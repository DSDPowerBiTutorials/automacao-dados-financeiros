import { NextResponse } from 'next/server';
import { getSQLServerConnection, closeSQLServerConnection } from '@/lib/sqlserver';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cleanProductName, extractCurrency } from '@/lib/matching-engine';
import { ENRICHED_HUBSPOT_QUERY, INTERMEDIATE_HUBSPOT_QUERY, SIMPLE_HUBSPOT_QUERY } from '@/lib/hubspot-queries';
import crypto from 'crypto';

// ============================================================
// 💰 MAPEAMENTO PRODUTO → FINANCIAL ACCOUNT CODE
// Baseado nas contas de receita designadas para cada produto
// ============================================================
function getFinancialAccountCode(orderCode: string, productName: string, description: string): { code: string | null; name: string | null } {
    // Combinar todas as strings para busca
    const searchText = `${orderCode} ${productName} ${description}`.toLowerCase();

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

    // 101.4 - PC Membership (Provider/Planning Center Membership)
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

    // ====== 104.0 - LAB (Manufacture) - CHECK BEFORE 103.0 ======
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

    // ====== 103.0 - Planning Center (Design services) ======
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

    // ====== 105.0 - Other Income ======

    // 105.1 - Level 1 Subscriptions (Growth Hub subscriptions)
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

    // Fallback: sem mapeamento
    return { code: null, name: null };
}

// Rota para sincronizar dados do HubSpot via SQL Server Data Warehouse
// Configurar timeout maior para evitar erro de loading infinito
export const maxDuration = 180; // 3 minutos

