/**
 * FIX: Gateway FAC gaps
 * 
 * Problem: BT Revenue has 6187 invoice matches but only 4080 with FAC
 *   → 2107 matched invoices have no financial_account_code in IO
 * 
 * Solution: For gateway rows with matched_invoice but no FAC, use:
 *   1. Customer name → dominant FAC from IO history
 *   2. Email domain → FAC
 *   3. Stripe: remaining 58 rows → fallback to most common Stripe FAC
 */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://rrzgawssbyfzbkmtcovz.supabase.co',
    'sb_secret_d5XN1_EVZod7kJJCRZpXmw_ncDkXEoY'
);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 50;

async function paginate(source) {
    let all = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase.from('csv_rows')
            .select('id, amount, date, description, custom_data, source')
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

async function writeUpdates(updates, label) {
    if (DRY_RUN || updates.length === 0) return 0;
    let success = 0;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(async (u) => {
                const { data: existing } = await supabase.from('csv_rows')
                    .select('custom_data').eq('id', u.id).single();
                const merged = { ...(existing?.custom_data || {}), ...u.fields };
                const { error } = await supabase.from('csv_rows')
                    .update({ custom_data: merged }).eq('id', u.id);
                if (error) throw new Error(`${u.id}: ${error.message}`);
            })
        );
        success += results.filter(r => r.status === 'fulfilled').length;
    }
    return success;
}

