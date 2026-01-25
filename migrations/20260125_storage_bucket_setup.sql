-- =====================================================
-- SETUP: Storage Bucket para Avatares
-- Execute no SQL Editor do Supabase
-- =====================================================

-- 1. Criar bucket para uploads de usuário
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'user-uploads', 
    'user-uploads', 
    true,
    2097152, -- 2MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Políticas de acesso para o bucket

-- Permitir leitura pública
DROP POLICY IF EXISTS "Avatars are publicly viewable" ON storage.objects;
CREATE POLICY "Avatars are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-uploads');

-- Permitir upload para usuários autenticados
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'user-uploads' 
    AND auth.role() = 'authenticated'
);

-- Permitir update para usuários autenticados (próprio arquivo)
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'user-uploads' 
    AND auth.role() = 'authenticated'
);

-- Permitir delete para usuários autenticados (próprio arquivo)
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'user-uploads' 
    AND auth.role() = 'authenticated'
);

-- 3. Verificação
DO $$
BEGIN
    RAISE NOTICE '✅ Bucket user-uploads configurado com sucesso!';
    RAISE NOTICE '📦 Limite: 2MB';
    RAISE NOTICE '🖼️ Formatos: JPEG, PNG, WebP, GIF';
END $$;
