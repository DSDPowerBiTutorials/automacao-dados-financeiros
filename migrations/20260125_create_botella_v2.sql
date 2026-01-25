-- =====================================================
-- BOTella v2 - Sistema de Automação com Notificações
-- =====================================================
-- Version: 2.0
-- Date: 2026-01-25
-- Description: Sistema completo com retry, workflows e notificações
-- =====================================================

-- Remover tabelas antigas se existirem (cuidado em produção!)
DROP TABLE IF EXISTS bot_dead_letter_queue CASCADE;
DROP TABLE IF EXISTS bot_notification_rules CASCADE;
DROP TABLE IF EXISTS bot_notifications CASCADE;
DROP TABLE IF EXISTS bot_notification_templates CASCADE;
DROP TABLE IF EXISTS bot_workflows CASCADE;
DROP TABLE IF EXISTS bot_logs CASCADE;
DROP TABLE IF EXISTS bot_tasks CASCADE;
DROP TABLE IF EXISTS bot_users CASCADE;

-- =====================================================
-- 1. BOT_USERS - Usuários que recebem notificações
-- =====================================================
CREATE TABLE bot_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  notification_preferences JSONB DEFAULT '{"email": true, "push": false, "sms": false, "in_app": true}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE bot_users IS 'Usuários que recebem notificações do BOTella';

-- Inserir usuários existentes
INSERT INTO bot_users (email, name, avatar_url, notification_preferences) VALUES
  ('botella@system.local', 'BOTella', '/avatars/botella.svg', '{"email": false, "push": false, "sms": false, "in_app": false}'::jsonb),
  ('fernando@digitalsmiledesign.com', 'Fernando', '/avatars/Fernando.png', '{"email": true, "push": true, "sms": false, "in_app": true}'::jsonb),
  ('sofia@digitalsmiledesign.com', 'Sofia', '/avatars/Sofia.png', '{"email": true, "push": true, "sms": false, "in_app": true}'::jsonb),
  ('jorge@digitalsmiledesign.com', 'Jorge', '/avatars/Jorge.png', '{"email": true, "push": true, "sms": false, "in_app": true}'::jsonb),
  ('valeria@digitalsmiledesign.com', 'Valeria', '/avatars/Valeria.png', '{"email": true, "push": true, "sms": false, "in_app": true}'::jsonb)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  avatar_url = EXCLUDED.avatar_url,
  updated_at = NOW();

-- =====================================================
-- 2. BOT_TASKS - Tarefas configuradas
-- =====================================================
CREATE TABLE bot_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL CHECK (task_type IN ('sync', 'reconciliation', 'report', 'notification', 'cleanup', 'backup')),
  cron_expression TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  rate_limit_per_minute INTEGER DEFAULT 10,
  timeout_seconds INTEGER DEFAULT 300,
  config JSONB DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE bot_tasks IS 'Configuração de tarefas automáticas do BOTella';

