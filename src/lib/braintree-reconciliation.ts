import { supabase } from './supabase';

export interface BraintreeTransaction {
    id: string;
    settlement_batch_id?: string;
    disbursement_id?: string;
    disbursement_date?: string | null;
    date: string;
    amount: number;
    settlement_amount?: number | null;
    settlement_currency_iso_code?: string | null;
    conciliado: boolean;
    destinationAccount: string | null;
    reconciliationType?: "automatic" | "manual" | null;

    // Informações do match bancário
    bank_match_id?: string | null;
    bank_match_date?: string | null;
    bank_match_amount?: number | null;
    bank_match_description?: string | null;

    [key: string]: any;
}

export interface ReconciliationResult {
    transactions: BraintreeTransaction[];
    autoReconciledCount: number;
    totalGroups: number;
    matchedGroups: number;
}

/**
 * Reconciliação automática de transações Braintree com extratos bancários
 * @param braintreeRows - Transações Braintree a reconciliar
 * @param bankSource - Fonte do banco (bankinter-eur, bankinter-usd, bankinter-gbp)
 * @param targetAccount - Nome da conta de destino (Bankinter EUR, Bankinter USD, etc)
 * @returns Resultado da reconciliação com estatísticas
 */
export async function reconcileWithBank(
    braintreeRows: BraintreeTransaction[],
    bankSource: string,
    targetAccount: string
): Promise<ReconciliationResult> {
    console.log(`[Reconciliation] Starting reconciliation with ${bankSource}...`);

    try {
        // Buscar extratos bancários dos últimos 2 anos
        const { data: bankStatements, error } = await supabase
            .from("csv_rows")
            .select("*")
            .eq("source", bankSource)
            .gte("date", "2024-01-01")
            .order("date", { ascending: false });

        if (error || !bankStatements) {
            console.error(`[Reconciliation] Error loading ${bankSource}:`, error);
            return {
                transactions: braintreeRows,
                autoReconciledCount: 0,
                totalGroups: 0,
                matchedGroups: 0,
            };
        }

        console.log(`[Reconciliation] Found ${bankStatements.length} bank statements`);

        // Agrupar Braintree por settlement_batch_id
        const groups = new Map<string, BraintreeTransaction[]>();
        braintreeRows.forEach(tx => {
            const batchId = tx.settlement_batch_id || tx.disbursement_id || 'ungrouped';
            if (!groups.has(batchId)) {
                groups.set(batchId, []);
            }
            groups.get(batchId)!.push(tx);
        });

        console.log(`[Reconciliation] Grouped into ${groups.size} disbursement batches`);

        const reconciledRows: BraintreeTransaction[] = [];
        let autoReconciledCount = 0;
        let matchedGroupsCount = 0;
        const totalGroups = groups.size;

        // Para cada grupo, buscar match no banco
        groups.forEach((groupTxs, batchId) => {
            if (batchId === 'ungrouped') {
                reconciledRows.push(...groupTxs);
                return;
            }

            const firstTx = groupTxs[0];
            const disbursementDate = firstTx.disbursement_date;

            // Calcular total esperado (usar settlement_amount que já é líquido)
            const expectedAmount = groupTxs.reduce((sum, tx) =>
                sum + (tx.settlement_amount || tx.amount), 0
            );

            console.log(`[Reconciliation] Group ${batchId}: ${groupTxs.length} txs, expected: ${expectedAmount.toFixed(2)}`);

            // Buscar match no banco (mesmo dia ou ±2 dias)
            const match = bankStatements.find(stmt => {
                const stmtDate = new Date(stmt.date);
                const txDate = new Date(disbursementDate || firstTx.date);
                const dayDiff = Math.abs(
                    (stmtDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)
                );

                // Match por valor (±2€ de tolerância para FX rounding)
                const amountMatch = Math.abs(parseFloat(stmt.amount) - expectedAmount) < 2;

                // Match por descrição (PayPal Europe, Braintree, PP, etc)
                const descLower = (stmt.description || '').toLowerCase();
                const descMatch = descLower.includes('paypal') ||
                    descLower.includes('braintree') ||
                    descLower.includes('pp ') ||
                    descLower.includes('pp.') ||
                    descLower.includes('trans/paypal');

                const dateMatch = dayDiff <= 2;

                if (dateMatch && amountMatch && descMatch) {
                    console.log(`[Reconciliation] ✅ Match found! Bank: ${stmt.date} ${stmt.amount} "${stmt.description}"`);
                    return true;
                }

                return false;
            });

            // Atualizar transações com informações do match
            groupTxs.forEach(tx => {
                if (match && !tx.conciliado) {
                    reconciledRows.push({
                        ...tx,
                        conciliado: true,
                        destinationAccount: targetAccount,
                        reconciliationType: 'automatic',
                        bank_match_id: match.id,
                        bank_match_date: match.date,
                        bank_match_amount: parseFloat(match.amount),
                        bank_match_description: match.description,
                    });
                    autoReconciledCount++;
                } else {
                    reconciledRows.push(tx);
                }
            });

            if (match) {
                matchedGroupsCount++;
            }
        });

        console.log(`[Reconciliation] Auto-reconciled ${autoReconciledCount} transactions (${matchedGroupsCount}/${totalGroups} groups)`);

        // Salvar reconciliações automáticas no banco
        if (autoReconciledCount > 0) {
            const toUpdate = reconciledRows.filter(tx =>
                tx.conciliado &&
                tx.reconciliationType === 'automatic' &&
                !braintreeRows.find(original => original.id === tx.id && original.conciliado)
            );

            console.log(`[Reconciliation] Saving ${toUpdate.length} new reconciliations...`);

            for (const tx of toUpdate) {
                const { error: updateError } = await supabase
                    .from("csv_rows")
                    .update({
                        custom_data: {
                            ...tx,
                            conciliado: true,
                            destinationAccount: targetAccount,
                            reconciliationType: 'automatic',
                            bank_match_id: tx.bank_match_id,
                            bank_match_date: tx.bank_match_date,
                            bank_match_amount: tx.bank_match_amount,
                            bank_match_description: tx.bank_match_description,
                        },
                    })
                    .eq("id", tx.id);

                if (updateError) {
                    console.error(`[Reconciliation] Error updating tx ${tx.id}:`, updateError);
                }
            }

            console.log(`[Reconciliation] ✅ Saved ${toUpdate.length} reconciliations to database`);
        }

        return {
            transactions: reconciledRows,
            autoReconciledCount,
            totalGroups: totalGroups - 1, // Excluir 'ungrouped'
            matchedGroups: matchedGroupsCount,
        };
    } catch (error) {
        console.error(`[Reconciliation] Error reconciling with ${bankSource}:`, error);
        return {
            transactions: braintreeRows,
            autoReconciledCount: 0,
            totalGroups: 0,
            matchedGroups: 0,
        };
    }
}

/**
 * Determinar qual banco usar para reconciliação baseado na settlement currency
 * USD/GBP geralmente vão para Bankinter EUR (cross-currency)
 * EUR vai para Bankinter EUR
 */
export function getBankSourceForCurrency(
    settlementCurrency: string | null,
    transactionCurrency: string | null
): { bankSource: string; targetAccount: string } {
    const currency = settlementCurrency || transactionCurrency || 'EUR';

    // Por padrão, tudo vai para Bankinter EUR (descoberta do usuário)
    // USD → EUR, GBP → EUR, EUR → EUR
    if (currency.toUpperCase() === 'EUR') {
        return {
            bankSource: 'bankinter-eur',
            targetAccount: 'Bankinter EUR',
        };
    }

    // Fallback para moedas específicas (caso haja depósitos diretos)
    if (currency.toUpperCase() === 'USD') {
        return {
            bankSource: 'bankinter-usd',
            targetAccount: 'Bankinter USD',
        };
    }

    if (currency.toUpperCase() === 'GBP') {
        return {
            bankSource: 'bankinter-gbp',
            targetAccount: 'Bankinter GBP',
        };
    }

    // Default
    return {
        bankSource: 'bankinter-eur',
        targetAccount: 'Bankinter EUR',
    };
}
