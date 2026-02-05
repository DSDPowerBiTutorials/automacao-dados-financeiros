/**
 * Resumo final de Maio 2025 - Comparar com Excel do usuário
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function may2025Summary() {
    console.log('='.repeat(70));
    console.log('RESUMO MAIO 2025 - PARA COMPARAR COM EXCEL');
    console.log('='.repeat(70));

    // Buscar todos os dados de Maio 2025 com paginação
    let allData = [];
    let offset = 0;
    while (true) {
        const { data } = await supabase
            .from('csv_rows')
            .select('custom_data, amount, date')
            .eq('source', 'invoice-orders')
            .gte('date', '2025-05-01')
            .lte('date', '2025-05-31')
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        offset += 1000;
        if (data.length < 1000) break;
    }

    console.log('\n📊 Total de registros Maio 2025:', allData.length);

    // Agrupar por categoria (101, 102, 103, 104, 105)
    const categories = {
        '101': { name: 'Growth', total: 0, count: 0 },
        '102': { name: 'Delight', total: 0, count: 0 },
        '103': { name: 'Planning Center', total: 0, count: 0 },
        '104': { name: 'LAB', total: 0, count: 0 },
        '105': { name: 'Other Income', total: 0, count: 0 },
    };

    let grandTotal = 0;
    for (const r of allData) {
        const fa = r.custom_data?.financial_account_code || '';
        const cat = fa.split('.')[0];
        const amt = parseFloat(r.amount) || 0;

        if (categories[cat]) {
            categories[cat].total += amt;
            categories[cat].count++;
        }
        grandTotal += amt;
    }

    console.log('\n--- RESUMO POR CATEGORIA (Maio 2025) ---');
    console.log('Cat'.padEnd(8), 'Nome'.padEnd(20), 'Registros'.padStart(10), 'Total €'.padStart(15));
    console.log('-'.repeat(55));

    for (const [cat, data] of Object.entries(categories)) {
        console.log(
            cat.padEnd(8),
            data.name.padEnd(20),
            String(data.count).padStart(10),
            data.total.toFixed(2).padStart(15)
        );
    }
    console.log('-'.repeat(55));
    console.log('TOTAL'.padEnd(8), ''.padEnd(20), String(allData.length).padStart(10), grandTotal.toFixed(2).padStart(15));

    console.log('\n' + '='.repeat(70));
    console.log('💰 TOTAL GERAL MAIO 2025: €', grandTotal.toFixed(2));
    console.log('');
    console.log('📋 Compare este valor com o Excel para verificar se há discrepância.');
    console.log('   Se o Excel mostrar valor diferente, pode indicar:');
    console.log('   - Dados faltando no import');
    console.log('   - Filtros diferentes aplicados');
    console.log('   - Datas interpretadas diferentemente');
    console.log('='.repeat(70));
}

may2025Summary().catch(console.error);
