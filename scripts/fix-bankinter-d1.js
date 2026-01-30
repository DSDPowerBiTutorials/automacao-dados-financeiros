#!/usr/bin/env node
/**
 * CORREÇÃO IMEDIATA: Adiciona +1 dia a todas as datas de bankinter-eur
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixDates() {
    console.log('🔧 Corrigindo datas Bankinter EUR (+1 dia)...\n');

    const { data: rows, error } = await supabase
        .from('csv_rows')
        .select('id, date')
        .eq('source', 'bankinter-eur');

    if (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }

    console.log('Total registros:', rows.length);
    let updated = 0;

    for (const row of rows) {
        const oldDate = new Date(row.date + 'T12:00:00Z');
        oldDate.setUTCDate(oldDate.getUTCDate() + 1);
        const newDate = oldDate.toISOString().split('T')[0];

        const { error: upErr } = await supabase
            .from('csv_rows')
            .update({ date: newDate })
            .eq('id', row.id);

        if (!upErr) {
            console.log(`✅ ${row.date} → ${newDate}`);
            updated++;
        } else {
            console.log(`❌ ${row.id}: ${upErr.message}`);
        }
    }

    console.log('\n=============================');
    console.log(`✅ Atualizados: ${updated}/${rows.length}`);
    console.log('=============================');
}

fixDates();
