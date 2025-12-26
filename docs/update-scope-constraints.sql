-- Update invoices table to enforce ES/US only (remove GLOBAL option)
-- GLOBAL is a view-only mode that shows ES + US consolidated

-- Step 1: Check if there are any invoices with scope='GLOBAL' (should not exist)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM public.invoices WHERE scope = 'GLOBAL') THEN
    RAISE EXCEPTION 'Found invoices with scope=GLOBAL. Please reassign them to ES or US before running this migration.';
  END IF;
END $$;

-- Step 2: Drop old constraints if they exist
ALTER TABLE public.invoices 
DROP CONSTRAINT IF EXISTS invoices_country_code_check;

ALTER TABLE public.invoices 
DROP CONSTRAINT IF EXISTS invoices_scope_check;

-- Step 3: Add new constraints (only ES and US allowed)
ALTER TABLE public.invoices 
ADD CONSTRAINT invoices_country_code_check 
CHECK (country_code IN ('ES', 'US'));

ALTER TABLE public.invoices 
ADD CONSTRAINT invoices_scope_check 
CHECK (scope IN ('ES', 'US'));

-- Step 4: Update comments
COMMENT ON COLUMN public.invoices.scope IS 'Country scope: ES (Spain) or US (United States) - GLOBAL is view-only in UI (shows ES + US consolidated)';
COMMENT ON COLUMN public.invoices.country_code IS 'Country code: ES (Spain) or US (United States) - matches scope field';

-- Verify changes
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'invoices'
  AND column_name IN ('scope', 'country_code')
ORDER BY ordinal_position;

SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%scope%' OR constraint_name LIKE '%country_code%';
