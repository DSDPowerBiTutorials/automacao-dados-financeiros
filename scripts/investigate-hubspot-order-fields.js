#!/usr/bin/env node

/**
 * Script para investigar campos de Order/E-commerce no HubSpot SQL
 */

require('dotenv').config({ path: '.env.local' });
const sql = require('mssql');

async function investigateOrderFields() {
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
        console.log('✓ Conectado ao SQL Server\n');

        // 1. Buscar campos relacionados a ORDER/ECOMM/WEBSITE
        console.log('🔍 BUSCANDO CAMPOS DE ORDER/E-COMMERCE NA TABELA DEAL:\n');
        const dealColumns = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Deal'
            AND (
                COLUMN_NAME LIKE '%order%'
                OR COLUMN_NAME LIKE '%ecomm%'
                OR COLUMN_NAME LIKE '%website%'
                OR COLUMN_NAME LIKE '%product%'
                OR COLUMN_NAME LIKE '%quantity%'
                OR COLUMN_NAME LIKE '%payment%'
                OR COLUMN_NAME LIKE '%paid%'
                OR COLUMN_NAME LIKE '%coupon%'
                OR COLUMN_NAME LIKE '%sku%'
                OR COLUMN_NAME LIKE '%reference%'
            )
            ORDER BY COLUMN_NAME
        `);

        dealColumns.recordset.forEach(col => {
            console.log(`  ✓ ${col.COLUMN_NAME.padEnd(50)} [${col.DATA_TYPE}]`);
        });

        // 2. Buscar exemplo real de deal
        console.log('\n\n📊 EXEMPLO REAL DE DEAL (último deal ganho):\n');
        const exampleDeal = await pool.request().query(`
            SELECT TOP 1 *
            FROM Deal
            WHERE dealstage LIKE '%won%'
            ORDER BY closedate DESC
        `);

        if (exampleDeal.recordset.length > 0) {
            const deal = exampleDeal.recordset[0];
            console.log('DealId:', deal.DealId);
            console.log('dealname:', deal.dealname);
            console.log('amount:', deal.amount);
            console.log('closedate:', deal.closedate);
            console.log('dealstage:', deal.dealstage);

            // Mostrar todos os campos de order/ecomm que existem
            Object.keys(deal).forEach(key => {
                const lowerKey = key.toLowerCase();
                if (lowerKey.includes('order') || lowerKey.includes('ecomm') ||
                    lowerKey.includes('website') || lowerKey.includes('product') ||
                    lowerKey.includes('quantity') || lowerKey.includes('payment') ||
                    lowerKey.includes('coupon') || lowerKey.includes('reference')) {
                    console.log(`${key}:`, deal[key]);
                }
            });
        }

        // 3. Verificar LineItem
        console.log('\n\n🛒 VERIFICANDO LINEITEMS:\n');
        const lineItemCheck = await pool.request().query(`
            SELECT COUNT(*) as total
            FROM LineItem
        `);
        console.log(`Total de LineItems: ${lineItemCheck.recordset[0].total}`);

        // Campos de LineItem
        const lineItemColumns = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'LineItem'
            AND (
                COLUMN_NAME LIKE '%description%'
                OR COLUMN_NAME LIKE '%name%'
                OR COLUMN_NAME LIKE '%quantity%'
                OR COLUMN_NAME LIKE '%amount%'
                OR COLUMN_NAME LIKE '%price%'
                OR COLUMN_NAME LIKE '%sku%'
                OR COLUMN_NAME LIKE '%product%'
            )
            ORDER BY COLUMN_NAME
        `);

        console.log('\nCampos de LineItem:');
        lineItemColumns.recordset.forEach(col => {
            console.log(`  ✓ ${col.COLUMN_NAME.padEnd(50)} [${col.DATA_TYPE}]`);
        });

        // 4. Buscar exemplo de deal com LineItem
        console.log('\n\n📦 EXEMPLO DE DEAL COM LINEITEM:\n');
        const dealWithLineItem = await pool.request().query(`
            SELECT TOP 1
                d.DealId,
                d.dealname,
                d.amount,
                li.description as product_name,
                li.quantity,
                li.amount as line_amount,
                li.hs_sku
            FROM Deal d
            LEFT JOIN DealLineItemAssociations dlia ON d.DealId = dlia.DealId
            LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
            WHERE d.dealstage LIKE '%won%'
            AND li.description IS NOT NULL
            ORDER BY d.closedate DESC
        `);

        if (dealWithLineItem.recordset.length > 0) {
            console.log(JSON.stringify(dealWithLineItem.recordset[0], null, 2));
        } else {
            console.log('❌ Nenhum deal com LineItem encontrado');
        }

        await pool.close();

    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

investigateOrderFields();
