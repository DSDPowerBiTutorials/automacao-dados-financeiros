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
    settlement_batch_id?: string;
    transaction_ids?: string[];
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
    settlement_batch_id?: string;
    transaction_ids?: string[];
    transaction_count?: number;
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
    // Paginate to get all rows (may exceed 5000)
    let allData: any[] = [];
    let offset = 0;
    while (true) {
        const { data } = await supabaseAdmin
            .from('csv_rows')
            .select('*')
            .eq('source', 'braintree-api-revenue')
            .not('custom_data->disbursement_date', 'is', null)
            .order('date', { ascending: false })
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }

    if (allData.length === 0) return [];

    // Agrupar por disbursement_date + merchant_account_id
    const grouped = new Map<string, {
        amount: number;
        count: number;
        merchant_account_id: string;
        batch_id: string;
        transaction_ids: string[];
    }>();

    allData.forEach(tx => {
        const cd = tx.custom_data || {};
        const disbDate = cd.disbursement_date?.split('T')[0];
        const merchantId = cd.merchant_account_id || '';
        if (!disbDate) return;

        // Skip AMEX — they are settled separately via "Trans american express"
        const cardType = (cd.card_type || '').toLowerCase();
        if (cardType.includes('american express') || cardType.includes('amex')) return;

        const key = `${disbDate}|${merchantId}`;
        if (!grouped.has(key)) {
            grouped.set(key, {
                amount: 0,
                count: 0,
                merchant_account_id: merchantId,
                batch_id: cd.settlement_batch_id || '',
                transaction_ids: []
            });
        }
        const g = grouped.get(key)!;
        g.amount += parseFloat(cd.settlement_amount || tx.amount || 0);
        g.count++;
        // Collect transaction IDs
        const txId = cd.transaction_id || cd.id || tx.id;
        if (txId && !g.transaction_ids.includes(txId)) {
            g.transaction_ids.push(txId);
        }
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
            merchant_account_id: merchantId,
            settlement_batch_id: val.batch_id || `${date}_${merchantId}`,
            transaction_ids: val.transaction_ids
        };
    });
}

async function fetchStripeDisbursements(): Promise<DisbursementInfo[]> {
    // Stripe payouts estão em stripe-eur-payouts e stripe-usd-payouts
    // O payout_id está no campo custom_data->transaction_id (ex: po_1SsYEhIO1Dgqa3TAnKdoz5Fc)
    // E a data de chegada no banco está em custom_data->arrival_date ou no campo date
    const { data } = await supabaseAdmin
        .from('csv_rows')
        .select('*')
        .or('source.eq.stripe-eur-payouts,source.eq.stripe-usd-payouts')
        .eq('reconciled', false)
        .order('date', { ascending: false })
        .limit(2000);

    if (!data) return [];

    // Cada payout é um registro individual (não precisa agrupar)
    return data.map(tx => {
        const cd = tx.custom_data || {};
        const payoutId = cd.transaction_id || cd.payout_id || tx.id;
        const arrivalDate = cd.arrival_date?.split('T')[0] || tx.date?.split('T')[0];
        const amount = parseFloat(tx.amount || 0);

        // Determinar moeda: stripe-eur-payouts = EUR, stripe-usd-payouts = USD
        // Stripe EUR payouts → Bankinter EUR
        // Stripe USD payouts → Chase USD (via Dsdplanningcenter)
        const isUsdPayout = tx.source?.includes('usd') || cd.currency?.toUpperCase() === 'USD';
        const original_currency = cd.currency?.toUpperCase() ||
            (tx.source?.includes('usd') ? 'USD' : 'EUR');

        return {
            source: 'stripe',
            date: arrivalDate,
            amount: Math.round(amount * 100) / 100,
            currency: isUsdPayout ? 'USD' : 'EUR',
            reference: payoutId,
            transaction_count: 1,
            // Extra info
            original_currency,
            stripe_account_name: cd.stripe_account_name
        } as DisbursementInfo;
    });
}

