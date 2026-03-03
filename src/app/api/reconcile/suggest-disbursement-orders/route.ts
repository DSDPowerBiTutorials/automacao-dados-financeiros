/**
 * API Endpoint: Suggest Orders for Bank Reconciliation via Disbursement Chain
 *
 * POST /api/reconcile/suggest-disbursement-orders
 *
 * Given a bank transaction's date, detected gateway, amount and currency,
 * resolves: Bank Date → Disbursement/Payout → Gateway Transactions → Web Orders (ar_invoices)
 *
 * Returns disbursement groups with resolved orders for the Suggestions tab.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ─── Types ───

interface GatewayTxInfo {
    transactionId: string;
    orderId: string | null;
    orderRef7: string | null; // normalized 7-char reference
    customerName: string | null;
    customerEmail: string | null;
    amount: number;
    currency: string | null;
    cardType: string | null;
    paymentMethod: string | null;
    date: string;
}

interface ResolvedOrder {
    arInvoiceId: number;
    orderId: string | null;
    invoiceNumber: string | null;
    clientName: string | null;
    email: string | null;
    companyName: string | null;
    amount: number;
    chargedAmount: number | null;
    currency: string | null;
    products: string | null;
    reconciled: boolean;
    reconciledWith: string | null;
    reconciliationType: string | null;
    financialAccountCode: string | null;
    orderDate: string | null;
    paymentMethod: string | null;
}

interface DisbursementSuggestion {
    id: string;
    disbursementDate: string;
    disbursementId: string | null;
    gatewaySource: string;
    gatewayLabel: string;
    totalAmount: number;
    transactionCount: number;
    matchScore: number;
    gatewayTransactions: GatewayTxInfo[];
    resolvedOrders: ResolvedOrder[];
    unresolvedTxCount: number;
}

// ─── Helpers ───

/** Normalize a Braintree order_id to 7-char reference */
function normalizeOrderRef(oid: string): string {
    const base = oid.includes("-") ? oid.split("-")[0] : oid;
    return base.substring(0, 7);
}

/** Extract gateway tx info from a csv_row */
function mapTxInfo(row: any): GatewayTxInfo {
    const cd = row.custom_data || {};
    const rawOrderId = cd.order_id || cd.metadata?.order_id || null;
    return {
        transactionId: cd.transaction_id || cd.payment_intent || cd.gocardless_id || cd.payment_id || row.id,
        orderId: rawOrderId,
        orderRef7: rawOrderId ? normalizeOrderRef(rawOrderId) : null,
        customerName: row.customer_name || cd.customer_name || cd.customer_company || cd.billing_name || null,
        customerEmail: row.customer_email || cd.customer_email || null,
        amount: Math.abs(parseFloat(row.amount) || 0),
        currency: cd.settlement_currency || cd.currency || null,
        cardType: cd.card_type || null,
        paymentMethod: cd.payment_method || cd.payment_method_type || cd.card_type || null,
        date: row.date?.split("T")[0] || "",
    };
}

/** Lookup ar_invoices by order_ids (7-char refs) */
async function lookupArInvoicesByOrderIds(orderRefs: string[], currency?: string): Promise<ResolvedOrder[]> {
    const unique = [...new Set(orderRefs.filter(Boolean))].slice(0, 200);
    if (unique.length === 0) return [];
    const results: ResolvedOrder[] = [];

    for (let i = 0; i < unique.length; i += 30) {
        const batch = unique.slice(i, i + 30);
        let qb = supabaseAdmin
            .from("ar_invoices")
            .select("id, order_id, invoice_number, client_name, email, company_name, total_amount, charged_amount, currency, products, reconciled, reconciled_with, reconciliation_type, financial_account_code, order_date, payment_method")
            .in("order_id", batch)
            .limit(100);
        if (currency) qb = qb.eq("currency", currency);

        const { data } = await qb;
        if (data) {
            for (const inv of data) {
                results.push({
                    arInvoiceId: inv.id,
                    orderId: inv.order_id,
                    invoiceNumber: inv.invoice_number,
                    clientName: inv.client_name,
                    email: inv.email,
                    companyName: inv.company_name,
                    amount: parseFloat(inv.total_amount) || 0,
                    chargedAmount: inv.charged_amount ? parseFloat(inv.charged_amount) : null,
                    currency: inv.currency,
                    products: inv.products,
                    reconciled: !!inv.reconciled,
                    reconciledWith: inv.reconciled_with,
                    reconciliationType: inv.reconciliation_type,
                    financialAccountCode: inv.financial_account_code,
                    orderDate: inv.order_date,
                    paymentMethod: inv.payment_method,
                });
            }
        }
    }
    return results;
}

