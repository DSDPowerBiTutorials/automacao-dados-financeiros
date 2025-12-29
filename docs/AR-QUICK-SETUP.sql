-- ============================================
-- ACCOUNTS RECEIVABLE - QUICK SETUP
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. CREATE CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'ES',
  currency TEXT DEFAULT 'EUR',
  payment_terms TEXT DEFAULT 'net_30',
  credit_limit DECIMAL(15,2),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_country ON customers(country);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- 2. ADD CUSTOMER_CODE TO INVOICES
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_code TEXT;
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_code);

-- 3. INSERT REVENUE FINANCIAL ACCOUNTS
-- Level 1 accounts
INSERT INTO financial_accounts (code, name, type, level, parent_code, country_code, applies_to_all_countries, is_active)
VALUES
  ('101.0', '101.0 - Growth', 'revenue', 1, NULL, 'ES', true, true),
  ('102.0', '102.0 - Delight', 'revenue', 1, NULL, 'ES', true, true),
  ('103.0', '103.0 - Planning Center', 'revenue', 1, NULL, 'ES', true, true),
  ('104.0', '104.0 - LAB', 'revenue', 1, NULL, 'ES', true, true),
  ('105.0', '105.0 - Other Income', 'revenue', 1, NULL, 'ES', true, true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type;

-- Growth accounts (101.x)
INSERT INTO financial_accounts (code, name, type, level, parent_code, country_code, applies_to_all_countries, is_active)
VALUES
  ('101.1', '101.1 - DSD Courses', 'revenue', 2, '101.0', 'ES', true, true),
  ('101.2', '101.2 - Others Courses', 'revenue', 2, '101.0', 'ES', true, true),
  ('101.3', '101.3 - Mastership', 'revenue', 2, '101.0', 'ES', true, true),
  ('101.4', '101.4 - PC Membership', 'revenue', 2, '101.0', 'ES', true, true),
  ('101.5', '101.5 - Partnerships', 'revenue', 2, '101.0', 'ES', true, true),
  ('101.6', '101.6 - Level 2 Allocation', 'revenue', 2, '101.0', 'ES', true, true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, parent_code = EXCLUDED.parent_code;

-- Delight accounts (102.x)
INSERT INTO financial_accounts (code, name, type, level, parent_code, country_code, applies_to_all_countries, is_active)
VALUES
  ('102.1', '102.1 - Contracted ROW', 'revenue', 2, '102.0', 'ES', true, true),
  ('102.2', '102.2 - Contracted AMEX', 'revenue', 2, '102.0', 'ES', true, true),
  ('102.3', '102.3 - Level 3 New ROW', 'revenue', 2, '102.0', 'ES', true, true),
  ('102.4', '102.4 - Level 3 New AMEX', 'revenue', 2, '102.0', 'ES', true, true),
  ('102.5', '102.5 - Consultancies', 'revenue', 2, '102.0', 'ES', true, true),
  ('102.6', '102.6 - Marketing Coaching', 'revenue', 2, '102.0', 'ES', true, true),
  ('102.7', '102.7 - Others', 'revenue', 2, '102.0', 'ES', true, true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, parent_code = EXCLUDED.parent_code;

-- Planning Center accounts (103.x)
INSERT INTO financial_accounts (code, name, type, level, parent_code, country_code, applies_to_all_countries, is_active)
VALUES
  ('103.1', '103.1 - Level 3 ROW', 'revenue', 2, '103.0', 'ES', true, true),
  ('103.2', '103.2 - Level 3 AMEX', 'revenue', 2, '103.0', 'ES', true, true),
  ('103.3', '103.3 - Level 3 New ROW', 'revenue', 2, '103.0', 'ES', true, true),
  ('103.4', '103.4 - Level 3 New AMEX', 'revenue', 2, '103.0', 'ES', true, true),
  ('103.5', '103.5 - Level 2', 'revenue', 2, '103.0', 'ES', true, true),
  ('103.6', '103.6 - Level 1', 'revenue', 2, '103.0', 'ES', true, true),
  ('103.7', '103.7 - Not a Subscriber', 'revenue', 2, '103.0', 'ES', true, true),
  ('103.8', '103.8 - Level 2 Allocation', 'revenue', 2, '103.0', 'ES', true, true),
  ('103.9', '103.9 - Level 3 Allocation', 'revenue', 2, '103.0', 'ES', true, true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, parent_code = EXCLUDED.parent_code;

-- LAB accounts (104.x)
INSERT INTO financial_accounts (code, name, type, level, parent_code, country_code, applies_to_all_countries, is_active)
VALUES
  ('104.1', '104.1 - Level 3 ROW', 'revenue', 2, '104.0', 'ES', true, true),
  ('104.2', '104.2 - Level 3 AMEX', 'revenue', 2, '104.0', 'ES', true, true),
  ('104.3', '104.3 - Level 3 New ROW', 'revenue', 2, '104.0', 'ES', true, true),
  ('104.4', '104.4 - Level 3 New AMEX', 'revenue', 2, '104.0', 'ES', true, true),
  ('104.5', '104.5 - Level 2', 'revenue', 2, '104.0', 'ES', true, true),
  ('104.6', '104.6 - Level 1', 'revenue', 2, '104.0', 'ES', true, true),
  ('104.7', '104.7 - Not a Subscriber', 'revenue', 2, '104.0', 'ES', true, true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, parent_code = EXCLUDED.parent_code;

-- Other Income accounts (105.x)
INSERT INTO financial_accounts (code, name, type, level, parent_code, country_code, applies_to_all_countries, is_active)
VALUES
  ('105.1', '105.1 - Level 1', 'revenue', 2, '105.0', 'ES', true, true),
  ('105.2', '105.2 - CORE Partnerships', 'revenue', 2, '105.0', 'ES', true, true),
  ('105.3', '105.3 - Study Club', 'revenue', 2, '105.0', 'ES', true, true),
  ('105.4', '105.4 - Other Marketing Revenues', 'revenue', 2, '105.0', 'ES', true, true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, parent_code = EXCLUDED.parent_code;

-- 4. VERIFY SETUP
SELECT 
  'Total revenue accounts' as description,
  COUNT(*) as count
FROM financial_accounts 
WHERE type = 'revenue';

-- 5. SHOW SAMPLE ACCOUNTS
SELECT code, name, level, parent_code
FROM financial_accounts
WHERE type = 'revenue'
ORDER BY code
LIMIT 15;
