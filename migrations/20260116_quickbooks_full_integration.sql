-- =====================================================
-- QUICKBOOKS FULL INTEGRATION
-- Migração completa para integração QuickBooks (Escopo: EUA/USD)
-- Data: 2026-01-16
-- =====================================================

-- =====================================================
-- 1. ADICIONAR QUICKBOOKS AO SYNC_METADATA
-- =====================================================

INSERT INTO sync_metadata (source, sync_config) VALUES
  ('quickbooks-usd', '{
    "fullSyncIntervalDays": 7,
    "incrementalSyncIntervalHours": 24,
    "scope": "US",
    "currency": "USD",
    "entities": ["invoices", "payments", "bills", "expenses", "customers", "vendors"],
    "description": "QuickBooks Online - DSD Planning LLC (USA)"
  }'::jsonb)
ON CONFLICT (source) DO UPDATE SET
  sync_config = EXCLUDED.sync_config,
  updated_at = NOW();

-- =====================================================
-- 2. ÍNDICES OTIMIZADOS PARA QUICKBOOKS
-- =====================================================

-- Índice para queries por source QuickBooks
CREATE INDEX IF NOT EXISTS idx_csv_rows_quickbooks 
ON csv_rows(source, date DESC) 
WHERE source LIKE 'quickbooks-%';

-- Índice para busca por quickbooks_id no custom_data
CREATE INDEX IF NOT EXISTS idx_csv_rows_quickbooks_id 
ON csv_rows((custom_data->>'quickbooks_id')) 
WHERE source LIKE 'quickbooks-%';

-- Índice para busca por doc_number (número da fatura/bill)
CREATE INDEX IF NOT EXISTS idx_csv_rows_quickbooks_doc_number 
ON csv_rows((custom_data->>'doc_number')) 
WHERE source LIKE 'quickbooks-%';

-- Índice para busca por customer_id
CREATE INDEX IF NOT EXISTS idx_csv_rows_quickbooks_customer_id 
ON csv_rows((custom_data->>'customer_id')) 
WHERE source LIKE 'quickbooks-%';

-- Índice para busca por vendor_id
CREATE INDEX IF NOT EXISTS idx_csv_rows_quickbooks_vendor_id 
ON csv_rows((custom_data->>'vendor_id')) 
WHERE source LIKE 'quickbooks-%';

-- Índice composto para reconciliação
CREATE INDEX IF NOT EXISTS idx_csv_rows_quickbooks_reconciliation
ON csv_rows(source, reconciled, date DESC)
WHERE source LIKE 'quickbooks-%';

-- =====================================================
-- 3. TABELA DE CLIENTES QUICKBOOKS (MASTER DATA)
-- =====================================================

