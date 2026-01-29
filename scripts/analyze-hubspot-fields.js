require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyze() {
  console.log("🔍 Analisando estrutura dos dados HubSpot...\n");
  
  const { data } = await supabase
    .from("csv_rows")
    .select("*")
    .eq("source", "hubspot")
    .limit(10);
  
  // Analisar um registro completo
  const sample = data[0];
  const cd = sample.custom_data;
  
  console.log("📋 CAMPOS DISPONÍVEIS NO custom_data:\n");
  
  // Agrupar campos por categoria
  const fields = {
    "ORDER/DEAL": ["deal_id", "dealname", "order_code", "ecomm_order_number", "website_order_id", "reference"],
    "PRODUTO": ["product_name", "product_id", "product_sku", "product_description", "product_amount", "product_quantity"],
    "CLIENTE": ["customer_firstname", "customer_lastname", "customer_email", "customer_phone", "customer_address"],
    "EMPRESA": ["company", "company_name", "company_domain"],
    "DATAS": ["date_ordered", "date_paid", "createdate", "hs_closed_won_date"],
    "VALORES": ["total_price", "final_price", "total_payment", "discount_amount", "tax_amount"],
    "STATUS": ["paid_status", "dealstage", "status", "hs_is_closed", "hs_is_closed_won"],
    "PAGAMENTO": ["gateway_name", "coupon_code"]
  };
  
  for (const [category, keys] of Object.entries(fields)) {
    console.log(`\n=== ${category} ===`);
    for (const key of keys) {
      const value = cd[key];
      if (value !== undefined && value !== null && value !== "") {
        console.log(`  ${key}: "${value}"`);
      }
    }
  }
  
  console.log("\n\n📊 EXEMPLOS DE 5 REGISTROS:");
  for (const row of data.slice(0, 5)) {
    const c = row.custom_data;
    console.log("\n---");
    console.log(`  deal_id: ${c.deal_id}`);
    console.log(`  dealname: ${c.dealname}`);
    console.log(`  order_code: ${c.order_code}`);
    console.log(`  product_name: ${c.product_name}`);
    console.log(`  date_ordered: ${c.date_ordered}`);
    console.log(`  date_paid: ${c.date_paid}`);
    console.log(`  paid_status: ${c.paid_status}`);
  }
}

analyze();
