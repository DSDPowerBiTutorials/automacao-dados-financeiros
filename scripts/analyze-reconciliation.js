require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fullAnalysis() {
    console.log('=== ANÁLISE COMPLETA DE RECONCILIAÇÃO ===\n');

    // Buscar TODOS os Braintree
    let btAll = [];
    let offset = 0;
    while (true) {
        const { data } = await supabase
            .from('csv_rows')
            .select('*')
            .eq('source', 'braintree-api-revenue')
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        btAll = btAll.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }

    // Buscar TODOS os HubSpot
    let hsAll = [];
    offset = 0;
    while (true) {
        const { data } = await supabase
            .from('csv_rows')
            .select('*')
            .eq('source', 'hubspot')
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        hsAll = hsAll.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }

    console.log('Braintree transações:', btAll.length);
    console.log('HubSpot deals:', hsAll.length);

    // Criar mapa de HubSpot por order_code
    const hsMap = new Map();
    hsAll.forEach(h => {
        const code = h.custom_data?.order_code?.toLowerCase();
        if (code) hsMap.set(code, h);
    });

    // Criar mapa de HubSpot por email
    const hsEmailMap = new Map();
    hsAll.forEach(h => {
        const email = h.custom_data?.customer_email?.toLowerCase();
        if (email) {
            if (!hsEmailMap.has(email)) hsEmailMap.set(email, []);
            hsEmailMap.get(email).push(h);
        }
    });

    // Tentar match
    let matchByOrderId = 0;
    let matchByEmail = 0;
    let matchByEmailAmount = 0;
    let noMatch = 0;
    const matchedPairs = [];

    for (const bt of btAll) {
        const cd = bt.custom_data || {};
        let matched = false;
        let matchType = null;
        let hsMatch = null;

        // 1. Match por order_id (mais confiável)
        let orderId = cd.order_id;
        if (orderId) {
            // Extrair hash se for composto (ex: 4519a0d-5116552 -> 4519a0d)
            if (orderId.includes('-') && orderId.length > 8) {
                orderId = orderId.split('-')[0];
            }
            if (hsMap.has(orderId.toLowerCase())) {
                matchByOrderId++;
                matched = true;
                matchType = 'order_id';
                hsMatch = hsMap.get(orderId.toLowerCase());
            }
        }

        // 2. Match por email + valor aproximado
        if (!matched && bt.customer_email) {
            const email = bt.customer_email.toLowerCase();
            if (hsEmailMap.has(email)) {
                matchByEmail++;

                // Verificar se valor também bate (tolerância de 1 EUR)
                const hsMatches = hsEmailMap.get(email);
                const amountMatch = hsMatches.find(h => Math.abs(h.amount - bt.amount) < 1);
                if (amountMatch) {
                    matchByEmailAmount++;
                    hsMatch = amountMatch;
                    matchType = 'email+amount';
                } else {
                    matchType = 'email_only';
                }

                matched = true;
            }
        }

        if (!matched) {
            noMatch++;
        } else if (hsMatch && matchType !== 'email_only') {
            matchedPairs.push({
                braintree: {
                    id: bt.id,
                    amount: bt.amount,
                    date: bt.date,
                    email: bt.customer_email,
                    order_id: cd.order_id,
                    transaction_id: cd.transaction_id
                },
                hubspot: {
                    id: hsMatch.id,
                    amount: hsMatch.amount,
                    date: hsMatch.date,
                    email: hsMatch.custom_data?.customer_email,
                    order_code: hsMatch.custom_data?.order_code
                },
                matchType
            });
        }
    }

    console.log('\n=== RESULTADO DO MATCHING ===');
    console.log('Match por Order ID:', matchByOrderId, '(' + ((matchByOrderId / btAll.length) * 100).toFixed(1) + '%)');
    console.log('Match por Email:', matchByEmail, '(' + ((matchByEmail / btAll.length) * 100).toFixed(1) + '%)');
    console.log('  - Com valor igual:', matchByEmailAmount);
    console.log('Sem match:', noMatch, '(' + ((noMatch / btAll.length) * 100).toFixed(1) + '%)');
    console.log('\nTotal pares reconciliáveis:', matchedPairs.length);

    // Mostrar amostra de matches
    console.log('\n=== AMOSTRA DE MATCHES ===');
    matchedPairs.slice(0, 5).forEach((p, i) => {
        console.log(`\n${i + 1}. [${p.matchType}]`);
        console.log(`   BT: €${p.braintree.amount} em ${p.braintree.date} - ${p.braintree.order_id || p.braintree.email}`);
        console.log(`   HS: €${p.hubspot.amount} em ${p.hubspot.date?.substring(0, 10)} - ${p.hubspot.order_code}`);
    });

    // Calcular valor total reconciliável
    const totalReconcilable = matchedPairs.reduce((sum, p) => sum + p.braintree.amount, 0);
    console.log('\n=== VALOR TOTAL RECONCILIÁVEL ===');
    console.log('€' + totalReconcilable.toLocaleString('de-DE', { minimumFractionDigits: 2 }));

    return matchedPairs;
}

fullAnalysis();
