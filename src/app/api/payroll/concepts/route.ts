import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

// GET — extract all unique concepts from payroll_uploads JSONB
export async function GET() {
    try {
        const { data: uploads, error } = await supabase
            .from("payroll_uploads")
            .select("year, month, data")
            .order("year", { ascending: true })
            .order("month", { ascending: true });

        if (error) throw error;

        // Extract unique concepts across all months/employees
        const conceptMap = new Map<string, {
            code: number;
            description: string;
            isDeduction: boolean;
            // Track which months this concept appears in
            monthsPresent: string[];
            // Sum total across all employees/months
            totalAmount: number;
            employeeCount: number;
        }>();

        for (const upload of uploads || []) {
            const monthLabel = `${String(upload.month).padStart(2, "0")}/${upload.year}`;
            const employees = upload.data?.employees || [];
            for (const emp of employees) {
                for (const c of emp.concepts || []) {
                    const key = `${c.code}-${c.isDeduction ? "D" : "E"}`;
                    let entry = conceptMap.get(key);
                    if (!entry) {
                        entry = {
                            code: c.code,
                            description: c.description,
                            isDeduction: c.isDeduction,
                            monthsPresent: [],
                            totalAmount: 0,
                            employeeCount: 0,
                        };
                        conceptMap.set(key, entry);
                    }
                    if (!entry.monthsPresent.includes(monthLabel)) {
                        entry.monthsPresent.push(monthLabel);
                    }
                    entry.totalAmount += c.amount || 0;
                    entry.employeeCount += 1;
                }
            }
        }

        const concepts = Array.from(conceptMap.values()).sort((a, b) => {
            if (a.isDeduction !== b.isDeduction) return a.isDeduction ? 1 : -1;
            return a.code - b.code;
        });

        return NextResponse.json({ success: true, data: concepts, count: concepts.length });
    } catch (err) {
        console.error("payroll-concepts GET error:", err);
        return NextResponse.json(
            { success: false, error: String(err) },
            { status: 500 }
        );
    }
}

// POST — bulk sync: upsert concepts into payroll_line_mappings
export async function POST(req: NextRequest) {
    try {
        const { concepts } = await req.json();

        if (!concepts || !Array.isArray(concepts) || concepts.length === 0) {
            return NextResponse.json(
                { success: false, error: "concepts array is required" },
                { status: 400 }
            );
        }

        // Get existing mappings to avoid overwriting user-set categories
        const { data: existing } = await supabase
            .from("payroll_line_mappings")
            .select("concept_code");

        const existingCodes = new Set((existing || []).map((e) => e.concept_code));

        // Only insert concepts that don't already have a mapping
        const toInsert = concepts
            .filter((c: { code: number }) => !existingCodes.has(String(c.code).padStart(3, "0")))
            .map((c: { code: number; description: string; isDeduction: boolean }) => ({
                concept_code: String(c.code).padStart(3, "0"),
                concept_description: c.description,
                target_category: "labour", // default — user will change
                is_active: true,
            }));

        if (toInsert.length === 0) {
            return NextResponse.json({ success: true, inserted: 0, message: "All concepts already mapped" });
        }

        const { error } = await supabase
            .from("payroll_line_mappings")
            .insert(toInsert);

        if (error) throw error;

        return NextResponse.json({ success: true, inserted: toInsert.length });
    } catch (err) {
        console.error("payroll-concepts POST error:", err);
        return NextResponse.json(
            { success: false, error: String(err) },
            { status: 500 }
        );
    }
}
