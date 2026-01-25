-- Migration: Add reconciliation tracking fields to invoices table
-- Date: 2026-01-25
-- Description: Tracks which bank transaction an invoice was reconciled with

-- Add is_reconciled column
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN DEFAULT FALSE;

-- Add reconciled_transaction_id column (references csv_rows.id)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS reconciled_transaction_id TEXT;

-- Add reconciled_at timestamp
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

-- Add comments explaining the fields
COMMENT ON COLUMN invoices.is_reconciled IS 'Whether this invoice has been reconciled with a bank transaction';
COMMENT ON COLUMN invoices.reconciled_transaction_id IS 'ID of the csv_rows record this invoice was matched with';
COMMENT ON COLUMN invoices.reconciled_at IS 'Timestamp when the reconciliation was performed';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_reconciled ON invoices(is_reconciled) WHERE is_reconciled = TRUE;
CREATE INDEX IF NOT EXISTS idx_invoices_reconciled_transaction ON invoices(reconciled_transaction_id) WHERE reconciled_transaction_id IS NOT NULL;
