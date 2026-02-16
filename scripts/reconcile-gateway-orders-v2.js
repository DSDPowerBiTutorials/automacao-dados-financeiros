/**
 * RECONCILE GATEWAY → ORDERS V2
 * 
 * Links gateway transactions (BT, Stripe, GC) to invoice-orders (csv_rows)
 * Writes matched_invoice_number, matched_invoice_fac, matched_order_id, 
 * matched_customer_name, matched_products to gateway custom_data using MERGE.
 * 
 * Target: ≥70% of gateway txs linked to orders
 * 
 * Strategies:
 *  S1: gateway.order_id → IO.order_number (exact, BT/Stripe)
 *  S2: gateway.matched_invoice_number already set → verify IO exists
 *  S3: gateway.customer_email → IO.email + amount ±5% + date ±30d
 *  S4: gateway.customer_name → IO.customer_name (fuzzy 50%) + amount ±5%
 *  S5: gateway.amount exact → IO.amount + date ±7d + same FAC domain
 * 
 * Usage:
 *   node scripts/reconcile-gateway-orders-v2.js --dry-run
 *   node scripts/reconcile-gateway-orders-v2.js --apply
 */

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://rrzgawssbyfzbkmtcovz.supabase.co',
    'sb_secret_d5XN1_EVZod7kJJCRZpXmw_ncDkXEoY'
);

const DRY_RUN = !process.argv.includes('--apply');
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
    if (!d1 || !d2) return 999;
    return Math.abs(new Date(d1).getTime() - new Date(d2).getTime()) / 86400000;
}

function getWords(name) {
    return name.split(/\s+/).filter(w => w.length >= 3);
}

/** Read-modify-write: MERGE into existing custom_data */
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
        if (failed.length > 0) {
            console.error(`  [${label}] batch ${Math.floor(i / BATCH_SIZE)}: ${failed.length} failures`);
        }
    }
    return success;
}

