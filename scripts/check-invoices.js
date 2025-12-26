const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkInvoices() {
    console.log('🔍 Checking invoices table...\n');

    // Check count
    const { count, error: countError } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('❌ Error counting invoices:', countError);
        return;
    }

    console.log(`📊 Total invoices: ${count}\n`);

    // Get first 5 records
    const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, due_date, schedule_date, bank_account_code, invoice_amount, currency, provider_code, scope')
        .limit(5);

    if (error) {
        console.error('❌ Error fetching invoices:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('📝 Sample invoices:');
        console.table(data);
    } else {
        console.log('⚠️  No invoices found in the database.');
        console.log('\n💡 Tip: You need to add invoices first using the Invoices page.');
    }

    // Check bank accounts
    console.log('\n🏦 Checking bank accounts...\n');
    const { data: accounts, error: accountsError } = await supabase
        .from('bank_accounts')
        .select('code, name, currency, scope, is_active')
        .eq('is_active', true);

    if (accountsError) {
        console.error('❌ Error fetching bank accounts:', accountsError);
        return;
    }

    if (accounts && accounts.length > 0) {
        console.log('💳 Active bank accounts:');
        console.table(accounts);
    } else {
        console.log('⚠️  No active bank accounts found.');
    }
}

checkInvoices();
