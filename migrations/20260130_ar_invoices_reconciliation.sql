-- Migration: Adicionar campos de reconciliação à ar_invoices
-- Data: 2026-01-30

-- Adicionar campo para marcar como reconciliado
ALTER TABLE ar_invoices 
ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT FALSE;

-- Data da reconciliação
ALTER TABLE ar_invoices 
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

-- Referência do pagamento que foi reconciliado (ex: braintree:txn123)
ALTER TABLE ar_invoices 
ADD COLUMN IF NOT EXISTS reconciled_with TEXT;

-- Referência do pagamento (transaction_id)
ALTER TABLE ar_invoices 
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Índice para busca rápida de invoices não reconciliadas
CREATE INDEX IF NOT EXISTS idx_ar_invoices_reconciled 
ON ar_invoices(reconciled) 
WHERE reconciled = FALSE;

-- Comentários
COMMENT ON COLUMN ar_invoices.reconciled IS 'Se a invoice foi reconciliada com um pagamento';
COMMENT ON COLUMN ar_invoices.reconciled_at IS 'Data/hora da reconciliação';
COMMENT ON COLUMN ar_invoices.reconciled_with IS 'Referência do pagamento (ex: braintree:txn123, stripe:pi_123)';
COMMENT ON COLUMN ar_invoices.payment_reference IS 'ID da transação de pagamento';
