-- ============================================================================
-- SCRIPT COMPLETO DE DEPLOY PARA PRODUÇÃO
-- Sistema Multi-País (ES/US/GLOBAL) - Invoices
-- Data: 26/12/2025
-- ============================================================================
-- INSTRUÇÕES:
-- 1. Abra Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- 2. Copie e cole TODO este arquivo
-- 3. Clique em "Run" (Executar)
-- 4. Aguarde mensagem de sucesso
-- ============================================================================

BEGIN;

-- ============================================================================
-- ETAPA 1: CRIAR TABELA INVOICES (SE NÃO EXISTIR)
-- ============================================================================

DO $$ 
BEGIN
  CREATE TABLE IF NOT EXISTS public.invoices (
    id BIGSERIAL PRIMARY KEY,
    input_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    invoice_date DATE NOT NULL,
    benefit_date DATE NOT NULL,
    due_date DATE NOT NULL,
    schedule_date DATE NOT NULL,
    payment_date DATE,
    invoice_type TEXT NOT NULL CHECK (invoice_type IN ('INCURRED', 'BUDGET', 'ADJUSTMENT')),
    entry_type TEXT NOT NULL,
    financial_account_code TEXT NOT NULL,
    financial_account_name TEXT,
    invoice_amount NUMERIC(15, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    eur_exchange NUMERIC(10, 6) NOT NULL DEFAULT 1.0,
    provider_code TEXT NOT NULL,
    bank_account_code TEXT,
    course_code TEXT,
    payment_method_code TEXT,
    cost_type_code TEXT NOT NULL,
    dep_cost_type_code TEXT NOT NULL,
    cost_center_code TEXT NOT NULL,
    description TEXT,
    invoice_number TEXT,
    country_code TEXT NOT NULL CHECK (country_code IN ('ES', 'US')),
    scope TEXT NOT NULL CHECK (scope IN ('ES', 'US')),
    applies_to_all_countries BOOLEAN DEFAULT FALSE,
    dre_impact BOOLEAN NOT NULL DEFAULT TRUE,
    cash_impact BOOLEAN NOT NULL DEFAULT TRUE,
    is_intercompany BOOLEAN NOT NULL DEFAULT FALSE,
    is_reconciled BOOLEAN DEFAULT FALSE,
    payment_status TEXT,
    notes TEXT,
    is_split BOOLEAN DEFAULT FALSE,
    parent_invoice_id BIGINT,
    split_number INTEGER,
    total_splits INTEGER,
    split_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  
  RAISE NOTICE '✅ Tabela invoices criada ou já existe';
END $$;

-- ============================================================================
-- ETAPA 2: CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================================================

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date DESC);
  CREATE INDEX IF NOT EXISTS idx_invoices_scope ON public.invoices(scope);
  CREATE INDEX IF NOT EXISTS idx_invoices_provider_code ON public.invoices(provider_code);
  CREATE INDEX IF NOT EXISTS idx_invoices_invoice_type ON public.invoices(invoice_type);
  CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);
  CREATE INDEX IF NOT EXISTS idx_invoices_parent_invoice_id ON public.invoices(parent_invoice_id) WHERE parent_invoice_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_invoices_country_code ON public.invoices(country_code);
  
  RAISE NOTICE '✅ Índices criados';
END $$;

-- ============================================================================
-- ETAPA 3: CRIAR FOREIGN KEY PARA SPLIT INVOICES
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_parent_invoice'
  ) THEN
    ALTER TABLE public.invoices 
    ADD CONSTRAINT fk_parent_invoice 
    FOREIGN KEY (parent_invoice_id) 
    REFERENCES public.invoices(id) 
    ON DELETE CASCADE;
    RAISE NOTICE '✅ Foreign key criada';
  ELSE
    RAISE NOTICE '⏭️  Foreign key já existe';
  END IF;
END $$;

-- ============================================================================
-- ETAPA 4: CRIAR TRIGGER DE AUTO-UPDATE (updated_at)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BO $$
BEGIN
  DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
  CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
  RAISE NOTICE '✅ Trigger de auto-update criado';
END $$;

-- ============================================================================
-- ETAPA 5: HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================================================

DO $$
BEGIN
  ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ RLS habilitado';
END $$;

-- ============================================================================
-- ETAPA 6: REMOVER POLÍTICAS ANTIGAS
-- ============================================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.invoices;
  DROP POLICY IF EXISTS "Enable read access for all users" ON public.invoices;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.invoices;
  DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.invoices;
  DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.invoices;
  
  RAISE NOTICE '✅ Políticas antigas removidas';
END $$;

