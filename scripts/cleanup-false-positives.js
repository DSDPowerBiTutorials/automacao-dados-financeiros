#!/usr/bin/env node
/**
 * CLEANUP: Reset false positive reconciliation matches
 * 
 * Finds all reconciled bank entries where the matched disbursement date is >14 days 
 * from the bank date and resets them.
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
    const DRY_RUN = process.argv.includes("--apply") ? false : true;

    console.log("═══════════════════════════════════════════════════════");
    console.log(`  CLEANUP FALSE POSITIVE MATCHES ${DRY_RUN ? "(DRY RUN)" : "🔴 APPLYING"}`);
    console.log("═══════════════════════════════════════════════════════\n");

    // Get all reconciled bankinter-eur credit entries
    const allRec = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description, reconciled, custom_data, matched_with")
            .eq("source", "bankinter-eur")
            .eq("reconciled", true)
            .gt("amount", 0)
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .order("date")
    );

    console.log(`Total reconciled credit entries: ${allRec.length}`);

    // Analyze each for date quality
    const badMatches = [];
    const goodMatches = [];
    const noDateInfo = [];

    for (const row of allRec) {
        const cd = row.custom_data || {};
        const bankDate = row.date?.substring(0, 10);
        const disbDate = cd.disbursement_date?.substring(0, 10);
        const matchType = cd.match_type;

        if (!disbDate) {
            // No disbursement date stored — check if match_type was auto
            if (matchType === 'description_amount' || cd.reconciliationType === 'automatic') {
                noDateInfo.push(row);
            } else {
                goodMatches.push(row); // Manual or other — assume good
            }
            continue;
        }

        const daysDiff = Math.abs(Math.round(
            (new Date(bankDate) - new Date(disbDate)) / (1000 * 60 * 60 * 24)
        ));

        if (daysDiff > 14) {
            badMatches.push({ ...row, daysDiff, disbDate });
        } else {
            goodMatches.push(row);
        }
    }

    console.log(`\n  Good matches (≤14d): ${goodMatches.length}`);
    console.log(`  BAD matches (>14d): ${badMatches.length}`);
    console.log(`  No date info (auto): ${noDateInfo.length}`);

    // Categorize bad matches by description
    const badByType = {};
    for (const m of badMatches) {
        const desc = m.description?.toLowerCase() || "";
        let cat;
        if (desc.includes("paypal")) cat = "PayPal";
        else if (desc.includes("american express")) cat = "AMEX";
        else if (desc.includes("stripe")) cat = "Stripe";
        else if (desc.includes("gocardless")) cat = "GoCardless";
        else cat = "Other";

        if (!badByType[cat]) badByType[cat] = [];
        badByType[cat].push(m);
    }

    console.log("\n  BAD matches by category:");
    for (const [cat, list] of Object.entries(badByType)) {
        const totalAmt = list.reduce((s, r) => s + parseFloat(r.amount), 0);
        console.log(`    ${cat}: ${list.length} entries, €${totalAmt.toFixed(2)}`);
        // Show worst examples
        const worst = list.sort((a, b) => b.daysDiff - a.daysDiff).slice(0, 3);
        for (const w of worst) {
            console.log(`      Bank ${w.date} → Disb ${w.disbDate} (${w.daysDiff}d), €${parseFloat(w.amount).toFixed(2)}, type=${w.custom_data?.match_type}`);
        }
    }

    // Also check noDateInfo entries - are they description_amount with no date?
    console.log(`\n  No-date auto matches (description_amount without disbursement_date):`);
    const noDateByType = {};
    for (const m of noDateInfo) {
        const desc = m.description?.toLowerCase() || "";
        let cat;
        if (desc.includes("paypal")) cat = "PayPal";
        else if (desc.includes("american express")) cat = "AMEX";
        else if (desc.includes("stripe")) cat = "Stripe";
        else if (desc.includes("gocardless")) cat = "GoCardless";
        else cat = "Other";

        if (!noDateByType[cat]) noDateByType[cat] = [];
        noDateByType[cat].push(m);
    }

    for (const [cat, list] of Object.entries(noDateByType)) {
        const totalAmt = list.reduce((s, r) => s + parseFloat(r.amount), 0);
        console.log(`    ${cat}: ${list.length} entries, €${totalAmt.toFixed(2)}`);
    }

    // Total to reset
    const toReset = [...badMatches, ...noDateInfo];
    console.log(`\n  TOTAL TO RESET: ${toReset.length} entries`);
    const resetTotal = toReset.reduce((s, r) => s + parseFloat(r.amount), 0);
    console.log(`  Value: €${resetTotal.toFixed(2)}`);

    if (DRY_RUN) {
        console.log("\n  ⚠️  DRY RUN — no changes made. Run with --apply to execute.");
        return;
    }

    // Apply reset
    console.log("\n  🔴 APPLYING RESET...");
    let resetCount = 0;
    let errors = 0;

    for (const row of toReset) {
        const cd = row.custom_data || {};

        // Remove reconciliation metadata, keep original data
        const cleanedCustomData = { ...cd };
        delete cleanedCustomData.reconciled_at;
        delete cleanedCustomData.reconciliationType;
        delete cleanedCustomData.paymentSource;
        delete cleanedCustomData.disbursement_reference;
        delete cleanedCustomData.disbursement_amount;
        delete cleanedCustomData.disbursement_date;
        delete cleanedCustomData.match_type;
        delete cleanedCustomData.settlement_batch_id;
        delete cleanedCustomData.transaction_ids;
        delete cleanedCustomData.braintree_transaction_count;
        delete cleanedCustomData.match_confidence;

        const { error } = await sb
            .from("csv_rows")
            .update({
                reconciled: false,
                matched_with: null,
                custom_data: cleanedCustomData
            })
            .eq("id", row.id);

        if (error) {
            errors++;
            console.error(`    Error resetting ${row.id}: ${error.message}`);
        } else {
            resetCount++;
        }
    }

    console.log(`\n  ✅ Reset ${resetCount} entries (${errors} errors)`);

    // Verify final state
    const { count } = await sb
        .from("csv_rows")
        .select("*", { count: "exact", head: true })
        .eq("source", "bankinter-eur")
        .eq("reconciled", true)
        .gt("amount", 0)
        .gte("date", "2025-01-01")
        .lte("date", "2025-12-31");

    console.log(`  Remaining reconciled: ${count}`);
    console.log("\n═══════════════════════════════════════════════════════");
}

run().catch(console.error);
