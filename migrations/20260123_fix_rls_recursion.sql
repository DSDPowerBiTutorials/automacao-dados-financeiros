-- FIX: Remove recursive RLS policies
-- Run this in Supabase SQL Editor

-- Drop problematic policies
DROP POLICY
IF EXISTS "channels_select" ON channels;
DROP POLICY
IF EXISTS "channel_members_select" ON channel_members;
DROP POLICY
IF EXISTS "messages_select" ON messages;

-- Simple non-recursive policies

-- Channels: authenticated users can see all channels (for now)
CREATE POLICY "channels_select" ON channels 
FOR
SELECT TO authenticated
USING
(true);

-- Channel Members: authenticated users can see all members
CREATE POLICY "channel_members_select" ON channel_members 
FOR
SELECT TO authenticated
USING
(true);

-- Messages: authenticated users can see messages in any channel
CREATE POLICY "messages_select" ON messages 
FOR
SELECT TO authenticated
USING
(true);

SELECT 'RLS policies fixed - no more recursion!' as status;
