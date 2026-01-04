import { NextResponse } from 'next/server';
import { getSQLServerConnection, closeSQLServerConnection } from '@/lib/sqlserver';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

// Nome fixo da tabela (verificado via test-sqlserver.js)
// Usar colchetes para evitar problemas de case sensitivity
const HUBSPOT_DEALS_TABLE = '[dbo].[Deals]';

// Rota para sincronizar dados do HubSpot via SQL Server Data Warehouse
export async function POST(request: Request) {
    let diagnosticInfo = {
        currentDatabase: '',
        availableTables: [] as string[],
        attempts: [] as { table: string; success: boolean; error?: string }[],
    };

    try {
        console.log('Iniciando sincronização HubSpot...');

        // Conectar no SQL Server
        const pool = await getSQLServerConnection();
        console.log('✓ Conectado ao SQL Server');

        // DIAGNÓSTICO: Verificar database e tabelas disponíveis
        try {
            const dbCheck = await pool.request().query('SELECT DB_NAME() AS current_db');
            diagnosticInfo.currentDatabase = dbCheck.recordset[0].current_db;
            console.log(`Database atual: ${diagnosticInfo.currentDatabase}`);

            const tablesCheck = await pool.request().query(`
                SELECT TABLE_SCHEMA, TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME LIKE '%Deal%'
                ORDER BY TABLE_NAME
            `);
            diagnosticInfo.availableTables = tablesCheck.recordset.map((t: any) => `${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);
            console.log(`Tabelas com "Deal": ${diagnosticInfo.availableTables.join(', ')}`);
        } catch (diagError: any) {
            console.error('Erro no diagnóstico:', diagError);
            throw new Error(`Erro ao verificar database: ${diagError.message}`);
        }

        // Tentar diferentes formatos do nome da tabela (SINGULAR: Deal, não Deals!)
        const tableVariations = ['Deal', '[Deal]', 'dbo.Deal', '[dbo].[Deal]'];
        let result: any = null;
        let usedTableName = '';

        // Data de início: 01/01/2024
        const startDate = '2024-01-01';

        for (const tableName of tableVariations) {
            try {
                console.log(`Tentando: ${tableName}`);
                // Buscar deals desde 01/01/2024 até presente
                result = await pool.request().query(`
                    SELECT TOP 10000 * 
                    FROM ${tableName}
                    WHERE hs_lastmodifieddate >= '${startDate}'
                    ORDER BY hs_lastmodifieddate DESC
                `);
                usedTableName = tableName;
                diagnosticInfo.attempts.push({ table: tableName, success: true });
                console.log(`✓ Sucesso com: ${tableName} (${result.recordset.length} deals desde ${startDate})`);
                break;
            } catch (err: any) {
                const errorMsg = err.message.split('\n')[0];
                diagnosticInfo.attempts.push({ table: tableName, success: false, error: errorMsg });
                console.log(`✗ Falhou ${tableName}: ${errorMsg}`);
            }
        }

        if (!result || result.recordset.length === 0) {
            throw new Error(
                `Nenhuma variação de nome de tabela funcionou.\n\n` +
                `Database conectado: ${diagnosticInfo.currentDatabase}\n` +
                `Tabelas disponíveis com "Deal": ${diagnosticInfo.availableTables.length > 0 ? diagnosticInfo.availableTables.join(', ') : 'NENHUMA'}\n\n` +
                `Tentativas:\n${diagnosticInfo.attempts.map(a => `  ${a.table}: ${a.success ? '✓' : '✗ ' + a.error}`).join('\n')}`
            );
        }

        console.log(`Encontrados ${result.recordset.length} deals usando: ${usedTableName}`);

        if (result.recordset.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Nenhum deal encontrado no período',
                count: 0,
            });
        }

        // Mapear colunas dinamicamente (detectar nomes de colunas automaticamente)
        const firstRow = result.recordset[0];
        const columns = Object.keys(firstRow);

        console.log('Colunas detectadas:', columns);

        // Função auxiliar para encontrar coluna por padrões
        const findColumn = (patterns: string[]): string | null => {
            for (const pattern of patterns) {
                const col = columns.find(c =>
                    c.toLowerCase().includes(pattern.toLowerCase())
                );
                if (col) return col;
            }
            return null;
        };

        // Detectar colunas importantes
        const colId = findColumn(['deal_id', 'dealid', 'id']);
        const colName = findColumn(['deal_name', 'dealname', 'name', 'title']);
        const colAmount = findColumn(['amount', 'value', 'deal_amount']);
        const colDate = findColumn(['close_date', 'closedate', 'date', 'created']);
        const colStage = findColumn(['stage', 'dealstage']);
        const colPipeline = findColumn(['pipeline']);
        const colOwner = findColumn(['owner', 'owner_name', 'ownername']);
        const colCompany = findColumn(['company', 'company_name', 'companyname']);
        const colCurrency = findColumn(['currency', 'currency_code']);

        // Transformar dados para o formato csv_rows
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
                date: closeDate.toISOString(), // Garantir formato ISO
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

        // Inserir no Supabase (substituir dados existentes do HubSpot)
        // Primeiro, deletar dados antigos
        const { error: deleteError } = await supabaseAdmin
            .from('csv_rows')
            .delete()
            .eq('source', 'hubspot');

        if (deleteError) {
            console.error('Erro ao deletar dados antigos:', deleteError);
            throw deleteError;
        }

        // Inserir novos dados
        const { data, error: insertError } = await supabaseAdmin
            .from('csv_rows')
            .insert(rows);

        if (insertError) {
            console.error('Erro ao inserir dados:', insertError);
            throw insertError;
        }

        console.log(`✓ ${rows.length} deals sincronizados com sucesso`);

        return NextResponse.json({
            success: true,
            message: `${rows.length} deals sincronizados com sucesso`,
            count: rows.length,
        });

    } catch (error: any) {
        console.error('Erro na sincronização:', error);
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