/** Lookup order refs via order_transaction_links by BT transaction IDs */
async function lookupOrderRefsByTxIds(txIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(txIds.filter(Boolean))].slice(0, 200);
    const result = new Map<string, string>(); // txId → orderRef
    for (let i = 0; i < unique.length; i += 30) {
        const batch = unique.slice(i, i + 30);
        const { data } = await supabaseAdmin
            .from("order_transaction_links")
            .select("transaction_id, order_id")
            .eq("provider", "braintree")
            .in("transaction_id", batch)
            .limit(100);
        if (data) {
            for (const link of data) {
                result.set(link.transaction_id, link.order_id);
            }
        }
    }
    return result;
}

/** Lookup ar_invoices by customer email */
async function lookupArInvoicesByEmail(emails: string[], currency?: string): Promise<ResolvedOrder[]> {
    const unique = [...new Set(emails.filter(Boolean).map(e => e.toLowerCase()))].slice(0, 50);
    if (unique.length === 0) return [];
    const results: ResolvedOrder[] = [];

    for (let i = 0; i < unique.length; i += 20) {
        const batch = unique.slice(i, i + 20);
        let qb = supabaseAdmin
            .from("ar_invoices")
            .select("id, order_id, invoice_number, client_name, email, company_name, total_amount, charged_amount, currency, products, reconciled, reconciled_with, reconciliation_type, financial_account_code, order_date, payment_method")
            .in("email", batch)
            .limit(100);
        if (currency) qb = qb.eq("currency", currency);

        const { data } = await qb;
        if (data) {
            for (const inv of data) {
                if (!results.some(r => r.arInvoiceId === inv.id)) {
                    results.push({
                        arInvoiceId: inv.id,
                        orderId: inv.order_id,
                        invoiceNumber: inv.invoice_number,
                        clientName: inv.client_name,
                        email: inv.email,
                        companyName: inv.company_name,
                        amount: parseFloat(inv.total_amount) || 0,
                        chargedAmount: inv.charged_amount ? parseFloat(inv.charged_amount) : null,
                        currency: inv.currency,
                        products: inv.products,
                        reconciled: !!inv.reconciled,
                        reconciledWith: inv.reconciled_with,
                        reconciliationType: inv.reconciliation_type,
                        financialAccountCode: inv.financial_account_code,
                        orderDate: inv.order_date,
                        paymentMethod: inv.payment_method,
                    });
                }
            }
        }
    }
    return results;
}

