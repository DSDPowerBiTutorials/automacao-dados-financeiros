require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function apply() {
  console.log("🔧 Aplicando migration: adicionar coluna deal_status...");
  
  const { error } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS deal_status TEXT;`
  });
  
  if (error) {
    // Tentar via query direta
    const { error: error2 } = await supabase
      .from('ar_invoices')
      .select('deal_status')
      .limit(1);
    
    if (error2?.message?.includes('does not exist')) {
      console.log("❌ Coluna não existe. Execute a migration manualmente no Supabase:");
      console.log("\n   ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS deal_status TEXT;\n");
    } else if (!error2) {
      console.log("✅ Coluna deal_status já existe!");
    } else {
      console.log("❌ Erro:", error2.message);
    }
  } else {
    console.log("✅ Coluna deal_status adicionada com sucesso!");
  }
}

apply();
