# Estrutura de Tabelas do Supabase

## ✅ Tabelas Existentes

### Core - Reconciliação e CSV
- **csv_files** (0 registros) - Metadados dos arquivos CSV carregados
- **csv_rows** (0 registros) - Linhas processadas dos CSVs (transações bancárias e pagamentos)

### Master Data - Accounts Payable
- **providers** (219 registros) - Fornecedores
- **bank_accounts** (8 registros) - Contas bancárias
- **payment_methods** (7 registros) - Métodos de pagamento
- **cost_types** (4 registros) - Tipos de custo
- **dep_cost_types** (4 registros) - Tipos de custo depreciativos
- **cost_centers** (10 registros) - Centros de custo
- **financial_accounts** (40 registros) - Contas financeiras

### Transações
- **invoices** (0 registros) - Faturas
- **invoice_items** (0 registros) - Itens das faturas

### Master Data - Accounts Receivable
- **customers** (0 registros) - Clientes
- **customer_groups** (0 registros) - Grupos de clientes
- **revenue_centers** (0 registros) - Centros de receita

### Configurações
- **chart_of_accounts** (0 registros) - Plano de contas
- **payment_terms** (0 registros) - Condições de pagamento
- **tax_configurations** (0 registros) - Configurações fiscais
- **approval_rules** (0 registros) - Regras de aprovação
- **posting_profiles** (0 registros) - Perfis de lançamento
- **credit_policies** (0 registros) - Políticas de crédito
- **dsd_courses** (0 registros) - Cursos DSD

## 🚧 Tabelas que Precisam Ser Criadas

### Accounts Receivable - Transações
- **ar_invoices** - Faturas de recebíveis
- **ar_credit_notes** - Notas de crédito
- **ar_payments** - Pagamentos recebidos
- **ar_receipts** - Recibos
- **payment_channels** - Canais de pagamento (Stripe, PayPal, etc.)

### Cash Management
- **bank_statements** - Extratos bancários consolidados
- **reconciliation_matches** - Matches de reconciliação
- **cash_flow_forecast** - Previsão de fluxo de caixa

### Executive Insights
- **kpi_metrics** - Métricas de KPIs
- **performance_analytics** - Analytics de performance
- **forecasts** - Previsões financeiras

### Multi-Country Support
- **companies** - Empresas (ES, US)
- **currencies** - Moedas e taxas de câmbio
- **country_configurations** - Configurações específicas por país

## 📊 Campos Importantes

### Scope/Company (Multi-Country)
Todas as tabelas principais devem ter:
- `scope` (text): 'ES', 'US', 'all'
- `company_id` (uuid): Referência à empresa

### Auditoria
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `created_by` (uuid)
- `updated_by` (uuid)

### Estado
- `is_active` (boolean)
- `status` (text): 'draft', 'pending', 'approved', 'posted', 'cancelled'

## 🔄 Próximos Passos

1. **Criar migrations** para as tabelas faltantes
2. **Implementar RLS (Row Level Security)** por company/scope
3. **Adicionar triggers** para auditoria automática
4. **Criar views** para relatórios consolidados
5. **Implementar policies** de acesso multi-tenant
