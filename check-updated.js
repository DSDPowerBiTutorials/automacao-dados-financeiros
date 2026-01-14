const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUpdated() {
    // Verificar registros Braintree com order_id
    const { data, error } = await supabase
        .from('csv_rows')
        .select('id, customer_name, custom_data')
        .like('source', 'braintree%')
        .not('custom_data->order_id', 'is', null)
        .limit(10);
    
    if (error) {
        console.error('Erro:', error.message);
        return;
    }
    
    console.log('📋 REGISTROS BRAINTREE COM ORDER ID:\n');
    data?.forEach(row => {
        console.log(`  ID: ${row.custom_data?.transaction_id || row.id}`);
        console.log(`  Order ID: ${row.custom_data?.order_id}`);
        console.log(`  Cliente: ${row.customer_name}`);
        console.log(`  Método: ${row.custom_data?.payment_method}`);
        console.log('');
    });
    
    // Contar total
    const { count } = await supabase
        .from('csv_rows')
        .select('*', { count: 'exact', head: true })
        .like('source', 'braintree%')
        .not('custom_data->order_id', 'is', null);
    
    console.log(`\n📊 Total com Order ID: ${count || 0}`);
}

checkUpdated();
