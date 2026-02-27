-- Structured data model for contracts page content

ALTER TABLE public.contracts
  ADD COLUMN
IF NOT EXISTS contract_code text,
ADD COLUMN
IF NOT EXISTS submitted_to text,
ADD COLUMN
IF NOT EXISTS submitted_by text,
ADD COLUMN
IF NOT EXISTS location text,
ADD COLUMN
IF NOT EXISTS duration_months integer,
ADD COLUMN
IF NOT EXISTS admin_fee_percent numeric
(5,2),
ADD COLUMN
IF NOT EXISTS currency_code text,
ADD COLUMN
IF NOT EXISTS monthly_retainer_amount numeric
(14,2),
ADD COLUMN
IF NOT EXISTS annual_estimated_amount numeric
(14,2),
ADD COLUMN
IF NOT EXISTS summary text,
ADD COLUMN
IF NOT EXISTS service_scope text,
ADD COLUMN
IF NOT EXISTS document_path text,
ADD COLUMN
IF NOT EXISTS source_document_filename text,
ADD COLUMN
IF NOT EXISTS key_terms jsonb DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX
IF NOT EXISTS idx_contracts_contract_code ON public.contracts
(contract_code);

CREATE TABLE
IF NOT EXISTS public.contract_parties
(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid
(),
  contract_id uuid NOT NULL REFERENCES public.contracts
(id) ON
DELETE CASCADE,
  role text
NOT NULL,
  name text NOT NULL,
  entity_type text,
  tax_id text,
  country text,
  email text,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now
()
);

CREATE TABLE
IF NOT EXISTS public.contract_line_items
(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid
(),
  contract_id uuid NOT NULL REFERENCES public.contracts
(id) ON
DELETE CASCADE,
  item_order integer
NOT NULL DEFAULT 1,
  code text,
  category text,
  name text NOT NULL,
  monthly_amount numeric
(14,2),
  annual_amount numeric
(14,2),
  allocation_percent numeric
(6,2),
  notes text,
  created_at timestamptz DEFAULT now
()
);

CREATE INDEX
IF NOT EXISTS idx_contract_parties_contract_id ON public.contract_parties
(contract_id);
CREATE INDEX
IF NOT EXISTS idx_contract_line_items_contract_id ON public.contract_line_items
(contract_id);

ALTER TABLE public.contract_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY
IF EXISTS "Allow all contract_parties" ON public.contract_parties;
CREATE POLICY "Allow all contract_parties" ON public.contract_parties
FOR ALL USING
(true) WITH CHECK
(true);

DROP POLICY
IF EXISTS "Allow all contract_line_items" ON public.contract_line_items;
CREATE POLICY "Allow all contract_line_items" ON public.contract_line_items
FOR ALL USING
(true) WITH CHECK
(true);

UPDATE public.contracts
SET
  contract_code = 'CTR-DSD-PC-2025-11',
  submitted_to = 'DSD Corporate Management',
  submitted_by = 'DSD Corporate Management',
  provider_name = COALESCE(provider_name, 'DSD Corporate Management'),
  location = 'Madrid, Spain',
  start_date = '2025-11-01',
  end_date = '2026-10-31',
  duration_months = 12,
  admin_fee_percent = 15.00,
  currency_code = 'EUR',
  monthly_retainer_amount = 114624.22,
  annual_estimated_amount = 1375490.64,
  monthly_amount = COALESCE(monthly_amount, 114624.22),
  annual_amount = COALESCE(annual_amount, 1375490.64),
  summary = 'Operational cost budget for Lab / Planning Center / Delight with marketing, operations and administrative support.',
  service_scope = 'Marketing support, Operation Delight, Operation Lab, logistics, finance, office and studio support.',
  document_path = '/contracts/service-proposal-dsd-pc-department-signed.pdf',
  document_url = '/contracts/service-proposal-dsd-pc-department-signed.pdf',
  source_document_filename = 'service-proposal-dsd-pc-department-signed.pdf',
  key_terms = jsonb_build_object(
    'duration_label', '12 Months (November 1, 2025 – October 31, 2026)',
    'administrative_fee_note', 'A 15% administrative fee is included to cover overhead and service continuity.'
  )
WHERE name = 'SERVICE PROPOSAL DSD PC Department Signed';

