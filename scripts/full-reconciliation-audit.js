/**
 * COMPREHENSIVE RECONCILIATION AUDIT
 * Full analysis of ALL gateways, ALL bank sources, ALL matching chains
 */
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
    'https://rrzgawssbyfzbkmtcovz.supabase.co',
    'sb_secret_d5XN1_EVZod7kJJCRZpXmw_ncDkXEoY'
);

async function paginate(source, fields) {
    let all = [];
    let page = 0;
    const f = fields || 'id, amount, date, description, reconciled, custom_data, source';
    while (true) {
        const q = source
            ? s.from('csv_rows').select(f).eq('source', source).range(page * 1000, (page + 1) * 1000 - 1)
            : s.from('csv_rows').select(f).range(page * 1000, (page + 1) * 1000 - 1);
        const { data, error } = await q;
        if (error) { console.error('Error:', error.message); break; }
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
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║  COMPREHENSIVE RECONCILIATION AUDIT - ALL SOURCES ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');

    // === 1. Load ALL data by source ===
    console.log('[1] Loading all data...');
    const sources = {};
    const allSources = [
        'bankinter-eur', 'bankinter-usd', 'sabadell', 'chase-usd',
        'braintree-api-revenue', 'braintree-api-disbursement', 'braintree-api-fees',
        'braintree-amex',
        'stripe-eur', 'stripe-usd',
        'gocardless',
        'invoice-orders', 'web-orders'
    ];

    for (const src of allSources) {
        sources[src] = await paginate(src);
        console.log(`  ${src}: ${sources[src].length} rows`);
    }

    // === 2. BANK INFLOWS ANALYSIS ===
    console.log('\n══════════════════════════════════════');
    console.log('  2. BANK INFLOWS - GATEWAY COVERAGE');
    console.log('══════════════════════════════════════\n');

    const bankSources = ['bankinter-eur', 'bankinter-usd', 'sabadell', 'chase-usd'];

    for (const bs of bankSources) {
        const rows = sources[bs];
        const inflows = rows.filter(r => parseFloat(r.amount) > 0);
        const outflows = rows.filter(r => parseFloat(r.amount) < 0);
        const inflowAmt = inflows.reduce((s, r) => s + parseFloat(r.amount), 0);

        const withPS = inflows.filter(r => r.custom_data?.paymentSource);
        const withPSAmt = withPS.reduce((s, r) => s + parseFloat(r.amount), 0);
        const withTxIds = inflows.filter(r => r.custom_data?.transaction_ids?.length > 0);
        const withPnl = inflows.filter(r => r.custom_data?.pnl_line || r.custom_data?.pnl_fac);
        const reconciled = inflows.filter(r => r.reconciled);

        // Gateway distribution
        const gwDist = {};
        inflows.forEach(r => {
            const gw = r.custom_data?.paymentSource || 'sem-gateway';
            gwDist[gw] = (gwDist[gw] || 0) + 1;
        });

        console.log(`─── ${bs.toUpperCase()} ───`);
        console.log(`  Total: ${rows.length} rows (${inflows.length} inflows, ${outflows.length} outflows)`);
        console.log(`  Inflow total: ${inflowAmt.toFixed(2)}`);
        console.log(`  Reconciled: ${reconciled.length}/${inflows.length} (${Math.round(reconciled.length / inflows.length * 100)}%)`);
        console.log(`  With paymentSource: ${withPS.length}/${inflows.length} (${Math.round(withPS.length / inflows.length * 100)}%) = ${withPSAmt.toFixed(2)} (${Math.round(withPSAmt / inflowAmt * 100)}% of value)`);
        console.log(`  With transaction_ids: ${withTxIds.length}`);
        console.log(`  With direct P&L: ${withPnl.length}`);
        console.log(`  Gateway distribution:`);
        Object.entries(gwDist).sort((a, b) => b[1] - a[1]).forEach(([gw, cnt]) => {
            console.log(`    ${gw}: ${cnt}`);
        });
        console.log();
    }

    // === 3. GATEWAY → INVOICE MATCHING ===
    console.log('\n══════════════════════════════════════════');
    console.log('  3. GATEWAY → INVOICE-ORDERS MATCHING');
    console.log('══════════════════════════════════════════\n');

    const gatewaySources = ['braintree-api-revenue', 'braintree-amex', 'stripe-eur', 'stripe-usd', 'gocardless'];

    for (const gs of gatewaySources) {
        const rows = sources[gs];
        const withInvMatch = rows.filter(r => r.custom_data?.matched_invoice_number);
        const withTxId = rows.filter(r => r.custom_data?.transaction_id);
        const withName = rows.filter(r => r.custom_data?.customer_name);
        const withEmail = rows.filter(r => r.custom_data?.customer_email);
        const withOrderId = rows.filter(r => r.custom_data?.order_id);

        console.log(`─── ${gs.toUpperCase()} ───`);
        console.log(`  Total: ${rows.length} rows`);
        console.log(`  With transaction_id: ${withTxId.length}`);
        console.log(`  With customer_name: ${withName.length}`);
        console.log(`  With customer_email: ${withEmail.length}`);
        console.log(`  With order_id: ${withOrderId.length}`);
        console.log(`  Matched to invoice: ${withInvMatch.length}/${rows.length} (${rows.length > 0 ? Math.round(withInvMatch.length / rows.length * 100) : 0}%)`);

        // Strategy distribution
        const stratDist = {};
        withInvMatch.forEach(r => {
            const strat = r.custom_data?.reconciliation_strategy || r.custom_data?.reconciliationType || 'unknown';
            stratDist[strat] = (stratDist[strat] || 0) + 1;
        });
        if (Object.keys(stratDist).length > 0) {
            console.log(`  Strategy distribution:`);
            Object.entries(stratDist).sort((a, b) => b[1] - a[1]).forEach(([st, cnt]) => {
                console.log(`    ${st}: ${cnt}`);
            });
        }
        console.log();
    }

    // === 4. INVOICE-ORDERS DATA QUALITY ===
    console.log('\n══════════════════════════════════════════');
    console.log('  4. INVOICE-ORDERS DATA QUALITY');
    console.log('══════════════════════════════════════════\n');

    const io = sources['invoice-orders'];
    const ioWithFAC = io.filter(r => r.custom_data?.financial_account_code);
    const ioWithInvNum = io.filter(r => r.custom_data?.invoice_number);
    const ioWithName = io.filter(r => r.custom_data?.customer_name);
    const ioWithAmt = io.filter(r => Math.abs(parseFloat(r.amount) || 0) > 0);
    const ioWithEmail = io.filter(r => r.custom_data?.customer_email || r.custom_data?.email);

    console.log(`  Total: ${io.length}`);
    console.log(`  With FAC: ${ioWithFAC.length} (${Math.round(ioWithFAC.length / io.length * 100)}%)`);
    console.log(`  With invoice_number: ${ioWithInvNum.length}`);
    console.log(`  With customer_name: ${ioWithName.length}`);
    console.log(`  With amount > 0: ${ioWithAmt.length}`);
    console.log(`  With email: ${ioWithEmail.length}`);

    // === 5. WEB-ORDERS DATA QUALITY ===
    console.log('\n══════════════════════════════════════════');
    console.log('  5. WEB-ORDERS DATA QUALITY');
    console.log('══════════════════════════════════════════\n');

    const wo = sources['web-orders'];
    console.log(`  Total: ${wo.length}`);
    if (wo.length > 0) {
        const woKeys = new Set();
        wo.slice(0, 20).forEach(r => Object.keys(r.custom_data || {}).forEach(k => woKeys.add(k)));
        console.log(`  Sample custom_data keys: ${[...woKeys].join(', ')}`);

        const woWithName = wo.filter(r => r.custom_data?.customer_name || r.custom_data?.billing_name);
        const woWithEmail = wo.filter(r => r.custom_data?.customer_email || r.custom_data?.email);
        const woWithOrderId = wo.filter(r => r.custom_data?.order_id || r.custom_data?.order_number);
        const woWithTxId = wo.filter(r => r.custom_data?.transaction_id || r.custom_data?.braintree_transaction_id);
        console.log(`  With customer_name: ${woWithName.length}`);
        console.log(`  With email: ${woWithEmail.length}`);
        console.log(`  With order_id: ${woWithOrderId.length}`);
        console.log(`  With transaction_id: ${woWithTxId.length}`);

        console.log('\n  Sample web-orders:');
        wo.slice(0, 3).forEach(r => {
            console.log(`    ${r.date} | ${r.amount} | ${r.description?.substring(0, 60)}`);
            const cd = r.custom_data || {};
            console.log(`    keys: ${Object.keys(cd).slice(0, 15).join(', ')}`);
            console.log(`    name: ${cd.customer_name || cd.billing_name || 'N/A'}, email: ${cd.customer_email || cd.email || 'N/A'}`);
            console.log(`    order_id: ${cd.order_id || cd.order_number || 'N/A'}, tx_id: ${cd.transaction_id || 'N/A'}`);
            console.log();
        });
    }

    // === 6. STRIPE DEEP ANALYSIS ===
    console.log('\n══════════════════════════════════════════');
    console.log('  6. STRIPE DEEP ANALYSIS');
    console.log('══════════════════════════════════════════\n');

    const stripeAll = [...sources['stripe-eur'], ...sources['stripe-usd']];
    console.log(`  Stripe EUR: ${sources['stripe-eur'].length}`);
    console.log(`  Stripe USD: ${sources['stripe-usd'].length}`);
    console.log(`  Total: ${stripeAll.length}`);

    if (stripeAll.length > 0) {
        const stripeKeys = new Set();
        stripeAll.slice(0, 20).forEach(r => Object.keys(r.custom_data || {}).forEach(k => stripeKeys.add(k)));
        console.log(`  Custom_data keys: ${[...stripeKeys].join(', ')}`);

        const stripeWithName = stripeAll.filter(r => r.custom_data?.customer_name);
        const stripeWithEmail = stripeAll.filter(r => r.custom_data?.customer_email || r.custom_data?.email);
        const stripeWithInvMatch = stripeAll.filter(r => r.custom_data?.matched_invoice_number);
        console.log(`  With customer_name: ${stripeWithName.length}`);
        console.log(`  With email: ${stripeWithEmail.length}`);
        console.log(`  Matched to invoice: ${stripeWithInvMatch.length}`);

        console.log('\n  Sample Stripe rows:');
        stripeAll.slice(0, 5).forEach(r => {
            const cd = r.custom_data || {};
            console.log(`    ${r.date} | ${r.amount} | ${cd.customer_name || 'N/A'} | ${cd.customer_email || 'N/A'} | inv: ${cd.matched_invoice_number || 'N/A'}`);
        });
    }

    // === 7. GOCARDLESS DEEP ANALYSIS ===
    console.log('\n══════════════════════════════════════════');
    console.log('  7. GOCARDLESS DEEP ANALYSIS');
    console.log('══════════════════════════════════════════\n');

    const gc = sources['gocardless'];
    console.log(`  Total: ${gc.length}`);

    if (gc.length > 0) {
        const gcKeys = new Set();
        gc.slice(0, 20).forEach(r => Object.keys(r.custom_data || {}).forEach(k => gcKeys.add(k)));
        console.log(`  Custom_data keys: ${[...gcKeys].join(', ')}`);

        const gcWithName = gc.filter(r => r.custom_data?.customer_name);
        const gcWithEmail = gc.filter(r => r.custom_data?.customer_email || r.custom_data?.email);
        const gcWithInvMatch = gc.filter(r => r.custom_data?.matched_invoice_number);
        console.log(`  With customer_name: ${gcWithName.length}`);
        console.log(`  With email: ${gcWithEmail.length}`);
        console.log(`  Matched to invoice: ${gcWithInvMatch.length}`);

        console.log('\n  Sample GC rows:');
        gc.slice(0, 5).forEach(r => {
            const cd = r.custom_data || {};
            console.log(`    ${r.date} | ${r.amount} | ${cd.customer_name || 'N/A'} | ${cd.customer_email || 'N/A'} | desc: ${r.description?.substring(0, 50)}`);
        });
    }

    // === 8. CHAIN COMPLETENESS ===
    console.log('\n══════════════════════════════════════════');
    console.log('  8. FULL CHAIN COMPLETENESS: BANK → GW → INV → P&L');
    console.log('══════════════════════════════════════════\n');

    // Build tx → matched_invoice_number map from ALL gateways
    const txMap = {};
    [...sources['braintree-api-revenue'], ...sources['braintree-amex'], ...stripeAll, ...gc].forEach(r => {
        const txId = r.custom_data?.transaction_id;
        if (txId) {
            txMap[txId] = {
                matched_invoice_number: r.custom_data?.matched_invoice_number || null,
                matched_invoice_fac: r.custom_data?.matched_invoice_fac || null,
                customer_name: r.custom_data?.customer_name || null,
                source: r.source
            };
        }
    });

    // Build invoice → FAC map
    const invToFac = {};
    io.forEach(r => {
        if (r.custom_data?.invoice_number && r.custom_data?.financial_account_code) {
            invToFac[r.custom_data.invoice_number] = r.custom_data.financial_account_code;
        }
    });

    for (const bs of bankSources) {
        const inflows = sources[bs].filter(r => parseFloat(r.amount) > 0);
        let chainComplete = 0, chainPartial = 0, directPnl = 0, noChain = 0;

        inflows.forEach(bank => {
            // Check direct P&L
            if (bank.custom_data?.pnl_line) { directPnl++; return; }

            // Check chain via tx_ids
            const txIds = bank.custom_data?.transaction_ids || [];
            if (txIds.length > 0) {
                let found = false;
                for (const txId of txIds) {
                    const bt = txMap[txId];
                    if (bt) {
                        // Check matched_invoice_fac directly (from mega reconciliation)
                        if (bt.matched_invoice_fac) { chainComplete++; found = true; break; }
                        // Or check via invoice → FAC map
                        if (bt.matched_invoice_number && invToFac[bt.matched_invoice_number]) { chainComplete++; found = true; break; }
                    }
                }
                if (!found) chainPartial++;
                return;
            }

            // Check direct pnl_fac
            if (bank.custom_data?.pnl_fac) { directPnl++; return; }

            noChain++;
        });

        const pnlTotal = chainComplete + directPnl;
        console.log(`─── ${bs.toUpperCase()} ───`);
        console.log(`  Inflows: ${inflows.length}`);
        console.log(`  ✓ Full chain (bank→gw→inv→P&L): ${chainComplete}`);
        console.log(`  ✓ Direct P&L classification: ${directPnl}`);
        console.log(`  ~ Partial (has tx_ids, no P&L): ${chainPartial}`);
        console.log(`  ✗ No chain at all: ${noChain}`);
        console.log(`  P&L COVERAGE: ${pnlTotal}/${inflows.length} (${Math.round(pnlTotal / inflows.length * 100)}%)`);
        console.log();
    }

    // === 9. UNMATCHED ANALYSIS — What's blocking >80%? ===
    console.log('\n══════════════════════════════════════════');
    console.log('  9. REMAINING GAPS - WHAT BLOCKS >80%?');
    console.log('══════════════════════════════════════════\n');

    for (const bs of bankSources) {
        const inflows = sources[bs].filter(r => parseFloat(r.amount) > 0);
        const noPnl = inflows.filter(bank => {
            if (bank.custom_data?.pnl_line || bank.custom_data?.pnl_fac) return false;
            const txIds = bank.custom_data?.transaction_ids || [];
            for (const txId of txIds) {
                const bt = txMap[txId];
                if (bt?.matched_invoice_fac || (bt?.matched_invoice_number && invToFac[bt.matched_invoice_number])) return false;
            }
            return true;
        });

        // Categorize what's missing
        const categories = {};
        noPnl.forEach(r => {
            const ps = r.custom_data?.paymentSource;
            const desc = (r.description || '').toLowerCase();
            let cat;
            if (ps) cat = `has-gateway:${ps}`;
            else if (desc.includes('braintree') || desc.includes('paypal braintree')) cat = 'desc:braintree';
            else if (desc.includes('paypal')) cat = 'desc:paypal';
            else if (desc.includes('american express') || desc.includes('amex')) cat = 'desc:amex';
            else if (desc.includes('stripe')) cat = 'desc:stripe';
            else if (desc.includes('gocardless') || desc.includes('go cardless')) cat = 'desc:gocardless';
            else if (desc.includes('dsd')) cat = 'desc:dsd-intercompany';
            else cat = 'other';

            if (!categories[cat]) categories[cat] = { count: 0, amount: 0, samples: [] };
            categories[cat].count++;
            categories[cat].amount += parseFloat(r.amount);
            if (categories[cat].samples.length < 3) categories[cat].samples.push(`${r.date} | ${parseFloat(r.amount).toFixed(2)} | ${r.description?.substring(0, 60)}`);
        });

        if (noPnl.length > 0) {
            console.log(`─── ${bs.toUpperCase()} — ${noPnl.length} inflows without P&L ───`);
            Object.entries(categories).sort((a, b) => b[1].count - a[1].count).forEach(([cat, data]) => {
                console.log(`\n  ${cat}: ${data.count} rows (${data.amount.toFixed(2)})`);
                data.samples.forEach(s => console.log(`    → ${s}`));
            });
            console.log();
        }
    }

    // === 10. STRIPE/GC → INVOICE MATCHABILITY ===
    console.log('\n══════════════════════════════════════════');
    console.log('  10. STRIPE/GC → INVOICE MATCHING POTENTIAL');
    console.log('══════════════════════════════════════════\n');

    // Build IO name index
    const ioByName = new Map();
    io.forEach(r => {
        const name = normalize(r.custom_data?.customer_name);
        if (name && name.length >= 3) {
            if (!ioByName.has(name)) ioByName.set(name, []);
            ioByName.get(name).push(r);
        }
    });

    for (const gs of ['stripe-eur', 'stripe-usd', 'gocardless']) {
        const rows = sources[gs];
        const unmatched = rows.filter(r => !r.custom_data?.matched_invoice_number);

        let matchByName = 0, matchByNameAmt = 0, matchByEmail = 0;

        unmatched.forEach(r => {
            const name = normalize(r.custom_data?.customer_name);
            const amt = Math.abs(parseFloat(r.amount) || 0);

            if (name && ioByName.has(name)) {
                matchByName++;
                const candidates = ioByName.get(name);
                const found = candidates.find(o => {
                    const oAmt = Math.abs(parseFloat(o.amount) || 0);
                    return Math.abs(oAmt - amt) <= Math.max(amt * 0.02, 1);
                });
                if (found) matchByNameAmt++;
            }
        });

        console.log(`─── ${gs.toUpperCase()} ───`);
        console.log(`  Unmatched: ${unmatched.length}`);
        console.log(`  Matchable by name: ${matchByName}`);
        console.log(`  Matchable by name+amount: ${matchByNameAmt}`);
        console.log();
    }

    // === 11. BRAINTREE AMEX & DISBURSEMENTS ===
    console.log('\n══════════════════════════════════════════');
    console.log('  11. BRAINTREE DISBURSEMENTS ANALYSIS');
    console.log('══════════════════════════════════════════\n');

    const disb = sources['braintree-api-disbursement'];
    console.log(`  Disbursements: ${disb.length}`);
    if (disb.length > 0) {
        const disbKeys = new Set();
        disb.slice(0, 10).forEach(r => Object.keys(r.custom_data || {}).forEach(k => disbKeys.add(k)));
        console.log(`  Keys: ${[...disbKeys].join(', ')}`);
        console.log('\n  Samples:');
        disb.slice(0, 5).forEach(r => {
            console.log(`    ${r.date} | ${r.amount} | ${r.description?.substring(0, 60)} | id: ${r.custom_data?.disbursement_id || r.id}`);
        });
    }

    // OVERALL SUMMARY
    console.log('\n\n══════════════════════════════════════════');
    console.log('  OVERALL RECONCILIATION SCORECARD');
    console.log('══════════════════════════════════════════\n');

    let totalBankInflows = 0, totalPnlClassified = 0, totalBankInflowAmt = 0, totalPnlAmt = 0;

    for (const bs of bankSources) {
        const inflows = sources[bs].filter(r => parseFloat(r.amount) > 0);
        const inflowAmt = inflows.reduce((s, r) => s + parseFloat(r.amount), 0);
        let pnlCount = 0, pnlAmt = 0;

        inflows.forEach(bank => {
            let classified = false;
            if (bank.custom_data?.pnl_line || bank.custom_data?.pnl_fac) classified = true;
            if (!classified) {
                const txIds = bank.custom_data?.transaction_ids || [];
                for (const txId of txIds) {
                    const bt = txMap[txId];
                    if (bt?.matched_invoice_fac || (bt?.matched_invoice_number && invToFac[bt.matched_invoice_number])) {
                        classified = true; break;
                    }
                }
            }
            if (classified) { pnlCount++; pnlAmt += parseFloat(bank.amount); }
        });

        totalBankInflows += inflows.length;
        totalPnlClassified += pnlCount;
        totalBankInflowAmt += inflowAmt;
        totalPnlAmt += pnlAmt;

        console.log(`  ${bs}: ${pnlCount}/${inflows.length} (${Math.round(pnlCount / inflows.length * 100)}%) = ${pnlAmt.toFixed(0)} / ${inflowAmt.toFixed(0)} (${Math.round(pnlAmt / inflowAmt * 100)}% by value)`);
    }

    console.log(`\n  TOTAL: ${totalPnlClassified}/${totalBankInflows} (${Math.round(totalPnlClassified / totalBankInflows * 100)}%) = ${totalPnlAmt.toFixed(0)} / ${totalBankInflowAmt.toFixed(0)} (${Math.round(totalPnlAmt / totalBankInflowAmt * 100)}% by value)`);

    // Gateway coverage
    console.log('\n  GATEWAY-TO-INVOICE COVERAGE:');
    for (const gs of gatewaySources) {
        const rows = sources[gs];
        const matched = rows.filter(r => r.custom_data?.matched_invoice_number).length;
        console.log(`    ${gs}: ${matched}/${rows.length} (${rows.length > 0 ? Math.round(matched / rows.length * 100) : 0}%)`);
    }

    process.exit(0);
})();
