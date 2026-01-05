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
            console.log('  - dealname:', firstDeal.dealname);
            console.log('  - ip__ecomm_bridge__order_number:', firstDeal.ip__ecomm_bridge__order_number);
            console.log('  - website_order_id:', firstDeal.website_order_id);
            console.log('  - product_quantity:', firstDeal.product_quantity);
            console.log('  - product_amount:', firstDeal.product_amount);
        }

        // Transformar dados para o formato csv_rows
        const rows = result.recordset.map((deal: any) => {
            // Dados básicos do deal
            const dealId = deal.DealId;
            const dealName = deal.dealname || 'Deal sem nome';
            const amount = parseFloat(deal.amount) || 0;

            // Data: priorizar closedate
            let closeDate = new Date();
            if (deal.closedate) {
                closeDate = new Date(deal.closedate);
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

            // Produto - limpar nome
            const rawProductName = deal.product_name || deal.dealname;
            const productName = cleanProductName(rawProductName);
            const productAmount = deal.product_amount ? parseFloat(deal.product_amount) : null;
            const productQuantity = deal.product_quantity ? parseInt(deal.product_quantity) : null;

            // Moeda
            const currency = deal.currency || extractCurrency(dealName) || 'EUR';

            // Descrição para a tabela
            let description = dealName;
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
                amount: amount,
                reconciled: false,

                // 🔑 CAMPOS CRÍTICOS PARA LINKAGEM
                customer_email: customerEmail,
                customer_name: customerName,

                custom_data: {
                    // IDs
                    deal_id: dealId,
                    contact_id: deal.contact_id || null,
                    company_id: deal.company_id || null,

                    // Deal info
                    dealname: dealName,
                    stage: deal.dealstage || 'unknown',
                    dealstage: deal.dealstage || 'unknown',
                    pipeline: deal.pipeline || null,
                    owner_id: deal.owner_id || null,
                    owner: deal.owner_id || null,
                    currency: currency,

                    // ✅ CAMPOS ADICIONAIS (para visualização no frontend)
                    paid_status: deal.paid_status || null,
                    coupon_code: deal.coupon_code || null,
                    hs_closed_won_date: deal.hs_closed_won_date || null,
                    total_payment: deal.total_payment ? parseFloat(deal.total_payment) : null,
                    website_source: deal.website_source || 'Web',
                    hs_lastmodifieddate: deal.hs_lastmodifieddate || null,

                    // Cliente
                    customer_firstname: customerFirstname,
                    customer_lastname: customerLastname,
                    customer_phone: customerPhone,
                    customer_jobtitle: deal.customer_jobtitle || null,
                    customer_clinic: deal.customer_clinic || null,

                    // Empresa
                    company: companyName,
                    company_name: companyName,
                    company_industry: deal.company_industry || null,
                    company_website: deal.company_website || null,
                    company_city: deal.company_city || null,
                    company_country: deal.company_country || null,

                    // Produto
                    product_name: productName,
                    product_name_raw: rawProductName,
                    product_amount: productAmount,
                    product_quantity: productQuantity,
                    product_discount: deal.product_discount ? parseFloat(deal.product_discount) : null,

                    // Totais calculados
                    quantity: productQuantity,
                    items_total: productAmount,
                    discount_amount: deal.product_discount ? parseFloat(deal.product_discount) : 0,
                    final_price: amount, // amount já é o valor final

                    // E-commerce
                    ecomm_order_number: deal.ip__ecomm_bridge__order_number || deal.ecomm_order_number || null,
                    website_order_id: deal.website_order_id || null,
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

        console.log('💾 Inserindo novos dados...');
        const { error: insertError } = await supabaseAdmin
            .from('csv_rows')
            .insert(rows);

        if (insertError) {
            console.error('❌ Erro ao inserir dados:', insertError);
            throw insertError;
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
