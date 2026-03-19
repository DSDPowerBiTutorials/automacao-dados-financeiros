require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SQL = `
CREATE TABLE IF NOT EXISTS invoice_collaborators (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    added_by UUID,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(invoice_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_invoice_collaborators_invoice ON invoice_collaborators(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_collaborators_user ON invoice_collaborators(user_id);
ALTER TABLE invoice_collaborators DISABLE ROW LEVEL SECURITY;
`;

async function main() {
    // Try Supabase pg endpoint (newer projects)
    console.log('Trying /pg endpoint...');
    const pgRes = await fetch(`${SUPABASE_URL}/pg`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ query: SQL }),
    });
    console.log('  Status:', pgRes.status);
    if (pgRes.ok) {
        const data = await pgRes.text();
        console.log('  Result:', data.substring(0, 200));
        return;
    }

    // Try sql endpoint
    console.log('\nTrying /sql endpoint...');
    const sqlRes = await fetch(`${SUPABASE_URL}/sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ query: SQL }),
    });
    console.log('  Status:', sqlRes.status);
    if (sqlRes.ok) {
        const data = await sqlRes.text();
        console.log('  Result:', data.substring(0, 200));
        return;
    }

    // Try pg/query endpoint
    console.log('\nTrying /pg/query endpoint...');
    const pgqRes = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ query: SQL }),
    });
    console.log('  Status:', pgqRes.status);
    if (pgqRes.ok) {
        const data = await pgqRes.text();
        console.log('  Result:', data.substring(0, 200));
        return;
    }

    // None worked - output SQL for manual execution
    console.log('\n❌ No programmatic SQL execution available.');
    console.log('\n📋 Run this SQL in the Supabase Dashboard > SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/rrzgawssbyfzbkmtcovz/sql/new\n');
    console.log(SQL);
}

main().catch(console.error);
