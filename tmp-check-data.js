require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log('URL:', url ? url.substring(0, 30) + '...' : 'MISSING');
console.log('KEY:', key ? key.substring(0, 15) + '...' : 'MISSING');

const supabase = createClient(url, key);

async function check() {
    // 1. Craft Commerce em ar_invoices
    const { count: craftCount } = await supabase.from('ar_invoices').select('*', { count: 'exact', head: true }).eq('source', 'craft-commerce');
    console.log('\n=== ar_invoices craft-commerce:', craftCount);

    // 2. HubSpot em ar_invoices
    const { count: hsCount } = await supabase.from('ar_invoices').select('*', { count: 'exact', head: true }).eq('source', 'hubspot');
    console.log('=== ar_invoices hubspot:', hsCount);

    // 3. BT transactions
    const { count: btCount } = await supabase.from('csv_rows').select('*', { count: 'exact', head: true }).eq('source', 'braintree-api-revenue');
    console.log('=== csv_rows braintree-api-revenue:', btCount);

    // 4. BT order_id samples
    const { data: btSamples } = await supabase.from('csv_rows')
        .select('id, custom_data')
        .eq('source', 'braintree-api-revenue')
        .limit(20);
    console.log('\n=== BT samples (first 20):');
    let btWithOid = 0;
    let btWithoutOid = 0;
    btSamples?.forEach(r => {
        const cd = r.custom_data || {};
        const oid = cd.order_id || '';
        if (oid) btWithOid++; else btWithoutOid++;
        console.log('  oid:', JSON.stringify(oid), '| txid:', cd.transaction_id, '| email:', cd.customer_email);
    });

    // 5. Craft Commerce samples
    const { data: craftSamples } = await supabase.from('ar_invoices')
        .select('order_id, email, total_amount, currency, charged_amount, invoice_number')
        .eq('source', 'craft-commerce')
        .gt('charged_amount', 0)
        .limit(15);
    console.log('\n=== Craft Commerce samples (paid > 0):');
    craftSamples?.forEach(r => {
        console.log('  inv:', r.invoice_number, '| order_id:', r.order_id, '| email:', r.email, '|', r.charged_amount, r.currency);
    });

    // 6. Deep match test — load ALL craft order_ids
    const allCraftIds = [];
    let craftOffset = 0;
    while (true) {
        const { data } = await supabase.from('ar_invoices')
            .select('order_id')
            .eq('source', 'craft-commerce')
            .not('order_id', 'is', null)
            .range(craftOffset, craftOffset + 999);
        if (!data || data.length === 0) break;
        data.forEach(r => allCraftIds.push(r.order_id?.toLowerCase()));
        if (data.length < 1000) break;
        craftOffset += 1000;
    }
    const craftSet = new Set(allCraftIds);
    console.log('\n=== Total craft order_ids:', craftSet.size);

    // 7. Check ALL BT order_ids for matches
    let matched = 0;
    let totalBtWithOid = 0;
    let totalBtWithoutOid = 0;
    let matchedExamples = [];
    let btOffset = 0;
    while (true) {
        const { data: btBatch } = await supabase.from('csv_rows')
            .select('custom_data')
            .eq('source', 'braintree-api-revenue')
            .range(btOffset, btOffset + 999);
        if (!btBatch || btBatch.length === 0) break;
        for (const bt of btBatch) {
            let oid = (bt.custom_data?.order_id || '').trim();
            if (!oid) { totalBtWithoutOid++; continue; }
            totalBtWithOid++;
            let cleanOid = oid.toLowerCase();
            if (cleanOid.includes('-') && cleanOid.length > 8) cleanOid = cleanOid.split('-')[0];
            if (craftSet.has(cleanOid)) {
                matched++;
                if (matchedExamples.length < 10) {
                    matchedExamples.push({ btOid: oid, craftOid: cleanOid, email: bt.custom_data?.customer_email });
                }
            }
        }
        if (btBatch.length < 1000) break;
        btOffset += 1000;
    }
    console.log('=== BT com order_id:', totalBtWithOid, '| sem:', totalBtWithoutOid);
    console.log('=== MATCHES order_id BT↔Craft:', matched);
    if (matchedExamples.length) {
        console.log('=== Match examples:');
        matchedExamples.forEach(m => console.log('  ', m.btOid, '→', m.craftOid, '|', m.email));
    }

    // 8. Reconciled counts
    const { count: reconciledCraft } = await supabase.from('ar_invoices')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'craft-commerce').eq('reconciled', true);
    console.log('\n=== Craft reconciled:', reconciledCraft);

    const { count: reconciledHS } = await supabase.from('ar_invoices')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'hubspot').eq('reconciled', true);
    console.log('=== HubSpot reconciled:', reconciledHS);

    // 9. Check chain-details: how many BT transactions are linked to disbursements
    const { count: btLinkedDisb } = await supabase.from('csv_rows')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'braintree-api-revenue')
        .not('custom_data->disbursement_id', 'is', null);
    console.log('\n=== BT transactions with disbursement_id:', btLinkedDisb);

    // 10. Any disbursement tx?
    const { count: disbCount } = await supabase.from('csv_rows')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'braintree-api-disbursement');
    console.log('=== csv_rows braintree-api-disbursement:', disbCount);
}

check().catch(console.error);
