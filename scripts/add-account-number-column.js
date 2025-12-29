#!/usr/bin/env node

/**
 * Script to add missing columns to bank_accounts table
 * Adds: account_number, iban, swift_bic
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addMissingColumns() {
    console.log('🔧 Adding missing columns to bank_accounts table...\n');

    console.log('📋 Current columns found:');
    console.log('   - code, name, currency, bank_name');
    console.log('   - account_type, is_active');
    console.log('   - created_at, updated_at');
    console.log('   - country, applies_to_all_countries\n');

    console.log('➕ Columns to add:');
    console.log('   - account_number (TEXT)');
    console.log('   - iban (TEXT)');
    console.log('   - swift_bic (TEXT)\n');

    console.log('📋 SQL to execute in Supabase Dashboard:\n');
    console.log('============================================');
    console.log(`
-- Add account_number column
ALTER TABLE bank_accounts 
ADD COLUMN IF NOT EXISTS account_number TEXT;

-- Add iban column
ALTER TABLE bank_accounts 
ADD COLUMN IF NOT EXISTS iban TEXT;

-- Add swift_bic column
ALTER TABLE bank_accounts 
ADD COLUMN IF NOT EXISTS swift_bic TEXT;

-- Add comments to columns
COMMENT ON COLUMN bank_accounts.account_number IS 'Bank account number';
COMMENT ON COLUMN bank_accounts.iban IS 'International Bank Account Number';
COMMENT ON COLUMN bank_accounts.swift_bic IS 'SWIFT/BIC code';

-- Optional: Add indexes for faster searches
CREATE INDEX IF NOT EXISTS idx_bank_accounts_account_number 
ON bank_accounts(account_number);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_iban 
ON bank_accounts(iban);

-- Show updated structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bank_accounts'
ORDER BY ordinal_position;
    `);
    console.log('============================================\n');

    console.log('🚀 To execute this SQL:\n');
    console.log('1. Go to: ' + supabaseUrl.replace('/rest/v1', '') + '/project/_/sql');
    console.log('2. Or navigate to: Dashboard > SQL Editor > New query');
    console.log('3. Paste the SQL above');
    console.log('4. Click "Run" or press Cmd/Ctrl + Enter\n');

    console.log('✅ After running the SQL, verify with:');
    console.log('   node scripts/check-bank-accounts-columns.js\n');

    process.exit(0);
}

addMissingColumns();
