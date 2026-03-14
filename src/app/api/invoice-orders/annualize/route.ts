import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/invoice-orders/annualize
 * Takes a single invoice order row ID and creates 11 additional monthly installments.
 * The original row becomes month 1/12, and 11 new rows are created for months 2-12.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { rowId } = body;

        if (!rowId) {
            return NextResponse.json({ success: false, error: "rowId is required" }, { status: 400 });
        }

        // Fetch the original row
        const { data: original, error: fetchError } = await supabaseAdmin
            .from("csv_rows")
            .select("*")
            .eq("id", rowId)
            .single();

        if (fetchError || !original) {
            return NextResponse.json({ success: false, error: "Row not found" }, { status: 404 });
        }

        const baseDate = new Date(original.date + "T00:00:00Z");
        const baseMonth = baseDate.getUTCMonth();
        const baseYear = baseDate.getUTCFullYear();
        const baseDay = Math.min(baseDate.getUTCDate(), 28); // Safe day for all months

        // Mark the original as installment 1/12
        const originalCustomData = { ...(original.custom_data || {}) };
        originalCustomData.annualized = true;
        originalCustomData.installment = "1/12";
        originalCustomData.annualized_from = rowId;

        await supabaseAdmin
            .from("csv_rows")
            .update({ custom_data: originalCustomData })
            .eq("id", rowId);

        // Create 11 monthly installments (months 2-12)
        const newRows = [];
        for (let i = 1; i <= 11; i++) {
            const installmentMonth = baseMonth + i;
            const installmentYear = baseYear + Math.floor(installmentMonth / 12);
            const actualMonth = installmentMonth % 12;

            const installmentDate = `${installmentYear}-${String(actualMonth + 1).padStart(2, "0")}-${String(baseDay).padStart(2, "0")}`;

            const customData = { ...(original.custom_data || {}) };
            customData.annualized = true;
            customData.installment = `${i + 1}/12`;
            customData.annualized_from = rowId;

            newRows.push({
                source: original.source,
                file_name: original.file_name,
                date: installmentDate,
                description: original.description,
                amount: original.amount,
                reconciled: false,
                custom_data: customData
            });
        }

        const { error: insertError } = await supabaseAdmin.from("csv_rows").insert(newRows);
        if (insertError) throw insertError;

        return NextResponse.json({
            success: true,
            data: {
                originalId: rowId,
                installmentsCreated: 11,
                dateRange: `${original.date} → ${newRows[newRows.length - 1].date}`
            }
        });
    } catch (error) {
        console.error("❌ Annualize error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
