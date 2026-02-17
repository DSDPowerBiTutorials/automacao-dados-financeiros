/**
 * API Endpoint: Reconciliação Profunda Multi-Nível
 * 
 * POST /api/reconcile/deep
 * 
 * Reconciliação automática avançada com 12 estratégias progressivas:
 * 
 * NÍVEL 1: Exact match (data exata + valor exato ±0.10)
 * NÍVEL 2: Date range (±3 dias + valor ±0.10)  
 * NÍVEL 3: Description-based (keywords no banco + valor ±0.50)
 * NÍVEL 4: Wider date range (±7 dias + valor ±0.50 + descrição gateway)
 * NÍVEL 5: Amount clustering (soma de múltiplos disbursements dentro de ±3 dias)
 * NÍVEL 6: Percentage tolerance (±1% do valor para valores > €500)
 * NÍVEL 7: Net amount match (valor bruto - fees = valor banco)
 * NÍVEL 7b: Refund-offset (disbursement - refund = valor banco)
 * NÍVEL 8: Cross-gateway residual (valores sem match são testados contra todos os gateways)
 * NÍVEL 9: Name extraction (extrai nome do cliente da descrição bancária → IO → FAC)
 * NÍVEL 10: AMEX extended (±10 dias úteis + ±3% para AMEX com delays maiores)
 * NÍVEL 11: Cross-bank intercompany (débito num banco ↔ crédito noutro banco)
 * NÍVEL 12: Refund debit (débitos bancários ↔ refunds nos gateways)
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
                // Extract Stripe fees from custom_data fields
                const stripeFee = parseFloat(cd.stripe_fee || cd.fee || cd.fees || 0);
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
                    fees_amount: stripeFee > 0 ? Math.round(stripeFee * 100) / 100 : undefined,
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
            // Extract GoCardless fees from custom_data fields
            const gcFee = parseFloat(cd.app_fee || cd.gocardless_fees || cd.fees || cd.gc_fee || 0);
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
                fees_amount: gcFee > 0 ? Math.round(gcFee * 100) / 100 : undefined,
            });
        }
    }

    // ─── Enrich Stripe payouts with charge customer data ───
    for (const currSuffix of ["eur", "usd"] as const) {
        const chargeSource = `stripe-${currSuffix}`;
        const { data: charges } = await supabaseAdmin
            .from("csv_rows")
            .select("date, customer_name, customer_email, custom_data")
            .eq("source", chargeSource)
            .order("date", { ascending: false })
            .limit(3000);

        if (charges && charges.length > 0) {
            const stripePayoutGroups = groups.filter(
                g => g.source === "stripe" && g.currency === currSuffix.toUpperCase()
            );
            for (const pg of stripePayoutGroups) {
                const pgDate = pg.date;
                // Charges that settled within ±2 days of payout arrival
                const nearby = charges.filter(c => {
                    const cDate = (c.date || "").split("T")[0];
                    return cDate && daysDiffStatic(cDate, pgDate) <= 2;
                });
                for (const ch of nearby) {
                    const nm = ch.customer_name || (ch.custom_data as any)?.customer_name;
                    const em = ch.customer_email || (ch.custom_data as any)?.customer_email;
                    const cd = (ch.custom_data || {}) as Record<string, any>;
                    if (nm && !pg.customer_names.includes(nm)) pg.customer_names.push(nm);
                    if (em && !pg.customer_emails.includes(em)) pg.customer_emails.push(em);
                    const prod = cd.stripe_description || cd.product;
                    if (prod && !pg.products.includes(prod)) pg.products.push(prod);
                }
            }
        }
    }

    // ─── Enrich GoCardless payouts with payment customer data ───
    const { data: gcPayments } = await supabaseAdmin
        .from("csv_rows")
        .select("date, customer_name, customer_email, custom_data")
        .eq("source", "gocardless")
        .eq("custom_data->>type", "payment")
        .order("date", { ascending: false })
        .limit(3000);

    if (gcPayments && gcPayments.length > 0) {
        const gcPayoutGroups = groups.filter(g => g.source === "gocardless");
        for (const pg of gcPayoutGroups) {
            const pgDate = pg.date;
            const nearby = gcPayments.filter(p => {
                const pDate = (p.date || "").split("T")[0];
                return pDate && daysDiffStatic(pDate, pgDate) <= 3;
            });
            for (const pm of nearby) {
                const nm = pm.customer_name || (pm.custom_data as any)?.customer_name;
                const em = pm.customer_email || (pm.custom_data as any)?.customer_email;
                const cd = (pm.custom_data || {}) as Record<string, any>;
                if (nm && !pg.customer_names.includes(nm)) pg.customer_names.push(nm);
                if (em && !pg.customer_emails.includes(em)) pg.customer_emails.push(em);
                const prod = cd.subscription_name || cd.gc_subscription_id;
                if (prod && !pg.products.includes(prod)) pg.products.push(prod);
            }
        }
    }

    return groups;
}

// ═══════════════════════════════════════════════════════════
// Gateway Detection (from bank description)
// ═══════════════════════════════════════════════════════════

type GatewayHint = "braintree" | "braintree-amex" | "stripe" | "gocardless" | null;

/** Normalize text for fuzzy comparison (lowercase, strip accents/symbols) */
function normText(s: string): string {
    return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
}