UPDATE public.contracts
SET
  contract_code = 'CTR-DSD-EDU-2025-11',
  submitted_to = 'DSD Education LLC',
  submitted_by = 'DSD Corporate Management',
  provider_name = COALESCE(provider_name, 'DSD Corporate Management'),
  location = 'Madrid, Spain',
  start_date = '2025-11-01',
  end_date = '2026-10-31',
  duration_months = 12,
  admin_fee_percent = 15.00,
  currency_code = 'EUR',
  monthly_retainer_amount = 47891.61,
  annual_estimated_amount = 574699.32,
  monthly_amount = COALESCE(monthly_amount, 47891.61),
  annual_amount = COALESCE(annual_amount, 574699.32),
  summary = 'Operational cost budget for Education & Events with marketing and education operations support.',
  service_scope = 'Marketing support and Education Ops execution for events and operational planning.',
  document_path = '/contracts/service-proposal-dsd-education-llc-signed.pdf',
  document_url = '/contracts/service-proposal-dsd-education-llc-signed.pdf',
  source_document_filename = 'service-proposal-dsd-education-llc-signed.pdf',
  key_terms = jsonb_build_object(
    'duration_label', '12 Months (November 1, 2025 – October 31, 2026)',
    'administrative_fee_note', 'A 15% administrative fee is included to cover overhead and service continuity.'
  )
WHERE name = 'Signed SERVICE PROPOSAL DSD Education LLC Signed';

WITH
    target_contracts
    AS
    (
        SELECT id
        FROM public.contracts
        WHERE contract_code IN ('CTR-DSD-PC-2025-11', 'CTR-DSD-EDU-2025-11')
    )
DELETE FROM public.contract_parties WHERE contract_id IN (SELECT id
FROM target_contracts);

WITH
    target_contracts
    AS
    (
        SELECT id
        FROM public.contracts
        WHERE contract_code IN ('CTR-DSD-PC-2025-11', 'CTR-DSD-EDU-2025-11')
    )
DELETE FROM public.contract_line_items WHERE contract_id IN (SELECT id
FROM target_contracts);

INSERT INTO public.contract_parties
    (contract_id, role, name, entity_type, country, is_primary)
SELECT c.id, 'client', 'DSD Corporate Management', 'company', 'ES', true
FROM public.contracts c
WHERE c.contract_code = 'CTR-DSD-PC-2025-11';

INSERT INTO public.contract_parties
    (contract_id, role, name, entity_type, country, is_primary)
SELECT c.id, 'provider', 'DSD Lab / Planning Center / Delight Department', 'department', 'ES', true
FROM public.contracts c
WHERE c.contract_code = 'CTR-DSD-PC-2025-11';

INSERT INTO public.contract_parties
    (contract_id, role, name, entity_type, country, is_primary)
SELECT c.id, 'client', 'DSD Education LLC', 'company', 'US', true
FROM public.contracts c
WHERE c.contract_code = 'CTR-DSD-EDU-2025-11';

INSERT INTO public.contract_parties
    (contract_id, role, name, entity_type, country, is_primary)
SELECT c.id, 'provider', 'DSD Corporate Management', 'company', 'ES', true
FROM public.contracts c
WHERE c.contract_code = 'CTR-DSD-EDU-2025-11';

INSERT INTO public.contract_line_items
    (contract_id, item_order, code, category, name, monthly_amount, annual_amount, notes)
    SELECT c.id, 1, 'A', 'marketing', 'Marketing Support', 3256.26, 39075.12, 'Includes content, campaigns, video, design, analytics and brand support.'
    FROM public.contracts c
    WHERE c.contract_code = 'CTR-DSD-PC-2025-11'
UNION ALL
    SELECT c.id, 2, 'B', 'operations', 'Operation Delight', 70327.47, 843929.64, 'Team allocation for Delight operations.'
    FROM public.contracts c
    WHERE c.contract_code = 'CTR-DSD-PC-2025-11'
UNION ALL
    SELECT c.id, 3, 'C', 'operations', 'Operation Lab', 41040.49, 492485.88, 'Team allocation for Lab operations.'
    FROM public.contracts c
    WHERE c.contract_code = 'CTR-DSD-PC-2025-11';

INSERT INTO public.contract_line_items
    (contract_id, item_order, code, category, name, monthly_amount, annual_amount, notes)
    SELECT c.id, 1, 'A', 'marketing', 'Marketing Support', 10854.19, 130250.28, 'Includes content, campaigns, video, design, analytics and brand support.'
    FROM public.contracts c
    WHERE c.contract_code = 'CTR-DSD-EDU-2025-11'
UNION ALL
    SELECT c.id, 2, 'B', 'operations', 'Education Ops', 37037.42, 444449.04, 'Education operations team and event execution support.'
    FROM public.contracts c
    WHERE c.contract_code = 'CTR-DSD-EDU-2025-11';
