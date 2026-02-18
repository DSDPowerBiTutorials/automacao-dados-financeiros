#!/usr/bin/env node
/**
 * Apply web_orders migration via Supabase exec_sql RPC
 * Requires SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!key) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY não definida no .env.local');
    console.error('Adicione: SUPABASE_SERVICE_ROLE_KEY=sb_secret_...');
    process.exit(1);
}

const sb = createClient(url, key);

async function run() {
    // Check if table already exists
    const { error: checkErr } = await sb.from('web_orders').select('id').limit(1);
    if (!checkErr) {
        console.log('✅ Tabela web_orders já existe! Nada a fazer.');
        return;
    }

    console.log('📦 Aplicando migração web_orders...');
    const sqlFile = path.join(__dirname, '..', 'supabase', 'migrations', '20260211_create_web_orders.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');

    // Split by statement (each ; ends a statement)
    const statements = sql
        .split(/;\s*$/m)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    let ok = 0;
    let errors = 0;

    for (const stmt of statements) {
        const label = stmt.substring(0, 60).replace(/\n/g, ' ') + '...';
        process.stdout.write(`  ${label} `);

        const { error } = await sb.rpc('exec_sql', { query: stmt + ';' });
        if (error) {
            if (error.message.includes('already exists')) {
                console.log('⏭️  (exists)');
                ok++;
            } else {
                console.log(`❌ ${error.message}`);
                errors++;
            }
        } else {
            console.log('✅');
            ok++;
        }
    }

    console.log(`\n📊 ${ok} OK, ${errors} errors`);

    // Verify
    const { error: verifyErr } = await sb.from('web_orders').select('id').limit(1);
    if (!verifyErr) {
        console.log('✅ Tabela web_orders criada com sucesso!');
    } else {
        console.log('❌ Tabela ainda não acessível:', verifyErr.message);
    }
}

run().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
