import { NextResponse } from 'next/server';
import { getSQLServerConnection, closeSQLServerConnection } from '@/lib/sqlserver';

/**
 * API para verificar tabelas disponíveis no SQL Server Data Warehouse
 * GET /api/hubspot/tables
 */
export async function GET() {
    try {
        console.log('Verificando tabelas disponíveis no SQL Server...');

        const pool = await getSQLServerConnection();

        // Query para listar todas as tabelas
        const tablesResult = await pool.request().query(`
            SELECT 
                TABLE_SCHEMA,
                TABLE_NAME,
                TABLE_TYPE
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `);

        console.log(`Encontradas ${tablesResult.recordset.length} tabelas`);

        // Para cada tabela, buscar colunas
        const tablesWithColumns = await Promise.all(
            tablesResult.recordset.map(async (table: any) => {
                const columnsResult = await pool.request()
                    .input('tableName', table.TABLE_NAME)
                    .input('schemaName', table.TABLE_SCHEMA)
                    .query(`
                        SELECT 
                            COLUMN_NAME,
                            DATA_TYPE,
                            IS_NULLABLE,
                            CHARACTER_MAXIMUM_LENGTH
                        FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_NAME = @tableName 
                        AND TABLE_SCHEMA = @schemaName
                        ORDER BY ORDINAL_POSITION
                    `);

                return {
                    schema: table.TABLE_SCHEMA,
                    name: table.TABLE_NAME,
                    type: table.TABLE_TYPE,
                    columns: columnsResult.recordset,
                };
            })
        );

        return NextResponse.json({
            success: true,
            count: tablesWithColumns.length,
            tables: tablesWithColumns,
        });

    } catch (error: any) {
        console.error('Erro ao verificar tabelas:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erro ao conectar no SQL Server',
                details: error.toString(),
            },
            { status: 500 }
        );
    } finally {
        await closeSQLServerConnection();
    }
}
