require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
    try {
        console.log('=== Checking Accounts Receivable related tables ===\n');

        // Check if there's a separate receivables table
        console.log('1. Checking for "receivables" or "revenue_invoices" table...\n');

        const receivablesTest = await supabase
            .from('receivables')
            .select('*')
            .limit(1);

        if (!receivablesTest.error) {
            console.log('✅ Found "receivables" table');
            console.log('Columns:', Object.keys(receivablesTest.data[0] || {}).join(', '));
            console.log('Sample:', JSON.stringify(receivablesTest.data[0], null, 2));
        } else {
            console.log('❌ "receivables" table not found:', receivablesTest.error.message);
        }

        console.log('\n2. Checking "invoices" table for revenue records...\n');

        const invoicesTest = await supabase
            .from('invoices')
            .select('*')
            .limit(1);

        if (!invoicesTest.error && invoicesTest.data && invoicesTest.data.length > 0) {
            console.log('✅ Found "invoices" table');
            console.log('Columns:', Object.keys(invoicesTest.data[0]).join(', '));
            console.log('\nSample invoice:');
            console.log(JSON.stringify(invoicesTest.data[0], null, 2));

            // Check if there's a type/category field to distinguish payables vs receivables
            const invoice = invoicesTest.data[0];
            if (invoice.invoice_type || invoice.type || invoice.category) {
                console.log('\n📋 Invoice has type/category field - can distinguish AP vs AR');
            }
        } else {
            console.log('❌ "invoices" table error:', invoicesTest.error?.message);
        }

        console.log('\n3. Checking for "customers" table...\n');

        const customersTest = await supabase
            .from('customers')
            .select('*')
            .limit(1);

        if (!customersTest.error) {
            console.log('✅ Found "customers" table');
            console.log('Columns:', Object.keys(customersTest.data[0] || {}).join(', '));
            console.log('Sample:', JSON.stringify(customersTest.data[0], null, 2));
        } else {
            console.log('❌ "customers" table not found:', customersTest.error.message);
        }

        console.log('\n4. Checking for "revenue" or "sales" related tables...\n');

        const revenueTest = await supabase
            .from('revenue')
            .select('*')
            .limit(1);

        if (!revenueTest.error) {
            console.log('✅ Found "revenue" table');
            console.log('Columns:', Object.keys(revenueTest.data[0] || {}).join(', '));
        } else {
            console.log('❌ "revenue" table not found:', revenueTest.error.message);
        }

        console.log('\n5. Listing all available tables via rpc (if enabled)...\n');
        console.log('Note: You may need to check Supabase dashboard for full table list');

    } catch (err) {
        console.error('❌ Unexpected error:', err);
    } finally {
        process.exit(0);
    }
})();
