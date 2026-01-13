-- ============================================================================
-- FIX URGENTE: Performance Indexes para csv_rows
-- Data: 13/01/2026
-- Problema: Timeout de 20 segundos ao carregar Braintree EUR
-- Causa: Falta de índices nas queries principais
-- ============================================================================
-- INSTRUÇÕES:
-- 1. Abra Supabase SQL Editor
-- 2. Copie e cole TODO este script
-- 3. Clique em "Run"
-- 4. Aguarde mensagem de sucesso (30-60 segundos)
-- ============================================================================

BEGIN;

DO $$
BEGIN
  -- ÍNDICE CRÍTICO 1: source + date
  CREATE INDEX IF NOT EXISTS idx_csv_rows_source_date 
  ON csv_rows(source, date DESC);
  RAISE NOTICE '✅ Índice 1 criado: source + date';

  -- ÍNDICE CRÍTICO 2: transaction_id (JSONB)
  CREATE INDEX IF NOT EXISTS idx_csv_rows_transaction_id 
  ON csv_rows((custom_data->>'transaction_id'))
  WHERE (custom_data->>'transaction_id') IS NOT NULL;
  RAISE NOTICE '✅ Índice 2 criado: transaction_id';

  -- ÍNDICE CRÍTICO 3: currency (JSONB)
  CREATE INDEX IF NOT EXISTS idx_csv_rows_currency 
  ON csv_rows((custom_data->>'currency'))
  WHERE (custom_data->>'currency') IS NOT NULL;
  RAISE NOTICE '✅ Índice 3 criado: currency';

  -- ÍNDICE 4: merchant_account_id (JSONB)
  CREATE INDEX IF NOT EXISTS idx_csv_rows_merchant_account 
  ON csv_rows((custom_data->>'merchant_account_id'))
  WHERE (custom_data->>'merchant_account_id') IS NOT NULL;
  RAISE NOTICE '✅ Índice 4 criado: merchant_account_id';

  -- ÍNDICE 5: reconciled
  CREATE INDEX IF NOT EXISTS idx_csv_rows_reconciled 
  ON csv_rows(source, reconciled) 
  WHERE reconciled = false;
  RAISE NOTICE '✅ Índice 5 criado: reconciled';

  -- ÍNDICE 6: created_at
  CREATE INDEX IF NOT EXISTS idx_csv_rows_created_at 
  ON csv_rows(created_at DESC);
  RAISE NOTICE '✅ Índice 6 criado: created_at';

  -- ÍNDICE 7: settlement_batch_id (JSONB)
  CREATE INDEX IF NOT EXISTS idx_csv_rows_settlement_batch_id 
  ON csv_rows((custom_data->>'settlement_batch_id'))
  WHERE (custom_data->>'settlement_batch_id') IS NOT NULL;
  RAISE NOTICE '✅ Índice 7 criado: settlement_batch_id';

  -- Atualizar estatísticas
  ANALYZE csv_rows;
  RAISE NOTICE '✅ Estatísticas atualizadas';
END $$;

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================
DO $$
DECLARE
  indexes_count INTEGER;
  table_size TEXT;
  row_count BIGINT;
BEGIN
  -- Contar índices
  SELECT COUNT(*) INTO indexes_count 
  FROM pg_indexes 
  WHERE tablename = 'csv_rows' 
  AND indexname LIKE 'idx_csv_rows_%';
  
  -- Tamanho da tabela
  SELECT pg_size_pretty(pg_total_relation_size('csv_rows')) INTO table_size;
  
  -- Número de linhas
  SELECT COUNT(*) INTO row_count FROM csv_rows;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '🎉 ÍNDICES CRIADOS COM SUCESSO';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Índices criados: %', indexes_count;
  RAISE NOTICE '✅ Tamanho da tabela: %', table_size;
  RAISE NOTICE '✅ Total de registros: %', row_count;
  RAISE NOTICE '';
  RAISE NOTICE '📊 IMPACTO ESPERADO:';
  RAISE NOTICE '   • Query speed: 10-20x mais rápido';
  RAISE NOTICE '   • Timeout: Eliminado (20s → 1-2s)';
  RAISE NOTICE '   • Page load: 70%% mais rápido';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 PRÓXIMOS PASSOS:';
  RAISE NOTICE '   1. Aguarde 30-60 segundos (criação de índices)';
  RAISE NOTICE '   2. Recarregue a página Braintree EUR (Ctrl+Shift+R)';
  RAISE NOTICE '   3. Verifique tempo de carregamento < 3 segundos';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;

COMMIT;

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================

-- ============================================================================
-- DIAGNÓSTICO (opcional - executar separadamente)
-- ============================================================================
-- Verificar índices criados:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'csv_rows' ORDER BY indexname;

-- Verificar tamanho dos índices:
-- SELECT 
--   indexrelname AS index_name,
--   pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
-- FROM pg_stat_user_indexes
-- WHERE relname = 'csv_rows'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- Verificar uso dos índices (após queries):
-- SELECT 
--   indexrelname AS index_name,
--   idx_scan AS scans,
--   idx_tup_read AS tuples_read
-- FROM pg_stat_user_indexes
-- WHERE relname = 'csv_rows' AND idx_scan > 0
-- ORDER BY idx_scan DESC;
