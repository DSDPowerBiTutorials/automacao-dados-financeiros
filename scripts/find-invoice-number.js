require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function find() {
  console.log("🔍 Buscando invoice number #DSDESC7599A2-53202...\n");
  
  const searchTerms = ['DSDESC7599A2', '53202', 'DSDESC7599A2-53202'];
  
  // 1. Buscar em csv_rows (todas as fontes)
  console.log("1️⃣ Buscando em csv_rows (todas as fontes):");
  
  for (const term of searchTerms) {
    const { data } = await supabase
      .from("csv_rows")
      .select("*")
      .or(`description.ilike.%${term}%`)
      .limit(10);
    
    if (data?.length > 0) {
      console.log(`\n   ✅ Encontrado "${term}" em csv_rows (${data.length} registros):`);
      data.forEach(d => {
        console.log(`      source: ${d.source}`);
        console.log(`      date: ${d.date}`);
        console.log(`      description: ${d.description?.substring(0, 100)}`);
        console.log(`      amount: ${d.amount}`);
        if (d.custom_data) {
          // Procurar campos com a data
          Object.keys(d.custom_data).forEach(k => {
            const val = String(d.custom_data[k]);
            if (val.includes('2025-12-03') || val.includes('03/12/2025')) {
              console.log(`      ⭐ ${k}: ${d.custom_data[k]}`);
            }
          });
        }
        console.log('');
      });
    }
  }
  
  // 2. Buscar em invoices (tabela AP)
  console.log("\n2️⃣ Buscando em invoices (AP):");
  const { data: invData } = await supabase
    .from("invoices")
    .select("*")
    .or(`invoice_number.ilike.%DSDESC7599A2%,invoice_number.ilike.%53202%`)
    .limit(10);
  
  if (invData?.length > 0) {
    console.log(`   ✅ Encontrado em invoices: ${invData.length} registros`);
    invData.forEach(i => console.log(`      ${i.invoice_number} - ${i.invoice_date}`));
  } else {
    console.log("   Não encontrado em invoices");
  }
  
  // 3. Buscar em ar_invoices
  console.log("\n3️⃣ Buscando em ar_invoices:");
  const { data: arData } = await supabase
    .from("ar_invoices")
    .select("*")
    .or(`invoice_number.ilike.%DSDESC7599A2%,invoice_number.ilike.%53202%`)
    .limit(10);
  
  if (arData?.length > 0) {
    console.log(`   ✅ Encontrado em ar_invoices: ${arData.length} registros`);
    arData.forEach(i => console.log(`      ${i.invoice_number} - ${i.invoice_date}`));
  } else {
    console.log("   Não encontrado em ar_invoices");
  }
  
  // 4. Listar todas as tabelas disponíveis para buscar
  console.log("\n4️⃣ Buscando em TODAS as tabelas por 53202 ou DSDESC7599A2...");
  
  // Tentar tabelas comuns
  const tables = ['hubspot_deals', 'transactions', 'payments', 'orders', 'financial_transactions'];
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .limit(1);
      
      if (!error) {
        console.log(`   Tabela ${table} existe`);
      }
    } catch (e) {}
  }
}

find();
