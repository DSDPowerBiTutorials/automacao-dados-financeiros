#!/usr/bin/env node
/**
 * Script de Validação: Excel vs Banco de Dados
 * 
 * Este script compara os dados de receita do arquivo CSV (Revenue Import.csv)
 * com os dados no banco de dados Supabase (tabela csv_rows).
 * 
 * Aprendizados Aplicados:
 * 1. Parse de números no formato europeu (4.000,50 = 4000.50)
 * 2. Detecção de duplicatas por invoice_number
 * 3. Paginação para buscar todos os registros (limite de 1000 por query)
 * 4. Comparação por FA (Financial Account) e mês
 * 
 * Uso:
 *   node scripts/validate-revenue-data.js [ano]
 *   node scripts/validate-revenue-data.js 2025
 * 
 * @author Copilot Agent
 * @date 2026-02-04
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Parse formato europeu: 4.000,50 → 4000.50
function parseEuropeanNumber(str) {
    if (!str || typeof str !== 'string') return 0;
    // Remover pontos (separadores de milhar) e trocar vírgula por ponto decimal
    const cleaned = str.trim().replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
}

// Constantes
const MONTH_NAMES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

async function validateRevenueData(year = new Date().getFullYear()) {
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`     VALIDAÇÃO DE DADOS DE RECEITA - ${year}`);
    console.log('═══════════════════════════════════════════════════════════════════════\n');

    // 1) Ler Excel
    const csvPath = 'public/Revenue Import.csv';
    if (!fs.existsSync(csvPath)) {
        console.error('❌ Arquivo não encontrado:', csvPath);
        process.exit(1);
    }

    const csv = fs.readFileSync(csvPath, 'utf8');
    const lines = csv.split('\n');

    console.log('📁 Lendo Excel:', lines.length - 1, 'linhas');

    const excelData = {};
    const excelByInvoice = {};
    const duplicatesInExcel = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';');
        if (cols.length < 12) continue;

        const dateStr = cols[0]?.trim();
        const faLine = cols[4]?.trim();
        const arIncurred = parseEuropeanNumber(cols[11]);
        const invoiceNumber = cols[17]?.trim();

        if (!dateStr || !faLine) continue;

        const parts = dateStr.split('/');
        if (parts.length !== 3) continue;
        const [day, month, yearNum] = parts.map(Number);
        if (yearNum !== year) continue;

        const faMatch = faLine.match(/(\d{3}\.\d)/);
        if (!faMatch) continue;
        const faCode = faMatch[1];

        // Agregar por FA e mês
        const key = faCode + '_' + month;
        excelData[key] = (excelData[key] || 0) + arIncurred;

        // Verificar duplicatas por invoice
        if (invoiceNumber && invoiceNumber !== '') {
            const invoiceKey = `${invoiceNumber}_${faCode}_${month}`;
            if (!excelByInvoice[invoiceKey]) {
                excelByInvoice[invoiceKey] = [];
            }
            excelByInvoice[invoiceKey].push({
                lineNum: i + 1,
                amount: arIncurred,
                invoice: invoiceNumber
            });
        }
    }

    // Detectar duplicatas
    for (const [key, entries] of Object.entries(excelByInvoice)) {
        if (entries.length > 1) {
            duplicatesInExcel.push({ key, entries });
        }
    }

    if (duplicatesInExcel.length > 0) {
        console.log('\n⚠️  DUPLICATAS DETECTADAS NO EXCEL:');
        for (const dup of duplicatesInExcel) {
            console.log(`   ${dup.key}: ${dup.entries.length} entradas`);
            for (const e of dup.entries) {
                console.log(`      Linha ${e.lineNum}: €${e.amount}`);
            }
        }
    }

    // 2) Ler Banco com paginação
    console.log('\n📊 Buscando dados do banco...');
    const bankData = {};
    let offset = 0;
    const pageSize = 1000;
    let totalRows = 0;

    while (true) {
        const { data, error } = await supabase
            .from('csv_rows')
            .select('date, amount, custom_data')
            .eq('source', 'invoice-orders')
            .gte('date', `${year}-01-01`)
            .lte('date', `${year}-12-31`)
            .range(offset, offset + pageSize - 1);

        if (error) {
            console.error('❌ Erro ao buscar dados:', error);
            break;
        }
        if (!data || data.length === 0) break;

        for (const row of data) {
            const fa = row.custom_data?.financial_account_code || row.custom_data?.financial_account;
            if (!fa) continue;

            const date = new Date(row.date);
            const month = date.getMonth() + 1;

            const key = fa + '_' + month;
            bankData[key] = (bankData[key] || 0) + (row.amount || 0);
        }

        totalRows += data.length;
        offset += pageSize;
        if (data.length < pageSize) break;
    }

    console.log('📊 Total registros no banco:', totalRows);

    // 3) Comparar
    const allKeys = new Set([...Object.keys(excelData), ...Object.keys(bankData)]);
    const differences = [];

    for (const key of allKeys) {
        const [fa, month] = key.split('_');
        const excel = excelData[key] || 0;
        const banco = bankData[key] || 0;
        const diff = banco - excel;

        if (Math.abs(diff) > 1) {
            differences.push({ fa, month: parseInt(month), excel, banco, diff });
        }
    }

    differences.sort((a, b) => a.fa.localeCompare(b.fa) || a.month - b.month);

    // 4) Relatório
    console.log('\n' + '─'.repeat(60));

    if (differences.length === 0) {
        console.log('✅ NENHUMA DIFERENÇA ENCONTRADA! Excel = Banco');
    } else {
        console.log('⚠️  DIFERENÇAS ENCONTRADAS (|diff| > €1):\n');
        console.log('FA      | Mês   | Excel        | Banco        | Diferença');
        console.log('--------|-------|--------------|--------------|-------------');

        for (const d of differences) {
            const excelStr = ('€' + d.excel.toFixed(2)).padStart(12);
            const bancoStr = ('€' + d.banco.toFixed(2)).padStart(12);
            const diffStr = (d.diff >= 0 ? '+' : '') + '€' + d.diff.toFixed(2);
            console.log(
                d.fa.padEnd(7) + ' | ' +
                MONTH_NAMES[d.month].padEnd(5) + ' | ' +
                excelStr + ' | ' +
                bancoStr + ' | ' +
                diffStr
            );
        }
    }

    // Resumo por FA
    console.log('\n\n📊 RESUMO POR FA (Total Anual):');
    console.log('─'.repeat(60));

    const faList = [...new Set([...Object.keys(excelData), ...Object.keys(bankData)].map(k => k.split('_')[0]))].sort();

    let allMatch = true;
    for (const fa of faList) {
        let excelTotal = 0, bancoTotal = 0;
        for (let m = 1; m <= 12; m++) {
            excelTotal += excelData[fa + '_' + m] || 0;
            bancoTotal += bankData[fa + '_' + m] || 0;
        }
        const diff = bancoTotal - excelTotal;
        const status = Math.abs(diff) < 1 ? '✅' : '❌';
        if (Math.abs(diff) >= 1) allMatch = false;

        console.log(
            status + ' FA ' + fa + ': Excel €' + excelTotal.toFixed(0).padStart(10) +
            ' | Banco €' + bancoTotal.toFixed(0).padStart(10) +
            ' | Diff: ' + (diff >= 0 ? '+' : '') + '€' + diff.toFixed(0)
        );
    }

    console.log('\n' + '═'.repeat(60));
    console.log(allMatch ? '✅ VALIDAÇÃO APROVADA!' : '❌ VALIDAÇÃO FALHOU - Existem diferenças');
    console.log('═'.repeat(60));

    // Retornar status para uso em CI/CD
    process.exit(allMatch && duplicatesInExcel.length === 0 ? 0 : 1);
}

// Executar
const year = parseInt(process.argv[2]) || new Date().getFullYear();
validateRevenueData(year);
