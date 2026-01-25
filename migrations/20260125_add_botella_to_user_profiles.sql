-- Migration: Add BOTella to user_profiles for DM visibility
-- Date: 2026-01-25
-- Description: Inserts BOTella as a system user in user_profiles so it appears in DM list

-- Create a system UUID for BOTella (deterministic based on email)
-- Using UUID v5 namespace with 'botella@system.local'
DO $
$
DECLARE
    botella_id UUID := '00000000-0000-0000-0000-b07e11a00001';
-- Easy to identify system bot
BEGIN
    -- Insert BOTella into user_profiles if not exists
    INSERT INTO user_profiles
        (id, username, full_name, avatar_url, status)
    VALUES
        (
            botella_id,
            'botella',
            'BOTella',
            '/avatars/botella.svg',
            'online'
    )
    ON CONFLICT
    (id) DO
    UPDATE SET
        full_name = 'BOTella',
        avatar_url = '/avatars/botella.svg',
        status = 'online';

    RAISE NOTICE 'BOTella added to user_profiles with ID: %', botella_id;
END $$;

-- Verify
SELECT id, username, full_name, avatar_url, status
FROM user_profiles
WHERE username = 'botella' OR full_name = 'BOTella';
