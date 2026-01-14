require('dotenv').config({ path: '.env.local' });

console.log('🔍 VERIFICANDO CONFIGURAÇÃO STRIPE...\n');

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET;

if (stripeKey) {
    console.log('✅ STRIPE_SECRET_KEY configurada');
    console.log('   Tipo:', stripeKey.startsWith('sk_live') ? 'PRODUÇÃO' : 'TESTE');
    
    // Testar conexão
    const Stripe = require('stripe');
    const stripe = new Stripe(stripeKey);
    
    stripe.charges.list({ limit: 1 })
        .then(charges => {
            console.log('✅ Conexão OK - Stripe ativo');
            console.log('   Total charges disponíveis:', charges.has_more ? '100+' : charges.data.length);
        })
        .catch(err => {
            console.log('❌ Erro na conexão:', err.message);
        });
} else {
    console.log('❌ STRIPE_SECRET_KEY não configurada');
    console.log('\n📋 PARA CONFIGURAR:');
    console.log('   1. Acesse https://dashboard.stripe.com/apikeys');
    console.log('   2. Copie a "Secret key" (sk_live_... ou sk_test_...)');
    console.log('   3. Adicione ao .env.local:');
    console.log('      STRIPE_SECRET_KEY=sk_live_xxxx');
}

if (stripeWebhook) {
    console.log('\n✅ STRIPE_WEBHOOK_SECRET configurada');
} else {
    console.log('\n⚠️ STRIPE_WEBHOOK_SECRET não configurada (opcional)');
}
