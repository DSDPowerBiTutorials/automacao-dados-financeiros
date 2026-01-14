const { createClient } = require('@supabase/supabase-js');
const gocardless = require('gocardless-nodejs');
const constants = require('gocardless-nodejs/constants');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function analyze() {
    // 1. Buscar emails Braintree
    const { data: braintree } = await supabase
        .from('csv_rows')
        .select('*')
        .eq('source', 'braintree-api-revenue');

    const braintreeEmails = new Set();
    const braintreeByEmail = {};

    for (const tx of braintree || []) {
        const email = tx.custom_data?.customer_email?.toLowerCase();
        if (email) {
            braintreeEmails.add(email);
            if (!braintreeByEmail[email]) braintreeByEmail[email] = [];
            braintreeByEmail[email].push(tx);
        }
    }

    // 2. Buscar emails GoCardless
    const gc = gocardless(process.env.GOCARDLESS_ACCESS_TOKEN, constants.Environments.Live);
    const [payments, mandates, customers] = await Promise.all([
        gc.payments.list({ limit: 500 }),
        gc.mandates.list({ limit: 100 }),
        gc.customers.list({ limit: 100 })
    ]);

    const mandateToCustomer = {};
    (mandates.mandates || []).forEach(m => mandateToCustomer[m.id] = m.links?.customer);

    const customerData = {};
    (customers.customers || []).forEach(c => {
        customerData[c.id] = {
            email: c.email?.toLowerCase(),
            name: [c.given_name, c.family_name].filter(Boolean).join(' ') || c.company_name
        };
    });

    // 3. Agrupar GoCardless por email
    const gcByEmail = {};
    for (const p of payments.payments || []) {
        const customerId = mandateToCustomer[p.links?.mandate];
        const customer = customerData[customerId];
        const email = customer?.email;
        if (email) {
            if (!gcByEmail[email]) gcByEmail[email] = { name: customer.name, payments: [] };
            gcByEmail[email].payments.push({
                amount: p.amount / 100,
                currency: p.currency,
                description: p.description,
                date: p.charge_date
            });
        }
    }

    // 4. Encontrar matches
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 ANÁLISE DE MATCH POR EMAIL: GoCardless vs Braintree');
    console.log('═══════════════════════════════════════════════════════════════');

    const gcEmails = Object.keys(gcByEmail);
    console.log('\n📧 GoCardless: ' + gcEmails.length + ' clientes únicos');
    console.log('📧 Braintree: ' + braintreeEmails.size + ' emails únicos');

    let matchCount = 0;
    let noMatchCount = 0;

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ CLIENTES COM PAGAMENTOS EM AMBOS:');
    console.log('═══════════════════════════════════════════════════════════════');

    for (const email of gcEmails) {
        if (braintreeEmails.has(email)) {
            matchCount++;
            const gcData = gcByEmail[email];
            const bt = braintreeByEmail[email];
            const gcTotal = gcData.payments.reduce((s, p) => s + p.amount, 0);
            const btTotal = bt.reduce((s, tx) => s + Math.abs(tx.amount || 0), 0);

            console.log('\n👤 ' + gcData.name + ' <' + email + '>');
            console.log('   GoCardless: ' + gcData.payments.length + ' pagamentos = €' + gcTotal.toFixed(2));
            console.log('   Braintree:  ' + bt.length + ' transações = €' + btTotal.toFixed(2));
        }
    }

    if (matchCount === 0) {
        console.log('\n   (nenhum match encontrado)');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('❌ CLIENTES GOCARDLESS SEM PAGAMENTOS BRAINTREE:');
    console.log('═══════════════════════════════════════════════════════════════');

    for (const email of gcEmails) {
        if (!braintreeEmails.has(email)) {
            noMatchCount++;
            const gcData = gcByEmail[email];
            const total = gcData.payments.reduce((s, p) => s + p.amount, 0);
            console.log('  • ' + gcData.name + ' <' + email + '> - €' + total.toFixed(2) + ' (' + gcData.payments.length + ' pagamentos)');
        }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📈 RESUMO');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ Clientes com ambos: ' + matchCount + ' (' + (matchCount / gcEmails.length * 100).toFixed(0) + '%)');
    console.log('❌ Só GoCardless: ' + noMatchCount + ' (' + (noMatchCount / gcEmails.length * 100).toFixed(0) + '%)');
}

analyze().catch(console.error);
