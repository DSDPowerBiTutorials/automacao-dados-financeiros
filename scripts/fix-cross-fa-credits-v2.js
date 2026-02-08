#!/usr/bin/env node
/**
 * fix-cross-fa-credits-v2.js
 * 
 * ROOT CAUSE: fix-negative-invoices.js matched CSV credit notes to DB rows
 * by date+description but NOT by financial_account_code. This caused:
 *   - Pattern A: CSV has "-" (zero) for FA X, but DB got non-zero → phantom values
 *   - Pattern B: CSV has "(amount)" for FA Y, but DB stayed at 0 → missing values
 * 
 * This script handles both patterns:
 * 1. Find all CSV rows with "-" (should be 0) but DB has non-zero → reset to 0
 * 2. Find all CSV rows with "(amount)" (negative) but DB has 0 → apply correct amount
 * 
 * Usage:
 *   node scripts/fix-cross-fa-credits-v2.js              # Dry-run
 *   node scripts/fix-cross-fa-credits-v2.js --apply      # Apply fixes
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

function normDesc(s) {
    return (s || '').trim().toUpperCase().replace(/\s+/g, ' ').substring(0, 25);
}

async function main() {
    const csvPath = path.join(__dirname, '..', 'public', 'epenses.csv');
    const raw = fs.readFileSync(csvPath, 'utf-8');
    const lines = raw.split('\n').filter(l => l.trim());
    const apply = process.argv.includes('--apply');

    console.log(`📂 CSV loaded: ${lines.length} lines`);
    console.log(`Mode: ${apply ? '🔴 APPLY' : '🟡 DRY RUN'}\n`);

    // Parse all CSV rows
    const dashRows = []; // Amount = "-" (should be 0)
    const negRows = [];  // Amount = "(X)" (should be negative)

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';');
        const group = (cols[0] || '').trim();
        const subGroup = (cols[1] || '').trim();
        const amountStr = (cols[2] || '').trim();
        const benefitDate = parseDate((cols[4] || '').trim());
        const description = (cols[6] || '').trim();

        if (group === 'Budget' || group === 'Balance Adjustment') continue;

        const faMatch = subGroup.match(/(\d+\.\d+(?:\.\d+)?)/);
        const faCode = faMatch ? faMatch[1] : '';
        if (!faCode || !benefitDate) continue;

        if (amountStr === '-') {
            dashRows.push({ line: i + 1, faCode, benefitDate, description, amountStr });
        } else if (amountStr.startsWith('(') && amountStr.endsWith(')')) {
            const amount = parseEuropeanNumber(amountStr);
            negRows.push({ line: i + 1, faCode, benefitDate, description, amount, amountStr });
        }
    }

    console.log(`📊 Dash entries (should be 0): ${dashRows.length}`);
    console.log(`📊 Negative entries (credit notes): ${negRows.length}\n`);

    // ═══════════════════════════════════════════════════
    // PATTERN A: CSV has "-" but DB has non-zero
    // ═══════════════════════════════════════════════════
    console.log('═══ PATTERN A: Phantom values (CSV="-", DB≠0) ═══');
    const phantomFixes = [];

    for (const row of dashRows) {
        const desc20 = normDesc(row.description);
        if (!desc20) continue;

        const { data } = await supabase
            .from('invoices')
            .select('id, invoice_amount, financial_account_code, benefit_date, description, invoice_type')
            .eq('financial_account_code', row.faCode)
            .eq('benefit_date', row.benefitDate)
            .eq('invoice_type', 'INCURRED')
            .neq('invoice_amount', 0)
            .limit(20);

        if (!data) continue;

        // Find the specific row by description match
        for (const db of data) {
            if (normDesc(db.description) === desc20) {
                phantomFixes.push({
                    id: db.id,
                    fa: db.financial_account_code,
                    date: db.benefit_date,
                    desc: db.description,
                    currentAmount: db.invoice_amount,
                    correctAmount: 0,
                    reason: 'CSV has "-" → should be 0',
                });
                break; // Only fix one match per CSV row
            }
        }
    }

    const phantomNeg = phantomFixes.filter(f => f.currentAmount < 0);
    const phantomPos = phantomFixes.filter(f => f.currentAmount > 0);
    console.log(`  Phantom negatives: ${phantomNeg.length} | Impact: €${phantomNeg.reduce((s, f) => s + f.currentAmount, 0).toFixed(2)}`);
    console.log(`  Phantom positives: ${phantomPos.length} | Impact: €${phantomPos.reduce((s, f) => s + f.currentAmount, 0).toFixed(2)}`);
    console.log(`  Total phantom fixes: ${phantomFixes.length}`);

    // Show by FA
    const byFA_phantom = {};
    for (const f of phantomFixes) {
        if (!byFA_phantom[f.fa]) byFA_phantom[f.fa] = { count: 0, impact: 0 };
        byFA_phantom[f.fa].count++;
        byFA_phantom[f.fa].impact += f.currentAmount;
    }
    console.log('\n  By FA code:');
    Object.entries(byFA_phantom).sort((a, b) => a[0].localeCompare(b[0])).forEach(([fa, v]) => {
        console.log(`    ${fa}: ${v.count} entries, phantom impact €${v.impact.toFixed(2)}`);
    });

    console.log('\n  Sample phantom fixes:');
    phantomFixes.slice(0, 15).forEach(f => {
        console.log(`    ${f.date} | ${f.fa} | ${f.currentAmount} → 0 | ${f.desc.substring(0, 40)}`);
    });

    // ═══════════════════════════════════════════════════
    // PATTERN B: CSV has "(amount)" but DB still has 0
    // ═══════════════════════════════════════════════════
    console.log('\n═══ PATTERN B: Missing negatives (CSV="(X)", DB=0) ═══');
    const missingFixes = [];

    for (const row of negRows) {
        const desc20 = normDesc(row.description);
        if (!desc20) continue;

        const { data } = await supabase
            .from('invoices')
            .select('id, invoice_amount, financial_account_code, benefit_date, description, invoice_type')
            .eq('financial_account_code', row.faCode)
            .eq('benefit_date', row.benefitDate)
            .eq('invoice_type', 'INCURRED')
            .eq('invoice_amount', 0)
            .limit(20);

        if (!data) continue;

        for (const db of data) {
            if (normDesc(db.description) === desc20) {
                missingFixes.push({
                    id: db.id,
                    fa: db.financial_account_code,
                    date: db.benefit_date,
                    desc: db.description,
                    currentAmount: 0,
                    correctAmount: row.amount,
                    reason: `CSV has "${row.amountStr}" → should be ${row.amount}`,
                });
                break;
            }
        }
    }

    console.log(`  Missing negatives to restore: ${missingFixes.length}`);
    console.log(`  Total value to restore: €${missingFixes.reduce((s, f) => s + f.correctAmount, 0).toFixed(2)}`);

    const byFA_missing = {};
    for (const f of missingFixes) {
        if (!byFA_missing[f.fa]) byFA_missing[f.fa] = { count: 0, impact: 0 };
        byFA_missing[f.fa].count++;
        byFA_missing[f.fa].impact += f.correctAmount;
    }
    console.log('\n  By FA code:');
    Object.entries(byFA_missing).sort((a, b) => a[0].localeCompare(b[0])).forEach(([fa, v]) => {
        console.log(`    ${fa}: ${v.count} entries, missing value €${v.impact.toFixed(2)}`);
    });

    console.log('\n  Sample missing fixes:');
    missingFixes.slice(0, 15).forEach(f => {
        console.log(`    ${f.date} | ${f.fa} | 0 → ${f.correctAmount} | ${f.desc.substring(0, 40)}`);
    });

    // ═══════════════════════════════════════════════════
    // SUMMARY & APPLY
    // ═══════════════════════════════════════════════════
    const allFixes = [...phantomFixes, ...missingFixes];
    console.log(`\n═══ TOTAL ═══`);
    console.log(`  Phantom fixes (→ 0): ${phantomFixes.length}`);
    console.log(`  Missing fixes (0 → X): ${missingFixes.length}`);
    console.log(`  Total updates: ${allFixes.length}`);

    if (allFixes.length === 0) {
        console.log('\n✅ Nothing to fix!');
        return;
    }

    if (!apply) {
        console.log('\n🟡 DRY RUN — Run with --apply to execute fixes');
        return;
    }

    // Apply
    console.log(`\n🔴 Applying ${allFixes.length} fixes...`);
    let applied = 0;
    let errors = 0;

    for (let i = 0; i < allFixes.length; i += 50) {
        const batch = allFixes.slice(i, i + 50);
        for (const f of batch) {
            const { error } = await supabase
                .from('invoices')
                .update({ invoice_amount: f.correctAmount })
                .eq('id', f.id);
            if (error) {
                console.error(`  ❌ Error ${f.id}:`, error.message);
                errors++;
            } else {
                applied++;
            }
        }
        process.stdout.write(`  ${Math.min(i + 50, allFixes.length)}/${allFixes.length}\r`);
    }

    console.log(`\n\n✅ Applied: ${applied}`);
    console.log(`❌ Errors: ${errors}`);
}

main().catch(console.error);
