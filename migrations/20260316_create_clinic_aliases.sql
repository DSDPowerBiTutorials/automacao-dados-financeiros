-- ============================================================
-- Clinic Aliases: link duplicate clinic records
-- When a clinic has different names/emails in the system,
-- the user can merge them under a primary name.
-- All csv_rows with the alias customer_name will be updated
-- to use the primary name.
-- ============================================================

CREATE TABLE
IF NOT EXISTS clinic_aliases
(
    id BIGSERIAL PRIMARY KEY,
    primary_name TEXT NOT NULL,       -- canonical clinic name
    alias_name TEXT NOT NULL UNIQUE,  -- duplicate name to redirect
    alias_email TEXT,                 -- optional email of the alias
    merged_by TEXT,                   -- user who performed the merge
    created_at TIMESTAMPTZ DEFAULT NOW
()
);

-- RLS
ALTER TABLE clinic_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_clinic_aliases" ON clinic_aliases
    FOR
SELECT TO authenticated
USING
(true);
CREATE POLICY "auth_insert_clinic_aliases" ON clinic_aliases
    FOR
INSERT TO authenticated WITH CHECK (
true);
CREATE POLICY "auth_delete_clinic_aliases" ON clinic_aliases
    FOR
DELETE TO authenticated USING (true);

-- Revoke anon
REVOKE ALL ON clinic_aliases FROM anon;
GRANT SELECT, INSERT, DELETE ON clinic_aliases TO authenticated;

-- Index for lookups
CREATE INDEX
IF NOT EXISTS idx_clinic_aliases_alias ON clinic_aliases
(alias_name);
CREATE INDEX
IF NOT EXISTS idx_clinic_aliases_primary ON clinic_aliases
(primary_name);
