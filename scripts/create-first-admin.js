#!/usr/bin/env node

/**
 * Script para criar o primeiro usuário admin
 * Uso: node scripts/create-first-admin.js
 */

const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

console.log('\n=== Criar Primeiro Usuário Admin ===\n');

// Dados do usuário
const userData = {
    email: 'jmarfetan@digitalsmiledesign.com',
    password: '***REMOVED***',
    name: 'Jorge Marfetan',
    department: 'Finance',
};

console.log('Dados do usuário:');
console.log(`  Nome: ${userData.name}`);
console.log(`  Cargo: Finance Controller (Admin)`);
console.log(`  Email: ${userData.email}`);
console.log(`  Senha: ${userData.password}`);
console.log(`  Departamento: ${userData.department}`);
console.log(`  Role: admin (acesso total)`);
console.log(`  Empresa: GLOBAL\n`);

rl.question('Deseja criar este usuário? (s/n): ', async (answer) => {
    if (answer.toLowerCase() !== 's' && answer.toLowerCase() !== 'sim') {
        console.log('Operação cancelada.');
        rl.close();
        return;
    }

    console.log('\nCriando usuário...');

    try {
        // Fazer requisição para a API
        const response = await fetch('http://localhost:3000/api/setup-admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('\n❌ Erro ao criar usuário:');
            console.error(result.error || 'Erro desconhecido');
            rl.close();
            return;
        }

        console.log('\n✅ Usuário criado com sucesso!');
        console.log('\nDetalhes:');
        console.log(`  ID: ${result.user.id}`);
        console.log(`  Email: ${result.user.email}`);
        console.log(`  Nome: ${result.user.name}`);
        console.log(`  Role: ${result.user.role}`);
        console.log(`  Empresa: ${result.user.company_code}`);
        console.log(`  Departamento: ${result.user.department}`);
        console.log('\n📝 Você pode fazer login agora em: http://localhost:3000/login');
        console.log('\n⚠️  IMPORTANTE: Remova a rota /api/setup-admin após o setup inicial!\n');
    } catch (error) {
        console.error('\n❌ Erro ao fazer requisição:');
        console.error(error.message);
        console.log('\nVerifique se o servidor está rodando: npm run dev');
    }

    rl.close();
});
