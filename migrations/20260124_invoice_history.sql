-- Invoice History Table for tracking all changes
-- Run this in Supabase SQL Editor

-- Create history table
CREATE TABLE IF NOT EXISTS invoice_history (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL, -- 'created', 'finance_status', 'invoice_status', 'schedule_date', 'paid', 'updated'
    field_name TEXT, -- which field changed
    old_value TEXT, -- previous value
    new_value TEXT, -- new value
    changed_by TEXT, -- user email or 'system'
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_invoice_history_invoice_id ON invoice_history(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_history_change_type ON invoice_history(change_type);
CREATE INDEX IF NOT EXISTS idx_invoice_history_changed_at ON invoice_history(changed_at DESC);

-- RLS Policies
ALTER TABLE invoice_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read invoice_history" ON invoice_history FOR SELECT USING (true);
CREATE POLICY "Allow insert invoice_history" ON invoice_history FOR INSERT WITH CHECK (true);

-- Function to auto-record history on invoice updates
CREATE OR REPLACE FUNCTION record_invoice_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Track finance_payment_status changes
    IF OLD.finance_payment_status IS DISTINCT FROM NEW.finance_payment_status THEN
        INSERT INTO invoice_history (invoice_id, change_type, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'finance_status', 'finance_payment_status', OLD.finance_payment_status, NEW.finance_payment_status, 'user');
    END IF;
    
    -- Track invoice_status changes
    IF OLD.invoice_status IS DISTINCT FROM NEW.invoice_status THEN
        INSERT INTO invoice_history (invoice_id, change_type, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'invoice_status', 'invoice_status', OLD.invoice_status, NEW.invoice_status, 'user');
    END IF;
    
    -- Track schedule_date changes
    IF OLD.schedule_date IS DISTINCT FROM NEW.schedule_date THEN
        INSERT INTO invoice_history (invoice_id, change_type, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'schedule_date', 'schedule_date', OLD.schedule_date::text, NEW.schedule_date::text, 'user');
    END IF;
    
    -- Track payment_date changes (paid/unpaid)
    IF OLD.payment_date IS DISTINCT FROM NEW.payment_date THEN
        INSERT INTO invoice_history (invoice_id, change_type, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, CASE WHEN NEW.payment_date IS NOT NULL THEN 'paid' ELSE 'unpaid' END, 'payment_date', OLD.payment_date::text, NEW.payment_date::text, 'user');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS invoice_history_trigger ON invoices;
CREATE TRIGGER invoice_history_trigger
    AFTER UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION record_invoice_history();

-- Also record when invoice is created
CREATE OR REPLACE FUNCTION record_invoice_created()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO invoice_history (invoice_id, change_type, field_name, new_value, changed_by)
    VALUES (NEW.id, 'created', 'invoice', 'Invoice created', 'user');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_created_trigger ON invoices;
CREATE TRIGGER invoice_created_trigger
    AFTER INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION record_invoice_created();

-- Verify columns exist (in case previous migration failed)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'finance_payment_status') THEN
        ALTER TABLE invoices ADD COLUMN finance_payment_status TEXT DEFAULT 'pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'invoice_status') THEN
        ALTER TABLE invoices ADD COLUMN invoice_status TEXT DEFAULT 'pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'finance_status_changed_at') THEN
        ALTER TABLE invoices ADD COLUMN finance_status_changed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'invoice_status_changed_at') THEN
        ALTER TABLE invoices ADD COLUMN invoice_status_changed_at TIMESTAMPTZ;
    END IF;
END $$;
