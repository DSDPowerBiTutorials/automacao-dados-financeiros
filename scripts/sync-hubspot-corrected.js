require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncCorrected() {
  console.log("🔄 Sincronizando HubSpot com mapeamento CORRIGIDO...\n");
  
  // 1. Limpar registros existentes
  console.log("🧹 Limpando registros existentes...");
  await supabase.from("ar_invoices").delete().eq("source", "hubspot");
  
  // 2. Buscar TODOS os dados HubSpot
  const { data: hubspotOrders, error } = await supabase
    .from("csv_rows")
    .select("*")
    .eq("source", "hubspot");
  
  if (error) {
    console.log("❌ Erro:", error.message);
    return;
  }
  
  console.log(`📊 Total HubSpot orders: ${hubspotOrders?.length || 0}`);
  
  // 3. Filtrar por data: >= 2025-11-01 e <= hoje
  const minDate = new Date('2025-11-01');
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  const validOrders = hubspotOrders.filter(order => {
    const cd = order.custom_data || {};
    // Usar date_ordered ou date do registro
    const dateStr = cd.date_ordered || cd.date_paid || order.date;
    if (!dateStr) return false;
    
    const orderDate = new Date(dateStr);
    return orderDate >= minDate && orderDate <= today;
  });
  
  console.log(`📊 Registros válidos (data >= 2025-11-01 e <= hoje): ${validOrders.length}`);
  
  // 4. Preparar registros com mapeamento CORRETO
  const mapStatus = (paidStatus) => {
    if (!paidStatus) return "pending";
    const status = paidStatus.toLowerCase();
    if (status === "paid" || status.includes("paid")) return "paid";
    if (status === "partial") return "partial";
    return "pending";
  };
  
  // Função para extrair código de ordem (se for um hash curto)
  const extractOrderCode = (orderCode, dealname) => {
    // Se order_code é um hash curto (< 15 chars e diferente do dealname), usar
    if (orderCode && orderCode.length < 15 && orderCode !== dealname) {
      return orderCode;
    }
    // Se começa com prefixo de código como TEST_, usar
    if (orderCode && (orderCode.startsWith('TEST_') || /^[a-f0-9]{7,8}$/i.test(orderCode))) {
      return orderCode;
    }
    return null; // Não é um código de ordem real
  };
  
  // Função para extrair nome do produto
  const extractProductName = (cd) => {
    // Tentar pegar product_name primeiro
    if (cd.product_name && cd.product_name !== cd.order_code) {
      return cd.product_name;
    }
    // Senão, usar dealname (removendo prefixos como "PM - ", "TA ", etc)
    let name = cd.dealname || cd.product_name || null;
    if (name) {
      // Remover prefixos comuns
      name = name.replace(/^(PM|TA|WIN BACK STRATEGY|CHECKOUT PENDING|CONTACT US COURSES)\s*-?\s*/i, '');
      // Remover sufixos de email
      name = name.replace(/\s*-\s*[^\s]+@[^\s]+\s*(ROW|AMEX|APAC)?$/i, '');
      // Se sobrou só um hash, retornar null
      if (/^[a-f0-9]{6,8}$/i.test(name.trim())) {
        return cd.dealname; // Usar dealname original
      }
    }
    return name;
  };
  
  const records = validOrders.map((order) => {
    const cd = order.custom_data || {};
    const shortId = String(order.id).replace(/-/g, '').slice(0, 12).toUpperCase();
    
    // Extrair order_code e product_name corretamente
    const orderCode = extractOrderCode(cd.order_code, cd.dealname);
    const productName = extractProductName(cd);
    
    // Determinar invoice_date: usar date_paid se disponível, senão date_ordered
    const invoiceDate = cd.date_paid || cd.date_ordered || order.date;
    
    return {
      invoice_number: `HS-${shortId}`,
      order_id: orderCode, // Apenas código de ordem real
      order_date: cd.date_ordered || order.date || null,
      order_status: cd.paid_status || null,
      invoice_date: invoiceDate,
      products: productName, // Nome do produto limpo
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
  
  console.log(`📊 Registros a inserir: ${records.length}`);
  
  if (records.length === 0) {
    console.log("⚠️  Nenhum registro para inserir");
    return;
  }
  
  // 5. Inserir em batches
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error: insertError } = await supabase.from("ar_invoices").insert(batch);
    
    if (insertError) {
      console.log(`❌ Erro no batch ${i}:`, insertError.message);
    } else {
      inserted += batch.length;
    }
  }
  
  console.log(`\n🎉 CONCLUÍDO! ${inserted} registros sincronizados.`);
  
  // Verificar total
  const { count } = await supabase.from("ar_invoices").select("*", { count: 'exact', head: true });
  console.log(`📊 Total em ar_invoices: ${count}`);
}

syncCorrected();
