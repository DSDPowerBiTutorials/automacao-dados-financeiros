/**
 * MEGA RECONCILIATION SCRIPT
 * 
 * Goal: Match ALL Braintree transactions to invoice-orders to get matched_invoice_number
 * This enables the chain: Bank → BT tx → matched_invoice_number → IO → FAC → P&L Line
 * 
 * Strategies (in priority order):
 *   S1: order_id match (confidence 1.0)
 *   S2: customer_name + amount ±2% (confidence 0.90) 
 *   S3: customer_name + closest date (confidence 0.70)
 *   S4: amount + date ±€1, ±5d (confidence 0.60)
 * 
 * KEY FIX: Updates custom_data.matched_invoice_number (what the frontend chain reads)
 *          Does NOT filter by reconciled status — matches ALL BT rows without matched_invoice_number
 */

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://rrzgawssbyfzbkmtcovz.supabase.co',
    'sb_secret_d5XN1_EVZod7kJJCRZpXmw_ncDkXEoY'
);

// Config
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const BATCH_SIZE = 50;

async function paginate(source) {
    let all = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase.from('csv_rows')
            .select('id, amount, date, description, reconciled, custom_data')
            .eq('source', source)
            .range(page * 1000, (page + 1) * 1000 - 1);
        if (error) { console.error('Paginate error:', error.message); break; }
        if (!data || data.length === 0) break;
        all.push(...data);
        page++;
        if (page > 50) break;
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

async function updateBatch(updates) {
    if (DRY_RUN) return updates.length;
    let success = 0;
    // Process in small batches to avoid rate limits
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(async (u) => {
                // Merge with existing custom_data to preserve all fields
                const { data: existing } = await supabase.from('csv_rows')
                    .select('custom_data')
                    .eq('id', u.id)
                    .single();

                const mergedCustomData = {
                    ...(existing?.custom_data || {}),
                    matched_invoice_number: u.matched_invoice_number,
                    matched_invoice_fac: u.matched_invoice_fac,
                    reconciliation_strategy: u.strategy,
                    reconciliation_confidence: u.confidence,
                    reconciled_at: new Date().toISOString(),
                    matched_customer: u.matched_customer,
                    matched_order_id: u.matched_order_id,
                    matched_order_type: u.matched_order_type,
                    reconciliationType: 'braintree-orders-mega'
                };

                const { error } = await supabase.from('csv_rows')
                    .update({ custom_data: mergedCustomData })
                    .eq('id', u.id);

                if (error) throw new Error(`Update ${u.id}: ${error.message}`);
                return true;
            })
        );
        success += results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length > 0) {
            console.error(`  Batch ${i}: ${failed.length} failures`);
            failed.slice(0, 3).forEach(f => console.error('    ', f.reason?.message));
        }
    }
    return success;
}