-- Tarefas padrão
INSERT INTO bot_tasks (task_key, name, description, task_type, cron_expression, priority, config) VALUES
  ('daily_sync', 'Sincronização Diária', 'Sincroniza Braintree, GoCardless, HubSpot, Stripe e QuickBooks', 'sync', '0 4 * * *', 1, 
   '{"sources": ["braintree-eur", "braintree-usd", "gocardless", "hubspot", "stripe", "quickbooks"]}'::jsonb),
  ('braintree_eur_sync', 'Braintree EUR Sync', 'Sincroniza transações Braintree em EUR', 'sync', '0 4 * * *', 2, 
   '{"currency": "EUR", "days_back": 7}'::jsonb),
  ('braintree_usd_sync', 'Braintree USD Sync', 'Sincroniza transações Braintree em USD', 'sync', '0 4 * * *', 2, 
   '{"currency": "USD", "days_back": 7}'::jsonb),
  ('gocardless_sync', 'GoCardless Sync', 'Sincroniza pagamentos GoCardless', 'sync', '0 4 * * *', 2, 
   '{"days_back": 30}'::jsonb),
  ('hubspot_sync', 'HubSpot Sync', 'Sincroniza deals e clientes HubSpot', 'sync', '0 4 * * *', 2, 
   '{"since_year": 2024}'::jsonb),
  ('stripe_sync', 'Stripe Sync', 'Sincroniza pagamentos Stripe', 'sync', '0 4 * * *', 2, 
   '{"days_back": 7}'::jsonb),
  ('quickbooks_sync', 'QuickBooks Sync', 'Sincroniza dados QuickBooks (EUA)', 'sync', '0 4 * * *', 3, 
   '{"scope": "US", "days_back": 30}'::jsonb),
  ('auto_reconciliation', 'Reconciliação Automática', 'Executa reconciliação automática de transações', 'reconciliation', '0 5 * * *', 2, 
   '{"tolerance_days": 3, "tolerance_amount": 0.01}'::jsonb),
  ('order_linking', 'Order ID Linking', 'Vincula Order IDs às transações Braintree', 'reconciliation', '*/30 * * * *', 3, 
   '{"batch_size": 100}'::jsonb),
  ('daily_summary_notification', 'Resumo Diário', 'Envia resumo diário aos usuários', 'notification', '0 8 * * *', 4, 
   '{"template": "daily_summary", "recipients": "all_active"}'::jsonb),
  ('process_notification_queue', 'Processar Notificações', 'Processa fila de notificações pendentes', 'notification', '*/5 * * * *', 1, 
   '{"batch_size": 50}'::jsonb),
  ('cleanup_old_logs', 'Limpeza de Logs', 'Remove logs com mais de 90 dias', 'cleanup', '0 3 * * 0', 10, 
   '{"retention_days": 90}'::jsonb),
  ('daily_backup', 'Backup Diário', 'Cria backup das tabelas críticas', 'backup', '0 2 * * *', 5, 
   '{"tables": ["csv_rows", "invoices", "payments"]}'::jsonb)
ON CONFLICT (task_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  config = EXCLUDED.config,
  updated_at = NOW();

-- =====================================================
-- 3. BOT_LOGS - Logs de execução (padrão Celery)
-- =====================================================
CREATE TABLE bot_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES bot_tasks(id) ON DELETE SET NULL,
  task_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'STARTED', 'SUCCESS', 'FAILURE', 'RETRY', 'REVOKED')),
  attempt INTEGER DEFAULT 1,
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  result JSONB,
  error_message TEXT,
  error_stack TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  executed_by TEXT DEFAULT 'BOTella'
);

COMMENT ON TABLE bot_logs IS 'Logs de execução das tarefas do BOTella';

CREATE INDEX idx_bot_logs_status ON bot_logs(status);
CREATE INDEX idx_bot_logs_task_name ON bot_logs(task_name);
CREATE INDEX idx_bot_logs_started_at ON bot_logs(started_at DESC);
CREATE INDEX idx_bot_logs_task_id ON bot_logs(task_id);

-- =====================================================
-- 4. BOT_NOTIFICATION_TEMPLATES - Templates de notificação
-- =====================================================
CREATE TABLE bot_notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'sms', 'in_app')),
  subject TEXT,
  body_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE bot_notification_templates IS 'Templates de notificação com variáveis {{placeholders}}';

