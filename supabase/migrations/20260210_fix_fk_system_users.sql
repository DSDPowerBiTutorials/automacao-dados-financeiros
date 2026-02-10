-- ============================================================
-- DSD Workstream — Fix FK constraints to use system_users
-- Run this SQL in Supabase Dashboard → SQL Editor
-- Date: 2026-02-10
--
-- Problem: ws_tasks.assignee_id, ws_tasks.created_by, and
-- ws_comments.user_id have FKs to auth.users(id), but the
-- workstream uses system_users which have different UUIDs.
-- This causes 500 errors on task assignment and comments.
--
-- Fix: Drop auth.users FKs and re-add pointing to system_users.
-- Also drops notification FKs (already done, safety re-run).
-- ============================================================

-- ============================================================
-- 1. Fix ws_tasks FKs — DROP only (no re-add)
-- Existing data mixes public.users and system_users UUIDs.
-- Application layer handles validation.
-- ============================================================

ALTER TABLE ws_tasks DROP CONSTRAINT IF EXISTS ws_tasks_assignee_id_fkey;
ALTER TABLE ws_tasks DROP CONSTRAINT IF EXISTS ws_tasks_created_by_fkey;

-- ============================================================
-- 2. Fix ws_comments FKs — DROP only
-- Existing comments use public.users IDs.
-- ============================================================

ALTER TABLE ws_comments DROP CONSTRAINT IF EXISTS ws_comments_user_id_fkey;

-- ============================================================
-- 3. Fix notifications FKs (safety re-run)
-- Drop completely — notifications accept IDs from both tables
-- ============================================================

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_triggered_by_fkey;

-- ============================================================
-- 4. Fix ws_projects FKs (if they point to auth.users)
-- ============================================================

ALTER TABLE ws_projects DROP CONSTRAINT IF EXISTS ws_projects_created_by_fkey;
-- Don't re-add — created_by can be from either table

-- ============================================================
-- 5. Force PostgREST schema cache reload
-- ============================================================

NOTIFY pgrst, 'reload schema';

-- Done! Task assignment and comments should now work with system_users IDs.
