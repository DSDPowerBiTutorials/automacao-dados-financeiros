-- ============================================================
-- DSD Workstream — Phase 2: Asana Parity Schema
-- Subtasks, Dependencies, Labels, Comment Edit/Delete, Start Date
-- ============================================================

-- 1) Add subtask support (parent_task_id) and start_date to ws_tasks
ALTER TABLE ws_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id INT REFERENCES ws_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS start_date DATE;

-- Index for fast subtask lookups
CREATE INDEX IF NOT EXISTS idx_ws_tasks_parent_task_id ON ws_tasks(parent_task_id);

-- 2) Task Dependencies
CREATE TABLE IF NOT EXISTS ws_task_dependencies (
    id SERIAL PRIMARY KEY,
    blocking_task_id INT NOT NULL REFERENCES ws_tasks(id) ON DELETE CASCADE,
    dependent_task_id INT NOT NULL REFERENCES ws_tasks(id) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL DEFAULT 'finish_to_start'
        CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(blocking_task_id, dependent_task_id)
);

-- Indexes for dependency lookups
CREATE INDEX IF NOT EXISTS idx_ws_deps_blocking ON ws_task_dependencies(blocking_task_id);
CREATE INDEX IF NOT EXISTS idx_ws_deps_dependent ON ws_task_dependencies(dependent_task_id);

-- 3) Labels (project-scoped, with color)
CREATE TABLE IF NOT EXISTS ws_labels (
    id SERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES ws_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, name)
);

-- Task ↔ Label junction
CREATE TABLE IF NOT EXISTS ws_task_labels (
    task_id INT NOT NULL REFERENCES ws_tasks(id) ON DELETE CASCADE,
    label_id INT NOT NULL REFERENCES ws_labels(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_ws_task_labels_task ON ws_task_labels(task_id);
CREATE INDEX IF NOT EXISTS idx_ws_task_labels_label ON ws_task_labels(label_id);

-- 4) Comment edit/delete support
ALTER TABLE ws_comments
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 5) RLS policies for new tables (same pattern: authenticated = full access)
ALTER TABLE ws_task_dependencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ws_task_dependencies_all ON ws_task_dependencies;
CREATE POLICY ws_task_dependencies_all ON ws_task_dependencies FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ws_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ws_labels_all ON ws_labels;
CREATE POLICY ws_labels_all ON ws_labels FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ws_task_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ws_task_labels_all ON ws_task_labels;
CREATE POLICY ws_task_labels_all ON ws_task_labels FOR ALL USING (true) WITH CHECK (true);
