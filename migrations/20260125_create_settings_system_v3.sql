-- =====================================================
-- MIGRAÇÃO: Sistema Completo de Configurações v3
-- Data: 2026-01-25
-- Inclui: Usuários, Auditoria, BOTella, Permissões
-- =====================================================

-- ============================================
-- 1. TABELA DE USUÁRIOS DO SISTEMA
-- ============================================
CREATE TABLE IF NOT EXISTS system_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'editor', 'viewer')),
  department TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================
-- 2. TABELA DE PAPÉIS E PERMISSÕES
-- ============================================
CREATE TABLE IF NOT EXISTS system_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. LOGS DE AUDITORIA
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. CONFIGURAÇÕES DO SISTEMA (KEY-VALUE)
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  is_sensitive BOOLEAN DEFAULT false,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, key)
);

-- ============================================
-- 5. SESSÕES DE USUÁRIO
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  token_hash TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. INTEGRAÇÕES EXTERNAS
-- ============================================
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  config JSONB DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  sync_frequency TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. USUÁRIOS DO BOT (se não existir)
-- ============================================
CREATE TABLE IF NOT EXISTS bot_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'viewer',
  is_active BOOLEAN DEFAULT true,
  notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. TAREFAS DO BOT
-- ============================================
CREATE TABLE IF NOT EXISTS bot_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL CHECK (task_type IN ('sync', 'reconciliation', 'report', 'notification', 'cleanup', 'backup')),
  cron_expression TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  rate_limit_per_minute INTEGER DEFAULT 60,
  timeout_seconds INTEGER DEFAULT 300,
  config JSONB DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  last_status TEXT CHECK (last_status IN ('PENDING', 'STARTED', 'SUCCESS', 'FAILURE', 'RETRY', 'REVOKED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. LOGS DO BOT
-- ============================================
CREATE TABLE IF NOT EXISTS bot_logs (
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

-- ============================================
-- 10. NOTIFICAÇÕES DO BOT
-- ============================================
CREATE TABLE IF NOT EXISTS bot_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'sms', 'in_app')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'read')),
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. TEMPLATES DE NOTIFICAÇÃO
-- ============================================
CREATE TABLE IF NOT EXISTS bot_notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'sms', 'in_app')),
  subject TEXT,
  body_template TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. REGRAS DE NOTIFICAÇÃO
-- ============================================
CREATE TABLE IF NOT EXISTS bot_notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  channels TEXT[] DEFAULT ARRAY['email', 'in_app'],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 13. WORKFLOWS DO BOT
-- ============================================
CREATE TABLE IF NOT EXISTS bot_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 14. DEAD LETTER QUEUE
-- ============================================
CREATE TABLE IF NOT EXISTS bot_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_log_id UUID,
  task_name TEXT NOT NULL,
  payload JSONB,
  error_message TEXT,
  attempts INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reprocessed', 'discarded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_users_email ON system_users(email);
CREATE INDEX IF NOT EXISTS idx_system_users_role ON system_users(role);
CREATE INDEX IF NOT EXISTS idx_bot_logs_task ON bot_logs(task_name);
CREATE INDEX IF NOT EXISTS idx_bot_logs_status ON bot_logs(status);
CREATE INDEX IF NOT EXISTS idx_bot_logs_started ON bot_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_notifications_user ON bot_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_notifications_status ON bot_notifications(status);

