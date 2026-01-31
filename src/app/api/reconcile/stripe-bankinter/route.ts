/**
 * API Endpoint: Reconciliação Automática Stripe ↔ Bankinter EUR
 * 
 * POST /api/reconcile/stripe-bankinter
 * 
 * Reconcilia automaticamente lançamentos do Bankinter EUR que contêm "stripe" 
 * na descrição com payouts do Stripe (EUR e USD que caem no Bankinter EUR).
 * 
 * O Stripe faz payouts para a conta Bankinter EUR com a descrição:
 * "Trans/stripe technology europ"
 * 
 * Estratégia de Match:
 * 1. Match exato: mesmo valor (±0.01) + mesma data (arrival_date = fecha_valor)
 * 2. Match por data: mesmo valor (±0.01) + data ±2 dias
 * 3. Match por valor: mesmo valor (±0.10) + descrição contém "stripe"
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface StripePayoutInfo {
    id: string;
    source: string;
    date: string;
    amount: number;
    payoutId: string;
    currency: string;
    arrivalDate: string;
    stripeAccountName?: string;
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
    stripePayoutId: string;
    stripeDate: string;
    stripeAmount: number;
    stripeSource: string;
    matchType: 'exact' | 'date_range' | 'description_amount';
    dateDiff: number;
    amountDiff: number;
}

async function fetchStripePayouts(): Promise<StripePayoutInfo[]> {
    // Buscar todos os payouts Stripe (EUR + USD) não reconciliados
    const { data, error } = await supabaseAdmin
        .from('csv_rows')
        .select('*')
        .or('source.eq.stripe-eur-payouts,source.eq.stripe-usd-payouts')
        .eq('reconciled', false)
        .gt('amount', 0) // Apenas créditos
        .order('date', { ascending: false });

    if (error) {
        console.error('[Stripe Reconcile] Error fetching payouts:', error);
        return [];
    }

    return (data || []).map(tx => {
        const cd = tx.custom_data || {};
        return {
            id: tx.id,
            source: tx.source,
            date: tx.date?.split('T')[0],
            amount: Math.round(parseFloat(tx.amount) * 100) / 100,
            payoutId: cd.transaction_id || cd.payout_id || tx.id,
            currency: cd.currency || (tx.source?.includes('usd') ? 'USD' : 'EUR'),
            arrivalDate: cd.arrival_date?.split('T')[0] || tx.date?.split('T')[0],
            stripeAccountName: cd.stripe_account_name
        };
    });
}

async function fetchBankinterStripeRows(): Promise<BankRow[]> {
    // Buscar lançamentos Bankinter EUR que contêm "stripe" na descrição
    // Excluir débitos (Recibo/stripe) focando apenas nos créditos (Trans/stripe)
    const { data, error } = await supabaseAdmin
        .from('csv_rows')
        .select('*')
        .eq('source', 'bankinter-eur')
        .eq('reconciled', false)
        .ilike('description', '%stripe%')
        .gt('amount', 0) // Apenas créditos
        .order('date', { ascending: false });

    if (error) {
        console.error('[Stripe Reconcile] Error fetching Bankinter rows:', error);
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

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const dryRun = body.dryRun !== false;

        console.log(`[Stripe Reconcile] Starting... dryRun=${dryRun}`);

        // Buscar dados em paralelo
        const [stripePayouts, bankRows] = await Promise.all([
            fetchStripePayouts(),
            fetchBankinterStripeRows()
        ]);

        console.log(`[Stripe Reconcile] Found ${stripePayouts.length} Stripe payouts, ${bankRows.length} Bankinter rows`);

        const matches: Match[] = [];
        const matchedBankIds = new Set<string>();
        const matchedPayoutIds = new Set<string>();

        // Criar índice por valor para busca rápida
        const payoutsByAmount = new Map<string, StripePayoutInfo[]>();
        stripePayouts.forEach(p => {
            const key = p.amount.toFixed(2);
            if (!payoutsByAmount.has(key)) payoutsByAmount.set(key, []);
            payoutsByAmount.get(key)!.push(p);
        });

        // Para cada lançamento Bankinter, tentar encontrar payout correspondente
        for (const bankRow of bankRows) {
            if (matchedBankIds.has(bankRow.id)) continue;

            const bankAmount = bankRow.amount;
            const bankDate = bankRow.date;
            const bankDateObj = new Date(bankDate);

            let bestMatch: StripePayoutInfo | null = null;
            let matchType: 'exact' | 'date_range' | 'description_amount' | null = null;
            let dateDiff = 0;
            let amountDiff = 0;

            // Candidatos com mesmo valor (±0.01)
            const exactAmountKey = bankAmount.toFixed(2);
            const candidates = payoutsByAmount.get(exactAmountKey)?.filter(
                p => !matchedPayoutIds.has(p.payoutId)
            ) || [];

            // 1. Match exato: mesmo valor + mesma data
            for (const payout of candidates) {
                const payoutDateObj = new Date(payout.arrivalDate);
                const daysDiff = Math.abs((bankDateObj.getTime() - payoutDateObj.getTime()) / 86400000);

                if (daysDiff === 0 && Math.abs(payout.amount - bankAmount) < 0.01) {
                    bestMatch = payout;
                    matchType = 'exact';
                    dateDiff = 0;
                    amountDiff = Math.abs(payout.amount - bankAmount);
                    break;
                }
            }

            // 2. Match por data range: mesmo valor + ±2 dias
            if (!bestMatch) {
                for (const payout of candidates) {
                    const payoutDateObj = new Date(payout.arrivalDate);
                    const daysDiff = Math.abs((bankDateObj.getTime() - payoutDateObj.getTime()) / 86400000);

                    if (daysDiff <= 2 && Math.abs(payout.amount - bankAmount) < 0.01) {
                        bestMatch = payout;
                        matchType = 'date_range';
                        dateDiff = daysDiff;
                        amountDiff = Math.abs(payout.amount - bankAmount);
                        break;
                    }
                }
            }

            // 3. Match por descrição + valor aproximado (tolerância maior)
            if (!bestMatch && bankRow.description.toLowerCase().includes('stripe')) {
                // Buscar em todos os payouts não matched com valor próximo
                for (const payout of stripePayouts) {
                    if (matchedPayoutIds.has(payout.payoutId)) continue;

                    const valueDiff = Math.abs(payout.amount - bankAmount);
                    if (valueDiff < 0.10) {
                        bestMatch = payout;
                        matchType = 'description_amount';
                        const payoutDateObj = new Date(payout.arrivalDate);
                        dateDiff = Math.abs((bankDateObj.getTime() - payoutDateObj.getTime()) / 86400000);
                        amountDiff = valueDiff;
                        break;
                    }
                }
            }

            if (bestMatch && matchType) {
                matchedBankIds.add(bankRow.id);
                matchedPayoutIds.add(bestMatch.payoutId);

                matches.push({
                    bankRowId: bankRow.id,
                    bankDate: bankDate,
                    bankAmount: bankAmount,
                    bankDescription: bankRow.description,
                    stripePayoutId: bestMatch.payoutId,
                    stripeDate: bestMatch.arrivalDate,
                    stripeAmount: bestMatch.amount,
                    stripeSource: bestMatch.source,
                    matchType,
                    dateDiff,
                    amountDiff
                });
            }
        }

        console.log(`[Stripe Reconcile] Found ${matches.length} matches`);

        // Aplicar matches se não for dry run
        let updated = 0;
        let stripeUpdated = 0;

        if (!dryRun && matches.length > 0) {
            for (const match of matches) {
                // Atualizar lançamento Bankinter
                const { data: currentBankRow } = await supabaseAdmin
                    .from('csv_rows')
                    .select('custom_data')
                    .eq('id', match.bankRowId)
                    .single();

                const bankCustomData = {
                    ...(currentBankRow?.custom_data || {}),
                    reconciled_at: new Date().toISOString(),
                    reconciliationType: 'automatic',
                    paymentSource: 'Stripe',
                    stripe_payout_id: match.stripePayoutId,
                    stripe_payout_date: match.stripeDate,
                    stripe_payout_amount: match.stripeAmount,
                    stripe_source: match.stripeSource,
                    match_type: match.matchType,
                    date_diff_days: match.dateDiff,
                    amount_diff: match.amountDiff
                };

                const { error: bankError } = await supabaseAdmin
                    .from('csv_rows')
                    .update({
                        reconciled: true,
                        custom_data: bankCustomData,
                        matched_with: `stripe:${match.stripePayoutId}`
                    })
                    .eq('id', match.bankRowId);

                if (bankError) {
                    console.error('[Stripe Reconcile] Error updating bank row:', bankError);
                } else {
                    updated++;
                }

                // Também marcar o payout Stripe como reconciliado
                const { data: stripePayout } = await supabaseAdmin
                    .from('csv_rows')
                    .select('id, custom_data')
                    .or('source.eq.stripe-eur-payouts,source.eq.stripe-usd-payouts')
                    .filter('custom_data->>transaction_id', 'eq', match.stripePayoutId)
                    .single();

                if (stripePayout) {
                    const stripeCustomData = {
                        ...(stripePayout.custom_data || {}),
                        reconciled_at: new Date().toISOString(),
                        reconciled_with_bank: true,
                        bank_row_id: match.bankRowId,
                        bank_date: match.bankDate,
                        bank_amount: match.bankAmount
                    };

                    const { error: stripeError } = await supabaseAdmin
                        .from('csv_rows')
                        .update({
                            reconciled: true,
                            custom_data: stripeCustomData,
                            matched_with: `bankinter-eur:${match.bankRowId}`
                        })
                        .eq('id', stripePayout.id);

                    if (!stripeError) {
                        stripeUpdated++;
                    }
                }
            }
        }

        const totalValue = matches.reduce((sum, m) => sum + m.bankAmount, 0);

        // Estatísticas por tipo de match
        const matchStats = {
            exact: matches.filter(m => m.matchType === 'exact').length,
            date_range: matches.filter(m => m.matchType === 'date_range').length,
            description_amount: matches.filter(m => m.matchType === 'description_amount').length
        };

        return NextResponse.json({
            success: true,
            dryRun,
            summary: {
                stripePayoutsTotal: stripePayouts.length,
                bankinterRowsTotal: bankRows.length,
                matchesFound: matches.length,
                unmatchedBankinter: bankRows.length - matches.length,
                unmatchedStripe: stripePayouts.length - matches.length,
                totalValueReconciled: Math.round(totalValue * 100) / 100,
                bankRowsUpdated: dryRun ? 0 : updated,
                stripeRowsUpdated: dryRun ? 0 : stripeUpdated,
                matchTypes: matchStats
            },
            matches: matches.map(m => ({
                ...m,
                stripePayoutIdShort: m.stripePayoutId.substring(0, 20) + '...'
            }))
        });

    } catch (error: any) {
        console.error('[Stripe Reconcile] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

export async function GET() {
    // GET retorna status atual da reconciliação
    try {
        const [stripePayouts, bankRows] = await Promise.all([
            fetchStripePayouts(),
            fetchBankinterStripeRows()
        ]);

        // Contar reconciliados
        const { count: reconciledStripe } = await supabaseAdmin
            .from('csv_rows')
            .select('*', { count: 'exact', head: true })
            .or('source.eq.stripe-eur-payouts,source.eq.stripe-usd-payouts')
            .eq('reconciled', true);

        const { count: reconciledBank } = await supabaseAdmin
            .from('csv_rows')
            .select('*', { count: 'exact', head: true })
            .eq('source', 'bankinter-eur')
            .eq('reconciled', true)
            .ilike('description', '%stripe%');

        return NextResponse.json({
            success: true,
            status: {
                stripePayouts: {
                    unreconciled: stripePayouts.length,
                    reconciled: reconciledStripe || 0
                },
                bankinterStripe: {
                    unreconciled: bankRows.length,
                    reconciled: reconciledBank || 0
                }
            },
            hint: 'POST to this endpoint to run reconciliation. Use { "dryRun": false } to apply changes.'
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
