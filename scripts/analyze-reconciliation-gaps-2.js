#!/usr/bin/env node
/**
 * Deep dive #2: Understanding Braintree data fields and PayPal disbursement patterns
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  DEEP DIVE #2 — BRAINTREE FIELDS & PAYPAL PATTERNS");
    console.log("═══════════════════════════════════════════════════════\n");

    // =============================================
    // 1. BRAINTREE custom_data FIELD NAMES
    // =============================================
    console.log("📊 1. BRAINTREE GATEWAY — ALL custom_data FIELDS");
    console.log("──────────────────────────────────────────────────");

    const { data: btSample } = await sb.from("csv_rows")
        .select("custom_data")
        .eq("source", "braintree-api-revenue")
        .gte("date", "2025-01-01")
        .limit(10);

    if (btSample && btSample.length > 0) {
        // Show ALL field names from first row
        const allKeys = new Set();
        btSample.forEach(r => Object.keys(r.custom_data || {}).forEach(k => allKeys.add(k)));
        console.log(`  All fields: ${[...allKeys].sort().join(", ")}`);

        // Show full custom_data of first row
        console.log(`\n  Full row 1:`);
        console.log(JSON.stringify(btSample[0].custom_data, null, 2).substring(0, 2000));
    }

    // =============================================
    // 2. FIND PAYPAL PAYMENTS IN BRAINTREE
    // =============================================
    console.log("\n\n📊 2. SEARCHING FOR PAYPAL IN BRAINTREE DATA");
    console.log("──────────────────────────────────────────────");

    // Search every possible field for "paypal"
    const fields = [
        "payment_method_type", "payment_instrument_type", "payment_method",
        "paymentMethodType", "type", "card_type", "cardType", "payment_type",
        "paymentType", "channel", "source", "gateway", "payment_method_nonce",
        "payment_instrument", "processor"
    ];

    for (const field of fields) {
        const { data, count } = await sb.from("csv_rows")
            .select("id", { count: "exact", head: true })
            .eq("source", "braintree-api-revenue")
            .gte("date", "2025-01-01")
            .ilike(`custom_data->>${field}`, "%paypal%");

        if (count > 0) {
            console.log(`  ✅ Found paypal in field '${field}': ${count} rows`);
        }
    }

    // Also try text search in description field of braintree rows
    const { data: btPaypalDesc, count: btPPDescCount } = await sb.from("csv_rows")
        .select("id, description, custom_data", { count: "exact" })
        .eq("source", "braintree-api-revenue")
        .gte("date", "2025-01-01")
        .ilike("description", "%paypal%")
        .limit(3);

    console.log(`\n  PayPal in description: ${btPPDescCount}`);
    if (btPaypalDesc) {
        btPaypalDesc.forEach(r => console.log(`    "${r.description?.substring(0, 80)}"`));
    }

    // Check distinct payment_method_type values
    console.log(`\n  Distinct payment_method_type values:`);
    const { data: btAll } = await sb.from("csv_rows")
        .select("custom_data")
        .eq("source", "braintree-api-revenue")
        .gte("date", "2025-01-01")
        .limit(5000);

    if (btAll) {
        const types = {};
        const cardTypes = {};
        for (const r of btAll) {
            const cd = r.custom_data || {};
            // Check ALL fields for any sign of PayPal
            for (const [k, v] of Object.entries(cd)) {
                if (typeof v === "string" && v.toLowerCase().includes("paypal")) {
                    if (!types[k]) types[k] = 0;
                    types[k]++;
                }
            }
            // Collect unique values for card_type
            const ct = cd.card_type || "N/A";
            cardTypes[ct] = (cardTypes[ct] || 0) + 1;
        }

        console.log(`  Fields containing 'paypal' in any value: ${JSON.stringify(types)}`);
        console.log(`  card_type distribution: ${JSON.stringify(cardTypes)}`);
    }

    // =============================================
    // 3. MERCHANT ACCOUNT ANALYSIS
    // =============================================
    console.log("\n\n📊 3. MERCHANT ACCOUNT → DISBURSEMENT ANALYSIS");
    console.log("────────────────────────────────────────────────");

    if (btAll) {
        // Group by merchant_account_id + disbursement_date, show totals
        const disbursements = {};
        for (const r of btAll) {
            const cd = r.custom_data || {};
            const ma = cd.merchant_account_id || "unknown";
            const dd = cd.disbursement_date || "no-date";
            const key = `${dd}|${ma}`;
            if (!disbursements[key]) disbursements[key] = { total: 0, count: 0, merchant: ma, date: dd };
            disbursements[key].total += parseFloat(cd.settlement_amount || 0);
            disbursements[key].count++;
        }

        // Show first 20 disbursements sorted by date
        const sorted = Object.values(disbursements).sort((a, b) => a.date.localeCompare(b.date));
        console.log(`  Total unique disbursements: ${sorted.length}`);
        console.log(`\n  First 20 disbursements:`);
        sorted.slice(0, 20).forEach(d => {
            console.log(`    ${d.date} | ${d.merchant} | ${d.total.toFixed(2)} | ${d.count} txs`);
        });
    }

    // =============================================
    // 4. RECONCILED PAYPAL — HOW DID THEY MATCH?
    // =============================================
    console.log("\n\n📊 4. RECONCILED PAYPAL — HOW DID THEY MATCH?");
    console.log("────────────────────────────────────────────────");

    const { data: ppRecon } = await sb.from("csv_rows")
        .select("id, date, amount, description, custom_data, matched_with")
        .eq("source", "bankinter-eur")
        .eq("reconciled", true)
        .gt("amount", 0)
        .ilike("description", "%paypal%")
        .gte("date", "2025-01-01")
        .order("date")
        .limit(20);

    if (ppRecon && ppRecon.length > 0) {
        console.log(`  ${ppRecon.length} reconciled PayPal entries (showing first 10):`);
        for (const r of ppRecon.slice(0, 10)) {
            const cd = r.custom_data || {};
            console.log(`\n    ${r.date} | ${r.amount} | matched_with: ${r.matched_with}`);
            console.log(`      paymentSource=${cd.paymentSource} | match_type=${cd.match_type} | reconciliationType=${cd.reconciliationType}`);
            console.log(`      disbursement_date=${cd.disbursement_date} | disbursement_amount=${cd.disbursement_amount}`);
            console.log(`      settlement_batch_id=${cd.settlement_batch_id}`);
            console.log(`      transaction_ids: ${(cd.transaction_ids || []).length} txs`);
            if (cd.transaction_ids?.length > 0) console.log(`      first 3 txids: ${cd.transaction_ids.slice(0, 3).join(", ")}`);
        }
    }

    // =============================================
    // 5. BRAINTREE RECONCILED — HOW DID THEY MATCH?
    // =============================================
    console.log("\n\n📊 5. BRAINTREE RECONCILED — SAMPLE");
    console.log("──────────────────────────────────────");

    const { data: btRecon } = await sb.from("csv_rows")
        .select("id, date, amount, description, custom_data, matched_with")
        .eq("source", "bankinter-eur")
        .eq("reconciled", true)
        .gt("amount", 0)
        .not("description", "ilike", "%paypal%")
        .not("description", "ilike", "%stripe%")
        .not("description", "ilike", "%gocardless%")
        .gte("date", "2025-01-01")
        .order("date")
        .limit(10);

    if (btRecon && btRecon.length > 0) {
        console.log(`  Showing 10 non-PayPal/Stripe/GC reconciled entries:`);
        for (const r of btRecon.slice(0, 10)) {
            const cd = r.custom_data || {};
            console.log(`\n    ${r.date} | ${r.amount} | "${r.description?.substring(0, 50)}" | matched_with: ${r.matched_with}`);
            console.log(`      paymentSource=${cd.paymentSource} | match_type=${cd.match_type}`);
            console.log(`      disbursement_date=${cd.disbursement_date} | disbursement_amount=${cd.disbursement_amount}`);
            console.log(`      transaction_ids: ${(cd.transaction_ids || []).length}`);
        }
    }

    // =============================================
    // 6. UNRECONCILED "AMERICAN EXPRESS" ANALYSIS
    // =============================================
    console.log("\n\n📊 6. AMERICAN EXPRESS ENTRIES");
    console.log("──────────────────────────────");

    const { data: amexBank } = await sb.from("csv_rows")
        .select("id, date, amount, description, reconciled, custom_data")
        .eq("source", "bankinter-eur")
        .gt("amount", 0)
        .ilike("description", "%american express%")
        .gte("date", "2025-01-01")
        .order("date")
        .limit(20);

    if (amexBank && amexBank.length > 0) {
        const recon = amexBank.filter(r => r.reconciled);
        console.log(`  AMEX entries: ${amexBank.length}, reconciled: ${recon.length}`);
        amexBank.slice(0, 5).forEach(r => {
            const cd = r.custom_data || {};
            console.log(`    ${r.date} | ${r.amount} | recon=${r.reconciled} | paymentSource=${cd.paymentSource} | match_type=${cd.match_type}`);
        });
    }

    // =============================================
    // 7. BANKINTER-USD ANALYSIS
    // =============================================
    console.log("\n\n📊 7. BANKINTER-USD");
    console.log("──────────────────────");

    const { data: bkUsd } = await sb.from("csv_rows")
        .select("id, date, amount, description, reconciled, custom_data")
        .eq("source", "bankinter-usd")
        .gt("amount", 0)
        .gte("date", "2025-01-01")
        .order("date")
        .limit(5);

    if (bkUsd && bkUsd.length > 0) {
        const { count: totalUsd } = await sb.from("csv_rows")
            .select("id", { count: "exact", head: true })
            .eq("source", "bankinter-usd")
            .gt("amount", 0)
            .gte("date", "2025-01-01");
        const { count: reconUsd } = await sb.from("csv_rows")
            .select("id", { count: "exact", head: true })
            .eq("source", "bankinter-usd")
            .gt("amount", 0)
            .eq("reconciled", true)
            .gte("date", "2025-01-01");
        console.log(`  Total: ${totalUsd}, Reconciled: ${reconUsd} (${((reconUsd / totalUsd) * 100).toFixed(1)}%)`);
        bkUsd.forEach(r => {
            console.log(`    ${r.date} | ${r.amount} | "${r.description?.substring(0, 50)}" | recon=${r.reconciled}`);
        });
    } else {
        console.log("  No bankinter-usd credit entries in 2025");
    }

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  DEEP DIVE #2 COMPLETE");
    console.log("═══════════════════════════════════════════════════════");
}

run().catch(console.error);