/** Bigram-based string similarity (0-1), reused from ap-bank pattern */
function stringSimilarity(s1: string, s2: string): number {
    const a = normText(s1);
    const b = normText(s2);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.85;
    const bg = (s: string) => {
        const m = new Map<string, number>();
        for (let i = 0; i < s.length - 1; i++) {
            const bi = s.substring(i, i + 2);
            m.set(bi, (m.get(bi) || 0) + 1);
        }
        return m;
    };
    const biA = bg(a);
    const biB = bg(b);
    let matches = 0;
    biB.forEach((cnt, bi) => { matches += Math.min(cnt, biA.get(bi) || 0); });
    const total = (a.length - 1) + (b.length - 1);
    return total > 0 ? (2 * matches) / total : 0;
}

/** Static daysDiff for use outside POST handler (calendar days) */
function daysDiffStatic(d1: string, d2: string): number {
    return Math.abs((new Date(d1).getTime() - new Date(d2).getTime()) / 86400000);
}

/** Business-day diff: excludes weekends (Sat/Sun), returns integer */
function businessDaysDiff(d1: string, d2: string): number {
    const a = new Date(d1);
    const b = new Date(d2);
    let start = a < b ? new Date(a) : new Date(b);
    const end = a < b ? b : a;
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    let count = 0;
    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() + 1);
    while (cursor <= end) {
        const dow = cursor.getDay();
        if (dow !== 0 && dow !== 6) count++;
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
}

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
// Matching Engine — 12 Levels
// ═══════════════════════════════════════════════════════════

/** daysDiff: uses business days for levels >=4, calendar days for L1-L3 */
function daysDiff(d1: string, d2: string): number {
    return businessDaysDiff(d1, d2);
}

