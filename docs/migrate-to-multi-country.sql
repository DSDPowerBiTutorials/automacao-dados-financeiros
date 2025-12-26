-- Migration: Convert old scope system (DSD/LH/ALL) to new multi-country system (ES/US/GLOBAL)

-- Step 1: First, check if invoices table already exists with old scopes
DO $$ 
BEGIN
  -- If table exists with old data, update it
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices') THEN
    -- Update existing records to new scope values
    UPDATE public.invoices 
    SET scope = CASE 
      WHEN scope = 'dsd' THEN 'ES'
      WHEN scope = 'lh' THEN 'US'
      WHEN scope IN ('dsd_lh', 'all') THEN 'GLOBAL'
      ELSE scope
    END
    WHERE scope IN ('dsd', 'lh', 'dsd_lh', 'all');
    
    UPDATE public.invoices 
    SET country_code = CASE 
      WHEN country_code = 'dsd' THEN 'ES'
      WHEN country_code = 'lh' THEN 'US'
      WHEN country_code IN ('dsd_lh', 'all') THEN 'GLOBAL'
      ELSE country_code
    END
    WHERE country_code IN ('dsd', 'lh', 'dsd_lh', 'all');
    
    RAISE NOTICE 'Updated existing records to new scope system';
  END IF;
END $$;

-- Step 2: Drop old constraint if exists and add new one
DO $$ 
BEGIN
  -- Drop old constraints if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'invoices_country_code_check' 
    AND table_name = 'invoices'
  ) THEN
    ALTER TABLE public.invoices DROP CONSTRAINT invoices_country_code_check;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'invoices_scope_check' 
    AND table_name = 'invoices'
  ) THEN
    ALTER TABLE public.invoices DROP CONSTRAINT invoices_scope_check;
  END IF;
END $$;

-- Step 3: Add new constraints for multi-country support
ALTER TABLE public.invoices 
ADD CONSTRAINT invoices_country_code_check 
CHECK (country_code IN ('ES', 'US', 'GLOBAL'));

ALTER TABLE public.invoices 
ADD CONSTRAINT invoices_scope_check 
CHECK (scope IN ('ES', 'US', 'GLOBAL'));

-- Step 4: Update comments to reflect new system
COMMENT ON COLUMN public.invoices.scope IS 'Country scope: ES (Spain), US (United States), GLOBAL (Consolidated Spain+US)';
COMMENT ON COLUMN public.invoices.country_code IS 'Country code: ES (Spain), US (United States), GLOBAL (Consolidated)';
COMMENT ON COLUMN public.invoices.applies_to_all_countries IS 'True when scope is GLOBAL (applies to both ES and US)';

-- Migration complete
SELECT 'Migration completed successfully - Old scopes converted to: ES (Spain), US (United States), GLOBAL (Consolidated)' as status;
