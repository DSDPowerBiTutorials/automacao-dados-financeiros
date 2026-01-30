require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, anonKey);

const allTables = [
    'csv_rows', 'csv_files', 'ar_invoices', 'invoices', 'providers',
    'bank_accounts', 'cost_centers', 'users', 'customers', 'financial_accounts',
    'companies', 'products', 'vendors', 'currencies', 'countries',
    'payment_methods', 'accounts_payable', 'quickbooks_tokens', 'audit_logs',
    'attachment_batches', 'attachments', 'audit_log', 'bot_dead_letter_queue',
    'bot_logs', 'bot_notification_rules', 'bot_notification_templates',
    'bot_notifications', 'bot_tasks', 'bot_users', 'bot_workflows',
    'channel_members', 'channels', 'chat_messages', 'cost_types',
    'courses', 'dep_cost_types', 'entry_types', 'exchange_rates',
    'global_providers', 'integrations', 'invoice_activities', 'invoice_history',
    'message_reactions', 'messages', 'notifications', 'order_transaction_links',
    'order_transaction_mapping', 'product_merges', 'quickbooks_accounts',
    'quickbooks_customers', 'quickbooks_vendors', 'roles', 'sub_departments',
    'sync_metadata', 'system_roles', 'system_settings', 'system_users',
    'user_permissions', 'user_profiles', 'user_sessions', 'vendor_sequences',
    'vendors_mapping', 'ar_financial_accounts', 'profiles', 'reconciliations'
];

async function checkExposed() {
    console.log('🔍 VERIFICAÇÃO COMPLETA - TABELAS EXPOSTAS PARA ANON\n');

    const exposed = [];
    const blocked = [];

    for (const t of allTables) {
        const { data, error } = await supabase.from(t).select('id').limit(1);
        if (!error && data && data.length > 0) {
            exposed.push(t);
            console.log('⚠️  EXPOSTO:', t, '- retornou', data.length, 'rows');
        } else {
            blocked.push(t);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO:');
    console.log('   🔒 Bloqueado:', blocked.length);
    console.log('   ⚠️  Exposto:', exposed.length);

    if (exposed.length === 0) {
        console.log('\n✅ PERFEITO! Nenhuma tabela exposta para anônimos!');
    } else {
        console.log('\n❌ TABELAS A CORRIGIR:');
        exposed.forEach(t => console.log('   -', t));
    }
}

checkExposed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
