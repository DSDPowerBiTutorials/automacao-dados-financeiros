import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const updateFields: Record<string, unknown> = {};
        if (body.name !== undefined) updateFields.name = body.name;
        if (body.isPublic !== undefined) updateFields.is_public = body.isPublic;
        if (body.measureType !== undefined) updateFields.measure_type = body.measureType;
        if (body.config !== undefined) updateFields.config = body.config;

        const { error } = await supabaseAdmin
            .from("bi_measures")
            .update(updateFields)
            .eq("id", id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("PUT /api/bi/measures/[id] error:", msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const { error } = await supabaseAdmin
            .from("bi_measures")
            .delete()
            .eq("id", id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("DELETE /api/bi/measures/[id] error:", msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
