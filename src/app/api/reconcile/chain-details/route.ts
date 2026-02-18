/**
 * API Endpoint: Detalhes da Cadeia de Reconciliação (V2 — Order-enriched)
 *
 * GET /api/reconcile/chain-details?bankRowId=UUID
 *
 * Dado um registro bancário, retorna TODA a cadeia:
 * - Disbursement/payout associado
 * - Transações gateway (Braintree/Stripe/GoCardless) com customer_name, email, order_id, product
 * - Invoices (ar_invoices) associadas com client_name, product, valor
 * - Orders (csv_rows source=invoice-orders) com dados ricos: FAC, order_type, products, billing_entity
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface GatewayTransaction {
    transaction_id: string;
    amount: number;
    date: string;
    customer_name: string | null;
    customer_email: string | null;
    order_id: string | null;
    product_name: string | null;
    payment_method: string | null;
    source?: string;
    matched_invoice_number?: string | null;
    // Enriched fields (new)
    subscription_id?: string | null;
    card_type?: string | null;
    country_of_issuance?: string | null;
    merchant_account_id?: string | null;
    settlement_amount?: number | null;
    settlement_currency?: string | null;
    amount_refunded?: number | null;
    company_name?: string | null;
    billing_name?: string | null;
    billing_country?: string | null;
    gc_subscription_id?: string | null;
    mandate_id?: string | null;
    descriptor_name?: string | null;
    refunded_transaction_id?: string | null;
    matched_invoice_fac?: string | null;
    matched_invoice_fac_name?: string | null;
}

interface LinkedInvoice {
    id: number;
    invoice_number: string;
    order_id: string;
    client_name: string;
    company_name: string | null;
    total_amount: number;
    currency: string;
    product: string | null;
    invoice_date: string | null;
}

interface LinkedOrder {
    invoice_number: string;
    order_number: string | null;
    customer_name: string | null;
    email: string | null;
    products: string | null;
    amount: number;
    currency: string;
    financial_account_code: string | null;
    financial_account_name: string | null;
    order_type: string | null;
    payment_method: string | null;
    billing_entity: string | null;
    country: string | null;
    date: string | null;
}

interface DisbursementInfo {
    id: string;
    date: string;
    amount: number;
    transaction_count: number;
}

interface WebOrderInfo {
    order_reference: string;
    craft_id: string;
    customer_email: string | null;
    customer_name: string | null;
    currency: string;
    total_price: number;
    total_paid: number;
    paid_status: string | null;
    date_ordered: string | null;
    order_type: string | null;
    products: { sku: string; description: string; qty: number; price: number; subtotal: number }[];
    braintree_tx_ids: string[];
    billing_country: string | null;
    billing_organization: string | null;
    subscription_reference: string | null;
}

// ─── Helpers ───

/** Parse a gateway row into a GatewayTransaction */
function mapGatewayRow(row: any, srcHint?: string): GatewayTransaction {
    const cd = row.custom_data || {};
    return {
        transaction_id: cd.transaction_id || cd.payment_intent || cd.gocardless_id || cd.payment_id || row.id,
        amount: parseFloat(row.amount) || 0,
        date: row.date || "",
        customer_name: row.customer_name || cd.customer_name || cd.customer_company || cd.billing_name || null,
        customer_email: row.customer_email || cd.customer_email || null,
        order_id: cd.order_id || cd.metadata?.order_id || null,
        product_name: cd.plan_id || cd.subscription_id || cd.product || cd.product_description || cd.description || cd.stripe_description || null,
        payment_method: cd.payment_method || cd.payment_method_type || cd.card_type || (srcHint === "gocardless" ? "direct_debit" : null),
        source: srcHint || row.source || null,
        matched_invoice_number: cd.matched_invoice_number || null,
        // Enriched fields
        subscription_id: cd.subscription_id || cd.gc_subscription_id || null,
        card_type: cd.card_type || null,
        country_of_issuance: cd.country_of_issuance || cd.billing_country || null,
        merchant_account_id: cd.merchant_account_id || null,
        settlement_amount: cd.settlement_amount ? parseFloat(cd.settlement_amount) : null,
        settlement_currency: cd.settlement_currency || null,
        amount_refunded: cd.amount_refunded ? parseFloat(cd.amount_refunded) : null,
        company_name: cd.customer_company || cd.company_name || null,
        billing_name: cd.billing_name || null,
        billing_country: cd.billing_country || cd.country_of_issuance || null,
        gc_subscription_id: cd.gc_subscription_id || null,
        mandate_id: cd.mandate_id || null,
        descriptor_name: cd.descriptor_name || null,
        refunded_transaction_id: cd.refunded_transaction_id || null,
        matched_invoice_fac: cd.matched_invoice_fac || null,
        matched_invoice_fac_name: cd.matched_invoice_fac_name || null,
    };
}

