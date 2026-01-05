-- Migration: Adicionar campos de matching para reconciliação HubSpot
-- Descrição: Campos necessários para o sistema de auto-matching

-- 1. Adicionar campos de cliente para linkagem
ALTER TABLE csv_rows 
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- 2. Adicionar campos de matching/reconciliação
ALTER TABLE csv_rows 
ADD COLUMN IF NOT EXISTS matched_with UUID REFERENCES csv_rows(id),
ADD COLUMN IF NOT EXISTS matched_source TEXT,
ADD COLUMN IF NOT EXISTS match_confidence INTEGER CHECK (match_confidence >= 0 AND match_confidence <= 100),
ADD COLUMN IF NOT EXISTS match_details JSONB,
ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ;

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_csv_rows_customer_email ON csv_rows(customer_email) WHERE customer_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_csv_rows_customer_name ON csv_rows(customer_name) WHERE customer_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_csv_rows_matched_with ON csv_rows(matched_with) WHERE matched_with IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_csv_rows_reconciled ON csv_rows(reconciled);
CREATE INDEX IF NOT EXISTS idx_csv_rows_source_reconciled ON csv_rows(source, reconciled);

-- 4. Comentários para documentação
COMMENT ON COLUMN csv_rows.customer_email IS 'Email do cliente extraído do HubSpot Contact ou Payment Channel';
COMMENT ON COLUMN csv_rows.customer_name IS 'Nome completo do cliente para matching';
COMMENT ON COLUMN csv_rows.matched_with IS 'ID do registro pareado (referência para outra linha)';
COMMENT ON COLUMN csv_rows.matched_source IS 'Source do registro pareado (ex: braintree-eur, hubspot)';
COMMENT ON COLUMN csv_rows.match_confidence IS 'Nível de confiança do match (0-100%)';
COMMENT ON COLUMN csv_rows.match_details IS 'Detalhes do matching: critérios usados, similaridades, motivos';
COMMENT ON COLUMN csv_rows.matched_at IS 'Timestamp de quando o match foi realizado';

-- 5. View para facilitar consultas de matches
CREATE OR REPLACE VIEW reconciled_pairs AS
SELECT 
    a.id as record_a_id,
    a.source as record_a_source,
    a.date as record_a_date,
    a.description as record_a_description,
    a.amount as record_a_amount,
    a.customer_email as record_a_email,
    a.customer_name as record_a_name,
    
    b.id as record_b_id,
    b.source as record_b_source,
    b.date as record_b_date,
    b.description as record_b_description,
    b.amount as record_b_amount,
    b.customer_email as record_b_email,
    b.customer_name as record_b_name,
    
    a.match_confidence,
    a.match_details,
    a.matched_at,
    
    -- Cálculos úteis
    ABS(EXTRACT(EPOCH FROM (a.date::timestamp - b.date::timestamp)) / 86400) as days_diff,
    ABS(a.amount - b.amount) as amount_diff,
    ABS((a.amount - b.amount) / ((a.amount + b.amount) / 2) * 100) as amount_diff_percent
    
FROM csv_rows a
INNER JOIN csv_rows b ON a.matched_with = b.id
WHERE a.reconciled = true AND b.reconciled = true;

COMMENT ON VIEW reconciled_pairs IS 'View para facilitar análise de pares reconciliados com métricas calculadas';
