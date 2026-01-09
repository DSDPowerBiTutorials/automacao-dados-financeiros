/**
 * API Route: Deletar todos os dados do Braintree
 * 
 * DELETE /api/braintree/delete-all
 * Body: { currency: "EUR" }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json();
        const { currency = "EUR" } = body;

        console.log(`[Braintree Delete] Deletando todas as transações ${currency}...`);

        // Deletar todas as receitas
        const { error: revenueError, count: revenueCount } = await supabaseAdmin
            .from("csv_rows")
            .delete()
            .eq("source", "braintree-api-revenue")
            .like("custom_data->>currency", currency);

        if (revenueError) {
            console.error("[Braintree Delete] Erro ao deletar receitas:", revenueError);
            return NextResponse.json(
                { error: `Erro ao deletar receitas: ${revenueError.message}` },
                { status: 500 }
            );
        }

        // Deletar todas as fees
        const { error: feeError, count: feeCount } = await supabaseAdmin
            .from("csv_rows")
            .delete()
            .eq("source", "braintree-api-fees")
            .like("custom_data->>currency", currency);

        if (feeError) {
            console.error("[Braintree Delete] Erro ao deletar fees:", feeError);
            return NextResponse.json(
                { error: `Erro ao deletar fees: ${feeError.message}` },
                { status: 500 }
            );
        }

        console.log(`[Braintree Delete] ✅ Deletado: ${revenueCount} receitas + ${feeCount} fees`);

        return NextResponse.json({
            success: true,
            message: `Deletado: ${revenueCount} receitas + ${feeCount} fees (${currency})`,
            data: {
                revenue_deleted: revenueCount,
                fees_deleted: feeCount,
            },
        });
    } catch (error: any) {
        console.error("[Braintree Delete] Erro:", error);
        return NextResponse.json(
            { error: error.message || "Erro ao deletar dados" },
            { status: 500 }
        );
    }
}
