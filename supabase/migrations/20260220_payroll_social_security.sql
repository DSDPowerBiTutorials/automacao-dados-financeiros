-- Migration: Add 'social-security' to payroll_line_mappings target_category CHECK constraint
-- Also make concept_description nullable (auto-sync may not have description)
--
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/rrzgawssbyfzbkmtcovz/sql/new

-- 1. Drop existing constraint
ALTER TABLE payroll_line_mappings 
  DROP CONSTRAINT IF EXISTS payroll_line_mappings_target_category_check;

-- 2. Recreate with social-security included
ALTER TABLE payroll_line_mappings 
  ADD CONSTRAINT payroll_line_mappings_target_category_check 
  CHECK (target_category IN ('cogs', 'labour', 'office-rh-spain', 'social-security'));

-- 3. Make concept_description nullable (auto-sync may not always have it)
ALTER TABLE payroll_line_mappings 
  ALTER COLUMN concept_description DROP NOT NULL;
