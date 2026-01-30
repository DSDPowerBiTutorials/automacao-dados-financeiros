require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findMapping() {
  const { data } = await supabase
    .from("csv_rows")
    .select("custom_data")
    .eq("source", "hubspot")
    .limit(1000);
  
  // Agrupar por stage e analisar padrões
  const stageAnalysis = {};
  
  data?.forEach(r => {
    const cd = r.custom_data || {};
    const stage = cd.stage || cd.dealstage;
    if (!stage) return;
    
    if (!stageAnalysis[stage]) {
      stageAnalysis[stage] = {
        count: 0,
        paidStatus: {},
        hsClosed: { true: 0, false: 0 },
        hsClosedWon: { true: 0, false: 0 },
        hasPayment: 0,
        examples: []
      };
    }
    
    const s = stageAnalysis[stage];
    s.count++;
    
    // Paid status
    const ps = cd.paid_status || 'null';
    s.paidStatus[ps] = (s.paidStatus[ps] || 0) + 1;
    
    // hs_is_closed
    if (cd.hs_is_closed === true) s.hsClosed.true++;
    else s.hsClosed.false++;
    
    // hs_is_closed_won
    if (cd.hs_is_closed_won === true) s.hsClosedWon.true++;
    else s.hsClosedWon.false++;
    
    // Has payment
    if (cd.total_payment > 0) s.hasPayment++;
    
    // Examples (primeiros 2)
    if (s.examples.length < 2) {
      s.examples.push({
        dealname: cd.dealname,
        paid_status: cd.paid_status,
        total_payment: cd.total_payment,
        final_price: cd.final_price
      });
    }
  });
  
  console.log("📊 ANÁLISE DE ESTÁGIOS DO HUBSPOT:\n");
  console.log("Legenda: count | paid_status | closed_won | tem_pagamento\n");
  
  Object.entries(stageAnalysis)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([stage, s]) => {
      console.log(`\n🔹 Stage: ${stage} (${s.count} orders)`);
      console.log(`   Paid Status: ${JSON.stringify(s.paidStatus)}`);
      console.log(`   Closed Won: ${s.hsClosedWon.true} / ${s.count}`);
      console.log(`   Com Pagamento: ${s.hasPayment} / ${s.count}`);
      
      // Inferir nome baseado nos padrões
      let inferredName = "Unknown";
      const paidCount = s.paidStatus['Paid'] || 0;
      const unpaidCount = s.paidStatus['Unpaid'] || 0;
      const partialCount = s.paidStatus['Partial'] || 0;
      
      if (stage === 'checkout_completed') {
        inferredName = "Checkout Completed";
      } else if (stage === 'checkout_pending') {
        inferredName = "Checkout Pending";
      } else if (stage === 'cancelled') {
        inferredName = "Cancelled";
      } else if (stage === 'closedwon') {
        inferredName = "Closed Won";
      } else if (unpaidCount > paidCount && unpaidCount > partialCount) {
        if (s.hsClosedWon.false > s.hsClosedWon.true) {
          inferredName = "Credit Order (Unpaid/Not Won)";
        } else {
          inferredName = "Pending Payment";
        }
      } else if (paidCount > unpaidCount) {
        inferredName = "Paid Order";
      } else if (partialCount > 0) {
        inferredName = "Partial Payment";
      }
      
      console.log(`   ➡️  Inferido: ${inferredName}`);
      console.log(`   Exemplos: ${s.examples.map(e => e.dealname).join(', ')}`);
    });
}

findMapping();
