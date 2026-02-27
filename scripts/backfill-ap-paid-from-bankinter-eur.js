#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function absNumber(value) {
    const n = Number(value || 0);
    return Math.abs(Number.isFinite(n) ? n : 0);
}

function daysDiff(a, b) {
    return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

async function fetchAllInvoices() {
    const pageSize = 1000;
    let offset = 0;
    const all = [];

    while (true) {
        const { data, error } = await supabase
            .from('invoices')
            .select('id,invoice_type,invoice_date,schedule_date,payment_date,payment_status,finance_payment_status,is_reconciled,reconciled_transaction_id,reconciled_at,reconciled_amount,bank_account_code,invoice_amount,paid_amount,paid_currency,currency')
            .eq('invoice_type', 'INCURRED')
            .gte('invoice_date', '2024-01-01')
            .lte('invoice_date', '2025-12-31')
            .order('id', { ascending: true })
            .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        all.push(...data);
        offset += data.length;
        if (data.length < pageSize) break;
    }

    return all;
}

async function fetchAllBankDebits() {
    const pageSize = 1000;
    let offset = 0;
    const all = [];

    while (true) {
        const { data, error } = await supabase
            .from('csv_rows')
            .select('id,date,amount,reconciled,custom_data')
            .eq('source', 'bankinter-eur')
            .lt('amount', 0)
            .gte('date', '2024-01-01')
            .lte('date', '2025-12-31')
            .order('date', { ascending: true })
            .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        all.push(...data);
        offset += data.length;
        if (data.length < pageSize) break;
    }

    return all;
}

async function main() {
    console.log('🔎 Backfill AP paid fields from Bankinter EUR (2024-2025)...');

    const invoices = await fetchAllInvoices();
    const txs = await fetchAllBankDebits();

    console.log(`📄 Invoices (INCURRED 2024-2025): ${invoices.length}`);
    console.log(`🏦 Bankinter EUR debits (2024-2025): ${txs.length}`);

    const candidatesByInvoice = new Map();
    const invoiceIdsByTx = new Map();

    const targetInvoices = invoices.filter((inv) => {
        const status = String(inv.payment_status || '').toLowerCase();
        const refDate = inv.payment_date || inv.schedule_date || inv.invoice_date;
        if (!refDate) return false;
        if (inv.currency && inv.currency !== 'EUR') return false;
        return status !== 'paid';
    });

    for (const inv of targetInvoices) {
        const amount = absNumber(inv.paid_amount || inv.invoice_amount);
        const refDate = inv.payment_date || inv.schedule_date || inv.invoice_date;
        if (!amount || !refDate) {
            candidatesByInvoice.set(inv.id, []);
            continue;
        }

        const candidates = txs.filter((tx) => {
            const txAmount = absNumber(tx.amount);
            return Math.abs(txAmount - amount) <= 0.01 && daysDiff(refDate, tx.date) <= 3;
        });

        candidatesByInvoice.set(inv.id, candidates);
        for (const tx of candidates) {
            if (!invoiceIdsByTx.has(tx.id)) invoiceIdsByTx.set(tx.id, []);
            invoiceIdsByTx.get(tx.id).push(inv.id);
        }
    }

    const safePairs = [];
    for (const inv of targetInvoices) {
        const candidates = candidatesByInvoice.get(inv.id) || [];
        if (candidates.length !== 1) continue;
        const tx = candidates[0];
        const invsForTx = invoiceIdsByTx.get(tx.id) || [];
        if (invsForTx.length !== 1) continue;
        safePairs.push({ inv, tx });
    }

    console.log(`✅ Safe 1:1 matches found: ${safePairs.length}`);

    let updatedInvoices = 0;
    let updatedBankTx = 0;
    let errors = 0;

    const now = new Date().toISOString();

    for (const pair of safePairs) {
        const { inv, tx } = pair;
        const txAmountAbs = absNumber(tx.amount);

        const invoicePatch = {
            payment_date: tx.date,
            schedule_date: tx.date,
            payment_status: 'paid',
            finance_payment_status: 'paid',
            paid_amount: inv.paid_amount != null ? inv.paid_amount : txAmountAbs,
            paid_currency: inv.paid_currency || 'EUR',
            bank_account_code: inv.bank_account_code || 'BKINT-4605',
            is_reconciled: true,
            reconciled_transaction_id: inv.reconciled_transaction_id || tx.id,
            reconciled_at: inv.reconciled_at || now,
            reconciled_amount: inv.reconciled_amount != null ? inv.reconciled_amount : txAmountAbs,
        };

        const { error: invoiceError } = await supabase
            .from('invoices')
            .update(invoicePatch)
            .eq('id', inv.id);

        if (invoiceError) {
            errors++;
            continue;
        }
        updatedInvoices++;

        const txCustom = tx.custom_data || {};
        const currentMatched = Array.isArray(txCustom.matched_invoice_ids) ? txCustom.matched_invoice_ids : [];
        const mergedMatched = Array.from(new Set([...currentMatched, inv.id]));

        const txPatch = {
            reconciled: true,
            custom_data: {
                ...txCustom,
                reconciliationType: txCustom.reconciliationType || 'automatic',
                matched_invoice_ids: mergedMatched,
                matched_invoice_total: txAmountAbs,
                matched_provider: txCustom.matched_provider || inv.provider_code || null,
                match_type: txCustom.match_type || 'backfill_exact_amount_date',
                api: 'backfill-ap-paid-from-bankinter-eur',
                reconciled_at: txCustom.reconciled_at || now,
            },
        };

        const { error: txError } = await supabase
            .from('csv_rows')
            .update(txPatch)
            .eq('id', tx.id);

        if (txError) {
            errors++;
            continue;
        }
        updatedBankTx++;
    }

    // Second pass: invoices already reconciled to bankinter-eur but still not paid fields
    let secondPass = 0;
    for (const inv of invoices) {
        const status = String(inv.payment_status || '').toLowerCase();
        if (status === 'paid' && inv.payment_date && inv.schedule_date === inv.payment_date) continue;
        if (!inv.reconciled_transaction_id) continue;

        const tx = txs.find((t) => t.id === inv.reconciled_transaction_id);
        if (!tx) continue;

        const txAmountAbs = absNumber(tx.amount);
        const patch = {
            payment_date: inv.payment_date || tx.date,
            schedule_date: (inv.payment_date || tx.date),
            payment_status: 'paid',
            finance_payment_status: 'paid',
            paid_amount: inv.paid_amount != null ? inv.paid_amount : txAmountAbs,
            paid_currency: inv.paid_currency || 'EUR',
            bank_account_code: inv.bank_account_code || 'BKINT-4605',
            is_reconciled: true,
            reconciled_amount: inv.reconciled_amount != null ? inv.reconciled_amount : txAmountAbs,
            reconciled_at: inv.reconciled_at || now,
        };

        const { error } = await supabase.from('invoices').update(patch).eq('id', inv.id);
        if (!error) secondPass++;
    }

    console.log('\n📊 Summary');
    console.log(`- Target invoices (not paid): ${targetInvoices.length}`);
    console.log(`- Safe 1:1 matches used: ${safePairs.length}`);
    console.log(`- Invoices updated (pass 1): ${updatedInvoices}`);
    console.log(`- Bank tx updated (pass 1): ${updatedBankTx}`);
    console.log(`- Invoices normalized from existing reconciliation (pass 2): ${secondPass}`);
    console.log(`- Errors: ${errors}`);
}

main().catch((err) => {
    console.error('❌ Backfill failed:', err.message);
    process.exit(1);
});
