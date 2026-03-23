import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { authorId, authorName } = body;

        if (!authorId) {
            return NextResponse.json({ success: false, error: "authorId required" }, { status: 400 });
        }

        // Fetch original
        const { data: original, error: fetchErr } = await supabaseAdmin
            .from("bi_dashboards")
            .select("*")
            .eq("id", id)
            .single();

        if (fetchErr) throw fetchErr;
        if (!original) {
            return NextResponse.json({ success: false, error: "Dashboard not found" }, { status: 404 });
        }

        // Create clone
        const { data: clone, error: insertErr } = await supabaseAdmin
            .from("bi_dashboards")
            .insert({
                title: `${original.title} (Copy)`,
                author_id: authorId,
                author_name: authorName ?? "",
                is_public: false,
                scope: original.scope,
                slots: original.slots,
            })
            .select("id")
            .single();

        if (insertErr) throw insertErr;

        return NextResponse.json({ success: true, id: clone.id });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("POST /api/bi/dashboards/[id]/clone error:", msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
