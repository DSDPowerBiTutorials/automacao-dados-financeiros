#!/usr/bin/env node
/**
 * Quick check: sum expense CSV totals by FA category for 2025 Incurred records
 */
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'public', 'epenses.csv');
const lines = fs.readFileSync(CSV_PATH, 'utf-8').split('\n');

const sumsByFA = {};
const sumsByCat = {};
let total = 0;
let count = 0;

for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (!cols[0] || cols[0].trim() !== 'Incurred') continue;

    // Benefit Date column 4: dd/mm/yyyy
    const dateStr = (cols[4] || '').trim();
    const parts = dateStr.split('/');
    if (parts.length < 3 || parts[2] !== '2025') continue;

    // FA code from Sub-Group column 1
    const sg = (cols[1] || '').trim();
    const m = sg.match(/(\d{3}\.[\d.]+)/);
    if (!m) continue;
    const fa = m[1];

    // Parse European amount column 2
    const raw = (cols[2] || '').trim();
    const num = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;

    sumsByFA[fa] = (sumsByFA[fa] || 0) + num;

    // Group by major category
    const cat = fa.substring(0, 3) + '.0';
    sumsByCat[cat] = (sumsByCat[cat] || 0) + num;
    total += num;
    count++;
}

console.log('=== Expense CSV Totals by Category (2025 Incurred) ===');
const catKeys = Object.keys(sumsByCat).sort();
for (const k of catKeys) {
    console.log(`  ${k}\t${sumsByCat[k].toFixed(0)}`);
}
console.log(`  TOTAL\t${total.toFixed(0)} (${count} records)`);

console.log('\n=== Expense CSV Totals by FA (2025 Incurred) ===');
const faKeys = Object.keys(sumsByFA).sort();
for (const k of faKeys) {
    console.log(`  ${k}\t${sumsByFA[k].toFixed(0)}`);
}