-- ============================================
-- DADOS INICIAIS: PAPÉIS
-- ============================================
INSERT INTO system_roles (name, description, permissions, is_system) VALUES
('admin', 'Administrador com acesso total', '["*"]'::jsonb, true),
('manager', 'Gerente com acesso de leitura/escrita', '["read", "write", "export", "manage_users"]'::jsonb, true),
('editor', 'Editor com acesso de leitura/escrita limitado', '["read", "write", "export"]'::jsonb, true),
('viewer', 'Visualizador apenas leitura', '["read"]'::jsonb, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- DADOS INICIAIS: USUÁRIOS DO SISTEMA
-- ============================================
INSERT INTO system_users (email, name, role, avatar_url, department) VALUES
('fernando@digitalsmiledesign.com', 'Fernando', 'admin', '/avatars/Fernando.png', 'Administração'),
('sofia@digitalsmiledesign.com', 'Sofia', 'manager', '/avatars/Sofia.png', 'Financeiro'),
('jorge@digitalsmiledesign.com', 'Jorge', 'editor', '/avatars/Jorge.png', 'Operações'),
('valeria@digitalsmiledesign.com', 'Valeria', 'viewer', '/avatars/Valeria.png', 'Suporte'),
('botella@system.local', 'BOTella', 'admin', '/avatars/botella.svg', 'Sistema')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- DADOS INICIAIS: USUÁRIOS DO BOT
-- ============================================
INSERT INTO bot_users (email, name, role, avatar_url, is_active) VALUES
('fernando@digitalsmiledesign.com', 'Fernando', 'admin', '/avatars/Fernando.png', true),
('sofia@digitalsmiledesign.com', 'Sofia', 'manager', '/avatars/Sofia.png', true),
('jorge@digitalsmiledesign.com', 'Jorge', 'editor', '/avatars/Jorge.png', true),
('valeria@digitalsmiledesign.com', 'Valeria', 'viewer', '/avatars/Valeria.png', true),
('botella@system.local', 'BOTella', 'admin', '/avatars/botella.svg', true)
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- DADOS INICIAIS: TAREFAS DO BOT
-- ============================================
INSERT INTO bot_tasks (task_key, name, description, task_type, cron_expression, is_active, priority, max_retries, timeout_seconds) VALUES
-- Sincronizações
('sync-braintree-eur', 'Sync Braintree EUR', 'Sincroniza transações Braintree em EUR', 'sync', '0 */2 * * *', true, 3, 3, 300),
('sync-braintree-usd', 'Sync Braintree USD', 'Sincroniza transações Braintree em USD', 'sync', '0 */2 * * *', true, 3, 3, 300),
('sync-braintree-gbp', 'Sync Braintree GBP', 'Sincroniza transações Braintree em GBP', 'sync', '0 */2 * * *', true, 3, 3, 300),
('sync-stripe-eur', 'Sync Stripe EUR', 'Sincroniza transações Stripe em EUR', 'sync', '0 */2 * * *', true, 3, 3, 300),
('sync-stripe-usd', 'Sync Stripe USD', 'Sincroniza transações Stripe em USD', 'sync', '0 */2 * * *', true, 3, 3, 300),
('sync-gocardless', 'Sync GoCardless', 'Sincroniza débitos diretos GoCardless', 'sync', '0 */2 * * *', true, 3, 3, 300),
('sync-hubspot', 'Sync HubSpot', 'Sincroniza deals do HubSpot', 'sync', '0 */4 * * *', true, 4, 3, 600),

-- Reconciliação
('auto-reconciliation', 'Reconciliação Automática', 'Executa matching automático de transações', 'reconciliation', '30 8 * * *', true, 2, 2, 600),
('reconciliation-report', 'Relatório de Reconciliação', 'Gera relatório de status de reconciliação', 'report', '0 9 * * *', true, 5, 1, 300),

-- Relatórios
('daily-summary', 'Resumo Diário', 'Envia resumo diário por email', 'notification', '0 8 * * *', true, 5, 2, 120),
('weekly-report', 'Relatório Semanal', 'Gera relatório semanal de fluxo de caixa', 'report', '0 9 * * 1', true, 5, 2, 600),

-- Manutenção
('cleanup-old-logs', 'Limpeza de Logs Antigos', 'Remove logs com mais de 90 dias', 'cleanup', '0 3 * * 0', true, 8, 1, 300),
('backup-database', 'Backup do Banco', 'Executa backup incremental', 'backup', '0 4 * * *', true, 1, 3, 1800)
ON CONFLICT (task_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  cron_expression = EXCLUDED.cron_expression,
  updated_at = NOW();

-- ============================================
-- DADOS INICIAIS: TEMPLATES DE NOTIFICAÇÃO
-- ============================================
INSERT INTO bot_notification_templates (name, event_type, channel, subject, body_template, is_active) VALUES
('Tarefa Concluída', 'task_success', 'email', 'BOTella: {{task_name}} concluída', 'Olá {{user_name}},\n\nA tarefa "{{task_name}}" foi concluída com sucesso.\n\nRegistros processados: {{records_processed}}\nDuração: {{duration}}', true),
('Tarefa Concluída (Push)', 'task_success', 'push', NULL, '✅ {{task_name}} concluída - {{records_processed}} registros', true),
('Tarefa Falhou', 'task_failure', 'email', '⚠️ BOTella: Falha em {{task_name}}', 'Olá {{user_name}},\n\nA tarefa "{{task_name}}" falhou após {{attempts}} tentativas.\n\nErro: {{error_message}}\n\nPor favor, verifique os logs para mais detalhes.', true),
('Tarefa Falhou (Push)', 'task_failure', 'push', NULL, '❌ {{task_name}} falhou - {{error_message}}', true),
('Reconciliação Completa', 'reconciliation_complete', 'email', 'BOTella: Reconciliação Concluída', 'Olá {{user_name}},\n\nA reconciliação automática foi concluída.\n\nTransações matched: {{matched}}\nPendentes: {{pending}}\nTaxa de match: {{match_rate}}%', true),
('Resumo Diário', 'daily_summary', 'email', 'BOTella: Resumo do Dia {{date}}', 'Bom dia {{user_name}},\n\nResumo das atividades de ontem:\n\n{{summary}}\n\nTenha um ótimo dia!', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- DADOS INICIAIS: REGRAS DE NOTIFICAÇÃO
-- ============================================
INSERT INTO bot_notification_rules (user_id, event_type, channels, is_active)
SELECT id, 'task_failure', ARRAY['email', 'push'], true FROM system_users WHERE role = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO bot_notification_rules (user_id, event_type, channels, is_active)
SELECT id, 'daily_summary', ARRAY['email'], true FROM system_users WHERE role IN ('admin', 'manager')
ON CONFLICT DO NOTHING;

-- ============================================
-- DADOS INICIAIS: CONFIGURAÇÕES
-- ============================================
INSERT INTO system_settings (category, key, value, description) VALUES
('general', 'company_name', '"DSD Power BI"'::jsonb, 'Nome da empresa'),
('general', 'timezone', '"Europe/Madrid"'::jsonb, 'Fuso horário padrão'),
('general', 'date_format', '"DD/MM/YYYY"'::jsonb, 'Formato de data'),
('general', 'currency', '"EUR"'::jsonb, 'Moeda padrão'),
('general', 'language', '"pt-BR"'::jsonb, 'Idioma padrão'),
('notifications', 'email_enabled', 'true'::jsonb, 'Ativar notificações por email'),
('notifications', 'push_enabled', 'true'::jsonb, 'Ativar notificações push'),
('notifications', 'digest_frequency', '"daily"'::jsonb, 'Frequência do resumo'),
('security', 'session_timeout_hours', '24'::jsonb, 'Timeout de sessão em horas'),
('security', 'require_2fa', 'false'::jsonb, 'Exigir autenticação 2FA'),
('security', 'password_min_length', '8'::jsonb, 'Tamanho mínimo de senha'),
('botella', 'auto_reconciliation', 'true'::jsonb, 'Reconciliação automática ativa'),
('botella', 'daily_report_time', '"08:00"'::jsonb, 'Horário do relatório diário'),
('botella', 'error_notifications', 'true'::jsonb, 'Notificar em caso de erro'),
('botella', 'log_retention_days', '90'::jsonb, 'Dias para manter logs')
ON CONFLICT (category, key) DO NOTHING;

-- ============================================
-- DADOS INICIAIS: INTEGRAÇÕES
-- ============================================
INSERT INTO integrations (name, provider, status, sync_frequency) VALUES
('Braintree', 'braintree', 'active', 'hourly'),
('Stripe', 'stripe', 'active', 'hourly'),
('GoCardless', 'gocardless', 'active', 'hourly'),
('HubSpot', 'hubspot', 'active', 'daily'),
('QuickBooks', 'quickbooks', 'inactive', 'manual'),
('Slack', 'slack', 'inactive', 'manual')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migração concluída com sucesso!';
  RAISE NOTICE '📊 Tabelas criadas: system_users, system_roles, audit_logs, system_settings, user_sessions, integrations, bot_users, bot_tasks, bot_logs, bot_notifications, bot_notification_templates, bot_notification_rules, bot_workflows, bot_dead_letter_queue';
  RAISE NOTICE '👤 Usuários: Fernando (admin), Sofia (manager), Jorge (editor), Valeria (viewer), BOTella (sistema)';
  RAISE NOTICE '🤖 Tarefas BOT: 13 tarefas pré-configuradas';
END $$;
