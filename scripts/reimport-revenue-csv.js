#!/usr/bin/env node
/**
 * Script de reimportação do Revenue Import.csv
 * 
 * Problema identificado:
 * - CSV tem 128 registros (543.337,50€) para FA 101.1 em Março 2025 com Financial Dimension = "Incurred"
 * - Banco de dados tem apenas 125 registros (537.490€)
 * - Campos Invoice_Date, Financial_Dimension, Invoice_Number estão NULL
 * 
 * Solução:
 * - Reimportar APENAS registros com Financial Dimension = "Incurred"
 * - Mapear corretamente todos os campos necessários
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Mapeamento de colunas (0-indexed)
// IMPORTANTE: O FA detalhado está na coluna LINHA (índice 4), não em FINANCIAL_ACCOUNT (índice 3)
// cols[3] = categoria (ex: "104.0 - LAB"), cols[4] = detalhado (ex: "   104.5 - Level 2")
const COLUMNS = {
    INVOICE_DATE: 0,           // col 1: Invoice Date (DD/MM/YYYY)
    FINANCIAL_DIMENSION: 1,    // col 2: Financial Dimension (Incurred, Budget, etc.)
    BIG_LINE: 2,               // col 3: Big Line (101.0 - Growth)
    FINANCIAL_ACCOUNT: 4,      // col 5: LINHA - FA detalhado (   104.5 - Level 2)
    FINANCIAL_ACCOUNT_CATEGORY: 3,  // col 4: Categoria FA (104.0 - LAB)
    LINHA: 4,                  // col 5: LINHA - alias para FINANCIAL_ACCOUNT
    EMAIL: 5,                  // col 6: Email (Most Frequent)
    CLIENT_NAME: 6,            // col 7: Client Name (Most Frequent)
    PRODUCTS_CLEAN: 7,         // col 8: Products - Clean
    BASE_AMOUNT: 8,            // col 9: Base Amount
    DISCOUNT_EUR_EX: 9,        // col 10: Discount EUR EX
    EUR_EX: 10,                // col 11: EUR Ex (valor principal)
    AR_INCURRED: 11,           // col 12: AR Incurred
    AR_BUDGET: 12,             // col 13: AR Budget
    ZIP_CODE: 13,              // col 14: Zip Code
    PC_POINTS: 14,             // col 15: PC Points
    COUNTRY: 15,               // col 16: Country
    FROM_WHERE: 16,            // col 17: From Where ?
    INVOICE_NUMBER: 17,        // col 18: Invoice Number
    ORDER_DATE: 18,            // col 19: Order Date
    PRODUCTS_WEB: 19,          // col 20: Products - Web
    COMPANY: 20,               // col 21: Company
    CURRENCY: 25,              // col 26: Currency
    BILLING_ENTITY: 26,        // col 27: Billing Entity
};

/**
 * Converte data DD/MM/YYYY para YYYY-MM-DD
 */
function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;
    const parts = dateStr.trim().split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Converte valor numérico (pode ter vírgula como decimal)
 */
function parseNumber(value) {
    if (!value || value.trim() === '') return 0;
    // Remove espaços e converte vírgula para ponto
    const cleaned = value.trim().replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

/**
 * Extrai código FA do campo Financial Account
 * Ex: "   101.1 - DSD Courses" -> "101.1"
 */
function extractFACode(faField) {
    if (!faField) return null;
    const match = faField.trim().match(/^(\d{3}\.\d)/);
    return match ? match[1] : null;
}

/**
 * Lê e processa o CSV
 */
function parseCSV(filePath) {
    console.log(`📖 Lendo arquivo: ${filePath}`);

    // Lê o arquivo removendo BOM se existir
    let content = fs.readFileSync(filePath, 'utf-8');
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }

    const lines = content.split(/\r?\n/).filter(line => line.trim());
    console.log(`📊 Total de linhas: ${lines.length}`);

    // Primeira linha é o header
    const header = lines[0].split(';');
    console.log(`📋 Colunas: ${header.length}`);

    const records = [];
    let skippedNonIncurred = 0;
    let skippedInvalid = 0;

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';');

        // Verifica se tem colunas suficientes
        if (cols.length < 20) {
            skippedInvalid++;
            continue;
        }

        const financialDimension = cols[COLUMNS.FINANCIAL_DIMENSION]?.trim();

        // FILTRO CRÍTICO: Apenas registros "Incurred" (receita real)
        if (financialDimension !== 'Incurred') {
            skippedNonIncurred++;
            continue;
        }

        const invoiceDate = parseDate(cols[COLUMNS.INVOICE_DATE]);
        const faCode = extractFACode(cols[COLUMNS.FINANCIAL_ACCOUNT]);
        const amount = parseNumber(cols[COLUMNS.EUR_EX]);

        if (!invoiceDate || !faCode) {
            skippedInvalid++;
            continue;
        }

        records.push({
            date: invoiceDate,
            description: cols[COLUMNS.PRODUCTS_CLEAN]?.trim() || cols[COLUMNS.PRODUCTS_WEB]?.trim() || 'Revenue',
            amount: amount,
            source: 'invoice-orders',
            file_name: 'Revenue Import.csv',
            reconciled: false,
            custom_data: {
                Invoice_Date: invoiceDate,
                Financial_Dimension: financialDimension,
                Financial_Account: faCode,
                financial_account_code: faCode, // Campo esperado pela API P&L
                Invoice_Number: cols[COLUMNS.INVOICE_NUMBER]?.trim() || null,
                Order_Date: parseDate(cols[COLUMNS.ORDER_DATE]),
                Client_Name: cols[COLUMNS.CLIENT_NAME]?.trim() || null,
                Email: cols[COLUMNS.EMAIL]?.trim() || null,
                Company: cols[COLUMNS.COMPANY]?.trim() || null,
                Country: cols[COLUMNS.COUNTRY]?.trim() || null,
                Currency: cols[COLUMNS.CURRENCY]?.trim() || 'EUR',
                Billing_Entity: cols[COLUMNS.BILLING_ENTITY]?.trim() || null,
                Big_Line: cols[COLUMNS.BIG_LINE]?.trim() || null,
                Base_Amount: parseNumber(cols[COLUMNS.BASE_AMOUNT]),
                Discount: parseNumber(cols[COLUMNS.DISCOUNT_EUR_EX]),
            }
        });
    }

    console.log(`\n📈 Resumo do parsing:`);
    console.log(`   ✅ Registros Incurred válidos: ${records.length}`);
    console.log(`   ⏭️  Registros não-Incurred ignorados: ${skippedNonIncurred}`);
    console.log(`   ❌ Registros inválidos: ${skippedInvalid}`);

    return records;
}

