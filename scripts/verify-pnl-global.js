#!/usr/bin/env node
/**
 * Verify what the PnL API actually returns for GLOBAL scope (2025)
 * Simulates the exact logic of the expense and revenue APIs
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

async function checkRevenue() {
    console.log('═══ REVENUE (GLOBAL 2025) ═══');
    let allData = [];
    let offset = 0;
    while (true) {
        const { data, error } = await supabase
            .from('csv_rows')
            .select('source, date, amount, custom_data')
            .in('source', ['invoice-orders', 'invoice-orders-usd'])
            .gte('date', '2025-01-01')
            .lte('date', '2025-12-31')
            .range(offset, offset + 999);
        if (error) { console.error('Revenue error:', error.message); return; }
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        offset += 1000;
        if (data.length < 1000) break;
    }

    console.log(`Records: ${allData.length}`);

    let totalByMonth = new Array(12).fill(0);
    let byFA = {};
    let validCount = 0;
    let skipped = 0;

    for (const row of allData) {
        if (!row.date || !row.custom_data) { skipped++; continue; }
        const cd = typeof row.custom_data === 'string' ? JSON.parse(row.custom_data) : row.custom_data;
        const group = cd.group || cd.Group || '';
        if (group !== 'Incurred') { skipped++; continue; }

        const fa = cd.financial_account || cd.financialAccount || '';
        if (!fa) { skipped++; continue; }

        const amount = row.amount || 0;
        const monthIdx = parseInt(row.date.substring(5, 7), 10) - 1;
        if (monthIdx < 0 || monthIdx > 11) { skipped++; continue; }

        totalByMonth[monthIdx] += amount;
        byFA[fa] = (byFA[fa] || 0) + amount;
        validCount++;
    }

    const grandTotal = totalByMonth.reduce((a, b) => a + b, 0);
    console.log(`Valid Incurred: ${validCount}, Skipped: ${skipped}`);
    console.log(`Monthly: ${totalByMonth.map((v, i) => `${monthKeys[i]}=${Math.round(v)}`).join(', ')}`);
    console.log(`Revenue TOTAL: ${Math.round(grandTotal)}`);
    console.log(`Target: 8,548,579`);
    console.log(`Diff: ${Math.round(grandTotal - 8548579)}`);

    // Top FAs
    const sorted = Object.entries(byFA).sort((a, b) => b[1] - a[1]);
    console.log('\nTop 15 FAs:');
    for (const [fa, total] of sorted.slice(0, 15)) {
        console.log(`  ${fa}: ${Math.round(total)}`);
    }
}

async function checkExpenses() {
    console.log('\n═══ EXPENSES (GLOBAL 2025) ═══');
    let allData = [];
    let offset = 0;
    while (true) {
        const { data, error } = await supabase
            .from('invoices')
            .select('benefit_date, invoice_amount, financial_account_code, invoice_type')
            .eq('dre_impact', true)
            .gte('benefit_date', '2025-01-01')
            .lte('benefit_date', '2025-12-31')
            .range(offset, offset + 999);
        if (error) { console.error('Expense error:', error.message); return; }
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        offset += 1000;
        if (data.length < 1000) break;
    }

    console.log(`Records: ${allData.length}`);

    let totalByMonth = new Array(12).fill(0);
    let actualCount = 0;
    let budgetCount = 0;

    for (const row of allData) {
        if (!row.benefit_date || !row.financial_account_code) continue;
        const amount = row.invoice_amount || 0;
        if (amount === 0) continue;

        const rawFA = row.financial_account_code;
        const fa = rawFA.includes(' - ') ? rawFA.split(' - ')[0].trim() : rawFA.trim();
        if (fa === '0000' || fa === '400.0') continue;

        if (row.invoice_type === 'BUDGET') {
            budgetCount++;
            continue;
        }

        const monthIdx = parseInt(row.benefit_date.substring(5, 7), 10) - 1;
        if (monthIdx < 0 || monthIdx > 11) continue;

        totalByMonth[monthIdx] += amount;
        actualCount++;
    }

    const grandTotal = totalByMonth.reduce((a, b) => a + b, 0);
    console.log(`Actual: ${actualCount}, Budget: ${budgetCount}`);
    console.log(`Monthly: ${totalByMonth.map((v, i) => `${monthKeys[i]}=${Math.round(v)}`).join(', ')}`);
    console.log(`Expenses TOTAL: ${Math.round(grandTotal)}`);
    console.log(`Target: 8,380,612`);
    console.log(`Diff: ${Math.round(grandTotal - 8380612)}`);
}

async function main() {
    await checkRevenue();
    await checkExpenses();

    console.log('\n═══ P&L SUMMARY (GLOBAL 2025) ═══');
    console.log('Target:  Revenue=8,548,579  Expenses=8,380,612  Profit=167,967');
}

main().catch(console.error);
