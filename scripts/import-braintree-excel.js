#!/usr/bin/env node

/**
 * Script para importar transações Braintree a partir de Excel/CSV
 * 
 * Objetivo: Carregar dados de transações Braintree exportadas do painel Braintree
 * para a tabela csv_rows com o formato exato de "braintree-api-revenue",
 * permitindo que a reconciliação banco ↔ disbursement funcione corretamente.
 * 
 * Uso:
 *   node scripts/import-braintree-excel.js <ficheiro> [opções]
 * 
 * Exemplos:
 *   node scripts/import-braintree-excel.js data/braintree-2025-eur.csv --currency EUR --dry-run
 *   node scripts/import-braintree-excel.js data/braintree-2025-usd.csv --currency USD
 *   node scripts/import-braintree-excel.js data/braintree-2025-gbp.csv --currency GBP
 *   node scripts/import-braintree-excel.js data/braintree-2025.xlsx --currency EUR --sheet "Transactions"
 * 
 * Opções:
 *   --currency EUR|USD|GBP    Moeda das transações (obrigatório)
 *   --dry-run                 Apenas mostra o que seria importado, sem gravar
 *   --separator <char>        Separador do CSV (default: auto-detect)
 *   --sheet <name>            Nome da sheet (para ficheiros .xlsx)
 *   --date-format <fmt>       Formato da data: "iso" (YYYY-MM-DD), "eu" (DD/MM/YYYY), "us" (MM/DD/YYYY)
 *   --skip-fees               Não criar rows de fees
 *   --mapping <file>          Ficheiro JSON com mapeamento de colunas customizado
 * 
 * Formatos de CSV suportados (auto-detectados):
 * 
 * 1) Braintree Transaction Search Export:
 *    Transaction ID, Created Date, Settlement Date, Disbursement Date, 
 *    Amount, Currency, Customer Email, Customer Name, Payment Method,
 *    Status, Type, Merchant Account, Order ID
 * 
 * 2) Braintree Settlement Batch Report:
 *    PAYOUT, Transaction ID, Disbursement Date, Currency ISO Code,
 *    Amount Authorized, Customer First Name, Customer Last Name,
 *    Customer Email, Order ID
 * 
 * 3) Custom mapping via --mapping flag
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// ============================================================
// Configuração Supabase
// ============================================================
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================
// Utilitários
// ============================================================

/** Parseia número formato europeu: "4.000,50" → 4000.50 */
function parseEuropeanNumber(str) {
    if (!str || str === '' || str === '-' || str === 'N/A') return 0;
    const cleaned = str.toString().trim();
    // Detectar formato europeu: tem vírgula como decimal
    if (cleaned.includes(',') && cleaned.indexOf(',') > cleaned.lastIndexOf('.')) {
        return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    }
    // Formato americano/standard
    return parseFloat(cleaned.replace(/,/g, '')) || 0;
}

/** Parseia data em vários formatos → YYYY-MM-DD */
function parseDate(dateStr, format = 'auto') {
    if (!dateStr || dateStr === '' || dateStr === '-' || dateStr === 'N/A') return null;
    const trimmed = dateStr.toString().trim();

    if (format === 'iso' || (format === 'auto' && /^\d{4}-\d{2}-\d{2}/.test(trimmed))) {
        return trimmed.substring(0, 10); // YYYY-MM-DD
    }

    if (format === 'eu' || (format === 'auto' && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(trimmed))) {
        const parts = trimmed.split(/[\/\-]/);
        if (parts.length >= 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            return `${year}-${month}-${day}`;
        }
    }

    if (format === 'us') {
        const parts = trimmed.split(/[\/\-]/);
        if (parts.length >= 3) {
            const month = parts[0].padStart(2, '0');
            const day = parts[1].padStart(2, '0');
            const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            return `${year}-${month}-${day}`;
        }
    }

    // Fallback: try JS Date parse
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
    }

    return null;
}

