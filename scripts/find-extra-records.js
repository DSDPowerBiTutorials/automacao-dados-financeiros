/**
 * Encontrar os registros EXTRAS que a API está contando em Maio 2025
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findExtraRecords() {
    console.log('='.repeat(70));
    console.log('ENCONTRAR REGISTROS EXTRAS NA API - MAIO 2025');
    console.log('='.repeat(70));

    // 1. IDs do banco (consulta direta Maio 01-31)
    const { data: dbData } = await supabase
        .from('csv_rows')
        .select('id')
        .eq('source', 'invoice-orders')
        .gte('date', '2025-05-01')
        .lte('date', '2025-05-31')
        .limit(5000);

    const dbIDs = new Set(dbData.map(r => r.id));
    console.log('\n📊 IDs no Banco (maio 01-31):', dbIDs.size);

    // 2. IDs da API (ano 2025, getMonth === 4)
    let allData = [];
    let offset = 0;
    while (true) {
        const { data } = await supabase
            .from('csv_rows')
            .select('id, date, amount, custom_data, description')
            .eq('source', 'invoice-orders')
            .gte('date', '2025-01-01')
            .lte('date', '2025-12-31')
            .range(offset, offset + 1000 - 1);
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        offset += 1000;
        if (data.length < 1000) break;
    }

    // Filtrar por getMonth === 4 (Maio)
    const apiMay = allData.filter(r => new Date(r.date).getMonth() === 4);
    const apiIDs = new Set(apiMay.map(r => r.id));
    console.log('📊 IDs na API (getMonth=4):', apiIDs.size);

    // 3. Encontrar IDs que estão na API mas NÃO no banco
    const extraInAPI = [...apiIDs].filter(id => !dbIDs.has(id));
    console.log('\n🔍 IDs EXTRAS na API (não estão no banco):', extraInAPI.length);

    if (extraInAPI.length > 0) {
        // Buscar detalhes desses registros
        const extraRecords = apiMay.filter(r => extraInAPI.includes(r.id));

        console.log('\n--- REGISTROS EXTRAS (primeiros 20) ---');
        console.log('ID'.padEnd(40), 'Data'.padEnd(12), 'Amount'.padStart(12), 'FA');
        console.log('-'.repeat(80));

        let extraTotal = 0;
        for (const r of extraRecords.slice(0, 20)) {
            console.log(
                r.id.substring(0, 38).padEnd(40),
                r.date.padEnd(12),
                (r.amount || 0).toFixed(2).padStart(12),
                r.custom_data?.financial_account_code || 'N/A'
            );
            extraTotal += parseFloat(r.amount) || 0;
        }

        // Total dos extras
        const totalExtra = extraRecords.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        console.log('\nTotal dos registros extras:', totalExtra.toFixed(2), '€');

        // Verificar as datas desses registros extras
        const extraDates = new Set(extraRecords.map(r => r.date));
        console.log('\nDatas dos registros extras:', [...extraDates].sort().join(', '));
    }

    // 4. Encontrar IDs que estão no banco mas NÃO na API
    const missingInAPI = [...dbIDs].filter(id => !apiIDs.has(id));
    console.log('\n🔍 IDs FALTANDO na API (estão no banco mas não na API):', missingInAPI.length);

    // 5. Verificar se o limite de 1000 está afetando
    console.log('\n--- VERIFICAÇÃO DE LIMITE ---');
    console.log('Banco retornou:', dbData.length, 'registros (limit 5000)');
    console.log('API processou:', allData.length, 'registros de 2025');

    // 6. Testar se há problema com o limite no banco
    const { count: totalMay } = await supabase
        .from('csv_rows')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'invoice-orders')
        .gte('date', '2025-05-01')
        .lte('date', '2025-05-31');

    console.log('Total real de registros Maio (count):', totalMay);

    // 7. Comparar com mais detalhes - verificar se há datas "estranhas"
    console.log('\n--- VERIFICAR DATAS NA API ---');
    const apiMayDates = new Set(apiMay.map(r => r.date));
    console.log('Datas únicas na API para Maio:');
    [...apiMayDates].sort().forEach(d => {
        const count = apiMay.filter(r => r.date === d).length;
        const total = apiMay.filter(r => r.date === d).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        console.log('  ', d, ':', count, 'registros,', total.toFixed(2), '€');
    });
}

findExtraRecords().catch(console.error);
