require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncAll() {
  console.log("🔄 Sincronizando TODOS os registros HubSpot...\n");
  
  // 1. Buscar TODOS os dados HubSpot
  const { data: hubspotOrders, error: hubspotError } = await supabase
    .from("csv_rows")
    .select("*")
    .eq("source", "hubspot");
  
  if (hubspotError) {
    console.log("❌ Erro:", hubspotError.message);
    return;
  }
  
  console.log("📊 Total HubSpot orders:", hubspotOrders?.length || 0);
  
  // 2. Verificar existentes
  const { data: existingInvoices } = await supabase
    .from("ar_invoices")
    .select("source_id")
    .eq("source", "hubspot");
  
  const existingSourceIds = new Set((existingInvoices || []).map((i) => i.source_id));
  console.log("📊 Já existem:", existingSourceIds.size);
  
  // 3. Filtrar novos
  const newOrders = hubspotOrders.filter((order) => !existingSourceIds.has(String(order.id)));
  console.log("📊 Novos para inserir:", newOrders.length);
  
  if (newOrders.length === 0) {
    console.log("✅ Nada para sincronizar");
    return;
  }
  
  // 4. Preparar registros
  const mapStatus = (paidStatus) => {
    if (!paidStatus) return "pending";
    const status = paidStatus.toLowerCase();
    if (status === "paid" || status.includes("paid")) return "paid";
    return "pending";
  };
  
  const records = newOrders.map((order) => {
    const cd = order.custom_data || {};
    return {
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
      payment_method: cd.gateway_name || null,
      status: mapStatus(cd.paid_status),
      scope: "ES",
      source: "hubspot",
      source_id: String(order.id)
    };
  });
  
  // 5. Inserir em batches de 500
  const batchSize = 500;
  let inserted = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error: insertError } = await supabase.from("ar_invoices").insert(batch);
    
    if (insertError) {
      console.log(`❌ Erro no batch ${i}-${i+batch.length}:`, insertError.message);
    } else {
      inserted += batch.length;
      console.log(`✅ Inseridos: ${inserted}/${records.length}`);
    }
  }
  
  console.log(`\n🎉 CONCLUÍDO! ${inserted} registros sincronizados.`);
}

syncAll();
