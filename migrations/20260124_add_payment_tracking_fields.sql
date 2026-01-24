-- Migration: Add payment tracking fields for schedule page
-- Run this in Supabase SQL Editor

-- Add finance_payment_status (workflow status)
ALTER TABLE invoices 
ADD COLUMN
IF NOT EXISTS finance_payment_status TEXT DEFAULT 'pending' 
CHECK
(finance_payment_status IN
('pending', 'uploaded', 'done', 'info_required'));

-- Add invoice_status (attachment status)
ALTER TABLE invoices 
ADD COLUMN
IF NOT EXISTS invoice_status TEXT DEFAULT 'pending' 
CHECK
(invoice_status IN
('pending', 'available'));

-- Add status change tracking timestamps
ALTER TABLE invoices 
ADD COLUMN
IF NOT EXISTS finance_status_changed_at TIMESTAMPTZ;

ALTER TABLE invoices 
ADD COLUMN
IF NOT EXISTS invoice_status_changed_at TIMESTAMPTZ;

-- Update existing invoices: if they have attachments, set invoice_status to 'available'
-- (This will be handled by the application logic)

-- Create index for filtering
CREATE INDEX
IF NOT EXISTS idx_invoices_finance_payment_status ON invoices
(finance_payment_status);
CREATE INDEX
IF NOT EXISTS idx_invoices_invoice_status ON invoices
(invoice_status);

-- Done!
SELECT 'Payment tracking fields added successfully!' as status;
