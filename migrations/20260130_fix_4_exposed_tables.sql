-- ============================================
-- CORREÇÃO URGENTE - 4 TABELAS EXPOSTAS
-- products, invoice_history, product_merges, sub_departments
-- Data: 30/01/2026
-- ============================================

-- ============================================
-- 1. PRODUCTS
-- ============================================
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Allow all" ON products;
DROP POLICY IF EXISTS "anon_select" ON products;
DROP POLICY IF EXISTS "anon_all" ON products;
DROP POLICY IF EXISTS "public_select" ON products;
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "authenticated_all_products" ON products;

-- Criar políticas seguras
CREATE POLICY "auth_select_products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_products" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_products" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_products" ON products FOR DELETE TO authenticated USING (true);

REVOKE ALL ON products FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;

-- ============================================
-- 2. INVOICE_HISTORY
-- ============================================
ALTER TABLE IF EXISTS invoice_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON invoice_history;
DROP POLICY IF EXISTS "anon_select" ON invoice_history;
DROP POLICY IF EXISTS "Enable read access for all users" ON invoice_history;
DROP POLICY IF EXISTS "authenticated_all_invoice_history" ON invoice_history;

CREATE POLICY "auth_select_invoice_history" ON invoice_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_invoice_history" ON invoice_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_invoice_history" ON invoice_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_invoice_history" ON invoice_history FOR DELETE TO authenticated USING (true);

REVOKE ALL ON invoice_history FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_history TO authenticated;

-- ============================================
-- 3. PRODUCT_MERGES
-- ============================================
ALTER TABLE IF EXISTS product_merges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON product_merges;
DROP POLICY IF EXISTS "anon_select" ON product_merges;
DROP POLICY IF EXISTS "Enable read access for all users" ON product_merges;
DROP POLICY IF EXISTS "authenticated_all_product_merges" ON product_merges;

CREATE POLICY "auth_select_product_merges" ON product_merges FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_product_merges" ON product_merges FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_product_merges" ON product_merges FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_product_merges" ON product_merges FOR DELETE TO authenticated USING (true);

REVOKE ALL ON product_merges FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_merges TO authenticated;

-- ============================================
-- 4. SUB_DEPARTMENTS
-- ============================================
ALTER TABLE IF EXISTS sub_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON sub_departments;
DROP POLICY IF EXISTS "anon_select" ON sub_departments;
DROP POLICY IF EXISTS "Enable read access for all users" ON sub_departments;
DROP POLICY IF EXISTS "authenticated_all_sub_departments" ON sub_departments;

CREATE POLICY "auth_select_sub_departments" ON sub_departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_sub_departments" ON sub_departments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_sub_departments" ON sub_departments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_sub_departments" ON sub_departments FOR DELETE TO authenticated USING (true);

REVOKE ALL ON sub_departments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON sub_departments TO authenticated;

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================
SELECT 
  tablename,
  policyname,
  roles
FROM pg_policies 
WHERE tablename IN ('products', 'invoice_history', 'product_merges', 'sub_departments')
ORDER BY tablename, policyname;
