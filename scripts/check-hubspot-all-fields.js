require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Buscar a order c7599a2 no hubspot
  const { data } = await supabase
    .from("csv_rows")
    .select("*")
    .eq("source", "hubspot")
    .ilike("custom_data->>order_code", "%c7599a2%");
  
  if (data?.[0]) {
    console.log("📊 Order c7599a2 - TODOS OS CAMPOS:\n");
    
    // Campos do registro principal
    console.log("CAMPOS PRINCIPAIS:");
    Object.keys(data[0]).forEach(k => {
      if (k !== 'custom_data') {
        console.log(`  ${k}: ${data[0][k]}`);
      }
    });
    
    // Campos do custom_data
    console.log("\nCAMPOS CUSTOM_DATA (ordenados):");
    const cd = data[0].custom_data;
    Object.keys(cd).sort().forEach(k => {
      console.log(`  ${k}: ${cd[k]}`);
    });
    
    // Verificar se há campos que parecem relacionados a faturamento
    console.log("\n\n🔍 ANÁLISE:");
    console.log("- date_ordered (Order Date): 21/11/2025");
    console.log("- date_paid: null (não foi pago totalmente)");
    console.log("- A 'Invoice Date' de 03/12/2025 NÃO está no HubSpot");
    console.log("\n💡 OPÇÕES:");
    console.log("1. O Invoice Date vem de transações de pagamento (Braintree/Stripe)");
    console.log("2. O Invoice Date é calculado/definido em outro sistema");
    console.log("3. Precisamos acessar o datawarehouse que gera o report");
  }
}

check();
