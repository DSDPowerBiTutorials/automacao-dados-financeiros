-- =====================================================
-- Migration: P&L Popup + Payment Matched Semantics
-- Date: 2025-06-15
-- =====================================================

-- 1) Create product_pnl_mappings table for learned product → P&L line mappings
CREATE TABLE
IF NOT EXISTS product_pnl_mappings
(
    id SERIAL PRIMARY KEY,
    product_name TEXT NOT NULL UNIQUE,
    pnl_line TEXT NOT NULL,          -- e.g. "101", "102", "103", "104", "105"
    pnl_label TEXT,                  -- e.g. "Growth", "Delight", etc.
    learned_from_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW
(),
    updated_at TIMESTAMPTZ DEFAULT NOW
()
);

-- Index for fast lookup by product_name
CREATE INDEX
IF NOT EXISTS idx_product_pnl_mappings_name ON product_pnl_mappings
(product_name);

-- 2) Add payment_matched columns to ar_invoices
-- payment_matched = gateway matched (Braintree/Stripe/GoCardless)
-- reconciled = linked to actual bank statement line
ALTER TABLE ar_invoices ADD COLUMN
IF NOT EXISTS payment_matched BOOLEAN DEFAULT FALSE;
ALTER TABLE ar_invoices ADD COLUMN
IF NOT EXISTS payment_source TEXT;
ALTER TABLE ar_invoices ADD COLUMN
IF NOT EXISTS payment_matched_at TIMESTAMPTZ;

-- 3) Migrate: all auto-reconciled invoices → payment_matched=true, reconciled=false
-- These were matched by gateway but NOT by bank statement
UPDATE ar_invoices
SET
    payment_matched = true,
    payment_source = reconciled_with,
    payment_matched_at = reconciled_at,
    reconciled = false,
    reconciled_at = NULL,
    reconciled_with = NULL
WHERE reconciliation_type = 'automatic'
    AND reconciled = true;

-- 4) Keep manual-bank reconciliations as-is (they ARE bank-reconciled)
-- Also mark them as payment_matched since they went through bank
UPDATE ar_invoices
SET
    payment_matched = true,
    payment_source = reconciled_with,
    payment_matched_at = reconciled_at
WHERE reconciliation_type = 'manual-bank'
    AND reconciled = true;
