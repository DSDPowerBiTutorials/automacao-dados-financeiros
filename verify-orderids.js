const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
    // Contar total com order_id não-nulo
    const { data } = await supabase
        .from('csv_rows')
        .select('id, custom_data')
        .like('source', 'braintree%')
        .limit(500);
    
    // Filtrar manualmente
    const withOrderId = data?.filter(r => 
        r.custom_data?.order_id && 
        r.custom_data.order_id !== null && 
        r.custom_data.order_id !== 'null'
    ) || [];
    
    console.log(`📊 RESULTADO DA VERIFICAÇÃO:`);
    console.log(`  Total verificados: ${data?.length}`);
    console.log(`  Com Order ID preenchido: ${withOrderId.length}\n`);
    
    if (withOrderId.length > 0) {
        console.log(`✅ EXEMPLOS COM ORDER ID:`);
        withOrderId.slice(0, 10).forEach(r => {
            console.log(`  ${r.custom_data?.transaction_id}: ${r.custom_data?.order_id}`);
        });
    }
}

verify();
