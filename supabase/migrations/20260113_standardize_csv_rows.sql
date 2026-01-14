-- =====================================================
-- Migration: Padronização da tabela csv_rows
-- Data: 2026-01-13
-- Objetivo: Aplicar melhores práticas de banco de dados
-- =====================================================

-- 1. ADICIONAR COLUNA date_ts (TIMESTAMPTZ) para datas normalizadas
-- Mantém a coluna date original para compatibilidade retroativa
ALTER TABLE csv_rows 
ADD COLUMN IF NOT EXISTS date_ts TIMESTAMPTZ;

-- 2. MIGRAR DADOS: Converter date (TEXT) para date_ts (TIMESTAMPTZ)
-- Trata diferentes formatos: ISO com timezone, ISO sem timezone, apenas data
UPDATE csv_rows 
SET date_ts = CASE
    -- Formato ISO com timezone (2026-01-13T00:00:00.000Z)
    WHEN date ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}' THEN date::TIMESTAMPTZ
    -- Formato apenas data (2026-01-08)
    WHEN date ~ '^\d{4}-\d{2}-\d{2}$' THEN (date || 'T00:00:00Z')::TIMESTAMPTZ
    -- Formato DD/MM/YYYY (formato europeu)
    WHEN date ~ '^\d{2}/\d{2}/\d{4}$' THEN TO_TIMESTAMP(date, 'DD/MM/YYYY')
    -- Fallback: tentar conversão direta
    ELSE date::TIMESTAMPTZ
END
WHERE date IS NOT NULL AND date != '' AND date_ts IS NULL;

-- 3. ADICIONAR COLUNA currency para moeda (se não existir)
ALTER TABLE csv_rows 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'EUR';

-- 4. EXTRAIR currency do custom_data onde disponível
UPDATE csv_rows 
SET currency = UPPER(custom_data->>'currency')
WHERE custom_data->>'currency' IS NOT NULL 
  AND currency = 'EUR';

-- 5. ADICIONAR COLUNA amount_cents para valores em centavos (evita problemas de ponto flutuante)
ALTER TABLE csv_rows 
ADD COLUMN IF NOT EXISTS amount_cents BIGINT;

-- Converter amount para centavos
UPDATE csv_rows 
SET amount_cents = ROUND(amount * 100)::BIGINT
WHERE amount IS NOT NULL AND amount_cents IS NULL;

-- 6. CRIAR ÍNDICES PARA PERFORMANCE
-- Índice composto para consultas por source + data (mais comum)
CREATE INDEX IF NOT EXISTS idx_csv_rows_source_date 
ON csv_rows(source, date_ts DESC);

-- Índice para buscas por data
CREATE INDEX IF NOT EXISTS idx_csv_rows_date_ts 
ON csv_rows(date_ts DESC);

-- Índice para status de reconciliação
CREATE INDEX IF NOT EXISTS idx_csv_rows_reconciled 
ON csv_rows(reconciled) WHERE reconciled = false;

-- Índice para external_id (usado em integrações)
CREATE INDEX IF NOT EXISTS idx_csv_rows_external_id 
ON csv_rows(external_id) WHERE external_id IS NOT NULL;

-- Índice para customer_email (buscas por cliente)
CREATE INDEX IF NOT EXISTS idx_csv_rows_customer_email 
ON csv_rows(customer_email) WHERE customer_email IS NOT NULL;

-- Índice GIN para busca em custom_data (JSONB)
CREATE INDEX IF NOT EXISTS idx_csv_rows_custom_data 
ON csv_rows USING GIN(custom_data);

-- 7. ADICIONAR CONSTRAINTS
-- Garantir que amount_cents e amount são consistentes
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_amount_positive' 
        AND conrelid = 'csv_rows'::regclass
    ) THEN
        ALTER TABLE csv_rows 
        ADD CONSTRAINT chk_amount_positive 
        CHECK (amount IS NULL OR amount >= -999999999);
    END IF;
END $$;

-- 8. COMENTÁRIOS PARA DOCUMENTAÇÃO
COMMENT ON COLUMN csv_rows.date IS 'Data original em formato texto (mantido para compatibilidade)';
COMMENT ON COLUMN csv_rows.date_ts IS 'Data normalizada em TIMESTAMPTZ (usar para queries)';
COMMENT ON COLUMN csv_rows.amount IS 'Valor em formato decimal (usar amount_cents para cálculos precisos)';
COMMENT ON COLUMN csv_rows.amount_cents IS 'Valor em centavos (BIGINT) para cálculos precisos';
COMMENT ON COLUMN csv_rows.currency IS 'Código ISO 4217 da moeda (EUR, USD, GBP)';
COMMENT ON COLUMN csv_rows.custom_data IS 'Dados específicos da fonte em formato JSONB';
COMMENT ON COLUMN csv_rows.external_id IS 'ID único do sistema origem (Braintree, Stripe, etc)';

-- 9. CRIAR VIEW para consultas padronizadas
CREATE OR REPLACE VIEW csv_rows_normalized AS
SELECT 
    id,
    file_name,
    source,
    COALESCE(date_ts, date::TIMESTAMPTZ) as transaction_date,
    date_ts,
    date as date_original,
    description,
    amount,
    amount_cents,
    currency,
    category,
    classification,
    deposit_account,
    payment_method,
    order_numbers,
    reconciled,
    matched_with,
    matched_source,
    match_confidence,
    match_details,
    matched_at,
    customer_email,
    customer_name,
    external_id,
    custom_data,
    created_at,
    updated_at
FROM csv_rows;

COMMENT ON VIEW csv_rows_normalized IS 'View padronizada com data normalizada para queries';

-- 10. FUNÇÃO HELPER para converter datas de forma consistente
CREATE OR REPLACE FUNCTION parse_transaction_date(date_str TEXT)
RETURNS TIMESTAMPTZ AS $$
BEGIN
    IF date_str IS NULL OR date_str = '' THEN
        RETURN NULL;
    END IF;
    
    -- Formato ISO com timezone
    IF date_str ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}' THEN
        RETURN date_str::TIMESTAMPTZ;
    END IF;
    
    -- Formato apenas data ISO
    IF date_str ~ '^\d{4}-\d{2}-\d{2}$' THEN
        RETURN (date_str || 'T00:00:00Z')::TIMESTAMPTZ;
    END IF;
    
    -- Formato DD/MM/YYYY
    IF date_str ~ '^\d{2}/\d{2}/\d{4}$' THEN
        RETURN TO_TIMESTAMP(date_str, 'DD/MM/YYYY');
    END IF;
    
    -- Fallback
    RETURN date_str::TIMESTAMPTZ;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION parse_transaction_date IS 'Converte string de data em TIMESTAMPTZ de forma consistente';
