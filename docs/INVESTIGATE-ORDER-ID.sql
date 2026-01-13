-- ============================================================================
-- INVESTIGAÇÃO: Estrutura de Order ID no Braintree
-- ============================================================================

-- 1️⃣ Ver exemplos de order_id que existem
SELECT 
  custom_data->>'order_id' as order_id,
  custom_data->>'transaction_id' as transaction_id,
  date,
  amount,
  description
FROM csv_rows
WHERE source = 'braintree-api-revenue'
  AND custom_data->>'order_id' IS NOT NULL
ORDER BY date DESC
LIMIT 20;

-- ============================================================================
-- 2️⃣ Buscar "ba29374" em qualquer parte do custom_data
-- ============================================================================
SELECT 
  id,
  date,
  amount,
  custom_data->>'transaction_id' as transaction_id,
  custom_data->>'order_id' as order_id,
  substring(custom_data::text, 1, 200) as custom_data_preview
FROM csv_rows
WHERE source = 'braintree-api-revenue'
  AND custom_data::text LIKE '%ba29374%'
ORDER BY date DESC
LIMIT 10;

-- ============================================================================
-- 3️⃣ Estatísticas: Quantas transações TÊM order_id?
-- ============================================================================
SELECT 
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN custom_data->>'order_id' IS NOT NULL THEN 1 END) as with_order_id,
  COUNT(CASE WHEN custom_data->>'order_id' IS NULL THEN 1 END) as without_order_id,
  ROUND(
    100.0 * COUNT(CASE WHEN custom_data->>'order_id' IS NOT NULL THEN 1 END) / COUNT(*),
    2
  ) as percentage_with_order_id
FROM csv_rows
WHERE source = 'braintree-api-revenue';

-- ============================================================================
-- 4️⃣ Ver estrutura completa de UMA transação recente
-- ============================================================================
SELECT 
  id,
  date,
  amount,
  description,
  custom_data
FROM csv_rows
WHERE source = 'braintree-api-revenue'
ORDER BY date DESC
LIMIT 1;

-- ============================================================================
-- 5️⃣ Buscar por padrões similares (ba*, *29374*, etc)
-- ============================================================================
SELECT 
  custom_data->>'order_id' as order_id,
  custom_data->>'transaction_id' as transaction_id,
  date,
  amount
FROM csv_rows
WHERE source = 'braintree-api-revenue'
  AND (
    custom_data->>'order_id' LIKE 'ba%'
    OR custom_data->>'order_id' LIKE '%29374%'
    OR custom_data->>'transaction_id' LIKE '%ba29374%'
    OR custom_data->>'transaction_id' LIKE 'ba%'
  )
ORDER BY date DESC
LIMIT 20;
