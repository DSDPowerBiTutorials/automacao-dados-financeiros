import { NextResponse } from 'next/server';
import { getSQLServerConnection, closeSQLServerConnection } from '@/lib/sqlserver';
import { supabaseAdmin } from '@/lib/supabase';

// Rota para sincronizar dados do HubSpot via SQL Server Data Warehouse
export async function POST(request: Request) {
    try {
        console.log('Iniciando sincronização HubSpot...');

        // Conectar no SQL Server
        const pool = await getSQLServerConnection();

        // Query para buscar deals/vendas do HubSpot
        // Ajuste conforme as tabelas disponíveis no seu Data Warehouse
        const result = await pool.request().query(`
      SELECT TOP 1000
        deal_id,
        deal_name,
        amount,
        close_date,
        stage,
        pipeline,
        owner_name,
        company_name,
        currency_code,
        created_date,
        modified_date
      FROM deals
      WHERE close_date >= DATEADD(month, -6, GETDATE())
      ORDER BY close_date DESC
    `);

        console.log(`Encontrados ${result.recordset.length} deals no SQL Server`);

        // Transformar dados para o formato csv_rows
        const rows = result.recordset.map((deal: any) => ({
            source: 'hubspot',
            date: deal.close_date,
            description: `${deal.deal_name} - ${deal.company_name || 'N/A'}`,
            amount: parseFloat(deal.amount) || 0,
            reconciled: false,
            custom_data: {
                deal_id: deal.deal_id,
                stage: deal.stage,
                pipeline: deal.pipeline,
                owner: deal.owner_name,
                company: deal.company_name,
                currency: deal.currency_code || 'EUR',
                created_date: deal.created_date,
                modified_date: deal.modified_date,
            },
        }));

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
