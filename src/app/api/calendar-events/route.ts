import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

// GET — list all calendar events
export async function GET() {
    try {
        const { data, error } = await supabase
            .from("calendar_events")
            .select("*")
            .order("date", { ascending: true });

        if (error) throw error;
        return NextResponse.json({ success: true, data: data || [] });
    } catch (err) {
        console.error("calendar-events GET error:", err);
        return NextResponse.json(
            { success: false, error: String(err) },
            { status: 500 }
        );
    }
}

// POST — create a new calendar event
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { date, title, type, description } = body;

        if (!date || !title || !type) {
            return NextResponse.json(
                { success: false, error: "date, title, and type are required" },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from("calendar_events")
            .insert({ date, title, type, description: description || null })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, data });
    } catch (err) {
        console.error("calendar-events POST error:", err);
        return NextResponse.json(
            { success: false, error: String(err) },
            { status: 500 }
        );
    }
}

// DELETE — remove a calendar event by id
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json(
                { success: false, error: "id is required" },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from("calendar_events")
            .delete()
            .eq("id", id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("calendar-events DELETE error:", err);
        return NextResponse.json(
            { success: false, error: String(err) },
            { status: 500 }
        );
    }
}
