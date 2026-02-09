-- ============================================================
-- DSD Workstream — Phase 1: Notifications, Collaborators, Attachments
-- Migration: 20260209_workstream_phase1
-- ============================================================

-- ============================================================
-- 1. Task Collaborators (watchers / participants)
-- ============================================================

CREATE TABLE IF NOT EXISTS ws_task_collaborators (
    id SERIAL PRIMARY KEY,
    task_id INT NOT NULL REFERENCES ws_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (task_id, user_id)
);

CREATE INDEX idx_ws_task_collaborators_task ON ws_task_collaborators(task_id);
CREATE INDEX idx_ws_task_collaborators_user ON ws_task_collaborators(user_id);

ALTER TABLE ws_task_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_task_collaborators_select" ON ws_task_collaborators FOR SELECT TO authenticated USING (true);
CREATE POLICY "ws_task_collaborators_insert" ON ws_task_collaborators FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ws_task_collaborators_delete" ON ws_task_collaborators FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 2. Workstream Attachments
-- ============================================================

CREATE TABLE IF NOT EXISTS ws_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'comment', 'project')),
    entity_id INT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT DEFAULT 0,
    storage_path TEXT NOT NULL,
    kind TEXT DEFAULT 'other' CHECK (kind IN ('image', 'document', 'screenshot', 'other')),
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ws_attachments_entity ON ws_attachments(entity_type, entity_id);
CREATE INDEX idx_ws_attachments_uploaded_by ON ws_attachments(uploaded_by);

ALTER TABLE ws_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_attachments_select" ON ws_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "ws_attachments_insert" ON ws_attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ws_attachments_delete" ON ws_attachments FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 3. Alter ws_comments — add parent_id and mentions
-- ============================================================

ALTER TABLE ws_comments ADD COLUMN IF NOT EXISTS parent_id INT REFERENCES ws_comments(id) ON DELETE SET NULL;
ALTER TABLE ws_comments ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ws_comments_parent ON ws_comments(parent_id);

-- ============================================================
-- 4. Function to create Workstream notifications
-- ============================================================

CREATE OR REPLACE FUNCTION create_ws_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_triggered_by UUID,
    p_reference_type TEXT DEFAULT 'task',
    p_reference_id UUID DEFAULT NULL,
    p_reference_url TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    -- Don't notify yourself
    IF p_user_id = p_triggered_by THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.notifications (
        user_id, type, title, message,
        reference_type, reference_id, reference_url,
        triggered_by, metadata
    ) VALUES (
        p_user_id, p_type, p_title, p_message,
        p_reference_type, p_reference_id, p_reference_url,
        p_triggered_by, p_metadata
    )
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. Storage bucket policy (run via Supabase dashboard if needed)
-- Note: Bucket creation is typically done via dashboard or API
-- This creates the RLS policies for the bucket if it exists
-- ============================================================

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('ws-attachments', 'ws-attachments', false)
-- ON CONFLICT (id) DO NOTHING;

