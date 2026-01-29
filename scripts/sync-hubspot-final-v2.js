require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncFinal() {
  console.log("🔄 Sincronizando HubSpot com mapeamento FINAL v2...\n");
  
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
  
  // 4. EXCLUIR deals que são apenas "Checkout pending" ou similares (não são orders reais)
  const excludePatterns = [
    /^checkout pending/i,
    /^win back strategy/i,
    /^contact us courses/i,
  ];
  
  validOrders = validOrders.filter(order => {
    const cd = order.custom_data || {};
    const dealname = cd.dealname || "";
    for (const pattern of excludePatterns) {
      if (pattern.test(dealname)) {
        // Só excluir se NÃO tiver um product_name diferente
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
  
  // Função para extrair código de ordem (melhorada)
  const extractOrderCode = (orderCode, dealname) => {
    // 1. Se order_code é um hash curto (7-8 caracteres hex), usar
    if (orderCode && /^[a-f0-9]{7,8}$/i.test(orderCode)) {
      return orderCode;
    }
    // 2. Se começa com TEST_, usar
    if (orderCode && orderCode.startsWith('TEST_')) {
      return orderCode;
    }
    // 3. Tentar extrair hash do dealname (padrão "Nome - hash" ou "Nome - Cliente - hash")
    const hashMatch = dealname?.match(/\b([a-f0-9]{7,8})\b/i);
    if (hashMatch) {
      return hashMatch[1];
    }
    return null;
  };
  
  // Função para extrair nome do produto (melhorada)
  const extractProductName = (cd) => {
    // PRIORIDADE 1: product_name se for diferente do dealname/order_code
    if (cd.product_name && 
        cd.product_name !== cd.dealname && 
        cd.product_name !== cd.order_code) {
      return cd.product_name;
    }
    
    // PRIORIDADE 2: Limpar dealname
    let name = cd.dealname || "";
    
    // Se dealname é só um hash, usar product_name
    if (/^[a-f0-9]{7,8}$/i.test(name)) {
      return cd.product_name || name;
    }
    
    // Remover prefixos conhecidos
    name = name.replace(/^(PM|TA|WIN BACK STRATEGY|CHECKOUT PENDING|CONTACT US COURSES)\s*-?\s*/i, '');
    // Remover padrão " - Nome Cliente - hash"
    name = name.replace(/\s+-\s+[A-Za-z\s]+\s+-\s+[a-f0-9]{7,8}$/i, '');
    // Remover padrão " - email@... ROW"
    name = name.replace(/\s+-\s+[^\s]+@[^\s]+\s*(ROW|AMEX|APAC)?$/i, '');
    // Remover padrão " - hash" no final
    name = name.replace(/\s+-\s+[a-f0-9]{7,8}$/i, '');
    // Remover " OCT 2026", " MAY 2025" etc
    name = name.replace(/\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4}/i, '');
    
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
  
  // Mostrar exemplo específico
  const gayaRecord = records.find(r => r.email?.includes('gayakat16'));
  if (gayaRecord) {
    console.log("\n📋 Exemplo (Gaya Kathiresan):");
    console.log(`  Order="${gayaRecord.order_id}" | Product="${gayaRecord.products}" | Status=${gayaRecord.order_status}`);
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
  
  const { count } = await supabase.from("ar_invoices").select("*", { count: 'exact', head: true });
  console.log(`📊 Total em ar_invoices: ${count}`);
}

syncFinal();
