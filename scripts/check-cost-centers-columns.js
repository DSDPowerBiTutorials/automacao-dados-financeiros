const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkCostCenters() {
    console.log('\n🔍 Checking cost_centers table structure...\n');

    // Query the table
    const { data, error } = await supabase
        .from('cost_centers')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('⚠️  No data found in cost_centers table');
        return;
    }

    const sample = data[0];
    console.log('✅ Current columns in cost_centers table:');
    console.log('═'.repeat(50));

    Object.keys(sample).forEach((key, index) => {
        const value = sample[key];
        const type = typeof value;
        console.log(`${index + 1}. ${key} (${type})`);
    });

    console.log('═'.repeat(50));
    console.log('\n📊 Sample data:');
    console.log(JSON.stringify(sample, null, 2));

    console.log('\n🔑 Key observations:');
    if (sample.id) {
        console.log(`   ✓ Has "id" column: ${sample.id}`);
    } else {
        console.log('   ✗ NO "id" column found');
    }

    if (sample.code) {
        console.log(`   ✓ Has "code" column: ${sample.code}`);
    }
}

checkCostCenters();
