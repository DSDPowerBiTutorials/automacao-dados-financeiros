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

async function getPaymentMethod(tx) {
    if (tx.paymentInstrumentType === 'credit_card' && tx.creditCard) {
        return `${tx.creditCard.cardType || 'Card'} ****${tx.creditCard.last4 || ''}`;
    }
    if (tx.paymentInstrumentType === 'paypal_account' && tx.paypalAccount) {
        return `PayPal (${tx.paypalAccount.payerEmail || ''})`;
    }
    return tx.paymentInstrumentType || 'Unknown';
}

async function resyncWithOrderId() {
    console.log('🔄 RESSINCRONIZANDO BRAINTREE COM ORDER ID...\n');
    
    // Buscar últimos 120 dias
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 120);
    
    return new Promise((resolve, reject) => {
        gateway.transaction.search(
            (search) => {
                search.createdAt().between(startDate, endDate);
            },
            async (err, response) => {
                if (err) {
                    console.error('Erro:', err);
                    resolve();
                    return;
                }
                
                const updates = [];
                let totalProcessed = 0;
                let withOrderId = 0;
                
                response.each((err, tx) => {
                    if (err) return;
                    
                    totalProcessed++;
                    
                    // Extrair Order ID
                    const orderId = tx.orderId || tx.customFields?.order_id || tx.customFields?.orderId || null;
                    
                    if (orderId) {
                        withOrderId++;
                    }
                    
                    // Dados para atualizar
                    const currency = tx.currencyIsoCode || 'EUR';
                    const id = `braintree-rev-${currency}-${tx.id}`;
                    const customerName = tx.customer ? 
                        `${tx.customer.firstName || ''} ${tx.customer.lastName || ''}`.trim() || 
                        tx.customer.email || 'Unknown' : 'Unknown';
                    
                    updates.push({
                        id,
                        customer_email: tx.customer?.email || tx.paypalAccount?.payerEmail || null,
                        customer_name: customerName,
                        custom_data: {
                            transaction_id: tx.id,
                            order_id: orderId, // 🔑 Order ID da API!
                            status: tx.status,
                            currency: currency,
                            customer_id: tx.customer?.id,
                            customer_name: customerName,
                            customer_email: tx.customer?.email || tx.paypalAccount?.payerEmail || null,
                            billing_name: tx.billing ? `${tx.billing.firstName || ''} ${tx.billing.lastName || ''}`.trim() : null,
                            company_name: tx.billing?.company || tx.customer?.company || null,
                            payment_method: getPaymentMethod(tx),
                            merchant_account_id: tx.merchantAccountId,
                            created_at: tx.createdAt ? new Date(tx.createdAt).toISOString() : null,
                        }
                    });
                    
                    return true;
                });
                
                // Aguardar e fazer updates
                setTimeout(async () => {
                    console.log(`\n📊 RESUMO DA BUSCA:`);
                    console.log(`  Total processado: ${totalProcessed}`);
                    console.log(`  Com Order ID: ${withOrderId}`);
                    console.log(`  Sem Order ID: ${totalProcessed - withOrderId}\n`);
                    
                    // Atualizar em batches
                    console.log('💾 Atualizando Supabase...');
                    let updated = 0;
                    let failed = 0;
                    
                    for (const row of updates) {
                        const { error } = await supabase
                            .from('csv_rows')
                            .update({
                                customer_email: row.customer_email,
                                customer_name: row.customer_name,
                                custom_data: row.custom_data
                            })
                            .eq('id', row.id);
                        
                        if (error) {
                            failed++;
                            if (failed <= 3) console.log(`  ❌ Erro ${row.id}:`, error.message);
                        } else {
                            updated++;
                        }
                    }
                    
                    console.log(`\n✅ RESULTADO:`);
                    console.log(`  Atualizados: ${updated}`);
                    console.log(`  Falhas: ${failed}`);
                    
                    // Mostrar exemplos com Order ID
                    const withId = updates.filter(u => u.custom_data.order_id);
                    console.log(`\n📋 EXEMPLOS COM ORDER ID:`);
                    withId.slice(0, 5).forEach(u => {
                        console.log(`  ${u.custom_data.transaction_id}: ${u.custom_data.order_id} (${u.custom_data.customer_name})`);
                    });
                    
                    resolve();
                }, 5000);
            }
        );
    });
}

resyncWithOrderId().then(() => process.exit(0));
