require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyze() {
    // Buscar Braintree desde 01/12/2025
    const { data: bt } = await supabase
        .from('csv_rows')
        .select('*')
        .eq('source', 'braintree-api-revenue')
        .gte('date', '2025-12-01')
        .lte('date', '2026-01-30');

    // Buscar HubSpot no mesmo período
    let hs = [];
    let offset = 0;
    while (true) {
        const { data } = await supabase
            .from('csv_rows')
            .select('*')
            .eq('source', 'hubspot')
            .gte('date', '2025-12-01')
            .lte('date', '2026-01-30')
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        hs = hs.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }

    console.log('=== PERÍODO: 01/12/2025 - 30/01/2026 ===');
    console.log('Braintree:', bt?.length);
    console.log('HubSpot:', hs.length);

    // Criar mapas
    const hsOrderMap = new Map();
    const hsEmailMap = new Map();

    hs.forEach(h => {
        const code = h.custom_data?.order_code?.toLowerCase();
        if (code) hsOrderMap.set(code, h);

        const email = h.custom_data?.customer_email?.toLowerCase();
        if (email) {
            if (!hsEmailMap.has(email)) hsEmailMap.set(email, []);
            hsEmailMap.get(email).push(h);
        }
    });

    // Match
    let matchOrderId = 0, matchEmail = 0, matchEmailAmount = 0, noMatch = 0;
    let totalMatched = 0;
    const matchedPairs = [];

    for (const b of bt || []) {
        const cd = b.custom_data || {};
        let matched = false;
        let hsMatch = null;
        let matchType = null;

        // 1. Order ID
        let orderId = cd.order_id;
        if (orderId) {
            if (orderId.includes('-') && orderId.length > 8) orderId = orderId.split('-')[0];
            if (hsOrderMap.has(orderId.toLowerCase())) {
                matchOrderId++;
                matched = true;
                matchType = 'order_id';
                hsMatch = hsOrderMap.get(orderId.toLowerCase());
                totalMatched += b.amount;
            }
        }

        // 2. Email + valor
        if (!matched && b.customer_email) {
            const email = b.customer_email.toLowerCase();
            if (hsEmailMap.has(email)) {
                matchEmail++;
                const amountMatch = hsEmailMap.get(email).find(h => Math.abs(h.amount - b.amount) < 1);
                if (amountMatch) {
                    matchEmailAmount++;
                    totalMatched += b.amount;
                    hsMatch = amountMatch;
                    matchType = 'email+amount';
                }
                matched = true;
            }
        }

        if (!matched) {
            noMatch++;
        } else if (hsMatch) {
            matchedPairs.push({ braintree: b, hubspot: hsMatch, matchType });
        }
    }

    const total = bt?.length || 0;
    console.log('\n=== RESULTADO ===');
    console.log('Match por Order ID:', matchOrderId, '(' + ((matchOrderId / total) * 100).toFixed(1) + '%)');
    console.log('Match por Email:', matchEmail, '(' + ((matchEmail / total) * 100).toFixed(1) + '%)');
    console.log('  - Com valor igual:', matchEmailAmount);
    console.log('Sem match:', noMatch, '(' + ((noMatch / total) * 100).toFixed(1) + '%)');
    console.log('\nTotal pares reconciliáveis:', matchedPairs.length);
    console.log('Valor reconciliável: €' + totalMatched.toLocaleString('de-DE', { minimumFractionDigits: 2 }));
}

analyze();
