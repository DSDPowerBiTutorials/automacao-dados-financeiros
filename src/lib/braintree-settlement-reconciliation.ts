/**
 * 🤝 RECONCILIAÇÃO AUTOMÁTICA: Braintree Settlement Batches ↔ Bankinter
 * 
 * Reconcilia automaticamente settlement batches do Braintree com ingressos
 * correspondentes nas contas bancárias Bankinter (EUR, USD, GBP, AUD).
 * 
 * Lógica de Match:
 * 1. Agrupa transações Braintree por settlement_batch_id
 * 2. Calcula total líquido do batch
 * 3. Busca no Bankinter: data ±3 dias, valor ±0.10 de tolerância
 * 4. Marca ambos como conciliados (bidirectional)
 */

import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { parseDateUTC } from "@/lib/formatters";
import { SupabaseClient } from "@supabase/supabase-js";

interface SettlementBatch {
    batchId: string;
    transactions: any[];
    totalAmount: number;
    disbursementDate: string;
    currency: 'EUR' | 'USD' | 'GBP' | 'AUD';
    merchantAccount: string;
}

interface BankMatch {
    id: string;
    date: string;
    amount: number;
    description: string;
    source: string;
    custom_data?: Record<string, any> | null;
}

/**
 * Resolve o valor líquido que realmente liquida no banco (disbursement/net)
 */
function resolvePayoutAmount(t: any): number {
    const cd = t.custom_data || {};
    const candidates = [
        cd.settlement_disbursement_amount,
        cd.settlement_disbursement_total,
        cd.disbursement_settlement_amount,
        cd.disbursement_total_amount,
        cd.disbursement_amount,
        cd.settlement_amount,
        t.settlement_amount,
        t.amount,
    ];

    const found = candidates
        .map((v) => (typeof v === 'string' ? parseFloat(v) : v))
        .find((v) => typeof v === 'number' && !Number.isNaN(v));

    return Math.abs(found ?? 0);
}

/**
 * Resolve a data de liquidação/disbursement
 */
function resolveDisbursementDate(t: any): string | undefined {
    const cd = t.custom_data || {};
    const dateStr =
        cd.disbursement_date ||
        cd.settlement_date ||
        t.disbursement_date ||
        t.settlement_date;

    return dateStr ? dateStr.split('T')[0] : undefined;
}

/**
 * Adicionar/subtrair dias de uma data
 */
function addDays(dateStr: string, days: number): string {
    const date = parseDateUTC(dateStr);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().split('T')[0];
}

/**
 * Verifica se dois valores são aproximadamente iguais (tolerância de 0.10)
 */
function isAmountMatch(amount1: number, amount2: number, tolerance = 0.10): boolean {
    return Math.abs(amount1 - amount2) <= tolerance;
}

/**
 * Busca transação correspondente no Bankinter
 */
async function findBankMatch(
    batch: SettlementBatch,
    client: SupabaseClient = supabaseAdmin || supabase
): Promise<BankMatch | null> {
    const bankSource = `bankinter-${batch.currency.toLowerCase()}`;

    const startDate = addDays(batch.disbursementDate, -3);
    const endDate = addDays(batch.disbursementDate, 3);

    console.log(`[Auto-Reconcile] Searching ${bankSource} between ${startDate} and ${endDate} for amount ${batch.totalAmount}`);

    try {
        const { data: bankRows, error } = await client
            .from('csv_rows')
            .select('*')
            .eq('source', bankSource)
            .or('reconciled.is.null,reconciled.eq.false') // inclui null como não conciliado
            .gte('date', startDate)
            .lte('date', endDate);

        if (error) {
            console.error('[Auto-Reconcile] Error querying bank:', error);
            return null;
        }

        if (!bankRows || bankRows.length === 0) {
            console.log('[Auto-Reconcile] No bank transactions found in date range');
            return null;
        }

        console.log(`[Auto-Reconcile] Found ${bankRows.length} candidates in ${bankSource}`);

        // Procurar match exato ou aproximado
        for (const row of bankRows) {
            const bankAmount = Math.abs(parseFloat(row.amount) || 0);

            if (isAmountMatch(bankAmount, batch.totalAmount)) {
                console.log(`[Auto-Reconcile] ✅ Match found! Bank: ${bankAmount}, Batch: ${batch.totalAmount}`);
                return {
                    id: row.id,
                    date: row.date,
                    amount: bankAmount,
                    description: row.description || '',
                    source: row.source,
                    custom_data: row.custom_data || {},
                };
            }
        }

        console.log('[Auto-Reconcile] No amount match found');
        return null;
    } catch (error) {
        console.error('[Auto-Reconcile] Unexpected error:', error);
        return null;
    }
}

/**
 * Reconcilia um settlement batch com entrada bancária
 */
