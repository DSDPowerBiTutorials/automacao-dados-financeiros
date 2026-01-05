/**
 * HubSpot SQL Server - Investigação de Tabelas
 * 
 * Este script conecta no SQL Server Azure do HubSpot e:
 * 1. Lista TODAS as tabelas disponíveis
 * 2. Procura especificamente: Invoices, Payments, Orders
 * 3. Mapeia as colunas de cada tabela encontrada
 * 4. Testa dados reais de Deals com relações
 * 5. Verifica campos de linkagem (order_number, invoice_number, transaction_id)
 */

const sql = require('mssql');

// Configuração de conexão
const config = {
    server: process.env.SQLSERVER_HOST || 'datawarehouse-io-eur.database.windows.net',
    database: process.env.SQLSERVER_DATABASE || 'Jorge9660',
    user: process.env.SQLSERVER_USER || 'Jorge6368',
    password: process.env.SQLSERVER_PASSWORD || '***REMOVED***',
    options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true,
        connectionTimeout: 30000,
        requestTimeout: 30000
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

async function investigateHubSpotTables() {
    let pool;

    try {
        console.log('\n🔍 INVESTIGAÇÃO HUBSPOT SQL SERVER');
        console.log('='.repeat(70));
        console.log(`📡 Conectando em: ${config.server}`);
        console.log(`📦 Database: ${config.database}`);
        console.log('='.repeat(70));

        // Conectar
        pool = await sql.connect(config);
        console.log('✅ Conexão estabelecida!\n');

        // ========================================================================
        // 1. LISTAR TODAS AS TABELAS
        // ========================================================================
        console.log('\n📋 PASSO 1: Listando TODAS as tabelas disponíveis...\n');

        const allTablesQuery = `
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;

        const allTablesResult = await pool.request().query(allTablesQuery);
        console.log(`📊 Total de tabelas encontradas: ${allTablesResult.recordset.length}\n`);

        // Salvar lista completa
        const allTablesList = allTablesResult.recordset.map(t => t.TABLE_NAME);
        console.log('Primeiras 50 tabelas:');
        allTablesList.slice(0, 50).forEach((name, i) => {
            console.log(`  ${(i + 1).toString().padStart(2, '0')}. ${name}`);
        });

        // ========================================================================
        // 2. PROCURAR TABELAS ESPECÍFICAS (Invoice, Payment, Order)
        // ========================================================================
        console.log('\n\n🔍 PASSO 2: Procurando tabelas de Invoice, Payment, Order...\n');

        const targetKeywords = ['Invoice', 'Payment', 'Order', 'Transaction', 'Bill'];
        const foundTables = {};

        targetKeywords.forEach(keyword => {
            const matches = allTablesList.filter(name =>
                name.toLowerCase().includes(keyword.toLowerCase())
            );

            if (matches.length > 0) {
                foundTables[keyword] = matches;
                console.log(`✅ ${keyword}: ${matches.length} tabela(s) encontrada(s)`);
                matches.forEach(match => console.log(`   └─ ${match}`));
            } else {
                console.log(`❌ ${keyword}: Nenhuma tabela encontrada`);
            }
        });

        // ========================================================================
        // 3. MAPEAR COLUNAS DAS TABELAS RELEVANTES
        // ========================================================================
        console.log('\n\n📊 PASSO 3: Mapeando colunas das tabelas relevantes...\n');

        const tablesToInspect = [
            ...Object.values(foundTables).flat(),
            'Deal',
            'Contact',
            'Company',
            'LineItem'
        ];

        const uniqueTables = [...new Set(tablesToInspect)];

        for (const tableName of uniqueTables.slice(0, 15)) { // Limitar a 15 tabelas para não sobrecarregar
            try {
                console.log(`\n🔹 Tabela: ${tableName}`);
                console.log('-'.repeat(70));

                const columnsQuery = `
          SELECT 
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH,
            IS_NULLABLE
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${tableName}'
          ORDER BY ORDINAL_POSITION
        `;

                const columnsResult = await pool.request().query(columnsQuery);
                const columns = columnsResult.recordset;

                console.log(`📋 Total de colunas: ${columns.length}`);

                // Filtrar colunas de interesse para linkagem
                const linkageColumns = columns.filter(col => {
                    const name = col.COLUMN_NAME.toLowerCase();
                    return (
                        name.includes('id') ||
                        name.includes('order') ||
                        name.includes('invoice') ||
                        name.includes('transaction') ||
                        name.includes('payment') ||
                        name.includes('reference') ||
                        name.includes('email') ||
                        name.includes('customer') ||
                        name.includes('amount') ||
                        name.includes('date')
                    );
                });

                if (linkageColumns.length > 0) {
                    console.log('\n🔑 Colunas relevantes para linkagem:');
                    linkageColumns.forEach(col => {
                        const nullable = col.IS_NULLABLE === 'YES' ? '(nullable)' : '(required)';
                        const maxLen = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
                        console.log(`   • ${col.COLUMN_NAME.padEnd(40)} ${col.DATA_TYPE}${maxLen} ${nullable}`);
                    });
                }

                // Mostrar primeiras 5 colunas de qualquer jeito
                console.log('\nPrimeiras colunas:');
                columns.slice(0, 5).forEach(col => {
                    console.log(`   • ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
                });

            } catch (err) {
                console.log(`⚠️  Erro ao acessar tabela ${tableName}: ${err.message}`);
            }
        }

        // ========================================================================
        // 4. TESTAR DADOS REAIS COM RELAÇÕES
        // ========================================================================
        console.log('\n\n🧪 PASSO 4: Testando dados reais de Deals...\n');

        const testQuery = `
      SELECT TOP 10
        d.DealId,
        d.dealname,
        d.amount,
        d.closedate,
        d.dealstage,
        d.ip__ecomm_bridge__order_number as ecomm_order_number,
        d.website_order_id,
        c.email as customer_email,
        c.firstname + ' ' + c.lastname as customer_name,
        co.name as company_name
      FROM Deal d
      LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
      LEFT JOIN Contact c ON c.VId = dca.VId
      LEFT JOIN DealCompanyAssociations dcoa ON d.DealId = dcoa.DealId
      LEFT JOIN Company co ON co.CompanyId = dcoa.CompanyId
      WHERE d.dealstage LIKE '%won%'
        AND d.closedate >= '2025-01-01'
      ORDER BY d.closedate DESC
    `;

        const testResult = await pool.request().query(testQuery);
        const deals = testResult.recordset;

        console.log(`📊 Deals encontrados: ${deals.length}\n`);

        deals.forEach((deal, i) => {
            console.log(`\n${i + 1}. Deal #${deal.DealId}`);
            console.log(`   Nome: ${deal.dealname}`);
            console.log(`   Valor: €${deal.amount || 0}`);
            console.log(`   Data: ${deal.closedate ? new Date(deal.closedate).toISOString().split('T')[0] : 'N/A'}`);
            console.log(`   Customer Email: ${deal.customer_email || '❌ Não encontrado'}`);
            console.log(`   Customer Name: ${deal.customer_name || '❌ Não encontrado'}`);
            console.log(`   Company: ${deal.company_name || '❌ Não encontrado'}`);
            console.log(`   🔑 Order Number: ${deal.ecomm_order_number || '❌ Não encontrado'}`);
            console.log(`   🔑 Website Order ID: ${deal.website_order_id || '❌ Não encontrado'}`);
        });

        // ========================================================================
        // 5. VERIFICAR ASSOCIAÇÕES (TABELAS DE PONTE)
        // ========================================================================
        console.log('\n\n🔗 PASSO 5: Verificando tabelas de associação...\n');

        const associationTables = allTablesList.filter(name =>
            name.toLowerCase().includes('association')
        );

        console.log(`📊 Total de tabelas de associação: ${associationTables.length}\n`);

        associationTables.slice(0, 20).forEach(table => {
            console.log(`   • ${table}`);
        });

        // ========================================================================
        // 6. ESTATÍSTICAS DE COBERTURA
        // ========================================================================
        console.log('\n\n📊 PASSO 6: Estatísticas de cobertura de dados...\n');

        const statsQuery = `
      SELECT 
        COUNT(*) as total_deals,
        COUNT(DISTINCT c.email) as deals_with_email,
        COUNT(DISTINCT d.ip__ecomm_bridge__order_number) as deals_with_order_number,
        COUNT(DISTINCT d.website_order_id) as deals_with_website_order_id
      FROM Deal d
      LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
      LEFT JOIN Contact c ON c.VId = dca.VId
      WHERE d.dealstage LIKE '%won%'
        AND d.closedate >= '2024-01-01'
    `;

        const statsResult = await pool.request().query(statsQuery);
        const stats = statsResult.recordset[0];

        console.log('📈 Estatísticas (deals ganhos desde 2024):');
        console.log(`   Total de deals: ${stats.total_deals}`);
        console.log(`   Com email: ${stats.deals_with_email} (${((stats.deals_with_email / stats.total_deals) * 100).toFixed(1)}%)`);
        console.log(`   Com order number: ${stats.deals_with_order_number} (${((stats.deals_with_order_number / stats.total_deals) * 100).toFixed(1)}%)`);
        console.log(`   Com website order ID: ${stats.deals_with_website_order_id} (${((stats.deals_with_website_order_id / stats.total_deals) * 100).toFixed(1)}%)`);

        // ========================================================================
        // RESUMO FINAL
        // ========================================================================
        console.log('\n\n' + '='.repeat(70));
        console.log('✅ INVESTIGAÇÃO CONCLUÍDA!');
        console.log('='.repeat(70));
        console.log('\n📋 RESUMO:');
        console.log(`   • Total de tabelas no banco: ${allTablesList.length}`);
        console.log(`   • Tabelas com "Invoice": ${foundTables.Invoice?.length || 0}`);
        console.log(`   • Tabelas com "Payment": ${foundTables.Payment?.length || 0}`);
        console.log(`   • Tabelas com "Order": ${foundTables.Order?.length || 0}`);
        console.log(`   • Tabelas de associação: ${associationTables.length}`);

        console.log('\n🔑 CAMPOS DE LINKAGEM ENCONTRADOS:');
        console.log('   ✅ Contact.email (para match com payment channels)');
        console.log('   ✅ Deal.amount + closedate (para match aproximado)');
        console.log(`   ${deals.some(d => d.ecomm_order_number) ? '✅' : '❌'} Deal.ip__ecomm_bridge__order_number`);
        console.log(`   ${deals.some(d => d.website_order_id) ? '✅' : '❌'} Deal.website_order_id`);

        console.log('\n💡 PRÓXIMOS PASSOS:');
        console.log('   1. Verificar se tabelas Invoice/Payment existem e mapear');
        console.log('   2. Testar match por email entre HubSpot e Braintree');
        console.log('   3. Criar query SQL enriquecida com todos os JOINs');
        console.log('   4. Implementar sincronização automática\n');

    } catch (err) {
        console.error('\n❌ ERRO:', err.message);
        console.error('Stack:', err.stack);
    } finally {
        if (pool) {
            await pool.close();
            console.log('\n🔌 Conexão fechada.');
        }
    }
}

// Executar
investigateHubSpotTables()
    .then(() => {
        console.log('\n✅ Script finalizado com sucesso!');
        process.exit(0);
    })
    .catch(err => {
        console.error('\n❌ Erro fatal:', err);
        process.exit(1);
    });
