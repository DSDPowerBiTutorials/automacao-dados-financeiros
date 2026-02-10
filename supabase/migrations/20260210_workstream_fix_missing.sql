-- ============================================================
-- DSD Workstream — COMPLETE Migration Fix
-- Run this SQL in Supabase Dashboard → SQL Editor
-- Date: 2026-02-10
--
-- Creates ALL missing tables (Phase 1 + Phase 2) and adds
-- missing columns. Also fixes notifications FK constraints.
-- ============================================================

-- ============================================================
-- PHASE 1: Task Collaborators
-- ============================================================

CREATE TABLE IF NOT EXISTS ws_task_collaborators (
    id SERIAL PRIMARY KEY,
    task_id INT NOT NULL REFERENCES ws_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    added_by UUID,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ws_task_collaborators_task ON ws_task_collaborators(task_id);
CREATE INDEX IF NOT EXISTS idx_ws_task_collaborators_user ON ws_task_collaborators(user_id);

ALTER TABLE ws_task_collaborators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ws_task_collaborators_all" ON ws_task_collaborators;
CREATE POLICY "ws_task_collaborators_all" ON ws_task_collaborators FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PHASE 1: Workstream Attachments
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
    uploaded_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ws_attachments_entity ON ws_attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ws_attachments_uploaded_by ON ws_attachments(uploaded_by);

ALTER TABLE ws_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ws_attachments_all" ON ws_attachments;
CREATE POLICY "ws_attachments_all" ON ws_attachments FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PHASE 1: Comment threading + mentions
-- ============================================================

ALTER TABLE ws_comments ADD COLUMN IF NOT EXISTS parent_id INT REFERENCES ws_comments(id) ON DELETE SET NULL;
ALTER TABLE ws_comments ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_ws_comments_parent ON ws_comments(parent_id);

-- ============================================================
-- PHASE 2: Subtask support (parent_task_id) + start_date
-- ============================================================

ALTER TABLE ws_tasks ADD COLUMN IF NOT EXISTS parent_task_id INT REFERENCES ws_tasks(id) ON DELETE CASCADE;
ALTER TABLE ws_tasks ADD COLUMN IF NOT EXISTS start_date DATE;
CREATE INDEX IF NOT EXISTS idx_ws_tasks_parent_task_id ON ws_tasks(parent_task_id);

-- ============================================================
-- PHASE 2: Task Dependencies
-- ============================================================

CREATE TABLE IF NOT EXISTS ws_task_dependencies (
    id SERIAL PRIMARY KEY,
    blocking_task_id INT NOT NULL REFERENCES ws_tasks(id) ON DELETE CASCADE,
    dependent_task_id INT NOT NULL REFERENCES ws_tasks(id) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL DEFAULT 'finish_to_start'
        CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(blocking_task_id, dependent_task_id)
);

CREATE INDEX IF NOT EXISTS idx_ws_deps_blocking ON ws_task_dependencies(blocking_task_id);
CREATE INDEX IF NOT EXISTS idx_ws_deps_dependent ON ws_task_dependencies(dependent_task_id);

ALTER TABLE ws_task_dependencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ws_task_dependencies_all" ON ws_task_dependencies;
CREATE POLICY "ws_task_dependencies_all" ON ws_task_dependencies FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PHASE 2: Labels (project-scoped, with color)
-- ============================================================

CREATE TABLE IF NOT EXISTS ws_labels (
    id SERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES ws_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, name)
);

ALTER TABLE ws_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ws_labels_all" ON ws_labels;
CREATE POLICY "ws_labels_all" ON ws_labels FOR ALL USING (true) WITH CHECK (true);

-- Task ↔ Label junction
CREATE TABLE IF NOT EXISTS ws_task_labels (
    task_id INT NOT NULL REFERENCES ws_tasks(id) ON DELETE CASCADE,
    label_id INT NOT NULL REFERENCES ws_labels(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_ws_task_labels_task ON ws_task_labels(task_id);
CREATE INDEX IF NOT EXISTS idx_ws_task_labels_label ON ws_task_labels(label_id);

ALTER TABLE ws_task_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ws_task_labels_all" ON ws_task_labels;
CREATE POLICY "ws_task_labels_all" ON ws_task_labels FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PHASE 2: Comment edit/delete support
-- ============================================================

ALTER TABLE ws_comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE ws_comments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- ============================================================
-- FIX: Notifications FK constraints
-- The notifications table has FKs to public.users(id) but the
-- workstream uses system_users which have different UUIDs.
-- Drop the FKs so notifications work with any user ID source.
-- ============================================================

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_triggered_by_fkey;

-- ============================================================
-- Grant access to service_role and authenticated
-- ============================================================

GRANT ALL ON ws_task_collaborators TO service_role, authenticated;
GRANT ALL ON ws_attachments TO service_role, authenticated;
GRANT ALL ON ws_task_dependencies TO service_role, authenticated;
GRANT ALL ON ws_labels TO service_role, authenticated;
GRANT ALL ON ws_task_labels TO service_role, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

-- Done! All workstream features should now work.
