require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Buscar a invoice específica
  const { data } = await supabase
    .from("csv_rows")
    .select("*")
    .eq("source", "hubspot")
    .ilike("custom_data->>customer_email", "%donohue.kristen@gmail.com%")
    .limit(1);
  
  if (data?.[0]) {
    console.log("📊 Dados completos da invoice Kristen Donohue:\n");
    console.log(JSON.stringify(data[0].custom_data, null, 2));
  }
  
  // Verificar campos disponíveis que podem conter "status"
  const { data: sample } = await supabase
    .from("csv_rows")
    .select("custom_data")
    .eq("source", "hubspot")
    .limit(5);
  
  console.log("\n📋 Campos disponíveis no custom_data:");
  const allKeys = new Set();
  sample?.forEach(r => {
    Object.keys(r.custom_data || {}).forEach(k => allKeys.add(k));
  });
  console.log([...allKeys].sort().join('\n'));
}

check();
