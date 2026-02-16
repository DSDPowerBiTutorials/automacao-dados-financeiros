/**
 * MEGA RECONCILIATION V2 - ALL GATEWAYS
 * 
 * Phase 1: Stripe → Invoice-Orders (email + name matching)
 * Phase 2: GoCardless → Invoice-Orders (amount + description matching)
 * Phase 3: Bank PayPal → BT chain (disbursement date matching)
 * Phase 4: Bank AmEx → BT-Amex chain (date + amount matching)
 * Phase 5: Bank Stripe → Stripe transactions (payout date matching)
 * Phase 6: Bank GoCardless → GC transactions (payout amount matching)
 * Phase 7: Bank "other" → Direct P&L by customer extraction
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

function daysDiff(d1, d2) {
    return Math.abs(new Date(d1).getTime() - new Date(d2).getTime()) / 86400000;
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
        if (failed.length > 0) console.error(`  [${label}] batch ${i}: ${failed.length} failures`);
    }
    return success;
}

(async () => {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║  MEGA RECONCILIATION V2 - ALL GATEWAYS, ALL CHAINS  ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

    // Load all data
    console.log('[LOAD] Loading all data...');
    const btRev = await paginate('braintree-api-revenue');
    const btAmex = await paginate('braintree-amex');
    const stripeEur = await paginate('stripe-eur');
    const stripeUsd = await paginate('stripe-usd');
    const gc = await paginate('gocardless');
    const io = await paginate('invoice-orders');
    const bankEur = await paginate('bankinter-eur');
    const chaseUsd = await paginate('chase-usd');
    const btDisb = await paginate('braintree-api-disbursement');

    console.log('  Data loaded.\n');

    // Build IO indexes
    const ioByName = new Map();
    const ioByEmail = new Map();
    const ioByAmount = new Map();
    const invToFac = {};
    const invToType = {};
    const customerFACFreq = {};

    io.forEach(r => {
        const cd = r.custom_data || {};
        const invNum = cd.invoice_number;
        const fac = cd.financial_account_code;
        const name = normalize(cd.customer_name);
        const amount = Math.abs(parseFloat(r.amount) || 0);
        const email = (cd.customer_email || cd.email || '').toLowerCase().trim();

        if (invNum && fac) { invToFac[invNum] = fac; invToType[invNum] = cd.order_type || ''; }
        if (name && fac) {
            if (!customerFACFreq[name]) customerFACFreq[name] = {};
            customerFACFreq[name][fac] = (customerFACFreq[name][fac] || 0) + 1;
        }
        if (name) {
            if (!ioByName.has(name)) ioByName.set(name, []);
            ioByName.get(name).push(r);
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

    console.log(`[INDEX] IO: ${ioByName.size} names, ${ioByEmail.size} emails, ${ioByAmount.size} amounts, ${Object.keys(invToFac).length} inv→FAC\n`);

    // Helper: find best IO match for a gateway transaction
    function findBestIOMatch(name, email, amount, date) {
        let best = null;
        let bestScore = Infinity;
        let strategy = '';

        // Strategy 1: email + amount
        if (email) {
            const candidates = ioByEmail.get(email) || [];
            for (const o of candidates) {
                const invNum = o.custom_data?.invoice_number;
                if (!invNum || !invToFac[invNum]) continue;
                const oAmt = Math.abs(parseFloat(o.amount) || 0);
                if (oAmt === 0) continue;
                const amtDiff = Math.abs(amount - oAmt);
                if (amtDiff <= Math.max(amount * 0.05, 2)) {
                    const days = date && o.date ? daysDiff(date, o.date) : 999;
                    const score = amtDiff + days * 0.1;
                    if (score < bestScore) { bestScore = score; best = o; strategy = 'email+amount'; }
                }
            }
            if (best) return { match: best, strategy, confidence: 0.90 };
        }

        // Strategy 2: email only (closest date)
        if (email) {
            const candidates = ioByEmail.get(email) || [];
            for (const o of candidates) {
                const invNum = o.custom_data?.invoice_number;
                if (!invNum || !invToFac[invNum]) continue;
                const days = date && o.date ? daysDiff(date, o.date) : 999;
                if (days < bestScore) { bestScore = days; best = o; strategy = 'email+date'; }
            }
            if (best && bestScore <= 365) return { match: best, strategy, confidence: 0.75 };
        }

        // Strategy 3: name + amount
        if (name && name.length >= 3) {
            bestScore = Infinity; best = null;
            const candidates = ioByName.get(name) || [];
            for (const o of candidates) {
                const invNum = o.custom_data?.invoice_number;
                if (!invNum || !invToFac[invNum]) continue;
                const oAmt = Math.abs(parseFloat(o.amount) || 0);
                if (oAmt === 0) continue;
                const amtDiff = Math.abs(amount - oAmt);
                if (amtDiff <= Math.max(amount * 0.02, 1)) {
                    const days = date && o.date ? daysDiff(date, o.date) : 999;
                    const score = amtDiff + days * 0.1;
                    if (score < bestScore) { bestScore = score; best = o; strategy = 'name+amount'; }
                }
            }
            if (best) return { match: best, strategy, confidence: 0.85 };
        }

        // Strategy 4: name + closest date
        if (name && name.length >= 3) {
            bestScore = Infinity; best = null;
            const candidates = ioByName.get(name) || [];
            for (const o of candidates) {
                const invNum = o.custom_data?.invoice_number;
                if (!invNum || !invToFac[invNum]) continue;
                const days = date && o.date ? daysDiff(date, o.date) : 999;
                if (days < bestScore) { bestScore = days; best = o; strategy = 'name+date'; }
            }
            if (best && bestScore <= 365) return { match: best, strategy, confidence: bestScore <= 30 ? 0.70 : 0.55 };
        }

        return null;
    }

    // Helper: get dominant FAC for a customer name
    function getDominantFAC(name) {
        const facs = customerFACFreq[normalize(name)];
        if (!facs) return null;
        let maxFac = null, maxCount = 0;
        for (const [fac, cnt] of Object.entries(facs)) {
            if (cnt > maxCount) { maxCount = cnt; maxFac = fac; }
        }
        return maxFac;
    }

    const totalStats = {};

    // ════════════════════════════════════════════════════════
    // PHASE 1: STRIPE → INVOICE-ORDERS
    // ════════════════════════════════════════════════════════
    console.log('════════════════════════════════════════════');
    console.log('  PHASE 1: STRIPE → INVOICE-ORDERS');
    console.log('════════════════════════════════════════════\n');

    const stripeAll = [...stripeEur, ...stripeUsd];
    const stripeUnmatched = stripeAll.filter(r => !r.custom_data?.matched_invoice_number);
    let stripeMatched = 0;
    const stripeUpdates = [];

    for (const st of stripeUnmatched) {
        const email = (st.custom_data?.customer_email || '').toLowerCase().trim();
        const name = normalize(st.custom_data?.customer_name);
        const amount = Math.abs(parseFloat(st.amount) || 0);

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
                    reconciliationType: 'stripe-orders-mega'
                }
            });
            stripeMatched++;
        }
    }

    const stripeAlready = stripeAll.length - stripeUnmatched.length;
    console.log(`  Stripe total: ${stripeAll.length}`);
    console.log(`  Already matched: ${stripeAlready}`);
    console.log(`  New matches: ${stripeMatched}`);
    console.log(`  Final coverage: ${stripeAlready + stripeMatched}/${stripeAll.length} (${Math.round((stripeAlready + stripeMatched) / stripeAll.length * 100)}%)`);

    if (!DRY_RUN && stripeUpdates.length > 0) {
        const written = await writeUpdates(stripeUpdates, 'Stripe');
        console.log(`  Written: ${written}`);
    }
    totalStats.stripe = { total: stripeAll.length, matched: stripeAlready + stripeMatched };

    // ════════════════════════════════════════════════════════
    // PHASE 2: GOCARDLESS → INVOICE-ORDERS
    // ════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════');
    console.log('  PHASE 2: GOCARDLESS → INVOICE-ORDERS');
    console.log('════════════════════════════════════════════\n');

    // GC has NO customer data. Try amount + date matching.
    // GC amounts are rounded (1498, 4498) which suggests subscription tiers.
    const gcUnmatched = gc.filter(r => !r.custom_data?.matched_invoice_number);
    let gcMatched = 0;
    const gcUpdates = [];
    const gcUsedIOIds = new Set();

    for (const g of gcUnmatched) {
        const amount = Math.abs(parseFloat(g.amount) || 0);
        if (amount < 10) continue;

        // Try amount + date matching with IO
        const amtKey = Math.round(amount);
        const candidates = [];
        for (let d = -2; d <= 2; d++) {
            const c = ioByAmount.get(amtKey + d) || [];
            candidates.push(...c);
        }

        let best = null;
        let bestScore = Infinity;

        for (const o of candidates) {
            if (gcUsedIOIds.has(o.id)) continue;
            const invNum = o.custom_data?.invoice_number;
            if (!invNum || !invToFac[invNum]) continue;
            const oAmt = Math.abs(parseFloat(o.amount) || 0);
            const amtDiff = Math.abs(amount - oAmt);
            if (amtDiff > 2) continue;

            const days = g.date && o.date ? daysDiff(g.date, o.date) : 999;
            if (days > 15) continue;

            const score = amtDiff * 10 + days;
            if (score < bestScore) { bestScore = score; best = o; }
        }

        if (best) {
            const invNum = best.custom_data?.invoice_number;
            gcUpdates.push({
                id: g.id,
                fields: {
                    matched_invoice_number: invNum,
                    matched_invoice_fac: invToFac[invNum],
                    reconciliation_strategy: 'amount-date',
                    reconciliation_confidence: 0.60,
                    reconciled_at: new Date().toISOString(),
                    matched_customer: best.custom_data?.customer_name || '',
                    reconciliationType: 'gocardless-orders-mega'
                }
            });
            gcUsedIOIds.add(best.id);
            gcMatched++;
        }
    }

    const gcAlready = gc.length - gcUnmatched.length;
    console.log(`  GoCardless total: ${gc.length}`);
    console.log(`  Already matched: ${gcAlready}`);
    console.log(`  New matches (amount+date): ${gcMatched}`);
    console.log(`  Final coverage: ${gcAlready + gcMatched}/${gc.length} (${Math.round((gcAlready + gcMatched) / gc.length * 100)}%)`);

    if (!DRY_RUN && gcUpdates.length > 0) {
        const written = await writeUpdates(gcUpdates, 'GoCardless');
        console.log(`  Written: ${written}`);
    }
    totalStats.gocardless = { total: gc.length, matched: gcAlready + gcMatched };

    // ════════════════════════════════════════════════════════
    // PHASE 3: BANK → GATEWAY LINKING (PayPal/Stripe/GC/AmEx)
    // ════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════');
    console.log('  PHASE 3: BANK → GATEWAY TRANSACTION LINKING');
    console.log('════════════════════════════════════════════\n');

    // Build gateway tx indexes by date and amount for matching bank rows
    // For Stripe: Match bank Stripe payouts to Stripe transactions (which reference disbursement_date)
    // For GC: Match bank GC payouts to GC transactions  
    // For PayPal/BT: Match bank paypal rows to BT disbursements by date/amount

    const allBT = [...btRev, ...btAmex];

    // Build BT tx by disbursement_date
    const btByDisbDate = new Map();
    allBT.forEach(r => {
        const disbDate = r.custom_data?.disbursement_date;
        if (disbDate) {
            const key = disbDate.substring(0, 10); // YYYY-MM-DD
            if (!btByDisbDate.has(key)) btByDisbDate.set(key, []);
            btByDisbDate.get(key).push(r);
        }
    });

    // Build Stripe tx by disbursement_date/settlement_date
    const stripeByDate = new Map();
    stripeAll.forEach(r => {
        const date = r.custom_data?.disbursement_date || r.custom_data?.settlement_date || r.date;
        if (date) {
            const key = date.substring(0, 10);
            if (!stripeByDate.has(key)) stripeByDate.set(key, []);
            stripeByDate.get(key).push(r);
        }
    });

    // Build GC tx by date
    const gcByDate = new Map();
    gc.forEach(r => {
        if (r.date) {
            const key = r.date.substring(0, 10);
            if (!gcByDate.has(key)) gcByDate.set(key, []);
            gcByDate.get(key).push(r);
        }
    });

    // Build BT disbursement index
    const disbByDate = new Map();
    btDisb.forEach(r => {
        const key = r.date?.substring(0, 10);
        if (key) {
            if (!disbByDate.has(key)) disbByDate.set(key, []);
            disbByDate.get(key).push(r);
        }
    });

    const bankUpdates = [];
    const allBankInflows = [
        ...bankEur.filter(r => parseFloat(r.amount) > 0),
        ...chaseUsd.filter(r => parseFloat(r.amount) > 0)
    ];

    let bankStripeLinked = 0, bankGCLinked = 0, bankPayPalLinked = 0, bankAmexLinked = 0, bankOtherPnl = 0;

    for (const bank of allBankInflows) {
        // Skip if already has full chain
        if (bank.custom_data?.pnl_line || bank.custom_data?.pnl_fac) continue;
        const txIds = bank.custom_data?.transaction_ids || [];
        if (txIds.length > 0) {
            // Check if chain already complete
            let complete = false;
            for (const txId of txIds) {
                const allGW = [...allBT, ...stripeAll, ...gc];
                const gwTx = allGW.find(g => g.custom_data?.transaction_id === txId);
                if (gwTx?.custom_data?.matched_invoice_fac || (gwTx?.custom_data?.matched_invoice_number && invToFac[gwTx.custom_data.matched_invoice_number])) {
                    complete = true; break;
                }
            }
            if (complete) continue;
        }

        const ps = (bank.custom_data?.paymentSource || '').toLowerCase();
        const desc = (bank.description || '').toLowerCase();
        const bankAmt = parseFloat(bank.amount);
        const bankDate = bank.date;

        // ─── STRIPE bank rows ───
        if (ps.includes('stripe') || desc.includes('stripe')) {
            // Match bank Stripe payout to Stripe transactions by summing txs around same date
            // Stripe pays out in batches — bank amount = sum of Stripe txs for that payout date
            // Try direct: find Stripe txs whose disbursement_date ≈ bank date
            const matchedTxIds = [];
            let matchedFAC = null;

            for (let delta = -3; delta <= 3; delta++) {
                const d = new Date(bankDate);
                d.setDate(d.getDate() + delta);
                const key = d.toISOString().substring(0, 10);
                const txs = stripeByDate.get(key) || [];

                // Sum amounts for this date
                const dayTotal = txs.reduce((s, t) => s + Math.abs(parseFloat(t.amount) || 0), 0);
                if (Math.abs(dayTotal - bankAmt) < Math.max(bankAmt * 0.02, 2)) {
                    txs.forEach(t => {
                        if (t.custom_data?.transaction_id) matchedTxIds.push(t.custom_data.transaction_id);
                        if (!matchedFAC && t.custom_data?.matched_invoice_fac) matchedFAC = t.custom_data.matched_invoice_fac;
                        if (!matchedFAC && t.custom_data?.matched_invoice_number) matchedFAC = invToFac[t.custom_data.matched_invoice_number];
                    });
                    break;
                }
            }

            // If no sum match, try individual tx match
            if (matchedTxIds.length === 0) {
                for (let delta = -5; delta <= 5; delta++) {
                    const d = new Date(bankDate);
                    d.setDate(d.getDate() + delta);
                    const key = d.toISOString().substring(0, 10);
                    const txs = stripeByDate.get(key) || [];
                    for (const t of txs) {
                        const tAmt = Math.abs(parseFloat(t.amount) || 0);
                        if (Math.abs(tAmt - bankAmt) < Math.max(bankAmt * 0.01, 1)) {
                            if (t.custom_data?.transaction_id) matchedTxIds.push(t.custom_data.transaction_id);
                            if (!matchedFAC && t.custom_data?.matched_invoice_fac) matchedFAC = t.custom_data.matched_invoice_fac;
                            if (!matchedFAC && t.custom_data?.matched_invoice_number) matchedFAC = invToFac[t.custom_data.matched_invoice_number];
                            break;
                        }
                    }
                    if (matchedTxIds.length > 0) break;
                }
            }

            if (matchedTxIds.length > 0 || matchedFAC) {
                const fields = {
                    paymentSource: 'Stripe',
                    reconciliationType: 'bank-stripe-mega'
                };
                if (matchedTxIds.length > 0) fields.transaction_ids = matchedTxIds;
                if (matchedFAC) fields.pnl_fac = matchedFAC;
                bankUpdates.push({ id: bank.id, fields });
                bankStripeLinked++;
                continue;
            }
        }

        // ─── GOCARDLESS bank rows ───
        if (ps.includes('gocardless') || desc.includes('gocardless') || desc.includes('go cardless')) {
            // GC payouts: match by amount + date window
            let bestGCGroup = null;
            let bestDelta = Infinity;

            for (let delta = -5; delta <= 5; delta++) {
                const d = new Date(bankDate);
                d.setDate(d.getDate() + delta);
                const key = d.toISOString().substring(0, 10);
                const txs = gcByDate.get(key) || [];

                // Sum GC txs for this date
                const dayTotal = txs.reduce((s, t) => s + Math.abs(parseFloat(t.amount) || 0), 0);
                if (dayTotal > 0 && Math.abs(dayTotal - bankAmt) < Math.max(bankAmt * 0.03, 5)) {
                    if (Math.abs(delta) < bestDelta) {
                        bestDelta = Math.abs(delta);
                        bestGCGroup = txs;
                    }
                }

                // Also try individual GC transaction
                for (const t of txs) {
                    const tAmt = Math.abs(parseFloat(t.amount) || 0);
                    if (Math.abs(tAmt - bankAmt) < Math.max(bankAmt * 0.01, 2)) {
                        if (Math.abs(delta) < bestDelta) {
                            bestDelta = Math.abs(delta);
                            bestGCGroup = [t];
                        }
                    }
                }
            }

            if (bestGCGroup && bestGCGroup.length > 0) {
                const txIds = bestGCGroup.map(t => t.custom_data?.gocardless_id || t.custom_data?.payment_id || t.id).filter(Boolean);
                let matchedFAC = null;
                for (const t of bestGCGroup) {
                    if (t.custom_data?.matched_invoice_fac) { matchedFAC = t.custom_data.matched_invoice_fac; break; }
                    if (t.custom_data?.matched_invoice_number && invToFac[t.custom_data.matched_invoice_number]) {
                        matchedFAC = invToFac[t.custom_data.matched_invoice_number]; break;
                    }
                }

                const fields = {
                    paymentSource: 'Gocardless',
                    reconciliationType: 'bank-gocardless-mega',
                    gc_transaction_ids: txIds
                };
                if (matchedFAC) fields.pnl_fac = matchedFAC;
                bankUpdates.push({ id: bank.id, fields });
                bankGCLinked++;
                continue;
            }
        }

        // ─── PAYPAL bank rows → BT disbursements ───
        if (ps.includes('paypal') || (desc.includes('paypal') && !desc.includes('braintree'))) {
            // PayPal payments go through Braintree. Match bank PayPal to BT disbursement by date+amount
            let matched = false;

            for (let delta = -3; delta <= 3; delta++) {
                const d = new Date(bankDate);
                d.setDate(d.getDate() + delta);
                const key = d.toISOString().substring(0, 10);

                // Check BT disbursements
                const disbs = disbByDate.get(key) || [];
                for (const disb of disbs) {
                    const disbAmt = Math.abs(parseFloat(disb.amount) || 0);
                    if (Math.abs(disbAmt - bankAmt) < Math.max(bankAmt * 0.02, 2)) {
                        const txIds = disb.custom_data?.transaction_ids || [];
                        // Get P&L from first tx with matched_invoice
                        let matchedFAC = null;
                        for (const txId of txIds) {
                            const bt = allBT.find(b => b.custom_data?.transaction_id === txId);
                            if (bt?.custom_data?.matched_invoice_fac) { matchedFAC = bt.custom_data.matched_invoice_fac; break; }
                            if (bt?.custom_data?.matched_invoice_number && invToFac[bt.custom_data.matched_invoice_number]) {
                                matchedFAC = invToFac[bt.custom_data.matched_invoice_number]; break;
                            }
                        }

                        const fields = {
                            paymentSource: 'paypal',
                            reconciliationType: 'bank-paypal-bt-mega',
                            transaction_ids: txIds.slice(0, 50)
                        };
                        if (matchedFAC) fields.pnl_fac = matchedFAC;
                        bankUpdates.push({ id: bank.id, fields });
                        bankPayPalLinked++;
                        matched = true;
                        break;
                    }
                }
                if (matched) break;

                // Also try matching sum of BT txs for that disbursement date
                const btTxs = btByDisbDate.get(key) || [];
                if (btTxs.length > 0) {
                    const dayTotal = btTxs.reduce((s, t) => s + Math.abs(parseFloat(t.amount) || 0), 0);
                    if (Math.abs(dayTotal - bankAmt) < Math.max(bankAmt * 0.05, 5)) {
                        const txIds = btTxs.map(t => t.custom_data?.transaction_id).filter(Boolean);
                        let matchedFAC = null;
                        for (const t of btTxs) {
                            if (t.custom_data?.matched_invoice_fac) { matchedFAC = t.custom_data.matched_invoice_fac; break; }
                        }

                        const fields = {
                            paymentSource: 'paypal',
                            reconciliationType: 'bank-paypal-bt-sum-mega',
                            transaction_ids: txIds.slice(0, 50)
                        };
                        if (matchedFAC) fields.pnl_fac = matchedFAC;
                        bankUpdates.push({ id: bank.id, fields });
                        bankPayPalLinked++;
                        matched = true;
                        break;
                    }
                }
            }
            if (matched) continue;
        }

        // ─── AMEX bank rows → BT-Amex transactions ───
        if (ps.includes('amex') || desc.includes('american express') || desc.includes('amex')) {
            // AmEx pays in batches. Match by date sum of BT-Amex transactions
            let matched = false;

            // BT-Amex transactions have settlement_date/disbursement_date
            for (let delta = -5; delta <= 5; delta++) {
                const d = new Date(bankDate);
                d.setDate(d.getDate() + delta);
                const key = d.toISOString().substring(0, 10);

                // Check BT-Amex txs with this settlement date
                const amexTxs = btAmex.filter(t => {
                    const settDate = (t.custom_data?.settlement_date || t.custom_data?.disbursement_date || '').substring(0, 10);
                    return settDate === key;
                });

                if (amexTxs.length > 0) {
                    const dayTotal = amexTxs.reduce((s, t) => s + Math.abs(parseFloat(t.amount) || 0), 0);
                    if (Math.abs(dayTotal - bankAmt) < Math.max(bankAmt * 0.03, 5)) {
                        const txIds = amexTxs.map(t => t.custom_data?.transaction_id).filter(Boolean);
                        let matchedFAC = null;
                        for (const t of amexTxs) {
                            if (t.custom_data?.matched_invoice_fac) { matchedFAC = t.custom_data.matched_invoice_fac; break; }
                            if (t.custom_data?.matched_invoice_number && invToFac[t.custom_data.matched_invoice_number]) {
                                matchedFAC = invToFac[t.custom_data.matched_invoice_number]; break;
                            }
                        }

                        const fields = {
                            paymentSource: 'braintree (amex)',
                            reconciliationType: 'bank-amex-bt-mega',
                            transaction_ids: txIds.slice(0, 50)
                        };
                        if (matchedFAC) fields.pnl_fac = matchedFAC;
                        bankUpdates.push({ id: bank.id, fields });
                        bankAmexLinked++;
                        matched = true;
                        break;
                    }
                }
            }
            if (matched) continue;
        }

        // ─── OTHER bank rows → Direct P&L by customer extraction ───
        if (!ps && !bank.custom_data?.transaction_ids?.length) {
            // Try to extract customer name from description and match to IO
            const descClean = (bank.description || '')
                .replace(/^(transf|trans|abono|remesa|transfer|ach|wire|chips)[\s\/:]*/gi, '')
                .replace(/^(otras\s+e|inm|otras\s+entid)[\s\/:]*/gi, '')
                .trim();

            // Try full description as customer name search
            const descNorm = normalize(descClean);
            if (descNorm.length >= 5) {
                // Check if description contains a known IO customer name
                for (const [ioName, ioRows] of ioByName) {
                    if (ioName.length < 4) continue;
                    // Check if bank description contains IO customer name
                    if (descNorm.includes(ioName) || ioName.includes(descNorm.substring(0, Math.min(15, descNorm.length)))) {
                        const withFac = ioRows.find(o => o.custom_data?.invoice_number && invToFac[o.custom_data.invoice_number]);
                        if (withFac) {
                            const invNum = withFac.custom_data.invoice_number;
                            bankUpdates.push({
                                id: bank.id,
                                fields: {
                                    pnl_fac: invToFac[invNum],
                                    pnl_line: getPnlLineFromCode(invToFac[invNum]),
                                    pnl_source: 'desc-customer-match',
                                    matched_customer: withFac.custom_data?.customer_name || ioName,
                                    reconciliationType: 'bank-direct-customer-mega'
                                }
                            });
                            bankOtherPnl++;
                            break;
                        }
                    }
                }
            }
        }
    }

    function getPnlLineFromCode(faCode) {
        if (!faCode) return 'unclassified';
        return faCode.split('.')[0] || 'unclassified';
    }

    console.log(`  Bank→Stripe linked: ${bankStripeLinked}`);
    console.log(`  Bank→GC linked: ${bankGCLinked}`);
    console.log(`  Bank→PayPal/BT linked: ${bankPayPalLinked}`);
    console.log(`  Bank→AmEx/BT linked: ${bankAmexLinked}`);
    console.log(`  Bank→Direct P&L (customer match): ${bankOtherPnl}`);
    console.log(`  Total bank updates: ${bankUpdates.length}`);

    if (!DRY_RUN && bankUpdates.length > 0) {
        const written = await writeUpdates(bankUpdates, 'Bank');
        console.log(`  Written: ${written}`);
    }

    // ════════════════════════════════════════════════════════
    // PHASE 4: FOR REMAINING - SET P&L FROM CUSTOMER HISTORY (GW rows with matched_invoice but bank no chain)
    // ════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════');
    console.log('  PHASE 4: REMAINING BANK → P&L VIA GATEWAY CUSTOMER');
    console.log('════════════════════════════════════════════\n');

    // Reload bank data to check what's still unclassified
    // Build a "gateway tx → FAC" quick lookup map from ALL gateways
    const gwTxToFAC = {};
    [...allBT, ...stripeAll, ...gc].forEach(r => {
        const txId = r.custom_data?.transaction_id || r.custom_data?.gocardless_id || r.custom_data?.payment_id;
        if (txId) {
            const fac = r.custom_data?.matched_invoice_fac ||
                (r.custom_data?.matched_invoice_number && invToFac[r.custom_data.matched_invoice_number]) || null;
            if (fac) gwTxToFAC[txId] = fac;

            // Also store customer for fallback
            const name = normalize(r.custom_data?.customer_name);
            if (name && !fac) {
                const dominantFAC = getDominantFAC(name);
                if (dominantFAC) gwTxToFAC[txId] = dominantFAC;
            }
        }
    });

    // For bank rows with paymentSource but still no P&L, try to assign from gateway customer FAC history
    let phase4Count = 0;
    const phase4Updates = [];

    for (const bank of allBankInflows) {
        // Skip if already has P&L
        if (bank.custom_data?.pnl_line || bank.custom_data?.pnl_fac) continue;

        // Check if any bank update from Phase 3 already covers this
        if (bankUpdates.find(u => u.id === bank.id)) continue;

        const txIds = bank.custom_data?.transaction_ids || [];
        let foundFAC = null;

        for (const txId of txIds) {
            if (gwTxToFAC[txId]) { foundFAC = gwTxToFAC[txId]; break; }
        }

        if (!foundFAC) {
            // Try: if bank has paymentSource, use the gateway txs matched in the same date range
            // Get gateway customer names from bank custom_data
            const customerNames = bank.custom_data?.matched_customer_names || [];
            for (const cn of customerNames) {
                const dom = getDominantFAC(cn);
                if (dom) { foundFAC = dom; break; }
            }
        }

        if (foundFAC) {
            phase4Updates.push({
                id: bank.id,
                fields: {
                    pnl_fac: foundFAC,
                    pnl_line: getPnlLineFromCode(foundFAC),
                    pnl_source: 'gateway-customer-history',
                    reconciliationType: 'bank-customer-history-mega'
                }
            });
            phase4Count++;
        }
    }

    console.log(`  Phase 4 matches (customer history): ${phase4Count}`);

    if (!DRY_RUN && phase4Updates.length > 0) {
        const written = await writeUpdates(phase4Updates, 'Phase4');
        console.log(`  Written: ${written}`);
    }

    // ════════════════════════════════════════════════════════
    // FINAL SCORECARD
    // ════════════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║              FINAL RECONCILIATION SCORECARD           ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    console.log('  GATEWAY → INVOICE COVERAGE:');
    console.log(`    Braintree Revenue: ${btRev.filter(r => r.custom_data?.matched_invoice_number).length}/${btRev.length} (${Math.round(btRev.filter(r => r.custom_data?.matched_invoice_number).length / btRev.length * 100)}%)`);
    console.log(`    Braintree Amex: ${btAmex.filter(r => r.custom_data?.matched_invoice_number).length}/${btAmex.length} (${Math.round(btAmex.filter(r => r.custom_data?.matched_invoice_number).length / btAmex.length * 100)}%)`);
    console.log(`    Stripe: ${totalStats.stripe.matched}/${totalStats.stripe.total} (${Math.round(totalStats.stripe.matched / totalStats.stripe.total * 100)}%)`);
    console.log(`    GoCardless: ${totalStats.gocardless.matched}/${totalStats.gocardless.total} (${Math.round(totalStats.gocardless.matched / totalStats.gocardless.total * 100)}%)`);

    console.log('\n  BANK → P&L CLASSIFICATION:');
    console.log(`    Bank→Stripe: +${bankStripeLinked}`);
    console.log(`    Bank→GC: +${bankGCLinked}`);
    console.log(`    Bank→PayPal: +${bankPayPalLinked}`);
    console.log(`    Bank→AmEx: +${bankAmexLinked}`);
    console.log(`    Bank→Customer: +${bankOtherPnl}`);
    console.log(`    Bank→GW History: +${phase4Count}`);

    console.log('\n  Done! Run audit script again to see updated coverage.');

    process.exit(0);
})();
