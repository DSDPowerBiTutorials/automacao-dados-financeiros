-- ============================================================
-- Migration: BI Dashboard Builder
-- Date: 2026-03-23
-- Description: Tables for the DSD-BI Dashboard Builder feature
-- ============================================================

-- 1. Dashboards
CREATE TABLE IF NOT EXISTS bi_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'Untitled Dashboard',
    author_id UUID NOT NULL,
    author_name TEXT NOT NULL DEFAULT '',
    is_public BOOLEAN NOT NULL DEFAULT false,
    scope TEXT NOT NULL DEFAULT 'GLOBAL',
    slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bi_dashboards_author ON bi_dashboards(author_id);
CREATE INDEX idx_bi_dashboards_public ON bi_dashboards(is_public) WHERE is_public = true;

-- 2. Measures (user-created)
CREATE TABLE IF NOT EXISTS bi_measures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    author_id UUID NOT NULL,
    author_name TEXT NOT NULL DEFAULT '',
    is_public BOOLEAN NOT NULL DEFAULT false,
    measure_type TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bi_measures_author ON bi_measures(author_id);
CREATE INDEX idx_bi_measures_public ON bi_measures(is_public) WHERE is_public = true;

-- 3. Dashboard Comments
CREATE TABLE IF NOT EXISTS bi_dashboard_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES bi_dashboards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_name TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    parent_id UUID REFERENCES bi_dashboard_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    edited_at TIMESTAMPTZ
);

CREATE INDEX idx_bi_comments_dashboard ON bi_dashboard_comments(dashboard_id);
CREATE INDEX idx_bi_comments_parent ON bi_dashboard_comments(parent_id) WHERE parent_id IS NOT NULL;

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION update_bi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bi_dashboards_updated
    BEFORE UPDATE ON bi_dashboards
    FOR EACH ROW EXECUTE FUNCTION update_bi_updated_at();

CREATE TRIGGER trg_bi_measures_updated
    BEFORE UPDATE ON bi_measures
    FOR EACH ROW EXECUTE FUNCTION update_bi_updated_at();

-- 5. RLS Policies
ALTER TABLE bi_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_dashboard_comments ENABLE ROW LEVEL SECURITY;

-- Dashboards: public ones visible to all authenticated, private only to author
CREATE POLICY bi_dashboards_select ON bi_dashboards
    FOR SELECT TO authenticated
    USING (is_public = true OR author_id = auth.uid());

CREATE POLICY bi_dashboards_insert ON bi_dashboards
    FOR INSERT TO authenticated
    WITH CHECK (author_id = auth.uid());

CREATE POLICY bi_dashboards_update ON bi_dashboards
    FOR UPDATE TO authenticated
    USING (author_id = auth.uid());

CREATE POLICY bi_dashboards_delete ON bi_dashboards
    FOR DELETE TO authenticated
    USING (author_id = auth.uid());

-- Measures: same pattern
CREATE POLICY bi_measures_select ON bi_measures
    FOR SELECT TO authenticated
    USING (is_public = true OR author_id = auth.uid());

CREATE POLICY bi_measures_insert ON bi_measures
    FOR INSERT TO authenticated
    WITH CHECK (author_id = auth.uid());

CREATE POLICY bi_measures_update ON bi_measures
    FOR UPDATE TO authenticated
    USING (author_id = auth.uid());

CREATE POLICY bi_measures_delete ON bi_measures
    FOR DELETE TO authenticated
    USING (author_id = auth.uid());

-- Comments: visible on accessible dashboards, writeable by authenticated
CREATE POLICY bi_comments_select ON bi_dashboard_comments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM bi_dashboards d
            WHERE d.id = dashboard_id
            AND (d.is_public = true OR d.author_id = auth.uid())
        )
    );

CREATE POLICY bi_comments_insert ON bi_dashboard_comments
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY bi_comments_update ON bi_dashboard_comments
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY bi_comments_delete ON bi_dashboard_comments
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Service role full access
CREATE POLICY bi_dashboards_service ON bi_dashboards
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY bi_measures_service ON bi_measures
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY bi_comments_service ON bi_dashboard_comments
    FOR ALL TO service_role USING (true) WITH CHECK (true);
