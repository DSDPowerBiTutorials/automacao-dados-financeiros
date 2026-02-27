-- Contracts table for Departmental Insights
CREATE TABLE
IF NOT EXISTS contracts
(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
  name TEXT NOT NULL,
  provider_name TEXT,
  contract_type TEXT,
  department_code TEXT,
  sub_department_code TEXT,
  monthly_amount NUMERIC
(14,2),
  annual_amount NUMERIC
(14,2),
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK
(status IN
('active', 'inactive', 'expired', 'draft')),
  document_url TEXT,
  scope TEXT DEFAULT 'ES',
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now
(),
  updated_at TIMESTAMPTZ DEFAULT now
()
);

CREATE INDEX
IF NOT EXISTS idx_contracts_department ON contracts
(department_code);
CREATE INDEX
IF NOT EXISTS idx_contracts_sub_department ON contracts
(sub_department_code);
CREATE INDEX
IF NOT EXISTS idx_contracts_scope ON contracts
(scope);
CREATE INDEX
IF NOT EXISTS idx_contracts_active ON contracts
(is_active);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY
IF EXISTS "Allow all contracts" ON contracts;
CREATE POLICY "Allow all contracts" ON contracts FOR ALL USING
(true) WITH CHECK
(true);

INSERT INTO contracts
    (
    name,
    provider_name,
    contract_type,
    document_url,
    scope,
    is_active,
    status,
    notes
    )
SELECT
    'SERVICE PROPOSAL DSD PC Department Signed',
    'DSD',
    'service_proposal',
    'https://github.com/DSDPowerBiTutorials/automacao-dados-financeiros/blob/main/public/SERVICE%20PROPOSAL%20DSD%20PC%20Department%20Signed.pdf',
    'ES',
    true,
    'active',
    'Contrato referenciado via URL externa (PDF não disponível localmente no workspace).'
WHERE NOT EXISTS (
  SELECT 1
FROM contracts
WHERE name = 'SERVICE PROPOSAL DSD PC Department Signed'
);

INSERT INTO contracts
    (
    name,
    provider_name,
    contract_type,
    document_url,
    scope,
    is_active,
    status,
    notes
    )
SELECT
    'Signed SERVICE PROPOSAL DSD Education LLC Signed',
    'DSD Education LLC',
    'service_proposal',
    'https://github.com/DSDPowerBiTutorials/automacao-dados-financeiros/blob/main/public/Signed%20SERVICE%20PROPOSAL%20DSD%20Education%20%20LLC%20Signed.pdf',
    'ES',
    true,
    'active',
    'Contrato referenciado via URL externa (PDF não disponível localmente no workspace).'
WHERE NOT EXISTS (
  SELECT 1
FROM contracts
WHERE name = 'Signed SERVICE PROPOSAL DSD Education LLC Signed'
);
