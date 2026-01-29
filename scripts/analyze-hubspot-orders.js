require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyze() {
  console.log("🔍 Buscando registros com order_code diferente de dealname...\n");
  
  const { data } = await supabase
    .from("csv_rows")
    .select("*")
    .eq("source", "hubspot")
    .limit(100);
  
  // Filtrar registros onde order_code é diferente de dealname
  const different = data.filter(row => {
    const c = row.custom_data;
    // order_code curto (parece ser um hash/código)
    return c.order_code && c.order_code.length < 15 && c.order_code !== c.dealname;
  });
  
  console.log(`Encontrados ${different.length} registros com order_code curto:\n`);
  
  for (const row of different.slice(0, 10)) {
    const c = row.custom_data;
    console.log("---");
    console.log(`  order_code: "${c.order_code}"`);
    console.log(`  dealname: "${c.dealname}"`);
    console.log(`  product_name: "${c.product_name}"`);
    console.log(`  date_ordered: ${c.date_ordered}`);
    console.log(`  paid_status: ${c.paid_status}`);
  }
  
  // Verificar datas
  console.log("\n\n📅 ANÁLISE DE DATAS:");
  const today = new Date();
  const futureCount = data.filter(r => new Date(r.custom_data.date_ordered) > today).length;
  const validCount = data.filter(r => {
    const d = new Date(r.custom_data.date_ordered);
    return d >= new Date('2025-11-01') && d <= today;
  }).length;
  
  console.log(`  Datas futuras (inválidas): ${futureCount}`);
  console.log(`  Datas válidas (>= 2025-11-01 e <= hoje): ${validCount}`);
  console.log(`  Data de hoje: ${today.toISOString().split('T')[0]}`);
}

analyze();
