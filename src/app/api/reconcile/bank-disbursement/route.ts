/**
 * API Endpoint: Reconciliação Automática Banco ↔ Disbursements
 * 
 * POST /api/reconcile/bank-disbursement
 * 
 * Reconcilia automaticamente extratos bancários (Bankinter EUR/USD) com disbursements de:
 * - Braintree (disbursement_date)
 * - Stripe (payout_date)
 * - GoCardless (payout)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface DisbursementInfo {
    source: string;
    date: string;
    amount: number;
    currency: string;
    reference: string;
    transaction_count?: number;
    merchant_account_id?: string;
}

interface BankRow {
    id: string;
    date: string;
    amount: number;
    description: string;
    reconciled: boolean;
    custom_data?: any;
}

interface Match {
    bank_row_id: string;
    bank_date: string;
    bank_amount: number;
    bank_description: string;
    disbursement_source: string;
    disbursement_date: string;
    disbursement_amount: number;
    disbursement_reference: string;
    match_type: string;
}

async function fetchBankRows(source: string): Promise<BankRow[]> {
    let all: any[] = [];
    let offset = 0;
    while (true) {
        const { data } = await supabaseAdmin
            .from('csv_rows')
            .select('*')
            .eq('source', source)
            .eq('reconciled', false)
            .gt('amount', 0) // Apenas créditos
            .order('date', { ascending: false })
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }
    return all.map(r => ({
        id: r.id,
        date: r.date,
        amount: parseFloat(r.amount),
        description: r.description || '',
        reconciled: r.reconciled || false,
        custom_data: r.custom_data || {}
    }));
}

async function fetchBraintreeDisbursements(): Promise<DisbursementInfo[]> {
    // Braintree armazena disbursement_date no custom_data de braintree-api-revenue
    const { data } = await supabaseAdmin
        .from('csv_rows')
        .select('*')
        .eq('source', 'braintree-api-revenue')
        .not('custom_data->disbursement_date', 'is', null)
        .order('date', { ascending: false })
        .limit(5000);

    if (!data) return [];

    // Agrupar por disbursement_date + merchant_account_id
    const grouped = new Map<string, { amount: number; count: number; merchant_account_id: string; batch_id: string }>();

    data.forEach(tx => {
        const cd = tx.custom_data || {};
        const disbDate = cd.disbursement_date?.split('T')[0];
        const merchantId = cd.merchant_account_id || '';
        if (!disbDate) return;

        const key = `${disbDate}|${merchantId}`;
        if (!grouped.has(key)) {
            grouped.set(key, {
                amount: 0,
                count: 0,
                merchant_account_id: merchantId,
                batch_id: cd.settlement_batch_id || ''
            });
        }
        const g = grouped.get(key)!;
        g.amount += parseFloat(cd.settlement_amount || tx.amount || 0);
        g.count++;
    });

    return Array.from(grouped.entries()).map(([key, val]) => {
        const [date, merchantId] = key.split('|');
        return {
            source: 'braintree',
            date,
            amount: Math.round(val.amount * 100) / 100,
            currency: merchantId.includes('EUR') ? 'EUR' : merchantId.includes('USD') ? 'USD' : 'EUR',
            reference: `braintree-disb-${date}`,
            transaction_count: val.count,
            merchant_account_id: merchantId
        };
    });
}

async function fetchStripeDisbursements(): Promise<DisbursementInfo[]> {
    // Stripe usa payouts - buscar em stripe-eur
    const { data } = await supabaseAdmin
        .from('csv_rows')
        .select('*')
        .eq('source', 'stripe-eur')
        .not('custom_data->payout_id', 'is', null)
        .order('date', { ascending: false })
        .limit(2000);

    if (!data) return [];

    // Agrupar por payout_id
    const grouped = new Map<string, { amount: number; date: string; count: number }>();

    data.forEach(tx => {
        const cd = tx.custom_data || {};
        const payoutId = cd.payout_id;
        const payoutDate = cd.payout_date?.split('T')[0] || tx.date?.split('T')[0];
        if (!payoutId) return;

        if (!grouped.has(payoutId)) {
            grouped.set(payoutId, { amount: 0, date: payoutDate, count: 0 });
        }
        const g = grouped.get(payoutId)!;
        g.amount += parseFloat(tx.amount || 0);
        g.count++;
    });

    return Array.from(grouped.entries()).map(([payoutId, val]) => ({
        source: 'stripe',
        date: val.date,
        amount: Math.round(val.amount * 100) / 100,
        currency: 'EUR',
        reference: payoutId,
        transaction_count: val.count
    }));
}

async function fetchGoCardlessDisbursements(): Promise<DisbursementInfo[]> {
    // GoCardless usa payouts
    const { data } = await supabaseAdmin
        .from('csv_rows')
        .select('*')
        .eq('source', 'gocardless')
        .not('custom_data->payout_id', 'is', null)
        .order('date', { ascending: false })
        .limit(2000);

    if (!data) return [];

    const grouped = new Map<string, { amount: number; date: string; count: number }>();

    data.forEach(tx => {
        const cd = tx.custom_data || {};
        const payoutId = cd.payout_id;
        const payoutDate = cd.payout_date?.split('T')[0] || tx.date?.split('T')[0];
        if (!payoutId) return;

        if (!grouped.has(payoutId)) {
            grouped.set(payoutId, { amount: 0, date: payoutDate, count: 0 });
        }
        const g = grouped.get(payoutId)!;
        g.amount += parseFloat(tx.amount || 0);
        g.count++;
    });

    return Array.from(grouped.entries()).map(([payoutId, val]) => ({
        source: 'gocardless',
        date: val.date,
        amount: Math.round(val.amount * 100) / 100,
        currency: 'EUR',
        reference: payoutId,
        transaction_count: val.count
    }));
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const dryRun = body.dryRun !== false;
        const bankSource = body.bankSource || 'bankinter-eur'; // bankinter-eur ou bankinter-usd

        // Buscar dados em paralelo
        const [bankRows, braintreeDisb, stripeDisb, gocardlessDisb] = await Promise.all([
            fetchBankRows(bankSource),
            fetchBraintreeDisbursements(),
            fetchStripeDisbursements(),
            fetchGoCardlessDisbursements()
        ]);

        // Filtrar disbursements por moeda
        const currency = bankSource.includes('usd') ? 'USD' : 'EUR';
        const allDisbursements = [
            ...braintreeDisb.filter(d => d.currency === currency),
            ...stripeDisb.filter(d => d.currency === currency),
            ...gocardlessDisb.filter(d => d.currency === currency)
        ];

        const matches: Match[] = [];
        const matchedBankIds = new Set<string>();
        const matchedDisbRefs = new Set<string>();
        const stats = { braintree: 0, stripe: 0, gocardless: 0 };

        // Criar índices para matching
        const disbByDate = new Map<string, DisbursementInfo[]>();
        const disbByAmount = new Map<number, DisbursementInfo[]>();

        allDisbursements.forEach(d => {
            // Index por data
            if (!disbByDate.has(d.date)) disbByDate.set(d.date, []);
            disbByDate.get(d.date)!.push(d);

            // Index por valor arredondado
            const amountKey = Math.round(d.amount);
            if (!disbByAmount.has(amountKey)) disbByAmount.set(amountKey, []);
            disbByAmount.get(amountKey)!.push(d);
        });

        // Match each bank row with disbursements
        for (const bankRow of bankRows) {
            if (matchedBankIds.has(bankRow.id)) continue;
            if (bankRow.amount <= 0) continue; // Skip debits

            let match: DisbursementInfo | null = null;
            let matchType: string | null = null;
            const bankDate = bankRow.date?.split('T')[0];
            const bankAmount = Math.round(bankRow.amount * 100) / 100;

            // 1. Exact match: same date + same amount (±0.10)
            const exactCandidates = (disbByDate.get(bankDate) || [])
                .filter(d => !matchedDisbRefs.has(d.reference));
            const exactMatch = exactCandidates.find(d =>
                Math.abs(d.amount - bankAmount) < 0.10
            );
            if (exactMatch) {
                match = exactMatch;
                matchType = 'exact_date_amount';
            }

            // 2. Date range match: ±3 days + same amount
            if (!match) {
                const bankDateObj = new Date(bankDate);
                for (let offset = -3; offset <= 3; offset++) {
                    if (offset === 0) continue;
                    const checkDate = new Date(bankDateObj);
                    checkDate.setDate(checkDate.getDate() + offset);
                    const checkDateStr = checkDate.toISOString().split('T')[0];

                    const candidates = (disbByDate.get(checkDateStr) || [])
                        .filter(d => !matchedDisbRefs.has(d.reference));
                    const rangeMatch = candidates.find(d =>
                        Math.abs(d.amount - bankAmount) < 0.10
                    );
                    if (rangeMatch) {
                        match = rangeMatch;
                        matchType = 'date_range_amount';
                        break;
                    }
                }
            }

            // 3. Description-based match (Braintree, Stripe, GoCardless in description)
            if (!match) {
                const descLower = bankRow.description.toLowerCase();
                const descPatterns = [
                    { pattern: 'braintree', source: 'braintree' },
                    { pattern: 'paypal braintree', source: 'braintree' },
                    { pattern: 'stripe', source: 'stripe' },
                    { pattern: 'gocardless', source: 'gocardless' }
                ];

                for (const { pattern, source } of descPatterns) {
                    if (descLower.includes(pattern)) {
                        // Find closest amount match from that source
                        const sourceDisbursements = allDisbursements
                            .filter(d => d.source === source && !matchedDisbRefs.has(d.reference));
                        const amountMatch = sourceDisbursements.find(d =>
                            Math.abs(d.amount - bankAmount) < 5
                        );
                        if (amountMatch) {
                            match = amountMatch;
                            matchType = 'description_amount';
                            break;
                        }
                    }
                }
            }

            if (match && matchType) {
                matchedBankIds.add(bankRow.id);
                matchedDisbRefs.add(match.reference);
                stats[match.source as keyof typeof stats]++;

                matches.push({
                    bank_row_id: bankRow.id,
                    bank_date: bankDate,
                    bank_amount: bankAmount,
                    bank_description: bankRow.description.substring(0, 100),
                    disbursement_source: match.source,
                    disbursement_date: match.date,
                    disbursement_amount: match.amount,
                    disbursement_reference: match.reference,
                    match_type: matchType
                });
            }
        }

        // Apply matches if not dry run
        let updated = 0;
        if (!dryRun && matches.length > 0) {
            for (const match of matches) {
                // Primeiro buscar o registro atual para mesclar custom_data
                const { data: currentRow } = await supabaseAdmin
                    .from('csv_rows')
                    .select('custom_data')
                    .eq('id', match.bank_row_id)
                    .single();

                const existingCustomData = currentRow?.custom_data || {};
                const newCustomData = {
                    ...existingCustomData,
                    reconciled_at: new Date().toISOString(),
                    reconciliationType: 'automatic',
                    paymentSource: match.disbursement_source.charAt(0).toUpperCase() + match.disbursement_source.slice(1),
                    disbursement_reference: match.disbursement_reference,
                    disbursement_amount: match.disbursement_amount,
                    disbursement_date: match.disbursement_date,
                    match_type: match.match_type
                };

                const { error } = await supabaseAdmin
                    .from('csv_rows')
                    .update({
                        reconciled: true,
                        custom_data: newCustomData,
                        matched_with: `${match.disbursement_source}:${match.disbursement_reference}`
                    })
                    .eq('id', match.bank_row_id);

                if (error) {
                    console.error('Error updating bank row:', error);
                }
                updated++;
            }
        }

        const totalValue = matches.reduce((sum, m) => sum + m.bank_amount, 0);

        return NextResponse.json({
            success: true,
            dryRun,
            bankSource,
            total: bankRows.length,
            matched: matches.length,
            unmatched: bankRows.length - matches.length,
            summary: {
                bankRowsUnreconciled: bankRows.length,
                disbursements: {
                    braintree: braintreeDisb.filter(d => d.currency === currency).length,
                    stripe: stripeDisb.filter(d => d.currency === currency).length,
                    gocardless: gocardlessDisb.filter(d => d.currency === currency).length,
                    total: allDisbursements.length
                },
                matched: matches.length,
                bySource: stats,
                totalValue: Math.round(totalValue * 100) / 100,
                updated: dryRun ? 0 : updated
            },
            matches: matches.slice(0, 30)
        });

    } catch (error: any) {
        console.error('[Bank Disbursement Reconcile API] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