/** Deduplicate gateway transactions by transaction_id */
function dedupeGateway(txs: GatewayTransaction[]): GatewayTransaction[] {
    const seen = new Set<string>();
    return txs.filter(t => {
        if (seen.has(t.transaction_id)) return false;
        seen.add(t.transaction_id);
        return true;
    });
}

/** Lookup web_orders by order references */
async function lookupWebOrders(orderRefs: string[]): Promise<WebOrderInfo[]> {
    const results: WebOrderInfo[] = [];
    const unique = [...new Set(orderRefs.filter(Boolean))].slice(0, 100);
    for (let i = 0; i < unique.length; i += 30) {
        const batch = unique.slice(i, i + 30);
        const { data } = await supabaseAdmin
            .from("web_orders")
            .select("*")
            .in("order_reference", batch)
            .limit(50);
        if (data) {
            for (const wo of data) {
                results.push({
                    order_reference: wo.order_reference,
                    craft_id: wo.craft_id,
                    customer_email: wo.customer_email,
                    customer_name: wo.customer_full_name || `${wo.customer_first_name || ""} ${wo.customer_last_name || ""}`.trim() || null,
                    currency: wo.currency,
                    total_price: parseFloat(wo.total_price) || 0,
                    total_paid: parseFloat(wo.total_paid) || 0,
                    paid_status: wo.paid_status,
                    date_ordered: wo.date_ordered || null,
                    order_type: wo.order_type,
                    products: Array.isArray(wo.products) ? wo.products : [],
                    braintree_tx_ids: wo.braintree_tx_ids || [],
                    billing_country: wo.billing_country,
                    billing_organization: wo.billing_organization,
                    subscription_reference: wo.subscription_reference,
                });
            }
        }
    }
    return results;
}

/** Lookup order_transaction_links by transaction IDs → returns order_ids */
async function lookupOrdersByTxIds(txIds: string[]): Promise<string[]> {
    const unique = [...new Set(txIds.filter(Boolean))].slice(0, 200);
    const orderIds: string[] = [];
    for (let i = 0; i < unique.length; i += 30) {
        const batch = unique.slice(i, i + 30);
        const { data } = await supabaseAdmin
            .from("order_transaction_links")
            .select("order_id")
            .eq("provider", "braintree")
            .in("transaction_id", batch)
            .limit(50);
        if (data) {
            for (const link of data) {
                if (link.order_id && !orderIds.includes(link.order_id)) {
                    orderIds.push(link.order_id);
                }
            }
        }
    }
    return orderIds;
}

