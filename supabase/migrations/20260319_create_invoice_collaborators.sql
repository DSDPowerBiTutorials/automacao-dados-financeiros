-- Migration: Create invoice_collaborators table
-- Purpose: Track collaborators on scheduled payment invoices
-- Pattern: Same as ws_task_collaborators but for invoices

CREATE TABLE
IF NOT EXISTS invoice_collaborators
(
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices
(id) ON
DELETE CASCADE,
    user_id UUID
NOT NULL,
    added_by UUID,
    added_at TIMESTAMPTZ DEFAULT NOW
(),
    UNIQUE
(invoice_id, user_id)
);

-- Indexes for common queries
CREATE INDEX
IF NOT EXISTS idx_invoice_collaborators_invoice ON invoice_collaborators
(invoice_id);
CREATE INDEX
IF NOT EXISTS idx_invoice_collaborators_user ON invoice_collaborators
(user_id);

-- Disable RLS (uses supabaseAdmin / service role key)
ALTER TABLE invoice_collaborators DISABLE ROW LEVEL SECURITY;
