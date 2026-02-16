/**
 * Deep analysis of Stripe and GoCardless data to improve matching strategies
 */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://rrzgawssbyfzbkmtcovz.supabase.co',
    'sb_secret_d5XN1_EVZod7kJJCRZpXmw_ncDkXEoY'
);

async function paginate(source) {
    let all = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase.from('csv_rows')
            .select('id, amount, date, description, reconciled, custom_data, source')
            .eq('source', source).range(page * 1000, (page + 1) * 1000 - 1);
        if (error) break;
        if (!data || data.length === 0) break;
        all.push(...data);
        page++;
        if (page > 60) break;
    }
    return all;
}

function normalize(str) {
    if (!str) return '';
    return str.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
}

(async () => {
    console.log('Deep Gap Analysis...\n');

    const stripeEur = await paginate('stripe-eur');
    const stripeUsd = await paginate('stripe-usd');
    const gc = await paginate('gocardless');
    const io = await paginate('invoice-orders');

    const stripeAll = [...stripeEur, ...stripeUsd];

    // === STRIPE ANALYSIS ===
    console.log('═══ STRIPE UNMATCHED ANALYSIS ═══\n');

    // Build IO indexes
    const ioEmails = new Set();
    const ioNames = new Set();
    const ioAmountMap = {};
    io.forEach(r => {
        const cd = r.custom_data || {};
        const email = (cd.customer_email || cd.email || '').toLowerCase().trim();
        const name = normalize(cd.customer_name);
        if (email) ioEmails.add(email);
        if (name) ioNames.add(name);
        const amt = Math.abs(parseFloat(r.amount) || 0);
        if (amt > 0) {
            const key = Math.round(amt);
            if (!ioAmountMap[key]) ioAmountMap[key] = [];
            ioAmountMap[key].push(r);
        }
    });

    const unmatched = stripeAll.filter(r => !r.custom_data?.matched_invoice_number);
    console.log(`Total unmatched Stripe: ${unmatched.length}\n`);

    // Analyze why they don't match
    let noEmail = 0, noName = 0, emailNotInIO = 0, nameNotInIO = 0;
    let emailInIO = 0, nameInIO = 0;
    let noAmountMatch = 0, amountInIO = 0;
    const unmatchedDetails = [];

    for (const st of unmatched) {
        const email = (st.custom_data?.customer_email || '').toLowerCase().trim();
        const name = normalize(st.custom_data?.customer_name);
        const amount = Math.abs(parseFloat(st.amount) || 0);
        const amtKey = Math.round(amount);

        const hasEmail = !!email;
        const hasName = name.length > 2;
        const emailExists = ioEmails.has(email);
        const nameExists = ioNames.has(name);
        const amtExists = !!ioAmountMap[amtKey] || !!ioAmountMap[amtKey - 1] || !!ioAmountMap[amtKey + 1];

        if (!hasEmail) noEmail++;
        if (!hasName) noName++;
        if (hasEmail && !emailExists) emailNotInIO++;
        if (hasName && !nameExists) nameNotInIO++;
        if (hasEmail && emailExists) emailInIO++;
        if (hasName && nameExists) nameInIO++;
        if (amtExists) amountInIO++;
        else noAmountMatch++;

        unmatchedDetails.push({ email, name, amount, hasEmail, hasName, emailExists, nameExists, amtExists, source: st.source });
    }

    console.log(`  No email: ${noEmail}`);
    console.log(`  No name: ${noName}`);
    console.log(`  Email NOT in IO: ${emailNotInIO}`);
    console.log(`  Name NOT in IO: ${nameNotInIO}`);
    console.log(`  Email IN IO: ${emailInIO}`);
    console.log(`  Name IN IO: ${nameInIO}`);
    console.log(`  Amount match possible: ${amountInIO}`);
    console.log(`  No amount match: ${noAmountMatch}\n`);

    // Sample unmatched with emails not in IO
    console.log('  Sample Stripe emails NOT in IO:');
    const emailNotInIOSample = unmatchedDetails.filter(d => d.hasEmail && !d.emailExists).slice(0, 10);
    emailNotInIOSample.forEach(d => console.log(`    ${d.email} | ${d.name} | ${d.amount}`));

    console.log('\n  Sample Stripe names NOT in IO:');
    const nameNotInIOSample = unmatchedDetails.filter(d => d.hasName && !d.nameExists).slice(0, 10);
    nameNotInIOSample.forEach(d => console.log(`    "${d.name}" | ${d.email} | ${d.amount}`));

    // Check partial name matches
    console.log('\n  Partial name match analysis (Stripe name CONTAINS IO name):');
    let partialMatches = 0;
    const partialExamples = [];
    for (const d of unmatchedDetails.filter(x => x.hasName && !x.nameExists)) {
        for (const ioName of ioNames) {
            if (ioName.length >= 4 && (d.name.includes(ioName) || ioName.includes(d.name))) {
                partialMatches++;
                if (partialExamples.length < 10) partialExamples.push(`"${d.name}" ~ "${ioName}"`);
                break;
            }
        }
    }
    console.log(`  Partial matches found: ${partialMatches}`);
    partialExamples.forEach(e => console.log(`    ${e}`));

    // === GOCARDLESS ANALYSIS ===
    console.log('\n═══ GOCARDLESS UNMATCHED ANALYSIS ═══\n');

    const gcUnmatched = gc.filter(r => !r.custom_data?.matched_invoice_number);
    // Check what the remaining GC look like after dry run
    // Since dry run doesn't write, all are still unmatched, but the 216 that WOULD match we can skip

    // Analyze amount ranges
    const amountBuckets = {};
    gc.forEach(g => {
        const amt = Math.abs(parseFloat(g.amount) || 0);
        const bucket = Math.round(amt / 100) * 100;
        amountBuckets[bucket] = (amountBuckets[bucket] || 0) + 1;
    });

    console.log('  Amount distribution (buckets of 100):');
    Object.entries(amountBuckets).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([b, c]) => {
        console.log(`    ${b}-${parseInt(b) + 99}: ${c} txs`);
    });

    // Check date range
    const gcDates = gc.map(g => g.date).filter(Boolean).sort();
    console.log(`\n  Date range: ${gcDates[0]} to ${gcDates[gcDates.length - 1]}`);

    // Check IO date range
    const ioDates = io.map(r => r.date).filter(Boolean).sort();
    console.log(`  IO date range: ${ioDates[0]} to ${ioDates[ioDates.length - 1]}`);

    // Check overlap by finding GC amounts that exist in IO
    let gcAmtInIO = 0, gcAmtNotInIO = 0;
    for (const g of gc) {
        const amt = Math.abs(parseFloat(g.amount) || 0);
        const key = Math.round(amt);
        const exists = !!ioAmountMap[key] || !!ioAmountMap[key - 1] || !!ioAmountMap[key + 1];
        if (exists) gcAmtInIO++;
        else gcAmtNotInIO++;
    }
    console.log(`\n  GC amount has IO match: ${gcAmtInIO}`);
    console.log(`  GC amount NO IO match: ${gcAmtNotInIO}`);

    // Check GC descriptions for patterns
    console.log('\n  GC description samples:');
    gc.slice(0, 10).forEach(g => {
        console.log(`    ${g.date} | ${g.amount} | "${g.description}" | ${JSON.stringify(g.custom_data || {}).substring(0, 100)}`);
    });

    // Check GC custom_data fields
    const gcFields = {};
    gc.forEach(g => {
        Object.keys(g.custom_data || {}).forEach(k => {
            gcFields[k] = (gcFields[k] || 0) + 1;
        });
    });
    console.log('\n  GC custom_data fields:');
    Object.entries(gcFields).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

    // Check GC currencies
    const gcCurrencies = {};
    gc.forEach(g => {
        const curr = g.custom_data?.currency || 'unknown';
        gcCurrencies[curr] = (gcCurrencies[curr] || 0) + 1;
    });
    console.log('\n  GC currencies:', gcCurrencies);

    // Check GC statuses
    const gcStatuses = {};
    gc.forEach(g => {
        const st = g.custom_data?.status || 'unknown';
        gcStatuses[st] = (gcStatuses[st] || 0) + 1;
    });
    console.log('  GC statuses:', gcStatuses);

    // What data does GC have that can help match?
    // Check payout_id uniqueness
    const payoutIds = new Set();
    gc.forEach(g => { if (g.custom_data?.payout_id) payoutIds.add(g.custom_data.payout_id); });
    console.log(`\n  Unique payout_ids: ${payoutIds.size}`);

    // Number of GC per payout
    const perPayout = {};
    gc.forEach(g => {
        const pid = g.custom_data?.payout_id || 'none';
        perPayout[pid] = (perPayout[pid] || 0) + 1;
    });
    const payoutSizes = Object.values(perPayout);
    console.log(`  Avg GC per payout: ${(payoutSizes.reduce((a, b) => a + b, 0) / payoutSizes.length).toFixed(1)}`);
    console.log(`  Max GC per payout: ${Math.max(...payoutSizes)}`);

    // Payout amounts vs bank GC rows
    console.log('\n  Top payouts by tx count:');
    Object.entries(perPayout).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([pid, cnt]) => {
        const txs = gc.filter(g => g.custom_data?.payout_id === pid);
        const total = txs.reduce((s, t) => s + Math.abs(parseFloat(t.amount) || 0), 0);
        console.log(`    ${pid}: ${cnt} txs, total=${total.toFixed(2)}, date=${txs[0]?.date}`);
    });

    // Deep dive: for the ~115 GC that WON'T match by amount+date, why?
    // Simulate the matching
    let wouldMatch = 0, wouldNotMatch = 0;
    const noMatchReasons = { noAmtInIO: 0, noDateClose: 0, exactMatchTaken: 0 };
    const gcUsedIDs = new Set();

    for (const g of gc) {
        const amount = Math.abs(parseFloat(g.amount) || 0);
        if (amount < 10) { wouldNotMatch++; noMatchReasons.noAmtInIO++; continue; }

        const amtKey = Math.round(amount);
        let candidates = [];
        for (let d = -2; d <= 2; d++) {
            candidates.push(...(ioAmountMap[amtKey + d] || []));
        }

        let found = false;
        for (const o of candidates) {
            if (gcUsedIDs.has(o.id)) continue;
            const invNum = o.custom_data?.invoice_number;
            if (!invNum) continue;
            const oAmt = Math.abs(parseFloat(o.amount) || 0);
            if (Math.abs(amount - oAmt) > 2) continue;
            const days = g.date && o.date ? Math.abs(new Date(g.date) - new Date(o.date)) / 86400000 : 999;
            if (days > 15) continue;
            gcUsedIDs.add(o.id);
            found = true;
            wouldMatch++;
            break;
        }

        if (!found) {
            wouldNotMatch++;
            // Why not?
            if (candidates.length === 0) noMatchReasons.noAmtInIO++;
            else noMatchReasons.noDateClose++;
        }
    }

    console.log(`\n  GC matching simulation: would match ${wouldMatch}, no match ${wouldNotMatch}`);
    console.log(`  No match reasons:`, noMatchReasons);

    // Check date range for unmatched GC
    console.log('\n  Unmatched GC by month:');
    const gcNoMatchByMonth = {};
    for (const g of gc) {
        const amount = Math.abs(parseFloat(g.amount) || 0);
        const amtKey = Math.round(amount);
        let candidates = [];
        for (let d = -2; d <= 2; d++) {
            candidates.push(...(ioAmountMap[amtKey + d] || []));
        }
        const hasClose = candidates.some(o => {
            const days = g.date && o.date ? Math.abs(new Date(g.date) - new Date(o.date)) / 86400000 : 999;
            return days <= 15;
        });
        if (!hasClose) {
            const month = (g.date || '').substring(0, 7);
            gcNoMatchByMonth[month] = (gcNoMatchByMonth[month] || 0) + 1;
        }
    }
    Object.entries(gcNoMatchByMonth).sort().forEach(([m, c]) => console.log(`    ${m}: ${c}`));

    // Check if wider date window or looser amount helps
    let match30d = 0, match45d = 0, match60d = 0;
    for (const g of gc) {
        const amount = Math.abs(parseFloat(g.amount) || 0);
        const amtKey = Math.round(amount);
        let candidates = [];
        for (let d = -5; d <= 5; d++) {
            candidates.push(...(ioAmountMap[amtKey + d] || []));
        }
        for (const o of candidates) {
            const oAmt = Math.abs(parseFloat(o.amount) || 0);
            if (Math.abs(amount - oAmt) > 5) continue;
            const days = g.date && o.date ? Math.abs(new Date(g.date) - new Date(o.date)) / 86400000 : 999;
            if (days <= 30) { match30d++; break; }
            if (days <= 45) { match45d++; break; }
            if (days <= 60) { match60d++; break; }
        }
    }
    console.log(`\n  Wider windows: 30d=${match30d}, 45d=${match45d}, 60d=${match60d}`);

    process.exit(0);
})();
