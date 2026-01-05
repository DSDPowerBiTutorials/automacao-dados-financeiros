import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { findBestMatch, type MatchCandidate } from '@/lib/matching-engine';

/**
 * API de Auto-Matching: HubSpot ↔ Payment Channels
 * 
 * POST /api/hubspot/auto-match
 * Body: { 
 *   hubspotIds?: string[], // IDs específicos ou todos se vazio
 *   minConfidence?: number, // Mínimo 70%
 *   dryRun?: boolean // true = apenas testar sem salvar
 * }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            hubspotIds,
            minConfidence = 70,
            dryRun = false
        } = body;

        console.log('🤖 Iniciando auto-matching...');
        console.log(`   Confidence mínimo: ${minConfidence}%`);
        console.log(`   Dry run: ${dryRun ? 'SIM (não vai salvar)' : 'NÃO (vai salvar)'}`);

        // 1. BUSCAR DEALS DO HUBSPOT (não reconciliados)
        let hubspotQuery = supabaseAdmin
            .from('csv_rows')
            .select('*')
            .eq('source', 'hubspot')
            .eq('reconciled', false);

        if (hubspotIds && hubspotIds.length > 0) {
            hubspotQuery = hubspotQuery.in('id', hubspotIds);
        }

        const { data: hubspotRecords, error: hubspotError } = await hubspotQuery;

        if (hubspotError) throw hubspotError;
        if (!hubspotRecords || hubspotRecords.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Nenhum deal do HubSpot para processar',
                stats: { total: 0, matched: 0, unmatched: 0 },
            });
        }

        console.log(`📊 ${hubspotRecords.length} deals do HubSpot para processar`);

        // 2. BUSCAR TRANSAÇÕES DOS PAYMENT CHANNELS (não reconciliadas)
        const { data: paymentRecords, error: paymentError } = await supabaseAdmin
            .from('csv_rows')
            .select('*')
            .in('source', ['braintree-eur', 'braintree-usd', 'gocardless-eur', 'gocardless-gbp', 'stripe-eur'])
            .eq('reconciled', false);

        if (paymentError) throw paymentError;
        if (!paymentRecords || paymentRecords.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Nenhuma transação de payment channel para comparar',
                stats: { total: hubspotRecords.length, matched: 0, unmatched: hubspotRecords.length },
            });
        }

        console.log(`💳 ${paymentRecords.length} transações de payment channels disponíveis`);

        // 3. PROCESSAR CADA DEAL DO HUBSPOT
        const results = {
            total: hubspotRecords.length,
            matched: 0,
            unmatched: 0,
            matches: [] as any[],
            errors: [] as any[],
        };

        for (const hubspotRecord of hubspotRecords) {
            try {
                // Converter para formato MatchCandidate
                const hubspotCandidate: MatchCandidate = {
                    id: hubspotRecord.id,
                    source: hubspotRecord.source,
                    date: hubspotRecord.date,
                    amount: hubspotRecord.amount,
                    customer_email: hubspotRecord.customer_email || hubspotRecord.custom_data?.customer_email,
                    customer_name: hubspotRecord.customer_name ||
                        `${hubspotRecord.custom_data?.customer_firstname || ''} ${hubspotRecord.custom_data?.customer_lastname || ''}`.trim() ||
                        null,
                    description: hubspotRecord.description,
                    custom_data: hubspotRecord.custom_data,
                };

                // Converter payment records
                const paymentCandidates: MatchCandidate[] = paymentRecords.map(p => ({
                    id: p.id,
                    source: p.source,
                    date: p.date,
                    amount: p.amount,
                    customer_email: p.custom_data?.customer_email || null,
                    customer_name: p.custom_data?.customer_name || null,
                    description: p.description,
                    custom_data: p.custom_data,
                }));

                // Tentar fazer match
                const matchResult = findBestMatch(hubspotCandidate, paymentCandidates, {
                    minConfidence: minConfidence,
                });

                if (matchResult.matched && matchResult.matchedId) {
                    results.matched++;
                    results.matches.push({
                        hubspot_id: hubspotRecord.id,
                        hubspot_deal: hubspotRecord.custom_data?.dealname || hubspotRecord.description,
                        payment_id: matchResult.matchedId,
                        payment_source: matchResult.matchedSource,
                        confidence: matchResult.confidence,
                        reasons: matchResult.reasons,
                        details: matchResult.details,
                    });

                    // Salvar match se não for dry run
                    if (!dryRun) {
                        // Atualizar HubSpot record
                        await supabaseAdmin
                            .from('csv_rows')
                            .update({
                                reconciled: true,
                                matched_with: matchResult.matchedId,
                                matched_source: matchResult.matchedSource,
                                match_confidence: matchResult.confidence,
                                match_details: matchResult.details,
                                matched_at: new Date().toISOString(),
                            })
                            .eq('id', hubspotRecord.id);

                        // Atualizar Payment record
                        await supabaseAdmin
                            .from('csv_rows')
                            .update({
                                reconciled: true,
                                matched_with: hubspotRecord.id,
                                matched_source: 'hubspot',
                                match_confidence: matchResult.confidence,
                                match_details: matchResult.details,
                                matched_at: new Date().toISOString(),
                            })
                            .eq('id', matchResult.matchedId);

                        console.log(`✅ Match salvo: ${hubspotRecord.id} ↔ ${matchResult.matchedId} (${matchResult.confidence}%)`);
                    }
                } else {
                    results.unmatched++;
                }
            } catch (error: any) {
                results.errors.push({
                    hubspot_id: hubspotRecord.id,
                    error: error.message,
                });
                console.error(`❌ Erro ao processar deal ${hubspotRecord.id}:`, error);
            }
        }

        console.log(`\n✅ Auto-matching concluído!`);
        console.log(`   Total processado: ${results.total}`);
        console.log(`   Matches encontrados: ${results.matched} (${((results.matched / results.total) * 100).toFixed(1)}%)`);
        console.log(`   Sem match: ${results.unmatched}`);
        console.log(`   Erros: ${results.errors.length}`);

        return NextResponse.json({
            success: true,
            message: dryRun
                ? `Dry run: ${results.matched} matches encontrados (não salvos)`
                : `${results.matched} matches salvos com sucesso`,
            stats: {
                total: results.total,
                matched: results.matched,
                unmatched: results.unmatched,
                errors: results.errors.length,
                matchRate: ((results.matched / results.total) * 100).toFixed(1) + '%',
            },
            matches: results.matches,
            errors: results.errors.length > 0 ? results.errors : undefined,
        });

    } catch (error: any) {
        console.error('❌ Erro no auto-matching:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Erro ao processar auto-matching',
            },
            { status: 500 }
        );
    }
}

/**
 * GET: Retorna estatísticas de matching
 */
