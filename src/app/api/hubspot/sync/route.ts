import { NextResponse } from 'next/server';
import { getSQLServerConnection, closeSQLServerConnection } from '@/lib/sqlserver';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cleanProductName, extractCurrency } from '@/lib/matching-engine';
import { ENRICHED_HUBSPOT_QUERY, INTERMEDIATE_HUBSPOT_QUERY, SIMPLE_HUBSPOT_QUERY } from '@/lib/hubspot-queries';
import crypto from 'crypto';

// Rota para sincronizar dados do HubSpot via SQL Server Data Warehouse
// Configurar timeout maior para evitar erro de loading infinito
export const maxDuration = 180; // 3 minutos

export async function POST(request: Request) {
    try {
        console.log('🔄 Iniciando sincronização HubSpot...');

        // Conectar no SQL Server
        const pool = await getSQLServerConnection();
        console.log('✅ Conectado ao SQL Server');

        // Data de início: buscar deals dos últimos 2 anos
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 2);
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

            // Cliente
            const customerEmail = deal.customer_email || null;
            const customerFirstname = deal.customer_firstname || '';
            const customerLastname = deal.customer_lastname || '';
            const customerName = `${customerFirstname} ${customerLastname}`.trim() || null;
            const customerPhone = deal.customer_phone || null;

            // Empresa
            const companyName = deal.company_name || null;
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
                },
            };
        });

        console.log(`🔄 Transformados ${rows.length} deals para inserir no Supabase`);

        // 🔍 DEBUG: Verificar campos e-commerce
        const withEcommOrder = rows.filter((r: any) => r.custom_data.ecomm_order_number).length;
        const withWebsiteOrder = rows.filter((r: any) => r.custom_data.website_order_id).length;
        console.log(`🛒 ${withEcommOrder} deals com ecomm_order_number (${((withEcommOrder / rows.length) * 100).toFixed(1)}%)`);
        console.log(`🌐 ${withWebsiteOrder} deals com website_order_id (${((withWebsiteOrder / rows.length) * 100).toFixed(1)}%)`);

        // Contar quantos têm email para linkagem
        const withEmail = rows.filter((r: any) => r.customer_email).length;
        const withName = rows.filter((r: any) => r.customer_name).length;
        const withProduct = rows.filter((r: any) => r.custom_data.product_name).length;

        console.log(`📧 ${withEmail} deals com email (${((withEmail / rows.length) * 100).toFixed(1)}%)`);
        console.log(`👤 ${withName} deals com nome do cliente (${((withName / rows.length) * 100).toFixed(1)}%)`);
        console.log(`📦 ${withProduct} deals com produto (${((withProduct / rows.length) * 100).toFixed(1)}%)`);

        // Inserir no Supabase (substituir dados existentes do HubSpot)
        console.log('🗑️ Deletando dados antigos do HubSpot...');
        const { error: deleteError } = await supabaseAdmin
            .from('csv_rows')
            .delete()
            .eq('source', 'hubspot');

        if (deleteError) {
            console.error('❌ Erro ao deletar dados antigos:', deleteError);
            throw deleteError;
        }

        // Inserir em lotes de 500 para evitar timeout
        const BATCH_SIZE = 500;
        console.log(`💾 Inserindo ${rows.length} registros em lotes de ${BATCH_SIZE}...`);

        let insertedCount = 0;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const { error: insertError } = await supabaseAdmin
                .from('csv_rows')
                .insert(batch);

            if (insertError) {
                console.error(`❌ Erro ao inserir lote ${Math.floor(i / BATCH_SIZE) + 1}:`, insertError);
                throw insertError;
            }

            insertedCount += batch.length;
            console.log(`  ✓ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${insertedCount}/${rows.length} inseridos`);
        }

        console.log(`✅ ${rows.length} deals sincronizados com sucesso!`);

        return NextResponse.json({
            success: true,
            message: `${rows.length} deals sincronizados com sucesso`,
            count: rows.length,
            stats: {
                total: rows.length,
                withEmail: withEmail,
                withName: withName,
                withProduct: withProduct,
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
