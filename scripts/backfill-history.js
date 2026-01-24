const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://rrzgawssbyfzbkmtcovz.supabase.co',
    'sb_secret_d5XN1_EVZod7kJJCRZpXmw_ncDkXEoY'
);

async function backfillHistory() {
    // Get all invoices
    const { data: invoices, error: invError } = await supabase
        .from('invoices')
        .select('id, created_at');

    if (invError) {
        console.log('Error fetching invoices:', invError.message);
        return;
    }

    // Get existing history entries
    const { data: existingHistory } = await supabase
        .from('invoice_history')
        .select('invoice_id')
        .eq('change_type', 'created');

    const existingIds = new Set((existingHistory || []).map(h => h.invoice_id));

    // Filter invoices that don't have history
    const toInsert = (invoices || [])
        .filter(inv => !existingIds.has(inv.id))
        .map(inv => ({
            invoice_id: inv.id,
            change_type: 'created',
            field_name: 'invoice',
            new_value: 'Payment created',
            changed_by: 'system',
            changed_at: inv.created_at || new Date().toISOString()
        }));

    console.log('Found', invoices?.length || 0, 'invoices');
    console.log('Already have history:', existingIds.size);
    console.log('To insert:', toInsert.length);

    if (toInsert.length > 0) {
        const { error } = await supabase.from('invoice_history').insert(toInsert);
        if (error) {
            console.log('Insert error:', error.message);
        } else {
            console.log('Successfully inserted', toInsert.length, 'history entries!');
        }
    }
}

backfillHistory();
