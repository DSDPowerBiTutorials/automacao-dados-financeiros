const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
    try {
        console.log('\n=== Testing Bank Accounts Scope Filter ===\n');

        // Get all bank accounts first
        const allAccounts = await supabase
            .from('bank_accounts')
            .select('code, name, country, applies_to_all_countries, is_active')
            .eq('is_active', true);

        console.log('ALL ACTIVE BANK ACCOUNTS:');
        console.log(JSON.stringify(allAccounts.data, null, 2));

        // Test with ES scope using OR
        console.log('\n--- Query with .or() for ES scope ---');
        const esQuery = supabase
            .from('bank_accounts')
            .select('code, name, country, applies_to_all_countries, is_active')
            .eq('is_active', true)
            .or('country.eq.ES,applies_to_all_countries.eq.true');

        const esResult = await esQuery;
        console.log('ES Result with .or():');
        console.log(JSON.stringify(esResult.data, null, 2));
        console.log('Error:', esResult.error);

        // Test with US scope using OR
        console.log('\n--- Query with .or() for US scope ---');
        const usQuery = supabase
            .from('bank_accounts')
            .select('code, name, country, applies_to_all_countries, is_active')
            .eq('is_active', true)
            .or('country.eq.US,applies_to_all_countries.eq.true');

        const usResult = await usQuery;
        console.log('US Result with .or():');
        console.log(JSON.stringify(usResult.data, null, 2));
        console.log('Error:', usResult.error);

    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
})();
