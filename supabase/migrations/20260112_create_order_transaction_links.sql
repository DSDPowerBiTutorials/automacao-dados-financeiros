-- =====================================================
-- Tabela de vínculo Order ↔ Transaction (ex: Braintree)
-- Guarda relacionamentos determinísticos para conciliação
-- =====================================================

CREATE TABLE IF NOT EXISTS order_transaction_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificador do provedor/origem do vínculo (ex: 'braintree')
  provider TEXT NOT NULL DEFAULT 'braintree',

  -- Chave do pedido do e-commerce (ex: '5ebe90b')
  order_id TEXT NOT NULL,

  -- ID da transação no provedor (ex: Braintree transactionId)
  transaction_id TEXT NOT NULL,

  -- Campos auxiliares para facilitar relatórios/explicações
  disbursement_id TEXT,
  merchant_account_id TEXT,
  currency TEXT,

  -- Campo flexível para metadados adicionais
  link_metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unicidade e performance
CREATE UNIQUE INDEX IF NOT EXISTS uniq_order_transaction_links_provider_tx
  ON order_transaction_links(provider, transaction_id);

CREATE INDEX IF NOT EXISTS idx_order_transaction_links_provider_order
  ON order_transaction_links(provider, order_id);

CREATE INDEX IF NOT EXISTS idx_order_transaction_links_provider_disbursement
  ON order_transaction_links(provider, disbursement_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_order_transaction_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_order_transaction_links_updated_at ON order_transaction_links;
CREATE TRIGGER trigger_update_order_transaction_links_updated_at
  BEFORE UPDATE ON order_transaction_links
  FOR EACH ROW
  EXECUTE FUNCTION update_order_transaction_links_updated_at();

-- Segurança
ALTER TABLE order_transaction_links ENABLE ROW LEVEL SECURITY;

-- Policies (padrão do projeto)
CREATE POLICY "Allow public read access to order_transaction_links"
  ON order_transaction_links FOR SELECT
  USING (true);

CREATE POLICY "Allow service role to insert order_transaction_links"
  ON order_transaction_links FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow service role to update order_transaction_links"
  ON order_transaction_links FOR UPDATE
  USING (true);

COMMENT ON TABLE order_transaction_links IS 'Vínculos determinísticos entre orders do e-commerce e transações de provedores (ex: Braintree).';
COMMENT ON COLUMN order_transaction_links.provider IS 'Origem do vínculo (ex: braintree, stripe, etc.)';
COMMENT ON COLUMN order_transaction_links.order_id IS 'Order ID do site/e-commerce (ex: 5ebe90b)';
COMMENT ON COLUMN order_transaction_links.transaction_id IS 'Transaction ID no provedor (ex: Braintree transactionId)';
COMMENT ON COLUMN order_transaction_links.disbursement_id IS 'Disbursement/Payout ID no provedor (quando existir)';
