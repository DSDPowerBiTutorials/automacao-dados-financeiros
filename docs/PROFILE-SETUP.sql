-- =========================================
-- SETUP DE PERFIL DE USUÁRIO
-- =========================================
-- Execute este SQL no Supabase SQL Editor para configurar:
-- 1. Bucket de storage para uploads de avatares
-- 2. Políticas RLS para acesso aos avatares

-- =========================================
-- 1. CRIAR BUCKET DE STORAGE (se não existir)
-- =========================================

-- Criar bucket para uploads de usuários (avatares, etc)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-uploads', 'user-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- 2. POLÍTICAS DE STORAGE
-- =========================================

-- Permitir que usuários autenticados façam upload de avatares
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'user-uploads' 
    AND (storage.foldername(name))[1] = 'avatars'
);

-- Permitir que usuários autenticados atualizem seus próprios avatares
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'user-uploads' 
    AND (storage.foldername(name))[1] = 'avatars'
    AND auth.uid()::text = (string_to_array(name, '-'))[1]
);

-- Permitir que usuários autenticados deletem seus próprios avatares
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'user-uploads' 
    AND (storage.foldername(name))[1] = 'avatars'
    AND auth.uid()::text = (string_to_array(name, '-'))[1]
);

-- Permitir que todos vejam avatares (leitura pública)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = 'avatars');

-- =========================================
-- 3. ADICIONAR CAMPOS NO users TABLE (se não existir)
-- =========================================

-- Adicionar campos de perfil à tabela users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Criar índice para otimizar queries por avatar_url
CREATE INDEX IF NOT EXISTS idx_users_avatar_url ON users(avatar_url) WHERE avatar_url IS NOT NULL;

-- =========================================
-- 4. VERIFICAR SETUP
-- =========================================

-- Verificar se o bucket foi criado
SELECT * FROM storage.buckets WHERE name = 'user-uploads';

-- Verificar políticas do bucket
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%avatar%';

-- Verificar estrutura da tabela users
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('avatar_url', 'department', 'phone');

-- =========================================
-- ✅ SETUP COMPLETO
-- =========================================
-- Após executar este script:
-- 1. Usuários podem fazer upload de avatares em /profile
-- 2. Avatares são públicos (qualquer um pode ver)
-- 3. Apenas o dono pode atualizar/deletar seu avatar
-- 4. Tamanho máximo: 2MB (validado no código)
-- 5. Formatos aceitos: JPEG, PNG, WebP, GIF
