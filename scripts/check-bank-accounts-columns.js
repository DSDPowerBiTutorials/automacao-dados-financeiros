#!/usr/bin/env node

/**
 * Script to check current columns in bank_accounts table
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkBankAccountsColumns() {
    console.log('🔍 Checking bank_accounts table structure...\n');

    try {
        // Get one row to see all columns
        const { data, error } = await supabase
            .from('bank_accounts')
            .select('*')
            .limit(1);

        if (error) {
            console.error('❌ Error querying bank_accounts:', error);
            return;
        }

        if (!data || data.length === 0) {
            console.log('⚠️  Table is empty, checking with describe...\n');

            // Try to get table info via RPC or direct query
            console.log('📋 Attempting to get table structure via Supabase API...\n');

            // Try inserting empty object to get error with expected columns
            const { error: insertError } = await supabase
                .from('bank_accounts')
                .insert([{ _test: true }]);

            if (insertError) {
                console.log('Table structure based on error:');
                console.log(insertError.message);
            }

            return;
        }

        console.log('✅ Current columns in bank_accounts table:\n');
        const columns = Object.keys(data[0]);

        columns.forEach((col, index) => {
            const value = data[0][col];
            const type = value === null ? 'null' : typeof value;
            console.log(`${index + 1}. ${col.padEnd(20)} (${type})`);
        });

        console.log('\n📊 Total columns:', columns.length);
        console.log('\n📝 Sample data:');
        console.log(JSON.stringify(data[0], null, 2));

        // Check if account_number exists
        if (columns.includes('account_number')) {
            console.log('\n✅ account_number column EXISTS');
        } else {
            console.log('\n⚠️  account_number column DOES NOT EXIST');
            console.log('   You need to add it to the table');
        }

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }

    process.exit(0);
}

checkBankAccountsColumns();