-- ============================================================================
-- ETAPA 7: CRIAR POLÍTICAS PERMISSIVAS
-- ============================================================================

DO $$
BEGIN
  CREATE POLICY "Enable read access for all users" 
  ON public.invoices FOR SELECT 
  USING (true);

  CREATE POLICY "Enable insert for authenticated users" 
  ON public.invoices FOR INSERT 
  WITH CHECK (true);

  CREATE POLICY "Enable update for authenticated users" 
  ON public.invoices FOR UPDATE 
  USING (true)
  WITH CHECK (true);

  CREATE POLICY "Enable delete for authenticated users" 
  ON public.invoices FOR DELETE 
  USING (true);
  
  RAISE NOTICE '✅ Políticas RLS criadas';
END $$;

-- ============================================================================
-- ETAPA 8: CONCEDER PERMISSÕES
-- ============================================================================

DO $$
BEGIN
  GRANT ALL ON public.invoices TO authenticated;
  GRANT ALL ON public.invoices TO service_role;
  GRANT ALL ON public.invoices TO anon;
  GRANT USAGE, SELECT ON SEQUENCE invoices_id_seq TO authenticated;
  GRANT USAGE, SELECT ON SEQUENCE invoices_id_seq TO service_role;
  GRANT USAGE, SELECT ON SEQUENCE invoices_id_seq TO anon;
  
  RAISE NOTICE '✅ Permissões concedidas';
END $$;

-- ============================================================================
-- ETAPA 9: ATUALIZAR VALORES NULL EM CAMPOS OBRIGATÓRIOS
-- ============================================================================

DO $$
BEGIN
  UPDATE public.invoices 
  SET due_date = benefit_date 
  WHERE due_date IS NULL;

  UPDATE public.invoices 
  SET schedule_date = COALESCE(due_date, benefit_date)
  WHERE schedule_date IS NULL;
  
  RAISE NOTICE '✅ Valores NULL atualizados';
END $$

UPDATE public.invoices 
SET schedule_date = COALESCE(due_date, benefit_date)
WHERE schedule_date IS NULL;

DO $$
BEGIN
  ALTER TABLE public.invoices 
  DROP CONSTRAINT IF EXISTS invoices_country_code_check;

  ALTER TABLE public.invoices 
  DROP CONSTRAINT IF EXISTS invoices_scope_check;

  ALTER TABLE public.invoices 
  ADD CONSTRAINT invoices_country_code_check 
  CHECK (country_code IN ('ES', 'US'));

  ALTER TABLE public.invoices 
  ADD CONSTRAINT invoices_scope_check 
  CHECK (scope IN ('ES', 'US'));
  
  RAISE NOTICE '✅ Constraints de scope atualizadas (ES/US apenas)';
END $$;

-- ============================================================================
-- ETAPA 12: ADICIONAR COMENTÁRIOS DE DOCUMENTAÇÃO
-- ============================================================================

DO $$
BEGIN
  COMMENT ON TABLE public.invoices IS 'Accounts payable invoices with multi-currency and multi-country support';
  COMMENT ON COLUMN public.invoices.invoice_type IS 'Type of invoice: INCURRED (actual expense), BUDGET (planned expense), ADJUSTMENT (balance adjustment)';
  COMMENT ON COLUMN public.invoices.scope IS 'Country scope: ES (Spain) or US (United States) - GLOBAL is view-only in UI (shows ES + US consolidated)';
  COMMENT ON COLUMN public.invoices.country_code IS 'Country code: ES (Spain) or US (United States) - matches scope field';
  COMMENT ON COLUMN public.invoices.dre_impact IS 'Whether this invoice impacts the Income Statement (DRE)';
  COMMENT ON COLUMN public.invoices.cash_impact IS 'Whether this invoice impacts Cash Flow';
  COMMENT ON COLUMN public.invoices.is_split IS 'Indicates if this invoice is part of a split transaction';
  COMMENT ON COLUMN public.invoices.parent_invoice_id IS 'Reference to parent invoice if this is a split';
  COMMENT ON COLUMN public.invoices.provider_code IS 'Provider code (REQUIRED) - Reference to providers table';
  COMMENT ON COLUMN public.invoices.financial_account_code IS 'Financial account code (REQUIRED) - Reference to financial_accounts table';
  COMMENT ON COLUMN public.invoices.cost_center_code IS 'Cost center code (REQUIRED) - Reference to cost_centers table';
  COMMENT ON COLUMN public.invoices.cost_type_code IS 'Cost type code (REQUIRED) - Reference to cost_types table';
  COMMENT ON COLUMN public.invoices.dep_cost_type_code IS 'Depreciation cost type code (REQUIRED) - Reference to dep_cost_types table';
  COMMENT ON COLUMN public.invoices.due_date IS 'Invoice due date (REQUIRED)';
  COMMENT ON COLUMN public.invoices.schedule_date IS 'Payment schedule date (REQUIRED) - Defaults to due_date';
  
  RAISE NOTICE '✅ Comentários de documentação adicionados';
