-- Fix RLS policies for invoices table
-- Execute this if you're getting "new row violates row-level security policy" error

-- Drop all existing policies
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.invoices;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.invoices;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.invoices;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.invoices;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.invoices;

-- Create new permissive policies
CREATE POLICY "Enable read access for all users" 
ON public.invoices FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for authenticated users" 
ON public.invoices FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" 
ON public.invoices FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" 
ON public.invoices FOR DELETE 
USING (true);

-- Grant necessary permissions
GRANT ALL ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
GRANT ALL ON public.invoices TO anon;
GRANT USAGE, SELECT ON SEQUENCE invoices_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE invoices_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE invoices_id_seq TO anon;

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'invoices';
