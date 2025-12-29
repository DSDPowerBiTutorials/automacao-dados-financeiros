const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAll() {
  console.log('\n=== Financial Accounts - Full Analysis ===\n');

  const { data, error } = await supabase
    .from('financial_accounts')
    .select('*')
    .order('code');

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  console.log(`📊 Total records: ${data.length}\n`);

  // Group by type
  const byType = {};
  data.forEach(acc => {
    if (!byType[acc.type]) byType[acc.type] = [];
    byType[acc.type].push(acc);
  });

  console.log('📋 Accounts by TYPE:\n');
  Object.keys(byType).forEach(type => {
    console.log(`\n${type.toUpperCase()} (${byType[type].length} accounts):`);
    byType[type].slice(0, 5).forEach(acc => {
      console.log(`  ${acc.code} - ${acc.name} [Level ${acc.level}]`);
    });
    if (byType[type].length > 5) {
      console.log(`  ... and ${byType[type].length - 5} more`);
    }
  });

  // Group by level
  const byLevel = {};
  data.forEach(acc => {
    if (!byLevel[acc.level]) byLevel[acc.level] = [];
    byLevel[acc.level].push(acc);
  });

  console.log('\n\n📊 Accounts by LEVEL:\n');
  Object.keys(byLevel).sort().forEach(level => {
    console.log(`Level ${level}: ${byLevel[level].length} accounts`);
  });

  // Check for revenue accounts
  const revenueKeywords = ['revenue', 'receita', 'income', 'sales', 'venda'];
  const possibleRevenue = data.filter(acc => 
    revenueKeywords.some(keyword => 
      acc.name.toLowerCase().includes(keyword) || 
      acc.code.startsWith('4') || // Typical revenue accounts start with 4
      acc.code.startsWith('3')     // Or 3 in some chart of accounts
    )
  );

  console.log(`\n\n🔍 Possible REVENUE accounts (${possibleRevenue.length}):\n`);
  if (possibleRevenue.length > 0) {
    possibleRevenue.forEach(acc => {
      console.log(`  ${acc.code} - ${acc.name} [Type: ${acc.type}, Level: ${acc.level}]`);
    });
  } else {
    console.log('  ❌ No revenue accounts found!');
    console.log('  ⚠️  All accounts are type "expense" - need to create revenue accounts for AR');
  }

  // Show account code ranges
  const codes = data.map(acc => acc.code).sort();
  console.log(`\n\n📈 Account code range:`);
  console.log(`  First: ${codes[0]}`);
  console.log(`  Last: ${codes[codes.length - 1]}`);

}

checkAll();
