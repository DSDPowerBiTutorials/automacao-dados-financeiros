-- =====================================================
-- SYNC METADATA & WEBHOOK LOGS TABLES
-- Rastreamento completo de sincronizações e webhooks
-- =====================================================

-- Tabela: sync_metadata
-- Armazena metadata sobre sincronizações de cada fonte
CREATE TABLE IF NOT EXISTS sync_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL UNIQUE, -- 'braintree-eur', 'gocardless', 'hubspot', etc.
  
  -- Timestamps de sincronização
  last_sync_at TIMESTAMPTZ, -- Última sincronização (qualquer tipo)
  last_incremental_sync_at TIMESTAMPTZ, -- Última sync incremental
  last_full_sync_at TIMESTAMPTZ, -- Última sync completa
  next_full_sync_due_at TIMESTAMPTZ, -- Quando fazer próxima full sync
  
  -- Timestamps de dados
  most_recent_transaction_date TIMESTAMPTZ, -- Data da transação mais recente
  most_recent_webhook_at TIMESTAMPTZ, -- Último webhook recebido
  
  -- Estatísticas
  total_records INTEGER DEFAULT 0,
  records_added_last_sync INTEGER DEFAULT 0,
  records_updated_last_sync INTEGER DEFAULT 0,
  
  -- Status
  sync_status TEXT DEFAULT 'idle', -- 'idle', 'syncing', 'success', 'error'
  last_sync_error TEXT,
  last_sync_duration_ms INTEGER,
  
  -- Configuração
  sync_config JSONB DEFAULT '{}', -- Configurações específicas da fonte
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para sync_metadata
CREATE INDEX idx_sync_metadata_source ON sync_metadata(source);
CREATE INDEX idx_sync_metadata_next_full_sync ON sync_metadata(next_full_sync_due_at);
CREATE INDEX idx_sync_metadata_status ON sync_metadata(sync_status);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_sync_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_metadata_updated_at
  BEFORE UPDATE ON sync_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_metadata_updated_at();

-- =====================================================

-- Tabela: webhook_logs
-- Registra todos os webhooks recebidos
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- 'braintree', 'gocardless', 'stripe', etc.
  
  -- Dados do webhook
  event_type TEXT NOT NULL, -- 'payment.confirmed', 'transaction.settled', etc.
  event_id TEXT, -- ID do evento (se fornecido pela API)
  external_id TEXT, -- ID da transação/pagamento na API externa
  
  -- Payload
  payload JSONB, -- Payload completo do webhook
  headers JSONB, -- Headers HTTP do webhook
  
  -- Processamento
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  processing_duration_ms INTEGER,
  
  -- Validação
  signature_valid BOOLEAN,
  ip_address TEXT,
  
  -- Metadata
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para webhook_logs
CREATE INDEX idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX idx_webhook_logs_external_id ON webhook_logs(external_id);
CREATE INDEX idx_webhook_logs_processed ON webhook_logs(processed);
CREATE INDEX idx_webhook_logs_received_at ON webhook_logs(received_at DESC);
CREATE INDEX idx_webhook_logs_source_received ON webhook_logs(source, received_at DESC);

-- =====================================================

-- Inserir registros iniciais para fontes conhecidas
INSERT INTO sync_metadata (source, sync_config) VALUES
  ('braintree-eur', '{"fullSyncIntervalDays": 30, "incrementalSyncIntervalHours": 6, "useUpdatedAt": true}'::jsonb),
  ('braintree-usd', '{"fullSyncIntervalDays": 30, "incrementalSyncIntervalHours": 6, "useUpdatedAt": true}'::jsonb),
  ('braintree-amex', '{"fullSyncIntervalDays": 30, "incrementalSyncIntervalHours": 6, "useUpdatedAt": true}'::jsonb),
  ('gocardless', '{"fullSyncIntervalDays": 7, "incrementalSyncIntervalHours": 12, "useUpdatedAt": false, "useWebhooks": true}'::jsonb),
  ('hubspot', '{"fullSyncIntervalDays": 14, "incrementalSyncIntervalHours": 24, "useUpdatedAt": true}'::jsonb),
  ('bankinter-eur', '{"fullSyncIntervalDays": 90, "incrementalSyncIntervalHours": 0, "useUpdatedAt": false}'::jsonb),
  ('sabadell', '{"fullSyncIntervalDays": 90, "incrementalSyncIntervalHours": 0, "useUpdatedAt": false}'::jsonb)
