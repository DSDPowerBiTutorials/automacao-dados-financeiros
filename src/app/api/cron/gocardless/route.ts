import { NextRequest, NextResponse } from "next/server";
import { syncGoCardlessTransactions } from "@/lib/gocardless";

/**
 * Cron endpoint for syncing GoCardless transactions daily
 * Can be called by Vercel Cron, external services, or manually
 * Verify with CRON_SECRET to prevent unauthorized calls
 */
export async function GET(request: NextRequest) {
    try {
        // Verify cron secret if set
        const cronSecret = request.headers.get("x-cron-secret");
        const expectedSecret = process.env.CRON_SECRET;

        if (expectedSecret && cronSecret !== expectedSecret) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        console.log("[GoCardless Cron] Starting sync...");

        const result = await syncGoCardlessTransactions();

        if (result.success) {
            console.log(
                `[GoCardless Cron] Sync completed: ${result.payoutsCount} payouts, ${result.paymentsCount} payments`
            );
            return NextResponse.json({
                success: true,
                message: "GoCardless sync completed",
                payoutsCount: result.payoutsCount,
                paymentsCount: result.paymentsCount,
                timestamp: new Date().toISOString(),
            });
        } else {
            console.error("[GoCardless Cron] Sync failed:", result.error);
            return NextResponse.json(
                {
                    success: false,
                    error: result.error,
                },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error("[GoCardless Cron] Unexpected error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

export const runtime = "nodejs";
