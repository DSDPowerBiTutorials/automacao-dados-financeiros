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
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

async function testDealsTable() {
    try {
        console.log('Conectando ao SQL Server...');
        const pool = await sql.connect(config);
        console.log('✓ Conectado!');

        // Teste 1: Buscar tabelas com "Deals" no nome
        console.log('\n=== TESTE 1: Buscar tabelas com "Deals" ===');
        const tables = await pool.request().query(`
            SELECT 
                TABLE_CATALOG,
                TABLE_SCHEMA, 
                TABLE_NAME,
                TABLE_TYPE
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME LIKE '%Deal%'
            ORDER BY TABLE_NAME
        `);

        console.log(`Encontradas ${tables.recordset.length} tabelas:`);
        tables.recordset.forEach(t => {
            console.log(`  ${t.TABLE_CATALOG}.${t.TABLE_SCHEMA}.${t.TABLE_NAME} (${t.TABLE_TYPE})`);
        });

        // Teste 2: Tentar diferentes variações do nome
        const variations = [
            'Deals',
            'dbo.Deals',
            '[dbo].[Deals]',
            '[Deals]',
            'Deal',
            'dbo.Deal',
            '[dbo].[Deal]'
        ];

        console.log('\n=== TESTE 2: Testar variações do nome ===');
        for (const tableName of variations) {
            try {
                const result = await pool.request().query(`SELECT TOP 1 * FROM ${tableName}`);
                console.log(`✓ ${tableName} - FUNCIONA! (${result.recordset.length} linha retornada)`);

                // Mostrar colunas
                if (result.recordset.length > 0) {
                    const columns = Object.keys(result.recordset[0]);
                    console.log(`  Colunas principais: ${columns.slice(0, 5).join(', ')}...`);
                }
            } catch (err) {
                console.log(`✗ ${tableName} - FALHA: ${err.message.split('\n')[0]}`);
            }
        }

        // Teste 3: Verificar database atual
        console.log('\n=== TESTE 3: Database atual ===');
        const dbInfo = await pool.request().query('SELECT DB_NAME() AS current_db');
        console.log(`Database atual: ${dbInfo.recordset[0].current_db}`);

        await pool.close();
        console.log('\n✓ Conexão fechada');

    } catch (error) {
        console.error('ERRO:', error.message);
        process.exit(1);
    }
}

testDealsTable();
