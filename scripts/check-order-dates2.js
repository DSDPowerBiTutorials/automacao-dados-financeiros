require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data } = await supabase
    .from("csv_rows")
    .select("*")
    .eq("source", "hubspot")
    .ilike("custom_data->>order_code", "%c7599a2%");
  
  if (data?.[0]) {
    console.log("📊 TODOS os campos com 'date' no nome:\n");
    const cd = data[0].custom_data;
    Object.keys(cd).filter(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('time')).forEach(k => {
      console.log(`  ${k}: ${cd[k]}`);
    });
    
    console.log("\n📊 Verificando se há invoice_date no custom_data:");
    console.log(`  invoice_date: ${cd.invoice_date}`);
    
    console.log("\n📊 Todos campos do custom_data:");
    Object.keys(cd).sort().forEach(k => {
      if (cd[k] !== null && cd[k] !== undefined && cd[k] !== '') {
        console.log(`  ${k}: ${cd[k]}`);
      }
    });
  }
}

check();
