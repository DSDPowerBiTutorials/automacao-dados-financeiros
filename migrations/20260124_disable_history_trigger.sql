-- Disable automatic triggers since we now record history manually with user names
-- Run this in Supabase SQL Editor

-- Drop the update trigger (we now record manually from frontend with user names)
DROP TRIGGER IF EXISTS invoice_history_trigger
ON invoices;

-- Keep the created trigger for new invoices
-- (already exists from previous migration)
