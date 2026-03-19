require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runSQL(sql) {
    // Use Supabase's pg_net extension or raw REST — try the /rest/v1/rpc endpoint
    // Since exec_sql doesn't exist, use the management API SQL endpoint
    const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

    // Try using the PostgREST SQL function if available
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ sql }),
    });

    if (res.ok) {
        console.log('✅ SQL executed successfully via exec_sql');
        return true;
    }

    console.log('exec_sql not available, status:', res.status);

    // Alternative: create the function first, then use it
    // Or use individual table operations
    return false;
}

async function createTableViaSupabase() {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // First, check if table already exists
    const { data: check, error: checkErr } = await sb
        .from('invoice_collaborators')
        .select('id')
        .limit(1);

    if (!checkErr) {
        console.log('✅ Table invoice_collaborators already exists!');
        return;
    }

    console.log('Table does not exist. Error:', checkErr.message);
    console.log('\n📋 Please run this SQL in the Supabase Dashboard SQL Editor:');
    console.log('   URL: https://supabase.com/dashboard/sql/new\n');

    const sql = `
CREATE TABLE IF NOT EXISTS invoice_collaborators (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    added_by UUID,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(invoice_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_collaborators_invoice 
    ON invoice_collaborators(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_collaborators_user 
    ON invoice_collaborators(user_id);

ALTER TABLE invoice_collaborators DISABLE ROW LEVEL SECURITY;
  `.trim();

    console.log(sql);
    console.log('\n---');

    // Try via fetch to the SQL endpoint (Supabase Management API)
    const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
    console.log('\nProject ref:', projectRef);

    // Alternative approach: try to create via pg extension
    const pgRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_invoice_collaborators_table`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({}),
    });
    console.log('Alternative RPC attempt status:', pgRes.status);
}

createTableViaSupabase();
