/**
 * API Endpoint: Reconciliação em Cadeia - Web Orders → Braintree → Disbursement → Banco
 * 
 * POST /api/reconcile/disbursement-chain
 * 
 * Este endpoint reconcilia a cadeia completa:
 * 1. Web Orders (ar_invoices) já reconciliadas com Braintree
 * 2. Braintree transactions agrupadas por disbursement_id
 * 3. Disbursements vinculados a transações bancárias
 * 
 * Fluxo:
 * ar_invoices (order_id) → csv_rows/braintree (transaction_id) → 
 * csv_rows/disbursement (transaction_ids[]) → csv_rows/bankinter (amount match)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface DisbursementRecord {
    id: string;
    date: string;
    amount: number;
    disbursement_id: string;
    merchant_account_id: string;
    currency: string;
    transaction_ids: string[];
}

interface BraintreeTransaction {
    id: string;
    date: string;
    amount: number;
    transaction_id: string;
    order_id: string | null;
    disbursement_date: string | null;
    settlement_batch_id: string | null;
    merchant_account_id: string;
}

interface BankRow {
    id: string;
    date: string;
    amount: number;
    description: string;
    reconciled: boolean;
}

interface ChainMatch {
    disbursement_id: string;
    disbursement_date: string;
    disbursement_amount: number;
    currency: string;
    braintree_transactions: {
        id: string;
        transaction_id: string;
        order_id: string | null;
        amount: number;
    }[];
    web_orders: {
        id: number;
        order_id: string;
        client_name: string;
        amount: number;
    }[];
    bank_match: {
        id: string;
        date: string;
        amount: number;
        description: string;
    } | null;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const dryRun = body.dryRun !== false;
        const currency = body.currency || 'EUR';
        const bankSource = currency === 'EUR' ? 'bankinter-eur' : 'bankinter-usd';
        const merchantFilter = currency === 'EUR' ? 'digitalsmiledesignEUR' : 'digitalsmiledesignUSD';

        // 1. Buscar todos os disbursements do Braintree
        const { data: disbursementRows, error: disbError } = await supabaseAdmin
            .from('csv_rows')
            .select('*')
            .eq('source', 'braintree-api-disbursement')
            .order('date', { ascending: false })
            .limit(500);

        if (disbError) throw new Error(`Erro ao buscar disbursements: ${disbError.message}`);

        const disbursements: DisbursementRecord[] = (disbursementRows || [])
            .filter(d => {
                const cd = d.custom_data || {};
                return cd.merchant_account_id === merchantFilter;
            })
            .map(d => {
                const cd = d.custom_data || {};
                return {
                    id: d.id,
                    date: d.date,
                    amount: parseFloat(d.amount),
                    disbursement_id: cd.disbursement_id,
                    merchant_account_id: cd.merchant_account_id,
                    currency: cd.currency || currency,
                    transaction_ids: cd.transaction_ids || []
                };
            });

        // 2. Buscar transações Braintree com disbursement_date
        const { data: braintreeTxs, error: btError } = await supabaseAdmin
            .from('csv_rows')
            .select('*')
            .eq('source', 'braintree-api-revenue')
            .order('date', { ascending: false })
            .limit(5000);

        if (btError) throw new Error(`Erro ao buscar transações Braintree: ${btError.message}`);

        const braintreeByTxId = new Map<string, BraintreeTransaction>();
        const braintreeByOrderId = new Map<string, BraintreeTransaction>();

        (braintreeTxs || []).forEach(tx => {
            const cd = tx.custom_data || {};
            if (cd.merchant_account_id !== merchantFilter) return;

            const btTx: BraintreeTransaction = {
                id: tx.id,
                date: tx.date,
                amount: parseFloat(tx.amount),
                transaction_id: cd.transaction_id,
                order_id: cd.order_id || null,
                disbursement_date: cd.disbursement_date || null,
                settlement_batch_id: cd.settlement_batch_id || null,
                merchant_account_id: cd.merchant_account_id
            };

            if (cd.transaction_id) {
                braintreeByTxId.set(cd.transaction_id, btTx);
            }
            if (cd.order_id) {
                braintreeByOrderId.set(cd.order_id, btTx);
            }
        });

        // 3. Buscar Web Orders (ar_invoices) reconciliadas com Braintree
        const { data: arInvoices, error: arError } = await supabaseAdmin
            .from('ar_invoices')
            .select('*')
            .eq('source', 'hubspot')
            .eq('currency', currency)
            .not('order_id', 'is', null)
            .order('order_date', { ascending: false })
            .limit(1000);

        if (arError) throw new Error(`Erro ao buscar ar_invoices: ${arError.message}`);

        const arByOrderId = new Map<string, any>();
        (arInvoices || []).forEach(inv => {
            if (inv.order_id) {
                arByOrderId.set(inv.order_id, inv);
            }
        });

        // 4. Buscar transações bancárias não reconciliadas (créditos = Trans/paypal)
        const { data: bankRows, error: bankError } = await supabaseAdmin
            .from('csv_rows')
            .select('*')
            .eq('source', bankSource)
            .eq('reconciled', false)
            .gt('amount', 0) // Apenas créditos
            .order('date', { ascending: false })
            .limit(1000);

        if (bankError) throw new Error(`Erro ao buscar extrato bancário: ${bankError.message}`);

        // Filtrar apenas transações PayPal/Braintree
        const paypalBankRows: BankRow[] = (bankRows || [])
            .filter(row => {
                const desc = (row.description || '').toLowerCase();
                return desc.includes('paypal') || desc.includes('braintree');
            })
            .map(row => ({
                id: row.id,
                date: row.date,
                amount: parseFloat(row.amount),
                description: row.description,
                reconciled: row.reconciled || false
            }));

        // 5. Para cada disbursement, montar a cadeia completa
        const chainMatches: ChainMatch[] = [];
        const matchedBankIds = new Set<string>();
        const matchedDisbursementIds = new Set<string>();

        for (const disb of disbursements) {
            if (matchedDisbursementIds.has(disb.disbursement_id)) continue;

            // Encontrar transações Braintree deste disbursement
            const relatedBtTxs = disb.transaction_ids
                .map(txId => braintreeByTxId.get(txId))
                .filter(Boolean) as BraintreeTransaction[];

            // Encontrar web orders correspondentes
            const relatedOrders = relatedBtTxs
                .filter(tx => tx.order_id)
                .map(tx => {
                    const arInv = arByOrderId.get(tx.order_id!);
                    if (arInv) {
                        return {
                            id: arInv.id,
                            order_id: arInv.order_id,
                            client_name: arInv.client_name || 'N/A',
                            amount: arInv.total_amount
                        };
                    }
                    return null;
                })
                .filter(Boolean) as { id: number; order_id: string; client_name: string; amount: number }[];

            // Encontrar transação bancária correspondente
            let bankMatch: BankRow | null = null;
            const disbDate = disb.date?.split('T')[0];
            const disbAmount = Math.round(disb.amount * 100) / 100;

            // Match exato: mesmo valor (±0.10)
            for (const bankRow of paypalBankRows) {
                if (matchedBankIds.has(bankRow.id)) continue;

                const bankDate = bankRow.date?.split('T')[0];
                const bankAmount = Math.round(bankRow.amount * 100) / 100;

                // Match por valor exato
                if (Math.abs(bankAmount - disbAmount) < 0.10) {
                    // Verificar se a data está dentro de ±3 dias
                    const disbDateObj = new Date(disbDate);
                    const bankDateObj = new Date(bankDate);
                    const daysDiff = Math.abs((disbDateObj.getTime() - bankDateObj.getTime()) / (1000 * 60 * 60 * 24));

                    if (daysDiff <= 3) {
                        bankMatch = bankRow;
                        matchedBankIds.add(bankRow.id);
                        break;
                    }
                }
            }

            if (relatedBtTxs.length > 0 || bankMatch) {
                chainMatches.push({
                    disbursement_id: disb.disbursement_id,
                    disbursement_date: disb.date,
                    disbursement_amount: disb.amount,
                    currency: disb.currency,
                    braintree_transactions: relatedBtTxs.map(tx => ({
                        id: tx.id,
                        transaction_id: tx.transaction_id,
                        order_id: tx.order_id,
                        amount: tx.amount
                    })),
                    web_orders: relatedOrders,
                    bank_match: bankMatch ? {
                        id: bankMatch.id,
                        date: bankMatch.date,
                        amount: bankMatch.amount,
                        description: bankMatch.description
                    } : null
                });

                matchedDisbursementIds.add(disb.disbursement_id);
            }
        }

        // 6. Aplicar reconciliações (se não for dry run)
        let stats = {
            disbursements_processed: chainMatches.length,
            bank_rows_reconciled: 0,
            braintree_txs_updated: 0,
            ar_invoices_updated: 0
        };

        if (!dryRun) {
            for (const chain of chainMatches) {
                // Reconciliar transação bancária
                if (chain.bank_match) {
                    // Buscar custom_data existente
                    const { data: existingBank } = await supabaseAdmin
                        .from('csv_rows')
                        .select('custom_data')
                        .eq('id', chain.bank_match.id)
                        .single();

                    const existingCustomData = existingBank?.custom_data || {};

                    const { error: bankUpdateError } = await supabaseAdmin
                        .from('csv_rows')
                        .update({
                            reconciled: true,
                            custom_data: {
                                ...existingCustomData,
                                disbursement_id: chain.disbursement_id,
                                disbursement_date: chain.disbursement_date,
                                disbursement_amount: chain.disbursement_amount,
                                reconciled_at: new Date().toISOString(),
                                reconciliation_type: 'disbursement-chain',
                                braintree_transactions: chain.braintree_transactions.length,
                                web_orders_count: chain.web_orders.length,
                                web_orders: chain.web_orders.map(o => o.order_id)
                            }
                        })
                        .eq('id', chain.bank_match.id);

                    if (!bankUpdateError) {
                        stats.bank_rows_reconciled++;
                    }
                }

                // Atualizar transações Braintree com info do banco
                for (const btTx of chain.braintree_transactions) {
                    const existingRow = await supabaseAdmin
                        .from('csv_rows')
                        .select('custom_data')
                        .eq('id', btTx.id)
                        .single();

                    const existingCustomData = existingRow.data?.custom_data || {};

                    const { error: btUpdateError } = await supabaseAdmin
                        .from('csv_rows')
                        .update({
                            custom_data: {
                                ...existingCustomData,
                                bank_reconciled: chain.bank_match ? true : false,
                                bank_row_id: chain.bank_match?.id || null,
                                bank_date: chain.bank_match?.date || null,
                                bank_amount: chain.bank_match?.amount || null,
                                bank_reconciled_at: chain.bank_match ? new Date().toISOString() : null
                            }
                        })
                        .eq('id', btTx.id);

                    if (!btUpdateError) {
                        stats.braintree_txs_updated++;
                    }
                }

                // Atualizar ar_invoices com info completa do fluxo (usando source_data JSONB)
                for (const order of chain.web_orders) {
                    // Buscar source_data existente
                    const { data: existingAr } = await supabaseAdmin
                        .from('ar_invoices')
                        .select('source_data')
                        .eq('id', order.id)
                        .single();

                    const existingSourceData = existingAr?.source_data || {};

                    const { error: arUpdateError } = await supabaseAdmin
                        .from('ar_invoices')
                        .update({
                            source_data: {
                                ...existingSourceData,
                                bank_reconciled: chain.bank_match ? true : false,
                                bank_row_id: chain.bank_match?.id || null,
                                bank_date: chain.bank_match?.date || null,
                                bank_amount: chain.bank_match?.amount || null,
                                bank_description: chain.bank_match?.description || null,
                                disbursement_id: chain.disbursement_id,
                                disbursement_date: chain.disbursement_date,
                                disbursement_amount: chain.disbursement_amount,
                                bank_reconciled_at: chain.bank_match ? new Date().toISOString() : null
                            },
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', order.id);

                    if (!arUpdateError) {
                        stats.ar_invoices_updated++;
                    }
                }
            }
        }

        // 7. Resumo
        const withBankMatch = chainMatches.filter(c => c.bank_match !== null);
        const withoutBankMatch = chainMatches.filter(c => c.bank_match === null);

        return NextResponse.json({
            success: true,
            dryRun,
            currency,
            summary: {
                total_disbursements: disbursements.length,
                chains_found: chainMatches.length,
                with_bank_match: withBankMatch.length,
                without_bank_match: withoutBankMatch.length,
                total_braintree_txs: chainMatches.reduce((acc, c) => acc + c.braintree_transactions.length, 0),
                total_web_orders: chainMatches.reduce((acc, c) => acc + c.web_orders.length, 0)
            },
            stats: dryRun ? null : stats,
            // Preview das primeiras 10 cadeias
            preview: chainMatches.slice(0, 10).map(c => ({
                disbursement_id: c.disbursement_id,
                date: c.disbursement_date,
                amount: c.disbursement_amount,
                braintree_count: c.braintree_transactions.length,
                orders_count: c.web_orders.length,
                orders: c.web_orders.map(o => `${o.order_id} (${o.client_name})`),
                bank_matched: c.bank_match ? {
                    date: c.bank_match.date,
                    amount: c.bank_match.amount,
                    description: c.bank_match.description?.substring(0, 40)
                } : null
            }))
        });
    } catch (error: any) {
        console.error('[Disbursement Chain] Error:', error);
        return NextResponse.json(
            { success: false, error: error?.message || 'Erro desconhecido' },
            { status: 500 }
        );
    }
}

// GET - Retorna estatísticas sem fazer alterações
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const currency = url.searchParams.get('currency') || 'EUR';

    try {
        // Simular POST com dryRun=true
        const mockReq = new NextRequest(req.url, {
            method: 'POST',
            body: JSON.stringify({ dryRun: true, currency })
        });

        return POST(mockReq);
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Erro desconhecido' },
            { status: 500 }
        );
    }
}
