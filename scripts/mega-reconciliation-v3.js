/**
 * MEGA RECONCILIATION V3 - ALL GATEWAYS - ENHANCED
 * 
 * Key improvements over V2:
 *  - GC: 30-day window (was 15), wider amount tolerance
 *  - Stripe: partial name matching, email domain matching, customer FAC fallback
 *  - Bank: direct P&L for paymentSource rows without full chain
 *  - Customer history: broader fallback using dominant FAC from IO
 *  - Description patterns: more bank description patterns for P&L
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
            .select('id, amount, date, description, reconciled, custom_data, source')
            .eq('source', source).range(page * 1000, (page + 1) * 1000 - 1);
        if (error) { console.error('Paginate error:', error.message); break; }
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

function normalizeAmount(str) {
    return Math.abs(parseFloat(str) || 0);
}

function daysDiff(d1, d2) {
    if (!d1 || !d2) return 999;
    return Math.abs(new Date(d1).getTime() - new Date(d2).getTime()) / 86400000;
}

function getWords(name) {
    return name.split(/\s+/).filter(w => w.length >= 3);
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
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length > 0) console.error(`  [${label}] batch ${Math.floor(i / BATCH_SIZE)}: ${failed.length} failures`);
    }
    return success;
}

(async () => {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  MEGA RECONCILIATION V3 - ENHANCED ALL-GATEWAY MATCHING  ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : '🔴 LIVE — WRITING TO DB'}\n`);

    // Load all data
    console.log('[LOAD] Loading all data...');
    const [btRev, btAmex, stripeEur, stripeUsd, gc, io, bankEur, chaseUsd, btDisb] = await Promise.all([
        paginate('braintree-api-revenue'),
        paginate('braintree-amex'),
        paginate('stripe-eur'),
        paginate('stripe-usd'),
        paginate('gocardless'),
        paginate('invoice-orders'),
        paginate('bankinter-eur'),
        paginate('chase-usd'),
        paginate('braintree-api-disbursement')
    ]);
    console.log(`  Loaded: BT=${btRev.length}, Amex=${btAmex.length}, Stripe=${stripeEur.length + stripeUsd.length}, GC=${gc.length}, IO=${io.length}, BankEUR=${bankEur.length}, Chase=${chaseUsd.length}\n`);

    // ─── Build comprehensive IO indexes ───
    const ioByName = new Map();     // normalize(name) → [rows]
    const ioByEmail = new Map();     // email → [rows]
    const ioByAmount = new Map();    // round(amount) → [rows]
    const ioByWord = new Map();      // individual words → [rows]
    const invToFac = {};             // invoice_number → FAC
    const customerFACFreq = {};      // normalize(name) → { fac: count }
    const emailToIO = {};            // email → [rows] (for domain matching)
    const domainFACFreq = {};        // email domain → { fac: count }

    io.forEach(r => {
        const cd = r.custom_data || {};
        const invNum = cd.invoice_number;
        const fac = cd.financial_account_code;
        const name = normalize(cd.customer_name);
        const amount = normalizeAmount(r.amount);
        const email = (cd.customer_email || cd.email || '').toLowerCase().trim();
        const emailDomain = email.split('@')[1] || '';

        if (invNum && fac) invToFac[invNum] = fac;

        // Name → FAC frequency
        if (name && fac) {
            if (!customerFACFreq[name]) customerFACFreq[name] = {};
            customerFACFreq[name][fac] = (customerFACFreq[name][fac] || 0) + 1;
        }

        // Domain → FAC frequency
        if (emailDomain && fac) {
            if (!domainFACFreq[emailDomain]) domainFACFreq[emailDomain] = {};
            domainFACFreq[emailDomain][fac] = (domainFACFreq[emailDomain][fac] || 0) + 1;
        }

        if (name) {
            if (!ioByName.has(name)) ioByName.set(name, []);
            ioByName.get(name).push(r);

            // Word index for fuzzy matching
            getWords(name).forEach(w => {
                if (!ioByWord.has(w)) ioByWord.set(w, new Set());
                ioByWord.get(w).add(name);
            });
        }

        if (email) {
            if (!ioByEmail.has(email)) ioByEmail.set(email, []);
            ioByEmail.get(email).push(r);
        }

        if (amount > 0) {
            const key = Math.round(amount);
            if (!ioByAmount.has(key)) ioByAmount.set(key, []);
            ioByAmount.get(key).push(r);
        }
    });

    console.log(`[INDEX] IO: ${ioByName.size} names, ${ioByEmail.size} emails, ${ioByAmount.size} amounts, ${ioByWord.size} words, ${Object.keys(invToFac).length} inv→FAC`);

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
        return maxCount >= 2 ? maxFac : null; // Only if domain appears 2+ times
    }

    // Find fuzzy name matches via word overlap
    function fuzzyNameMatch(name) {
        if (!name || name.length < 4) return [];
        const words = getWords(name);
        if (words.length === 0) return [];

        // Collect IO names that share words
        const nameScores = new Map();
        for (const w of words) {
            const ioNames = ioByWord.get(w) || new Set();
            for (const ioName of ioNames) {
                nameScores.set(ioName, (nameScores.get(ioName) || 0) + 1);
            }
        }

        // Filter by word overlap ratio
        const results = [];
        for (const [ioName, sharedWords] of nameScores) {
            const ioWords = getWords(ioName);
            const overlapRatio = sharedWords / Math.max(words.length, ioWords.length);
            if (overlapRatio >= 0.5 && sharedWords >= 1) {
                results.push({ name: ioName, score: overlapRatio });
            }
        }
        return results.sort((a, b) => b.score - a.score);
    }

    // Comprehensive IO match finder
    function findBestIOMatch(name, email, amount, date, options = {}) {
        const { maxDays = 365, amountTolerance = 0.05, minAmtTolerance = 2 } = options;
        let best = null;
        let bestScore = Infinity;
        let strategy = '';
        const toleranceAmt = Math.max(amount * amountTolerance, minAmtTolerance);

        // S1: email + amount (±5% or ±2)
        if (email) {
            const candidates = ioByEmail.get(email) || [];
            for (const o of candidates) {
                const invNum = o.custom_data?.invoice_number;
                if (!invNum || !invToFac[invNum]) continue;
                const oAmt = normalizeAmount(o.amount);
                if (oAmt === 0) continue;
                const amtDiff = Math.abs(amount - oAmt);
                if (amtDiff <= toleranceAmt) {
                    const days = daysDiff(date, o.date);
                    const score = amtDiff + days * 0.1;
                    if (score < bestScore) { bestScore = score; best = o; strategy = 'email+amount'; }
                }
            }
            if (best) return { match: best, strategy, confidence: 0.92 };
        }

        // S2: email + closest date
        if (email) {
            bestScore = Infinity; best = null;
            const candidates = ioByEmail.get(email) || [];
            for (const o of candidates) {
                const invNum = o.custom_data?.invoice_number;
                if (!invNum || !invToFac[invNum]) continue;
                const days = daysDiff(date, o.date);
                if (days < bestScore) { bestScore = days; best = o; strategy = 'email+date'; }
            }
            if (best && bestScore <= maxDays) return { match: best, strategy, confidence: 0.78 };
        }

        // S3: exact name + amount
        if (name && name.length >= 3) {
            bestScore = Infinity; best = null;
            const candidates = ioByName.get(name) || [];
            for (const o of candidates) {
                const invNum = o.custom_data?.invoice_number;
                if (!invNum || !invToFac[invNum]) continue;
                const oAmt = normalizeAmount(o.amount);
                if (oAmt === 0) continue;
                const amtDiff = Math.abs(amount - oAmt);
                if (amtDiff <= toleranceAmt) {
                    const days = daysDiff(date, o.date);
                    const score = amtDiff + days * 0.1;
                    if (score < bestScore) { bestScore = score; best = o; strategy = 'name+amount'; }
                }
            }
            if (best) return { match: best, strategy, confidence: 0.88 };
        }

        // S4: exact name + closest date
        if (name && name.length >= 3) {
            bestScore = Infinity; best = null;
            const candidates = ioByName.get(name) || [];
            for (const o of candidates) {
                const invNum = o.custom_data?.invoice_number;
                if (!invNum || !invToFac[invNum]) continue;
                const days = daysDiff(date, o.date);
                if (days < bestScore) { bestScore = days; best = o; strategy = 'name+date'; }
            }
            if (best && bestScore <= maxDays) return { match: best, strategy, confidence: bestScore <= 30 ? 0.72 : 0.55 };
        }

        // S5: fuzzy name + amount
        if (name && name.length >= 4) {
            bestScore = Infinity; best = null;
            const fuzzyNames = fuzzyNameMatch(name);
            for (const fn of fuzzyNames.slice(0, 5)) {
                const candidates = ioByName.get(fn.name) || [];
                for (const o of candidates) {
                    const invNum = o.custom_data?.invoice_number;
                    if (!invNum || !invToFac[invNum]) continue;
                    const oAmt = normalizeAmount(o.amount);
                    if (oAmt === 0) continue;
                    const amtDiff = Math.abs(amount - oAmt);
                    if (amtDiff <= toleranceAmt) {
                        const score = amtDiff + daysDiff(date, o.date) * 0.1;
                        if (score < bestScore) { bestScore = score; best = o; strategy = `fuzzy-name+amount(${fn.name})`; }
                    }
                }
            }
            if (best) return { match: best, strategy, confidence: 0.70 };
        }

        // S6: fuzzy name only (for FAC fallback)
        if (name && name.length >= 4) {
            const fuzzyNames = fuzzyNameMatch(name);
            for (const fn of fuzzyNames.slice(0, 3)) {
                const candidates = ioByName.get(fn.name) || [];
                const withFac = candidates.find(o => o.custom_data?.invoice_number && invToFac[o.custom_data.invoice_number]);
                if (withFac) {
                    return { match: withFac, strategy: `fuzzy-name(${fn.name})`, confidence: 0.50 };
                }
            }
        }

        return null;
    }

    const allStats = {};

    // ════════════════════════════════════════════════════════
    // PHASE 1: STRIPE → INVOICE-ORDERS
    // ════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════');
    console.log('  PHASE 1: STRIPE → INVOICE-ORDERS');
    console.log('════════════════════════════════════════════\n');

    const stripeAll = [...stripeEur, ...stripeUsd];
    const stripeUnmatched = stripeAll.filter(r => !r.custom_data?.matched_invoice_number);
    let stripeMatched = 0;
    let stripeCustomerFAC = 0;
    const stripeUpdates = [];
    const stripeStrategyCounts = {};

    for (const st of stripeUnmatched) {
        const email = (st.custom_data?.customer_email || '').toLowerCase().trim();
        const name = normalize(st.custom_data?.customer_name);
        const amount = normalizeAmount(st.amount);

        const result = findBestIOMatch(name, email, amount, st.date);
        if (result) {
            const invNum = result.match.custom_data?.invoice_number;
            stripeUpdates.push({
                id: st.id,
                fields: {
                    matched_invoice_number: invNum,
                    matched_invoice_fac: invToFac[invNum],
                    reconciliation_strategy: result.strategy,
                    reconciliation_confidence: result.confidence,
                    reconciled_at: new Date().toISOString(),
                    matched_customer: result.match.custom_data?.customer_name || '',
                    reconciliationType: 'stripe-orders-v3'
                }
            });
            stripeMatched++;
            const sKey = result.strategy.split('(')[0]; // Group fuzzy variants
            stripeStrategyCounts[sKey] = (stripeStrategyCounts[sKey] || 0) + 1;
        } else {
            // Fallback: assign FAC from customer name/email history without specific invoice match
            let fallbackFAC = null;

            // Try email domain → FAC
            if (email) fallbackFAC = getDomainFAC(email);

            // Try name → dominant FAC
            if (!fallbackFAC && name) fallbackFAC = getDominantFAC(name);

            // Try fuzzy name → FAC
            if (!fallbackFAC && name) {
                const fuzzyNames = fuzzyNameMatch(name);
                for (const fn of fuzzyNames.slice(0, 3)) {
                    fallbackFAC = getDominantFAC(fn.name);
                    if (fallbackFAC) break;
                }
            }

            if (fallbackFAC) {
                stripeUpdates.push({
                    id: st.id,
                    fields: {
                        matched_invoice_fac: fallbackFAC,
                        reconciliation_strategy: 'customer-fac-fallback',
                        reconciliation_confidence: 0.45,
                        reconciled_at: new Date().toISOString(),
                        reconciliationType: 'stripe-fac-fallback-v3'
                    }
                });
                stripeCustomerFAC++;
            }
        }
    }

    const stripeAlready = stripeAll.length - stripeUnmatched.length;
    const stripeTotalMatch = stripeAlready + stripeMatched + stripeCustomerFAC;
    console.log(`  Stripe total: ${stripeAll.length}`);
    console.log(`  Already matched: ${stripeAlready}`);
    console.log(`  New invoice matches: ${stripeMatched}`);
    console.log(`  FAC fallback: ${stripeCustomerFAC}`);
    console.log(`  Strategy breakdown:`, stripeStrategyCounts);
    console.log(`  Final with FAC: ${stripeTotalMatch}/${stripeAll.length} (${Math.round(stripeTotalMatch / stripeAll.length * 100)}%)`);
    console.log(`  Still unmatched: ${stripeAll.length - stripeTotalMatch}`);

    allStats.stripe = { total: stripeAll.length, withFAC: stripeTotalMatch };

    // ════════════════════════════════════════════════════════
    // PHASE 2: GOCARDLESS → INVOICE-ORDERS (30-day window)
    // ════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════');
    console.log('  PHASE 2: GOCARDLESS → INVOICE-ORDERS');
    console.log('════════════════════════════════════════════\n');

    const gcUnmatched = gc.filter(r => !r.custom_data?.matched_invoice_number);
    let gcMatched = 0;
    let gcFACFallback = 0;
    const gcUpdates = [];
    const gcUsedIOIds = new Set();
    const gcStrategyCounts = {};

    // Strategy: Amount + date (30-day window), then amount-only with uniqueness
    for (const g of gcUnmatched) {
        const amount = normalizeAmount(g.amount);
        if (amount < 5) continue;

        // Get all IO candidates with similar amount  
        const amtKey = Math.round(amount);
        const candidates = [];
        for (let d = -5; d <= 5; d++) {
            (ioByAmount.get(amtKey + d) || []).forEach(c => {
                if (!gcUsedIOIds.has(c.id)) candidates.push(c);
            });
        }

        let best = null;
        let bestScore = Infinity;
        let strategy = '';

        // Pass 1: amount + date within 30 days
        for (const o of candidates) {
            const invNum = o.custom_data?.invoice_number;
            if (!invNum || !invToFac[invNum]) continue;
            const oAmt = normalizeAmount(o.amount);
            const amtDiff = Math.abs(amount - oAmt);
            if (amtDiff > 5) continue;

            const days = daysDiff(g.date, o.date);
            if (days > 30) continue;

            const score = amtDiff * 10 + days;
            if (score < bestScore) { bestScore = score; best = o; strategy = days <= 15 ? 'amount+date(15d)' : 'amount+date(30d)'; }
        }

        // Pass 2: amount only — if GC amount is relatively unique in IO (≤3 matches)
        if (!best) {
            const exactMatches = candidates.filter(o => {
                const oAmt = normalizeAmount(o.amount);
                return Math.abs(amount - oAmt) < 1 && o.custom_data?.invoice_number && invToFac[o.custom_data.invoice_number];
            });
            if (exactMatches.length >= 1 && exactMatches.length <= 3) {
                // Pick the closest by date
                for (const o of exactMatches) {
                    const days = daysDiff(g.date, o.date);
                    if (days < bestScore) { bestScore = days; best = o; strategy = 'amount-only'; }
                }
            }
        }

        if (best) {
            const invNum = best.custom_data?.invoice_number;
            gcUpdates.push({
                id: g.id,
                fields: {
                    matched_invoice_number: invNum,
                    matched_invoice_fac: invToFac[invNum],
                    reconciliation_strategy: strategy,
                    reconciliation_confidence: strategy.includes('30d') ? 0.55 : strategy === 'amount-only' ? 0.45 : 0.65,
                    reconciled_at: new Date().toISOString(),
                    matched_customer: best.custom_data?.customer_name || '',
                    reconciliationType: 'gocardless-orders-v3'
                }
            });
            gcUsedIOIds.add(best.id);
            gcMatched++;
            const sKey = strategy;
            gcStrategyCounts[sKey] = (gcStrategyCounts[sKey] || 0) + 1;
        }
    }

    // For remaining unmatched GC: use dominant FAC from matched GC customers
    // Since GC has no customer_name, check if matched GC rows reveal a customer pattern
    const gcMatchedCustomers = {};
    for (const u of gcUpdates) {
        const cust = u.fields.matched_customer;
        const fac = u.fields.matched_invoice_fac;
        if (cust && fac) {
            const key = normalize(cust);
            if (!gcMatchedCustomers[key]) gcMatchedCustomers[key] = {};
            gcMatchedCustomers[key][fac] = (gcMatchedCustomers[key][fac] || 0) + 1;
        }
    }

    // Compute global dominant FAC across all GC matches
    const gcGlobalFACFreq = {};
    gcUpdates.forEach(u => {
        const fac = u.fields.matched_invoice_fac;
        if (fac) gcGlobalFACFreq[fac] = (gcGlobalFACFreq[fac] || 0) + 1;
    });
    const gcDominantFAC = Object.entries(gcGlobalFACFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    console.log(`  GC dominant FAC across matches: ${gcDominantFAC} (${gcGlobalFACFreq[gcDominantFAC] || 0} occurrences)`);

    // Assign dominant FAC to remaining unmatched GC rows
    const gcStillUnmatched = gc.filter(g =>
        !g.custom_data?.matched_invoice_number &&
        !gcUpdates.find(u => u.id === g.id)
    );

    if (gcDominantFAC) {
        for (const g of gcStillUnmatched) {
            const amount = normalizeAmount(g.amount);
            if (amount < 5) continue;

            gcUpdates.push({
                id: g.id,
                fields: {
                    matched_invoice_fac: gcDominantFAC,
                    reconciliation_strategy: 'gc-dominant-fac-fallback',
                    reconciliation_confidence: 0.35,
                    reconciled_at: new Date().toISOString(),
                    reconciliationType: 'gocardless-fac-fallback-v3'
                }
            });
            gcFACFallback++;
        }
    }

    const gcAlready = gc.length - gcUnmatched.length;
    const gcTotalMatch = gcAlready + gcMatched + gcFACFallback;
    console.log(`  GC total: ${gc.length}`);
    console.log(`  Already matched: ${gcAlready}`);
    console.log(`  New invoice matches: ${gcMatched}`);
    console.log(`  FAC fallback: ${gcFACFallback}`);
    console.log(`  Strategy breakdown:`, gcStrategyCounts);
    console.log(`  Final with FAC: ${gcTotalMatch}/${gc.length} (${Math.round(gcTotalMatch / gc.length * 100)}%)`);
    console.log(`  Still unmatched: ${gc.length - gcTotalMatch}`);

    allStats.gocardless = { total: gc.length, withFAC: gcTotalMatch };

    // ════════════════════════════════════════════════════════
    // PHASE 3: BANK → GATEWAY TRANSACTION LINKING
    // ════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════');
    console.log('  PHASE 3: BANK → GATEWAY LINKING + P&L');
    console.log('════════════════════════════════════════════\n');

    const allBT = [...btRev, ...btAmex];
    const allGW = [...allBT, ...stripeAll, ...gc];

    // Build tx → FAC lookup from ALL gateway data (including new matches)
    const gwTxToFAC = {};
    const gwTxToCustomer = {};

    // First, apply our new matches to the lookup
    const allGWUpdates = [...stripeUpdates, ...gcUpdates];
    const updateFACMap = {};
    allGWUpdates.forEach(u => {
        if (u.fields.matched_invoice_fac) updateFACMap[u.id] = u.fields.matched_invoice_fac;
    });

    allGW.forEach(r => {
        const txId = r.custom_data?.transaction_id || r.custom_data?.gocardless_id || r.custom_data?.payment_id;
        if (!txId) return;

        // Check our new matches first
        let fac = updateFACMap[r.id] || r.custom_data?.matched_invoice_fac || null;
        if (!fac && r.custom_data?.matched_invoice_number) fac = invToFac[r.custom_data.matched_invoice_number];

        // Customer → dominant FAC fallback
        if (!fac) {
            const name = normalize(r.custom_data?.customer_name);
            if (name) {
                fac = getDominantFAC(name);
                if (name && r.custom_data?.customer_name) gwTxToCustomer[txId] = r.custom_data.customer_name;
            }
        }

        if (fac) gwTxToFAC[txId] = fac;
    });

    console.log(`  Gateway TX→FAC lookup: ${Object.keys(gwTxToFAC).length} entries`);

    // Build date-indexed lookups for bank→gateway matching 
    const btByDisbDate = new Map();
    allBT.forEach(r => {
        const key = (r.custom_data?.disbursement_date || '').substring(0, 10);
        if (key) { if (!btByDisbDate.has(key)) btByDisbDate.set(key, []); btByDisbDate.get(key).push(r); }
    });

    const stripeByDate = new Map();
    stripeAll.forEach(r => {
        const key = (r.custom_data?.available_on || r.custom_data?.created || r.date || '').substring(0, 10);
        if (key) { if (!stripeByDate.has(key)) stripeByDate.set(key, []); stripeByDate.get(key).push(r); }
    });

    const gcByDate = new Map();
    gc.forEach(r => {
        const key = (r.date || '').substring(0, 10);
        if (key) { if (!gcByDate.has(key)) gcByDate.set(key, []); gcByDate.get(key).push(r); }
    });

    const disbByDate = new Map();
    btDisb.forEach(r => {
        const key = (r.date || '').substring(0, 10);
        if (key) { if (!disbByDate.has(key)) disbByDate.set(key, []); disbByDate.get(key).push(r); }
    });

    // Process all bank inflows
    const bankUpdates = [];
    const allBankInflows = [
        ...bankEur.filter(r => parseFloat(r.amount) > 0),
        ...chaseUsd.filter(r => parseFloat(r.amount) > 0)
    ];

    const bankStats = { stripe: 0, gc: 0, paypal: 0, amex: 0, btDirect: 0, customerMatch: 0, descPattern: 0, gwHistory: 0 };

    for (const bank of allBankInflows) {
        // Skip if already has P&L
        if (bank.custom_data?.pnl_line || bank.custom_data?.pnl_fac) continue;

        // Check existing tx_ids chain
        const existingTxIds = bank.custom_data?.transaction_ids || [];
        let chainComplete = false;
        let chainFAC = null;

        for (const txId of existingTxIds) {
            if (gwTxToFAC[txId]) { chainFAC = gwTxToFAC[txId]; chainComplete = true; break; }
        }

        if (chainComplete && chainFAC) {
            bankUpdates.push({
                id: bank.id,
                fields: { pnl_fac: chainFAC, pnl_source: 'existing-chain-v3', reconciliationType: 'bank-chain-v3' }
            });
            bankStats.btDirect++;
            continue;
        }

        const ps = (bank.custom_data?.paymentSource || '').toLowerCase();
        const desc = (bank.description || '').toLowerCase();
        const bankAmt = parseFloat(bank.amount);
        const bankDate = bank.date;

        // ─── STRIPE bank rows ───
        if (ps.includes('stripe') || desc.includes('stripe')) {
            let found = false;

            // Try matching bank payout to Stripe txs by date sum
            for (let delta = -5; delta <= 5; delta++) {
                const d = new Date(bankDate);
                d.setDate(d.getDate() + delta);
                const key = d.toISOString().substring(0, 10);
                const txs = stripeByDate.get(key) || [];

                // Sum
                const dayTotal = txs.reduce((s, t) => s + normalizeAmount(t.amount), 0);
                if (dayTotal > 0 && Math.abs(dayTotal - bankAmt) < Math.max(bankAmt * 0.03, 5)) {
                    const txIds = txs.map(t => t.custom_data?.transaction_id).filter(Boolean);
                    let fac = null;
                    for (const t of txs) {
                        fac = updateFACMap[t.id] || t.custom_data?.matched_invoice_fac || (t.custom_data?.matched_invoice_number && invToFac[t.custom_data.matched_invoice_number]);
                        if (fac) break;
                    }

                    const fields = { paymentSource: 'Stripe', reconciliationType: 'bank-stripe-v3' };
                    if (txIds.length) fields.transaction_ids = txIds;
                    if (fac) fields.pnl_fac = fac;
                    bankUpdates.push({ id: bank.id, fields });
                    bankStats.stripe++;
                    found = true;
                    break;
                }

                // Individual tx match
                for (const t of txs) {
                    const tAmt = normalizeAmount(t.amount);
                    if (Math.abs(tAmt - bankAmt) < Math.max(bankAmt * 0.02, 2)) {
                        const txId = t.custom_data?.transaction_id;
                        const fac = updateFACMap[t.id] || gwTxToFAC[txId] || t.custom_data?.matched_invoice_fac;

                        const fields = { paymentSource: 'Stripe', reconciliationType: 'bank-stripe-v3' };
                        if (txId) fields.transaction_ids = [txId];
                        if (fac) fields.pnl_fac = fac;
                        bankUpdates.push({ id: bank.id, fields });
                        bankStats.stripe++;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (found) continue;
        }

        // ─── GOCARDLESS bank rows ───
        if (ps.includes('gocardless') || desc.includes('gocardless') || desc.includes('go cardless')) {
            let found = false;

            for (let delta = -5; delta <= 5; delta++) {
                const d = new Date(bankDate);
                d.setDate(d.getDate() + delta);
                const key = d.toISOString().substring(0, 10);
                const txs = gcByDate.get(key) || [];

                // Sum match
                const dayTotal = txs.reduce((s, t) => s + normalizeAmount(t.amount), 0);
                if (dayTotal > 0 && Math.abs(dayTotal - bankAmt) < Math.max(bankAmt * 0.05, 10)) {
                    const txIds = txs.map(t => t.custom_data?.gocardless_id || t.custom_data?.payment_id).filter(Boolean);
                    let fac = null;
                    for (const t of txs) {
                        fac = updateFACMap[t.id] || t.custom_data?.matched_invoice_fac;
                        if (fac) break;
                    }
                    if (!fac) fac = gcDominantFAC;

                    const fields = { paymentSource: 'Gocardless', reconciliationType: 'bank-gc-v3' };
                    if (txIds.length) fields.gc_transaction_ids = txIds;
                    if (fac) fields.pnl_fac = fac;
                    bankUpdates.push({ id: bank.id, fields });
                    bankStats.gc++;
                    found = true;
                    break;
                }

                // Individual match
                for (const t of txs) {
                    const tAmt = normalizeAmount(t.amount);
                    if (Math.abs(tAmt - bankAmt) < Math.max(bankAmt * 0.02, 2)) {
                        const txId = t.custom_data?.gocardless_id || t.custom_data?.payment_id;
                        const fac = updateFACMap[t.id] || gwTxToFAC[txId] || t.custom_data?.matched_invoice_fac || gcDominantFAC;

                        const fields = { paymentSource: 'Gocardless', reconciliationType: 'bank-gc-v3' };
                        if (txId) fields.gc_transaction_ids = [txId];
                        if (fac) fields.pnl_fac = fac;
                        bankUpdates.push({ id: bank.id, fields });
                        bankStats.gc++;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (found) continue;
        }

        // ─── PAYPAL bank rows → BT disbursements ───
        if (ps.includes('paypal') || (desc.includes('paypal') && !desc.includes('braintree'))) {
            let found = false;

            for (let delta = -5; delta <= 5; delta++) {
                const d = new Date(bankDate);
                d.setDate(d.getDate() + delta);
                const key = d.toISOString().substring(0, 10);

                // Check BT disbursements
                const disbs = disbByDate.get(key) || [];
                for (const disb of disbs) {
                    const disbAmt = normalizeAmount(disb.amount);
                    if (Math.abs(disbAmt - bankAmt) < Math.max(bankAmt * 0.03, 5)) {
                        const txIds = disb.custom_data?.transaction_ids || [];
                        let fac = null;
                        for (const txId of txIds.slice(0, 20)) {
                            if (gwTxToFAC[txId]) { fac = gwTxToFAC[txId]; break; }
                        }

                        const fields = { paymentSource: 'paypal', reconciliationType: 'bank-paypal-v3' };
                        if (txIds.length) fields.transaction_ids = txIds.slice(0, 50);
                        if (fac) fields.pnl_fac = fac;
                        bankUpdates.push({ id: bank.id, fields });
                        bankStats.paypal++;
                        found = true;
                        break;
                    }
                }
                if (found) break;

                // Check BT revenue tx sum by disb date
                const btTxs = btByDisbDate.get(key) || [];
                if (btTxs.length > 0) {
                    const dayTotal = btTxs.reduce((s, t) => s + normalizeAmount(t.amount), 0);
                    if (Math.abs(dayTotal - bankAmt) < Math.max(bankAmt * 0.05, 10)) {
                        const txIds = btTxs.map(t => t.custom_data?.transaction_id).filter(Boolean);
                        let fac = null;
                        for (const txId of txIds.slice(0, 20)) {
                            if (gwTxToFAC[txId]) { fac = gwTxToFAC[txId]; break; }
                        }

                        const fields = { paymentSource: 'paypal', reconciliationType: 'bank-paypal-btsum-v3' };
                        if (txIds.length) fields.transaction_ids = txIds.slice(0, 50);
                        if (fac) fields.pnl_fac = fac;
                        bankUpdates.push({ id: bank.id, fields });
                        bankStats.paypal++;
                        found = true;
                        break;
                    }
                }
            }
            if (found) continue;
        }

        // ─── AMEX bank rows → BT-Amex ───
        if (ps.includes('amex') || desc.includes('american express') || desc.includes('amex')) {
            let found = false;

            for (let delta = -7; delta <= 7; delta++) {
                const d = new Date(bankDate);
                d.setDate(d.getDate() + delta);
                const key = d.toISOString().substring(0, 10);

                const amexTxs = btAmex.filter(t => {
                    const sd = (t.custom_data?.settlement_date || t.custom_data?.disbursement_date || '').substring(0, 10);
                    return sd === key;
                });

                if (amexTxs.length > 0) {
                    const dayTotal = amexTxs.reduce((s, t) => s + normalizeAmount(t.amount), 0);
                    if (Math.abs(dayTotal - bankAmt) < Math.max(bankAmt * 0.05, 10)) {
                        const txIds = amexTxs.map(t => t.custom_data?.transaction_id).filter(Boolean);
                        let fac = null;
                        for (const txId of txIds.slice(0, 20)) {
                            if (gwTxToFAC[txId]) { fac = gwTxToFAC[txId]; break; }
                        }

                        const fields = { paymentSource: 'braintree (amex)', reconciliationType: 'bank-amex-v3' };
                        if (txIds.length) fields.transaction_ids = txIds.slice(0, 50);
                        if (fac) fields.pnl_fac = fac;
                        bankUpdates.push({ id: bank.id, fields });
                        bankStats.amex++;
                        found = true;
                        break;
                    }
                }
            }
            if (found) continue;
        }

        // ─── BRAINTREE bank rows (already tagged) ───
        if (ps.includes('braintree') && !ps.includes('amex')) {
            // Find BT disbursement matching this amount+date
            let found = false;
            for (let delta = -3; delta <= 3; delta++) {
                const d = new Date(bankDate);
                d.setDate(d.getDate() + delta);
                const key = d.toISOString().substring(0, 10);
                const disbs = disbByDate.get(key) || [];
                for (const disb of disbs) {
                    const disbAmt = normalizeAmount(disb.amount);
                    if (Math.abs(disbAmt - bankAmt) < Math.max(bankAmt * 0.02, 2)) {
                        const txIds = disb.custom_data?.transaction_ids || [];
                        let fac = null;
                        for (const txId of txIds.slice(0, 20)) {
                            if (gwTxToFAC[txId]) { fac = gwTxToFAC[txId]; break; }
                        }
                        const fields = { reconciliationType: 'bank-bt-disb-v3' };
                        if (txIds.length) fields.transaction_ids = txIds.slice(0, 50);
                        if (fac) fields.pnl_fac = fac;
                        bankUpdates.push({ id: bank.id, fields });
                        bankStats.btDirect++;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (found) continue;
        }

        // ─── OTHER/UNTAGGED bank rows → Description pattern matching ───
        if (!bankUpdates.find(u => u.id === bank.id)) {
            const descLower = desc;

            // Known transfer patterns (not revenue - skip)
            const isTransfer = /transferencia|traspaso|dotacion|intragrupo|intercompany|propia cuenta|movimiento entre/i.test(descLower);
            if (isTransfer) continue;

            // Try to extract customer name from bank description
            const descClean = (bank.description || '')
                .replace(/^(transf|trans|abono|remesa|transfer|ach|wire|chips|inm|otras\s+e|otras\s+entid)[\s\/:]*/gi, '')
                .replace(/\d{2,}/g, '') // Remove numbers
                .replace(/\s{2,}/g, ' ')
                .trim();

            const descNorm = normalize(descClean);
            if (descNorm.length >= 4) {
                // Direct name lookup
                if (ioByName.has(descNorm)) {
                    const candidates = ioByName.get(descNorm);
                    const withFac = candidates.find(o => o.custom_data?.invoice_number && invToFac[o.custom_data.invoice_number]);
                    if (withFac) {
                        const invNum = withFac.custom_data.invoice_number;
                        bankUpdates.push({
                            id: bank.id,
                            fields: {
                                pnl_fac: invToFac[invNum],
                                pnl_source: 'desc-exact-name',
                                matched_customer: withFac.custom_data?.customer_name,
                                reconciliationType: 'bank-desc-name-v3'
                            }
                        });
                        bankStats.customerMatch++;
                        continue;
                    }
                }

                // Fuzzy match
                const parts = descNorm.split(' ').filter(w => w.length >= 3);
                for (const [ioName, ioRows] of ioByName) {
                    if (ioName.length < 4) continue;
                    // Check if any significant words from description match IO name
                    const ioWords = getWords(ioName);
                    const matchingWords = parts.filter(p => ioWords.some(w => w === p || (w.length >= 5 && p.startsWith(w.substring(0, 4)))));
                    if (matchingWords.length >= 2 || (matchingWords.length === 1 && ioWords.length === 1 && matchingWords[0].length >= 5)) {
                        const withFac = ioRows.find(o => o.custom_data?.invoice_number && invToFac[o.custom_data.invoice_number]);
                        if (withFac) {
                            const invNum = withFac.custom_data.invoice_number;
                            bankUpdates.push({
                                id: bank.id,
                                fields: {
                                    pnl_fac: invToFac[invNum],
                                    pnl_source: 'desc-fuzzy-name',
                                    matched_customer: withFac.custom_data?.customer_name,
                                    reconciliationType: 'bank-desc-fuzzy-v3'
                                }
                            });
                            bankStats.customerMatch++;
                            break;
                        }
                    }
                }
            }
        }
    }

    // ─── PHASE 3b: Bank rows with paymentSource but still no P&L → assign gateway dominant FAC ───
    const bankAlreadyUpdated = new Set(bankUpdates.map(u => u.id));

    // Compute dominant FAC per gateway source from ALL matched data
    const btRevDominantFAC = computeDominantFAC(btRev, gwTxToFAC, invToFac, updateFACMap);
    const btAmexDominantFAC = computeDominantFAC(btAmex, gwTxToFAC, invToFac, updateFACMap);
    const stripeDominantFAC = computeDominantFAC(stripeAll, gwTxToFAC, invToFac, updateFACMap);

    console.log(`  Dominant FACs: BT-Rev=${btRevDominantFAC}, BT-Amex=${btAmexDominantFAC}, Stripe=${stripeDominantFAC}, GC=${gcDominantFAC}`);

    for (const bank of allBankInflows) {
        if (bank.custom_data?.pnl_line || bank.custom_data?.pnl_fac) continue;
        if (bankAlreadyUpdated.has(bank.id)) continue;

        const ps = (bank.custom_data?.paymentSource || '').toLowerCase();
        const desc = (bank.description || '').toLowerCase();
        let assignedFAC = null;

        if (ps.includes('paypal') || desc.includes('paypal')) assignedFAC = btRevDominantFAC;
        else if (ps.includes('amex') || desc.includes('amex')) assignedFAC = btAmexDominantFAC;
        else if (ps.includes('stripe') || desc.includes('stripe')) assignedFAC = stripeDominantFAC;
        else if (ps.includes('gocardless') || desc.includes('gocardless')) assignedFAC = gcDominantFAC;
        else if (ps.includes('braintree')) assignedFAC = btRevDominantFAC;

        // Also try: existing transaction_ids → gwTxToFAC
        if (!assignedFAC) {
            const txIds = bank.custom_data?.transaction_ids || [];
            for (const txId of txIds) {
                if (gwTxToFAC[txId]) { assignedFAC = gwTxToFAC[txId]; break; }
            }
        }

        if (assignedFAC) {
            bankUpdates.push({
                id: bank.id,
                fields: {
                    pnl_fac: assignedFAC,
                    pnl_source: 'gateway-dominant-fac',
                    reconciliationType: 'bank-gw-dominant-v3'
                }
            });
            bankStats.gwHistory++;
        }
    }

    console.log(`\n  Bank update summary:`);
    console.log(`    Stripe: +${bankStats.stripe}`);
    console.log(`    GC: +${bankStats.gc}`);
    console.log(`    PayPal: +${bankStats.paypal}`);
    console.log(`    AmEx: +${bankStats.amex}`);
    console.log(`    BT Direct: +${bankStats.btDirect}`);
    console.log(`    Customer Match: +${bankStats.customerMatch}`);
    console.log(`    Desc Pattern: +${bankStats.descPattern}`);
    console.log(`    GW History/Dominant: +${bankStats.gwHistory}`);
    console.log(`    Total: ${bankUpdates.length}`);

    // ════════════════════════════════════════════════════════
    // WRITE ALL UPDATES
    // ════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════');
    console.log('  WRITING UPDATES');
    console.log('════════════════════════════════════════════\n');

    if (!DRY_RUN) {
        if (stripeUpdates.length > 0) {
            const w = await writeUpdates(stripeUpdates, 'Stripe');
            console.log(`  Stripe: ${w}/${stripeUpdates.length} written`);
        }
        if (gcUpdates.length > 0) {
            const w = await writeUpdates(gcUpdates, 'GoCardless');
            console.log(`  GoCardless: ${w}/${gcUpdates.length} written`);
        }
        if (bankUpdates.length > 0) {
            const w = await writeUpdates(bankUpdates, 'Bank');
            console.log(`  Bank: ${w}/${bankUpdates.length} written`);
        }
    } else {
        console.log('  DRY RUN — no writes performed');
    }

    // ════════════════════════════════════════════════════════
    // PROJECTED SCORECARD
    // ════════════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║           PROJECTED RECONCILIATION SCORECARD              ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // BT is already good
    const btRevMatch = btRev.filter(r => r.custom_data?.matched_invoice_number).length;
    const btAmexMatch = btAmex.filter(r => r.custom_data?.matched_invoice_number).length;

    console.log('  GATEWAY → INVOICE / FAC:');
    console.log(`    BT Revenue:   ${btRevMatch}/${btRev.length} (${Math.round(btRevMatch / btRev.length * 100)}%)`);
    console.log(`    BT Amex:      ${btAmexMatch}/${btAmex.length} (${Math.round(btAmexMatch / btAmex.length * 100)}%)`);
    console.log(`    Stripe:       ${allStats.stripe.withFAC}/${allStats.stripe.total} (${Math.round(allStats.stripe.withFAC / allStats.stripe.total * 100)}%)`);
    console.log(`    GoCardless:   ${allStats.gocardless.withFAC}/${allStats.gocardless.total} (${Math.round(allStats.gocardless.withFAC / allStats.gocardless.total * 100)}%)`);

    // Bank P&L
    const bankEurInflows = bankEur.filter(r => parseFloat(r.amount) > 0);
    const chaseInflows = chaseUsd.filter(r => parseFloat(r.amount) > 0);

    const bankEurExisting = bankEurInflows.filter(r => r.custom_data?.pnl_line || r.custom_data?.pnl_fac).length;
    const chaseExisting = chaseInflows.filter(r => r.custom_data?.pnl_line || r.custom_data?.pnl_fac).length;

    const bankEurNew = bankUpdates.filter(u => bankEurInflows.some(b => b.id === u.id)).length;
    const chaseNew = bankUpdates.filter(u => chaseInflows.some(b => b.id === u.id)).length;

    console.log('\n  BANK → P&L:');
    console.log(`    Bankinter EUR: ${bankEurExisting} existing + ${bankEurNew} new = ${bankEurExisting + bankEurNew}/${bankEurInflows.length} (${Math.round((bankEurExisting + bankEurNew) / bankEurInflows.length * 100)}%)`);
    console.log(`    Chase USD:     ${chaseExisting} existing + ${chaseNew} new = ${chaseExisting + chaseNew}/${chaseInflows.length} (${Math.round((chaseExisting + chaseNew) / chaseInflows.length * 100)}%)`);

    const totalExisting = bankEurExisting + chaseExisting;
    const totalNew = bankEurNew + chaseNew;
    const totalInflows = bankEurInflows.length + chaseInflows.length;
    console.log(`\n    TOTAL:         ${totalExisting} existing + ${totalNew} new = ${totalExisting + totalNew}/${totalInflows} (${Math.round((totalExisting + totalNew) / totalInflows * 100)}%)`);

    console.log('\n  Done!');
    process.exit(0);
})();

function computeDominantFAC(rows, gwTxToFAC, invToFac, updateFACMap) {
    const facFreq = {};
    for (const r of rows) {
        let fac = updateFACMap[r.id] || r.custom_data?.matched_invoice_fac;
        if (!fac && r.custom_data?.matched_invoice_number) fac = invToFac[r.custom_data.matched_invoice_number];
        if (!fac) {
            const txId = r.custom_data?.transaction_id;
            if (txId && gwTxToFAC[txId]) fac = gwTxToFAC[txId];
        }
        if (fac) facFreq[fac] = (facFreq[fac] || 0) + 1;
    }
    let maxFac = null, maxCount = 0;
    for (const [fac, cnt] of Object.entries(facFreq)) {
        if (cnt > maxCount) { maxCount = cnt; maxFac = fac; }
    }
    return maxFac;
}
