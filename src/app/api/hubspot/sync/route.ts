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
                // Buscar deals desde 01/01/2024 (limitado a 2000 para performance)
                result = await pool.request().query(`
                    SELECT TOP 2000 * 
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

        // Função auxiliar para encontrar coluna por padrões (case-insensitive)
        const findColumn = (patterns: string[]): string | null => {
            const lowerPatterns = patterns.map(p => p.toLowerCase());

            // Primeiro tenta match exato (case-insensitive)
            for (const col of columns) {
                if (lowerPatterns.includes(col.toLowerCase())) {
                    return col;
                }
            }

            // Depois tenta partial match
            for (const pattern of lowerPatterns) {
                const col = columns.find(c =>
                    c.toLowerCase().includes(pattern)
                );
                if (col) return col;
            }
            return null;
        };

        // Detectar colunas importantes
        const colId = findColumn(['DealId', 'deal_id', 'dealid', 'id']);
        const colName = findColumn(['dealname', 'deal_name', 'name', 'title']);
        const colAmount = findColumn(['amount', 'value', 'deal_amount', 'amount_in_home_currency']);
        const colDate = findColumn(['closedate', 'close_date', 'hs_closed_won_date', 'hs_closed_deal_close_date', 'createdate', 'date', 'created']);
        const colStage = findColumn(['dealstage', 'stage']);
        const colPipeline = findColumn(['deal_pipeline', 'pipeline']);
        const colOwner = findColumn(['hubspot_owner_id', 'owner', 'owner_name', 'ownername']);
        const colCompany = findColumn(['hs_primary_associated_company', 'company', 'company_name', 'companyname']);
        const colCurrency = findColumn(['deal_currency_code', 'currency', 'currency_code']);

        // Transformar dados para o formato csv_rows
        const rows = result.recordset.map((deal: any) => {
            const dealId = colId ? deal[colId] : null;
            const dealName = colName ? deal[colName] : 'Deal';
            const amount = colAmount ? parseFloat(deal[colAmount]) || 0 : 0;

            // Melhorar detecção da data: tentar múltiplas colunas e formatos
            let closeDate = new Date();
            let usedDateColumn = 'unknown';

            // Tentar ordem de preferência: closedate > hs_closed_won_date > hs_closed_deal_close_date > createdate
            const dateColumnsToTry = [
                { col: 'closedate', name: 'closedate' },
                { col: colDate, name: `${colDate || 'detected'}` },
                { col: 'hs_closed_won_date', name: 'hs_closed_won_date' },
                { col: 'hs_closed_deal_close_date', name: 'hs_closed_deal_close_date' },
                { col: 'createdate', name: 'createdate' },
            ];

            for (const { col, name } of dateColumnsToTry) {
                if (!col || !deal[col]) continue;

                const dateValue = deal[col];
                if (dateValue === null || dateValue === undefined || dateValue === '') continue;

                // Tentar fazer parse de diferentes formatos
                let parsedDate = new Date(dateValue);

                // Se for timestamp (número em ms), converter
                if (typeof dateValue === 'number') {
                    parsedDate = new Date(dateValue);
                } else if (typeof dateValue === 'string') {
                    // Tentar múltiplos formatos
                    parsedDate = new Date(dateValue);

                    // Se falhar, tentar ISO ou timestamp em ms
                    if (isNaN(parsedDate.getTime())) {
                        const asMs = parseInt(dateValue);
                        if (!isNaN(asMs)) {
                            parsedDate = new Date(asMs);
                        }
                    }
                }

                if (!isNaN(parsedDate.getTime()) && parsedDate.getTime() !== 0) {
                    closeDate = parsedDate;
                    usedDateColumn = name;
                    break;
                }
            }

            if (usedDateColumn === 'unknown' || closeDate.getFullYear() === new Date().getFullYear() && closeDate.getMonth() === new Date().getMonth() && closeDate.getDate() === new Date().getDate()) {
                console.warn(`Data possível com fallback para deal ${dealId}: coluna usada="${usedDateColumn}" | data="${closeDate.toISOString()}"`);
            }

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
                    closedate: deal['closedate'] || null,
                    createdate: deal['createdate'] || null,
                    source_date_column_used: usedDateColumn, // Registrar qual coluna foi usada
                    raw_close_date: deal[colDate] || null,
                },
            };
        });

        console.log(`Transformados ${rows.length} deals para inserir no Supabase`);

        // Inserir no Supabase (substituir dados existentes do HubSpot)
        // Primeiro, deletar dados antigos
        console.log('Deletando dados antigos do HubSpot...');
        const { error: deleteError } = await supabaseAdmin
            .from('csv_rows')
            .delete()
            .eq('source', 'hubspot');

        if (deleteError) {
            console.error('Erro ao deletar dados antigos:', deleteError);
            throw deleteError;
        }

        console.log('Inserindo novos dados...');
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
