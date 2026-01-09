-- =============================================================================
-- FIX: csv_rows table - NULL value in column "id" error
-- =============================================================================
-- Problem: Column "id" doesn't have DEFAULT value configured
-- Solution: Add DEFAULT gen_random_uuid() for UUID type
-- Execute this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- =============================================================================

-- Step 1: Check current schema
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'csv_rows'
ORDER BY ordinal_position;

-- Step 2: Check if id column exists and its type
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'csv_rows' AND column_name = 'id';

-- =============================================================================
-- Step 3: FIX - Add DEFAULT value to id column
-- =============================================================================

-- If id is UUID type:
ALTER TABLE csv_rows 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- If id is BIGINT/INTEGER type (uncomment if needed):
-- CREATE SEQUENCE IF NOT EXISTS csv_rows_id_seq;
-- ALTER TABLE csv_rows 
-- ALTER COLUMN id SET DEFAULT nextval('csv_rows_id_seq'::regclass);

-- =============================================================================
-- Step 4: Verify fix
-- =============================================================================
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'csv_rows' AND column_name = 'id';

-- Should show something like:
-- id | uuid | gen_random_uuid()

-- =============================================================================
-- Step 5: Test insert
-- =============================================================================
INSERT INTO csv_rows (source, file_name, date, description, amount, category, classification, reconciled, custom_data)
VALUES (
    'test-source',
    'test-file.csv',
    '2026-01-09',
    'Test transaction',
    '100.00',
    'Test',
    'Test',
    false,
    '{}'::jsonb
)
RETURNING id;

-- If this returns an id, the fix worked! Delete the test row:
DELETE FROM csv_rows WHERE source = 'test-source' AND file_name = 'test-file.csv';