export async function reconcileSettlementBatch(
    batch: SettlementBatch,
    client: SupabaseClient = supabaseAdmin || supabase
): Promise<{ success: boolean; matchId?: string; error?: string }> {
    try {
        // 1. Buscar match no Bankinter
        const bankMatch = await findBankMatch(batch, client);

        if (!bankMatch) {
            return {
                success: false,
                error: 'No matching bank transaction found'
            };
        }

        // 2. Atualizar todas as transações do batch Braintree → Bank
        const braintreeUpdates = batch.transactions.map(async (transaction) => {
            const { error } = await supabaseAdmin
                .from('csv_rows')
                .update({
                    reconciled: true, // ✅ Usar 'reconciled' não 'conciliado'
                    custom_data: {
                        ...(transaction.custom_data || {}),
                        destinationAccount: `Bankinter ${batch.currency}`,
                        reconciliationType: 'automatic',
                        bank_match_id: bankMatch.id,
                        bank_match_date: bankMatch.date,
                        bank_match_amount: bankMatch.amount,
                        bank_match_description: bankMatch.description,
                        settlement_batch_id: transaction.custom_data?.settlement_batch_id || batch.batchId,
                        disbursement_date: transaction.custom_data?.disbursement_date || batch.disbursementDate,
                        reconciled_at: new Date().toISOString(),
                    }
                })
                .eq('id', transaction.id);

            if (error) {
                console.error(`[Auto-Reconcile] Error updating Braintree transaction ${transaction.id}:`, error);
                return false;
            }
            return true;
        });

        const braintreeResults = await Promise.all(braintreeUpdates);
        const allBraintreeSuccess = braintreeResults.every(r => r === true);

        if (!allBraintreeSuccess) {
            return {
                success: false,
                error: 'Failed to update some Braintree transactions'
            };
        }

        // 3. Atualizar entrada bancária Bank → Braintree
        const { error: bankError } = await supabaseAdmin
            .from('csv_rows')
            .update({
                reconciled: true,
                custom_data: {
                    ...(bankMatch.custom_data || {}),
                    destinationAccount: `Braintree ${batch.currency}`,
                    paymentSource: `Braintree ${batch.currency}`,
                    reconciliationType: 'automatic',
                    braintree_settlement_batch_id: batch.batchId,
                    braintree_transaction_count: batch.transactions.length,
                    bank_match_amount: batch.totalAmount,
                    bank_match_date: batch.disbursementDate,
                    bank_match_description: `Settlement batch ${batch.batchId}`,
                    reconciled_at: new Date().toISOString(),
                }
            })
            .eq('id', bankMatch.id);

        if (bankError) {
            console.error('[Auto-Reconcile] Error updating bank transaction:', bankError);
            // Rollback? (complicado, deixar manual por enquanto)
            return {
                success: false,
                error: 'Failed to update bank transaction'
            };
        }

        console.log(`✅ [Auto-Reconcile] Successfully reconciled batch ${batch.batchId} with bank ${bankMatch.id}`);

        return {
            success: true,
            matchId: bankMatch.id,
        };
    } catch (error: any) {
        console.error('[Auto-Reconcile] Unexpected error:', error);
        return {
            success: false,
            error: error.message || 'Unexpected error'
        };
    }
}

/**
 * Reconcilia múltiplos batches de uma vez
 */
export async function reconcileAllSettlementBatches(
    batches: SettlementBatch[],
    client: SupabaseClient = supabaseAdmin || supabase
): Promise<{
    total: number;
    reconciled: number;
    failed: number;
    results: Array<{ batchId: string; success: boolean; error?: string }>;
}> {
    const results = [];
    let reconciled = 0;
    let failed = 0;

    for (const batch of batches) {
        const result = await reconcileSettlementBatch(batch, client);

        results.push({
            batchId: batch.batchId,
            success: result.success,
            error: result.error,
        });

        if (result.success) {
            reconciled++;
        } else {
            failed++;
        }
    }

    return {
        total: batches.length,
        reconciled,
        failed,
        results,
    };
}

/**
 * Prepara batches de transações Braintree para reconciliação
 */
export function prepareSettlementBatches(
    transactions: any[],
    currency: 'EUR' | 'USD' | 'GBP' | 'AUD'
): SettlementBatch[] {
    // Agrupar por settlement_batch_id
    const batchMap = new Map<string, any[]>();

    transactions.forEach(t => {
        const batchId = t.settlement_batch_id || t.custom_data?.settlement_batch_id;
        if (!batchId || batchId === 'no-batch') return;

        if (!batchMap.has(batchId)) {
            batchMap.set(batchId, []);
        }
        batchMap.get(batchId)!.push(t);
    });

    // Converter para array de batches
    const batches: SettlementBatch[] = [];

    batchMap.forEach((txs, batchId) => {
        // Usa valor líquido que realmente cai no banco
        const totalAmount = txs.reduce((sum, t) => sum + resolvePayoutAmount(t), 0);

        const disbursementDate =
            resolveDisbursementDate(txs[0]) ||
            batchId.split('_')[0]; // fallback: data no próprio batch_id
        const merchantAccount = txs[0]?.merchant_account_id || txs[0]?.custom_data?.merchant_account_id;

        if (!disbursementDate) {
            console.warn(`[Prepare Batches] Batch ${batchId} has no disbursement_date, skipping`);
            return;
        }

        batches.push({
            batchId,
            transactions: txs,
            totalAmount,
            disbursementDate: disbursementDate.split('T')[0], // Apenas data
            currency,
            merchantAccount: merchantAccount || 'unknown',
        });
    });

    return batches;
}
