#!/usr/bin/env node

/**
 * Script para corrigir invoices marcadas como "hubspot-confirmed" 
 * que na verdade têm transações de gateway (Braintree/Stripe/GoCardless)
 * 
 * Problema: O sync marcava como hubspot-confirmed qualquer invoice com order_status=Paid
 * antes de verificar se existia uma transação real de gateway correspondente.
 * 
 * Solução: Re-processar essas invoices e tentar match por domínio+valor+data
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--apply') ? false : true;

async function fetchAll(table, filters = {}) {
    let all = [];
    let offset = 0;
    while (true) {
        let query = supabase.from(table).select('*');
        for (const [key, value] of Object.entries(filters)) {
            query = query.eq(key, value);
        }
        const { data } = await query.range(offset, offset + 999);
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }
    return all;
}

async function main() {
    console.log('🔍 Fix HubSpot-Confirmed Invoices');
    console.log('=================================');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (use --apply to execute)' : 'APPLYING CHANGES'}\n`);

    // 1. Buscar invoices marcadas como hubspot-confirmed
    const { data: hubspotConfirmed } = await supabase
        .from('ar_invoices')
        .select('*')
        .eq('reconciled', true)
        .ilike('reconciled_with', 'hubspot-confirmed%');

    console.log(`📋 Invoices com hubspot-confirmed: ${hubspotConfirmed?.length || 0}`);

    // 2. Buscar todas as transações de gateway
    const [braintree, stripe, gocardless] = await Promise.all([
        fetchAll('csv_rows', { source: 'braintree-api-revenue' }),
        fetchAll('csv_rows', { source: 'stripe-eur' }),
        fetchAll('csv_rows', { source: 'gocardless' })
    ]);

    console.log(`💳 Braintree: ${braintree.length}, Stripe: ${stripe.length}, GoCardless: ${gocardless.length}`);

    // Criar mapa de transações por domínio+valor+data
    const paymentsByDomain = new Map();
    const allPayments = [];

    braintree.forEach(t => {
        const cd = t.custom_data || {};
        const email = cd.customer_email?.toLowerCase();
        const domain = email?.split('@')[1];
        const amount = Math.round(parseFloat(t.amount));
        
        const payment = {
            source: 'braintree',
            transaction_id: cd.transaction_id || t.id,
            date: t.date,
            amount: parseFloat(t.amount),
            email,
            domain,
            order_id: cd.order_id,
            row_id: t.id
        };
        allPayments.push(payment);
        
        if (domain) {
            const key = `${domain}:${amount}`;
            if (!paymentsByDomain.has(key)) paymentsByDomain.set(key, []);
            paymentsByDomain.get(key).push(payment);
        }
    });

    stripe.forEach(t => {
        const cd = t.custom_data || {};
        const email = cd.customer_email?.toLowerCase();
        const domain = email?.split('@')[1];
        const amount = Math.round(parseFloat(t.amount));
        
        const payment = {
            source: 'stripe',
            transaction_id: cd.payment_intent || cd.charge_id || t.id,
            date: t.date,
            amount: parseFloat(t.amount),
            email,
            domain,
            order_id: cd.order_id,
            row_id: t.id
        };
        allPayments.push(payment);
        
        if (domain) {
            const key = `${domain}:${amount}`;
            if (!paymentsByDomain.has(key)) paymentsByDomain.set(key, []);
            paymentsByDomain.get(key).push(payment);
        }
    });

    gocardless.forEach(t => {
        const cd = t.custom_data || {};
        const email = cd.customer_email?.toLowerCase();
        const domain = email?.split('@')[1];
        const amount = Math.round(parseFloat(t.amount));
        
        const payment = {
            source: 'gocardless',
            transaction_id: cd.payment_id || t.id,
            date: t.date,
            amount: parseFloat(t.amount),
            email,
            domain,
            order_id: null,
            row_id: t.id
        };
        allPayments.push(payment);
        
        if (domain) {
            const key = `${domain}:${amount}`;
            if (!paymentsByDomain.has(key)) paymentsByDomain.set(key, []);
            paymentsByDomain.get(key).push(payment);
        }
    });

    // 3. Tentar match para cada invoice hubspot-confirmed
    const fixes = [];
    const usedPayments = new Set();

    for (const inv of hubspotConfirmed || []) {
        const invEmail = inv.email?.toLowerCase();
        const invDomain = invEmail?.split('@')[1];
        const invAmount = Math.round(inv.total_amount);
        const invDate = new Date(inv.invoice_date || inv.order_date);

        // Buscar por order_id primeiro
        let match = null;
        if (inv.order_id) {
            const orderKey = inv.order_id.toLowerCase();
            match = allPayments.find(p => 
                !usedPayments.has(p.row_id) &&
                p.order_id?.toLowerCase() === orderKey
            );
            if (match) {
                match.match_type = 'order_id';
            }
        }

        // Buscar por email exato + valor
        if (!match && invEmail) {
            match = allPayments.find(p =>
                !usedPayments.has(p.row_id) &&
                p.email === invEmail &&
                Math.abs(p.amount - inv.total_amount) < 1
            );
            if (match) {
                match.match_type = 'email+amount';
            }
        }

        // Buscar por domínio + valor + data
        if (!match && invDomain) {
            const key = `${invDomain}:${invAmount}`;
            const candidates = paymentsByDomain.get(key) || [];
            
            for (const candidate of candidates) {
                if (usedPayments.has(candidate.row_id)) continue;
                
                const payDate = new Date(candidate.date);
                const daysDiff = Math.abs((payDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysDiff <= 3 && Math.abs(candidate.amount - inv.total_amount) < 1) {
                    match = { ...candidate, match_type: 'domain+amount+date' };
                    break;
                }
            }
        }

        // Buscar por valor + data exatos (sem email)
        if (!match) {
            const candidates = allPayments.filter(p =>
                !usedPayments.has(p.row_id) &&
                Math.abs(p.amount - inv.total_amount) < 0.01
            );
            
            for (const candidate of candidates) {
                const payDate = new Date(candidate.date);
                const daysDiff = Math.abs((payDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysDiff <= 1) { // Janela mais restrita sem email
                    match = { ...candidate, match_type: 'amount+date' };
                    break;
                }
            }
        }

        if (match) {
            usedPayments.add(match.row_id);
            fixes.push({
                invoice_id: inv.id,
                invoice_number: inv.invoice_number,
                order_id: inv.order_id,
                client: inv.client_name,
                inv_email: inv.email,
                old_source: 'hubspot-confirmed',
                new_source: match.source,
                transaction_id: match.transaction_id,
                pay_email: match.email,
                match_type: match.match_type
            });
        }
    }

    console.log(`\n✅ Matches encontrados: ${fixes.length}`);
    
    // Mostrar por tipo de match
    const byType = {};
    fixes.forEach(f => {
        byType[f.match_type] = (byType[f.match_type] || 0) + 1;
    });
    console.log('   Por tipo:', byType);

    // Mostrar exemplos
    console.log('\n📝 Exemplos de correções:');
    fixes.slice(0, 10).forEach(f => {
        console.log(`   ${f.invoice_number} (${f.order_id}) -> ${f.new_source}:${f.transaction_id} [${f.match_type}]`);
    });

    // Aplicar se não for dry run
    if (!DRY_RUN && fixes.length > 0) {
        console.log('\n⚡ Aplicando correções...');
        let updated = 0;
        
        for (const fix of fixes) {
            const { error } = await supabase
                .from('ar_invoices')
                .update({
                    reconciled_with: `${fix.new_source}:${fix.transaction_id}`,
                    payment_reference: fix.transaction_id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', fix.invoice_id);
            
            if (!error) {
                updated++;
            } else {
                console.error(`   Erro em ${fix.invoice_number}:`, error.message);
            }
        }
        
        console.log(`✅ ${updated}/${fixes.length} invoices corrigidas`);
    } else if (DRY_RUN) {
        console.log('\n⚠️  DRY RUN - nenhuma alteração feita');
        console.log('   Use --apply para executar as correções');
    }
}

main().catch(console.error);
