const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data } = await supabase
    .from('csv_rows')
    .select('*')
    .eq('source', 'hubspot')
    .eq('customer_email', 'drhamada@akdentalgroups.com')
    .limit(1);
  
  if (data && data[0]) {
    console.log('=== CUSTOM DATA FIELDS ===');
    console.log(JSON.stringify(data[0].custom_data, null, 2));
    console.log('\n=== KEYS ===');
    console.log(Object.keys(data[0].custom_data));
  }
}

check();
