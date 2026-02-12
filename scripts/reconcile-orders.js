#!/usr/bin/env node
/**
 * reconcile-orders.js
 * 
 * Focused order reconciliation: matches the full chain
 *   ar_invoices / invoice-orders  ←→  Braintree/Stripe/GoCardless  ←→  Bank
 * 
 * Strategies:
 *   1. order_id exact match (braintree ↔ ar_invoices)
 *   2. customer_name + amount match
 *   3. email + amount match  
 *   4. invoice_number match (invoice-orders ↔ ar_invoices)
 *   5. amount + date proximity (±7 days)
 * 
 * Usage:
 *   node scripts/reconcile-orders.js              # dry-run
 *   node scripts/reconcile-orders.js --apply       # apply changes
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");

async function fetchAll(query) {
    // Paginate to get all rows (Supabase max 1000 per query)
    const allData = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return allData;
}

async function main() {
    console.log(`\n🔄 ORDER RECONCILIATION ${APPLY ? "(APPLYING)" : "(DRY RUN)"}\n${"=".repeat(60)}\n`);

    // ─── Load all data sources ───
    console.log("📦 Loading data...");

    // Braintree unreconciled
    const braintree = await fetchAll(
        supabase.from("csv_rows")
            .select("id, date, amount, description, currency, custom_data")
            .eq("source", "braintree-api-revenue")
            .eq("reconciled", false)
            .order("date", { ascending: false })
    );

    // Stripe unreconciled
    const stripeEur = await fetchAll(
        supabase.from("csv_rows")
            .select("id, date, amount, description, currency, custom_data")
            .eq("source", "stripe-eur")
            .eq("reconciled", false)
    );
    const stripeUsd = await fetchAll(
        supabase.from("csv_rows")
            .select("id, date, amount, description, currency, custom_data")
            .eq("source", "stripe-usd")
            .eq("reconciled", false)
    );

    // GoCardless unreconciled
    const gocardless = await fetchAll(
        supabase.from("csv_rows")
            .select("id, date, amount, description, currency, custom_data")
            .eq("source", "gocardless")
            .eq("reconciled", false)
    );

    // AR invoices unreconciled
    const arInvoices = await fetchAll(
        supabase.from("ar_invoices")
            .select("id, order_id, invoice_number, company_name, client_name, email, total_amount, charged_amount, currency, payment_method, reconciled, order_date")
            .eq("reconciled", false)
    );

    // Invoice-orders unreconciled
    const invoiceOrders = await fetchAll(
        supabase.from("csv_rows")
            .select("id, date, amount, description, currency, custom_data")
            .eq("source", "invoice-orders")
            .eq("reconciled", false)
    );

    const allGateway = [...braintree, ...stripeEur, ...stripeUsd, ...gocardless];

    console.log(`  Braintree: ${braintree.length} unreconciled`);
    console.log(`  Stripe EUR: ${stripeEur.length} | Stripe USD: ${stripeUsd.length}`);
    console.log(`  GoCardless: ${gocardless.length}`);
    console.log(`  AR Invoices: ${arInvoices.length} pending`);
    console.log(`  Invoice-orders: ${invoiceOrders.length} pending`);
    console.log();

    // ─── Build indexes ───
    // AR invoices by order_id
    const arByOrderId = new Map();
    for (const ar of arInvoices) {
        if (ar.order_id) arByOrderId.set(ar.order_id.toLowerCase(), ar);
    }

    // AR invoices by email
    const arByEmail = new Map();
    for (const ar of arInvoices) {
        if (ar.email) {
            const key = ar.email.toLowerCase();
            if (!arByEmail.has(key)) arByEmail.set(key, []);
            arByEmail.get(key).push(ar);
        }
    }

    // AR invoices by company_name words
    const arByNameWord = new Map();
    for (const ar of arInvoices) {
        const name = (ar.company_name || ar.client_name || "").toLowerCase();
        const words = name.split(/\s+/).filter(w => w.length > 3);
        for (const w of words) {
            if (!arByNameWord.has(w)) arByNameWord.set(w, []);
            arByNameWord.get(w).push(ar);
        }
    }

    // Invoice-orders by invoice_number
    const ioByInvNumber = new Map();
    for (const io of invoiceOrders) {
        const inv = io.custom_data?.invoice_number;
        if (inv) ioByInvNumber.set(inv.toLowerCase(), io);
    }

    // Invoice-orders by customer name
    const ioByCustomer = new Map();
    for (const io of invoiceOrders) {
        const cust = (io.custom_data?.customer_name || "").toLowerCase().trim();
        if (cust && cust.length > 2) {
            if (!ioByCustomer.has(cust)) ioByCustomer.set(cust, []);
            ioByCustomer.get(cust).push(io);
        }
    }

    // ─── Results tracking ───
    const matches = [];
    const matchedBtIds = new Set();
    const matchedArIds = new Set();
    const matchedIoIds = new Set();

    // ════════════════════════════════════════════════
    // STRATEGY 1: order_id exact match (Braintree → AR Invoices)
    // ════════════════════════════════════════════════
    console.log("🔍 Strategy 1: order_id exact match...");
    let s1Count = 0;

    for (const bt of braintree) {
        if (matchedBtIds.has(bt.id)) continue;
        const rawOrderId = bt.custom_data?.order_id;
        if (!rawOrderId) continue;

        // Try full order_id first, then first part of composite (e.g., 'abc123-456789' → 'abc123')
        const candidates = [rawOrderId.toLowerCase()];
        if (rawOrderId.includes("-")) {
            candidates.push(rawOrderId.split("-")[0].toLowerCase());
        }

        for (const oid of candidates) {
            const ar = arByOrderId.get(oid);
            if (ar && !matchedArIds.has(ar.id)) {
                matches.push({
                    strategy: "order_id",
                    gateway: { id: bt.id, source: "braintree-api-revenue", amount: bt.amount, date: bt.date, customer: bt.custom_data?.customer_name },
                    order: { id: ar.id, type: "ar_invoice", orderId: ar.order_id, amount: ar.total_amount, customer: ar.company_name || ar.client_name, invoiceNumber: ar.invoice_number },
                });
                matchedBtIds.add(bt.id);
                matchedArIds.add(ar.id);
                s1Count++;
                break;
            }
        }
    }
    console.log(`  ✅ ${s1Count} matches\n`);

    // ════════════════════════════════════════════════
    // STRATEGY 2: customer_name + approximate amount (±5%)
    // ════════════════════════════════════════════════
    console.log("🔍 Strategy 2: customer_name + amount...");
    let s2Count = 0;

    for (const bt of braintree) {
        if (matchedBtIds.has(bt.id)) continue;
        const btCustomer = (bt.custom_data?.customer_name || "").toLowerCase().trim();
        if (!btCustomer || btCustomer.length < 4) continue;

        const btAmount = Math.abs(parseFloat(bt.amount)) || 0;
        const btWords = btCustomer.split(/\s+/).filter(w => w.length > 2);

        for (const ar of arInvoices) {
            if (matchedArIds.has(ar.id)) continue;
            const arAmount = ar.charged_amount || ar.total_amount || 0;
            const amountDiff = Math.abs(btAmount - arAmount);
            if (amountDiff > Math.max(btAmount * 0.02, 1)) continue; // ±2% or ±€1

            const arName = (ar.company_name || ar.client_name || "").toLowerCase().trim();
            if (!arName) continue;

            const arWords = arName.split(/\s+/).filter(w => w.length > 2);
            // Require at least 2 common words OR the full name matches
            const commonWords = btWords.filter(w => arWords.some(aw => aw === w));
            const fullMatch = btCustomer === arName;

            if (fullMatch || (commonWords.length >= 2 && commonWords.length >= Math.min(btWords.length, arWords.length) * 0.6)) {
                matches.push({
                    strategy: "customer+amount",
                    gateway: { id: bt.id, source: "braintree-api-revenue", amount: bt.amount, date: bt.date, customer: bt.custom_data?.customer_name },
                    order: { id: ar.id, type: "ar_invoice", orderId: ar.order_id, amount: ar.total_amount, customer: ar.company_name || ar.client_name, invoiceNumber: ar.invoice_number },
                });
                matchedBtIds.add(bt.id);
                matchedArIds.add(ar.id);
                s2Count++;
                break;
            }
        }
    }
    console.log(`  ✅ ${s2Count} matches\n`);

    // ════════════════════════════════════════════════
    // STRATEGY 3: email + amount (Braintree/Stripe/GC → AR Invoices)
    // ════════════════════════════════════════════════
    console.log("🔍 Strategy 3: email + amount...");
    let s3Count = 0;

    for (const gw of allGateway) {
        if (matchedBtIds.has(gw.id)) continue;
        const email = (gw.custom_data?.customer_email || gw.custom_data?.email || "").toLowerCase();
        if (!email || !email.includes("@")) continue;

        const gwAmount = Math.abs(parseFloat(gw.amount)) || 0;
        const candidates = arByEmail.get(email) || [];

        for (const ar of candidates) {
            if (matchedArIds.has(ar.id)) continue;
            const arAmount = ar.charged_amount || ar.total_amount || 0;
            if (Math.abs(gwAmount - arAmount) < Math.max(gwAmount * 0.02, 1)) {
                const srcName = gw.custom_data?.source || "gateway";
                matches.push({
                    strategy: "email+amount",
                    gateway: { id: gw.id, source: srcName, amount: gw.amount, date: gw.date, customer: gw.custom_data?.customer_name || email },
                    order: { id: ar.id, type: "ar_invoice", orderId: ar.order_id, amount: ar.total_amount, customer: ar.company_name || ar.client_name, invoiceNumber: ar.invoice_number },
                });
                matchedBtIds.add(gw.id);
                matchedArIds.add(ar.id);
                s3Count++;
                break;
            }
        }
    }
    console.log(`  ✅ ${s3Count} matches\n`);

    // ════════════════════════════════════════════════
    // STRATEGY 4: Braintree → Invoice-Orders (customer_name + amount)
    // ════════════════════════════════════════════════
    console.log("🔍 Strategy 4: Braintree → invoice-orders by customer+amount...");
    let s4Count = 0;

    for (const bt of braintree) {
        if (matchedBtIds.has(bt.id)) continue;
        const btCustomer = (bt.custom_data?.customer_name || "").toLowerCase().trim();
        if (!btCustomer || btCustomer.length < 3) continue;

        const btAmount = Math.abs(parseFloat(bt.amount)) || 0;
        const btDate = new Date(bt.date);

        const candidates = ioByCustomer.get(btCustomer) || [];
        for (const io of candidates) {
            if (matchedIoIds.has(io.id)) continue;
            const ioAmount = Math.abs(parseFloat(io.amount)) || 0;
            if (Math.abs(btAmount - ioAmount) > Math.max(btAmount * 0.05, 1)) continue;

            // Date proximity check (±30 days for invoice-orders)
            const ioDate = new Date(io.date);
            const daysDiff = Math.abs(btDate - ioDate) / (1000 * 60 * 60 * 24);
            if (daysDiff > 30) continue;

            matches.push({
                strategy: "customer+amount (invoice-order)",
                gateway: { id: bt.id, source: "braintree-api-revenue", amount: bt.amount, date: bt.date, customer: bt.custom_data?.customer_name },
                order: { id: io.id, type: "invoice-order", orderId: io.custom_data?.invoice_number || "", amount: io.amount, customer: io.custom_data?.customer_name, invoiceNumber: io.custom_data?.invoice_number },
            });
            matchedBtIds.add(bt.id);
            matchedIoIds.add(io.id);
            s4Count++;
            break;
        }
    }
    console.log(`  ✅ ${s4Count} matches\n`);

    // ════════════════════════════════════════════════
    // STRATEGY 5: Amount + date proximity (±7 days) - last resort
    // ════════════════════════════════════════════════
    console.log("🔍 Strategy 5: amount + date (±7 days)...");
    let s5Count = 0;

    for (const bt of braintree) {
        if (matchedBtIds.has(bt.id)) continue;
        const btAmount = Math.abs(parseFloat(bt.amount)) || 0;
        if (btAmount < 10) continue; // skip tiny amounts
        const btDate = new Date(bt.date);

        for (const ar of arInvoices) {
            if (matchedArIds.has(ar.id)) continue;
            const arAmount = ar.charged_amount || ar.total_amount || 0;
            if (Math.abs(btAmount - arAmount) > 0.01) continue; // exact amount only

            // Check currency match
            const btCurrency = (bt.currency || "").toUpperCase();
            const arCurrency = (ar.currency || "").toUpperCase();
            if (btCurrency && arCurrency && btCurrency !== arCurrency) continue;

            const arDate = new Date(ar.order_date);
            const daysDiff = Math.abs(btDate - arDate) / (1000 * 60 * 60 * 24);
            if (daysDiff > 7) continue;

            matches.push({
                strategy: "exact-amount+date",
                gateway: { id: bt.id, source: "braintree-api-revenue", amount: bt.amount, date: bt.date, customer: bt.custom_data?.customer_name },
                order: { id: ar.id, type: "ar_invoice", orderId: ar.order_id, amount: ar.total_amount, customer: ar.company_name || ar.client_name, invoiceNumber: ar.invoice_number },
            });
            matchedBtIds.add(bt.id);
            matchedArIds.add(ar.id);
            s5Count++;
            break;
        }
    }
    console.log(`  ✅ ${s5Count} matches\n`);

    // ─── Summary ───
    console.log("═".repeat(60));
    console.log(`📊 TOTAL MATCHES: ${matches.length}`);
    console.log(`  Strategy 1 (order_id):           ${s1Count}`);
    console.log(`  Strategy 2 (customer+amount):     ${s2Count}`);
    console.log(`  Strategy 3 (email+amount):         ${s3Count}`);
    console.log(`  Strategy 4 (invoice-orders):       ${s4Count}`);
    console.log(`  Strategy 5 (exact amount+date):    ${s5Count}`);

    const totalValue = matches.reduce((sum, m) => sum + Math.abs(parseFloat(m.gateway.amount) || 0), 0);
    console.log(`  💰 Total value: €${totalValue.toFixed(2)}`);

    // Show samples
    if (matches.length > 0) {
        console.log(`\n📋 SAMPLE MATCHES:`);
        for (const m of matches.slice(0, 10)) {
            console.log(`  [${m.strategy}] ${m.gateway.customer || "?"} → ${m.order.customer || "?"} | GW: €${Math.abs(m.gateway.amount).toFixed(2)} | Order: €${Math.abs(m.order.amount).toFixed(2)} | ${m.order.invoiceNumber || m.order.orderId || "-"}`);
        }
    }

    // ─── Apply ───
    if (APPLY && matches.length > 0) {
        console.log(`\n🔄 APPLYING ${matches.length} reconciliations...`);
        const now = new Date().toISOString();
        let applied = 0;
        let errors = 0;

        const batchSize = 50;
        for (let i = 0; i < matches.length; i += batchSize) {
            const batch = matches.slice(i, i + batchSize);
            const promises = batch.map(async (m) => {
                try {
                    // Update gateway transaction
                    const { error: gwError } = await supabase
                        .from("csv_rows")
                        .update({
                            reconciled: true,
                            custom_data: {
                                reconciliationType: "automatic",
                                reconciliation_strategy: m.strategy,
                                reconciled_at: now,
                                matched_order_id: m.order.orderId,
                                matched_order_type: m.order.type,
                                matched_customer: m.order.customer,
                                matched_invoice_number: m.order.invoiceNumber,
                            }
                        })
                        .eq("id", m.gateway.id);
                    if (gwError) throw gwError;

                    // Update order
                    if (m.order.type === "ar_invoice") {
                        const { error: arError } = await supabase
                            .from("ar_invoices")
                            .update({
                                reconciled: true,
                                reconciled_at: now,
                                reconciled_with: m.gateway.id,
                                reconciliation_type: `auto-${m.strategy}`,
                            })
                            .eq("id", m.order.id);
                        if (arError) throw arError;
                    } else if (m.order.type === "invoice-order") {
                        const { error: ioError } = await supabase
                            .from("csv_rows")
                            .update({
                                reconciled: true,
                                custom_data: {
                                    reconciliationType: "automatic",
                                    reconciliation_strategy: m.strategy,
                                    reconciled_at: now,
                                    matched_gateway_id: m.gateway.id,
                                    matched_gateway_source: m.gateway.source,
                                    matched_gateway_amount: m.gateway.amount,
                                }
                            })
                            .eq("id", m.order.id);
                        if (ioError) throw ioError;
                    }

                    return true;
                } catch (err) {
                    if (VERBOSE) console.error(`  ❌ Error: ${err.message}`);
                    return false;
                }
            });

            const results = await Promise.all(promises);
            applied += results.filter(Boolean).length;
            errors += results.filter(r => !r).length;
            process.stdout.write(`  Progress: ${Math.min(i + batchSize, matches.length)}/${matches.length}\r`);
        }

        console.log(`\n✅ Applied: ${applied}/${matches.length} (${errors} errors)`);
    } else if (!APPLY && matches.length > 0) {
        console.log(`\n💡 Run with --apply to apply these ${matches.length} matches`);
    }

    // ─── Remaining analysis ───
    const remainingBt = braintree.length - matchedBtIds.size;
    const remainingAr = arInvoices.length - matchedArIds.size;
    const remainingIo = invoiceOrders.length - matchedIoIds.size;

    console.log(`\n📊 REMAINING UNRECONCILED:`);
    console.log(`  Braintree: ${remainingBt}/${braintree.length}`);
    console.log(`  AR Invoices: ${remainingAr}/${arInvoices.length}`);
    console.log(`  Invoice-orders: ${remainingIo}/${invoiceOrders.length}`);
}

main().catch(console.error);
