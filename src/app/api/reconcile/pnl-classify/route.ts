/**
 * API Endpoint: P&L Classification for Unreconciled Bank Rows
 * 
 * POST /api/reconcile/pnl-classify
 * 
 * Classifies remaining unreconciled bank inflows into P&L categories:
 * 
 *   Sub-fase A — Internal transfers (regex detection)
 *   Sub-fase B — Intercompany DSD (description pattern)
 *   Sub-fase C — Customer name extraction → IO → FAC
 *   Sub-fase D — Gateway-dominant FAC (most frequent FAC per gateway)
 *   Sub-fase E — Catch-all 105.0 (Other Income)
 * 
 * Body: { dryRun?: boolean, banks?: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ALL_BANKS = ["bankinter-eur", "bankinter-usd", "sabadell", "chase-usd"];
const BATCH_SIZE = 50;

// ─── Internal transfer regex (from mega-v4) ───
const INTERNAL_REGEX = /propia cuenta|movimiento entre|traspaso(?:s)? (?:propios?|entre)|dotacion|cuenta propia|transferencia\s+a\s+favor.*propia|transf.*propia|mov(?:imiento)?\s+interno/i;

// ─── Name extraction patterns (from mega-v4) ───
const NAME_PATTERNS: { regex: RegExp; label: string }[] = [
    { regex: /trans(?:f|\.?\s*inm)?\/(.+)/i, label: 'transf-prefix' },
    { regex: /^mxiso\s+(.+)/i, label: 'mxiso' },
    { regex: /orig co name:\s*(.+?)(?:\s+orig id|\s+sec|\s*$)/i, label: 'orig-co-name' },
    { regex: /remesa\s+(?:de\s+)?(.+)/i, label: 'remesa' },
    { regex: /(?:ach|wire|chips)\s+(?:credit|deposit|transfer)?\s*(?:from\s+)?(.+)/i, label: 'ach-wire' },
    { regex: /abono\s+(?:de\s+)?(.+)/i, label: 'abono' },
];

const GATEWAY_NAMES_SKIP = /paypal|stripe|gocardless|braintree|american express|amex/i;

// Helpers
const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '');
const getWords = (s: string) => s.split(/\s+/).filter(w => w.length >= 3);

interface BankRow {
    id: string;
    date: string;
    amount: number;
    description: string;
    reconciled: boolean;
    custom_data: Record<string, any>;
    source: string;
}

interface PnlUpdate {
    id: string;
    pnl_line: string;
    pnl_fac: string;
    pnl_source: string;
    extra?: Record<string, any>;
}

async function fetchUnclassifiedBankRows(banks: string[]): Promise<BankRow[]> {
    const allRows: BankRow[] = [];
    for (const bank of banks) {
        let offset = 0;
        while (true) {
            const { data, error } = await supabaseAdmin
                .from("csv_rows")
                .select("id, date, amount, description, reconciled, custom_data, source")
                .eq("source", bank)
                .is("custom_data->>pnl_line", null)  // Not yet classified
                .gt("amount", 0)  // Credits only
                .range(offset, offset + 999)
                .order("date", { ascending: false });

            if (error || !data || data.length === 0) break;
            allRows.push(...data.map(r => ({
                id: r.id,
                date: r.date?.split('T')[0] || '',
                amount: Math.round(parseFloat(r.amount) * 100) / 100,
                description: r.description || '',
                reconciled: r.reconciled || false,
                custom_data: r.custom_data || {},
                source: r.source,
            })));
            if (data.length < 1000) break;
            offset += 1000;
        }
    }
    return allRows;
}

async function fetchInvoiceOrders(): Promise<any[]> {
    const allRows: any[] = [];
    let offset = 0;
    while (true) {
        const { data, error } = await supabaseAdmin
            .from("csv_rows")
            .select("custom_data")
            .eq("source", "invoice-orders")
            .range(offset, offset + 999);
        if (error || !data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < 1000) break;
        offset += 1000;
    }
    return allRows;
}

async function fetchGatewayRows(): Promise<any[]> {
    const sources = [
        "braintree-api-revenue", "braintree-amex",
        "stripe-eur-payouts", "stripe-usd-payouts",
        "gocardless-payouts"
    ];
    const allRows: any[] = [];
    for (const src of sources) {
        let offset = 0;
        while (true) {
            const { data, error } = await supabaseAdmin
                .from("csv_rows")
                .select("custom_data, source")
                .eq("source", src)
                .range(offset, offset + 999);
            if (error || !data || data.length === 0) break;
            allRows.push(...data);
            if (data.length < 1000) break;
            offset += 1000;
        }
    }
    return allRows;
}

async function writeUpdates(updates: PnlUpdate[], dryRun: boolean): Promise<{ updated: number; errors: string[] }> {
    if (dryRun || updates.length === 0) return { updated: 0, errors: [] };

    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        for (const u of batch) {
            try {
                const { data: current } = await supabaseAdmin
                    .from("csv_rows")
                    .select("custom_data")
                    .eq("id", u.id)
                    .single();

                const existingCd = current?.custom_data || {};
                const newCd = {
                    ...existingCd,
                    pnl_line: u.pnl_line,
                    pnl_fac: u.pnl_fac,
                    pnl_source: u.pnl_source,
                    pnl_classified_at: new Date().toISOString(),
                    ...u.extra,
                };

                const updatePayload: Record<string, any> = { custom_data: newCd };
                // Mark internal transfers as reconciled
                if (u.pnl_line === 'internal' && !existingCd.reconciled) {
                    updatePayload.reconciled = true;
                    newCd.reconciled_at = new Date().toISOString();
                    newCd.reconciliationType = 'automatic';
                }

                const { error } = await supabaseAdmin
                    .from("csv_rows")
                    .update(updatePayload)
                    .eq("id", u.id);

                if (error) errors.push(`${u.id}: ${error.message}`);
                else updated++;
            } catch (err: any) {
                errors.push(`${u.id}: ${err.message}`);
            }
        }
    }
    return { updated, errors };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const dryRun = body.dryRun !== false;
        const banks: string[] = body.banks || ALL_BANKS;

        const startTime = Date.now();
        const stats = {
            internal_transfers: 0,
            intercompany_dsd: 0,
            name_extraction: 0,
            gateway_dominant_fac: 0,
            catch_all_105: 0,
        };

        // Fetch data
        const [bankRows, ioRows, gwRows] = await Promise.all([
            fetchUnclassifiedBankRows(banks),
            fetchInvoiceOrders(),
            fetchGatewayRows(),
        ]);

        console.log(`[pnl-classify] ${bankRows.length} unclassified bank credits found`);

        // ─── Build IO name index ───
        const ioByName = new Map<string, { fac_code: string; fac_name: string }>();
        const nameToFacFreq = new Map<string, Map<string, number>>();

        for (const row of ioRows) {
            const cd = row.custom_data || {};
            const name = cd.customer_name || cd.company_name || cd.billing_name;
            const fac = cd.financial_account_code;
            if (!name || !fac) continue;
            const nName = normalize(name);
            if (!nName) continue;
            if (!ioByName.has(nName)) {
                ioByName.set(nName, { fac_code: fac, fac_name: cd.financial_account_name || '' });
            }
            if (!nameToFacFreq.has(nName)) nameToFacFreq.set(nName, new Map());
            const freq = nameToFacFreq.get(nName)!;
            freq.set(fac, (freq.get(fac) || 0) + 1);
        }

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

        // ─── Build gateway dominant FAC ───
        const gatewayFacFreq: Record<string, Map<string, number>> = {
            braintree: new Map(), 'braintree-amex': new Map(),
            stripe: new Map(), gocardless: new Map(),
        };

        for (const row of gwRows) {
            const cd = row.custom_data || {};
            const fac = cd.matched_invoice_fac || cd.financial_account_code;
            if (!fac) continue;
            const src = row.source as string;
            let key = 'braintree';
            if (src.includes('amex')) key = 'braintree-amex';
            else if (src.includes('stripe')) key = 'stripe';
            else if (src.includes('gocardless')) key = 'gocardless';

            if (gatewayFacFreq[key]) {
                gatewayFacFreq[key].set(fac, (gatewayFacFreq[key].get(fac) || 0) + 1);
            }
        }

        const gatewayDominantFac: Record<string, string> = {};
        for (const [gw, freqMap] of Object.entries(gatewayFacFreq)) {
            let best = ''; let bestCount = 0;
            for (const [fac, count] of freqMap) {
                if (count > bestCount) { best = fac; bestCount = count; }
            }
            if (best) gatewayDominantFac[gw] = best;
        }

        // ─── Process rows through 5 sub-phases ───
        const processed = new Set<string>();
        const allUpdates: PnlUpdate[] = [];

        // SUB-FASE A: Internal Transfers
        for (const row of bankRows) {
            if (processed.has(row.id)) continue;
            if (INTERNAL_REGEX.test(row.description)) {
                allUpdates.push({
                    id: row.id,
                    pnl_line: 'internal',
                    pnl_fac: 'internal',
                    pnl_source: 'internal-transfer-pnl-v1',
                    extra: { is_internal_transfer: true },
                });
                processed.add(row.id);
                stats.internal_transfers++;
            }
        }
        console.log(`[pnl-classify] A: ${stats.internal_transfers} internal transfers`);

        // SUB-FASE B: Intercompany DSD
        for (const row of bankRows) {
            if (processed.has(row.id)) continue;
            const descLower = row.description.toLowerCase();
            if (descLower.includes('dsd') && /llc|s\.l|sl |sl,|planning center/i.test(descLower)) {
                allUpdates.push({
                    id: row.id,
                    pnl_line: 'internal',
                    pnl_fac: 'internal',
                    pnl_source: 'intercompany-dsd-pnl-v1',
                    extra: { is_intercompany: true },
                });
                processed.add(row.id);
                stats.intercompany_dsd++;
            }
        }
        console.log(`[pnl-classify] B: ${stats.intercompany_dsd} intercompany DSD`);

        // SUB-FASE C: Customer name extraction → IO → FAC
        for (const row of bankRows) {
            if (processed.has(row.id)) continue;

            let extractedName: string | null = null;
            let extractionMethod = '';

            for (const { regex, label } of NAME_PATTERNS) {
                const m = row.description.match(regex);
                if (m && m[1]) {
                    const candidate = m[1].trim();
                    if (!GATEWAY_NAMES_SKIP.test(candidate) && candidate.length >= 3) {
                        extractedName = candidate;
                        extractionMethod = label;
                        break;
                    }
                }
            }

            if (!extractedName) continue;

            const nExtracted = normalize(extractedName);
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
            // 3. Fuzzy match
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
                allUpdates.push({
                    id: row.id,
                    pnl_line: facInfo.fac_code.split('.')[0] || facInfo.fac_code,
                    pnl_fac: facInfo.fac_code,
                    pnl_source: `name-extraction-${extractionMethod}-pnl-v1`,
                    extra: {
                        extracted_customer_name: extractedName,
                        matched_invoice_fac: facInfo.fac_code,
                        matched_invoice_fac_name: facInfo.fac_name,
                    },
                });
                processed.add(row.id);
                stats.name_extraction++;
            }
        }
        console.log(`[pnl-classify] C: ${stats.name_extraction} name extractions`);

        // SUB-FASE D: Gateway-dominant FAC
        for (const row of bankRows) {
            if (processed.has(row.id)) continue;

            const cd = row.custom_data;
            const descLower = row.description.toLowerCase();
            let gatewayKey: string | null = null;

            // Detect gateway from custom_data or description
            if (cd.paymentSource) {
                const ps = cd.paymentSource.toLowerCase();
                if (ps.includes('amex')) gatewayKey = 'braintree-amex';
                else if (ps.includes('paypal') || ps.includes('braintree')) gatewayKey = 'braintree';
                else if (ps.includes('stripe')) gatewayKey = 'stripe';
                else if (ps.includes('gocardless')) gatewayKey = 'gocardless';
            }
            if (!gatewayKey) {
                if (descLower.includes('american express') || descLower.includes('amex')) gatewayKey = 'braintree-amex';
                else if (descLower.includes('paypal') || descLower.includes('braintree')) gatewayKey = 'braintree';
                else if (descLower.includes('stripe')) gatewayKey = 'stripe';
                else if (descLower.includes('gocardless')) gatewayKey = 'gocardless';
            }

            if (gatewayKey && gatewayDominantFac[gatewayKey]) {
                const fac = gatewayDominantFac[gatewayKey];
                allUpdates.push({
                    id: row.id,
                    pnl_line: fac.split('.')[0] || fac,
                    pnl_fac: fac,
                    pnl_source: `gateway-dominant-${gatewayKey}-pnl-v1`,
                });
                processed.add(row.id);
                stats.gateway_dominant_fac++;
            }
        }
        console.log(`[pnl-classify] D: ${stats.gateway_dominant_fac} gateway-dominant FAC`);

        // SUB-FASE E: Catch-all 105.0 (Other Income)
        for (const row of bankRows) {
            if (processed.has(row.id)) continue;
            allUpdates.push({
                id: row.id,
                pnl_line: '105',
                pnl_fac: '105.0',
                pnl_source: 'catch-all-other-income-pnl-v1',
            });
            processed.add(row.id);
            stats.catch_all_105++;
        }
        console.log(`[pnl-classify] E: ${stats.catch_all_105} catch-all 105.0`);

        // Write all updates
        const { updated, errors } = await writeUpdates(allUpdates, dryRun);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        const totalClassified = stats.internal_transfers + stats.intercompany_dsd +
            stats.name_extraction + stats.gateway_dominant_fac + stats.catch_all_105;

        console.log(`[pnl-classify] COMPLETE in ${duration}s — ${totalClassified} classified, ${updated} written`);

        return NextResponse.json({
            success: true,
            dryRun,
            duration: `${duration}s`,
            summary: {
                totalUnclassified: bankRows.length,
                totalClassified,
                updated: dryRun ? 0 : updated,
                coverage: bankRows.length > 0 ? `${Math.round((totalClassified / bankRows.length) * 100)}%` : "100%",
                byPhase: stats,
                gatewayDominantFac,
                errors: errors.slice(0, 10),
            },
        });
    } catch (error: any) {
        console.error("[PNL Classify API] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
