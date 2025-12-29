require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Use service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function addCurrentBalanceColumn() {
  console.log('🔧 Adding current_balance column to bank_accounts table...\n');

  try {
    // First, check if column already exists by trying to select it
    const { data: testData, error: testError } = await supabase
      .from('bank_accounts')
      .select('current_balance')
      .limit(1);

    if (!testError) {
      console.log('✅ current_balance column already exists!');
      console.log(`Found ${testData?.length || 0} records`);
      return;
    }

    console.log('⚠️  Column does not exist, attempting to add...');
    console.log('Error was:', testError.message);

    // Try to use RPC to execute SQL (if you have a function set up)
    console.log('\n📋 To add this column, run the following SQL in Supabase SQL Editor:');
    console.log('─'.repeat(80));
    console.log(`
ALTER TABLE bank_accounts 
ADD COLUMN IF NOT EXISTS current_balance DECIMAL(15, 2) DEFAULT 0.00;

COMMENT ON COLUMN bank_accounts.current_balance IS 'Current account balance for cash management';

UPDATE bank_accounts 
SET current_balance = 0.00 
WHERE current_balance IS NULL;
    `);
    console.log('─'.repeat(80));

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

addCurrentBalanceColumn().then(() => process.exit(0));
