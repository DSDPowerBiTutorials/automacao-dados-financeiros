-- QuickBooks OAuth Tokens Table
-- Used to store OAuth2 tokens for QuickBooks integration

-- Create table for storing QuickBooks tokens
CREATE TABLE IF NOT EXISTS quickbooks_tokens (
    id TEXT PRIMARY KEY DEFAULT 'default',
    realm_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type TEXT DEFAULT 'Bearer',
    expires_in INTEGER DEFAULT 3600,
    x_refresh_token_expires_in INTEGER DEFAULT 8726400,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quickbooks_tokens_realm ON quickbooks_tokens(realm_id);

-- Add comment
COMMENT ON TABLE quickbooks_tokens IS 'Stores OAuth2 tokens for QuickBooks integration';

-- Example query to check status:
-- SELECT id, realm_id, created_at, updated_at FROM quickbooks_tokens;
