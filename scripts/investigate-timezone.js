/**
 * Investigar problema de TIMEZONE em Maio 2025
 * A API usa new Date(row.date).getMonth() que pode mudar de mês dependendo do fuso
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigateTimezone() {
    console.log('='.repeat(70));
    console.log('INVESTIGAÇÃO DE TIMEZONE - MAIO 2025');
    console.log('='.repeat(70));

    // 1. Buscar registros dos dias limítrofes (30 Abril, 1 Maio, 31 Maio, 1 Junho)
    const { data: borderData } = await supabase
        .from('csv_rows')
        .select('id, date, amount, custom_data, description')
        .eq('source', 'invoice-orders')
        .in('date', ['2025-04-30', '2025-05-01', '2025-05-31', '2025-06-01', '2025-06-02'])
        .limit(500);

    console.log('\n📆 Registros nos dias limítrofes:');
    const byDate = {};
    for (const r of borderData || []) {
        const d = r.date;
        if (!byDate[d]) byDate[d] = { count: 0, total: 0 };
        byDate[d].count++;
        byDate[d].total += parseFloat(r.amount) || 0;
    }

    Object.keys(byDate).sort().forEach(d => {
        const info = byDate[d];

        // Testar como new Date() interpreta
        const jsDate = new Date(d);
        const monthIndex = jsDate.getMonth();
        const monthName = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][monthIndex];

        console.log(
            d,
            '→ getMonth():', monthIndex, `(${monthName})`,
            '| Registros:', info.count,
            '| Total:', info.total.toFixed(2), '€'
        );
    });

    // 2. Verificar datas de 01-05 de Maio (que podem ter ido para Abril via timezone)
    const { data: earlyMayData } = await supabase
        .from('csv_rows')
        .select('id, date, amount, custom_data')
        .eq('source', 'invoice-orders')
        .gte('date', '2025-05-01')
        .lte('date', '2025-05-05')
        .limit(1000);

    console.log('\n📆 Registros de 01-05 Maio (podem migrar para Abril):');
    const byDateEarly = {};
    for (const r of earlyMayData || []) {
        const d = r.date;
        if (!byDateEarly[d]) byDateEarly[d] = { count: 0, total: 0 };
        byDateEarly[d].count++;
        byDateEarly[d].total += parseFloat(r.amount) || 0;
    }

    Object.keys(byDateEarly).sort().forEach(d => {
        const info = byDateEarly[d];
        const jsDate = new Date(d);
        const monthIndex = jsDate.getMonth();
        console.log(d, '→ getMonth():', monthIndex, '| Registros:', info.count, '| Total:', info.total.toFixed(2));
    });

    // 3. Verificar o que a API considera como "Maio" (getMonth() === 4)
    const { data: allData } = await supabase
        .from('csv_rows')
        .select('date, amount, custom_data')
        .eq('source', 'invoice-orders')
        .gte('date', '2025-04-25')
        .lte('date', '2025-06-05')
        .limit(3000);

    console.log('\n📊 Analisando como new Date() categoriza cada registro:');

    const apiApril = { count: 0, total: 0 };
    const apiMay = { count: 0, total: 0 };
    const apiJune = { count: 0, total: 0 };

    for (const r of allData || []) {
        if (!r.date) continue;
        const amount = parseFloat(r.amount) || 0;
        if (amount === 0) continue;

        const monthIndex = new Date(r.date).getMonth();

        if (monthIndex === 3) { // Abril
            apiApril.count++;
            apiApril.total += amount;
        } else if (monthIndex === 4) { // Maio
            apiMay.count++;
            apiMay.total += amount;
        } else if (monthIndex === 5) { // Junho
            apiJune.count++;
            apiJune.total += amount;
        }
    }

    console.log('Abril (getMonth=3):', apiApril.count, 'registros,', apiApril.total.toFixed(2), '€');
    console.log('Maio (getMonth=4):', apiMay.count, 'registros,', apiMay.total.toFixed(2), '€');
    console.log('Junho (getMonth=5):', apiJune.count, 'registros,', apiJune.total.toFixed(2), '€');

    // 4. Verificar ambiente de timezone
    console.log('\n🌐 Ambiente:');
    console.log('Timezone do processo:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('TZ env:', process.env.TZ || '(não definido)');

    // Teste de parsing de data
    const testDate = '2025-05-01';
    const parsed = new Date(testDate);
    console.log('\nTeste de parsing:');
    console.log(`  "${testDate}" → getMonth() = ${parsed.getMonth()} (${parsed.getMonth() === 4 ? 'Maio ✅' : 'ERRO ❌'})`);
    console.log(`  toString(): ${parsed.toString()}`);
    console.log(`  toISOString(): ${parsed.toISOString()}`);

    // 5. Encontrar a causa raiz da diferença
    console.log('\n' + '='.repeat(70));
    console.log('🔍 DIAGNÓSTICO:');

    // Contar quantos registros de maio têm amount > 0 vs === 0
    let mayWithValue = 0;
    let mayZero = 0;
    for (const r of allData || []) {
        if (!r.date) continue;
        const monthIndex = new Date(r.date).getMonth();
        if (monthIndex !== 4) continue;

        const amount = parseFloat(r.amount) || 0;
        if (amount === 0) mayZero++;
        else mayWithValue++;
    }

    console.log('Registros Maio com valor:', mayWithValue);
    console.log('Registros Maio com amount=0 (ignorados):', mayZero);
    console.log('Total API considera:', apiMay.count, '(apenas amount != 0)');
}

investigateTimezone().catch(console.error);
