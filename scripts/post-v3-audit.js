/**
 * POST-V3 AUDIT - Verify actual coverage in database after V3 writes
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

(async () => {
    console.log('╔═════════════════════════════════════════════════╗');
    console.log('║  POST-V3 RECONCILIATION AUDIT — LIVE DATABASE   ║');
    console.log('╚═════════════════════════════════════════════════╝\n');

    const [btRev, btAmex, stripeEur, stripeUsd, gc, io, bankEur, chaseUsd] = await Promise.all([
        paginate('braintree-api-revenue'),
        paginate('braintree-amex'),
        paginate('stripe-eur'),
        paginate('stripe-usd'),
        paginate('gocardless'),
        paginate('invoice-orders'),
        paginate('bankinter-eur'),
        paginate('chase-usd')
    ]);

    const invToFac = {};
    io.forEach(r => {
        const cd = r.custom_data || {};
        if (cd.invoice_number && cd.financial_account_code) {
            invToFac[cd.invoice_number] = cd.financial_account_code;
        }
    });

    // Gateway → Invoice/FAC coverage
    console.log('══ GATEWAY → INVOICE / FAC COVERAGE ══\n');

    function gatewayStats(rows, label) {
        const total = rows.length;
        const withInvoice = rows.filter(r => r.custom_data?.matched_invoice_number).length;
        const withFAC = rows.filter(r => {
            return r.custom_data?.matched_invoice_fac ||
                (r.custom_data?.matched_invoice_number && invToFac[r.custom_data.matched_invoice_number]);
        }).length;
        const pct = Math.round(withFAC / total * 100);
        console.log(`  ${label}: ${withInvoice} invoice, ${withFAC} with FAC / ${total} total (${pct}%)`);
        return { total, withFAC, pct };
    }

    const btRevStats = gatewayStats(btRev, 'BT Revenue   ');
    const btAmexStats = gatewayStats(btAmex, 'BT Amex      ');
    const stripeStats = gatewayStats([...stripeEur, ...stripeUsd], 'Stripe       ');
    const gcStats = gatewayStats(gc, 'GoCardless   ');

    const allGW = [...btRev, ...btAmex, ...stripeEur, ...stripeUsd, ...gc];
    const allGWFAC = allGW.filter(r => r.custom_data?.matched_invoice_fac || (r.custom_data?.matched_invoice_number && invToFac[r.custom_data.matched_invoice_number])).length;
    console.log(`\n  ALL GATEWAYS: ${allGWFAC}/${allGW.length} (${Math.round(allGWFAC / allGW.length * 100)}%)`);

    // Bank → P&L coverage
    console.log('\n══ BANK → P&L COVERAGE ══\n');

    function bankStats(rows, label) {
        const inflows = rows.filter(r => parseFloat(r.amount) > 0);
        const total = inflows.length;

        const withPnl = inflows.filter(r => {
            const cd = r.custom_data || {};
            return cd.pnl_line || cd.pnl_fac;
        }).length;

        // With chain (tx_ids that lead to FAC)
        const withChain = inflows.filter(r => {
            const cd = r.custom_data || {};
            if (cd.pnl_line || cd.pnl_fac) return true;
            const txIds = cd.transaction_ids || [];
            for (const txId of txIds) {
                const gw = allGW.find(g => {
                    const gcd = g.custom_data || {};
                    return gcd.transaction_id === txId || gcd.gocardless_id === txId || gcd.payment_id === txId;
                });
                if (gw?.custom_data?.matched_invoice_fac) return true;
                if (gw?.custom_data?.matched_invoice_number && invToFac[gw.custom_data.matched_invoice_number]) return true;
            }
            return false;
        }).length;

        const pct = Math.round(withPnl / total * 100);
        const pctChain = Math.round(withChain / total * 100);
        console.log(`  ${label}: direct P&L=${withPnl} (${pct}%), with chain=${withChain} (${pctChain}%) / ${total} inflows`);

        // Breakdown by paymentSource
        const ps = {};
        const psNoPnl = {};
        inflows.forEach(r => {
            const source = (r.custom_data?.paymentSource || 'untagged').toLowerCase();
            ps[source] = (ps[source] || 0) + 1;
            if (!r.custom_data?.pnl_line && !r.custom_data?.pnl_fac) {
                psNoPnl[source] = (psNoPnl[source] || 0) + 1;
            }
        });

        console.log(`    Remaining gaps by paymentSource:`);
        Object.entries(psNoPnl).sort((a, b) => b[1] - a[1]).forEach(([s, cnt]) => {
            console.log(`      ${s}: ${cnt}/${ps[s]} without P&L`);
        });

        return { total, withPnl, withChain, pct, pctChain };
    }

    const bankEurStats = bankStats(bankEur, 'Bankinter EUR');
    const chaseStats = bankStats(chaseUsd, 'Chase USD    ');

    const totalInflows = bankEurStats.total + chaseStats.total;
    const totalPnl = bankEurStats.withPnl + chaseStats.withPnl;
    const totalChain = bankEurStats.withChain + chaseStats.withChain;

    console.log(`\n  TOTAL BANK P&L: direct=${totalPnl}/${totalInflows} (${Math.round(totalPnl / totalInflows * 100)}%), chain=${totalChain}/${totalInflows} (${Math.round(totalChain / totalInflows * 100)}%)`);

    // === OVERALL SCORECARD ===
    console.log('\n╔═════════════════════════════════════════════════╗');
    console.log('║              FINAL SCORECARD                      ║');
    console.log('╚═════════════════════════════════════════════════╝\n');

    const target = 80;

    const checks = [
        { label: 'BT Revenue → Invoice', pct: btRevStats.pct },
        { label: 'BT Amex → Invoice', pct: btAmexStats.pct },
        { label: 'Stripe → FAC', pct: stripeStats.pct },
        { label: 'GoCardless → FAC', pct: gcStats.pct },
        { label: 'All Gateways → FAC', pct: Math.round(allGWFAC / allGW.length * 100) },
        { label: 'Bankinter EUR → P&L', pct: bankEurStats.pct },
        { label: 'Chase USD → P&L', pct: chaseStats.pct },
        { label: 'Total Bank → P&L', pct: Math.round(totalPnl / totalInflows * 100) }
    ];

    console.log('  Metric                     Coverage   Target   Status');
    console.log('  ─────────────────────────  ────────   ──────   ──────');
    checks.forEach(c => {
        const status = c.pct >= target ? '✅ PASS' : '❌ FAIL';
        console.log(`  ${c.label.padEnd(27)} ${String(c.pct + '%').padEnd(10)} ${target}%     ${status}`);
    });

    const passing = checks.filter(c => c.pct >= target).length;
    console.log(`\n  ${passing}/${checks.length} metrics pass >80% threshold`);

    process.exit(0);
})();
