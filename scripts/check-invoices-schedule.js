const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkInvoicesWithScheduleDate() {
    console.log('\n🔍 Checking invoices with schedule_date...\n');

    // Query invoices that have schedule_date
    const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .not('schedule_date', 'is', null)
        .order('schedule_date', { ascending: true });

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('⚠️  No invoices found with schedule_date');
        return;
    }

    console.log(`✅ Found ${data.length} invoices with schedule_date:\n`);
    console.log('═'.repeat(120));

    data.forEach((inv, index) => {
        console.log(`\n${index + 1}. Invoice: ${inv.invoice_number || 'N/A'}`);
        console.log(`   ID: ${inv.id}`);
        console.log(`   Scope: ${inv.scope || 'MISSING!'}`);
        console.log(`   Country Code: ${inv.country_code || 'MISSING!'}`);
        console.log(`   Schedule Date: ${inv.schedule_date}`);
        console.log(`   Due Date: ${inv.due_date || 'N/A'}`);
        console.log(`   Amount: ${inv.invoice_amount} ${inv.currency}`);
        console.log(`   Provider: ${inv.provider_code}`);
        console.log(`   Bank Account: ${inv.bank_account_code || 'NONE'}`);
        console.log(`   Payment Date: ${inv.payment_date || 'Not paid'}`);
        console.log(`   Reconciled: ${inv.is_reconciled ? 'Yes' : 'No'}`);
        console.log(`   Payment Status: ${inv.payment_status || 'N/A'}`);
    });

    console.log('\n' + '═'.repeat(120));

    // Check scopes distribution
    const scopes = {};
    data.forEach(inv => {
        const scope = inv.scope || 'MISSING';
        scopes[scope] = (scopes[scope] || 0) + 1;
    });

    console.log('\n📊 Scope distribution:');
    Object.entries(scopes).forEach(([scope, count]) => {
        console.log(`   ${scope}: ${count} invoice(s)`);
    });

    // Check bank accounts
    const withBankAccount = data.filter(inv => inv.bank_account_code).length;
    const withoutBankAccount = data.filter(inv => !inv.bank_account_code).length;

    console.log('\n🏦 Bank account assignment:');
    console.log(`   With bank account: ${withBankAccount}`);
    console.log(`   Without bank account: ${withoutBankAccount}`);
}

checkInvoicesWithScheduleDate();
