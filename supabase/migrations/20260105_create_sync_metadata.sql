-- =====================================================
-- Tabela de Metadata de Sincronização
-- Armazena informações sobre última sync de cada fonte
-- =====================================================

CREATE TABLE IF NOT EXISTS sync_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL UNIQUE, -- 'braintree-eur', 'braintree-usd', 'gocardless', 'hubspot', etc.
  
  -- Timestamps de sincronização
  last_api_sync TIMESTAMPTZ, -- Última sincronização manual via botão
  last_webhook_received TIMESTAMPTZ, -- Último webhook recebido
  last_full_sync TIMESTAMPTZ, -- Última sincronização completa
  
  -- Dados sobre registros
  last_record_date TIMESTAMPTZ, -- Data do registro mais recente
  total_records INTEGER DEFAULT 0,
  records_added_last_sync INTEGER DEFAULT 0,
  
  -- Status e erros
  last_sync_status TEXT DEFAULT 'success', -- 'success', 'error', 'in_progress'
  last_sync_error TEXT,
  
  -- Configuração
  sync_config JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps de controle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sync_metadata_source ON sync_metadata(source);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_last_api_sync ON sync_metadata(last_api_sync);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_sync_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sync_metadata_updated_at
  BEFORE UPDATE ON sync_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_metadata_updated_at();

-- Inserir registros iniciais para todas as fontes
INSERT INTO sync_metadata (source, sync_config) VALUES
  ('braintree-eur', '{"currency": "EUR", "merchant_account": "digitalsmiledesignEUR"}'::jsonb),
  ('braintree-usd', '{"currency": "USD", "merchant_account": "digitalsmiledesignUSD"}'::jsonb),
  ('braintree-amex', '{"currency": "USD", "merchant_account": "digitalsmiledesignAmex"}'::jsonb),
  ('gocardless', '{"currency": "EUR"}'::jsonb),
  ('hubspot', '{"source": "sqlserver"}'::jsonb),
  ('stripe', '{"currency": "USD"}'::jsonb)
ON CONFLICT (source) DO NOTHING;

-- RLS Policies (se necessário)
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

-- Permitir leitura pública (para mostrar no frontend)
CREATE POLICY "Allow public read access to sync_metadata"
  ON sync_metadata FOR SELECT
  USING (true);

-- Permitir update apenas para service role
CREATE POLICY "Allow service role to update sync_metadata"
  ON sync_metadata FOR UPDATE
  USING (true);

CREATE POLICY "Allow service role to insert sync_metadata"
  ON sync_metadata FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE sync_metadata IS 'Metadata de sincronização para todas as fontes de dados (APIs, webhooks, etc.)';
COMMENT ON COLUMN sync_metadata.source IS 'Identificador único da fonte (braintree-eur, gocardless, etc.)';
COMMENT ON COLUMN sync_metadata.last_api_sync IS 'Timestamp da última sincronização manual via API';
COMMENT ON COLUMN sync_metadata.last_webhook_received IS 'Timestamp do último webhook recebido';
COMMENT ON COLUMN sync_metadata.last_record_date IS 'Data do registro mais recente na base';
