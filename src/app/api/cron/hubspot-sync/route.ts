/**
 * Cron Job: Sincronização diária HubSpot
 * 
 * Executa: Todos os dias às 4h da manhã (após Braintree)
 * Sincroniza deals do SQL Server Data Warehouse para Supabase
 */

import { NextResponse } from 'next/server';
import { getSQLServerConnection, closeSQLServerConnection } from '@/lib/sqlserver';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

export async function GET(request: Request) {
    // Verificar autorização (apenas Vercel Cron pode chamar)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('🕐 Iniciando sincronização automática HubSpot...');

        // Conectar no SQL Server
        const pool = await getSQLServerConnection();

        // Buscar deals desde 01/01/2024
        const result = await pool.request().query(`
            SELECT *
            FROM [dbo].[Deal]
            WHERE hs_lastmodifieddate >= '2024-01-01'
            ORDER BY hs_lastmodifieddate DESC
        `);

        console.log(`Encontrados ${result.recordset.length} deals desde 2024-01-01`);

        if (result.recordset.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Nenhum deal encontrado',
                count: 0,
            });
        }

        // Mapear colunas
        const firstRow = result.recordset[0];
        const columns = Object.keys(firstRow);

        const findColumn = (patterns: string[]): string | null => {
            for (const pattern of patterns) {
                const col = columns.find(c =>
                    c.toLowerCase().includes(pattern.toLowerCase())
                );
                if (col) return col;
            }
            return null;
        };

        const colId = findColumn(['deal_id', 'dealid', 'id']);
        const colName = findColumn(['deal_name', 'dealname', 'name', 'title']);
        const colAmount = findColumn(['amount', 'value', 'deal_amount']);
        const colDate = findColumn(['close_date', 'closedate', 'date', 'created', 'lastmodifieddate']);
        const colStage = findColumn(['stage', 'dealstage']);
        const colPipeline = findColumn(['pipeline']);
        const colOwner = findColumn(['owner', 'owner_name', 'ownername']);
        const colCompany = findColumn(['company', 'company_name', 'companyname']);
        const colCurrency = findColumn(['currency', 'currency_code']);

        // Transformar dados
        const rows = result.recordset.map((deal: any) => {
            const dealId = colId ? deal[colId] : null;
            const dealName = colName ? deal[colName] : 'Deal';
            const amount = colAmount ? parseFloat(deal[colAmount]) || 0 : 0;
            const closeDate = colDate && deal[colDate] ? new Date(deal[colDate]) : new Date();
            const stage = colStage ? deal[colStage] : 'unknown';
            const pipeline = colPipeline ? deal[colPipeline] : null;
            const owner = colOwner ? deal[colOwner] : null;
            const company = colCompany ? deal[colCompany] : null;
            const currency = colCurrency ? deal[colCurrency] : 'EUR';

            return {
                id: crypto.randomUUID(),
                file_name: 'hubspot-sync',
                source: 'hubspot',
                date: closeDate.toISOString(),
                description: `${dealName}${company ? ' - ' + company : ''}`,
                amount: amount,
                reconciled: false,
                custom_data: {
                    deal_id: dealId,
                    stage: stage,
                    pipeline: pipeline,
                    owner: owner,
                    company: company,
                    currency: currency,
                    raw_data: deal,
                },
            };
        });

        // Deletar dados antigos
        const { error: deleteError } = await supabaseAdmin
            .from('csv_rows')
            .delete()
            .eq('source', 'hubspot');

        if (deleteError) throw deleteError;

        // Inserir novos dados
        const { error: insertError } = await supabaseAdmin
            .from('csv_rows')
            .insert(rows);

        if (insertError) throw insertError;

        // Salvar metadados da sincronização
        const { error: metaError } = await supabaseAdmin
            .from('sync_metadata')
            .upsert({
                source: 'hubspot',
                last_sync: new Date().toISOString(),
                records_synced: rows.length,
                status: 'success',
            }, { onConflict: 'source' });

        if (metaError) {
            console.warn('Erro ao salvar metadados (não crítico):', metaError);
        }

        console.log(`✓ ${rows.length} deals sincronizados com sucesso (cron)`);

        return NextResponse.json({
            success: true,
            message: `${rows.length} deals sincronizados`,
            count: rows.length,
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error('Erro na sincronização automática:', error);
        
        // Salvar erro nos metadados
        try {
            await supabaseAdmin
                .from('sync_metadata')
                .upsert({
                    source: 'hubspot',
                    last_sync: new Date().toISOString(),
                    status: 'error',
                    error_message: error.message,
                }, { onConflict: 'source' });
        } catch (metaError) {
            console.warn('Erro ao salvar metadados de erro:', metaError);
        }

        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    } finally {
        await closeSQLServerConnection();
    }
}
