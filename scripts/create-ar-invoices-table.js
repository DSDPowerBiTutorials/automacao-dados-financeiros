// Script para criar a tabela ar_invoices via Supabase
// Execute: node scripts/create-ar-invoices-table.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
    console.log('🔧 Criando tabela ar_invoices...');

    // Verificar se tabela já existe
    const { data: existing, error: checkError } = await supabase
        .from('ar_invoices')
        .select('id')
        .limit(1);

    if (!checkError) {
        console.log('✅ Tabela ar_invoices já existe!');
        return;
    }

    if (checkError.code !== '42P01' && !checkError.message.includes('does not exist')) {
        console.log('ℹ️ Erro ao verificar tabela:', checkError.message);
    }

    console.log('📋 Tabela não existe. Execute o SQL abaixo no Supabase Dashboard:');
    console.log('');
    console.log('='.repeat(80));
    console.log(`
-- Copie e cole no Supabase Dashboard > SQL Editor:

CREATE TABLE IF NOT EXISTS ar_invoices (
    id BIGSERIAL PRIMARY KEY,
    input_date DATE NOT NULL DEFAULT CURRENT_DATE,
    invoice_date DATE NOT NULL,
    due_date DATE,
    payment_date DATE,
    invoice_type TEXT NOT NULL DEFAULT 'REVENUE' CHECK (invoice_type IN ('REVENUE', 'BUDGET', 'ADJUSTMENT')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'sent', 'paid', 'partial', 'overdue', 'cancelled')),
    invoice_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'EUR',
    eur_exchange NUMERIC(10,6) NOT NULL DEFAULT 1.0,
    paid_amount NUMERIC(15,2) DEFAULT 0,
    invoice_number TEXT,
    customer_code TEXT NOT NULL,
    customer_name TEXT,
    financial_account_code TEXT,
    financial_account_name TEXT,
    bank_account_code TEXT,
    cost_center_code TEXT,
    revenue_center_code TEXT,
    course_code TEXT,
    course_name TEXT,
    payment_method_code TEXT,
    payment_channel TEXT,
    description TEXT,
    notes TEXT,
    country_code TEXT NOT NULL DEFAULT 'ES',
    scope TEXT NOT NULL DEFAULT 'ES',
    dre_impact BOOLEAN NOT NULL DEFAULT TRUE,
    cash_impact BOOLEAN NOT NULL DEFAULT TRUE,
    is_intercompany BOOLEAN NOT NULL DEFAULT FALSE,
    is_reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMPTZ,
    reconciled_by TEXT,
    matched_transaction_id BIGINT,
    is_split BOOLEAN DEFAULT FALSE,
    parent_invoice_id BIGINT REFERENCES ar_invoices(id),
    split_number INTEGER,
    total_splits INTEGER,
    source TEXT,
    source_id TEXT,
    source_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT,
    CONSTRAINT ar_invoices_invoice_number_unique UNIQUE (invoice_number, scope)
);

CREATE INDEX IF NOT EXISTS idx_ar_invoices_customer ON ar_invoices(customer_code);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_date ON ar_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_due_date ON ar_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_status ON ar_invoices(status);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_scope ON ar_invoices(scope);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_type ON ar_invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_source ON ar_invoices(source, source_id);

ALTER TABLE ar_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY ar_invoices_select ON ar_invoices FOR SELECT USING (true);
CREATE POLICY ar_invoices_all ON ar_invoices FOR ALL USING (true);
`);
    console.log('='.repeat(80));
}

createTable().catch(console.error);
