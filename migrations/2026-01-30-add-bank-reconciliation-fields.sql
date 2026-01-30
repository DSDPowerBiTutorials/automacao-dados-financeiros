-- Migration: Adicionar campos de reconciliação bancária em ar_invoices
-- Data: 2026-01-30
-- Descrição: Campos para vincular Web Orders → Braintree → Disbursement → Banco

-- Adicionar colunas para reconciliação bancária
ALTER TABLE ar_invoices 
ADD COLUMN IF NOT EXISTS bank_reconciled BOOLEAN DEFAULT FALSE;

ALTER TABLE ar_invoices 
ADD COLUMN IF NOT EXISTS bank_row_id UUID REFERENCES csv_rows(id);

ALTER TABLE ar_invoices 
ADD COLUMN IF NOT EXISTS disbursement_id TEXT;

ALTER TABLE ar_invoices 
ADD COLUMN IF NOT EXISTS disbursement_date DATE;

ALTER TABLE ar_invoices 
ADD COLUMN IF NOT EXISTS disbursement_amount NUMERIC(15, 2);

-- Índices para consultas
CREATE INDEX IF NOT EXISTS idx_ar_invoices_bank_reconciled 
ON ar_invoices(bank_reconciled) WHERE bank_reconciled = TRUE;

CREATE INDEX IF NOT EXISTS idx_ar_invoices_disbursement_id 
ON ar_invoices(disbursement_id) WHERE disbursement_id IS NOT NULL;

-- Comentários
COMMENT ON COLUMN ar_invoices.bank_reconciled IS 'Indica se a order foi reconciliada com o extrato bancário via disbursement';
COMMENT ON COLUMN ar_invoices.bank_row_id IS 'ID da transação bancária (csv_rows) vinculada ao disbursement';
COMMENT ON COLUMN ar_invoices.disbursement_id IS 'ID do disbursement Braintree que inclui esta transação';
COMMENT ON COLUMN ar_invoices.disbursement_date IS 'Data do disbursement (quando o dinheiro chegou no banco)';
COMMENT ON COLUMN ar_invoices.disbursement_amount IS 'Valor total do disbursement que contém esta transação';
