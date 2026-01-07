-- Migration: Add external_id column to csv_rows for upsert strategy
-- Date: 2026-01-05

-- Add external_id column
ALTER TABLE csv_rows 
ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Create unique index for upsert (source + external_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_csv_rows_source_external_id 
ON csv_rows(source, external_id) 
WHERE external_id IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_csv_rows_external_id 
ON csv_rows(external_id) 
WHERE external_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN csv_rows.external_id IS 'External ID from source API (e.g., Braintree transaction.id, GoCardless payment.id)';

-- Backfill external_id for existing Braintree records (if transaction_id exists in custom_data)
UPDATE csv_rows
SET external_id = custom_data->>'transaction_id'
WHERE source LIKE 'braintree%'
  AND custom_data->>'transaction_id' IS NOT NULL
  AND external_id IS NULL;

-- Backfill external_id for existing GoCardless records
UPDATE csv_rows
SET external_id = custom_data->>'payment_id'
WHERE source LIKE 'gocardless%'
  AND custom_data->>'payment_id' IS NOT NULL
  AND external_id IS NULL;

-- Backfill external_id for existing HubSpot records
UPDATE csv_rows
SET external_id = custom_data->>'deal_id'
WHERE source = 'hubspot'
  AND custom_data->>'deal_id' IS NOT NULL
  AND external_id IS NULL;
