const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
    // Buscar dados brutos
    const { data: rawData } = await supabase
        .from('csv_rows')
        .select('id, custom_data')
        .like('source', 'braintree%')
        .limit(5);
    
    console.log('📋 DADOS BRUTOS (primeiros 5):\n');
    rawData?.forEach((row, i) => {
        console.log(`${i+1}. ID: ${row.id}`);
        console.log(`   custom_data:`, JSON.stringify(row.custom_data, null, 2).substring(0, 500));
        console.log('');
    });
    
    // Verificar se existe order_id com valor
    const { data: withOrder } = await supabase
        .from('csv_rows')
        .select('id, custom_data')
        .like('source', 'braintree%')
        .limit(100);
    
    // Filtrar manualmente
    const hasOrderId = withOrder?.filter(r => 
        r.custom_data?.order_id && r.custom_data?.order_id !== null && r.custom_data?.order_id !== ''
    ) || [];
    
    console.log(`\n📊 ESTATÍSTICAS:`);
    console.log(`  Total verificados: ${withOrder?.length}`);
    console.log(`  Com order_id preenchido: ${hasOrderId.length}`);
    
    if (hasOrderId.length > 0) {
        console.log(`\n✅ EXEMPLOS COM ORDER ID:`);
        hasOrderId.slice(0, 5).forEach(r => {
            console.log(`  ${r.custom_data?.transaction_id}: ${r.custom_data?.order_id}`);
        });
    }
}

checkData();
