/**
 * MEGA RECONCILIATION V4 — PUSH TO 100%
 * 
 * Builds on V3 results. Only processes bank inflows that STILL lack pnl_line/pnl_fac.
 * Never overwrites existing classifications.
 *
 * Phase 0: Diagnostic — categorize all unclassified bank inflows
 * Phase 1: Mark internal transfers (propia cuenta, traspaso, movimiento entre, dotacion)
 * Phase 2: Mark intercompany DSD (DSD LLC→SL, Planning Center)
 * Phase 3: Expanded gateway matching (wider tolerances)
 * Phase 4: Transfer name extraction → IO → FAC
 * Phase 5: Gateway-dominant FAC fallback (for rows with paymentSource but no P&L)
 * Phase 6: Catch-all Other Income (105.0) for remaining genuine inflows
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

function computeDominantFAC(rows, gwTxToFAC, invToFac) {
    const facFreq = {};
    for (const r of rows) {
        let fac = r.custom_data?.matched_invoice_fac;
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

(async () => {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║    MEGA RECONCILIATION V4 — PUSH TO 100% COVERAGE       ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : '🔴 LIVE — WRITING TO DB'}\n`);

    // ─── Load all data ───
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
    const stripeAll = [...stripeEur, ...stripeUsd];
    const allGW = [...btRev, ...btAmex, ...stripeAll, ...gc];

    console.log(`  BT-Rev=${btRev.length}, Amex=${btAmex.length}, Stripe=${stripeAll.length}, GC=${gc.length}`);
    console.log(`  IO=${io.length}, BankEUR=${bankEur.length}, Chase=${chaseUsd.length}, Disb=${btDisb.length}\n`);

    // ─── Build indexes ───
    const invToFac = {};
    const ioByName = new Map();
    const customerDominantFAC = {};

    io.forEach(r => {
        const cd = r.custom_data || {};
        if (cd.invoice_number && cd.financial_account_code) {
            invToFac[cd.invoice_number] = cd.financial_account_code;
        }
        const name = normalize(cd.customer_name);
        if (name && name.length >= 3) {
            if (!ioByName.has(name)) ioByName.set(name, []);
            ioByName.get(name).push(r);
        }
    });

    // Build customer → dominant FAC
    for (const [name, rows] of ioByName) {
        const facFreq = {};
        rows.forEach(r => {
            const fac = r.custom_data?.financial_account_code;
            if (fac) facFreq[fac] = (facFreq[fac] || 0) + 1;
        });
        let best = null, bestCount = 0;
        for (const [fac, cnt] of Object.entries(facFreq)) {
            if (cnt > bestCount) { best = fac; bestCount = cnt; }
        }
        if (best) customerDominantFAC[name] = best;
    }

    // Build gwTxToFAC
    const gwTxToFAC = {};
    allGW.forEach(r => {
        const txId = r.custom_data?.transaction_id || r.custom_data?.gocardless_id || r.custom_data?.payment_id;
        if (!txId) return;
        let fac = r.custom_data?.matched_invoice_fac;
        if (!fac && r.custom_data?.matched_invoice_number) fac = invToFac[r.custom_data.matched_invoice_number];
        if (!fac) {
            const name = normalize(r.custom_data?.customer_name);
            if (name && customerDominantFAC[name]) fac = customerDominantFAC[name];
        }
        if (fac) gwTxToFAC[txId] = fac;
    });

    // Build date-indexed lookups
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

    const btByDisbDate = new Map();
    [...btRev, ...btAmex].forEach(r => {
        const key = (r.custom_data?.disbursement_date || '').substring(0, 10);
        if (key) { if (!btByDisbDate.has(key)) btByDisbDate.set(key, []); btByDisbDate.get(key).push(r); }
    });

    const disbByDate = new Map();
    btDisb.forEach(r => {
        const key = (r.date || '').substring(0, 10);
        if (key) { if (!disbByDate.has(key)) disbByDate.set(key, []); disbByDate.get(key).push(r); }
    });

    // Gateway dominant FACs
    const btRevDominantFAC = computeDominantFAC(btRev, gwTxToFAC, invToFac);
    const btAmexDominantFAC = computeDominantFAC(btAmex, gwTxToFAC, invToFac);
    const stripeDominantFAC = computeDominantFAC(stripeAll, gwTxToFAC, invToFac);
    const gcDominantFAC = computeDominantFAC(gc, gwTxToFAC, invToFac);

    console.log(`  Dominant FACs: BT-Rev=${btRevDominantFAC}, Amex=${btAmexDominantFAC}, Stripe=${stripeDominantFAC}, GC=${gcDominantFAC}`);
    console.log(`  IO names: ${ioByName.size}, Cust→FAC: ${Object.keys(customerDominantFAC).length}, GW→FAC: ${Object.keys(gwTxToFAC).length}\n`);

    // ─── Identify unclassified bank inflows ───
    const allBankInflows = [
        ...bankEur.filter(r => parseFloat(r.amount) > 0),
        ...chaseUsd.filter(r => parseFloat(r.amount) > 0)
    ];

    const unclassified = allBankInflows.filter(r => {
        const cd = r.custom_data || {};
        return !cd.pnl_line && !cd.pnl_fac;
    });

    const alreadyClassified = allBankInflows.length - unclassified.length;
    console.log(`  Bank inflows: ${allBankInflows.length} total, ${alreadyClassified} already classified, ${unclassified.length} to process\n`);

    if (unclassified.length === 0) {
        console.log('  ✅ All bank inflows already classified! Nothing to do.');
        process.exit(0);
    }

    // ════════════════════════════════════════════════════════
    // PHASE 0: DIAGNOSTIC — Categorize unclassified rows
    // ════════════════════════════════════════════════════════
    console.log('════════════════════════════════════════════');
    console.log('  PHASE 0: DIAGNOSTIC');
    console.log('════════════════════════════════════════════\n');

    const categories = {};
    unclassified.forEach(r => {
        const ps = (r.custom_data?.paymentSource || '').toLowerCase();
        const desc = (r.description || '').toLowerCase();
        let cat;

        // Internal transfers
        if (/propia cuenta|movimiento entre|traspaso(?:s)? (?:propios?|entre)|dotacion|cuenta propia/i.test(desc)) {
            cat = 'internal-transfer';
        } else if (/transferencia\s+a\s+favor|transf.*propia|mov(?:imiento)?\s+interno/i.test(desc)) {
            cat = 'internal-transfer';
            // Intercompany DSD
        } else if (desc.includes('dsd') && (desc.includes('llc') || desc.includes('s.l') || desc.includes('sl ') || desc.includes('planning center'))) {
            cat = 'intercompany-dsd';
            // Gateway-tagged but no P&L
        } else if (ps) {
            cat = `has-gateway:${ps}`;
            // Transfer with extractable name
        } else if (/^transf\//i.test(desc) || /^trans\s*(?:inm)?[\s\/]/i.test(desc)) {
            cat = 'transfer-with-name';
        } else if (/^mxiso\s+/i.test(desc)) {
            cat = 'transfer-mxiso';
        } else if (/orig co name:/i.test(desc)) {
            cat = 'transfer-wire-origco';
            // Remesa/Abono
        } else if (/remesa|abono|domicilia/i.test(desc)) {
            cat = 'remesa-abono';
            // Check/cheque
        } else if (/cheque?|check\b/i.test(desc)) {
            cat = 'check';
            // Wire
        } else if (/wire\b/i.test(desc)) {
            cat = 'wire';
            // Gateway in desc but not tagged
        } else if (desc.includes('paypal')) cat = 'desc-gateway:paypal';
        else if (desc.includes('stripe')) cat = 'desc-gateway:stripe';
        else if (desc.includes('gocardless') || desc.includes('go cardless')) cat = 'desc-gateway:gocardless';
        else if (desc.includes('american express') || desc.includes('amex')) cat = 'desc-gateway:amex';
        else if (desc.includes('braintree')) cat = 'desc-gateway:braintree';
        else {
            cat = 'other';
        }

        if (!categories[cat]) categories[cat] = { count: 0, amount: 0, samples: [] };
        categories[cat].count++;
        categories[cat].amount += parseFloat(r.amount);
        if (categories[cat].samples.length < 3) {
            categories[cat].samples.push(`  ${r.source} | ${r.date} | ${parseFloat(r.amount).toFixed(2)} | ${r.description?.substring(0, 70)}`);
        }
    });

    console.log(`  ${unclassified.length} unclassified bank inflows:\n`);
    Object.entries(categories).sort((a, b) => b[1].count - a[1].count).forEach(([cat, data]) => {
        console.log(`  ${cat}: ${data.count} rows (€${data.amount.toFixed(2)})`);
        data.samples.forEach(s => console.log(`    ${s}`));
    });

    // ════════════════════════════════════════════════════════
    // PHASE 1: Mark internal transfers
    // ════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════');
    console.log('  PHASE 1: MARK INTERNAL TRANSFERS');
    console.log('════════════════════════════════════════════\n');

    const INTERNAL_REGEX = /propia cuenta|movimiento entre|traspaso(?:s)? (?:propios?|entre)|dotacion|cuenta propia|transferencia\s+a\s+favor.*propia|transf.*propia|mov(?:imiento)?\s+interno/i;

    const internalUpdates = [];
    const processed = new Set();

    unclassified.forEach(r => {
        if (processed.has(r.id)) return;
        const desc = (r.description || '');
        if (INTERNAL_REGEX.test(desc)) {
            internalUpdates.push({
                id: r.id,
                fields: {
                    pnl_line: 'internal',
                    is_internal_transfer: true,
                    pnl_source: 'auto-internal-v4',
                    pnl_classified_at: new Date().toISOString()
                }
            });
            processed.add(r.id);
        }
    });

    console.log(`  Internal transfers marked: ${internalUpdates.length}`);

    // ════════════════════════════════════════════════════════
    // PHASE 2: Mark intercompany DSD
    // ════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════');
    console.log('  PHASE 2: MARK INTERCOMPANY DSD');
    console.log('════════════════════════════════════════════\n');

    const dsdUpdates = [];
    unclassified.forEach(r => {
        if (processed.has(r.id)) return;
        const desc = (r.description || '').toLowerCase();
        if (desc.includes('dsd') && (desc.includes('llc') || desc.includes('s.l') || desc.includes('sl ') || desc.includes('sl,') || desc.includes('planning center'))) {
            dsdUpdates.push({
                id: r.id,
                fields: {
                    pnl_line: 'internal',
                    is_internal_transfer: true,
                    pnl_source: 'intercompany-dsd-v4',
                    pnl_classified_at: new Date().toISOString()
                }
            });
            processed.add(r.id);
        }
    });

    console.log(`  Intercompany DSD marked: ${dsdUpdates.length}`);

    // ════════════════════════════════════════════════════════
    // PHASE 3: Expanded gateway matching (wider tolerances)
    // ════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════');
    console.log('  PHASE 3: EXPANDED GATEWAY MATCHING');
    console.log('════════════════════════════════════════════\n');

    const gwExpandedUpdates = [];
    const gwStats = { stripe: 0, gc: 0, paypal: 0, amex: 0, bt: 0 };

    const remaining = unclassified.filter(r => !processed.has(r.id));

    for (const bank of remaining) {
        const ps = (bank.custom_data?.paymentSource || '').toLowerCase();
        const desc = (bank.description || '').toLowerCase();
        const bankAmt = parseFloat(bank.amount);
        const bankDate = bank.date;

        // ─── STRIPE ───
        if (ps.includes('stripe') || desc.includes('stripe')) {
            let found = false;
            for (let delta = -7; delta <= 7; delta++) {
                const d = new Date(bankDate);
                d.setDate(d.getDate() + delta);
                const key = d.toISOString().substring(0, 10);
                const txs = stripeByDate.get(key) || [];

                // Sum match (wider: 5% or €10)
                const dayTotal = txs.reduce((s, t) => s + normalizeAmount(t.amount), 0);
                if (dayTotal > 0 && Math.abs(dayTotal - bankAmt) < Math.max(bankAmt * 0.05, 10)) {
                    const txIds = txs.map(t => t.custom_data?.transaction_id).filter(Boolean);
                    let fac = null;
                    for (const t of txs) {
                        fac = t.custom_data?.matched_invoice_fac || (t.custom_data?.matched_invoice_number && invToFac[t.custom_data.matched_invoice_number]);
                        if (fac) break;
                    }
                    if (!fac) fac = stripeDominantFAC;
                    gwExpandedUpdates.push({
                        id: bank.id, fields: {
                            paymentSource: 'Stripe', reconciliationType: 'bank-stripe-v4',
                            ...(txIds.length && { transaction_ids: txIds }),
                            ...(fac && { pnl_fac: fac }),
                            pnl_source: 'expanded-gateway-v4'
                        }
                    });
                    gwStats.stripe++;
                    found = true;
                    break;
                }

                // Individual (wider: 5% or €5)
                for (const t of txs) {
                    const tAmt = normalizeAmount(t.amount);
                    if (Math.abs(tAmt - bankAmt) < Math.max(bankAmt * 0.05, 5)) {
                        const txId = t.custom_data?.transaction_id;
                        const fac = gwTxToFAC[txId] || t.custom_data?.matched_invoice_fac || stripeDominantFAC;
                        gwExpandedUpdates.push({
                            id: bank.id, fields: {
                                paymentSource: 'Stripe', reconciliationType: 'bank-stripe-v4',
                                ...(txId && { transaction_ids: [txId] }),
                                ...(fac && { pnl_fac: fac }),
                                pnl_source: 'expanded-gateway-v4'
                            }
                        });
                        gwStats.stripe++;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (found) { processed.add(bank.id); continue; }
        }

        // ─── GOCARDLESS ───
        if (ps.includes('gocardless') || desc.includes('gocardless') || desc.includes('go cardless')) {
            let found = false;
            for (let delta = -7; delta <= 7; delta++) {
                const d = new Date(bankDate);
                d.setDate(d.getDate() + delta);
                const key = d.toISOString().substring(0, 10);
                const txs = gcByDate.get(key) || [];

                const dayTotal = txs.reduce((s, t) => s + normalizeAmount(t.amount), 0);
                if (dayTotal > 0 && Math.abs(dayTotal - bankAmt) < Math.max(bankAmt * 0.05, 10)) {
                    const txIds = txs.map(t => t.custom_data?.gocardless_id || t.custom_data?.payment_id).filter(Boolean);
                    let fac = null;
                    for (const t of txs) {
                        fac = t.custom_data?.matched_invoice_fac;
                        if (fac) break;
                    }
                    if (!fac) fac = gcDominantFAC;
                    gwExpandedUpdates.push({
                        id: bank.id, fields: {
                            paymentSource: 'Gocardless', reconciliationType: 'bank-gc-v4',
                            ...(txIds.length && { gc_transaction_ids: txIds }),
                            ...(fac && { pnl_fac: fac }),
                            pnl_source: 'expanded-gateway-v4'
                        }
                    });
                    gwStats.gc++;
                    found = true;
                    break;
                }

                for (const t of txs) {
                    const tAmt = normalizeAmount(t.amount);
                    if (Math.abs(tAmt - bankAmt) < Math.max(bankAmt * 0.05, 5)) {
                        const txId = t.custom_data?.gocardless_id || t.custom_data?.payment_id;
                        const fac = gwTxToFAC[txId] || t.custom_data?.matched_invoice_fac || gcDominantFAC;
                        gwExpandedUpdates.push({
                            id: bank.id, fields: {
                                paymentSource: 'Gocardless', reconciliationType: 'bank-gc-v4',
                                ...(txId && { gc_transaction_ids: [txId] }),
                                ...(fac && { pnl_fac: fac }),
                                pnl_source: 'expanded-gateway-v4'
                            }
                        });
                        gwStats.gc++;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (found) { processed.add(bank.id); continue; }
        }

        // ─── PAYPAL ───
        if (ps.includes('paypal') || (desc.includes('paypal') && !desc.includes('braintree'))) {
            let found = false;
            for (let delta = -7; delta <= 7; delta++) {
                const d = new Date(bankDate);
                d.setDate(d.getDate() + delta);
                const key = d.toISOString().substring(0, 10);

                const disbs = disbByDate.get(key) || [];
                for (const disb of disbs) {
                    const disbAmt = normalizeAmount(disb.amount);
                    if (Math.abs(disbAmt - bankAmt) < Math.max(bankAmt * 0.05, 10)) {
                        const txIds = (disb.custom_data?.transaction_ids || []).slice(0, 50);
                        let fac = null;
                        for (const txId of txIds.slice(0, 20)) {
                            if (gwTxToFAC[txId]) { fac = gwTxToFAC[txId]; break; }
                        }
                        if (!fac) fac = btRevDominantFAC;
                        gwExpandedUpdates.push({
                            id: bank.id, fields: {
                                paymentSource: 'paypal', reconciliationType: 'bank-paypal-v4',
                                ...(txIds.length && { transaction_ids: txIds }),
                                ...(fac && { pnl_fac: fac }),
                                pnl_source: 'expanded-gateway-v4'
                            }
                        });
                        gwStats.paypal++;
                        found = true;
                        break;
                    }
                }
                if (found) break;

                // BT revenue sum by disbursement date
                const btTxs = btByDisbDate.get(key) || [];
                if (btTxs.length > 0) {
                    const dayTotal = btTxs.reduce((s, t) => s + normalizeAmount(t.amount), 0);
                    if (Math.abs(dayTotal - bankAmt) < Math.max(bankAmt * 0.05, 10)) {
                        const txIds = btTxs.map(t => t.custom_data?.transaction_id).filter(Boolean).slice(0, 50);
                        let fac = null;
                        for (const txId of txIds.slice(0, 20)) {
                            if (gwTxToFAC[txId]) { fac = gwTxToFAC[txId]; break; }
                        }
                        if (!fac) fac = btRevDominantFAC;
                        gwExpandedUpdates.push({
                            id: bank.id, fields: {
                                paymentSource: 'paypal', reconciliationType: 'bank-paypal-btsum-v4',
                                ...(txIds.length && { transaction_ids: txIds }),
                                ...(fac && { pnl_fac: fac }),
                                pnl_source: 'expanded-gateway-v4'
                            }
                        });
                        gwStats.paypal++;
                        found = true;
                        break;
                    }
                }
            }
            if (found) { processed.add(bank.id); continue; }
        }

        // ─── AMEX ───
        if (ps.includes('amex') || desc.includes('american express') || desc.includes('amex')) {
            let found = false;
            for (let delta = -10; delta <= 10; delta++) {
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
                        const txIds = amexTxs.map(t => t.custom_data?.transaction_id).filter(Boolean).slice(0, 50);
                        let fac = null;
                        for (const txId of txIds.slice(0, 20)) {
                            if (gwTxToFAC[txId]) { fac = gwTxToFAC[txId]; break; }
                        }
                        if (!fac) fac = btAmexDominantFAC;
                        gwExpandedUpdates.push({
                            id: bank.id, fields: {
                                paymentSource: 'braintree (amex)', reconciliationType: 'bank-amex-v4',
                                ...(txIds.length && { transaction_ids: txIds }),
                                ...(fac && { pnl_fac: fac }),
                                pnl_source: 'expanded-gateway-v4'
                            }
                        });
                        gwStats.amex++;
                        found = true;
                        break;
                    }
                }
            }
            if (found) { processed.add(bank.id); continue; }
        }

        // ─── BRAINTREE direct ───
        if (ps.includes('braintree') && !ps.includes('amex')) {
            let found = false;
            for (let delta = -5; delta <= 5; delta++) {
                const d = new Date(bankDate);
                d.setDate(d.getDate() + delta);
                const key = d.toISOString().substring(0, 10);
                const disbs = disbByDate.get(key) || [];
                for (const disb of disbs) {
                    const disbAmt = normalizeAmount(disb.amount);
                    if (Math.abs(disbAmt - bankAmt) < Math.max(bankAmt * 0.03, 5)) {
                        const txIds = (disb.custom_data?.transaction_ids || []).slice(0, 50);
                        let fac = null;
                        for (const txId of txIds.slice(0, 20)) {
                            if (gwTxToFAC[txId]) { fac = gwTxToFAC[txId]; break; }
                        }
                        if (!fac) fac = btRevDominantFAC;
                        gwExpandedUpdates.push({
                            id: bank.id, fields: {
                                reconciliationType: 'bank-bt-disb-v4',
                                ...(txIds.length && { transaction_ids: txIds }),
                                ...(fac && { pnl_fac: fac }),
                                pnl_source: 'expanded-gateway-v4'
                            }
                        });
                        gwStats.bt++;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (found) { processed.add(bank.id); continue; }
        }
    }

    console.log(`  Expanded gateway matches: ${gwExpandedUpdates.length}`);
    console.log(`    Stripe: ${gwStats.stripe}, GC: ${gwStats.gc}, PayPal: ${gwStats.paypal}, AmEx: ${gwStats.amex}, BT: ${gwStats.bt}`);

    // ════════════════════════════════════════════════════════
    // PHASE 4: Transfer name extraction → IO → FAC
    // ════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════');
    console.log('  PHASE 4: TRANSFER NAME → IO → FAC');
    console.log('════════════════════════════════════════════\n');

    const nameUpdates = [];
    const remaining2 = unclassified.filter(r => !processed.has(r.id));

    for (const bank of remaining2) {
        const desc = bank.description || '';
        let extractedName = null;
        let method = null;

        // Pattern 1: TRANSF/NAME, Trans/NAME, Trans inm/NAME
        let m = desc.match(/trans(?:f|\.?\s*inm)?\/(.+)/i);
        if (m) { extractedName = m[1].trim(); method = 'transf-prefix'; }

        // Pattern 2: MXISO NAME
        if (!extractedName) {
            m = desc.match(/^mxiso\s+(.+)/i);
            if (m) { extractedName = m[1].trim(); method = 'mxiso'; }
        }

        // Pattern 3: ORIG CO NAME:NAME
        if (!extractedName) {
            m = desc.match(/orig co name:\s*(.+?)(?:\s+orig id|\s+sec|\s*$)/i);
            if (m) { extractedName = m[1].trim(); method = 'orig-co-name'; }
        }

        // Pattern 4: REMESA ... de NAME (extract after common prefixes)
        if (!extractedName) {
            m = desc.match(/remesa\s+(?:de\s+)?(.+)/i);
            if (m) { extractedName = m[1].trim(); method = 'remesa'; }
        }

        // Pattern 5: ACH/WIRE patterns
        if (!extractedName) {
            m = desc.match(/(?:ach|wire|chips)\s+(?:credit|deposit|transfer)?\s*(?:from\s+)?(.+)/i);
            if (m) { extractedName = m[1].trim(); method = 'ach-wire'; }
        }

        // Pattern 6: ABONO ... 
        if (!extractedName) {
            m = desc.match(/abono\s+(?:de\s+)?(.+)/i);
            if (m) { extractedName = m[1].trim(); method = 'abono'; }
        }

        if (!extractedName || extractedName.length < 3) continue;

        // Skip known non-customer names
        const nameL = extractedName.toLowerCase();
        if (['paypal europe', 'paypal', 'stripe', 'gocardless', 'braintree', 'american express'].some(x => nameL.includes(x))) continue;

        const norm = normalize(extractedName);
        if (norm.length < 3) continue;

        // Exact match in IO
        let fac = null;
        if (ioByName.has(norm)) {
            fac = customerDominantFAC[norm];
        }

        // Partial match (substring)
        if (!fac) {
            for (const [ioName] of ioByName) {
                if (ioName.length < 4) continue;
                if (norm.includes(ioName) || ioName.includes(norm)) {
                    if (customerDominantFAC[ioName]) {
                        fac = customerDominantFAC[ioName];
                        break;
                    }
                }
            }
        }

        // Fuzzy match: 2+ word overlap
        if (!fac) {
            const parts = norm.split(' ').filter(w => w.length >= 3);
            if (parts.length >= 1) {
                for (const [ioName] of ioByName) {
                    const ioWords = getWords(ioName);
                    const overlap = parts.filter(p => ioWords.some(w => w === p || (w.length >= 5 && p.length >= 5 && (w.startsWith(p.substring(0, 4)) || p.startsWith(w.substring(0, 4))))));
                    if (overlap.length >= 2 || (overlap.length === 1 && ioWords.length === 1 && overlap[0].length >= 5)) {
                        if (customerDominantFAC[ioName]) {
                            fac = customerDominantFAC[ioName];
                            break;
                        }
                    }
                }
            }
        }

        if (fac) {
            const pnlLine = fac.split('.')[0] || '105';
            nameUpdates.push({
                id: bank.id,
                fields: {
                    pnl_line: pnlLine,
                    pnl_fac: fac,
                    pnl_source: `name-extraction-${method}-v4`,
                    extracted_customer: extractedName,
                    pnl_classified_at: new Date().toISOString()
                }
            });
            processed.add(bank.id);
        }
    }

    console.log(`  Name extraction matches: ${nameUpdates.length}`);

    // ════════════════════════════════════════════════════════
    // PHASE 5: Gateway-dominant FAC fallback
    // ════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════');
    console.log('  PHASE 5: GATEWAY-DOMINANT FAC FALLBACK');
    console.log('════════════════════════════════════════════\n');

    const gwFallbackUpdates = [];
    const remaining3 = unclassified.filter(r => !processed.has(r.id));

    for (const bank of remaining3) {
        const ps = (bank.custom_data?.paymentSource || '').toLowerCase();
        const desc = (bank.description || '').toLowerCase();
        let assignedFAC = null;

        if (ps.includes('paypal') || desc.includes('paypal')) assignedFAC = btRevDominantFAC;
        else if (ps.includes('amex') || desc.includes('amex') || desc.includes('american express')) assignedFAC = btAmexDominantFAC;
        else if (ps.includes('stripe') || desc.includes('stripe')) assignedFAC = stripeDominantFAC;
        else if (ps.includes('gocardless') || desc.includes('gocardless')) assignedFAC = gcDominantFAC;
        else if (ps.includes('braintree')) assignedFAC = btRevDominantFAC;

        // Also check existing transaction_ids
        if (!assignedFAC) {
            const txIds = bank.custom_data?.transaction_ids || [];
            for (const txId of txIds) {
                if (gwTxToFAC[txId]) { assignedFAC = gwTxToFAC[txId]; break; }
            }
        }

        if (assignedFAC) {
            const pnlLine = assignedFAC.split('.')[0] || '105';
            gwFallbackUpdates.push({
                id: bank.id,
                fields: {
                    pnl_fac: assignedFAC,
                    pnl_line: pnlLine,
                    pnl_source: 'gateway-dominant-fac-v4',
                    pnl_classified_at: new Date().toISOString()
                }
            });
            processed.add(bank.id);
        }
    }

    console.log(`  Gateway-dominant FAC assigned: ${gwFallbackUpdates.length}`);

    // ════════════════════════════════════════════════════════
    // PHASE 6: Catch-all Other Income (105.0)
    // ════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════');
    console.log('  PHASE 6: CATCH-ALL OTHER INCOME');
    console.log('════════════════════════════════════════════\n');

    const catchAllUpdates = [];
    const remaining4 = unclassified.filter(r => !processed.has(r.id));

    for (const bank of remaining4) {
        catchAllUpdates.push({
            id: bank.id,
            fields: {
                pnl_line: '105',
                pnl_fac: '105.0',
                pnl_source: 'catch-all-other-income-v4',
                pnl_classified_at: new Date().toISOString()
            }
        });
        processed.add(bank.id);
    }

    console.log(`  Catch-all Other Income: ${catchAllUpdates.length}`);

    // ════════════════════════════════════════════════════════
    // PROJECTED SCORECARD
    // ════════════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║           PROJECTED V4 SCORECARD                         ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    const allUpdates = [...internalUpdates, ...dsdUpdates, ...gwExpandedUpdates, ...nameUpdates, ...gwFallbackUpdates, ...catchAllUpdates];

    const bankEurInflows = bankEur.filter(r => parseFloat(r.amount) > 0);
    const chaseInflows = chaseUsd.filter(r => parseFloat(r.amount) > 0);

    // Count internals being excluded
    const internalBankEur = internalUpdates.filter(u => bankEurInflows.some(b => b.id === u.id)).length
        + dsdUpdates.filter(u => bankEurInflows.some(b => b.id === u.id)).length;
    const internalChase = internalUpdates.filter(u => chaseInflows.some(b => b.id === u.id)).length
        + dsdUpdates.filter(u => chaseInflows.some(b => b.id === u.id)).length;

    const bankEurRelevant = bankEurInflows.length - internalBankEur;
    const chaseRelevant = chaseInflows.length - internalChase;

    // Count classified (excluding internals)
    const bankEurExisting = bankEurInflows.filter(r => r.custom_data?.pnl_line || r.custom_data?.pnl_fac).length;
    const chaseExisting = chaseInflows.filter(r => r.custom_data?.pnl_line || r.custom_data?.pnl_fac).length;

    const newRevenueUpdates = [...gwExpandedUpdates, ...nameUpdates, ...gwFallbackUpdates, ...catchAllUpdates];
    const bankEurNew = newRevenueUpdates.filter(u => bankEurInflows.some(b => b.id === u.id)).length;
    const chaseNew = newRevenueUpdates.filter(u => chaseInflows.some(b => b.id === u.id)).length;

    const bankEurTotal = bankEurExisting + bankEurNew;
    const chaseTotal = chaseExisting + chaseNew;

    const totalRelevant = bankEurRelevant + chaseRelevant;
    const totalClassified = bankEurTotal + chaseTotal;

    console.log('  Metric                        Coverage        Status');
    console.log('  ─────────────────────────────  ────────────   ──────');
    console.log(`  Bankinter EUR → P&L           ${bankEurTotal}/${bankEurRelevant} (${bankEurRelevant > 0 ? Math.round(bankEurTotal / bankEurRelevant * 100) : 100}%)    ${bankEurTotal >= bankEurRelevant ? '✅' : '⚠️'}`);
    console.log(`  Chase USD → P&L               ${chaseTotal}/${chaseRelevant} (${chaseRelevant > 0 ? Math.round(chaseTotal / chaseRelevant * 100) : 100}%)    ${chaseTotal >= chaseRelevant ? '✅' : '⚠️'}`);
    console.log(`  Total Bank → P&L              ${totalClassified}/${totalRelevant} (${totalRelevant > 0 ? Math.round(totalClassified / totalRelevant * 100) : 100}%)    ${totalClassified >= totalRelevant ? '✅' : '⚠️'}`);
    console.log(`\n  Internal excluded:            ${internalBankEur + internalChase} rows (Bankinter: ${internalBankEur}, Chase: ${internalChase})`);

    console.log('\n  Update breakdown:');
    console.log(`    Phase 1 (internal):         ${internalUpdates.length}`);
    console.log(`    Phase 2 (DSD):              ${dsdUpdates.length}`);
    console.log(`    Phase 3 (expanded GW):      ${gwExpandedUpdates.length}`);
    console.log(`    Phase 4 (name extraction):  ${nameUpdates.length}`);
    console.log(`    Phase 5 (GW dominant):      ${gwFallbackUpdates.length}`);
    console.log(`    Phase 6 (catch-all 105):    ${catchAllUpdates.length}`);
    console.log(`    TOTAL:                      ${allUpdates.length}`);

    // ════════════════════════════════════════════════════════
    // WRITE ALL UPDATES
    // ════════════════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════');
    console.log('  WRITING UPDATES');
    console.log('════════════════════════════════════════════\n');

    if (DRY_RUN) {
        console.log('  DRY RUN — no writes performed');
        console.log('\n  Run without --dry-run to apply changes.');
    } else if (allUpdates.length > 0) {
        const labels = [
            ['Internal', internalUpdates],
            ['DSD', dsdUpdates],
            ['GW-Expanded', gwExpandedUpdates],
            ['Name-Extract', nameUpdates],
            ['GW-Dominant', gwFallbackUpdates],
            ['Catch-All', catchAllUpdates],
        ];

        for (const [label, updates] of labels) {
            if (updates.length > 0) {
                const written = await writeUpdates(updates, label);
                console.log(`  ${label}: ${written}/${updates.length} written`);
            }
        }
    } else {
        console.log('  No updates to write.');
    }

    console.log('\n✅ V4 reconciliation complete!');
    process.exit(0);
})();
