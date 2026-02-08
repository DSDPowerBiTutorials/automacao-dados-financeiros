#!/usr/bin/env node
/**
 * fix-cross-fa-credits.js
 * 
 * The fix-negative-invoices.js script matched CSV negative rows (with parentheses)
 * to DB rows by date+description but NOT by financial_account_code.
 * This caused credit notes to be applied to wrong FA codes.
 * 
 * Example: CSV has "Descuento Guard Flex" (152,8) in 202.3 and "-" in 202.4
 * But the fix script matched the 202.3 CSV amount to the 202.4 DB row.
 * Result: 202.4 got -152.8 instead of 0.
 * 
 * This script:
 * 1. Reads the FULL CSV and builds the CORRECT amount for each FA+date+description
 * 2. Compares with the current DB values
 * 3. Fixes all mismatches
 * 
 * Usage:
 *   node scripts/fix-cross-fa-credits.js              # Dry-run
 *   node scripts/fix-cross-fa-credits.js --apply      # Apply fixes
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseEuropeanNumber(str) {
    if (!str) return 0;
    let s = str.trim();
    if (s === '-' || s === '') return 0;
    const isNeg = s.startsWith('(') && s.endsWith(')');
    if (isNeg) s = s.slice(1, -1).trim();
    const cleaned = s.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(cleaned);
    if (isNaN(val)) return 0;
    return isNeg ? -val : val;
}

function parseDate(str) {
    if (!str) return null;
    const p = str.trim().split('/');
    if (p.length !== 3) return null;
    return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
}

function normalizeDesc(s) {
    return (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

async function main() {
    const csvPath = path.join(__dirname, '..', 'public', 'epenses.csv');
    const raw = fs.readFileSync(csvPath, 'utf-8');
    const lines = raw.split('\n').filter(l => l.trim());
    const apply = process.argv.includes('--apply');

    console.log(`📂 CSV loaded: ${lines.length} lines`);
    console.log(`Mode: ${apply ? '🔴 APPLY' : '🟡 DRY RUN'}\n`);

    // Step 1: Parse CSV and build expected values map
    // Key: FA_CODE|DATE|DESCRIPTION_NORMALIZED → expected amount
    const csvExpected = new Map();
    const csvRows = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';');
        const group = (cols[0] || '').trim();
        const subGroup = (cols[1] || '').trim();
        const amountStr = (cols[2] || '').trim();
        const benefitDate = parseDate((cols[4] || '').trim());
        const description = (cols[6] || '').trim();

        const faMatch = subGroup.match(/(\d+\.\d+(?:\.\d+)?)/);
        const faCode = faMatch ? faMatch[1] : '';

        if (!faCode || !benefitDate) continue;

        const amount = parseEuropeanNumber(amountStr);
        const key = `${faCode}|${benefitDate}|${normalizeDesc(description)}`;

        csvRows.push({ line: i + 1, faCode, benefitDate, description, amount, amountStr, group, key });
        csvExpected.set(key, { amount, amountStr, faCode, benefitDate, description });
    }

    console.log(`📊 Parsed ${csvRows.length} CSV rows, ${csvExpected.size} unique keys\n`);

    // Step 2: Load ALL invoices that are INCURRED type from DB
    let allInvoices = [];
    let offset = 0;
    while (true) {
        const { data, error } = await supabase
            .from('invoices')
            .select('id, invoice_amount, financial_account_code, benefit_date, description, invoice_type, provider_code')
            .eq('dre_impact', true)
            .neq('invoice_type', 'BUDGET')
            .range(offset, offset + 999);
        if (error) { console.error('Error:', error); return; }
        if (!data || data.length === 0) break;
        allInvoices = allInvoices.concat(data);
        offset += 1000;
        if (data.length < 1000) break;
    }

    console.log(`📊 Loaded ${allInvoices.length} invoices from DB\n`);

    // Step 3: For each DB invoice, check if the CSV expected a different amount
    const fixes = [];
    let checked = 0;

    for (const inv of allInvoices) {
        const key = `${inv.financial_account_code}|${inv.benefit_date}|${normalizeDesc(inv.description)}`;
        const expected = csvExpected.get(key);

        if (expected) {
            checked++;
            if (Math.abs(inv.invoice_amount - expected.amount) > 0.01) {
                fixes.push({
                    id: inv.id,
                    fa: inv.financial_account_code,
                    date: inv.benefit_date,
                    desc: inv.description,
                    currentAmount: inv.invoice_amount,
                    expectedAmount: expected.amount,
                    csvAmountStr: expected.amountStr,
                });
            }
        }
    }

    console.log(`✅ Matched ${checked} DB entries to CSV`);
    console.log(`🔧 Entries needing correction: ${fixes.length}\n`);

    if (fixes.length === 0) {
        console.log('Nothing to fix!');
        return;
    }

    // Categorize fixes
    const wrongNegatives = fixes.filter(f => f.currentAmount < 0 && f.expectedAmount === 0);
    const wrongPositives = fixes.filter(f => f.currentAmount > 0 && f.expectedAmount === 0);
    const wrongZeros = fixes.filter(f => f.currentAmount === 0 && f.expectedAmount !== 0);
    const wrongValues = fixes.filter(f => f.currentAmount !== 0 && f.expectedAmount !== 0 && Math.abs(f.currentAmount - f.expectedAmount) > 0.01);

    console.log('Breakdown:');
    console.log(`  Phantom negatives (should be 0): ${wrongNegatives.length} | Impact: €${wrongNegatives.reduce((s, f) => s + f.currentAmount, 0).toFixed(2)}`);
    console.log(`  Phantom positives (should be 0): ${wrongPositives.length} | Impact: €${wrongPositives.reduce((s, f) => s + f.currentAmount, 0).toFixed(2)}`);
    console.log(`  Missing values (0 should be X): ${wrongZeros.length} | Impact: €${wrongZeros.reduce((s, f) => s + f.expectedAmount, 0).toFixed(2)}`);
    console.log(`  Wrong values (X should be Y):   ${wrongValues.length}`);

    // Show by FA code
    const byFA = {};
    for (const f of fixes) {
        if (!byFA[f.fa]) byFA[f.fa] = { count: 0, impact: 0 };
        byFA[f.fa].count++;
        byFA[f.fa].impact += (f.currentAmount - f.expectedAmount);
    }
    console.log('\nImpact by FA code:');
    Object.entries(byFA).sort((a, b) => a[0].localeCompare(b[0])).forEach(([fa, v]) => {
        console.log(`  ${fa}: ${v.count} entries, impact €${v.impact.toFixed(2)}`);
    });

    // Show samples
    console.log('\nSample fixes:');
    fixes.slice(0, 20).forEach(f => {
        console.log(`  ${f.date} | ${f.fa} | ${f.currentAmount} → ${f.expectedAmount} (CSV: "${f.csvAmountStr}") | ${f.desc.substring(0, 35)}`);
    });

    if (!apply) {
        console.log('\n🟡 DRY RUN — Run with --apply to execute fixes');
        return;
    }

    // Step 4: Apply fixes in batches
    console.log(`\n🔴 Applying ${fixes.length} fixes...`);
    let applied = 0;
    let errors = 0;

    for (let i = 0; i < fixes.length; i += 50) {
        const batch = fixes.slice(i, i + 50);
        for (const f of batch) {
            const { error } = await supabase
                .from('invoices')
                .update({ invoice_amount: f.expectedAmount })
                .eq('id', f.id);
            if (error) {
                console.error(`  ❌ Error updating ${f.id}:`, error.message);
                errors++;
            } else {
                applied++;
            }
        }
        console.log(`  Progress: ${Math.min(i + 50, fixes.length)}/${fixes.length}`);
    }

    console.log(`\n✅ Applied: ${applied}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`\nTotal impact corrected: €${fixes.reduce((s, f) => s + (f.currentAmount - f.expectedAmount), 0).toFixed(2)}`);
}

main().catch(console.error);
