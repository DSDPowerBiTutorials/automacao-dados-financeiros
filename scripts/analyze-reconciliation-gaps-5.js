#!/usr/bin/env node
/**
 * Deep dive #5: Check all data sources, PayPal CSV data, and build final strategy
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchAll(baseQuery) {
    let all = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
        const { data, error } = await baseQuery.range(from, from + PAGE - 1);
        if (error) { console.error("Error:", error.message); break; }
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
    }
    return all;
}

async function run() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  DEEP DIVE #5 — ALL SOURCES + PAYPAL CSV + STRATEGY");
    console.log("═══════════════════════════════════════════════════════\n");

    // =============================================
    // 1. ALL SOURCES IN SYSTEM
    // =============================================
    console.log("📊 1. ALL SOURCES IN csv_rows");
    console.log("──────────────────────────────");

    // Get distinct sources
    const { data: allRows } = await sb.from("csv_rows")
        .select("source")
        .limit(50000);

    const sources = {};
    if (allRows) {
        for (const r of allRows) {
            sources[r.source] = (sources[r.source] || 0) + 1;
        }
    }

    Object.entries(sources).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => {
        console.log(`  ${s}: ${c} rows`);
    });

    // =============================================
    // 2. PAYPAL SOURCE DATA
    // =============================================
    console.log("\n\n📊 2. PAYPAL SOURCE DATA");
    console.log("────────────────────────");

    const ppRows = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description, custom_data")
            .eq("source", "paypal")
            .order("date")
    );

    console.log(`  paypal source rows: ${ppRows.length}`);

    if (ppRows.length > 0) {
        console.log(`  Date range: ${ppRows[0].date} to ${ppRows[ppRows.length - 1].date}`);

        // Show first 5 rows with full details
        console.log(`\n  Sample rows:`);
        for (const r of ppRows.slice(0, 5)) {
            const cd = r.custom_data || {};
            console.log(`\n    Date: ${r.date} | Amount: ${r.amount} | Desc: "${String(r.description).substring(0, 60)}"`);
            console.log(`    custom_data keys: ${Object.keys(cd).join(", ")}`);
            console.log(`    Full custom_data: ${JSON.stringify(cd).substring(0, 500)}`);
        }

        // Monthly distribution
        const monthly = {};
        for (const r of ppRows) {
            const m = r.date?.substring(0, 7) || "?";
            monthly[m] = (monthly[m] || 0) + 1;
        }
        console.log(`\n  Monthly distribution:`);
        Object.entries(monthly).sort().forEach(([m, c]) => console.log(`    ${m}: ${c}`));

        // Positive amounts (credits/income)
        const credits = ppRows.filter(r => parseFloat(r.amount) > 0);
        const debits = ppRows.filter(r => parseFloat(r.amount) < 0);
        console.log(`\n  Credits (positive): ${credits.length}`);
        console.log(`  Debits (negative): ${debits.length}`);

        // Look for disbursement/payout patterns
        const types = {};
        for (const r of ppRows) {
            const cd = r.custom_data || {};
            const type = cd.type || cd.Tipo || cd.tipo || String(r.description).substring(0, 20);
            types[type] = (types[type] || 0) + 1;
        }
        console.log(`\n  Types/descriptions: ${JSON.stringify(types)}`);

        // Total amounts
        const totalCredits = credits.reduce((s, r) => s + parseFloat(r.amount), 0);
        const totalDebits = debits.reduce((s, r) => s + parseFloat(r.amount), 0);
        console.log(`\n  Total credits: ${totalCredits.toFixed(2)}`);
        console.log(`  Total debits: ${totalDebits.toFixed(2)}`);

        // Look for payout/withdrawal entries
        const payouts = ppRows.filter(r => {
            const d = String(r.description).toLowerCase();
            const cd = r.custom_data || {};
            const t = String(cd.type || cd.Tipo || "").toLowerCase();
            return d.includes("payout") || d.includes("withdrawal") || d.includes("disbursement") ||
                d.includes("bank") || t.includes("payout") || t.includes("withdrawal") ||
                t.includes("retir") || d.includes("retir");
        });

        console.log(`\n  Payout/withdrawal entries: ${payouts.length}`);
        payouts.slice(0, 10).forEach(r => {
            console.log(`    ${r.date} | ${r.amount} | "${String(r.description).substring(0, 60)}"`);
        });
    }

    // =============================================
    // 3. BRAINTREE-TRANSACTIONS SOURCE
    // =============================================
    console.log("\n\n📊 3. BRAINTREE-TRANSACTIONS SOURCE");
    console.log("──────────────────────────────────────");

    const btTxRows = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description, custom_data")
            .eq("source", "braintree-transactions")
            .order("date")
    );

    console.log(`  braintree-transactions rows: ${btTxRows.length}`);
    if (btTxRows.length > 0) {
        console.log(`  Date range: ${btTxRows[0].date} to ${btTxRows[btTxRows.length - 1].date}`);

        // Check for PayPal entries here
        const ppInBtTx = btTxRows.filter(r => {
            const cd = r.custom_data || {};
            return String(cd.payment_method || cd.payment_instrument_type || r.description || "").toLowerCase().includes("paypal");
        });
        console.log(`  PayPal entries in braintree-transactions: ${ppInBtTx.length}`);

        // Monthly
        const monthly = {};
        for (const r of btTxRows) {
            const m = r.date?.substring(0, 7) || "?";
            monthly[m] = (monthly[m] || 0) + 1;
        }
        console.log(`  Monthly: ${JSON.stringify(monthly)}`);

        // Sample
        if (btTxRows.length > 0) {
            const r = btTxRows[0];
            console.log(`\n  Sample row:`);
            console.log(`    ${r.date} | ${r.amount} | "${String(r.description).substring(0, 60)}"`);
            console.log(`    custom_data: ${JSON.stringify(r.custom_data).substring(0, 1000)}`);
        }
    }

    // =============================================
    // 4. BRAINTREE EUR/USD SOURCES
    // =============================================
    console.log("\n\n📊 4. BRAINTREE-EUR / BRAINTREE-USD");
    console.log("──────────────────────────────────────");

    for (const src of ["braintree-eur", "braintree-usd"]) {
        const rows = await fetchAll(
            sb.from("csv_rows")
                .select("id, date, amount, description, custom_data")
                .eq("source", src)
                .order("date")
        );
        console.log(`\n  ${src}: ${rows.length} rows`);
        if (rows.length > 0) {
            console.log(`  Date range: ${rows[0].date} to ${rows[rows.length - 1].date}`);

            // Look for disbursement entries
            const disbEntries = rows.filter(r => {
                const cd = r.custom_data || {};
                return cd.record_type === "DD" || cd.record_type === "DT" ||
                    String(r.description).toLowerCase().includes("disbursement") ||
                    cd.disbursement_date;
            });
            console.log(`  Disbursement entries: ${disbEntries.length}`);

            // Look for PayPal in these sources
            const ppEntries = rows.filter(r => {
                const cd = r.custom_data || {};
                return String(cd.payment_instrument_type || cd.payment_method || r.description || "").toLowerCase().includes("paypal");
            });
            console.log(`  PayPal entries: ${ppEntries.length}`);
            if (ppEntries.length > 0) {
                ppEntries.slice(0, 3).forEach(r => {
                    const cd = r.custom_data || {};
                    console.log(`    ${r.date} | ${r.amount} | "${String(r.description).substring(0, 50)}" | payment_instrument=${cd.payment_instrument_type}`);
                });
            }

            // Sample
            if (rows.length > 0) {
                const r = rows[0];
                console.log(`\n  Sample row custom_data keys: ${Object.keys(r.custom_data || {}).join(", ")}`);
            }
        }
    }

    // =============================================
    // 5. PAYPAL BANK ENTRIES — DISBURSEMENT DATE PATTERN
    // =============================================
    console.log("\n\n📊 5. PAYPAL BANK ENTRIES — PATTERN BY DATE");
    console.log("──────────────────────────────────────────────");

    const ppBank = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description, custom_data")
            .eq("source", "bankinter-eur")
            .gt("amount", 0)
            .ilike("description", "%paypal%")
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .order("date")
    );

    // Frequency analysis: how many PayPal entries per day?
    const byDate = {};
    for (const r of ppBank) {
        const d = r.date?.substring(0, 10) || "?";
        if (!byDate[d]) byDate[d] = { count: 0, total: 0, amounts: [] };
        byDate[d].count++;
        byDate[d].total += parseFloat(r.amount);
        byDate[d].amounts.push(parseFloat(r.amount));
    }

    console.log(`  PayPal entries by date (first 30 dates):`);
    const dates = Object.entries(byDate).sort();
    dates.slice(0, 30).forEach(([d, info]) => {
        console.log(`    ${d}: ${info.count} entries, total=${info.total.toFixed(2)}, amounts=[${info.amounts.map(a => a.toFixed(2)).join(", ")}]`);
    });

    // Typical number of entries per day
    const entriesPerDay = Object.values(byDate).map(v => v.count);
    console.log(`\n  Entries per day: min=${Math.min(...entriesPerDay)}, max=${Math.max(...entriesPerDay)}, avg=${(entriesPerDay.reduce((s, v) => s + v, 0) / entriesPerDay.length).toFixed(1)}`);

    // =============================================
    // 6. RECONCILED PAYPAL - ARE THEY TRULY MATCHED?
    // =============================================
    console.log("\n\n📊 6. RECONCILED PAYPAL — QUALITY CHECK");
    console.log("────────────────────────────────────────");

    const ppRecon = ppBank.filter(r => r.reconciled !== false);
    // Wait, we don't have reconciled field in this query. Let me re-query.
    const { data: ppReconRows } = await sb.from("csv_rows")
        .select("id, date, amount, description, reconciled, custom_data, matched_with")
        .eq("source", "bankinter-eur")
        .eq("reconciled", true)
        .gt("amount", 0)
        .ilike("description", "%paypal%")
        .gte("date", "2025-01-01")
        .lte("date", "2025-12-31")
        .order("date")
        .limit(1000);

    console.log(`  Reconciled PayPal entries: ${ppReconRows?.length || 0}`);

    if (ppReconRows && ppReconRows.length > 0) {
        // Check date quality of matches
        let goodDateMatch = 0, badDateMatch = 0;
        for (const r of ppReconRows) {
            const cd = r.custom_data || {};
            if (cd.disbursement_date) {
                const bankDate = new Date(r.date);
                const disbDate = new Date(cd.disbursement_date);
                const daysDiff = Math.abs(Math.round((bankDate - disbDate) / (1000 * 60 * 60 * 24)));
                if (daysDiff <= 14) goodDateMatch++;
                else badDateMatch++;
            }
        }
        console.log(`  Date quality: ${goodDateMatch} good (≤14d), ${badDateMatch} bad (>14d)`);
        console.log(`  → ${badDateMatch > 0 ? "⚠️ BAD MATCHES EXIST — wrong disbursement dates" : "✅ All dates reasonable"}`);
    }

    // =============================================
    // 7. FINAL SUMMARY
    // =============================================
    console.log("\n\n═══════════════════════════════════════════════════════");
    console.log("  SUMMARY & STRATEGY RECOMMENDATIONS");
    console.log("═══════════════════════════════════════════════════════");

    console.log(`
  BANKINTER-EUR 2025 Credits: 1170 entries, €6,020,982
  Currently reconciled: 657 (62.2%)
  Currently unreconciled: 513 (37.8%)

  UNRECONCILED BREAKDOWN:
  ┌──────────────────┬───────┬──────────────┬─────────────────────────────────────┐
  │ Category         │ Count │ Amount       │ Strategy                            │
  ├──────────────────┼───────┼──────────────┼─────────────────────────────────────┤
  │ PayPal           │ 253   │ €1,453,678   │ Need PayPal settlement/payout data  │
  │ AMEX             │ 82    │ €273,940     │ Fix AMEX disbursement matching      │
  │ Wire transfers   │ 130   │ €285,862     │ Match vs AR invoices/GoCardless     │  
  │ Stripe           │ 16    │ €75,859      │ Tune Stripe matching tolerances     │
  │ Abono remesa     │ 29    │ €75,141      │ Match vs GoCardless/direct debit    │
  │ GoCardless       │ 3     │ €10,317      │ Minor fix                           │
  └──────────────────┴───────┴──────────────┴─────────────────────────────────────┘

  DATA AVAILABILITY:
  - braintree-api-revenue: 6418 rows (Jan 2024-Jan 2026) — GOOD for CC
  - braintree-api-revenue PayPal txs: 213 (only 3.1% coverage) — CRITICAL GAP
  - braintree-amex: 1322 rows (Jan 2025-Jan 2026) — GOOD
  - paypal source: check below
  - braintree-eur/usd: check below
  `);

    console.log("═══════════════════════════════════════════════════════");
}

run().catch(console.error);
