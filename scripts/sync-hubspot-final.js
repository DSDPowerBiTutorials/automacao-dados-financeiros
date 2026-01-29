require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncFinal() {
  console.log("🔄 Sincronizando HubSpot com mapeamento FINAL...\n");
  
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
  
  let validOrders = hubspotOrders.filter(order => {
    const cd = order.custom_data || {};
    const dateStr = cd.date_ordered || cd.date_paid || order.date;
    if (!dateStr) return false;
    const orderDate = new Date(dateStr);
    return orderDate >= minDate && orderDate <= today;
  });
  
  console.log(`📊 Após filtro de data: ${validOrders.length}`);
  
  // 4. EXCLUIR deals que são apenas "Checkout pending" ou "Win Back Strategy" (não são orders reais)
  const excludePatterns = [
    /^checkout pending/i,
    /^win back strategy/i,
    /^contact us courses/i,
    /^pm - /i,  // Pipeline Management deals
    /^ta /i,    // TA deals
  ];
  
  validOrders = validOrders.filter(order => {
    const cd = order.custom_data || {};
    const dealname = cd.dealname || "";
    // Verificar se é um deal que deve ser excluído
    for (const pattern of excludePatterns) {
      if (pattern.test(dealname)) {
        // Só excluir se NÃO tiver um product_name diferente (indica que é um deal real)
        if (!cd.product_name || cd.product_name === dealname) {
          return false;
        }
      }
    }
    return true;
  });
  
  console.log(`📊 Após excluir deals não-transacionais: ${validOrders.length}`);
  
  // 5. Preparar registros com mapeamento CORRETO
  const mapStatus = (paidStatus) => {
    if (!paidStatus) return "pending";
    const status = paidStatus.toLowerCase();
    if (status === "paid" || status.includes("paid")) return "paid";
    if (status === "partial") return "partial";
    return "pending";
  };
  
  // Função para extrair código de ordem
  const extractOrderCode = (orderCode, dealname) => {
    if (!orderCode) return null;
    // Se é um hash curto (7-8 caracteres hex), usar como order code
    if (/^[a-f0-9]{7,8}$/i.test(orderCode)) return orderCode;
    // Se começa com TEST_, usar
    if (orderCode.startsWith('TEST_')) return orderCode;
    // Se order_code é diferente e curto (< 20 chars), pode ser um código
    if (orderCode.length < 20 && orderCode !== dealname) return orderCode;
    return null;
  };
  
  // Função para extrair nome do produto
  const extractProductName = (cd) => {
    // PRIORIDADE 1: product_name se for diferente do dealname/order_code
    if (cd.product_name && 
        cd.product_name !== cd.dealname && 
        cd.product_name !== cd.order_code) {
      return cd.product_name;
    }
    
    // PRIORIDADE 2: Limpar dealname
    let name = cd.dealname || "";
    
    // Se dealname é um hash, usar product_name mesmo que igual
    if (/^[a-f0-9]{7,8}$/i.test(name)) {
      return cd.product_name || name;
    }
    
    // Remover padrões comuns de prefixos
    name = name.replace(/^(PM|TA|WIN BACK STRATEGY|CHECKOUT PENDING|CONTACT US COURSES)\s*-?\s*/i, '');
    // Remover nome do cliente e sufixos de email
    name = name.replace(/\s*-\s*[A-Za-z\s]+\s*-\s*[a-f0-9]{7,8}$/i, ''); // "- Nome - hash"
    name = name.replace(/\s*-\s*[^\s]+@[^\s]+\s*(ROW|AMEX|APAC)?$/i, ''); // "- email@... ROW"
    name = name.replace(/\s*-\s*[a-f0-9]{7,8}$/i, ''); // "- hash"
    
    return name.trim() || cd.product_name || null;
  };
  
  const records = validOrders.map((order) => {
    const cd = order.custom_data || {};
    const shortId = String(order.id).replace(/-/g, '').slice(0, 12).toUpperCase();
    
    const orderCode = extractOrderCode(cd.order_code, cd.dealname);
    const productName = extractProductName(cd);
    const invoiceDate = cd.date_paid || cd.date_ordered || order.date;
    
    return {
      invoice_number: `HS-${shortId}`,
      order_id: orderCode,
      order_date: cd.date_ordered || order.date || null,
      order_status: cd.paid_status || null,
      invoice_date: invoiceDate,
      products: productName,
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
  
  // Mostrar alguns exemplos
  console.log("\n📋 Exemplos de registros:");
  for (const r of records.slice(0, 5)) {
    console.log(`  ${r.invoice_number}: Order="${r.order_id || '-'}" | Product="${r.products}" | Status=${r.order_status}`);
  }
  
  // 6. Inserir em batches
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

syncFinal();
