require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Script de Reconciliação Automática HubSpot <-> Braintree
 * 
 * Critérios de match:
 * 1. Order ID (Braintree order_id = HubSpot order_code) - 100% confiável
 * 2. Email + Valor (±€1 de tolerância) - Alta confiança
 * 
 * O script:
 * - Busca transações Braintree e invoices HubSpot
 * - Faz o match automático
 * - Atualiza ar_invoices com status reconciled e linked payment
 */

async function reconcile() {
    console.log('🔄 INICIANDO RECONCILIAÇÃO AUTOMÁTICA\n');
    console.log('='.repeat(50));

    // Buscar Braintree desde 01/12/2025
    let btAll = [];
    let offset = 0;
    while (true) {
        const { data } = await supabase
            .from('csv_rows')
            .select('*')
            .eq('source', 'braintree-api-revenue')
            .gte('date', '2025-12-01')
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        btAll = btAll.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }

    // Buscar invoices do ar_invoices (HubSpot)
    let invoices = [];
    offset = 0;
    while (true) {
        const { data } = await supabase
            .from('ar_invoices')
            .select('*')
            .eq('source', 'hubspot')
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        invoices = invoices.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }

    console.log(`📦 Braintree transações: ${btAll.length}`);
    console.log(`📋 AR Invoices (HubSpot): ${invoices.length}`);

    // Criar mapas de invoices
    const invoiceByOrderId = new Map();
    const invoiceByEmail = new Map();

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
    });

    // Fazer reconciliação
    const matches = [];
    let matchByOrderId = 0;
    let matchByEmailAmount = 0;

    for (const bt of btAll) {
        const cd = bt.custom_data || {};
        let matched = false;
        let invoice = null;
        let matchType = null;

        // 1. Match por order_id
        let orderId = cd.order_id;
        if (orderId) {
            // Extrair hash se for composto (ex: 4519a0d-5116552 -> 4519a0d)
            if (orderId.includes('-') && orderId.length > 8) {
                orderId = orderId.split('-')[0];
            }

            if (invoiceByOrderId.has(orderId.toLowerCase())) {
                invoice = invoiceByOrderId.get(orderId.toLowerCase());
                matchType = 'order_id';
                matchByOrderId++;
                matched = true;
            }
        }

        // 2. Match por email + valor
        if (!matched && bt.customer_email) {
            const email = bt.customer_email.toLowerCase();
            if (invoiceByEmail.has(email)) {
                const candidates = invoiceByEmail.get(email);
                // Buscar por valor aproximado (tolerância de €1)
                const amountMatch = candidates.find(inv =>
                    Math.abs(inv.total_amount - bt.amount) < 1
                );

                if (amountMatch) {
                    invoice = amountMatch;
                    matchType = 'email+amount';
                    matchByEmailAmount++;
                    matched = true;
                }
            }
        }

        if (matched && invoice) {
            matches.push({
                invoice_id: invoice.id,
                invoice_number: invoice.invoice_number,
                braintree_transaction_id: cd.transaction_id,
                braintree_amount: bt.amount,
                invoice_amount: invoice.total_amount,
                match_type: matchType,
                braintree_date: bt.date,
                order_id: orderId || null
            });
        }
    }

    console.log('\n=== RESULTADO DO MATCHING ===');
    console.log(`✅ Match por Order ID: ${matchByOrderId}`);
    console.log(`✅ Match por Email+Valor: ${matchByEmailAmount}`);
    console.log(`📊 Total matches: ${matches.length}`);

    // Calcular valor total
    const totalValue = matches.reduce((sum, m) => sum + m.braintree_amount, 0);
    console.log(`💰 Valor total: €${totalValue.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`);

    // Mostrar amostra
    console.log('\n=== AMOSTRA DE MATCHES ===');
    matches.slice(0, 5).forEach((m, i) => {
        console.log(`\n${i + 1}. [${m.match_type}] ${m.invoice_number}`);
        console.log(`   Braintree: €${m.braintree_amount} (${m.braintree_transaction_id})`);
        console.log(`   Invoice: €${m.invoice_amount} - Order: ${m.order_id || 'N/A'}`);
    });

    // Perguntar se quer aplicar
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
                    reconciled_with: `braintree:${match.braintree_transaction_id}`,
                    payment_reference: match.braintree_transaction_id,
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

    return matches;
}

reconcile().catch(console.error);
