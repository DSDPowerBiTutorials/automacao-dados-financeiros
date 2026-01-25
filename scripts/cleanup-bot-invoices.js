// Limpar invoices criadas erroneamente pelo BOTella
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanup() {
    console.log('Deletando invoices BOT-SWIFT...');

    const { data: deleted, error: err1 } = await supabase
        .from('invoices')
        .delete()
        .ilike('invoice_number', 'BOT-SWIFT%')
        .select('id, invoice_number');

    if (err1) {
        console.log('Erro ao deletar:', err1.message);
    } else {
        console.log('Deletadas:', deleted?.length || 0, 'invoices');
        if (deleted) deleted.forEach(d => console.log('  -', d.invoice_number));
    }

    console.log('\nRevertendo reconciliação das transações Swift...');

    const { data: reverted, error: err2 } = await supabase
        .from('csv_rows')
        .update({ reconciled: false })
        .eq('source', 'bankinter-eur')
        .ilike('description', 'Comis.pago swift%')
        .select('id, description');

    if (err2) {
        console.log('Erro ao reverter:', err2.message);
    } else {
        console.log('Revertidas:', reverted?.length || 0, 'transações');
    }

    console.log('\nLimpeza concluída!');
}

cleanup().catch(console.error);
