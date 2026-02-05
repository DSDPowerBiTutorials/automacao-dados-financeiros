/**
 * Script para investigar a discrepância entre banco direto e API para Maio 2025
 * Problema: Banco mostra 719.108€, API mostra valores diferentes
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigateMay2025() {
    console.log('='.repeat(70));
    console.log('INVESTIGAÇÃO DETALHADA - MAIO 2025');
    console.log('='.repeat(70));

    // 1. Consulta direta - MAIO 2025 (01 a 31)
    const { data: mayData, error: e1, count: c1 } = await supabase
        .from('csv_rows')
        .select('id, date, amount, custom_data', { count: 'exact' })
        .eq('source', 'invoice-orders')
        .gte('date', '2025-05-01')
        .lte('date', '2025-05-31')
        .limit(5000);

    if (e1) { console.error('Erro:', e1); return; }

    console.log('\n📆 Maio 2025 (01-31): ', c1, 'registros');

    // 2. Verificar distribuição de datas
    const byDate = new Map();
    for (const r of mayData) {
        const d = r.date;
        if (!byDate.has(d)) byDate.set(d, { count: 0, total: 0 });
        const v = byDate.get(d);
        v.count++;
        v.total += parseFloat(r.amount) || 0;
    }

    console.log('\n--- Distribuição por data (primeiras e últimas 5) ---');
    const sortedDates = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    console.log('Primeiras 5 datas:');
    sortedDates.slice(0, 5).forEach(([d, v]) => {
        console.log('  ', d, ':', v.count, 'registros,', v.total.toFixed(2), '€');
    });
    console.log('Últimas 5 datas:');
    sortedDates.slice(-5).forEach(([d, v]) => {
        console.log('  ', d, ':', v.count, 'registros,', v.total.toFixed(2), '€');
    });

    // 3. Pegar o total para cada FA
    const byFA = new Map();
    for (const r of mayData) {
        const fa = r.custom_data?.financial_account_code || 'SEM_FA';
        const existing = byFA.get(fa) || { count: 0, total: 0, negatives: 0, negativeTotal: 0 };
        existing.count++;
        const amt = parseFloat(r.amount) || 0;
        existing.total += amt;
        if (amt < 0) {
            existing.negatives++;
            existing.negativeTotal += amt;
        }
        byFA.set(fa, existing);
    }

    // 4. Mostrar FAs com credit notes (negativos)
    console.log('\n--- FAs com Credit Notes (valores negativos) ---');
    const sortedFA = [...byFA.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [fa, info] of sortedFA) {
        if (info.negatives > 0) {
            console.log(fa, ':', info.negatives, 'credit notes,', info.negativeTotal.toFixed(2), '€');
        }
    }

    // 5. Verificar se a API usa um ano diferente
    console.log('\n--- Verificar processamento da API ---');

    // A API usa: const monthIndex = new Date(row.date).getMonth();
    // Se a data for "2025-05-15", getMonth() retorna 4 (maio = índice 4)
    // monthKeys[4] = "may" ✅ Correto

    // 6. Buscar TODOS os dados de 2025 e calcular maio como a API faz
    let allData = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('csv_rows')
            .select('date, amount, custom_data')
            .eq('source', 'invoice-orders')
            .gte('date', '2025-01-01')
            .lte('date', '2025-12-31')
            .range(offset, offset + pageSize - 1);

        if (error) { console.error('Erro:', error); break; }
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        offset += pageSize;
        if (data.length < pageSize) break;
    }

    console.log('\nTotal 2025:', allData.length, 'registros');

    // Processar como a API
    const byFaApi = {};
    for (const row of allData) {
        if (!row.date) continue;
        const amount = row.amount || 0;
        if (amount === 0) continue;

        const monthIndex = new Date(row.date).getMonth();
        if (monthIndex !== 4) continue; // Maio = 4

        const fa = row.custom_data?.financial_account_code;
        if (!fa) continue;

        if (!byFaApi[fa]) byFaApi[fa] = 0;
        byFaApi[fa] += amount;
    }

    console.log('\n--- Simulação da API para Maio ---');
    console.log('FA'.padEnd(10), 'Total API'.padStart(14));
    console.log('-'.repeat(25));

    let totalApi = 0;
    Object.keys(byFaApi).sort().forEach(fa => {
        console.log(fa.padEnd(10), byFaApi[fa].toFixed(2).padStart(14));
        totalApi += byFaApi[fa];
    });
    console.log('-'.repeat(25));
    console.log('TOTAL:'.padEnd(10), totalApi.toFixed(2).padStart(14));

    // 7. Comparação final
    const totalBanco = [...byFA.values()].reduce((s, v) => s + v.total, 0);

    console.log('\n' + '='.repeat(70));
    console.log('📊 COMPARAÇÃO FINAL:');
    console.log('   Banco direto (Maio 01-31):', totalBanco.toFixed(2), '€');
    console.log('   Simulação API (getMonth=4):', totalApi.toFixed(2), '€');
    console.log('   Diferença:', (totalBanco - totalApi).toFixed(2), '€');
    console.log('='.repeat(70));

    // 8. Investigar registros perdidos
    if (Math.abs(totalBanco - totalApi) > 1) {
        console.log('\n🔍 INVESTIGANDO REGISTROS FALTANTES...');

        // Verificar se há registros com amount = 0 que estão sendo ignorados
        let zeroCount = 0;
        for (const r of mayData) {
            if ((r.amount || 0) === 0) zeroCount++;
        }
        console.log('Registros com amount = 0:', zeroCount);

        // Verificar registros sem FA
        const semFA = byFA.get('SEM_FA');
        if (semFA) {
            console.log('Registros SEM FA:', semFA.count, '- Total:', semFA.total.toFixed(2), '€');
        }

        // Verificar FAs que não estão na lista da API
        const API_FA_LIST = [
            "101.1", "101.2", "101.3", "101.4", "101.5",
            "102.1", "102.2", "102.3", "102.4", "102.5", "102.6", "102.7",
            "103.1", "103.2", "103.3", "103.4", "103.5", "103.6", "103.7",
            "104.1", "104.2", "104.3", "104.4", "104.5", "104.6", "104.7",
            "105.1", "105.2", "105.3", "105.4"
        ];

        console.log('\nFAs NÃO na lista da API:');
        for (const [fa, info] of sortedFA) {
            if (!API_FA_LIST.includes(fa) && fa !== 'SEM_FA') {
                console.log('  ', fa, ':', info.count, 'registros,', info.total.toFixed(2), '€');
            }
        }
    }
}

investigateMay2025().catch(console.error);
