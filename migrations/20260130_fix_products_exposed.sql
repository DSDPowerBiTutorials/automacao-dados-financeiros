-- ============================================
-- CORREÇÃO URGENTE - TABELA PRODUCTS EXPOSTA
-- Data: 30/01/2026
-- ============================================

-- 1. Verificar RLS está habilitado (já deve estar)
ALTER TABLE
IF EXISTS products ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas permissivas antigas
DROP POLICY
IF EXISTS "Allow all" ON products;
DROP POLICY
IF EXISTS "anon_select" ON products;
DROP POLICY
IF EXISTS "anon_all" ON products;
DROP POLICY
IF EXISTS "public_select" ON products;
DROP POLICY
IF EXISTS "Enable read access for all users" ON products;
DROP POLICY
IF EXISTS "authenticated_all_products" ON products;

-- 3. Criar política APENAS para authenticated
CREATE POLICY "auth_select_products" ON products
  FOR
SELECT TO authenticated
USING
(true);
CREATE POLICY "auth_insert_products" ON products
  FOR
INSERT TO authenticated WITH CHECK (
true);
CREATE POLICY "auth_update_products" ON products
  FOR
UPDATE TO authenticated USING (true)
WITH CHECK
(true);
CREATE POLICY "auth_delete_products" ON products
  FOR
DELETE TO authenticated USING (true);

-- 4. Revogar acesso anônimo
REVOKE ALL ON products FROM anon;

-- 5. Garantir acesso para authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;

-- Verificar
SELECT
    tablename,
    policyname,
    roles
FROM pg_policies
WHERE tablename = 'products';
