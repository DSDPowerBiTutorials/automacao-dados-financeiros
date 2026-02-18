#!/usr/bin/env node
/**
 * Deep dive #3: 
 * - BT data date range
 * - PayPal vs CC vs AMEX disbursement split
 * - Matching hypothesis testing
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
    console.log("  DEEP DIVE #3 — HIPÓTESES DE MATCHING");
    console.log("═══════════════════════════════════════════════════════\n");

    // =============================================
    // 1. BT DATA DATE RANGE
    // =============================================
    console.log("📊 1. BRAINTREE DATA DATE RANGE");
    console.log("────────────────────────────────");

    const btAll = await fetchAll(
        sb.from("csv_rows")
            .select("date, amount, description, custom_data")
            .eq("source", "braintree-api-revenue")
            .order("date")
    );

    console.log(`  Total rows: ${btAll.length}`);
    if (btAll.length > 0) {
        console.log(`  First date: ${btAll[0].date}`);
        console.log(`  Last date: ${btAll[btAll.length - 1].date}`);

        // Monthly distribution
        const monthly = {};
        for (const r of btAll) {
            const m = r.date?.substring(0, 7) || "unknown";
            monthly[m] = (monthly[m] || 0) + 1;
        }
        console.log(`  Monthly distribution:`);
        Object.entries(monthly).sort().forEach(([m, c]) => console.log(`    ${m}: ${c} rows`));
    }

    // =============================================
    // 2. SPLIT BY PAYMENT METHOD
    // =============================================
    console.log("\n\n📊 2. BT SPLIT BY PAYMENT METHOD");
    console.log("──────────────────────────────────");

    const paypalTxs = [];
    const amexTxs = [];
    const ccTxs = [];  // credit card (non-AMEX, non-PayPal)

    for (const r of btAll) {
        const cd = r.custom_data || {};
        const pm = String(cd.payment_method || "").toLowerCase();
        const ct = String(cd.card_type || "").toLowerCase();
        const desc = String(r.description || "").toLowerCase();

        if (pm.includes("paypal") || desc.includes("paypal")) {
            paypalTxs.push(r);
        } else if (ct.includes("american express") || ct.includes("amex")) {
            amexTxs.push(r);
        } else {
            ccTxs.push(r);
        }
    }

    console.log(`  PayPal: ${paypalTxs.length} transactions`);
    console.log(`  AMEX: ${amexTxs.length} transactions`);
    console.log(`  CC (Visa/MC/other): ${ccTxs.length} transactions`);

    // =============================================
    // 3. BUILD DISBURSEMENTS SPLIT BY PAYMENT TYPE
    // =============================================
    console.log("\n\n📊 3. DISBURSEMENTS SPLIT BY PAYMENT TYPE");
    console.log("──────────────────────────────────────────");

    function buildDisbursements(txs, label) {
        const disbs = {};
        for (const r of txs) {
            const cd = r.custom_data || {};
            const dd = cd.disbursement_date?.substring(0, 10);
            const ma = cd.merchant_account_id || "unknown";
            if (!dd) continue;
            const key = `${dd}|${ma}`;
            if (!disbs[key]) disbs[key] = { date: dd, merchant: ma, total: 0, count: 0, txIds: [] };
            disbs[key].total += parseFloat(cd.settlement_amount || r.amount || 0);
            disbs[key].count++;
            if (cd.transaction_id) disbs[key].txIds.push(cd.transaction_id);
        }
        return Object.values(disbs).sort((a, b) => a.date.localeCompare(b.date));
    }

    const ppDisbs = buildDisbursements(paypalTxs, "PayPal");
    const amexDisbs = buildDisbursements(amexTxs, "AMEX");
    const ccDisbs = buildDisbursements(ccTxs, "CC");

    console.log(`\n  PayPal disbursements: ${ppDisbs.length}`);
    ppDisbs.forEach(d => console.log(`    ${d.date} | ${d.merchant} | ${d.total.toFixed(2)} | ${d.count} txs`));

    console.log(`\n  AMEX disbursements: ${amexDisbs.length}`);
    amexDisbs.slice(0, 15).forEach(d => console.log(`    ${d.date} | ${d.merchant} | ${d.total.toFixed(2)} | ${d.count} txs`));

    console.log(`\n  CC (non-PayPal, non-AMEX) disbursements: ${ccDisbs.length}`);
    ccDisbs.slice(0, 15).forEach(d => console.log(`    ${d.date} | ${d.merchant} | ${d.total.toFixed(2)} | ${d.count} txs`));

    // =============================================
    // 4. MATCH PAYPAL BANK ENTRIES VS PAYPAL DISBS
    // =============================================
    console.log("\n\n📊 4. MATCHING: PayPal Bank vs PayPal Disbursements");
    console.log("────────────────────────────────────────────────────");

    const ppBankAll = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description, reconciled, custom_data")
            .eq("source", "bankinter-eur")
            .gt("amount", 0)
            .ilike("description", "%paypal%")
            .gte("date", "2025-01-01")
            .order("date")
    );

    console.log(`  PayPal bank entries: ${ppBankAll.length}`);
    console.log(`  PayPal disbursements available: ${ppDisbs.length}`);

    // Try matching with various tolerances
    let matched = 0;
    let matchDetails = [];
    const usedDisbs = new Set();

    // Sort by date for greedy matching
    for (const bank of ppBankAll) {
        const bankDate = new Date(bank.date);
        const bankAmt = parseFloat(bank.amount);

        let bestMatch = null;
        let bestScore = Infinity;

        for (let i = 0; i < ppDisbs.length; i++) {
            if (usedDisbs.has(i)) continue;
            const disb = ppDisbs[i];
            const disbDate = new Date(disb.date);
            const daysDiff = Math.round((bankDate - disbDate) / (1000 * 60 * 60 * 24));
            const amtDiff = Math.abs(bankAmt - disb.total);
            const amtPct = amtDiff / bankAmt;

            // Try ±14 days and ±5% amount
            if (Math.abs(daysDiff) <= 14 && amtPct < 0.05) {
                const score = Math.abs(daysDiff) + amtPct * 100;
                if (score < bestScore) {
                    bestScore = score;
                    bestMatch = { idx: i, disb, daysDiff, amtDiff, amtPct };
                }
            }
        }

        if (bestMatch) {
            matched++;
            usedDisbs.add(bestMatch.idx);
            matchDetails.push({
                bankDate: bank.date,
                bankAmt,
                disbDate: bestMatch.disb.date,
                disbAmt: bestMatch.disb.total,
                daysDiff: bestMatch.daysDiff,
                amtDiff: bestMatch.amtDiff,
                txCount: bestMatch.disb.count
            });
        }
    }

    console.log(`\n  Match results (±14 days, ±5% amount):`);
    console.log(`    MATCHED: ${matched}/${ppBankAll.length} (${(matched / ppBankAll.length * 100).toFixed(1)}%)`);

    if (matchDetails.length > 0) {
        console.log(`\n  Sample matches:`);
        matchDetails.slice(0, 10).forEach(m => {
            console.log(`    Bank ${m.bankDate} (${m.bankAmt}) → Disb ${m.disbDate} (${m.disbAmt.toFixed(2)}) | ${m.daysDiff}d | diff=${m.amtDiff.toFixed(2)} (${(m.amtDiff / m.bankAmt * 100).toFixed(2)}%) | ${m.txCount} txs`);
        });

        // Timing pattern
        const diffs = matchDetails.map(m => m.daysDiff);
        const avg = diffs.reduce((s, v) => s + v, 0) / diffs.length;
        const dist = {};
        diffs.forEach(d => { dist[d] = (dist[d] || 0) + 1; });
        console.log(`\n  Timing pattern: avg=${avg.toFixed(1)} days`);
        console.log(`  Distribution: ${Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([d, c]) => `${d}d:${c}`).join(", ")}`);
    }

    // =============================================
    // 5. MATCH CC BANK ENTRIES VS CC DISBS
    // =============================================
    console.log("\n\n📊 5. MATCHING: Non-PayPal/Non-AMEX Bank vs CC Disbursements");
    console.log("─────────────────────────────────────────────────────────────");

    // Bank entries that don't mention paypal/amex/stripe/gocardless
    const otherBank = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description, reconciled, custom_data")
            .eq("source", "bankinter-eur")
            .eq("reconciled", false)
            .gt("amount", 0)
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .order("date")
    );

    // Filter to only gateway-type entries (exclude internal transfers etc)
    const unreconPP = otherBank.filter(r => r.description?.toLowerCase().includes("paypal"));
    const unreconAMEX = otherBank.filter(r => r.description?.toLowerCase().includes("american express"));

    console.log(`  Unreconciled PayPal: ${unreconPP.length}`);
    console.log(`  Unreconciled AMEX: ${unreconAMEX.length}`);

    // Match AMEX bank vs AMEX disbs
    let amexMatched = 0;
    const usedAmex = new Set();
    const amexMatchDetails = [];

    for (const bank of unreconAMEX) {
        const bankDate = new Date(bank.date);
        const bankAmt = parseFloat(bank.amount);

        let bestMatch = null;
        let bestScore = Infinity;

        for (let i = 0; i < amexDisbs.length; i++) {
            if (usedAmex.has(i)) continue;
            const disb = amexDisbs[i];
            const disbDate = new Date(disb.date);
            const daysDiff = Math.round((bankDate - disbDate) / (1000 * 60 * 60 * 24));
            const amtDiff = Math.abs(bankAmt - disb.total);
            const amtPct = amtDiff / bankAmt;

            if (Math.abs(daysDiff) <= 14 && amtPct < 0.05) {
                const score = Math.abs(daysDiff) + amtPct * 100;
                if (score < bestScore) {
                    bestScore = score;
                    bestMatch = { idx: i, disb, daysDiff, amtDiff, amtPct };
                }
            }
        }

        if (bestMatch) {
            amexMatched++;
            usedAmex.add(bestMatch.idx);
            amexMatchDetails.push({
                bankDate: bank.date,
                bankAmt,
                disbDate: bestMatch.disb.date,
                disbAmt: bestMatch.disb.total,
                daysDiff: bestMatch.daysDiff,
                amtDiff: bestMatch.amtDiff
            });
        }
    }

    console.log(`\n  AMEX Match results (±14d, ±5%): ${amexMatched}/${unreconAMEX.length}`);
    if (amexMatchDetails.length > 0) {
        amexMatchDetails.slice(0, 5).forEach(m => {
            console.log(`    Bank ${m.bankDate} (${m.bankAmt}) → Disb ${m.disbDate} (${m.disbAmt.toFixed(2)}) | ${m.daysDiff}d | diff=${m.amtDiff.toFixed(2)}`);
        });
    }

    // =============================================
    // 6. ALL UNRECONCILED — WIDER SEARCH
    // =============================================
    console.log("\n\n📊 6. ALL UNRECONCILED ENTRIES CATEGORIZATION");
    console.log("──────────────────────────────────────────────");

    const allUnrecon = otherBank.filter(r => !r.reconciled);
    console.log(`  Total unreconciled credits bankinter-eur: ${allUnrecon.length}`);

    const cats = {};
    for (const r of allUnrecon) {
        const d = r.description?.toLowerCase() || "";
        let cat;
        if (d.includes("paypal")) cat = "PayPal";
        else if (d.includes("american express")) cat = "AMEX";
        else if (d.includes("stripe")) cat = "Stripe";
        else if (d.includes("gocardless")) cat = "GoCardless";
        else if (d.includes("abono remesa")) cat = "Abono Remesa";
        else if (d.includes("trans ")) cat = "Transferencia";
        else if (d.includes("transf")) cat = "Transferencia";
        else cat = "Outro";

        if (!cats[cat]) cats[cat] = { count: 0, total: 0, samples: [] };
        cats[cat].count++;
        cats[cat].total += parseFloat(r.amount);
        if (cats[cat].samples.length < 3) cats[cat].samples.push(r);
    }

    for (const [cat, info] of Object.entries(cats).sort((a, b) => b[1].count - a[1].count)) {
        console.log(`\n  ${cat}: ${info.count} entries, total=${info.total.toFixed(2)}€`);
        info.samples.forEach(r => {
            console.log(`    ${r.date} | ${r.amount} | "${r.description?.substring(0, 60)}"`);
        });
    }

    // =============================================
    // 7. BRAINTREE-AMEX SOURCE DATA
    // =============================================
    console.log("\n\n📊 7. BRAINTREE-AMEX SOURCE DATA");
    console.log("──────────────────────────────────");

    const amexAll = await fetchAll(
        sb.from("csv_rows")
            .select("date, amount, custom_data")
            .eq("source", "braintree-amex")
            .order("date")
    );

    console.log(`  braintree-amex rows: ${amexAll.length}`);
    if (amexAll.length > 0) {
        console.log(`  Date range: ${amexAll[0].date} to ${amexAll[amexAll.length - 1].date}`);

        // Build AMEX-specific disbursements
        const amexSpecDisbs = buildDisbursements(amexAll, "AMEX-specific");
        console.log(`  AMEX-specific disbursements: ${amexSpecDisbs.length}`);
        amexSpecDisbs.slice(0, 10).forEach(d => {
            console.log(`    ${d.date} | ${d.total.toFixed(2)} | ${d.count} txs`);
        });
    }

    // =============================================
    // 8. PERCENTAGE MATCH WITH WIDER TOLERANCES
    // =============================================
    console.log("\n\n📊 8. TOLERANCE SENSITIVITY ANALYSIS");
    console.log("──────────────────────────────────────");

    // All BT disbursements (mixed)
    const allDisbs = buildDisbursements(btAll, "ALL");
    const allDisbsByMerchant = {};
    for (const d of allDisbs) {
        const curr = d.merchant.includes("USD") ? "USD" : "EUR";
        if (!allDisbsByMerchant[curr]) allDisbsByMerchant[curr] = [];
        allDisbsByMerchant[curr].push(d);
    }

    const eurDisbs = allDisbsByMerchant["EUR"] || [];

    // Test different tolerance combinations
    const tolerances = [
        { days: 3, pct: 0.01, label: "±3d, ±1%" },
        { days: 5, pct: 0.03, label: "±5d, ±3%" },
        { days: 7, pct: 0.05, label: "±7d, ±5%" },
        { days: 10, pct: 0.05, label: "±10d, ±5%" },
        { days: 14, pct: 0.05, label: "±14d, ±5%" },
        { days: 14, pct: 0.10, label: "±14d, ±10%" },
    ];

    const ppAndAmex = [...unreconPP, ...unreconAMEX];

    for (const tol of tolerances) {
        let matches = 0;
        const used = new Set();

        for (const bank of ppAndAmex) {
            const bankDate = new Date(bank.date);
            const bankAmt = parseFloat(bank.amount);

            for (let i = 0; i < eurDisbs.length; i++) {
                if (used.has(i)) continue;
                const disb = eurDisbs[i];
                const disbDate = new Date(disb.date);
                const daysDiff = Math.abs(Math.round((bankDate - disbDate) / (1000 * 60 * 60 * 24)));
                const amtDiff = Math.abs(bankAmt - disb.total);
                const amtPct = amtDiff / bankAmt;

                if (daysDiff <= tol.days && amtPct < tol.pct) {
                    matches++;
                    used.add(i);
                    break;
                }
            }
        }

        console.log(`  ${tol.label}: ${matches}/${ppAndAmex.length} (${(matches / ppAndAmex.length * 100).toFixed(1)}%)`);
    }

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  DEEP DIVE #3 COMPLETE");
    console.log("═══════════════════════════════════════════════════════");
}

run().catch(console.error);
