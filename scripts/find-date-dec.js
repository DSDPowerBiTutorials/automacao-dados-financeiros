require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data } = await supabase
    .from("csv_rows")
    .select("*")
    .eq("source", "hubspot")
    .ilike("custom_data->>order_code", "%c7599a2%");
  
  if (data?.[0]) {
    const cd = data[0].custom_data;
    console.log("📊 Buscando campos com data de dezembro (12/2025):\n");
    
    // Verificar TODOS os campos
    Object.keys(cd).forEach(k => {
      const val = cd[k];
      if (val) {
        const valStr = String(val);
        // Procurar por datas de dezembro 2025
        if (valStr.includes('2025-12') || valStr.includes('12/2025') || valStr.includes('Dec 2025')) {
          console.log(`  ✅ ${k}: ${val}`);
        }
      }
    });
    
    // Também verificar campos no nível do registro
    console.log("\n📊 Campos do registro principal:");
    Object.keys(data[0]).forEach(k => {
      if (k !== 'custom_data') {
        const val = data[0][k];
        if (val) {
          const valStr = String(val);
          if (valStr.includes('2025-12') || valStr.includes('12/2025')) {
            console.log(`  ✅ ${k}: ${val}`);
          }
        }
      }
    });
    
    // Listar TODOS os campos com valores de data
    console.log("\n📊 TODOS os campos com formato de data:");
    Object.keys(cd).forEach(k => {
      const val = cd[k];
      if (val && /\d{4}-\d{2}-\d{2}/.test(String(val))) {
        console.log(`  ${k}: ${val}`);
      }
    });
  }
}

check();
