#!/usr/bin/env node

/**
 * Script para testar login e diagnosticar problemas
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
    console.log('\n🔐 Testando Login do Jorge Marfetan...\n');

    const email = 'jmarfetan@digitalsmiledesign.com';
    const password = '***REMOVED***';

    try {
        // PASSO 1: Tentar fazer login
        console.log('1️⃣ Tentando login...');
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            console.error('❌ Login falhou!');
            console.error('Erro:', authError.message);
            console.error('Código:', authError.status);
            return;
        }

        console.log('✅ Login bem-sucedido!');
        console.log('User ID:', authData.user.id);
        console.log('Email:', authData.user.email);
        console.log('Session expires:', new Date(authData.session.expires_at * 1000).toLocaleString());
        console.log('');

        // PASSO 2: Buscar perfil na tabela users
        console.log('2️⃣ Buscando perfil na tabela users...');
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (profileError) {
            console.error('❌ Erro ao buscar perfil!');
            console.error('Erro:', profileError.message);
            console.error('Código:', profileError.code);
            console.error('Detalhes:', profileError.details);
            console.error('Hint:', profileError.hint);

            if (profileError.message.includes('recursion')) {
                console.error('\n🔧 PROBLEMA: RLS está causando recursão infinita');
                console.error('📝 SOLUÇÃO: Execute o arquivo docs/FIX-RLS-RECURSION.sql no Supabase');
            } else if (profileError.message.includes('permission denied')) {
                console.error('\n🔧 PROBLEMA: RLS está bloqueando acesso');
                console.error('📝 SOLUÇÃO: Execute o arquivo docs/FIX-RLS-RECURSION.sql no Supabase');
            } else if (profileError.code === 'PGRST116') {
                console.error('\n🔧 PROBLEMA: Perfil não existe na tabela users');
                console.error('📝 SOLUÇÃO: Execute este SQL:');
                console.error(`
INSERT INTO users (id, email, name, role, company_code, department, is_active)
VALUES (
  '${authData.user.id}',
  '${email}',
  'Jorge Marfetan',
  'admin',
  'GLOBAL',
  'Finance',
  true
);`);
            }
            return;
        }

        console.log('✅ Perfil encontrado!');
        console.log('Nome:', profile.name);
        console.log('Role:', profile.role);
        console.log('Empresa:', profile.company_code);
        console.log('Departamento:', profile.department);
        console.log('Ativo:', profile.is_active);
        console.log('');

        // PASSO 3: Verificar permissões do role
        console.log('3️⃣ Verificando permissões...');
        const { data: roleData, error: roleError } = await supabase
            .from('roles')
            .select('*')
            .eq('role', profile.role)
            .single();

        if (roleError) {
            console.error('❌ Erro ao buscar role!');
            console.error('Erro:', roleError.message);
            return;
        }

        console.log('✅ Role encontrado!');
        console.log('Description:', roleData.description);
        console.log('Level:', roleData.level);
        console.log('Permissions:', JSON.stringify(roleData.permissions, null, 2));
        console.log('');

        console.log('🎉 TUDO OK! O login deve funcionar no navegador.');
        console.log('');
        console.log('📝 Se ainda não funcionar no navegador, tente:');
        console.log('1. Limpar cache do navegador (Ctrl+Shift+Del)');
        console.log('2. Abrir aba anônima/privada');
        console.log('3. Verificar console do navegador (F12) para erros');
        console.log('4. Verificar se o servidor está rodando (npm run dev)');

    } catch (err) {
        console.error('❌ Erro inesperado:', err.message);
        console.error(err);
    }
}

testLogin().catch(console.error);
