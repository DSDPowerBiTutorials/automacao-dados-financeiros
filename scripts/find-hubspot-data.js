require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findHubspotData() {
    const tables = ['deals', 'hubspot', 'orders', 'web_orders', 'sales', 'hubspot_orders', 'transactions', 'hubspot_contacts', 'contacts'];

    console.log('Procurando tabelas com dados HubSpot...\n');

    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (!error && data) {
            console.log(`✅ ${table}: ${data.length > 0 ? 'tem dados' : 'vazia'}`);
            if (data[0]) {
                console.log(`   Campos: ${Object.keys(data[0]).slice(0, 10).join(', ')}...`);
            }
        }
    }

    // Ver sources únicos em csv_rows
    const { data: rows } = await supabase.from('csv_rows').select('source').limit(5000);
    if (rows) {
        const sources = [...new Set(rows.map(r => r.source))];
        console.log('\nSources em csv_rows:', sources);
    }
}

findHubspotData().catch(console.error);
