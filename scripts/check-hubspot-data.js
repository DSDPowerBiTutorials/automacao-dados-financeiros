require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHubspotData() {
    console.log('🔍 Verificando dados HubSpot...\n');

    // 1. Verificar csv_rows com source hubspot
    const { data: hubspotRows, count } = await supabase
        .from('csv_rows')
        .select('*', { count: 'exact' })
        .eq('source', 'hubspot')
        .limit(5);

    console.log(`📊 csv_rows com source='hubspot': ${count || 0} registros`);

    if (hubspotRows && hubspotRows.length > 0) {
        console.log('\nExemplo de registro HubSpot:');
        console.log(JSON.stringify(hubspotRows[0], null, 2));
    }

    // 2. Listar todos os sources únicos
    const { data: allRows } = await supabase
        .from('csv_rows')
        .select('source')
        .limit(10000);

    if (allRows) {
        const sources = [...new Set(allRows.map(r => r.source))];
        console.log('\n📋 Sources disponíveis em csv_rows:');
        sources.forEach(s => console.log(`   - ${s}`));
    }

    // 3. Verificar ar_invoices
    const { count: arCount } = await supabase
        .from('ar_invoices')
        .select('id', { count: 'exact', head: true });

    console.log(`\n📊 ar_invoices: ${arCount || 0} registros`);
}

checkHubspotData().catch(console.error);
