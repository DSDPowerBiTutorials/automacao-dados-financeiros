const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function exportFluxoCaixa() {
    console.log('💰 EXPORTANDO FLUXO DE CAIXA...\n');
    
    // 1. Buscar transações Braintree
    console.log('📥 Buscando transações Braintree...');
    const { data: braintree, error: btError } = await supabase
        .from('csv_rows')
        .select('*')
        .like('source', 'braintree-api-revenue%')
        .order('date', { ascending: false })
        .limit(3000);
    
    if (btError) {
        console.error('Erro Braintree:', btError.message);
        return;
    }
    console.log(`  ✓ ${braintree.length} transações Braintree`);
    
    // 2. Buscar deals do HubSpot
    console.log('📥 Buscando deals HubSpot...');
    const { data: hubspot, error: hsError } = await supabase
        .from('csv_rows')
        .select('*')
        .eq('source', 'hubspot-deals')
        .limit(5000);
    
    if (hsError) {
        console.error('Erro HubSpot:', hsError.message);
    }
    console.log(`  ✓ ${hubspot?.length || 0} deals HubSpot`);
    
    // 3. Criar índice de HubSpot por Order ID
    const hubspotByOrderId = {};
    hubspot?.forEach(deal => {
        const orderId = deal.custom_data?.order_code || deal.custom_data?.order_id;
        if (orderId && /^[a-f0-9]{7}/.test(orderId)) {
            hubspotByOrderId[orderId] = deal;
        }
    });
    console.log(`  ✓ ${Object.keys(hubspotByOrderId).length} deals com Order ID válido`);
    
    // 4. Processar dados para fluxo de caixa
    const fluxoCaixa = braintree.map(tx => {
        const orderId = tx.custom_data?.order_id || '';
        const orderIdBase = orderId.split('-')[0]; // Pegar só o hex code base
        const hubspotDeal = hubspotByOrderId[orderIdBase] || hubspotByOrderId[orderId];
        
        // Datas importantes
        const dataTransacao = tx.date;
        const dataSettlement = tx.custom_data?.settlement_date?.split('T')[0] || '';
        const dataDisbursement = tx.custom_data?.disbursement_date?.split('T')[0] || '';
        
        return {
            // Datas
            'Data Transação': dataTransacao,
            'Data Settlement': dataSettlement,
            'Data Dinheiro Conta': dataDisbursement,
            
            // Identificação
            'Order ID': orderId,
            'Transaction ID': tx.custom_data?.transaction_id || '',
            
            // Cliente
            'Cliente': tx.customer_name || tx.custom_data?.customer_name || '',
            'Email': tx.customer_email || tx.custom_data?.customer_email || '',
            'Empresa': tx.custom_data?.company_name || hubspotDeal?.custom_data?.company_name || '',
            
            // Produto (do HubSpot)
            'Produto': hubspotDeal?.description || hubspotDeal?.custom_data?.dealname || '',
            'Pipeline': hubspotDeal?.custom_data?.pipeline || '',
            'Deal Stage': hubspotDeal?.custom_data?.dealstage || '',
            
            // Financeiro
            'Valor': tx.amount,
            'Moeda': tx.custom_data?.currency || 'EUR',
            'Método Pagamento': tx.custom_data?.payment_method || '',
            
            // Status
            'Status Braintree': tx.custom_data?.status || '',
            'Merchant Account': tx.custom_data?.merchant_account_id || '',
            'Settlement Batch': tx.custom_data?.settlement_batch_id || '',
            
            // Reconciliação
            'Reconciliado': tx.reconciled ? 'Sim' : 'Não',
            'Match HubSpot': hubspotDeal ? 'Sim' : 'Não'
        };
    });
    
    console.log(`\n📊 Processados: ${fluxoCaixa.length} registros`);
    
    // Estatísticas
    const comDisbursement = fluxoCaixa.filter(r => r['Data Dinheiro Conta']);
    const comSettlement = fluxoCaixa.filter(r => r['Data Settlement']);
    const comMatchHubspot = fluxoCaixa.filter(r => r['Match HubSpot'] === 'Sim');
    
    console.log(`  Com data disbursement: ${comDisbursement.length}`);
    console.log(`  Com data settlement: ${comSettlement.length}`);
    console.log(`  Com match HubSpot: ${comMatchHubspot.length}`);
    
    // 5. Criar resumo por mês
    const resumoPorMes = {};
    fluxoCaixa.forEach(tx => {
        const mes = tx['Data Dinheiro Conta']?.substring(0, 7) || tx['Data Transação']?.substring(0, 7) || 'Sem Data';
        const moeda = tx['Moeda'] || 'EUR';
        const key = `${mes}_${moeda}`;
        
        if (!resumoPorMes[key]) {
            resumoPorMes[key] = { mes, moeda, total: 0, qtd: 0 };
        }
        resumoPorMes[key].total += parseFloat(tx['Valor']) || 0;
        resumoPorMes[key].qtd += 1;
    });
    
    const resumoArray = Object.values(resumoPorMes)
        .sort((a, b) => b.mes.localeCompare(a.mes))
        .map(r => ({
            'Mês': r.mes,
            'Moeda': r.moeda,
            'Total': Math.round(r.total * 100) / 100,
            'Qtd Transações': r.qtd
        }));
    
    // 6. Criar workbook
    const wb = XLSX.utils.book_new();
    
    // Aba 1: Fluxo de Caixa Completo
    const ws1 = XLSX.utils.json_to_sheet(fluxoCaixa);
    XLSX.utils.book_append_sheet(wb, ws1, 'Fluxo de Caixa');
    
    // Aba 2: Resumo Mensal
    const ws2 = XLSX.utils.json_to_sheet(resumoArray);
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumo Mensal');
    
    // Aba 3: Com Match HubSpot (produtos identificados)
    const ws3 = XLSX.utils.json_to_sheet(fluxoCaixa.filter(r => r['Match HubSpot'] === 'Sim'));
    XLSX.utils.book_append_sheet(wb, ws3, 'Com Produto');
    
    // Aba 4: Pendentes de settlement
    const pendentes = fluxoCaixa.filter(r => !r['Data Dinheiro Conta'] && r['Status Braintree'] !== 'settled');
    const ws4 = XLSX.utils.json_to_sheet(pendentes.length > 0 ? pendentes : [{ Info: 'Nenhum pendente' }]);
    XLSX.utils.book_append_sheet(wb, ws4, 'Pendentes');
    
    // Salvar
    const filename = `fluxo-caixa-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    console.log(`\n✅ Arquivo salvo: ${filename}`);
    console.log('\n📋 ABAS:');
    console.log('  1. Fluxo de Caixa - Todas as transações com datas');
    console.log('  2. Resumo Mensal - Total por mês/moeda');
    console.log('  3. Com Produto - Transações com produto identificado');
    console.log('  4. Pendentes - Aguardando settlement');
}

exportFluxoCaixa();
