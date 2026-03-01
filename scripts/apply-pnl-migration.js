/**
 * Apply migration: product_pnl_mappings + payment_matched columns
 * Run: node scripts/apply-pnl-migration.js
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log('=== Applying P&L Popup Migration ===\n');

    // 1. Create product_pnl_mappings via insert test (table must exist on Supabase dashboard)
    // We'll use the Supabase REST API approach — create table via pg endpoint

    // Instead, let's use the management API to run SQL
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Try using the SQL endpoint
    const sqlStatements = [
        `CREATE TABLE IF NOT EXISTS product_pnl_mappings (
            id SERIAL PRIMARY KEY,
            product_name TEXT NOT NULL UNIQUE,
            pnl_line TEXT NOT NULL,
            pnl_label TEXT,
            learned_from_count INT DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_product_pnl_mappings_name ON product_pnl_mappings (product_name)`,
        `ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS payment_matched BOOLEAN DEFAULT FALSE`,
        `ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS payment_source TEXT`,
        `ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS payment_matched_at TIMESTAMPTZ`,
    ];

    // Execute via PostgREST RPC if available, otherwise use pg HTTP endpoint
    for (const sql of sqlStatements) {
        try {
            const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SERVICE_KEY,
                    'Authorization': `Bearer ${SERVICE_KEY}`,
                },
                body: JSON.stringify({ sql_text: sql }),
            });
            if (resp.ok) {
                console.log('✅ Executed:', sql.substring(0, 60) + '...');
            } else {
                const err = await resp.text();
                console.log('⚠️  RPC failed:', sql.substring(0, 40), '→', err.substring(0, 100));
            }
        } catch (e) {
            console.log('❌ Error:', e.message);
        }
    }

    // 2. Migrate auto-reconciled invoices
    console.log('\n--- Migrating auto-reconciled invoices ---');

    // Count how many to migrate
    const { data: autoRecon, error: countErr } = await sb
        .from('ar_invoices')
        .select('id, reconciled_with, reconciled_at', { count: 'exact' })
        .eq('reconciliation_type', 'automatic')
        .eq('reconciled', true)
        .limit(2000);

    if (countErr) {
        console.log('Error counting auto-reconciled:', countErr.message);
    } else {
        console.log(`Found ${autoRecon?.length || 0} auto-reconciled invoices to migrate`);

        if (autoRecon && autoRecon.length > 0) {
            let migrated = 0;
            for (const inv of autoRecon) {
                const { error: upErr } = await sb
                    .from('ar_invoices')
                    .update({
                        payment_matched: true,
                        payment_source: inv.reconciled_with,
                        payment_matched_at: inv.reconciled_at,
                        reconciled: false,
                        reconciled_at: null,
                        reconciled_with: null,
                    })
                    .eq('id', inv.id);
                if (!upErr) migrated++;
                else console.log(`  Error migrating ${inv.id}:`, upErr.message);
            }
            console.log(`✅ Migrated ${migrated}/${autoRecon.length} auto-reconciled → payment_matched`);
        }
    }

    // 3. Mark manual-bank reconciliations as also payment_matched
    const { data: manualBank } = await sb
        .from('ar_invoices')
        .select('id, reconciled_with, reconciled_at')
        .eq('reconciliation_type', 'manual-bank')
        .eq('reconciled', true)
        .limit(2000);

    if (manualBank && manualBank.length > 0) {
        let updated = 0;
        for (const inv of manualBank) {
            const { error: upErr } = await sb
                .from('ar_invoices')
                .update({
                    payment_matched: true,
                    payment_source: inv.reconciled_with,
                    payment_matched_at: inv.reconciled_at,
                })
                .eq('id', inv.id);
            if (!upErr) updated++;
        }
        console.log(`✅ Updated ${updated}/${manualBank.length} manual-bank → also payment_matched=true`);
    } else {
        console.log('No manual-bank reconciliations to update');
    }

    console.log('\n=== Migration complete ===');
}

run().catch(console.error);