export async function GET() {
    try {
        // Contar deals do HubSpot
        const { count: totalHubspot } = await supabaseAdmin
            .from('csv_rows')
            .select('*', { count: 'exact', head: true })
            .eq('source', 'hubspot');

        const { count: matchedHubspot } = await supabaseAdmin
            .from('csv_rows')
            .select('*', { count: 'exact', head: true })
            .eq('source', 'hubspot')
            .eq('reconciled', true);

        // Contar transações de payment channels
        const { count: totalPayments } = await supabaseAdmin
            .from('csv_rows')
            .select('*', { count: 'exact', head: true })
            .in('source', ['braintree-eur', 'braintree-usd', 'gocardless-eur', 'gocardless-gbp', 'stripe-eur']);

        const { count: matchedPayments } = await supabaseAdmin
            .from('csv_rows')
            .select('*', { count: 'exact', head: true })
            .in('source', ['braintree-eur', 'braintree-usd', 'gocardless-eur', 'gocardless-gbp', 'stripe-eur'])
            .eq('reconciled', true);

        return NextResponse.json({
            success: true,
            stats: {
                hubspot: {
                    total: totalHubspot || 0,
                    matched: matchedHubspot || 0,
                    unmatched: (totalHubspot || 0) - (matchedHubspot || 0),
                    matchRate: totalHubspot ? ((matchedHubspot || 0) / totalHubspot * 100).toFixed(1) + '%' : '0%',
                },
                payments: {
                    total: totalPayments || 0,
                    matched: matchedPayments || 0,
                    unmatched: (totalPayments || 0) - (matchedPayments || 0),
                    matchRate: totalPayments ? ((matchedPayments || 0) / totalPayments * 100).toFixed(1) + '%' : '0%',
                },
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
