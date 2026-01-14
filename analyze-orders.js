const braintree = require('braintree');
require('dotenv').config({ path: '.env.local' });

const gateway = new braintree.BraintreeGateway({
    environment: process.env.BRAINTREE_ENVIRONMENT === 'production' 
        ? braintree.Environment.Production 
        : braintree.Environment.Sandbox,
    merchantId: process.env.BRAINTREE_MERCHANT_ID,
    publicKey: process.env.BRAINTREE_PUBLIC_KEY,
    privateKey: process.env.BRAINTREE_PRIVATE_KEY,
});

async function checkBraintreeRaw() {
    console.log('🔍 BUSCANDO TRANSAÇÕES BRAINTREE COM ORDER ID...\n');
    
    // Buscar transações dos últimos 30 dias
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    return new Promise((resolve, reject) => {
        gateway.transaction.search(
            (search) => {
                search.createdAt().between(startDate, endDate);
            },
            (err, response) => {
                if (err) {
                    console.error('Erro:', err);
                    resolve();
                    return;
                }
                
                let count = 0;
                let withOrderId = 0;
                
                response.each((err, tx) => {
                    if (err) return;
                    if (count >= 20) return false; // Limitar a 20
                    
                    count++;
                    
                    // Verificar se tem orderId
                    if (tx.orderId) {
                        withOrderId++;
                        console.log('✅ Transação COM Order ID:');
                        console.log('   ID:', tx.id);
                        console.log('   Order ID:', tx.orderId);
                        console.log('   Customer:', tx.customer?.firstName, tx.customer?.lastName);
                        console.log('   Amount:', tx.amount, tx.currencyIsoCode);
                        console.log('   Custom Fields:', JSON.stringify(tx.customFields));
                        console.log('');
                    } else if (count <= 5) {
                        console.log('❌ Transação SEM Order ID:');
                        console.log('   ID:', tx.id);
                        console.log('   Customer:', tx.customer?.firstName, tx.customer?.lastName);
                        console.log('   Amount:', tx.amount, tx.currencyIsoCode);
                        console.log('');
                    }
                    
                    return true;
                });
                
                // Aguardar um pouco e mostrar resumo
                setTimeout(() => {
                    console.log('\n📊 RESUMO:');
                    console.log('  Transações analisadas:', count);
                    console.log('  Com Order ID:', withOrderId);
                    resolve();
                }, 3000);
            }
        );
    });
}

checkBraintreeRaw().then(() => process.exit(0));
