import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

// GET — list all payroll line mappings
export async function GET() {
    try {
        const { data, error } = await supabase
            .from("payroll_line_mappings")
            .select("*")
            .order("concept_code", { ascending: true });

        if (error) throw error;
        return NextResponse.json({ success: true, data: data || [] });
    } catch (err) {
        console.error("payroll-master-data GET error:", err);
        return NextResponse.json(
            { success: false, error: String(err) },
            { status: 500 }
        );
    }
}

// POST — create a new mapping
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            concept_code,
            concept_description,
            target_category,
            department_override,
            financial_account_code,
            financial_account_name,
            notes,
        } = body;

        if (!concept_code || !target_category) {
            return NextResponse.json(
                { success: false, error: "concept_code and target_category are required" },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from("payroll_line_mappings")
            .insert({
                concept_code,
                concept_description: concept_description || null,
                target_category,
                department_override: department_override || null,
                financial_account_code: financial_account_code || null,
                financial_account_name: financial_account_name || null,
                notes: notes || null,
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, data });
    } catch (err) {
        console.error("payroll-master-data POST error:", err);
        return NextResponse.json(
            { success: false, error: String(err) },
            { status: 500 }
        );
    }
}

// PUT — update a mapping
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
            .from("payroll_line_mappings")
            .update(updates)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, data });
    } catch (err) {
        console.error("payroll-master-data PUT error:", err);
        return NextResponse.json(
            { success: false, error: String(err) },
            { status: 500 }
        );
    }
}

// DELETE — remove a mapping
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
            .from("payroll_line_mappings")
            .delete()
            .eq("id", id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("payroll-master-data DELETE error:", err);
        return NextResponse.json(
            { success: false, error: String(err) },
            { status: 500 }
        );
    }
}
