-- ════════════════════════════════════════════════════════
-- DSD Courses & Calendar Events + Payroll Master Data
-- ════════════════════════════════════════════════════════

-- DSD Courses table
CREATE TABLE IF NOT EXISTS dsd_courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  location TEXT,
  description TEXT,
  course_type TEXT DEFAULT 'course' CHECK (course_type IN ('course', 'residency', 'masterclass', 'workshop', 'annual-meeting')),
  price_eur NUMERIC(12,2),
  capacity INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Calendar Events table (user-created events shown on the DSD Calendar)
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('new-clinic', 'clinic-exit', 'pc-level-3', 'pc-level-2', 'pc-level-1', 'dsd-course', 'custom')),
  description TEXT,
  course_id UUID REFERENCES dsd_courses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payroll Line Master Data
-- Maps payroll concept codes (e.g. "Mejora Voluntaria") to financial account lines
CREATE TABLE IF NOT EXISTS payroll_line_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  concept_code TEXT NOT NULL,          -- e.g. "015", "001"
  concept_description TEXT NOT NULL,   -- e.g. "Mejora Voluntaria", "Salario Base"
  target_category TEXT NOT NULL CHECK (target_category IN ('cogs', 'labour', 'office-rh-spain')),
  department_override TEXT,            -- if set, overrides the employee's department for this line
  financial_account_code TEXT,         -- optional link to financial_accounts table
  financial_account_name TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(concept_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dsd_courses_start_date ON dsd_courses(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(type);
CREATE INDEX IF NOT EXISTS idx_payroll_line_mappings_code ON payroll_line_mappings(concept_code);

-- Enable RLS (permissive for now)
ALTER TABLE dsd_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_line_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on dsd_courses" ON dsd_courses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on calendar_events" ON calendar_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on payroll_line_mappings" ON payroll_line_mappings FOR ALL USING (true) WITH CHECK (true);
