-- Migration: Create invoice_activities table for comments and activity tracking
-- Run this in Supabase SQL Editor

-- Create invoice_activities table
CREATE TABLE
IF NOT EXISTS invoice_activities
(
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices
(id) ON
DELETE CASCADE,
    user_id UUID
REFERENCES auth.users
(id),
    user_email TEXT,
    user_name TEXT,
    activity_type TEXT NOT NULL DEFAULT 'comment', -- 'comment', 'created', 'updated', 'scheduled', 'paid', 'attachment'
    content TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW
(),
    updated_at TIMESTAMPTZ DEFAULT NOW
()
);

-- Create index for faster lookups
CREATE INDEX
IF NOT EXISTS idx_invoice_activities_invoice_id ON invoice_activities
(invoice_id);
CREATE INDEX
IF NOT EXISTS idx_invoice_activities_created_at ON invoice_activities
(created_at DESC);

-- Enable RLS
ALTER TABLE invoice_activities ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow authenticated users to read invoice_activities"
    ON invoice_activities FOR
SELECT
    TO authenticated
USING
(true);

CREATE POLICY "Allow authenticated users to insert invoice_activities"
    ON invoice_activities FOR
INSERT
    TO authenticated
    WITH CHECK (
true);

CREATE POLICY "Allow authenticated users to update their own activities"
    ON invoice_activities FOR
UPDATE
    TO authenticated
    USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Allow authenticated users to delete their own activities"
    ON invoice_activities FOR
DELETE
    TO authenticated
    USING (user_id = auth.uid() OR user_id IS NULL);

-- Grant permissions
GRANT ALL ON invoice_activities TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE invoice_activities_id_seq TO authenticated;
