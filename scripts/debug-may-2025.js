/**
 * Investigar a diferença entre consulta direta e API para Maio 2025
 * Banco: 1181 registros, 719.108€
 * API: 427 registros (com valor), valores diferentes
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMay2025() {
    console.log('='.repeat(70));
    console.log('DEBUG DETALHADO - MAIO 2025');
    console.log('='.repeat(70));

    // 1. Consulta EXATA que o banco faz (gte/lte)
    const { data: dbData, count } = await supabase
        .from('csv_rows')
        .select('id, date, amount, custom_data', { count: 'exact' })
        .eq('source', 'invoice-orders')
        .gte('date', '2025-05-01')
        .lte('date', '2025-05-31')
        .limit(5000);

    console.log('\n📊 Consulta Banco (gte/lte 05-01 a 05-31):');
    console.log('   Registros:', count);

    let totalBanco = 0;
    let countWithValue = 0;
    let countZero = 0;
    const byFA_Banco = {};

    for (const r of dbData) {
        const amt = parseFloat(r.amount) || 0;
        const fa = r.custom_data?.financial_account_code || 'SEM_FA';

        if (!byFA_Banco[fa]) byFA_Banco[fa] = { count: 0, total: 0, zeros: 0 };
        byFA_Banco[fa].count++;
        byFA_Banco[fa].total += amt;

        if (amt === 0) {
            countZero++;
            byFA_Banco[fa].zeros++;
        } else {
            countWithValue++;
        }
        totalBanco += amt;
    }

    console.log('   Com valor (!=0):', countWithValue);
    console.log('   Zeros:', countZero);
    console.log('   Total €:', totalBanco.toFixed(2));

    // 2. Consulta como a API faz (getMonth)
    // Buscar dados de 2025-01-01 a 2025-12-31 e filtrar por getMonth === 4
    let allData = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
        const { data } = await supabase
            .from('csv_rows')
            .select('id, date, amount, custom_data')
            .eq('source', 'invoice-orders')
            .gte('date', '2025-01-01')
            .lte('date', '2025-12-31')
            .range(offset, offset + pageSize - 1);

        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        offset += pageSize;
        if (data.length < pageSize) break;
    }

    console.log('\n📊 Consulta API (ano 2025, filtro getMonth=4):');
    console.log('   Total 2025:', allData.length, 'registros');

    let totalAPI = 0;
    let countAPI = 0;
    let countAPIZero = 0;
    const byFA_API = {};

    for (const r of allData) {
        if (!r.date) continue;
        const monthIndex = new Date(r.date).getMonth();
        if (monthIndex !== 4) continue; // Maio

        const amt = parseFloat(r.amount) || 0;
        const fa = r.custom_data?.financial_account_code || 'SEM_FA';

        if (!byFA_API[fa]) byFA_API[fa] = { count: 0, total: 0, zeros: 0 };
        byFA_API[fa].count++;
        byFA_API[fa].total += amt;

        if (amt === 0) {
            countAPIZero++;
            byFA_API[fa].zeros++;
        } else {
            countAPI++;
        }
        totalAPI += amt;
    }

    console.log('   Maio (getMonth=4):', countAPI + countAPIZero, 'registros');
    console.log('   Com valor (!=0):', countAPI);
    console.log('   Zeros:', countAPIZero);
    console.log('   Total €:', totalAPI.toFixed(2));

    // 3. Comparar FA por FA
    console.log('\n--- COMPARAÇÃO POR FA ---');
    console.log('FA'.padEnd(10), 'Banco'.padStart(10), 'API'.padStart(10), 'Diff'.padStart(10));
    console.log('-'.repeat(45));

    const allFAs = new Set([...Object.keys(byFA_Banco), ...Object.keys(byFA_API)]);
    let totalDiff = 0;

    for (const fa of [...allFAs].sort()) {
        const b = byFA_Banco[fa]?.total || 0;
        const a = byFA_API[fa]?.total || 0;
        const diff = b - a;

        if (Math.abs(diff) > 0.01) {
            console.log(
                fa.padEnd(10),
                b.toFixed(2).padStart(10),
                a.toFixed(2).padStart(10),
                diff.toFixed(2).padStart(10)
            );
            totalDiff += diff;
        }
    }
    console.log('-'.repeat(45));
    console.log('TOTAL DIFF:'.padEnd(30), totalDiff.toFixed(2).padStart(10));

    // 4. Verificar se há IDs duplicados ou registros repetidos
    console.log('\n--- VERIFICANDO IDs ---');
    const dbIDs = new Set(dbData.map(r => r.id));
    console.log('IDs únicos no banco (maio):', dbIDs.size);

    // Verificar se há datas fora do esperado
    const datesInDB = new Set(dbData.map(r => r.date));
    console.log('\nDatas únicas no banco:', datesInDB.size);
    console.log('Range:', Math.min(...[...datesInDB]), 'a', Math.max(...[...datesInDB]));

    // 5. DIAGNÓSTICO FINAL
    console.log('\n' + '='.repeat(70));
    console.log('🔍 DIAGNÓSTICO FINAL:');
    console.log('');
    console.log('Banco direto (gte/lte):', totalBanco.toFixed(2), '€ (' + count + ' registros)');
    console.log('API (getMonth):', totalAPI.toFixed(2), '€ (' + (countAPI + countAPIZero) + ' registros)');
    console.log('Diferença:', (totalBanco - totalAPI).toFixed(2), '€');
    console.log('');

    if (totalBanco < totalAPI) {
        console.log('⚠️  API mostra MAIS que o banco direto!');
        console.log('   Isso indica que há registros de OUTROS meses sendo contados como Maio');
    } else if (totalBanco > totalAPI) {
        console.log('⚠️  Banco mostra MAIS que a API!');
        console.log('   Isso indica que a API está EXCLUINDO registros válidos de Maio');
    }
    console.log('='.repeat(70));
}

debugMay2025().catch(console.error);
