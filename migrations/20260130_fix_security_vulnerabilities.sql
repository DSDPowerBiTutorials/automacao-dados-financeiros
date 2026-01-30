-- ============================================
-- CORREÇÃO DE VULNERABILIDADES DE SEGURANÇA
-- Supabase Security Advisor - 132 erros
-- Data: 30/01/2026
-- ============================================

-- ============================================
-- 1. HABILITAR RLS EM TODAS AS TABELAS
-- ============================================

ALTER TABLE IF EXISTS csv_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS csv_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ar_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ar_financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. REMOVER POLÍTICAS ANTIGAS (se existirem)
-- ============================================

DROP POLICY IF EXISTS "Allow all" ON csv_rows;
DROP POLICY IF EXISTS "Allow all" ON csv_files;
DROP POLICY IF EXISTS "Allow all" ON ar_invoices;
DROP POLICY IF EXISTS "Allow all" ON invoices;
DROP POLICY IF EXISTS "Allow all" ON providers;
DROP POLICY IF EXISTS "Allow all" ON bank_accounts;
DROP POLICY IF EXISTS "Allow all" ON cost_centers;
DROP POLICY IF EXISTS "Allow all" ON users;
DROP POLICY IF EXISTS "Allow all" ON audit_logs;
DROP POLICY IF EXISTS "anon_select" ON csv_rows;
DROP POLICY IF EXISTS "anon_insert" ON csv_rows;
DROP POLICY IF EXISTS "anon_update" ON csv_rows;
DROP POLICY IF EXISTS "anon_delete" ON csv_rows;

-- ============================================
-- 3. CRIAR POLÍTICAS SEGURAS (apenas usuários autenticados)
-- ============================================

-- csv_rows
CREATE POLICY "authenticated_select_csv_rows" ON csv_rows
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_csv_rows" ON csv_rows
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_csv_rows" ON csv_rows
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_csv_rows" ON csv_rows
  FOR DELETE TO authenticated USING (true);

-- csv_files
CREATE POLICY "authenticated_select_csv_files" ON csv_files
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_csv_files" ON csv_files
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_csv_files" ON csv_files
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_csv_files" ON csv_files
  FOR DELETE TO authenticated USING (true);

-- ar_invoices
CREATE POLICY "authenticated_select_ar_invoices" ON ar_invoices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_ar_invoices" ON ar_invoices
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_ar_invoices" ON ar_invoices
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_ar_invoices" ON ar_invoices
  FOR DELETE TO authenticated USING (true);

-- invoices (AP)
CREATE POLICY "authenticated_select_invoices" ON invoices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_invoices" ON invoices
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_invoices" ON invoices
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_invoices" ON invoices
  FOR DELETE TO authenticated USING (true);

-- providers
CREATE POLICY "authenticated_select_providers" ON providers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_providers" ON providers
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_providers" ON providers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_providers" ON providers
  FOR DELETE TO authenticated USING (true);

-- bank_accounts
CREATE POLICY "authenticated_select_bank_accounts" ON bank_accounts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_bank_accounts" ON bank_accounts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_bank_accounts" ON bank_accounts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_bank_accounts" ON bank_accounts
  FOR DELETE TO authenticated USING (true);

-- cost_centers
CREATE POLICY "authenticated_select_cost_centers" ON cost_centers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_cost_centers" ON cost_centers
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_cost_centers" ON cost_centers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_cost_centers" ON cost_centers
  FOR DELETE TO authenticated USING (true);

-- users
CREATE POLICY "authenticated_select_users" ON users
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_users" ON users
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_users" ON users
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- audit_logs (somente leitura para usuários, insert via service role)
CREATE POLICY "authenticated_select_audit_logs" ON audit_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_insert_audit_logs" ON audit_logs
  FOR INSERT TO service_role WITH CHECK (true);

-- ============================================
-- 4. POLÍTICAS PARA TABELAS ADICIONAIS (se existirem)
-- ============================================

DO $$ 
BEGIN
  -- profiles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    EXECUTE 'CREATE POLICY "authenticated_all_profiles" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  
  -- reconciliations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reconciliations') THEN
    EXECUTE 'CREATE POLICY "authenticated_all_reconciliations" ON reconciliations FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  
  -- financial_accounts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financial_accounts') THEN
    EXECUTE 'CREATE POLICY "authenticated_all_financial_accounts" ON financial_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  
  -- ar_financial_accounts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ar_financial_accounts') THEN
    EXECUTE 'CREATE POLICY "authenticated_all_ar_financial_accounts" ON ar_financial_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  
  -- customers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    EXECUTE 'CREATE POLICY "authenticated_all_customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  
EXCEPTION WHEN duplicate_object THEN
  NULL; -- Ignora se política já existe
END $$;

-- ============================================
-- 5. REVOGAR ACESSO ANÔNIMO
-- ============================================

REVOKE ALL ON csv_rows FROM anon;
REVOKE ALL ON csv_files FROM anon;
REVOKE ALL ON ar_invoices FROM anon;
REVOKE ALL ON invoices FROM anon;
REVOKE ALL ON providers FROM anon;
REVOKE ALL ON bank_accounts FROM anon;
REVOKE ALL ON cost_centers FROM anon;
REVOKE ALL ON users FROM anon;
REVOKE ALL ON audit_logs FROM anon;

-- ============================================
-- 6. GARANTIR ACESSO A USUÁRIOS AUTENTICADOS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON csv_rows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON csv_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ar_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON providers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cost_centers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;

-- Sequences (para INSERT funcionar)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- 7. VERIFICAÇÃO FINAL
-- ============================================

SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
