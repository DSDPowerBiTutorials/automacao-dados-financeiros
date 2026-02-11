#!/usr/bin/env node

/**
 * Script de diagnóstico: verifica que dados existem na base para cada fonte
 * e identifica gaps para o Consolidated Cashflow funcionar.
 * 
 * Uso: node scripts/check-gateway-data-coverage.js [year]
 * Exemplo: node scripts/check-gateway-data-coverage.js 2025
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const YEAR = process.argv[2] || '2025';
const START = `${YEAR}-01-01`;
const END = `${YEAR}-12-31`;

// Sources relevantes para o Consolidated Cashflow
const SOURCES = [
    // Bancos
    { source: 'bankinter-eur', label: '🏦 Bankinter EUR', type: 'bank' },
    { source: 'bankinter-usd', label: '🏦 Bankinter USD', type: 'bank' },
    // Gateways — Revenue
    { source: 'braintree-api-revenue', label: '🔷 Braintree Revenue', type: 'gateway', filter: { currency: 'EUR' }, filterLabel: 'EUR' },
    { source: 'braintree-api-revenue', label: '🔷 Braintree Revenue', type: 'gateway', filter: { currency: 'USD' }, filterLabel: 'USD' },
    { source: 'braintree-api-revenue', label: '🔷 Braintree Revenue', type: 'gateway', filter: { currency: 'GBP' }, filterLabel: 'GBP' },
    { source: 'braintree-api-fees', label: '🔷 Braintree Fees', type: 'gateway' },
    { source: 'stripe-eur', label: '🟣 Stripe EUR', type: 'gateway' },
    { source: 'stripe-usd', label: '🟣 Stripe USD', type: 'gateway' },
    // Gateways — Payouts (para reconciliação)
    { source: 'stripe-eur-payouts', label: '🟣 Stripe EUR Payouts', type: 'payout' },
    { source: 'stripe-usd-payouts', label: '🟣 Stripe USD Payouts', type: 'payout' },
    { source: 'gocardless', label: '🟢 GoCardless', type: 'gateway' },
    // Outros
    { source: 'paypal', label: '🅿️  PayPal', type: 'gateway' },
    { source: 'invoice-orders', label: '📄 Invoice Orders', type: 'revenue' },
];

async function fetchAllRows(source, startDate, endDate) {
    const all = [];
    let offset = 0;
    while (true) {
        const { data, error } = await supabase
            .from('csv_rows')
            .select('date, amount, reconciled, custom_data')
            .eq('source', source)
            .gte('date', startDate)
            .lte('date', endDate)
            .range(offset, offset + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < 1000) break;
        offset += 1000;
    }
    return all;
}

async function checkCoverage() {
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`📊 DIAGNÓSTICO DE DADOS — Ano ${YEAR}`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);

    for (const src of SOURCES) {
        let filteredData;
        try {
            const allData = await fetchAllRows(src.source, START, END);

            // Apply custom_data filter if needed (e.g. currency)
            filteredData = allData;
            if (src.filter) {
                filteredData = allData.filter(row => {
                    for (const [key, value] of Object.entries(src.filter)) {
                        if (row.custom_data?.[key]?.toUpperCase() !== value.toUpperCase()) return false;
                    }
                    return true;
                });
            }
        } catch (error) {
            console.log(`${src.label} (${src.source}): ❌ Erro — ${error.message}`);
            continue;
        }

        if (filteredData.length === 0) {
            const filterLabel = src.filterLabel ? ` [${src.filterLabel}]` : '';
            console.log(`${src.label}${filterLabel} (${src.source}): ⚠️  SEM DADOS em ${YEAR}`);
            continue;
        }

        // Calculate stats
        const dates = filteredData.map(r => r.date).sort();
        const amounts = filteredData.map(r => parseFloat(r.amount) || 0);
        const total = amounts.reduce((a, b) => a + b, 0);
        const reconciled = filteredData.filter(r => r.reconciled).length;
        const reconciledWithSource = filteredData.filter(r => r.reconciled && r.custom_data?.paymentSource).length;

        // Monthly breakdown
        const byMonth = {};
        for (const row of filteredData) {
            const m = row.date?.substring(0, 7);
            if (!m) continue;
            if (!byMonth[m]) byMonth[m] = { count: 0, amount: 0 };
            byMonth[m].count++;
            byMonth[m].amount += parseFloat(row.amount) || 0;
        }

        const filterLabel = src.filterLabel ? ` [${src.filterLabel}]` : '';
        console.log(`${src.label}${filterLabel} (${src.source}):`);
        console.log(`   📏 Rows: ${filteredData.length} | Datas: ${dates[0]} → ${dates[dates.length - 1]}`);
        console.log(`   💰 Total: ${total.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`);

        if (src.type === 'bank') {
            console.log(`   ✅ Reconciliados: ${reconciled} (${((reconciled / filteredData.length) * 100).toFixed(1)}%)`);
            console.log(`   🏷️  Com paymentSource: ${reconciledWithSource} (${((reconciledWithSource / filteredData.length) * 100).toFixed(1)}%)`);
        }

        // Check monthly coverage
        const months = [];
        for (let m = 1; m <= 12; m++) {
            months.push(`${YEAR}-${String(m).padStart(2, '0')}`);
        }
        const missingMonths = months.filter(m => !byMonth[m]);
        if (missingMonths.length > 0) {
            console.log(`   ⚠️  Meses sem dados: ${missingMonths.join(', ')}`);
        } else {
            console.log(`   ✅ Todos os 12 meses cobertos`);
        }

        // Monthly detail
        const monthStrs = Object.entries(byMonth)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([m, s]) => `${m.substring(5)}:${s.count}`)
            .join(' | ');
        console.log(`   📅 ${monthStrs}`);
        console.log('');
    }

    // ============================================================
    // Reconciliation readiness check
    // ============================================================
    console.log(`═══════════════════════════════════════════════════════════════`);
    console.log(`🔗 VERIFICAÇÃO DE RECONCILIAÇÃO`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);

    // Check bank rows that have credits (positive amounts) — with pagination
    const allBankRows = await fetchAllRows('bankinter-eur', START, END);
    const bankCredits = allBankRows.filter(r => parseFloat(r.amount) > 0);

    if (bankCredits.length > 0) {
        const totalCredits = bankCredits.length;
        const reconciledCredits = bankCredits.filter(r => r.reconciled).length;
        const withPaymentSource = bankCredits.filter(r => r.reconciled && r.custom_data?.paymentSource).length;

        // Breakdown by paymentSource
        const bySource = {};
        bankCredits.filter(r => r.custom_data?.paymentSource).forEach(r => {
            const ps = r.custom_data.paymentSource;
            if (!bySource[ps]) bySource[ps] = { count: 0, amount: 0 };
            bySource[ps].count++;
            bySource[ps].amount += parseFloat(r.amount) || 0;
        });

        console.log(`🏦 Bankinter EUR — Créditos (inflows) em ${YEAR}:`);
        console.log(`   Total créditos: ${totalCredits}`);
        console.log(`   Reconciliados:  ${reconciledCredits} (${((reconciledCredits / totalCredits) * 100).toFixed(1)}%)`);
        console.log(`   Com paymentSource (visíveis no Revenue Cashflow): ${withPaymentSource} (${((withPaymentSource / totalCredits) * 100).toFixed(1)}%)`);
        console.log('');

        if (Object.keys(bySource).length > 0) {
            console.log('   Breakdown por gateway:');
            for (const [src, s] of Object.entries(bySource).sort((a, b) => b[1].amount - a[1].amount)) {
                console.log(`     ${src}: ${s.count} transações → €${s.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`);
            }
        }

        // Check Braintree disbursement_date availability — with pagination
        const btRevenue = await fetchAllRows('braintree-api-revenue', START, END);

        if (btRevenue.length > 0) {
            const withDisb = btRevenue.filter(r => r.custom_data?.disbursement_date).length;
            console.log(`\n   🔷 Braintree disbursement_date: ${withDisb}/${btRevenue.length} (${((withDisb / btRevenue.length) * 100).toFixed(1)}%)`);
            if (withDisb < btRevenue.length * 0.8) {
                console.log(`      ⚠️  Muitas transações sem disbursement_date — reconciliação pode ser parcial.`);
            }
        }
    }

    // Summary of what's needed
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`📋 ACÇÕES NECESSÁRIAS`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);

    // Use exact count queries
    const countQuery = async (source) => {
        const { count } = await supabase.from('csv_rows').select('id', { count: 'exact', head: true })
            .eq('source', source).gte('date', START).lte('date', END);
        return count || 0;
    };

    const [btCount, strEurCount, strUsdCount, gcCount] = await Promise.all([
        countQuery('braintree-api-revenue'),
        countQuery('stripe-eur'),
        countQuery('stripe-usd'),
        countQuery('gocardless'),
    ]);

    if (btCount === 0) {
        console.log(`1. 🔷 BRAINTREE: Importar dados via Excel`);
        console.log(`   → node scripts/import-braintree-excel.js data/braintree-2025-eur.csv --currency EUR --dry-run`);
        console.log(`   → node scripts/import-braintree-excel.js data/braintree-2025-usd.csv --currency USD --dry-run`);
        console.log(`   → node scripts/import-braintree-excel.js data/braintree-2025-gbp.csv --currency GBP --dry-run\n`);
    } else {
        console.log(`1. 🔷 BRAINTREE: ✅ Dados presentes (${btCount} rows)`);
    }

    if (strEurCount === 0) {
        console.log(`2. 🟣 STRIPE EUR: Sincronizar via API`);
        console.log(`   → curl -X POST http://localhost:3000/api/stripe/sync-all -d '{"sinceDate":"${START}"}'\n`);
    } else {
        console.log(`2. 🟣 STRIPE EUR: ✅ Dados presentes (${strEurCount} rows)`);
    }

    if (strUsdCount === 0) {
        console.log(`3. 🟣 STRIPE USD: Sincronizar via API (incluído no sync-all)`);
    } else {
        console.log(`3. 🟣 STRIPE USD: ✅ Dados presentes (${strUsdCount} rows)`);
    }

    if (gcCount === 0) {
        console.log(`4. 🟢 GOCARDLESS: Sincronizar via API`);
        console.log(`   → curl -X POST http://localhost:3000/api/gocardless/sync -d '{"sinceDate":"${START}"}'\n`);
    } else {
        console.log(`4. 🟢 GOCARDLESS: ✅ Dados presentes (${gcCount} rows)`);
    }

    console.log(`\n5. 🔗 Após carregar dados, executar reconciliação:`);
    console.log(`   → curl -X POST http://localhost:3000/api/reconcile/bank-disbursement -d '{"bankSource":"bankinter-eur","dryRun":true}'`);
    console.log(`   → (analisar resultado, depois) dryRun:false para gravar\n`);
}

checkCoverage().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
