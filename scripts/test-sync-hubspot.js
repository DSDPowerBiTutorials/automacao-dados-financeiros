require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSync() {
  console.log("🔍 Testando sincronização HubSpot...\n");
  
  // 1. Buscar dados HubSpot
  const { data: hubspotOrders, error: hubspotError } = await supabase
    .from("csv_rows")
    .select("*")
    .eq("source", "hubspot")
    .limit(5);
  
  if (hubspotError) {
    console.log("❌ Erro ao buscar HubSpot:", hubspotError.message);
    return;
  }
  
  console.log("📊 HubSpot orders encontrados:", hubspotOrders?.length || 0);
  
  // 2. Verificar existentes
  const { data: existingInvoices, error: existingError } = await supabase
    .from("ar_invoices")
    .select("source_id")
    .eq("source", "hubspot");
  
  if (existingError) {
    console.log("❌ Erro ao buscar ar_invoices:", existingError.message);
    return;
  }
  
  console.log("📊 AR Invoices existentes:", existingInvoices?.length || 0);
  
  const existingSourceIds = new Set((existingInvoices || []).map((i) => i.source_id));
  console.log("📊 Source IDs existentes:", existingSourceIds.size);
  
  // 3. Filtrar novos
  const newOrders = hubspotOrders.filter((order) => !existingSourceIds.has(String(order.id)));
  console.log("📊 Novos para inserir:", newOrders.length);
  
  if (newOrders.length === 0) {
    console.log("\n⚠️  Todos já sincronizados OU algo está errado");
    return;
  }
  
  // 4. Tentar inserir 1 registro de teste
  const order = newOrders[0];
  const cd = order.custom_data || {};
  
  console.log("\n📝 Tentando inserir registro de teste:");
  console.log("  ID:", order.id);
  console.log("  Source:", order.source);
  console.log("  Custom data keys:", Object.keys(cd).join(", "));
  
  const testRecord = {
    invoice_number: `DSDFS-${String(cd.deal_id || order.id).slice(-8)}`,
    order_id: cd.order_code || cd.dealname || null,
    order_date: cd.date_ordered || order.date || null,
    order_status: cd.paid_status || null,
    invoice_date: cd.date_paid || cd.date_ordered || order.date || new Date().toISOString().split("T")[0],
    products: cd.dealname || order.description || null,
    company_name: cd.company_name || cd.company || null,
    client_name: `${cd.customer_firstname || ""} ${cd.customer_lastname || ""}`.trim() || null,
    email: cd.customer_email || null,
    total_amount: parseFloat(cd.final_price || cd.total_price || order.amount) || 0,
    currency: cd.currency || "EUR",
    status: "pending",
    scope: "ES",
    source: "hubspot",
    source_id: String(order.id)
  };
  
  console.log("\n📋 Registro a inserir:", JSON.stringify(testRecord, null, 2));
  
  const { data: insertResult, error: insertError } = await supabase
    .from("ar_invoices")
    .insert([testRecord])
    .select();
  
  if (insertError) {
    console.log("\n❌ ERRO AO INSERIR:", insertError.message);
    console.log("Detalhes:", JSON.stringify(insertError, null, 2));
  } else {
    console.log("\n✅ SUCESSO! Registro inserido:", insertResult);
  }
}

testSync();
