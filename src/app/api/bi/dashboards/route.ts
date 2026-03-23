import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const filter = searchParams.get("filter") ?? "all";
        const userId = searchParams.get("userId");

        let query = supabaseAdmin
            .from("bi_dashboards")
            .select("id, title, author_id, author_name, is_public, scope, created_at, updated_at")
            .order("updated_at", { ascending: false })
            .limit(50);

        if (filter === "public") {
            query = query.eq("is_public", true);
        } else if (filter === "mine" && userId) {
            query = query.eq("author_id", userId);
        } else if (filter === "mine") {
            // Return empty if no userId for "mine" filter
            return NextResponse.json({ success: true, dashboards: [] });
        }

        const { data, error } = await query;
        if (error) throw error;

        const dashboards = (data ?? []).map((d: Record<string, unknown>) => ({
            id: d.id,
            title: d.title,
            authorName: d.author_name ?? "",
            isPublic: d.is_public,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
        }));

        return NextResponse.json({ success: true, dashboards });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("GET /api/bi/dashboards error:", msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { title, authorId, authorName, isPublic, scope, slots } = body;

        if (!authorId) {
            return NextResponse.json({ success: false, error: "authorId required" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from("bi_dashboards")
            .insert({
                title: title ?? "Untitled Dashboard",
                author_id: authorId,
                author_name: authorName ?? "",
                is_public: isPublic ?? false,
                scope: scope ?? "GLOBAL",
                slots: slots ?? [],
            })
            .select("id")
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, id: data.id });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("POST /api/bi/dashboards error:", msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
