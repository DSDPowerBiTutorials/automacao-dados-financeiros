-- Migration: Rename cost_centers to departmental_accounts and update products
-- Date: 2026-01-30
-- Description: 
--   1. Rename cost_centers to departmental_accounts with group/subgroup structure
--   2. Add departmental_account_id and departmental_account_group to products
--   3. Clean products table to only include Web Orders products

-- ============================================
-- PART 1: Create departmental_accounts table
-- ============================================

-- Create new departmental_accounts table (keep cost_centers for backwards compatibility)
CREATE TABLE IF NOT EXISTS departmental_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Hierarchy: group > subgroup > account
    level INTEGER DEFAULT 1, -- 1=group, 2=subgroup, 3=account
    parent_id UUID REFERENCES departmental_accounts(id) ON DELETE SET NULL,
    
    -- Full path for display (e.g., "Education > Courses > Online")
    full_path VARCHAR(500),
    
    -- Scope
    scope VARCHAR(10) DEFAULT 'GLOBAL',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_departmental_accounts_parent ON departmental_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_departmental_accounts_level ON departmental_accounts(level);
CREATE INDEX IF NOT EXISTS idx_departmental_accounts_code ON departmental_accounts(code);
CREATE INDEX IF NOT EXISTS idx_departmental_accounts_active ON departmental_accounts(is_active);

-- Migrate data from cost_centers if it exists
INSERT INTO departmental_accounts (code, name, level, is_active, created_at)
SELECT 
    code,
    name,
    COALESCE(level, 1),
    COALESCE(is_active, true),
    COALESCE(created_at, NOW())
FROM cost_centers
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- PART 2: Update products table
-- ============================================

-- Add departmental_account columns to products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS departmental_account_id UUID REFERENCES departmental_accounts(id) ON DELETE SET NULL;

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS departmental_account_group_id UUID REFERENCES departmental_accounts(id) ON DELETE SET NULL;

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS departmental_account_subgroup_id UUID REFERENCES departmental_accounts(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_departmental_account ON products(departmental_account_id);
CREATE INDEX IF NOT EXISTS idx_products_financial_account ON products(financial_account_id);
CREATE INDEX IF NOT EXISTS idx_products_source ON products(source);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- ============================================
-- PART 3: Insert default departmental account structure
-- ============================================

-- Insert main groups (level 1)
INSERT INTO departmental_accounts (code, name, level, description, full_path, is_active) VALUES
('DEP-EDU', 'Education', 1, 'Educational products and services', 'Education', true),
('DEP-TEC', 'Technology', 1, 'Technology products and services', 'Technology', true),
('DEP-SRV', 'Services', 1, 'Professional services', 'Services', true),
('DEP-SUB', 'Subscriptions', 1, 'Recurring subscription products', 'Subscriptions', true),
('DEP-MFG', 'Manufacturing', 1, 'Manufacturing and production', 'Manufacturing', true),
('DEP-CLI', 'Clinic Services', 1, 'Clinic and dental services', 'Clinic Services', true)
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    full_path = EXCLUDED.full_path;

-- Insert subgroups (level 2) for Education
INSERT INTO departmental_accounts (code, name, level, parent_id, description, full_path, is_active) VALUES
('DEP-EDU-CRS', 'Courses', 2, (SELECT id FROM departmental_accounts WHERE code = 'DEP-EDU'), 'Educational courses', 'Education > Courses', true),
('DEP-EDU-WKS', 'Workshops', 2, (SELECT id FROM departmental_accounts WHERE code = 'DEP-EDU'), 'Workshops and modules', 'Education > Workshops', true),
('DEP-EDU-RES', 'Residencies', 2, (SELECT id FROM departmental_accounts WHERE code = 'DEP-EDU'), 'Residency programs', 'Education > Residencies', true),
('DEP-EDU-CRT', 'Certifications', 2, (SELECT id FROM departmental_accounts WHERE code = 'DEP-EDU'), 'Certification programs', 'Education > Certifications', true)
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    full_path = EXCLUDED.full_path;

-- Insert subgroups for Services
INSERT INTO departmental_accounts (code, name, level, parent_id, description, full_path, is_active) VALUES
('DEP-SRV-PLN', 'Planning', 2, (SELECT id FROM departmental_accounts WHERE code = 'DEP-SRV'), 'Planning services', 'Services > Planning', true),
('DEP-SRV-DSG', 'Design', 2, (SELECT id FROM departmental_accounts WHERE code = 'DEP-SRV'), 'Design services', 'Services > Design', true),
('DEP-SRV-COA', 'Coaching', 2, (SELECT id FROM departmental_accounts WHERE code = 'DEP-SRV'), 'Coaching and mentoring', 'Services > Coaching', true)
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    full_path = EXCLUDED.full_path;

-- Insert subgroups for Subscriptions
INSERT INTO departmental_accounts (code, name, level, parent_id, description, full_path, is_active) VALUES
('DEP-SUB-L1', 'Level 1', 2, (SELECT id FROM departmental_accounts WHERE code = 'DEP-SUB'), 'Level 1 subscriptions', 'Subscriptions > Level 1', true),
('DEP-SUB-L2', 'Level 2', 2, (SELECT id FROM departmental_accounts WHERE code = 'DEP-SUB'), 'Level 2 subscriptions', 'Subscriptions > Level 2', true),
('DEP-SUB-L3', 'Level 3', 2, (SELECT id FROM departmental_accounts WHERE code = 'DEP-SUB'), 'Level 3 subscriptions', 'Subscriptions > Level 3', true),
('DEP-SUB-PRE', 'Premium', 2, (SELECT id FROM departmental_accounts WHERE code = 'DEP-SUB'), 'Premium subscriptions', 'Subscriptions > Premium', true)
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    full_path = EXCLUDED.full_path;

-- Insert subgroups for Manufacturing
INSERT INTO departmental_accounts (code, name, level, parent_id, description, full_path, is_active) VALUES
('DEP-MFG-GDE', 'Guides', 2, (SELECT id FROM departmental_accounts WHERE code = 'DEP-MFG'), 'Manufacturing guides', 'Manufacturing > Guides', true),
('DEP-MFG-IMP', 'Implants', 2, (SELECT id FROM departmental_accounts WHERE code = 'DEP-MFG'), 'Implant manufacturing', 'Manufacturing > Implants', true),
('DEP-MFG-ORT', 'Ortho', 2, (SELECT id FROM departmental_accounts WHERE code = 'DEP-MFG'), 'Ortho manufacturing', 'Manufacturing > Ortho', true)
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    full_path = EXCLUDED.full_path;

-- ============================================
-- PART 4: Enable RLS
-- ============================================

ALTER TABLE departmental_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "authenticated_select_departmental_accounts" ON departmental_accounts;
CREATE POLICY "authenticated_select_departmental_accounts" ON departmental_accounts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_departmental_accounts" ON departmental_accounts;
CREATE POLICY "authenticated_insert_departmental_accounts" ON departmental_accounts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_departmental_accounts" ON departmental_accounts;
CREATE POLICY "authenticated_update_departmental_accounts" ON departmental_accounts FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_delete_departmental_accounts" ON departmental_accounts;
CREATE POLICY "authenticated_delete_departmental_accounts" ON departmental_accounts FOR DELETE TO authenticated USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON departmental_accounts TO authenticated;

-- ============================================
-- PART 5: Update trigger for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_departmental_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_departmental_accounts_updated_at ON departmental_accounts;
CREATE TRIGGER trigger_departmental_accounts_updated_at
    BEFORE UPDATE ON departmental_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_departmental_accounts_updated_at();

-- ============================================
-- Done!
-- ============================================
