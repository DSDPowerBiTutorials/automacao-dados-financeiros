const braintree = require('braintree');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const gateway = new braintree.BraintreeGateway({
    environment: process.env.BRAINTREE_ENVIRONMENT === 'production' 
        ? braintree.Environment.Production 
        : braintree.Environment.Sandbox,
    merchantId: process.env.BRAINTREE_MERCHANT_ID,
    publicKey: process.env.BRAINTREE_PUBLIC_KEY,
    privateKey: process.env.BRAINTREE_PRIVATE_KEY,
});

async function analyzeLinks() {
    console.log('🔍 ANÁLISE DE LINKS: WEB ORDERS vs PAGAMENTOS\n');
    console.log('Período: Dezembro 2025 até hoje\n');
    
    const startDate = new Date('2025-12-01');
    const endDate = new Date();
    
    // 1. BRAINTREE
    console.log('📊 BRAINTREE...');
    const btResults = await new Promise((resolve) => {
        const txs = [];
        gateway.transaction.search(
            (search) => search.createdAt().between(startDate, endDate),
            (err, response) => {
                if (err) { resolve({ total: 0, withOrderId: 0, txs: [] }); return; }
                response.each((err, tx) => {
                    if (err) return;
                    txs.push({
                        id: tx.id,
                        orderId: tx.orderId || null,
                        amount: parseFloat(tx.amount),
                        currency: tx.currencyIsoCode,
                        date: tx.createdAt,
                        customer: tx.customer?.email || tx.customer?.firstName
                    });
                    return true;
                });
                setTimeout(() => {
                    const withOrderId = txs.filter(t => t.orderId && /^[a-f0-9]{5,}/.test(t.orderId));
                    resolve({ total: txs.length, withOrderId: withOrderId.length, txs, linked: withOrderId });
                }, 10000);
            }
        );
    });
    
    console.log(`  Total transações: ${btResults.total}`);
    console.log(`  Com Order ID (web): ${btResults.withOrderId}`);
    console.log(`  Sem Order ID (manual/subscription): ${btResults.total - btResults.withOrderId}`);
    console.log(`  Taxa de link: ${Math.round(btResults.withOrderId / btResults.total * 100)}%\n`);
    
    // Valor total linkado vs não linkado
    const btLinkedValue = btResults.linked.reduce((sum, t) => sum + t.amount, 0);
    const btTotalValue = btResults.txs.reduce((sum, t) => sum + t.amount, 0);
    console.log(`  💰 Valor linkado: €${Math.round(btLinkedValue).toLocaleString()}`);
    console.log(`  💰 Valor total: €${Math.round(btTotalValue).toLocaleString()}\n`);
    
    // 2. GOCARDLESS (verificar no Supabase)
    console.log('📊 GOCARDLESS...');
    const { data: gcData } = await supabase
        .from('csv_rows')
        .select('*')
        .like('source', '%gocardless%')
        .gte('date', '2025-12-01');
    
    const gcTotal = gcData?.length || 0;
    const gcWithOrderId = gcData?.filter(r => 
        r.custom_data?.order_id && /^[a-f0-9]{5,}/.test(r.custom_data?.order_id)
    ).length || 0;
    
    console.log(`  Total transações: ${gcTotal}`);
    console.log(`  Com Order ID (web): ${gcWithOrderId}`);
    if (gcTotal > 0) {
        console.log(`  Taxa de link: ${Math.round(gcWithOrderId / gcTotal * 100)}%`);
    }
    console.log('');
    
    // 3. STRIPE (verificar no Supabase)
    console.log('📊 STRIPE...');
    const { data: stripeData } = await supabase
        .from('csv_rows')
        .select('*')
        .like('source', '%stripe%')
        .gte('date', '2025-12-01');
    
    const stripeTotal = stripeData?.length || 0;
    const stripeWithOrderId = stripeData?.filter(r => 
        r.custom_data?.order_id && /^[a-f0-9]{5,}/.test(r.custom_data?.order_id)
    ).length || 0;
    
    console.log(`  Total transações: ${stripeTotal}`);
    console.log(`  Com Order ID (web): ${stripeWithOrderId}`);
    if (stripeTotal > 0) {
        console.log(`  Taxa de link: ${Math.round(stripeWithOrderId / stripeTotal * 100)}%`);
    }
    console.log('');
    
    // RESUMO
    console.log('═══════════════════════════════════════════');
    console.log('📋 RESUMO (Dezembro 2025 - Hoje)');
    console.log('═══════════════════════════════════════════');
    
    const totalAll = btResults.total + gcTotal + stripeTotal;
    const linkedAll = btResults.withOrderId + gcWithOrderId + stripeWithOrderId;
    
    console.log(`\n| Gateway    | Total | Linkados | Taxa |`);
    console.log(`|------------|-------|----------|------|`);
    console.log(`| Braintree  | ${btResults.total.toString().padStart(5)} | ${btResults.withOrderId.toString().padStart(8)} | ${Math.round(btResults.withOrderId / btResults.total * 100)}%  |`);
    console.log(`| GoCardless | ${gcTotal.toString().padStart(5)} | ${gcWithOrderId.toString().padStart(8)} | ${gcTotal > 0 ? Math.round(gcWithOrderId / gcTotal * 100) : 0}%  |`);
    console.log(`| Stripe     | ${stripeTotal.toString().padStart(5)} | ${stripeWithOrderId.toString().padStart(8)} | ${stripeTotal > 0 ? Math.round(stripeWithOrderId / stripeTotal * 100) : 0}%  |`);
    console.log(`|------------|-------|----------|------|`);
    console.log(`| TOTAL      | ${totalAll.toString().padStart(5)} | ${linkedAll.toString().padStart(8)} | ${totalAll > 0 ? Math.round(linkedAll / totalAll * 100) : 0}%  |`);
    
    // Por mês
    console.log('\n📅 BRAINTREE POR MÊS:');
    const byMonth = {};
    btResults.txs.forEach(t => {
        const month = new Date(t.date).toISOString().substring(0, 7);
        if (!byMonth[month]) byMonth[month] = { total: 0, linked: 0, value: 0 };
        byMonth[month].total++;
        byMonth[month].value += t.amount;
        if (t.orderId && /^[a-f0-9]{5,}/.test(t.orderId)) byMonth[month].linked++;
    });
    
    Object.keys(byMonth).sort().forEach(month => {
        const m = byMonth[month];
        console.log(`  ${month}: ${m.linked}/${m.total} linkados (${Math.round(m.linked/m.total*100)}%) - €${Math.round(m.value).toLocaleString()}`);
    });
}

analyzeLinks().then(() => process.exit(0));
