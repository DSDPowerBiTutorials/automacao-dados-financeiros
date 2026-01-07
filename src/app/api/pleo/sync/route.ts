// =====================================================
// Pleo API Sync Route
// Sincroniza despesas do Pleo para o Supabase
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const PLEO_API_BASE = 'https://external.pleo.io/v1';
const PLEO_TOKEN = process.env.PLEO_API_TOKEN;

interface PleoExpense {
    id: string;
    createdAt: string;
    updatedAt: string;
    amount: {
        value: string;
        currency: string;
    };
    note?: string;
    status: string;
    merchant?: {
        name: string;
    };
    user: {
        id: string;
        name: string;
        email: string;
    };
    category?: {
        id: string;
        name: string;
    };
    receipt?: {
        url: string;
    };
}

export async function POST(request: NextRequest) {
    try {
        console.log('[Pleo Sync] Iniciando sincronização...');

        if (!PLEO_TOKEN) {
            console.error('[Pleo Sync] PLEO_API_TOKEN não configurado');
            return NextResponse.json(
                { success: false, error: 'PLEO_API_TOKEN não configurado' },
                { status: 500 }
            );
        }

        // Buscar parâmetros de data
        const { searchParams } = request.nextUrl;
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        let apiUrl = `${PLEO_API_BASE}/expenses`;
        const params = new URLSearchParams();

        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        params.append('limit', '100'); // Pegar 100 por vez

        if (params.toString()) {
            apiUrl += `?${params.toString()}`;
        }

        console.log('[Pleo Sync] Buscando despesas:', apiUrl);

        // 1. Buscar despesas da API Pleo
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${PLEO_TOKEN}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Pleo Sync] API error:', response.status, errorText);

            return NextResponse.json({
                success: false,
                error: `Pleo API error: ${response.status}`,
                details: errorText
            }, { status: response.status });
        }

        const responseData = await response.json();
        console.log('[Pleo Sync] Resposta da API recebida');

        // A estrutura pode ser { data: [...] } ou diretamente [...]
        const expenses: PleoExpense[] = responseData.data || responseData || [];

        if (!Array.isArray(expenses)) {
            console.error('[Pleo Sync] Formato de resposta inválido:', typeof expenses);
            return NextResponse.json({
                success: false,
                error: 'Formato de resposta da API inválido'
            }, { status: 500 });
        }

        console.log(`[Pleo Sync] ${expenses.length} despesas encontradas`);

        if (expenses.length === 0) {
            return NextResponse.json({
                success: true,
                imported: 0,
                message: 'Nenhuma despesa encontrada no período'
            });
        }

        // 2. Transformar para formato csv_rows
        const rows = expenses.map(exp => {
            const amount = parseFloat(exp.amount.value);
            const currency = exp.amount.currency;
            const date = exp.createdAt.split('T')[0]; // ISO date

            return {
                source: 'pleo',
                date: date,
                description: `${exp.merchant?.name || 'Despesa'} - ${exp.user.name}`,
                amount: -Math.abs(amount), // Negativo pois é despesa
                reconciled: false,
                custom_data: {
                    pleo_expense_id: exp.id,
                    merchant: exp.merchant?.name,
                    category: exp.category?.name,
                    user_id: exp.user.id,
                    user_name: exp.user.name,
                    user_email: exp.user.email,
                    status: exp.status,
                    currency: currency,
                    note: exp.note,
                    receipt_url: exp.receipt?.url,
                    created_at: exp.createdAt,
                    updated_at: exp.updatedAt
                }
            };
        });

        console.log('[Pleo Sync] Inserindo no Supabase...');

        // 3. Inserir no Supabase (upsert para evitar duplicados)
        const { data, error } = await supabaseAdmin
            .from('csv_rows')
            .upsert(rows, {
                onConflict: 'id',
                ignoreDuplicates: false
            })
            .select();

        if (error) {
            console.error('[Pleo Sync] Supabase error:', error);
            return NextResponse.json({
                success: false,
                error: 'Erro ao salvar no Supabase',
                details: error.message
            }, { status: 500 });
        }

        // 4. Atualizar metadata de sincronização
        const now = new Date().toISOString();
        await supabaseAdmin
            .from('sync_metadata')
            .upsert({
                source: 'pleo',
                last_api_sync: now,
                total_records: rows.length,
                last_sync_status: 'success',
                last_sync_error: null
            }, { onConflict: 'source' });

        console.log(`[Pleo Sync] ✅ ${rows.length} despesas sincronizadas com sucesso`);

        return NextResponse.json({
            success: true,
            imported: rows.length,
            expenses: data
        });

    } catch (error: any) {
        console.error('[Pleo Sync] Erro:', error);

        // Salvar erro no metadata
        await supabaseAdmin
            .from('sync_metadata')
            .upsert({
                source: 'pleo',
                last_sync_status: 'error',
                last_sync_error: error.message
            }, { onConflict: 'source' });

        return NextResponse.json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        }, { status: 500 });
    }
}

// GET endpoint para buscar despesas locais
export async function GET(request: NextRequest) {
    try {
        const { data, error } = await supabaseAdmin
            .from('csv_rows')
            .select('*')
            .eq('source', 'pleo')
            .order('date', { ascending: false });

        if (error) throw error;

        return NextResponse.json({
            success: true,
            expenses: data
        });

    } catch (error: any) {
        console.error('[Pleo API] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
