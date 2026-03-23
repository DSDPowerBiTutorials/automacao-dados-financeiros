import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const { data, error } = await supabaseAdmin
            .from("bi_dashboards")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;
        if (!data) {
            return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            dashboard: {
                id: data.id,
                title: data.title,
                authorId: data.author_id,
                authorName: data.author_name,
                isPublic: data.is_public,
                scope: data.scope,
                slots: data.slots ?? [],
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            },
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("GET /api/bi/dashboards/[id] error:", msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const updateFields: Record<string, unknown> = {};
        if (body.title !== undefined) updateFields.title = body.title;
        if (body.isPublic !== undefined) updateFields.is_public = body.isPublic;
        if (body.scope !== undefined) updateFields.scope = body.scope;
        if (body.slots !== undefined) updateFields.slots = body.slots;

        const { error } = await supabaseAdmin
            .from("bi_dashboards")
            .update(updateFields)
            .eq("id", id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("PUT /api/bi/dashboards/[id] error:", msg);
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
            .from("bi_dashboards")
            .delete()
            .eq("id", id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("DELETE /api/bi/dashboards/[id] error:", msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
