-- Migration: Create ar_invoices table for Accounts Receivable
-- Date: 2026-01-29

-- Table: ar_invoices (Accounts Receivable Invoices)
CREATE TABLE IF NOT EXISTS ar_invoices (
    id BIGSERIAL PRIMARY KEY,
    
    -- Datas importantes
    input_date DATE NOT NULL DEFAULT CURRENT_DATE,
    invoice_date DATE NOT NULL,
    due_date DATE,
    payment_date DATE,
    
    -- Tipo e status
    invoice_type TEXT NOT NULL DEFAULT 'REVENUE' CHECK (invoice_type IN ('REVENUE', 'BUDGET', 'ADJUSTMENT')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'sent', 'paid', 'partial', 'overdue', 'cancelled')),
    
    -- Valores
    invoice_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'EUR',
    eur_exchange NUMERIC(10,6) NOT NULL DEFAULT 1.0,
    paid_amount NUMERIC(15,2) DEFAULT 0,
    
    -- Referências
    invoice_number TEXT,
    customer_code TEXT NOT NULL,
    customer_name TEXT,
    
    -- Contas e classificação
    financial_account_code TEXT,
    financial_account_name TEXT,
    bank_account_code TEXT,
    cost_center_code TEXT,
    revenue_center_code TEXT,
    
    -- Curso (para DSD)
    course_code TEXT,
    course_name TEXT,
    
    -- Método de pagamento
    payment_method_code TEXT,
    payment_channel TEXT, -- stripe, paypal, braintree, gocardless, bank_transfer
    
    -- Descrição
    description TEXT,
    notes TEXT,
    
    -- Escopo geográfico
    country_code TEXT NOT NULL DEFAULT 'ES',
    scope TEXT NOT NULL DEFAULT 'ES',
    
    -- Impactos contábeis
    dre_impact BOOLEAN NOT NULL DEFAULT TRUE,
    cash_impact BOOLEAN NOT NULL DEFAULT TRUE,
    is_intercompany BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Reconciliação
    is_reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMPTZ,
    reconciled_by TEXT,
    matched_transaction_id BIGINT,
    
    -- Parcelamento/Split
    is_split BOOLEAN DEFAULT FALSE,
    parent_invoice_id BIGINT REFERENCES ar_invoices(id),
    split_number INTEGER,
    total_splits INTEGER,
    
    -- Origem automática (HubSpot, Stripe, etc.)
    source TEXT, -- hubspot, stripe, braintree, manual
    source_id TEXT, -- ID externo
    source_data JSONB, -- Dados originais da fonte
    
    -- Auditoria
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT,
    
    -- Índices
    CONSTRAINT ar_invoices_invoice_number_unique UNIQUE (invoice_number, scope)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ar_invoices_customer ON ar_invoices(customer_code);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_date ON ar_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_due_date ON ar_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_status ON ar_invoices(status);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_scope ON ar_invoices(scope);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_type ON ar_invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_source ON ar_invoices(source, source_id);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_reconciled ON ar_invoices(is_reconciled) WHERE is_reconciled = FALSE;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_ar_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ar_invoices_updated_at ON ar_invoices;
CREATE TRIGGER trigger_ar_invoices_updated_at
    BEFORE UPDATE ON ar_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_ar_invoices_updated_at();

-- RLS (Row Level Security)
ALTER TABLE ar_invoices ENABLE ROW LEVEL SECURITY;

-- Policy para leitura (todos podem ler)
DROP POLICY IF EXISTS ar_invoices_read_policy ON ar_invoices;
CREATE POLICY ar_invoices_read_policy ON ar_invoices
    FOR SELECT USING (true);

-- Policy para insert/update/delete (todos podem por enquanto)
DROP POLICY IF EXISTS ar_invoices_write_policy ON ar_invoices;
CREATE POLICY ar_invoices_write_policy ON ar_invoices
    FOR ALL USING (true);

-- Comentários
COMMENT ON TABLE ar_invoices IS 'Faturas de Contas a Receber (Accounts Receivable)';
COMMENT ON COLUMN ar_invoices.invoice_type IS 'REVENUE = Receita real, BUDGET = Orçamento, ADJUSTMENT = Ajuste';
COMMENT ON COLUMN ar_invoices.source IS 'Origem: hubspot, stripe, braintree, gocardless, manual';
COMMENT ON COLUMN ar_invoices.source_data IS 'Dados JSON originais da fonte externa';
