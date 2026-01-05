import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Endpoint para limpar dados corrompidos do HubSpot
 * DELETE /api/hubspot/cleanup
 * 
 * Remove todos os dados do HubSpot no Supabase.
 * Após deletar, você deve executar /api/hubspot/sync para re-sincronizar.
 */
export async function DELETE(request: Request) {
    try {
        console.log('🗑️ Iniciando limpeza de dados do HubSpot...');

        // 1. Contar quantos registros existem
        const { count: beforeCount } = await supabaseAdmin
            .from('csv_rows')
            .select('*', { count: 'exact', head: true })
            .eq('source', 'hubspot');

        console.log(`📊 Encontrados ${beforeCount} registros do HubSpot`);

        if (!beforeCount || beforeCount === 0) {
            return NextResponse.json({
                success: true,
                message: 'Nenhum dado do HubSpot para deletar',
                deleted: 0,
            });
        }

        // 2. Deletar todos os registros do HubSpot
        const { error: deleteError } = await supabaseAdmin
            .from('csv_rows')
            .delete()
            .eq('source', 'hubspot');

        if (deleteError) {
            console.error('❌ Erro ao deletar dados:', deleteError);
            throw deleteError;
        }

        // 3. Verificar se realmente deletou
        const { count: afterCount } = await supabaseAdmin
            .from('csv_rows')
            .select('*', { count: 'exact', head: true })
            .eq('source', 'hubspot');

        console.log(`✅ Limpeza completa! ${beforeCount} registros deletados`);
        console.log(`📊 Registros restantes: ${afterCount}`);

        return NextResponse.json({
            success: true,
            message: `${beforeCount} registros do HubSpot deletados com sucesso`,
            deleted: beforeCount,
            remaining: afterCount || 0,
            nextStep: 'Execute POST /api/hubspot/sync para re-sincronizar',
        });

    } catch (error: any) {
        console.error('❌ Erro na limpeza:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Erro ao deletar dados',
            details: error.toString(),
        }, { status: 500 });
    }
}

/**
 * GET - Informações sobre limpeza
 */
export async function GET() {
    try {
        const { count, error } = await supabaseAdmin
            .from('csv_rows')
            .select('*', { count: 'exact', head: true })
            .eq('source', 'hubspot');

        if (error) throw error;

        return NextResponse.json({
            success: true,
            currentRecords: count || 0,
            message: count
                ? `Existem ${count} registros do HubSpot no Supabase`
                : 'Nenhum dado do HubSpot encontrado',
            cleanupEndpoint: 'DELETE /api/hubspot/cleanup',
            syncEndpoint: 'POST /api/hubspot/sync',
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}
