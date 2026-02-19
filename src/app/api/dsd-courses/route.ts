import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

// GET — list all DSD courses
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const year = searchParams.get("year");

        let query = supabase
            .from("dsd_courses")
            .select("*")
            .order("start_date", { ascending: true });

        if (year) {
            query = query
                .gte("start_date", `${year}-01-01`)
                .lte("start_date", `${year}-12-31`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ success: true, data: data || [] });
    } catch (err) {
        console.error("dsd-courses GET error:", err);
        return NextResponse.json(
            { success: false, error: String(err) },
            { status: 500 }
        );
    }
}

// POST — create a new DSD course
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, start_date, end_date, location, description, course_type, price_eur, capacity } = body;

        if (!name || !start_date) {
            return NextResponse.json(
                { success: false, error: "name and start_date are required" },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from("dsd_courses")
            .insert({
                name,
                start_date,
                end_date: end_date || null,
                location: location || null,
                description: description || null,
                course_type: course_type || "course",
                price_eur: price_eur || null,
                capacity: capacity || null,
                is_active: true,
            })
            .select()
            .single();

        if (error) throw error;

        // Also create a calendar event for this course
        await supabase.from("calendar_events").insert({
            date: start_date,
            title: name,
            type: "dsd-course",
            description: `${location ? location + " — " : ""}${description || ""}`.trim() || null,
            course_id: data.id,
        });

        return NextResponse.json({ success: true, data });
    } catch (err) {
        console.error("dsd-courses POST error:", err);
        return NextResponse.json(
            { success: false, error: String(err) },
            { status: 500 }
        );
    }
}

// PUT — update a DSD course
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json(
                { success: false, error: "id is required" },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from("dsd_courses")
            .update(updates)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, data });
    } catch (err) {
        console.error("dsd-courses PUT error:", err);
        return NextResponse.json(
            { success: false, error: String(err) },
            { status: 500 }
        );
    }
}

// DELETE — remove a DSD course
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

        // Remove associated calendar event
        await supabase.from("calendar_events").delete().eq("course_id", id);

        const { error } = await supabase.from("dsd_courses").delete().eq("id", id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("dsd-courses DELETE error:", err);
        return NextResponse.json(
            { success: false, error: String(err) },
            { status: 500 }
        );
    }
}
