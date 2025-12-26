-- Create invoices table for accounts payable
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
  country_code TEXT NOT NULL CHECK (country_code IN ('ES', 'US', 'GLOBAL')),
  scope TEXT NOT NULL CHECK (scope IN ('ES', 'US', 'GLOBAL')),
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_scope ON public.invoices(scope);
CREATE INDEX IF NOT EXISTS idx_invoices_provider_code ON public.invoices(provider_code);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_type ON public.invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_parent_invoice_id ON public.invoices(parent_invoice_id) WHERE parent_invoice_id IS NOT NULL;

-- Add foreign key constraint for split invoices
ALTER TABLE public.invoices 
ADD CONSTRAINT fk_parent_invoice 
FOREIGN KEY (parent_invoice_id) 
REFERENCES public.invoices(id) 
ON DELETE CASCADE;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.invoices;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.invoices;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.invoices;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.invoices;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.invoices;

-- Create policies for authenticated users
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

-- Grant permissions
GRANT ALL ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
GRANT ALL ON public.invoices TO anon;
GRANT USAGE, SELECT ON SEQUENCE invoices_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE invoices_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE invoices_id_seq TO anon;

-- Add comments for documentation
COMMENT ON TABLE public.invoices IS 'Accounts payable invoices with multi-currency and multi-country support';
COMMENT ON COLUMN public.invoices.invoice_type IS 'Type of invoice: INCURRED (actual expense), BUDGET (planned expense), ADJUSTMENT (balance adjustment)';
COMMENT ON COLUMN public.invoices.scope IS 'Country scope: ES (Spain), US (United States), GLOBAL (consolidated)';
COMMENT ON COLUMN public.invoices.dre_impact IS 'Whether this invoice impacts the Income Statement (DRE)';
COMMENT ON COLUMN public.invoices.cash_impact IS 'Whether this invoice impacts Cash Flow';
COMMENT ON COLUMN public.invoices.is_split IS 'Indicates if this invoice is part of a split transaction';
COMMENT ON COLUMN public.invoices.parent_invoice_id IS 'Reference to parent invoice if this is a split';
