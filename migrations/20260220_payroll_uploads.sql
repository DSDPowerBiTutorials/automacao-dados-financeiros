-- Payroll Uploads: stores parsed payroll data per month/year
CREATE TABLE IF NOT EXISTS payroll_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INT NOT NULL,
    month INT NOT NULL,
    period TEXT NOT NULL,            -- e.g. "01/2026"
    company TEXT NOT NULL,
    nif TEXT,
    currency TEXT DEFAULT 'Euro',
    file_name TEXT,
    data JSONB NOT NULL,             -- full PayrollData JSON (employees, departments, totals)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(year, month)              -- one record per year+month
);

CREATE INDEX IF NOT EXISTS idx_payroll_uploads_year ON payroll_uploads(year);
CREATE INDEX IF NOT EXISTS idx_payroll_uploads_year_month ON payroll_uploads(year, month);

-- RLS
ALTER TABLE payroll_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on payroll_uploads" ON payroll_uploads FOR ALL USING (true) WITH CHECK (true);
