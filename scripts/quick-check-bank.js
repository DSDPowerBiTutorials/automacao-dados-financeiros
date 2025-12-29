require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
    console.log('Checking bank_accounts table...');

    const { data, error, count } = await supabase
        .from('bank_accounts')
        .select('*', { count: 'exact' })
        .limit(1);

    if (error) {
        console.error('Error:', error);
        process.exit(1);
    }

    console.log('Total rows:', count);
    if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]).join(', '));
        console.log('\nSample row:', JSON.stringify(data[0], null, 2));
    } else {
        console.log('No data found');
    }

    process.exit(0);
})();
