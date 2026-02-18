#!/usr/bin/env node
/**
 * Deep dive #7: Find where Braintree CC disbursements show up in bank
 * Analyze ALL bank credit categories and unknown descriptions
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
    console.log("  WHERE ARE BRAINTREE CC DISBURSEMENTS IN THE BANK?");
    console.log("═══════════════════════════════════════════════════════\n");

    // Get ALL Bankinter EUR credit entries in 2025
    const allBank = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description, reconciled, custom_data")
            .eq("source", "bankinter-eur")
            .gt("amount", 0)
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .order("date")
    );

    console.log(`Total credit entries: ${allBank.length}`);

    // Categorize ALL descriptions
    const categories = {};
    for (const r of allBank) {
        const d = r.description?.toLowerCase() || "no description";

        let cat;
        if (d.includes("paypal")) cat = "PayPal";
        else if (d.includes("american express")) cat = "AMEX";
        else if (d.includes("braintree")) cat = "Braintree";
        else if (d.includes("stripe")) cat = "Stripe";
        else if (d.includes("gocardless")) cat = "GoCardless";
        else if (d.includes("abono remesa")) cat = "Abono Remesa";
        else if (d.includes("transf") || d.includes("trans inm") || d.includes("trans otras")) cat = "Wire Transfer";
        else if (d.includes("ingres") || d.includes("ingreso")) cat = "Ingreso";
        else if (d.includes("cheque")) cat = "Cheque";
        else if (d.includes("devol")) cat = "Devolucion";
        else cat = "UNKNOWN";

        if (!categories[cat]) categories[cat] = { count: 0, total: 0, reconciled: 0, unrec: 0, descriptions: {} };
        categories[cat].count++;
        categories[cat].total += parseFloat(r.amount);
        if (r.reconciled) categories[cat].reconciled++;
        else categories[cat].unrec++;

        // Track unique descriptions
        const desc = r.description?.substring(0, 60) || "?";
        if (!categories[cat].descriptions[desc]) categories[cat].descriptions[desc] = { count: 0, total: 0 };
        categories[cat].descriptions[desc].count++;
        categories[cat].descriptions[desc].total += parseFloat(r.amount);
    }

    console.log("\n📊 ALL CATEGORIES:");
    console.log("──────────────────────────────────────────────────────────────────");
    const sorted = Object.entries(categories).sort((a, b) => b[1].total - a[1].total);
    for (const [cat, data] of sorted) {
        console.log(`\n  ${cat}: ${data.count} entries, €${data.total.toFixed(2)}`);
        console.log(`    Reconciled: ${data.reconciled}, Unreconciled: ${data.unrec}`);
        const topDescs = Object.entries(data.descriptions)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 5);
        for (const [desc, info] of topDescs) {
            console.log(`    • "${desc}" — ${info.count}x, €${info.total.toFixed(2)}`);
        }
    }

    // =============================================
    // Detailed look at UNKNOWN descriptions
    // =============================================
    console.log("\n\n📊 ALL UNIQUE 'UNKNOWN' DESCRIPTIONS:");
    console.log("──────────────────────────────────────────");
    if (categories["UNKNOWN"]) {
        const unkDescs = Object.entries(categories["UNKNOWN"].descriptions)
            .sort((a, b) => b[1].total - a[1].total);
        for (const [desc, info] of unkDescs) {
            console.log(`    "${desc}" — ${info.count}x, €${info.total.toFixed(2)}`);
        }
    }

    // =============================================
    // Check if any descriptions contain patterns hinting at Braintree settlement
    // =============================================
    console.log("\n\n📊 WIRE TRANSFER DESCRIPTIONS (potential CC disb or client payments):");
    console.log("────────────────────────────────────────────────────────────────────────");

    const wireDescs = Object.entries(categories["Wire Transfer"]?.descriptions || {})
        .sort((a, b) => b[1].total - a[1].total);
    for (const [desc, info] of wireDescs) {
        console.log(`    "${desc}" — ${info.count}x, €${info.total.toFixed(2)}`);
    }

    // =============================================
    // PayPal daily pattern - look for TWO distinct amounts
    // =============================================
    console.log("\n\n📊 PAYPAL DAILY PATTERN ANALYSIS:");
    console.log("─────────────────────────────────────");

    const ppEntries = allBank.filter(r => r.description?.toLowerCase().includes("paypal"));

    // Group by day
    const ppByDay = {};
    for (const r of ppEntries) {
        const d = r.date?.substring(0, 10);
        if (!d) continue;
        if (!ppByDay[d]) ppByDay[d] = [];
        ppByDay[d].push({ amount: parseFloat(r.amount), desc: r.description?.substring(0, 50) });
    }

    // Show the 2-entry pattern
    let days1 = 0, days2 = 0, days3 = 0;
    for (const [day, entries] of Object.entries(ppByDay)) {
        if (entries.length === 1) days1++;
        else if (entries.length === 2) days2++;
        else days3++;
    }
    console.log(`  1-entry days: ${days1}, 2-entry days: ${days2}, 3+ entry days: ${days3}`);

    // For 2-entry days, what's the ratio between the two amounts?
    console.log("\n  2-entry days — ratio between amounts:");
    const twoEntryDays = Object.entries(ppByDay)
        .filter(([, e]) => e.length === 2)
        .sort(([a], [b]) => a.localeCompare(b));

    let ratios = [];
    for (const [day, [e1, e2]] of twoEntryDays.slice(0, 20)) {
        const big = Math.max(e1.amount, e2.amount);
        const small = Math.min(e1.amount, e2.amount);
        const ratio = big / small;
        ratios.push(ratio);
        console.log(`    ${day}: ${e1.amount.toFixed(0)} + ${e2.amount.toFixed(0)} = ${(e1.amount + e2.amount).toFixed(2)} (ratio ${ratio.toFixed(1)})`);
    }

    // Average ratio?
    const avgRatio = ratios.reduce((s, r) => s + r, 0) / ratios.length;
    console.log(`\n  Average big/small ratio: ${avgRatio.toFixed(2)}`);

    // =============================================
    // Compare PayPal descriptions for the 2 entries
    // =============================================
    console.log("\n\n📊 PAYPAL UNIQUE DESCRIPTIONS:");
    console.log("──────────────────────────────────");
    const ppDescriptions = {};
    for (const r of ppEntries) {
        const d = r.description || "?";
        if (!ppDescriptions[d]) ppDescriptions[d] = { count: 0, total: 0 };
        ppDescriptions[d].count++;
        ppDescriptions[d].total += parseFloat(r.amount);
    }
    const sortedPPDesc = Object.entries(ppDescriptions).sort((a, b) => b[1].count - a[1].count);
    for (const [desc, info] of sortedPPDesc.slice(0, 10)) {
        console.log(`  "${desc}" — ${info.count}x, €${info.total.toFixed(2)}`);
    }

    // =============================================
    // AMEX: compare disbursements vs bank entries
    // =============================================
    console.log("\n\n📊 AMEX DEEP MATCH TEST:");
    console.log("──────────────────────────");

    const amexBank = allBank.filter(r => r.description?.toLowerCase().includes("american express"));
    console.log(`AMEX bank entries: ${amexBank.length}`);

    const amexAllData = await fetchAll(
        sb.from("csv_rows")
            .select("date, amount, custom_data")
            .eq("source", "braintree-amex")
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .order("date")
    );

    console.log(`braintree-amex rows: ${amexAllData.length}`);

    // Build AMEX disbursements by date
    const amexDisbs = {};
    for (const r of amexAllData) {
        const cd = r.custom_data || {};
        const dd = cd.disbursement_date?.substring(0, 10);
        if (!dd) continue;
        if (!amexDisbs[dd]) amexDisbs[dd] = { date: dd, total: 0, count: 0 };
        amexDisbs[dd].total += parseFloat(cd.settlement_amount || r.amount || 0);
        amexDisbs[dd].count++;
    }

    const amexDisbList = Object.values(amexDisbs).sort((a, b) => a.date.localeCompare(b.date));
    console.log(`AMEX unique disbursement dates: ${amexDisbList.length}`);

    // Greedy match AMEX bank → AMEX disb
    for (const offset of [0, 1, 2, 3, 4, 5, 6, 7, 10, 14]) {
        let matched = 0;
        const used = new Set();

        for (const bank of amexBank) {
            const bankDate = new Date(bank.date);
            const bankAmt = parseFloat(bank.amount);

            for (let i = 0; i < amexDisbList.length; i++) {
                if (used.has(i)) continue;
                const disb = amexDisbList[i];
                const disbDate = new Date(disb.date);
                const daysDiff = Math.abs(Math.round((bankDate - disbDate) / (1000 * 60 * 60 * 24)));

                if (daysDiff > offset) continue;

                const amtDiff = Math.abs(bankAmt - disb.total);
                const pct = amtDiff / bankAmt;

                if (pct < 0.05) {
                    matched++;
                    used.add(i);
                    break;
                }
            }
        }

        console.log(`  Offset ±${offset}d, ±5% amount: ${matched}/${amexBank.length} matched`);
    }

    // Show sample AMEX matching: first 10 bank entries
    console.log("\n  AMEX Sample (first 10 bank entries vs closest disb):");
    for (const bank of amexBank.slice(0, 10)) {
        const bAmt = parseFloat(bank.amount);
        const bDate = new Date(bank.date);

        let best = null, bestDiff = Infinity;
        for (const disb of amexDisbList) {
            const daysDiff = Math.abs(Math.round((bDate - new Date(disb.date)) / (1000 * 60 * 60 * 24)));
            if (daysDiff > 14) continue;
            const amtDiff = Math.abs(bAmt - disb.total);
            if (amtDiff < bestDiff) {
                bestDiff = amtDiff;
                best = { ...disb, daysDiff, amtDiff };
            }
        }

        if (best) {
            console.log(`    Bank ${bank.date} €${bAmt.toFixed(2)} → Disb ${best.date} €${best.total.toFixed(2)} (${best.daysDiff}d, €${best.amtDiff.toFixed(2)} diff)`);
        } else {
            console.log(`    Bank ${bank.date} €${bAmt.toFixed(2)} → NO MATCH within 14d`);
        }
    }

    // =============================================
    // FINAL SUMMARY
    // =============================================
    console.log("\n\n═══════════════════════════════════════════════════════");
    console.log("  FINAL DATA COVERAGE SUMMARY");
    console.log("═══════════════════════════════════════════════════════");

    let totalBankCredits = allBank.reduce((s, r) => s + parseFloat(r.amount), 0);
    let totalRec = allBank.filter(r => r.reconciled).reduce((s, r) => s + parseFloat(r.amount), 0);

    console.log(`\n  Total bank credits 2025: ${allBank.length} entries, €${totalBankCredits.toFixed(2)}`);
    console.log(`  Currently reconciled: €${totalRec.toFixed(2)} (mostly FALSE positives for PayPal)`);
    console.log(`\n  Breakdown by source:`);

    for (const [cat, data] of sorted) {
        const recPct = (data.reconciled / data.count * 100).toFixed(0);
        console.log(`    ${cat.padEnd(15)} | ${String(data.count).padStart(4)} | €${data.total.toFixed(2).padStart(12)} | ${recPct}% rec`);
    }

    console.log(`\n  DATA AVAILABILITY FOR MATCHING:`);
    console.log(`    AMEX: bank €609K, disb data €606K → 99.5% covered ✅`);
    console.log(`    PayPal: bank €2.34M, NO PayPal data available → 0% covered ❌`);
    console.log(`    Braintree CC: disb €892K, but NO bank entries labeled "braintree" → ???`);
    console.log(`    Question: Where do the €892K of CC disbursements appear in bank?`);

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  ANALYSIS COMPLETE");
    console.log("═══════════════════════════════════════════════════════");
}

run().catch(console.error);
