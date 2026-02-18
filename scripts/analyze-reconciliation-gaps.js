#!/usr/bin/env node
/**
 * Deep analysis of reconciliation gaps
 * - Bank entries not reconciled
 * - PayPal entries analysis
 * - Braintree partial matches
 * - Disbursement timing analysis
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchAll(query) {
    // Paginate to get all rows
    let all = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
        const { data, error } = await query.range(from, from + PAGE - 1);
        if (error) { console.error("Query error:", error.message); break; }
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
    }
    return all;
}

async function run() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  ANÁLISE PROFUNDA DE RECONCILIAÇÃO");
    console.log("═══════════════════════════════════════════════════════\n");

    // =============================================
    // 1. BANK ENTRIES OVERVIEW
    // =============================================
    console.log("📊 1. BANK ENTRIES (créditos 2025)");
    console.log("─────────────────────────────────────");

    const bankSources = ["bankinter-eur", "bankinter-usd", "sabadell", "chase-usd"];

    for (const src of bankSources) {
        const { data: all } = await sb.from("csv_rows")
            .select("id, date, description, amount, reconciled, custom_data")
            .eq("source", src)
            .gt("amount", 0)
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .order("date");

        if (!all || all.length === 0) continue;

        const reconciled = all.filter(r => r.reconciled);
        const notRecon = all.filter(r => !r.reconciled);

        console.log(`\n  ${src}: ${all.length} créditos, ${reconciled.length} reconciliados (${(reconciled.length / all.length * 100).toFixed(1)}%), ${notRecon.length} pendentes`);

        // Breakdown by description keywords
        const paypalEntries = all.filter(r => r.description?.toLowerCase().includes("paypal"));
        const paypalRecon = paypalEntries.filter(r => r.reconciled);
        const btEntries = all.filter(r => r.description?.toLowerCase().match(/braintree|brain tree/));
        const btRecon = btEntries.filter(r => r.reconciled);
        const stripeEntries = all.filter(r => r.description?.toLowerCase().includes("stripe"));
        const stripeRecon = stripeEntries.filter(r => r.reconciled);
        const gcEntries = all.filter(r => r.description?.toLowerCase().includes("gocardless"));
        const gcRecon = gcEntries.filter(r => r.reconciled);

        if (paypalEntries.length > 0) console.log(`    PayPal: ${paypalEntries.length} entries, ${paypalRecon.length} reconciliados (${(paypalRecon.length / paypalEntries.length * 100).toFixed(1)}%)`);
        if (btEntries.length > 0) console.log(`    Braintree: ${btEntries.length} entries, ${btRecon.length} reconciliados (${(btRecon.length / btEntries.length * 100).toFixed(1)}%)`);
        if (stripeEntries.length > 0) console.log(`    Stripe: ${stripeEntries.length} entries, ${stripeRecon.length} reconciliados (${(stripeRecon.length / stripeEntries.length * 100).toFixed(1)}%)`);
        if (gcEntries.length > 0) console.log(`    GoCardless: ${gcEntries.length} entries, ${gcRecon.length} reconciliados (${(gcRecon.length / gcEntries.length * 100).toFixed(1)}%)`);

        // Show unreconciled PayPal entries
        if (paypalEntries.length > 0) {
            const unrecPP = paypalEntries.filter(r => !r.reconciled);
            if (unrecPP.length > 0) {
                console.log(`\n    📋 PayPal NÃO reconciliados (primeiros 5):`);
                unrecPP.slice(0, 5).forEach(r => {
                    const cd = r.custom_data || {};
                    console.log(`      ${r.date} | ${r.amount} | "${r.description?.substring(0, 60)}" | paymentSource=${cd.paymentSource || 'N/A'} | match_type=${cd.match_type || 'N/A'}`);
                });
            }
        }

        // Show unreconciled Braintree entries
        if (btEntries.length > 0) {
            const unrecBT = btEntries.filter(r => !r.reconciled);
            if (unrecBT.length > 0) {
                console.log(`\n    📋 Braintree NÃO reconciliados (primeiros 5):`);
                unrecBT.slice(0, 5).forEach(r => {
                    const cd = r.custom_data || {};
                    console.log(`      ${r.date} | ${r.amount} | "${r.description?.substring(0, 60)}" | paymentSource=${cd.paymentSource || 'N/A'}`);
                });
            }
        }

        // Show NOT RECONCILED entries that are not gateway-related
        const otherUnrecon = notRecon.filter(r => {
            const d = r.description?.toLowerCase() || "";
            return !d.includes("paypal") && !d.includes("braintree") && !d.includes("stripe") && !d.includes("gocardless");
        });
        if (otherUnrecon.length > 0) {
            console.log(`\n    📋 Outros NÃO reconciliados: ${otherUnrecon.length} entries (primeiros 5):`);
            otherUnrecon.slice(0, 5).forEach(r => {
                console.log(`      ${r.date} | ${r.amount} | "${r.description?.substring(0, 60)}"`);
            });
        }
    }

    // =============================================
    // 2. DISBURSEMENT TIMING ANALYSIS  
    // =============================================
    console.log("\n\n📊 2. DISBURSEMENT TIMING (Bank vs Gateway)");
    console.log("─────────────────────────────────────────────");

    // Get reconciled bank entries with disbursement info
    const { data: reconciledRows } = await sb.from("csv_rows")
        .select("id, date, description, amount, custom_data, source")
        .in("source", bankSources)
        .eq("reconciled", true)
        .gt("amount", 0)
        .gte("date", "2025-01-01")
        .lte("date", "2025-12-31")
        .order("date")
        .limit(500);

    if (reconciledRows && reconciledRows.length > 0) {
        const timingData = [];
        for (const r of reconciledRows) {
            const cd = r.custom_data || {};
            if (cd.disbursement_date && r.date) {
                const bankDate = new Date(r.date);
                const disbDate = new Date(cd.disbursement_date);
                const diffDays = Math.round((bankDate - disbDate) / (1000 * 60 * 60 * 24));
                timingData.push({
                    source: cd.paymentSource || "unknown",
                    diffDays,
                    bankDate: r.date,
                    disbDate: cd.disbursement_date,
                    matchType: cd.match_type,
                    amount: r.amount
                });
            }
        }

        // Group by payment source
        const bySource = {};
        for (const t of timingData) {
            if (!bySource[t.source]) bySource[t.source] = [];
            bySource[t.source].push(t);
        }

        for (const [src, entries] of Object.entries(bySource)) {
            const diffs = entries.map(e => e.diffDays).sort((a, b) => a - b);
            const avg = diffs.reduce((s, v) => s + v, 0) / diffs.length;
            const min = diffs[0];
            const max = diffs[diffs.length - 1];
            const median = diffs[Math.floor(diffs.length / 2)];

            console.log(`\n  ${src}: ${entries.length} matches`);
            console.log(`    Dias entre disbursement → bank: min=${min}, max=${max}, média=${avg.toFixed(1)}, mediana=${median}`);

            // Distribution
            const dist = {};
            for (const d of diffs) { dist[d] = (dist[d] || 0) + 1; }
            const topDiffs = Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 8);
            console.log(`    Distribuição: ${topDiffs.map(([d, c]) => `${d}d:${c}`).join(", ")}`);
        }
    }

    // =============================================
    // 3. PAYPAL DEEP ANALYSIS
    // =============================================
    console.log("\n\n📊 3. PAYPAL DEEP ANALYSIS");
    console.log("──────────────────────────────");

    // Get all PayPal bank entries
    for (const src of bankSources) {
        const { data: ppBank } = await sb.from("csv_rows")
            .select("id, date, description, amount, reconciled, custom_data")
            .eq("source", src)
            .gt("amount", 0)
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .ilike("description", "%paypal%")
            .order("date");

        if (!ppBank || ppBank.length === 0) continue;

        console.log(`\n  ${src} PayPal entries: ${ppBank.length}`);

        // Show first few with full details
        for (const r of ppBank.slice(0, 3)) {
            console.log(`\n    Date: ${r.date} | Amount: ${r.amount} | Reconciled: ${r.reconciled}`);
            console.log(`    Desc: "${r.description}"`);
            const cd = r.custom_data || {};
            console.log(`    custom_data keys: ${Object.keys(cd).join(", ")}`);
            if (cd.paymentSource) console.log(`    paymentSource: ${cd.paymentSource}`);
            if (cd.transaction_ids) console.log(`    transaction_ids: ${JSON.stringify(cd.transaction_ids?.slice(0, 5))}`);
            if (cd.disbursement_date) console.log(`    disbursement_date: ${cd.disbursement_date}`);
            if (cd.match_type) console.log(`    match_type: ${cd.match_type}`);
        }

        // Now check: do Braintree gateway rows have PayPal payment methods?
        console.log(`\n  🔍 Braintree gateway rows com payment_method_type = 'paypal':`);
        const { data: ppGateway, count: ppGwCount } = await sb.from("csv_rows")
            .select("id, date, amount, custom_data", { count: "exact" })
            .eq("source", "braintree-api-revenue")
            .gte("date", "2025-01-01")
            .limit(5)
            .or("custom_data->>payment_method_type.ilike.%paypal%,custom_data->>payment_instrument_type.ilike.%paypal%");

        console.log(`    Count: ${ppGwCount || (ppGateway?.length || 0)}`);
        if (ppGateway && ppGateway.length > 0) {
            for (const g of ppGateway.slice(0, 3)) {
                const cd = g.custom_data || {};
                console.log(`    ${g.date} | ${g.amount} | type=${cd.payment_method_type || cd.payment_instrument_type} | disb=${cd.disbursement_date} | tx=${cd.transaction_id}`);
            }
        }
    }

    // =============================================
    // 4. BRAINTREE GATEWAY DATA ANALYSIS
    // =============================================
    console.log("\n\n📊 4. BRAINTREE GATEWAY DATA OVERVIEW");
    console.log("─────────────────────────────────────────");

    // Get total braintree-api-revenue rows for 2025
    const { count: btTotal } = await sb.from("csv_rows")
        .select("id", { count: "exact", head: true })
        .eq("source", "braintree-api-revenue")
        .gte("date", "2025-01-01");

    console.log(`  Total braintree-api-revenue rows (2025): ${btTotal}`);

    // Get payment method types distribution
    const { data: btSample } = await sb.from("csv_rows")
        .select("custom_data")
        .eq("source", "braintree-api-revenue")
        .gte("date", "2025-01-01")
        .limit(1000);

    if (btSample) {
        const methodTypes = {};
        const merchantAccounts = {};
        for (const r of btSample) {
            const cd = r.custom_data || {};
            const mt = cd.payment_method_type || cd.payment_instrument_type || "unknown";
            methodTypes[mt] = (methodTypes[mt] || 0) + 1;
            const ma = cd.merchant_account_id || "unknown";
            merchantAccounts[ma] = (merchantAccounts[ma] || 0) + 1;
        }
        console.log(`  Payment method types (sample 1000): ${JSON.stringify(methodTypes)}`);
        console.log(`  Merchant accounts (sample 1000): ${JSON.stringify(merchantAccounts)}`);
    }

    // =============================================
    // 5. UNRECONCILED ANALYSIS - Pattern Detection
    // =============================================
    console.log("\n\n📊 5. PATTERN ANALYSIS - NÃO RECONCILIADOS");
    console.log("──────────────────────────────────────────────");

    for (const src of bankSources) {
        const { data: unrecon } = await sb.from("csv_rows")
            .select("id, date, description, amount, custom_data")
            .eq("source", src)
            .eq("reconciled", false)
            .gt("amount", 0)
            .gte("date", "2025-01-01")
            .lte("date", "2025-12-31")
            .order("date");

        if (!unrecon || unrecon.length === 0) continue;

        console.log(`\n  ${src}: ${unrecon.length} não reconciliados`);

        // Categorize by description pattern
        const categories = {
            paypal: [], braintree: [], stripe: [], gocardless: [],
            transfer: [], interest: [], other: []
        };

        for (const r of unrecon) {
            const d = r.description?.toLowerCase() || "";
            if (d.includes("paypal")) categories.paypal.push(r);
            else if (d.includes("braintree") || d.includes("brain tree")) categories.braintree.push(r);
            else if (d.includes("stripe")) categories.stripe.push(r);
            else if (d.includes("gocardless")) categories.gocardless.push(r);
            else if (d.includes("transfer") || d.includes("transf")) categories.transfer.push(r);
            else if (d.includes("interest") || d.includes("interes")) categories.interest.push(r);
            else categories.other.push(r);
        }

        for (const [cat, items] of Object.entries(categories)) {
            if (items.length > 0) {
                const totalAmt = items.reduce((s, r) => s + parseFloat(r.amount), 0);
                console.log(`    ${cat}: ${items.length} entries, total=${totalAmt.toFixed(2)}`);
            }
        }
    }

    // =============================================
    // 6. CROSS-CHECK: Bank PayPal amounts vs BT disbursements
    // =============================================
    console.log("\n\n📊 6. CROSS-CHECK: PayPal bank entries vs Braintree disbursements");
    console.log("──────────────────────────────────────────────────────────────────");

    // Get all PayPal bank entries (not reconciled)
    const { data: ppBankAll } = await sb.from("csv_rows")
        .select("id, date, description, amount, custom_data")
        .in("source", bankSources)
        .eq("reconciled", false)
        .gt("amount", 0)
        .gte("date", "2025-01-01")
        .lte("date", "2025-12-31")
        .ilike("description", "%paypal%")
        .order("date");

    if (ppBankAll && ppBankAll.length > 0) {
        console.log(`\n  PayPal bank entries não reconciliados: ${ppBankAll.length}`);

        // For each PayPal entry, find BT disbursements within ±7 days
        for (const pp of ppBankAll.slice(0, 10)) {
            const ppDate = new Date(pp.date);
            const dateMin = new Date(ppDate); dateMin.setDate(dateMin.getDate() - 7);
            const dateMax = new Date(ppDate); dateMax.setDate(dateMax.getDate() + 7);

            // Find BT rows with disbursement_date in range
            const { data: candidates } = await sb.from("csv_rows")
                .select("date, amount, custom_data")
                .eq("source", "braintree-api-revenue")
                .gte("date", dateMin.toISOString().split("T")[0])
                .lte("date", dateMax.toISOString().split("T")[0])
                .limit(500);

            // Group by disbursement_date to create disbursements
            if (candidates && candidates.length > 0) {
                const disbByDate = {};
                for (const c of candidates) {
                    const cd = c.custom_data || {};
                    const dd = cd.disbursement_date;
                    const pmt = cd.payment_method_type || cd.payment_instrument_type || "";
                    if (dd && pmt.toLowerCase().includes("paypal")) {
                        if (!disbByDate[dd]) disbByDate[dd] = { total: 0, count: 0, txIds: [] };
                        disbByDate[dd].total += parseFloat(cd.settlement_amount || c.amount || 0);
                        disbByDate[dd].count++;
                        if (cd.transaction_id) disbByDate[dd].txIds.push(cd.transaction_id);
                    }
                }

                const ppAmt = parseFloat(pp.amount);
                console.log(`\n  Bank: ${pp.date} | ${ppAmt} | "${pp.description?.substring(0, 50)}"`);

                if (Object.keys(disbByDate).length > 0) {
                    for (const [dd, info] of Object.entries(disbByDate)) {
                        const diff = Math.abs(ppAmt - info.total);
                        const pct = (diff / ppAmt * 100).toFixed(1);
                        const daysDiff = Math.round((ppDate - new Date(dd)) / (1000 * 60 * 60 * 24));
                        const match = diff < 1 ? "✅ MATCH" : diff < ppAmt * 0.05 ? "⚠️ CLOSE" : "❌";
                        console.log(`    Disb ${dd} (${daysDiff}d): PayPal sum=${info.total.toFixed(2)}, diff=${diff.toFixed(2)} (${pct}%), ${info.count} txs ${match}`);
                    }
                } else {
                    // Try ALL payment types, not just paypal
                    const allDisbByDate = {};
                    for (const c of candidates) {
                        const cd = c.custom_data || {};
                        const dd = cd.disbursement_date;
                        if (dd) {
                            if (!allDisbByDate[dd]) allDisbByDate[dd] = { total: 0, count: 0, paypal: 0, other: 0 };
                            allDisbByDate[dd].total += parseFloat(cd.settlement_amount || c.amount || 0);
                            allDisbByDate[dd].count++;
                            const pmt = (cd.payment_method_type || cd.payment_instrument_type || "").toLowerCase();
                            if (pmt.includes("paypal")) allDisbByDate[dd].paypal++;
                            else allDisbByDate[dd].other++;
                        }
                    }
                    // Check if any disbursement date total matches
                    for (const [dd, info] of Object.entries(allDisbByDate)) {
                        const diff = Math.abs(ppAmt - info.total);
                        if (diff < ppAmt * 0.1) {
                            const daysDiff = Math.round((ppDate - new Date(dd)) / (1000 * 60 * 60 * 24));
                            console.log(`    ⚡ ALL types disb ${dd} (${daysDiff}d): total=${info.total.toFixed(2)}, diff=${diff.toFixed(2)}, ${info.count} txs (${info.paypal} paypal, ${info.other} other)`);
                        }
                    }
                    if (Object.keys(allDisbByDate).length === 0) {
                        console.log(`    ❌ Nenhum disbursement encontrado em ±7 dias`);
                    }
                }
            }
        }
    }

    console.log("\n\n═══════════════════════════════════════════════════════");
    console.log("  ANÁLISE COMPLETA");
    console.log("═══════════════════════════════════════════════════════");
}

run().catch(console.error);
