/**
 * Script para importar receitas de 2024/2025 para Invoice Orders
 * 
 * DOCUMENTAÇÃO: docs/REVENUE-CLASSIFICATION-RULES.md
 * 
 * Lógica de classificação:
 * - 102.0 Delight (assinaturas/monthly fees):
 *   - 102.1/102.2 = Contracted (cliente recorrente)
 *   - 102.3/102.4 = New (primeira compra)
 *   - ROW = Rest of World (não-EUA), AMEX = USA
 * 
 * - 103.0 Planning Center e 104.0 LAB:
 *   - .1/.2 = Level 3 ROW/AMEX (Clinics recorrentes)
 *   - .3/.4 = Level 3 New ROW/AMEX (Clinics novos)
 *   - .5 = Level 2 (PC Membership mas não é Clinic)
 *   - .6 = Level 1 (só Level 1 Subscription)
 *   - .7 = Not a Subscriber
 * 
 * IMPORTANTE: Este script considera histórico existente no banco de dados
 * para classificar corretamente clientes que já compraram anteriormente.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Ler o CSV
const csvPath = path.join(__dirname, '../public/Revenue Import.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n');

// Parse header
const header = lines[0].split(';').map(h => h.trim());
console.log('📋 Colunas encontradas:', header.length);

// Índices das colunas importantes
const COL = {
  INVOICE_DATE: header.indexOf('Invoice Date'),
  FINANCIAL_DIMENSION: header.indexOf('Financial Dimension'),
  BIG_LINE: header.indexOf('Big Line'),
  FINANCIAL_ACCOUNT: header.indexOf('Financial Account'),
  LINHA: header.indexOf('LINHA'),
  EMAIL: header.indexOf('Email (Most Frequent)'),
  CLIENT_NAME: header.indexOf('Client Name (Most Frequent)'),
  PRODUCTS: header.indexOf('Products - Clean'),
  BASE_AMOUNT: header.indexOf('Base Amount'),
  DISCOUNT: header.indexOf('Discount EUR EX'),
  EUR_EX: header.indexOf('EUR Ex'),
  AR_INCURRED: header.indexOf('AR Incurred'),
  PC_POINTS: header.indexOf('PC Points'),
  COUNTRY: header.indexOf('Country'),
  FROM_WHERE: header.indexOf('From Where ?'),
  INVOICE_NUMBER: header.indexOf('Invoice Number'),
  ORDER_DATE: header.indexOf('Order Date'),
  PRODUCTS_WEB: header.indexOf('Products - Web'),
  COMPANY: header.indexOf('Company'),
  CURRENCY: header.indexOf('Currency'),
  IS_CLINIC: header.indexOf("It's Clinic ?"),
  DEP_CLASSIFICATION: header.indexOf('DEP P&L Classification'),
};

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function parseDate(dateStr) {
  if (!dateStr || dateStr === '-') return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseEuroNumber(numStr) {
  if (!numStr || numStr === '' || numStr === '-') return 0;
  const cleaned = numStr.toString().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function isUSA(country) {
  const c = country?.toLowerCase()?.trim();
  return c === 'united states' || c === 'usa' || c === 'us' || c === 'estados unidos';
}

function getSubscriberLevel(pcPoints, isClinic) {
  if (isClinic === 'Yes' || isClinic === true) return 'Lvl 3';
  if (pcPoints && parseInt(pcPoints) > 0) {
    const points = parseInt(pcPoints);
    if (points >= 1000) return 'Lvl 2';
    return 'Lvl 1';
  }
  return 'Not a Subscriber';
}

// ============================================================================
// BUSCAR HISTÓRICO EXISTENTE NO BANCO
// ============================================================================

async function getExistingHistory() {
  console.log('\n🔍 Buscando histórico existente no banco de dados...');
  const history = new Map();
  
  let offset = 0;
  const pageSize = 1000;
  let totalRows = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('csv_rows')
      .select('date, custom_data')
      .eq('source', 'invoice-orders')
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      console.error('Erro ao buscar histórico:', error.message);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    for (const row of data) {
      const email = row.custom_data?.email?.toLowerCase();
      const bigLine = row.custom_data?.big_line;
      const date = row.date;
      if (!email || !date) continue;
      
      if (!history.has(email)) {
        history.set(email, { 
          firstDelightDate: null, 
          firstPCDate: null, 
          firstLabDate: null,
          isClinic: row.custom_data?.is_clinic || false
        });
      }
      const h = history.get(email);
      
      if (bigLine?.includes('102.0') && (!h.firstDelightDate || date < h.firstDelightDate)) {
        h.firstDelightDate = date;
      }
      if (bigLine?.includes('103.0') && (!h.firstPCDate || date < h.firstPCDate)) {
        h.firstPCDate = date;
      }
      if (bigLine?.includes('104.0') && (!h.firstLabDate || date < h.firstLabDate)) {
        h.firstLabDate = date;
      }
      if (row.custom_data?.is_clinic) h.isClinic = true;
    }
    
    totalRows += data.length;
    offset += pageSize;
    if (data.length < pageSize) break;
  }
  
  console.log(`   📊 Histórico existente: ${history.size} clientes de ${totalRows} registros`);
  return history;
}

// ============================================================================
// PROCESSAR CSV E CONSTRUIR HISTÓRICO
// ============================================================================

function buildCSVHistory() {
  console.log('\n📄 Processando CSV e construindo histórico...');
  const csvHistory = new Map();
  const incurredLines = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const cols = line.split(';');
    const dimension = cols[COL.FINANCIAL_DIMENSION]?.trim();
    
    if (dimension !== 'Incurred') continue;
    
    const email = cols[COL.EMAIL]?.trim().toLowerCase();
    const dateStr = cols[COL.INVOICE_DATE]?.trim();
    const bigLine = cols[COL.BIG_LINE]?.trim();
    const isClinic = cols[COL.IS_CLINIC]?.trim();
    
    if (!email || email === 'no email') continue;
    
    const date = parseDate(dateStr);
    if (!date) continue;
    
    incurredLines.push({ index: i, cols, date, email, bigLine, isClinic });
    
    if (!csvHistory.has(email)) {
      csvHistory.set(email, {
        firstDelightDate: null,
        firstPCDate: null,
        firstLabDate: null,
        isClinic: isClinic === 'Yes'
      });
    }
    
    const history = csvHistory.get(email);
    if (isClinic === 'Yes') history.isClinic = true;
    
    if (bigLine?.includes('102.0 - Delight')) {
      if (!history.firstDelightDate || date < history.firstDelightDate) {
        history.firstDelightDate = date;
      }
    } else if (bigLine?.includes('103.0 - Planning Center')) {
      if (!history.firstPCDate || date < history.firstPCDate) {
        history.firstPCDate = date;
      }
    } else if (bigLine?.includes('104.0 - LAB')) {
      if (!history.firstLabDate || date < history.firstLabDate) {
        history.firstLabDate = date;
      }
    }
  }
  
  incurredLines.sort((a, b) => a.date.localeCompare(b.date));
  
  console.log(`   📊 CSV: ${csvHistory.size} clientes, ${incurredLines.length} linhas Incurred`);
  return { csvHistory, incurredLines };
}

// ============================================================================
// MESCLAR HISTÓRICOS (BANCO + CSV)
// ============================================================================

function mergeHistories(existingHistory, csvHistory) {
  console.log('\n🔗 Mesclando históricos (banco + CSV)...');
  const merged = new Map();
  
  for (const [email, h] of existingHistory) {
    merged.set(email, { ...h });
  }
  
  for (const [email, csvH] of csvHistory) {
    if (!merged.has(email)) {
      merged.set(email, { ...csvH });
    } else {
      const h = merged.get(email);
      if (csvH.firstDelightDate && (!h.firstDelightDate || csvH.firstDelightDate < h.firstDelightDate)) {
        h.firstDelightDate = csvH.firstDelightDate;
      }
      if (csvH.firstPCDate && (!h.firstPCDate || csvH.firstPCDate < h.firstPCDate)) {
        h.firstPCDate = csvH.firstPCDate;
      }
      if (csvH.firstLabDate && (!h.firstLabDate || csvH.firstLabDate < h.firstLabDate)) {
        h.firstLabDate = csvH.firstLabDate;
      }
      if (csvH.isClinic) h.isClinic = true;
    }
  }
  
  console.log(`   📊 Histórico mesclado: ${merged.size} clientes únicos`);
  return merged;
}

// ============================================================================
// DETERMINAR FINANCIAL ACCOUNT
// ============================================================================

function determineFinancialAccount(cols, email, date, clientHistory) {
  const bigLine = cols[COL.BIG_LINE]?.trim();
  const originalFA = cols[COL.FINANCIAL_ACCOUNT]?.trim();
  const linha = cols[COL.LINHA]?.trim();
  const country = cols[COL.COUNTRY]?.trim();
  const pcPoints = cols[COL.PC_POINTS]?.trim();
  const isClinicStr = cols[COL.IS_CLINIC]?.trim();
  
  const isAMEX = isUSA(country);
  const history = clientHistory.get(email) || {};
  
  if (linha) {
    const linhaCode = linha.match(/(\d+\.\d+)/)?.[1];
    if (linhaCode) return linhaCode;
  }
  // Fallback: lógica antiga (não deve ser executada)
  if (false) {
    const code = linha.match(/(\d+\.\d+)/)?.[1];
    if (code) return code;
  }
  
  if (bigLine?.includes('102.0 - Delight')) {
    if (originalFA?.includes('102.5')) return '102.5';
    if (originalFA?.includes('102.6')) return '102.6';
    if (originalFA?.includes('102.7')) return '102.7';
    
    const isFirstDelight = history.firstDelightDate === date;
    
    if (isFirstDelight) {
      return isAMEX ? '102.4' : '102.3';
    } else {
      return isAMEX ? '102.2' : '102.1';
    }
  }
  
  if (bigLine?.includes('103.0 - Planning Center')) {
    const subscriberLevel = getSubscriberLevel(pcPoints, isClinicStr === 'Yes' || history.isClinic);
    
    if (subscriberLevel === 'Lvl 3') {
      const isFirstPC = history.firstPCDate === date;
      if (isFirstPC) {
        return isAMEX ? '103.4' : '103.3';
      } else {
        return isAMEX ? '103.2' : '103.1';
      }
    } else if (subscriberLevel === 'Lvl 2') {
      return '103.5';
    } else if (subscriberLevel === 'Lvl 1') {
      return '103.6';
    } else {
      return '103.7';
    }
  }
  
  if (bigLine?.includes('104.0 - LAB')) {
    const subscriberLevel = getSubscriberLevel(pcPoints, isClinicStr === 'Yes' || history.isClinic);
    
    if (subscriberLevel === 'Lvl 3') {
      const isFirstLab = history.firstLabDate === date;
      if (isFirstLab) {
        return isAMEX ? '104.4' : '104.3';
      } else {
        return isAMEX ? '104.2' : '104.1';
      }
    } else if (subscriberLevel === 'Lvl 2') {
      return '104.5';
    } else if (subscriberLevel === 'Lvl 1') {
      return '104.6';
    } else {
      return '104.7';
    }
  }
  
  const code = originalFA?.match(/(\d+\.\d+)/)?.[1];
  return code || '999.0';
}

// ============================================================================
// PREPARAR LINHAS PARA INSERÇÃO
// ============================================================================

function prepareRowsForInsert(incurredLines, clientHistory) {
  console.log('\n📝 Preparando linhas para inserção...');
  const rowsToInsert = [];
  let skipped = 0;
  
  for (const { cols, date, email } of incurredLines) {
    const amount = parseEuroNumber(cols[COL.EUR_EX]);
    
    if (amount === 0) {
      skipped++;
      continue;
    }
    
    const financialAccountCode = determineFinancialAccount(cols, email, date, clientHistory);
    
    const row = {
      source: 'invoice-orders',
      file_name: 'Revenue Import 2024-2025',
      date: date,
      description: cols[COL.PRODUCTS]?.trim() || cols[COL.PRODUCTS_WEB]?.trim() || 'Revenue Import',
      amount: amount,
      currency: cols[COL.CURRENCY]?.trim() || 'EUR',
      reconciled: false,
      custom_data: {
        email: cols[COL.EMAIL]?.trim(),
        customer_name: cols[COL.CLIENT_NAME]?.trim() || cols[COL.COMPANY]?.trim(),
        product: cols[COL.PRODUCTS]?.trim(),
        financial_account_code: financialAccountCode,
        big_line: cols[COL.BIG_LINE]?.trim(),
        invoice_number: cols[COL.INVOICE_NUMBER]?.trim(),
        order_date: cols[COL.ORDER_DATE]?.trim(),
        country: cols[COL.COUNTRY]?.trim(),
        region: cols[COL.FROM_WHERE]?.trim(),
        base_amount: parseEuroNumber(cols[COL.BASE_AMOUNT]),
        discount: parseEuroNumber(cols[COL.DISCOUNT]),
        is_clinic: cols[COL.IS_CLINIC]?.trim() === 'Yes',
        pc_points: cols[COL.PC_POINTS]?.trim(),
        import_source: 'revenue-import-2024-2025',
        imported_at: new Date().toISOString(),
      }
    };
    
    rowsToInsert.push(row);
  }
  
  console.log(`   ✅ Linhas a inserir: ${rowsToInsert.length}`);
  console.log(`   ⏭️ Linhas puladas (sem valor): ${skipped}`);
  
  return rowsToInsert;
}

// ============================================================================
// INSERIR NO SUPABASE
// ============================================================================

async function insertBatch(batch, batchNum, totalBatches) {
  const { error } = await supabase.from('csv_rows').insert(batch);
  
  if (error) {
    console.error(`   ❌ Erro no batch ${batchNum}:`, error.message);
    return false;
  }
  
  console.log(`   ✅ Batch ${batchNum}/${totalBatches} inserido (${batch.length} linhas)`);
  return true;
}

async function insertAllRows(rowsToInsert) {
  console.log('\n🚀 Iniciando inserção no Supabase...');
  
  const BATCH_SIZE = 500;
  const totalBatches = Math.ceil(rowsToInsert.length / BATCH_SIZE);
  let successCount = 0;
  
  for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
    const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    
    const success = await insertBatch(batch, batchNum, totalBatches);
    if (success) successCount += batch.length;
    
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`\n🎉 Importação concluída! ${successCount} linhas inseridas.`);
  return successCount;
}

// ============================================================================
// FUNÇÃO PRINCIPAL
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   IMPORTAÇÃO DE RECEITAS 2024/2025 (v2 - Com Histórico)');
  console.log('═══════════════════════════════════════════════════════════════');
  
  // 1. Verificar e deletar dados anteriores
  const { count: existingCount } = await supabase
    .from('csv_rows')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'invoice-orders')
    .contains('custom_data', { import_source: 'revenue-import-2024-2025' });
  
  if (existingCount > 0) {
    console.log(`\n⚠️ Deletando ${existingCount} linhas importadas anteriormente...`);
    
    const { error: deleteError } = await supabase
      .from('csv_rows')
      .delete()
      .eq('source', 'invoice-orders')
      .contains('custom_data', { import_source: 'revenue-import-2024-2025' });
    
    if (deleteError) {
      console.error('   ❌ Erro ao deletar:', deleteError.message);
      return;
    }
    console.log('   ✅ Dados anteriores deletados.');
  }
  
  // 2. Buscar histórico existente no banco
  const existingHistory = await getExistingHistory();
  
  // 3. Processar CSV e construir histórico
  const { csvHistory, incurredLines } = buildCSVHistory();
  
  // 4. Mesclar históricos
  const mergedHistory = mergeHistories(existingHistory, csvHistory);
  
  // 5. Preparar linhas para inserção
  const rowsToInsert = prepareRowsForInsert(incurredLines, mergedHistory);
  
  // 6. Mostrar estatísticas
  const faStats = {};
  for (const row of rowsToInsert) {
    const fa = row.custom_data.financial_account_code;
    if (!faStats[fa]) faStats[fa] = { count: 0, total: 0 };
    faStats[fa].count++;
    faStats[fa].total += row.amount;
  }
  
  console.log('\n📊 Estatísticas por Financial Account:');
  Object.entries(faStats)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([fa, stats]) => {
      console.log(`   ${fa}: ${stats.count} linhas, €${stats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    });
  
  // 7. Inserir no Supabase
  await insertAllRows(rowsToInsert);
}

main().catch(console.error);
