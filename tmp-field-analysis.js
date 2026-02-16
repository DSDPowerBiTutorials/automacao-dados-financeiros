// Detailed field analysis for matching accuracy
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
    'https://rrzgawssbyfzbkmtcovz.supabase.co',
    'sb_secret_d5XN1_EVZod7kJJCRZpXmw_ncDkXEoY'
);

async function paginate(source) {
    let all = [];
    let page = 0;
    while (true) {
        const { data } = await s.from('csv_rows').select('id, amount, date, description, reconciled, custom_data')
            .eq('source', source).range(page * 1000, (page + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        all.push(...data);
        page++;
        if (page > 50) break;
    }
    return all;
}

(async () => {
    // Sample BT revenue custom_data to understand structure
    const { data: btSamples } = await s.from('csv_rows')
        .select('id, amount, date, custom_data')
        .eq('source', 'braintree-api-revenue')
        .limit(5);

    console.log('=== BT REVENUE SAMPLE CUSTOM_DATA ===');
    btSamples.forEach(r => {
        console.log(`ID: ${r.id}, amount: ${r.amount}, date: ${r.date}`);
        console.log(`  custom_data keys:`, Object.keys(r.custom_data || {}));
        console.log(`  tx_id: ${r.custom_data?.transaction_id}`);
        console.log(`  order_id: ${r.custom_data?.order_id}`);
        console.log(`  customer: ${r.custom_data?.customer_name}`);
        console.log(`  email: ${r.custom_data?.customer_email}`);
        console.log(`  matched_inv: ${r.custom_data?.matched_invoice_number}`);
        console.log(`  cd.amount: ${r.custom_data?.amount}`);
        console.log(`  cd.currency: ${r.custom_data?.currency_iso_code}`);
        console.log();
    });

    // Sample BT Amex custom_data
    const { data: amexSamples } = await s.from('csv_rows')
        .select('id, amount, date, custom_data')
        .eq('source', 'braintree-amex')
        .limit(3);

    console.log('=== BT AMEX SAMPLE CUSTOM_DATA ===');
    amexSamples.forEach(r => {
        console.log(`ID: ${r.id}, amount: ${r.amount}, date: ${r.date}`);
        console.log(`  custom_data keys:`, Object.keys(r.custom_data || {}));
        console.log(`  tx_id: ${r.custom_data?.transaction_id}`);
        console.log(`  customer: ${r.custom_data?.customer_name}`);
        console.log(`  matched_inv: ${r.custom_data?.matched_invoice_number}`);
        console.log();
    });

    // Sample invoice-orders custom_data to understand amount field
    const { data: ioSamples } = await s.from('csv_rows')
        .select('id, amount, date, custom_data')
        .eq('source', 'invoice-orders')
        .not('custom_data->invoice_number', 'is', null)
        .limit(5);

    console.log('=== INVOICE-ORDERS SAMPLE ===');
    ioSamples.forEach(r => {
        console.log(`ID: ${r.id}, amount: ${r.amount}, date: ${r.date}`);
        console.log(`  cd keys:`, Object.keys(r.custom_data || {}));
        console.log(`  invoice_number: ${r.custom_data?.invoice_number}`);
        console.log(`  customer: ${r.custom_data?.customer_name}`);
        console.log(`  email: ${r.custom_data?.customer_email || r.custom_data?.email}`);
        console.log(`  FAC: ${r.custom_data?.financial_account_code}`);
        console.log(`  order_id: ${r.custom_data?.order_id}`);
        console.log(`  cd.amount: ${r.custom_data?.amount}`);
        console.log(`  cd.total: ${r.custom_data?.total}`);
        console.log(`  cd.currency: ${r.custom_data?.currency}`);
        console.log();
    });

    // Check how many IO rows have amount > 0 vs amount = 0
    const io = await paginate('invoice-orders');
    const ioWithAmt = io.filter(r => Math.abs(parseFloat(r.amount) || 0) > 0);
    const ioNoAmt = io.filter(r => Math.abs(parseFloat(r.amount) || 0) === 0);
    const ioWithCdAmt = io.filter(r => r.custom_data?.amount && parseFloat(r.custom_data.amount) > 0);
    const ioWithTotal = io.filter(r => r.custom_data?.total && parseFloat(r.custom_data.total) > 0);

    console.log('=== INVOICE-ORDERS AMOUNT ANALYSIS ===');
    console.log('Total IO rows:', io.length);
    console.log('  amount > 0:', ioWithAmt.length);
    console.log('  amount = 0:', ioNoAmt.length);
    console.log('  custom_data.amount > 0:', ioWithCdAmt.length);
    console.log('  custom_data.total > 0:', ioWithTotal.length);

    // Check BT amount field - where is it?
    const bt = await paginate('braintree-api-revenue');
    const btWithAmt = bt.filter(r => Math.abs(parseFloat(r.amount) || 0) > 0);
    const btNoAmt = bt.filter(r => Math.abs(parseFloat(r.amount) || 0) === 0);
    const btWithCdAmt = bt.filter(r => r.custom_data?.amount && parseFloat(r.custom_data.amount) > 0);

    console.log('\n=== BT REVENUE AMOUNT ANALYSIS ===');
    console.log('Total BT rows:', bt.length);
    console.log('  amount > 0:', btWithAmt.length);
    console.log('  amount = 0:', btNoAmt.length);
    console.log('  custom_data.amount > 0:', btWithCdAmt.length);

    // See amounts for the matched sample
    console.log('\n=== AMOUNTS FOR KATHRINE TRELLES (sample match) ===');
    const kathrine_bt = bt.filter(r => r.custom_data?.customer_name?.toLowerCase().includes('kathrine'));
    kathrine_bt.forEach(r => {
        console.log(`  BT: amount=${r.amount}, cd.amount=${r.custom_data?.amount}, cd.matched_inv=${r.custom_data?.matched_invoice_number}`);
    });
    const kathrine_io = io.filter(r => r.custom_data?.customer_name?.toLowerCase().includes('kathrine'));
    kathrine_io.forEach(r => {
        console.log(`  IO: amount=${r.amount}, cd.amount=${r.custom_data?.amount}, inv=${r.custom_data?.invoice_number}, FAC=${r.custom_data?.financial_account_code}`);
    });

    // For name-only strategy: Check if customers are consistently in one P&L line
    console.log('\n=== CUSTOMER P&L CONSISTENCY ===');
    const customerFAC = {};
    io.forEach(r => {
        const name = (r.custom_data?.customer_name || '').toLowerCase().trim();
        const fac = r.custom_data?.financial_account_code;
        if (!name || !fac) return;
        if (!customerFAC[name]) customerFAC[name] = {};
        customerFAC[name][fac] = (customerFAC[name][fac] || 0) + 1;
    });

    let consistent = 0, inconsistent = 0;
    Object.entries(customerFAC).forEach(([name, facs]) => {
        const uniqueFacs = Object.keys(facs);
        if (uniqueFacs.length === 1) consistent++;
        else inconsistent++;
    });

    console.log('Customers with only ONE P&L line:', consistent, `(${Math.round(consistent / (consistent + inconsistent) * 100)}%)`);
    console.log('Customers with multiple P&L lines:', inconsistent);

    // Show some inconsistent customers
    let shown = 0;
    Object.entries(customerFAC).forEach(([name, facs]) => {
        if (shown >= 5 || Object.keys(facs).length <= 1) return;
        console.log(`  ${name}: ${JSON.stringify(facs)}`);
        shown++;
    });

    // For name-only: what % can be assigned with majority vote?
    console.log('\n=== NAME-ONLY: MAJORITY VOTE ACCURACY ===');
    const btUnmatched = bt.filter(r => r.custom_data?.transaction_id && !r.custom_data?.matched_invoice_number);
    let nameOnlyMatchable = 0;
    let nameOnlyWithClearMajority = 0;

    btUnmatched.forEach(r => {
        const name = (r.custom_data?.customer_name || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '');
        if (!name) return;
        const facs = customerFAC[name];
        if (!facs) return;
        nameOnlyMatchable++;

        const total = Object.values(facs).reduce((s, v) => s + v, 0);
        const max = Math.max(...Object.values(facs));
        if (max / total >= 0.8) nameOnlyWithClearMajority++;
    });

    console.log('BT unmatched with customer in IO:', nameOnlyMatchable);
    console.log('  With clear majority P&L (≥80%):', nameOnlyWithClearMajority, `(${nameOnlyMatchable > 0 ? Math.round(nameOnlyWithClearMajority / nameOnlyMatchable * 100) : 0}%)`);

    process.exit(0);
})();
