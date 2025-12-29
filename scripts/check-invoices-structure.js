const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkInvoicesStructure() {
    console.log('\n🔍 Checking invoices structure and data...\n');

    // Get a few invoices to see structure
    const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('⚠️  No invoices found');
        return;
    }

    const sample = data[0];
    console.log('✅ Invoice structure:');
    console.log('═'.repeat(80));
    Object.keys(sample).forEach(key => {
        console.log(`${key}: ${typeof sample[key]} = ${sample[key]}`);
    });

    console.log('\n📊 Statistics:');

    // Count invoices by type
    const { data: invoicesByType, error: typeError } = await supabase
        .from('invoices')
        .select('invoice_type')
        .then(result => {
            const types = {};
            result.data?.forEach(inv => {
                types[inv.invoice_type] = (types[inv.invoice_type] || 0) + 1;
            });
            return { data: types };
        });

    console.log('\nInvoice types:');
    Object.entries(invoicesByType || {}).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
    });

    // Check cash impact field
    const { data: allInvoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_type, invoice_amount, currency, cash_impact, dre_impact, scope');

    if (allInvoices) {
        const cashImpact = allInvoices.filter(inv => inv.cash_impact).length;
        const dreImpact = allInvoices.filter(inv => inv.dre_impact).length;

        console.log(`\nTotal invoices: ${allInvoices.length}`);
        console.log(`With cash impact: ${cashImpact}`);
        console.log(`With DRE impact: ${dreImpact}`);

        // Check scopes
        const byScope = {};
        allInvoices.forEach(inv => {
            byScope[inv.scope] = (byScope[inv.scope] || 0) + 1;
        });
        console.log('\nBy scope:');
        Object.entries(byScope).forEach(([scope, count]) => {
            console.log(`  ${scope}: ${count}`);
        });
    }
}

checkInvoicesStructure();