/** Detecta separador do CSV */
function detectSeparator(firstLine) {
    const counts = {
        ',': (firstLine.match(/,/g) || []).length,
        ';': (firstLine.match(/;/g) || []).length,
        '\t': (firstLine.match(/\t/g) || []).length,
    };
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** Parse CSV line respeitando aspas */
function parseCSVLine(line, separator) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === separator && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

// ============================================================
// Mapeamentos de colunas conhecidos
// ============================================================

/**
 * Auto-detect do formato baseado nos headers
 */
function detectFormat(headers) {
    const h = headers.map(h => h.toLowerCase().trim());

    // Formato 1: Transaction Search Export
    if (h.some(c => c.includes('transaction id')) && h.some(c => c.includes('disbursement date'))) {
        console.log('📋 Formato detectado: Braintree Transaction Search Export');
        return 'transaction-search';
    }

    // Formato 2: Settlement Batch Report
    if (h.some(c => c === 'payout') && h.some(c => c.includes('amount authorized'))) {
        console.log('📋 Formato detectado: Braintree Settlement Batch Report');
        return 'settlement-batch';
    }

    // Formato 3: Transaction Detail Report
    if (h.some(c => c.includes('transaction_id') || c.includes('transactionid'))) {
        console.log('📋 Formato detectado: Braintree Transaction Detail');
        return 'transaction-detail';
    }

    console.log('📋 Formato não reconhecido — usando mapeamento genérico por posição de coluna.');
    console.log('   Headers encontrados:', headers.join(' | '));
    return 'unknown';
}

/** Encontra índice de coluna case-insensitive com partial match */
function findCol(headers, ...alternatives) {
    const h = headers.map(c => c.toLowerCase().trim());
    for (const alt of alternatives) {
        const idx = h.findIndex(c => c.includes(alt.toLowerCase()));
        if (idx !== -1) return idx;
    }
    return -1;
}

/**
 * Retorna mapeamento de colunas baseado no formato detectado
 */
function getColumnMapping(headers, format) {
    const mapping = {};

    if (format === 'transaction-search') {
        mapping.transaction_id = findCol(headers, 'transaction id', 'transaction_id', 'id');
        mapping.date = findCol(headers, 'created date', 'created_at', 'created', 'date');
        mapping.settlement_date = findCol(headers, 'settlement date', 'settled date');
        mapping.disbursement_date = findCol(headers, 'disbursement date');
        mapping.amount = findCol(headers, 'amount');
        mapping.currency = findCol(headers, 'currency');
        mapping.customer_email = findCol(headers, 'customer email', 'email');
        mapping.customer_name = findCol(headers, 'customer name', 'customer');
        mapping.customer_first_name = findCol(headers, 'first name', 'customer first');
        mapping.customer_last_name = findCol(headers, 'last name', 'customer last');
        mapping.payment_method = findCol(headers, 'payment method', 'payment instrument', 'card type');
        mapping.status = findCol(headers, 'status');
        mapping.type = findCol(headers, 'type');
        mapping.merchant_account = findCol(headers, 'merchant account', 'merchant_account');
        mapping.order_id = findCol(headers, 'order id', 'order_id');
        mapping.settlement_amount = findCol(headers, 'settlement amount');
        mapping.settlement_currency = findCol(headers, 'settlement currency');
        mapping.company = findCol(headers, 'company', 'billing company');
        mapping.fee = findCol(headers, 'service fee', 'fee');
    } else if (format === 'settlement-batch') {
        mapping.transaction_id = findCol(headers, 'transaction id');
        mapping.disbursement_date = findCol(headers, 'disbursement date');
        mapping.currency = findCol(headers, 'currency iso code', 'currency');
        mapping.amount = findCol(headers, 'amount authorized', 'amount');
        mapping.customer_first_name = findCol(headers, 'customer first name', 'first name');
        mapping.customer_last_name = findCol(headers, 'customer last name', 'last name');
        mapping.customer_email = findCol(headers, 'customer email', 'email');
        mapping.order_id = findCol(headers, 'order id');
        mapping.settlement_amount = findCol(headers, 'settlement amount');
        mapping.payment_method = findCol(headers, 'payment instrument type', 'payment method');
        mapping.merchant_account = findCol(headers, 'merchant account');
    } else if (format === 'transaction-detail') {
        mapping.transaction_id = findCol(headers, 'transaction_id', 'transactionid', 'id');
        mapping.date = findCol(headers, 'created_at', 'date', 'created');
        mapping.disbursement_date = findCol(headers, 'disbursement_date', 'disbursement');
        mapping.amount = findCol(headers, 'amount');
        mapping.currency = findCol(headers, 'currency');
        mapping.customer_email = findCol(headers, 'customer_email', 'email');
        mapping.customer_name = findCol(headers, 'customer_name', 'customer');
        mapping.payment_method = findCol(headers, 'payment_method', 'payment_type');
        mapping.status = findCol(headers, 'status');
        mapping.merchant_account = findCol(headers, 'merchant_account_id', 'merchant_account');
        mapping.order_id = findCol(headers, 'order_id');
        mapping.settlement_amount = findCol(headers, 'settlement_amount');
        mapping.fee = findCol(headers, 'service_fee', 'fee');
    }

    return mapping;
}

// ============================================================
// Main Import Logic
// ============================================================

async function importBraintreeExcel() {
    // Parse args
    const args = process.argv.slice(2);
    const filePath = args[0];

    if (!filePath || filePath === '--help') {
        console.log(`
Uso: node scripts/import-braintree-excel.js <ficheiro> [opções]

Opções:
  --currency EUR|USD|GBP    Moeda das transações (obrigatório)
  --dry-run                 Apenas mostra o que seria importado
  --separator <char>        Separador CSV (auto-detect por defeito)
  --date-format <fmt>       "iso", "eu" (DD/MM/YYYY), "us" (MM/DD/YYYY)
  --skip-fees               Não criar rows de fees
  --mapping <file>          JSON com mapeamento customizado

Exemplo:
  node scripts/import-braintree-excel.js data/braintree-2025-eur.csv --currency EUR --dry-run
        `);
        process.exit(0);
    }

    const currency = (args.find((_, i) => args[i - 1] === '--currency') || '').toUpperCase();
    const dryRun = args.includes('--dry-run');
    const separator = args.find((_, i) => args[i - 1] === '--separator');
    const dateFormat = args.find((_, i) => args[i - 1] === '--date-format') || 'auto';
    const skipFees = args.includes('--skip-fees');
    const mappingFile = args.find((_, i) => args[i - 1] === '--mapping');

    if (!currency || !['EUR', 'USD', 'GBP', 'AUD'].includes(currency)) {
        console.error('❌ Moeda obrigatória: --currency EUR|USD|GBP|AUD');
        process.exit(1);
    }

    // Resolve file path
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ Ficheiro não encontrado: ${resolvedPath}`);
        process.exit(1);
    }

    const isXlsx = resolvedPath.endsWith('.xlsx') || resolvedPath.endsWith('.xls');
    let lines;

    if (isXlsx) {
        // Try to use xlsx library
        try {
            const XLSX = require('xlsx');
            const sheetName = args.find((_, i) => args[i - 1] === '--sheet');
            const workbook = XLSX.readFile(resolvedPath);
            const sheet = workbook.Sheets[sheetName || workbook.SheetNames[0]];
            const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ',' });
            lines = csv.split('\n').filter(l => l.trim());
        } catch (e) {
            console.error('❌ Para ficheiros .xlsx, instale: npm install xlsx');
            console.error('   Ou converta para CSV primeiro.');
            process.exit(1);
        }
    } else {
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        lines = content.split('\n').filter(l => l.trim());
    }

    if (lines.length < 2) {
        console.error('❌ Ficheiro vazio ou sem dados.');
        process.exit(1);
    }

    // Detect separator and parse headers
    const sep = separator || detectSeparator(lines[0]);
    const headers = parseCSVLine(lines[0], sep);
    console.log(`\n📁 Ficheiro: ${path.basename(resolvedPath)}`);
    console.log(`💱 Moeda: ${currency}`);
    console.log(`📏 Linhas de dados: ${lines.length - 1}`);
    console.log(`🔤 Separador: "${sep === '\t' ? 'TAB' : sep}"`);
    console.log(`📋 Colunas (${headers.length}): ${headers.join(' | ')}\n`);

    // Detect format and get mapping
    let mapping;
    if (mappingFile) {
        mapping = JSON.parse(fs.readFileSync(path.resolve(mappingFile), 'utf-8'));
        console.log('📋 Usando mapeamento customizado:', mappingFile);
    } else {
        const format = detectFormat(headers);
        mapping = getColumnMapping(headers, format);
    }

    // Show detected mapping
    console.log('🗺️  Mapeamento de colunas:');
    for (const [field, idx] of Object.entries(mapping)) {
        if (idx >= 0) {
            console.log(`   ${field}: coluna ${idx} → "${headers[idx]}"`);
        }
    }
    console.log('');

    // Validate minimum required: transaction_id + amount
    if (mapping.amount < 0) {
        console.error('❌ Coluna "amount" não encontrada. Use --mapping para mapear manualmente.');
        process.exit(1);
    }

    // Parse data rows
    const revenueRows = [];
    const feeRows = [];
    const stats = { total: 0, skipped: 0, noDate: 0, noAmount: 0, byMonth: {} };

    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i], sep);
        if (cols.length < 2) continue;
        stats.total++;

        // Extract fields
        const getValue = (field) => {
            const idx = mapping[field];
            return idx >= 0 && idx < cols.length ? cols[idx] : null;
        };

        const transactionId = getValue('transaction_id') || `import-${currency}-${i}-${Date.now()}`;
        const rawAmount = getValue('amount');
        const amount = parseEuropeanNumber(rawAmount);

        if (!amount || amount <= 0) {
            stats.noAmount++;
            stats.skipped++;
            continue;
        }

        // Date: prefer created date, fallback to settlement/disbursement date
        const rawDate = getValue('date') || getValue('settlement_date') || getValue('disbursement_date');
        const date = parseDate(rawDate, dateFormat);

        if (!date) {
            stats.noDate++;
            stats.skipped++;
            continue;
        }

        // Build customer name
        let customerName = getValue('customer_name');
        if (!customerName) {
            const first = getValue('customer_first_name') || '';
            const last = getValue('customer_last_name') || '';
            customerName = `${first} ${last}`.trim() || null;
        }

        const customerEmail = getValue('customer_email');
        const paymentMethod = getValue('payment_method') || 'Unknown';
        const status = getValue('status') || 'settled';
        const type = getValue('type') || 'sale';
        const merchantAccount = getValue('merchant_account') || `imported-${currency.toLowerCase()}`;
        const orderId = getValue('order_id');
        const disbursementDate = parseDate(getValue('disbursement_date'), dateFormat);
        const settlementDate = parseDate(getValue('settlement_date'), dateFormat);
        const settlementAmount = parseEuropeanNumber(getValue('settlement_amount')) || amount;
        const settlementCurrency = getValue('settlement_currency') || currency;
        const company = getValue('company');
        const fee = parseEuropeanNumber(getValue('fee'));

        // Filter: only transactions of the specified currency (if currency column exists)
        const rowCurrency = getValue('currency');
        if (rowCurrency && rowCurrency.toUpperCase() !== currency) {
            stats.skipped++;
            continue;
        }

        // Filter: only settled/settling transactions
        const statusLower = status.toLowerCase();
        if (['voided', 'failed', 'gateway_rejected', 'processor_declined'].includes(statusLower)) {
            stats.skipped++;
            continue;
        }

        // Track by month
        const month = date.substring(0, 7); // YYYY-MM
        stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;

        // Build revenue row matching braintree-api-revenue format exactly
        const rowId = `braintree-rev-${currency.toLowerCase()}-${transactionId}`;
        revenueRows.push({
            id: rowId,
            file_name: `braintree-import-${currency.toLowerCase()}-${path.basename(resolvedPath)}`,
            source: 'braintree-api-revenue',
            date: date,
            description: `${customerName || 'Braintree Customer'} - ${paymentMethod}`,
            amount: amount.toString(),
            reconciled: false,
            customer_email: customerEmail,
            customer_name: customerName,
            custom_data: {
                transaction_id: transactionId,
                order_id: orderId || null,
                status: status,
                type: type,
                currency: currency,
                customer_id: null,
                customer_name: customerName,
                customer_email: customerEmail,
                billing_name: customerName,
                company_name: company || null,
                payment_method: paymentMethod,
                merchant_account_id: merchantAccount,
                created_at: `${date}T00:00:00.000Z`,
                updated_at: `${date}T00:00:00.000Z`,
                disbursement_date: disbursementDate || null,
                settlement_amount: settlementAmount,
                settlement_currency: settlementCurrency,
                settlement_currency_iso_code: settlementCurrency,
                settlement_currency_exchange_rate: settlementCurrency === currency ? 1.0 : null,
                disbursement_id: disbursementDate ? `disb-import-${disbursementDate}` : null,
                settlement_batch_id: disbursementDate ?
                    `${disbursementDate}_${merchantAccount}_disb-import-${disbursementDate}` : null,
                settlement_date: settlementDate || disbursementDate || null,
                status_history: [],
                // Import metadata
                _imported: true,
                _import_source: path.basename(resolvedPath),
                _import_date: new Date().toISOString(),
            }
        });

        // Build fee row if fee data available
        if (!skipFees && fee && fee > 0) {
            feeRows.push({
                id: `braintree-fee-${currency.toLowerCase()}-${transactionId}`,
                file_name: `braintree-import-${currency.toLowerCase()}-${path.basename(resolvedPath)}`,
                source: 'braintree-api-fees',
                date: date,
                description: `Fee Braintree - ${transactionId}`,
                amount: (-fee).toString(),
                reconciled: false,
                custom_data: {
                    transaction_id: transactionId,
                    related_revenue_amount: amount.toString(),
                    fee_type: 'service_fee',
                    currency: currency,
                    _imported: true,
                    _import_source: path.basename(resolvedPath),
                }
            });
        }
    }

    // ============================================================
    // Report
    // ============================================================
    console.log('═══════════════════════════════════════════════════');
    console.log(`📊 RESUMO DO IMPORT — Braintree ${currency}`);
    console.log('═══════════════════════════════════════════════════');
    console.log(`   Total linhas no ficheiro: ${stats.total}`);
    console.log(`   Linhas válidas (revenue): ${revenueRows.length}`);
    console.log(`   Linhas de fees:           ${feeRows.length}`);
    console.log(`   Skipped (sem valor):      ${stats.noAmount}`);
    console.log(`   Skipped (sem data):       ${stats.noDate}`);
    console.log(`   Skipped (outro motivo):   ${stats.skipped - stats.noAmount - stats.noDate}`);
    console.log('');
    console.log('   📅 Por mês:');

    const sortedMonths = Object.entries(stats.byMonth).sort(([a], [b]) => a.localeCompare(b));
    let totalAmount = 0;
    for (const [month, count] of sortedMonths) {
        const monthAmount = revenueRows
            .filter(r => r.date.startsWith(month))
            .reduce((sum, r) => sum + parseFloat(r.amount), 0);
        totalAmount += monthAmount;
        console.log(`      ${month}: ${count} transações → ${currency} ${monthAmount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`);
    }
    console.log(`      ────────────────────────────────────`);
    console.log(`      TOTAL: ${revenueRows.length} transações → ${currency} ${totalAmount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`);
    console.log('═══════════════════════════════════════════════════');

    // Show sample rows
    if (revenueRows.length > 0) {
        console.log('\n📋 Amostra (primeiras 3 linhas):');
        revenueRows.slice(0, 3).forEach((r, i) => {
            console.log(`   [${i + 1}] ${r.date} | ${r.custom_data.transaction_id} | ${currency} ${parseFloat(r.amount).toFixed(2)} | ${r.description} | disb: ${r.custom_data.disbursement_date || 'N/A'}`);
        });
    }

    // Check for critical field: disbursement_date
    const withDisbursement = revenueRows.filter(r => r.custom_data.disbursement_date).length;
    const withoutDisbursement = revenueRows.length - withDisbursement;
    console.log(`\n🔑 Campo crítico - disbursement_date:`);
    console.log(`   Com disbursement_date:    ${withDisbursement} (${((withDisbursement / revenueRows.length) * 100).toFixed(1)}%)`);
    console.log(`   Sem disbursement_date:    ${withoutDisbursement}`);
    if (withoutDisbursement > 0) {
        console.log(`   ⚠️  Transações sem disbursement_date NÃO serão reconciliadas automaticamente`);
        console.log(`      com créditos bancários. O relatório Braintree ideal é o "Transaction Search"`);
        console.log(`      que inclui a coluna "Disbursement Date".`);
    }

    // ============================================================
    // Insert into Supabase
    // ============================================================
    if (dryRun) {
        console.log('\n🔍 DRY RUN — nada foi gravado na base de dados.');
        console.log('   Remova --dry-run para executar a importação real.');
        process.exit(0);
    }

    console.log(`\n💾 Inserindo ${revenueRows.length} revenue rows no Supabase...`);

    // Batch upsert in chunks of 500
    const BATCH_SIZE = 500;
    let insertedRevenue = 0;
    let insertedFees = 0;

    for (let i = 0; i < revenueRows.length; i += BATCH_SIZE) {
        const batch = revenueRows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('csv_rows')
            .upsert(batch, { onConflict: 'id' });

        if (error) {
            console.error(`❌ Erro no batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
            // Log first row of failed batch for debugging
            console.error('   Primeira row do batch:', JSON.stringify(batch[0], null, 2));
            continue;
        }
        insertedRevenue += batch.length;
        process.stdout.write(`   Revenue: ${insertedRevenue}/${revenueRows.length}\r`);
    }
    console.log(`\n✅ Revenue: ${insertedRevenue} rows inseridas/atualizadas.`);

    if (feeRows.length > 0) {
        console.log(`💾 Inserindo ${feeRows.length} fee rows...`);
        for (let i = 0; i < feeRows.length; i += BATCH_SIZE) {
            const batch = feeRows.slice(i, i + BATCH_SIZE);
            const { error } = await supabase
                .from('csv_rows')
                .upsert(batch, { onConflict: 'id' });

            if (error) {
                console.error(`❌ Erro fees batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
                continue;
            }
            insertedFees += batch.length;
        }
        console.log(`✅ Fees: ${insertedFees} rows inseridas/atualizadas.`);
    }

    console.log(`\n🎉 Importação concluída! Total: ${insertedRevenue + insertedFees} rows.`);
    console.log(`\nPróximos passos:`);
    console.log(`  1. Verificar na UI: /reports/braintree-${currency.toLowerCase()}`);
    console.log(`  2. Executar reconciliação: POST /api/reconcile/bank-disbursement {"bankSource":"bankinter-${currency.toLowerCase()}", "dryRun":true}`);
}

// ============================================================
// Run
// ============================================================
importBraintreeExcel().catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});
