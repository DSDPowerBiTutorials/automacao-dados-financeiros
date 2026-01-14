/**
 * API Route: HubSpot Reconciliation
 * POST /api/hubspot/reconcile
 * 
 * Reconcilia deals do HubSpot com transações de pagamento
 * (Braintree, Stripe, GoCardless)
 */

import { NextResponse } from "next/server";
import {
    reconcileHubSpotDeals,
    applyReconciliationMatches,
    generateUnmatchedReport,
} from "@/lib/hubspot-reconciliation";

export async function POST(request: Request) {
    try {
        // Parâmetros opcionais
        const body = await request.json().catch(() => ({}));
        const dryRun = body.dryRun !== false; // Default: true (não altera dados)
        const applyMatches = body.apply === true;

        console.log("🔄 Iniciando reconciliação HubSpot...");
        console.log(`  Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

        // Executar reconciliação
        const result = await reconcileHubSpotDeals();

        // Aplicar matches se solicitado
        let applyResult = { success: 0, errors: 0 };
        if (applyMatches && result.matches.length > 0) {
            applyResult = await applyReconciliationMatches(result.matches, dryRun);
        }

        // Gerar relatório de não reconciliados
        const unmatchedReport = generateUnmatchedReport(result.unmatched);

        return NextResponse.json({
            success: true,
            mode: dryRun ? "dry_run" : "live",
            summary: {
                total_deals: result.total_hubspot_deals,
                with_order_id: result.deals_with_order_id,
                without_order_id: result.deals_without_order_id,
                matched_by_order_id: result.matches_by_order_id,
                matched_by_email: result.matches_by_email,
                matched_by_name: result.matches_by_name,
                total_matched: result.matches.length,
                unmatched: result.unmatched_deals,
                match_rate: ((result.matches.length / result.total_hubspot_deals) * 100).toFixed(1) + "%",
            },
            matches: result.matches.slice(0, 50), // Limitar para resposta
            unmatched_categories: {
                total: result.unmatched.length,
                sample: result.unmatched.slice(0, 10).map(d => ({
                    description: d.description,
                    amount: d.amount,
                    email: d.customer_email,
                    date: d.date,
                })),
            },
            applied: applyMatches ? applyResult : null,
            report: unmatchedReport,
        });
    } catch (error) {
        console.error("❌ Erro na reconciliação:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Erro desconhecido",
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        endpoint: "/api/hubspot/reconcile",
        method: "POST",
        description: "Reconcilia deals do HubSpot com transações de pagamento",
        parameters: {
            dryRun: {
                type: "boolean",
                default: true,
                description: "Se true, apenas simula sem alterar dados",
            },
            apply: {
                type: "boolean",
                default: false,
                description: "Se true, aplica os matches no banco",
            },
        },
        payment_sources: [
            "braintree-api-revenue",
            "braintree-eur",
            "braintree-usd",
            "stripe-eur",
            "stripe-usd",
            "gocardless",
            "gocardless-eur",
        ],
        matching_strategies: [
            {
                type: "order_id",
                confidence: "high",
                description: "Match exato por Order ID (7 chars hex)",
            },
            {
                type: "email_amount_date",
                confidence: "medium",
                description: "Match por email + valor + data (±3 dias)",
            },
        ],
    });
}