END $$
RAISE NOTICE '✅ Constraints de scope atualizadas (ES/US apenas)';

-- ============================================================================
-- ETAPA 12: ADICIONAR COMENTÁRIOS DE DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON TABLE public.invoices IS 'Accounts payable invoices with multi-currency and multi-country support';
COMMENT ON COLUMN public.invoices.invoice_type IS 'Type of invoice: INCURRED (actual expense), BUDGET (planned expense), ADJUSTMENT (balance adjustment)';
COMMENT ON COLUMN public.invoices.scope IS 'Country scope: ES (Spain) or US (United States) - GLOBAL is view-only in UI (shows ES + US consolidated)';
COMMENT ON COLUMN public.invoices.country_code IS 'Country code: ES (Spain) or US (United States) - matches scope field';
COMMENT ON COLUMN public.invoices.dre_impact IS 'Whether this invoice impacts the Income Statement (DRE)';
COMMENT ON COLUMN public.invoices.cash_impact IS 'Whether this invoice impacts Cash Flow';
COMMENT ON COLUMN public.invoices.is_split IS 'Indicates if this invoice is part of a split transaction';
COMMENT ON COLUMN public.invoices.parent_invoice_id IS 'Reference to parent invoice if this is a split';
COMMENT ON COLUMN public.invoices.provider_code IS 'Provider code (REQUIRED) - Reference to providers table';
COMMENT ON COLUMN public.invoices.financial_account_code IS 'Financial account code (REQUIRED) - Reference to financial_accounts table';
COMMENT ON COLUMN public.invoices.cost_center_code IS 'Cost center code (REQUIRED) - Reference to cost_centers table';
COMMENT ON COLUMN public.invoices.cost_type_code IS 'Cost type code (REQUIRED) - Reference to cost_types table';
COMMENT ON COLUMN public.invoices.dep_cost_type_code IS 'Depreciation cost type code (REQUIRED) - Reference to dep_cost_types table';
COMMENT ON COLUMN public.invoices.due_date IS 'Invoice due date (REQUIRED)';
COMMENT ON COLUMN public.invoices.schedule_date IS 'Payment schedule date (REQUIRED) - Defaults to due_date';

RAISE NOTICE '✅ Comentários de documentação adicionados';

-- ============================================================================
-- ETAPA 13: VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
DECLARE
  table_exists BOOLEAN;
  policies_count INTEGER;
  indexes_count INTEGER;
BEGIN
  -- Verificar se tabela existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) INTO table_exists;
  
  -- Contar políticas
  SELECT COUNT(*) INTO policies_count 
  FROM pg_policies WHERE tablename = 'invoices';
  
  -- Contar índices
  SELECT COUNT(*) INTO indexes_count 
  FROM pg_indexes WHERE tablename = 'invoices';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '🎉 DEPLOY COMPLETO - VERIFICAÇÃO FINAL';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Tabela invoices: %', CASE WHEN table_exists THEN 'EXISTE' ELSE 'NÃO EXISTE' END;
  RAISE NOTICE '✅ Políticas RLS: % configuradas', policies_count;
  RAISE NOTICE '✅ Índices: % criados', indexes_count;
  RAISE NOTICE '';
  RAISE NOTICE '📋 PRÓXIMOS PASSOS:';
  RAISE NOTICE '   1. Verificar deploy na Vercel (https://vercel.com/dashboard)';
  RAISE NOTICE '   2. Testar sistema:';
  RAISE NOTICE '      - Clicar 🇪🇸 → ver apenas ES';
  RAISE NOTICE '      - Clicar 🇺🇸 → ver apenas US';
  RAISE NOTICE '      - Clicar 🌐 → ver ES+US, botão disabled';
  RAISE NOTICE '   3. Criar invoice em ES → verificar auto-número ES-INV-YYYYMM-####';
  RAISE NOTICE '   4. Criar invoice em US → verificar auto-número US-INV-YYYYMM-####';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  
  IF NOT table_exists THEN
    RAISE EXCEPTION '❌ ERRO CRÍTICO: Tabela invoices não foi criada!';
  END IF;
  
  IF policies_count < 4 THEN
    RAISE WARNING '⚠️  AVISO: Esperadas 4 políticas RLS, encontradas %', policies_count;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
