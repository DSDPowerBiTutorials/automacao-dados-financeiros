const { createClient } = require('@supabase/supabase-js');
const sql = require('mssql');
const XLSX = require('xlsx');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sqlConfig = {
    user: 'Jorge6368',
    password: process.env.AZURE_SQL_PASSWORD || 'Xrt54@io0',
    server: 'datawarehouse-io-eur.database.windows.net',
    database: 'Jorge9660',
    options: { encrypt: true, trustServerCertificate: false }
};

async function exportFluxoCompleto() {
    console.log('💰 EXPORTANDO FLUXO DE CAIXA COMPLETO...\n');
    
    // 1. Buscar transações Braintree do Supabase
    console.log('📥 Buscando transações Braintree...');
    const { data: braintree } = await supabase
        .from('csv_rows')
        .select('*')
        .like('source', 'braintree-api-revenue%')
        .order('date', { ascending: false })
        .limit(5000);
    console.log(`  ✓ ${braintree?.length || 0} transações Braintree`);
    
    // 2. Buscar deals do HubSpot via Azure SQL
    console.log('📥 Conectando ao Azure SQL (HubSpot)...');
    let hubspotDeals = [];
    try {
        await sql.connect(sqlConfig);
        const result = await sql.query`
            SELECT 
                dealname,
                amount,
                closedate,
                dealstage,
                pipeline,
                ip__ecomm_bridge__order_number as order_id,
                ecommerce_deal,
                hs_deal_stage_probability,
                createdate
            FROM Deal 
            WHERE amount IS NOT NULL
            ORDER BY closedate DESC
        `;
        hubspotDeals = result.recordset;
        console.log(`  ✓ ${hubspotDeals.length} deals HubSpot`);
        await sql.close();
    } catch (err) {
        console.log(`  ⚠️ Erro SQL: ${err.message}`);
    }
    
    // 3. Criar índice de HubSpot por Order ID
    const hubspotByOrderId = {};
    hubspotDeals.forEach(deal => {
        if (deal.order_id && /^[a-f0-9]{5,}/.test(deal.order_id)) {
            hubspotByOrderId[deal.order_id] = deal;
        }
    });
    console.log(`  ✓ ${Object.keys(hubspotByOrderId).length} deals com Order ID válido`);
    
    // 4. Processar dados para fluxo de caixa
    const fluxoCaixa = (braintree || []).map(tx => {
        const orderId = tx.custom_data?.order_id || '';
        const orderIdBase = orderId.split('-')[0];
        const hubspotDeal = hubspotByOrderId[orderIdBase] || hubspotByOrderId[orderId];
        
        return {
            'Data Transação': tx.date,
            'Data Settlement': tx.custom_data?.settlement_date?.split('T')[0] || '',
            'Data Dinheiro Conta': tx.custom_data?.disbursement_date?.split('T')[0] || '',
            'Order ID': orderId,
            'Transaction ID': tx.custom_data?.transaction_id || '',
            'Cliente': tx.customer_name || tx.custom_data?.customer_name || '',
            'Email': tx.customer_email || '',
            'Produto/Deal': hubspotDeal?.dealname || '',
            'Valor Braintree': tx.amount,
            'Valor HubSpot': hubspotDeal?.amount || '',
            'Moeda': tx.custom_data?.currency || 'EUR',
            'Método Pagamento': tx.custom_data?.payment_method || '',
            'Status': tx.custom_data?.status || '',
            'Pipeline': hubspotDeal?.pipeline || '',
            'Deal Stage': hubspotDeal?.dealstage || '',
            'Match HubSpot': hubspotDeal ? 'Sim' : 'Não'
        };
    });
    
    // Estatísticas
    const matched = fluxoCaixa.filter(r => r['Match HubSpot'] === 'Sim');
    console.log(`\n📊 Estatísticas:`);
    console.log(`  Total transações: ${fluxoCaixa.length}`);
    console.log(`  Com match HubSpot: ${matched.length} (${Math.round(matched.length/fluxoCaixa.length*100)}%)`);
    
    // 5. Resumo mensal
    const resumoPorMes = {};
    fluxoCaixa.forEach(tx => {
        const mes = tx['Data Dinheiro Conta']?.substring(0, 7) || tx['Data Transação']?.substring(0, 7) || 'Sem Data';
        const moeda = tx['Moeda'] || 'EUR';
        const key = `${mes}_${moeda}`;
        if (!resumoPorMes[key]) resumoPorMes[key] = { mes, moeda, total: 0, qtd: 0 };
        resumoPorMes[key].total += parseFloat(tx['Valor Braintree']) || 0;
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
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fluxoCaixa), 'Fluxo de Caixa');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoArray), 'Resumo Mensal');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matched), 'Com Produto');
    
    // Aba com HubSpot deals
    const hubspotSheet = hubspotDeals.map(d => ({
        'Deal Name': d.dealname,
        'Order ID': d.order_id || '',
        'Valor': d.amount,
        'Close Date': d.closedate?.toISOString?.().split('T')[0] || '',
        'Pipeline': d.pipeline,
        'Stage': d.dealstage,
        'E-commerce': d.ecommerce_deal ? 'Sim' : 'Não'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hubspotSheet), 'HubSpot Deals');
    
    const filename = `fluxo-caixa-completo-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    console.log(`\n✅ Arquivo salvo: ${filename}`);
    console.log('\n📋 ABAS:');
    console.log('  1. Fluxo de Caixa - Braintree + datas de entrada');
    console.log('  2. Resumo Mensal - Total por mês/moeda');
    console.log('  3. Com Produto - Transações com produto identificado');
    console.log('  4. HubSpot Deals - Todos os deals do HubSpot');
}

exportFluxoCompleto().catch(console.error);
