-- Migration: Create chat_messages table for platform-wide chat
-- Run this in Supabase SQL Editor

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_avatar TEXT,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- 'text', 'system', 'file'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow authenticated users to read chat_messages"
    ON chat_messages FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert chat_messages"
    ON chat_messages FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update their own messages"
    ON chat_messages FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Allow authenticated users to delete their own messages"
    ON chat_messages FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON chat_messages TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE chat_messages_id_seq TO authenticated;

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
