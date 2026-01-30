import { NextRequest, NextResponse } from 'next/server';
import { getSQLServerConnection, closeSQLServerConnection } from '@/lib/sqlserver';

/**
 * API para executar queries no SQL Server Data Warehouse
 * POST /api/hubspot/query
 * 
 * Body: { query: string, params?: Record<string, any> }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query, params = {} } = body;

        if (!query) {
            return NextResponse.json(
                { success: false, error: 'Query é obrigatória' },
                { status: 400 }
            );
        }

        // Validação básica de segurança - apenas SELECT permitido
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery.startsWith('select')) {
            return NextResponse.json(
                { success: false, error: 'Apenas queries SELECT são permitidas' },
                { status: 400 }
            );
        }

        console.log('Executando query no SQL Server:', query.substring(0, 100) + '...');

        const pool = await getSQLServerConnection();
        const request_sql = pool.request();

        // Adicionar parâmetros se fornecidos
        for (const [key, value] of Object.entries(params)) {
            request_sql.input(key, value);
        }

        const result = await request_sql.query(query);

        console.log(`Query retornou ${result.recordset.length} registros`);

        return NextResponse.json({
            success: true,
            count: result.recordset.length,
            data: result.recordset,
        });

    } catch (error: any) {
        console.error('Erro ao executar query:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erro ao executar query',
                details: error.toString(),
            },
            { status: 500 }
        );
    } finally {
        await closeSQLServerConnection();
    }
}
