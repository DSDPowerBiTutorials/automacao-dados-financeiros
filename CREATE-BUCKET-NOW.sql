-- ==========================================
-- EXECUTE ESTE SQL NO SUPABASE AGORA
-- ==========================================

-- 1. Criar bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'user-uploads', 
    'user-uploads', 
    true,
    2097152,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- 3. Criar políticas
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = 'avatars');

CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = 'avatars');

CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = 'avatars');

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = 'avatars');

-- 4. Verificar
SELECT 'Bucket criado:' as status, COUNT(*) as count FROM storage.buckets WHERE name = 'user-uploads';
SELECT 'Políticas criadas:' as status, COUNT(*) as count FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%avatar%';
