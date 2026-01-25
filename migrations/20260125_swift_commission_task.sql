-- =====================================================
-- Swift Commission Auto-Invoice Task Registration
-- 
-- Registra a task no banco para controle via UI
-- 
-- EXECUTE ESTE SQL NO SUPABASE SQL EDITOR:
-- https://supabase.com/dashboard → SQL Editor → New Query
-- =====================================================

-- 1. Inserir task na tabela bot_tasks
INSERT INTO bot_tasks (
    task_key,
    name,
    description,
    task_type,
    cron_expression,
    is_active,
    priority,
    max_retries,
    retry_delay_seconds,
    rate_limit_per_minute,
    timeout_seconds,
    config,
    created_at,
    updated_at
) VALUES (
    'swift-commission-auto-invoice',
    'Swift Commission Auto-Invoice',
    'Detecta débitos "Comis.pago swift" no Bankinter EUR e cria invoices no Accounts Payable automaticamente.',
    'reconciliation',
    '0 8 * * *',  -- Todo dia às 8h
    true,
    5,
    3,
    300,
    10,
    600,
    jsonb_build_object(
        'source', 'bankinter-eur',
        'descriptionPattern', 'Comis.pago swift%',
        'defaults', jsonb_build_object(
            'currency', 'EUR',
            'scope', 'ES',
            'country_code', 'ES',
            'provider_code', 'BANKINTER',
            'cost_type_code', 'VC',
            'dep_cost_type_code', 'GE',
            'cost_center_code', '3.1.1',
            'financial_account_code', '6290',
            'financial_account_name', 'Bank Charges - Swift',
            'bank_account_code', 'BKINT-4605',
            'payment_method_code', 'DD',
            'entry_type', 'EXPENSE',
            'invoice_type', 'INCURRED'
        )
    ),
    NOW(),
    NOW()
)
ON CONFLICT (task_key) 
DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    config = EXCLUDED.config,
    updated_at = NOW();

-- 2. Criar índice para busca eficiente de comissões Swift
CREATE INDEX IF NOT EXISTS idx_csv_rows_swift_commission 
ON csv_rows (source, description) 
WHERE source = 'bankinter-eur' AND description ILIKE 'Comis.pago swift%';

-- 3. Comentário para referência
COMMENT ON INDEX idx_csv_rows_swift_commission IS 
'Índice otimizado para busca de comissões Swift pelo BOTella';

-- =====================================================
-- Verificação
-- =====================================================
SELECT 
    task_key,
    name,
    is_active,
    cron_expression,
    config->'defaults'->>'provider_code' as provider,
    created_at
FROM bot_tasks 
WHERE task_key = 'swift-commission-auto-invoice';