/**
 * Agrupa registros por mês/FA para verificação
 */
function analyzeRecords(records) {
    const byMonthFA = {};

    for (const rec of records) {
        const month = rec.date.substring(0, 7); // YYYY-MM
        const fa = rec.custom_data.Financial_Account;
        const key = `${month}|${fa}`;

        if (!byMonthFA[key]) {
            byMonthFA[key] = { count: 0, total: 0 };
        }
        byMonthFA[key].count++;
        byMonthFA[key].total += rec.amount;
    }

    console.log(`\n📊 Análise por Mês/FA (top 20):`);
    const sorted = Object.entries(byMonthFA)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 20);

    for (const [key, data] of sorted) {
        const [month, fa] = key.split('|');
        console.log(`   ${month} | FA ${fa}: ${data.count} registros = €${data.total.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`);
    }

    // Verificar especificamente Março 2025 FA 101.1
    const mar2025_101_1 = byMonthFA['2025-03|101.1'];
    if (mar2025_101_1) {
        console.log(`\n🎯 Março 2025 FA 101.1: ${mar2025_101_1.count} registros = €${mar2025_101_1.total.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`);
    }

    return byMonthFA;
}

/**
 * Importa registros para o Supabase
 */
async function importToSupabase(records, dryRun = true) {
    console.log(`\n${dryRun ? '🔍 [DRY RUN]' : '💾 [EXECUTANDO]'} Importação para Supabase...`);

    if (dryRun) {
        console.log(`   📝 Total de registros a importar: ${records.length}`);
        console.log(`   ⚠️  Execute com --execute para importar de verdade`);
        return;
    }

    // 1. Deletar registros antigos de invoice-orders
    console.log(`\n🗑️  Deletando registros antigos de source='invoice-orders'...`);
    const { error: deleteError, count: deleteCount } = await supabase
        .from('csv_rows')
        .delete()
        .eq('source', 'invoice-orders')
        .select('*', { count: 'exact', head: true });

    if (deleteError) {
        console.error(`❌ Erro ao deletar: ${deleteError.message}`);
        return;
    }
    console.log(`   ✅ Registros antigos removidos`);

    // 2. Inserir novos registros em batches de 500
    const batchSize = 500;
    let inserted = 0;
    let errors = 0;

    console.log(`\n📥 Inserindo ${records.length} registros em batches de ${batchSize}...`);

    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error: insertError, data } = await supabase
            .from('csv_rows')
            .insert(batch)
            .select('id');

        if (insertError) {
            console.error(`   ❌ Erro no batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
            errors += batch.length;
        } else {
            inserted += data?.length || batch.length;
            process.stdout.write(`\r   ✅ Inseridos: ${inserted}/${records.length}`);
        }
    }

    console.log(`\n\n📊 Resumo da importação:`);
    console.log(`   ✅ Inseridos: ${inserted}`);
    console.log(`   ❌ Erros: ${errors}`);
}

/**
 * Verifica dados após importação
 */
async function verifyImport() {
    console.log(`\n🔍 Verificando dados importados...`);

    // Query para Março 2025 FA 101.1
    const { data, error } = await supabase
        .from('csv_rows')
        .select('id, date, amount, custom_data')
        .eq('source', 'invoice-orders')
        .gte('date', '2025-03-01')
        .lte('date', '2025-03-31')
        .filter('custom_data->>Financial_Account', 'eq', '101.1');

    if (error) {
        console.error(`❌ Erro na verificação: ${error.message}`);
        return;
    }

    const total = data?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
    console.log(`   📊 Março 2025 FA 101.1: ${data?.length || 0} registros = €${total.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`);

    if (data?.length === 128 && Math.abs(total - 543337.50) < 1) {
        console.log(`   ✅ SUCESSO! Valores conferem com o CSV original!`);
    } else {
        console.log(`   ⚠️  Esperado: 128 registros = €543.337,50`);
    }
}

// Main
async function main() {
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--execute');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   REIMPORTAÇÃO DE REVENUE IMPORT.CSV');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`   Modo: ${dryRun ? '🔍 DRY RUN (simulação)' : '💾 EXECUÇÃO REAL'}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    const csvPath = path.join(__dirname, '..', 'public', 'Revenue Import.csv');

    if (!fs.existsSync(csvPath)) {
        console.error(`❌ Arquivo não encontrado: ${csvPath}`);
        process.exit(1);
    }

    // 1. Parse CSV
    const records = parseCSV(csvPath);

    // 2. Analisar registros
    analyzeRecords(records);

    // 3. Importar para Supabase
    await importToSupabase(records, dryRun);

    // 4. Verificar (apenas se executou de verdade)
    if (!dryRun) {
        await verifyImport();
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   CONCLUÍDO');
    console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
