-- ============================================================================
-- CREATE FIRST ADMIN USER - Jorge Marfetan
-- ============================================================================
-- Execute este script no Supabase SQL Editor
-- Data: 2024-12-30
-- ============================================================================

-- PASSO 1: Criar usuário no auth.users
-- Nota: O Supabase cria automaticamente o hash da senha
-- Este comando cria o usuário e retorna o UUID

-- Criar usuário via função admin do Supabase
-- IMPORTANTE: Copie o UUID retornado para usar no próximo passo

DO $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Inserir usuário na tabela auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'jmarfetan@digitalsmiledesign.com',
    crypt('***REMOVED***', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO user_uuid;

  -- PASSO 2: Criar perfil na tabela users
  INSERT INTO users (
    id,
    email,
    name,
    role,
    company_code,
    department,
    is_active
  ) VALUES (
    user_uuid,
    'jmarfetan@digitalsmiledesign.com',
    'Jorge Marfetan',
    'admin',
    'GLOBAL',
    'Finance',
    true
  );

  -- Mostrar resultado
  RAISE NOTICE 'Usuário criado com sucesso! UUID: %', user_uuid;
  RAISE NOTICE 'Email: jmarfetan@digitalsmiledesign.com';
  RAISE NOTICE 'Role: admin';
  RAISE NOTICE 'Você pode fazer login agora!';
END $$;

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

-- Verificar se o usuário foi criado corretamente
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  u.company_code,
  u.department,
  u.is_active,
  u.created_at
FROM users u
WHERE u.email = 'jmarfetan@digitalsmiledesign.com';

-- Verificar roles disponíveis
SELECT * FROM roles ORDER BY level DESC;

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- Se o script falhar por algum motivo, você pode criar manualmente:

-- 1. Primeiro, obtenha o UUID do usuário criado no auth.users:
-- SELECT id FROM auth.users WHERE email = 'jmarfetan@digitalsmiledesign.com';

-- 2. Depois insira manualmente na tabela users:
/*
INSERT INTO users (id, email, name, role, company_code, department, is_active)
VALUES (
  '<UUID_DO_PASSO_1>',
  'jmarfetan@digitalsmiledesign.com',
  'Jorge Marfetan',
  'admin',
  'GLOBAL',
  'Finance',
  true
);
*/

-- ============================================================================
-- ALTERNATIVAMENTE: Usar função do Supabase (se disponível)
-- ============================================================================

-- Se o script acima não funcionar, use este método alternativo:

/*
-- Primeiro, vá no Supabase Dashboard → Authentication → Users
-- Clique em "Add User"
-- Preencha:
--   - Email: jmarfetan@digitalsmiledesign.com
--   - Password: ***REMOVED***
-- Copie o UUID gerado

-- Depois, execute este INSERT:
INSERT INTO users (id, email, name, role, company_code, department, is_active)
VALUES (
  '<UUID_COPIADO_DO_DASHBOARD>',
  'jmarfetan@digitalsmiledesign.com',
  'Jorge Marfetan',
  'admin',
  'GLOBAL',
  'Finance',
  true
);
*/

-- ============================================================================
-- INFORMAÇÕES DO USUÁRIO
-- ============================================================================

-- Nome: Jorge Marfetan
-- Cargo: Finance Controller (Admin)
-- Email: jmarfetan@digitalsmiledesign.com
-- Senha: ***REMOVED***
-- Role: admin (nível 100 - acesso total)
-- Empresa: GLOBAL
-- Departamento: Finance

-- ============================================================================
-- END
-- ============================================================================
