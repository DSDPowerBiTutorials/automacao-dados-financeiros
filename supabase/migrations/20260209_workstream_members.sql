-- ============================================================
-- DSD Workstream — Project Members Table
-- Migration: 20260209_workstream_members
-- ============================================================

CREATE TABLE
IF NOT EXISTS ws_project_members
(
    id SERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES ws_projects
(id) ON
DELETE CASCADE,
    user_id UUID
NOT NULL,
    role TEXT DEFAULT 'member' CHECK
(role IN
('owner', 'admin', 'member', 'viewer')),
    joined_at TIMESTAMPTZ DEFAULT NOW
(),
    UNIQUE
(project_id, user_id)
);

CREATE INDEX idx_ws_project_members_project ON ws_project_members(project_id);
CREATE INDEX idx_ws_project_members_user ON ws_project_members(user_id);

-- RLS
ALTER TABLE ws_project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_project_members_select" ON ws_project_members FOR
SELECT TO authenticated
USING
(true);
CREATE POLICY "ws_project_members_insert" ON ws_project_members FOR
INSERT TO authenticated WITH CHECK (
true);
CREATE POLICY "ws_project_members_update" ON ws_project_members FOR
UPDATE TO authenticated USING (true)
WITH CHECK
(true);
CREATE POLICY "ws_project_members_delete" ON ws_project_members FOR
DELETE TO authenticated USING (true);
