-- ============================================
-- Add missing columns to bank_accounts table
-- ============================================

-- Add account_number column
ALTER TABLE bank_accounts 
ADD COLUMN IF NOT EXISTS account_number TEXT;

-- Add iban column
ALTER TABLE bank_accounts 
ADD COLUMN IF NOT EXISTS iban TEXT;

-- Add swift_bic column
ALTER TABLE bank_accounts 
ADD COLUMN IF NOT EXISTS swift_bic TEXT;

-- Add comments to columns
COMMENT ON COLUMN bank_accounts.account_number IS 'Bank account number';
COMMENT ON COLUMN bank_accounts.iban IS 'International Bank Account Number';
COMMENT ON COLUMN bank_accounts.swift_bic IS 'SWIFT/BIC code';

-- Optional: Add indexes for faster searches
CREATE INDEX IF NOT EXISTS idx_bank_accounts_account_number 
ON bank_accounts(account_number);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_iban 
ON bank_accounts(iban);

-- Verify: Show updated structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bank_accounts'
ORDER BY ordinal_position;
