require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSecurity() {
  console.log("🔒 VERIFICAÇÃO DE SEGURANÇA DO SUPABASE\n");
  
  // 1. Listar todas as tabelas públicas
  const { data: tables, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `
  });
  
  if (error) {
    // Tentar outra abordagem
    console.log("Verificando tabelas conhecidas...\n");
    
    const knownTables = [
      'csv_rows', 'csv_files', 'ar_invoices', 'invoices', 
      'providers', 'bank_accounts', 'cost_centers', 'users',
      'profiles', 'audit_logs', 'reconciliations'
    ];
    
    for (const table of knownTables) {
      const { error: testError } = await supabase.from(table).select('*').limit(1);
      if (!testError) {
        console.log(`✅ Tabela ${table} existe`);
      }
    }
  }
  
  console.log("\n📋 PROBLEMAS COMUNS DE SEGURANÇA:");
  console.log("1. RLS desabilitado em tabelas");
  console.log("2. Políticas muito permissivas (SELECT/INSERT/UPDATE/DELETE para anon)");
  console.log("3. Funções sem SECURITY DEFINER");
  console.log("4. Buckets de storage públicos");
  
  console.log("\n🔧 SOLUÇÃO:");
  console.log("Execute no Supabase Dashboard > SQL Editor:");
  console.log("");
  console.log("-- Habilitar RLS em todas as tabelas");
  console.log("ALTER TABLE csv_rows ENABLE ROW LEVEL SECURITY;");
  console.log("ALTER TABLE ar_invoices ENABLE ROW LEVEL SECURITY;");
  console.log("-- etc...");
}

checkSecurity();
