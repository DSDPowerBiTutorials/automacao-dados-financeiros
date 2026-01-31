/**
 * API Endpoint: Reconciliação Automática GoCardless ↔ Bankinter EUR
 * 
 * POST /api/reconcile/gocardless-bankinter
 * 
 * Reconcilia automaticamente lançamentos do Bankinter EUR que contêm "gocardless" 
 * na descrição com payouts do GoCardless.
 * 
 * O GoCardless faz payouts para a conta Bankinter EUR com a descrição:
 * "Transf otras e/gocardless sas"
 * 
 * Diferença do Stripe: GoCardless envia payouts consolidados que podem representar
 * múltiplos pagamentos. O match pode ser:
 * 1. Match exato: mesmo valor + data ±3 dias
 * 2. Match por soma: soma de payouts próximos = valor banco
 * 3. Match manual: quando valor não bate exatamente
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface GoCardlessPayoutInfo {
    id: string;
    date: string;
    amount: number;
    payoutId: string;
    description: string;
    status: string;
    reconciled: boolean;
}

interface BankRow {
    id: string;
    date: string;
    amount: number;
    description: string;
    reconciled: boolean;
    custom_data?: any;
}

interface Match {
    bankRowId: string;
    bankDate: string;
    bankAmount: number;
    bankDescription: string;
    gcPayoutIds: string[];
    gcPayoutDbIds: string[];
    gcTotalAmount: number;
    gcDates: string[];
    matchType: 'exact' | 'sum' | 'approximate';
    dateDiff: number;
    amountDiff: number;
}

/**
 * Busca todos os payouts GoCardless não reconciliados
 * Payouts são registros com custom_data.type = 'payout'
 */
async function fetchGoCardlessPayouts(): Promise<GoCardlessPayoutInfo[]> {
    const { data, error } = await supabaseAdmin
        .from('csv_rows')
        .select('*')
        .eq('source', 'gocardless')
        .eq('custom_data->>type', 'payout')
        .eq('reconciled', false)
        .order('date', { ascending: false });

    if (error) {
        console.error('[GoCardless Reconcile] Error fetching payouts:', error);
        return [];
    }

    return (data || []).map(tx => {
        const cd = tx.custom_data || {};
        return {
            id: tx.id,
            date: tx.date?.split('T')[0],
            amount: Math.round(parseFloat(tx.amount) * 100) / 100,
            payoutId: cd.payout_id || cd.gocardless_id || tx.id,
            description: tx.description || '',
            status: cd.status || 'unknown',
            reconciled: tx.reconciled || false
        };
    });
}

/**
 * Busca lançamentos Bankinter EUR que contêm "gocardless" na descrição
 */
async function fetchBankinterGoCardlessRows(): Promise<BankRow[]> {
    const { data, error } = await supabaseAdmin
        .from('csv_rows')
        .select('*')
        .eq('source', 'bankinter-eur')
        .eq('reconciled', false)
        .ilike('description', '%gocardless%')
        .gt('amount', 0) // Apenas créditos
        .order('date', { ascending: false });

    if (error) {
        console.error('[GoCardless Reconcile] Error fetching Bankinter rows:', error);
        return [];
    }

    return (data || []).map(r => ({
        id: r.id,
        date: r.date?.split('T')[0],
        amount: Math.round(parseFloat(r.amount) * 100) / 100,
        description: r.description || '',
        reconciled: r.reconciled || false,
        custom_data: r.custom_data || {}
    }));
}

/**
 * Tenta encontrar matches entre banco e payouts GoCardless
 */
