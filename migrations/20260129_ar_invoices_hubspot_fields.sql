-- Migration: AR Invoices com campos do HubSpot/Backend
-- Date: 2026-01-29
-- Execute no Supabase Dashboard > SQL Editor

-- Remover tabela antiga se existir
DROP TABLE IF EXISTS ar_invoices CASCADE;

-- Criar tabela com campos do relatório HubSpot
CREATE TABLE ar_invoices (
    id BIGSERIAL PRIMARY KEY,
    
    -- Campos do relatório HubSpot (mapeados)
    invoice_number TEXT NOT NULL,              -- Number (#DSDFS4F46AC9-53077)
    order_id TEXT,                             -- Order (4f46ac9)
    order_date DATE,                           -- Order Date
    order_status TEXT,                         -- Order Status (Subscription Plan, Single Payment, etc.)
    invoice_date DATE NOT NULL,                -- Invoice Date (campo principal para lançamento automático)
    products TEXT,                             -- Products (Level 1 Subscription - DO NOT DELETE)
    company_name TEXT,                         -- Company
    client_name TEXT,                          -- Client
    email TEXT,                                -- Email
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,  -- Total
    currency TEXT NOT NULL DEFAULT 'EUR',      -- Currency
    charged_amount NUMERIC(15,2),              -- Charged (pode ser NULL ou "-")
    payment_method TEXT,                       -- Payment Method (Braintree, Stripe, GoCardless, etc.)
    billing_entity TEXT,                       -- Billing Entity (Planning Center SL.)
    note TEXT,                                 -- Note
    discount_code TEXT,                        -- Discount Code
    discount_names TEXT,                       -- Discount Names
    
    -- Campos de controle de status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'sent', 'paid', 'partial', 'overdue', 'cancelled')),
    due_date DATE,
    payment_date DATE,
    
    -- Campos de escopo geográfico
    country_code TEXT NOT NULL DEFAULT 'ES',
    scope TEXT NOT NULL DEFAULT 'ES',
    
    -- Origem dos dados (para rastreamento)
    source TEXT DEFAULT 'hubspot',             -- hubspot, stripe, braintree, gocardless, manual
    source_id TEXT,                            -- ID original da fonte
    source_data JSONB,                         -- Dados JSON completos da fonte
    
    -- Campos de auditoria
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT,
    
    -- Constraint para evitar duplicatas
    CONSTRAINT ar_invoices_number_scope_unique UNIQUE (invoice_number, scope)
);

-- Índices para performance
CREATE INDEX idx_ar_invoices_number ON ar_invoices(invoice_number);
CREATE INDEX idx_ar_invoices_order ON ar_invoices(order_id);
CREATE INDEX idx_ar_invoices_invoice_date ON ar_invoices(invoice_date DESC);
CREATE INDEX idx_ar_invoices_order_date ON ar_invoices(order_date DESC);
CREATE INDEX idx_ar_invoices_company ON ar_invoices(company_name);
CREATE INDEX idx_ar_invoices_client ON ar_invoices(client_name);
CREATE INDEX idx_ar_invoices_email ON ar_invoices(email);
CREATE INDEX idx_ar_invoices_status ON ar_invoices(status);
CREATE INDEX idx_ar_invoices_scope ON ar_invoices(scope);
CREATE INDEX idx_ar_invoices_source ON ar_invoices(source, source_id);
CREATE INDEX idx_ar_invoices_payment_method ON ar_invoices(payment_method);
CREATE INDEX idx_ar_invoices_billing_entity ON ar_invoices(billing_entity);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_ar_invoices_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ar_invoices_updated ON ar_invoices;
CREATE TRIGGER trigger_ar_invoices_updated
    BEFORE UPDATE ON ar_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_ar_invoices_timestamp();

-- RLS (Row Level Security)
ALTER TABLE ar_invoices ENABLE ROW LEVEL SECURITY;

-- Policies permissivas (ajustar conforme necessidade)
DROP POLICY IF EXISTS ar_invoices_select_policy ON ar_invoices;
CREATE POLICY ar_invoices_select_policy ON ar_invoices FOR SELECT USING (true);

DROP POLICY IF EXISTS ar_invoices_insert_policy ON ar_invoices;
CREATE POLICY ar_invoices_insert_policy ON ar_invoices FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS ar_invoices_update_policy ON ar_invoices;
CREATE POLICY ar_invoices_update_policy ON ar_invoices FOR UPDATE USING (true);

DROP POLICY IF EXISTS ar_invoices_delete_policy ON ar_invoices;
CREATE POLICY ar_invoices_delete_policy ON ar_invoices FOR DELETE USING (true);

-- Comentários para documentação
COMMENT ON TABLE ar_invoices IS 'Faturas de Contas a Receber (AR) - sincronizadas do HubSpot/Backend';
COMMENT ON COLUMN ar_invoices.invoice_number IS 'Número da fatura (ex: #DSDFS4F46AC9-53077)';
COMMENT ON COLUMN ar_invoices.order_id IS 'ID do pedido no sistema origem';
COMMENT ON COLUMN ar_invoices.invoice_date IS 'Data da fatura - usado para lançamento automático';
COMMENT ON COLUMN ar_invoices.source IS 'Origem: hubspot, stripe, braintree, gocardless, manual';
COMMENT ON COLUMN ar_invoices.billing_entity IS 'Entidade de faturamento (Planning Center SL., DSD ESP, etc.)';
