#!/usr/bin/env node
/**
 * Deep dive #6: Test theory that "PayPal bank entries" = Braintree CC disbursements settled via PayPal entity
 * Also validate amount correlation between CC disbursements and PayPal bank entries
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
    console.log("  HYPOTHESIS TEST: PayPal bank = Braintree CC disbursements");
    console.log("═══════════════════════════════════════════════════════\n");

    // Get ALL braintree-api-revenue for 2025
    const btAll = await fetchAll(
        sb.from("csv_rows")
            .select("date, amount, description, custom_data")
            .eq("source", "braintree-api-revenue")
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .order("date")
    );

    console.log(`BT API Revenue 2025: ${btAll.length} rows`);

    // Split by payment type
    const cc = [], pp = [], amex = [];
    for (const r of btAll) {
        const cd = r.custom_data || {};
        const pm = String(cd.payment_method || "").toLowerCase();
        const ct = String(cd.card_type || "").toLowerCase();
        const desc = String(r.description || "").toLowerCase();

        if (pm.includes("paypal") || desc.includes("paypal")) pp.push(r);
        else if (ct.includes("american express") || ct.includes("amex")) amex.push(r);
        else cc.push(r);
    }

    console.log(`  CC: ${cc.length}, PayPal: ${pp.length}, AMEX: ${amex.length}`);

    // Build CC EUR disbursements
    const ccEurDisbs = {};
    for (const r of cc) {
        const cd = r.custom_data || {};
        const ma = cd.merchant_account_id || "";
        if (ma.includes("USD")) continue;
        const dd = cd.disbursement_date?.substring(0, 10);
        if (!dd) continue;
        if (!ccEurDisbs[dd]) ccEurDisbs[dd] = { date: dd, total: 0, count: 0, txIds: [] };
        ccEurDisbs[dd].total += parseFloat(cd.settlement_amount || r.amount || 0);
        ccEurDisbs[dd].count++;
        if (cd.transaction_id) ccEurDisbs[dd].txIds.push(cd.transaction_id);
    }

    const ccList = Object.values(ccEurDisbs).sort((a, b) => a.date.localeCompare(b.date));
    console.log(`\nCC EUR disbursements: ${ccList.length}`);

    // Get ALL Bankinter EUR PayPal bank entries
    const ppBankAll = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description, reconciled, custom_data")
            .eq("source", "bankinter-eur")
            .gt("amount", 0)
            .ilike("description", "%paypal%")
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .order("date")
    );

    console.log(`PayPal bank entries: ${ppBankAll.length}`);

    // =============================================
    // TEST 1: Monthly totals comparison
    // =============================================
    console.log("\n\n📊 TEST 1: Monthly totals — PayPal bank vs CC EUR disbursements");
    console.log("────────────────────────────────────────────────────────────────");

    const bankMonthly = {};
    for (const r of ppBankAll) {
        const m = r.date?.substring(0, 7);
        if (!m) continue;
        if (!bankMonthly[m]) bankMonthly[m] = 0;
        bankMonthly[m] += parseFloat(r.amount);
    }

    const disbMonthly = {};
    for (const d of ccList) {
        const m = d.date.substring(0, 7);
        if (!disbMonthly[m]) disbMonthly[m] = 0;
        disbMonthly[m] += d.total;
    }

    const months = [...new Set([...Object.keys(bankMonthly), ...Object.keys(disbMonthly)])].sort();
    console.log("  Month     | PayPal Bank  | CC Disb EUR   | Ratio");
    console.log("  ──────────┼──────────────┼───────────────┼──────");
    let totalBank = 0, totalDisb = 0;
    for (const m of months) {
        const b = bankMonthly[m] || 0;
        const d = disbMonthly[m] || 0;
        const ratio = d > 0 ? (b / d * 100).toFixed(1) : "N/A";
        totalBank += b;
        totalDisb += d;
        console.log(`  ${m}  | ${b.toFixed(2).padStart(12)} | ${d.toFixed(2).padStart(13)} | ${ratio}%`);
    }
    console.log(`  ──────────┼──────────────┼───────────────┼──────`);
    console.log(`  TOTAL     | ${totalBank.toFixed(2).padStart(12)} | ${totalDisb.toFixed(2).padStart(13)} | ${(totalBank / totalDisb * 100).toFixed(1)}%`);

    // =============================================
    // TEST 2: ALL BT EUR disbursements (regardless of payment type)
    // =============================================
    console.log("\n\n📊 TEST 2: ALL BT EUR disbursements (CC+PayPal+AMEX)");
    console.log("────────────────────────────────────────────────────────");

    const allEurDisbs = {};
    for (const r of btAll) {
        const cd = r.custom_data || {};
        const ma = cd.merchant_account_id || "";
        if (ma.includes("USD")) continue;
        const dd = cd.disbursement_date?.substring(0, 10);
        if (!dd) continue;
        if (!allEurDisbs[dd]) allEurDisbs[dd] = { date: dd, total: 0, count: 0, txIds: [] };
        allEurDisbs[dd].total += parseFloat(cd.settlement_amount || r.amount || 0);
        allEurDisbs[dd].count++;
        if (cd.transaction_id) allEurDisbs[dd].txIds.push(cd.transaction_id);
    }

    const allList = Object.values(allEurDisbs).sort((a, b) => a.date.localeCompare(b.date));

    const allDisbMonthly = {};
    for (const d of allList) {
        const m = d.date.substring(0, 7);
        if (!allDisbMonthly[m]) allDisbMonthly[m] = 0;
        allDisbMonthly[m] += d.total;
    }

    let totalAllDisb = 0;
    console.log("  Month     | PayPal Bank  | ALL BT Disb   | Ratio");
    console.log("  ──────────┼──────────────┼───────────────┼──────");
    for (const m of months) {
        const b = bankMonthly[m] || 0;
        const d = allDisbMonthly[m] || 0;
        totalAllDisb += d;
        const ratio = d > 0 ? (b / d * 100).toFixed(1) : "N/A";
        console.log(`  ${m}  | ${b.toFixed(2).padStart(12)} | ${d.toFixed(2).padStart(13)} | ${ratio}%`);
    }
    console.log(`  TOTAL     | ${totalBank.toFixed(2).padStart(12)} | ${totalAllDisb.toFixed(2).padStart(13)} | ${(totalBank / totalAllDisb * 100).toFixed(1)}%`);

    // =============================================
    // TEST 3: ALL bank entries (PayPal + AMEX + other) vs ALL disbursements
    // =============================================
    console.log("\n\n📊 TEST 3: ALL gateway bank entries vs ALL BT EUR disbursements");
    console.log("─────────────────────────────────────────────────────────────────");

    const allGatewayBank = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description, reconciled, custom_data")
            .eq("source", "bankinter-eur")
            .gt("amount", 0)
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .order("date")
    );

    // Split bank by category
    const bankPP = [], bankAMEX = [], bankBT = [], bankOther = [];
    for (const r of allGatewayBank) {
        const d = r.description?.toLowerCase() || "";
        if (d.includes("paypal")) bankPP.push(r);
        else if (d.includes("american express")) bankAMEX.push(r);
        else if (d.includes("braintree")) bankBT.push(r);
        else bankOther.push(r);
    }

    console.log(`  Bank PP: ${bankPP.length}, AMEX: ${bankAMEX.length}, BT: ${bankBT.length}, Other: ${bankOther.length}`);

    const ppTotal = bankPP.reduce((s, r) => s + parseFloat(r.amount), 0);
    const amexTotal = bankAMEX.reduce((s, r) => s + parseFloat(r.amount), 0);
    const btTotal = bankBT.reduce((s, r) => s + parseFloat(r.amount), 0);

    console.log(`  Bank PayPal total: ${ppTotal.toFixed(2)}`);
    console.log(`  Bank AMEX total: ${amexTotal.toFixed(2)}`);
    console.log(`  Bank BT total: ${btTotal.toFixed(2)}`);
    console.log(`  Bank PP+AMEX: ${(ppTotal + amexTotal).toFixed(2)}`);
    console.log(`  Bank PP+AMEX+BT: ${(ppTotal + amexTotal + btTotal).toFixed(2)}`);
    console.log(`  ALL BT EUR disbursements: ${totalAllDisb.toFixed(2)}`);

    // Also get AMEX-specific disbursements  
    const amexAll = await fetchAll(
        sb.from("csv_rows")
            .select("date, amount, custom_data")
            .eq("source", "braintree-amex")
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .order("date")
    );

    const amexEurDisbs = {};
    for (const r of amexAll) {
        const cd = r.custom_data || {};
        const dd = cd.disbursement_date?.substring(0, 10);
        if (!dd) continue;
        if (!amexEurDisbs[dd]) amexEurDisbs[dd] = { date: dd, total: 0, count: 0, txIds: [] };
        amexEurDisbs[dd].total += parseFloat(cd.settlement_amount || r.amount || 0);
        amexEurDisbs[dd].count++;
    }
    const amexDisbTotal = Object.values(amexEurDisbs).reduce((s, d) => s + d.total, 0);
    console.log(`\n  AMEX source disbursements total: ${amexDisbTotal.toFixed(2)}`);
    console.log(`  Combined BT API + AMEX disb: ${(totalAllDisb + amexDisbTotal).toFixed(2)}`);

    // =============================================
    // TEST 4: Greedy 1:1 matching PP bank ↔ CC disb
    // =============================================
    console.log("\n\n📊 TEST 4: GREEDY MATCHING — PayPal bank ↔ CC EUR disbursements");
    console.log("─────────────────────────────────────────────────────────────────");

    // Sort both by date
    const sortedPP = [...ppBankAll].sort((a, b) => a.date.localeCompare(b.date));

    // For multiple offsets, test bank_date - offset = disb_date
    // Theory: PayPal disburses X days after Braintree settlement

    for (const offset of [0, 1, 2, 3, 4, 5, 6, 7]) {
        let matched = 0;
        const used = new Set();

        for (const bank of sortedPP) {
            const bankDate = new Date(bank.date);
            const bankAmt = parseFloat(bank.amount);
            const targetDate = new Date(bankDate);
            targetDate.setDate(targetDate.getDate() - offset);
            const targetDateStr = targetDate.toISOString().substring(0, 10);

            // Find disbursement on target date
            for (let i = 0; i < ccList.length; i++) {
                if (used.has(i)) continue;
                const disb = ccList[i];

                // Check date within ±1 day of target
                const disbDate = new Date(disb.date);
                const daysDiff = Math.abs(Math.round((new Date(targetDateStr) - disbDate) / (1000 * 60 * 60 * 24)));
                if (daysDiff > 1) continue;

                const amtDiff = Math.abs(bankAmt - disb.total);
                const pct = amtDiff / bankAmt;

                if (pct < 0.03) {
                    matched++;
                    used.add(i);
                    break;
                }
            }
        }

        console.log(`  Offset ${offset}d (±1d tolerance, ±3% amount): ${matched}/${sortedPP.length} (${(matched / sortedPP.length * 100).toFixed(1)}%)`);
    }

    // =============================================
    // TEST 5: EXACT day-by-day matching for a specific month
    // =============================================
    console.log("\n\n📊 TEST 5: DAILY AMOUNTS — January 2025");
    console.log("──────────────────────────────────────────");

    // Bank PayPal entries by day
    const janPP = sortedPP.filter(r => r.date >= "2025-01-01" && r.date < "2025-02-01");
    const janByDate = {};
    for (const r of janPP) {
        const d = r.date?.substring(0, 10);
        if (!janByDate[d]) janByDate[d] = { bankAmounts: [], bankTotal: 0 };
        janByDate[d].bankAmounts.push(parseFloat(r.amount));
        janByDate[d].bankTotal += parseFloat(r.amount);
    }

    // CC EUR disbursements by day
    const janCC = ccList.filter(d => d.date >= "2025-01-01" && d.date < "2025-02-01");
    const janCCByDate = {};
    for (const d of janCC) {
        janCCByDate[d.date] = d;
    }

    console.log("  Date       | Bank PP amounts                    | CC Disb EUR    | Match?");
    console.log("  ───────────┼────────────────────────────────────┼────────────────┼──────");

    const allDays = [...new Set([...Object.keys(janByDate), ...Object.keys(janCCByDate)])].sort();
    for (const day of allDays) {
        const b = janByDate[day];
        const d = janCCByDate[day];
        const bankStr = b ? b.bankAmounts.map(a => a.toFixed(0)).join("+") + `=${b.bankTotal.toFixed(2)}` : "-";
        const disbStr = d ? `${d.total.toFixed(2)} (${d.count}tx)` : "-";

        let match = "";
        if (b && d) {
            const diff = Math.abs(b.bankTotal - d.total);
            const pct = (diff / b.bankTotal * 100).toFixed(1);
            match = diff < b.bankTotal * 0.05 ? `✅ ${pct}%` : `❌ ${pct}%`;

            // Check individual amounts vs disbursement
            for (const amt of b.bankAmounts) {
                if (Math.abs(amt - d.total) / amt < 0.03) {
                    match += ` (single=${amt.toFixed(0)})`;
                }
            }
        }

        console.log(`  ${day} | ${bankStr.padEnd(34)} | ${disbStr.padEnd(14)} | ${match}`);
    }

    // =============================================
    // TEST 6: Check what "abono remesa" entries are
    // =============================================
    console.log("\n\n📊 TEST 6: ABONO REMESA ANALYSIS");
    console.log("──────────────────────────────────");

    const { data: abonoRows } = await sb.from("csv_rows")
        .select("id, date, amount, description, custom_data")
        .eq("source", "bankinter-eur")
        .eq("reconciled", false)
        .gt("amount", 0)
        .ilike("description", "%abono remesa%")
        .gte("date", "2025-01-01")
        .order("date")
        .limit(30);

    if (abonoRows && abonoRows.length > 0) {
        console.log(`  Abono remesa entries: ${abonoRows.length}`);
        abonoRows.slice(0, 10).forEach(r => {
            const cd = r.custom_data || {};
            console.log(`    ${r.date} | ${r.amount} | "${r.description}" | referencia=${cd.referencia || "?"}`);
        });
    }

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  HYPOTHESIS TEST COMPLETE");
    console.log("═══════════════════════════════════════════════════════");
}

run().catch(console.error);
