-- ============================================================
-- DSD Workstream — Project Management Tables
-- Migration: 20260209_workstream
-- ============================================================

-- 1. Projects
CREATE TABLE IF NOT EXISTS ws_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#3b82f6',
    icon TEXT DEFAULT 'folder',
    project_type TEXT DEFAULT 'general' CHECK (project_type IN ('general', 'financial', 'engineering', 'marketing', 'operations', 'hr')),
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    section_order INT[] DEFAULT '{}',
    is_archived BOOLEAN DEFAULT false,
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ws_projects_owner ON ws_projects(owner_id);
CREATE INDEX idx_ws_projects_archived ON ws_projects(is_archived);

-- 2. Sections (columns in board view / groups in list view)
CREATE TABLE IF NOT EXISTS ws_sections (
    id SERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES ws_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    task_order INT[] DEFAULT '{}',
    color TEXT,
    position INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ws_sections_project ON ws_sections(project_id);

-- 3. Tasks
CREATE TABLE IF NOT EXISTS ws_tasks (
    id SERIAL PRIMARY KEY,
    section_id INT NOT NULL REFERENCES ws_sections(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES ws_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'blocked')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    due_date DATE,
    completed_at TIMESTAMPTZ,
    position INT DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    custom_data JSONB DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ws_tasks_section ON ws_tasks(section_id);
CREATE INDEX idx_ws_tasks_project ON ws_tasks(project_id);
CREATE INDEX idx_ws_tasks_assignee ON ws_tasks(assignee_id);
CREATE INDEX idx_ws_tasks_status ON ws_tasks(status);
CREATE INDEX idx_ws_tasks_due_date ON ws_tasks(due_date);

-- 4. Custom field definitions per project
CREATE TABLE IF NOT EXISTS ws_custom_fields (
    id SERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES ws_projects(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_key TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'currency', 'date', 'select', 'url', 'checkbox')),
    field_options JSONB DEFAULT '[]',
    is_required BOOLEAN DEFAULT false,
    position INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ws_custom_fields_project ON ws_custom_fields(project_id);
CREATE UNIQUE INDEX idx_ws_custom_fields_unique ON ws_custom_fields(project_id, field_key);

-- 5. Comments on tasks
CREATE TABLE IF NOT EXISTS ws_comments (
    id SERIAL PRIMARY KEY,
    task_id INT NOT NULL REFERENCES ws_tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ws_comments_task ON ws_comments(task_id);

-- 6. Activity log
CREATE TABLE IF NOT EXISTS ws_activity_log (
    id SERIAL PRIMARY KEY,
    task_id INT REFERENCES ws_tasks(id) ON DELETE CASCADE,
    project_id UUID REFERENCES ws_projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ws_activity_task ON ws_activity_log(task_id);
CREATE INDEX idx_ws_activity_project ON ws_activity_log(project_id);

-- ============================================================
-- RLS Policies — All authenticated users get full access
-- ============================================================

ALTER TABLE ws_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE ws_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ws_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ws_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE ws_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ws_activity_log ENABLE ROW LEVEL SECURITY;

-- Projects
CREATE POLICY "ws_projects_select" ON ws_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "ws_projects_insert" ON ws_projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ws_projects_update" ON ws_projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ws_projects_delete" ON ws_projects FOR DELETE TO authenticated USING (true);

-- Sections
CREATE POLICY "ws_sections_select" ON ws_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "ws_sections_insert" ON ws_sections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ws_sections_update" ON ws_sections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ws_sections_delete" ON ws_sections FOR DELETE TO authenticated USING (true);

-- Tasks
CREATE POLICY "ws_tasks_select" ON ws_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "ws_tasks_insert" ON ws_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ws_tasks_update" ON ws_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ws_tasks_delete" ON ws_tasks FOR DELETE TO authenticated USING (true);

-- Custom Fields
CREATE POLICY "ws_custom_fields_select" ON ws_custom_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "ws_custom_fields_insert" ON ws_custom_fields FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ws_custom_fields_update" ON ws_custom_fields FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ws_custom_fields_delete" ON ws_custom_fields FOR DELETE TO authenticated USING (true);

-- Comments
CREATE POLICY "ws_comments_select" ON ws_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "ws_comments_insert" ON ws_comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ws_comments_delete" ON ws_comments FOR DELETE TO authenticated USING (true);

-- Activity Log
CREATE POLICY "ws_activity_log_select" ON ws_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "ws_activity_log_insert" ON ws_activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION ws_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ws_projects_updated_at
    BEFORE UPDATE ON ws_projects
    FOR EACH ROW EXECUTE FUNCTION ws_update_updated_at();

CREATE TRIGGER ws_tasks_updated_at
    BEFORE UPDATE ON ws_tasks
    FOR EACH ROW EXECUTE FUNCTION ws_update_updated_at();
