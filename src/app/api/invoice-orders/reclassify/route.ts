import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const FA_NAMES: Record<string, string> = {
    "103.1": "Level 3 ROW", "103.2": "Level 3 AMEX",
    "103.3": "Level 3 New ROW", "103.4": "Level 3 New AMEX",
    "103.5": "Level 2", "103.6": "Level 1", "103.7": "Not a Subscriber",
    "104.1": "Level 3 ROW", "104.2": "Level 3 AMEX",
    "104.3": "Level 3 New ROW", "104.4": "Level 3 New AMEX",
    "104.5": "Level 2", "104.6": "Level 1", "104.7": "Not a Subscriber",
};

interface ReclassChange {
    rowId: string;
    newCode: string;
}

/**
 * POST /api/invoice-orders/reclassify
 * Batch-updates financial_account_code in custom_data for LAB/PC rows.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const changes: ReclassChange[] = body.changes;

        if (!changes || changes.length === 0) {
            return NextResponse.json({ success: false, error: "No changes provided" }, { status: 400 });
        }

        // Validate all codes are 103.x or 104.x
        for (const c of changes) {
            if (!c.rowId || !c.newCode) {
                return NextResponse.json({ success: false, error: "Each change must have rowId and newCode" }, { status: 400 });
            }
            if (!c.newCode.startsWith("103.") && !c.newCode.startsWith("104.")) {
                return NextResponse.json({ success: false, error: `Invalid code ${c.newCode}: only 103.x/104.x allowed` }, { status: 400 });
            }
        }

        let updated = 0;

        // Fetch current rows to merge custom_data
        const rowIds = changes.map(c => c.rowId);
        const idToNewCode = new Map(changes.map(c => [c.rowId, c.newCode]));

        // Batch fetch in groups of 100
        for (let i = 0; i < rowIds.length; i += 100) {
            const batch = rowIds.slice(i, i + 100);
            const { data: rows, error: fetchErr } = await supabaseAdmin
                .from("csv_rows")
                .select("id, custom_data")
                .in("id", batch);

            if (fetchErr) throw fetchErr;
            if (!rows) continue;

            for (const row of rows) {
                const newCode = idToNewCode.get(row.id);
                if (!newCode) continue;

                const customData = { ...(row.custom_data as Record<string, unknown>) };
                customData.financial_account_code = newCode;
                customData.financial_account_name = FA_NAMES[newCode] || null;

                const { error: updateErr } = await supabaseAdmin
                    .from("csv_rows")
                    .update({ custom_data: customData })
                    .eq("id", row.id);

                if (updateErr) {
                    console.error(`Failed to reclassify row ${row.id}:`, updateErr);
                } else {
                    updated++;
                }
            }
        }

        return NextResponse.json({ success: true, updated });
    } catch (error) {
        console.error("❌ Reclassify error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
