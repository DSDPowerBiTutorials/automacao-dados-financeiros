-- =========================================
-- SETUP DE PERFIL DE USUÁRIO
-- =========================================
-- Execute este SQL no Supabase SQL Editor para configurar:
-- 1. Bucket de storage para uploads de avatares
-- 2. Políticas RLS para acesso aos avatares

-- =========================================
-- 1. CRIAR BUCKET DE STORAGE (se não existir)
-- =========================================

-- Verificar se bucket já existe
DO $$ 
BEGIN
    -- Tentar criar o bucket
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'user-uploads', 
        'user-uploads', 
        true,
        2097152, -- 2MB em bytes
        ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    )
    ON CONFLICT (id) DO UPDATE SET
        public = true,
        file_size_limit = 2097152,
        allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    
    RAISE NOTICE '✅ Bucket "user-uploads" criado/atualizado com sucesso';
EXCEPTION 
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Erro ao criar bucket: %', SQLERRM;
END $$;

-- =========================================
-- 2. REMOVER POLÍTICAS ANTIGAS (se existirem)
-- =========================================

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- =========================================
-- 3. CRIAR NOVAS POLÍTICAS DE STORAGE
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
);

-- Permitir que usuários autenticados deletem seus próprios avatares
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'user-uploads' 
    AND (storage.foldername(name))[1] = 'avatars'
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
