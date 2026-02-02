#!/usr/bin/env node
/**
 * Script para atualizar financial_account_code nos registros existentes
 * Atualiza tanto invoice-orders quanto hubspot baseado no produto/description
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================
// 💰 MAPEAMENTO PRODUTO → FINANCIAL ACCOUNT CODE
// ============================================================
function getFinancialAccountCode(text) {
    const searchText = (text || '').toLowerCase();

    // ====== 101.0 - Growth (Education) ======

    // 101.1 - DSD Courses
    if (
        searchText.includes('dsd provider') ||
        searchText.includes('designing smiles') ||
        searchText.includes('dsd course') ||
        searchText.includes('increase case acceptance') ||
        searchText.includes('case acceptance mastery') ||
        searchText.includes('ios festival') ||
        searchText.includes('intraoral scanner') ||
        searchText.includes('kois & coachman') ||
        searchText.includes('dsd aligners') ||
        searchText.includes('dsd clinical') ||
        searchText.includes('wtd meeting') ||
        searchText.includes('smile to success') ||
        searchText.includes('implement and learn') ||
        searchText.includes('mastering dsd')
    ) {
        return { code: '101.1', name: 'DSD Courses' };
    }

    // 101.3 - Mastership
    if (
        searchText.includes('mastership') ||
        searchText.includes('master ship') ||
        searchText.includes('residency')
    ) {
        return { code: '101.3', name: 'Mastership' };
    }

    // 101.4 - PC Membership
    if (
        searchText.includes('provider annual membership') ||
        searchText.includes('provider membership') ||
        searchText.includes('pc membership') ||
        searchText.includes('planning center membership')
    ) {
        return { code: '101.4', name: 'PC Membership' };
    }

    // 101.5 - Partnerships / Sponsorships
    if (
        searchText.includes('sponsorship') ||
        searchText.includes('partnership') ||
        searchText.includes('sponsor') ||
        searchText.includes('exhibit space')
    ) {
        return { code: '101.5', name: 'Partnerships' };
    }

    // ====== 102.0 - Delight (Clinic Services) ======

    // 102.5 - Consultancies
    if (
        searchText.includes('dsd clinic transformation') ||
        searchText.includes('clinic transformation') ||
        searchText.includes('dsd clinic -') ||
        searchText.includes('consultancy') ||
        searchText.includes('consulting')
    ) {
        return { code: '102.5', name: 'Consultancies' };
    }

    // 102.6 - Marketing Coaching
    if (
        searchText.includes('fractional cmo') ||
        searchText.includes('marketing coaching') ||
        searchText.includes('growth hub onboarding')
    ) {
        return { code: '102.6', name: 'Marketing Coaching' };
    }

    // ====== 103.0 - Planning Center ======
    if (
        searchText.includes('planning center') ||
        searchText.includes('prep guide') ||
        searchText.includes('smile design') ||
        searchText.includes('planning service')
    ) {
        return { code: '103.0', name: 'Planning Center' };
    }

    // ====== 104.0 - LAB (Manufacture) ======
    if (
        searchText.includes('natural restoration') ||
        searchText.includes('lab ') ||
        searchText.includes('prosthesis') ||
        searchText.includes('crown') ||
        searchText.includes('veneer') ||
        searchText.includes('surgical guide') ||
        searchText.includes('abutment')
    ) {
        return { code: '104.0', name: 'LAB' };
    }

    // ====== 105.0 - Other Income ======

    // 105.1 - Level 1 Subscriptions
    if (
        searchText.includes('dsd growth hub') ||
        searchText.includes('growth hub') ||
        searchText.includes('monthly subscription') ||
        searchText.includes('subscription')
    ) {
        return { code: '105.1', name: 'Level 1 Subscriptions' };
    }

    // 105.4 - Other Marketing Revenues
    if (
        searchText.includes('cancellation fee') ||
        searchText.includes('reschedule fee') ||
        searchText.includes('late fee')
    ) {
        return { code: '105.4', name: 'Other Marketing Revenues' };
    }

    return { code: null, name: null };
}

async function updateFinancialAccounts() {
    console.log('🔄 Atualizando Financial Accounts nos registros existentes...\n');

    // Buscar registros de invoice-orders e hubspot
    const sources = ['invoice-orders', 'hubspot'];

    for (const source of sources) {
        console.log(`\n📦 Processando source: ${source}`);

        // Buscar todos os registros
        let allRows = [];
        let offset = 0;
        const batchSize = 1000;

        while (true) {
            const { data, error } = await supabase
                .from('csv_rows')
                .select('id, description, custom_data')
                .eq('source', source)
                .range(offset, offset + batchSize - 1);

            if (error) {
                console.error(`❌ Erro ao buscar ${source}:`, error.message);
                break;
            }

            if (!data || data.length === 0) break;

            allRows = allRows.concat(data);
            offset += batchSize;

            if (data.length < batchSize) break;
        }

        console.log(`   📊 Total de registros: ${allRows.length}`);

        // Atualizar cada registro
        let updated = 0;
        let skipped = 0;
        let noMatch = 0;
        const accountStats = {};

        for (const row of allRows) {
            // Texto para busca: description + product_name do custom_data + dealname
            const searchText = [
                row.description,
                row.custom_data?.product_name,
                row.custom_data?.dealname,
                row.custom_data?.Products,
                row.custom_data?.order_code
            ].filter(Boolean).join(' ');

            const account = getFinancialAccountCode(searchText);

            // Se já tem financial_account_code igual, pular
            if (row.custom_data?.financial_account_code === account.code) {
                skipped++;
                continue;
            }

            if (!account.code) {
                noMatch++;
                continue;
            }

            // Atualizar custom_data
            const newCustomData = {
                ...row.custom_data,
                financial_account_code: account.code,
                financial_account_name: account.name
            };

            const { error: updateError } = await supabase
                .from('csv_rows')
                .update({ custom_data: newCustomData })
                .eq('id', row.id);

            if (updateError) {
                console.error(`   ❌ Erro ao atualizar ${row.id}:`, updateError.message);
            } else {
                updated++;
                accountStats[account.code] = (accountStats[account.code] || 0) + 1;
            }
        }

        console.log(`   ✅ Atualizados: ${updated}`);
        console.log(`   ⏭️  Já corretos: ${skipped}`);
        console.log(`   ⚠️  Sem match: ${noMatch}`);

        if (Object.keys(accountStats).length > 0) {
            console.log(`   📊 Distribuição:`);
            Object.entries(accountStats)
                .sort((a, b) => b[1] - a[1])
                .forEach(([code, count]) => {
                    console.log(`      ${code}: ${count}`);
                });
        }
    }

    console.log('\n🎉 Atualização concluída!');
}

updateFinancialAccounts().catch(console.error);
