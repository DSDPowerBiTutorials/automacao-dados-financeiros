const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkFinancialAccounts() {
  console.log('\n=== Checking financial_accounts table structure ===\n');

  try {
    // Check if table exists and get sample data
    const { data, error } = await supabase
      .from('financial_accounts')
      .select('*')
      .limit(10);

    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log('⚠️  Table exists but has no data');
      return;
    }

    console.log('✅ Found financial_accounts table');
    console.log(`📊 Sample records: ${data.length}`);
    console.log('\n📋 Columns:');
    
    const columns = Object.keys(data[0]);
    columns.forEach(col => console.log(`  - ${col}`));

    console.log('\n💡 Sample records:\n');
    data.slice(0, 5).forEach((record, i) => {
      console.log(`Record ${i + 1}:`);
      console.log(JSON.stringify(record, null, 2));
      console.log('---');
    });

    // Check if there's any categorization for AR vs AP
    const categoryCheck = columns.find(c => 
      c.includes('type') || c.includes('category') || c.includes('class')
    );
    
    if (categoryCheck) {
      console.log(`\n🔍 Found categorization field: "${categoryCheck}"`);
      
      const { data: types } = await supabase
        .from('financial_accounts')
        .select(categoryCheck)
        .limit(100);
      
      const uniqueTypes = [...new Set(types?.map(t => t[categoryCheck]))];
      console.log(`Unique values: ${uniqueTypes.join(', ')}`);
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkFinancialAccounts();
