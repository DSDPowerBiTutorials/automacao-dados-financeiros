-- FIX: Add missing realtime tables (ignore if already exists)
-- Run this in Supabase SQL Editor

DO $
$
BEGIN
    -- Try to add channels to realtime (ignore if exists)
    BEGIN
        ALTER PUBLICATION supabase_realtime
        ADD TABLE channels;
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'channels already in realtime';
END;

-- Try to add user_profiles to realtime (ignore if exists)
BEGIN
    ALTER PUBLICATION supabase_realtime
    ADD TABLE user_profiles;
EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'user_profiles already in realtime';
END;

-- Try to add messages to realtime (ignore if exists)
BEGIN
    ALTER PUBLICATION supabase_realtime
    ADD TABLE messages;
EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'messages already in realtime';
END;
END $$;

SELECT 'Realtime fix applied!' as status;
