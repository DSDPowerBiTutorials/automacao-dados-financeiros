const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function executeSetup() {
  console.log('\n🚀 Setting up Accounts Receivable Module\n');

  try {
    // Step 1: Insert revenue financial accounts
    console.log('1️⃣ Inserting revenue financial accounts (série 100)...\n');
    
    const revenueAccounts = [
      // Level 1
      { code: '101.0', name: '101.0 - Growth', type: 'revenue', level: 1, parent_code: null },
      { code: '102.0', name: '102.0 - Delight', type: 'revenue', level: 1, parent_code: null },
      { code: '103.0', name: '103.0 - Planning Center', type: 'revenue', level: 1, parent_code: null },
      { code: '104.0', name: '104.0 - LAB', type: 'revenue', level: 1, parent_code: null },
      { code: '105.0', name: '105.0 - Other Income', type: 'revenue', level: 1, parent_code: null },
      
      // Growth (101.x)
      { code: '101.1', name: '101.1 - DSD Courses', type: 'revenue', level: 2, parent_code: '101.0' },
      { code: '101.2', name: '101.2 - Others Courses', type: 'revenue', level: 2, parent_code: '101.0' },
      { code: '101.3', name: '101.3 - Mastership', type: 'revenue', level: 2, parent_code: '101.0' },
      { code: '101.4', name: '101.4 - PC Membership', type: 'revenue', level: 2, parent_code: '101.0' },
      { code: '101.5', name: '101.5 - Partnerships', type: 'revenue', level: 2, parent_code: '101.0' },
      { code: '101.6', name: '101.6 - Level 2 Allocation', type: 'revenue', level: 2, parent_code: '101.0' },
      
      // Delight (102.x)
      { code: '102.1', name: '102.1 - Contracted ROW', type: 'revenue', level: 2, parent_code: '102.0' },
      { code: '102.2', name: '102.2 - Contracted AMEX', type: 'revenue', level: 2, parent_code: '102.0' },
      { code: '102.3', name: '102.3 - Level 3 New ROW', type: 'revenue', level: 2, parent_code: '102.0' },
      { code: '102.4', name: '102.4 - Level 3 New AMEX', type: 'revenue', level: 2, parent_code: '102.0' },
      { code: '102.5', name: '102.5 - Consultancies', type: 'revenue', level: 2, parent_code: '102.0' },
      { code: '102.6', name: '102.6 - Marketing Coaching', type: 'revenue', level: 2, parent_code: '102.0' },
      { code: '102.7', name: '102.7 - Others', type: 'revenue', level: 2, parent_code: '102.0' },
      
      // Planning Center (103.x)
      { code: '103.1', name: '103.1 - Level 3 ROW', type: 'revenue', level: 2, parent_code: '103.0' },
      { code: '103.2', name: '103.2 - Level 3 AMEX', type: 'revenue', level: 2, parent_code: '103.0' },
      { code: '103.3', name: '103.3 - Level 3 New ROW', type: 'revenue', level: 2, parent_code: '103.0' },
      { code: '103.4', name: '103.4 - Level 3 New AMEX', type: 'revenue', level: 2, parent_code: '103.0' },
      { code: '103.5', name: '103.5 - Level 2', type: 'revenue', level: 2, parent_code: '103.0' },
      { code: '103.6', name: '103.6 - Level 1', type: 'revenue', level: 2, parent_code: '103.0' },
      { code: '103.7', name: '103.7 - Not a Subscriber', type: 'revenue', level: 2, parent_code: '103.0' },
      { code: '103.8', name: '103.8 - Level 2 Allocation', type: 'revenue', level: 2, parent_code: '103.0' },
      { code: '103.9', name: '103.9 - Level 3 Allocation', type: 'revenue', level: 2, parent_code: '103.0' },
      
      // LAB (104.x)
      { code: '104.1', name: '104.1 - Level 3 ROW', type: 'revenue', level: 2, parent_code: '104.0' },
      { code: '104.2', name: '104.2 - Level 3 AMEX', type: 'revenue', level: 2, parent_code: '104.0' },
      { code: '104.3', name: '104.3 - Level 3 New ROW', type: 'revenue', level: 2, parent_code: '104.0' },
      { code: '104.4', name: '104.4 - Level 3 New AMEX', type: 'revenue', level: 2, parent_code: '104.0' },
      { code: '104.5', name: '104.5 - Level 2', type: 'revenue', level: 2, parent_code: '104.0' },
      { code: '104.6', name: '104.6 - Level 1', type: 'revenue', level: 2, parent_code: '104.0' },
      { code: '104.7', name: '104.7 - Not a Subscriber', type: 'revenue', level: 2, parent_code: '104.0' },
      
      // Other Income (105.x)
      { code: '105.1', name: '105.1 - Level 1', type: 'revenue', level: 2, parent_code: '105.0' },
      { code: '105.2', name: '105.2 - CORE Partnerships', type: 'revenue', level: 2, parent_code: '105.0' },
      { code: '105.3', name: '105.3 - Study Club', type: 'revenue', level: 2, parent_code: '105.0' },
      { code: '105.4', name: '105.4 - Other Marketing Revenues', type: 'revenue', level: 2, parent_code: '105.0' }
    ];

    let inserted = 0;
    let updated = 0;
    let errors = 0;
    
    for (const account of revenueAccounts) {
      const { data: existing } = await supabase
        .from('financial_accounts')
        .select('code')
        .eq('code', account.code)
        .single();

      if (existing) {
        const { error: updateError } = await supabase
          .from('financial_accounts')
          .update({
            name: account.name,
            type: account.type,
            level: account.level,
            parent_code: account.parent_code,
            country_code: 'ES',
            applies_to_all_countries: true,
            updated_at: new Date().toISOString()
          })
          .eq('code', account.code);

        if (!updateError) {
          updated++;
          process.stdout.write('.');
        } else {
          errors++;
          console.log(`\n   ❌ Error updating ${account.code}: ${updateError.message}`);
        }
      } else {
        const { error: insertError } = await supabase
          .from('financial_accounts')
          .insert({
            code: account.code,
            name: account.name,
            type: account.type,
            level: account.level,
            parent_code: account.parent_code,
            country_code: 'ES',
            applies_to_all_countries: true,
            is_active: true
          });

        if (!insertError) {
          inserted++;
          process.stdout.write('✓');
        } else {
          errors++;
          console.log(`\n   ❌ Error inserting ${account.code}: ${insertError.message}`);
        }
      }
    }

    console.log(`\n\n   ✅ Financial accounts: ${inserted} inserted, ${updated} updated, ${errors} errors\n`);

    // Step 2: Verify setup
    console.log('2️⃣ Verifying setup...\n');
    
    const { data: revenue, error: revError } = await supabase
      .from('financial_accounts')
      .select('code, name, type, level')
      .eq('type', 'revenue')
      .order('code');

    if (!revError && revenue) {
      console.log(`   ✅ Found ${revenue.length} revenue accounts in database\n`);
      console.log('   Sample accounts:');
      revenue.slice(0, 10).forEach(acc => {
        console.log(`      ${acc.code} - ${acc.name} (Level ${acc.level})`);
      });
      if (revenue.length > 10) {
        console.log(`      ... and ${revenue.length - 10} more`);
      }
    } else {
      console.log('   ⚠️ Could not verify revenue accounts');
    }

    console.log('\n✨ Setup complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Execute the SQL in Supabase SQL Editor to create customers table:');
    console.log('      - CREATE TABLE customers');
    console.log('      - ALTER TABLE invoices ADD COLUMN customer_code');
    console.log('   2. Access /accounts-receivable/master-data/customers');
    console.log('   3. Create some test customers\n');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

executeSetup();
