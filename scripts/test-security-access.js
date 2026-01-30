const { createClient } = require('@supabase/supabase-js');

// Carregar .env.local
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 TESTE COMPLETO DE SEGURANÇA\n');
console.log('URL:', supabaseUrl);
console.log('Anon Key:', supabaseAnonKey ? '✅ Presente' : '❌ Faltando');
console.log('Service Key:', supabaseServiceKey ? '✅ Presente' : '❌ Faltando');
console.log('');

const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

async function testAllTables() {
    console.log('='.repeat(70));
    console.log('📋 TESTE 1: Acesso ANÔNIMO (deve FALHAR - isso é BOM!)');
    console.log('='.repeat(70));

    const tables = [
        'csv_rows', 'csv_files', 'ar_invoices', 'invoices', 'providers',
        'bank_accounts', 'cost_centers', 'users', 'customers', 'financial_accounts',
        'companies', 'products', 'vendors', 'currencies', 'countries',
        'payment_methods', 'accounts_payable', 'bot_tasks', 'channels',
        'quickbooks_tokens', 'system_settings', 'audit_logs'
    ];

    let anonBlocked = 0;
    let anonAllowed = 0;

    for (const table of tables) {
        const { data, error } = await supabaseAnon.from(table).select('*').limit(1);

        if (error || (data && data.length === 0)) {
            // Bloqueado ou vazio = seguro
            console.log('🔒', table.padEnd(25), '→ Bloqueado (CORRETO)');
            anonBlocked++;
        } else if (data && data.length > 0) {
            // Retornou dados = PROBLEMA
            console.log('⚠️ ', table.padEnd(25), '→ EXPOSTO! Retornou', data.length, 'rows');
            anonAllowed++;
        }
    }

    console.log('\n📊 Anon: Bloqueado:', anonBlocked, '| Exposto:', anonAllowed);

    if (supabaseAdmin) {
        console.log('\n' + '='.repeat(70));
        console.log('📋 TESTE 2: Acesso SERVICE ROLE (deve FUNCIONAR)');
        console.log('='.repeat(70));

        let adminPassed = 0;
        let adminFailed = 0;
        const adminErrors = [];

        for (const table of tables) {
            const { data, error } = await supabaseAdmin.from(table).select('*').limit(1);

            if (error) {
                console.log('❌', table.padEnd(25), '→ ERRO:', error.message.substring(0, 40));
                adminFailed++;
                adminErrors.push({ table, error: error.message });
            } else {
                console.log('✅', table.padEnd(25), '→ OK (', data?.length || 0, 'rows)');
                adminPassed++;
            }
        }

        console.log('\n📊 Admin: Passou:', adminPassed, '| Falhou:', adminFailed);

        if (adminErrors.length > 0) {
            console.log('\n⚠️  TABELAS COM ERRO (Admin):');
            adminErrors.forEach(e => console.log('   -', e.table, ':', e.error));
        }
    } else {
        console.log('\n⚠️  Service Role Key não encontrada - pulando teste admin');
    }

    console.log('\n' + '='.repeat(70));
    console.log('📋 RESUMO FINAL');
    console.log('='.repeat(70));

    if (anonAllowed === 0) {
        console.log('✅ SEGURANÇA OK: Nenhuma tabela exposta para anônimos');
    } else {
        console.log('❌ PROBLEMA: ' + anonAllowed + ' tabelas expostas para anônimos!');
    }
}

testAllTables().catch(console.error);
