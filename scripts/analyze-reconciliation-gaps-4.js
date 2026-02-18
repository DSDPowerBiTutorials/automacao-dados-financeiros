#!/usr/bin/env node
/**
 * Deep dive #4: PayPal synthetic disbursements + full matching solution
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
    console.log("  DEEP DIVE #4 — PAYPAL SYNTHETIC DISBURSEMENTS");
    console.log("═══════════════════════════════════════════════════════\n");

    // =============================================
    // 1. PAYPAL BT ROWS — Field Analysis
    // =============================================
    console.log("📊 1. PAYPAL BT ROWS — FIELD ANALYSIS");
    console.log("──────────────────────────────────────");

    const btAll = await fetchAll(
        sb.from("csv_rows")
            .select("date, amount, description, custom_data")
            .eq("source", "braintree-api-revenue")
            .order("date")
    );

    const paypalTxs = btAll.filter(r => {
        const cd = r.custom_data || {};
        const pm = String(cd.payment_method || "").toLowerCase();
        const desc = String(r.description || "").toLowerCase();
        return pm.includes("paypal") || desc.includes("paypal");
    });

    console.log(`  Total PayPal BT transactions: ${paypalTxs.length}`);

    if (paypalTxs.length > 0) {
        // Show ALL fields and values of first 3
        for (let i = 0; i < Math.min(3, paypalTxs.length); i++) {
            const r = paypalTxs[i];
            const cd = r.custom_data || {};
            console.log(`\n  Row ${i + 1}: ${r.date} | ${r.amount} | "${String(r.description).substring(0, 60)}"`);
            console.log(`    settlement_date: ${cd.settlement_date}`);
            console.log(`    disbursement_date: ${cd.disbursement_date}`);
            console.log(`    disbursement_id: ${cd.disbursement_id}`);
            console.log(`    settlement_amount: ${cd.settlement_amount}`);
            console.log(`    settlement_batch_id: ${cd.settlement_batch_id}`);
            console.log(`    payment_method: ${JSON.stringify(cd.payment_method)}`);
            console.log(`    transaction_id: ${cd.transaction_id}`);
            console.log(`    created_at: ${cd.created_at}`);
            console.log(`    status: ${cd.status}`);
            console.log(`    merchant_account_id: ${cd.merchant_account_id}`);
            console.log(`    amount: ${cd.amount}`);
            console.log(`    currency: ${cd.currency}`);
            console.log(`    status_history: ${JSON.stringify(cd.status_history?.slice(0, 2))}`);
        }

        // Stats: how many have each date field?
        let withSettlementDate = 0, withDisbursementDate = 0, withCreatedAt = 0;
        let withSettlementAmount = 0, withDisbursementId = 0;
        for (const r of paypalTxs) {
            const cd = r.custom_data || {};
            if (cd.settlement_date) withSettlementDate++;
            if (cd.disbursement_date) withDisbursementDate++;
            if (cd.created_at) withCreatedAt++;
            if (cd.settlement_amount) withSettlementAmount++;
            if (cd.disbursement_id) withDisbursementId++;
        }

        console.log(`\n  Field coverage:`);
        console.log(`    settlement_date: ${withSettlementDate}/${paypalTxs.length}`);
        console.log(`    disbursement_date: ${withDisbursementDate}/${paypalTxs.length}`);
        console.log(`    disbursement_id: ${withDisbursementId}/${paypalTxs.length}`);
        console.log(`    settlement_amount: ${withSettlementAmount}/${paypalTxs.length}`);
        console.log(`    created_at: ${withCreatedAt}/${paypalTxs.length}`);
    }

    // =============================================
    // 2. BUILD SYNTHETIC PAYPAL DISBURSEMENTS
    // =============================================
    console.log("\n\n📊 2. SYNTHETIC PAYPAL DISBURSEMENTS");
    console.log("──────────────────────────────────────");

    // Try grouping by settlement_date, then by date, then by created_at
    const groupers = ["settlement_date", "date", "created_at"];

    for (const groupField of groupers) {
        const groups = {};
        for (const r of paypalTxs) {
            const cd = r.custom_data || {};
            let dateVal;
            if (groupField === "date") {
                dateVal = r.date?.substring(0, 10);
            } else if (groupField === "settlement_date") {
                dateVal = cd.settlement_date?.substring(0, 10);
            } else {
                dateVal = cd.created_at?.substring(0, 10);
            }
            if (!dateVal) continue;

            const ma = cd.merchant_account_id || "unknown";
            const key = `${dateVal}|${ma}`;
            if (!groups[key]) groups[key] = { date: dateVal, merchant: ma, total: 0, count: 0, txIds: [] };
            groups[key].total += parseFloat(cd.settlement_amount || r.amount || 0);
            groups[key].count++;
            if (cd.transaction_id) groups[key].txIds.push(cd.transaction_id);
        }

        const disbs = Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
        console.log(`\n  Grouped by ${groupField}: ${disbs.length} disbursements`);

        // Show EUR only
        const eurDisbs = disbs.filter(d => d.merchant?.includes("EUR") || !d.merchant?.includes("USD"));
        console.log(`  EUR disbursements: ${eurDisbs.length}`);
        eurDisbs.slice(0, 15).forEach(d => {
            console.log(`    ${d.date} | ${d.merchant} | ${d.total.toFixed(2)} | ${d.count} txs`);
        });
    }

    // =============================================
    // 3. MATCH PAYPAL BANK ENTRIES VS SYNTHETIC DISBS
    // =============================================
    console.log("\n\n📊 3. MATCHING: PayPal Bank vs Synthetic Disbursements");
    console.log("──────────────────────────────────────────────────────");

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

    const ppBankUnrecon = ppBankAll.filter(r => !r.reconciled);
    console.log(`  PayPal bank entries (unreconciled): ${ppBankUnrecon.length}`);

    // Build synthetic disbursements grouped by settlement_date (most likely)
    // But also try the actual transaction date
    for (const groupField of ["settlement_date", "date"]) {
        const synthDisbs = {};
        for (const r of paypalTxs) {
            const cd = r.custom_data || {};
            let dateVal;
            if (groupField === "date") {
                dateVal = r.date?.substring(0, 10);
            } else {
                dateVal = cd.settlement_date?.substring(0, 10);
            }
            if (!dateVal) continue;

            const ma = cd.merchant_account_id || "unknown";
            const curr = ma.includes("USD") ? "USD" : "EUR";
            if (curr !== "EUR") continue;

            if (!synthDisbs[dateVal]) synthDisbs[dateVal] = { date: dateVal, total: 0, count: 0, txIds: [] };
            synthDisbs[dateVal].total += parseFloat(cd.settlement_amount || r.amount || 0);
            synthDisbs[dateVal].count++;
            if (cd.transaction_id) synthDisbs[dateVal].txIds.push(cd.transaction_id);
        }

        const disbList = Object.values(synthDisbs).sort((a, b) => a.date.localeCompare(b.date));

        // Try matching with different day offsets
        for (const dayOffset of [0, 1, 2, 3, 5, 7, 10, 14]) {
            for (const amtTol of [0.01, 0.03, 0.05]) {
                let matched = 0;
                const used = new Set();

                for (const bank of ppBankUnrecon) {
                    const bankDate = new Date(bank.date);
                    const bankAmt = parseFloat(bank.amount);

                    let bestMatch = null;
                    let bestScore = Infinity;

                    for (let i = 0; i < disbList.length; i++) {
                        if (used.has(i)) continue;
                        const disb = disbList[i];
                        const disbDate = new Date(disb.date);
                        const daysDiff = Math.round((bankDate - disbDate) / (1000 * 60 * 60 * 24));
                        const amtDiff = Math.abs(bankAmt - disb.total);
                        const amtPct = amtDiff / bankAmt;

                        if (Math.abs(daysDiff) <= dayOffset && amtPct < amtTol) {
                            const score = Math.abs(daysDiff) + amtPct * 100;
                            if (score < bestScore) {
                                bestScore = score;
                                bestMatch = { idx: i, disb, daysDiff, amtDiff };
                            }
                        }
                    }

                    if (bestMatch) {
                        matched++;
                        used.add(bestMatch.idx);
                    }
                }

                if (matched > 0) {
                    console.log(`  ${groupField} | ±${dayOffset}d, ±${(amtTol * 100).toFixed(0)}%: ${matched}/${ppBankUnrecon.length} (${(matched / ppBankUnrecon.length * 100).toFixed(1)}%)`);
                }
            }
        }
    }

    // =============================================
    // 4. UNDERSTANDING THE REAL PATTERN
    // =============================================
    console.log("\n\n📊 4. REAL PATTERN: PayPal bank amounts vs ALL possible groupings");
    console.log("───────────────────────────────────────────────────────────────");

    // Maybe PayPal doesn't disburse per-day, but accumulates over several days
    // Let's try cumulative groupings (sliding windows)

    // First, let's look at the bank entry amounts and dates
    console.log("\n  PayPal bank EUR entries (first 20):");
    ppBankUnrecon.slice(0, 20).forEach(r => {
        console.log(`    ${r.date} | ${parseFloat(r.amount).toFixed(2)}`);
    });

    // PayPal EUR transactions (date + amount)
    const ppEurTxs = paypalTxs.filter(r => {
        const cd = r.custom_data || {};
        const ma = cd.merchant_account_id || "";
        return ma.includes("EUR") || (!ma.includes("USD") && cd.currency === "EUR");
    });

    console.log(`\n  PayPal EUR transactions: ${ppEurTxs.length}`);
    ppEurTxs.slice(0, 20).forEach(r => {
        const cd = r.custom_data || {};
        console.log(`    ${r.date} | amt=${r.amount} | settlement=${cd.settlement_amount} | tx=${cd.transaction_id}`);
    });

    // Amount comparison: total PayPal bank vs total PayPal gateway for same period
    const ppBankTotal = ppBankUnrecon.reduce((s, r) => s + parseFloat(r.amount), 0);
    const ppGatewayTotal = ppEurTxs.reduce((s, r) => {
        const cd = r.custom_data || {};
        return s + parseFloat(cd.settlement_amount || r.amount || 0);
    }, 0);

    console.log(`\n  PayPal bank total (unrecon): ${ppBankTotal.toFixed(2)}`);
    console.log(`  PayPal gateway EUR total: ${ppGatewayTotal.toFixed(2)}`);
    console.log(`  Ratio: ${(ppGatewayTotal / ppBankTotal * 100).toFixed(1)}%`);

    // Also check ALL PayPal bank (incl reconciled)
    const ppBankAllTotal = ppBankAll.reduce((s, r) => s + parseFloat(r.amount), 0);
    console.log(`  PayPal bank total (all): ${ppBankAllTotal.toFixed(2)}`);

    // =============================================
    // 5. CC DISBURSEMENTS vs "braintree" BANK ENTRIES
    // =============================================
    console.log("\n\n📊 5. CC (non-PayPal) BANK ENTRIES ANALYSIS");
    console.log("──────────────────────────────────────────────");

    // What do the non-PayPal, non-AMEX, non-Stripe, non-GC unreconciled entries look like?
    // These should be regular CC Braintree disbursements
    const allUnrecon = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description, reconciled, custom_data")
            .eq("source", "bankinter-eur")
            .eq("reconciled", false)
            .gt("amount", 0)
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .order("date")
    );

    // Find entries that could be Braintree CC but aren't categorized
    const uncategorized = allUnrecon.filter(r => {
        const d = r.description?.toLowerCase() || "";
        return !d.includes("paypal") && !d.includes("stripe") && !d.includes("gocardless") && !d.includes("american express");
    });

    console.log(`  Uncategorized unreconciled: ${uncategorized.length}`);

    // Can we link "abono remesa" and "Trans" entries to Braintree?
    const abonoRemesa = uncategorized.filter(r => r.description?.toLowerCase().includes("abono remesa"));
    const transEntries = uncategorized.filter(r => r.description?.toLowerCase().startsWith("trans"));
    const otherEntries = uncategorized.filter(r => {
        const d = r.description?.toLowerCase() || "";
        return !d.includes("abono remesa") && !d.startsWith("trans");
    });

    console.log(`    'abono remesa': ${abonoRemesa.length}`);
    console.log(`    'Trans...': ${transEntries.length}`);
    console.log(`    Other: ${otherEntries.length}`);

    // Show all unique description patterns
    console.log(`\n  Unique descriptions (uncategorized):`);
    const descPatterns = {};
    for (const r of uncategorized) {
        const d = r.description?.substring(0, 30) || "?";
        descPatterns[d] = (descPatterns[d] || 0) + 1;
    }
    Object.entries(descPatterns).sort((a, b) => b[1] - a[1]).forEach(([d, c]) => {
        console.log(`    (${c}x) "${d}..."`);
    });

    // =============================================
    // 6. OVERALL RECONCILIATION STATUS SUMMARY
    // =============================================
    console.log("\n\n📊 6. OVERALL STATUS SUMMARY - BANKINTER EUR 2025");
    console.log("────────────────────────────────────────────────────");

    const allBank = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description, reconciled, custom_data")
            .eq("source", "bankinter-eur")
            .gt("amount", 0)
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .order("date")
    );

    const totalAmt = allBank.reduce((s, r) => s + parseFloat(r.amount), 0);
    const reconAmt = allBank.filter(r => r.reconciled).reduce((s, r) => s + parseFloat(r.amount), 0);
    const unreconAmt = totalAmt - reconAmt;

    console.log(`  Total credits: ${allBank.length} entries, ${totalAmt.toFixed(2)}€`);
    console.log(`  Reconciled: ${allBank.filter(r => r.reconciled).length} (${reconAmt.toFixed(2)}€ = ${(reconAmt / totalAmt * 100).toFixed(1)}%)`);
    console.log(`  Unreconciled: ${allBank.filter(r => !r.reconciled).length} (${unreconAmt.toFixed(2)}€ = ${(unreconAmt / totalAmt * 100).toFixed(1)}%)`);

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  DEEP DIVE #4 COMPLETE");
    console.log("═══════════════════════════════════════════════════════");
}

run().catch(console.error);
