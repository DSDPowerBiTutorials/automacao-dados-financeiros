import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * API de Reconciliação Braintree ↔ Orders/Invoices
 *
 * Strategies:
 * 1. "order-id"   — Match por Order ID (Braintree order_id → invoice-orders order_id)
 * 2. "email"      — Match por Customer Email (Braintree email → invoice-orders email)
 * 3. "amount-date" — Match por valor + data ±3 dias
 * 4. "all"        — Executa todas as estratégias sequencialmente
 *
 * POST /api/reconciliation/braintree-orders?strategy=all&dryRun=1
 */

interface MatchResult {
    braintreeId: string;
    braintreeTransactionId: string;
    orderId: string;
    orderRowId: string;
    matchType: string;
    confidence: number;
    braintreeAmount: number;
    orderAmount: number;
    braintreeDate: string;
    orderDate: string;
    customerName: string | null;
    customerEmail: string | null;
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

/** Normaliza email para comparação */
function normalizeEmail(email: string | null | undefined): string | null {
    if (!email) return null;
    return email.toString().trim().toLowerCase();
}

/** Normaliza name para fuzzy matching */
function normalizeName(name: string | null | undefined): string | null {
    if (!name) return null;
    return name.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '') || null;
}

/** Calcula diferença em dias entre duas datas ISO */
function daysDiff(dateA: string, dateB: string): number {
    const a = new Date(dateA);
    const b = new Date(dateB);
    return Math.abs((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export async function POST(req: Request) {
    try {
        const url = new URL(req.url);
        const dryRun = url.searchParams.get("dryRun") === "1";
        const strategy = url.searchParams.get("strategy") || "all";
        const currency = (url.searchParams.get("currency") || "").toUpperCase();

        console.log(`[Braintree-Orders] Strategy: ${strategy} | DryRun: ${dryRun} | Currency: ${currency || "ALL"}`);

        // 1. Buscar transações Braintree não reconciliadas
        let braintreeQuery = supabaseAdmin
            .from("csv_rows")
            .select("id, source, amount, date, description, customer_email, customer_name, custom_data, reconciled")
            .or("source.eq.braintree-api-revenue,source.eq.braintree-eur,source.eq.braintree-usd")
            .eq("reconciled", false)
            .gte("date", "2024-01-01")
            .order("date", { ascending: false })
            .limit(5000);

        const { data: braintreeRows, error: btError } = await braintreeQuery;

        if (btError) {
            console.error("[Braintree-Orders] Supabase error (braintree):", btError);
            return NextResponse.json({ success: false, error: btError.message }, { status: 500 });
        }

        // Filtrar por moeda se especificada
        let transactions = braintreeRows || [];
        if (currency) {
            transactions = transactions.filter((r) => {
                const cd = r.custom_data || {};
                const txCurrency = (cd.currency || cd.currency_iso_code || "").toUpperCase();
                const merchant = (cd.merchant_account_id || "").toLowerCase();
                return txCurrency === currency || merchant.includes(currency.toLowerCase());
            });
        }

        console.log(`[Braintree-Orders] ${transactions.length} transações Braintree não reconciliadas`);

        // 2. Buscar invoice-orders
        const { data: orderRows, error: orderError } = await supabaseAdmin
            .from("csv_rows")
            .select("id, source, amount, date, description, customer_email, customer_name, custom_data, reconciled")
            .eq("source", "invoice-orders")
            .gte("date", "2024-01-01")
            .order("date", { ascending: false })
            .limit(10000);

        if (orderError) {
            console.error("[Braintree-Orders] Supabase error (orders):", orderError);
            return NextResponse.json({ success: false, error: orderError.message }, { status: 500 });
        }

        const orders = orderRows || [];
        console.log(`[Braintree-Orders] ${orders.length} invoice-orders carregadas`);

        if (transactions.length === 0) {
            return NextResponse.json({
                success: true,
                data: { message: "Nenhuma transação Braintree pendente de reconciliação", total: 0, matched: 0 },
            });
        }

        if (orders.length === 0) {
            return NextResponse.json({
                success: true,
                data: { message: "Nenhuma invoice-order encontrada para reconciliar", total: transactions.length, matched: 0 },
            });
        }

        // Build indexes for fast lookup
        const ordersByOrderId = new Map<string, any>();
        const ordersByEmail = new Map<string, any[]>();
        const ordersByAmountRounded = new Map<number, any[]>();
        const ordersByCustomerName = new Map<string, any[]>();
        const ordersByPartialOrderId = new Map<string, any[]>();

        for (const order of orders) {
            // Index by order_id
            const orderId = order.custom_data?.order_id || order.custom_data?.order_number || order.custom_data?.Number;
            if (orderId) {
                const key = String(orderId).toLowerCase().trim();
                ordersByOrderId.set(key, order);

                // Also index by partial order_id prefix (first 7 chars) for fuzzy matching
                if (key.length >= 7) {
                    const prefix = key.substring(0, 7);
                    if (!ordersByPartialOrderId.has(prefix)) ordersByPartialOrderId.set(prefix, []);
                    ordersByPartialOrderId.get(prefix)!.push(order);
                }
            }

            // Index by email
            const email = normalizeEmail(order.customer_email || order.custom_data?.customer_email || order.custom_data?.Email);
            if (email) {
                if (!ordersByEmail.has(email)) ordersByEmail.set(email, []);
                ordersByEmail.get(email)!.push(order);
            }

            // Index by amount (rounded to integer) for fuzzy matching
            const amt = Math.abs(parseFloat(order.amount) || 0);
            if (amt > 0) {
                const roundedAmt = Math.round(amt);
                if (!ordersByAmountRounded.has(roundedAmt)) ordersByAmountRounded.set(roundedAmt, []);
                ordersByAmountRounded.get(roundedAmt)!.push(order);
            }

            // Index by customer name
            const customerName = normalizeName(order.customer_name || order.custom_data?.customer_name || order.custom_data?.CustomerName);
            if (customerName && customerName.length >= 3) {
                if (!ordersByCustomerName.has(customerName)) ordersByCustomerName.set(customerName, []);
                ordersByCustomerName.get(customerName)!.push(order);
            }
        }

        console.log(`[Braintree-Orders] Indexes: ${ordersByOrderId.size} by orderId, ${ordersByEmail.size} by email, ${ordersByAmountRounded.size} by amount, ${ordersByCustomerName.size} by name, ${ordersByPartialOrderId.size} by partialId`);

        // 3. Run matching strategies
        const matches: MatchResult[] = [];
        const matchedBraintreeIds = new Set<string>();
        const matchedOrderIds = new Set<string>();

        // Strategy 1: Match by Order ID
        if (strategy === "order-id" || strategy === "all") {
            for (const tx of transactions) {
                if (matchedBraintreeIds.has(tx.id)) continue;

                const btOrderId = tx.custom_data?.order_id;
                if (!btOrderId) continue;

                const key = String(btOrderId).toLowerCase().trim();
                const matchedOrder = ordersByOrderId.get(key);

                if (matchedOrder && !matchedOrderIds.has(matchedOrder.id)) {
                    matches.push({
                        braintreeId: tx.id,
                        braintreeTransactionId: tx.custom_data?.transaction_id || tx.id,
                        orderId: btOrderId,
                        orderRowId: matchedOrder.id,
                        matchType: "order-id",
                        confidence: 1.0,
                        braintreeAmount: parseFloat(tx.amount) || 0,
                        orderAmount: parseFloat(matchedOrder.amount) || 0,
                        braintreeDate: tx.date,
                        orderDate: matchedOrder.date,
                        customerName: tx.customer_name || tx.custom_data?.customer_name,
                        customerEmail: tx.customer_email || tx.custom_data?.customer_email,
                    });
                    matchedBraintreeIds.add(tx.id);
                    matchedOrderIds.add(matchedOrder.id);
                }
            }
            console.log(`[Strategy: order-id] ${matches.length} matches`);
        }

        // Strategy 2: Match by Email + Amount tolerance
        if (strategy === "email" || strategy === "all") {
            const emailMatchesBefore = matches.length;

            for (const tx of transactions) {
                if (matchedBraintreeIds.has(tx.id)) continue;

                const email = normalizeEmail(tx.customer_email || tx.custom_data?.customer_email);
                if (!email) continue;

                const candidates = ordersByEmail.get(email);
                if (!candidates) continue;

                const btAmount = Math.abs(parseFloat(tx.amount) || 0);

                // Find best match by amount similarity
                let bestMatch: any = null;
                let bestDiff = Infinity;

                for (const order of candidates) {
                    if (matchedOrderIds.has(order.id)) continue;

                    const orderAmount = Math.abs(parseFloat(order.amount) || 0);
                    const amountDiff = Math.abs(btAmount - orderAmount);
                    const amountTolerance = Math.max(1.0, btAmount * 0.02); // 2% or €1

                    if (amountDiff <= amountTolerance && amountDiff < bestDiff) {
                        bestDiff = amountDiff;
                        bestMatch = order;
                    }
                }

                if (bestMatch) {
                    const confidence = bestDiff < 0.01 ? 0.95 : 0.80;
                    matches.push({
                        braintreeId: tx.id,
                        braintreeTransactionId: tx.custom_data?.transaction_id || tx.id,
                        orderId: bestMatch.custom_data?.order_id || bestMatch.custom_data?.Number || "",
                        orderRowId: bestMatch.id,
                        matchType: "email",
                        confidence,
                        braintreeAmount: parseFloat(tx.amount) || 0,
                        orderAmount: parseFloat(bestMatch.amount) || 0,
                        braintreeDate: tx.date,
                        orderDate: bestMatch.date,
                        customerName: tx.customer_name || tx.custom_data?.customer_name,
                        customerEmail: email,
                    });
                    matchedBraintreeIds.add(tx.id);
                    matchedOrderIds.add(bestMatch.id);
                }
            }
            console.log(`[Strategy: email] ${matches.length - emailMatchesBefore} new matches`);
        }

        // Strategy 3: Match by Amount + Date proximity (rounded keys ±1, ±5 days)
        if (strategy === "amount-date" || strategy === "all") {
            const amountMatchesBefore = matches.length;

            for (const tx of transactions) {
                if (matchedBraintreeIds.has(tx.id)) continue;

                const btAmount = Math.abs(parseFloat(tx.amount) || 0);
                if (btAmount < 1) continue;

                // Check rounded key and neighbors (±1) for near-misses
                const roundedKey = Math.round(btAmount);
                const candidateKeys = [roundedKey - 1, roundedKey, roundedKey + 1];
                const allCandidates: any[] = [];
                for (const key of candidateKeys) {
                    const list = ordersByAmountRounded.get(key);
                    if (list) allCandidates.push(...list);
                }

                // Find best match by date proximity
                let bestMatch: any = null;
                let bestDays = Infinity;

                for (const order of allCandidates) {
                    if (matchedOrderIds.has(order.id)) continue;

                    const orderAmount = Math.abs(parseFloat(order.amount) || 0);
                    const amountDiff = Math.abs(btAmount - orderAmount);
                    if (amountDiff > 1.0) continue; // Hard cap at ±€1

                    const days = daysDiff(tx.date, order.date);
                    if (days <= 5 && days < bestDays) {
                        bestDays = days;
                        bestMatch = order;
                    }
                }

                if (bestMatch) {
                    const confidence = bestDays === 0 ? 0.75 : bestDays <= 1 ? 0.65 : 0.50;
                    matches.push({
                        braintreeId: tx.id,
                        braintreeTransactionId: tx.custom_data?.transaction_id || tx.id,
                        orderId: bestMatch.custom_data?.order_id || bestMatch.custom_data?.Number || "",
                        orderRowId: bestMatch.id,
                        matchType: "amount-date",
                        confidence,
                        braintreeAmount: parseFloat(tx.amount) || 0,
                        orderAmount: parseFloat(bestMatch.amount) || 0,
                        braintreeDate: tx.date,
                        orderDate: bestMatch.date,
                        customerName: tx.customer_name || tx.custom_data?.customer_name,
                        customerEmail: tx.customer_email || tx.custom_data?.customer_email,
                    });
                    matchedBraintreeIds.add(tx.id);
                    matchedOrderIds.add(bestMatch.id);
                }
            }
            console.log(`[Strategy: amount-date] ${matches.length - amountMatchesBefore} new matches`);
        }

        // Strategy 4: Match by Customer Name + Amount tolerance
        if (strategy === "all") {
            const nameMatchesBefore = matches.length;

            for (const tx of transactions) {
                if (matchedBraintreeIds.has(tx.id)) continue;

                const customerName = normalizeName(tx.customer_name || tx.custom_data?.customer_name);
                if (!customerName || customerName.length < 3) continue;

                const btAmount = Math.abs(parseFloat(tx.amount) || 0);
                if (btAmount < 1) continue;

                // Try exact normalized name
                let candidates = (ordersByCustomerName.get(customerName) || [])
                    .filter(o => !matchedOrderIds.has(o.id));

                // Try partial name match if no exact
                if (candidates.length === 0) {
                    for (const [nameKey, orderList] of ordersByCustomerName) {
                        if (nameKey.includes(customerName) || customerName.includes(nameKey)) {
                            candidates.push(...orderList.filter(o => !matchedOrderIds.has(o.id)));
                        }
                    }
                }

                let bestMatch: any = null;
                let bestScore = Infinity;

                for (const order of candidates) {
                    const orderAmount = Math.abs(parseFloat(order.amount) || 0);
                    const amountDiff = Math.abs(btAmount - orderAmount);
                    const amountTolerance = Math.max(1.0, btAmount * 0.02);

                    if (amountDiff <= amountTolerance) {
                        const days = daysDiff(tx.date, order.date);
                        if (days <= 7 && (amountDiff + days) < bestScore) {
                            bestScore = amountDiff + days;
                            bestMatch = order;
                        }
                    }
                }

                if (bestMatch) {
                    matches.push({
                        braintreeId: tx.id,
                        braintreeTransactionId: tx.custom_data?.transaction_id || tx.id,
                        orderId: bestMatch.custom_data?.order_id || bestMatch.custom_data?.Number || "",
                        orderRowId: bestMatch.id,
                        matchType: "customer-name",
                        confidence: 0.60,
                        braintreeAmount: parseFloat(tx.amount) || 0,
                        orderAmount: parseFloat(bestMatch.amount) || 0,
                        braintreeDate: tx.date,
                        orderDate: bestMatch.date,
                        customerName: tx.customer_name || tx.custom_data?.customer_name,
                        customerEmail: tx.customer_email || tx.custom_data?.customer_email,
                    });
                    matchedBraintreeIds.add(tx.id);
                    matchedOrderIds.add(bestMatch.id);
                }
            }
            console.log(`[Strategy: customer-name] ${matches.length - nameMatchesBefore} new matches`);
        }

        // Strategy 5: Partial Order ID prefix matching
        if (strategy === "all") {
            const partialMatchesBefore = matches.length;

            for (const tx of transactions) {
                if (matchedBraintreeIds.has(tx.id)) continue;

                const btOrderId = tx.custom_data?.order_id;
                if (!btOrderId) continue;

                const key = String(btOrderId).toLowerCase().trim();
                if (key.length < 7) continue;

                // Already tried exact match in strategy 1, now try prefix
                const prefix = key.substring(0, 7);
                const candidates = (ordersByPartialOrderId.get(prefix) || [])
                    .filter(o => !matchedOrderIds.has(o.id));

                if (candidates.length === 1) {
                    // Only match if unambiguous (single candidate)
                    const order = candidates[0];
                    const btAmount = Math.abs(parseFloat(tx.amount) || 0);
                    const orderAmount = Math.abs(parseFloat(order.amount) || 0);
                    const amountDiff = Math.abs(btAmount - orderAmount);

                    if (amountDiff < 2.0) {
                        matches.push({
                            braintreeId: tx.id,
                            braintreeTransactionId: tx.custom_data?.transaction_id || tx.id,
                            orderId: order.custom_data?.order_id || order.custom_data?.Number || "",
                            orderRowId: order.id,
                            matchType: "partial-order-id",
                            confidence: 0.70,
                            braintreeAmount: parseFloat(tx.amount) || 0,
                            orderAmount: parseFloat(order.amount) || 0,
                            braintreeDate: tx.date,
                            orderDate: order.date,
                            customerName: tx.customer_name || tx.custom_data?.customer_name,
                            customerEmail: tx.customer_email || tx.custom_data?.customer_email,
                        });
                        matchedBraintreeIds.add(tx.id);
                        matchedOrderIds.add(order.id);
                    }
                }
            }
            console.log(`[Strategy: partial-order-id] ${matches.length - partialMatchesBefore} new matches`);
        }

        // Strategy 6: Subscription ID — match BT subscription payments to subscription-type IOs
        if (strategy === "all") {
            const subMatchesBefore = matches.length;

            // Subscription FAC codes (products that are subscriptions)
            const subscriptionFACCodes = new Set(["105.1", "101.4", "101.3"]);

            for (const tx of transactions) {
                if (matchedBraintreeIds.has(tx.id)) continue;

                const subscriptionId = tx.custom_data?.subscription_id;
                if (!subscriptionId) continue;

                // For subscription payments, match by email to subscription-type IOs
                const email = normalizeEmail(tx.customer_email || tx.custom_data?.customer_email);
                if (!email) continue;

                const candidates = (ordersByEmail.get(email) || []).filter(o => {
                    if (matchedOrderIds.has(o.id)) return false;
                    // Only match orders classified as subscription products
                    const fac = o.custom_data?.financial_account_code;
                    return fac && subscriptionFACCodes.has(fac);
                });

                if (candidates.length > 0) {
                    const btAmount = Math.abs(parseFloat(tx.amount) || 0);
                    // Pick closest amount
                    let bestMatch: any = null;
                    let bestDiff = Infinity;
                    for (const order of candidates) {
                        const diff = Math.abs(btAmount - Math.abs(parseFloat(order.amount) || 0));
                        if (diff < bestDiff && diff < Math.max(2.0, btAmount * 0.05)) {
                            bestDiff = diff;
                            bestMatch = order;
                        }
                    }

                    if (bestMatch) {
                        matches.push({
                            braintreeId: tx.id,
                            braintreeTransactionId: tx.custom_data?.transaction_id || tx.id,
                            orderId: bestMatch.custom_data?.order_id || bestMatch.custom_data?.Number || "",
                            orderRowId: bestMatch.id,
                            matchType: "subscription-id",
                            confidence: 0.85,
                            braintreeAmount: parseFloat(tx.amount) || 0,
                            orderAmount: parseFloat(bestMatch.amount) || 0,
                            braintreeDate: tx.date,
                            orderDate: bestMatch.date,
                            customerName: tx.customer_name || tx.custom_data?.customer_name,
                            customerEmail: email,
                        });
                        matchedBraintreeIds.add(tx.id);
                        matchedOrderIds.add(bestMatch.id);
                    }
                }
            }
            console.log(`[Strategy: subscription-id] ${matches.length - subMatchesBefore} new matches`);
        }

        // Strategy 7: Billing Name — match BT billing_name (cardholder) to IO customer_name
        if (strategy === "all") {
            const billingMatchesBefore = matches.length;

            for (const tx of transactions) {
                if (matchedBraintreeIds.has(tx.id)) continue;

                const billingName = normalizeName(tx.custom_data?.billing_name);
                if (!billingName || billingName.length < 3) continue;

                // Skip if billing_name is same as customer_name (already tried in strategy 4)
                const customerNameNorm = normalizeName(tx.customer_name || tx.custom_data?.customer_name);
                if (billingName === customerNameNorm) continue;

                const btAmount = Math.abs(parseFloat(tx.amount) || 0);
                if (btAmount < 1) continue;

                let candidates: any[] = [];
                // Try exact billing name match against IO customer names
                candidates = (ordersByCustomerName.get(billingName) || []).filter(o => !matchedOrderIds.has(o.id));

                // Partial match fallback
                if (candidates.length === 0) {
                    for (const [nameKey, orderList] of ordersByCustomerName) {
                        if (nameKey.includes(billingName) || billingName.includes(nameKey)) {
                            candidates.push(...orderList.filter(o => !matchedOrderIds.has(o.id)));
                        }
                    }
                }

                let bestMatch: any = null;
                let bestScore = Infinity;

                for (const order of candidates) {
                    const orderAmount = Math.abs(parseFloat(order.amount) || 0);
                    const amountDiff = Math.abs(btAmount - orderAmount);
                    if (amountDiff > Math.max(2.0, btAmount * 0.03)) continue;

                    const days = daysDiff(tx.date, order.date);
                    if (days <= 7 && (amountDiff + days) < bestScore) {
                        bestScore = amountDiff + days;
                        bestMatch = order;
                    }
                }

                if (bestMatch) {
                    // Country tiebreaker: boost confidence if countries match
                    let confidence = 0.65;
                    const btCountry = tx.custom_data?.country_of_issuance;
                    const orderCountry = bestMatch.custom_data?.country || bestMatch.custom_data?.Country;
                    if (btCountry && orderCountry && btCountry.toLowerCase() === orderCountry.toLowerCase()) {
                        confidence += 0.05;
                    }

                    matches.push({
                        braintreeId: tx.id,
                        braintreeTransactionId: tx.custom_data?.transaction_id || tx.id,
                        orderId: bestMatch.custom_data?.order_id || bestMatch.custom_data?.Number || "",
                        orderRowId: bestMatch.id,
                        matchType: "billing-name",
                        confidence,
                        braintreeAmount: parseFloat(tx.amount) || 0,
                        orderAmount: parseFloat(bestMatch.amount) || 0,
                        braintreeDate: tx.date,
                        orderDate: bestMatch.date,
                        customerName: tx.custom_data?.billing_name || tx.customer_name,
                        customerEmail: tx.customer_email || tx.custom_data?.customer_email,
                    });
                    matchedBraintreeIds.add(tx.id);
                    matchedOrderIds.add(bestMatch.id);
                }
            }
            console.log(`[Strategy: billing-name] ${matches.length - billingMatchesBefore} new matches`);
        }

        console.log(`\n[Braintree-Orders] TOTAL: ${matches.length} matches de ${transactions.length} transações`);

        // 4. Apply matches (update both sides if not dry run)
        let appliedCount = 0;
        let failedCount = 0;

        if (!dryRun && matches.length > 0) {
            // Build a map of order IDs → order data for FAC lookup
            const orderDataMap = new Map<string, any>();
            for (const order of orders) {
                orderDataMap.set(order.id, order);
            }

            for (const batch of chunk(matches, 25)) {
                const results = await Promise.allSettled(
                    batch.map(async (match) => {
                        // Lookup the matched order to get FAC data
                        const matchedOrder = orderDataMap.get(match.orderRowId);
                        const orderCd = matchedOrder?.custom_data || {};
                        const invoiceNumber = orderCd.Number || orderCd.invoice_number || match.orderId;
                        const facCode = orderCd.financial_account_code || null;
                        const facName = orderCd.financial_account_name || null;

                        // Fetch existing custom_data from BT row to preserve it
                        const { data: currentBtRow } = await supabaseAdmin
                            .from("csv_rows")
                            .select("custom_data")
                            .eq("id", match.braintreeId)
                            .single();

                        const existingBtCd = currentBtRow?.custom_data || {};

                        // Update Braintree row — with FAC enrichment
                        const { error: btErr } = await supabaseAdmin
                            .from("csv_rows")
                            .update({
                                reconciled: true,
                                matched_with: match.orderRowId,
                                matched_source: "invoice-orders",
                                match_confidence: match.confidence,
                                match_details: {
                                    match_type: match.matchType,
                                    order_id: match.orderId,
                                    order_amount: match.orderAmount,
                                    order_date: match.orderDate,
                                    matched_at: new Date().toISOString(),
                                },
                                custom_data: {
                                    ...existingBtCd,
                                    matched_invoice_number: invoiceNumber,
                                    matched_invoice_fac: facCode,
                                    matched_invoice_fac_name: facName,
                                    matched_customer_name: match.customerName,
                                    matched_customer_email: match.customerEmail,
                                },
                            })
                            .eq("id", match.braintreeId);

                        if (btErr) throw new Error(`Braintree update failed: ${btErr.message}`);

                        // Update Order row
                        const { error: orderErr } = await supabaseAdmin
                            .from("csv_rows")
                            .update({
                                reconciled: true,
                                matched_with: match.braintreeId,
                                matched_source: "braintree",
                                match_confidence: match.confidence,
                                match_details: {
                                    match_type: match.matchType,
                                    transaction_id: match.braintreeTransactionId,
                                    braintree_amount: match.braintreeAmount,
                                    braintree_date: match.braintreeDate,
                                    matched_at: new Date().toISOString(),
                                },
                            })
                            .eq("id", match.orderRowId);

                        if (orderErr) throw new Error(`Order update failed: ${orderErr.message}`);

                        return match;
                    })
                );

                for (const r of results) {
                    if (r.status === "fulfilled") appliedCount++;
                    else {
                        failedCount++;
                        console.error("[Match failed]", r.reason);
                    }
                }
            }
        }

        // 5. Summary by strategy
        const byStrategy: Record<string, number> = {};
        for (const m of matches) {
            byStrategy[m.matchType] = (byStrategy[m.matchType] || 0) + 1;
        }

        return NextResponse.json({
            success: true,
            dryRun,
            data: {
                totalBraintree: transactions.length,
                totalOrders: orders.length,
                totalMatched: matches.length,
                totalApplied: dryRun ? 0 : appliedCount,
                totalFailed: failedCount,
                totalUnmatched: transactions.length - matches.length,
                byStrategy,
                averageConfidence: matches.length > 0
                    ? +(matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length).toFixed(3)
                    : 0,
                matches: dryRun ? matches.slice(0, 100) : matches.slice(0, 20),
            },
        });
    } catch (err: any) {
        console.error("[Braintree-Orders] Unexpected error:", err);
        return NextResponse.json(
            { success: false, error: err?.message || "Unexpected error" },
            { status: 500 }
        );
    }
}
