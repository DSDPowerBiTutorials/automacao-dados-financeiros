-- Make required fields NOT NULL in invoices table
-- Execute this to enforce required fields

-- IMPORTANT: Before running, make sure all existing records have values for these fields
-- You can check with: SELECT * FROM invoices WHERE provider_code IS NULL OR financial_account_code IS NULL OR cost_center_code IS NULL OR cost_type_code IS NULL OR dep_cost_type_code IS NULL OR due_date IS NULL OR schedule_date IS NULL;

-- If you have NULL values, update them first:
-- UPDATE invoices SET due_date = benefit_date WHERE due_date IS NULL;
-- UPDATE invoices SET schedule_date = due_date WHERE schedule_date IS NULL;
-- etc.

-- Step 1: Update NULL values with defaults (if any exist)
UPDATE public.invoices 
SET due_date = benefit_date 
WHERE due_date IS NULL;

UPDATE public.invoices 
SET schedule_date = COALESCE(due_date, benefit_date)
WHERE schedule_date IS NULL;

-- Step 2: Add NOT NULL constraints
ALTER TABLE public.invoices 
ALTER COLUMN provider_code SET NOT NULL;

ALTER TABLE public.invoices 
ALTER COLUMN financial_account_code SET NOT NULL;

ALTER TABLE public.invoices 
ALTER COLUMN cost_center_code SET NOT NULL;

ALTER TABLE public.invoices 
ALTER COLUMN cost_type_code SET NOT NULL;

ALTER TABLE public.invoices 
ALTER COLUMN dep_cost_type_code SET NOT NULL;

ALTER TABLE public.invoices 
ALTER COLUMN due_date SET NOT NULL;

ALTER TABLE public.invoices 
ALTER COLUMN schedule_date SET NOT NULL;

-- Step 3: Add comments for documentation
COMMENT ON COLUMN public.invoices.provider_code IS 'Provider code (REQUIRED) - Reference to providers table';
COMMENT ON COLUMN public.invoices.financial_account_code IS 'Financial account code (REQUIRED) - Reference to financial_accounts table';
COMMENT ON COLUMN public.invoices.cost_center_code IS 'Cost center code (REQUIRED) - Reference to cost_centers table';
COMMENT ON COLUMN public.invoices.cost_type_code IS 'Cost type code (REQUIRED) - Reference to cost_types table';
COMMENT ON COLUMN public.invoices.dep_cost_type_code IS 'Depreciation cost type code (REQUIRED) - Reference to dep_cost_types table';
COMMENT ON COLUMN public.invoices.due_date IS 'Invoice due date (REQUIRED)';
COMMENT ON COLUMN public.invoices.schedule_date IS 'Payment schedule date (REQUIRED) - Defaults to due_date';

-- Verify constraints
SELECT 
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_name = 'invoices'
  AND column_name IN ('provider_code', 'financial_account_code', 'cost_center_code', 
                      'cost_type_code', 'dep_cost_type_code', 'due_date', 'schedule_date')
ORDER BY ordinal_position;
