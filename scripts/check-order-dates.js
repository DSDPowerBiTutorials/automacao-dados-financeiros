require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Buscar a order c7599a2
  const { data } = await supabase
    .from("csv_rows")
    .select("*")
    .eq("source", "hubspot")
    .ilike("custom_data->>order_code", "%c7599a2%");
  
  if (data?.[0]) {
    const cd = data[0].custom_data;
    console.log("📊 Order c7599a2 - Dados de datas:\n");
    console.log("Campos de data disponíveis:");
    console.log(`  date_ordered: ${cd.date_ordered}`);
    console.log(`  date_paid: ${cd.date_paid}`);
    console.log(`  createdate: ${cd.createdate}`);
    console.log(`  last_updated: ${cd.last_updated}`);
    console.log(`  hs_lastmodifieddate: ${cd.hs_lastmodifieddate}`);
    console.log(`  hs_closed_won_date: ${cd.hs_closed_won_date}`);
    console.log(`  order.date: ${data[0].date}`);
    
    console.log("\n📋 Outros campos relevantes:");
    console.log(`  paid_status: ${cd.paid_status}`);
    console.log(`  dealname: ${cd.dealname}`);
    console.log(`  product_name: ${cd.product_name}`);
  } else {
    console.log("Order não encontrada");
  }
  
  // Verificar na ar_invoices também
  const { data: inv } = await supabase
    .from("ar_invoices")
    .select("*")
    .ilike("order_id", "%c7599a2%");
  
  if (inv?.[0]) {
    console.log("\n📊 Na tabela ar_invoices:");
    console.log(`  order_date: ${inv[0].order_date}`);
    console.log(`  invoice_date: ${inv[0].invoice_date}`);
  }
}

check();
