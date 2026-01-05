#!/usr/bin/env node

/**
 * Script para gerar arquivo XLSX com 100 exemplos de deals do HubSpot
 * Inclui todas as 239 colunas disponíveis
 * Executar: node scripts/export-hubspot-xlsx.js
 */

require('dotenv').config({ path: '.env.local' });
const sql = require('mssql');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function exportToExcel() {
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

        // Buscar 100 deals
        console.log('📥 Buscando 100 deals...');
        const result = await pool.request().query(`
      SELECT TOP 100 * 
      FROM [dbo].[Deal]
      ORDER BY hs_lastmodifieddate DESC
    `);

        const deals = result.recordset;
        console.log(`✓ Encontrados ${deals.length} deals\n`);

        if (deals.length === 0) {
            console.log('⚠️ Nenhum deal encontrado!');
            await pool.close();
            return;
        }

        // Obter nomes de todas as colunas
        const columns = Object.keys(deals[0]);
        console.log(`📊 Total de colunas: ${columns.length}\n`);

        // Criar workbook
        console.log('📝 Criando arquivo Excel...');
        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Dados dos deals
        const worksheet = workbook.addWorksheet('Deals', {
            pageSetup: { paperSize: 9, orientation: 'landscape' },
        });

        // Adicionar cabeçalhos
        worksheet.columns = columns.map(col => ({
            header: col,
            key: col,
            width: 20,
        }));

        // Estilo do cabeçalho
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
        };

        worksheet.getRow(1).font = {
            bold: true,
            color: { argb: 'FFFFFFFF' },
            size: 11,
        };

        worksheet.getRow(1).alignment = {
            horizontal: 'center',
            vertical: 'center',
            wrapText: true,
        };

        // Adicionar dados
        console.log('🔄 Processando dados...');
        deals.forEach((deal, index) => {
            const row = worksheet.addRow(deal);

            // Aplicar formatação condicional para datas
            columns.forEach((col, colIndex) => {
                const cell = row.getCell(colIndex + 1);

                // Se for data, formatar
                if (deal[col] instanceof Date) {
                    cell.numFmt = 'yyyy-mm-dd hh:mm:ss';
                    cell.alignment = { horizontal: 'center' };
                }

                // Se for número, alinhar à direita
                if (typeof deal[col] === 'number') {
                    cell.numFmt = '#,##0.00';
                    cell.alignment = { horizontal: 'right' };
                }

                // Cores alternadas para melhor legibilidade
                if (index % 2 === 0) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF2F2F2' },
                    };
                }
            });

            if ((index + 1) % 10 === 0) {
                console.log(`  Processados ${index + 1}/${deals.length} deals`);
            }
        });

        // Congelar primeira linha
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        // Sheet 2: Informações das colunas
        console.log('📋 Adicionando sheet de metadados...');
        const metaWorksheet = workbook.addWorksheet('Colunas', {
            pageSetup: { paperSize: 9, orientation: 'portrait' },
        });

        // Buscar tipos de dados
        const columnsInfo = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Deal'
      ORDER BY ORDINAL_POSITION
    `);

        metaWorksheet.columns = [
            { header: '#', key: 'ORDINAL_POSITION', width: 5 },
            { header: 'Nome da Coluna', key: 'COLUMN_NAME', width: 45 },
            { header: 'Tipo de Dado', key: 'DATA_TYPE', width: 15 },
            { header: 'Pode ser Vazio?', key: 'IS_NULLABLE', width: 15 },
        ];

        // Estilo do cabeçalho
        metaWorksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF70AD47' },
        };

        metaWorksheet.getRow(1).font = {
            bold: true,
            color: { argb: 'FFFFFFFF' },
            size: 11,
        };

        columnsInfo.recordset.forEach((col, index) => {
            const row = metaWorksheet.addRow({
                ORDINAL_POSITION: col.ORDINAL_POSITION,
                COLUMN_NAME: col.COLUMN_NAME,
                DATA_TYPE: col.DATA_TYPE,
                IS_NULLABLE: col.IS_NULLABLE === 'YES' ? 'Sim' : 'Não',
            });

            if (index % 2 === 0) {
                row.eachCell(cell => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF2F2F2' },
                    };
                });
            }
        });

        // Sheet 3: Resumo
        console.log('📊 Adicionando resumo...');
        const summaryWorksheet = workbook.addWorksheet('Resumo');

        const summaryData = [
            { label: 'Data de Exportação', value: new Date().toLocaleString('pt-BR') },
            { label: 'Número de Deals', value: deals.length },
            { label: 'Número de Colunas', value: columns.length },
            { label: 'Database', value: config.database },
            { label: 'Tabela', value: 'Deal' },
            { label: 'Período de Dados', value: 'Últimos 100 deals modificados' },
        ];

        // Tipos de coluna
        const typeGroups = {};
        columnsInfo.recordset.forEach(col => {
            if (!typeGroups[col.DATA_TYPE]) {
                typeGroups[col.DATA_TYPE] = 0;
            }
            typeGroups[col.DATA_TYPE]++;
        });

        summaryWorksheet.columns = [
            { header: 'Informação', key: 'label', width: 30 },
            { header: 'Valor', key: 'value', width: 40 },
        ];

        summaryData.forEach((item, index) => {
            const row = summaryWorksheet.addRow(item);
            if (index % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2F2F2' },
                };
            }
        });

        // Adicionar resumo de tipos
        summaryWorksheet.addRow({ label: '', value: '' });
        summaryWorksheet.addRow({ label: 'Distribuição de Tipos de Dados', value: '' });

        Object.entries(typeGroups).forEach(([type, count]) => {
            summaryWorksheet.addRow({
                label: `  ${type}`,
                value: count,
            });
        });

        // Salvar arquivo
        const outputPath = path.join(process.cwd(), 'data', `hubspot-deals-${new Date().toISOString().split('T')[0]}.xlsx`);

        // Criar diretório se não existir
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        console.log(`\n💾 Salvando arquivo em: ${outputPath}`);
        await workbook.xlsx.writeFile(outputPath);

        console.log(`✅ Arquivo criado com sucesso!\n`);
        console.log('📋 Conteúdo do arquivo:');
        console.log(`  • Sheet 1: "Deals" - ${deals.length} deals com ${columns.length} colunas cada`);
        console.log(`  • Sheet 2: "Colunas" - Metadados de todas as ${columns.length} colunas`);
        console.log(`  • Sheet 3: "Resumo" - Informações e estatísticas do arquivo`);

        await pool.close();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

exportToExcel();
