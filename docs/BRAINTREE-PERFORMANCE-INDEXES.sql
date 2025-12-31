-- ================================================
-- Performance Indexes for Braintree Integration
-- ================================================
-- 
-- These indexes optimize queries for the Braintree transaction system
-- which handles 10,000+ transactions and growing.
--
-- WHEN TO RUN:
-- - After initial data sync (10K+ transactions)
-- - If queries are slow (loading times > 2 seconds)
-- - Before scaling to multiple currencies
--
-- ESTIMATED IMPACT:
-- - Query speed: 10x faster (200ms → 20ms)
-- - Page load: 70% faster
-- - Memory usage: +5-10MB (negligible)
--
-- ================================================

-- 1️⃣ Index para buscar transações por source e data
-- Usado em: loadData() em todas as páginas braintree-*
-- Query otimizada: WHERE source = 'X' ORDER BY date DESC
CREATE INDEX IF NOT EXISTS idx_csv_rows_source_date 
ON csv_rows(source, date DESC);

-- 2️⃣ Index para buscar por transaction_id (em custom_data JSONB)
-- Usado em: Verificar duplicatas, buscar por ID específico
-- Query otimizada: WHERE custom_data->>'transaction_id' = 'abc123'
CREATE INDEX IF NOT EXISTS idx_csv_rows_transaction_id 
ON csv_rows((custom_data->>'transaction_id'));

-- 3️⃣ Index para buscar transações por moeda
-- Usado em: Filtrar USD, EUR, GBP, AUD nas páginas
-- Query otimizada: WHERE custom_data->>'currency' = 'USD'
CREATE INDEX IF NOT EXISTS idx_csv_rows_currency 
ON csv_rows((custom_data->>'currency'));

-- 4️⃣ Index para buscar transações não reconciliadas
-- Usado em: Páginas de reconciliação, dashboard
-- Query otimizada: WHERE source = 'X' AND reconciled = false
CREATE INDEX IF NOT EXISTS idx_csv_rows_reconciled 
ON csv_rows(source, reconciled) 
WHERE reconciled = false;

-- 5️⃣ Index para buscar por merchant account
-- Usado em: Filtrar por conta específica (EUR, USD, etc.)
-- Query otimizada: WHERE custom_data->>'merchant_account_id' = 'digitalsmiledesignEUR'
CREATE INDEX IF NOT EXISTS idx_csv_rows_merchant_account 
ON csv_rows((custom_data->>'merchant_account_id'));

-- 6️⃣ Index composto para reconciliação bancária
-- Usado em: reconcileBankStatements() - match por data ±3 dias + valor
-- Query otimizada: WHERE source LIKE 'bankinter-%' AND date BETWEEN X AND Y
CREATE INDEX IF NOT EXISTS idx_csv_rows_bank_reconciliation 
ON csv_rows(source, date, amount) 
WHERE source LIKE 'bankinter-%' OR source LIKE 'braintree-%';

-- 7️⃣ Index para buscar disbursements
-- Usado em: Tracking de transferências bancárias
-- Query otimizada: WHERE custom_data->>'disbursement_date' IS NOT NULL
CREATE INDEX IF NOT EXISTS idx_csv_rows_disbursement_date 
ON csv_rows((custom_data->>'disbursement_date')) 
WHERE (custom_data->>'disbursement_date') IS NOT NULL;

-- ================================================
-- Statistics & Verification
-- ================================================

-- Verificar tamanho dos índices criados
SELECT 
    schemaname,
    relname AS tablename,
    indexrelname AS indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE relname = 'csv_rows'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Verificar uso dos índices (após queries)
SELECT 
    schemaname,
    relname AS tablename,
    indexrelname AS indexname,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE relname = 'csv_rows'
ORDER BY idx_scan DESC;

-- Verificar distribuição de transações por moeda
SELECT 
    custom_data->>'currency' AS currency,
    COUNT(*) AS total_transactions,
    SUM(amount::numeric) AS total_amount,
    MIN(date::date) AS first_transaction,
    MAX(date::date) AS last_transaction
FROM csv_rows
WHERE source = 'braintree-api-revenue'
GROUP BY custom_data->>'currency'
ORDER BY total_amount DESC;

-- ================================================
-- Performance Testing Queries
-- ================================================

-- Teste 1: Buscar transações EUR (deve usar idx_csv_rows_currency)
EXPLAIN ANALYZE
SELECT * 
FROM csv_rows 
WHERE custom_data->>'currency' = 'EUR' 
  AND source = 'braintree-api-revenue'
ORDER BY date DESC 
LIMIT 200;

-- Teste 2: Buscar transações não reconciliadas (deve usar idx_csv_rows_reconciled)
EXPLAIN ANALYZE
SELECT * 
FROM csv_rows 
WHERE source = 'braintree-api-revenue' 
  AND reconciled = false
ORDER BY date DESC;

-- Teste 3: Reconciliação bancária (deve usar idx_csv_rows_bank_reconciliation)
EXPLAIN ANALYZE
SELECT * 
FROM csv_rows 
WHERE source LIKE 'bankinter-%' 
  AND date BETWEEN '2024-01-01' AND '2024-12-31'
ORDER BY date DESC;

-- ================================================
-- Maintenance Queries
-- ================================================

-- Recriar índices (se houver corrupção ou performance degredada)
REINDEX TABLE csv_rows;

-- Atualizar estatísticas (para query planner otimizar)
ANALYZE csv_rows;

-- Verificar tamanho total da tabela
SELECT 
    pg_size_pretty(pg_total_relation_size('csv_rows')) AS total_size,
    pg_size_pretty(pg_relation_size('csv_rows')) AS table_size,
    pg_size_pretty(pg_total_relation_size('csv_rows') - pg_relation_size('csv_rows')) AS indexes_size;

-- ================================================
-- Expected Results (Before vs After)
-- ================================================
--
-- BEFORE INDEXES:
-- - Query time: 150-300ms (Seq Scan on csv_rows)
-- - Page load: 1-2 seconds
-- - Rows scanned: 10,000+ (full table scan)
--
-- AFTER INDEXES:
-- - Query time: 10-30ms (Index Scan)
-- - Page load: 300-500ms
-- - Rows scanned: 200 (only needed rows)
--
-- STORAGE IMPACT:
-- - Index size: ~5-10MB per index
-- - Total indexes: ~50-70MB
-- - Table size: ~30-50MB (10K rows)
-- - Total growth: ~2-3x (acceptable)
--
-- ================================================

-- 🎯 RECOMMENDED ACTIONS:
-- 1. Run these indexes on Supabase SQL Editor
-- 2. Test query performance with EXPLAIN ANALYZE
-- 3. Monitor index usage with pg_stat_user_indexes
-- 4. REINDEX if performance degrades over time
-- 5. Add more indexes as new query patterns emerge
