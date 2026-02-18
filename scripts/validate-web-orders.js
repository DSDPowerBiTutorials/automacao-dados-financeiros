#!/usr/bin/env node
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("🔍 Validando web_orders...\n");

    // Count total
    const { count } = await sb.from("web_orders").select("*", { count: "exact", head: true });
    console.log(`Total orders: ${count}`);

    // Count by currency
    const { data: eur } = await sb.from("web_orders").select("id", { count: "exact", head: true }).eq("currency", "EUR");
    const { data: usd } = await sb.from("web_orders").select("id", { count: "exact", head: true }).eq("currency", "USD");

    // Sample order with products
    const { data: sample } = await sb.from("web_orders")
        .select("order_reference, customer_full_name, total_paid, currency, braintree_tx_ids, products, date_ordered")
        .not("braintree_tx_ids", "eq", "{}")
        .limit(3);

    console.log("\n📋 Sample orders:");
    for (const o of sample || []) {
        const prods = (o.products || []).map(p => p.sku || p.description).join(", ");
        console.log(`  ${o.order_reference} | ${o.customer_full_name} | ${o.total_paid} ${o.currency} | BT: ${(o.braintree_tx_ids || []).join(",")} | Products: ${prods} | ${o.date_ordered}`);
    }

    // Count transaction links
    const { count: linkCount } = await sb.from("order_transaction_links").select("*", { count: "exact", head: true }).eq("provider", "braintree");
    console.log(`\n🔗 Order-transaction links (braintree): ${linkCount}`);

    // Sample links
    const { data: linkSample } = await sb.from("order_transaction_links")
        .select("order_id, transaction_id, currency")
        .eq("provider", "braintree")
        .limit(5);
    console.log("📋 Sample links:");
    for (const l of linkSample || []) {
        console.log(`  Order: ${l.order_id} → TX: ${l.transaction_id} (${l.currency})`);
    }

    // Check chain: pick a TX ID and see if we can find the order
    if (linkSample && linkSample.length > 0) {
        const testTx = linkSample[0].transaction_id;
        console.log(`\n🔄 Chain test: TX ${testTx}`);

        const { data: links } = await sb.from("order_transaction_links")
            .select("order_id")
            .eq("transaction_id", testTx);

        if (links && links.length > 0) {
            const orderRef = links[0].order_id;
            const { data: order } = await sb.from("web_orders")
                .select("order_reference, customer_full_name, total_paid, currency, products")
                .eq("order_reference", orderRef)
                .single();

            if (order) {
                const prods = (order.products || []).map(p => p.sku).join(", ");
                console.log(`  ✅ TX → Order: ${order.order_reference} | ${order.customer_full_name} | ${order.total_paid} ${order.currency} | ${prods}`);
            }
        }
    }

    console.log("\n✅ Validação completa!");
}

run().catch(console.error);