(async () => {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  RECONCILE GATEWAY → ORDERS V2                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`Mode: ${DRY_RUN ? '🔵 DRY RUN' : '🔴 LIVE — WRITING TO DB'}\n`);

    // ─── Load all data ───
    console.log('[LOAD] Loading gateway + IO data...');
    const [btRev, btAmex, stripeEur, stripeUsd, gc, io] = await Promise.all([
        paginate('braintree-api-revenue'),
        paginate('braintree-amex'),
        paginate('stripe-eur'),
        paginate('stripe-usd'),
        paginate('gocardless'),
        paginate('invoice-orders'),
    ]);

    const gwAll = [
        ...btRev.map(r => ({ ...r, gwSource: 'braintree-api-revenue' })),
        ...btAmex.map(r => ({ ...r, gwSource: 'braintree-amex' })),
        ...stripeEur.map(r => ({ ...r, gwSource: 'stripe-eur' })),
        ...stripeUsd.map(r => ({ ...r, gwSource: 'stripe-usd' })),
        ...gc.filter(r => (r.custom_data?.type || '') !== 'payout').map(r => ({ ...r, gwSource: 'gocardless' })),
    ];

    console.log(`  Gateway: BT=${btRev.length}, Amex=${btAmex.length}, StripeEUR=${stripeEur.length}, StripeUSD=${stripeUsd.length}, GC=${gc.length} (${gc.filter(r => r.custom_data?.type !== 'payout').length} payments)`);
    console.log(`  IO: ${io.length}`);
    console.log(`  Total gateway txs to process: ${gwAll.length}\n`);

    // ─── Build IO indexes ───
    console.log('[INDEX] Building IO indexes...');
    const ioByInvNum = new Map();     // invoice_number → row
    const ioByOrderNum = new Map();   // order_number → [rows]
    const ioByEmail = new Map();      // email → [rows]
    const ioByName = new Map();       // normalize(name) → [rows]
    const ioByWord = new Map();       // word → Set<normalize(name)>
    const ioByAmountKey = new Map();  // round(amount) → [rows]
    const invToFac = {};              // invoice_number → FAC

    io.forEach(r => {
        const cd = r.custom_data || {};
        const invNum = cd.invoice_number;
        const orderNum = cd.order_number;
        const name = normalize(cd.customer_name);
        const email = (cd.email || cd.customer_email || '').toLowerCase().trim();
        const amount = Math.abs(parseFloat(r.amount) || 0);
        const fac = cd.financial_account_code;

        if (invNum) ioByInvNum.set(invNum, r);
        if (invNum && fac) invToFac[invNum] = fac;

        if (orderNum) {
            if (!ioByOrderNum.has(orderNum)) ioByOrderNum.set(orderNum, []);
            ioByOrderNum.get(orderNum).push(r);
        }

        if (email) {
            if (!ioByEmail.has(email)) ioByEmail.set(email, []);
            ioByEmail.get(email).push(r);
        }

        if (name) {
            if (!ioByName.has(name)) ioByName.set(name, []);
            ioByName.get(name).push(r);

            getWords(name).forEach(w => {
                if (!ioByWord.has(w)) ioByWord.set(w, new Set());
                ioByWord.get(w).add(name);
            });
        }

        if (amount > 0) {
            const key = Math.round(amount);
            if (!ioByAmountKey.has(key)) ioByAmountKey.set(key, []);
            ioByAmountKey.get(key).push(r);
        }
    });

    console.log(`  Indexes: ${ioByInvNum.size} invoices, ${ioByOrderNum.size} orders, ${ioByEmail.size} emails, ${ioByName.size} names, ${ioByWord.size} words\n`);

    // ─── Fuzzy name matching helper ───
    function fuzzyNameMatch(name) {
        if (!name || name.length < 4) return [];
        const words = getWords(name);
        if (words.length === 0) return [];

        const nameScores = new Map();
        for (const w of words) {
            const ioNames = ioByWord.get(w) || new Set();
            for (const ioName of ioNames) {
                nameScores.set(ioName, (nameScores.get(ioName) || 0) + 1);
            }
        }

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

    // ─── Process each gateway tx ───
    const stats = { total: gwAll.length, alreadyMatched: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, noMatch: 0 };
    const statsBySource = {};
    const updates = [];

    for (const gw of gwAll) {
        const cd = gw.custom_data || {};
        const src = gw.gwSource;

        // Init per-source stats
        if (!statsBySource[src]) {
            statsBySource[src] = { total: 0, alreadyMatched: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, noMatch: 0 };
        }
        statsBySource[src].total++;

        // Skip if already has a good matched_invoice_number with FAC
        if (cd.matched_invoice_number && cd.matched_invoice_fac) {
            stats.alreadyMatched++;
            statsBySource[src].alreadyMatched++;
            continue;
        }

        const gwAmount = Math.abs(parseFloat(gw.amount) || 0);
        const gwDate = gw.date?.split('T')[0] || '';
        const gwEmail = (cd.customer_email || cd.email || '').toLowerCase().trim();
        const gwName = normalize(cd.customer_name || cd.billing_name || cd.customer_company || '');
        const gwOrderId = cd.order_id || '';

        let matched = null;
        let strategy = '';

        // ─── S1: order_id → IO.order_number ───
        if (!matched && gwOrderId) {
            // BT order_id format: "4519a0d-5116552" → try full, then first part
            const candidates = ioByOrderNum.get(gwOrderId) || [];
            if (candidates.length > 0) {
                matched = candidates[0];
                strategy = 's1-order-id';
            } else {
                // Try first part before dash
                const firstPart = gwOrderId.split('-')[0];
                if (firstPart && firstPart !== gwOrderId) {
                    const c2 = ioByOrderNum.get(firstPart) || [];
                    if (c2.length > 0) {
                        matched = c2[0];
                        strategy = 's1-order-id-partial';
                    }
                }
            }

            // Also try matching invoice_number containing order_id
            if (!matched && gwOrderId.length >= 5) {
                for (const [invNum, ioRow] of ioByInvNum) {
                    if (invNum.toLowerCase().includes(gwOrderId.toLowerCase())) {
                        matched = ioRow;
                        strategy = 's1-order-in-invoice';
                        break;
                    }
                }
            }
        }

        // ─── S2: matched_invoice_number already set → verify + enrich ───
        if (!matched && cd.matched_invoice_number) {
            const ioRow = ioByInvNum.get(cd.matched_invoice_number);
            if (ioRow) {
                matched = ioRow;
                strategy = 's2-existing-inv';
            }
        }

        // ─── S3: email + amount ±5% + date ±30d ───
        if (!matched && gwEmail) {
            const emailCandidates = ioByEmail.get(gwEmail) || [];
            for (const ioRow of emailCandidates) {
                const ioAmount = Math.abs(parseFloat(ioRow.amount) || 0);
                const amountDiff = gwAmount > 0 && ioAmount > 0 ? Math.abs(gwAmount - ioAmount) / Math.max(gwAmount, ioAmount) : 1;
                const dateDiff = daysDiff(gwDate, ioRow.date);
                if (amountDiff <= 0.05 && dateDiff <= 30) {
                    matched = ioRow;
                    strategy = 's3-email-amount';
                    break;
                }
            }
            // Broader email match: just email + date ±15d (ignore amount)
            if (!matched) {
                for (const ioRow of emailCandidates) {
                    const dateDiff = daysDiff(gwDate, ioRow.date);
                    if (dateDiff <= 15) {
                        matched = ioRow;
                        strategy = 's3-email-date';
                        break;
                    }
                }
            }
        }

        // ─── S4: fuzzy name + amount ±5% ───
        if (!matched && gwName) {
            const nameMatches = fuzzyNameMatch(gwName);
            for (const nm of nameMatches.slice(0, 5)) {
                const ioRows = ioByName.get(nm.name) || [];
                for (const ioRow of ioRows) {
                    const ioAmount = Math.abs(parseFloat(ioRow.amount) || 0);
                    const amountDiff = gwAmount > 0 && ioAmount > 0 ? Math.abs(gwAmount - ioAmount) / Math.max(gwAmount, ioAmount) : 1;
                    const dateDiff = daysDiff(gwDate, ioRow.date);
                    if (amountDiff <= 0.05 && dateDiff <= 30) {
                        matched = ioRow;
                        strategy = `s4-name-amount(${nm.score.toFixed(2)})`;
                        break;
                    }
                }
                if (matched) break;
            }

            // Broader: name match + date ±15d (no amount check)
            if (!matched) {
                for (const nm of nameMatches.slice(0, 5)) {
                    const ioRows = ioByName.get(nm.name) || [];
                    for (const ioRow of ioRows) {
                        const dateDiff = daysDiff(gwDate, ioRow.date);
                        if (dateDiff <= 15) {
                            matched = ioRow;
                            strategy = `s4-name-date(${nm.score.toFixed(2)})`;
                            break;
                        }
                    }
                    if (matched) break;
                }
            }
        }

        // ─── S5: exact amount + date ±7d ───
        if (!matched && gwAmount > 0) {
            const key = Math.round(gwAmount);
            for (const k of [key, key - 1, key + 1]) {
                const candidates = ioByAmountKey.get(k) || [];
                for (const ioRow of candidates) {
                    const ioAmount = Math.abs(parseFloat(ioRow.amount) || 0);
                    if (Math.abs(gwAmount - ioAmount) <= 0.50 && daysDiff(gwDate, ioRow.date) <= 7) {
                        matched = ioRow;
                        strategy = 's5-amount-date';
                        break;
                    }
                }
                if (matched) break;
            }
        }

        // ─── Record result ───
        if (matched) {
            const ioCd = matched.custom_data || {};
            const sKey = strategy.split('-')[0].split('(')[0]; // e.g. "s1", "s2" etc.
            stats[sKey] = (stats[sKey] || 0) + 1;
            statsBySource[src][sKey] = (statsBySource[src][sKey] || 0) + 1;

            updates.push({
                id: gw.id,
                fields: {
                    matched_invoice_number: ioCd.invoice_number || cd.matched_invoice_number || null,
                    matched_invoice_fac: ioCd.financial_account_code || cd.matched_invoice_fac || null,
                    matched_order_id: ioCd.order_number || null,
                    matched_customer_name: ioCd.customer_name || null,
                    matched_products: matched.description || null,
                    matched_email: ioCd.email || null,
                    matched_billing_entity: ioCd.billing_entity || null,
                    matched_order_type: ioCd.order_type || null,
                    order_reconciliation_strategy: strategy,
                    order_reconciled_at: new Date().toISOString(),
                },
            });
        } else {
            stats.noMatch++;
            statsBySource[src].noMatch++;
        }
    }

    // ─── Print results ───
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  RESULTS                                                      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    const totalMatched = stats.alreadyMatched + stats.s1 + stats.s2 + stats.s3 + stats.s4 + stats.s5;
    const pct = stats.total > 0 ? ((totalMatched / stats.total) * 100).toFixed(1) : '0';

    console.log(`\n  Total gateway txs: ${stats.total}`);
    console.log(`  Already matched:   ${stats.alreadyMatched}`);
    console.log(`  S1 (order_id):     ${stats.s1}`);
    console.log(`  S2 (existing inv): ${stats.s2}`);
    console.log(`  S3 (email):        ${stats.s3}`);
    console.log(`  S4 (name fuzzy):   ${stats.s4}`);
    console.log(`  S5 (amount+date):  ${stats.s5}`);
    console.log(`  No match:          ${stats.noMatch}`);
    console.log(`  ─────────────────────────`);
    console.log(`  TOTAL MATCHED:     ${totalMatched} / ${stats.total} (${pct}%)`);
    console.log(`  TARGET:            ≥70%`);
    console.log(`  STATUS:            ${parseFloat(pct) >= 70 ? '✅ TARGET MET' : '❌ BELOW TARGET'}\n`);

    console.log('  Per-source breakdown:');
    for (const [src, s] of Object.entries(statsBySource)) {
        const srcMatched = s.alreadyMatched + s.s1 + s.s2 + s.s3 + s.s4 + s.s5;
        const srcPct = s.total > 0 ? ((srcMatched / s.total) * 100).toFixed(1) : '0';
        console.log(`    ${src}: ${srcMatched}/${s.total} (${srcPct}%) [S1=${s.s1} S2=${s.s2} S3=${s.s3} S4=${s.s4} S5=${s.s5} pre=${s.alreadyMatched}]`);
    }

    // ─── Write updates ───
    if (!DRY_RUN && updates.length > 0) {
        console.log(`\n[WRITE] Writing ${updates.length} updates to DB...`);
        const written = await writeUpdates(updates, 'gw-orders-v2');
        console.log(`  ✅ ${written} updates written successfully`);
    } else if (DRY_RUN) {
        console.log(`\n[DRY RUN] Would write ${updates.length} updates. Use --apply to execute.`);
    }

    console.log('\n✅ Done');
})();
