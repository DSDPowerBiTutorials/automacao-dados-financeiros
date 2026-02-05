/**
 * Script para analisar dados de Maio 2025 e identificar discrepâncias
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeMay2025() {
    console.log('='.repeat(60));
    console.log('ANÁLISE DE MAIO 2025 - DISCREPÂNCIAS');
    console.log('='.repeat(60));

    // 1. Buscar dados do banco para Maio 2025 (com paginação para pegar TODOS)
    let allMayData = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('csv_rows')
            .select('custom_data, amount, date, description')
            .eq('source', 'invoice-orders')
            .gte('date', '2025-05-01')
            .lte('date', '2025-05-31')
            .range(offset, offset + pageSize - 1);

        if (error) {
            console.error('Erro ao buscar dados:', error);
            return;
        }

        if (!data || data.length === 0) break;
        allMayData = allMayData.concat(data);
        offset += pageSize;
        if (data.length < pageSize) break;
    }

    const { count } = await supabase
        .from('csv_rows')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'invoice-orders')
        .gte('date', '2025-05-01')
        .lte('date', '2025-05-31');

    console.log(`\n📊 Total de registros no banco: ${count} (carregados: ${allMayData.length})`);

    const dbData = allMayData;

    // Agrupar por FA
    const byFA = new Map();
    for (const r of dbData) {
        const fa = r.custom_data?.financial_account_code || 'SEM_FA';
        const existing = byFA.get(fa) || { count: 0, total: 0 };
        existing.count++;
        existing.total += parseFloat(r.amount) || 0;
        byFA.set(fa, existing);
    }

    console.log('\n--- DADOS DO BANCO (Maio 2025) ---');
    console.log('FA'.padEnd(12), 'Qtd'.padStart(6), 'Total (€)'.padStart(15));
    console.log('-'.repeat(35));

    let grandTotal = 0;
    const sorted = [...byFA.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [fa, info] of sorted) {
        console.log(
            fa.padEnd(12),
            String(info.count).padStart(6),
            info.total.toFixed(2).padStart(15)
        );
        grandTotal += info.total;
    }
    console.log('-'.repeat(35));
    console.log('TOTAL'.padEnd(12), '', grandTotal.toFixed(2).padStart(15));

    // 2. Verificar se há registros com FA nulo ou incorreto
    const semFA = byFA.get('SEM_FA');
    if (semFA && semFA.count > 0) {
        console.log('\n⚠️  ALERTA: Registros sem Financial Account:', semFA.count);
    }

    // 3. Resumo por categoria principal (101, 102, 103, 104, 105)
    console.log('\n--- RESUMO POR CATEGORIA ---');
    const categories = {
        '101': { name: 'Growth', total: 0 },
        '102': { name: 'Delight', total: 0 },
        '103': { name: 'Planning Center', total: 0 },
        '104': { name: 'LAB', total: 0 },
        '105': { name: 'Other Income', total: 0 },
    };

    for (const [fa, info] of sorted) {
        const cat = fa.split('.')[0];
        if (categories[cat]) {
            categories[cat].total += info.total;
        }
    }

    console.log('Cat'.padEnd(6), 'Nome'.padEnd(20), 'Total (€)'.padStart(15));
    console.log('-'.repeat(45));
    for (const [cat, data] of Object.entries(categories)) {
        console.log(cat.padEnd(6), data.name.padEnd(20), data.total.toFixed(2).padStart(15));
    }

    console.log('\n' + '='.repeat(60));
    console.log('💰 TOTAL GERAL MAIO 2025:', grandTotal.toFixed(2), '€');
    console.log('='.repeat(60));

    // 4. Comparar com valores da API (que aparecem no P&L)
    console.log('\n--- COMPARAÇÃO: BANCO vs API ---');
    const apiValues = {
        '101.1': 112876,
        '101.4': 51477.65,
        '101.5': 486.74,
        '102.1': 122735,
        '102.2': 211747,
        '102.4': 18000,
        '102.5': 6600,
        '102.6': 5000,
        '102.7': 6500,
        '103.1': 27506.20,
        '103.2': 24287.88,
        '103.4': 1572.5,
        '103.5': 36119.02,
        '103.7': 9476.65,
        '104.1': 27832.07,
        '104.2': 34526.55,
        '104.4': 2394,
        '104.5': 15632.5,
        '104.7': 15056.32,
        '105.1': 3670.25,
    };

    console.log('FA'.padEnd(10), 'Banco'.padStart(12), 'API'.padStart(12), 'Diff'.padStart(12), 'Status');
    console.log('-'.repeat(55));

    let totalDiff = 0;
    for (const [fa, info] of sorted) {
        if (fa === 'SEM_FA') continue;
        const apiVal = apiValues[fa] || 0;
        const diff = info.total - apiVal;
        totalDiff += Math.abs(diff);
        const status = Math.abs(diff) < 1 ? '✅' : diff > 0 ? '⬆️ Banco maior' : '⬇️ API maior';
        if (Math.abs(diff) >= 1) {
            console.log(
                fa.padEnd(10),
                info.total.toFixed(2).padStart(12),
                apiVal.toFixed(2).padStart(12),
                diff.toFixed(2).padStart(12),
                status
            );
        }
    }
    console.log('-'.repeat(55));
    console.log('Total diferenças absolutas:', totalDiff.toFixed(2));
}

analyzeMay2025().catch(console.error);
