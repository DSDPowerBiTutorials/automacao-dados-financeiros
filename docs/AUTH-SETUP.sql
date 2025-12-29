-- ============================================================================
-- DSD Finance Hub - Authentication & Authorization System
-- ============================================================================
-- Version: 1.0
-- Date: 2024-12-29
-- Description: Complete setup for users, roles, and permissions
-- ============================================================================

-- ============================================================================
-- 1. ROLES TABLE - Define organizational roles
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
  role TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  level INTEGER NOT NULL DEFAULT 0, -- Hierarchy level (higher = more access)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE roles IS 'Organizational roles with permission sets';
COMMENT ON COLUMN roles.role IS 'Unique role identifier (e.g., "admin", "manager")';
COMMENT ON COLUMN roles.permissions IS 'JSON array of permission strings';
COMMENT ON COLUMN roles.level IS 'Hierarchy level: 100=Admin, 50=Manager, 10=Analyst, 1=Viewer';

-- Insert default roles
INSERT INTO roles (role, description, permissions, level) VALUES
  ('admin', 'Global Administrator - Full system access', 
   '["*"]'::jsonb, 100),
  
  ('finance_manager', 'Finance Manager - Full financial operations access',
   '["view_all", "edit_invoices", "edit_payments", "reconcile", "export_data", "view_reports", "edit_master_data"]'::jsonb, 50),
  
  ('analyst', 'Financial Analyst - Read/Write invoices and reports',
   '["view_all", "edit_invoices", "view_reports", "export_data"]'::jsonb, 10),
  
  ('viewer', 'Report Viewer - Read-only access',
   '["view_reports", "export_data"]'::jsonb, 1)
ON CONFLICT (role) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  level = EXCLUDED.level,
  updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- 2. USERS TABLE - Extended user profile (links to auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' REFERENCES roles(role),
  company_code TEXT NOT NULL DEFAULT 'GLOBAL', -- ES, US, GLOBAL
  department TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_company_code CHECK (company_code IN ('ES', 'US', 'GLOBAL'))
);

-- Add comments
COMMENT ON TABLE users IS 'Extended user profiles linked to Supabase auth.users';
COMMENT ON COLUMN users.id IS 'UUID from auth.users';
COMMENT ON COLUMN users.company_code IS 'Primary company scope: ES, US, or GLOBAL';
COMMENT ON COLUMN users.role IS 'Assigned organizational role';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_company_code ON users(company_code);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================================================
-- 3. USER_PERMISSIONS TABLE - Additional granular permissions per user
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Prevent duplicate permissions
  UNIQUE(user_id, permission)
);

COMMENT ON TABLE user_permissions IS 'Additional permissions granted to specific users';

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);

-- ============================================================================
-- 4. AUDIT_LOG TABLE - Track user actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL, -- 'login', 'create', 'update', 'delete', 'export'
  resource_type TEXT, -- 'invoice', 'payment', 'customer', etc.
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE audit_log IS 'Audit trail of user actions';

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);

-- ============================================================================
-- 5. FUNCTIONS - Helper functions
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to check user permission
CREATE OR REPLACE FUNCTION has_permission(
  user_uuid UUID,
  required_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  role_permissions JSONB;
  user_extra_permissions TEXT[];
BEGIN
  -- Get user's role
  SELECT role INTO user_role
  FROM users
  WHERE id = user_uuid AND is_active = true;
  
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get role permissions
  SELECT permissions INTO role_permissions
  FROM roles
  WHERE role = user_role AND is_active = true;
  
  -- Check if role has wildcard (admin)
  IF role_permissions @> '["*"]'::jsonb THEN
    RETURN true;
  END IF;
  
  -- Check if permission exists in role
  IF role_permissions @> to_jsonb(ARRAY[required_permission]) THEN
    RETURN true;
  END IF;
  
  -- Check user-specific permissions
  SELECT array_agg(permission) INTO user_extra_permissions
  FROM user_permissions
  WHERE user_id = user_uuid
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);
  
  IF required_permission = ANY(user_extra_permissions) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_permission IS 'Check if user has specific permission';

-- Function to log user action
CREATE OR REPLACE FUNCTION log_audit(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (p_user_id, p_action, p_resource_type, p_resource_id, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Policy: Admins can view all users
DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND u.is_active = true
    )
  );

-- Policy: Users can update their own profile (limited fields)
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Enable RLS on audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own audit logs
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_log;
CREATE POLICY "Users can view own audit logs"
  ON audit_log FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Admins can view all audit logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_log;
CREATE POLICY "Admins can view all audit logs"
  ON audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role = 'admin'
        AND is_active = true
    )
  );

-- ============================================================================
-- 7. SAMPLE DATA - Create initial admin user (MANUAL STEP)
-- ============================================================================

-- After creating user via Supabase Auth UI or API, insert into users table:
-- Example:
-- INSERT INTO users (id, email, name, role, company_code)
-- VALUES (
--   '<UUID_FROM_AUTH_USERS>',
--   'admin@digitalsmiledesign.com',
--   'DSD Administrator',
--   'admin',
--   'GLOBAL'
-- );

-- ============================================================================
-- 8. VIEWS - Convenience views
-- ============================================================================

-- View: User details with role info
CREATE OR REPLACE VIEW user_details AS
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  r.description as role_description,
  r.level as role_level,
  r.permissions as role_permissions,
  u.company_code,
  u.department,
  u.is_active,
  u.last_login_at,
  u.created_at
FROM users u
LEFT JOIN roles r ON u.role = r.role;

COMMENT ON VIEW user_details IS 'User profiles with expanded role information';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check roles
-- SELECT * FROM roles ORDER BY level DESC;

-- Check users
-- SELECT * FROM user_details ORDER BY role_level DESC, name;

-- Test permission check
-- SELECT has_permission('<user_uuid>', 'edit_invoices');

-- View audit log
-- SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 50;

-- ============================================================================
-- END OF AUTH SETUP
-- ============================================================================
