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
            .from("bi_dashboard_comments")
            .select("*")
            .eq("dashboard_id", id)
            .order("created_at", { ascending: true });

        if (error) throw error;

        // Build tree (parent comments with replies)
        const comments = (data ?? []).map((c: Record<string, unknown>) => ({
            id: c.id,
            dashboardId: c.dashboard_id,
            userId: c.user_id,
            userName: c.user_name ?? "",
            content: c.content,
            parentId: c.parent_id ?? null,
            createdAt: c.created_at,
            editedAt: c.edited_at ?? null,
        }));

        const rootComments = comments.filter((c: { parentId: string | null }) => !c.parentId);
        const repliesMap = new Map<string, typeof comments>();
        for (const c of comments) {
            if (c.parentId) {
                const existing = repliesMap.get(c.parentId) ?? [];
                existing.push(c);
                repliesMap.set(c.parentId, existing);
            }
        }
        for (const root of rootComments) {
            (root as Record<string, unknown>).replies = repliesMap.get(root.id as string) ?? [];
        }

        return NextResponse.json({ success: true, comments: rootComments });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("GET /api/bi/dashboards/[id]/comments error:", msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { userId, userName, content, parentId } = body;

        if (!userId || !content?.trim()) {
            return NextResponse.json({ success: false, error: "userId and content required" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from("bi_dashboard_comments")
            .insert({
                dashboard_id: id,
                user_id: userId,
                user_name: userName ?? "",
                content: content.trim(),
                parent_id: parentId ?? null,
            })
            .select("id")
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, id: data.id });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("POST /api/bi/dashboards/[id]/comments error:", msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
