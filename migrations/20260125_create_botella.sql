-- ============================================================================
-- BOTella - Sistema de Automação com Logs
-- ============================================================================
-- Version: 1.0
-- Date: 2026-01-25
-- Description: Cria usuário BOT e tabela de logs para tarefas automáticas
-- ============================================================================

-- ============================================================================
-- 1. CRIAR ROLE BOT (se não existir)
-- ============================================================================
INSERT INTO roles (role, description, permissions, level) VALUES
  ('bot', 'System Bot - Automated tasks only', 
   '["execute_sync", "write_logs", "read_all"]'::jsonb, 0)
ON CONFLICT (role) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  level = EXCLUDED.level,
  updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- 2. TABELA DE LOGS DO BOT
-- ============================================================================
CREATE TABLE IF NOT EXISTS bot_logs (
  id SERIAL PRIMARY KEY,
  bot_name TEXT NOT NULL DEFAULT 'BOTella',
  task_name TEXT NOT NULL,
  task_type TEXT NOT NULL, -- 'sync', 'reconciliation', 'cleanup', 'notification', 'backup'
  status TEXT NOT NULL CHECK (status IN ('started', 'running', 'completed', 'failed', 'warning')),
  message TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  error_stack TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE bot_logs IS 'Logs de tarefas automáticas executadas pelo BOTella';
COMMENT ON COLUMN bot_logs.bot_name IS 'Nome do bot (default: BOTella)';
COMMENT ON COLUMN bot_logs.task_name IS 'Nome da tarefa executada';
COMMENT ON COLUMN bot_logs.task_type IS 'Tipo: sync, reconciliation, cleanup, notification, backup';
COMMENT ON COLUMN bot_logs.status IS 'Status: started, running, completed, failed, warning';

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_bot_logs_bot_name ON bot_logs(bot_name);
CREATE INDEX IF NOT EXISTS idx_bot_logs_task_type ON bot_logs(task_type);
CREATE INDEX IF NOT EXISTS idx_bot_logs_status ON bot_logs(status);
CREATE INDEX IF NOT EXISTS idx_bot_logs_started_at ON bot_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_logs_created_at ON bot_logs(created_at DESC);

-- ============================================================================
-- 3. TABELA DE CONFIGURAÇÃO DE TAREFAS DO BOT
-- ============================================================================
CREATE TABLE IF NOT EXISTS bot_tasks (
  id SERIAL PRIMARY KEY,
  task_key TEXT UNIQUE NOT NULL, -- identificador único da tarefa
  task_name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  description TEXT,
  schedule TEXT, -- cron expression (e.g., '0 4 * * *')
  is_enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_status TEXT,
  next_run_at TIMESTAMP WITH TIME ZONE,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE bot_tasks IS 'Configuração de tarefas automáticas do BOTella';

-- Inserir tarefas padrão
INSERT INTO bot_tasks (task_key, task_name, task_type, description, schedule, is_enabled) VALUES
  ('daily_sync', 'Sincronização Diária', 'sync', 'Sincroniza Braintree, GoCardless, HubSpot, Stripe e QuickBooks', '0 4 * * *', true),
  ('braintree_eur_sync', 'Braintree EUR Sync', 'sync', 'Sincroniza transações Braintree em EUR', '0 4 * * *', true),
  ('braintree_usd_sync', 'Braintree USD Sync', 'sync', 'Sincroniza transações Braintree em USD', '0 4 * * *', true),
  ('gocardless_sync', 'GoCardless Sync', 'sync', 'Sincroniza pagamentos GoCardless', '0 4 * * *', true),
  ('hubspot_sync', 'HubSpot Sync', 'sync', 'Sincroniza deals e clientes HubSpot', '0 4 * * *', true),
  ('stripe_sync', 'Stripe Sync', 'sync', 'Sincroniza pagamentos Stripe', '0 4 * * *', true),
  ('quickbooks_sync', 'QuickBooks Sync', 'sync', 'Sincroniza dados QuickBooks (EUA)', '0 4 * * *', true),
  ('auto_reconciliation', 'Reconciliação Automática', 'reconciliation', 'Executa reconciliação automática de transações', '0 5 * * *', true),
  ('order_linking', 'Order ID Linking', 'reconciliation', 'Vincula Order IDs às transações', '*/30 * * * *', true),
  ('cleanup_old_logs', 'Limpeza de Logs', 'cleanup', 'Remove logs antigos (>90 dias)', '0 3 * * 0', true),
  ('daily_backup', 'Backup Diário', 'backup', 'Cria backup das tabelas críticas', '0 2 * * *', false)
ON CONFLICT (task_key) DO NOTHING;

-- ============================================================================
-- 4. FUNÇÃO PARA REGISTRAR LOG DO BOT
-- ============================================================================
CREATE OR REPLACE FUNCTION log_bot_action(
  p_task_name TEXT,
  p_task_type TEXT,
  p_status TEXT,
  p_message TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_records_processed INTEGER DEFAULT 0,
  p_records_created INTEGER DEFAULT 0,
  p_records_updated INTEGER DEFAULT 0,
  p_records_failed INTEGER DEFAULT 0,
  p_duration_ms INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  log_id INTEGER;
BEGIN
  INSERT INTO bot_logs (
    task_name,
    task_type,
    status,
    message,
    details,
    records_processed,
    records_created,
    records_updated,
    records_failed,
    duration_ms,
    error_message,
    completed_at
  ) VALUES (
    p_task_name,
    p_task_type,
    p_status,
    p_message,
    p_details,
    p_records_processed,
    p_records_created,
    p_records_updated,
    p_records_failed,
    p_duration_ms,
    p_error_message,
    CASE WHEN p_status IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE NULL END
  ) RETURNING id INTO log_id;
  
  -- Atualizar última execução na tabela de tarefas
  UPDATE bot_tasks
  SET 
    last_run_at = CURRENT_TIMESTAMP,
    last_status = p_status,
    updated_at = CURRENT_TIMESTAMP
  WHERE task_name = p_task_name;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. VIEW PARA RESUMO DE ATIVIDADES DO BOT
-- ============================================================================
CREATE OR REPLACE VIEW bot_activity_summary AS
SELECT 
  DATE(started_at) as date,
  task_type,
  COUNT(*) as total_tasks,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warnings,
  SUM(records_processed) as total_records_processed,
  SUM(records_created) as total_records_created,
  SUM(records_updated) as total_records_updated,
  AVG(duration_ms)::INTEGER as avg_duration_ms
FROM bot_logs
WHERE started_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(started_at), task_type
ORDER BY date DESC, task_type;

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT, INSERT ON bot_logs TO authenticated;
GRANT SELECT ON bot_tasks TO authenticated;
GRANT UPDATE ON bot_tasks TO authenticated;
GRANT SELECT ON bot_activity_summary TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE bot_logs_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE bot_tasks_id_seq TO authenticated;

-- Done!
SELECT 'BOTella system created successfully!' as status;
