/**
 * Cron Job: Sincronização Diária do Braintree
 * 
 * Roda automaticamente todos os dias às 3h AM (UTC)
 * Sincroniza os últimos 7 dias como backup do webhook
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        // Verificar autorização (Vercel Cron ou header secreto)
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        // Vercel Cron envia header específico
        const isVercelCron = req.headers.get("x-vercel-cron") !== null;

        if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        console.log("[Braintree Cron] 🕐 Iniciando sincronização automática...");

        // Sincronizar últimos 7 dias (backup do webhook)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const syncUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/braintree/sync`;

        const response = await fetch(syncUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                startDate: startDate.toISOString().split("T")[0],
                endDate: endDate.toISOString().split("T")[0],
                currency: "EUR",
            }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            console.error("[Braintree Cron] ❌ Erro:", result.error);
            return NextResponse.json(
                {
                    success: false,
                    error: result.error || "Sync failed"
                },
                { status: 500 }
            );
        }

        console.log("[Braintree Cron] ✅ Sincronização concluída:", result.data);

        return NextResponse.json({
            success: true,
            message: "Sincronização automática concluída",
            data: {
                period: result.data.period,
                transactions_processed: result.data.transactions_processed,
                revenue_inserted: result.data.revenue_rows_inserted,
                fees_inserted: result.data.fee_rows_inserted,
                timestamp: new Date().toISOString(),
            },
        });

    } catch (error: any) {
        console.error("[Braintree Cron] 💥 Erro fatal:", error);

        return NextResponse.json(
            {
                success: false,
                error: error.message || "Internal server error",
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}
