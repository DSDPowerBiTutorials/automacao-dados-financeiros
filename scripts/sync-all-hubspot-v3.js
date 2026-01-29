require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncAll() {
  console.log("🔄 Sincronizando TODOS os registros HubSpot (v3 - source_id único)...\n");
  
  // 1. Limpar registros existentes
  console.log("🧹 Limpando registros existentes...");
  const { error: deleteError } = await supabase.from("ar_invoices").delete().eq("source", "hubspot");
  if (deleteError) console.log("Delete error:", deleteError.message);
  
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
  
  // 3. Preparar registros com invoice_number baseado no source_id (UUID único)
  const mapStatus = (paidStatus) => {
    if (!paidStatus) return "pending";
    const status = paidStatus.toLowerCase();
    if (status === "paid" || status.includes("paid")) return "paid";
    return "pending";
  };
  
  const records = hubspotOrders.map((order) => {
    const cd = order.custom_data || {};
    // Usar os primeiros 8 caracteres do UUID como invoice number
    const shortId = String(order.id).replace(/-/g, '').slice(0, 12).toUpperCase();
    const invoiceNumber = `HS-${shortId}`;
    
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
  
  console.log("📊 Registros preparados:", records.length);
  console.log("  Exemplo invoice_number:", records[0]?.invoice_number);
  
  // 4. Inserir em batches menores de 100
  const batchSize = 100;
  let inserted = 0;
  let errors = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error: insertError } = await supabase.from("ar_invoices").insert(batch);
    
    if (insertError) {
      errors++;
      if (errors <= 3) {
        console.log(`❌ Erro no batch ${i}-${i+batch.length}:`, insertError.message);
      }
    } else {
      inserted += batch.length;
      if (inserted % 500 === 0 || i + batchSize >= records.length) {
        console.log(`✅ Inseridos: ${inserted}/${records.length}`);
      }
    }
  }
  
  console.log(`\n🎉 CONCLUÍDO! ${inserted} registros sincronizados.`);
  
  // Verificar total
  const { count } = await supabase.from("ar_invoices").select("*", { count: 'exact', head: true });
  console.log(`📊 Total em ar_invoices: ${count}`);
}

syncAll();
