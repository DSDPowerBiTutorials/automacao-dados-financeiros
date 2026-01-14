const gocardless = require('gocardless-nodejs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigateGoCardless() {
    console.log('🔍 INVESTIGANDO GOCARDLESS...\n');
    
    // Verificar dados no Supabase
    const { data: gcData } = await supabase
        .from('csv_rows')
        .select('*')
        .like('source', '%gocardless%')
        .order('date', { ascending: false })
        .limit(20);
    
    console.log(`📊 Registros GoCardless no Supabase: ${gcData?.length || 0}\n`);
    
    if (gcData?.length > 0) {
        console.log('📋 EXEMPLOS DE TRANSAÇÕES GOCARDLESS:');
        gcData.slice(0, 5).forEach((row, i) => {
            console.log(`\n${i+1}. ${row.date} - €${row.amount}`);
            console.log(`   Descrição: ${row.description}`);
            console.log(`   Source: ${row.source}`);
            console.log(`   Custom Data:`, JSON.stringify(row.custom_data || {}, null, 2).substring(0, 300));
        });
    }
    
    // Tentar conectar à API GoCardless
    console.log('\n\n🔌 CONECTANDO À API GOCARDLESS...');
    try {
        const client = gocardless.default(
            process.env.GOCARDLESS_ACCESS_TOKEN,
            gocardless.Environments.Live
        );
        
        // Buscar pagamentos recentes
        const payments = await client.payments.list({
            created_at: { gte: '2025-12-01T00:00:00Z' },
            limit: 20
        });
        
        console.log(`\n📥 Pagamentos da API: ${payments.payments?.length || 0}`);
        
        if (payments.payments?.length > 0) {
            console.log('\n📋 PAGAMENTOS GOCARDLESS (API):');
            for (const p of payments.payments.slice(0, 10)) {
                // Buscar metadata do mandate/subscription
                let orderId = null;
                let metadata = {};
                
                try {
                    if (p.links?.mandate) {
                        const mandate = await client.mandates.get(p.links.mandate);
                        metadata = mandate.metadata || {};
                    }
                } catch (e) {}
                
                console.log(`\n  ID: ${p.id}`);
                console.log(`  Valor: ${p.amount / 100} ${p.currency}`);
                console.log(`  Data: ${p.created_at}`);
                console.log(`  Status: ${p.status}`);
                console.log(`  Descrição: ${p.description || 'N/A'}`);
                console.log(`  Metadata:`, JSON.stringify(metadata));
            }
        }
        
    } catch (err) {
        console.log(`  ⚠️ Erro API: ${err.message}`);
    }
}

investigateGoCardless().then(() => process.exit(0));
