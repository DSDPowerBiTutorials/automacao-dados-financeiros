#!/usr/bin/env node

/**
 * Script para listar todas as colunas disponíveis na tabela Deals do HubSpot
 * Executar: node scripts/list-hubspot-columns.js
 */

require('dotenv').config({ path: '.env.local' });
const sql = require('mssql');

async function listAllColumns() {
    const config = {
        server: process.env.SQLSERVER_HOST,
        database: process.env.SQLSERVER_DATABASE,
        user: process.env.SQLSERVER_USER,
        password: process.env.SQLSERVER_PASSWORD,
        options: {
            encrypt: true,
            trustServerCertificate: true,
        },
    };

    const pool = new sql.ConnectionPool(config);

    try {
        await pool.connect();
        console.log('✓ Conectado ao SQL Server');
        console.log(`Database: ${config.database}\n`);

        // Buscar schema da tabela Deal
        const result = await pool
            .request()
            .query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Deal'
        ORDER BY ORDINAL_POSITION
      `);

        const columns = result.recordset;

        console.log(`\n📊 TOTAL DE COLUNAS DISPONÍVEIS: ${columns.length}\n`);
        console.log('═════════════════════════════════════════════════════════════\n');

        // Agrupar por tipo
        const grouped = {};
        columns.forEach(col => {
            if (!grouped[col.DATA_TYPE]) {
                grouped[col.DATA_TYPE] = [];
            }
            grouped[col.DATA_TYPE].push(col);
        });

        // Exibir todas as colunas
        columns.forEach((col, index) => {
            const nullable = col.IS_NULLABLE === 'YES' ? '(nullable)' : '(required)';
            console.log(`${String(index + 1).padStart(3, '0')}. ${col.COLUMN_NAME.padEnd(60)} [${col.DATA_TYPE}] ${nullable}`);
        });

        console.log('\n═════════════════════════════════════════════════════════════\n');
        console.log('📋 RESUMO POR TIPO DE DADO:\n');

        Object.entries(grouped).forEach(([type, cols]) => {
            console.log(`${type}: ${cols.length} coluna(s)`);
            cols.slice(0, 5).forEach(col => {
                console.log(`   • ${col.COLUMN_NAME}`);
            });
            if (cols.length > 5) {
                console.log(`   ... e mais ${cols.length - 5}`);
            }
            console.log();
        });

        // Colunas mais importantes para reconciliação
        console.log('\n═════════════════════════════════════════════════════════════\n');
        console.log('🎯 COLUNAS RECOMENDADAS PARA RECONCILIAÇÃO:\n');

        const keyColumns = [
            'DealId',
            'dealname',
            'closedate',
            'createdate',
            'amount',
            'amount_in_home_currency',
            'dealstage',
            'deal_pipeline',
            'deal_currency_code',
            'hubspot_owner_id',
            'hs_primary_associated_company',
            'hs_closed_won_date',
            'hs_closed_deal_close_date',
            'hs_lastmodifieddate',
            'contact_s_name',
            'description',
        ];

        keyColumns.forEach(colName => {
            const found = columns.find(c => c.COLUMN_NAME === colName);
            if (found) {
                console.log(`✓ ${found.COLUMN_NAME} [${found.DATA_TYPE}]`);
            } else {
                console.log(`✗ ${colName} (não encontrada)`);
            }
        });

        // Exportar JSON
        const columnsJson = columns.map(col => ({
            name: col.COLUMN_NAME,
            type: col.DATA_TYPE,
            nullable: col.IS_NULLABLE === 'YES',
        }));

        console.log('\n═════════════════════════════════════════════════════════════\n');
        console.log('💾 Exportando para docs/HUBSPOT-AVAILABLE-COLUMNS.json\n');

        const fs = require('fs');
        fs.writeFileSync(
            'docs/HUBSPOT-AVAILABLE-COLUMNS.json',
            JSON.stringify({
                lastUpdated: new Date().toISOString(),
                database: config.database,
                table: 'Deal',
                totalColumns: columns.length,
                columns: columnsJson,
            }, null, 2)
        );

        console.log('✓ Arquivo criado com sucesso!\n');

        await pool.close();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

listAllColumns();
