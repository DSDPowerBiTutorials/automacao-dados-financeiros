#!/usr/bin/env node

/**
 * Script para verificar se o setup do Supabase está correto
 * Uso: node scripts/verify-supabase-setup.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Erro: Variáveis de ambiente não encontradas!');
    console.error('Certifique-se que o arquivo .env.local existe com:');
    console.error('  NEXT_PUBLIC_SUPABASE_URL');
    console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY');
    console.error('  SUPABASE_SERVICE_ROLE_KEY (opcional)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n=== Verificação do Setup do Supabase ===\n');
console.log('URL:', supabaseUrl);
console.log('Key tipo:', supabaseKey.includes('service_role') ? 'Service Role' : 'Anon');
console.log('\n');

async function verifyTables() {
    console.log('📋 Verificando tabelas...\n');

    // Verificar tabela roles
    try {
        const { data, error } = await supabase.from('roles').select('role, level').order('level', { ascending: false });

        if (error) {
            console.error('❌ Tabela "roles" não existe ou erro ao acessar');
            console.error('   Erro:', error.message);
            console.error('   ⚠️  VOCÊ PRECISA EXECUTAR: docs/AUTH-SETUP.sql no Supabase SQL Editor');
            return false;
        }

        console.log('✅ Tabela "roles" existe');
        if (data && data.length > 0) {
            console.log('   Roles encontrados:');
            data.forEach(role => {
                console.log(`   - ${role.role} (level ${role.level})`);
            });
        } else {
            console.log('   ⚠️  Nenhum role encontrado! Execute AUTH-SETUP.sql');
        }
        console.log('');
    } catch (err) {
        console.error('❌ Erro ao verificar tabela "roles":', err.message);
        return false;
    }

    // Verificar tabela users
    try {
        const { data, error, count } = await supabase
            .from('users')
            .select('email, name, role', { count: 'exact' });

        if (error) {
            console.error('❌ Tabela "users" não existe ou erro ao acessar');
            console.error('   Erro:', error.message);
            return false;
        }

        console.log('✅ Tabela "users" existe');
        console.log(`   Total de usuários: ${count || 0}`);

        if (data && data.length > 0) {
            console.log('   Usuários cadastrados:');
            data.forEach(user => {
                console.log(`   - ${user.name} (${user.email}) - Role: ${user.role}`);
            });
        } else {
            console.log('   ⚠️  Nenhum usuário cadastrado!');
            console.log('   📝 Siga o guia: docs/CRIAR-JORGE-MARFETAN.md');
        }
        console.log('');
    } catch (err) {
        console.error('❌ Erro ao verificar tabela "users":', err.message);
        return false;
    }

    // Verificar tabela audit_log
    try {
        const { error } = await supabase.from('audit_log').select('id').limit(1);

        if (error) {
            console.error('❌ Tabela "audit_log" não existe');
            console.error('   Erro:', error.message);
            return false;
        }

        console.log('✅ Tabela "audit_log" existe');
        console.log('');
    } catch (err) {
        console.error('❌ Erro ao verificar tabela "audit_log":', err.message);
        return false;
    }

    return true;
}

async function verifyAuthUser() {
    console.log('👤 Verificando usuários no Supabase Auth...\n');

    try {
        // Tentar verificar se há usuários (funciona apenas com service_role_key)
        if (supabaseKey.includes('service_role')) {
            const { data: { users }, error } = await supabase.auth.admin.listUsers();

            if (error) {
                console.error('⚠️  Não foi possível listar usuários do auth:', error.message);
                console.log('   (Isso é normal se você não estiver usando service_role_key)');
            } else {
                console.log(`✅ Total de usuários no auth.users: ${users?.length || 0}`);

                if (users && users.length > 0) {
                    console.log('   Usuários no auth:');
                    users.forEach(user => {
                        console.log(`   - ${user.email} (ID: ${user.id.substring(0, 8)}...)`);
                    });
                } else {
                    console.log('   ⚠️  Nenhum usuário no auth.users!');
                    console.log('   📝 Crie via Supabase Dashboard → Authentication → Users');
                }
            }
        } else {
            console.log('⚠️  Usando anon_key - não é possível listar usuários');
            console.log('   Use service_role_key para verificação completa');
        }
        console.log('');
    } catch (err) {
        console.error('⚠️  Erro ao verificar auth.users:', err.message);
        console.log('');
    }
}

async function testLogin() {
    console.log('🔐 Testando credenciais do Jorge Marfetan...\n');

    const email = 'jmarfetan@digitalsmiledesign.com';
    const password = '***REMOVED***';

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('❌ Login falhou!');
            console.error('   Erro:', error.message);

            if (error.message.includes('Invalid login credentials')) {
                console.error('\n   Possíveis causas:');
                console.error('   1. Usuário não foi criado no auth.users');
                console.error('   2. Senha está incorreta');
                console.error('   3. Email não foi confirmado');
                console.error('\n   📝 Solução:');
                console.error('   - Vá no Supabase Dashboard → Authentication → Users');
                console.error('   - Verifique se jmarfetan@digitalsmiledesign.com existe');
                console.error('   - Se não existir, siga: docs/CRIAR-JORGE-MARFETAN.md');
            }
            return false;
        }

        console.log('✅ Login bem-sucedido!');
        console.log(`   User ID: ${data.user.id}`);
        console.log(`   Email: ${data.user.email}`);
        console.log('');

        // Verificar se o perfil existe na tabela users
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profileError) {
            console.error('❌ Perfil não encontrado na tabela "users"!');
            console.error('   Erro:', profileError.message);
            console.error('\n   📝 Solução: Execute este SQL no Supabase:');
            console.error(`   INSERT INTO users (id, email, name, role, company_code, department, is_active)`);
            console.error(`   VALUES ('${data.user.id}', '${email}', 'Jorge Marfetan', 'admin', 'GLOBAL', 'Finance', true);`);
            return false;
        }

        console.log('✅ Perfil encontrado na tabela "users"');
        console.log(`   Nome: ${profile.name}`);
        console.log(`   Role: ${profile.role}`);
        console.log(`   Empresa: ${profile.company_code}`);
        console.log(`   Departamento: ${profile.department}`);
        console.log('');

        return true;
    } catch (err) {
        console.error('❌ Erro inesperado ao testar login:', err.message);
        return false;
    }
}

async function main() {
    const tablesOk = await verifyTables();
    await verifyAuthUser();

    if (tablesOk) {
        await testLogin();
    }

    console.log('\n=== Resumo ===\n');

    if (!tablesOk) {
        console.log('❌ Setup incompleto!');
        console.log('\n📝 Ação necessária:');
        console.log('1. Abra o Supabase Dashboard → SQL Editor');
        console.log('2. Execute TODO o conteúdo de: docs/AUTH-SETUP.sql');
        console.log('3. Execute este script novamente');
    } else {
        console.log('✅ Tabelas configuradas corretamente');
        console.log('\n📝 Próximo passo:');
        console.log('1. Se o login falhou, siga: docs/CRIAR-JORGE-MARFETAN.md');
        console.log('2. Crie o usuário Jorge Marfetan no Supabase Dashboard');
        console.log('3. Teste o login em: http://localhost:3000/login');
    }

    console.log('\n');
}

main().catch(console.error);
