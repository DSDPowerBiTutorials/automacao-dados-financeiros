-- Migration: Invoice Attachments System
-- Storage: SharePoint via Microsoft Graph
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ATTACHMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT DEFAULT 'DSD',
    
    -- Entity linking (invoice, payment, vendor, etc.)
    entity_type TEXT NOT NULL CHECK (entity_type IN ('invoice', 'payment', 'vendor', 'other')),
    entity_id INTEGER, -- Can be null for draft uploads
    batch_id UUID, -- For uploads before entity exists
    
    -- File classification
    kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('invoice_pdf', 'payment_proof', 'contract', 'receipt', 'other')),
    
    -- File metadata
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT,
    
    -- Storage info (SharePoint)
    storage_provider TEXT DEFAULT 'sharepoint',
    storage_site_id TEXT,
    storage_drive_id TEXT,
    storage_item_id TEXT,
    storage_path TEXT,
    web_url TEXT,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. ATTACHMENT BATCHES (for draft uploads)
-- ============================================
CREATE TABLE IF NOT EXISTS attachment_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT DEFAULT 'DSD',
    
    -- Status
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'linked', 'expired')),
    
    -- Linked entity (filled when invoice is created)
    linked_entity_type TEXT,
    linked_entity_id INTEGER,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    linked_at TIMESTAMPTZ
);

-- ============================================
-- 3. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attachments_batch ON attachments(batch_id);
CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON attachments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachment_batches_status ON attachment_batches(status);

-- ============================================
-- 4. RLS POLICIES
-- ============================================
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachment_batches ENABLE ROW LEVEL SECURITY;

-- Attachments: authenticated users can read/write
DROP POLICY IF EXISTS "attachments_select" ON attachments;
CREATE POLICY "attachments_select" ON attachments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "attachments_insert" ON attachments;
CREATE POLICY "attachments_insert" ON attachments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "attachments_update" ON attachments;
CREATE POLICY "attachments_update" ON attachments FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "attachments_delete" ON attachments;
CREATE POLICY "attachments_delete" ON attachments FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Batches: authenticated users can read/write
DROP POLICY IF EXISTS "attachment_batches_select" ON attachment_batches;
CREATE POLICY "attachment_batches_select" ON attachment_batches FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "attachment_batches_insert" ON attachment_batches;
CREATE POLICY "attachment_batches_insert" ON attachment_batches FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "attachment_batches_update" ON attachment_batches;
CREATE POLICY "attachment_batches_update" ON attachment_batches FOR UPDATE TO authenticated USING (true);

-- ============================================
-- 5. GRANTS
-- ============================================
GRANT ALL ON attachments TO authenticated;
GRANT ALL ON attachment_batches TO authenticated;

-- ============================================
-- 6. FUNCTION: Link batch to entity
-- ============================================
CREATE OR REPLACE FUNCTION link_attachment_batch(
    p_batch_id UUID,
    p_entity_type TEXT,
    p_entity_id INTEGER
) RETURNS VOID AS $$
BEGIN
    -- Update batch
    UPDATE attachment_batches 
    SET status = 'linked',
        linked_entity_type = p_entity_type,
        linked_entity_id = p_entity_id,
        linked_at = NOW()
    WHERE id = p_batch_id;
    
    -- Update attachments
    UPDATE attachments 
    SET entity_type = p_entity_type,
        entity_id = p_entity_id,
        updated_at = NOW()
    WHERE batch_id = p_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done!
SELECT 'Attachments system created successfully!' as status;
