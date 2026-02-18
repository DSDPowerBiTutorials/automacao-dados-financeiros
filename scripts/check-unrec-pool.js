#!/usr/bin/env node
/**
 * Quick check: what categories are in the 876 unreconciled pool?
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
    while (true) {
        const { data, error } = await baseQuery.range(from, from + 999);
        if (error || !data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        from += 1000;
    }
    return all;
}

async function run() {
    // Get all unreconciled bankinter-eur credit entries
    const unrec = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description")
            .eq("source", "bankinter-eur")
            .eq("reconciled", false)
            .gt("amount", 0)
            .order("date")
    );

    console.log(`Total unreconciled credits: ${unrec.length}`);

    const cats = {};
    for (const r of unrec) {
        const d = r.description?.toLowerCase() || "";
        let cat;
        if (d.includes("paypal")) cat = "PayPal";
        else if (d.includes("american express")) cat = "AMEX";
        else if (d.includes("stripe")) cat = "Stripe";
        else if (d.includes("gocardless")) cat = "GoCardless";
        else if (d.includes("transf") || d.includes("trans inm")) cat = "Wire";
        else if (d.includes("abono remesa")) cat = "Remesa";
        else cat = "Other";

        if (!cats[cat]) cats[cat] = { count: 0, total: 0 };
        cats[cat].count++;
        cats[cat].total += parseFloat(r.amount);
    }

    for (const [cat, data] of Object.entries(cats).sort((a, b) => b[1].total - a[1].total)) {
        console.log(`  ${cat.padEnd(15)} ${String(data.count).padStart(4)} entries  €${data.total.toFixed(2)}`);
    }

    // Check already reconciled to understand what's good
    const rec = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description, custom_data")
            .eq("source", "bankinter-eur")
            .eq("reconciled", true)
            .gt("amount", 0)
            .order("date")
    );

    console.log(`\nAlready reconciled: ${rec.length}`);
    const recCats = {};
    for (const r of rec) {
        const d = r.description?.toLowerCase() || "";
        let cat;
        if (d.includes("paypal")) cat = "PayPal";
        else if (d.includes("american express")) cat = "AMEX";
        else if (d.includes("stripe")) cat = "Stripe";
        else if (d.includes("gocardless")) cat = "GoCardless";
        else cat = "Other";

        if (!recCats[cat]) recCats[cat] = { count: 0, total: 0 };
        recCats[cat].count++;
        recCats[cat].total += parseFloat(r.amount);
    }

    for (const [cat, data] of Object.entries(recCats).sort((a, b) => b[1].total - a[1].total)) {
        console.log(`  ${cat.padEnd(15)} ${String(data.count).padStart(4)} entries  €${data.total.toFixed(2)}`);
    }

    // Check Stripe unreconciled vs available stripe payouts
    const stripeUnrec = unrec.filter(r => r.description?.toLowerCase().includes("stripe"));
    console.log(`\nStripe unreconciled entries: ${stripeUnrec.length}`);
    for (const s of stripeUnrec.slice(0, 5)) {
        console.log(`  ${s.date} €${parseFloat(s.amount).toFixed(2)} "${s.description?.substring(0, 50)}"`);
    }

    // Get stripe payouts
    const { data: stripePO } = await sb.from("csv_rows")
        .select("id, date, amount, custom_data")
        .or("source.eq.stripe-eur-payouts,source.eq.stripe-usd-payouts")
        .order("date", { ascending: false })
        .limit(100);

    console.log(`\nStripe payout records: ${stripePO?.length || 0}`);
    for (const p of (stripePO || []).slice(0, 5)) {
        const cd = p.custom_data || {};
        console.log(`  ${p.date} €${parseFloat(p.amount).toFixed(2)} arrival=${cd.arrival_date} payout=${cd.transaction_id || cd.payout_id}`);
    }

    // GoCardless
    const gcUnrec = unrec.filter(r => r.description?.toLowerCase().includes("gocardless"));
    console.log(`\nGoCardless unreconciled entries: ${gcUnrec.length}`);
    for (const s of gcUnrec) {
        console.log(`  ${s.date} €${parseFloat(s.amount).toFixed(2)} "${s.description?.substring(0, 50)}"`);
    }
}

run().catch(console.error);
