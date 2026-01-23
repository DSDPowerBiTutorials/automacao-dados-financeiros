-- ============================================================================
-- CREATE USER - Sofia Hernandez
-- ============================================================================
-- Execute este script no Supabase SQL Editor
-- Data: 2026-01-21
-- ============================================================================

DO $
$
DECLARE
  user_uuid UUID;
BEGIN
    -- Inserir usuário na tabela auth.users
    INSERT INTO auth.users
        (
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
        )
    VALUES
        (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'sofia@digitalsmiledesign.com',
            crypt('DSD@Sofia2026!', gen_salt('bf')),
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

-- Criar perfil na tabela users
INSERT INTO users
    (
    id,
    email,
    name,
    role,
    company_code,
    department,
    is_active
    )
VALUES
    (
        user_uuid,
        'sofia@digitalsmiledesign.com',
        'Sofia Hernandez',
        'admin',
        'GLOBAL',
        'Finance',
        true
  );

-- Mostrar resultado
RAISE NOTICE 'Usuário criado com sucesso! UUID: %', user_uuid;
  RAISE NOTICE 'Email: sofia@digitalsmiledesign.com';
  RAISE NOTICE 'Role: admin';
END $$;

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

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
WHERE u.email = 'sofia@digitalsmiledesign.com';
