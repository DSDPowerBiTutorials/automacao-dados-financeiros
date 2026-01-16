/**
 * API Route: Sincronização de todas as contas Stripe
 * 
 * GET - Retorna status das contas e URLs de webhook
 * POST - Sincroniza charges e payouts de todas as contas
 * 
 * Query params:
 * - since: Data inicial (formato: YYYY-MM-DD), default: 2025-01-01
 */

import { NextRequest, NextResponse } from "next/server";
import {
    getStripeAccounts,
    testAllStripeConnections,
    syncAllStripeAccounts,
} from "@/lib/stripe-multi-account";

export async function GET() {
    try {
        const { accounts } = await testAllStripeConnections();

        const webhookUrls = [
            {
                account: "DSD OnDemand",
                url: "https://www.dsdfinancehub.com/api/stripe/webhook",
            },
            {
                account: "Digitalsmiledesign",
                url: "https://www.dsdfinancehub.com/api/stripe/webhook/account-2",
            },
            {
                account: "Dsdplanningcenter",
                url: "https://www.dsdfinancehub.com/api/stripe/webhook/account-3",
            },
        ];

        return NextResponse.json({
            success: true,
            accounts,
            webhookUrls,
            instructions: {
                sync: "POST /api/stripe/sync-all?since=2025-01-01",
                events: [
                    "charge.succeeded",
                    "charge.refunded",
                    "payout.paid",
                    "checkout.session.completed",
                ],
            },
        });
    } catch (error) {
        console.error("[Stripe Sync All] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        // Pegar data inicial do body JSON ou query params
        const { searchParams } = new URL(request.url);
        const sinceParam = searchParams.get("since");

        let bodyDate: string | null = null;
        try {
            const body = await request.json();
            bodyDate = body?.sinceDate || body?.since || null;
        } catch {
            // Sem body JSON
        }

        // Prioridade: body > query params > default
        const dateStr = bodyDate || sinceParam || "2025-01-01";
        const sinceDate = new Date(dateStr);

        console.log(`[Stripe Sync All] 🔄 Starting sync since ${sinceDate.toISOString()}`);

        const result = await syncAllStripeAccounts(sinceDate);

        console.log(`[Stripe Sync All] ✅ Sync complete:`, {
            totalCharges: result.totalCharges,
            totalPayouts: result.totalPayouts,
        });

        return NextResponse.json({
            success: result.success,
            sincDate: sinceDate.toISOString(),
            ...result,
        });
    } catch (error) {
        console.error("[Stripe Sync All] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