/** Calendar-day diff for backward compat in L1-L3 where exact dates matter */
function calendarDaysDiff(d1: string, d2: string): number {
    return daysDiffStatic(d1, d2);
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
        const [bankRows, disbGroups, ioRows] = await Promise.all([
            fetchBankRows(targetBanks),
            buildDisbursementGroups(),
            fetchAllPaginated("invoice-orders"),
        ]);

        // ─── Build invoice-orders name index for L9 ───
        const normalizeForMatch = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '');
        const getWords = (s: string) => s.split(/\s+/).filter(w => w.length >= 3);

        // Map: normalized customer_name → { fac_code, fac_name }
        const ioByName = new Map<string, { fac_code: string; fac_name: string }>();
        // Also build dominant FAC per name
        const nameToFacFreq = new Map<string, Map<string, number>>();

        for (const row of ioRows) {
            const cd = row.custom_data || {};
            const name = cd.customer_name || cd.company_name || cd.billing_name;
            const fac = cd.financial_account_code;
            if (!name || !fac) continue;
            const nName = normalizeForMatch(name);
            if (!nName) continue;
            if (!ioByName.has(nName)) {
                ioByName.set(nName, { fac_code: fac, fac_name: cd.financial_account_name || '' });
            }
            // Track frequency
            if (!nameToFacFreq.has(nName)) nameToFacFreq.set(nName, new Map());
            const freq = nameToFacFreq.get(nName)!;
            freq.set(fac, (freq.get(fac) || 0) + 1);
        }
        // Build dominant FAC per name
        const nameToDominantFac = new Map<string, { fac_code: string; fac_name: string }>();
        for (const [nName, freqMap] of nameToFacFreq) {
            let best = ''; let bestCount = 0;
            for (const [fac, count] of freqMap) {
                if (count > bestCount) { best = fac; bestCount = count; }
            }
            if (best) {
                const info = ioByName.get(nName);
                nameToDominantFac.set(nName, { fac_code: best, fac_name: info?.fac_name || '' });
            }
        }

        // ─── Name extraction regex patterns (from mega-v4) ───
        const NAME_PATTERNS: { regex: RegExp; label: string }[] = [
            { regex: /trans(?:f|\.?\s*inm)?\/(.+)/i, label: 'transf-prefix' },
            { regex: /^mxiso\s+(.+)/i, label: 'mxiso' },
            { regex: /orig co name:\s*(.+?)(?:\s+orig id|\s+sec|\s*$)/i, label: 'orig-co-name' },
            { regex: /remesa\s+(?:de\s+)?(.+)/i, label: 'remesa' },
            { regex: /(?:ach|wire|chips)\s+(?:credit|deposit|transfer)?\s*(?:from\s+)?(.+)/i, label: 'ach-wire' },
            { regex: /abono\s+(?:de\s+)?(.+)/i, label: 'abono' },
        ];
        const GATEWAY_NAMES_SKIP = /paypal|stripe|gocardless|braintree|american express|amex/i;

        // ─── Internal transfer and intercompany regex for L11 ───
        const INTERNAL_REGEX = /propia cuenta|movimiento entre|traspaso(?:s)? (?:propios?|entre)|dotacion|cuenta propia|transferencia\s+a\s+favor.*propia|transf.*propia|mov(?:imiento)?\s+interno/i;

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

        // Build payout ID → disbursement index for L0 deterministic matching
        const disbByPayoutId = new Map<string, DisbursementGroup>();
        for (const d of disbGroups) {
            if (d.source === 'stripe') {
                // Stripe payout references are like po_XXXX stored in reference or transaction_ids
                for (const tid of d.transaction_ids) {
                    if (tid.startsWith('po_')) disbByPayoutId.set(tid, d);
                }
                if (d.reference.startsWith('po_')) disbByPayoutId.set(d.reference, d);
            }
            // Braintree settlement batch IDs
            if (d.settlement_batch_id && d.source.startsWith('braintree')) {
                disbByPayoutId.set(d.settlement_batch_id, d);
            }
        }

        // Regex patterns for extracting payout/settlement IDs from bank descriptions
        const PAYOUT_ID_PATTERNS = [
            /\bpo_[a-zA-Z0-9]{10,}\b/,                    // Stripe payout ID (po_1SsYEhIO1Dgqa3T...)
            /\b\d{4}_\d{2}_\d{2}_[a-z0-9_]+\b/i,          // Braintree settlement batch (2025_01_15_merchant)
            /batch[\s_:-]*(\w{6,})/i,                       // Generic batch reference
        ];

        // Process each bank row through 12 matching levels
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

            // ─── LEVEL 0: Payout/Settlement ID extraction (deterministic) ───
            if (!match) {
                const desc = bankRow.description;
                for (const pattern of PAYOUT_ID_PATTERNS) {
                    const idMatch = desc.match(pattern);
                    if (idMatch) {
                        const extractedId = idMatch[1] || idMatch[0];
                        const directDisb = disbByPayoutId.get(extractedId);
                        if (directDisb && !matchedDisbRefs.has(directDisb.reference) && directDisb.currency === expectedCurrency) {
                            match = directDisb;
                            matchLevel = 0;
                            matchType = `payout_id_${pattern.source || 'regex'}`;
                            confidence = 1.0;
                            console.log(`[Deep L0] Payout ID match: ${extractedId} → bank ${bankRow.id} (${bankRow.source})`);
                            break;
                        }
                    }
                }
            }

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

            // ─── LEVEL 2: Date range ±3 calendar days + amount ±0.10 ───
            if (!match) {
                const candidates = validDisbs.filter(d => calendarDaysDiff(d.date, bankDate) <= 3 && Math.abs(d.amount - bankAmount) < 0.10);
                if (candidates.length > 0) {
                    // Sort by closest date, then closest amount
                    candidates.sort((a, b) => {
                        const dDiff = calendarDaysDiff(a.date, bankDate) - calendarDaysDiff(b.date, bankDate);
                        if (dDiff !== 0) return dDiff;
                        return Math.abs(a.amount - bankAmount) - Math.abs(b.amount - bankAmount);
                    });
                    // Prefer gateway hint
                    const hintMatch = gatewayHint ? candidates.find(c => c.source === gatewayHint || (gatewayHint === "braintree" && c.source.startsWith("braintree"))) : null;
                    match = hintMatch || candidates[0];
                    matchLevel = 2;
                    matchType = "date_range_3d";
                    confidence = 0.95 - calendarDaysDiff(match.date, bankDate) * 0.02;
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

            // ─── LEVEL 7b: Refund-offset (disbursement - nearby refunds ≈ bank amount) ───
            if (!match) {
                // Some bank deposits are net of refund disbursements processed nearby
                // Try: disbursement_amount - refund_disbursements = bank_amount
                const nearbyPositive = validDisbs.filter(d =>
                    d.amount > 0 && daysDiff(d.date, bankDate) <= 5 && d.amount > bankAmount
                );
                // Look for negative/refund disbursements (amount < 0 not normally present, but
                // look for smaller positive disbs that when subtracted give the bank amount)
                for (const posDisb of nearbyPositive) {
                    if (match) break;
                    const diff = posDisb.amount - bankAmount;
                    if (diff <= 0 || diff > posDisb.amount * 0.3) continue; // refund max 30%
                    // Check if there's any other disbursement or fee that equals the difference
                    const refundMatch = validDisbs.find(d =>
                        d !== posDisb &&
                        !matchedDisbRefs.has(d.reference) &&
                        daysDiff(d.date, bankDate) <= 5 &&
                        Math.abs(d.amount - diff) < 0.50
                    );
                    if (refundMatch) {
                        const merged: DisbursementGroup = {
                            ...posDisb,
                            amount: Math.round((posDisb.amount - refundMatch.amount) * 100) / 100,
                            reference: `${posDisb.reference}-refund:${refundMatch.reference}`,
                            transaction_count: posDisb.transaction_count + refundMatch.transaction_count,
                            transaction_ids: [...posDisb.transaction_ids, ...refundMatch.transaction_ids],
                            customer_names: [...new Set([...posDisb.customer_names, ...refundMatch.customer_names])],
                            customer_emails: [...new Set([...posDisb.customer_emails, ...refundMatch.customer_emails])],
                            order_ids: [...new Set([...posDisb.order_ids, ...refundMatch.order_ids])],
                            products: [...new Set([...posDisb.products, ...refundMatch.products])],
                        };
                        match = merged;
                        matchLevel = 7;
                        matchType = "refund_offset_net";
                        confidence = 0.62;
                        matchedDisbRefs.add(posDisb.reference);
                        matchedDisbRefs.add(refundMatch.reference);
                    }
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

            // ─── LEVEL 9: Name extraction from bank description → IO → FAC ───
            if (!match) {
                const desc = bankRow.description;
                let extractedName: string | null = null;
                let extractionMethod = '';

                for (const { regex, label } of NAME_PATTERNS) {
                    const m = desc.match(regex);
                    if (m && m[1]) {
                        const candidate = m[1].trim();
                        // Skip if it's a known gateway name
                        if (!GATEWAY_NAMES_SKIP.test(candidate) && candidate.length >= 3) {
                            extractedName = candidate;
                            extractionMethod = label;
                            break;
                        }
                    }
                }

                if (extractedName) {
                    const nExtracted = normalizeForMatch(extractedName);
                    let facInfo: { fac_code: string; fac_name: string } | null = null;

                    // 1. Exact match
                    if (ioByName.has(nExtracted)) {
                        facInfo = nameToDominantFac.get(nExtracted) || ioByName.get(nExtracted)!;
                    }
                    // 2. Substring match
                    if (!facInfo) {
                        for (const [key, info] of ioByName) {
                            if (key.includes(nExtracted) || nExtracted.includes(key)) {
                                facInfo = nameToDominantFac.get(key) || info;
                                break;
                            }
                        }
                    }
                    // 3. Bigram fuzzy match (similarity ≥ 0.55)
                    if (!facInfo) {
                        let bestSim = 0;
                        let bestKey = '';
                        for (const [key] of ioByName) {
                            const sim = stringSimilarity(nExtracted, key);
                            if (sim > bestSim) {
                                bestSim = sim;
                                bestKey = key;
                            }
                        }
                        if (bestSim >= 0.55 && bestKey) {
                            facInfo = nameToDominantFac.get(bestKey) || ioByName.get(bestKey)!;
                        }
                    }
                    // 4. Word overlap fallback (2+ words >= 3 chars, or 1 word >= 5 chars)
                    if (!facInfo) {
                        const extractedWords = getWords(nExtracted);
                        for (const [key, info] of ioByName) {
                            const keyWords = getWords(key);
                            const overlap = extractedWords.filter(w => keyWords.includes(w));
                            if (overlap.length >= 2 || (overlap.length === 1 && overlap[0].length >= 5)) {
                                facInfo = nameToDominantFac.get(key) || info;
                                break;
                            }
                        }
                    }

                    if (facInfo) {
                        // Try to find a disbursement linked to this customer within ±10 business days
                        const nameDisb = validDisbs.find(d =>
                            daysDiff(d.date, bankDate) <= 10 &&
                            Math.abs(d.amount - bankAmount) < 5.00
                        );
                        if (nameDisb) {
                            match = { ...nameDisb };
                            matchLevel = 9;
                            matchType = `name_extraction_${extractionMethod}`;
                            confidence = 0.52;
                        }
                    }
                }
            }

            // ─── LEVEL 10: AMEX extended (±10 business days + ±3% tolerance) ───
            if (!match && (gatewayHint === "braintree-amex" || bankRow.description.toLowerCase().includes("amex") || bankRow.description.toLowerCase().includes("american express"))) {
                const tolerance = Math.max(bankAmount * 0.03, 1.00);
                const amexCandidates = disbGroups.filter(d =>
                    d.currency === expectedCurrency &&
                    !matchedDisbRefs.has(d.reference) &&
                    (d.source === "braintree-amex" || d.source.includes("amex")) &&
                    daysDiff(d.date, bankDate) <= 10 &&
                    Math.abs(d.amount - bankAmount) < tolerance
                );
                if (amexCandidates.length > 0) {
                    amexCandidates.sort((a, b) => {
                        const aScore = Math.abs(a.amount - bankAmount) / bankAmount + daysDiff(a.date, bankDate) * 0.02;
                        const bScore = Math.abs(b.amount - bankAmount) / bankAmount + daysDiff(b.date, bankDate) * 0.02;
                        return aScore - bScore;
                    });
                    match = amexCandidates[0];
                    matchLevel = 10;
                    matchType = "amex_extended_10bd";
                    confidence = 0.48;
                }
            }

            // ─── LEVEL 11: Internal transfer / Intercompany detection ───
            if (!match) {
                const desc = bankRow.description;
                const descLower = desc.toLowerCase();
                // Check internal transfer patterns
                if (INTERNAL_REGEX.test(desc)) {
                    // Match debit in another bank with same amount ±0.10 within ±3 business days
                    const crossBankMatch = bankRows.find(other =>
                        other.id !== bankRow.id &&
                        other.source !== bankRow.source &&
                        !matchedBankIds.has(other.id) &&
                        other.amount < 0 &&
                        Math.abs(Math.abs(other.amount) - bankAmount) < 0.10 &&
                        daysDiff(other.date, bankDate) <= 3
                    );
                    if (crossBankMatch) {
                        // Mark both as internal transfers
                        matchedBankIds.add(bankRow.id);
                        matchedBankIds.add(crossBankMatch.id);
                        const levelKey = "L11_internal_transfer";
                        levelStats.set(levelKey, (levelStats.get(levelKey) || 0) + 1);
                        matches.push({
                            bank_row_id: bankRow.id,
                            bank_date: bankDate,
                            bank_amount: bankAmount,
                            bank_description: desc.substring(0, 100),
                            match_level: 11,
                            match_type: "internal_transfer_cross_bank",
                            disbursement_source: "internal",
                            disbursement_date: crossBankMatch.date,
                            disbursement_amount: Math.abs(crossBankMatch.amount),
                            disbursement_reference: `internal:${crossBankMatch.source}:${crossBankMatch.id}`,
                            confidence: 0.45,
                            settlement_batch_id: undefined,
                            transaction_ids: [],
                            transaction_count: 0,
                            customer_names: [],
                            customer_emails: [],
                            order_ids: [],
                            products: [],
                        });
                        continue; // Skip to next bankRow
                    }
                }
                // Check intercompany DSD pattern
                if (descLower.includes('dsd') && (/llc|s\.l|sl |sl,|planning center/i.test(descLower))) {
                    // Mark as intercompany — no need for disbursement match
                    matchedBankIds.add(bankRow.id);
                    const levelKey = "L11_intercompany_dsd";
                    levelStats.set(levelKey, (levelStats.get(levelKey) || 0) + 1);
                    matches.push({
                        bank_row_id: bankRow.id,
                        bank_date: bankDate,
                        bank_amount: bankAmount,
                        bank_description: desc.substring(0, 100),
                        match_level: 11,
                        match_type: "intercompany_dsd",
                        disbursement_source: "internal",
                        disbursement_date: bankDate,
                        disbursement_amount: bankAmount,
                        disbursement_reference: `intercompany-dsd:${bankRow.id}`,
                        confidence: 0.45,
                        settlement_batch_id: undefined,
                        transaction_ids: [],
                        transaction_count: 0,
                        customer_names: [],
                        customer_emails: [],
                        order_ids: [],
                        products: [],
                    });
                    continue; // Skip to next bankRow
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
        // LEVEL 12: Refund/Chargeback Debit Matching (second pass for negative amounts)
        // ═══════════════════════════════════════════════════════════
        // Match bank debits (amount < 0) against gateway refund transactions
        const refundSources = ["braintree-api-revenue", "braintree-amex", "stripe-eur-payouts", "stripe-usd-payouts", "gocardless-payouts"];

        for (const bankRow of bankRows) {
            if (matchedBankIds.has(bankRow.id)) continue;
            if (bankRow.amount >= 0) continue; // Only process debits

            const bankDate = bankRow.date;
            const bankDebitAbs = Math.abs(bankRow.amount);
            const expectedCurrency = bankToExpectedCurrency(bankRow.source);
            const descLower = bankRow.description.toLowerCase();

            // Skip if it looks like a transfer/AP payment (not a refund)
            if (INTERNAL_REGEX.test(bankRow.description)) continue;

            // Look for refund transactions in gateway data
            // Refunds often show as negative amounts in gateway sources too
            const refundDisbs = disbGroups.filter(d => {
                if (matchedDisbRefs.has(d.reference)) return false;
                if (d.currency !== expectedCurrency) return false;
                // Check description keywords that suggest refund
                const hasRefundKeyword = descLower.includes('refund') || descLower.includes('chargeback') ||
                    descLower.includes('devolucion') || descLower.includes('reembolso') ||
                    descLower.includes('reversal') || descLower.includes('contra');
                if (!hasRefundKeyword) return false;
                if (daysDiff(d.date, bankDate) > 5) return false;
                if (Math.abs(d.amount - bankDebitAbs) > 0.10) return false;
                return true;
            });

            if (refundDisbs.length > 0) {
                refundDisbs.sort((a, b) => Math.abs(a.amount - bankDebitAbs) - Math.abs(b.amount - bankDebitAbs));
                const refundMatch = refundDisbs[0];
                matchedBankIds.add(bankRow.id);
                matchedDisbRefs.add(refundMatch.reference);
                const levelKey = "L12_refund_debit";
                levelStats.set(levelKey, (levelStats.get(levelKey) || 0) + 1);
                matches.push({
                    bank_row_id: bankRow.id,
                    bank_date: bankDate,
                    bank_amount: bankRow.amount,
                    bank_description: bankRow.description.substring(0, 100),
                    match_level: 12,
                    match_type: "refund_debit_match",
                    disbursement_source: refundMatch.source,
                    disbursement_date: refundMatch.date,
                    disbursement_amount: refundMatch.amount,
                    disbursement_reference: `refund:${refundMatch.reference}`,
                    confidence: 0.50,
                    settlement_batch_id: refundMatch.settlement_batch_id,
                    transaction_ids: refundMatch.transaction_ids,
                    transaction_count: refundMatch.transaction_count,
                    customer_names: refundMatch.customer_names,
                    customer_emails: refundMatch.customer_emails,
                    order_ids: refundMatch.order_ids,
                    products: refundMatch.products,
                });
            }
        }

        // ═══════════════════════════════════════════════════════════
        // LEVEL 13: Global Ranking Score (re-evaluate unmatched with composite scoring)
        // ═══════════════════════════════════════════════════════════
        // For remaining unmatched bank credits, collect ALL candidates and rank by composite score
        // instead of waterfall "first match wins". This captures cases where a lower-level match
        // is actually the best overall candidate.
        for (const bankRow of bankRows) {
            if (matchedBankIds.has(bankRow.id)) continue;
            if (bankRow.amount <= 0) continue;

            const bankDate = bankRow.date;
            const bankAmount = bankRow.amount;
            const expectedCurrency = bankToExpectedCurrency(bankRow.source);
            const expectedGateways = bankToExpectedGateways(bankRow.source);
            const gatewayHint = detectGatewayFromDescription(bankRow.description);

            // Collect ALL candidate disbursements within generous bounds
            const allCandidates = disbGroups.filter(d =>
                d.currency === expectedCurrency &&
                !matchedDisbRefs.has(d.reference) &&
                daysDiff(d.date, bankDate) <= 15 &&
                Math.abs(d.amount - bankAmount) < Math.max(bankAmount * 0.05, 5.0)
            );

            if (allCandidates.length === 0) continue;

            // Score each candidate: composite of amount proximity, date proximity, gateway hint, name match
            const scored = allCandidates.map(d => {
                let score = 0;

                // Amount proximity (0-3 points): closer = better
                const amtDiffPct = Math.abs(d.amount - bankAmount) / Math.max(bankAmount, 1);
                if (amtDiffPct < 0.001) score += 3;       // exact
                else if (amtDiffPct < 0.005) score += 2.5; // very close
                else if (amtDiffPct < 0.01) score += 2;    // close
                else if (amtDiffPct < 0.02) score += 1;    // reasonable
                else score += Math.max(0, 0.5 - amtDiffPct * 10);

                // Date proximity (0-2 points): closer = better
                const dDiff = daysDiff(d.date, bankDate);
                if (dDiff === 0) score += 2;
                else if (dDiff <= 1) score += 1.8;
                else if (dDiff <= 3) score += 1.5;
                else if (dDiff <= 5) score += 1.0;
                else if (dDiff <= 7) score += 0.5;
                else score += Math.max(0, 0.3 - dDiff * 0.02);

                // Gateway hint match (0-1.5 points)
                if (gatewayHint) {
                    if (d.source === gatewayHint) score += 1.5;
                    else if (gatewayHint === "braintree" && d.source.startsWith("braintree")) score += 1.2;
                    else if (expectedGateways.includes(d.source)) score += 0.3;
                }

                // Customer name match (0-1 point): extract from description and compare
                if (d.customer_names.length > 0) {
                    const desc = bankRow.description;
                    for (const name of d.customer_names) {
                        const sim = stringSimilarity(desc, name);
                        if (sim > 0.4) {
                            score += Math.min(1, sim);
                            break;
                        }
                    }
                }

                return { disb: d, score };
            });

            // Sort by score descending
            scored.sort((a, b) => b.score - a.score);

            // Accept only if best score exceeds threshold (3.5 = reasonable amount + date match)
            if (scored[0].score >= 3.5) {
                const best = scored[0].disb;
                matchedBankIds.add(bankRow.id);
                matchedDisbRefs.add(best.reference);

                const levelKey = "L13_global_ranking";
                levelStats.set(levelKey, (levelStats.get(levelKey) || 0) + 1);

                matches.push({
                    bank_row_id: bankRow.id,
                    bank_date: bankDate,
                    bank_amount: bankAmount,
                    bank_description: bankRow.description.substring(0, 100),
                    match_level: 13,
                    match_type: "global_ranking_score",
                    disbursement_source: best.source,
                    disbursement_date: best.date,
                    disbursement_amount: best.amount,
                    disbursement_reference: best.reference,
                    confidence: Math.min(0.90, scored[0].score / 7.5), // Normalize to 0-0.90
                    settlement_batch_id: best.settlement_batch_id,
                    transaction_ids: best.transaction_ids,
                    transaction_count: best.transaction_count,
                    customer_names: best.customer_names,
                    customer_emails: best.customer_emails,
                    order_ids: best.order_ids,
                    products: best.products,
                });
            }
        }

        // ═══════════════════════════════════════════════════════════
        // LEVEL 14: Refund-Adjusted Payout (charges - refunds = expected payout)
        // ═══════════════════════════════════════════════════════════
        // For bank deposits that don't match any single disbursement, try computing
        // the expected payout as: sum(charges in settlement window) - sum(refunds in window)
        // This handles cases where the gateway nets refunds against the payout.
        for (const bankRow of bankRows) {
            if (matchedBankIds.has(bankRow.id)) continue;
            if (bankRow.amount <= 0) continue;

            const bankDate = bankRow.date;
            const bankAmount = bankRow.amount;
            const expectedCurrency = bankToExpectedCurrency(bankRow.source);
            const gatewayHint = detectGatewayFromDescription(bankRow.description);

            // Only attempt for gateway-identified bank rows
            if (!gatewayHint) continue;

            // Find positive (charge) and negative (refund) disbursements from same gateway within ±5 days
            const srcFilter = gatewayHint === "braintree-amex" ? "braintree-amex" : gatewayHint;
            const nearbyDisbs = disbGroups.filter(d =>
                d.currency === expectedCurrency &&
                !matchedDisbRefs.has(d.reference) &&
                (d.source === srcFilter || (gatewayHint === "braintree" && d.source.startsWith("braintree"))) &&
                daysDiff(d.date, bankDate) <= 5
            );

            if (nearbyDisbs.length < 2) continue;

            // Separate into positive (charges) and potential offset groups
            const positiveDisbs = nearbyDisbs.filter(d => d.amount > 0);
            const allAmounts = nearbyDisbs.map(d => d.amount);

            // Try subsets of positive disbs minus other positives (net effect)
            // Sometimes payout = large_disb - small_disb (refund was netted)
            for (let i = 0; i < positiveDisbs.length; i++) {
                if (matchedBankIds.has(bankRow.id)) break;
                const mainDisb = positiveDisbs[i];
                if (mainDisb.amount <= bankAmount) continue; // Must be larger than bank deposit

                const diff = mainDisb.amount - bankAmount;
                // Look for a combination that accounts for the difference (refunds netted)
                for (let j = 0; j < nearbyDisbs.length; j++) {
                    if (i === j) continue;
                    const offsetDisb = nearbyDisbs[j];
                    if (Math.abs(offsetDisb.amount - diff) < 1.0) {
                        // Found: mainDisb.amount - offsetDisb.amount ≈ bankAmount
                        const netAmount = mainDisb.amount - offsetDisb.amount;
                        if (Math.abs(netAmount - bankAmount) < 1.0) {
                            matchedBankIds.add(bankRow.id);
                            matchedDisbRefs.add(mainDisb.reference);
                            matchedDisbRefs.add(offsetDisb.reference);

                            const levelKey = "L14_refund_adjusted_payout";
                            levelStats.set(levelKey, (levelStats.get(levelKey) || 0) + 1);

                            const merged: DisbursementGroup = {
                                ...mainDisb,
                                amount: Math.round(netAmount * 100) / 100,
                                reference: `${mainDisb.reference}-adj:${offsetDisb.reference}`,
                                transaction_count: mainDisb.transaction_count + offsetDisb.transaction_count,
                                transaction_ids: [...mainDisb.transaction_ids, ...offsetDisb.transaction_ids],
                                customer_names: [...new Set([...mainDisb.customer_names, ...offsetDisb.customer_names])],
                                customer_emails: [...new Set([...mainDisb.customer_emails, ...offsetDisb.customer_emails])],
                                order_ids: [...new Set([...mainDisb.order_ids, ...offsetDisb.order_ids])],
                                products: [...new Set([...mainDisb.products, ...offsetDisb.products])],
                            };

                            matches.push({
                                bank_row_id: bankRow.id,
                                bank_date: bankDate,
                                bank_amount: bankAmount,
                                bank_description: bankRow.description.substring(0, 100),
                                match_level: 14,
                                match_type: "refund_adjusted_payout",
                                disbursement_source: merged.source,
                                disbursement_date: merged.date,
                                disbursement_amount: merged.amount,
                                disbursement_reference: merged.reference,
                                confidence: 0.60,
                                settlement_batch_id: merged.settlement_batch_id,
                                transaction_ids: merged.transaction_ids,
                                transaction_count: merged.transaction_count,
                                customer_names: merged.customer_names,
                                customer_emails: merged.customer_emails,
                                order_ids: merged.order_ids,
                                products: merged.products,
                            });
                            break;
                        }
                    }
                }
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

                    // Look up FAC classification from invoice-orders if we have order_ids
                    let facCode: string | null = null;
                    let facName: string | null = null;
                    if (m.order_ids.length > 0) {
                        const { data: orderRows } = await supabaseAdmin
                            .from("csv_rows")
                            .select("custom_data")
                            .eq("source", "invoice-orders")
                            .in("custom_data->>order_id", m.order_ids.slice(0, 5))
                            .limit(1);
                        if (orderRows && orderRows.length > 0) {
                            const ocd = orderRows[0].custom_data as Record<string, any>;
                            facCode = ocd?.financial_account_code || null;
                            facName = ocd?.financial_account_name || null;
                        }
                    }

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
                        // FAC classification
                        ...(facCode && { matched_invoice_fac: facCode }),
                        ...(facName && { matched_invoice_fac_name: facName }),
                        // Internal transfer / intercompany flags
                        ...(m.disbursement_source === "internal" && {
                            is_internal_transfer: true,
                            pnl_line: "internal",
                            pnl_source: m.match_type,
                        }),
                        // Refund debit flag
                        ...(m.match_type === "refund_debit_match" && {
                            is_refund_debit: true,
                            pnl_line: "refund",
                            pnl_source: "refund-debit-deep-L12",
                        }),
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
        const totalBankDebits = bankRows.filter(r => r.amount < 0).length;
        const totalValue = matches.reduce((s, m) => s + Math.abs(m.bank_amount), 0);
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
                bankDebitsUnreconciled: totalBankDebits,
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
