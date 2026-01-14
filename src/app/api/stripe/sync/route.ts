/**
 * API Route: Stripe Sync
 * POST /api/stripe/sync - Sincroniza transações do Stripe
 * GET /api/stripe/sync - Testa conexão
 */

import { NextResponse } from "next/server";
import { syncStripeTransactions, testStripeConnection } from "@/lib/stripe";

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const currency = (body.currency as "EUR" | "USD") || "EUR";
        const sinceDate = body.sinceDate ? new Date(body.sinceDate) : new Date("2024-01-01");

        console.log(`[Stripe API] Iniciando sync - Currency: ${currency}, Since: ${sinceDate.toISOString()}`);

        const result = await syncStripeTransactions({
            currency,
            sinceDate,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            summary: {
                charges_synced: result.chargesCount,
                payouts_found: result.payoutsCount,
                currency: currency.toUpperCase(),
            },
        });
    } catch (error) {
        console.error("[Stripe API] ❌ Erro:", error);
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
    try {
        const result = await testStripeConnection();

        return NextResponse.json({
            success: result.success,
            message: result.message,
            account: result.accountName,
            endpoint: "/api/stripe/sync",
            methods: {
                POST: {
                    description: "Sincroniza transações do Stripe com Supabase",
                    parameters: {
                        currency: {
                            type: "string",
                            enum: ["EUR", "USD"],
                            default: "EUR",
                        },
                        sinceDate: {
                            type: "string",
                            format: "date",
                            default: "2024-01-01",
                        },
                    },
                },
            },
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Erro desconhecido",
            },
            { status: 500 }
        );
    }
}
