-- =====================================================
-- Swift Commission Auto-Invoice Task Registration
-- 
-- Registra a task no banco para controle via UI
-- Execute este SQL no Supabase SQL Editor
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
    'Detecta débitos "Comis.pago swift" no Bankinter EUR e cria invoices automaticamente com pagamento marcado como pago e reconciliação.',
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
            'provider_name', 'Bankinter',
            'cost_type', 'Variable Cost',
            'dep_cost', 'General Expenses',
            'department', '3.0.0 - Corporate',
            'sub_department', '3.1.1 - Finance',
            'bank_account', 'Bankinter Spain 4605',
            'payment_method', 'Direct Debit',
            'document_type', 'Bank Charge'
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

-- 2. Garantir que o provider Bankinter existe
INSERT INTO providers (
    name,
    tax_id,
    email,
    is_active,
    created_by,
    created_at
) VALUES (
    'Bankinter',
    'A28157360',
    'info@bankinter.com',
    true,
    'BOTella',
    NOW()
)
ON CONFLICT (name) DO NOTHING;

-- 3. Garantir que o bank account existe (ajustar conforme necessário)
INSERT INTO bank_accounts (
    name,
    bank_name,
    account_number,
    currency,
    is_active,
    created_by,
    created_at
) VALUES (
    'Bankinter Spain 4605',
    'Bankinter',
    '****4605',
    'EUR',
    true,
    'BOTella',
    NOW()
)
ON CONFLICT (name) DO NOTHING;

-- 4. Adicionar campos na csv_rows se não existirem
DO $$
BEGIN
    -- Campo para marcar quem reconciliou
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'csv_rows' AND column_name = 'reconciled_by'
    ) THEN
        ALTER TABLE csv_rows ADD COLUMN reconciled_by TEXT;
    END IF;
    
    -- Campo para data de reconciliação
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'csv_rows' AND column_name = 'reconciled_at'
    ) THEN
        ALTER TABLE csv_rows ADD COLUMN reconciled_at TIMESTAMPTZ;
    END IF;
    
    -- Campo para link com invoice
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'csv_rows' AND column_name = 'reconciled_with'
    ) THEN
        ALTER TABLE csv_rows ADD COLUMN reconciled_with UUID;
    END IF;
END $$;

-- 5. Adicionar campo na invoice_payments para link com transação
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_payments' AND column_name = 'reconciled_transaction_id'
    ) THEN
        ALTER TABLE invoice_payments ADD COLUMN reconciled_transaction_id UUID;
    END IF;
END $$;

-- 6. Criar índice para busca eficiente
CREATE INDEX IF NOT EXISTS idx_csv_rows_swift_commission 
ON csv_rows (source, description) 
WHERE source = 'bankinter-eur' AND description ILIKE 'Comis.pago swift%';

-- 7. Comentário para referência
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
    created_at
FROM bot_tasks 
WHERE task_key = 'swift-commission-auto-invoice';
