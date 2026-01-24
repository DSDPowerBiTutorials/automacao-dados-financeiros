import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Fetch history for an invoice
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const invoiceId = searchParams.get("invoice_id");

        if (!invoiceId) {
            return NextResponse.json({ error: "invoice_id required" }, { status: 400 });
        }

        const { data: history, error } = await supabaseAdmin
            .from("invoice_history")
            .select("*")
            .eq("invoice_id", parseInt(invoiceId))
            .order("changed_at", { ascending: true });

        if (error) throw error;

        return NextResponse.json({ success: true, history });
    } catch (error: any) {
        console.error("Get history error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Manually add history entry (for special cases)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { invoice_id, change_type, field_name, old_value, new_value, changed_by, metadata } = body;

        if (!invoice_id || !change_type) {
            return NextResponse.json({ error: "invoice_id and change_type required" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from("invoice_history")
            .insert({
                invoice_id,
                change_type,
                field_name,
                old_value,
                new_value,
                changed_by: changed_by || "user",
                metadata: metadata || {}
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, entry: data });
    } catch (error: any) {
        console.error("Add history error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
