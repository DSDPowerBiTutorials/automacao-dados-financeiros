#!/usr/bin/env node

/**
 * Script para popular dados de teste do Braintree
 * Cria transações fake para testar a interface
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedBraintreeData() {
  console.log('🌱 Criando dados de teste do Braintree...\n');

  const testTransactions = [];
  const testFees = [];

  // Criar 50 transações de teste
  for (let i = 0; i < 50; i++) {
    const date = new Date('2024-06-01');
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const amount = (Math.random() * 900 + 100).toFixed(2); // €100-€1000
    const transactionId = `test_${Date.now()}_${i}`;
    const customerName = [
      'John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Williams',
      'Charlie Brown', 'Diana Prince', 'Edward Norton', 'Fiona Apple'
    ][i % 8];
    
    const paymentMethod = [
      'Visa ****1234', 'Mastercard ****5678', 'Amex ****9012',
      'PayPal (user@email.com)', 'Visa ****3456'
    ][i % 5];

    // Revenue
    testTransactions.push({
      id: `braintree-revenue-${Date.now()}-${i}`,
      file_name: 'braintree-api-test-data.csv',
      source: 'braintree-api-revenue',
      date: dateStr,
      description: `${customerName} - ${paymentMethod}`,
      amount: amount,
      reconciled: false,
      custom_data: {
        transaction_id: transactionId,
        status: 'settled',
        currency: 'EUR',
        customer_name: customerName,
        customer_email: `${customerName.toLowerCase().replace(' ', '.')}@example.com`,
        payment_method: paymentMethod,
        merchant_account_id: '***REMOVED***',
        conciliado: Math.random() > 0.5,
        destinationAccount: Math.random() > 0.5 ? 'Bankinter EUR' : null,
        reconciliationType: Math.random() > 0.5 ? 'automatic' : null
      }
    });

    // Fee
    const feeAmount = (parseFloat(amount) * 0.029 + 0.30).toFixed(2); // 2.9% + €0.30
    testFees.push({
      id: `braintree-fee-${Date.now()}-${i}`,
      file_name: 'braintree-api-test-data.csv',
      source: 'braintree-api-fees',
      date: dateStr,
      description: `Fee Braintree - ${transactionId}`,
      amount: `-${feeAmount}`,
      reconciled: false,
      custom_data: {
        transaction_id: transactionId,
        related_revenue_amount: amount,
        fee_type: 'service_fee',
        currency: 'EUR'
      }
    });
  }

  console.log(`📊 Criando ${testTransactions.length} receitas...`);
  const { data: revenueData, error: revenueError } = await supabase
    .from('csv_rows')
    .insert(testTransactions);

  if (revenueError) {
    console.error('❌ Erro ao criar receitas:', revenueError);
    return;
  }

  console.log(`💰 Criando ${testFees.length} fees...`);
  const { data: feeData, error: feeError } = await supabase
    .from('csv_rows')
    .insert(testFees);

  if (feeError) {
    console.error('❌ Erro ao criar fees:', feeError);
    return;
  }

  console.log('\n✅ Dados de teste criados com sucesso!');
  console.log(`   • ${testTransactions.length} receitas (braintree-api-revenue)`);
  console.log(`   • ${testFees.length} fees (braintree-api-fees)`);
  console.log(`   • Período: 01/06/2024 - ${testTransactions[testTransactions.length - 1].date}`);
  console.log('\n🌐 Acesse: http://localhost:3000/reports/braintree-eur');
}

seedBraintreeData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
