require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('❌ Supabase URL ou Key não configurados');
    process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
    // Verificar transações recentes do hubspot
    const { data, error } = await supabase
        .from('csv_rows')
        .select('id, date, description, customer_name, customer_email, custom_data')
        .eq('source', 'hubspot')
        .gte('date', '2026-01-28')
        .order('date', { ascending: false })
        .limit(50);

    if (error) {
        console.error('❌ Erro:', error);
        return;
    }

    console.log('📊 Transações recentes do HubSpot (após correção):');
    console.log('---');

    // Agrupar por data
    const byDate = {};
    let totalWithName = 0;
    let totalWithoutName = 0;

    for (const row of data) {
        const date = new Date(row.date).toISOString().split('T')[0];
        const hasName = row.customer_name ? true : false;

        if (!byDate[date]) {
            byDate[date] = { withName: 0, withoutName: 0, examples: [] };
        }

        if (hasName) {
            byDate[date].withName++;
            totalWithName++;
            // Mostrar exemplos de nomes extraídos via fallback
            if (row.custom_data?.name_extracted_from === 'dealname_fallback' && byDate[date].examples.length < 2) {
                byDate[date].examples.push({
                    name: row.customer_name,
                    desc: row.description?.substring(0, 50)
                });
            }
        } else {
            byDate[date].withoutName++;
            totalWithoutName++;
        }
    }

    // Mostrar resumo por data
    console.log('📅 Resumo por data:');
    for (const date of Object.keys(byDate).sort().reverse()) {
        const info = byDate[date];
        const status = info.withoutName === 0 ? '✅' : '⚠️';
        console.log(`  ${status} ${date}: ${info.withName} com nome, ${info.withoutName} sem nome`);

        if (info.examples.length > 0) {
            console.log('    Extraídos via fallback:');
            for (const ex of info.examples) {
                console.log(`      👤 ${ex.name}`);
            }
        }
    }

    console.log('---');
    console.log(`Total: ✅ ${totalWithName} com nome | ❌ ${totalWithoutName} sem nome`);
}

check();
