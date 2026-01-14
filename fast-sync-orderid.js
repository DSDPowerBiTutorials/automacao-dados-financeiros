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

async function fastSync() {
    console.log('🚀 SINCRONIZAÇÃO RÁPIDA - Buscando Order IDs...\n');
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 180); // 6 meses
    
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
                
                // Aguardar todas transações e depois processar
                setTimeout(async () => {
                    console.log(`📥 Total transações encontradas: ${allTx.length}`);
                    
                    const withOrderId = allTx.filter(tx => tx.orderId);
                    console.log(`🔑 Com Order ID: ${withOrderId.length}\n`);
                    
                    // Atualizar apenas as que têm Order ID
                    let updated = 0;
                    for (const tx of withOrderId) {
                        const currency = tx.currencyIsoCode || 'EUR';
                        const id = `braintree-rev-${currency}-${tx.id}`;
                        
                        // Atualizar custom_data adicionando order_id
                        const { error } = await supabase.rpc('update_order_id', {
                            row_id: id,
                            new_order_id: tx.orderId
                        }).maybeSingle();
                        
                        // Se RPC não existe, tentar update direto
                        if (error) {
                            // Buscar registro atual
                            const { data: current } = await supabase
                                .from('csv_rows')
                                .select('custom_data')
                                .eq('id', id)
                                .single();
                            
                            if (current) {
                                const newCustomData = {
                                    ...current.custom_data,
                                    order_id: tx.orderId,
                                    payment_method: getPaymentMethod(tx)
                                };
                                
                                const { error: updateErr } = await supabase
                                    .from('csv_rows')
                                    .update({ custom_data: newCustomData })
                                    .eq('id', id);
                                
                                if (!updateErr) updated++;
                            }
                        } else {
                            updated++;
                        }
                        
                        if (updated % 50 === 0 && updated > 0) {
                            console.log(`  ✓ ${updated} atualizados...`);
                        }
                    }
                    
                    console.log(`\n✅ Total atualizado: ${updated}`);
                    
                    // Mostrar exemplos
                    console.log('\n📋 EXEMPLOS DE ORDER IDs:');
                    withOrderId.slice(0, 10).forEach(tx => {
                        console.log(`  ${tx.id}: ${tx.orderId} (${tx.customer?.firstName} ${tx.customer?.lastName})`);
                    });
                    
                    resolve();
                }, 10000); // 10 segundos para coletar todas
            }
        );
    });
}

fastSync().then(() => process.exit(0));