(async () => {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   MEGA RECONCILIATION: BT → Invoice-Orders  ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (writing to DB)'}\n`);

    // === LOAD ALL DATA ===
    console.log('[1/6] Loading data...');
    const btRev = await paginate('braintree-api-revenue');
    const btAmex = await paginate('braintree-amex');
    const io = await paginate('invoice-orders');

    const allBT = [...btRev, ...btAmex];

    // Filter: BT rows that DON'T have matched_invoice_number yet
    const btUnmatched = allBT.filter(r => !r.custom_data?.matched_invoice_number);
    const btAlready = allBT.length - btUnmatched.length;

    console.log(`  BT Revenue: ${btRev.length}`);
    console.log(`  BT Amex: ${btAmex.length}`);
    console.log(`  Total BT: ${allBT.length}`);
    console.log(`  Already matched: ${btAlready} (${Math.round(btAlready / allBT.length * 100)}%)`);
    console.log(`  Needing match: ${btUnmatched.length}`);
    console.log(`  Invoice-Orders: ${io.length}`);

    // === BUILD INDEXES ===
    console.log('\n[2/6] Building indexes...');

    // IO by customer_name (normalized)
    const ioByName = new Map();
    // IO by amount rounded
    const ioByAmount = new Map();
    // IO invoice_number → FAC map
    const invToFac = {};
    // IO invoice_number → order_type map
    const invToType = {};
    // Customer → FAC frequency
    const customerFACFreq = {};

    io.forEach(r => {
        const cd = r.custom_data || {};
        const invNum = cd.invoice_number;
        const fac = cd.financial_account_code;
        const name = normalize(cd.customer_name);
        const amount = Math.abs(parseFloat(r.amount) || 0);

        if (invNum && fac) {
            invToFac[invNum] = fac;
            invToType[invNum] = cd.order_type || '';
        }

        if (name && fac) {
            if (!customerFACFreq[name]) customerFACFreq[name] = {};
            customerFACFreq[name][fac] = (customerFACFreq[name][fac] || 0) + 1;
        }

        if (name) {
            if (!ioByName.has(name)) ioByName.set(name, []);
            ioByName.get(name).push(r);
        }

        if (amount > 0) {
            const key = Math.round(amount);
            if (!ioByAmount.has(key)) ioByAmount.set(key, []);
            ioByAmount.get(key).push(r);
        }
    });

    console.log(`  Names index: ${ioByName.size} unique customers`);
    console.log(`  Amount index: ${ioByAmount.size} unique amounts`);
    console.log(`  Invoice→FAC map: ${Object.keys(invToFac).length} entries`);

    // === RUN MATCHING ===
    console.log('\n[3/6] Running matching strategies...');

    const updates = []; // { id, matched_invoice_number, matched_invoice_fac, strategy, confidence, matched_customer }
    const matched = new Set();
    const matchedIOIds = new Set(); // Track used IO rows for 1:1

    const stats = { s1_orderId: 0, s2_nameAmount: 0, s3_nameDate: 0, s4_amountDate: 0, s5_nameOnly: 0 };

    // === S1: Order ID match ===
    // BT order_id format: "4519a0d-5116552"  
    // IO invoice_number format: "#DSDES4457268-48689" or "#DSDFSB4417FC-53516"
    // Try: extract hex part from BT order_id, find in IO invoice_number
    console.log('  S1: order_id → invoice_number...');
    btUnmatched.forEach(bt => {
        if (matched.has(bt.id)) return;
        const orderId = bt.custom_data?.order_id;
        if (!orderId) return;

        // Extract first hex part before dash
        const parts = orderId.split('-');
        const hexPart = parts[0]?.toUpperCase();
        if (!hexPart || hexPart.length < 5) return;

        // Search in invoice numbers
        for (const [invNum, fac] of Object.entries(invToFac)) {
            if (invNum.toUpperCase().includes(hexPart)) {
                updates.push({
                    id: bt.id,
                    matched_invoice_number: invNum,
                    matched_invoice_fac: fac,
                    strategy: 'order-id',
                    confidence: 1.0,
                    matched_customer: bt.custom_data?.customer_name,
                    matched_order_id: orderId,
                    matched_order_type: invToType[invNum]
                });
                matched.add(bt.id);
                stats.s1_orderId++;
                return;
            }
        }
    });
    console.log(`    → ${stats.s1_orderId} matches`);

    // === S2: Customer name + amount (±2%) ===
    console.log('  S2: customer_name + amount (±2%)...');
    btUnmatched.forEach(bt => {
        if (matched.has(bt.id)) return;
        const name = normalize(bt.custom_data?.customer_name);
        if (!name || name.length < 3) return;
        const btAmt = Math.abs(parseFloat(bt.amount) || 0);
        if (btAmt < 1) return;

        const candidates = ioByName.get(name);
        if (!candidates) return;

        // Find best match: closest amount, then closest date
        let best = null;
        let bestScore = Infinity;

        for (const io of candidates) {
            if (matchedIOIds.has(io.id)) continue;
            const ioAmt = Math.abs(parseFloat(io.amount) || 0);
            if (ioAmt === 0) continue; // Skip zero-amount IOs for this strategy

            const invNum = io.custom_data?.invoice_number;
            if (!invNum || !invToFac[invNum]) continue;

            const amtDiff = Math.abs(btAmt - ioAmt);
            const tolerance = Math.max(btAmt * 0.02, 1);
            if (amtDiff > tolerance) continue;

            const days = bt.date && io.date ? daysDiff(bt.date, io.date) : 999;
            const score = amtDiff + days * 0.1; // Prioritize amount accuracy, then date

            if (score < bestScore) {
                bestScore = score;
                best = io;
            }
        }

        if (best) {
            const invNum = best.custom_data?.invoice_number;
            updates.push({
                id: bt.id,
                matched_invoice_number: invNum,
                matched_invoice_fac: invToFac[invNum],
                strategy: 'customer-name-amount',
                confidence: 0.90,
                matched_customer: best.custom_data?.customer_name || name,
                matched_order_id: bt.custom_data?.order_id || '',
                matched_order_type: invToType[invNum]
            });
            matched.add(bt.id);
            matchedIOIds.add(best.id);
            stats.s2_nameAmount++;
        }
    });
    console.log(`    → ${stats.s2_nameAmount} matches`);

    // === S3: Customer name + closest date (no amount requirement) ===
    console.log('  S3: customer_name + closest date...');
    btUnmatched.forEach(bt => {
        if (matched.has(bt.id)) return;
        const name = normalize(bt.custom_data?.customer_name);
        if (!name || name.length < 3) return;

        const candidates = ioByName.get(name);
        if (!candidates) return;

        // Find closest-dated invoice with FAC
        let best = null;
        let bestDays = Infinity;

        for (const io of candidates) {
            const invNum = io.custom_data?.invoice_number;
            if (!invNum || !invToFac[invNum]) continue;

            const days = bt.date && io.date ? daysDiff(bt.date, io.date) : 999;
            if (days < bestDays) {
                bestDays = days;
                best = io;
            }
        }

        if (best && bestDays <= 365) { // Within 1 year
            const invNum = best.custom_data?.invoice_number;
            // Higher confidence if closer date
            const confidence = bestDays <= 7 ? 0.75 : bestDays <= 30 ? 0.70 : bestDays <= 90 ? 0.65 : 0.55;

            updates.push({
                id: bt.id,
                matched_invoice_number: invNum,
                matched_invoice_fac: invToFac[invNum],
                strategy: 'customer-name-date',
                confidence,
                matched_customer: best.custom_data?.customer_name || name,
                matched_order_id: bt.custom_data?.order_id || '',
                matched_order_type: invToType[invNum]
            });
            matched.add(bt.id);
            stats.s3_nameDate++;
        }
    });
    console.log(`    → ${stats.s3_nameDate} matches`);

    // === S4: Amount + date (±€1, ±5 days) — for customers NOT in IO ===
    console.log('  S4: amount + date (±€1, ±5d)...');
    btUnmatched.forEach(bt => {
        if (matched.has(bt.id)) return;
        const btAmt = Math.abs(parseFloat(bt.amount) || 0);
        if (btAmt < 10) return; // Skip small amounts (too many false positives)
        if (!bt.date) return;

        const roundedKey = Math.round(btAmt);
        const candidates = [];
        for (let d = -1; d <= 1; d++) {
            const c = ioByAmount.get(roundedKey + d) || [];
            candidates.push(...c);
        }

        let best = null;
        let bestScore = Infinity;

        for (const io of candidates) {
            if (matchedIOIds.has(io.id)) continue;
            const ioAmt = Math.abs(parseFloat(io.amount) || 0);
            const invNum = io.custom_data?.invoice_number;
            if (!invNum || !invToFac[invNum]) continue;

            const amtDiff = Math.abs(btAmt - ioAmt);
            if (amtDiff > 1) continue;

            const days = daysDiff(bt.date, io.date);
            if (days > 5) continue;

            const score = amtDiff * 10 + days;
            if (score < bestScore) {
                bestScore = score;
                best = io;
            }
        }

        if (best) {
            const invNum = best.custom_data?.invoice_number;
            updates.push({
                id: bt.id,
                matched_invoice_number: invNum,
                matched_invoice_fac: invToFac[invNum],
                strategy: 'amount-date',
                confidence: 0.60,
                matched_customer: best.custom_data?.customer_name || '',
                matched_order_id: bt.custom_data?.order_id || '',
                matched_order_type: invToType[invNum]
            });
            matched.add(bt.id);
            matchedIOIds.add(best.id);
            stats.s4_amountDate++;
        }
    });
    console.log(`    → ${stats.s4_amountDate} matches`);

    // === S5: Customer name only (use most frequent FAC) — for remaining ===
    console.log('  S5: customer_name → most frequent P&L line...');
    btUnmatched.forEach(bt => {
        if (matched.has(bt.id)) return;
        const name = normalize(bt.custom_data?.customer_name);
        if (!name || name.length < 3) return;

        const candidates = ioByName.get(name);
        if (!candidates) return;

        // Find any invoice with FAC for this customer
        const withInv = candidates.filter(c => c.custom_data?.invoice_number && invToFac[c.custom_data.invoice_number]);
        if (withInv.length === 0) return;

        // Use closest-dated invoice
        let best = withInv[0];
        let bestDays = bt.date ? daysDiff(bt.date, best.date) : 999;
        for (const c of withInv) {
            const days = bt.date ? daysDiff(bt.date, c.date) : 999;
            if (days < bestDays) {
                bestDays = days;
                best = c;
            }
        }

        const invNum = best.custom_data?.invoice_number;
        updates.push({
            id: bt.id,
            matched_invoice_number: invNum,
            matched_invoice_fac: invToFac[invNum],
            strategy: 'customer-name-only',
            confidence: 0.50,
            matched_customer: best.custom_data?.customer_name || name,
            matched_order_id: bt.custom_data?.order_id || '',
            matched_order_type: invToType[invNum]
        });
        matched.add(bt.id);
        stats.s5_nameOnly++;
    });
    console.log(`    → ${stats.s5_nameOnly} matches`);

    // === SUMMARY ===
    const totalMatched = updates.length;
    const totalBT = allBT.length;
    const newCoverage = btAlready + totalMatched;

    console.log('\n[4/6] ═══ MATCHING SUMMARY ═══');
    console.log(`  Already matched (before):  ${btAlready} / ${totalBT} (${Math.round(btAlready / totalBT * 100)}%)`);
    console.log(`  New matches found:         ${totalMatched}`);
    console.log(`    S1 order_id:             ${stats.s1_orderId}`);
    console.log(`    S2 name+amount:          ${stats.s2_nameAmount}`);
    console.log(`    S3 name+date:            ${stats.s3_nameDate}`);
    console.log(`    S4 amount+date:          ${stats.s4_amountDate}`);
    console.log(`    S5 name-only:            ${stats.s5_nameOnly}`);
    console.log(`  Total coverage (after):    ${newCoverage} / ${totalBT} (${Math.round(newCoverage / totalBT * 100)}%)`);
    console.log(`  Remaining unmatched:       ${totalBT - newCoverage}`);

    // === FAC distribution of new matches ===
    console.log('\n  FAC distribution of new matches:');
    const facDist = {};
    updates.forEach(u => {
        const fac = u.matched_invoice_fac || 'unknown';
        facDist[fac] = (facDist[fac] || 0) + 1;
    });
    Object.entries(facDist)
        .sort((a, b) => b[1] - a[1])
        .forEach(([fac, count]) => {
            console.log(`    ${fac}: ${count} (${Math.round(count / totalMatched * 100)}%)`);
        });

    // === Confidence distribution ===
    console.log('\n  Confidence distribution:');
    const confDist = {};
    updates.forEach(u => {
        const key = u.confidence.toFixed(2);
        confDist[key] = (confDist[key] || 0) + 1;
    });
    Object.entries(confDist)
        .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
        .forEach(([conf, count]) => {
            console.log(`    ${conf}: ${count}`);
        });

    // Show some sample matches
    if (VERBOSE) {
        console.log('\n  Sample matches:');
        updates.slice(0, 10).forEach(u => {
            console.log(`    [${u.strategy}] ${u.matched_customer} → ${u.matched_invoice_number} (FAC: ${u.matched_invoice_fac}, conf: ${u.confidence})`);
        });
    }

    // === WRITE TO DATABASE ===
    if (DRY_RUN) {
        console.log('\n[5/6] DRY RUN — no writes performed');
        console.log('[6/6] Done (dry run)');
    } else {
        console.log(`\n[5/6] Writing ${updates.length} updates to database...`);
        const written = await updateBatch(updates);
        console.log(`  Written: ${written} / ${updates.length}`);

        // === VERIFY: Re-check chain completion ===
        console.log('\n[6/6] Verifying chain completion...');

        // Reload BT data to check
        const btRevNew = await paginate('braintree-api-revenue');
        const btAmexNew = await paginate('braintree-amex');
        const allBTNew = [...btRevNew, ...btAmexNew];
        const btWithInvNow = allBTNew.filter(r => r.custom_data?.matched_invoice_number).length;
        console.log(`  BT with matched_invoice_number: ${btWithInvNow} / ${allBTNew.length} (${Math.round(btWithInvNow / allBTNew.length * 100)}%)`);

        // Check bank chain
        const bankEur = (await paginate('bankinter-eur')).filter(r => r.amount > 0);
        const bankUsd = (await paginate('chase-usd')).filter(r => r.amount > 0);
        const bankAll = [...bankEur, ...bankUsd];
        const bankWithTxIds = bankAll.filter(r => r.custom_data?.transaction_ids?.length > 0);

        // Build tx → matched_invoice_number map
        const txMap = {};
        allBTNew.forEach(r => {
            if (r.custom_data?.transaction_id) {
                txMap[r.custom_data.transaction_id] = r.custom_data;
            }
        });

        let chainComplete = 0;
        bankWithTxIds.forEach(bank => {
            for (const txId of bank.custom_data.transaction_ids) {
                const bt = txMap[txId];
                if (bt?.matched_invoice_number && invToFac[bt.matched_invoice_number]) {
                    chainComplete++;
                    return;
                }
            }
        });

        console.log(`  Bank chain completion: ${chainComplete} / ${bankWithTxIds.length} (${Math.round(chainComplete / bankWithTxIds.length * 100)}%)`);
        console.log(`  P&L classification: ${chainComplete} / ${bankAll.length} total bank inflows (${Math.round(chainComplete / bankAll.length * 100)}%)`);
    }

    console.log('\n✓ Done!');
    process.exit(0);
})();