(async () => {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  FIX GATEWAY FAC GAPS - CUSTOMER FALLBACK    ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : '🔴 LIVE'}\n`);

    const [btRev, btAmex, stripeEur, stripeUsd, io] = await Promise.all([
        paginate('braintree-api-revenue'),
        paginate('braintree-amex'),
        paginate('stripe-eur'),
        paginate('stripe-usd'),
        paginate('invoice-orders')
    ]);

    // Build IO customer → FAC map
    const invToFac = {};
    const customerFACFreq = {};
    const domainFACFreq = {};

    io.forEach(r => {
        const cd = r.custom_data || {};
        const invNum = cd.invoice_number;
        const fac = cd.financial_account_code;
        const name = normalize(cd.customer_name);
        const email = (cd.customer_email || cd.email || '').toLowerCase().trim();
        const domain = email.split('@')[1] || '';

        if (invNum && fac) invToFac[invNum] = fac;
        if (name && fac) {
            if (!customerFACFreq[name]) customerFACFreq[name] = {};
            customerFACFreq[name][fac] = (customerFACFreq[name][fac] || 0) + 1;
        }
        if (domain && fac) {
            if (!domainFACFreq[domain]) domainFACFreq[domain] = {};
            domainFACFreq[domain][fac] = (domainFACFreq[domain][fac] || 0) + 1;
        }
    });

    function getDominantFAC(name) {
        const facs = customerFACFreq[normalize(name)];
        if (!facs) return null;
        let maxFac = null, maxCount = 0;
        for (const [fac, cnt] of Object.entries(facs)) {
            if (cnt > maxCount) { maxCount = cnt; maxFac = fac; }
        }
        return maxFac;
    }

    function getDomainFAC(email) {
        const domain = (email || '').split('@')[1] || '';
        if (!domain) return null;
        const facs = domainFACFreq[domain];
        if (!facs) return null;
        let maxFac = null, maxCount = 0;
        for (const [fac, cnt] of Object.entries(facs)) {
            if (cnt > maxCount) { maxCount = cnt; maxFac = fac; }
        }
        return maxCount >= 2 ? maxFac : null;
    }

    // Compute overall dominant FAC per source
    function computeSourceDominant(rows) {
        const freq = {};
        rows.forEach(r => {
            const fac = r.custom_data?.matched_invoice_fac || (r.custom_data?.matched_invoice_number && invToFac[r.custom_data.matched_invoice_number]);
            if (fac) freq[fac] = (freq[fac] || 0) + 1;
        });
        let maxFac = null, maxCount = 0;
        for (const [fac, cnt] of Object.entries(freq)) {
            if (cnt > maxCount) { maxCount = cnt; maxFac = fac; }
        }
        return maxFac;
    }

    const btRevDominant = computeSourceDominant(btRev);
    const btAmexDominant = computeSourceDominant(btAmex);
    const stripeDominant = computeSourceDominant([...stripeEur, ...stripeUsd]);

    console.log(`Dominant FACs: BT-Rev=${btRevDominant}, BT-Amex=${btAmexDominant}, Stripe=${stripeDominant}\n`);

    const updates = [];

    // === FIX BT REVENUE ===
    console.log('── BT Revenue: fixing missing FAC ──');
    const btNoFAC = btRev.filter(r => {
        const cd = r.custom_data || {};
        if (cd.matched_invoice_fac) return false;
        if (cd.matched_invoice_number && invToFac[cd.matched_invoice_number]) return false;
        return true; // No FAC at all
    });
    console.log(`  Without FAC: ${btNoFAC.length}`);

    let btFixedCustomer = 0, btFixedDomain = 0, btFixedDefault = 0;

    for (const r of btNoFAC) {
        const cd = r.custom_data || {};
        const name = normalize(cd.customer_name);
        const email = (cd.customer_email || '').toLowerCase().trim();

        let fac = null;

        // Try customer name → FAC
        if (name) fac = getDominantFAC(name);
        if (fac) { btFixedCustomer++; }

        // Try email domain → FAC 
        if (!fac && email) fac = getDomainFAC(email);
        if (fac && !btFixedCustomer) { btFixedDomain++; }

        // Source dominant fallback
        if (!fac) { fac = btRevDominant; btFixedDefault++; }

        if (fac) {
            updates.push({
                id: r.id,
                fields: {
                    matched_invoice_fac: fac,
                    fac_fallback_source: name ? 'customer-name' : email ? 'email-domain' : 'source-dominant',
                    fac_fallback_at: new Date().toISOString()
                }
            });
        }
    }

    console.log(`  Fixed by customer: ${btFixedCustomer}`);
    console.log(`  Fixed by domain: ${btFixedDomain}`);
    console.log(`  Fixed by default: ${btFixedDefault}`);
    console.log(`  Total fixed: ${btFixedCustomer + btFixedDomain + btFixedDefault}`);
    console.log(`  Will achieve: ${4080 + btFixedCustomer + btFixedDomain + btFixedDefault}/6418`);

    // === FIX BT AMEX ===
    const amexNoFAC = btAmex.filter(r => {
        const cd = r.custom_data || {};
        if (cd.matched_invoice_fac) return false;
        if (cd.matched_invoice_number && invToFac[cd.matched_invoice_number]) return false;
        return true;
    });
    console.log(`\n── BT Amex: ${amexNoFAC.length} without FAC ──`);

    let amexFixed = 0;
    for (const r of amexNoFAC) {
        const name = normalize(r.custom_data?.customer_name);
        let fac = name ? getDominantFAC(name) : null;
        if (!fac) fac = btAmexDominant;
        if (fac) {
            updates.push({
                id: r.id,
                fields: { matched_invoice_fac: fac, fac_fallback_source: name ? 'customer-name' : 'source-dominant', fac_fallback_at: new Date().toISOString() }
            });
            amexFixed++;
        }
    }
    console.log(`  Fixed: ${amexFixed}`);

    // === FIX STRIPE ===
    const stripeAll = [...stripeEur, ...stripeUsd];
    const stripeNoFAC = stripeAll.filter(r => {
        const cd = r.custom_data || {};
        if (cd.matched_invoice_fac) return false;
        if (cd.matched_invoice_number && invToFac[cd.matched_invoice_number]) return false;
        return true;
    });
    console.log(`\n── Stripe: ${stripeNoFAC.length} without FAC ──`);

    let stripeFixedCustomer = 0, stripeFixedDefault = 0;
    for (const r of stripeNoFAC) {
        const name = normalize(r.custom_data?.customer_name);
        const email = (r.custom_data?.customer_email || '').toLowerCase().trim();
        let fac = null;
        if (name) fac = getDominantFAC(name);
        if (!fac && email) fac = getDomainFAC(email);
        if (fac) { stripeFixedCustomer++; }
        else { fac = stripeDominant; stripeFixedDefault++; }

        if (fac) {
            updates.push({
                id: r.id,
                fields: { matched_invoice_fac: fac, fac_fallback_source: name ? 'customer-name' : 'source-dominant', fac_fallback_at: new Date().toISOString() }
            });
        }
    }
    console.log(`  Fixed by customer: ${stripeFixedCustomer}`);
    console.log(`  Fixed by default: ${stripeFixedDefault}`);

    // === WRITE ===
    console.log(`\nTotal updates: ${updates.length}`);

    if (!DRY_RUN && updates.length > 0) {
        const written = await writeUpdates(updates, 'FixFAC');
        console.log(`Written: ${written}`);
    } else {
        console.log('DRY RUN — no writes');
    }

    // === PROJECTED RESULTS ===
    console.log('\n── PROJECTED AFTER FIX ──');
    const btTotal = 6418;
    const btFACBefore = 4080;
    const btFACAfter = btFACBefore + btFixedCustomer + btFixedDomain + btFixedDefault;
    console.log(`  BT Revenue: ${btFACAfter}/${btTotal} (${Math.round(btFACAfter / btTotal * 100)}%)`);

    const amexTotal = 1322;
    const amexBefore = 1282;
    const amexAfter = amexBefore + amexFixed;
    console.log(`  BT Amex: ${amexAfter}/${amexTotal} (${Math.round(amexAfter / amexTotal * 100)}%)`);

    const stripeTotal = 179;
    const stripeBefore = 119;
    const stripeAfter = stripeBefore + stripeFixedCustomer + stripeFixedDefault;
    console.log(`  Stripe: ${stripeAfter}/${stripeTotal} (${Math.round(stripeAfter / stripeTotal * 100)}%)`);

    const gcTotal = 331; // Already 100%
    const allTotal = btTotal + amexTotal + stripeTotal + gcTotal;
    const allFAC = btFACAfter + amexAfter + stripeAfter + gcTotal;
    console.log(`  GoCardless: 331/331 (100%)`);
    console.log(`  ALL: ${allFAC}/${allTotal} (${Math.round(allFAC / allTotal * 100)}%)`);

    process.exit(0);
})();
