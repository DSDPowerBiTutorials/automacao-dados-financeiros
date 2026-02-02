#!/usr/bin/env node
/**
 * Script para enriquecer registros HubSpot com product_name do SQL Server
 * e atualizar financial_account_code baseado no produto
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sql = require('mssql');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuração SQL Server
const sqlConfig = {
    user: process.env.SQLSERVER_USER,
    password: process.env.SQLSERVER_PASSWORD,
    server: process.env.SQLSERVER_HOST,
    database: process.env.SQLSERVER_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: false,
    },
};

// ============================================================
// 💰 MAPEAMENTO PRODUTO → FINANCIAL ACCOUNT CODE
// ============================================================
function getFinancialAccountCode(text) {
    const searchText = (text || '').toLowerCase();

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
        searchText.includes('mastering dsd') ||
        searchText.includes('ta courses') ||
        searchText.includes('restorative academy')
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

    // 102.5 - Consultancies
    if (
        searchText.includes('dsd clinic transformation') ||
        searchText.includes('clinic transformation') ||
        searchText.includes('dsd clinic -') ||
        searchText.includes('dsd clinic services') ||
        searchText.includes('monthly fee') ||
        searchText.includes('consultancy') ||
        searchText.includes('consulting')
    ) {
        return { code: '102.5', name: 'Consultancies' };
    }

    // 102.6 - Marketing Coaching
    if (
        searchText.includes('fractional cmo') ||
        searchText.includes('marketing coaching') ||
        searchText.includes('growth hub onboarding') ||
        searchText.includes('patient attraction')
    ) {
        return { code: '102.6', name: 'Marketing Coaching' };
    }

    // 104.0 - LAB (Manufacture) - CHECK BEFORE 103.0
    if (
        searchText.includes('manufacture') ||
        searchText.includes('natural restoration') ||
        searchText.includes('lab ') ||
        searchText.includes('prosthesis') ||
        searchText.includes('crown') ||
        searchText.includes('veneer') ||
        searchText.includes('surgical guide') ||
        searchText.includes('abutment') ||
        searchText.includes('direct restoration') ||
        searchText.includes('bridge manufacture') ||
        searchText.includes('mockup manufacture')
    ) {
        return { code: '104.0', name: 'LAB' };
    }

    // 103.0 - Planning Center (Design services)
    if (
        searchText.includes('planning center') ||
        searchText.includes('prep guide') ||
        searchText.includes('prep kit') ||
        searchText.includes('smile design') ||
        searchText.includes('planning service') ||
        searchText.includes('dsd upper') ||
        searchText.includes('dsd lower') ||
        searchText.includes('dsd diagnostic') ||
        searchText.includes('diagnostic design') ||
        searchText.includes('ortho planning') ||
        searchText.includes('ortho tps') ||
        searchText.includes('ortho quality') ||
        searchText.includes('mockup design') ||
        searchText.includes('motivational mockup') ||
        searchText.includes('clic guide') ||
        searchText.includes('update upper') ||
        searchText.includes('update lower') ||
        searchText.includes('denture design') ||
        searchText.includes('deprogrammer design') ||
        searchText.includes('implant planning') ||
        searchText.includes('guide design') ||
        searchText.includes('tad guide') ||
        searchText.includes('interdisciplinary') ||
        searchText.includes('restorative planning') ||
        searchText.includes('injected design') ||
        searchText.includes('additional design') ||
        searchText.includes('over prep') ||
        searchText.includes('invisalign')
    ) {
        return { code: '103.0', name: 'Planning Center' };
    }

    // 105.1 - Level 1 Subscriptions
    if (
        searchText.includes('dsd growth hub') ||
        searchText.includes('growth hub') ||
        searchText.includes('monthly subscription') ||
        searchText.includes('subscription') ||
        searchText.includes('online access') ||
        searchText.includes('dsd online') ||
        searchText.includes('level 2 annual') ||
        searchText.includes('annual plan')
    ) {
        return { code: '105.1', name: 'Level 1 Subscriptions' };
    }

    // DSD Coaching
    if (searchText.includes('dsd coaching') || searchText.includes('coaching')) {
        return { code: '102.6', name: 'Marketing Coaching' };
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

async function enrichHubSpotWithProducts() {
    console.log('🔄 Enriquecendo HubSpot com produtos do SQL Server...\n');

    // 1. Buscar registros HubSpot sem financial_account
    console.log('📦 Buscando registros HubSpot sem financial_account...');

    let allRows = [];
    let offset = 0;
    const batchSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('csv_rows')
            .select('id, custom_data')
            .eq('source', 'hubspot')
            .is('custom_data->financial_account_code', null)
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error('❌ Erro ao buscar:', error.message);
            break;
        }

        if (!data || data.length === 0) break;

        allRows = allRows.concat(data);
        offset += batchSize;

        if (data.length < batchSize) break;
    }

    console.log(`   📊 Total sem financial_account: ${allRows.length}`);

    if (allRows.length === 0) {
        console.log('✅ Todos os registros já têm financial_account!');
        return;
    }

    // 2. Conectar no SQL Server e buscar LineItems
    console.log('\n📡 Conectando ao SQL Server...');
    const pool = await sql.connect(sqlConfig);
    console.log('✅ Conectado!');

    // 3. Buscar todos os produtos de LineItems
    console.log('\n🔍 Buscando produtos dos LineItems...');

    const dealIds = allRows
        .map(r => r.custom_data?.deal_id)
        .filter(Boolean);

    if (dealIds.length === 0) {
        console.log('⚠️ Nenhum deal_id encontrado');
        await pool.close();
        return;
    }

    // Query para buscar LineItems por DealId
    const query = `
        SELECT 
            d.DealId,
            li.name AS product_name,
            li.description AS product_description
        FROM Deal d
        LEFT JOIN DealLineItemAssociations dlia ON d.DealId = dlia.DealId
        LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
        WHERE d.DealId IN (${dealIds.join(',')})
        AND li.name IS NOT NULL
    `;

    const result = await pool.request().query(query);
    console.log(`   📊 LineItems encontrados: ${result.recordset.length}`);

    // Criar mapa DealId -> Product
    const productMap = {};
    result.recordset.forEach(row => {
        if (!productMap[row.DealId]) {
            productMap[row.DealId] = [];
        }
        productMap[row.DealId].push({
            name: row.product_name,
            description: row.product_description
        });
    });

    console.log(`   📦 Deals com produtos: ${Object.keys(productMap).length}`);

    await pool.close();

    // 4. Preparar updates em batch
    console.log('\n🔄 Preparando atualizações...');

    let updated = 0;
    let noProduct = 0;
    let noMatch = 0;
    const accountStats = {};
    const updates = [];

    for (const row of allRows) {
        const dealId = row.custom_data?.deal_id;
        const products = productMap[dealId];

        if (!products || products.length === 0) {
            noProduct++;
            continue;
        }

        // Combinar todos os nomes de produtos para busca
        const productNames = products.map(p => p.name).join(' | ');
        const searchText = productNames + ' ' + (products.map(p => p.description).join(' '));

        const account = getFinancialAccountCode(searchText);

        if (!account.code) {
            noMatch++;
            continue;
        }

        // Preparar update
        updates.push({
            id: row.id,
            custom_data: {
                ...row.custom_data,
                product_name: productNames,
                financial_account_code: account.code,
                financial_account_name: account.name
            }
        });

        accountStats[account.code] = (accountStats[account.code] || 0) + 1;
    }

    console.log(`   📊 Updates preparados: ${updates.length}`);
    console.log(`   ⚠️  Sem produto no SQL: ${noProduct}`);
    console.log(`   ⚠️  Sem match de conta: ${noMatch}`);

    // 5. Executar updates em batches paralelos
    console.log('\n🔄 Executando updates...');

    const updateBatchSize = 50;
    for (let i = 0; i < updates.length; i += updateBatchSize) {
        const batch = updates.slice(i, i + updateBatchSize);

        await Promise.all(batch.map(async (upd) => {
            const { error } = await supabase
                .from('csv_rows')
                .update({ custom_data: upd.custom_data })
                .eq('id', upd.id);

            if (!error) updated++;
        }));

        process.stdout.write(`\r   Progresso: ${Math.min(i + updateBatchSize, updates.length)}/${updates.length}`);
    }

    console.log(`\n\n✅ Atualizados: ${updated}`);

    if (Object.keys(accountStats).length > 0) {
        console.log(`📊 Distribuição:`);
        Object.entries(accountStats)
            .sort((a, b) => b[1] - a[1])
            .forEach(([code, count]) => {
                console.log(`   ${code}: ${count}`);
            });
    }

    console.log('\n🎉 Enriquecimento concluído!');
}

enrichHubSpotWithProducts().catch(console.error);
