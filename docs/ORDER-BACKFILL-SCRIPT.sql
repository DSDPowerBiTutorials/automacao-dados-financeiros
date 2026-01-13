-- Script: Backfill automático de order_id via HubSpot links
-- Execução: Via API POST /api/order-mapping/backfill

-- 📊 ESTATÍSTICAS ANTES DO BACKFILL
-- Ver quantas transações precisam de mapeamento
SELECT 
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN custom_data->>'order_id' IS NULL THEN 1 END) as unmapped,
  COUNT(CASE WHEN custom_data->>'order_id' IS NOT NULL THEN 1 END) as has_order_id,
  ROUND(100.0 * COUNT(CASE WHEN custom_data->>'order_id' IS NOT NULL THEN 1 END) / COUNT(*), 2) as coverage_percent
FROM csv_rows
WHERE source = 'braintree-api-revenue';

-- 🔍 PREVIEW: Quantos podem ser linkados via HubSpot?
SELECT COUNT(*) as can_be_linked
FROM csv_rows cr
WHERE cr.source = 'braintree-api-revenue'
  AND cr.custom_data->>'order_id' IS NULL
  AND EXISTS (
    SELECT 1 FROM braintree_hubspot_order_links bh
    WHERE bh.braintree_transaction_id = cr.custom_data->>'transaction_id'
      AND bh.hubspot_order_code IS NOT NULL
  );

-- 🚀 EXECUTAR BACKFILL
-- 1. DRY RUN (testar sem salvar)
/*
POST /api/order-mapping/backfill
{
  "dry_run": true,
  "limit": 100
}
*/

-- 2. EXECUTAR REAL (criar mapeamentos)
/*
POST /api/order-mapping/backfill
{
  "dry_run": false,
  "limit": 1000
}
*/

-- ✅ VALIDAR RESULTADOS
-- Ver mapeamentos criados pelo backfill
SELECT 
  source,
  COUNT(*) as count,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM order_transaction_mapping
GROUP BY source
ORDER BY count DESC;

-- 🔗 SAMPLE: Ver alguns exemplos de vínculos criados
SELECT 
  otm.order_id,
  otm.transaction_id,
  otm.source,
  cr.amount,
  cr.date,
  cr.custom_data->>'customer_email' as customer_email
FROM order_transaction_mapping otm
LEFT JOIN csv_rows cr ON cr.custom_data->>'transaction_id' = otm.transaction_id
WHERE otm.source = 'hubspot_backfill'
ORDER BY otm.created_at DESC
LIMIT 10;

-- 📈 COBERTURA FINAL
-- Ver % de transações com order_id após backfill
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN custom_data->>'order_id' IS NOT NULL THEN 1 END) as with_order_id_direct,
  COUNT(CASE 
    WHEN EXISTS (
      SELECT 1 FROM order_transaction_mapping otm
      WHERE otm.transaction_id = csv_rows.custom_data->>'transaction_id'
    ) THEN 1 
  END) as with_mapping,
  ROUND(100.0 * COUNT(CASE 
    WHEN custom_data->>'order_id' IS NOT NULL 
      OR EXISTS (
        SELECT 1 FROM order_transaction_mapping otm
        WHERE otm.transaction_id = csv_rows.custom_data->>'transaction_id'
      ) 
    THEN 1 
  END) / COUNT(*), 2) as total_coverage_percent
FROM csv_rows
WHERE source = 'braintree-api-revenue';
