-- ============================================
-- CORREÇÃO COMPLETA - TODAS AS TABELAS
-- Supabase Security Advisor
-- Data: 30/01/2026
-- ============================================

-- ============================================
-- 1. HABILITAR RLS EM TODAS AS TABELAS COM rowsecurity = false
-- ============================================

ALTER TABLE
IF EXISTS accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS bot_dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS bot_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS bot_notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS bot_notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS bot_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS bot_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS bot_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS bot_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS cost_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS dep_cost_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS entry_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS global_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS order_transaction_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS quickbooks_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS quickbooks_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS quickbooks_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS quickbooks_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS sync_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS system_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS vendor_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE
IF EXISTS vendors_mapping ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. CRIAR POLÍTICAS PARA TODAS AS TABELAS
-- ============================================

-- accounts_payable
CREATE POLICY "auth_all_accounts_payable" ON accounts_payable FOR ALL TO authenticated USING
(true) WITH CHECK
(true);

-- bot_* tables (acesso para service_role e authenticated)
CREATE POLICY "auth_all_bot_dead_letter_queue" ON bot_dead_letter_queue FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_bot_logs" ON bot_logs FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_bot_notification_rules" ON bot_notification_rules FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_bot_notification_templates" ON bot_notification_templates FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_bot_notifications" ON bot_notifications FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_bot_tasks" ON bot_tasks FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_bot_users" ON bot_users FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_bot_workflows" ON bot_workflows FOR ALL TO authenticated USING
(true) WITH CHECK
(true);

-- channel/messages
CREATE POLICY "auth_all_channel_members" ON channel_members FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_channels" ON channels FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_messages" ON messages FOR ALL TO authenticated USING
(true) WITH CHECK
(true);

-- companies
CREATE POLICY "auth_all_companies" ON companies FOR ALL TO authenticated USING
(true) WITH CHECK
(true);

-- lookup/reference tables (SELECT only para anon, ALL para authenticated)
CREATE POLICY "auth_all_cost_types" ON cost_types FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_countries" ON countries FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_courses" ON courses FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_currencies" ON currencies FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_dep_cost_types" ON dep_cost_types FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_entry_types" ON entry_types FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_exchange_rates" ON exchange_rates FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_global_providers" ON global_providers FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_payment_methods" ON payment_methods FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_roles" ON roles FOR ALL TO authenticated USING
(true) WITH CHECK
(true);

-- integrations
CREATE POLICY "auth_all_integrations" ON integrations FOR ALL TO authenticated USING
(true) WITH CHECK
(true);

-- order mappings
CREATE POLICY "auth_all_order_transaction_mapping" ON order_transaction_mapping FOR ALL TO authenticated USING
(true) WITH CHECK
(true);

-- quickbooks (sensível - apenas authenticated)
CREATE POLICY "auth_all_quickbooks_accounts" ON quickbooks_accounts FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_quickbooks_customers" ON quickbooks_customers FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_quickbooks_tokens" ON quickbooks_tokens FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_quickbooks_vendors" ON quickbooks_vendors FOR ALL TO authenticated USING
(true) WITH CHECK
(true);

-- sync/system
CREATE POLICY "auth_all_sync_metadata" ON sync_metadata FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_system_roles" ON system_roles FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_system_settings" ON system_settings FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_system_users" ON system_users FOR ALL TO authenticated USING
(true) WITH CHECK
(true);

-- user permissions/sessions
CREATE POLICY "auth_all_user_permissions" ON user_permissions FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_user_sessions" ON user_sessions FOR ALL TO authenticated USING
(true) WITH CHECK
(true);

-- vendors
CREATE POLICY "auth_all_vendor_sequences" ON vendor_sequences FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_vendors" ON vendors FOR ALL TO authenticated USING
(true) WITH CHECK
(true);
CREATE POLICY "auth_all_vendors_mapping" ON vendors_mapping FOR ALL TO authenticated USING
(true) WITH CHECK
(true);

-- ============================================
-- 3. REVOGAR ACESSO ANÔNIMO DE TODAS AS TABELAS
-- ============================================