function findMatches(bankRows: BankRow[], gcPayouts: GoCardlessPayoutInfo[]): Match[] {
    const matches: Match[] = [];
    const usedPayouts = new Set<string>();
    const usedBankRows = new Set<string>();

    // Ordenar payouts por data para facilitar agrupamento
    const sortedPayouts = [...gcPayouts].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const bank of bankRows) {
        if (usedBankRows.has(bank.id)) continue;

        const bankDate = new Date(bank.date);
        const bankAmt = bank.amount;

        // 1. Tentar match exato (mesmo valor, data ±3 dias)
        const exactMatch = sortedPayouts.find(p => {
            if (usedPayouts.has(p.id)) return false;
            const pDate = new Date(p.date);
            const daysDiff = Math.abs((bankDate.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24));
            const amtDiff = Math.abs(bankAmt - p.amount);
            return amtDiff < 1 && daysDiff <= 5;
        });

        if (exactMatch) {
            const pDate = new Date(exactMatch.date);
            const daysDiff = Math.round((bankDate.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24));
            
            matches.push({
                bankRowId: bank.id,
                bankDate: bank.date,
                bankAmount: bankAmt,
                bankDescription: bank.description,
                gcPayoutIds: [exactMatch.payoutId],
                gcPayoutDbIds: [exactMatch.id],
                gcTotalAmount: exactMatch.amount,
                gcDates: [exactMatch.date],
                matchType: 'exact',
                dateDiff: daysDiff,
                amountDiff: Math.abs(bankAmt - exactMatch.amount)
            });

            usedPayouts.add(exactMatch.id);
            usedBankRows.add(bank.id);
            continue;
        }

        // 2. Tentar match por soma de payouts próximos
        // Pegar payouts em janela de 10 dias antes do depósito bancário
        const windowStart = new Date(bankDate);
        windowStart.setDate(windowStart.getDate() - 15);
        
        const payoutsInWindow = sortedPayouts.filter(p => {
            if (usedPayouts.has(p.id)) return false;
            const pDate = new Date(p.date);
            return pDate >= windowStart && pDate <= bankDate;
        });

        // Tentar combinações de payouts que somem o valor do banco
        // Começar com payouts mais próximos da data do banco
        const sortedByProximity = [...payoutsInWindow].sort((a, b) => {
            const aDiff = Math.abs(new Date(a.date).getTime() - bankDate.getTime());
            const bDiff = Math.abs(new Date(b.date).getTime() - bankDate.getTime());
            return aDiff - bDiff;
        });

        // Tentar soma cumulativa
        let sum = 0;
        const selectedPayouts: GoCardlessPayoutInfo[] = [];
        
        for (const payout of sortedByProximity) {
            if (Math.abs(sum + payout.amount - bankAmt) < Math.abs(sum - bankAmt)) {
                selectedPayouts.push(payout);
                sum += payout.amount;
            }
            
            // Se chegamos próximo o suficiente (diferença < €5 ou < 0.1%)
            if (Math.abs(sum - bankAmt) < 5 || Math.abs(sum - bankAmt) / bankAmt < 0.001) {
                break;
            }
        }

        // Verificar se a soma está próxima o suficiente
        const sumDiff = Math.abs(sum - bankAmt);
        if (selectedPayouts.length > 0 && (sumDiff < 5 || sumDiff / bankAmt < 0.01)) {
            matches.push({
                bankRowId: bank.id,
                bankDate: bank.date,
                bankAmount: bankAmt,
                bankDescription: bank.description,
                gcPayoutIds: selectedPayouts.map(p => p.payoutId),
                gcPayoutDbIds: selectedPayouts.map(p => p.id),
                gcTotalAmount: sum,
                gcDates: selectedPayouts.map(p => p.date),
                matchType: 'sum',
                dateDiff: Math.max(...selectedPayouts.map(p => 
                    Math.abs((bankDate.getTime() - new Date(p.date).getTime()) / (1000 * 60 * 60 * 24))
                )),
                amountDiff: sumDiff
            });

            selectedPayouts.forEach(p => usedPayouts.add(p.id));
            usedBankRows.add(bank.id);
        }
    }

    return matches;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const dryRun = body.dryRun !== false;

        console.log('[GoCardless Reconcile] Starting...', { dryRun });

        // Buscar dados
        const [gcPayouts, bankRows] = await Promise.all([
            fetchGoCardlessPayouts(),
            fetchBankinterGoCardlessRows()
        ]);

        console.log('[GoCardless Reconcile] Found:', {
            gcPayouts: gcPayouts.length,
            bankRows: bankRows.length
        });

        if (gcPayouts.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Nenhum payout GoCardless não reconciliado encontrado',
                stats: {
                    gcPayoutsAvailable: 0,
                    bankRowsAvailable: bankRows.length,
                    matchesFound: 0
                },
                needsSync: true,
                syncMessage: 'Execute POST /api/gocardless/sync para buscar payouts recentes'
            });
        }

        if (bankRows.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Nenhum lançamento Bankinter com GoCardless não reconciliado',
                stats: {
                    gcPayoutsAvailable: gcPayouts.length,
                    bankRowsAvailable: 0,
                    matchesFound: 0
                }
            });
        }

        // Encontrar matches
        const matches = findMatches(bankRows, gcPayouts);

        console.log('[GoCardless Reconcile] Matches found:', matches.length);

        if (matches.length === 0) {
            // Retornar informações para análise manual
            return NextResponse.json({
                success: true,
                message: 'Nenhum match automático encontrado',
                stats: {
                    gcPayoutsAvailable: gcPayouts.length,
                    bankRowsAvailable: bankRows.length,
                    matchesFound: 0
                },
                analysis: {
                    gcPayouts: gcPayouts.slice(0, 10).map(p => ({
                        date: p.date,
                        amount: p.amount,
                        payoutId: p.payoutId,
                        status: p.status
                    })),
                    bankRows: bankRows.slice(0, 10).map(b => ({
                        date: b.date,
                        amount: b.amount,
                        description: b.description
                    }))
                }
            });
        }

        // Calcular total
        const totalValue = matches.reduce((sum, m) => sum + m.bankAmount, 0);

        if (dryRun) {
            return NextResponse.json({
                success: true,
                dryRun: true,
                message: `Encontrados ${matches.length} matches potenciais`,
                stats: {
                    gcPayoutsAvailable: gcPayouts.length,
                    bankRowsAvailable: bankRows.length,
                    matchesFound: matches.length,
                    totalValueToReconcile: `€${totalValue.toFixed(2)}`
                },
                matches: matches.map(m => ({
                    bank: {
                        date: m.bankDate,
                        amount: `€${m.bankAmount.toFixed(2)}`,
                        description: m.bankDescription.substring(0, 50)
                    },
                    gocardless: {
                        payoutCount: m.gcPayoutIds.length,
                        payoutIds: m.gcPayoutIds,
                        dates: m.gcDates,
                        totalAmount: `€${m.gcTotalAmount.toFixed(2)}`
                    },
                    matchType: m.matchType,
                    dateDiff: m.dateDiff,
                    amountDiff: `€${m.amountDiff.toFixed(2)}`
                }))
            });
        }

        // Aplicar reconciliação
        let reconciled = 0;
        const errors: string[] = [];

        for (const match of matches) {
            try {
                // Atualizar linha do banco
                const { error: bankError } = await supabaseAdmin
                    .from('csv_rows')
                    .update({
                        reconciled: true,
                        custom_data: {
                            reconciled_at: new Date().toISOString(),
                            reconciled_with: 'gocardless',
                            gc_payout_ids: match.gcPayoutIds,
                            gc_payout_count: match.gcPayoutIds.length,
                            gc_total_amount: match.gcTotalAmount,
                            match_type: match.matchType,
                            amount_diff: match.amountDiff
                        }
                    })
                    .eq('id', match.bankRowId);

                if (bankError) {
                    errors.push(`Bank row ${match.bankRowId}: ${bankError.message}`);
                    continue;
                }

                // Atualizar payouts GoCardless - marcar como reconciliados
                for (const gcDbId of match.gcPayoutDbIds) {
                    // Primeiro buscar dados atuais para preservar custom_data existente
                    const { data: existingRow } = await supabaseAdmin
                        .from('csv_rows')
                        .select('custom_data')
                        .eq('id', gcDbId)
                        .single();

                    const existingCustomData = existingRow?.custom_data || {};
                    
                    const { error: gcError } = await supabaseAdmin
                        .from('csv_rows')
                        .update({
                            reconciled: true,
                            custom_data: {
                                ...existingCustomData,
                                reconciled_at: new Date().toISOString(),
                                reconciled_with_bank_id: match.bankRowId,
                                reconciled_bank_date: match.bankDate,
                                reconciled_bank_amount: match.bankAmount
                            }
                        })
                        .eq('id', gcDbId);

                    if (gcError) {
                        console.error(`[GoCardless Reconcile] Error updating payout ${gcDbId}:`, gcError);
                    }
                }

                reconciled++;
            } catch (err) {
                errors.push(`Match error: ${err}`);
            }
        }

        return NextResponse.json({
            success: true,
            dryRun: false,
            message: `Reconciliados ${reconciled} de ${matches.length} matches`,
            stats: {
                matchesFound: matches.length,
                reconciled,
                errors: errors.length,
                totalValueReconciled: `€${totalValue.toFixed(2)}`
            },
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('[GoCardless Reconcile] Error:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        // Status da reconciliação
        const [gcPayouts, bankRows] = await Promise.all([
            fetchGoCardlessPayouts(),
            fetchBankinterGoCardlessRows()
        ]);

        // Buscar também payouts já reconciliados para estatísticas
        const { data: reconciledPayouts } = await supabaseAdmin
            .from('csv_rows')
            .select('id, date, amount')
            .eq('source', 'gocardless')
            .eq('custom_data->>type', 'payout')
            .eq('reconciled', true);

        const { data: reconciledBank } = await supabaseAdmin
            .from('csv_rows')
            .select('id, date, amount')
            .eq('source', 'bankinter-eur')
            .eq('reconciled', true)
            .ilike('description', '%gocardless%');

        return NextResponse.json({
            success: true,
            status: {
                pendingGCPayouts: gcPayouts.length,
                pendingBankRows: bankRows.length,
                reconciledPayouts: reconciledPayouts?.length || 0,
                reconciledBankRows: reconciledBank?.length || 0
            },
            pendingPayouts: gcPayouts.slice(0, 10).map(p => ({
                date: p.date,
                amount: `€${p.amount.toFixed(2)}`,
                payoutId: p.payoutId,
                status: p.status
            })),
            pendingBankRows: bankRows.slice(0, 10).map(b => ({
                date: b.date,
                amount: `€${b.amount.toFixed(2)}`,
                description: b.description.substring(0, 50)
            }))
        });

    } catch (error) {
        console.error('[GoCardless Reconcile] GET Error:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        );
    }
}
