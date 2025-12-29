require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
    try {
        console.log('=== Testing bank_accounts query ===\n');

        const accountsQuery = await supabase
            .from("bank_accounts")
            .select("code, name, bank_name, currency, country, applies_to_all_countries, current_balance, is_active")
            .eq("is_active", true)
            .order("code", { ascending: true });

        if (accountsQuery.error) {
            console.error('❌ Bank accounts error:', accountsQuery.error);
            console.error('Error details:', {
                message: accountsQuery.error.message,
                details: accountsQuery.error.details,
                hint: accountsQuery.error.hint,
                code: accountsQuery.error.code
            });
        } else {
            console.log('✅ Bank accounts loaded:', accountsQuery.data?.length || 0);
            if (accountsQuery.data && accountsQuery.data.length > 0) {
                console.log('Sample:', JSON.stringify(accountsQuery.data[0], null, 2));
            }
        }

        console.log('\n=== Testing invoices query ===\n');

        const invoicesQuery = await supabase
            .from("invoices")
            .select("*")
            .not("schedule_date", "is", null)
            .order("schedule_date", { ascending: true });

        if (invoicesQuery.error) {
            console.error('❌ Invoices error:', invoicesQuery.error);
            console.error('Error details:', {
                message: invoicesQuery.error.message,
                details: invoicesQuery.error.details,
                hint: invoicesQuery.error.hint,
                code: invoicesQuery.error.code
            });
        } else {
            console.log('✅ Invoices loaded:', invoicesQuery.data?.length || 0);
            if (invoicesQuery.data && invoicesQuery.data.length > 0) {
                console.log('Sample:', JSON.stringify(invoicesQuery.data[0], null, 2));
                console.log('\nInvoice fields:', Object.keys(invoicesQuery.data[0]).join(', '));
            }
        }

        console.log('\n=== Checking bank_accounts schema ===\n');

        // Get all bank accounts to see actual schema
        const allAccounts = await supabase
            .from("bank_accounts")
            .select("*")
            .limit(1);

        if (allAccounts.data && allAccounts.data.length > 0) {
            console.log('Bank account fields:', Object.keys(allAccounts.data[0]).join(', '));
            console.log('Sample data:', JSON.stringify(allAccounts.data[0], null, 2));
        }

    } catch (err) {
        console.error('❌ Unexpected error:', err);
    }
})();