CREATE TABLE IF NOT EXISTS quickbooks_customers (
  id TEXT PRIMARY KEY, -- QuickBooks Customer ID
  display_name TEXT NOT NULL,
  company_name TEXT,
  given_name TEXT,
  family_name TEXT,
  email TEXT,
  phone TEXT,
  
  -- Endereço de cobrança
  billing_address JSONB,
  
  -- Endereço de entrega
  shipping_address JSONB,
  
  -- Status
  active BOOLEAN DEFAULT true,
  balance DECIMAL(15,2) DEFAULT 0,
  
  -- Metadata
  currency_ref TEXT DEFAULT 'USD',
  notes TEXT,
  
  -- Timestamps
  quickbooks_created_at TIMESTAMPTZ,
  quickbooks_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para customers
CREATE INDEX IF NOT EXISTS idx_qb_customers_email ON quickbooks_customers(email);
CREATE INDEX IF NOT EXISTS idx_qb_customers_active ON quickbooks_customers(active);
CREATE INDEX IF NOT EXISTS idx_qb_customers_balance ON quickbooks_customers(balance) WHERE balance > 0;

-- =====================================================
-- 4. TABELA DE FORNECEDORES QUICKBOOKS (MASTER DATA)
-- =====================================================

CREATE TABLE IF NOT EXISTS quickbooks_vendors (
  id TEXT PRIMARY KEY, -- QuickBooks Vendor ID
  display_name TEXT NOT NULL,
  company_name TEXT,
  given_name TEXT,
  family_name TEXT,
  email TEXT,
  phone TEXT,
  
  -- Endereço
  billing_address JSONB,
  
  -- Informações fiscais
  tax_identifier TEXT,
  vendor_1099 BOOLEAN DEFAULT false,
  
  -- Status
  active BOOLEAN DEFAULT true,
  balance DECIMAL(15,2) DEFAULT 0,
  
  -- Metadata
  currency_ref TEXT DEFAULT 'USD',
  account_number TEXT,
  terms_ref TEXT,
  
  -- Timestamps
  quickbooks_created_at TIMESTAMPTZ,
  quickbooks_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para vendors
CREATE INDEX IF NOT EXISTS idx_qb_vendors_email ON quickbooks_vendors(email);
CREATE INDEX IF NOT EXISTS idx_qb_vendors_active ON quickbooks_vendors(active);
CREATE INDEX IF NOT EXISTS idx_qb_vendors_1099 ON quickbooks_vendors(vendor_1099) WHERE vendor_1099 = true;

-- =====================================================
-- 5. TABELA DE CONTAS QUICKBOOKS (CHART OF ACCOUNTS)
-- =====================================================

CREATE TABLE IF NOT EXISTS quickbooks_accounts (
  id TEXT PRIMARY KEY, -- QuickBooks Account ID
  name TEXT NOT NULL,
  account_type TEXT NOT NULL, -- Bank, Expense, Income, etc.
  account_sub_type TEXT,
  
  -- Classificação
  classification TEXT, -- Asset, Liability, Equity, Revenue, Expense
  
  -- Saldos
  current_balance DECIMAL(15,2) DEFAULT 0,
  current_balance_with_subs DECIMAL(15,2) DEFAULT 0,
  
  -- Hierarquia
  parent_ref TEXT,
  fully_qualified_name TEXT,
  
  -- Status
  active BOOLEAN DEFAULT true,
  
  -- Metadata
  currency_ref TEXT DEFAULT 'USD',
  description TEXT,
  
  -- Timestamps
  quickbooks_created_at TIMESTAMPTZ,
  quickbooks_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para accounts
CREATE INDEX IF NOT EXISTS idx_qb_accounts_type ON quickbooks_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_qb_accounts_classification ON quickbooks_accounts(classification);
CREATE INDEX IF NOT EXISTS idx_qb_accounts_active ON quickbooks_accounts(active);
CREATE INDEX IF NOT EXISTS idx_qb_accounts_parent ON quickbooks_accounts(parent_ref);

-- =====================================================
-- 6. VIEWS ÚTEIS PARA QUICKBOOKS
-- =====================================================

-- View: Transações QuickBooks consolidadas
CREATE OR REPLACE VIEW v_quickbooks_transactions AS
SELECT 
  id,
  source,
  date,
  description,
  amount::DECIMAL(15,2) as amount,
  COALESCE(custom_data->>'currency', 'USD') as currency,
  COALESCE(custom_data->>'doc_number', '') as doc_number,
  COALESCE(custom_data->>'customer_name', custom_data->>'vendor_name', '') as counterparty,
  COALESCE(custom_data->>'quickbooks_id', '') as quickbooks_id,
  reconciled,
  custom_data,
  created_at,
  updated_at
FROM csv_rows
WHERE source LIKE 'quickbooks-%'
ORDER BY date DESC;

-- View: Resumo por tipo de transação QuickBooks
CREATE OR REPLACE VIEW v_quickbooks_summary AS
SELECT 
  source,
  COUNT(*) as total_count,
  SUM(amount::DECIMAL(15,2)) as total_amount,
  SUM(CASE WHEN reconciled THEN amount::DECIMAL(15,2) ELSE 0 END) as reconciled_amount,
  COUNT(CASE WHEN reconciled THEN 1 END) as reconciled_count,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM csv_rows
WHERE source LIKE 'quickbooks-%'
GROUP BY source;

-- View: Faturas pendentes (Accounts Receivable)
CREATE OR REPLACE VIEW v_quickbooks_open_invoices AS
SELECT 
  id,
  date,
  custom_data->>'doc_number' as invoice_number,
  custom_data->>'customer_name' as customer_name,
  amount::DECIMAL(15,2) as total_amount,
  (custom_data->>'balance')::DECIMAL(15,2) as balance_due,
  custom_data->>'due_date' as due_date,
  CASE 
    WHEN (custom_data->>'due_date')::DATE < CURRENT_DATE THEN 'overdue'
    WHEN (custom_data->>'due_date')::DATE <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
    ELSE 'current'
  END as status,
  custom_data
FROM csv_rows
WHERE source = 'quickbooks-invoices'
  AND (custom_data->>'balance')::DECIMAL(15,2) > 0
ORDER BY (custom_data->>'due_date')::DATE ASC;

-- View: Contas a Pagar (Accounts Payable)
CREATE OR REPLACE VIEW v_quickbooks_open_bills AS
SELECT 
  id,
  date,
  custom_data->>'doc_number' as bill_number,
  custom_data->>'vendor_name' as vendor_name,
  amount::DECIMAL(15,2) as total_amount,
  (custom_data->>'balance')::DECIMAL(15,2) as balance_due,
  custom_data->>'due_date' as due_date,
  CASE 
    WHEN (custom_data->>'due_date')::DATE < CURRENT_DATE THEN 'overdue'
    WHEN (custom_data->>'due_date')::DATE <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
    ELSE 'current'
  END as status,
  custom_data
FROM csv_rows
WHERE source = 'quickbooks-bills'
  AND (custom_data->>'balance')::DECIMAL(15,2) > 0
ORDER BY (custom_data->>'due_date')::DATE ASC;

-- =====================================================
-- 7. TRIGGERS PARA UPDATED_AT
-- =====================================================

-- Trigger para quickbooks_customers
CREATE OR REPLACE FUNCTION update_quickbooks_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quickbooks_customers_updated_at ON quickbooks_customers;
CREATE TRIGGER quickbooks_customers_updated_at
  BEFORE UPDATE ON quickbooks_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_quickbooks_customers_updated_at();

-- Trigger para quickbooks_vendors
CREATE OR REPLACE FUNCTION update_quickbooks_vendors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quickbooks_vendors_updated_at ON quickbooks_vendors;
CREATE TRIGGER quickbooks_vendors_updated_at
  BEFORE UPDATE ON quickbooks_vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_quickbooks_vendors_updated_at();

-- Trigger para quickbooks_accounts
CREATE OR REPLACE FUNCTION update_quickbooks_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quickbooks_accounts_updated_at ON quickbooks_accounts;
CREATE TRIGGER quickbooks_accounts_updated_at
  BEFORE UPDATE ON quickbooks_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_quickbooks_accounts_updated_at();

-- =====================================================
-- 8. RLS (Row Level Security) - OPCIONAL
-- =====================================================

-- Se precisar habilitar RLS no futuro:
-- ALTER TABLE quickbooks_customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE quickbooks_vendors ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE quickbooks_accounts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 9. COMENTÁRIOS NAS TABELAS
-- =====================================================

COMMENT ON TABLE quickbooks_customers IS 'Clientes sincronizados do QuickBooks Online (EUA)';
COMMENT ON TABLE quickbooks_vendors IS 'Fornecedores sincronizados do QuickBooks Online (EUA)';
COMMENT ON TABLE quickbooks_accounts IS 'Plano de Contas sincronizado do QuickBooks Online (EUA)';

COMMENT ON VIEW v_quickbooks_transactions IS 'Todas as transações QuickBooks consolidadas';
COMMENT ON VIEW v_quickbooks_summary IS 'Resumo de transações por tipo';
COMMENT ON VIEW v_quickbooks_open_invoices IS 'Faturas abertas (Accounts Receivable)';
COMMENT ON VIEW v_quickbooks_open_bills IS 'Contas a pagar abertas (Accounts Payable)';

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

-- Verificar se tudo foi criado corretamente:
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'quickbooks_%';
-- SELECT * FROM sync_metadata WHERE source = 'quickbooks-usd';
-- SELECT indexname FROM pg_indexes WHERE tablename LIKE 'quickbooks_%' OR indexname LIKE 'idx_csv_rows_quickbooks%';
