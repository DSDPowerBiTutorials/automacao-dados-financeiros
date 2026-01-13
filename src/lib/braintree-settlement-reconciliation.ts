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

function parseAmount(value: any): number | null {
    if (value == null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    if (typeof value !== 'string') {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    let s = value.trim();
    if (!s) return null;

    // Mantém apenas dígitos, sinais e separadores comuns
    s = s.replace(/[^0-9,.-]/g, '');
    if (!s) return null;

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    if (hasComma && hasDot) {
        // Decide o separador decimal pelo último que aparece
        const lastComma = s.lastIndexOf(',');
        const lastDot = s.lastIndexOf('.');

        if (lastComma > lastDot) {
            // Formato europeu: 1.234,56
            s = s.replace(/\./g, '').replace(/,/g, '.');
        } else {
            // Formato US: 1,234.56
            s = s.replace(/,/g, '');
        }
    } else if (hasComma) {
        // 1234,56
        s = s.replace(/,/g, '.');
    }

    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
}

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
 * Resolve o valor líquido que realmente liquida no banco (disbursement/net).
 * Importante: manter o sinal.
 */
function resolvePayoutAmountDetailed(t: any): { amount: number; from: 'payout' | 'amount' } {
    const cd = t.custom_data || {};
    const candidates = [
        cd.settlement_disbursement_amount,
        cd.settlement_disbursement_total,
        cd.disbursement_settlement_amount,
        cd.disbursement_total_amount,
        cd.disbursement_amount,
        cd.settlement_amount,
        t.settlement_amount,
    ];

    const found = candidates
        .map((v) => parseAmount(v))
        .find((v) => typeof v === 'number' && Number.isFinite(v) && v !== 0);

    if (typeof found === 'number') {
        return { amount: found, from: 'payout' };
    }

    const raw = parseAmount(t.amount);
    const fallback = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    return { amount: fallback, from: 'amount' };
}

function resolvePayoutAmount(t: any): number {
    return resolvePayoutAmountDetailed(t).amount;
}

function roundToCents(n: number): number {
    return Math.round(n * 100) / 100;
}

function modeByCents(values: number[]): { value: number; count: number } | null {
    if (!values.length) return null;
    const counts = new Map<number, number>();
    for (const v of values) {
        const key = roundToCents(v);
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    let best: { value: number; count: number } | null = null;
    for (const [value, count] of counts.entries()) {
        if (!best || count > best.count) best = { value, count };
    }
    return best;
}

/**
 * Resolve o total do batch evitando somas erradas.
 * Em alguns exports, um "total líquido" pode se repetir em múltiplas linhas do mesmo batch;
 * somar essas linhas multiplica o valor e quebra o match com o banco.
 */
function resolveBatchTotalAmount(transactions: any[]): number {
    const batchLevelCandidates: number[] = [];

    for (const t of transactions) {
        const cd = t.custom_data || {};
        const candidates = [
            cd.settlement_disbursement_total,
            cd.settlement_disbursement_amount,
            cd.disbursement_total_amount,
            cd.disbursement_settlement_amount,
            cd.disbursement_amount,
        ];
        for (const c of candidates) {
            const n = parseAmount(c);
            if (typeof n === 'number' && Number.isFinite(n) && n !== 0) batchLevelCandidates.push(n);
        }
    }

    const batchMode = modeByCents(batchLevelCandidates);
    if (batchMode) {
        return batchMode.value;
    }

    const perTx = transactions
        .map(resolvePayoutAmountDetailed)
        .filter((x) => typeof x.amount === 'number' && Number.isFinite(x.amount) && x.amount !== 0);

    if (!perTx.length) return 0;

    const amounts = perTx.map((x) => x.amount);
    const sum = amounts.reduce((a, b) => a + b, 0);

    // Se todos vieram do fallback "amount", não aplicamos heurística de mode
    // (senão podemos errar quando várias transações têm o mesmo valor).
    const hasPayoutSignals = perTx.some((x) => x.from === 'payout');
    if (!hasPayoutSignals) return sum;

    const m = modeByCents(amounts);
    if (m && m.count >= 2 && m.count / perTx.length >= 0.6) {
        return m.value;
    }

    return sum;
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
function resolveTolerance(amount: number): number {
    // tolerância dinâmica: pelo menos 0.10, ou 0.25% do valor
    return Math.max(0.1, Math.abs(amount) * 0.0025);
}

function isAmountMatch(amount1: number, amount2: number, tolerance?: number): boolean {
    const tol = tolerance ?? resolveTolerance(amount2);
    // aceita match com mesmo sinal OU com sinal invertido (alguns extratos vêm com convenção invertida)
    const direct = Math.abs(amount1 - amount2) <= tol;
    const absCompare = Math.abs(Math.abs(amount1) - Math.abs(amount2)) <= tol;
    return direct || absCompare;
}

function normalizeText(s: string): string {
    return (s || '').toLowerCase();
}

function isLikelyBraintreeDescription(desc?: string): boolean {
    const d = normalizeText(desc || '');
    return d.includes('braintree') || d.includes('bt ') || d.includes('paypal *braintree') || d.includes('braintreepayments');
}

function dateDistanceDays(a: string, b: string): number {
    const da = parseDateUTC(a);
    const db = parseDateUTC(b);
    return Math.abs(Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Busca transação correspondente no Bankinter
 */
async function findBankMatch(
    batch: SettlementBatch,
    client: SupabaseClient = supabaseAdmin || supabase
): Promise<{
    match: BankMatch | null;
    diagnostics: {
        candidates: number;
        closestDiff?: number;
        closestId?: string;
        tolerance?: number;
        startDate?: string;
        endDate?: string;
    };
}> {
    const bankSource = `bankinter-${batch.currency.toLowerCase()}`;

    const startDate = addDays(batch.disbursementDate, -5);
    const endDate = addDays(batch.disbursementDate, 5);

    console.log(`[Auto-Reconcile] Searching ${bankSource} between ${startDate} and ${endDate} for amount ${batch.totalAmount}`);

    try {
        // Nota: PostgREST não facilita (A between X and Y) OR (B between X and Y) mantendo AND com reconciled.
        // Fazemos duas queries pequenas e juntamos por id.
        const baseSelect = 'id,date,amount,description,source,custom_data,reconciled';

        const [byFecha, byDate] = await Promise.all([
            client
                .from('csv_rows')
                .select(baseSelect)
                .eq('source', bankSource)
                .or('reconciled.is.null,reconciled.eq.false')
                .gte('custom_data->>fecha_contable_iso', startDate)
                .lte('custom_data->>fecha_contable_iso', endDate),
            client
                .from('csv_rows')
                .select(baseSelect)
                .eq('source', bankSource)
                .or('reconciled.is.null,reconciled.eq.false')
                .gte('date', startDate)
                .lte('date', endDate),
        ]);

        const error = byFecha.error || byDate.error;
        const rowsA = byFecha.data || [];
        const rowsB = byDate.data || [];

        if (error) {
            console.error('[Auto-Reconcile] Error querying bank:', error);
            return null;
        }

        const mergedById = new Map<string, any>();
        for (const r of rowsA) mergedById.set(r.id, r);
        for (const r of rowsB) mergedById.set(r.id, r);
        const bankRows = Array.from(mergedById.values());

        if (!bankRows || bankRows.length === 0) {
            console.log('[Auto-Reconcile] No bank transactions found in date range');
            return { match: null, diagnostics: { candidates: 0, startDate, endDate } };
        }

        console.log(`[Auto-Reconcile] Found ${bankRows.length} candidates in ${bankSource}`);

        const tol = resolveTolerance(batch.totalAmount);

        let best: { row: any; score: number; diff: number } | null = null;
        let closestDiff = Number.POSITIVE_INFINITY;
        let closestId: string | undefined;

        for (const row of bankRows) {
            const rawBankAmount = parseAmount(row.amount);
            const bankAmount = typeof rawBankAmount === 'number' && Number.isFinite(rawBankAmount) ? rawBankAmount : 0;
            const bankDate = row.custom_data?.fecha_contable_iso || row.custom_data?.fecha_contable || row.date;

            const directDiff = Math.abs(bankAmount - batch.totalAmount);
            const absDiff = Math.abs(Math.abs(bankAmount) - Math.abs(batch.totalAmount));
            const diff = Math.min(directDiff, absDiff);

            if (diff < closestDiff) {
                closestDiff = diff;
                closestId = row.id;
            }

            if (!isAmountMatch(bankAmount, batch.totalAmount, tol)) continue;

            const days = dateDistanceDays(batch.disbursementDate, bankDate);
            const braintreeBoost = isLikelyBraintreeDescription(row.description) ? -2 : 0;

            // score: menor é melhor
            const score = diff * 10 + days + braintreeBoost;

            if (!best || score < best.score) {
                best = { row, score, diff };
            }
        }

        if (!best) {
            console.log('[Auto-Reconcile] No amount match found');
            return {
                match: null,
                diagnostics: { candidates: bankRows.length, closestDiff, closestId, tolerance: tol, startDate, endDate },
            };
        }

        const bankDate = best.row.custom_data?.fecha_contable_iso || best.row.custom_data?.fecha_contable || best.row.date;
        const rawAmount = parseAmount(best.row.amount);
        const bankAmount = typeof rawAmount === 'number' && Number.isFinite(rawAmount) ? rawAmount : 0;

        console.log(`[Auto-Reconcile] ✅ Match found! Bank: ${bankAmount}, Batch: ${batch.totalAmount} (tol=${tol})`);
        return {
            match: {
                id: best.row.id,
                date: bankDate,
                amount: bankAmount,
                description: best.row.description || '',
                source: best.row.source,
                custom_data: best.row.custom_data || {},
            },
            diagnostics: { candidates: bankRows.length, closestDiff: best.diff, closestId: best.row.id, tolerance: tol, startDate, endDate },
        };
    } catch (error) {
        console.error('[Auto-Reconcile] Unexpected error:', error);
        return { match: null, diagnostics: { candidates: 0 } };
    }
}

/**
 * Reconcilia um settlement batch com entrada bancária
 */
export async function reconcileSettlementBatch(
    batch: SettlementBatch,
    client: SupabaseClient = supabaseAdmin || supabase
    , options: { dryRun?: boolean } = {}
): Promise<{ success: boolean; matchId?: string; error?: string; diagnostics?: any }> {
    try {
        // 1. Buscar match no Bankinter
        const { match: bankMatch, diagnostics } = await findBankMatch(batch, client);

        if (!bankMatch) {
            return {
                success: false,
                error: 'No matching bank transaction found',
                diagnostics
            };
        }

        if (options.dryRun) {
            return {
                success: true,
                matchId: bankMatch.id,
                diagnostics,
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
    , options: { dryRun?: boolean } = {}
): Promise<{
    total: number;
    reconciled: number;
    failed: number;
    results: Array<{ batchId: string; success: boolean; error?: string; diagnostics?: any }>;
}> {
    const results = [];
    let reconciled = 0;
    let failed = 0;

    for (const batch of batches) {
        const result = await reconcileSettlementBatch(batch, client, options);

        results.push({
            batchId: batch.batchId,
            success: result.success,
            error: result.error,
            diagnostics: result.diagnostics,
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
        // Usa valor líquido que realmente cai no banco (com heurística para evitar multiplicação)
        const totalAmount = resolveBatchTotalAmount(txs);

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
