#!/usr/bin/env node
/**
 * fix-credit-notes-final.js
 * 
 * Comprehensive fix for ALL credit notes (negative amounts) that were scrambled
 * by the original fix-negative-invoices.js script (which matched by date+description
 * without checking financial_account_code).
 * 
 * Strategy:
 * 1. Read ALL CSV credit notes (parenthesized amounts) with their correct FA code
 * 2. For each, find the EXACT DB row by FA + benefit_date + description
 * 3. If amount doesn't match, update to correct value
 * 4. Also fix credit notes that are still at 0 (never got a value)
 * 
 * Usage:
 *   node scripts/fix-credit-notes-final.js              # Dry-run
 *   node scripts/fix-credit-notes-final.js --apply       # Apply
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseEN(str) {
    if (!str) return 0;
    let s = str.trim();
    if (s === '-' || s === '') return 0;
    const isNeg = s.startsWith('(') && s.endsWith(')');
    if (isNeg) s = s.slice(1, -1).trim();
    const v = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    if (isNaN(v)) return 0;
    return isNeg ? -v : v;
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
    const apply = process.argv.includes('--apply');
    const csvPath = path.join(__dirname, '..', 'public', 'epenses.csv');
    const lines = fs.readFileSync(csvPath, 'utf-8').split('\n');

    console.log(`📂 CSV: ${lines.length} lines | Mode: ${apply ? '🔴 APPLY' : '🟡 DRY RUN'}\n`);

    // ── Step 1: Parse ALL CSV credit notes ──
    const csvCredits = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';');
        const amtStr = (cols[2] || '').trim();
        if (!amtStr.startsWith('(') || !amtStr.endsWith(')')) continue;
        const group = (cols[0] || '').trim();
        if (group !== 'Incurred') continue;
        const faMatch = (cols[1] || '').trim().match(/(\d+\.\d+(?:\.\d+)?)/);
        if (!faMatch) continue;
        const benefitDate = parseDate((cols[4] || '').trim());
        if (!benefitDate) continue;

        csvCredits.push({
            fa: faMatch[1],
            date: benefitDate,
            desc: normDesc(cols[6]),
            amount: parseEN(amtStr),
            amtStr,
            line: i + 1,
        });
    }
    console.log(`📊 CSV credit notes: ${csvCredits.length}`);

    // ── Step 2: Load ALL INCURRED invoices (negative + zero) from DB ──
    let allInvoices = [];
    let off = 0;
    while (true) {
        const { data, error } = await supabase
            .from('invoices')
            .select('id, financial_account_code, benefit_date, description, invoice_amount')
            .eq('invoice_type', 'INCURRED')
            .lte('invoice_amount', 0)
            .range(off, off + 999);
        if (error) { console.error('Error:', error); return; }
        if (!data || data.length === 0) break;
        allInvoices = allInvoices.concat(data);
        off += 1000;
        if (data.length < 1000) break;
    }
    console.log(`📊 DB invoices (≤0): ${allInvoices.length}\n`);

    // ── Step 3: Match and find fixes ──
    const fixes = [];
    let correct = 0;
    let noMatch = 0;

    // Index DB invoices by FA+date for faster lookup
    const dbIndex = {};
    for (const inv of allInvoices) {
        const key = `${inv.financial_account_code}|${inv.benefit_date}`;
        if (!dbIndex[key]) dbIndex[key] = [];
        dbIndex[key].push(inv);
    }

    for (const csv of csvCredits) {
        const key = `${csv.fa}|${csv.date}`;
        const candidates = dbIndex[key] || [];

        // Find by description match
        const idx = candidates.findIndex(db => normDesc(db.description) === csv.desc);

        if (idx === -1) {
            noMatch++;
            continue;
        }

        const dbMatch = candidates[idx];
        candidates.splice(idx, 1); // Remove to avoid double-matching

        if (Math.abs(dbMatch.invoice_amount - csv.amount) > 0.01) {
            fixes.push({
                id: dbMatch.id,
                fa: csv.fa,
                date: csv.date,
                desc: dbMatch.description,
                currentAmount: dbMatch.invoice_amount,
                correctAmount: csv.amount,
                csvStr: csv.amtStr,
            });
        } else {
            correct++;
        }
    }

    console.log(`✅ Correct: ${correct}`);
    console.log(`🔧 Need fix: ${fixes.length}`);
    console.log(`❓ No DB match: ${noMatch}\n`);

    if (fixes.length === 0) {
        console.log('Nothing to fix!');
        return;
    }

    // Categorize
    const fromZero = fixes.filter(f => f.currentAmount === 0);
    const wrongValue = fixes.filter(f => f.currentAmount !== 0);

    console.log(`  Still at 0 → correct negative: ${fromZero.length}`);
    console.log(`  Wrong negative → correct negative: ${wrongValue.length}\n`);

    // By FA
    const byFA = {};
    for (const f of fixes) {
        if (!byFA[f.fa]) byFA[f.fa] = { count: 0, impact: 0 };
        byFA[f.fa].count++;
        byFA[f.fa].impact += (f.currentAmount - f.correctAmount);
    }
    console.log('By FA code:');
    Object.entries(byFA).sort((a, b) => a[0].localeCompare(b[0])).forEach(([fa, v]) => {
        console.log(`  ${fa}: ${v.count} fixes, net impact €${v.impact.toFixed(2)}`);
    });

    console.log('\nSample fixes:');
    fixes.slice(0, 20).forEach(f => {
        console.log(`  ${f.date} | ${f.fa} | ${f.currentAmount} → ${f.correctAmount} (CSV: "${f.csvStr}") | ${(f.desc || '').substring(0, 30)}`);
    });

    if (!apply) {
        console.log(`\n🟡 DRY RUN — Run with --apply to fix ${fixes.length} credit notes`);
        return;
    }

    // ── Step 4: Apply ──
    console.log(`\n🔴 Applying ${fixes.length} fixes...`);
    let applied = 0;
    let errors = 0;

    for (let i = 0; i < fixes.length; i += 50) {
        const batch = fixes.slice(i, i + 50);
        for (const f of batch) {
            const { error } = await supabase
                .from('invoices')
                .update({ invoice_amount: f.correctAmount })
                .eq('id', f.id);
            if (error) {
                console.error(`  ❌ ${f.id}:`, error.message);
                errors++;
            } else {
                applied++;
            }
        }
        process.stdout.write(`  ${Math.min(i + 50, fixes.length)}/${fixes.length}\r`);
    }

    console.log(`\n\n✅ Applied: ${applied}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`Net impact: €${fixes.reduce((s, f) => s + (f.currentAmount - f.correctAmount), 0).toFixed(2)}`);
}

main().catch(console.error);
