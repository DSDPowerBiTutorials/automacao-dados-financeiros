#!/usr/bin/env node
/**
 * Script de validação de dados P&L
 * Verifica se os dados no banco correspondem ao Excel
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function validate() {
    // Buscar todos os registros de 2025
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

        if (error) {
            console.error('Erro:', error.message);
            return;
        }

        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        offset += pageSize;
        if (data.length < pageSize) break;
    }

    console.log('📊 Validação de Dados P&L - 2025');
    console.log('═'.repeat(70));
    console.log(`Total de registros 2025: ${allData.length}`);

    // Agrupar por FA e mês
    const byFAMonth = {};
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    for (const row of allData) {
        const fa = row.custom_data?.financial_account_code || 'N/A';
        const month = new Date(row.date).getMonth();
        const key = `${fa}|${month}`;

        if (!byFAMonth[key]) {
            byFAMonth[key] = { fa, month, count: 0, total: 0 };
        }
        byFAMonth[key].count++;
        byFAMonth[key].total += row.amount || 0;
    }

    // Financial Accounts para verificar
    const allFAs = [
        '101.1', '101.2', '101.3', '101.4', '101.5',
        '102.1', '102.2', '102.3', '102.4', '102.5', '102.6', '102.7',
        '103.1', '103.2', '103.3', '103.4', '103.5', '103.6', '103.7',
        '104.1', '104.2', '104.3', '104.4', '104.5', '104.6', '104.7',
        '105.1', '105.2', '105.3', '105.4'
    ];

    // Mostrar Janeiro 2025
    console.log('\n📊 Janeiro 2025 (mês fechado):');
    console.log('-'.repeat(50));
    allFAs.forEach(fa => {
        const data = byFAMonth[`${fa}|0`];
        if (data && data.total !== 0) {
            console.log(`   FA ${fa}: ${data.count.toString().padStart(4)} reg = €${data.total.toLocaleString('de-DE', { minimumFractionDigits: 2 }).padStart(15)}`);
        }
    });

    // Mostrar Março 2025 - VALIDAÇÃO PRINCIPAL
    console.log('\n📊 Março 2025 (VALIDAÇÃO PRINCIPAL):');
    console.log('-'.repeat(50));
    allFAs.forEach(fa => {
        const data = byFAMonth[`${fa}|2`];
        if (data && data.total !== 0) {
            console.log(`   FA ${fa}: ${data.count.toString().padStart(4)} reg = €${data.total.toLocaleString('de-DE', { minimumFractionDigits: 2 }).padStart(15)}`);
        }
    });

    // Verificação específica FA 101.1 Março
    const mar101_1 = byFAMonth['101.1|2'];
    if (mar101_1) {
        console.log('\n🎯 Verificação FA 101.1 Março 2025 (DSD Courses):');
        console.log(`   Registros: ${mar101_1.count} (esperado: 128)`);
        console.log(`   Total: €${mar101_1.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (esperado: €543.337,50)`);
        if (mar101_1.count === 128 && Math.abs(mar101_1.total - 543337.50) < 1) {
            console.log('   ✅ CORRETO! Igual ao Excel.');
        } else {
            console.log('   ⚠️  DIFERENÇA DETECTADA');
        }
    }

    // Totais por categoria para cada mês fechado (Jan-Dez 2025)
    console.log('\n📊 Totais por Categoria - YTD 2025 (Jan-Dez):');
    console.log('-'.repeat(70));

    const categories = ['101.0', '102.0', '103.0', '104.0', '105.0'];

    // Header
    console.log('FA      ' + months.map(m => m.padStart(12)).join('') + '      TOTAL');
    console.log('-'.repeat(70));

    categories.forEach(cat => {
        const prefix = cat.split('.')[0];
        const fas = allFAs.filter(fa => fa.startsWith(prefix + '.'));

        let monthTotals = [];
        let yearTotal = 0;

        for (let m = 0; m < 12; m++) {
            let monthSum = 0;
            fas.forEach(fa => {
                const data = byFAMonth[`${fa}|${m}`];
                if (data) monthSum += data.total;
            });
            monthTotals.push(monthSum);
            yearTotal += monthSum;
        }

        console.log(
            cat.padEnd(8) +
            monthTotals.map(t => Math.round(t).toLocaleString('de-DE').padStart(12)).join('') +
            Math.round(yearTotal).toLocaleString('de-DE').padStart(12)
        );
    });

    // Total geral
    let grandMonthTotals = [];
    let grandTotal = 0;
    for (let m = 0; m < 12; m++) {
        let monthSum = 0;
        allFAs.forEach(fa => {
            const data = byFAMonth[`${fa}|${m}`];
            if (data) monthSum += data.total;
        });
        grandMonthTotals.push(monthSum);
        grandTotal += monthSum;
    }

    console.log('-'.repeat(70));
    console.log(
        'TOTAL'.padEnd(8) +
        grandMonthTotals.map(t => Math.round(t).toLocaleString('de-DE').padStart(12)).join('') +
        Math.round(grandTotal).toLocaleString('de-DE').padStart(12)
    );

    console.log('\n═'.repeat(70));
    console.log('✅ Validação concluída');
}

validate().catch(console.error);
