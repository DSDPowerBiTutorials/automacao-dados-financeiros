const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findOrder() {
  try {
    // Buscar por Deal ID 12037674126
    console.log('\n=== Buscando por Deal ID 12037674126 ===');
    const { data: byDealId, error: error1 } = await supabase
      .from('csv_rows')
      .select('*')
      .eq('source', 'hubspot')
      .ilike('description', '%12037674126%')
      .limit(5);
    
    if (error1) console.error('Erro byDealId:', error1);
    else console.log(JSON.stringify(byDealId, null, 2));
    
    // Buscar por dealname dsd r1
    console.log('\n=== Buscando por dealname "dsd r1" ===');
    const { data: byDealname, error: error2 } = await supabase
      .from('csv_rows')
      .select('*')
      .eq('source', 'hubspot')
      .ilike('custom_data->>dealname', '%dsd r1%')
      .limit(5);
    
    if (error2) console.error('Erro byDealname:', error2);
    else console.log(JSON.stringify(byDealname, null, 2));
    
    // Buscar por email
    console.log('\n=== Buscando por email drhamada ===');
    const { data: byEmail, error: error3 } = await supabase
      .from('csv_rows')
      .select('*')
      .eq('source', 'hubspot')
      .ilike('customer_email', '%drhamada%')
      .limit(5);
    
    if (error3) console.error('Erro byEmail:', error3);
    else console.log(JSON.stringify(byEmail, null, 2));
    
    // Buscar por e437d54
    console.log('\n=== Buscando por e437d54 ===');
    const { data: byCode, error: error4 } = await supabase
      .from('csv_rows')
      .select('*')
      .eq('source', 'hubspot')
      .or('description.ilike.%e437d54%,custom_data->>dealname.ilike.%e437d54%')
      .limit(5);
    
    if (error4) console.error('Erro byCode:', error4);
    else console.log(JSON.stringify(byCode, null, 2));
    
  } catch (err) {
    console.error('Erro:', err);
  }
}

findOrder();
