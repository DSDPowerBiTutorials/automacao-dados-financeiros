require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);
const admin = createClient(url, serviceKey);

const tables = [
    'csv_rows', 'csv_files', 'ar_invoices', 'invoices', 'providers',
    'bank_accounts', 'cost_centers', 'users', 'customers', 'financial_accounts',
    'companies', 'products', 'vendors', 'currencies', 'countries',
    'payment_methods', 'accounts_payable', 'quickbooks_tokens', 'audit_logs'
];

async function runTests() {
    console.log('\n🔐 TESTE DE SEGURANÇA - TODAS AS TABELAS\n');
    console.log('Tabela'.padEnd(25) + ' | Anon    | Admin');
    console.log('-'.repeat(50));

    let anonBlocked = 0;
    let adminOK = 0;
    let adminFail = 0;

    for (const t of tables) {
        // Anon test
        const r1 = await supabase.from(t).select('id').limit(1);
        let anonStatus;
        if (r1.error || !r1.data || r1.data.length === 0) {
            anonStatus = '🔒 BLOCK';
            anonBlocked++;
        } else {
            anonStatus = '⚠️ OPEN';
        }

        // Admin test  
        const r2 = await admin.from(t).select('id').limit(1);
        let adminStatus;
        if (r2.error) {
            adminStatus = '❌ FAIL';
            adminFail++;
        } else {
            adminStatus = '✅ OK';
            adminOK++;
        }

        console.log(t.padEnd(25) + ' | ' + anonStatus + ' | ' + adminStatus);
    }

    console.log('-'.repeat(50));
    console.log('\n📊 RESUMO:');
    console.log('   Anon bloqueado:', anonBlocked + '/' + tables.length);
    console.log('   Admin OK:', adminOK + '/' + tables.length);
    console.log('   Admin FAIL:', adminFail);

    if (anonBlocked === tables.length && adminFail === 0) {
        console.log('\n✅ SEGURANÇA PERFEITA!');
    } else if (adminFail > 0) {
        console.log('\n⚠️  PROBLEMA: Admin não consegue acessar algumas tabelas');
    }
}

runTests().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
