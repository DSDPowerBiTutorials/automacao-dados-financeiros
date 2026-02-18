#!/usr/bin/env node
/**
 * Deep dive #8: Test AMEX individual transaction matching
 * Instead of matching aggregated disbursements, match individual AMEX transactions to bank entries
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
    console.log("  AMEX INDIVIDUAL TRANSACTION MATCHING TEST");
    console.log("═══════════════════════════════════════════════════════\n");

    // Get ALL AMEX bank entries (2025)
    const amexBank = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description, reconciled, custom_data")
            .eq("source", "bankinter-eur")
            .gt("amount", 0)
            .ilike("description", "%american express%")
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .order("date")
    );

    console.log(`AMEX bank entries: ${amexBank.length} (rec: ${amexBank.filter(r => r.reconciled).length})`);

    // Get ALL braintree-amex source rows
    const amexTx = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description, custom_data")
            .eq("source", "braintree-amex")
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .order("date")
    );

    console.log(`braintree-amex transactions: ${amexTx.length}`);

    // Show amex tx fields
    if (amexTx.length > 0) {
        const sample = amexTx[0];
        console.log(`\nSample AMEX tx fields: ${Object.keys(sample.custom_data || {}).join(", ")}`);
        console.log(`  date: ${sample.date}, amount: ${sample.amount}`);
        const cd = sample.custom_data || {};
        console.log(`  settlement_amount: ${cd.settlement_amount}`);
        console.log(`  transaction_id: ${cd.transaction_id}`);
        console.log(`  disbursement_date: ${cd.disbursement_date}`);
        console.log(`  card_type: ${cd.card_type}`);
        console.log(`  settlement_date: ${cd.settlement_date}`);
        console.log(`  All fields: ${JSON.stringify(cd).substring(0, 500)}`);
    }

    // =============================================
    // TEST 1: Individual tx amount → bank amount matching
    // =============================================
    console.log("\n\n📊 TEST 1: Individual AMEX tx → bank entry matching by amount");
    console.log("───────────────────────────────────────────────────────────────");

    // Unreconciled AMEX bank entries
    const unrecAmex = amexBank.filter(r => !r.reconciled);
    console.log(`Unreconciled AMEX bank entries: ${unrecAmex.length}`);

    // Build amount index for AMEX transactions
    const txByAmount = {};
    for (const tx of amexTx) {
        const cd = tx.custom_data || {};
        const amt = parseFloat(cd.settlement_amount || tx.amount || 0);
        const key = amt.toFixed(2);
        if (!txByAmount[key]) txByAmount[key] = [];
        txByAmount[key].push(tx);
    }

    // Try exact amount match
    let exactMatches = 0;
    let nearMatches = 0;

    for (const bank of unrecAmex) {
        const bAmt = parseFloat(bank.amount);
        const key = bAmt.toFixed(2);

        if (txByAmount[key] && txByAmount[key].length > 0) {
            exactMatches++;
        } else {
            // Try ±1% tolerance
            for (const tx of amexTx) {
                const cd = tx.custom_data || {};
                const tAmt = parseFloat(cd.settlement_amount || tx.amount || 0);
                if (Math.abs(tAmt - bAmt) / bAmt < 0.01) {
                    nearMatches++;
                    break;
                }
            }
        }
    }

    console.log(`  Exact amount match: ${exactMatches}/${unrecAmex.length}`);
    console.log(`  ±1% amount match: ${exactMatches + nearMatches}/${unrecAmex.length}`);

    // =============================================
    // TEST 2: Group AMEX transactions by settlement_date (not disbursement_date)
    // =============================================
    console.log("\n\n📊 TEST 2: AMEX grouped by SETTLEMENT date vs bank");
    console.log("───────────────────────────────────────────────────");

    const bySettlementDate = {};
    for (const tx of amexTx) {
        const cd = tx.custom_data || {};
        const sd = cd.settlement_date?.substring(0, 10);
        if (!sd) continue;
        if (!bySettlementDate[sd]) bySettlementDate[sd] = { total: 0, count: 0, txs: [] };
        bySettlementDate[sd].total += parseFloat(cd.settlement_amount || tx.amount || 0);
        bySettlementDate[sd].count++;
        bySettlementDate[sd].txs.push(tx);
    }

    console.log(`Unique settlement dates: ${Object.keys(bySettlementDate).length}`);

    // Match settlement_date totals → bank entries
    for (const offset of [0, 1, 2, 3, 5, 7, 10, 14]) {
        let matched = 0;
        const used = new Set();

        for (const bank of amexBank) {
            const bAmt = parseFloat(bank.amount);
            const bDate = new Date(bank.date);

            for (const [sd, data] of Object.entries(bySettlementDate)) {
                if (used.has(sd)) continue;
                const sDate = new Date(sd);
                const daysDiff = Math.abs(Math.round((bDate - sDate) / (1000 * 60 * 60 * 24)));
                if (daysDiff > offset) continue;

                const diff = Math.abs(data.total - bAmt) / bAmt;
                if (diff < 0.05) {
                    matched++;
                    used.add(sd);
                    break;
                }
            }
        }

        console.log(`  Settlement date ±${offset}d, ±5%: ${matched}/${amexBank.length}`);
    }

    // =============================================
    // TEST 3: How many AMEX bank entries per day?
    // =============================================
    console.log("\n\n📊 TEST 3: AMEX bank entries per day pattern");
    console.log("──────────────────────────────────────────────");

    const byDay = {};
    for (const r of amexBank) {
        const d = r.date?.substring(0, 10);
        if (!d) continue;
        if (!byDay[d]) byDay[d] = [];
        byDay[d].push(parseFloat(r.amount));
    }

    const daysCounts = {};
    for (const entries of Object.values(byDay)) {
        const n = entries.length;
        daysCounts[n] = (daysCounts[n] || 0) + 1;
    }

    console.log(`  Days with entries: ${Object.keys(byDay).length}`);
    for (const [n, count] of Object.entries(daysCounts).sort((a, b) => a[0] - b[0])) {
        console.log(`    ${n} entries/day: ${count} days`);
    }

    // =============================================
    // TEST 4: For a specific day, compare AMEX bank amounts vs AMEX tx amounts
    // =============================================
    console.log("\n\n📊 TEST 4: January 2025 — bank AMEX vs tx amounts");
    console.log("───────────────────────────────────────────────────");

    const janBank = Object.entries(byDay)
        .filter(([d]) => d >= "2025-01-01" && d < "2025-02-01")
        .sort(([a], [b]) => a.localeCompare(b));

    for (const [day, amounts] of janBank) {
        const total = amounts.reduce((s, a) => s + a, 0);

        // Find settlements for ±7 days
        let nearSettlements = [];
        for (const [sd, data] of Object.entries(bySettlementDate)) {
            const daysDiff = Math.abs(Math.round((new Date(day) - new Date(sd)) / (1000 * 60 * 60 * 24)));
            if (daysDiff <= 3) {
                nearSettlements.push({ date: sd, total: data.total, count: data.count });
            }
        }

        const nearStr = nearSettlements.map(s => `${s.date}:€${s.total.toFixed(0)}(${s.count}tx)`).join(", ");
        console.log(`  ${day}: bank ${amounts.map(a => a.toFixed(0)).join("+")}=€${total.toFixed(0)} | near settlements: ${nearStr || "none"}`);
    }

    // =============================================
    // TEST 5: Multi-transaction sum matching — can combinations of AMEX txs sum to bank amount?
    // =============================================
    console.log("\n\n📊 TEST 5: SUM OF AMEX txs → bank entry (subset sum)");
    console.log("─────────────────────────────────────────────────────");

    // For each unreconciled AMEX bank entry, find if 1-5 AMEX txs near that date sum to the bank amount
    let sumMatches = 0;
    let singleMatches = 0;

    for (const bank of unrecAmex.slice(0, 30)) {
        const bAmt = parseFloat(bank.amount);
        const bDate = new Date(bank.date);

        // Get AMEX txs within ±14 days
        const nearTxs = amexTx.filter(tx => {
            const cd = tx.custom_data || {};
            const txDate = cd.settlement_date?.substring(0, 10) || cd.disbursement_date?.substring(0, 10) || tx.date;
            if (!txDate) return false;
            const daysDiff = Math.abs(Math.round((bDate - new Date(txDate)) / (1000 * 60 * 60 * 24)));
            return daysDiff <= 14;
        });

        // Check single tx match first
        let found = false;
        for (const tx of nearTxs) {
            const cd = tx.custom_data || {};
            const tAmt = parseFloat(cd.settlement_amount || tx.amount || 0);
            if (Math.abs(tAmt - bAmt) / (bAmt || 1) < 0.01) {
                singleMatches++;
                found = true;
                console.log(`  ✅ SINGLE: Bank ${bank.date} €${bAmt.toFixed(2)} ← Tx €${tAmt.toFixed(2)} (${cd.transaction_id})`);
                break;
            }
        }

        if (!found) {
            // Try 2-tx combinations (limit computation)
            const txAmounts = nearTxs.map(tx => {
                const cd = tx.custom_data || {};
                return parseFloat(cd.settlement_amount || tx.amount || 0);
            }).slice(0, 50);

            let pairFound = false;
            for (let i = 0; i < txAmounts.length && !pairFound; i++) {
                for (let j = i + 1; j < txAmounts.length && !pairFound; j++) {
                    const sum = txAmounts[i] + txAmounts[j];
                    if (Math.abs(sum - bAmt) / (bAmt || 1) < 0.01) {
                        sumMatches++;
                        pairFound = true;
                        console.log(`  ✅ PAIR:   Bank ${bank.date} €${bAmt.toFixed(2)} ← €${txAmounts[i].toFixed(2)} + €${txAmounts[j].toFixed(2)}`);
                    }
                }
            }

            if (!pairFound) {
                console.log(`  ❌ NO MATCH: Bank ${bank.date} €${bAmt.toFixed(2)} (${nearTxs.length} nearby txs)`);
            }
        }
    }

    console.log(`\n  Summary (first 30 unrec): single=${singleMatches}, pairs=${sumMatches}, total=${singleMatches + sumMatches}/30`);

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  AMEX ANALYSIS COMPLETE");
    console.log("═══════════════════════════════════════════════════════");
}

run().catch(console.error);
