-- ============================================================================
-- Atualizar Avatar do Jorge Marfetan
-- ============================================================================
-- Execute este SQL no Supabase SQL Editor
-- ============================================================================

-- Atualizar o perfil do Jorge Marfetan com o avatar
UPDATE users
SET 
  avatar_url = '/avatars/jorge-marfetan.jpg',
  updated_at = CURRENT_TIMESTAMP
WHERE email = 'jmarfetan@digitalsmiledesign.com';

-- Verificar se foi atualizado
SELECT 
  id,
  name,
  email,
  role,
  avatar_url,
  company_code,
  department,
  updated_at
FROM users
WHERE email = 'jmarfetan@digitalsmiledesign.com';

-- ============================================================================
-- NOTA: Você precisa fazer upload da imagem para o Supabase Storage
-- ============================================================================
-- 
-- Opção 1: Via Supabase Dashboard
-- 1. Vá em Storage → Buckets
-- 2. Crie um bucket público chamado "avatars" (se não existir)
-- 3. Faça upload da imagem jorge-marfetan.jpg
-- 4. Copie a URL pública
-- 5. Atualize a coluna avatar_url com a URL completa
--
-- Opção 2: Usar arquivo local (desenvolvimento)
-- 1. Copie a imagem para: public/avatars/jorge-marfetan.jpg
-- 2. O URL relativo /avatars/jorge-marfetan.jpg vai funcionar
-- 3. Em produção, mova para Supabase Storage
--
-- ============================================================================
