-- Migration: Create clinics master and events tables
-- Date: 2026-02-05
-- Purpose: Track clinic lifecycle (New, Pause, Return, Churn) for P&L drill-down and future Clinics Overview page

-- ============================================
-- 1. CLINICS MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS clinics (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    company_name TEXT,
    country TEXT,
    region TEXT, -- 'ROW' or 'AMEX'
    level TEXT, -- 'Level 1', 'Level 2', 'Level 3'
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'churned')),
    first_transaction_date DATE,
    last_transaction_date DATE,
    mrr NUMERIC(15,2) DEFAULT 0,
    total_revenue NUMERIC(15,2) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_clinics_email ON clinics(email);
CREATE INDEX IF NOT EXISTS idx_clinics_status ON clinics(status);
CREATE INDEX IF NOT EXISTS idx_clinics_region ON clinics(region);
CREATE INDEX IF NOT EXISTS idx_clinics_level ON clinics(level);

-- ============================================
-- 2. CLINIC EVENTS TABLE (Lifecycle tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS clinic_events (
    id BIGSERIAL PRIMARY KEY,
    clinic_id BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('New', 'Pause', 'Return', 'Churn')),
    event_date DATE NOT NULL,
    year_month TEXT NOT NULL, -- 'YYYY-MM' format for easy queries
    previous_status TEXT,
    new_status TEXT,
    previous_mrr NUMERIC(15,2),
    new_mrr NUMERIC(15,2),
    notes TEXT,
    is_auto_detected BOOLEAN DEFAULT false,
    confirmed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate events for same clinic in same month
    UNIQUE(clinic_id, year_month, event_type)
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_clinic_events_clinic_id ON clinic_events(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_events_year_month ON clinic_events(year_month);
CREATE INDEX IF NOT EXISTS idx_clinic_events_type ON clinic_events(event_type);
CREATE INDEX IF NOT EXISTS idx_clinic_events_type_month ON clinic_events(event_type, year_month);
CREATE INDEX IF NOT EXISTS idx_clinic_events_confirmed ON clinic_events(confirmed);

-- ============================================
-- 3. CLINIC MONTHLY STATS (for variations tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS clinic_monthly_stats (
    id BIGSERIAL PRIMARY KEY,
    clinic_id BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    year_month TEXT NOT NULL, -- 'YYYY-MM'
    revenue NUMERIC(15,2) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    level TEXT,
    region TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(clinic_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_clinic_monthly_stats_clinic ON clinic_monthly_stats(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_monthly_stats_month ON clinic_monthly_stats(year_month);

-- ============================================
-- 4. TRIGGER: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_clinics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_clinics_updated_at ON clinics;
CREATE TRIGGER trigger_clinics_updated_at
    BEFORE UPDATE ON clinics
    FOR EACH ROW
    EXECUTE FUNCTION update_clinics_updated_at();

DROP TRIGGER IF EXISTS trigger_clinic_events_updated_at ON clinic_events;
CREATE TRIGGER trigger_clinic_events_updated_at
    BEFORE UPDATE ON clinic_events
    FOR EACH ROW
    EXECUTE FUNCTION update_clinics_updated_at();

-- ============================================
-- 5. RLS POLICIES
-- ============================================
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_monthly_stats ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read clinics" ON clinics
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read clinic_events" ON clinic_events
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read clinic_monthly_stats" ON clinic_monthly_stats
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert/update (for event tracking)
CREATE POLICY "Allow authenticated insert clinics" ON clinics
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update clinics" ON clinics
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated insert clinic_events" ON clinic_events
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update clinic_events" ON clinic_events
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated insert clinic_monthly_stats" ON clinic_monthly_stats
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update clinic_monthly_stats" ON clinic_monthly_stats
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Service role has full access
CREATE POLICY "Service role full access clinics" ON clinics
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access clinic_events" ON clinic_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access clinic_monthly_stats" ON clinic_monthly_stats
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- 6. COMMENTS
-- ============================================
COMMENT ON TABLE clinics IS 'Master table for clinic entities, identified by unique email';
COMMENT ON TABLE clinic_events IS 'Lifecycle events: New, Pause, Return, Churn';
COMMENT ON TABLE clinic_monthly_stats IS 'Monthly revenue and transaction stats per clinic';

COMMENT ON COLUMN clinics.email IS 'Unique identifier for the clinic (lowercase)';
COMMENT ON COLUMN clinics.region IS 'ROW (Rest of World) or AMEX (Americas)';
COMMENT ON COLUMN clinics.level IS 'Contract level: Level 1, Level 2, or Level 3';
COMMENT ON COLUMN clinics.mrr IS 'Monthly Recurring Revenue (latest)';

COMMENT ON COLUMN clinic_events.event_type IS 'New=first appearance, Pause=stopped paying, Return=resumed after pause, Churn=cancelled';
COMMENT ON COLUMN clinic_events.is_auto_detected IS 'True if system detected, false if manually set';
COMMENT ON COLUMN clinic_events.confirmed IS 'User confirmed the auto-detected event';
