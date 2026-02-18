const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await s.from('web_orders').select('id').limit(1);
    if (!error) {
        console.log('✅ Tabela web_orders já existe!');
    } else if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('❌ Tabela web_orders NÃO existe.');
        console.log('Execute a migração no Supabase SQL Editor:');
        console.log('  Cole o conteúdo de: supabase/migrations/20260211_create_web_orders.sql');
    } else {
        console.log('Status:', error.message);
    }
}
check();
