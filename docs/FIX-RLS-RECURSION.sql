-- ============================================================================
-- FIX: Corrigir políticas RLS que causam recursão infinita
-- ============================================================================
-- Execute este SQL no Supabase SQL Editor para corrigir o problema
-- ============================================================================

-- PASSO 1: Remover todas as políticas problemáticas
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- PASSO 2: Criar políticas simplificadas SEM recursão

-- Política: Permitir leitura para usuários autenticados
CREATE POLICY "Allow authenticated users to read users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- Política: Usuários podem atualizar apenas seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Política: Permitir INSERT apenas para service_role
CREATE POLICY "Service role can insert users"
  ON users FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- PASSO 3: Verificar se Jorge Marfetan está na tabela
-- ============================================================================

-- Verificar usuários existentes
SELECT id, email, name, role, company_code, is_active 
FROM users 
WHERE email = 'jmarfetan@digitalsmiledesign.com';

-- Se NÃO retornar nada, execute:
-- INSERT INTO users (id, email, name, role, company_code, department, is_active)
-- VALUES (
--   '4d90f40f-fc62-40a5-bbdb-94cac68d413f',
--   'jmarfetan@digitalsmiledesign.com',
--   'Jorge Marfetan',
--   'admin',
--   'GLOBAL',
--   'Finance',
--   true
-- );

-- ============================================================================
-- PASSO 4: Testar se funciona
-- ============================================================================

-- Deve retornar 1 linha com Jorge Marfetan
SELECT * FROM users WHERE email = 'jmarfetan@digitalsmiledesign.com';

-- ============================================================================
-- FIM
-- ============================================================================
