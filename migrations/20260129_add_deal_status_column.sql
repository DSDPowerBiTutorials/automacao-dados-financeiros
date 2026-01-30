-- Adicionar coluna deal_status para guardar o status do deal (Credit Order, etc.)
ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS deal_status TEXT;

-- Comentário para documentação
COMMENT ON COLUMN ar_invoices.deal_status IS 'Status do deal no HubSpot (Credit Order, Checkout Completed, etc.)';
