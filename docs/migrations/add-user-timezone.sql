-- Migration: Add timezone field to users table
-- Date: 2026-01-24
-- Description: Allows users to set their local timezone for date display conversion
--              The system always uses Europe/Madrid as the reference timezone

-- Add timezone column to users table
ALTER TABLE users 
ADD COLUMN
IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Madrid';

-- Add comment explaining the field
COMMENT ON COLUMN users.timezone IS 'User local timezone for display purposes. All data is stored in Europe/Madrid timezone.';

-- Common timezone options (for reference):
-- Europe/Madrid (default - Spain)
-- America/Sao_Paulo (Brazil)
-- America/New_York (US East)
-- America/Los_Angeles (US West)
-- Europe/London (UK)
-- Europe/Paris (France)
-- Asia/Tokyo (Japan)
-- Australia/Sydney (Australia)

-- Update existing users to have the default timezone
UPDATE users 
SET timezone = 'Europe/Madrid' 
WHERE timezone IS NULL;
