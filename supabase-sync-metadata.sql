-- 🔄 Tabela de Metadata de Sincronização
-- Rastreia última sincronização de cada fonte de dados

CREATE TABLE IF NOT EXISTS sync_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL UNIQUE, -- 'braintree-eur', 'braintree-usd', 'gocardless', 'hubspot', etc.
  
  -- Timestamps de sincronização
  last_sync_at TIMESTAMPTZ, -- Última sincronização (qualquer tipo)
  last_webhook_at TIMESTAMPTZ, -- Último webhook recebido
  last_api_sync_at TIMESTAMPTZ, -- Última sincronização via API
  last_manual_sync_at TIMESTAMPTZ, -- Última sincronização manual
  
  -- Dados da última transação/registro
  most_recent_record_date TIMESTAMPTZ, -- Data do registro mais recente
  most_recent_record_id TEXT, -- ID do registro mais recente
  
  -- Estatísticas
  total_records INTEGER DEFAULT 0,
  records_last_sync INTEGER DEFAULT 0,
  
  -- Status
  sync_status TEXT DEFAULT 'idle', -- 'idle', 'syncing', 'success', 'error'
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  
  -- Configuração
  sync_config JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sync_metadata_source ON sync_metadata(source);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_last_sync ON sync_metadata(last_sync_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_status ON sync_metadata(sync_status);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_sync_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_metadata_updated_at ON sync_metadata;
CREATE TRIGGER trigger_sync_metadata_updated_at
  BEFORE UPDATE ON sync_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_metadata_updated_at();

-- Inserir registros iniciais para cada fonte
INSERT INTO sync_metadata (source, sync_config) VALUES
  ('braintree-eur', '{"currency": "EUR", "merchant_account": "digitalsmiledesignEUR"}'::jsonb),
  ('braintree-usd', '{"currency": "USD", "merchant_account": "digitalsmiledesignUSD"}'::jsonb),
  ('braintree-gbp', '{"currency": "GBP", "merchant_account": "digitalsmiledesignGBP"}'::jsonb),
  ('gocardless-eur', '{"currency": "EUR"}'::jsonb),
  ('gocardless-gbp', '{"currency": "GBP"}'::jsonb),
  ('hubspot', '{"sync_type": "sql_server"}'::jsonb),
  ('stripe', '{"enabled": false}'::jsonb)
ON CONFLICT (source) DO NOTHING;

-- Adicionar coluna external_id na csv_rows se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'csv_rows' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE csv_rows ADD COLUMN external_id TEXT;
    CREATE INDEX idx_csv_rows_external_id ON csv_rows(external_id) WHERE external_id IS NOT NULL;
  END IF;
END $$;

-- Criar índice único composto para evitar duplicatas
DROP INDEX IF EXISTS idx_csv_rows_source_external_id;
CREATE UNIQUE INDEX idx_csv_rows_source_external_id 
ON csv_rows(source, external_id) 
WHERE external_id IS NOT NULL;

-- Comentários
COMMENT ON TABLE sync_metadata IS 'Rastreia metadata de sincronização para cada fonte de dados';
COMMENT ON COLUMN sync_metadata.source IS 'Identificador único da fonte (ex: braintree-eur, gocardless, hubspot)';
COMMENT ON COLUMN sync_metadata.last_sync_at IS 'Timestamp da última sincronização (qualquer tipo)';
COMMENT ON COLUMN sync_metadata.last_webhook_at IS 'Timestamp do último webhook recebido';
COMMENT ON COLUMN sync_metadata.most_recent_record_date IS 'Data da transação/registro mais recente na fonte';

-- Verificar criação
SELECT 
  source,
  last_sync_at,
  last_webhook_at,
  most_recent_record_date,
  total_records,
  sync_status
FROM sync_metadata
ORDER BY source;
