require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
  console.log("🔍 Investigando invoices específicas...\n");
  
  // Buscar as duas invoices mencionadas
  const invoiceNumbers = ['HS-FE35CB9270AC', 'HS-D134E29F9500'];
  
  for (const invNum of invoiceNumbers) {
    console.log("=".repeat(70));
    console.log(`📋 INVOICE: ${invNum}`);
    console.log("=".repeat(70));
    
    // Buscar no ar_invoices
    const { data: invoice } = await supabase
      .from("ar_invoices")
      .select("*")
      .eq("invoice_number", invNum)
      .single();
    
    if (invoice) {
      console.log(`\n[ar_invoices]`);
      console.log(`  Order ID: ${invoice.order_id || 'NULL'}`);
      console.log(`  Products: ${invoice.products}`);
      console.log(`  Order Status: ${invoice.order_status}`);
      console.log(`  Email: ${invoice.email}`);
      console.log(`  Total: ${invoice.total_amount} ${invoice.currency}`);
      console.log(`  Source ID: ${invoice.source_id}`);
      
      // Buscar no csv_rows
      const { data: csvRow } = await supabase
        .from("csv_rows")
        .select("*")
        .eq("id", invoice.source_id)
        .single();
      
      if (csvRow) {
        const cd = csvRow.custom_data;
        console.log(`\n[csv_rows - custom_data]`);
        console.log(`  deal_id: ${cd.deal_id}`);
        console.log(`  dealname: ${cd.dealname}`);
        console.log(`  order_code: ${cd.order_code}`);
        console.log(`  product_name: ${cd.product_name}`);
        console.log(`  dealtype: ${cd.dealtype}`);
        console.log(`  dealstage: ${cd.dealstage}`);
        console.log(`  pipeline: ${cd.pipeline}`);
        console.log(`  paid_status: ${cd.paid_status}`);
        console.log(`  ecommerce_deal: ${cd.ecommerce_deal}`);
        console.log(`  hs_is_closed: ${cd.hs_is_closed}`);
        console.log(`  hs_is_closed_won: ${cd.hs_is_closed_won}`);
        console.log(`  total_price: ${cd.total_price}`);
        console.log(`  final_price: ${cd.final_price}`);
        console.log(`  total_payment: ${cd.total_payment}`);
        console.log(`  query_type: ${cd.query_type}`);
        console.log(`  order_site: ${cd.order_site}`);
      }
    }
  }
  
  // Agora vamos comparar com uma invoice "boa" que sabemos que funciona
  console.log("\n\n" + "=".repeat(70));
  console.log("📋 COMPARANDO COM INVOICE BEM-SUCEDIDA (Gaya Kathiresan)");
  console.log("=".repeat(70));
  
  const { data: goodInvoice } = await supabase
    .from("ar_invoices")
    .select("*")
    .ilike("email", "%gayakat16%")
    .single();
  
  if (goodInvoice) {
    const { data: csvRow } = await supabase
      .from("csv_rows")
      .select("*")
      .eq("id", goodInvoice.source_id)
      .single();
    
    if (csvRow) {
      const cd = csvRow.custom_data;
      console.log(`\n[csv_rows - custom_data]`);
      console.log(`  deal_id: ${cd.deal_id}`);
      console.log(`  dealname: ${cd.dealname}`);
      console.log(`  order_code: ${cd.order_code}`);
      console.log(`  product_name: ${cd.product_name}`);
      console.log(`  dealtype: ${cd.dealtype}`);
      console.log(`  dealstage: ${cd.dealstage}`);
      console.log(`  pipeline: ${cd.pipeline}`);
      console.log(`  paid_status: ${cd.paid_status}`);
      console.log(`  ecommerce_deal: ${cd.ecommerce_deal}`);
      console.log(`  hs_is_closed: ${cd.hs_is_closed}`);
      console.log(`  hs_is_closed_won: ${cd.hs_is_closed_won}`);
      console.log(`  total_price: ${cd.total_price}`);
      console.log(`  final_price: ${cd.final_price}`);
      console.log(`  total_payment: ${cd.total_payment}`);
      console.log(`  query_type: ${cd.query_type}`);
      console.log(`  order_site: ${cd.order_site}`);
    }
  }
  
  // Analisar padrões de TEST_
  console.log("\n\n" + "=".repeat(70));
  console.log("📋 ANÁLISE DE PADRÕES TEST_ e orders sem order_code");
  console.log("=".repeat(70));
  
  const { data: testOrders } = await supabase
    .from("csv_rows")
    .select("custom_data")
    .eq("source", "hubspot")
    .ilike("custom_data->>order_code", "TEST_%");
  
  console.log(`\nOrders com TEST_: ${testOrders?.length || 0}`);
  
  // Verificar padrões de dealtype e pipeline
  const { data: allOrders } = await supabase
    .from("csv_rows")
    .select("custom_data")
    .eq("source", "hubspot")
    .limit(500);
  
  const dealtypes = {};
  const pipelines = {};
  const querytypes = {};
  
  for (const order of allOrders || []) {
    const cd = order.custom_data;
    dealtypes[cd.dealtype] = (dealtypes[cd.dealtype] || 0) + 1;
    pipelines[cd.pipeline] = (pipelines[cd.pipeline] || 0) + 1;
    querytypes[cd.query_type] = (querytypes[cd.query_type] || 0) + 1;
  }
  
  console.log("\nDealTypes:");
  for (const [k, v] of Object.entries(dealtypes).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${k}: ${v}`);
  }
  
  console.log("\nPipelines:");
  for (const [k, v] of Object.entries(pipelines).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${k}: ${v}`);
  }
  
  console.log("\nQuery Types:");
  for (const [k, v] of Object.entries(querytypes).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${k}: ${v}`);
  }
}

investigate();
