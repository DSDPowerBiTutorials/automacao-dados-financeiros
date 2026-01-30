/**
 * BACKFILL TRANSACTION IDS v4
 * 
 * Usa a tabela braintree-api-disbursement para fazer match
 * com as transações bancárias pelo disbursement_id
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfill() {
  console.log('🔄 BACKFILL TRANSACTION IDS v4');
  console.log('Estratégia: Usar tabela braintree-api-disbursement');
  console.log('=' .repeat(60));
  
  // 1. Buscar disbursements Braintree
  console.log('\n📥 Carregando disbursements...');
  const { data: disbursements } = await supabase
    .from('csv_rows')
    .select('id, date, amount, custom_data')
    .eq('source', 'braintree-api-disbursement')
    .order('date', { ascending: false });
  
  console.log(`   ${disbursements.length} disbursements encontrados`);
  
  // Criar map por disbursement_id
  const disbursementMap = new Map();
  disbursements.forEach(d => {
    const cd = d.custom_data || {};
    const disbId = cd.disbursement_id || cd.id;
    if (disbId) {
      disbursementMap.set(disbId, {
        date: d.date,
        amount: d.amount,
        transaction_ids: cd.transaction_ids || [],
        settlement_batch_id: cd.settlement_batch_id
      });
    }
  });
  
  console.log(`   ${disbursementMap.size} mapeados por ID`);
  
  // 2. Buscar transações bancárias reconciliadas sem transaction_ids
  console.log('\n📥 Buscando transações bancárias...');
  const { data: bankRows } = await supabase
    .from('csv_rows')
    .select('id, source, date, amount, description, custom_data')
    .in('source', ['bankinter-eur', 'bankinter-usd'])
    .eq('reconciled', true)
    .gt('amount', 0)
    .order('date', { ascending: false });
  
  const needsBackfill = bankRows.filter(row => {
    const cd = row.custom_data || {};
    return !cd.transaction_ids || cd.transaction_ids.length === 0;
  });
  
  console.log(`   Total reconciliadas: ${bankRows.length}`);
  console.log(`   Precisam de backfill: ${needsBackfill.length}\n`);
  
  if (needsBackfill.length === 0) {
    console.log('✅ Todas já têm transaction_ids!');
    return;
  }
  
  // 3. Para cada transação bancária, buscar pelo disbursement_id
  console.log('🔄 Processando backfill...\n');
  
  let updated = 0;
  let skipped = 0;
  
  for (const bankRow of needsBackfill) {
    const cd = bankRow.custom_data || {};
    const disbursementId = cd.disbursement_id;
    
    if (!disbursementId) {
      console.log(`⏭️  ${bankRow.date} | €${bankRow.amount} | Sem disbursement_id`);
      skipped++;
      continue;
    }
    
    const disbInfo = disbursementMap.get(disbursementId);
    
    if (!disbInfo) {
      console.log(`⏭️  ${bankRow.date} | €${bankRow.amount} | disbursement_id ${disbursementId} não encontrado`);
      skipped++;
      continue;
    }
    
    // Verificar se o disbursement tem transaction_ids
    let transactionIds = disbInfo.transaction_ids;
    
    // Se transaction_ids é um número (count), precisa buscar as transações
    if (typeof transactionIds === 'number' || !Array.isArray(transactionIds)) {
      // Buscar transações Braintree com esse disbursement_id
      const { data: txs } = await supabase
        .from('csv_rows')
        .select('id, custom_data')
        .eq('source', 'braintree-api-revenue')
        .order('date', { ascending: false })
        .limit(500);
      
      // Infelizmente braintree-api-revenue não tem disbursement_id
      // Vamos tentar buscar por data similar
      transactionIds = [];
    }
    
    if (transactionIds.length > 0) {
      const newCustomData = {
        ...cd,
        paymentSource: 'braintree',
        transaction_ids: transactionIds,
        settlement_batch_id: disbInfo.settlement_batch_id,
        braintree_transaction_count: transactionIds.length,
        backfilled_at: new Date().toISOString()
      };
      
      const { error: updateError } = await supabase
        .from('csv_rows')
        .update({ custom_data: newCustomData })
        .eq('id', bankRow.id);
      
      if (updateError) {
        console.log(`❌ ${bankRow.date} | €${bankRow.amount} | Erro: ${updateError.message}`);
      } else {
        console.log(`✅ ${bankRow.date} | €${bankRow.amount} → ${transactionIds.length} txs`);
        updated++;
      }
    } else {
      console.log(`⏭️  ${bankRow.date} | €${bankRow.amount} | disbursement ${disbursementId} sem transaction_ids`);
      skipped++;
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESUMO:');
  console.log(`   ✅ Atualizados: ${updated}`);
  console.log(`   ⏭️  Ignorados: ${skipped}`);
  console.log('=' .repeat(60));
}

backfill().catch(console.error);
