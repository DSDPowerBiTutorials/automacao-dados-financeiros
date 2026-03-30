#!/usr/bin/env node
/**
 * Compare DB expense monthly data (GLOBAL scope) vs Excel reference
 * This validates that the DB actually has the right data
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Excel reference monthly data (from user's message)
const EXCEL = {
    '201.0': [67420, 34632, 438858, 78186, 153128, 102316, 42651, 45562, 69615, 185980, 72453, 61777],
    '202.0': [393683, 391524, 401966, 398854, 400024, 393906, 386675, 397558, 400048, 388729, 390266, 375890],
    '202.7': [55107, 53267, 53141, 61856, 60672, 61963, 56470, 54066, 57372, 63952, 68403, 63248],
    '203.0': [7003, 7117, 33950, 10776, 15628, 10587, 5653, 7526, 10964, 21735, 2154, 2309],
    '204.0': [2874, 2858, 2843, 7138, 2827, 2827, 2812, 2812, 2978, 5718, 2734, 2702],
    '205.0': [3740, 4600, 3924, 4524, 3428, 3610, 4330, 5141, 6407, 10234, 10750, 8084],
    '206.0': [72088, 78274, 72584, 68910, 90023, 78870, 65328, 66563, 79425, 66759, 117797, 68151],
    '207.0': [33641, 31216, 41168, 25524, 38488, 41148, 28018, 34560, 46946, 29436, 35351, 26696],
    '209.0': [18999, 15309, 16839, 19624, 24044, 17808, 13101, 14429, 14041, 24998, 15172, 18005],
    '211.0': [13345, 13345, 13345, 13345, 13345, 13345, 13345, 13345, 13345, 13345, 13345, 13345],
    '300.0': [25579, 28891, 35368, 36575, 41629, 46129, 24383, 27959, 27392, 16063, 40977, 3193],
};

async function main() {
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

        if (error) { console.error('DB Error:', error.message); return; }
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        offset += pageSize;
        if (data.length < pageSize) break;
    }

    // Build monthly data by parent category (GLOBAL scope = no scope filter)
    const dbMonthly = {};

    for (const row of allData) {
        if (!row.benefit_date || !row.financial_account_code) continue;
        if (row.invoice_type === 'BUDGET') continue;

        const amount = row.invoice_amount || 0;
        if (amount === 0) continue;

        const monthIdx = parseInt(row.benefit_date.substring(5, 7), 10) - 1;
        if (monthIdx < 0 || monthIdx > 11) continue;

        const rawFA = row.financial_account_code;
        const fa = rawFA.includes(' - ') ? rawFA.split(' - ')[0].trim() : rawFA.trim();
        if (fa === '0000' || fa === '400.0') continue;

        let mappedFA = fa;
        if (fa === '209.1' || fa === '209.2') mappedFA = '209.0';

        // Parent category (but keep 202.7 separate for comparison)
        const parentCat = mappedFA === '202.7' ? '202.7'
            : mappedFA.substring(0, 3) + '.0';

        if (!dbMonthly[parentCat]) dbMonthly[parentCat] = new Array(12).fill(0);
        dbMonthly[parentCat][monthIdx] += amount;
    }

    // Note: For 202.0 parent in Excel, it INCLUDES 202.7
    // So DB '202.0' parent should also include 202.7 for comparison
    // The user listed 202.0 and 202.7 separately in the PnL, but 202.0 parent sum includes 202.7

    console.log('=== Monthly Comparison: DB (GLOBAL) vs Excel ===\n');

    let totalDbYear = 0;
    let totalExcelYear = 0;

    for (const cat of Object.keys(EXCEL).sort()) {
        const excelArr = EXCEL[cat];
        const dbArr = dbMonthly[cat] || new Array(12).fill(0);

        const excelTotal = excelArr.reduce((a, b) => a + b, 0);
        const dbTotal = dbArr.reduce((a, b) => a + b, 0);
        const yearDiff = Math.round(dbTotal - excelTotal);

        // Don't double-count 202.7 in total (it's part of 202.0 parent)
        if (cat !== '202.7') {
            totalDbYear += dbTotal;
            totalExcelYear += excelTotal;
        }

        console.log(`--- ${cat} (Annual: DB=${Math.round(dbTotal)} Excel=${excelTotal} Diff=${yearDiff > 0 ? '+' : ''}${yearDiff}) ---`);

        let hasMonthlyDiff = false;
        for (let m = 0; m < 12; m++) {
            const diff = Math.round(dbArr[m]) - excelArr[m];
            if (Math.abs(diff) > 10) {
                if (!hasMonthlyDiff) { hasMonthlyDiff = true; console.log('  Monthly diffs:'); }
                console.log(`    ${months[m]}: DB=${Math.round(dbArr[m])} Excel=${excelArr[m]} Diff=${diff > 0 ? '+' : ''}${diff}`);
            }
        }
        if (!hasMonthlyDiff) console.log('  ✅ All months match (within ±10)');
        console.log();
    }

    // For 202.0 check: add 202.7 to the parent total
    const db202parent = (dbMonthly['202.0'] || new Array(12).fill(0)).map((v, i) => v + (dbMonthly['202.7'] ? dbMonthly['202.7'][i] : 0));
    const excel202parent = EXCEL['202.0'];
    console.log('--- 202.0 PARENT (with 202.7 included in DB) ---');
    const db202total = db202parent.reduce((a, b) => a + b, 0);
    const excel202total = excel202parent.reduce((a, b) => a + b, 0);
    console.log(`  Annual: DB=${Math.round(db202total)} Excel=${excel202total} Diff=${Math.round(db202total - excel202total)}`);
    let hasParentDiff = false;
    for (let m = 0; m < 12; m++) {
        const diff = Math.round(db202parent[m]) - excel202parent[m];
        if (Math.abs(diff) > 10) {
            if (!hasParentDiff) { hasParentDiff = true; console.log('  Monthly diffs:'); }
            console.log(`    ${months[m]}: DB=${Math.round(db202parent[m])} Excel=${excel202parent[m]} Diff=${diff > 0 ? '+' : ''}${diff}`);
        }
    }
    if (!hasParentDiff) console.log('  ✅ All months match (within ±10)');

    // Total comparison
    // Correct total: 202.0 parent already includes 202.7 in the DB
    // So for total we use dbMonthly categories excluding separate 202.7
    const allCats = Object.keys(dbMonthly).filter(c => c !== '202.7' && c !== '0000' && c !== '400.0');
    const grandDB = allCats.reduce((s, c) => s + (dbMonthly[c] || []).reduce((a, b) => a + b, 0), 0);

    console.log(`\n=== GRAND TOTAL: DB=${Math.round(grandDB)} Excel=${totalExcelYear} Diff=${Math.round(grandDB - totalExcelYear)} ===`);
}

main().catch(console.error);
