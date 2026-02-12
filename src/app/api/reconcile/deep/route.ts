/**
 * API Endpoint: Reconciliação Profunda Multi-Nível
 * 
 * POST /api/reconcile/deep
 * 
 * Reconciliação automática avançada com 8 estratégias progressivas:
 * 
 * NÍVEL 1: Exact match (data exata + valor exato ±0.10)
 * NÍVEL 2: Date range (±3 dias + valor ±0.10)  
 * NÍVEL 3: Description-based (keywords no banco + valor ±0.50)
 * NÍVEL 4: Wider date range (±7 dias + valor ±0.50 + descrição gateway)
 * NÍVEL 5: Amount clustering (soma de múltiplos disbursements dentro de ±3 dias)
 * NÍVEL 6: Percentage tolerance (±1% do valor para valores > €500)
 * NÍVEL 7: Net amount match (valor bruto - fees = valor banco)
 * NÍVEL 8: Cross-gateway residual (valores sem match são testados contra todos os gateways)
 * 
 * Também armazena dados enriquecidos (customer_name, product, order_id) no custom_data
 * para uso no popup do cashflow.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface DisbursementGroup {
    source: string; // braintree, stripe, gocardless, amex
    date: string;
    amount: number;
    currency: string;
    reference: string;
    transaction_count: number;
    merchant_account_id?: string;
    settlement_batch_id?: string;
    transaction_ids: string[];
    // Enriched data for popup
    customer_names: string[];
    customer_emails: string[];
    order_ids: string[];
    products: string[];
    fees_amount?: number;
}

interface BankRow {
    id: string;
    date: string;
    amount: number;
    description: string;
    reconciled: boolean;
    custom_data: Record<string, any>;
    source: string;
}

interface MatchResult {
    bank_row_id: string;
    bank_date: string;
    bank_amount: number;
    bank_description: string;
    match_level: number;
    match_type: string;
    disbursement_source: string;
    disbursement_date: string;
    disbursement_amount: number;
    disbursement_reference: string;
    confidence: number;
    settlement_batch_id?: string;
    transaction_ids: string[];
    transaction_count: number;
    // Enriched data
    customer_names: string[];
    customer_emails: string[];
    order_ids: string[];
    products: string[];
}

// ═══════════════════════════════════════════════════════════
// Data Fetching
// ═══════════════════════════════════════════════════════════

async function fetchAllPaginated(source: string, filters?: Record<string, any>): Promise<any[]> {
    let all: any[] = [];
    let offset = 0;
    while (true) {
        let query = supabaseAdmin.from("csv_rows").select("*").eq("source", source);
        if (filters) {
            for (const [key, value] of Object.entries(filters)) {
                if (key === "gt") query = query.gt(value[0], value[1]);
                else if (key === "eq_reconciled") query = query.eq("reconciled", value);
                else if (key === "not_null") query = query.not(`custom_data->${value}`, "is", null);
            }
        }
        const { data } = await query.order("date", { ascending: false }).range(offset, offset + 999);
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }
    return all;
}

async function fetchBankRows(sources: string[]): Promise<BankRow[]> {
    let all: any[] = [];
    for (const source of sources) {
        let offset = 0;
        while (true) {
            const { data } = await supabaseAdmin
                .from("csv_rows")
                .select("*")
                .eq("source", source)
                .eq("reconciled", false)
                .gt("amount", 0)
                .order("date", { ascending: false })
                .range(offset, offset + 999);
            if (!data || data.length === 0) break;
            all = all.concat(data);
            if (data.length < 1000) break;
            offset += 1000;
        }
    }
    return all.map(r => ({
        id: r.id,
        date: r.date?.split("T")[0] || "",
        amount: Math.round(parseFloat(r.amount) * 100) / 100,
        description: r.description || "",
        reconciled: r.reconciled || false,
        custom_data: r.custom_data || {},
        source: r.source || "",
    }));
}

async function buildDisbursementGroups(): Promise<DisbursementGroup[]> {
    const groups: DisbursementGroup[] = [];

    // ─── Braintree ───
    const braintreeData = await fetchAllPaginated("braintree-api-revenue", {
        not_null: "disbursement_date",
    });

    // Group by disbursement_date + merchant_account_id, separating AMEX
    const btGrouped = new Map<string, {
        amount: number; count: number; merchant: string; batch: string;
        txIds: string[]; names: string[]; emails: string[]; orders: string[];
        products: string[]; fees: number; isAmex: boolean;
    }>();

    for (const tx of braintreeData) {
        const cd = tx.custom_data || {};
        const disbDate = cd.disbursement_date?.split("T")[0];
        const merchant = cd.merchant_account_id || "";
        if (!disbDate) continue;

        const cardType = (cd.card_type || "").toLowerCase();
        const isAmex = cardType.includes("american express") || cardType.includes("amex");
        const amexSuffix = isAmex ? "_amex" : "";
        const key = `${disbDate}|${merchant}${amexSuffix}`;

        if (!btGrouped.has(key)) {
            btGrouped.set(key, {
                amount: 0, count: 0, merchant, batch: cd.settlement_batch_id || "",
                txIds: [], names: [], emails: [], orders: [], products: [], fees: 0, isAmex,
            });
        }

        const g = btGrouped.get(key)!;
        const settlementAmount = parseFloat(cd.settlement_amount || tx.amount || 0);
        g.amount += settlementAmount;
        g.count++;

        const txId = cd.transaction_id || cd.id || tx.id;
        if (txId && !g.txIds.includes(txId)) g.txIds.push(txId);

        // Collect enriched data
        const name = tx.customer_name || cd.customer_name || cd.customer_company;
        if (name && !g.names.includes(name)) g.names.push(name);

        const email = tx.customer_email || cd.customer_email;
        if (email && !g.emails.includes(email)) g.emails.push(email);

        const orderId = cd.order_id;
        if (orderId && !g.orders.includes(orderId)) g.orders.push(orderId);

        const product = cd.plan_id || cd.subscription_id || cd.product;
        if (product && !g.products.includes(product)) g.products.push(product);

        // Track fees (service_fee_amount from Braintree)
        const fee = parseFloat(cd.service_fee_amount || 0);
        if (fee) g.fees += fee;
    }

    for (const [key, val] of btGrouped.entries()) {
        const [datePart, merchantPart] = key.split("|");
        const merchantClean = merchantPart.replace("_amex", "");
        const currency = merchantClean.includes("USD") ? "USD" : "EUR";
        const src = val.isAmex ? "braintree-amex" : "braintree";

        groups.push({
            source: src,
            date: datePart,
            amount: Math.round(val.amount * 100) / 100,
            currency,
            reference: `${src}-disb-${datePart}-${merchantClean}`,
            transaction_count: val.count,
            merchant_account_id: merchantClean,
            settlement_batch_id: val.batch,
            transaction_ids: val.txIds,
            customer_names: val.names,
            customer_emails: val.emails,
            order_ids: val.orders,
            products: val.products,
            fees_amount: Math.round(val.fees * 100) / 100,
        });
    }

    // ─── Stripe Payouts ───
    for (const payoutSource of ["stripe-eur-payouts", "stripe-usd-payouts"]) {
        const { data: payouts } = await supabaseAdmin
            .from("csv_rows")
            .select("*")
            .eq("source", payoutSource)
            .eq("reconciled", false)
            .order("date", { ascending: false })
            .limit(2000);

        if (payouts) {
            for (const p of payouts) {
                const cd = p.custom_data || {};
                const isUsd = payoutSource.includes("usd") || cd.currency?.toUpperCase() === "USD";
                groups.push({
                    source: "stripe",
                    date: (cd.arrival_date || p.date || "").split("T")[0],
                    amount: Math.round(parseFloat(p.amount || 0) * 100) / 100,
                    currency: isUsd ? "USD" : "EUR",
                    reference: cd.transaction_id || cd.payout_id || p.id,
                    transaction_count: 1,
                    transaction_ids: [cd.transaction_id || cd.payout_id || p.id],
                    customer_names: [],
                    customer_emails: [],
                    order_ids: [],
                    products: [],
                });
            }
        }
    }

    // ─── GoCardless Payouts ───
    const { data: gcPayouts } = await supabaseAdmin
        .from("csv_rows")
        .select("*")
        .eq("source", "gocardless")
        .eq("custom_data->>type", "payout")
        .eq("reconciled", false)
        .order("date", { ascending: false })
        .limit(2000);

    if (gcPayouts) {
        for (const gc of gcPayouts) {
            const cd = gc.custom_data || {};
            groups.push({
                source: "gocardless",
                date: gc.date?.split("T")[0] || "",
                amount: Math.round(parseFloat(gc.amount || 0) * 100) / 100,
                currency: cd.currency || "EUR",
                reference: cd.payout_id || cd.gocardless_id || gc.id,
                transaction_count: 1,
                transaction_ids: [cd.payout_id || cd.gocardless_id || gc.id],
                customer_names: [],
                customer_emails: [],
                order_ids: [],
                products: [],
            });
        }
    }

    return groups;
}

// ═══════════════════════════════════════════════════════════
// Gateway Detection (from bank description)
// ═══════════════════════════════════════════════════════════

type GatewayHint = "braintree" | "braintree-amex" | "stripe" | "gocardless" | null;

function detectGatewayFromDescription(desc: string): GatewayHint {
    const d = desc.toLowerCase();
    if (d.includes("american express") || d.includes("amex")) return "braintree-amex";
    if (d.includes("braintree")) return "braintree";
    if (d.includes("trans/paypal") || d.includes("paypal (europe)") || d.includes("paypal")) return "braintree";
    if (d.includes("stripe technology") || d.includes("stripe")) return "stripe";
    if (d.includes("gocardless") || d.includes("go cardless")) return "gocardless";
    return null;
}

function bankToExpectedCurrency(bankSource: string): string {
    if (bankSource.includes("usd") || bankSource === "chase-usd") return "USD";
    return "EUR";
}

function bankToExpectedGateways(bankSource: string): string[] {
    switch (bankSource) {
        case "bankinter-eur": return ["braintree", "braintree-amex", "stripe", "gocardless"];
        case "bankinter-usd": return ["braintree", "braintree-amex"];
        case "sabadell": return ["braintree", "braintree-amex", "stripe", "gocardless"];
        case "chase-usd": return ["stripe"];
        default: return ["braintree", "stripe", "gocardless"];
    }
}

// ═══════════════════════════════════════════════════════════
// Matching Engine — 8 Levels
// ═══════════════════════════════════════════════════════════

function daysDiff(d1: string, d2: string): number {
    return Math.abs((new Date(d1).getTime() - new Date(d2).getTime()) / 86400000);
}

function getDateRange(baseDate: string, offsetDays: number): string[] {
    const dates: string[] = [];
    const base = new Date(baseDate);
    for (let i = -offsetDays; i <= offsetDays; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const dryRun = body.dryRun !== false;
        const targetBanks = body.banks || ["bankinter-eur", "bankinter-usd", "sabadell", "chase-usd"];

        // Fetch all data in parallel
        const [bankRows, disbGroups] = await Promise.all([
            fetchBankRows(targetBanks),
            buildDisbursementGroups(),
        ]);

        const matches: MatchResult[] = [];
        const matchedBankIds = new Set<string>();
        const matchedDisbRefs = new Set<string>();
        const levelStats = new Map<string, number>();

        // Build indices
        const disbByDate = new Map<string, DisbursementGroup[]>();
        const disbBySource = new Map<string, DisbursementGroup[]>();

        for (const d of disbGroups) {
            // By date
            if (!disbByDate.has(d.date)) disbByDate.set(d.date, []);
            disbByDate.get(d.date)!.push(d);
            // By source
            if (!disbBySource.has(d.source)) disbBySource.set(d.source, []);
            disbBySource.get(d.source)!.push(d);
        }

        // Process each bank row through 8 matching levels
        for (const bankRow of bankRows) {
            if (matchedBankIds.has(bankRow.id)) continue;
            if (bankRow.amount <= 0) continue;

            const bankDate = bankRow.date;
            const bankAmount = bankRow.amount;
            const expectedCurrency = bankToExpectedCurrency(bankRow.source);
            const expectedGateways = bankToExpectedGateways(bankRow.source);
            const gatewayHint = detectGatewayFromDescription(bankRow.description);

            // Filter candidates by currency and expected gateways
            const validDisbs = disbGroups.filter(d =>
                d.currency === expectedCurrency &&
                expectedGateways.includes(d.source) &&
                !matchedDisbRefs.has(d.reference)
            );

            let match: DisbursementGroup | null = null;
            let matchLevel = 0;
            let matchType = "";
            let confidence = 0;

            // ─── LEVEL 1: Exact (same date + amount ±0.10) ───
            if (!match) {
                const candidates = validDisbs.filter(d => d.date === bankDate && Math.abs(d.amount - bankAmount) < 0.10);
                if (candidates.length === 1) {
                    match = candidates[0];
                    matchLevel = 1;
                    matchType = "exact_date_amount";
                    confidence = 1.0;
                } else if (candidates.length > 1) {
                    // Prefer gateway match from description
                    const descMatch = gatewayHint ? candidates.find(c => c.source === gatewayHint || (gatewayHint === "braintree" && c.source.startsWith("braintree"))) : null;
                    match = descMatch || candidates.sort((a, b) => Math.abs(a.amount - bankAmount) - Math.abs(b.amount - bankAmount))[0];
                    matchLevel = 1;
                    matchType = "exact_date_amount";
                    confidence = 0.98;
                }
            }

            // ─── LEVEL 2: Date range ±3 days + amount ±0.10 ───
            if (!match) {
                const candidates = validDisbs.filter(d => daysDiff(d.date, bankDate) <= 3 && Math.abs(d.amount - bankAmount) < 0.10);
                if (candidates.length > 0) {
                    // Sort by closest date, then closest amount
                    candidates.sort((a, b) => {
                        const dDiff = daysDiff(a.date, bankDate) - daysDiff(b.date, bankDate);
                        if (dDiff !== 0) return dDiff;
                        return Math.abs(a.amount - bankAmount) - Math.abs(b.amount - bankAmount);
                    });
                    // Prefer gateway hint
                    const hintMatch = gatewayHint ? candidates.find(c => c.source === gatewayHint || (gatewayHint === "braintree" && c.source.startsWith("braintree"))) : null;
                    match = hintMatch || candidates[0];
                    matchLevel = 2;
                    matchType = "date_range_3d";
                    confidence = 0.95 - daysDiff(match.date, bankDate) * 0.02;
                }
            }

            // ─── LEVEL 3: Description gateway + amount ±0.50 ───
            if (!match && gatewayHint) {
                const srcKey = gatewayHint === "braintree-amex" ? "braintree-amex" : gatewayHint;
                const candidates = validDisbs.filter(d =>
                    (d.source === srcKey || (gatewayHint === "braintree" && d.source.startsWith("braintree"))) &&
                    Math.abs(d.amount - bankAmount) < 0.50
                );
                if (candidates.length > 0) {
                    candidates.sort((a, b) => Math.abs(a.amount - bankAmount) - Math.abs(b.amount - bankAmount));
                    match = candidates[0];
                    matchLevel = 3;
                    matchType = "description_amount_050";
                    confidence = 0.90;
                }
            }

            // ─── LEVEL 4: Wider date ±7 days + description + amount ±0.50 ───
            if (!match && gatewayHint) {
                const candidates = validDisbs.filter(d =>
                    (d.source === gatewayHint || (gatewayHint === "braintree" && d.source.startsWith("braintree"))) &&
                    daysDiff(d.date, bankDate) <= 7 &&
                    Math.abs(d.amount - bankAmount) < 0.50
                );
                if (candidates.length > 0) {
                    candidates.sort((a, b) => {
                        const dDiff = daysDiff(a.date, bankDate) - daysDiff(b.date, bankDate);
                        if (dDiff !== 0) return dDiff;
                        return Math.abs(a.amount - bankAmount) - Math.abs(b.amount - bankAmount);
                    });
                    match = candidates[0];
                    matchLevel = 4;
                    matchType = "wide_date_7d_desc";
                    confidence = 0.85 - daysDiff(match.date, bankDate) * 0.01;
                }
            }

            // ─── LEVEL 5: Amount clustering (sum of multiple disbursements) ───
            if (!match && gatewayHint) {
                // Try to find 2-5 disbursements that sum to bank amount within ±3 days
                const srcKey = gatewayHint === "braintree-amex" ? "braintree-amex" : gatewayHint;
                const nearbyDisbs = validDisbs.filter(d =>
                    (d.source === srcKey || (gatewayHint === "braintree" && d.source.startsWith("braintree"))) &&
                    daysDiff(d.date, bankDate) <= 5
                ).sort((a, b) => b.amount - a.amount);

                // Try combinations of 2
                for (let i = 0; i < nearbyDisbs.length && !match; i++) {
                    for (let j = i + 1; j < nearbyDisbs.length && !match; j++) {
                        const sum = nearbyDisbs[i].amount + nearbyDisbs[j].amount;
                        if (Math.abs(sum - bankAmount) < 0.50) {
                            // Found a pair! Merge them into a single match
                            const merged: DisbursementGroup = {
                                ...nearbyDisbs[i],
                                amount: Math.round(sum * 100) / 100,
                                reference: `${nearbyDisbs[i].reference}+${nearbyDisbs[j].reference}`,
                                transaction_count: nearbyDisbs[i].transaction_count + nearbyDisbs[j].transaction_count,
                                transaction_ids: [...nearbyDisbs[i].transaction_ids, ...nearbyDisbs[j].transaction_ids],
                                customer_names: [...new Set([...nearbyDisbs[i].customer_names, ...nearbyDisbs[j].customer_names])],
                                customer_emails: [...new Set([...nearbyDisbs[i].customer_emails, ...nearbyDisbs[j].customer_emails])],
                                order_ids: [...new Set([...nearbyDisbs[i].order_ids, ...nearbyDisbs[j].order_ids])],
                                products: [...new Set([...nearbyDisbs[i].products, ...nearbyDisbs[j].products])],
                            };
                            match = merged;
                            matchLevel = 5;
                            matchType = "amount_clustering_2";
                            confidence = 0.80;
                            matchedDisbRefs.add(nearbyDisbs[i].reference);
                            matchedDisbRefs.add(nearbyDisbs[j].reference);
                        }
                    }
                }

                // Try combinations of 3
                if (!match) {
                    for (let i = 0; i < Math.min(nearbyDisbs.length, 8) && !match; i++) {
                        for (let j = i + 1; j < Math.min(nearbyDisbs.length, 8) && !match; j++) {
                            for (let k = j + 1; k < Math.min(nearbyDisbs.length, 8) && !match; k++) {
                                const sum = nearbyDisbs[i].amount + nearbyDisbs[j].amount + nearbyDisbs[k].amount;
                                if (Math.abs(sum - bankAmount) < 1.0) {
                                    const items = [nearbyDisbs[i], nearbyDisbs[j], nearbyDisbs[k]];
                                    const merged: DisbursementGroup = {
                                        ...nearbyDisbs[i],
                                        amount: Math.round(sum * 100) / 100,
                                        reference: items.map(d => d.reference).join("+"),
                                        transaction_count: items.reduce((s, d) => s + d.transaction_count, 0),
                                        transaction_ids: items.flatMap(d => d.transaction_ids),
                                        customer_names: [...new Set(items.flatMap(d => d.customer_names))],
                                        customer_emails: [...new Set(items.flatMap(d => d.customer_emails))],
                                        order_ids: [...new Set(items.flatMap(d => d.order_ids))],
                                        products: [...new Set(items.flatMap(d => d.products))],
                                    };
                                    match = merged;
                                    matchLevel = 5;
                                    matchType = "amount_clustering_3";
                                    confidence = 0.75;
                                    items.forEach(d => matchedDisbRefs.add(d.reference));
                                }
                            }
                        }
                    }
                }
            }

            // ─── LEVEL 6: Percentage tolerance (±1% for amounts > €500, ±2% for amounts > €5000) ───
            if (!match) {
                const tolerance = bankAmount > 5000 ? bankAmount * 0.02 : bankAmount > 500 ? bankAmount * 0.01 : 0;
                if (tolerance > 0) {
                    const candidates = validDisbs.filter(d =>
                        daysDiff(d.date, bankDate) <= 5 &&
                        Math.abs(d.amount - bankAmount) < tolerance
                    );
                    if (candidates.length > 0) {
                        candidates.sort((a, b) => Math.abs(a.amount - bankAmount) - Math.abs(b.amount - bankAmount));
                        // Prefer gateway hint
                        const hintMatch = gatewayHint ? candidates.find(c =>
                            c.source === gatewayHint || (gatewayHint === "braintree" && c.source.startsWith("braintree"))
                        ) : null;
                        match = hintMatch || candidates[0];
                        matchLevel = 6;
                        matchType = "percentage_tolerance";
                        confidence = 0.70;
                    }
                }
            }

            // ─── LEVEL 7: Net amount (disbursement - fees ≈ bank amount) ───
            if (!match) {
                const candidates = validDisbs.filter(d => {
                    if (!d.fees_amount || d.fees_amount === 0) return false;
                    const netAmount = d.amount - d.fees_amount;
                    return daysDiff(d.date, bankDate) <= 5 && Math.abs(netAmount - bankAmount) < 0.50;
                });
                if (candidates.length > 0) {
                    candidates.sort((a, b) =>
                        Math.abs((a.amount - (a.fees_amount || 0)) - bankAmount) -
                        Math.abs((b.amount - (b.fees_amount || 0)) - bankAmount)
                    );
                    match = candidates[0];
                    matchLevel = 7;
                    matchType = "net_amount_minus_fees";
                    confidence = 0.65;
                }
            }

            // ─── LEVEL 8: Cross-gateway residual (any gateway, wider tolerance) ───
            if (!match && gatewayHint) {
                // Try all gateways, not just the expected ones
                const allCandidates = disbGroups.filter(d =>
                    d.currency === expectedCurrency &&
                    !matchedDisbRefs.has(d.reference) &&
                    daysDiff(d.date, bankDate) <= 7 &&
                    Math.abs(d.amount - bankAmount) < 1.00
                );
                if (allCandidates.length > 0) {
                    allCandidates.sort((a, b) => {
                        const aDiff = Math.abs(a.amount - bankAmount) + daysDiff(a.date, bankDate) * 0.1;
                        const bDiff = Math.abs(b.amount - bankAmount) + daysDiff(b.date, bankDate) * 0.1;
                        return aDiff - bDiff;
                    });
                    match = allCandidates[0];
                    matchLevel = 8;
                    matchType = "cross_gateway_residual";
                    confidence = 0.55;
                }
            }

            // ═══ Record match ═══
            if (match) {
                matchedBankIds.add(bankRow.id);
                matchedDisbRefs.add(match.reference);

                const levelKey = `L${matchLevel}_${matchType}`;
                levelStats.set(levelKey, (levelStats.get(levelKey) || 0) + 1);

                matches.push({
                    bank_row_id: bankRow.id,
                    bank_date: bankDate,
                    bank_amount: bankAmount,
                    bank_description: bankRow.description.substring(0, 100),
                    match_level: matchLevel,
                    match_type: matchType,
                    disbursement_source: match.source,
                    disbursement_date: match.date,
                    disbursement_amount: match.amount,
                    disbursement_reference: match.reference,
                    confidence,
                    settlement_batch_id: match.settlement_batch_id,
                    transaction_ids: match.transaction_ids,
                    transaction_count: match.transaction_count,
                    customer_names: match.customer_names,
                    customer_emails: match.customer_emails,
                    order_ids: match.order_ids,
                    products: match.products,
                });
            }
        }

        // ═══════════════════════════════════════════════════════════
        // Apply matches
        // ═══════════════════════════════════════════════════════════
        let updated = 0;
        const errors: string[] = [];

        if (!dryRun && matches.length > 0) {
            for (const m of matches) {
                try {
                    // Fetch existing custom_data
                    const { data: currentRow } = await supabaseAdmin
                        .from("csv_rows")
                        .select("custom_data")
                        .eq("id", m.bank_row_id)
                        .single();

                    const existingCd = currentRow?.custom_data || {};
                    const sourceName = m.disbursement_source.charAt(0).toUpperCase() + m.disbursement_source.slice(1);

                    const newCustomData = {
                        ...existingCd,
                        reconciled_at: new Date().toISOString(),
                        reconciliationType: "automatic",
                        paymentSource: sourceName.replace("-amex", " (AMEX)"),
                        disbursement_reference: m.disbursement_reference,
                        disbursement_amount: m.disbursement_amount,
                        disbursement_date: m.disbursement_date,
                        match_type: m.match_type,
                        match_level: m.match_level,
                        match_confidence: m.confidence,
                        settlement_batch_id: m.settlement_batch_id,
                        transaction_ids: m.transaction_ids,
                        braintree_transaction_count: m.transaction_count,
                        // Enriched data for popup
                        matched_customer_names: m.customer_names,
                        matched_customer_emails: m.customer_emails,
                        matched_order_ids: m.order_ids,
                        matched_products: m.products,
                    };

                    const { error } = await supabaseAdmin
                        .from("csv_rows")
                        .update({
                            reconciled: true,
                            custom_data: newCustomData,
                            matched_with: `${m.disbursement_source}:${m.disbursement_reference}`,
                        })
                        .eq("id", m.bank_row_id);

                    if (error) {
                        errors.push(`${m.bank_row_id}: ${error.message}`);
                    } else {
                        updated++;
                    }
                } catch (err: any) {
                    errors.push(`${m.bank_row_id}: ${err.message}`);
                }
            }
        }

        // Summary
        const totalBankCredits = bankRows.filter(r => r.amount > 0).length;
        const totalValue = matches.reduce((s, m) => s + m.bank_amount, 0);
        const byLevel = Object.fromEntries(levelStats);
        const bySource: Record<string, number> = {};
        matches.forEach(m => {
            bySource[m.disbursement_source] = (bySource[m.disbursement_source] || 0) + 1;
        });

        return NextResponse.json({
            success: true,
            dryRun,
            summary: {
                bankCreditsUnreconciled: totalBankCredits,
                disbursementGroups: disbGroups.length,
                matched: matches.length,
                matchRate: totalBankCredits > 0 ? `${Math.round((matches.length / totalBankCredits) * 100)}%` : "0%",
                totalValue: Math.round(totalValue * 100) / 100,
                byLevel,
                bySource,
                updated: dryRun ? 0 : updated,
                errors: errors.slice(0, 10),
            },
            matches: dryRun ? matches.slice(0, 50) : matches.slice(0, 20),
        });
    } catch (error: any) {
        console.error("[Deep Reconcile API] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