async function fetchGoCardlessDisbursements(): Promise<DisbursementInfo[]> {
    // GoCardless usa payouts - registros com custom_data.type = 'payout'
    const { data } = await supabaseAdmin
        .from('csv_rows')
        .select('*')
        .eq('source', 'gocardless')
        .eq('custom_data->>type', 'payout')
        .eq('reconciled', false)
        .order('date', { ascending: false })
        .limit(2000);

    if (!data) return [];

    // Cada registro de payout já é um disbursement individual
    return (data || []).map(tx => {
        const cd = tx.custom_data || {};
        const payoutId = cd.payout_id || cd.gocardless_id || tx.id;
        const payoutDate = tx.date?.split('T')[0];

        return {
            source: 'gocardless',
            date: payoutDate,
            amount: Math.round(parseFloat(tx.amount || 0) * 100) / 100,
            currency: cd.currency || 'EUR',
            reference: payoutId,
            transaction_count: 1
        };
    });
}

async function fetchBraintreeAmexDisbursements(): Promise<DisbursementInfo[]> {
    // AMEX transactions are settled separately — bank shows "Trans american express europe"
    // Look for AMEX card types in braintree-api-revenue OR braintree-amex source
    let allData: any[] = [];
    for (const src of ['braintree-api-revenue', 'braintree-amex']) {
        const { data } = await supabaseAdmin
            .from('csv_rows')
            .select('*')
            .eq('source', src)
            .not('custom_data->disbursement_date', 'is', null)
            .order('date', { ascending: false })
            .limit(5000);
        if (data) allData = allData.concat(data);
    }

    // Filter only AMEX card types
    const amexData = allData.filter(tx => {
        const cardType = (tx.custom_data?.card_type || '').toLowerCase();
        return cardType.includes('american express') || cardType.includes('amex');
    });

    // Deduplicate by transaction_id (since AMEX exists in both sources)
    const seen = new Set<string>();
    const uniqueAmex = amexData.filter(tx => {
        const txId = tx.custom_data?.transaction_id || tx.id;
        if (seen.has(txId)) return false;
        seen.add(txId);
        return true;
    });

    // Group by disbursement_date + merchant_account_id (same as regular Braintree)
    const grouped = new Map<string, {
        amount: number;
        count: number;
        merchant_account_id: string;
        batch_id: string;
        transaction_ids: string[];
    }>();

    uniqueAmex.forEach(tx => {
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
                batch_id: cd.settlement_batch_id || '',
                transaction_ids: []
            });
        }
        const g = grouped.get(key)!;
        g.amount += parseFloat(cd.settlement_amount || tx.amount || 0);
        g.count++;
        const txId = cd.transaction_id || tx.id;
        if (txId && !g.transaction_ids.includes(txId)) g.transaction_ids.push(txId);
    });

    return Array.from(grouped.entries()).map(([key, val]) => {
        const [date, merchantId] = key.split('|');
        return {
            source: 'braintree',
            date,
            amount: Math.round(val.amount * 100) / 100,
            currency: merchantId.includes('EUR') ? 'EUR' : merchantId.includes('USD') ? 'USD' : 'EUR',
            reference: `braintree-amex-disb-${date}`,
            transaction_count: val.count,
            merchant_account_id: merchantId,
            settlement_batch_id: val.batch_id || `${date}_${merchantId}`,
            transaction_ids: val.transaction_ids
        };
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const dryRun = body.dryRun !== false;
        // Suporta 4 bancos: bankinter-eur, bankinter-usd, sabadell-eur/sabadell, chase-usd
        const bankSource = body.bankSource || 'bankinter-eur';
        // Normalizar source name (sabadell-eur → sabadell, pois csv_rows usa "sabadell")
        const normalizedBankSource = bankSource === 'sabadell-eur' ? 'sabadell' : bankSource;

        // Buscar dados em paralelo
        const [bankRows, braintreeDisb, braintreeAmexDisb, stripeDisb, gocardlessDisb] = await Promise.all([
            fetchBankRows(normalizedBankSource),
            fetchBraintreeDisbursements(),
            fetchBraintreeAmexDisbursements(),
            fetchStripeDisbursements(),
            fetchGoCardlessDisbursements()
        ]);

        // Determinar quais gateways são relevantes para cada banco
        // - Bankinter EUR: Braintree EUR, Stripe EUR payouts, GoCardless
        // - Bankinter USD: Braintree USD
        // - Sabadell EUR: Braintree EUR, Stripe EUR payouts, GoCardless (mesmos que Bankinter EUR)
        // - Chase USD: Stripe USD payouts (via Dsdplanningcenter)
        const currency = normalizedBankSource.includes('usd') || normalizedBankSource === 'chase-usd' ? 'USD' : 'EUR';

        let allDisbursements: DisbursementInfo[];
        if (normalizedBankSource === 'chase-usd') {
            // Chase receives Stripe USD payouts + Braintree USD + wire transfers
            const stripeUsd = stripeDisb.filter(d => {
                const origCurrency = (d as any).original_currency;
                return origCurrency === 'USD' || d.currency === 'USD';
            });
            stripeUsd.forEach(d => d.currency = 'USD');

            const braintreeUsd = braintreeDisb.filter(d => d.currency === 'USD');
            const braintreeAmexUsd = braintreeAmexDisb.filter(d => d.currency === 'USD');

            allDisbursements = [...stripeUsd, ...braintreeUsd, ...braintreeAmexUsd];
        } else {
            allDisbursements = [
                ...braintreeDisb.filter(d => d.currency === currency),
                ...braintreeAmexDisb.filter(d => d.currency === currency),
                ...stripeDisb.filter(d => d.currency === currency),
                ...gocardlessDisb.filter(d => d.currency === currency)
            ];
        }

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
                    { pattern: 'trans/paypal', source: 'braintree' },   // "Trans/paypal (europe) s.a r.l" = Braintree
                    { pattern: 'paypal (europe)', source: 'braintree' }, // Alternative paypal pattern
                    { pattern: 'paypal', source: 'braintree' },         // Generic paypal = Braintree
                    { pattern: 'american express', source: 'braintree' }, // "Trans american express europe" = Braintree AMEX
                    { pattern: 'stripe technology', source: 'stripe' }, // Trans/stripe technology europ
                    { pattern: 'stripe', source: 'stripe' },
                    { pattern: 'gocardless', source: 'gocardless' }
                ];

                // Also try ORIG CO NAME parsing for wire transfers (Chase USD)
                const origCoMatch = descLower.match(/orig co name:\s*(.+?)(?:\s+orig id|\s+sec|\s*$)/i);
                if (origCoMatch) {
                    const origName = origCoMatch[1].trim().toLowerCase();
                    // Map ORIG CO NAME to gateway source
                    if (origName.includes('stripe')) descPatterns.unshift({ pattern: origName, source: 'stripe' });
                    else if (origName.includes('braintree') || origName.includes('paypal')) descPatterns.unshift({ pattern: origName, source: 'braintree' });
                    else if (origName.includes('gocardless')) descPatterns.unshift({ pattern: origName, source: 'gocardless' });
                }

                for (const { pattern, source } of descPatterns) {
                    if (descLower.includes(pattern)) {
                        // Find closest amount match from that source (tolerance 0.10 for exact payouts)
                        const sourceDisbursements = allDisbursements
                            .filter(d => d.source === source && !matchedDisbRefs.has(d.reference));

                        // First try exact match
                        let amountMatch = sourceDisbursements.find(d =>
                            Math.abs(d.amount - bankAmount) < 0.10
                        );

                        // If no exact match, try looser tolerance for larger amounts
                        if (!amountMatch) {
                            amountMatch = sourceDisbursements.find(d =>
                                Math.abs(d.amount - bankAmount) < 5
                            );
                        }

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
                    match_type: matchType,
                    settlement_batch_id: match.settlement_batch_id,
                    transaction_ids: match.transaction_ids,
                    transaction_count: match.transaction_count
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
                    match_type: match.match_type,
                    // NEW: Store settlement batch ID and transaction IDs for linked orders
                    settlement_batch_id: match.settlement_batch_id,
                    transaction_ids: match.transaction_ids,
                    braintree_transaction_count: match.transaction_count
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
            bankSource: normalizedBankSource,
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
