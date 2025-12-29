require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(url, key);

(async () => {
    console.log('\n=== Teste de Filtro Scope ===\n');

    // Get all active bank accounts
    const { data: allAccounts, error: allError } = await supabase
        .from('bank_accounts')
        .select('code, name, country, applies_to_all_countries, is_active')
        .eq('is_active', true);

    if (allError) {
        console.error('ERROR fetching all accounts:', allError);
        process.exit(1);
    }

    console.log('ALL ACTIVE BANK ACCOUNTS:');
    allAccounts.forEach(acc => {
        console.log(`  ${acc.code.padEnd(10)} | ${acc.name.padEnd(30)} | Country: ${(acc.country || 'NULL').padEnd(5)} | Global: ${String(acc.applies_to_all_countries).padEnd(5)}`);
    });

    // Test with ES scope
    console.log('\n--- QUERY com scope ES (usando .or()) ---');
    const { data: esAccounts, error: esError } = await supabase
        .from('bank_accounts')
        .select('code, name, country, applies_to_all_countries, is_active')
        .eq('is_active', true)
        .or('country.eq.ES,applies_to_all_countries.eq.true');

    if (esError) {
        console.error('ERROR:', esError);
    } else {
        console.log(`Resultado: ${esAccounts.length} contas`);
        esAccounts.forEach(acc => {
            console.log(`  ${acc.code.padEnd(10)} | ${acc.name.padEnd(30)} | Country: ${(acc.country || 'NULL').padEnd(5)} | Global: ${String(acc.applies_to_all_countries).padEnd(5)}`);
        });
    }

    // Test with US scope
    console.log('\n--- QUERY com scope US (usando .or()) ---');
    const { data: usAccounts, error: usError } = await supabase
        .from('bank_accounts')
        .select('code, name, country, applies_to_all_countries, is_active')
        .eq('is_active', true)
        .or('country.eq.US,applies_to_all_countries.eq.true');

    if (usError) {
        console.error('ERROR:', usError);
    } else {
        console.log(`Resultado: ${usAccounts.length} contas`);
        usAccounts.forEach(acc => {
            console.log(`  ${acc.code.padEnd(10)} | ${acc.name.padEnd(30)} | Country: ${(acc.country || 'NULL').padEnd(5)} | Global: ${String(acc.applies_to_all_countries).padEnd(5)}`);
        });
    }

    process.exit(0);
})();
