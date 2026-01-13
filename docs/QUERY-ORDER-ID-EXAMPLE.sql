-- ============================================================================
-- QUERY: Verificar Order ID em Transação Braintree
-- Exemplo: ba29374
-- ============================================================================

-- Buscar transação com order_id específico
SELECT 
  id,
  date,
  amount,
  description,
  custom_data->>'transaction_id' as transaction_id,
  custom_data->>'order_id' as order_id,
  custom_data->>'customer_name' as customer_name,
  custom_data->>'status' as status,
  reconciled
FROM csv_rows
WHERE source = 'braintree-api-revenue'
  AND custom_data->>'order_id' = 'ba29374'
ORDER BY date DESC;

-- ============================================================================
-- Se não encontrar, buscar em transaction_id
-- ============================================================================
SELECT 
  id,
  date,
  amount,
  description,
  custom_data->>'transaction_id' as transaction_id,
  custom_data->>'order_id' as order_id,
  custom_data->>'customer_name' as customer_name,
  custom_data->>'status' as status,
  reconciled
FROM csv_rows
WHERE source = 'braintree-api-revenue'
  AND custom_data->>'transaction_id' LIKE '%ba29374%'
ORDER BY date DESC
LIMIT 5;

-- ============================================================================
-- Estatísticas de order_id
-- ============================================================================
SELECT 
  COUNT(*) as total_transactions,
  COUNT(DISTINCT custom_data->>'order_id') as unique_order_ids,
  COUNT(CASE WHEN custom_data->>'order_id' IS NOT NULL THEN 1 END) as with_order_id,
  COUNT(CASE WHEN custom_data->>'order_id' IS NULL THEN 1 END) as without_order_id,
  ROUND(
    100.0 * COUNT(CASE WHEN custom_data->>'order_id' IS NOT NULL THEN 1 END) / COUNT(*),
    2
  ) as percentage_with_order_id
FROM csv_rows
WHERE source = 'braintree-api-revenue';
