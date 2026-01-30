require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Script de Reconciliação Automática HubSpot <-> Braintree/Stripe/GoCardless
 * 
 * Critérios de match:
 * 1. Order ID (payment order_id = HubSpot order_code) - 100% confiável
 * 2. Email + Valor (±€1 de tolerância) - Alta confiança
 * 3. Valor + Data aproximada (±3 dias, ±€1) - GoCardless fallback
 * 
 * Sources processados:
 * - braintree-api-revenue (principal)
 * - stripe-eur (transações Stripe)
 * - gocardless (débito direto)
 */

async function fetchAllFromSource(source, minDate = '2025-12-01') {
    let all = [];
    let offset = 0;
    while (true) {
        const { data } = await supabase
            .from('csv_rows')
            .select('*')
            .eq('source', source)
            .gte('date', minDate)
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }
    return all;
}

async function reconcile() {
    console.log('🔄 INICIANDO RECONCILIAÇÃO AUTOMÁTICA MULTI-SOURCE\n');
    console.log('='.repeat(50));

    // Buscar transações de todos os gateways
    const [braintree, stripeEur, gocardless] = await Promise.all([
        fetchAllFromSource('braintree-api-revenue'),
        fetchAllFromSource('stripe-eur'),
        fetchAllFromSource('gocardless')
    ]);

    // Normalizar transações para formato comum
    const allPayments = [];

    // Braintree
    braintree.forEach(bt => {
        const cd = bt.custom_data || {};
        allPayments.push({
            source: 'braintree',
            transaction_id: cd.transaction_id || bt.id,
            date: bt.date,
            amount: bt.amount,
            email: bt.customer_email?.toLowerCase(),
            order_id: cd.order_id,
            raw: bt
        });
    });

    // Stripe
    stripeEur.forEach(st => {
        const cd = st.custom_data || {};
        allPayments.push({
            source: 'stripe',
            transaction_id: cd.payment_intent || cd.charge_id || st.id,
            date: st.date,
            amount: st.amount,
            email: cd.customer_email?.toLowerCase(),
            order_id: cd.order_id || cd.metadata?.order_id,
            raw: st
        });
    });

    // GoCardless
    gocardless.forEach(gc => {
        const cd = gc.custom_data || {};
        allPayments.push({
            source: 'gocardless',
            transaction_id: cd.payment_id || cd.gocardless_id || gc.id,
            date: gc.date,
            amount: gc.amount,
            email: cd.customer_email?.toLowerCase(),
            order_id: null, // GoCardless não tem order_id
            raw: gc
        });
    });

    // Buscar invoices do ar_invoices (HubSpot) - apenas não reconciliadas
    let invoices = [];
    let offset = 0;
    while (true) {
        const { data } = await supabase
            .from('ar_invoices')
            .select('*')
            .eq('source', 'hubspot')
            .or('reconciled.is.null,reconciled.eq.false')
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        invoices = invoices.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }

    console.log(`📦 Braintree: ${braintree.length} | Stripe: ${stripeEur.length} | GoCardless: ${gocardless.length}`);
    console.log(`📋 AR Invoices pendentes: ${invoices.length}`);

    // Criar mapas de invoices
    const invoiceByOrderId = new Map();
    const invoiceByEmail = new Map();
    const invoiceByAmountDate = new Map(); // Para GoCardless

    invoices.forEach(inv => {
        // Map por order_id (order_code do HubSpot)
        if (inv.order_id) {
            invoiceByOrderId.set(inv.order_id.toLowerCase(), inv);
        }

        // Map por email
        if (inv.email) {
            const email = inv.email.toLowerCase();
            if (!invoiceByEmail.has(email)) invoiceByEmail.set(email, []);
            invoiceByEmail.get(email).push(inv);
        }

        // Map por valor arredondado (para GoCardless)
        const amountKey = Math.round(inv.total_amount);
        if (!invoiceByAmountDate.has(amountKey)) invoiceByAmountDate.set(amountKey, []);
        invoiceByAmountDate.get(amountKey).push(inv);
    });

    // Fazer reconciliação
    const matches = [];
    const stats = { braintree: 0, stripe: 0, gocardless: 0 };
    const matchedInvoiceIds = new Set();

    for (const payment of allPayments) {
        let matched = false;
        let invoice = null;
        let matchType = null;

        // 1. Match por order_id
        let orderId = payment.order_id;
        if (orderId) {
            // Extrair hash se for composto (ex: 4519a0d-5116552 -> 4519a0d)
            if (orderId.includes('-') && orderId.length > 8) {
                orderId = orderId.split('-')[0];
            }

            const orderKey = orderId.toLowerCase();
            if (invoiceByOrderId.has(orderKey) && !matchedInvoiceIds.has(invoiceByOrderId.get(orderKey).id)) {
                invoice = invoiceByOrderId.get(orderKey);
                matchType = 'order_id';
                matched = true;
            }
        }

        // 2. Match por email + valor
        if (!matched && payment.email) {
            if (invoiceByEmail.has(payment.email)) {
                const candidates = invoiceByEmail.get(payment.email)
                    .filter(inv => !matchedInvoiceIds.has(inv.id));

                // Buscar por valor aproximado (tolerância de €1)
                const amountMatch = candidates.find(inv =>
                    Math.abs(inv.total_amount - payment.amount) < 1
                );

                if (amountMatch) {
                    invoice = amountMatch;
                    matchType = 'email+amount';
                    matched = true;
                }
            }
        }

        // 3. Match por valor + data aproximada (GoCardless fallback)
        if (!matched && payment.source === 'gocardless') {
            const amountKey = Math.round(payment.amount);
            if (invoiceByAmountDate.has(amountKey)) {
                const candidates = invoiceByAmountDate.get(amountKey)
                    .filter(inv => !matchedInvoiceIds.has(inv.id));

                const paymentDate = new Date(payment.date);

                // Buscar invoice com data próxima (±7 dias) e valor exato
                const dateMatch = candidates.find(inv => {
                    const invDate = new Date(inv.invoice_date || inv.order_date);
                    const daysDiff = Math.abs((paymentDate - invDate) / (1000 * 60 * 60 * 24));
                    return daysDiff <= 7 && Math.abs(inv.total_amount - payment.amount) < 1;
                });

                if (dateMatch) {
                    invoice = dateMatch;
                    matchType = 'amount+date';
                    matched = true;
                }
            }
        }

        if (matched && invoice) {
            matchedInvoiceIds.add(invoice.id);
            stats[payment.source]++;

            matches.push({
                invoice_id: invoice.id,
                invoice_number: invoice.invoice_number,
                payment_source: payment.source,
                transaction_id: payment.transaction_id,
                payment_amount: payment.amount,
                invoice_amount: invoice.total_amount,
                match_type: matchType,
                payment_date: payment.date,
                order_id: orderId || null
            });
        }
    }

    console.log('\n=== RESULTADO DO MATCHING ===');
    console.log(`✅ Braintree: ${stats.braintree}`);
    console.log(`✅ Stripe: ${stats.stripe}`);
    console.log(`✅ GoCardless: ${stats.gocardless}`);
    console.log(`📊 Total matches: ${matches.length}`);

    // Calcular valor total
    const totalValue = matches.reduce((sum, m) => sum + m.payment_amount, 0);
    console.log(`💰 Valor total: €${totalValue.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`);

    // Mostrar amostra
    console.log('\n=== AMOSTRA DE MATCHES ===');
    matches.slice(0, 5).forEach((m, i) => {
        console.log(`\n${i + 1}. [${m.payment_source}/${m.match_type}] ${m.invoice_number}`);
        console.log(`   Payment: €${m.payment_amount} (${m.transaction_id})`);
        console.log(`   Invoice: €${m.invoice_amount} - Order: ${m.order_id || 'N/A'}`);
    });

    // Aplicar se --apply
    if (process.argv.includes('--apply')) {
        console.log('\n🔄 APLICANDO RECONCILIAÇÃO...');

        let updated = 0;
        for (const match of matches) {
            const { error } = await supabase
                .from('ar_invoices')
                .update({
                    status: 'paid',
                    reconciled: true,
                    reconciled_at: new Date().toISOString(),
                    reconciled_with: `${match.payment_source}:${match.transaction_id}`,
                    payment_reference: match.transaction_id,
                })
                .eq('id', match.invoice_id);

            if (!error) {
                updated++;
            } else {
                console.error(`❌ Erro ao atualizar invoice ${match.invoice_id}:`, error.message);
            }
        }

        console.log(`\n✅ ${updated}/${matches.length} invoices atualizadas!`);
    } else {
        console.log('\n⚠️  Modo DRY-RUN. Para aplicar, execute:');
        console.log('   node scripts/auto-reconcile.js --apply');
    }

    return { matches, stats };
}

// Export para uso como módulo (API endpoint)
module.exports = { reconcile };

// Executar se chamado diretamente
if (require.main === module) {
    reconcile().catch(console.error);
}
