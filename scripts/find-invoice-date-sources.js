require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log("📊 Investigando fontes de dados para Invoice Date...\n");
  
  // 1. Verificar todos os sources disponíveis em csv_rows
  const { data: sources } = await supabase
    .from("csv_rows")
    .select("source")
    .limit(1000);
  
  const uniqueSources = [...new Set(sources?.map(s => s.source))];
  console.log("1️⃣ Sources disponíveis em csv_rows:");
  console.log(`   ${uniqueSources.join(', ')}\n`);
  
  // 2. Buscar a order c7599a2 em TODOS os sources
  console.log("2️⃣ Buscando c7599a2 em todas as fontes:");
  
  for (const source of uniqueSources) {
    const { data } = await supabase
      .from("csv_rows")
      .select("*")
      .eq("source", source)
      .or(`description.ilike.%c7599a2%,custom_data->>order_code.ilike.%c7599a2%,custom_data->>reference.ilike.%c7599a2%,custom_data->>order_id.ilike.%c7599a2%`)
      .limit(5);
    
    if (data?.length > 0) {
      console.log(`\n   ✅ Encontrado em "${source}" (${data.length} registros)`);
      data.forEach(d => {
        console.log(`      - date: ${d.date}`);
        if (d.custom_data) {
          const cd = d.custom_data;
          // Procurar campos de invoice date
          const invoiceFields = Object.keys(cd).filter(k => 
            k.toLowerCase().includes('invoice') || 
            k.toLowerCase().includes('billing') ||
            k.toLowerCase().includes('settlement')
          );
          if (invoiceFields.length > 0) {
            console.log(`      - Campos de invoice: ${invoiceFields.join(', ')}`);
            invoiceFields.forEach(f => console.log(`        ${f}: ${cd[f]}`));
          }
        }
      });
    }
  }
  
  // 3. Verificar outras tabelas que podem ter invoice_date
  console.log("\n\n3️⃣ Verificando outras tabelas com invoice/order c7599a2:");
  
  // Braintree transactions
  const { data: btData } = await supabase
    .from("csv_rows")
    .select("*")
    .eq("source", "braintree")
    .or(`description.ilike.%c7599a2%,custom_data->>order_id.ilike.%c7599a2%`)
    .limit(5);
  
  if (btData?.length > 0) {
    console.log(`   Braintree: ${btData.length} registros`);
    btData.forEach(d => {
      console.log(`      date: ${d.date}, amount: ${d.amount}`);
      if (d.custom_data?.settlement_date) {
        console.log(`      settlement_date: ${d.custom_data.settlement_date}`);
      }
    });
  }
  
  // Stripe
  const { data: stripeData } = await supabase
    .from("csv_rows")
    .select("*")
    .eq("source", "stripe")
    .or(`description.ilike.%c7599a2%,custom_data->>order_id.ilike.%c7599a2%`)
    .limit(5);
  
  if (stripeData?.length > 0) {
    console.log(`   Stripe: ${stripeData.length} registros`);
  }
}

check();
