/**
 * import-web-orders-2025.js
 *
 * Importa e consolida dados de orders 2025 do Craft Commerce para a tabela web_orders.
 * Merge de 3 fontes CSV:
 *   1) Legacy CSV — dados base (flat, clean, 1755 rows)
 *   2) Line Items CSV — produtos por order
 *   3) Expanded 1-4 CSVs — Braintree TX IDs (regex extraction)
 *
 * Também popula order_transaction_links com o mapeamento Order→BT TxID.
 *
 * Uso:
 *   node scripts/import-web-orders-2025.js [--dry-run] [--force]
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

// ─── Config ───
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rrzgawssbyfzbkmtcovz.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
    console.error("❌ Set SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

const LEGACY_CSV = path.join(__dirname, "..", "public", "2025 Order Legacy .csv");
const LINE_ITEMS_CSV = path.join(__dirname, "..", "public", "2025 Order Line Itens.csv");
const EXPANDED_CSVS = [1, 2, 3, 4].map(i =>
    path.join(__dirname, "..", "public", `2025 Order Expanded ${i}.csv`)
);

// ─── Step 1: Parse Legacy CSV (base data) ───
function parseLegacy() {
    console.log("\n📄 Parsing Legacy CSV...");
    // Remove BOM if present
    const raw = fs.readFileSync(LEGACY_CSV, "utf-8").replace(/^\uFEFF/, "");
    const records = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true });
    console.log(`   ${records.length} orders found`);

    const orders = {};
    for (const r of records) {
        const ref = (r.number || "").substring(0, 7);
        if (!ref) continue;

        orders[ref] = {
            craft_id: r.id,
            order_reference: ref,
            order_number: r.number,
            customer_email: (r.email || "").toLowerCase().trim(),
            total_price: parseFloat(r.storedTotalPrice) || 0,
            total_paid: parseFloat(r.storedTotalPaid) || 0,
            total_discount: parseFloat(r.storedTotalDiscount) || 0,
            total_shipping: parseFloat(r.storedTotalShippingCost) || 0,
            total_tax: parseFloat(r.storedTotalTax) || 0,
            item_subtotal: parseFloat(r.storedItemSubtotal) || 0,
            currency: r.currency || "USD",
            paid_status: r.paidStatus || "unknown",
            order_status_id: parseInt(r.orderStatusId) || null,
            date_ordered: r.dateOrdered ? new Date(r.dateOrdered).toISOString() : null,
            date_paid: r.datePaid ? new Date(r.datePaid).toISOString() : null,
            gateway_id: parseInt(r.gatewayId) || null,
            payment_source: parseInt(r.gatewayId) === 2 ? "braintree" : "unknown",
            products: [],
            braintree_tx_ids: [],
            source_data: {},
        };
    }
    return orders;
}

// ─── Step 2: Parse Line Items CSV (products) ───
function parseLineItems(orders) {
    console.log("\n📦 Parsing Line Items CSV...");
    // Remove BOM if present
    const raw = fs.readFileSync(LINE_ITEMS_CSV, "utf-8").replace(/^\uFEFF/, "");
    const records = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true });
    console.log(`   ${records.length} line items found`);

    // Build craft_id lookup index for fast matching
    const craftIdIndex = {};
    for (const ref of Object.keys(orders)) {
        craftIdIndex[orders[ref].craft_id] = ref;
    }

    let matched = 0;
    let unmatched = 0;

    for (const r of records) {
        const orderId = r.orderId;
        // Find order by craft_id via index
        const ref = craftIdIndex[orderId];
        const order = ref ? orders[ref] : null;
        if (!order) {
            unmatched++;
            continue;
        }

        matched++;
        const item = {
            sku: r.sku || null,
            description: r.description || r.title || null,
            qty: parseInt(r.qty) || 1,
            price: parseFloat(r.salePrice || r.price) || 0,
            subtotal: parseFloat(r.subtotal) || 0,
        };

        // Extract subscription reference from options JSON
        if (r.options) {
            try {
                const opts = JSON.parse(r.options);
                if (opts.subscriptionReference) {
                    item.subscriptionReference = opts.subscriptionReference;
                    order.subscription_reference = opts.subscriptionReference;
                }
            } catch (e) {
                // options may not be valid JSON
            }
        }

        order.products.push(item);
    }

    console.log(`   Matched: ${matched}, Unmatched: ${unmatched}`);
}

// ─── Step 3: Extract customer names from Expanded CSV ───
function parseExpandedCustomerData(orders) {
    console.log("\n👤 Extracting customer data from Expanded CSVs...");
    let found = 0;

    for (const csvPath of EXPANDED_CSVS) {
        if (!fs.existsSync(csvPath)) continue;
        const raw = fs.readFileSync(csvPath, "utf-8");
        const lines = raw.split("\n");

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;

            // Extract reference (2nd field)
            const parts = line.split(",", 3);
            if (parts.length < 2) continue;
            const ref = parts[1].replace(/"/g, "").trim().substring(0, 7);

            if (!orders[ref]) continue;

            // Extract customer name: ""firstName"":""Name"" and ""lastName"":""Name""
            // The customer JSON is at column 77 area
            const firstNameMatch = line.match(/""firstName"":""([^"]+)""/);
            const lastNameMatch = line.match(/""lastName"":""([^"]+)""/);

            if (firstNameMatch || lastNameMatch) {
                const firstName = firstNameMatch ? firstNameMatch[1] : "";
                const lastName = lastNameMatch ? lastNameMatch[1] : "";
                // Only set if not already set (first match wins — closest to customer block)
                if (!orders[ref].customer_first_name) {
                    orders[ref].customer_first_name = firstName;
                    orders[ref].customer_last_name = lastName;
                    orders[ref].customer_full_name = `${firstName} ${lastName}`.trim();
                    found++;
                }
            }

            // Extract billing address info
            const orgMatch = line.match(/""organization"":""([^"]+)""/);
            const countryMatch = line.match(/""countryCode"":""([^"]+)""/);
            const cityMatch = line.match(/""locality"":""([^"]+)""/);

            if (orgMatch && !orders[ref].billing_organization) {
                orders[ref].billing_organization = orgMatch[1];
            }
            if (countryMatch && !orders[ref].billing_country) {
                orders[ref].billing_country = countryMatch[1];
            }
            if (cityMatch && !orders[ref].billing_city) {
                orders[ref].billing_city = cityMatch[1];
            }
        }
    }
    console.log(`   Customer names extracted: ${found}`);
}

// ─── Step 4: Extract Braintree TxIDs from Expanded CSVs ───
function parseExpandedTxIds(orders) {
    console.log("\n🔗 Extracting Braintree TxIDs from Expanded CSVs...");
    let ordersLinked = 0;
    let totalTxIds = 0;

    for (const csvPath of EXPANDED_CSVS) {
        if (!fs.existsSync(csvPath)) continue;
        const raw = fs.readFileSync(csvPath, "utf-8");
        const lines = raw.split("\n");

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;

            const parts = line.split(",", 3);
            if (parts.length < 2) continue;
            const ref = parts[1].replace(/"/g, "").trim().substring(0, 7);

            if (!orders[ref]) continue;

            // Extract BT TxIDs: ""reference"":""8charalphanumeric""
            const txRefs = line.match(/""reference"":""([a-z0-9]{6,12})""/g);
            if (txRefs) {
                const txIds = new Set(orders[ref].braintree_tx_ids);
                for (const m of txRefs) {
                    const txId = m.match(/""reference"":""([a-z0-9]{6,12})""/)?.[1];
                    if (txId) txIds.add(txId);
                }
                const newTxIds = [...txIds];
                if (newTxIds.length > orders[ref].braintree_tx_ids.length) {
                    orders[ref].braintree_tx_ids = newTxIds;
                    ordersLinked++;
                    totalTxIds += newTxIds.length;
                }
            }

            // Extract order type (subscriptionPayment, etc.)
            const orderTypeMatch = line.match(/,([a-zA-Z]+Payment),/);
            if (orderTypeMatch) {
                orders[ref].order_type = orderTypeMatch[1];
            }
        }
    }
    console.log(`   Orders with BT TxIDs: ${ordersLinked}`);
    console.log(`   Total TxIDs extracted: ${totalTxIds}`);
}

// ─── Step 5: Compute derived fields ───
function computeDerived(orders) {
    let subCount = 0;
    let cartCount = 0;

    for (const ref of Object.keys(orders)) {
        const o = orders[ref];

        // Order status text
        if (o.order_status_id === 12) {
            o.order_status = "subscription";
            subCount++;
        } else if (o.order_status_id === 5) {
            o.order_status = "cart";
            cartCount++;
        } else {
            o.order_status = `status-${o.order_status_id}`;
        }

        // Infer order_type if not set
        if (!o.order_type) {
            o.order_type = o.order_status_id === 12 ? "subscriptionPayment" : "cart";
        }

        // Product description for quick display
        if (o.products.length > 0) {
            o.source_data.product_summary = o.products
                .map(p => `${p.description || p.sku} (x${p.qty})`)
                .join(", ");
        }
    }
    console.log(`\n📊 Status: ${subCount} subscriptions, ${cartCount} cart`);
}

// ─── Step 6: Upsert into Supabase ───
async function upsertOrders(orders) {
    const all = Object.values(orders);
    console.log(`\n💾 Upserting ${all.length} orders to web_orders...`);

    if (DRY_RUN) {
        console.log("   [DRY RUN] Skipping database writes.");
        // Show sample
        const sample = all.slice(0, 3);
        for (const o of sample) {
            console.log(`   ref=${o.order_reference} email=${o.customer_email} amount=${o.total_price} ${o.currency} products=${o.products.length} txids=${o.braintree_tx_ids.length}`);
        }
        return;
    }

    // Check if table exists
    const { error: checkErr } = await supabase.from("web_orders").select("id").limit(1);
    if (checkErr && checkErr.message.includes("does not exist")) {
        console.error("❌ Tabela web_orders não existe. Execute a migração primeiro:");
        console.error("   psql $DATABASE_URL -f supabase/migrations/20260211_create_web_orders.sql");
        process.exit(1);
    }

    // Check current count
    const { count: existingCount } = await supabase
        .from("web_orders")
        .select("id", { count: "exact", head: true });

    if (existingCount > 0 && !FORCE) {
        console.log(`   ⚠️  Tabela já tem ${existingCount} rows. Use --force para sobrescrever.`);
        return;
    }

    // Delete existing if force
    if (existingCount > 0 && FORCE) {
        console.log(`   🗑️  Deletando ${existingCount} rows existentes...`);
        await supabase.from("web_orders").delete().neq("id", 0);
    }

    // Batch upsert (50 por vez)
    const BATCH = 50;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < all.length; i += BATCH) {
        const batch = all.slice(i, i + BATCH).map(o => ({
            craft_id: o.craft_id,
            order_reference: o.order_reference,
            order_number: o.order_number,
            customer_email: o.customer_email || null,
            customer_first_name: o.customer_first_name || null,
            customer_last_name: o.customer_last_name || null,
            customer_full_name: o.customer_full_name || null,
            total_price: o.total_price,
            total_paid: o.total_paid,
            total_discount: o.total_discount,
            total_shipping: o.total_shipping,
            total_tax: o.total_tax,
            item_subtotal: o.item_subtotal,
            currency: o.currency,
            paid_status: o.paid_status,
            order_status_id: o.order_status_id,
            order_status: o.order_status,
            date_ordered: o.date_ordered,
            date_paid: o.date_paid,
            gateway_id: o.gateway_id,
            payment_source: o.payment_source,
            products: o.products,
            braintree_tx_ids: o.braintree_tx_ids,
            hubspot_vid: o.hubspot_vid || null,
            subscription_reference: o.subscription_reference || null,
            order_type: o.order_type || null,
            billing_country: o.billing_country || null,
            billing_city: o.billing_city || null,
            billing_organization: o.billing_organization || null,
            source_data: o.source_data || {},
        }));

        const { error } = await supabase
            .from("web_orders")
            .upsert(batch, { onConflict: "order_reference" });

        if (error) {
            console.error(`   ❌ Batch ${i / BATCH + 1}: ${error.message}`);
            errors++;
        } else {
            inserted += batch.length;
        }
    }

    console.log(`   ✅ Inserted: ${inserted}, Errors: ${errors}`);
}

// ─── Step 7: Populate order_transaction_links ───
async function populateOrderTxLinks(orders) {
    const links = [];
    for (const ref of Object.keys(orders)) {
        const o = orders[ref];
        for (const txId of o.braintree_tx_ids) {
            links.push({
                provider: "braintree",
                order_id: o.order_reference,
                transaction_id: txId,
                currency: o.currency,
                merchant_account_id: o.currency === "EUR" ? "dsd_eur" : "dsd_usd",
                link_metadata: {
                    craft_id: o.craft_id,
                    source: "craft-commerce-csv",
                    order_type: o.order_type,
                    customer_email: o.customer_email,
                },
            });
        }
    }

    console.log(`\n🔗 Upserting ${links.length} order_transaction_links...`);

    if (DRY_RUN) {
        console.log("   [DRY RUN] Skipping.");
        return;
    }

    const BATCH = 50;
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < links.length; i += BATCH) {
        const batch = links.slice(i, i + BATCH);
        const { error } = await supabase
            .from("order_transaction_links")
            .upsert(batch, { onConflict: "provider,transaction_id", ignoreDuplicates: true });

        if (error) {
            // Some may already exist — count as skipped
            skipped += batch.length;
        } else {
            inserted += batch.length;
        }
    }

    console.log(`   ✅ Inserted: ${inserted}, Skipped/Existing: ${skipped}`);
}

// ─── Main ───
async function main() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  Import Web Orders 2025 — Craft Commerce → Supabase");
    console.log("═══════════════════════════════════════════════════════");
    if (DRY_RUN) console.log("  ⚡ DRY RUN MODE — no writes to database");

    // Parse all CSV sources
    const orders = parseLegacy();
    parseLineItems(orders);
    parseExpandedCustomerData(orders);
    parseExpandedTxIds(orders);
    computeDerived(orders);

    // Summary
    const all = Object.values(orders);
    const withTx = all.filter(o => o.braintree_tx_ids.length > 0);
    const withProducts = all.filter(o => o.products.length > 0);
    const withName = all.filter(o => o.customer_full_name);
    const eurOrders = all.filter(o => o.currency === "EUR");
    const usdOrders = all.filter(o => o.currency === "USD");

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  Summary:");
    console.log(`   Total orders: ${all.length}`);
    console.log(`   With BT TxIDs: ${withTx.length} (${(withTx.length / all.length * 100).toFixed(1)}%)`);
    console.log(`   With products: ${withProducts.length}`);
    console.log(`   With customer name: ${withName.length}`);
    console.log(`   EUR: ${eurOrders.length}, USD: ${usdOrders.length}`);
    console.log(`   Total BT TxIDs: ${all.reduce((s, o) => s + o.braintree_tx_ids.length, 0)}`);
    console.log("═══════════════════════════════════════════════════════");

    // Write to database
    await upsertOrders(orders);
    await populateOrderTxLinks(orders);

    console.log("\n✅ Import complete!");
}

main().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
});
