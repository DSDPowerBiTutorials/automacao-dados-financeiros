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
    // Stripe payouts — fetch ALL payouts (not just unreconciled) as matching candidates
    const { data } = await supabaseAdmin
        .from('csv_rows')
        .select('*')
        .or('source.eq.stripe-eur-payouts,source.eq.stripe-usd-payouts')
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
    // GoCardless payouts — fetch ALL payouts as matching candidates
    const { data } = await supabaseAdmin
        .from('csv_rows')
        .select('*')
        .eq('source', 'gocardless')
        .eq('custom_data->>type', 'payout')
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

// Individual AMEX transaction for single/pair matching
interface AmexTransaction {
    id: string;
    settlement_date: string;
    settlement_amount: number;
    transaction_id: string;
    card_type: string;
    merchant_account_id: string;
    currency: string;
}

async function fetchAmexIndividualTransactions(): Promise<AmexTransaction[]> {
    // AMEX bank entries are individual or pair settlements, NOT aggregated disbursements.
    // Fetch all individual AMEX transactions for matching.
    let allData: any[] = [];
    let offset = 0;
    while (true) {
        const { data } = await supabaseAdmin
            .from('csv_rows')
            .select('*')
            .eq('source', 'braintree-amex')
            .order('date', { ascending: false })
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }

    // Also include AMEX card_type from braintree-api-revenue
    let btAmex: any[] = [];
    offset = 0;
    while (true) {
        const { data } = await supabaseAdmin
            .from('csv_rows')
            .select('*')
            .eq('source', 'braintree-api-revenue')
            .order('date', { ascending: false })
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        const amexOnly = data.filter((tx: any) => {
            const ct = (tx.custom_data?.card_type || '').toLowerCase();
            return ct.includes('american express') || ct.includes('amex');
        });
        btAmex = btAmex.concat(amexOnly);
        if (data.length < 1000) break;
        offset += 1000;
    }

    allData = allData.concat(btAmex);

    // Deduplicate by transaction_id
    const seen = new Set<string>();
    const unique: AmexTransaction[] = [];
    for (const tx of allData) {
        const cd = tx.custom_data || {};
        const txId = cd.transaction_id || tx.id;
        if (seen.has(txId)) continue;
        seen.add(txId);

        const merchantId = cd.merchant_account_id || '';
        unique.push({
            id: tx.id,
            settlement_date: cd.settlement_date?.split('T')[0] || tx.date?.split('T')[0] || '',
            settlement_amount: Math.round(parseFloat(cd.settlement_amount || tx.amount || 0) * 100) / 100,
            transaction_id: txId,
            card_type: cd.card_type || 'American Express',
            merchant_account_id: merchantId,
            currency: merchantId.includes('USD') ? 'USD' : 'EUR'
        });
    }

    return unique;
}

