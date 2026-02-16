// Analysis: Other gateways reconciliation + remaining unmatched
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
    'https://rrzgawssbyfzbkmtcovz.supabase.co',
    'sb_secret_d5XN1_EVZod7kJJCRZpXmw_ncDkXEoY'
);

async function paginate(source) {
    let all = [];
    let page = 0;
    while (true) {
        const { data } = await s.from('csv_rows')
            .select('id, amount, date, description, reconciled, custom_data, source')
            .eq('source', source).range(page * 1000, (page + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        all.push(...data);
        page++;
        if (page > 50) break;
    }
    return all;
}

(async () => {
    console.log('=== REMAINING GAPS ANALYSIS ===\n');

    // Load bank inflows
    const be = (await paginate('bankinter-eur')).filter(r => r.amount > 0);
    const cu = (await paginate('chase-usd')).filter(r => r.amount > 0);
    const sab = (await paginate('sabadell')).filter(r => r.amount > 0);
    const bu = (await paginate('bankinter-usd')).filter(r => r.amount > 0);
    const bankAll = [...be, ...cu, ...sab, ...bu];

    console.log('Bank inflows by source:');
    console.log(`  bankinter-eur: ${be.length}`);
    console.log(`  chase-usd: ${cu.length}`);
    console.log(`  sabadell: ${sab.length}`);
    console.log(`  bankinter-usd: ${bu.length}`);
    console.log(`  Total: ${bankAll.length}`);

    // Categorize bank inflows
    const noPS = bankAll.filter(r => !r.custom_data?.paymentSource);
    const withPS = bankAll.filter(r => r.custom_data?.paymentSource);
    const withTxIds = bankAll.filter(r => r.custom_data?.transaction_ids?.length > 0);

    console.log(`\n  With paymentSource: ${withPS.length}`);
    console.log(`  With transaction_ids: ${withTxIds.length}`);
    console.log(`  Without any match: ${noPS.length}`);

    // Payment source distribution
    const psDist = {};
    withPS.forEach(r => {
        const ps = r.custom_data?.paymentSource?.toLowerCase();
        psDist[ps] = (psDist[ps] || 0) + 1;
    });
    console.log('\n  Payment Source distribution:');
    Object.entries(psDist).sort((a, b) => b[1] - a[1]).forEach(([ps, count]) => {
        console.log(`    ${ps}: ${count}`);
    });

    // For rows without paymentSource, analyze descriptions
    console.log('\n=== UNMATCHED BANK INFLOWS PATTERNS ===');
    const descPatterns = {};
    noPS.forEach(r => {
        const desc = (r.description || '').toLowerCase();
        let pattern = 'other';
        if (desc.includes('paypal')) pattern = 'paypal';
        else if (desc.includes('american express') || desc.includes('amex')) pattern = 'amex';
        else if (desc.includes('remesa')) pattern = 'remesa';
        else if (desc.includes('stripe')) pattern = 'stripe';
        else if (desc.includes('gocardless') || desc.includes('go cardless')) pattern = 'gocardless';
        else if (desc.includes('braintree')) pattern = 'braintree';
        else if (desc.includes('dsd') && (desc.includes('llc') || desc.includes('sl') || desc.includes('planning'))) pattern = 'intercompany/dsd';
        else if (desc.includes('transf/') || desc.includes('transferencia') || desc.includes('trans/')) pattern = 'transfer';
        else if (desc.includes('abono') || desc.includes('domicilia')) pattern = 'direct-debit/abono';
        else if (desc.includes('check') || desc.includes('cheque')) pattern = 'check';
        else if (desc.includes('wire')) pattern = 'wire';
        descPatterns[pattern] = (descPatterns[pattern] || 0) + 1;
    });

    console.log(`Total unmatched: ${noPS.length}`);
    Object.entries(descPatterns).sort((a, b) => b[1] - a[1]).forEach(([pattern, count]) => {
        console.log(`  ${pattern}: ${count}`);
    });

    // Analyze stripe rows
    const stripe = await paginate('stripe-eur');
    const stripeUsd = await paginate('stripe-usd');
    console.log('\n=== STRIPE DATA ===');
    console.log(`  stripe-eur: ${stripe.length}`);
    console.log(`  stripe-usd: ${stripeUsd.length}`);
    const stripeWithInv = [...stripe, ...stripeUsd].filter(r => r.custom_data?.matched_invoice_number);
    console.log(`  With matched_invoice_number: ${stripeWithInv.length}`);

    // Analyze GoCardless
    const gc = await paginate('gocardless');
    console.log('\n=== GOCARDLESS DATA ===');
    console.log(`  gocardless: ${gc.length}`);
    const gcWithInv = gc.filter(r => r.custom_data?.matched_invoice_number);
    console.log(`  With matched_invoice_number: ${gcWithInv.length}`);

    // Show sample stripe/gc custom_data
    if (stripe.length > 0) {
        console.log('\n  Stripe-EUR sample custom_data keys:', Object.keys(stripe[0].custom_data || {}));
        console.log(`  customer_name: ${stripe[0].custom_data?.customer_name}`);
        console.log(`  customer_email: ${stripe[0].custom_data?.customer_email}`);
    }
    if (gc.length > 0) {
        console.log('\n  GoCardless sample custom_data keys:', Object.keys(gc[0].custom_data || {}));
        console.log(`  customer_name: ${gc[0].custom_data?.customer_name}`);
    }

    // Check: for bank rows with paymentSource=stripe/gocardless, do they have transaction_ids?
    console.log('\n=== BANK→GATEWAY CHAIN FOR STRIPE/GC ===');
    const bankStripe = withPS.filter(r => r.custom_data?.paymentSource?.toLowerCase().includes('stripe'));
    const bankGC = withPS.filter(r => r.custom_data?.paymentSource?.toLowerCase().includes('gocardless'));

    console.log(`  Bank rows with paymentSource=stripe: ${bankStripe.length}`);
    const bankStripeWithTx = bankStripe.filter(r => r.custom_data?.transaction_ids?.length > 0);
    console.log(`    With transaction_ids: ${bankStripeWithTx.length}`);

    console.log(`  Bank rows with paymentSource=gocardless: ${bankGC.length}`);
    const bankGCWithTx = bankGC.filter(r => r.custom_data?.transaction_ids?.length > 0);
    console.log(`    With transaction_ids: ${bankGCWithTx.length}`);

    // For the 924 bank inflows without gateway, run deep bank reconciliation?
    console.log('\n=== DEEP BANK RECONCILIATION STATUS ===');
    const bankRecon = bankAll.filter(r => r.reconciled);
    const bankNotRecon = bankAll.filter(r => !r.reconciled);
    console.log(`  Reconciled: ${bankRecon.length} (${Math.round(bankRecon.length / bankAll.length * 100)}%)`);
    console.log(`  Not reconciled: ${bankNotRecon.length}`);
    console.log(`  Not reconciled descriptions sample:`);
    bankNotRecon.slice(0, 20).forEach(r => {
        const ps = r.custom_data?.paymentSource || '-';
        const txIds = r.custom_data?.transaction_ids?.length || 0;
        console.log(`    ${r.date} | ${r.amount.toFixed(2)} | ${r.description.substring(0, 60)} | src:${r.source} | ps:${ps} | txIds:${txIds}`);
    });

    // Check how many "sem-gateway" rows could be from known patterns
    console.log('\n=== POTENTIAL DIRECT MATCHES FOR UNMATCHED ===');
    const io = await paginate('invoice-orders');
    const ioByName = new Map();
    io.forEach(r => {
        const name = (r.custom_data?.customer_name || '').toLowerCase().trim();
        if (name) {
            if (!ioByName.has(name)) ioByName.set(name, []);
            ioByName.get(name).push(r);
        }
    });

    // Try matching bank description to invoice-orders customer_name
    let directNameMatch = 0;
    noPS.forEach(r => {
        const desc = (r.description || '').toLowerCase();
        // Extract name from transfer descriptions like "Transf/NAME" or "Trans/NAME"
        const nameMatch = desc.match(/trans(?:f|\.?\s*inm)?\/(.+)/i)
            || desc.match(/wire.*(?:a\/c|bnf):?\s*(.+?)(?:\s+[A-Z]{1,2}\d|$)/i);
        if (nameMatch) {
            const extractedName = nameMatch[1].trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
            if (extractedName.length >= 3 && ioByName.has(extractedName)) {
                directNameMatch++;
            }
        }
    });
    console.log(`  Bank unmatched → IO by extracted name: ${directNameMatch}`);

    // Deep bank reconciliation API call status
    const bankReconciled = bankAll.filter(r => r.custom_data?.reconciliationType);
    const reconTypes = {};
    bankReconciled.forEach(r => {
        const type = r.custom_data?.reconciliationType || 'unknown';
        reconTypes[type] = (reconTypes[type] || 0) + 1;
    });
    console.log('\n  Reconciliation types in bank data:');
    Object.entries(reconTypes).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
        console.log(`    ${type}: ${count}`);
    });

    process.exit(0);
})();
