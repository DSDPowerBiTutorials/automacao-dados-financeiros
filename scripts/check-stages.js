require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data } = await supabase
    .from("csv_rows")
    .select("custom_data")
    .eq("source", "hubspot")
    .limit(1000);
  
  // Contar estágios únicos
  const stageCount = {};
  data?.forEach(r => {
    const stage = r.custom_data?.stage || r.custom_data?.dealstage;
    if (stage) {
      stageCount[stage] = (stageCount[stage] || 0) + 1;
    }
  });
  
  console.log("📊 Estágios encontrados (stage/dealstage):\n");
  Object.entries(stageCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([stage, count]) => {
      console.log(`  ${stage}: ${count} orders`);
    });
}

check();