-- Templates padrão
INSERT INTO bot_notification_templates (name, event_type, channel, subject, body_template) VALUES
  ('Reconciliação Completa', 'reconciliation_complete', 'email', 
   '✅ Reconciliação {{source}} concluída', 
   E'Olá {{user_name}},\n\nA reconciliação de {{source}} foi concluída com sucesso.\n\n📊 Resumo:\n- Transações processadas: {{total_transactions}}\n- Reconciliadas: {{reconciled_count}}\n- Pendentes: {{pending_count}}\n\nAcesse o sistema para mais detalhes.\n\n🤖 BOTella'),
  
  ('Sync Falhou', 'sync_failed', 'email',
   '❌ Falha no sync {{source}}',
   E'Olá {{user_name}},\n\n⚠️ O sync de {{source}} falhou após {{attempts}} tentativas.\n\nErro: {{error_message}}\n\nPor favor, verifique o sistema.\n\n🤖 BOTella'),
  
  ('Resumo Diário', 'daily_summary', 'email',
   '📊 Resumo Financeiro - {{date}}',
   E'Bom dia {{user_name}},\n\n📈 Resumo do dia {{date}}:\n\n💰 Entradas: {{total_income}}\n💸 Saídas: {{total_expenses}}\n📊 Saldo: {{balance}}\n\n🔄 Tarefas executadas: {{tasks_count}}\n✅ Sucesso: {{success_count}}\n❌ Falhas: {{failure_count}}\n\n🤖 BOTella'),

  ('Alerta de Valor Alto', 'high_value_alert', 'email',
   '🚨 Transação de alto valor detectada',
   E'Olá {{user_name}},\n\n🚨 Uma transação de alto valor foi detectada:\n\n💰 Valor: {{amount}} {{currency}}\n📅 Data: {{date}}\n🏦 Fonte: {{source}}\n📝 Descrição: {{description}}\n\nPor favor, verifique se está tudo correto.\n\n🤖 BOTella'),

  ('Tarefa Iniciada (In-App)', 'task_started', 'in_app',
   '🤖 {{task_name}} iniciada',
   'A tarefa {{task_name}} foi iniciada às {{start_time}}.'),

  ('Tarefa Concluída (In-App)', 'task_completed', 'in_app',
   '✅ {{task_name}} concluída',
   'A tarefa {{task_name}} foi concluída em {{duration}}. Processados: {{records_processed}} registros.'),

  ('Tarefa Falhou (In-App)', 'task_failed', 'in_app',
   '❌ {{task_name}} falhou',
   'A tarefa {{task_name}} falhou: {{error_message}}')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 5. BOT_NOTIFICATIONS - Fila de notificações
-- =====================================================
CREATE TABLE bot_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES bot_users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'sms', 'in_app')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'read')),
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE bot_notifications IS 'Fila de notificações do BOTella';

CREATE INDEX idx_bot_notifications_status ON bot_notifications(status);
CREATE INDEX idx_bot_notifications_user ON bot_notifications(user_id);
CREATE INDEX idx_bot_notifications_scheduled ON bot_notifications(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_bot_notifications_channel ON bot_notifications(channel);

-- =====================================================
-- 6. BOT_NOTIFICATION_RULES - Regras de notificação
-- =====================================================
CREATE TABLE bot_notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES bot_users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channels TEXT[] DEFAULT ARRAY['email', 'in_app'],
  conditions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_type)
);

COMMENT ON TABLE bot_notification_rules IS 'Define quem recebe quais notificações';

-- Regras padrão para usuários
INSERT INTO bot_notification_rules (user_id, event_type, channels) 
SELECT id, 'daily_summary', ARRAY['email', 'in_app']
FROM bot_users WHERE email != 'botella@system.local';

INSERT INTO bot_notification_rules (user_id, event_type, channels) 
SELECT id, 'sync_failed', ARRAY['email', 'in_app']
FROM bot_users WHERE email != 'botella@system.local';

INSERT INTO bot_notification_rules (user_id, event_type, channels) 
SELECT id, 'high_value_alert', ARRAY['email', 'in_app']
FROM bot_users WHERE email != 'botella@system.local';

-- =====================================================
-- 7. BOT_WORKFLOWS - Encadeamento de tarefas
-- =====================================================
CREATE TABLE bot_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  steps JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE bot_workflows IS 'Workflows de tarefas encadeadas (padrão Celery chain)';

