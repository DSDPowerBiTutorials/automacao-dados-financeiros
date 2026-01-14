/**
 * Gerador de Fluxo de Caixa com Produtos
 * Cruza pagamentos Braintree/GoCardless com produtos do HubSpot
 */

const sql = require('mssql');
const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sqlConfig = {
    user: process.env.SQLSERVER_USER,
    password: process.env.SQLSERVER_PASSWORD,
    server: process.env.SQLSERVER_HOST,
    database: process.env.SQLSERVER_DATABASE,
    options: { encrypt: true, trustServerCertificate: false }
};

async function generateCashFlow() {
    console.log('💰 GERANDO FLUXO DE CAIXA COM PRODUTOS\n');

    // 1. Conectar ao Azure SQL (HubSpot data)
    console.log('📊 Conectando ao Azure SQL (HubSpot)...');
    await sql.connect(sqlConfig);

    // 2. Buscar deals com order_number e line items
    console.log('📦 Buscando deals e produtos do HubSpot...');

    const dealsQuery = await sql.query`
    SELECT 
      d.DealId,
      d.dealname,
      d.amount,
      d.closedate,
      d.dealstage,
      d.ip__ecomm_bridge__order_number as order_number,
      d.website_order_id,
      d.hs_closed_won_date,
      d.contact_s_name as customer_name,
      d.pipeline
    FROM Deal d
    WHERE d.ip__ecomm_bridge__order_number IS NOT NULL
      OR d.website_order_id IS NOT NULL
    ORDER BY d.closedate DESC
  `;

    console.log(`   Encontrados ${dealsQuery.recordset.length} deals com Order ID`);

    // 3. Buscar line items (produtos) para cada deal
    const lineItemsQuery = await sql.query`
    SELECT 
      dla.DealId,
      li.LineItemId,
      li.name,
      li.amount,
      li.quantity,
      li.price,
      li.hs_sku,
      li.description
    FROM DealLineItemAssociations dla
    JOIN LineItem li ON dla.LineItemId = li.LineItemId
  `;

    // Agrupar line items por deal
    const lineItemsByDeal = {};
    for (const li of lineItemsQuery.recordset) {
        if (!lineItemsByDeal[li.DealId]) lineItemsByDeal[li.DealId] = [];
        lineItemsByDeal[li.DealId].push(li);
    }

    console.log(`   Encontrados ${lineItemsQuery.recordset.length} line items`);

    // 4. Buscar transações Braintree do Supabase (todas, paginado)
    console.log('💳 Buscando transações Braintree...');

    let braintreeTx = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('csv_rows')
            .select('*')
            .eq('source', 'braintree-api-revenue')
            .gte('date', '2024-01-01')
            .order('date', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        braintreeTx = braintreeTx.concat(data);
        page++;

        if (data.length < pageSize) break;
    }

    console.log(`   Encontradas ${braintreeTx.length} transações Braintree`);

    // Criar mapa de order_id para transações Braintree
    const braintreeByOrderId = {};
    for (const tx of braintreeTx) {
        const orderId = tx.custom_data?.order_id;
        if (orderId) {
            if (!braintreeByOrderId[orderId]) braintreeByOrderId[orderId] = [];
            braintreeByOrderId[orderId].push(tx);
        }
    }

    // 5. Cruzar dados
    console.log('\n🔗 Cruzando pagamentos com produtos...');

    const cashFlowRows = [];
    let matched = 0;
    let unmatched = 0;

    for (const deal of dealsQuery.recordset) {
        const orderId = deal.order_number || deal.website_order_id;
        const btTransactions = braintreeByOrderId[orderId] || [];
        const products = lineItemsByDeal[deal.DealId] || [];

        if (btTransactions.length > 0) {
            matched++;

            for (const tx of btTransactions) {
                const row = {
                    data_pagamento: tx.date,
                    transaction_id: tx.custom_data?.transaction_id,
                    order_id: orderId,
                    valor_pago: tx.amount,
                    currency: tx.custom_data?.currency || 'EUR',
                    payment_method: tx.custom_data?.payment_method,
                    status: tx.custom_data?.status,
                    customer_name: tx.custom_data?.customer_name || deal.customer_name,
                    customer_email: tx.custom_data?.customer_email,
                    billing_name: tx.custom_data?.billing_name,
                    deal_name: deal.dealname,
                    deal_amount: deal.amount,
                    deal_stage: deal.dealstage,
                    close_date: deal.closedate,
                    produtos: products.map(p => p.name).join('; '),
                    quantidade_produtos: products.length,
                    valor_produtos: products.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
                    produtos_detalhes: products.map(p => ({
                        nome: p.name,
                        quantidade: p.quantity,
                        preco: p.price,
                        valor: p.amount,
                        sku: p.hs_sku
                    })),
                    fonte: 'Braintree'
                };
                cashFlowRows.push(row);
            }
        } else {
            unmatched++;
        }
    }

    // 6. Adicionar transações Braintree sem deal
    const dealsOrderIds = new Set(
        dealsQuery.recordset.map(d => d.order_number || d.website_order_id).filter(Boolean)
    );

    for (const tx of braintreeTx) {
        const orderId = tx.custom_data?.order_id;
        if (!orderId || !dealsOrderIds.has(orderId)) {
            cashFlowRows.push({
                data_pagamento: tx.date,
                transaction_id: tx.custom_data?.transaction_id,
                order_id: orderId || 'N/A',
                valor_pago: tx.amount,
                currency: tx.custom_data?.currency || 'EUR',
                payment_method: tx.custom_data?.payment_method,
                status: tx.custom_data?.status,
                customer_name: tx.custom_data?.customer_name,
                customer_email: tx.custom_data?.customer_email,
                billing_name: tx.custom_data?.billing_name,
                deal_name: null,
                deal_amount: null,
                deal_stage: null,
                close_date: null,
                produtos: tx.description || 'Produto não identificado',
                quantidade_produtos: 0,
                valor_produtos: 0,
                produtos_detalhes: [],
                fonte: 'Braintree (sem deal HubSpot)'
            });
        }
    }

    console.log(`\n📊 RESULTADO:`);
    console.log(`   ✅ Deals com pagamento: ${matched}`);
    console.log(`   ⚠️ Deals sem pagamento: ${unmatched}`);
    console.log(`   📋 Total linhas fluxo de caixa: ${cashFlowRows.length}`);

    // 7. Gerar Excel
    console.log('\n📁 Gerando arquivo Excel...');

    const workbook = new ExcelJS.Workbook();

    // Aba 1: Fluxo de Caixa Completo
    const sheetMain = workbook.addWorksheet('Fluxo de Caixa');
    sheetMain.columns = [
        { header: 'Data Pagamento', key: 'data_pagamento', width: 12 },
        { header: 'Transaction ID', key: 'transaction_id', width: 15 },
        { header: 'Order ID', key: 'order_id', width: 12 },
        { header: 'Valor Pago', key: 'valor_pago', width: 12 },
        { header: 'Moeda', key: 'currency', width: 6 },
        { header: 'Método', key: 'payment_method', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Cliente', key: 'customer_name', width: 25 },
        { header: 'Email', key: 'customer_email', width: 30 },
        { header: 'Deal', key: 'deal_name', width: 40 },
        { header: 'Produtos', key: 'produtos', width: 50 },
        { header: 'Qtd Produtos', key: 'quantidade_produtos', width: 12 },
        { header: 'Valor Produtos', key: 'valor_produtos', width: 12 },
        { header: 'Fonte', key: 'fonte', width: 25 }
    ];

    sheetMain.getRow(1).font = { bold: true };
    sheetMain.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } };

    cashFlowRows.sort((a, b) => {
        const dateA = a.data_pagamento ? new Date(a.data_pagamento) : new Date(0);
        const dateB = b.data_pagamento ? new Date(b.data_pagamento) : new Date(0);
        return dateB - dateA;
    });

    for (const row of cashFlowRows) {
        sheetMain.addRow({
            data_pagamento: row.data_pagamento,
            transaction_id: row.transaction_id,
            order_id: row.order_id,
            valor_pago: row.valor_pago,
            currency: row.currency,
            payment_method: row.payment_method,
            status: row.status,
            customer_name: row.customer_name,
            customer_email: row.customer_email,
            deal_name: row.deal_name,
            produtos: row.produtos,
            quantidade_produtos: row.quantidade_produtos,
            valor_produtos: row.valor_produtos,
            fonte: row.fonte
        });
    }

    // Aba 2: Por Produto
    const sheetByProduct = workbook.addWorksheet('Por Produto');
    sheetByProduct.columns = [
        { header: 'Produto', key: 'produto', width: 40 },
        { header: 'Quantidade Vendida', key: 'quantidade', width: 15 },
        { header: 'Receita Total', key: 'receita', width: 15 },
        { header: 'Ticket Médio', key: 'ticket_medio', width: 12 },
        { header: 'Nº Transações', key: 'transacoes', width: 12 }
    ];

    const byProduct = {};
    for (const row of cashFlowRows) {
        for (const prod of (row.produtos_detalhes || [])) {
            if (!byProduct[prod.nome]) {
                byProduct[prod.nome] = { quantidade: 0, receita: 0, transacoes: 0 };
            }
            byProduct[prod.nome].quantidade += parseInt(prod.quantidade) || 1;
            byProduct[prod.nome].receita += parseFloat(prod.valor) || 0;
            byProduct[prod.nome].transacoes++;
        }
    }

    sheetByProduct.getRow(1).font = { bold: true };
    sheetByProduct.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2196F3' } };

    Object.entries(byProduct)
        .sort((a, b) => b[1].receita - a[1].receita)
        .forEach(([produto, stats]) => {
            sheetByProduct.addRow({
                produto,
                quantidade: stats.quantidade,
                receita: stats.receita,
                ticket_medio: stats.transacoes > 0 ? stats.receita / stats.transacoes : 0,
                transacoes: stats.transacoes
            });
        });

    // Aba 3: Por Mês
    const sheetByMonth = workbook.addWorksheet('Por Mês');
    sheetByMonth.columns = [
        { header: 'Mês', key: 'mes', width: 12 },
        { header: 'Receita', key: 'receita', width: 15 },
        { header: 'Nº Transações', key: 'transacoes', width: 12 },
        { header: 'Ticket Médio', key: 'ticket_medio', width: 12 }
    ];

    const byMonth = {};
    for (const row of cashFlowRows) {
        if (!row.data_pagamento) continue;
        const dateStr = row.data_pagamento instanceof Date
            ? row.data_pagamento.toISOString().substring(0, 7)
            : String(row.data_pagamento).substring(0, 7);
        if (!byMonth[dateStr]) {
            byMonth[dateStr] = { receita: 0, transacoes: 0 };
        }
        const valor = parseFloat(row.valor_pago) || 0;
        byMonth[dateStr].receita += valor;
        byMonth[dateStr].transacoes++;
    }

    sheetByMonth.getRow(1).font = { bold: true };
    sheetByMonth.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF9800' } };

    Object.entries(byMonth)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .forEach(([mes, stats]) => {
            sheetByMonth.addRow({
                mes,
                receita: stats.receita,
                transacoes: stats.transacoes,
                ticket_medio: stats.transacoes > 0 ? stats.receita / stats.transacoes : 0
            });
        });

    // Salvar arquivo
    const filename = `fluxo-caixa-produtos-${new Date().toISOString().split('T')[0]}.xlsx`;
    await workbook.xlsx.writeFile(filename);

    console.log(`\n✅ Arquivo gerado: ${filename}`);

    // Resumo
    const totalReceita = cashFlowRows.reduce((sum, r) => sum + (parseFloat(r.valor_pago) || 0), 0);
    console.log(`\n💰 RESUMO FLUXO DE CAIXA:`);
    console.log(`   Total Receitas: €${totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Produtos únicos: ${Object.keys(byProduct).length}`);
    console.log(`   Meses cobertos: ${Object.keys(byMonth).length}`);

    await sql.close();
}

generateCashFlow().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
