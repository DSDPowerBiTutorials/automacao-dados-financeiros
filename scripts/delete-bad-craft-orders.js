require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    // Count records to delete
    const { count, error: countErr } = await supabase
        .from('ar_invoices')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'craft-commerce')
        .gte('invoice_date', '2026-03-05');

    if (countErr) {
        console.error('❌ Error counting:', countErr.message);
        return;
    }

    console.log(`🗑️  Found ${count} craft-commerce records with invoice_date >= 2026-03-05`);

    if (count === 0) {
        console.log('✅ Nothing to delete');
        return;
    }

    // Delete
    const { error } = await supabase
        .from('ar_invoices')
        .delete()
        .eq('source', 'craft-commerce')
        .gte('invoice_date', '2026-03-05');

    if (error) {
        console.error('❌ Delete error:', error.message);
        return;
    }

    console.log(`✅ Deleted ${count} records`);

    // Verify
    const { count: remaining } = await supabase
        .from('ar_invoices')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'craft-commerce')
        .gte('invoice_date', '2026-03-05');

    console.log(`🔍 Remaining craft-commerce >= 2026-03-05: ${remaining || 0}`);
}

main();
