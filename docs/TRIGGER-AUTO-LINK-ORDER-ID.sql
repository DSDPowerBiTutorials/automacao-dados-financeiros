-- Função: Auto-link order_id quando webhook do Braintree chegar
-- Trigger: Executar AFTER INSERT na csv_rows quando source = braintree-api-revenue

CREATE OR REPLACE FUNCTION auto_link_braintree_order_id()
RETURNS TRIGGER AS $$
DECLARE
  v_transaction_id TEXT;
  v_order_code TEXT;
BEGIN
  -- Só processar transações Braintree
  IF NEW.source <> 'braintree-api-revenue' THEN
    RETURN NEW;
  END IF;

  v_transaction_id := NEW.custom_data->>'transaction_id';

  -- Se já tem order_id, não fazer nada
  IF NEW.custom_data->>'order_id' IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1️⃣ Buscar na tabela de mapeamento
  SELECT order_id INTO v_order_code
  FROM order_transaction_mapping
  WHERE transaction_id = v_transaction_id
  LIMIT 1;

  -- 2️⃣ Se não encontrou, buscar no HubSpot link
  IF v_order_code IS NULL THEN
    SELECT hubspot_order_code INTO v_order_code
    FROM braintree_hubspot_order_links
    WHERE braintree_transaction_id = v_transaction_id
      AND hubspot_order_code IS NOT NULL
    LIMIT 1;

    -- Se encontrou no HubSpot, criar mapeamento para cache
    IF v_order_code IS NOT NULL THEN
      INSERT INTO order_transaction_mapping (order_id, transaction_id, source)
      VALUES (v_order_code, v_transaction_id, 'trigger_auto_link')
      ON CONFLICT (transaction_id) DO NOTHING;
    END IF;
  END IF;

  -- 3️⃣ Se encontrou order_id, atualizar custom_data
  IF v_order_code IS NOT NULL THEN
    NEW.custom_data := jsonb_set(
      COALESCE(NEW.custom_data, '{}'::jsonb),
      '{order_id}',
      to_jsonb(v_order_code)
    );
    
    RAISE NOTICE 'Auto-linked order_id % for transaction %', v_order_code, v_transaction_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_auto_link_braintree_order_id ON csv_rows;

CREATE TRIGGER trigger_auto_link_braintree_order_id
  BEFORE INSERT ON csv_rows
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_braintree_order_id();

COMMENT ON FUNCTION auto_link_braintree_order_id() IS 
'Auto-vincula order_id via order_transaction_mapping ou braintree_hubspot_order_links quando webhook do Braintree inserir nova transação';

-- ✅ TESTAR TRIGGER
-- Inserir transação teste SEM order_id
/*
INSERT INTO csv_rows (source, date, amount, description, custom_data)
VALUES (
  'braintree-api-revenue',
  '2026-01-13',
  99.99,
  'Test transaction',
  jsonb_build_object(
    'transaction_id', 'test_tx_123',
    'customer_email', 'test@example.com'
  )
);

-- Criar mapeamento
INSERT INTO order_transaction_mapping (order_id, transaction_id, source)
VALUES ('TEST-ORDER-999', 'test_tx_123', 'manual');

-- Inserir novamente e verificar se order_id foi auto-linkado
DELETE FROM csv_rows WHERE custom_data->>'transaction_id' = 'test_tx_123';
INSERT INTO csv_rows (source, date, amount, description, custom_data)
VALUES (
  'braintree-api-revenue',
  '2026-01-13',
  99.99,
  'Test transaction',
  jsonb_build_object(
    'transaction_id', 'test_tx_123',
    'customer_email', 'test@example.com'
  )
);

-- Verificar resultado
SELECT custom_data->>'order_id', custom_data->>'transaction_id'
FROM csv_rows
WHERE custom_data->>'transaction_id' = 'test_tx_123';
-- Deve retornar: TEST-ORDER-999

-- Limpar teste
DELETE FROM csv_rows WHERE custom_data->>'transaction_id' = 'test_tx_123';
DELETE FROM order_transaction_mapping WHERE transaction_id = 'test_tx_123';
*/