// ─── Main handler ───

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { bankDate, gateway, amount, currency, bankSource } = body as {
            bankDate: string;     // ISO date (YYYY-MM-DD)
            gateway: string;      // detected gateway: "braintree-eur", "stripe", "gocardless", etc.
            amount: number;       // absolute bank inflow amount
            currency: string;     // EUR / USD
            bankSource: string;   // csv_rows.source e.g. "bankinter-eur"
        };

        if (!bankDate || !amount) {
            return NextResponse.json({ success: false, error: "bankDate and amount are required" }, { status: 400 });
        }

        const suggestions: DisbursementSuggestion[] = [];
        const gwNorm = (gateway || "").toLowerCase();

        // ═══════════════════════════════════════════════════════
        // BRAINTREE: group by disbursement_date within ±3 days
        // ═══════════════════════════════════════════════════════
        if (gwNorm.includes("braintree") || gwNorm.includes("paypal")) {
            const startDate = new Date(new Date(bankDate).getTime() - 3 * 86400000).toISOString().split("T")[0];
            const endDate = new Date(new Date(bankDate).getTime() + 3 * 86400000).toISOString().split("T")[0];

            // Determine BT sources based on gateway variant
            let btSources: string[];
            if (gwNorm.includes("amex") || gwNorm.includes("american")) {
                btSources = ["braintree-api-revenue-amex", "braintree-api-revenue"];
            } else if (gwNorm.includes("usd")) {
                btSources = ["braintree-api-revenue-usd"];
            } else if (gwNorm.includes("gbp")) {
                btSources = ["braintree-api-revenue-gbp"];
            } else {
                // Default EUR + PayPal (settled through Braintree)
                btSources = currency === "USD"
                    ? ["braintree-api-revenue-usd"]
                    : ["braintree-api-revenue", "braintree-api-revenue-gbp"];
            }

            // Fetch all BT transactions with disbursement_date in range
            const allBtRows: any[] = [];
            for (const src of btSources) {
                const { data } = await supabaseAdmin
                    .from("csv_rows")
                    .select("*")
                    .eq("source", src)
                    .gte("custom_data->>disbursement_date", startDate)
                    .lte("custom_data->>disbursement_date", endDate)
                    .limit(500);
                if (data) allBtRows.push(...data);
            }

            // Group by disbursement_date + source
            const groups = new Map<string, { rows: any[]; total: number; source: string; disbDate: string }>();
            for (const row of allBtRows) {
                const cd = row.custom_data || {};
                const disbDate = cd.disbursement_date || "";
                const key = `${row.source}|${disbDate}`;
                if (!groups.has(key)) groups.set(key, { rows: [], total: 0, source: row.source, disbDate });
                const g = groups.get(key)!;
                g.rows.push(row);
                g.total += Math.abs(parseFloat(row.amount) || 0);
            }

            // For each group, resolve orders
            for (const [key, group] of groups) {
                const txInfos = group.rows.map(mapTxInfo);

                // Collect order references from gateway data
                const orderRefsFromGw = new Set<string>();
                const txIdsForLookup: string[] = [];
                for (const tx of txInfos) {
                    if (tx.orderRef7) orderRefsFromGw.add(tx.orderRef7);
                    txIdsForLookup.push(tx.transactionId);
                }

                // Also resolve via order_transaction_links
                const linkedRefs = await lookupOrderRefsByTxIds(txIdsForLookup);
                for (const ref of linkedRefs.values()) {
                    orderRefsFromGw.add(ref.substring(0, 7));
                }

                // Enrich txInfos with resolved refs
                for (const tx of txInfos) {
                    if (!tx.orderRef7 && linkedRefs.has(tx.transactionId)) {
                        tx.orderRef7 = linkedRefs.get(tx.transactionId)!.substring(0, 7);
                        tx.orderId = tx.orderRef7;
                    }
                }

                // Lookup ar_invoices
                const resolvedOrders = await lookupArInvoicesByOrderIds([...orderRefsFromGw], currency);

                // Fallback: if few orders found, try email matching
                if (resolvedOrders.length < txInfos.length * 0.5) {
                    const emails = txInfos.map(t => t.customerEmail).filter(Boolean) as string[];
                    if (emails.length > 0) {
                        const emailOrders = await lookupArInvoicesByEmail(emails, currency);
                        for (const eo of emailOrders) {
                            if (!resolvedOrders.some(r => r.arInvoiceId === eo.arInvoiceId)) {
                                resolvedOrders.push(eo);
                            }
                        }
                    }
                }

                const diff = Math.abs(group.total - amount);
                const score = diff < 0.10 ? 98 : diff < amount * 0.02 ? 90 : diff < amount * 0.05 ? 80 : 50;

                const srcLabel = group.source.includes("amex") ? "Braintree Amex"
                    : group.source.includes("gbp") ? "Braintree GBP"
                        : group.source.includes("usd") ? "Braintree USD" : "Braintree EUR";

                suggestions.push({
                    id: `bt-disb-${key}`,
                    disbursementDate: group.disbDate,
                    disbursementId: group.rows[0]?.custom_data?.settlement_batch_id || null,
                    gatewaySource: group.source,
                    gatewayLabel: srcLabel,
                    totalAmount: group.total,
                    transactionCount: txInfos.length,
                    matchScore: score,
                    gatewayTransactions: txInfos,
                    resolvedOrders,
                    unresolvedTxCount: txInfos.filter(t => !t.orderRef7).length,
                });
            }
        }

        // ═══════════════════════════════════════════════════════
        // STRIPE: find payout by arrival_date, then resolve charges
        // ═══════════════════════════════════════════════════════
        if (gwNorm.includes("stripe")) {
            const startDate = new Date(new Date(bankDate).getTime() - 3 * 86400000).toISOString().split("T")[0];
            const endDate = new Date(new Date(bankDate).getTime() + 3 * 86400000).toISOString().split("T")[0];

            const payoutSource = currency === "USD" ? "stripe-usd-payouts" : "stripe-eur-payouts";
            const chargeSource = currency === "USD" ? "stripe-usd" : "stripe-eur";

            // Find payouts in date range
            const { data: payouts } = await supabaseAdmin
                .from("csv_rows")
                .select("*")
                .eq("source", payoutSource)
                .gte("date", startDate)
                .lte("date", endDate)
                .limit(10);

            if (payouts && payouts.length > 0) {
                for (const payout of payouts) {
                    const payoutCd = payout.custom_data || {};
                    const payoutId = payoutCd.payout_id || payoutCd.transaction_id || "";
                    const payoutAmount = Math.abs(parseFloat(payout.amount) || 0);
                    const arrivalDate = payoutCd.arrival_date?.split("T")[0] || payout.date?.split("T")[0] || bankDate;

                    // Find charges for this payout — by date window (7 days before arrival)
                    const chargeStart = new Date(new Date(arrivalDate).getTime() - 7 * 86400000).toISOString().split("T")[0];
                    const { data: charges } = await supabaseAdmin
                        .from("csv_rows")
                        .select("*")
                        .eq("source", chargeSource)
                        .eq("reconciled", false)
                        .gte("date", chargeStart)
                        .lte("date", arrivalDate)
                        .gt("amount", 0)
                        .limit(100);

                    const txInfos = (charges || []).map(mapTxInfo);

                    // Resolve orders — Stripe doesn't reliably have order_id, use email matching
                    const resolvedOrders: ResolvedOrder[] = [];
                    const emails = txInfos.map(t => t.customerEmail).filter(Boolean) as string[];
                    if (emails.length > 0) {
                        const emailOrders = await lookupArInvoicesByEmail(emails, currency);
                        resolvedOrders.push(...emailOrders);
                    }

                    // Also try any order_ids present
                    const orderRefs = txInfos.map(t => t.orderRef7).filter(Boolean) as string[];
                    if (orderRefs.length > 0) {
                        const oidOrders = await lookupArInvoicesByOrderIds(orderRefs, currency);
                        for (const o of oidOrders) {
                            if (!resolvedOrders.some(r => r.arInvoiceId === o.arInvoiceId)) {
                                resolvedOrders.push(o);
                            }
                        }
                    }

                    const diff = Math.abs(payoutAmount - amount);
                    const score = diff < 0.10 ? 98 : diff < amount * 0.02 ? 90 : diff < amount * 0.05 ? 80 : 50;

                    suggestions.push({
                        id: `stripe-payout-${payoutId || payout.id}`,
                        disbursementDate: arrivalDate,
                        disbursementId: payoutId,
                        gatewaySource: payoutSource,
                        gatewayLabel: currency === "USD" ? "Stripe USD" : "Stripe EUR",
                        totalAmount: payoutAmount,
                        transactionCount: txInfos.length,
                        matchScore: score,
                        gatewayTransactions: txInfos,
                        resolvedOrders,
                        unresolvedTxCount: txInfos.filter(t => !t.orderRef7 && !t.customerEmail).length,
                    });
                }
            }
        }

        // ═══════════════════════════════════════════════════════
        // GOCARDLESS: find payout by date, then resolve payments
        // ═══════════════════════════════════════════════════════
        if (gwNorm.includes("gocardless") || gwNorm.includes("go cardless")) {
            const startDate = new Date(new Date(bankDate).getTime() - 3 * 86400000).toISOString().split("T")[0];
            const endDate = new Date(new Date(bankDate).getTime() + 3 * 86400000).toISOString().split("T")[0];

            // Find GC payouts in date range
            const { data: payouts } = await supabaseAdmin
                .from("csv_rows")
                .select("*")
                .eq("source", "gocardless")
                .eq("custom_data->>type", "payout")
                .gte("date", startDate)
                .lte("date", endDate)
                .limit(10);

            if (payouts && payouts.length > 0) {
                for (const payout of payouts) {
                    const payoutCd = payout.custom_data || {};
                    const payoutId = payoutCd.payout_id || payoutCd.gocardless_id || "";
                    const payoutAmount = Math.abs(parseFloat(payout.amount) || 0);

                    // Find GC payments linked by payout_id
                    let gcPayments: any[] = [];
                    if (payoutId) {
                        const { data } = await supabaseAdmin
                            .from("csv_rows")
                            .select("*")
                            .eq("source", "gocardless")
                            .neq("custom_data->>type", "payout")
                            .eq("custom_data->>payout_id", payoutId)
                            .limit(100);
                        if (data) gcPayments = data;
                    }

                    // Fallback: date range
                    if (gcPayments.length === 0) {
                        const gcStart = new Date(new Date(payout.date || bankDate).getTime() - 7 * 86400000).toISOString().split("T")[0];
                        const { data } = await supabaseAdmin
                            .from("csv_rows")
                            .select("*")
                            .eq("source", "gocardless")
                            .neq("custom_data->>type", "payout")
                            .gte("date", gcStart)
                            .lte("date", payout.date || bankDate)
                            .limit(100);
                        if (data) gcPayments = data;
                    }

                    const txInfos = gcPayments.map(mapTxInfo);

                    // Resolve orders by email (GoCardless has no order_id)
                    const resolvedOrders: ResolvedOrder[] = [];
                    const emails = txInfos.map(t => t.customerEmail).filter(Boolean) as string[];
                    if (emails.length > 0) {
                        const emailOrders = await lookupArInvoicesByEmail(emails, currency);
                        resolvedOrders.push(...emailOrders);
                    }

                    const diff = Math.abs(payoutAmount - amount);
                    const score = diff < 0.10 ? 98 : diff < amount * 0.02 ? 90 : diff < amount * 0.05 ? 80 : 50;

                    suggestions.push({
                        id: `gc-payout-${payoutId || payout.id}`,
                        disbursementDate: payout.date?.split("T")[0] || bankDate,
                        disbursementId: payoutId,
                        gatewaySource: "gocardless",
                        gatewayLabel: "GoCardless",
                        totalAmount: payoutAmount,
                        transactionCount: txInfos.length,
                        matchScore: score,
                        gatewayTransactions: txInfos,
                        resolvedOrders,
                        unresolvedTxCount: txInfos.filter(t => !t.customerEmail).length,
                    });
                }
            }
        }

        // Sort by matchScore descending
        suggestions.sort((a, b) => b.matchScore - a.matchScore);

        return NextResponse.json({
            success: true,
            suggestions,
            meta: {
                bankDate,
                gateway: gateway || null,
                amount,
                currency,
                totalSuggestions: suggestions.length,
                totalResolvedOrders: suggestions.reduce((s, sg) => s + sg.resolvedOrders.length, 0),
            },
        });
    } catch (err: any) {
        console.error("[suggest-disbursement-orders] Error:", err);
        return NextResponse.json({ success: false, error: err.message || "Internal error" }, { status: 500 });
    }
}
