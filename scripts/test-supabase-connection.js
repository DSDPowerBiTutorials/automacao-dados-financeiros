#!/usr/bin/env node

/**
 * Script para testar conexão com Supabase e verificar se as tabelas necessárias estão acessíveis
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase Connection...\n');
console.log('📍 Supabase URL:', supabaseUrl);
console.log('🔑 Anon Key:', supabaseAnonKey ? '✅ Present' : '❌ Missing');
console.log('');

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    console.log('Testing connection to critical tables:\n');

    const tables = [
        'invoices',
        'providers',
        'bank_accounts',
        'payment_methods',
        'cost_types',
        'dep_cost_types',
        'cost_centers',
        'entry_types',
        'financial_accounts',
        'courses'
    ];

    const results = [];

    for (const table of tables) {
        try {
            const { data, error, count } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error) {
                results.push({ table, status: '❌', error: error.message, count: 0 });
            } else {
                results.push({ table, status: '✅', count: count || 0 });
            }
        } catch (e) {
            results.push({ table, status: '❌', error: e.message, count: 0 });
        }
    }

    console.log('Table\t\t\t\tStatus\tCount\tError');
    console.log('─'.repeat(80));

    results.forEach(({ table, status, count, error }) => {
        const tablePadded = table.padEnd(30);
        const countStr = count !== undefined ? count.toString() : '-';
        const errorStr = error ? error.substring(0, 30) : '';
        console.log(`${tablePadded}\t${status}\t${countStr}\t${errorStr}`);
    });

    const hasErrors = results.some(r => r.status === '❌');

    if (hasErrors) {
        console.log('\n❌ Some tables are not accessible. Check RLS policies and authentication.');

        console.log('\n📋 Common issues:');
        console.log('1. RLS (Row Level Security) is enabled but no policies allow anonymous access');
        console.log('2. Tables do not exist in the database');
        console.log('3. User is not authenticated (for protected tables)');
        console.log('4. Domain/CORS configuration issues');

        process.exit(1);
    } else {
        console.log('\n✅ All tables are accessible!');
        console.log('\n💡 If invoices page still not loading:');
        console.log('1. Check browser console for errors (F12)');
        console.log('2. Verify domain is configured in Supabase Auth settings');
        console.log('3. Clear browser cache and cookies');
        console.log('4. Check Vercel environment variables');
    }
}

testConnection().catch(console.error);