ON CONFLICT (source) DO NOTHING;

-- =====================================================

-- Função auxiliar: Atualizar sync_metadata após sincronização
CREATE OR REPLACE FUNCTION update_sync_stats(
  p_source TEXT,
  p_sync_type TEXT, -- 'incremental' ou 'full'
  p_records_added INTEGER DEFAULT 0,
  p_records_updated INTEGER DEFAULT 0,
  p_duration_ms INTEGER DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE sync_metadata
  SET
    last_sync_at = NOW(),
    last_incremental_sync_at = CASE WHEN p_sync_type = 'incremental' THEN NOW() ELSE last_incremental_sync_at END,
    last_full_sync_at = CASE WHEN p_sync_type = 'full' THEN NOW() ELSE last_full_sync_at END,
    records_added_last_sync = p_records_added,
    records_updated_last_sync = p_records_updated,
    total_records = total_records + p_records_added,
    sync_status = CASE WHEN p_error IS NULL THEN 'success' ELSE 'error' END,
    last_sync_error = p_error,
    last_sync_duration_ms = p_duration_ms,
    next_full_sync_due_at = CASE 
      WHEN p_sync_type = 'full' THEN 
        NOW() + ((sync_config->>'fullSyncIntervalDays')::INTEGER || ' days')::INTERVAL
      ELSE next_full_sync_due_at
    END
  WHERE source = p_source;
END;
$$ LANGUAGE plpgsql;

-- =====================================================

-- Função auxiliar: Atualizar most_recent_transaction_date
CREATE OR REPLACE FUNCTION update_most_recent_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar sync_metadata com a data da transação mais recente
  UPDATE sync_metadata
  SET most_recent_transaction_date = GREATEST(
    COALESCE(most_recent_transaction_date, NEW.date),
    NEW.date
  )
  WHERE source = NEW.source;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger em csv_rows para atualizar automaticamente
CREATE TRIGGER update_most_recent_transaction_trigger
  AFTER INSERT OR UPDATE ON csv_rows
  FOR EACH ROW
  EXECUTE FUNCTION update_most_recent_transaction();

-- =====================================================

-- Função auxiliar: Registrar webhook recebido
CREATE OR REPLACE FUNCTION log_webhook_received(
  p_source TEXT,
  p_event_type TEXT,
  p_event_id TEXT DEFAULT NULL,
  p_external_id TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT NULL,
  p_headers JSONB DEFAULT NULL,
  p_signature_valid BOOLEAN DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_webhook_id UUID;
BEGIN
  INSERT INTO webhook_logs (
    source,
    event_type,
    event_id,
    external_id,
    payload,
    headers,
    signature_valid,
    ip_address
  ) VALUES (
    p_source,
    p_event_type,
    p_event_id,
    p_external_id,
    p_payload,
    p_headers,
    p_signature_valid,
    p_ip_address
  )
  RETURNING id INTO v_webhook_id;
  
  -- Atualizar sync_metadata com timestamp do webhook
  UPDATE sync_metadata
  SET most_recent_webhook_at = NOW()
  WHERE source = p_source;
  
  RETURN v_webhook_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================

-- View para facilitar queries de status
CREATE OR REPLACE VIEW sync_status_view AS
SELECT 
  sm.source,
  sm.last_sync_at,
  sm.last_incremental_sync_at,
  sm.last_full_sync_at,
  sm.most_recent_transaction_date,
  sm.most_recent_webhook_at,
  sm.total_records,
  sm.sync_status,
  sm.last_sync_error,
  -- Última webhook por fonte
  (SELECT COUNT(*) FROM webhook_logs wl WHERE wl.source = sm.source AND wl.received_at > NOW() - INTERVAL '24 hours') as webhooks_last_24h,
  (SELECT COUNT(*) FROM webhook_logs wl WHERE wl.source = sm.source AND wl.processed = false) as pending_webhooks
FROM sync_metadata sm;

-- =====================================================

COMMENT ON TABLE sync_metadata IS 'Metadata de sincronizações por fonte de dados';
COMMENT ON TABLE webhook_logs IS 'Log de todos os webhooks recebidos';
COMMENT ON FUNCTION update_sync_stats IS 'Atualiza estatísticas após uma sincronização';
COMMENT ON FUNCTION log_webhook_received IS 'Registra webhook recebido e atualiza sync_metadata';
