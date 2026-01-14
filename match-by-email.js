const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function matchByEmail() {
    console.log('🔍 ANÁLISE DE MATCH POR EMAIL\n');
    
    // 1. Buscar transações Braintree
    const { data: braintree } = await supabase
        .from('csv_rows')
        .select('*')
        .like('source', 'braintree-api-revenue%')
        .gte('date', '2025-12-01');
    
    console.log(`📊 Braintree: ${braintree?.length || 0} transações\n`);
    
    // Extrair emails únicos do Braintree
    const btEmails = new Map();
    braintree?.forEach(tx => {
        const email = (tx.customer_email || tx.custom_data?.customer_email || '').toLowerCase().trim();
        if (email && email.includes('@')) {
            if (!btEmails.has(email)) {
                btEmails.set(email, []);
            }
            btEmails.get(email).push({
                id: tx.custom_data?.transaction_id,
                date: tx.date,
                amount: tx.amount,
                orderId: tx.custom_data?.order_id,
                name: tx.customer_name
            });
        }
    });
    
    console.log(`📧 Emails únicos Braintree: ${btEmails.size}`);
    
    // 2. Buscar GoCardless
    const { data: gocardless } = await supabase
        .from('csv_rows')
        .select('*')
        .like('source', '%gocardless%')
        .gte('date', '2025-12-01');
    
    console.log(`📊 GoCardless: ${gocardless?.length || 0} transações\n`);
    
    // Extrair emails do GoCardless
    const gcEmails = new Map();
    gocardless?.forEach(tx => {
        const email = (tx.customer_email || tx.custom_data?.customer_email || '').toLowerCase().trim();
        const name = tx.customer_name || tx.description || '';
        if (email && email.includes('@')) {
            if (!gcEmails.has(email)) {
                gcEmails.set(email, []);
            }
            gcEmails.get(email).push({
                id: tx.custom_data?.payment_id,
                date: tx.date,
                amount: tx.amount,
                description: tx.description,
                name
            });
        }
    });
    
    console.log(`📧 Emails únicos GoCardless: ${gcEmails.size}`);
    
    // 3. Encontrar matches
    console.log('\n═══════════════════════════════════════════');
    console.log('📋 MATCHES POR EMAIL');
    console.log('═══════════════════════════════════════════\n');
    
    let matchCount = 0;
    const matches = [];
    
    for (const [email, gcTxs] of gcEmails) {
        if (btEmails.has(email)) {
            matchCount++;
            const btTxs = btEmails.get(email);
            matches.push({
                email,
                gcTransactions: gcTxs.length,
                btTransactions: btTxs.length,
                gcTotal: gcTxs.reduce((s, t) => s + parseFloat(t.amount || 0), 0),
                btTotal: btTxs.reduce((s, t) => s + parseFloat(t.amount || 0), 0),
                name: gcTxs[0]?.name || btTxs[0]?.name
            });
        }
    }
    
    if (matches.length > 0) {
        console.log('✅ CLIENTES COM PAGAMENTOS EM AMBOS:');
        matches.forEach((m, i) => {
            console.log(`\n${i+1}. ${m.email}`);
            console.log(`   Nome: ${m.name}`);
            console.log(`   GoCardless: ${m.gcTransactions} tx (€${m.gcTotal.toFixed(2)})`);
            console.log(`   Braintree: ${m.btTransactions} tx (€${m.btTotal.toFixed(2)})`);
        });
    }
    
    // 4. GoCardless sem match
    const gcNoMatch = [];
    for (const [email, txs] of gcEmails) {
        if (!btEmails.has(email)) {
            gcNoMatch.push({ email, txs });
        }
    }
    
    console.log('\n\n═══════════════════════════════════════════');
    console.log('⚠️ GOCARDLESS SEM MATCH NO BRAINTREE');
    console.log('═══════════════════════════════════════════\n');
    
    if (gcNoMatch.length > 0) {
        gcNoMatch.forEach((item, i) => {
            console.log(`${i+1}. ${item.email || '(sem email)'}`);
            item.txs.forEach(tx => {
                console.log(`   - ${tx.date}: €${tx.amount} - ${tx.description}`);
            });
        });
    } else {
        console.log('Todos os pagamentos GoCardless têm match por email!');
    }
    
    // Resumo
    console.log('\n\n═══════════════════════════════════════════');
    console.log('📊 RESUMO');
    console.log('═══════════════════════════════════════════');
    console.log(`\nGoCardless emails: ${gcEmails.size}`);
    console.log(`Braintree emails: ${btEmails.size}`);
    console.log(`Matches encontrados: ${matchCount}`);
    console.log(`Taxa de match: ${gcEmails.size > 0 ? Math.round(matchCount / gcEmails.size * 100) : 0}%`);
}

matchByEmail().then(() => process.exit(0));
