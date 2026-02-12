/**
 * API Endpoint: Detalhes da Cadeia de Reconciliação
 * 
 * GET /api/reconcile/chain-details?bankRowId=UUID
 * 
 * Dado um registro bancário reconciliado, retorna TODA a cadeia:
 * - Disbursement/payout associado
 * - Transações gateway (Braintree/Stripe/GoCardless) com customer_name, email, order_id, product
 * - Invoices (ar_invoices) associadas com client_name, product, valor
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

interface DisbursementInfo {
    id: string;
    date: string;
    amount: number;
    transaction_count: number;
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
        const gatewayTransactions: GatewayTransaction[] = [];
        const linkedInvoices: LinkedInvoice[] = [];
        let disbursementInfo: DisbursementInfo | null = null;

        // Determine the gateway source
        const paymentSource = (cd.paymentSource || "").toLowerCase();
        const matchedWith = bankRow.matched_with || "";

        // ═══════════════════════════════════════════════
        // STRATEGY 1: Via transaction_ids (Braintree disbursements)
        // ═══════════════════════════════════════════════
        if (cd.transaction_ids && Array.isArray(cd.transaction_ids) && cd.transaction_ids.length > 0) {
            // Fetch Braintree transactions by transaction_id in custom_data
            const txIds = cd.transaction_ids.slice(0, 100); // Limit to prevent oversized queries

            // Query in batches of 20
            for (let i = 0; i < txIds.length; i += 20) {
                const batch = txIds.slice(i, i + 20);
                for (const txId of batch) {
                    const { data: btRows } = await supabaseAdmin
                        .from("csv_rows")
                        .select("*")
                        .eq("source", "braintree-api-revenue")
                        .eq("custom_data->>transaction_id", txId)
                        .limit(1);

                    if (btRows && btRows.length > 0) {
                        const bt = btRows[0];
                        const btCd = bt.custom_data || {};
                        gatewayTransactions.push({
                            transaction_id: btCd.transaction_id || bt.id,
                            amount: parseFloat(bt.amount) || 0,
                            date: bt.date || "",
                            customer_name: bt.customer_name || btCd.customer_name || btCd.customer_company || null,
                            customer_email: bt.customer_email || btCd.customer_email || null,
                            order_id: btCd.order_id || null,
                            product_name: btCd.plan_id || btCd.subscription_id || btCd.product || null,
                            payment_method: btCd.payment_method || btCd.card_type || null,
                        });
                    }
                }
            }

            // Build disbursement info
            disbursementInfo = {
                id: cd.disbursement_reference || cd.settlement_batch_id || "",
                date: cd.disbursement_date || "",
                amount: cd.disbursement_amount || 0,
                transaction_count: txIds.length,
            };
        }

        // ═══════════════════════════════════════════════
        // STRATEGY 2: Via settlement_batch_id (Braintree settlement batches)
        // ═══════════════════════════════════════════════
        if (gatewayTransactions.length === 0 && cd.settlement_batch_id) {
            const { data: batchRows } = await supabaseAdmin
                .from("csv_rows")
                .select("*")
                .eq("source", "braintree-api-revenue")
                .eq("custom_data->>settlement_batch_id", cd.settlement_batch_id)
                .limit(50);

            if (batchRows && batchRows.length > 0) {
                for (const bt of batchRows) {
                    const btCd = bt.custom_data || {};
                    gatewayTransactions.push({
                        transaction_id: btCd.transaction_id || bt.id,
                        amount: parseFloat(bt.amount) || 0,
                        date: bt.date || "",
                        customer_name: bt.customer_name || btCd.customer_name || btCd.customer_company || null,
                        customer_email: bt.customer_email || btCd.customer_email || null,
                        order_id: btCd.order_id || null,
                        product_name: btCd.plan_id || btCd.subscription_id || btCd.product || null,
                        payment_method: btCd.payment_method || btCd.card_type || null,
                    });
                }

                disbursementInfo = {
                    id: cd.settlement_batch_id,
                    date: cd.disbursement_date || batchRows[0]?.custom_data?.disbursement_date || "",
                    amount: cd.disbursement_amount || gatewayTransactions.reduce((s, t) => s + t.amount, 0),
                    transaction_count: batchRows.length,
                };
            }
        }

        // ═══════════════════════════════════════════════
        // STRATEGY 3: Via disbursement_reference (match reference string)
        // ═══════════════════════════════════════════════
        if (gatewayTransactions.length === 0 && cd.disbursement_reference) {
            const ref = cd.disbursement_reference;
            // e.g., "braintree-disb-2025-06-15" → extract date → find Braintree txs with that disbursement_date
            const dateMatch = ref.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
                const disbDate = dateMatch[1];
                const { data: btRows } = await supabaseAdmin
                    .from("csv_rows")
                    .select("*")
                    .eq("source", "braintree-api-revenue")
                    .eq("custom_data->>disbursement_date", disbDate)
                    .limit(50);

                if (btRows && btRows.length > 0) {
                    for (const bt of btRows) {
                        const btCd = bt.custom_data || {};
                        gatewayTransactions.push({
                            transaction_id: btCd.transaction_id || bt.id,
                            amount: parseFloat(bt.amount) || 0,
                            date: bt.date || "",
                            customer_name: bt.customer_name || btCd.customer_name || btCd.customer_company || null,
                            customer_email: bt.customer_email || btCd.customer_email || null,
                            order_id: btCd.order_id || null,
                            product_name: btCd.plan_id || btCd.subscription_id || btCd.product || null,
                            payment_method: btCd.payment_method || btCd.card_type || null,
                        });
                    }

                    disbursementInfo = {
                        id: ref,
                        date: disbDate,
                        amount: cd.disbursement_amount || gatewayTransactions.reduce((s, t) => s + t.amount, 0),
                        transaction_count: btRows.length,
                    };
                }
            }
        }

        // ═══════════════════════════════════════════════
        // STRATEGY 4: Stripe payouts — match via payout reference
        // ═══════════════════════════════════════════════
        if (gatewayTransactions.length === 0 && (paymentSource === "stripe" || matchedWith.startsWith("stripe:"))) {
            const stripeRef = cd.disbursement_reference || matchedWith.replace("stripe:", "");
            if (stripeRef) {
                // Find the Stripe payout row
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

                    // Try to find Stripe charges contributing to this payout
                    const arrivalDate = payoutCd.arrival_date?.split("T")[0] || payout.date;
                    const { data: stripeCharges } = await supabaseAdmin
                        .from("csv_rows")
                        .select("*")
                        .eq("source", "stripe-eur")
                        .gte("date", new Date(new Date(arrivalDate).getTime() - 7 * 86400000).toISOString().split("T")[0])
                        .lte("date", arrivalDate)
                        .limit(50);

                    if (stripeCharges) {
                        for (const sc of stripeCharges) {
                            const scCd = sc.custom_data || {};
                            gatewayTransactions.push({
                                transaction_id: scCd.payment_intent || scCd.charge_id || sc.id,
                                amount: parseFloat(sc.amount) || 0,
                                date: sc.date || "",
                                customer_name: sc.customer_name || scCd.customer_name || scCd.customer_description || null,
                                customer_email: sc.customer_email || scCd.customer_email || null,
                                order_id: scCd.order_id || scCd.metadata?.order_id || null,
                                product_name: scCd.product_description || scCd.description || null,
                                payment_method: scCd.payment_method_type || "card",
                            });
                        }
                    }
                }
            }
        }

        // ═══════════════════════════════════════════════
        // STRATEGY 5: GoCardless payouts
        // ═══════════════════════════════════════════════
        if (gatewayTransactions.length === 0 && (paymentSource === "gocardless" || matchedWith.startsWith("gocardless:"))) {
            const gcRef = cd.disbursement_reference || matchedWith.replace("gocardless:", "");
            if (gcRef) {
                // Find GC payout
                const { data: gcPayouts } = await supabaseAdmin
                    .from("csv_rows")
                    .select("*")
                    .eq("source", "gocardless")
                    .eq("custom_data->>type", "payout")
                    .or(`custom_data->>payout_id.eq.${gcRef},custom_data->>gocardless_id.eq.${gcRef}`)
                    .limit(1);

                if (gcPayouts && gcPayouts.length > 0) {
                    disbursementInfo = {
                        id: gcRef,
                        date: gcPayouts[0].date || "",
                        amount: parseFloat(gcPayouts[0].amount) || 0,
                        transaction_count: 1,
                    };
                }

                // Find GC payments (not payouts)
                const { data: gcPayments } = await supabaseAdmin
                    .from("csv_rows")
                    .select("*")
                    .eq("source", "gocardless")
                    .neq("custom_data->>type", "payout")
                    .limit(50);

                if (gcPayments) {
                    for (const gc of gcPayments) {
                        const gcCd = gc.custom_data || {};
                        gatewayTransactions.push({
                            transaction_id: gcCd.payment_id || gcCd.gocardless_id || gc.id,
                            amount: parseFloat(gc.amount) || 0,
                            date: gc.date || "",
                            customer_name: gc.customer_name || gcCd.customer_name || null,
                            customer_email: gc.customer_email || gcCd.customer_email || null,
                            order_id: null,
                            product_name: gcCd.description || null,
                            payment_method: "direct_debit",
                        });
                    }
                }
            }
        }

        // ═══════════════════════════════════════════════
        // STRATEGY 6: General fallback — match by amount + date range in gateway data
        // ═══════════════════════════════════════════════
        if (gatewayTransactions.length === 0 && bankRow.amount > 0) {
            const bankAmount = parseFloat(bankRow.amount);
            const bankDate = bankRow.date?.split("T")[0];
            if (bankDate) {
                // Try to find gateway transactions near this date with similar sum
                const startDate = new Date(new Date(bankDate).getTime() - 5 * 86400000).toISOString().split("T")[0];
                const endDate = new Date(new Date(bankDate).getTime() + 2 * 86400000).toISOString().split("T")[0];

                for (const src of ["braintree-api-revenue", "stripe-eur", "gocardless"]) {
                    const { data: nearbyTxs } = await supabaseAdmin
                        .from("csv_rows")
                        .select("*")
                        .eq("source", src)
                        .gte("date", startDate)
                        .lte("date", endDate)
                        .gt("amount", 0)
                        .limit(100);

                    if (nearbyTxs && nearbyTxs.length > 0) {
                        // Find individual or grouped transactions matching bank amount
                        for (const tx of nearbyTxs) {
                            const txCd = tx.custom_data || {};
                            if (Math.abs(parseFloat(tx.amount) - bankAmount) < 1) {
                                gatewayTransactions.push({
                                    transaction_id: txCd.transaction_id || txCd.payment_intent || tx.id,
                                    amount: parseFloat(tx.amount) || 0,
                                    date: tx.date || "",
                                    customer_name: tx.customer_name || txCd.customer_name || txCd.customer_company || null,
                                    customer_email: tx.customer_email || txCd.customer_email || null,
                                    order_id: txCd.order_id || null,
                                    product_name: txCd.plan_id || txCd.product || txCd.description || null,
                                    payment_method: txCd.payment_method || txCd.card_type || null,
                                });
                            }
                        }
                    }
                    if (gatewayTransactions.length > 0) break;
                }
            }
        }

        // ═══════════════════════════════════════════════
        // FIND LINKED INVOICES — from order_ids in gateway transactions
        // ═══════════════════════════════════════════════
        const orderIds = gatewayTransactions
            .map(t => t.order_id)
            .filter(Boolean) as string[];

        // Also check custom_data for order references
        if (cd.web_orders && Array.isArray(cd.web_orders)) {
            for (const oid of cd.web_orders) {
                if (oid && !orderIds.includes(oid)) orderIds.push(oid);
            }
        }
        if (cd.invoice_order_id && !orderIds.includes(cd.invoice_order_id)) {
            orderIds.push(cd.invoice_order_id);
        }

        if (orderIds.length > 0) {
            // Query ar_invoices by order_id
            const uniqueOrderIds = [...new Set(orderIds)];
            for (let i = 0; i < uniqueOrderIds.length; i += 20) {
                const batch = uniqueOrderIds.slice(i, i + 20);
                const { data: invoices } = await supabaseAdmin
                    .from("ar_invoices")
                    .select("id, invoice_number, order_id, client_name, company_name, total_amount, currency, product, invoice_date, order_date")
                    .in("order_id", batch)
                    .limit(50);

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
                    .limit(20);

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

        return NextResponse.json({
            success: true,
            chain: {
                gateway_transactions: gatewayTransactions,
                invoices: linkedInvoices,
                disbursement: disbursementInfo,
            },
        });
    } catch (error: any) {
        console.error("[Chain Details API] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
