-- ============================================================
-- DSD Workstream — Missing Migrations Fix
-- Run this SQL in Supabase Dashboard → SQL Editor
-- Date: 2026-02-10
-- ============================================================

-- 1) Add subtask support (parent_task_id) to ws_tasks
ALTER TABLE ws_tasks
  ADD COLUMN
IF NOT EXISTS parent_task_id INT REFERENCES ws_tasks
(id) ON
DELETE CASCADE;

-- 2) Add start_date to ws_tasks
ALTER TABLE ws_tasks
  ADD COLUMN
IF NOT EXISTS start_date DATE;

-- 3) Index for fast subtask lookups
CREATE INDEX
IF NOT EXISTS idx_ws_tasks_parent_task_id ON ws_tasks
(parent_task_id);

-- 4) Comment threading support
ALTER TABLE ws_comments
  ADD COLUMN
IF NOT EXISTS parent_id INT REFERENCES ws_comments
(id) ON
DELETE
SET NULL;

-- 5) Comment mentions array
ALTER TABLE ws_comments
  ADD COLUMN
IF NOT EXISTS mentions UUID[] DEFAULT '{}';

-- 6) Comment edit tracking
ALTER TABLE ws_comments
  ADD COLUMN
IF NOT EXISTS edited_at TIMESTAMPTZ;

-- 7) Comment soft delete
ALTER TABLE ws_comments
  ADD COLUMN
IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 8) Index for threaded comments
CREATE INDEX
IF NOT EXISTS idx_ws_comments_parent ON ws_comments
(parent_id);

-- 9) Fix notifications FK constraints
-- The notifications table has FKs to public.users(id) but the workstream
-- uses system_users which have different UUIDs. Drop the FKs so
-- notifications work with any user ID source.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_triggered_by_fkey;

-- Done! All workstream features should now work.
