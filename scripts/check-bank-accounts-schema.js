const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkBankAccountsSchema() {
    console.log('🔍 Fetching bank_accounts schema...\n');

    const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('📋 Bank accounts columns:');
        console.log(Object.keys(data[0]));
        console.log('\n📝 Sample record:');
        console.log(data[0]);
    }

    // Get all bank accounts
    const { data: all, error: allError } = await supabase
        .from('bank_accounts')
        .select('*');

    if (!allError && all) {
        console.log(`\n📊 Total bank accounts: ${all.length}`);
        console.table(all.map(acc => ({
            code: acc.code,
            name: acc.name,
            bank_name: acc.bank_name,
            currency: acc.currency,
            is_active: acc.is_active,
            country_code: acc.country_code || 'N/A'
        })));
    }
}

checkBankAccountsSchema();