/** Batch query gateway rows by transaction IDs using .in() */
async function queryGatewayByTxIds(
    txIds: string[],
    sources: string[],
    idField: string = "transaction_id"
): Promise<any[]> {
    const results: any[] = [];
    const uniqueIds = [...new Set(txIds)].slice(0, 200);

    for (let i = 0; i < uniqueIds.length; i += 30) {
        const batch = uniqueIds.slice(i, i + 30);
        for (const src of sources) {
            const { data } = await supabaseAdmin
                .from("csv_rows")
                .select("*")
                .eq("source", src)
                .in(`custom_data->>${idField}`, batch)
                .limit(50);
            if (data) results.push(...data);
        }
    }
    return results;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const bankRowId = searchParams.get("bankRowId");

    if (!bankRowId) {
        return NextResponse.json({ success: false, error: "bankRowId is required" }, { status: 400 });
    }

    try {
        // 1. Buscar o registro bancário
        const { data: bankRow, error: bankError } = await supabaseAdmin
            .from("csv_rows")
            .select("*")
            .eq("id", bankRowId)
            .single();

        if (bankError || !bankRow) {
            return NextResponse.json({ success: false, error: "Bank row not found" }, { status: 404 });
        }

        const cd = bankRow.custom_data || {};
        let gatewayTransactions: GatewayTransaction[] = [];
        const linkedInvoices: LinkedInvoice[] = [];
        const linkedOrders: LinkedOrder[] = [];
        let disbursementInfo: DisbursementInfo | null = null;

        const paymentSource = (cd.paymentSource || "").toLowerCase();
        const matchedWith = bankRow.matched_with || "";
        const bankCurrency = (bankRow.source || "").includes("usd") ? "USD" : "EUR";

        // ═══════════════════════════════════════════════
        // STRATEGY 1: Via transaction_ids (BT/Stripe/PayPal)
        // Queries BOTH braintree-api-revenue AND braintree-amex + stripe sources
        // Uses batched .in() instead of N+1 individual queries
        // ═══════════════════════════════════════════════
        if (cd.transaction_ids && Array.isArray(cd.transaction_ids) && cd.transaction_ids.length > 0) {
            const txIds = cd.transaction_ids.slice(0, 200);

            // Determine which sources to query based on paymentSource
            let sources: string[];
            if (paymentSource.includes("stripe")) {
                sources = ["stripe-eur", "stripe-usd"];
            } else if (paymentSource.includes("amex")) {
                sources = ["braintree-amex", "braintree-api-revenue"];
            } else {
                sources = ["braintree-api-revenue", "braintree-amex", "stripe-eur", "stripe-usd"];
            }

            const rows = await queryGatewayByTxIds(txIds, sources, "transaction_id");
            for (const r of rows) {
                gatewayTransactions.push(mapGatewayRow(r, r.source));
            }

            // Also try payment_intent for Stripe
            if (gatewayTransactions.length < txIds.length && (paymentSource.includes("stripe") || sources.some(s => s.startsWith("stripe")))) {
                const missing = txIds.filter((id: string) => !gatewayTransactions.some(g => g.transaction_id === id));
                if (missing.length > 0) {
                    const piRows = await queryGatewayByTxIds(missing, ["stripe-eur", "stripe-usd"], "payment_intent");
                    for (const r of piRows) {
                        gatewayTransactions.push(mapGatewayRow(r, r.source));
                    }
                }
            }

            disbursementInfo = {
                id: cd.disbursement_reference || cd.settlement_batch_id || "",
                date: cd.disbursement_date || "",
                amount: cd.disbursement_amount || 0,
                transaction_count: txIds.length,
            };
        }

        // ═══════════════════════════════════════════════
        // STRATEGY 1b: Via gc_transaction_ids (GoCardless)
        // V3/V4 writes gc_transaction_ids[] with gocardless_id/payment_id values
        // ═══════════════════════════════════════════════
        if (cd.gc_transaction_ids && Array.isArray(cd.gc_transaction_ids) && cd.gc_transaction_ids.length > 0) {
            const gcIds = cd.gc_transaction_ids.slice(0, 200);

            const gcRows1 = await queryGatewayByTxIds(gcIds, ["gocardless"], "gocardless_id");
            for (const r of gcRows1) {
                gatewayTransactions.push(mapGatewayRow(r, "gocardless"));
            }

            const foundIds = new Set(gcRows1.map((r: any) => r.custom_data?.gocardless_id || r.custom_data?.payment_id));
            const missingGc = gcIds.filter((id: string) => !foundIds.has(id));
            if (missingGc.length > 0) {
                const gcRows2 = await queryGatewayByTxIds(missingGc, ["gocardless"], "payment_id");
                for (const r of gcRows2) {
                    gatewayTransactions.push(mapGatewayRow(r, "gocardless"));
                }
            }

            if (!disbursementInfo) {
                disbursementInfo = {
                    id: cd.disbursement_reference || "",
                    date: cd.disbursement_date || "",
                    amount: cd.disbursement_amount || parseFloat(bankRow.amount) || 0,
                    transaction_count: gcIds.length,
                };
            }
        }

        // ═══════════════════════════════════════════════
        // STRATEGY 2: Via settlement_batch_id (Braintree settlement batches)
        // Queries both braintree-api-revenue and braintree-amex
        // ═══════════════════════════════════════════════
        if (gatewayTransactions.length === 0 && cd.settlement_batch_id) {
            for (const src of ["braintree-api-revenue", "braintree-amex"]) {
                const { data: batchRows } = await supabaseAdmin
                    .from("csv_rows")
                    .select("*")
                    .eq("source", src)
                    .eq("custom_data->>settlement_batch_id", cd.settlement_batch_id)
                    .limit(100);

                if (batchRows) {
                    for (const bt of batchRows) {
                        gatewayTransactions.push(mapGatewayRow(bt, src));
                    }
                }
            }

            if (gatewayTransactions.length > 0) {
                disbursementInfo = {
                    id: cd.settlement_batch_id,
                    date: cd.disbursement_date || gatewayTransactions[0]?.date || "",
                    amount: cd.disbursement_amount || gatewayTransactions.reduce((s, t) => s + t.amount, 0),
                    transaction_count: gatewayTransactions.length,
                };
            }
        }

        // ═══════════════════════════════════════════════
        // STRATEGY 3: Via disbursement_reference (extract date for BT)
        // ═══════════════════════════════════════════════
        if (gatewayTransactions.length === 0 && cd.disbursement_reference) {
            const ref = cd.disbursement_reference;
            const dateMatch = ref.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
                const disbDate = dateMatch[1];
                for (const src of ["braintree-api-revenue", "braintree-amex"]) {
                    const { data: btRows } = await supabaseAdmin
                        .from("csv_rows")
                        .select("*")
                        .eq("source", src)
                        .eq("custom_data->>disbursement_date", disbDate)
                        .limit(100);

                    if (btRows) {
                        for (const bt of btRows) {
                            gatewayTransactions.push(mapGatewayRow(bt, src));
                        }
                    }
                }

                if (gatewayTransactions.length > 0) {
                    disbursementInfo = {
                        id: ref,
                        date: disbDate,
                        amount: cd.disbursement_amount || gatewayTransactions.reduce((s, t) => s + t.amount, 0),
                        transaction_count: gatewayTransactions.length,
                    };
                }
            }
        }

        // ═══════════════════════════════════════════════
        // STRATEGY 4: Stripe payouts — match via payout reference
        // Now queries BOTH stripe-eur AND stripe-usd based on bank currency
        // ═══════════════════════════════════════════════
        if (gatewayTransactions.length === 0 && (paymentSource === "stripe" || matchedWith.startsWith("stripe:"))) {
            const stripeRef = cd.disbursement_reference || matchedWith.replace("stripe:", "");
            if (stripeRef) {
                const { data: payoutRows } = await supabaseAdmin
                    .from("csv_rows")
                    .select("*")
                    .or("source.eq.stripe-eur-payouts,source.eq.stripe-usd-payouts")
                    .or(`custom_data->>transaction_id.eq.${stripeRef},custom_data->>payout_id.eq.${stripeRef}`)
                    .limit(1);

                if (payoutRows && payoutRows.length > 0) {
                    const payout = payoutRows[0];
                    const payoutCd = payout.custom_data || {};
                    disbursementInfo = {
                        id: stripeRef,
                        date: payout.date || "",
                        amount: parseFloat(payout.amount) || 0,
                        transaction_count: 1,
                    };

                    // Find Stripe charges — query BOTH EUR and USD
                    const arrivalDate = payoutCd.arrival_date?.split("T")[0] || payout.date;
                    const stripeSources = bankCurrency === "USD" ? ["stripe-usd", "stripe-eur"] : ["stripe-eur", "stripe-usd"];
                    for (const src of stripeSources) {
                        const { data: stripeCharges } = await supabaseAdmin
                            .from("csv_rows")
                            .select("*")
                            .eq("source", src)
                            .gte("date", new Date(new Date(arrivalDate).getTime() - 7 * 86400000).toISOString().split("T")[0])
                            .lte("date", arrivalDate)
                            .limit(50);

                        if (stripeCharges) {
                            for (const sc of stripeCharges) {
                                gatewayTransactions.push(mapGatewayRow(sc, src));
                            }
                        }
                        if (gatewayTransactions.length > 0) break;
                    }
                }
            }
        }

        // ═══════════════════════════════════════════════
        // STRATEGY 5: GoCardless payouts — filtered by payout_id or date range
        // Fixed: no longer fetches ALL GC payments globally
        // ═══════════════════════════════════════════════
        if (gatewayTransactions.length === 0 && (paymentSource === "gocardless" || matchedWith.startsWith("gocardless:"))) {
            const gcRef = cd.disbursement_reference || matchedWith.replace("gocardless:", "");
            if (gcRef) {
                const { data: gcPayouts } = await supabaseAdmin
                    .from("csv_rows")
                    .select("*")
                    .eq("source", "gocardless")
                    .eq("custom_data->>type", "payout")
                    .or(`custom_data->>payout_id.eq.${gcRef},custom_data->>gocardless_id.eq.${gcRef}`)
                    .limit(1);

                let payoutId: string | null = null;
                let payoutDate: string | null = null;

                if (gcPayouts && gcPayouts.length > 0) {
                    const payout = gcPayouts[0];
                    payoutId = payout.custom_data?.payout_id || payout.custom_data?.gocardless_id || null;
                    payoutDate = payout.date || null;
                    disbursementInfo = {
                        id: gcRef,
                        date: payout.date || "",
                        amount: parseFloat(payout.amount) || 0,
                        transaction_count: 1,
                    };
                }

                // Find GC payments linked by payout_id
                if (payoutId) {
                    const { data: gcPayments } = await supabaseAdmin
                        .from("csv_rows")
                        .select("*")
                        .eq("source", "gocardless")
                        .neq("custom_data->>type", "payout")
                        .eq("custom_data->>payout_id", payoutId)
                        .limit(100);

                    if (gcPayments && gcPayments.length > 0) {
                        for (const gc of gcPayments) {
                            gatewayTransactions.push(mapGatewayRow(gc, "gocardless"));
                        }
                    }
                }

                // Fallback: filter by date range around payout date
                if (gatewayTransactions.length === 0 && payoutDate) {
                    const start = new Date(new Date(payoutDate).getTime() - 7 * 86400000).toISOString().split("T")[0];
                    const end = payoutDate;
                    const { data: gcDatePayments } = await supabaseAdmin
                        .from("csv_rows")
                        .select("*")
                        .eq("source", "gocardless")
                        .neq("custom_data->>type", "payout")
                        .gte("date", start)
                        .lte("date", end)
                        .limit(100);

                    if (gcDatePayments) {
                        for (const gc of gcDatePayments) {
                            gatewayTransactions.push(mapGatewayRow(gc, "gocardless"));
                        }
                    }
                }
            }
        }

        // ═══════════════════════════════════════════════
        // STRATEGY 6: General fallback — match by amount + date range
        // Now includes braintree-amex and stripe-usd, with currency filter
        // ═══════════════════════════════════════════════
        if (gatewayTransactions.length === 0 && parseFloat(bankRow.amount) > 0) {
            const bankAmount = parseFloat(bankRow.amount);
            const bankDate = bankRow.date?.split("T")[0];
            if (bankDate) {
                const startDate = new Date(new Date(bankDate).getTime() - 5 * 86400000).toISOString().split("T")[0];
                const endDate = new Date(new Date(bankDate).getTime() + 2 * 86400000).toISOString().split("T")[0];

                const allSources = bankCurrency === "USD"
                    ? ["stripe-usd", "braintree-api-revenue", "braintree-amex", "stripe-eur", "gocardless"]
                    : ["braintree-api-revenue", "braintree-amex", "stripe-eur", "stripe-usd", "gocardless"];

                for (const src of allSources) {
                    const { data: nearbyTxs } = await supabaseAdmin
                        .from("csv_rows")
                        .select("*")
                        .eq("source", src)
                        .gte("date", startDate)
                        .lte("date", endDate)
                        .gt("amount", 0)
                        .limit(100);

                    if (nearbyTxs && nearbyTxs.length > 0) {
                        for (const tx of nearbyTxs) {
                            if (Math.abs(parseFloat(tx.amount) - bankAmount) < 1) {
                                gatewayTransactions.push(mapGatewayRow(tx, src));
                            }
                        }
                    }
                    if (gatewayTransactions.length > 0) break;
                }
            }
        }

        // Deduplicate gateway transactions
        gatewayTransactions = dedupeGateway(gatewayTransactions);

        // ═══════════════════════════════════════════════
        // FIND WEB ORDERS — via order_transaction_links + web_orders table
        // Strategy: TX IDs → order_transaction_links → order_reference → web_orders
        // Also: gateway order_ids → web_orders directly
        // ═══════════════════════════════════════════════
        const webOrders: WebOrderInfo[] = [];
        const webOrderRefs = new Set<string>();

        // 1. Collect order_ids already known from gateway transactions
        const gatewayOrderIds = gatewayTransactions
            .map(t => t.order_id)
            .filter(Boolean) as string[];

        // 2. Use order_transaction_links to find orders by BT TxIDs
        const allTxIds = gatewayTransactions.map(t => t.transaction_id).filter(Boolean);
        if (allTxIds.length > 0) {
            const linkedOrderRefs = await lookupOrdersByTxIds(allTxIds);
            for (const ref of linkedOrderRefs) {
                webOrderRefs.add(ref);
            }
        }

        // 3. Add gateway order_ids as potential web_order references
        for (const oid of gatewayOrderIds) {
            // Braintree Order ID can be "ref" (7 chars) or "ref-craftId" (15 chars)
            const ref = oid.includes("-") ? oid.split("-")[0] : oid;
            if (ref.length >= 7) webOrderRefs.add(ref.substring(0, 7));
        }

        // 4. Add order_ids from bank custom_data
        if (cd.web_orders && Array.isArray(cd.web_orders)) {
            for (const oid of cd.web_orders) {
                if (oid) {
                    const ref = typeof oid === "string" && oid.includes("-") ? oid.split("-")[0] : oid;
                    webOrderRefs.add(typeof ref === "string" ? ref.substring(0, 7) : ref);
                }
            }
        }

        // 5. Fetch web_orders data
        if (webOrderRefs.size > 0) {
            const woResults = await lookupWebOrders([...webOrderRefs]);
            for (const wo of woResults) {
                webOrders.push(wo);
            }
        }

        // ═══════════════════════════════════════════════
        // FIND LINKED INVOICES — from order_ids in gateway transactions + bank custom_data
        // ═══════════════════════════════════════════════
        const orderIds = gatewayTransactions
            .map(t => t.order_id)
            .filter(Boolean) as string[];

        // Also include web_order references as potential order_ids for ar_invoices
        for (const wo of webOrders) {
            if (wo.order_reference && !orderIds.includes(wo.order_reference)) {
                orderIds.push(wo.order_reference);
            }
        }

        if (cd.web_orders && Array.isArray(cd.web_orders)) {
            for (const oid of cd.web_orders) {
                if (oid && !orderIds.includes(oid)) orderIds.push(oid);
            }
        }
        if (cd.invoice_order_id && !orderIds.includes(cd.invoice_order_id)) {
            orderIds.push(cd.invoice_order_id);
        }

        if (orderIds.length > 0) {
            const uniqueOrderIds = [...new Set(orderIds)];
            for (let i = 0; i < uniqueOrderIds.length; i += 30) {
                const batch = uniqueOrderIds.slice(i, i + 30);
                const { data: invoices } = await supabaseAdmin
                    .from("ar_invoices")
                    .select("id, invoice_number, order_id, client_name, company_name, total_amount, currency, product, invoice_date, order_date")
                    .in("order_id", batch)
                    .limit(100);

                if (invoices) {
                    for (const inv of invoices) {
                        linkedInvoices.push({
                            id: inv.id,
                            invoice_number: inv.invoice_number || "",
                            order_id: inv.order_id || "",
                            client_name: inv.client_name || "",
                            company_name: inv.company_name || null,
                            total_amount: inv.total_amount || 0,
                            currency: inv.currency || "EUR",
                            product: inv.product || null,
                            invoice_date: inv.invoice_date || inv.order_date || null,
                        });
                    }
                }
            }
        }

        // Also try invoice lookup by matching customer_email from gateway txs
        if (linkedInvoices.length === 0) {
            const emails = gatewayTransactions
                .map(t => t.customer_email)
                .filter(Boolean) as string[];
            const uniqueEmails = [...new Set(emails)].slice(0, 10);

            if (uniqueEmails.length > 0) {
                const { data: invoicesByEmail } = await supabaseAdmin
                    .from("ar_invoices")
                    .select("id, invoice_number, order_id, client_name, company_name, total_amount, currency, product, invoice_date, order_date")
                    .in("email", uniqueEmails)
                    .limit(50);

                if (invoicesByEmail) {
                    for (const inv of invoicesByEmail) {
                        linkedInvoices.push({
                            id: inv.id,
                            invoice_number: inv.invoice_number || "",
                            order_id: inv.order_id || "",
                            client_name: inv.client_name || "",
                            company_name: inv.company_name || null,
                            total_amount: inv.total_amount || 0,
                            currency: inv.currency || "EUR",
                            product: inv.product || null,
                            invoice_date: inv.invoice_date || inv.order_date || null,
                        });
                    }
                }
            }
        }

        // ═══════════════════════════════════════════════
        // FIND LINKED ORDERS (csv_rows source=invoice-orders) — RICH DATA
        // Uses matched_invoice_number from gateway txs + bank custom_data
        // ═══════════════════════════════════════════════
        const invoiceNumbers = new Set<string>();

        // Collect invoice numbers from (a) gateway txs, (b) bank custom_data, (c) linked invoices
        for (const gt of gatewayTransactions) {
            if (gt.matched_invoice_number) invoiceNumbers.add(gt.matched_invoice_number);
        }
        if (cd.matched_invoice_number) invoiceNumbers.add(cd.matched_invoice_number);
        if (cd.matched_invoice_numbers) {
            const nums = String(cd.matched_invoice_numbers).split(",").map((s: string) => s.trim()).filter(Boolean);
            nums.forEach((n: string) => invoiceNumbers.add(n));
        }
        if (cd.invoice_number) invoiceNumbers.add(cd.invoice_number);
        for (const inv of linkedInvoices) {
            if (inv.invoice_number) invoiceNumbers.add(inv.invoice_number);
        }

        const allOrderIds = new Set<string>(orderIds);

        if (invoiceNumbers.size > 0) {
            const invNums = [...invoiceNumbers].slice(0, 100);
            for (let i = 0; i < invNums.length; i += 30) {
                const batch = invNums.slice(i, i + 30);
                const { data: ioRows } = await supabaseAdmin
                    .from("csv_rows")
                    .select("*")
                    .eq("source", "invoice-orders")
                    .in("custom_data->>invoice_number", batch)
                    .limit(100);

                if (ioRows) {
                    for (const io of ioRows) {
                        const ioCd = io.custom_data || {};
                        linkedOrders.push({
                            invoice_number: ioCd.invoice_number || "",
                            order_number: ioCd.order_number || null,
                            customer_name: ioCd.customer_name || null,
                            email: ioCd.email || null,
                            products: io.description || null,
                            amount: parseFloat(io.amount) || 0,
                            currency: ioCd.currency || "EUR",
                            financial_account_code: ioCd.financial_account_code || null,
                            financial_account_name: ioCd.financial_account_name || null,
                            order_type: ioCd.order_type || null,
                            payment_method: ioCd.payment_method || null,
                            billing_entity: ioCd.billing_entity || null,
                            country: ioCd.country || null,
                            date: io.date || null,
                        });
                    }
                }
            }
        }

        // Also try IO lookup by order_number matching gateway order_ids
        if (linkedOrders.length === 0 && allOrderIds.size > 0) {
            const oids = [...allOrderIds].slice(0, 50);
            for (let i = 0; i < oids.length; i += 30) {
                const batch = oids.slice(i, i + 30);
                const { data: ioRows } = await supabaseAdmin
                    .from("csv_rows")
                    .select("*")
                    .eq("source", "invoice-orders")
                    .in("custom_data->>order_number", batch)
                    .limit(100);

                if (ioRows) {
                    for (const io of ioRows) {
                        const ioCd = io.custom_data || {};
                        linkedOrders.push({
                            invoice_number: ioCd.invoice_number || "",
                            order_number: ioCd.order_number || null,
                            customer_name: ioCd.customer_name || null,
                            email: ioCd.email || null,
                            products: io.description || null,
                            amount: parseFloat(io.amount) || 0,
                            currency: ioCd.currency || "EUR",
                            financial_account_code: ioCd.financial_account_code || null,
                            financial_account_name: ioCd.financial_account_name || null,
                            order_type: ioCd.order_type || null,
                            payment_method: ioCd.payment_method || null,
                            billing_entity: ioCd.billing_entity || null,
                            country: ioCd.country || null,
                            date: io.date || null,
                        });
                    }
                }
            }
        }

        // Fallback: try IO lookup by customer email from gateway txs
        if (linkedOrders.length === 0 && gatewayTransactions.length > 0) {
            const emails = [...new Set(gatewayTransactions.map(t => t.customer_email).filter(Boolean) as string[])].slice(0, 10);
            const bankDate = bankRow.date?.split("T")[0];

            if (emails.length > 0 && bankDate) {
                const startDate = new Date(new Date(bankDate).getTime() - 30 * 86400000).toISOString().split("T")[0];
                const endDate = new Date(new Date(bankDate).getTime() + 7 * 86400000).toISOString().split("T")[0];

                const { data: ioByEmail } = await supabaseAdmin
                    .from("csv_rows")
                    .select("*")
                    .eq("source", "invoice-orders")
                    .in("custom_data->>email", emails)
                    .gte("date", startDate)
                    .lte("date", endDate)
                    .limit(50);

                if (ioByEmail) {
                    for (const io of ioByEmail) {
                        const ioCd = io.custom_data || {};
                        linkedOrders.push({
                            invoice_number: ioCd.invoice_number || "",
                            order_number: ioCd.order_number || null,
                            customer_name: ioCd.customer_name || null,
                            email: ioCd.email || null,
                            products: io.description || null,
                            amount: parseFloat(io.amount) || 0,
                            currency: ioCd.currency || "EUR",
                            financial_account_code: ioCd.financial_account_code || null,
                            financial_account_name: ioCd.financial_account_name || null,
                            order_type: ioCd.order_type || null,
                            payment_method: ioCd.payment_method || null,
                            billing_entity: ioCd.billing_entity || null,
                            country: ioCd.country || null,
                            date: io.date || null,
                        });
                    }
                }
            }
        }

        // Dedupe orders by invoice_number
        const seenInvNums = new Set<string>();
        const dedupedOrders = linkedOrders.filter(o => {
            if (!o.invoice_number || seenInvNums.has(o.invoice_number)) return false;
            seenInvNums.add(o.invoice_number);
            return true;
        });

        // Build summary metadata from chain data
        const facCodes = new Set<string>();
        const facNames = new Set<string>();
        let hasRefunds = false;
        let totalRefunded = 0;
        const countries = new Set<string>();
        const uniqueSubscriptions = new Set<string>();

        for (const gt of gatewayTransactions) {
            if (gt.matched_invoice_fac) facCodes.add(gt.matched_invoice_fac);
            if (gt.matched_invoice_fac_name) facNames.add(gt.matched_invoice_fac_name);
            if (gt.amount_refunded && gt.amount_refunded > 0) {
                hasRefunds = true;
                totalRefunded += gt.amount_refunded;
            }
            if (gt.refunded_transaction_id) hasRefunds = true;
            if (gt.country_of_issuance) countries.add(gt.country_of_issuance);
            if (gt.subscription_id) uniqueSubscriptions.add(gt.subscription_id);
        }
        for (const o of dedupedOrders) {
            if (o.financial_account_code) facCodes.add(o.financial_account_code);
            if (o.financial_account_name) facNames.add(o.financial_account_name);
            if (o.country) countries.add(o.country);
        }

        // Also pull FAC from bank row custom_data
        if (cd.matched_invoice_fac) facCodes.add(cd.matched_invoice_fac);
        if (cd.matched_invoice_fac_name) facNames.add(cd.matched_invoice_fac_name);

        // Enrich summary with web_orders data
        for (const wo of webOrders) {
            if (wo.billing_country) countries.add(wo.billing_country);
            if (wo.subscription_reference) uniqueSubscriptions.add(wo.subscription_reference);
        }

        // Add web_order customer emails to customer count
        const allCustomerEmails = new Set(gatewayTransactions.map(t => t.customer_email).filter(Boolean));
        for (const wo of webOrders) {
            if (wo.customer_email) allCustomerEmails.add(wo.customer_email);
        }

        return NextResponse.json({
            success: true,
            chain: {
                gateway_transactions: gatewayTransactions.slice(0, 100),
                invoices: linkedInvoices,
                orders: dedupedOrders,
                web_orders: webOrders,
                disbursement: disbursementInfo,
                summary: {
                    fac_codes: [...facCodes],
                    fac_names: [...facNames],
                    has_refunds: hasRefunds,
                    total_refunded: Math.round(totalRefunded * 100) / 100,
                    countries: [...countries],
                    subscription_count: uniqueSubscriptions.size,
                    customer_count: allCustomerEmails.size,
                    match_confidence: cd.match_confidence || null,
                    match_level: cd.match_level || null,
                    match_type: cd.match_type || null,
                    web_orders_count: webOrders.length,
                },
            },
        });
    } catch (error: any) {
        console.error("[Chain Details API] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}