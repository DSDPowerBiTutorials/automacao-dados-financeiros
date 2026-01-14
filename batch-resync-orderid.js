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

function getPaymentMethod(tx) {
    if (tx.paymentInstrumentType === 'credit_card' && tx.creditCard) {
        return `${tx.creditCard.cardType || 'Card'} ****${tx.creditCard.last4 || ''}`;
    }
    if (tx.paymentInstrumentType === 'paypal_account' && tx.paypalAccount) {
        return `PayPal (${tx.paypalAccount.payerEmail || ''})`;
    }
    return tx.paymentInstrumentType || 'Unknown';
}

async function batchResync() {
    console.log('🚀 RESSINCRONIZAÇÃO EM BATCH - Order IDs\n');
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365); // 1 ano
    
    return new Promise((resolve) => {
        const allTx = [];
        
        gateway.transaction.search(
            (search) => search.createdAt().between(startDate, endDate),
            (err, response) => {
                if (err) { console.error('Erro:', err); resolve(); return; }
                
                response.each((err, tx) => {
                    if (err) return;
                    allTx.push(tx);
                    return true;
                });
                
                setTimeout(async () => {
                    console.log(`📥 Total transações: ${allTx.length}`);
                    const withOrderId = allTx.filter(tx => tx.orderId);
                    console.log(`🔑 Com Order ID: ${withOrderId.length}\n`);
                    
                    // Preparar batch de updates
                    const updates = [];
                    for (const tx of withOrderId) {
                        const currency = tx.currencyIsoCode || 'EUR';
                        updates.push({
                            id: `braintree-rev-${currency}-${tx.id}`,
                            orderId: tx.orderId,
                            paymentMethod: getPaymentMethod(tx)
                        });
                    }
                    
                    console.log('💾 Atualizando em paralelo...');
                    
                    // Processar em chunks de 20
                    const chunkSize = 20;
                    let updated = 0;
                    let notFound = 0;
                    
                    for (let i = 0; i < updates.length; i += chunkSize) {
                        const chunk = updates.slice(i, i + chunkSize);
                        
                        await Promise.all(chunk.map(async (item) => {
                            // Buscar registro atual
                            const { data: current } = await supabase
                                .from('csv_rows')
                                .select('custom_data')
                                .eq('id', item.id)
                                .single();
                            
                            if (current) {
                                const newCustomData = {
                                    ...current.custom_data,
                                    order_id: item.orderId,
                                    payment_method: item.paymentMethod
                                };
                                
                                const { error } = await supabase
                                    .from('csv_rows')
                                    .update({ custom_data: newCustomData })
                                    .eq('id', item.id);
                                
                                if (!error) updated++;
                            } else {
                                notFound++;
                            }
                        }));
                        
                        if ((i + chunkSize) % 100 === 0 || i + chunkSize >= updates.length) {
                            console.log(`  ✓ Processados: ${Math.min(i + chunkSize, updates.length)}/${updates.length}`);
                        }
                    }
                    
                    console.log(`\n✅ CONCLUÍDO:`);
                    console.log(`  Atualizados: ${updated}`);
                    console.log(`  Não encontrados: ${notFound}`);
                    
                    // Exemplos
                    console.log('\n📋 EXEMPLOS DE ORDER IDs:');
                    withOrderId.slice(0, 8).forEach(tx => {
                        console.log(`  ${tx.id}: ${tx.orderId}`);
                    });
                    
                    resolve();
                }, 15000); // 15s para coletar todas
            }
        );
    });
}

batchResync().then(() => process.exit(0));
