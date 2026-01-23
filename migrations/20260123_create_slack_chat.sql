-- Migration: Slack-style Chat System
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. USER PROFILES (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline', 'dnd')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create profiles for existing users
INSERT INTO user_profiles (id, full_name, username)
SELECT id, raw_user_meta_data->>'full_name', email
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. CHANNELS (public, private, direct)
-- ============================================
CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    channel_type TEXT DEFAULT 'public' CHECK (channel_type IN ('public', 'private', 'direct')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default channels
INSERT INTO channels (slug, name, description, channel_type) VALUES
    ('general', 'General', 'General discussion', 'public'),
    ('financeiro', 'Financeiro', 'Finance team discussions', 'public'),
    ('suporte', 'Suporte', 'Support and help', 'public')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 3. CHANNEL MEMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS channel_members (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

-- ============================================
-- 4. MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'file')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- User Profiles: everyone can read, users can update their own
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
CREATE POLICY "user_profiles_select" ON user_profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
CREATE POLICY "user_profiles_insert" ON user_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
CREATE POLICY "user_profiles_update" ON user_profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Channels: public visible to all, private/direct only to members
DROP POLICY IF EXISTS "channels_select" ON channels;
CREATE POLICY "channels_select" ON channels FOR SELECT TO authenticated USING (
    channel_type = 'public' 
    OR EXISTS (SELECT 1 FROM channel_members WHERE channel_id = channels.id AND user_id = auth.uid())
    OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "channels_insert" ON channels;
CREATE POLICY "channels_insert" ON channels FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "channels_update" ON channels;
CREATE POLICY "channels_update" ON channels FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- Channel Members: can see members of channels you're in
DROP POLICY IF EXISTS "channel_members_select" ON channel_members;
CREATE POLICY "channel_members_select" ON channel_members FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM channels WHERE id = channel_id AND (channel_type = 'public' OR created_by = auth.uid()))
    OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "channel_members_insert" ON channel_members;
CREATE POLICY "channel_members_insert" ON channel_members FOR INSERT TO authenticated WITH CHECK (true);

-- Messages: can see messages in channels you have access to
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM channels 
        WHERE id = channel_id 
        AND (channel_type = 'public' OR created_by = auth.uid() 
             OR EXISTS (SELECT 1 FROM channel_members WHERE channel_id = channels.id AND user_id = auth.uid()))
    )
);

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "messages_update" ON messages;
CREATE POLICY "messages_update" ON messages FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "messages_delete" ON messages;
CREATE POLICY "messages_delete" ON messages FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- 6. GRANTS
-- ============================================
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON channels TO authenticated;
GRANT ALL ON channel_members TO authenticated;
GRANT ALL ON messages TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE channels_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE channel_members_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE messages_id_seq TO authenticated;

-- ============================================
-- 7. REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE channels;
ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;

-- ============================================
-- 8. AUTO-CREATE PROFILE ON NEW USER
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, username, avatar_url)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Done!
SELECT 'Slack-style chat system created successfully!' as status;
