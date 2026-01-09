// =====================================================
// Pleo API Sync Route
// Sincroniza despesas do Pleo para o Supabase
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Pleo API endpoints possíveis (API pode ter mudado)
const PLEO_API_BASES = [
    'https://external.pleo.io/v2',
    'https://external.pleo.io/v1',
    'https://api.pleo.io/v2',
    'https://api.pleo.io/v1'
];
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

        if (!PLEO_TOKEN || PLEO_TOKEN.trim() === '') {
            console.error('[Pleo Sync] PLEO_API_TOKEN não configurado ou vazio');
            return NextResponse.json(
                {
                    success: false,
                    error: 'PLEO_API_TOKEN não configurado. Adicione o token no arquivo .env.local'
                },
                { status: 400 }
            );
        }

        // Validar formato básico do token JWT (3 partes separadas por pontos)
        const tokenParts = PLEO_TOKEN.split('.');
        if (tokenParts.length !== 3) {
            console.error('[Pleo Sync] Token JWT inválido (formato incorreto)');
            return NextResponse.json(
                {
                    success: false,
                    error: 'Token JWT inválido. Verifique se o token está completo no .env.local'
                },
                { status: 400 }
            );
        }

        // Buscar parâmetros de data
        const { searchParams } = request.nextUrl;
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Tentar múltiplos endpoints possíveis
        const endpoints = ['expenses', 'transactions', 'export', 'spending'];

        let response: Response | null = null;
        let successUrl = '';

        // Testar cada combinação de base + endpoint
        for (const base of PLEO_API_BASES) {
            for (const endpoint of endpoints) {
                const queryParams = new URLSearchParams();
                if (startDate) queryParams.append('startDate', startDate);
                if (endDate) queryParams.append('endDate', endDate);
                queryParams.append('limit', '100');

                const testUrl = `${base}/${endpoint}?${queryParams.toString()}`;
                console.log('[Pleo Sync] Testando:', testUrl);

                try {
                    const testResponse = await fetch(testUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${PLEO_TOKEN}`,
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    });

                    console.log(`[Pleo Sync] ${testUrl} → Status: ${testResponse.status}`);

                    if (testResponse.ok) {
                        response = testResponse;
                        successUrl = testUrl;
                        console.log('[Pleo Sync] ✅ Endpoint funcionando:', successUrl);
                        break;
                    }
                } catch (err) {
                    console.log(`[Pleo Sync] ❌ Erro em ${testUrl}:`, err);
                }
            }
            if (response?.ok) break;
        }

        if (!response || !response.ok) {
            console.error('[Pleo Sync] Nenhum endpoint funcionou');
            return NextResponse.json({
                success: false,
                error: 'Nenhum endpoint da API Pleo está funcionando',
                details: `Testados: ${PLEO_API_BASES.length * endpoints.length} endpoints. Possíveis causas:
                  1. API do Pleo mudou de estrutura
                  2. Token precisa de renovação
                  3. Permissões insuficientes
                  
                  Visite https://app.pleo.io/settings/integrations para verificar seu token.`
            }, { status: 404 });
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
