require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncAll() {
  console.log("🔄 Sincronizando TODOS os registros HubSpot (v2 - UUID completo)...\n");
  
  // 1. Limpar registros existentes para recomeçar
  console.log("🧹 Limpando registros existentes...");
  await supabase.from("ar_invoices").delete().eq("source", "hubspot");
  
  // 2. Buscar TODOS os dados HubSpot
  const { data: hubspotOrders, error: hubspotError } = await supabase
    .from("csv_rows")
    .select("*")
    .eq("source", "hubspot");
  
  if (hubspotError) {
    console.log("❌ Erro:", hubspotError.message);
    return;
  }
  
  console.log("📊 Total HubSpot orders:", hubspotOrders?.length || 0);
  
  // 3. Preparar registros com invoice_number ÚNICO
  const mapStatus = (paidStatus) => {
    if (!paidStatus) return "pending";
    const status = paidStatus.toLowerCase();
    if (status === "paid" || status.includes("paid")) return "paid";
    return "pending";
  };
  
  let counter = 1;
  const records = hubspotOrders.map((order) => {
    const cd = order.custom_data || {};
    // Usar deal_id se existir, senão usar contador sequencial
    const dealId = cd.deal_id || cd.dealId;
    const invoiceNumber = dealId ? `HS-${dealId}` : `HS-${String(counter++).padStart(6, '0')}`;
    
    return {
      invoice_number: invoiceNumber,
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
  
  // 4. Inserir em batches de 500
  const batchSize = 500;
  let inserted = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error: insertError } = await supabase.from("ar_invoices").insert(batch);
    
    if (insertError) {
      console.log(`❌ Erro no batch ${i}-${i+batch.length}:`, insertError.message);
      // Mostrar primeiro registro do batch para debug
      console.log("  Primeiro registro:", JSON.stringify(batch[0], null, 2));
    } else {
      inserted += batch.length;
      console.log(`✅ Inseridos: ${inserted}/${records.length}`);
    }
  }
  
  console.log(`\n🎉 CONCLUÍDO! ${inserted} registros sincronizados.`);
  
  // Verificar total
  const { count } = await supabase.from("ar_invoices").select("*", { count: 'exact', head: true });
  console.log(`📊 Total em ar_invoices: ${count}`);
}

syncAll();
