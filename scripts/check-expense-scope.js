#!/usr/bin/env node
/**
 * Check expense scope values in the database to understand filtering
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
    // Check scope distribution for expense invoices
    let allData = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('invoices')
            .select('benefit_date, invoice_amount, financial_account_code, invoice_type, scope')
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

    console.log(`Total invoices: ${allData.length}`);

    // Check scope distribution
    const scopeDist = {};
    const scopeByFA = {};

    for (const row of allData) {
        const scope = row.scope || 'NULL';
        scopeDist[scope] = (scopeDist[scope] || 0) + 1;

        if (!row.financial_account_code) continue;
        const rawFA = row.financial_account_code;
        const fa = rawFA.includes(' - ') ? rawFA.split(' - ')[0].trim() : rawFA.trim();
        const cat = fa.substring(0, 3) + '.0';

        const key = `${cat}|${scope}`;
        const amount = row.invoice_amount || 0;
        if (row.invoice_type === 'BUDGET') continue;
        scopeByFA[key] = (scopeByFA[key] || 0) + amount;
    }

    console.log('\nScope distribution:');
    for (const [s, c] of Object.entries(scopeDist)) {
        console.log(`  ${s}: ${c}`);
    }

    // Show totals by FA + scope
    console.log('\nExpense totals by Category and Scope (Incurred+Adj):');
    const keys = Object.keys(scopeByFA).sort();
    const faCats = new Set(keys.map(k => k.split('|')[0]));
    const scopes = new Set(keys.map(k => k.split('|')[1]));

    console.log('Category\t' + [...scopes].join('\t'));
    for (const cat of [...faCats].sort()) {
        let line = cat;
        for (const scope of [...scopes]) {
            const val = Math.round(scopeByFA[`${cat}|${scope}`] || 0);
            line += `\t${val}`;
        }
        console.log(line);
    }

    // Specifically check 202.7 invoices
    console.log('\n=== 202.7 Labour AMEX detail ===');
    const amex = allData.filter(r => {
        const fa = (r.financial_account_code || '').includes(' - ')
            ? r.financial_account_code.split(' - ')[0].trim()
            : (r.financial_account_code || '').trim();
        return fa === '202.7';
    });

    console.log(`Total 202.7 records: ${amex.length}`);
    const amexByScope = {};
    const amexByType = {};
    for (const r of amex) {
        const s = r.scope || 'NULL';
        amexByScope[s] = (amexByScope[s] || 0) + (r.invoice_amount || 0);
        amexByType[r.invoice_type] = (amexByType[r.invoice_type] || 0) + (r.invoice_amount || 0);
    }
    console.log('By scope:', amexByScope);
    console.log('By type:', amexByType);

    // Check if there are invoices without scope (they would be excluded when filtering by scope=ES)
    const noScope = allData.filter(r => !r.scope);
    console.log(`\nInvoices with NULL scope: ${noScope.length}`);
    if (noScope.length > 0) {
        const noScopeTotal = noScope.filter(r => r.invoice_type !== 'BUDGET').reduce((s, r) => s + (r.invoice_amount || 0), 0);
        console.log(`NULL scope total (excl budget): ${Math.round(noScopeTotal)}`);

        // Count by FA for NULL scope
        const nsFAs = {};
        for (const r of noScope) {
            if (r.invoice_type === 'BUDGET') continue;
            const fa = (r.financial_account_code || '').includes(' - ')
                ? r.financial_account_code.split(' - ')[0].trim()
                : (r.financial_account_code || '').trim();
            const cat = fa.substring(0, 3) + '.0';
            nsFAs[cat] = (nsFAs[cat] || 0) + (r.invoice_amount || 0);
        }
        console.log('NULL scope by category:', nsFAs);
    }
}

main().catch(console.error);
