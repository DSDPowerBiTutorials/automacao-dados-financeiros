const sql = require('mssql');

const config = {
    server: 'datawarehouse-io-eur.database.windows.net',
    database: 'Jorge9660',
    user: 'Jorge6368',
    password: '***REMOVED***',
    options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 30000,
    },
};

async function testConnection() {
    let pool;
    try {
        console.log('🔌 Conectando ao SQL Server...');
        pool = await sql.connect(config);
        console.log('✅ Conectado com sucesso!\n');

        // Listar todas as tabelas
        console.log('📋 Listando todas as tabelas:');
        const tables = await pool.request().query(`
            SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `);

        console.log(`\n📊 Total de tabelas: ${tables.recordset.length}\n`);
        tables.recordset.forEach((t, i) => {
            console.log(`${i + 1}. ${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);
        });

        // Procurar tabelas relacionadas a deals/hubspot
        console.log('\n🔍 Procurando tabelas com "deal" ou "hubspot":');
        const dealTables = tables.recordset.filter(t =>
            t.TABLE_NAME.toLowerCase().includes('deal') ||
            t.TABLE_NAME.toLowerCase().includes('hubspot')
        );

        if (dealTables.length > 0) {
            console.log(`✅ Encontradas ${dealTables.length} tabelas:`);
            for (const table of dealTables) {
                const fullName = `${table.TABLE_SCHEMA}.${table.TABLE_NAME}`;
                console.log(`\n📁 Tabela: ${fullName}`);

                // Contar registros
                const count = await pool.request().query(`SELECT COUNT(*) as total FROM ${fullName}`);
                console.log(`   Registros: ${count.recordset[0].total}`);

                // Listar colunas
                const columns = await pool.request().query(`
                    SELECT COLUMN_NAME, DATA_TYPE
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = '${table.TABLE_SCHEMA}'
                    AND TABLE_NAME = '${table.TABLE_NAME}'
                    ORDER BY ORDINAL_POSITION
                `);
                console.log(`   Colunas (${columns.recordset.length}):`);
                columns.recordset.forEach(col => {
                    console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
                });

                // Mostrar amostra dos dados
                if (count.recordset[0].total > 0) {
                    const sample = await pool.request().query(`SELECT TOP 3 * FROM ${fullName}`);
                    console.log(`\n   📄 Amostra de dados (primeira linha):`);
                    console.log(JSON.stringify(sample.recordset[0], null, 2));
                }
            }
        } else {
            console.log('❌ Nenhuma tabela encontrada com "deal" ou "hubspot"');
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('Detalhes:', error);
    } finally {
        if (pool) {
            await pool.close();
            console.log('\n🔌 Conexão fechada');
        }
    }
}

testConnection();
