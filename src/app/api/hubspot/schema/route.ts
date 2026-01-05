import { NextResponse } from 'next/server';
import { getSQLServerConnection, closeSQLServerConnection } from '@/lib/sqlserver';

/**
 * Endpoint para verificar schema do HubSpot SQL Server
 * GET /api/hubspot/schema
 * GET /api/hubspot/schema?table=Deal (verificar tabela específica)
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const tableName = searchParams.get('table') || 'Deal';

        console.log(`🔍 Verificando schema da tabela: ${tableName}`);

        const pool = await getSQLServerConnection();

        // 1. Verificar se a tabela existe
        const tableCheck = await pool.request().query(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME = '${tableName}'
        `);

        if (tableCheck.recordset.length === 0) {
            return NextResponse.json({
                success: false,
                error: `Tabela '${tableName}' não encontrada no banco de dados`,
            }, { status: 404 });
        }

        // 2. Buscar colunas da tabela
        const columnsResult = await pool.request().query(`
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                IS_NULLABLE,
                CHARACTER_MAXIMUM_LENGTH,
                ORDINAL_POSITION
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${tableName}'
            ORDER BY ORDINAL_POSITION
        `);

        const columns = columnsResult.recordset;

        // 3. Verificar campos críticos para linkagem
        const criticalFields = [
            'DealId',
            'dealname',
            'ip__ecomm_bridge__order_number',
            'website_order_id',
            'amount',
            'closedate',
            'dealstage',
            'deal_currency_code',
            'currency',
            'hs_closed_won_date',
            'paid_status',
            'coupon_code',
            'total_payment',
        ];

        const fieldStatus = criticalFields.map(field => {
            const exists = columns.find((col: any) => 
                col.COLUMN_NAME.toLowerCase() === field.toLowerCase()
            );
            return {
                field,
                exists: !!exists,
                dataType: exists?.DATA_TYPE,
            };
        });

        // 4. Verificar tabelas relacionadas
        const relatedTables = [
            'Contact',
            'Company',
            'LineItem',
            'DealContactAssociations',
            'DealCompanyAssociations',
            'DealLineItemAssociations',
        ];

        const tablesResult = await pool.request().query(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME IN (${relatedTables.map(t => `'${t}'`).join(', ')})
        `);

        const relatedTablesStatus = relatedTables.map(tableName => ({
            table: tableName,
            exists: tablesResult.recordset.some(
                (row: any) => row.TABLE_NAME === tableName
            ),
        }));

        return NextResponse.json({
            success: true,
            table: tableName,
            totalColumns: columns.length,
            columns: columns.map((col: any) => ({
                name: col.COLUMN_NAME,
                type: col.DATA_TYPE,
                nullable: col.IS_NULLABLE === 'YES',
                maxLength: col.CHARACTER_MAXIMUM_LENGTH,
            })),
            criticalFields: fieldStatus,
            relatedTables: relatedTablesStatus,
            recommendations: generateRecommendations(fieldStatus, relatedTablesStatus),
        });

    } catch (error: any) {
        console.error('❌ Erro ao verificar schema:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
            details: error.toString(),
        }, { status: 500 });
    } finally {
        await closeSQLServerConnection();
    }
}

function generateRecommendations(
    fieldStatus: Array<{ field: string; exists: boolean; dataType?: string }>,
    relatedTables: Array<{ table: string; exists: boolean }>
): string[] {
    const recommendations: string[] = [];

    // Verificar campos de e-commerce
    const hasEcommOrder = fieldStatus.find(
        f => f.field === 'ip__ecomm_bridge__order_number' && f.exists
    );
    const hasWebsiteOrder = fieldStatus.find(
        f => f.field === 'website_order_id' && f.exists
    );

    if (!hasEcommOrder) {
        recommendations.push(
            '⚠️ Campo ip__ecomm_bridge__order_number não encontrado. ' +
            'Este campo é crítico para linkagem com Braintree/Stripe.'
        );
    }

    if (!hasWebsiteOrder) {
        recommendations.push(
            '⚠️ Campo website_order_id não encontrado. ' +
            'Considere usar outro campo para identificação de pedidos.'
        );
    }

    // Verificar tabelas relacionadas
    const missingTables = relatedTables.filter(t => !t.exists);
    if (missingTables.length > 0) {
        recommendations.push(
            `⚠️ Tabelas não encontradas: ${missingTables.map(t => t.table).join(', ')}. ` +
            'Query enriquecida pode falhar.'
        );
    }

    // Verificar Contact/Company
    const hasContact = relatedTables.find(t => t.table === 'Contact')?.exists;
    const hasCompany = relatedTables.find(t => t.table === 'Company')?.exists;
    const hasLineItem = relatedTables.find(t => t.table === 'LineItem')?.exists;

    if (hasContact && hasCompany && hasLineItem) {
        recommendations.push(
            '✅ Todas as tabelas relacionadas disponíveis. ' +
            'Pode usar query enriquecida com JOINs.'
        );
    }

    // Verificar campos de pagamento
    const hasPaidStatus = fieldStatus.find(
        f => f.field === 'paid_status' && f.exists
    );
    if (!hasPaidStatus) {
        recommendations.push(
            '⚠️ Campo paid_status não encontrado. ' +
            'Use hs_closed_won_date para determinar status de pagamento.'
        );
    }

    return recommendations;
}
