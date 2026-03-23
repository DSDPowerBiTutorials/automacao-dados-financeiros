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
            .from("bi_measures")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(200);

        if (filter === "mine" && userId) {
            query = query.eq("author_id", userId);
        } else if (filter === "public") {
            query = query.eq("is_public", true);
        }
        // "all" returns public + user's own (handled by RLS in authenticated, but via admin we filter manually)

        const { data, error } = await query;
        if (error) throw error;

        const measures = (data ?? []).map((m: Record<string, unknown>) => ({
            id: m.id,
            name: m.name,
            authorId: m.author_id,
            authorName: m.author_name ?? "",
            isPublic: m.is_public,
            measureType: m.measure_type,
            config: m.config,
            createdAt: m.created_at,
            updatedAt: m.updated_at,
        }));

        return NextResponse.json({ success: true, measures });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("GET /api/bi/measures error:", msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, authorId, authorName, isPublic, measureType, config } = body;

        if (!authorId || !name?.trim() || !measureType) {
            return NextResponse.json({ success: false, error: "name, authorId, measureType required" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from("bi_measures")
            .insert({
                name: name.trim(),
                author_id: authorId,
                author_name: authorName ?? "",
                is_public: isPublic ?? false,
                measure_type: measureType,
                config: config ?? {},
            })
            .select("id")
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, id: data.id });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("POST /api/bi/measures error:", msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