async function fetchBraintreeAmexDisbursements(): Promise<DisbursementInfo[]> {
    // Keep aggregated AMEX disbursements as fallback (for entries not matched by individual)
    let allData: any[] = [];
    for (const src of ['braintree-api-revenue', 'braintree-amex']) {
        let offset = 0;
        while (true) {
            const { data } = await supabaseAdmin
                .from('csv_rows')
                .select('*')
                .eq('source', src)
                .not('custom_data->disbursement_date', 'is', null)
                .order('date', { ascending: false })
                .range(offset, offset + 999);
            if (!data || data.length === 0) break;
            allData = allData.concat(data);
            if (data.length < 1000) break;
            offset += 1000;
        }
    }

    const amexData = allData.filter(tx => {
        const cardType = (tx.custom_data?.card_type || '').toLowerCase();
        return cardType.includes('american express') || cardType.includes('amex');
    });

    const seen = new Set<string>();
    const uniqueAmex = amexData.filter(tx => {
        const txId = tx.custom_data?.transaction_id || tx.id;
        if (seen.has(txId)) return false;
        seen.add(txId);
        return true;
    });

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
        const bankSource = body.bankSource || 'bankinter-eur';
        const normalizedBankSource = bankSource === 'sabadell-eur' ? 'sabadell' : bankSource;

        // Buscar dados em paralelo
        const [bankRows, braintreeDisb, braintreeAmexDisb, amexTxs, stripeDisb, gocardlessDisb] = await Promise.all([
            fetchBankRows(normalizedBankSource),
            fetchBraintreeDisbursements(),
            fetchBraintreeAmexDisbursements(),
            fetchAmexIndividualTransactions(),
            fetchStripeDisbursements(),
            fetchGoCardlessDisbursements()
        ]);

        const currency = normalizedBankSource.includes('usd') || normalizedBankSource === 'chase-usd' ? 'USD' : 'EUR';

        let allDisbursements: DisbursementInfo[];
        if (normalizedBankSource === 'chase-usd') {
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

        // Filter AMEX individual txs by currency
        const amexTxsFiltered = amexTxs.filter(t => t.currency === currency);

        const matches: Match[] = [];
        const matchedBankIds = new Set<string>();
        const matchedDisbRefs = new Set<string>();
        const matchedAmexTxIds = new Set<string>();
        const stats = { braintree: 0, stripe: 0, gocardless: 0, amex_individual: 0, amex_pair: 0 };

        // Create indices for matching
        const disbByDate = new Map<string, DisbursementInfo[]>();
        allDisbursements.forEach(d => {
            if (!disbByDate.has(d.date)) disbByDate.set(d.date, []);
            disbByDate.get(d.date)!.push(d);
        });

        // Helper: days between two date strings
        function daysBetween(d1: string, d2: string): number {
            return Math.abs(Math.round(
                (new Date(d1).getTime() - new Date(d2).getTime()) / (1000 * 60 * 60 * 24)
            ));
        }

        // Helper: check if bank description matches a gateway pattern
        function descriptionMatchesGateway(desc: string): { source: string; isAmex: boolean; isPaypal: boolean } | null {
            const d = desc.toLowerCase();
            if (d.includes('american express')) return { source: 'braintree', isAmex: true, isPaypal: false };
            if (d.includes('paypal')) return { source: 'braintree', isAmex: false, isPaypal: true };
            if (d.includes('braintree')) return { source: 'braintree', isAmex: false, isPaypal: false };
            if (d.includes('stripe')) return { source: 'stripe', isAmex: false, isPaypal: false };
            if (d.includes('gocardless')) return { source: 'gocardless', isAmex: false, isPaypal: false };

            // Chase USD: ORIG CO NAME parsing
            const origCoMatch = d.match(/orig co name:\s*(.+?)(?:\s+orig id|\s+sec|\s*$)/i);
            if (origCoMatch) {
                const origName = origCoMatch[1].trim().toLowerCase();
                if (origName.includes('stripe')) return { source: 'stripe', isAmex: false, isPaypal: false };
                if (origName.includes('braintree') || origName.includes('paypal')) return { source: 'braintree', isAmex: false, isPaypal: true };
                if (origName.includes('gocardless')) return { source: 'gocardless', isAmex: false, isPaypal: false };
            }
            return null;
        }

        // =======================================================
        // PHASE 1: AMEX individual/pair matching
        // AMEX bank entries are individual/pair settlements, not aggregated.
        // =======================================================
        const amexBankRows = bankRows.filter(r =>
            r.description.toLowerCase().includes('american express')
        );

        for (const bankRow of amexBankRows) {
            if (matchedBankIds.has(bankRow.id)) continue;
            const bankDate = bankRow.date?.split('T')[0];
            const bankAmount = Math.round(bankRow.amount * 100) / 100;

            // Get AMEX txs within ±14 days by settlement_date
            const nearbyAmex = amexTxsFiltered.filter(t =>
                !matchedAmexTxIds.has(t.transaction_id) &&
                t.settlement_date &&
                daysBetween(bankDate, t.settlement_date) <= 14
            );

            // Strategy A1: Single AMEX tx match (±1% tolerance)
            let matched = false;
            for (const tx of nearbyAmex) {
                const pctDiff = Math.abs(tx.settlement_amount - bankAmount) / (bankAmount || 1);
                if (pctDiff < 0.01) {
                    matchedBankIds.add(bankRow.id);
                    matchedAmexTxIds.add(tx.transaction_id);
                    stats.amex_individual++;
                    matches.push({
                        bank_row_id: bankRow.id,
                        bank_date: bankDate,
                        bank_amount: bankAmount,
                        bank_description: bankRow.description.substring(0, 100),
                        disbursement_source: 'braintree',
                        disbursement_date: tx.settlement_date,
                        disbursement_amount: tx.settlement_amount,
                        disbursement_reference: `amex-tx-${tx.transaction_id}`,
                        match_type: 'amex_single_tx',
                        transaction_ids: [tx.transaction_id],
                        transaction_count: 1
                    });
                    matched = true;
                    break;
                }
            }
            if (matched) continue;

            // Strategy A2: Pair of AMEX txs summing to bank amount (±1%)
            let pairFound = false;
            for (let i = 0; i < nearbyAmex.length && !pairFound; i++) {
                for (let j = i + 1; j < nearbyAmex.length && !pairFound; j++) {
                    const sum = nearbyAmex[i].settlement_amount + nearbyAmex[j].settlement_amount;
                    const pctDiff = Math.abs(sum - bankAmount) / (bankAmount || 1);
                    if (pctDiff < 0.01) {
                        matchedBankIds.add(bankRow.id);
                        matchedAmexTxIds.add(nearbyAmex[i].transaction_id);
                        matchedAmexTxIds.add(nearbyAmex[j].transaction_id);
                        stats.amex_pair++;
                        matches.push({
                            bank_row_id: bankRow.id,
                            bank_date: bankDate,
                            bank_amount: bankAmount,
                            bank_description: bankRow.description.substring(0, 100),
                            disbursement_source: 'braintree',
                            disbursement_date: nearbyAmex[i].settlement_date,
                            disbursement_amount: sum,
                            disbursement_reference: `amex-pair-${nearbyAmex[i].transaction_id}+${nearbyAmex[j].transaction_id}`,
                            match_type: 'amex_pair_tx',
                            transaction_ids: [nearbyAmex[i].transaction_id, nearbyAmex[j].transaction_id],
                            transaction_count: 2
                        });
                        pairFound = true;
                    }
                }
            }
            if (pairFound) continue;

            // Strategy A3: Triple AMEX txs (±1%) — for 3+ entry days
            let tripleFound = false;
            if (nearbyAmex.length >= 3 && bankAmount > 100) {
                for (let i = 0; i < Math.min(nearbyAmex.length, 30) && !tripleFound; i++) {
                    for (let j = i + 1; j < Math.min(nearbyAmex.length, 30) && !tripleFound; j++) {
                        for (let k = j + 1; k < Math.min(nearbyAmex.length, 30) && !tripleFound; k++) {
                            const sum = nearbyAmex[i].settlement_amount + nearbyAmex[j].settlement_amount + nearbyAmex[k].settlement_amount;
                            const pctDiff = Math.abs(sum - bankAmount) / (bankAmount || 1);
                            if (pctDiff < 0.01) {
                                matchedBankIds.add(bankRow.id);
                                matchedAmexTxIds.add(nearbyAmex[i].transaction_id);
                                matchedAmexTxIds.add(nearbyAmex[j].transaction_id);
                                matchedAmexTxIds.add(nearbyAmex[k].transaction_id);
                                stats.amex_individual++;
                                matches.push({
                                    bank_row_id: bankRow.id,
                                    bank_date: bankDate,
                                    bank_amount: bankAmount,
                                    bank_description: bankRow.description.substring(0, 100),
                                    disbursement_source: 'braintree',
                                    disbursement_date: nearbyAmex[i].settlement_date,
                                    disbursement_amount: Math.round(sum * 100) / 100,
                                    disbursement_reference: `amex-triple-${nearbyAmex[i].transaction_id}`,
                                    match_type: 'amex_triple_tx',
                                    transaction_ids: [nearbyAmex[i].transaction_id, nearbyAmex[j].transaction_id, nearbyAmex[k].transaction_id],
                                    transaction_count: 3
                                });
                                tripleFound = true;
                            }
                        }
                    }
                }
            }
        }

        // =======================================================
        // PHASE 2: Standard matching for non-AMEX entries
        // Strategies: exact → date_range → description_with_date_constraint
        // =======================================================
        for (const bankRow of bankRows) {
            if (matchedBankIds.has(bankRow.id)) continue;
            if (bankRow.amount <= 0) continue;

            // Skip AMEX entries (already handled in Phase 1)
            if (bankRow.description.toLowerCase().includes('american express')) continue;

            let match: DisbursementInfo | null = null;
            let matchType: string | null = null;
            const bankDate = bankRow.date?.split('T')[0];
            const bankAmount = Math.round(bankRow.amount * 100) / 100;

            // Strategy 1: Exact match — same date + same amount (±€0.10 or ±0.1%)
            const exactCandidates = (disbByDate.get(bankDate) || [])
                .filter(d => !matchedDisbRefs.has(d.reference));
            const tolerance1 = Math.max(0.10, bankAmount * 0.001); // At least €0.10 or 0.1%
            const exactMatch = exactCandidates.find(d =>
                Math.abs(d.amount - bankAmount) < tolerance1
            );
            if (exactMatch) {
                match = exactMatch;
                matchType = 'exact_date_amount';
            }

            // Strategy 2: Date range match — ±3 days + same amount (±€0.10 or ±0.1%)
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
                        Math.abs(d.amount - bankAmount) < tolerance1
                    );
                    if (rangeMatch) {
                        match = rangeMatch;
                        matchType = 'date_range_amount';
                        break;
                    }
                }
            }

            // Strategy 3: Description-based + DATE CONSTRAINED (±14 days, ±2% amount)
            // CRITICAL FIX: The old strategy 3 had NO date constraint, causing false positives.
            if (!match) {
                const gatewayInfo = descriptionMatchesGateway(bankRow.description);

                if (gatewayInfo) {
                    // Only search disbursements from the matching gateway source
                    const sourceDisbursements = allDisbursements
                        .filter(d => d.source === gatewayInfo.source && !matchedDisbRefs.has(d.reference));

                    // MUST have date proximity (±14 days max)
                    const MAX_DATE_OFFSET = 14;
                    const amountTolerance = bankAmount > 100
                        ? bankAmount * 0.02  // ±2% for amounts over €100
                        : 5.0;               // ±€5 for small amounts

                    let bestMatch: DisbursementInfo | null = null;
                    let bestDaysDiff = Infinity;

                    for (const disb of sourceDisbursements) {
                        const dd = daysBetween(bankDate, disb.date);
                        if (dd > MAX_DATE_OFFSET) continue;
                        if (Math.abs(disb.amount - bankAmount) > amountTolerance) continue;

                        // Prefer closest date.
                        if (dd < bestDaysDiff) {
                            bestDaysDiff = dd;
                            bestMatch = disb;
                        }
                    }

                    if (bestMatch) {
                        match = bestMatch;
                        matchType = 'description_date_amount';
                    }
                }
            }

            // Strategy 4: PayPal bank entries ↔ Braintree CC disbursements (±7d, ±2%)
            // PayPal (Europe) S.à r.l. is the settlement entity for Braintree CC disbursements.
            // Some CC disbursements arrive at the bank as "Trans/paypal" entries.
            if (!match) {
                const descLower = bankRow.description.toLowerCase();
                if (descLower.includes('paypal')) {
                    const ccDisbs = braintreeDisb
                        .filter(d => d.currency === currency && !matchedDisbRefs.has(d.reference));

                    const MAX_OFFSET = 7;
                    const amtTol = bankAmount * 0.02;

                    let bestCC: DisbursementInfo | null = null;
                    let bestDiff = Infinity;

                    for (const disb of ccDisbs) {
                        const dd = daysBetween(bankDate, disb.date);
                        if (dd > MAX_OFFSET) continue;
                        if (Math.abs(disb.amount - bankAmount) > amtTol) continue;
                        if (dd < bestDiff) {
                            bestDiff = dd;
                            bestCC = disb;
                        }
                    }

                    if (bestCC) {
                        match = bestCC;
                        matchType = 'paypal_cc_disbursement';
                    }
                }
            }

            if (match && matchType) {
                matchedBankIds.add(bankRow.id);
                matchedDisbRefs.add(match.reference);
                const src = match.source as keyof typeof stats;
                if (src in stats) stats[src]++;

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

        // Group matches by type for detailed stats
        const matchByType: Record<string, number> = {};
        for (const m of matches) {
            matchByType[m.match_type] = (matchByType[m.match_type] || 0) + 1;
        }

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
                    braintreeAmex: braintreeAmexDisb.filter(d => d.currency === currency).length,
                    amexIndividualTxs: amexTxsFiltered.length,
                    stripe: stripeDisb.filter(d => d.currency === currency).length,
                    gocardless: gocardlessDisb.filter(d => d.currency === currency).length,
                    total: allDisbursements.length
                },
                matched: matches.length,
                bySource: stats,
                byMatchType: matchByType,
                totalValue: Math.round(totalValue * 100) / 100,
                updated: dryRun ? 0 : updated
            },
            matches: matches.slice(0, 50)
        });

    } catch (error: any) {
        console.error('[Bank Disbursement Reconcile API] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
