-- Migration: Add sub_department_code to invoices and create sub_departments table
-- Run this in Supabase SQL Editor

-- Create sub_departments table
CREATE TABLE IF NOT EXISTS sub_departments (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    parent_department_code VARCHAR(20) NOT NULL,
    color VARCHAR(20) DEFAULT 'gray',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add sub_department_code to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sub_department_code VARCHAR(20);

-- RLS for sub_departments
ALTER TABLE sub_departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all sub_departments" ON sub_departments;
CREATE POLICY "Allow all sub_departments" ON sub_departments FOR ALL USING (true);

-- Add new Departments (without deleting existing - to preserve FK references)
INSERT INTO cost_centers (code, name, level, is_active) VALUES
    ('1.0.0', 'Education', 1, true),
    ('2.0.0', 'Lab', 1, true),
    ('3.0.0', 'Corporate', 1, true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, level = EXCLUDED.level;

-- Insert Sub-Departments
INSERT INTO sub_departments (code, name, parent_department_code, color) VALUES
    ('1.1.0', 'Education', '1.0.0', 'yellow'),
    ('2.1.0', 'Lab', '2.0.0', 'orange'),
    ('2.1.1', 'PC', '2.0.0', 'gray'),
    ('2.1.2', 'Delight', '2.0.0', 'orange'),
    ('3.1.0', 'Corporate', '3.0.0', 'blue'),
    ('3.1.2', 'Marketing', '3.0.0', 'pink')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    parent_department_code = EXCLUDED.parent_department_code,
    color = EXCLUDED.color;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_sub_department ON invoices(sub_department_code);
CREATE INDEX IF NOT EXISTS idx_sub_departments_parent ON sub_departments(parent_department_code);