REVOKE ALL ON accounts_payable FROM anon;
REVOKE ALL ON bot_dead_letter_queue FROM anon;
REVOKE ALL ON bot_logs FROM anon;
REVOKE ALL ON bot_notification_rules FROM anon;
REVOKE ALL ON bot_notification_templates FROM anon;
REVOKE ALL ON bot_notifications FROM anon;
REVOKE ALL ON bot_tasks FROM anon;
REVOKE ALL ON bot_users FROM anon;
REVOKE ALL ON bot_workflows FROM anon;
REVOKE ALL ON channel_members FROM anon;
REVOKE ALL ON channels FROM anon;
REVOKE ALL ON companies FROM anon;
REVOKE ALL ON cost_types FROM anon;
REVOKE ALL ON countries FROM anon;
REVOKE ALL ON courses FROM anon;
REVOKE ALL ON currencies FROM anon;
REVOKE ALL ON dep_cost_types FROM anon;
REVOKE ALL ON entry_types FROM anon;
REVOKE ALL ON exchange_rates FROM anon;
REVOKE ALL ON global_providers FROM anon;
REVOKE ALL ON integrations FROM anon;
REVOKE ALL ON messages FROM anon;
REVOKE ALL ON order_transaction_mapping FROM anon;
REVOKE ALL ON payment_methods FROM anon;
REVOKE ALL ON quickbooks_accounts FROM anon;
REVOKE ALL ON quickbooks_customers FROM anon;
REVOKE ALL ON quickbooks_tokens FROM anon;
REVOKE ALL ON quickbooks_vendors FROM anon;
REVOKE ALL ON roles FROM anon;
REVOKE ALL ON sync_metadata FROM anon;
REVOKE ALL ON system_roles FROM anon;
REVOKE ALL ON system_settings FROM anon;
REVOKE ALL ON system_users FROM anon;
REVOKE ALL ON user_permissions FROM anon;
REVOKE ALL ON user_sessions FROM anon;
REVOKE ALL ON vendor_sequences FROM anon;
REVOKE ALL ON vendors FROM anon;
REVOKE ALL ON vendors_mapping FROM anon;

-- ============================================
-- 4. GARANTIR ACESSO PARA AUTHENTICATED
-- ============================================

GRANT ALL ON accounts_payable TO authenticated;
GRANT ALL ON bot_dead_letter_queue TO authenticated;
GRANT ALL ON bot_logs TO authenticated;
GRANT ALL ON bot_notification_rules TO authenticated;
GRANT ALL ON bot_notification_templates TO authenticated;
GRANT ALL ON bot_notifications TO authenticated;
GRANT ALL ON bot_tasks TO authenticated;
GRANT ALL ON bot_users TO authenticated;
GRANT ALL ON bot_workflows TO authenticated;
GRANT ALL ON channel_members TO authenticated;
GRANT ALL ON channels TO authenticated;
GRANT ALL ON companies TO authenticated;
GRANT ALL ON cost_types TO authenticated;
GRANT ALL ON countries TO authenticated;
GRANT ALL ON courses TO authenticated;
GRANT ALL ON currencies TO authenticated;
GRANT ALL ON dep_cost_types TO authenticated;
GRANT ALL ON entry_types TO authenticated;
GRANT ALL ON exchange_rates TO authenticated;
GRANT ALL ON global_providers TO authenticated;
GRANT ALL ON integrations TO authenticated;
GRANT ALL ON messages TO authenticated;
GRANT ALL ON order_transaction_mapping TO authenticated;
GRANT ALL ON payment_methods TO authenticated;
GRANT ALL ON quickbooks_accounts TO authenticated;
GRANT ALL ON quickbooks_customers TO authenticated;
GRANT ALL ON quickbooks_tokens TO authenticated;
GRANT ALL ON quickbooks_vendors TO authenticated;
GRANT ALL ON roles TO authenticated;
GRANT ALL ON sync_metadata TO authenticated;
GRANT ALL ON system_roles TO authenticated;
GRANT ALL ON system_settings TO authenticated;
GRANT ALL ON system_users TO authenticated;
GRANT ALL ON user_permissions TO authenticated;
GRANT ALL ON user_sessions TO authenticated;
GRANT ALL ON vendor_sequences TO authenticated;
GRANT ALL ON vendors TO authenticated;
GRANT ALL ON vendors_mapping TO authenticated;

-- ============================================
-- 5. VERIFICAÇÃO FINAL
-- ============================================

SELECT
    tablename,
    rowsecurity,
    CASE WHEN rowsecurity THEN '✅' ELSE '❌' END as status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;
