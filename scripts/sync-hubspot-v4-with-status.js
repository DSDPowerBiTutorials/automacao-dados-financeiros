require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mapeamento de IDs de estágio para nomes do backend
// Valores possíveis: New, Shipped, Cancelled, Failed Payment, Outstanding Payment, Credit Order, High Value, Subscription Plan
const STAGE_MAPPING = {
  // E-commerce pipeline
  'checkout_completed': 'Shipped',
  'checkout_pending': 'Outstanding Payment',
  'cancelled': 'Cancelled',
  'closedwon': 'Shipped',
  'presentationscheduled': 'New',
  
  // Sales pipeline - Main stages (baseado em análise de paid_status)
  '108197790': 'New',              // Maioria pago mas misturado - vamos determinar dinamicamente
  '108197794': 'Shipped',          // Maioria pago
  '206173276': 'Shipped',          // Todos paid
  '1031801652': 'Credit Order',    // Todos unpaid, não closed won - CONFIRMADO
  '1031823104': 'Outstanding Payment',
  
  // Qualification/Sales stages
  '1203581030': 'New',
  '1203581031': 'New', 
  '1203581032': 'New',
  '1203581033': 'New',
  '1203581035': 'Shipped',
  '1203581036': 'Cancelled',
  
  // Provider stages
  '1067293738': 'Subscription Plan',
  '1065782346': 'Subscription Plan',
  '1065782348': 'Outstanding Payment',
  '1065782349': 'Cancelled',
  '1065782350': 'Subscription Plan',
  
  // Lab stages
  '1026647932': 'New',
  '1026592320': 'Shipped',
  
  // Other
  '22796161': 'New',
};

// Determinar status dinamicamente baseado em stage + paid_status
function getDealStatus(stageId, paidStatus, hsClosedWon) {
  if (!stageId) return null;
  
  const stage = stageId.toString();
  const paid = (paidStatus || '').toLowerCase();
  
  // Cancelados
  if (stage === 'cancelled' || stage === '1203581036' || stage === '1065782349') {
    return 'Cancelled';
  }
  
  // Credit Order - stage específico
  if (stage === '1031801652') {
    return 'Credit Order';
  }
  
  // Checkout completed = Shipped
  if (stage === 'checkout_completed' || stage === 'closedwon') {
    return 'Shipped';
  }
  
  // Checkout pending ou outstanding
  if (stage === 'checkout_pending' || stage === '1031823104' || stage === '1065782348') {
    return 'Outstanding Payment';
  }
  
  // Subscription stages
  if (stage === '1067293738' || stage === '1065782346' || stage === '1065782350') {
    return 'Subscription Plan';
  }
  
  // Para estágios genéricos, determinar baseado em paid_status
  if (paid === 'paid') {
    return 'Shipped';
  } else if (paid === 'partial') {
    return 'Outstanding Payment';
  } else if (paid === 'unpaid') {
    // Se não closed won e unpaid, pode ser Credit Order ou Outstanding Payment
    if (hsClosedWon === false) {
      return 'Credit Order';
    }
    return 'Outstanding Payment';
  }
  
  // Fallback para o mapeamento estático
  return STAGE_MAPPING[stage] || 'New';
}

async function syncFinal() {
  console.log("🔄 Sincronizando HubSpot v4 (com deal_status corrigido)...\n");
  
  // Verificar se coluna existe
  const { data: testData, error: testError } = await supabase
    .from("ar_invoices")
    .select("deal_status")
    .limit(1);
  
  if (testError?.message?.includes('does not exist')) {
    console.log("❌ Coluna deal_status não existe! Execute no Supabase:");
    console.log("\n   ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS deal_status TEXT;\n");
    return;
  }
  
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
  
  // 4. FILTROS DE QUALIDADE
  validOrders = validOrders.filter(order => {
    const cd = order.custom_data || {};
    const dealname = cd.dealname || "";
    const orderCode = cd.order_code || "";
    
    if (cd.ecommerce_deal === false || cd.ecommerce_deal === "false") return false;
    if (dealname.startsWith('TEST_') || orderCode.startsWith('TEST_')) return false;
    
    const excludePatterns = [/^checkout pending/i, /^win back strategy/i, /^contact us courses/i];
    for (const pattern of excludePatterns) {
      if (pattern.test(dealname) && (!cd.product_name || cd.product_name === dealname)) return false;
    }
    
    return true;
  });
  
  console.log(`📊 Após filtros de qualidade: ${validOrders.length}`);
  
  // 5. Funções auxiliares
  const mapStatus = (paidStatus) => {
    if (!paidStatus) return "pending";
    const status = paidStatus.toLowerCase();
    if (status === "paid" || status.includes("paid")) return "paid";
    if (status === "partial") return "partial";
    return "pending";
  };
  
  const extractOrderCode = (orderCode, dealname) => {
    if (orderCode && /^[a-f0-9]{7,8}$/i.test(orderCode)) return orderCode;
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
  
  // 6. Preparar registros
  const records = validOrders.map((order) => {
    const cd = order.custom_data || {};
    const shortId = String(order.id).replace(/-/g, '').slice(0, 12).toUpperCase();
    const stageId = cd.stage || cd.dealstage;
    
    return {
      invoice_number: `HS-${shortId}`,
      order_id: extractOrderCode(cd.order_code, cd.dealname),
      order_date: cd.date_ordered || order.date || null,
      order_status: cd.paid_status || null,  // Paid Status (Paid/Unpaid/Partial)
      deal_status: getDealStatus(stageId, cd.paid_status, cd.hs_is_closed_won),  // Status (Credit Order, Shipped, etc.)
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
  
  // Verificar deal_status da Kristen Donohue (deveria ser Credit Order - Unpaid)
  const kristen = records.find(r => r.email === 'donohue.kristen@gmail.com');
  console.log(`\n🔍 Verificação Kristen Donohue:`);
  console.log(`   order_status (Paid Status): ${kristen?.order_status || 'N/A'}`);
  console.log(`   deal_status (Status): ${kristen?.deal_status || 'N/A'}`);
  
  // Estatísticas de deal_status
  const statusCounts = {};
  records.forEach(r => {
    const s = r.deal_status || 'null';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  console.log(`\n📊 Distribuição de deal_status:`);
  Object.entries(statusCounts).sort((a,b) => b[1]-a[1]).forEach(([s, c]) => {
    console.log(`   ${s}: ${c}`);
  });
  
  // 7. Inserir em batches
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error: insertError } = await supabase.from("ar_invoices").insert(batch);
    
    if (insertError) {
      console.log(`❌ Erro no batch ${i}:`, insertError.message);
      if (insertError.message.includes('deal_status')) {
        console.log("\n⚠️  Execute no Supabase SQL Editor:");
        console.log("   ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS deal_status TEXT;");
        return;
      }
    } else {
      inserted += batch.length;
    }
  }
  
  console.log(`\n🎉 CONCLUÍDO! ${inserted} registros sincronizados.`);
}

syncFinal();
