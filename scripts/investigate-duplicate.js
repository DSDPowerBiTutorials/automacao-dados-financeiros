require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
  console.log("🔍 Investigando invoices duplicadas para gayakat16@gmail.com...\n");
  
  // Buscar no ar_invoices
  const { data: invoices } = await supabase
    .from("ar_invoices")
    .select("*")
    .ilike("email", "%gayakat16%");
  
  console.log(`📊 Encontradas ${invoices?.length || 0} invoices em ar_invoices:\n`);
  
  for (const inv of invoices || []) {
    console.log("=".repeat(60));
    console.log(`Invoice Number: ${inv.invoice_number}`);
    console.log(`Order ID: ${inv.order_id}`);
    console.log(`Order Status: ${inv.order_status}`);
    console.log(`Products: ${inv.products}`);
    console.log(`Invoice Date: ${inv.invoice_date}`);
    console.log(`Total: ${inv.total_amount} ${inv.currency}`);
    console.log(`Status: ${inv.status}`);
    console.log(`Source ID: ${inv.source_id}`);
  }
  
  // Buscar nos dados originais do csv_rows
  console.log("\n\n📊 DADOS ORIGINAIS NO csv_rows:\n");
  
  const { data: csvRows } = await supabase
    .from("csv_rows")
    .select("*")
    .eq("source", "hubspot")
    .ilike("custom_data->>customer_email", "%gayakat16%");
  
  console.log(`Encontrados ${csvRows?.length || 0} registros em csv_rows:\n`);
  
  for (const row of csvRows || []) {
    const cd = row.custom_data;
    console.log("=".repeat(60));
    console.log(`CSV Row ID: ${row.id}`);
    console.log(`Deal ID: ${cd.deal_id}`);
    console.log(`Dealname: ${cd.dealname}`);
    console.log(`Order Code: ${cd.order_code}`);
    console.log(`Product Name: ${cd.product_name}`);
    console.log(`Paid Status: ${cd.paid_status}`);
    console.log(`Date Ordered: ${cd.date_ordered}`);
    console.log(`Date Paid: ${cd.date_paid}`);
    console.log(`Total Price: ${cd.total_price}`);
    console.log(`Final Price: ${cd.final_price}`);
  }
}

investigate();
