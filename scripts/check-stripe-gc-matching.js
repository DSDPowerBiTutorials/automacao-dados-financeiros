#!/usr/bin/env node
/**
 * Quick analysis: Stripe bank entries vs Stripe payouts
 * Find why they're not matching and what tolerance would work
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
    // Get ALL unreconciled stripe bank entries
    const stripeBank = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description")
            .eq("source", "bankinter-eur")
            .eq("reconciled", false)
            .gt("amount", 0)
            .ilike("description", "%stripe%")
            .order("date")
    );

    // Get ALL Stripe payouts
    const payouts = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, custom_data")
            .or("source.eq.stripe-eur-payouts,source.eq.stripe-usd-payouts")
            .order("date")
    );

    const eurPayouts = payouts.filter(p => {
        const cd = p.custom_data || {};
        const src = cd.source || "";
        return !src.includes("usd") && (cd.currency || "").toUpperCase() !== "USD";
    });

    console.log(`Stripe unreconciled bank entries: ${stripeBank.length}`);
    console.log(`Stripe EUR payouts: ${eurPayouts.length}`);
    console.log(`Stripe ALL payouts: ${payouts.length}`);

    // For each bank entry, find closest payout by amount
    console.log("\nBank entry → Closest payout:");
    for (const bank of stripeBank) {
        const bAmt = parseFloat(bank.amount);
        const bDate = new Date(bank.date);

        let best = null;
        let bestDiff = Infinity;

        for (const po of eurPayouts) {
            const cd = po.custom_data || {};
            const pAmt = parseFloat(po.amount || 0);
            const pDate = new Date(cd.arrival_date || po.date);
            const amtDiff = Math.abs(pAmt - bAmt);
            const daysDiff = Math.abs(Math.round((bDate - pDate) / (1000 * 60 * 60 * 24)));

            if (daysDiff <= 14 && amtDiff < bestDiff) {
                bestDiff = amtDiff;
                best = { amt: pAmt, date: cd.arrival_date || po.date, daysDiff, amtDiff, pct: (amtDiff / bAmt * 100) };
            }
        }

        if (best) {
            console.log(`  ${bank.date} €${bAmt.toFixed(2)} → €${best.amt.toFixed(2)} (${best.date}, ${best.daysDiff}d, €${best.amtDiff.toFixed(2)} = ${best.pct.toFixed(1)}%)`);
        } else {
            // Try without date constraint
            for (const po of eurPayouts) {
                const pAmt = parseFloat(po.amount || 0);
                const amtDiff = Math.abs(pAmt - bAmt);
                if (amtDiff < bestDiff) {
                    bestDiff = amtDiff;
                    const cd = po.custom_data || {};
                    const pDate = new Date(cd.arrival_date || po.date);
                    const daysDiff = Math.abs(Math.round((bDate - pDate) / (1000 * 60 * 60 * 24)));
                    best = { amt: pAmt, date: cd.arrival_date || po.date, daysDiff, amtDiff, pct: (amtDiff / bAmt * 100) };
                }
            }
            console.log(`  ${bank.date} €${bAmt.toFixed(2)} → nearest: €${best?.amt.toFixed(2)} (${best?.date}, ${best?.daysDiff}d, €${best?.amtDiff.toFixed(2)} = ${best?.pct.toFixed(1)}%) ⚠️ NO MATCH ≤14d`);
        }
    }

    // Now do GoCardless
    const gcBank = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, description")
            .eq("source", "bankinter-eur")
            .eq("reconciled", false)
            .gt("amount", 0)
            .ilike("description", "%gocardless%")
            .order("date")
    );

    const gcPayouts = await fetchAll(
        sb.from("csv_rows")
            .select("id, date, amount, custom_data")
            .eq("source", "gocardless")
            .eq("custom_data->>type", "payout")
            .order("date")
    );

    console.log(`\nGoCardless unreconciled bank entries: ${gcBank.length}`);
    console.log(`GoCardless payouts: ${gcPayouts.length}`);

    for (const bank of gcBank) {
        const bAmt = parseFloat(bank.amount);
        const bDate = new Date(bank.date);

        let best = null;
        let bestDiff = Infinity;

        for (const po of gcPayouts) {
            const pAmt = parseFloat(po.amount || 0);
            const pDate = new Date(po.date);
            const daysDiff = Math.abs(Math.round((bDate - pDate) / (1000 * 60 * 60 * 24)));
            const amtDiff = Math.abs(pAmt - bAmt);

            if (daysDiff <= 14 && amtDiff < bestDiff) {
                bestDiff = amtDiff;
                best = { amt: pAmt, date: po.date, daysDiff, amtDiff, pct: (amtDiff / bAmt * 100) };
            }
        }

        if (best) {
            console.log(`  ${bank.date} €${bAmt.toFixed(2)} → €${best.amt.toFixed(2)} (${best.date}, ${best.daysDiff}d, €${best.amtDiff.toFixed(2)} = ${best.pct.toFixed(1)}%)`);
        } else {
            console.log(`  ${bank.date} €${bAmt.toFixed(2)} → NO MATCH within 14d`);
        }
    }
}

run().catch(console.error);