-- Workflow padrão
INSERT INTO bot_workflows (name, description, steps) VALUES
  ('morning_routine', 'Rotina matinal: sync → reconciliação → relatório', 
   '[
     {"task_key": "daily_sync", "order": 1, "on_failure": "continue"},
     {"task_key": "auto_reconciliation", "order": 2, "on_failure": "continue"},
     {"task_key": "daily_summary_notification", "order": 3, "on_failure": "stop"}
   ]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 8. BOT_DEAD_LETTER_QUEUE - Tarefas falhas
-- =====================================================
CREATE TABLE bot_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_log_id UUID REFERENCES bot_logs(id) ON DELETE SET NULL,
  task_name TEXT NOT NULL,
  payload JSONB,
  error_message TEXT,
  attempts INTEGER,
  failed_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  resolved_by TEXT
);

COMMENT ON TABLE bot_dead_letter_queue IS 'Tarefas falhas para análise e resolução manual';

CREATE INDEX idx_bot_dlq_resolved ON bot_dead_letter_queue(resolved_at) WHERE resolved_at IS NULL;

-- =====================================================
-- 9. VIEWS
-- =====================================================

-- View: Resumo de atividades
CREATE OR REPLACE VIEW bot_activity_summary AS
SELECT 
  DATE(started_at) as date,
  task_name,
  COUNT(*) as executions,
  SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN status = 'FAILURE' THEN 1 ELSE 0 END) as failure_count,
  SUM(records_processed) as total_processed,
  AVG(duration_ms)::INTEGER as avg_duration_ms
FROM bot_logs
WHERE started_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(started_at), task_name
ORDER BY date DESC, task_name;

-- View: Notificações pendentes por usuário
CREATE OR REPLACE VIEW bot_pending_notifications AS
SELECT 
  bu.name as user_name,
  bu.email,
  COUNT(*) FILTER (WHERE bn.status = 'pending') as pending,
  COUNT(*) FILTER (WHERE bn.status = 'sent') as sent_today,
  COUNT(*) FILTER (WHERE bn.status = 'read') as read_today
FROM bot_users bu
LEFT JOIN bot_notifications bn ON bu.id = bn.user_id AND bn.created_at >= CURRENT_DATE
WHERE bu.is_active = true AND bu.email != 'botella@system.local'
GROUP BY bu.id, bu.name, bu.email;

-- =====================================================
-- 10. FUNCTIONS
-- =====================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_bot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS trg_bot_users_updated ON bot_users;
CREATE TRIGGER trg_bot_users_updated
  BEFORE UPDATE ON bot_users
  FOR EACH ROW EXECUTE FUNCTION update_bot_updated_at();

DROP TRIGGER IF EXISTS trg_bot_tasks_updated ON bot_tasks;
CREATE TRIGGER trg_bot_tasks_updated
  BEFORE UPDATE ON bot_tasks
  FOR EACH ROW EXECUTE FUNCTION update_bot_updated_at();

-- =====================================================
-- 11. GRANTS
-- =====================================================
GRANT SELECT, INSERT, UPDATE ON bot_users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON bot_tasks TO authenticated;
GRANT SELECT, INSERT ON bot_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON bot_notifications TO authenticated;
GRANT SELECT ON bot_notification_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bot_notification_rules TO authenticated;
GRANT SELECT ON bot_workflows TO authenticated;
GRANT SELECT, INSERT, UPDATE ON bot_dead_letter_queue TO authenticated;
GRANT SELECT ON bot_activity_summary TO authenticated;
GRANT SELECT ON bot_pending_notifications TO authenticated;

-- =====================================================
-- DONE
-- =====================================================
SELECT 'BOTella v2 installed successfully!' as status,
       (SELECT COUNT(*) FROM bot_tasks) as tasks_count,
       (SELECT COUNT(*) FROM bot_users) as users_count,
       (SELECT COUNT(*) FROM bot_notification_templates) as templates_count;
