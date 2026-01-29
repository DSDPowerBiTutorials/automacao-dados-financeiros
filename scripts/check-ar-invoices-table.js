require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTable() {
  console.log("🔍 Verificando se tabela ar_invoices existe...\n");
  
  // Tentar fazer um select simples
  const { data, error } = await supabase
    .from("ar_invoices")
    .select("id")
    .limit(1);
  
  if (error) {
    console.log("❌ Tabela ar_invoices NÃO existe!");
    console.log("Erro:", error.message);
    console.log("\n⚠️  AÇÃO NECESSÁRIA: Execute o SQL de migração no Supabase Dashboard");
    console.log("📄 Arquivo: /workspaces/automacao-dados-financeiros/migrations/20260129_ar_invoices_hubspot_fields.sql");
  } else {
    console.log("✅ Tabela ar_invoices existe!");
    console.log("Registros atuais:", data?.length || 0);
  }
}

checkTable();
