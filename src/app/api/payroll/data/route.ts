import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// GET /api/payroll/data?year=2026
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);

        const { data, error } = await supabaseAdmin
            .from("payroll_uploads")
            .select("*")
            .eq("year", year)
            .order("month", { ascending: true });

        if (error) {
            console.error("Payroll fetch error:", error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 },
            );
        }

        // Convert to a map: { "2026-01": PayrollData, ... }
        const monthlyData: Record<string, unknown> = {};
        let latestData = null;
        let latestFileName = null;

        for (const row of data || []) {
            const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
            monthlyData[key] = row.data;
            // Track the most recent upload as "current"
            if (!latestData || row.month > (latestData as { month?: number })?.month) {
                latestData = row.data;
                latestFileName = row.file_name;
            }
        }

        return NextResponse.json({
            success: true,
            monthlyData,
            currentData: latestData,
            currentFileName: latestFileName,
            count: (data || []).length,
        });
    } catch (error: unknown) {
        console.error("Payroll data error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to load payroll data",
            },
            { status: 500 },
        );
    }
}

// DELETE /api/payroll/data?year=2026&month=1
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get("year") || "0", 10);
        const month = parseInt(searchParams.get("month") || "0", 10);

        if (!year || !month) {
            return NextResponse.json(
                { success: false, error: "year and month required" },
                { status: 400 },
            );
        }

        const { error } = await supabaseAdmin
            .from("payroll_uploads")
            .delete()
            .eq("year", year)
            .eq("month", month);

        if (error) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 },
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete",
            },
            { status: 500 },
        );
    }
}
