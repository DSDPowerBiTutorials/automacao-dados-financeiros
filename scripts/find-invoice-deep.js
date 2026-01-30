require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function find() {
  console.log("🔍 Busca profunda por DSDESC7599A2 ou 53202...\n");
  
  // 1. Buscar no custom_data do csv_rows
  console.log("1️⃣ Buscando no custom_data de csv_rows:");
  
  // Buscar em todos os campos JSONB
  const { data: jsonSearch } = await supabase
    .from("csv_rows")
    .select("*")
    .or(`custom_data::text.ilike.%DSDESC7599A2%,custom_data::text.ilike.%53202%`)
    .limit(20);
  
  if (jsonSearch?.length > 0) {
    console.log(`   ✅ Encontrado em custom_data: ${jsonSearch.length} registros`);
    jsonSearch.forEach(d => {
      console.log(`\n      source: ${d.source}`);
      console.log(`      date: ${d.date}`);
      // Mostrar campos que contêm o termo
      Object.keys(d.custom_data || {}).forEach(k => {
        const val = String(d.custom_data[k]);
        if (val.includes('DSDESC7599A2') || val.includes('53202')) {
          console.log(`      ⭐ ${k}: ${d.custom_data[k]}`);
        }
      });
    });
  } else {
    console.log("   Não encontrado em custom_data");
  }
  
  // 2. Listar todas as tabelas do schema público
  console.log("\n\n2️⃣ Listando tabelas disponíveis:");
  const { data: tables } = await supabase.rpc('get_tables');
  if (tables) {
    console.log(`   Tabelas: ${tables.map(t => t.table_name).join(', ')}`);
  }
  
  // 3. Buscar em Braintree com invoice_number ou order_id patterns
  console.log("\n\n3️⃣ Buscando padrões de invoice em Braintree:");
  const { data: btData } = await supabase
    .from("csv_rows")
    .select("custom_data")
    .ilike("source", "%braintree%")
    .limit(3);
  
  if (btData?.length > 0) {
    console.log("   Campos disponíveis no Braintree:");
    const allKeys = new Set();
    btData.forEach(d => {
      Object.keys(d.custom_data || {}).forEach(k => allKeys.add(k));
    });
    console.log(`   ${[...allKeys].sort().join(', ')}`);
  }
  
  // 4. Buscar order c7599a2 em Braintree diretamente
  console.log("\n\n4️⃣ Buscando order c7599a2 em Braintree (por order_id):");
  const { data: btOrder } = await supabase
    .from("csv_rows")
    .select("*")
    .ilike("source", "%braintree%")
    .ilike("custom_data->>order_id", "%c7599a2%")
    .limit(5);
  
  if (btOrder?.length > 0) {
    console.log(`   ✅ Encontrado: ${btOrder.length} registros`);
    btOrder.forEach(d => {
      console.log(`      date: ${d.date}`);
      console.log(`      source: ${d.source}`);
      console.log(`      custom_data: ${JSON.stringify(d.custom_data, null, 2)}`);
    });
  } else {
    console.log("   Não encontrado");
  }
  
  // 5. Verificar se existe tabela de invoices do datawarehouse
  console.log("\n\n5️⃣ Verificando tabelas que podem ter invoice data:");
  const possibleTables = ['dw_invoices', 'datawarehouse_invoices', 'external_invoices', 'hubspot_invoices', 'ecommerce_invoices', 'sales_invoices'];
  
  for (const table of possibleTables) {
    const { error } = await supabase.from(table).select("*").limit(1);
    if (!error) {
      console.log(`   ✅ Tabela ${table} existe!`);
    }
  }
}

find();
