#!/usr/bin/env node
/**
 * fix-negative-invoices.js
 * 
 * Corrige faturas que foram importadas com amount=0 porque o CSV usa
 * notação contábil com parênteses para negativos: (1.000,0) = -1000.0
 * 
 * O script lê o CSV original, identifica linhas com parênteses,
 * faz match pelo invoice_number e atualiza o valor correto no Supabase.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ── Load env ──
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseEuropeanNumber(str) {
    if (!str) return 0;
    let s = str.trim();
    const isNegative = s.startsWith('(') && s.endsWith(')');
    if (isNegative) s = s.slice(1, -1).trim();
    const cleaned = s.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(cleaned);
    if (isNaN(val)) return 0;
    return isNegative ? -val : val;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('/');
    if (parts.length !== 3) return null;
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return year + '-' + month + '-' + day;
}

async function main() {
    const csvPath = path.join(__dirname, '..', 'public', 'epenses.csv');
    const raw = fs.readFileSync(csvPath, 'utf-8');
    const lines = raw.split('\n').filter(l => l.trim());

    console.log('📂 CSV loaded:', lines.length, 'lines');

    // Find all rows with parenthesized (negative) amounts
    const negativeRows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';');
        const amountStr = (cols[2] || '').trim();

        if (amountStr.startsWith('(') && amountStr.endsWith(')')) {
            const amount = parseEuropeanNumber(amountStr);
            const invoiceDate = parseDate((cols[3] || '').trim());
            const benefitDate = parseDate((cols[4] || '').trim());
            const provider = (cols[5] || '').trim();
            const description = (cols[6] || '').trim();
            const subGroup = (cols[1] || '').trim();
            const group = (cols[0] || '').trim();

            negativeRows.push({
                line: i + 1,
                amount,
                amountStr,
                invoiceDate,
                benefitDate,
                provider,
                description,
                subGroup,
                group,
            });
        }
    }

    console.log(`\n🔍 Found ${negativeRows.length} rows with negative amounts in CSV`);

    if (negativeRows.length === 0) {
        console.log('Nothing to fix.');
        return;
    }

    // Show sample
    console.log('\nSample negative rows:');
    negativeRows.slice(0, 5).forEach(r =>
        console.log(`  Line ${r.line}: ${r.amountStr} → ${r.amount} | ${r.description} | ${r.benefitDate}`)
    );

    // Load all invoices with amount=0 from Supabase (those are the broken ones)
    let allZero = [];
    let offset = 0;
    while (true) {
        const { data, error } = await supabase
            .from('invoices')
            .select('id, invoice_number, invoice_amount, benefit_date, description, provider_code, financial_account_code, invoice_type')
            .eq('invoice_amount', 0)
            .range(offset, offset + 999);

        if (error) { console.error('Error fetching:', error); return; }
        if (!data || data.length === 0) break;
        allZero = allZero.concat(data);
        offset += 1000;
        if (data.length < 1000) break;
    }

    console.log(`\n📊 Found ${allZero.length} invoices with amount=0 in database`);

    // Also load invoices that have amount>0 but might be wrong (the "-" dash entries 
    // that were parsed as 0 AND the parenthesized ones that also became 0)
    // Both types ended up as amount=0 in the DB

    // Match by benefit_date + description (since invoice_number was auto-generated)
    // Pass 1: strict match by benefit_date + description
    // Pass 2: looser match by benefit_date + FA code prefix
    let matched = 0;
    let notMatched = 0;
    const updates = [];
    const unmatchedRows = [];

    for (const csvRow of negativeRows) {
        // Extract FA code from sub-group (e.g. "   202.3 - Labour Planning Center" → "202.3")
        const faMatch = csvRow.subGroup.match(/(\d+\.\d+(?:\.\d+)?)/);
        const csvFA = faMatch ? faMatch[1] : '';

        // Find matching DB row by benefit_date and description
        const candidates = allZero.filter(db => {
            if (db.benefit_date !== csvRow.benefitDate) return false;

            const dbDesc = (db.description || '').trim().toUpperCase();
            const csvDesc = csvRow.description.trim().toUpperCase();

            if (!csvDesc && !dbDesc) return true;
            if (!csvDesc || !dbDesc) return false;

            return dbDesc.includes(csvDesc.substring(0, 20)) || csvDesc.includes(dbDesc.substring(0, 20));
        });

        if (candidates.length >= 1) {
            updates.push({ id: candidates[0].id, amount: csvRow.amount, desc: csvRow.description });
            const idx = allZero.indexOf(candidates[0]);
            if (idx !== -1) allZero.splice(idx, 1);
            matched++;
        } else {
            unmatchedRows.push(csvRow);
        }
    }

    // Pass 2: try matching unmatched rows by benefit_date + FA code
    for (const csvRow of unmatchedRows) {
        const faMatch = csvRow.subGroup.match(/(\d+\.\d+(?:\.\d+)?)/);
        const csvFA = faMatch ? faMatch[1] : '';

        const candidates = allZero.filter(db => {
            if (db.benefit_date !== csvRow.benefitDate) return false;
            if (!csvFA || db.financial_account_code !== csvFA) return false;
            // Loose description check: at least same first word
            const dbDesc = (db.description || '').trim().toUpperCase();
            const csvDesc = csvRow.description.trim().toUpperCase();
            if (csvDesc && dbDesc) {
                const csvWord = csvDesc.split(/\s+/)[0];
                return dbDesc.startsWith(csvWord);
            }
            return !csvDesc && !dbDesc;
        });

        if (candidates.length >= 1) {
            updates.push({ id: candidates[0].id, amount: csvRow.amount, desc: csvRow.description });
            const idx = allZero.indexOf(candidates[0]);
            if (idx !== -1) allZero.splice(idx, 1);
            matched++;
        } else {
            notMatched++;
            if (notMatched <= 10) {
                console.log(`  ⚠️ No match: ${csvRow.benefitDate} | ${csvRow.description} | ${csvRow.amount} | FA: ${csvFA}`);
            }
        }
    }

    console.log(`\n✅ Matched: ${matched}`);
    console.log(`❌ Not matched: ${notMatched}`);

    if (updates.length === 0) {
        console.log('No updates to apply.');
        return;
    }

    // Show planned updates
    console.log('\nSample updates:');
    updates.slice(0, 10).forEach(u =>
        console.log(`  ID ${u.id}: 0 → ${u.amount} | ${u.desc}`)
    );

    // Check for --dry-run flag
    if (process.argv.includes('--dry-run')) {
        console.log('\n🏁 DRY RUN - No changes applied');
        console.log(`   Would update ${updates.length} invoices`);
        const totalNeg = updates.reduce((s, u) => s + u.amount, 0);
        console.log(`   Total negative value: €${totalNeg.toFixed(2)}`);
        return;
    }

    // Apply updates in batches
    console.log(`\n🔄 Applying ${updates.length} updates...`);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < updates.length; i += 50) {
        const batch = updates.slice(i, i + 50);
        for (const upd of batch) {
            const { error } = await supabase
                .from('invoices')
                .update({ invoice_amount: upd.amount })
                .eq('id', upd.id);

            if (error) {
                console.error(`  ❌ Failed ID ${upd.id}:`, error.message);
                failed++;
            } else {
                success++;
            }
        }
        console.log(`  Progress: ${Math.min(i + 50, updates.length)}/${updates.length}`);
    }

    const totalNeg = updates.reduce((s, u) => s + u.amount, 0);
    console.log(`\n🏁 Done!`);
    console.log(`   ✅ Updated: ${success}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   Total negative value added: €${totalNeg.toFixed(2)}`);
}

main().catch(console.error);
