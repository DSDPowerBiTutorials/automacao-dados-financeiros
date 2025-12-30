#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n🔍 Teste Completo de Login - Jorge Marfetan\n');

async function testLogin() {
    const email = 'jmarfetan@digitalsmiledesign.com';
    const password = '***REMOVED***';

    // PASSO 1: Login
    console.log('1️⃣ Fazendo login...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (authError) {
        console.error('❌ Erro no login:', authError.message);
        return;
    }

    console.log('✅ Login OK');
    console.log(`   User ID: ${authData.user.id}`);
    console.log('');

    // PASSO 2: Buscar perfil (como o AuthContext faz)
    console.log('2️⃣ Buscando perfil na tabela users...');
    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

    if (profileError) {
        console.error('❌ ERRO ao buscar perfil:', profileError.message);
        console.error('   Código:', profileError.code);
        console.error('   Details:', JSON.stringify(profileError.details, null, 2));
        console.log('');
        console.log('🔧 SOLUÇÃO:');
        console.log('   1. Abra o Supabase Dashboard → SQL Editor');
        console.log('   2. Execute o arquivo: docs/FIX-RLS-RECURSION.sql');
        console.log('   3. Isso vai corrigir as políticas RLS');
        return;
    }

    console.log('✅ Perfil encontrado!');
    console.log(`   Nome: ${profile.name}`);
    console.log(`   Email: ${profile.email}`);
    console.log(`   Role: ${profile.role}`);
    console.log(`   Company: ${profile.company_code}`);
    console.log(`   Department: ${profile.department}`);
    console.log('');

    console.log('🎉 TUDO FUNCIONANDO PERFEITAMENTE!');
    console.log('   Você deveria conseguir fazer login no app agora.');
}

testLogin().catch(console.error);
