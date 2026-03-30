#!/usr/bin/env node
/**
 * Check current expense totals in the invoices table vs CSV vs Excel reference
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

// Excel reference totals by FA category
const EXCEL_REF = {
    '201.0': 1352578,
    '202.0': 4719124.0,  // excl 202.7
    '202.7': 709517,
    '203.0': 135403,
    '204.0': 41122,
    '205.0': 68772,
    '206.0': 924773,
    '207.0': 412193,
    '209.0': 212370,
    '211.0': 160140,
    '300.0': 354138,
};

async function main() {
    // 1. Get DB totals by FA code for 2025 Incurred+Adjustment
    let allData = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('invoices')
            .select('benefit_date, invoice_amount, financial_account_code, invoice_type')
            .eq('dre_impact', true)
            .gte('benefit_date', '2025-01-01')
            .lte('benefit_date', '2025-12-31')
            .range(offset, offset + pageSize - 1);

        if (error) {
            console.error('DB Error:', error.message);
            return;
        }
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        offset += pageSize;
        if (data.length < pageSize) break;
    }

    console.log(`📊 Total invoices loaded from DB: ${allData.length}`);

    const dbByFA = {};
    const dbByCat = {};
    let dbTotal = 0;
    let incurredCount = 0;
    let adjustmentCount = 0;
    let budgetCount = 0;

    for (const row of allData) {
        if (!row.benefit_date || !row.financial_account_code) continue;
        const amount = row.invoice_amount || 0;
        if (amount === 0) continue;

        const rawFA = row.financial_account_code;
        const fa = rawFA.includes(' - ') ? rawFA.split(' - ')[0].trim() : rawFA.trim();

        if (fa === '0000' || fa === '400.0') continue;

        let mappedFA = fa;
        if (fa === '209.1' || fa === '209.2') mappedFA = '209.0';

        if (row.invoice_type === 'BUDGET') {
            budgetCount++;
            continue;
        }

        if (row.invoice_type === 'ADJUSTMENT') adjustmentCount++;
        else incurredCount++;

        dbByFA[mappedFA] = (dbByFA[mappedFA] || 0) + amount;
        const cat = mappedFA === '202.7' ? '202.7' : mappedFA.substring(0, 3) + '.0';
        dbByCat[cat] = (dbByCat[cat] || 0) + amount;
        dbTotal += amount;
    }

    // 2. Get CSV totals (Incurred + Balance Adjustment)
    const CSV_PATH = path.join(__dirname, '..', 'public', 'epenses.csv');
    const lines = fs.readFileSync(CSV_PATH, 'utf-8').split('\n');
    const csvByFA = {};
    const csvByCat = {};
    let csvTotal = 0;

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';');
        const group = (cols[0] || '').trim();
        if (group !== 'Incurred' && group !== 'Balance Adjustment') continue;

        const dateStr = (cols[4] || '').trim();
        const parts = dateStr.split('/');
        if (parts.length < 3 || parts[2] !== '2025') continue;

        const sg = (cols[1] || '').trim();
        const m = sg.match(/(\d{3}\.[\d.]+)/);
        if (!m) continue;
        let fa = m[1];
        if (fa === '0000' || fa === '400.0') continue;
        if (fa === '209.1' || fa === '209.2') fa = '209.0';

        const raw = (cols[2] || '').trim();
        const num = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;

        csvByFA[fa] = (csvByFA[fa] || 0) + num;
        const cat = fa === '202.7' ? '202.7' : fa.substring(0, 3) + '.0';
        csvByCat[cat] = (csvByCat[cat] || 0) + num;
        csvTotal += num;
    }

    // 3. Print comparison
    console.log('\n=== COMPARISON: Excel vs CSV vs DB ===');
    console.log('Category\tExcel\t\tCSV\t\tDB\t\tDB-Excel');
    const allCats = new Set([...Object.keys(EXCEL_REF), ...Object.keys(csvByCat), ...Object.keys(dbByCat)]);
    const sorted = [...allCats].sort();
    let excelTotal = 0;

    for (const cat of sorted) {
        const excel = EXCEL_REF[cat] || 0;
        const csv = Math.round(csvByCat[cat] || 0);
        const db = Math.round(dbByCat[cat] || 0);
        const diff = db - excel;
        excelTotal += excel;
        console.log(`  ${cat}\t\t${excel}\t\t${csv}\t\t${db}\t\t${diff > 0 ? '+' : ''}${diff}`);
    }

    console.log(`  TOTAL\t\t${excelTotal}\t\t${Math.round(csvTotal)}\t\t${Math.round(dbTotal)}\t\t${Math.round(dbTotal - excelTotal)}`);
    console.log(`\n  DB records: Incurred=${incurredCount}, Adjustment=${adjustmentCount}, Budget=${budgetCount}`);

    // 4. Per-FA detail for categories with big differences
    console.log('\n=== FA Detail: DB vs CSV ===');
    const allFAs = new Set([...Object.keys(csvByFA), ...Object.keys(dbByFA)]);
    const sortedFAs = [...allFAs].sort();
    for (const fa of sortedFAs) {
        const csv = Math.round(csvByFA[fa] || 0);
        const db = Math.round(dbByFA[fa] || 0);
        const diff = db - csv;
        if (Math.abs(diff) > 100) {
            console.log(`  ${fa}\tCSV=${csv}\tDB=${db}\tDiff=${diff > 0 ? '+' : ''}${diff}`);
        }
    }
}

main().catch(console.error);
