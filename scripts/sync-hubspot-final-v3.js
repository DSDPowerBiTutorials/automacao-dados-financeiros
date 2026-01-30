require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncFinal() {
  console.log("🔄 Sincronizando HubSpot com filtros FINAIS v3...\n");
  
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
  
  // 4. FILTROS DE QUALIDADE - Apenas invoices reais
  validOrders = validOrders.filter(order => {
    const cd = order.custom_data || {};
    const dealname = cd.dealname || "";
    const orderCode = cd.order_code || "";
    
    // ❌ EXCLUIR: ecommerce_deal = false (não é transação e-commerce)
    if (cd.ecommerce_deal === false || cd.ecommerce_deal === "false") {
      return false;
    }
    
    // ❌ EXCLUIR: Deals de teste (dealname ou order_code começa com TEST_)
    if (dealname.startsWith('TEST_') || orderCode.startsWith('TEST_')) {
      return false;
    }
    
    // ❌ EXCLUIR: Checkout pending, Win Back Strategy, Contact Us (sem product_name diferente)
    const excludePatterns = [
      /^checkout pending/i,
      /^win back strategy/i,
      /^contact us courses/i,
    ];
    for (const pattern of excludePatterns) {
      if (pattern.test(dealname)) {
        if (!cd.product_name || cd.product_name === dealname) {
          return false;
        }
      }
    }
    
    return true;
  });
  
  console.log(`📊 Após filtros de qualidade: ${validOrders.length}`);
  
  // 5. Preparar registros
  const mapStatus = (paidStatus) => {
    if (!paidStatus) return "pending";
    const status = paidStatus.toLowerCase();
    if (status === "paid" || status.includes("paid")) return "paid";
    if (status === "partial") return "partial";
    return "pending";
  };
  
  const extractOrderCode = (orderCode, dealname) => {
    if (orderCode && /^[a-f0-9]{7,8}$/i.test(orderCode)) return orderCode;
    if (orderCode && orderCode.startsWith('TEST_')) return orderCode;
    const hashMatch = dealname?.match(/\b([a-f0-9]{7,8})\b/i);
    if (hashMatch) return hashMatch[1];
    return null;
  };
  
  const extractProductName = (cd) => {
    if (cd.product_name && cd.product_name !== cd.dealname && cd.product_name !== cd.order_code) {
      return cd.product_name;
    }
    let name = cd.dealname || "";
    if (/^[a-f0-9]{7,8}$/i.test(name)) return cd.product_name || name;
    name = name.replace(/^(PM|TA|WIN BACK STRATEGY|CHECKOUT PENDING|CONTACT US COURSES)\s*-?\s*/i, '');
    name = name.replace(/\s+-\s+[A-Za-z\s]+\s+-\s+[a-f0-9]{7,8}$/i, '');
    name = name.replace(/\s+-\s+[^\s]+@[^\s]+\s*(ROW|AMEX|APAC)?$/i, '');
    name = name.replace(/\s+-\s+[a-f0-9]{7,8}$/i, '');
    name = name.replace(/\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4}/i, '');
    return name.trim() || cd.product_name || null;
  };
  
  const records = validOrders.map((order) => {
    const cd = order.custom_data || {};
    const shortId = String(order.id).replace(/-/g, '').slice(0, 12).toUpperCase();
    
    return {
      invoice_number: `HS-${shortId}`,
      order_id: extractOrderCode(cd.order_code, cd.dealname),
      order_date: cd.date_ordered || order.date || null,
      order_status: cd.paid_status || null,
      invoice_date: cd.date_paid || cd.date_ordered || order.date,
      products: extractProductName(cd),
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
  
  // Verificar se as invoices problemáticas foram removidas
  const testInv = records.find(r => r.invoice_number === 'HS-D134E29F9500');
  const ralfInv = records.find(r => r.email === 'info@zahnarztpraxis-lauenstein.de');
  console.log(`\n🔍 Verificação:`);
  console.log(`  Invoice TEST_ (HS-D134E29F9500): ${testInv ? '❌ AINDA PRESENTE' : '✅ REMOVIDA'}`);
  console.log(`  Invoice Ralf (ecommerce=false): ${ralfInv ? '❌ AINDA PRESENTE' : '✅ REMOVIDA'}`);
  
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
