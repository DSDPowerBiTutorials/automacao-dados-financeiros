-- Add current_balance column to bank_accounts table
-- This column stores the current balance for cash management calculations

ALTER TABLE bank_accounts 
ADD COLUMN IF NOT EXISTS current_balance DECIMAL(15, 2) DEFAULT 0.00;

COMMENT ON COLUMN bank_accounts.current_balance IS 'Current account balance for cash management';

-- Update existing records to have 0 balance by default
UPDATE bank_accounts 
SET current_balance = 0.00 
WHERE current_balance IS NULL;
