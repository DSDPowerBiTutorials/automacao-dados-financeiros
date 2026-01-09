-- =====================================================
-- FIX: Adicionar coluna last_sync_error faltante
-- Execute no Supabase SQL Editor
-- =====================================================

-- Adicionar coluna last_sync_error se não existir
ALTER TABLE sync_metadata 
ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

-- Se você tinha last_error e quer migrar os dados:
UPDATE sync_metadata 
SET last_sync_error = last_error 
WHERE last_error IS NOT NULL 
  AND (last_sync_error IS NULL OR last_sync_error = '');

-- Verificar estrutura atual da tabela
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sync_metadata'
ORDER BY ordinal_position;
