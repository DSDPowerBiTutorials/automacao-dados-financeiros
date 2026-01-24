-- Migration: Add reconciliation fields to invoices
-- Run this in Supabase SQL Editor

-- Add reconciliation fields to invoices table
ALTER TABLE invoices ADD COLUMN
IF NOT EXISTS is_reconciled BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN
IF NOT EXISTS reconciled_transaction_id TEXT;
ALTER TABLE invoices ADD COLUMN
IF NOT EXISTS reconciled_at TIMESTAMPTZ;

-- Create index for reconciliation lookups
CREATE INDEX
IF NOT EXISTS idx_invoices_is_reconciled ON invoices
(is_reconciled);
CREATE INDEX
IF NOT EXISTS idx_invoices_reconciled_transaction ON invoices
(reconciled_transaction_id);

-- Add comment
COMMENT ON COLUMN invoices.is_reconciled IS 'Whether invoice has been reconciled with bank transaction';
COMMENT ON COLUMN invoices.reconciled_transaction_id IS 'ID of the matched bank transaction (csv_rows.id)';
COMMENT ON COLUMN invoices.reconciled_at IS 'Timestamp when reconciliation was performed';
