import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// FA name lookup
const FA_NAMES: Record<string, string> = {
    "101.1": "DSD Course", "101.2": "Others Courses", "101.3": "Mastership",
    "101.4": "PC Membership", "101.5": "Partnerships",
    "102.0": "Delight", "102.1": "Contracted ROW", "102.2": "Contracted AMEX",
    "102.3": "Level 3 New ROW", "102.4": "Level 3 New AMEX",
    "102.5": "Consultancies", "102.6": "Marketing Coaching",
    "103.0": "Planning Center", "103.1": "Level 3 ROW", "103.2": "Level 3 AMEX",
    "103.3": "Level 3 New ROW", "103.4": "Level 3 New AMEX",
    "103.5": "Level 2", "103.6": "Level 1",
    "104.0": "LAB", "104.1": "Level 3 ROW", "104.2": "Level 3 AMEX",
    "104.3": "Level 3 New ROW", "104.4": "Level 3 New AMEX",
    "104.5": "Level 2", "104.6": "Level 1",
    "105.1": "Level 1", "105.2": "CORE Partnerships",
    "105.3": "Study Club", "105.4": "Other Marketing Revenues",
};

interface ClassifyRow {
    // For new rows (from upload)
    source?: string;
    file_name?: string;
    date: string;
    description: string;
    amount: number;
    customData: Record<string, unknown>;
    // For existing rows (overwrite)
    existingId?: string;
    // Classification
    financialAccountCode: string;
}

/**
 * POST /api/invoice-orders/classify
 * Saves classified invoice orders to the database.
 * Handles both new inserts and duplicate overwrites.
 * Also saves product→FA mappings to product_pnl_mappings for future uploads.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const rows: ClassifyRow[] = body.rows;

        if (!rows || rows.length === 0) {
            return NextResponse.json({ success: false, error: "No rows provided" }, { status: 400 });
        }

        // Separate new inserts vs overwrites
        const newInserts: Array<Record<string, unknown>> = [];
        const overwrites: Array<{ id: string; data: Record<string, unknown> }> = [];

        for (const row of rows) {
            const faCode = row.financialAccountCode;
            const faName = FA_NAMES[faCode] || null;

            const customData = { ...row.customData };
            customData.financial_account_code = faCode;
            customData.financial_account_name = faName;

            if (row.existingId) {
                overwrites.push({
                    id: row.existingId,
                    data: {
                        date: row.date,
                        description: row.description,
                        amount: row.amount,
                        custom_data: customData
                    }
                });
            } else {
                newInserts.push({
                    source: "invoice-orders",
                    file_name: row.file_name || row.customData?.file_name || "upload",
                    date: row.date,
                    description: row.description,
                    amount: row.amount,
                    reconciled: false,
                    custom_data: customData
                });
            }
        }

        let insertedCount = 0;
        let overwrittenCount = 0;

        // Insert new rows in batches of 500
        for (let i = 0; i < newInserts.length; i += 500) {
            const batch = newInserts.slice(i, i + 500);
            const { error } = await supabaseAdmin.from("csv_rows").insert(batch);
            if (error) throw error;
            insertedCount += batch.length;
        }

        // Overwrite duplicate rows
        for (const ow of overwrites) {
            const { error } = await supabaseAdmin
                .from("csv_rows")
                .update(ow.data)
                .eq("id", ow.id);
            if (error) {
                console.error(`Failed to overwrite row ${ow.id}:`, error);
            } else {
                overwrittenCount++;
            }
        }

        // Save product→FA mappings for future auto-fill
        const productMappings = new Map<string, string>();
        for (const row of rows) {
            const productName = row.description?.trim();
            if (productName && row.financialAccountCode) {
                productMappings.set(productName.toLowerCase(), row.financialAccountCode);
            }
        }

        for (const [productName, faCode] of productMappings) {
            await supabaseAdmin
                .from("product_pnl_mappings")
                .upsert(
                    { product_name: productName, financial_account_code: faCode, updated_at: new Date().toISOString() },
                    { onConflict: "product_name" }
                );
        }

        return NextResponse.json({
            success: true,
            data: {
                inserted: insertedCount,
                overwritten: overwrittenCount,
                mappingsSaved: productMappings.size
            }
        });
    } catch (error) {
        console.error("❌ Classify error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
