require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
    try {
        console.log('Checking providers table structure...\n');

        const { data, error } = await supabase
            .from('providers')
            .select('*')
            .limit(3);

        if (error) {
            console.error('Error:', error);
            return;
        }

        if (data && data.length > 0) {
            console.log('Sample provider record:');
            console.log(JSON.stringify(data[0], null, 2));
            console.log('\nFields available:', Object.keys(data[0]).join(', '));
            console.log(`\nTotal providers: ${data.length}`);
        } else {
            console.log('No providers found in database');
        }
    } catch (err) {
        console.error('Error:', err);
    }
})();
