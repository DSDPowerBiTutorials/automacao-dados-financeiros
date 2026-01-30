-- Migration: Criar índice único para source_id em ar_invoices
-- Isso permite usar upsert e evita erro 409 de conflito

-- Criar índice único (só onde source_id não é null)
CREATE UNIQUE INDEX
IF NOT EXISTS ar_invoices_source_id_unique 
ON ar_invoices
(source_id) 
WHERE source_id IS NOT NULL;

-- Adicionar comentário explicativo
COMMENT ON INDEX ar_invoices_source_id_unique IS 'Índice único para evitar duplicatas de source_id';
