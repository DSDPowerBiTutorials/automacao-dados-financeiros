import { NextResponse } from 'next/server';
import { getSQLServerConnection, closeSQLServerConnection } from '@/lib/sqlserver';
import { supabaseAdmin } from '@/lib/supabase';

// Lista de possíveis nomes de tabelas do HubSpot
const POSSIBLE_TABLE_NAMES = [
    'deals',
    'HubSpot_Deals',
    'hubspot_deals',
    'hs_deals',
    'CRM_Deals',
    'crm_deals',
    'vw_hubspot_deals',
    'dbo.deals',
    'hubspot.deals',
];

// Função para encontrar a tabela correta do HubSpot
async function findHubSpotTable(pool: any): Promise<string | null> {
    try {
        // Buscar todas as tabelas que contêm 'deal' no nome
        const tablesResult = await pool.request().query(`
            SELECT TABLE_SCHEMA, TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            AND (
                TABLE_NAME LIKE '%deal%'
                OR TABLE_NAME LIKE '%hubspot%'
            )
        `);

        if (tablesResult.recordset.length > 0) {
            // Retornar a primeira tabela encontrada
            const table = tablesResult.recordset[0];
            const fullTableName = table.TABLE_SCHEMA === 'dbo'
                ? table.TABLE_NAME
                : `${table.TABLE_SCHEMA}.${table.TABLE_NAME}`;
            console.log(`✓ Tabela HubSpot encontrada: ${fullTableName}`);
            return fullTableName;
        }

        return null;
    } catch (error) {
        console.error('Erro ao buscar tabelas:', error);
        return null;
    }
}

// Rota para sincronizar dados do HubSpot via SQL Server Data Warehouse
export async function POST(request: Request) {
    try {
        console.log('Iniciando sincronização HubSpot...');

        // Conectar no SQL Server
        const pool = await getSQLServerConnection();

        // Tentar encontrar a tabela automaticamente
        let tableName = await findHubSpotTable(pool);

        if (!tableName) {
            // Tentar nomes comuns
            for (const name of POSSIBLE_TABLE_NAMES) {
                try {
                    await pool.request().query(`SELECT TOP 1 * FROM ${name}`);
                    tableName = name;
                    console.log(`✓ Tabela encontrada: ${tableName}`);
                    break;
                } catch (e) {
                    continue;
                }
            }
        }

        if (!tableName) {
            // Listar tabelas disponíveis para ajudar o usuário
            const allTables = await pool.request().query(`
                SELECT TABLE_SCHEMA, TABLE_NAME
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE = 'BASE TABLE'
                ORDER BY TABLE_NAME
            `);

            const tableList = allTables.recordset
                .map((t: any) => `${t.TABLE_SCHEMA}.${t.TABLE_NAME}`)
                .join(', ');

            throw new Error(
                `Tabela do HubSpot não encontrada. Tabelas disponíveis: ${tableList}`
            );
        }

        console.log(`Usando tabela: ${tableName}`);

        // Query para buscar deals/vendas do HubSpot
        // Usar query mais simples e robusta
        const result = await pool.request().query(`
      SELECT TOP 1000 *
      FROM ${tableName}
    `);

        console.log(`Encontrados ${result.recordset.length} deals no SQL Server`);

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
            const closeDate = colDate ? deal[colDate] : new Date();
            const stage = colStage ? deal[colStage] : 'unknown';
            const pipeline = colPipeline ? deal[colPipeline] : null;
            const owner = colOwner ? deal[colOwner] : null;
            const company = colCompany ? deal[colCompany] : null;
            const currency = colCurrency ? deal[colCurrency] : 'EUR';

            return {
                source: 'hubspot',
                date: closeDate,
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
                    raw_data: deal, // Guardar dados originais para debug
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