export async function POST(request: Request) {
    try {
        console.log('🔄 Iniciando sincronização HubSpot...');

        // Conectar no SQL Server
        const pool = await getSQLServerConnection();
        console.log('✅ Conectado ao SQL Server');

        // Data de início: buscar deals desde 01/12/2025
        const startDate = new Date('2025-12-01');
        const startDateStr = startDate.toISOString().split('T')[0];

        console.log(`📅 Buscando deals desde: ${startDateStr}`);

        // Tentar queries em cascata: enriquecida → intermediária → simples
        let result: any = null;
        let usedQuery = 'enriched';

        // Tentativa 1: Query enriquecida (Deal + Contact + Company + LineItem)
        try {
            console.log('🔍 [1/3] Tentando query ENRIQUECIDA (Deal + Contact + Company + LineItem)...');
            const query = ENRICHED_HUBSPOT_QUERY.replace('@startDate', `'${startDateStr}'`);
            result = await pool.request().query(query);
            console.log(`✅ Query enriquecida funcionou! ${result.recordset.length} deals`);
        } catch (enrichedError: any) {
            console.error('❌ Query enriquecida FALHOU:', enrichedError.message);
            console.error('   Código:', enrichedError.code, 'Número:', enrichedError.number);

            // Tentativa 2: Query intermediária (Deal + Contact + Company, sem LineItem)
            try {
                console.log('🔍 [2/3] Tentando query INTERMEDIÁRIA (Deal + Contact + Company)...');
                const query = INTERMEDIATE_HUBSPOT_QUERY.replace('@startDate', `'${startDateStr}'`);
                result = await pool.request().query(query);
                usedQuery = 'intermediate';
                console.log(`✅ Query intermediária funcionou! ${result.recordset.length} deals`);
            } catch (intermediateError: any) {
                console.error('❌ Query intermediária FALHOU:', intermediateError.message);
                console.error('   Código:', intermediateError.code, 'Número:', intermediateError.number);

                // Tentativa 3: Query simples (apenas Deal + Contact básico)
                try {
                    console.log('🔍 [3/3] Tentando query SIMPLES (Deal + Contact básico)...');
                    const query = SIMPLE_HUBSPOT_QUERY.replace('@startDate', `'${startDateStr}'`);
                    result = await pool.request().query(query);
                    usedQuery = 'simple';
                    console.log(`✅ Query simples funcionou! ${result.recordset.length} deals`);
                } catch (simpleError: any) {
                    console.error('❌ TODAS as queries falharam!');
                    throw new Error(
                        `Nenhuma query funcionou.\n` +
                        `Enriquecida: ${enrichedError.message}\n` +
                        `Intermediária: ${intermediateError.message}\n` +
                        `Simples: ${simpleError.message}`
                    );
                }
            }
        }

        if (!result || result.recordset.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Nenhum deal encontrado no período',
                count: 0,
            });
        }

        console.log(`📊 Processando ${result.recordset.length} deals (query: ${usedQuery})`);

        // 🔍 DEBUG: Mostrar campos do primeiro deal
        if (result.recordset.length > 0) {
            const firstDeal = result.recordset[0];
            console.log('🔍 DEBUG - Campos disponíveis no primeiro deal:');
            console.log('  - DealId:', firstDeal.DealId);
            console.log('  - order_code:', firstDeal.order_code);
            console.log('  - ecomm_order_number:', firstDeal.ecomm_order_number);
            console.log('  - website_order_id:', firstDeal.website_order_id);
            console.log('  - product_quantity:', firstDeal.product_quantity);
            console.log('  - product_name:', firstDeal.product_name);
            console.log('  - paid_status:', firstDeal.paid_status);
            console.log('  - total_payment:', firstDeal.total_payment);
            console.log('  - customer_email:', firstDeal.customer_email);
            console.log('  - customer_firstname:', firstDeal.customer_firstname);
            console.log('  - company_name:', firstDeal.company_name);
        }

        // Transformar dados para o formato csv_rows
        const rows = result.recordset.map((deal: any) => {
            // ==========================================
            // MAPEAMENTO COMPLETO - Espelha Backend
            // ==========================================

            const dealId = deal.DealId;
            const orderCode = deal.order_code || deal.dealname || 'N/A';  // order_code É o dealname
            const totalAmount = parseFloat(deal.amount) || 0;

            // Data: priorizar date_ordered (closedate)
            let closeDate = new Date();
            if (deal.date_ordered) {
                closeDate = new Date(deal.date_ordered);
            } else if (deal.createdate) {
                closeDate = new Date(deal.createdate);
            }

            // Cliente - com fallback para extrair do orderCode/dealname
            const customerEmail = deal.customer_email || null;
            const customerFirstname = deal.customer_firstname || '';
            const customerLastname = deal.customer_lastname || '';
            let customerName = `${customerFirstname} ${customerLastname}`.trim() || null;

            // 🔧 FALLBACK: Extrair nome do cliente do dealname quando Contact não está associado
            // Exemplos de dealname:
            //   "Smile&Co (Melinda Cheung)- DSD Growth Hub Monthly Subscription"
            //   "Church View dental (Yusuf Surtee)- DSD Growth Hub Monthly Subscription"
            //   "CAM- Kalomoira"
            //   "- Prep Guides + NR Full - Dr. Manuela Barsan"
            if (!customerName && orderCode && orderCode !== 'N/A') {
                // Tentar extrair nome entre parênteses: "Company (Nome do Cliente)- Produto"
                const parenMatch = orderCode.match(/\(([^)]+)\)/);
                if (parenMatch && parenMatch[1]) {
                    customerName = parenMatch[1].trim();
                } else {
                    // Tentar extrair "Dr. Nome Sobrenome" no final do texto
                    const drMatch = orderCode.match(/Dr\.?\s+([A-Za-z\s]+?)\s*$/i);
                    if (drMatch && drMatch[1]) {
                        customerName = `Dr. ${drMatch[1].trim()}`;
                    } else {
                        // Tentar extrair nome após hífen simples: "Prefix- Nome"
                        const dashMatch = orderCode.match(/^[^-]+[-–]\s*([A-Za-z\s]+?)(?:[-–]|$)/);
                        if (dashMatch && dashMatch[1] && dashMatch[1].trim().length > 2) {
                            // Verificar se parece um nome (não é código alfanumérico)
                            const potentialName = dashMatch[1].trim();
                            if (!/^[a-f0-9]+$/i.test(potentialName)) {
                                customerName = potentialName;
                            }
                        }
                    }
                }
            }

            const customerPhone = deal.customer_phone || null;

            // Empresa - com fallback para extrair do orderCode
            let companyName = deal.company_name || null;

            // 🔧 FALLBACK: Extrair empresa do dealname quando Company não está associada
            // Exemplos: "Smile&Co (Melinda Cheung)- ..." → empresa = "Smile&Co"
            if (!companyName && orderCode && orderCode !== 'N/A') {
                // Extrair texto antes do parêntese ou primeiro hífen
                const companyMatch = orderCode.match(/^([^(–-]+?)(?:\s*\(|[-–])/);
                if (companyMatch && companyMatch[1]) {
                    const potentialCompany = companyMatch[1].trim();
                    // Verificar se não é apenas um código alfanumérico
                    if (potentialCompany.length > 2 && !/^[a-f0-9]+$/i.test(potentialCompany)) {
                        companyName = potentialCompany;
                    }
                }
            }

            const companyDomain = deal.company_domain || null;

            // Produto (agora vindo do LineItem)
            const productName = deal.product_name || orderCode;
            const productDescription = deal.product_description || '';
            const productQuantity = deal.product_quantity ? parseInt(deal.product_quantity) : null;
            const productAmount = deal.product_amount ? parseFloat(deal.product_amount) : null;
            const productUnitPrice = deal.product_unit_price ? parseFloat(deal.product_unit_price) : null;
            const productSku = deal.product_sku || null;
            const productCost = deal.product_cost ? parseFloat(deal.product_cost) : null;
            const productDiscount = deal.product_discount ? parseFloat(deal.product_discount) : null;

            // Moeda
            const currency = deal.currency || 'EUR';

            // Status de pagamento
            const paidStatus = deal.paid_status || 'Unpaid';
            const totalPayment = deal.total_payment ? parseFloat(deal.total_payment) : 0;

            // Order Site (ex: "DSD (en-GB)")
            const orderSite = deal.order_site || 'Web';

            // Descrição para a tabela (formato: Order e437d54 - Company (Customer))
            let description = `Order ${orderCode}`;
            if (companyName) {
                description += ` - ${companyName}`;
            }
            if (customerName) {
                description += ` (${customerName})`;
            }

            // 💰 FINANCIAL ACCOUNT: Mapear produto → conta de receita
            const financialAccount = getFinancialAccountCode(orderCode, productName, description);

            return {
                id: crypto.randomUUID(),
                file_name: 'hubspot-sync',
                source: 'hubspot',
                date: closeDate.toISOString(),
                description: description,
                amount: totalAmount,
                reconciled: false,

                // 🔑 CAMPOS CRÍTICOS PARA LINKAGEM
                customer_email: customerEmail,
                customer_name: customerName,

                custom_data: {
                    // ==========================================
                    // IDs e Códigos (CRÍTICO para linkagem)
                    // ==========================================
                    deal_id: dealId,
                    order_code: orderCode,  // e437d54, a3d2c9a, 8305674, etc
                    ecomm_order_number: deal.ecomm_order_number || orderCode,
                    website_order_id: deal.website_order_id || null,
                    reference: orderCode,

                    // IDs de relacionamento
                    contact_id: deal.contact_id || null,
                    company_id: deal.company_id || null,

                    // ==========================================
                    // Deal Info
                    // ==========================================
                    dealname: orderCode,
                    stage: deal.status || 'unknown',
                    dealstage: deal.status || 'unknown',
                    status: deal.status || 'unknown',
                    pipeline: deal.pipeline || null,
                    dealtype: deal.dealtype || null,
                    owner_id: deal.owner_id || null,
                    currency: currency,
                    amount_in_home_currency: deal.amount_in_home_currency ? parseFloat(deal.amount_in_home_currency) : totalAmount,
                    ecommerce_deal: deal.ecommerce_deal === 'true',
                    hs_is_closed: deal.hs_is_closed || false,
                    hs_is_closed_won: deal.hs_is_closed_won || false,

                    // ==========================================
                    // Pagamento
                    // ==========================================
                    paid_status: paidStatus,
                    total_payment: totalPayment,
                    date_paid: deal.date_paid || null,
                    hs_closed_won_date: deal.date_paid || null,
                    failed_payment_timestamp: deal.failed_payment_timestamp || null,

                    // ==========================================
                    // E-commerce & Descontos
                    // ==========================================
                    coupon_code: deal.coupon_code || null,
                    discount_amount: deal.discount_amount ? parseFloat(deal.discount_amount) : 0,
                    tax_amount: deal.tax_amount ? parseFloat(deal.tax_amount) : 0,
                    order_site: orderSite,

                    // ==========================================
                    // Cliente - Informações Completas
                    // ==========================================
                    customer_firstname: customerFirstname,
                    customer_lastname: customerLastname,
                    customer_email: customerEmail,
                    customer_phone: customerPhone,
                    customer_jobtitle: deal.customer_jobtitle || null,
                    customer_address: deal.customer_address || null,
                    customer_city: deal.customer_city || null,
                    customer_state: deal.customer_state || null,
                    customer_country: deal.customer_country || null,
                    customer_zip: deal.customer_zip || null,

                    // ==========================================
                    // Empresa
                    // ==========================================
                    company: companyName,
                    company_name: companyName,
                    company_domain: companyDomain,
                    company_industry: deal.company_industry || null,
                    company_website: deal.company_website || null,
                    company_city: deal.company_city || null,
                    company_country: deal.company_country || null,
                    company_phone: deal.company_phone || null,

                    // ==========================================
                    // Produto - Informações Completas (do LineItem)
                    // ==========================================
                    product_id: deal.product_id || null,
                    product_name: productName,
                    product_description: productDescription,
                    product_quantity: productQuantity,
                    product_amount: productAmount,
                    product_unit_price: productUnitPrice,
                    product_sku: productSku,
                    product_cost: productCost,
                    product_discount: productDiscount,

                    // Totais calculados
                    quantity: productQuantity,
                    items_total: productAmount,
                    final_price: totalAmount,
                    total_price: totalAmount,

                    // ==========================================
                    // Metadados
                    // ==========================================
                    date_ordered: deal.date_ordered || closeDate.toISOString(),
                    createdate: deal.createdate || null,
                    last_updated: deal.last_updated || null,
                    hs_lastmodifieddate: deal.last_updated || null,
                    synced_at: new Date().toISOString(),
                    query_type: usedQuery,

                    // ==========================================
                    // 💰 Financial Account (Conta de Receita)
                    // ==========================================
                    financial_account_code: financialAccount.code,
                    financial_account_name: financialAccount.name,
                },
            };
        });

        console.log(`🔄 Transformados ${rows.length} deals para inserir no Supabase`);

        // 🔍 DEBUG: Verificar campos e-commerce
        const withEcommOrder = rows.filter((r: any) => r.custom_data.ecomm_order_number).length;
        const withWebsiteOrder = rows.filter((r: any) => r.custom_data.website_order_id).length;
        console.log(`🛒 ${withEcommOrder} deals com ecomm_order_number (${((withEcommOrder / rows.length) * 100).toFixed(1)}%)`);
        console.log(`🌐 ${withWebsiteOrder} deals com website_order_id (${((withWebsiteOrder / rows.length) * 100).toFixed(1)}%)`);

        // Contar quantos têm email/nome para linkagem
        const withEmail = rows.filter((r: any) => r.customer_email).length;
        const withName = rows.filter((r: any) => r.customer_name).length;
        const withCompany = rows.filter((r: any) => r.custom_data.company_name).length;
        const withProduct = rows.filter((r: any) => r.custom_data.product_name).length;

        // Contadores de fallback (nomes extraídos do dealname)
        const withNameFromContact = rows.filter((r: any) => r.custom_data.customer_firstname || r.custom_data.customer_lastname).length;
        const withNameFromFallback = withName - withNameFromContact;

        console.log(`📧 ${withEmail} deals com email (${((withEmail / rows.length) * 100).toFixed(1)}%)`);
        console.log(`👤 ${withName} deals com nome do cliente (${((withName / rows.length) * 100).toFixed(1)}%)`);
        if (withNameFromFallback > 0) {
            console.log(`   ↳ ${withNameFromContact} via Contact, ${withNameFromFallback} via fallback (extraído do dealname)`);
        }
        console.log(`🏢 ${withCompany} deals com empresa (${((withCompany / rows.length) * 100).toFixed(1)}%)`);
        console.log(`📦 ${withProduct} deals com produto (${((withProduct / rows.length) * 100).toFixed(1)}%)`);

        // 💰 Contar deals com Financial Account mapeado
        const withFinancialAccount = rows.filter((r: any) => r.custom_data.financial_account_code).length;
        console.log(`💰 ${withFinancialAccount} deals com Financial Account (${((withFinancialAccount / rows.length) * 100).toFixed(1)}%)`);

        // Mostrar distribuição por conta
        const accountDistribution: Record<string, number> = {};
        rows.forEach((r: any) => {
            const code = r.custom_data.financial_account_code || 'N/A';
            accountDistribution[code] = (accountDistribution[code] || 0) + 1;
        });
        console.log('   📊 Distribuição por conta:', accountDistribution);

        // ============================================================
        // UPSERT: Preservar reconciliações existentes
        // ============================================================
        console.log('🔍 Buscando reconciliações existentes para preservar...');

        // Buscar todos os registros existentes do HubSpot com suas reconciliações
        const { data: existingRows, error: fetchError } = await supabaseAdmin
            .from('csv_rows')
            .select('id, custom_data, reconciled')
            .eq('source', 'hubspot');

        if (fetchError) {
            console.error('❌ Erro ao buscar registros existentes:', fetchError);
            throw fetchError;
        }

        // Criar mapa de deal_id -> dados de reconciliação
        const reconciliationMap = new Map<string, { id: string; reconciled: boolean; customData: any }>();
        for (const row of existingRows || []) {
            const dealId = row.custom_data?.deal_id;
            if (dealId) {
                reconciliationMap.set(String(dealId), {
                    id: row.id,
                    reconciled: row.reconciled || false,
                    customData: row.custom_data
                });
            }
        }

        console.log(`📊 ${reconciliationMap.size} registros existentes encontrados`);
        const reconciledCount = Array.from(reconciliationMap.values()).filter(r => r.reconciled).length;
        console.log(`✅ ${reconciledCount} reconciliações serão preservadas`);

        // Separar em updates e inserts
        const toUpdate: any[] = [];
        const toInsert: any[] = [];

        for (const row of rows) {
            const dealId = String(row.custom_data?.deal_id);
            const existing = reconciliationMap.get(dealId);

            if (existing) {
                // Preservar reconciliação e campos de linkagem existentes
                const preservedFields = {
                    reconciled: existing.reconciled,
                    // Preservar campos de linkagem Braintree se existirem
                    braintree_transaction_id: existing.customData?.braintree_transaction_id,
                    braintree_order_id: existing.customData?.braintree_order_id,
                    braintree_status: existing.customData?.braintree_status,
                    braintree_settlement_batch_id: existing.customData?.braintree_settlement_batch_id,
                    braintree_disbursement_date: existing.customData?.braintree_disbursement_date,
                    linked_at: existing.customData?.linked_at,
                    matched_with: existing.customData?.matched_with,
                };

                toUpdate.push({
                    ...row,
                    id: existing.id, // Manter o mesmo ID
                    reconciled: preservedFields.reconciled,
                    custom_data: {
                        ...row.custom_data,
                        // Preservar campos de linkagem
                        braintree_transaction_id: preservedFields.braintree_transaction_id || row.custom_data?.braintree_transaction_id,
                        braintree_order_id: preservedFields.braintree_order_id || row.custom_data?.braintree_order_id,
                        braintree_status: preservedFields.braintree_status || row.custom_data?.braintree_status,
                        braintree_settlement_batch_id: preservedFields.braintree_settlement_batch_id || row.custom_data?.braintree_settlement_batch_id,
                        braintree_disbursement_date: preservedFields.braintree_disbursement_date || row.custom_data?.braintree_disbursement_date,
                        linked_at: preservedFields.linked_at || row.custom_data?.linked_at,
                        matched_with: preservedFields.matched_with || row.custom_data?.matched_with,
                    }
                });
            } else {
                toInsert.push(row);
            }
        }

        console.log(`📝 ${toUpdate.length} registros para atualizar, ${toInsert.length} novos para inserir`);

        // Processar updates em lotes
        const BATCH_SIZE = 500;
        if (toUpdate.length > 0) {
            console.log(`🔄 Atualizando ${toUpdate.length} registros existentes...`);
            for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
                const batch = toUpdate.slice(i, i + BATCH_SIZE);

                // Usar upsert com onConflict no id
                const { error: upsertError } = await supabaseAdmin
                    .from('csv_rows')
                    .upsert(batch, { onConflict: 'id' });

                if (upsertError) {
                    console.error(`❌ Erro ao atualizar lote:`, upsertError);
                    throw upsertError;
                }
                console.log(`  ✓ ${Math.min(i + BATCH_SIZE, toUpdate.length)}/${toUpdate.length} atualizados`);
            }
        }

        // Processar inserts em lotes
        if (toInsert.length > 0) {
            console.log(`💾 Inserindo ${toInsert.length} novos registros...`);
            for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
                const batch = toInsert.slice(i, i + BATCH_SIZE);
                const { error: insertError } = await supabaseAdmin
                    .from('csv_rows')
                    .insert(batch);

                if (insertError) {
                    console.error(`❌ Erro ao inserir lote:`, insertError);
                    throw insertError;
                }
                console.log(`  ✓ ${Math.min(i + BATCH_SIZE, toInsert.length)}/${toInsert.length} inseridos`);
            }
        }

        // Remover deals que não existem mais no HubSpot (opcional - deals deletados)
        const currentDealIds = new Set(rows.map((r: any) => String(r.custom_data?.deal_id)));
        const toDelete = Array.from(reconciliationMap.entries())
            .filter(([dealId]) => !currentDealIds.has(dealId))
            .map(([, data]) => data.id);

        if (toDelete.length > 0) {
            console.log(`🗑️ Removendo ${toDelete.length} deals que não existem mais...`);
            const { error: deleteError } = await supabaseAdmin
                .from('csv_rows')
                .delete()
                .in('id', toDelete);

            if (deleteError) {
                console.error('❌ Erro ao deletar deals removidos:', deleteError);
                // Não lançar erro, apenas logar
            }
        }

        console.log(`✅ Sincronização concluída! ${toUpdate.length} atualizados, ${toInsert.length} novos, ${reconciledCount} reconciliações preservadas`);

        // Trigger customer master data sync after successful web orders sync
        try {
            const custUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/customers/sync`;
            fetch(custUrl, { method: "POST" }).catch(() => { }); // Fire and forget
            console.log("👥 Customer sync triggered after HubSpot sync");
        } catch (_) { /* non-blocking */ }

        return NextResponse.json({
            success: true,
            message: `${rows.length} deals sincronizados (${reconciledCount} reconciliações preservadas, ${withFinancialAccount} com Financial Account)`,
            count: rows.length,
            stats: {
                total: rows.length,
                updated: toUpdate.length,
                inserted: toInsert.length,
                deleted: toDelete.length,
                reconciliationsPreserved: reconciledCount,
                withEmail: withEmail,
                withName: withName,
                withProduct: withProduct,
                withFinancialAccount: withFinancialAccount,
                financialAccountDistribution: accountDistribution,
                queryType: usedQuery,
            },
        });

    } catch (error: any) {
        console.error('❌ Erro na sincronização:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erro ao sincronizar dados',
                details: error.toString(),
            },
            { status: 500 }
        );
    } finally {
        // Fechar conexão
        await closeSQLServerConnection();
    }
}

// GET para verificar status/últimos dados
export async function GET() {
    try {
        const { data, error, count } = await supabaseAdmin
            .from('csv_rows')
            .select('*', { count: 'exact' })
            .eq('source', 'hubspot')
            .order('date', { ascending: false })
            .limit(10);

        if (error) throw error;

        return NextResponse.json({
            success: true,
            count,
            lastSync: data?.[0]?.created_at || null,
            recentDeals: data,
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
