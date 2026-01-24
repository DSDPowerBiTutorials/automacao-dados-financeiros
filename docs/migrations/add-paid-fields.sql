-- Migration: Add paid_amount and paid_currency fields to invoices table
-- Date: 2026-01-24
-- Description: Tracks the actual paid amount and currency (may differ from invoice amount)

-- Add paid_amount column (actual amount paid, may differ from invoice_amount)
ALTER TABLE invoices 
ADD COLUMN
IF NOT EXISTS paid_amount NUMERIC
(15, 2);

-- Add paid_currency column (currency in which payment was made)
ALTER TABLE invoices 
ADD COLUMN
IF NOT EXISTS paid_currency TEXT;

-- Add comments explaining the fields
COMMENT ON COLUMN invoices.paid_amount IS 'Actual amount paid. May differ from invoice_amount due to exchange rates, discounts, or partial payments.';
COMMENT ON COLUMN invoices.paid_currency IS 'Currency in which the payment was actually made (EUR, USD, GBP, etc.).';

-- Optional: Update existing paid invoices to copy invoice values if not set
-- (Only run if you want to backfill existing data)
-- UPDATE invoices 
-- SET paid_amount = invoice_amount, paid_currency = currency 
-- WHERE payment_date IS NOT NULL AND paid_amount IS NULL;
