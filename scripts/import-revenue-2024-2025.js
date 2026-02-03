/**
 * Script para importar receitas de 2024/2025 para Invoice Orders
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
console.log('📋 Colunas:', header);

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

// Map para rastrear clientes e suas compras anteriores (para determinar New vs Contracted)
const clientHistory = new Map(); // email -> { firstDelightDate, firstPCDate, firstLabDate, isClinic }

// Função para parsear data DD/MM/YYYY
function parseDate(dateStr) {
  if (!dateStr || dateStr === '-') return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Função para parsear número europeu (1.234,56 -> 1234.56)
function parseEuroNumber(numStr) {
  if (!numStr || numStr === '' || numStr === '-') return 0;
  // Remove pontos de milhar e troca vírgula por ponto
  const cleaned = numStr.toString().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Função para determinar se é USA (AMEX) ou ROW
function isUSA(country) {
  return country?.toLowerCase() === 'united states' || country?.toLowerCase() === 'usa';
}

// Função para determinar o subscriber level
function getSubscriberLevel(pcPoints, isClinic) {
  if (isClinic === 'Yes' || isClinic === true) return 'Lvl 3';
  if (pcPoints && parseInt(pcPoints) > 0) {
    const points = parseInt(pcPoints);
    if (points >= 1000) return 'Lvl 2'; // PC Membership
    return 'Lvl 1';
  }
  return 'Not a Subscriber';
}

// Primeira passada: construir histórico de clientes
console.log('\n🔍 Primeira passada: construindo histórico de clientes...');
const incurredLines = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  
  const cols = line.split(';');
  const dimension = cols[COL.FINANCIAL_DIMENSION]?.trim();
  
  // Só processar Incurred
  if (dimension !== 'Incurred') continue;
  
  const email = cols[COL.EMAIL]?.trim().toLowerCase();
  const dateStr = cols[COL.INVOICE_DATE]?.trim();
  const bigLine = cols[COL.BIG_LINE]?.trim();
  const isClinic = cols[COL.IS_CLINIC]?.trim();
  
  if (!email || email === 'no email') continue;
  
  const date = parseDate(dateStr);
  if (!date) continue;
  
  incurredLines.push({ index: i, cols, date, email, bigLine, isClinic });
  
  // Rastrear histórico do cliente
  if (!clientHistory.has(email)) {
    clientHistory.set(email, {
      firstDelightDate: null,
      firstPCDate: null,
      firstLabDate: null,
      isClinic: isClinic === 'Yes'
    });
  }
  
  const history = clientHistory.get(email);
  
  // Atualizar isClinic se encontrar Yes
  if (isClinic === 'Yes') {
    history.isClinic = true;
  }
  
  // Registrar primeira data por categoria
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

console.log(`📊 Clientes únicos encontrados: ${clientHistory.size}`);
console.log(`📊 Linhas Incurred: ${incurredLines.length}`);

// Ordenar por data para processar cronologicamente
incurredLines.sort((a, b) => a.date.localeCompare(b.date));

// Função para determinar o Financial Account correto
function determineFinancialAccount(cols, email, date, clientHistory) {
  const bigLine = cols[COL.BIG_LINE]?.trim();
  const originalFA = cols[COL.FINANCIAL_ACCOUNT]?.trim();
  const linha = cols[COL.LINHA]?.trim();
  const country = cols[COL.COUNTRY]?.trim();
  const pcPoints = cols[COL.PC_POINTS]?.trim();
  const isClinicStr = cols[COL.IS_CLINIC]?.trim();
  
  const isAMEX = isUSA(country);
  const history = clientHistory.get(email) || {};
  
  // Se já tem uma classificação na coluna LINHA, usar ela (foi corrigida manualmente)
  if (linha && linha.includes(' - ') && linha !== originalFA) {
    // A coluna LINHA tem a classificação correta
    const code = linha.match(/(\d+\.\d+)/)?.[1];
    if (code) return code;
  }
  
  // 102.0 - Delight (Monthly Fees / Clinic subscriptions)
  if (bigLine?.includes('102.0 - Delight')) {
    // Verificar se é Consultancy, Marketing Coaching ou Others
    if (originalFA?.includes('102.5')) return '102.5'; // Consultancies
    if (originalFA?.includes('102.6')) return '102.6'; // Marketing Coaching
    if (originalFA?.includes('102.7')) return '102.7'; // Others
    
    // Para assinaturas de Clinics (monthly fees)
    const isFirstDelight = history.firstDelightDate === date;
    
    if (isFirstDelight) {
      // Novo cliente
      return isAMEX ? '102.4' : '102.3'; // Level 3 New AMEX/ROW
    } else {
      // Cliente recorrente
      return isAMEX ? '102.2' : '102.1'; // Contracted AMEX/ROW
    }
  }
  
  // 103.0 - Planning Center
  if (bigLine?.includes('103.0 - Planning Center')) {
    const subscriberLevel = getSubscriberLevel(pcPoints, isClinicStr === 'Yes' || history.isClinic);
    
    if (subscriberLevel === 'Lvl 3') {
      const isFirstPC = history.firstPCDate === date;
      if (isFirstPC) {
        return isAMEX ? '103.4' : '103.3'; // Level 3 New AMEX/ROW
      } else {
        return isAMEX ? '103.2' : '103.1'; // Level 3 AMEX/ROW
      }
    } else if (subscriberLevel === 'Lvl 2') {
      return '103.5'; // Level 2
    } else if (subscriberLevel === 'Lvl 1') {
      return '103.6'; // Level 1
    } else {
      return '103.7'; // Not a Subscriber
    }
  }
  
  // 104.0 - LAB
  if (bigLine?.includes('104.0 - LAB')) {
    const subscriberLevel = getSubscriberLevel(pcPoints, isClinicStr === 'Yes' || history.isClinic);
    
    if (subscriberLevel === 'Lvl 3') {
      const isFirstLab = history.firstLabDate === date;
      if (isFirstLab) {
        return isAMEX ? '104.4' : '104.3'; // Level 3 New AMEX/ROW
      } else {
        return isAMEX ? '104.2' : '104.1'; // Level 3 AMEX/ROW
      }
    } else if (subscriberLevel === 'Lvl 2') {
      return '104.5'; // Level 2
    } else if (subscriberLevel === 'Lvl 1') {
      return '104.6'; // Level 1
    } else {
      return '104.7'; // Not a Subscriber
    }
  }
  
  // Para outras categorias (101, 105), usar o código original
  const code = originalFA?.match(/(\d+\.\d+)/)?.[1];
  return code || '999.0'; // Fallback
}

// Segunda passada: preparar dados para inserção
console.log('\n📝 Segunda passada: preparando dados para inserção...');
const rowsToInsert = [];
let skipped = 0;

for (const { cols, date, email } of incurredLines) {
  const amount = parseEuroNumber(cols[COL.EUR_EX]);
  
  // Pular linhas sem valor
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

console.log(`✅ Linhas a inserir: ${rowsToInsert.length}`);
console.log(`⏭️ Linhas puladas (sem valor): ${skipped}`);

// Estatísticas por Financial Account
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

// Inserir em batches
async function insertBatch(batch, batchNum, totalBatches) {
  const { data, error } = await supabase
    .from('csv_rows')
    .insert(batch);
  
  if (error) {
    console.error(`❌ Erro no batch ${batchNum}:`, error.message);
    return false;
  }
  
  console.log(`   ✅ Batch ${batchNum}/${totalBatches} inserido (${batch.length} linhas)`);
  return true;
}

async function main() {
  console.log('\n🚀 Iniciando inserção no Supabase...');
  
  // Primeiro, verificar se já existem dados importados
  const { count: existingCount } = await supabase
    .from('csv_rows')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'invoice-orders')
    .contains('custom_data', { import_source: 'revenue-import-2024-2025' });
  
  if (existingCount > 0) {
    console.log(`⚠️ Já existem ${existingCount} linhas importadas anteriormente.`);
    console.log('   Para reimportar, primeiro delete os dados existentes:');
    console.log("   DELETE FROM csv_rows WHERE source = 'invoice-orders' AND custom_data->>'import_source' = 'revenue-import-2024-2025';");
    return;
  }
  
  const BATCH_SIZE = 500;
  const totalBatches = Math.ceil(rowsToInsert.length / BATCH_SIZE);
  let successCount = 0;
  
  for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
    const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    
    const success = await insertBatch(batch, batchNum, totalBatches);
    if (success) successCount += batch.length;
    
    // Pequeno delay entre batches
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`\n🎉 Importação concluída! ${successCount} linhas inseridas.`);
}

main().catch(console.error);
