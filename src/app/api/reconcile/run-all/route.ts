/**
 * API Endpoint: Reconciliação Completa Multi-Banco
 * 
 * POST /api/reconcile/run-all
 * 
 * Orquestra reconciliação automática para todos os bancos:
 * - Bankinter EUR ↔ Braintree EUR + Stripe EUR + GoCardless
 * - Bankinter USD ↔ Braintree USD
 * - Sabadell EUR ↔ Braintree EUR + Stripe EUR + GoCardless
 * - Chase USD ↔ Stripe USD payouts
 * 
 * Body: { dryRun?: boolean, banks?: string[] }
 */

import { NextRequest, NextResponse } from "next/server";

const ALL_BANKS = ["bankinter-eur", "bankinter-usd", "sabadell", "chase-usd"];

interface BankResult {
    bankSource: string;
    success: boolean;
    matched: number;
    unmatched: number;
    total: number;
    bySource?: Record<string, number>;
    totalValue?: number;
    error?: string;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const dryRun = body.dryRun !== false;
        const banks: string[] = body.banks || ALL_BANKS;

        const results: BankResult[] = [];
        const startTime = Date.now();

        // Executar reconciliação sequencialmente por banco
        // (para evitar sobrecarregar a base de dados com queries simultâneos)
        for (const bankSource of banks) {
            try {
                // Chamar a API bank-disbursement internamente
                const baseUrl = req.nextUrl.origin;
                const response = await fetch(`${baseUrl}/api/reconcile/bank-disbursement`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bankSource, dryRun }),
                });

                const data = await response.json();

                if (data.success) {
                    results.push({
                        bankSource,
                        success: true,
                        matched: data.matched || 0,
                        unmatched: data.unmatched || 0,
                        total: data.total || 0,
                        bySource: data.summary?.bySource || {},
                        totalValue: data.summary?.totalValue || 0,
                    });
                } else {
                    results.push({
                        bankSource,
                        success: false,
                        matched: 0,
                        unmatched: 0,
                        total: 0,
                        error: data.error || "Unknown error",
                    });
                }
            } catch (err: any) {
                results.push({
                    bankSource,
                    success: false,
                    matched: 0,
                    unmatched: 0,
                    total: 0,
                    error: err.message,
                });
            }
        }

        // Agora executar reconciliações especializadas (Stripe e GoCardless)
        const specialResults: Record<string, any> = {};

        // Stripe ↔ Bankinter (reconciliação dedicada se disponível)
        try {
            const stripeRes = await fetch(`${req.nextUrl.origin}/api/reconcile/stripe-bankinter`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dryRun }),
            });
            specialResults.stripeBankinter = await stripeRes.json();
        } catch {
            specialResults.stripeBankinter = { success: false, error: "Failed to call" };
        }

        // GoCardless ↔ Bankinter
        try {
            const gcRes = await fetch(`${req.nextUrl.origin}/api/reconcile/gocardless-bankinter`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dryRun }),
            });
            specialResults.gocardlessBankinter = await gcRes.json();
        } catch {
            specialResults.gocardlessBankinter = { success: false, error: "Failed to call" };
        }

        const totalMatched = results.reduce((sum, r) => sum + r.matched, 0);
        const totalUnmatched = results.reduce((sum, r) => sum + r.unmatched, 0);
        const totalValue = results.reduce((sum, r) => sum + (r.totalValue || 0), 0);

        return NextResponse.json({
            success: true,
            dryRun,
            duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
            summary: {
                totalMatched,
                totalUnmatched,
                totalValue: Math.round(totalValue * 100) / 100,
                banksProcessed: results.filter(r => r.success).length,
                banksTotal: banks.length,
            },
            banks: results,
            specialReconciliations: specialResults,
        });

    } catch (error: any) {
        console.error("[Run-All Reconcile API] Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}
