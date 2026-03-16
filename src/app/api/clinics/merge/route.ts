import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ============================================================
// Clinic Merge API
// POST: merge alias_name → primary_name
//   - Creates clinic_aliases record
//   - Updates csv_rows custom_data->customer_name
// GET: list all aliases
// DELETE: remove an alias (does NOT revert csv_rows)
// GET ?search=term: search distinct customer names in csv_rows
// ============================================================

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");

    try {
        if (search) {
            // Search for clinic names in csv_rows (for the merge UI)
            const term = `%${search}%`;
            const { data, error } = await supabaseAdmin
                .rpc("search_clinic_names", { search_term: term });

            if (error) {
                // Fallback: direct query if RPC doesn't exist
                const { data: rows, error: qErr } = await supabaseAdmin
                    .from("csv_rows")
                    .select("custom_data")
                    .eq("source", "invoice-orders")
                    .ilike("custom_data->>customer_name", term)
                    .limit(100);

                if (qErr) throw qErr;

                const names = new Set<string>();
                for (const r of rows || []) {
                    const name = (r.custom_data as any)?.customer_name;
                    if (name) names.add(String(name).trim());
                }

                return NextResponse.json({
                    success: true,
                    results: [...names].sort().map(n => ({ name: n })),
                });
            }

            return NextResponse.json({ success: true, results: data || [] });
        }

        // List all aliases
        const { data, error } = await supabaseAdmin
            .from("clinic_aliases")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        return NextResponse.json({ success: true, aliases: data || [] });
    } catch (err: any) {
        console.error("Clinic merge GET error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { primary_name, alias_name } = body;

        if (!primary_name || !alias_name) {
            return NextResponse.json(
                { error: "primary_name e alias_name são obrigatórios" },
                { status: 400 }
            );
        }

        if (primary_name === alias_name) {
            return NextResponse.json(
                { error: "primary_name e alias_name não podem ser iguais" },
                { status: 400 }
            );
        }

        // 1. Create alias record
        const { data: alias, error: aliasErr } = await supabaseAdmin
            .from("clinic_aliases")
            .insert({ primary_name, alias_name })
            .select()
            .single();

        if (aliasErr) {
            if (aliasErr.code === "23505") { // unique violation
                return NextResponse.json(
                    { error: `"${alias_name}" já está vinculado a outro clinic` },
                    { status: 409 }
                );
            }
            throw aliasErr;
        }

        // 2. Update csv_rows: change customer_name from alias to primary
        // We update custom_data->customer_name for all matching rows
        const { data: updated, error: updateErr } = await supabaseAdmin
            .rpc("merge_clinic_customer_name", {
                old_name: alias_name,
                new_name: primary_name,
            });

        let rowsUpdated = 0;
        if (updateErr) {
            // Fallback: manual update if RPC doesn't exist
            // Fetch matching rows and update them
            let offset = 0;
            const PAGE = 500;
            while (true) {
                const { data: rows, error: fetchErr } = await supabaseAdmin
                    .from("csv_rows")
                    .select("id, custom_data")
                    .eq("source", "invoice-orders")
                    .eq("custom_data->>customer_name", alias_name)
                    .range(offset, offset + PAGE - 1);

                if (fetchErr) throw fetchErr;
                if (!rows || rows.length === 0) break;

                for (const row of rows) {
                    const cd = { ...(row.custom_data as any), customer_name: primary_name };
                    await supabaseAdmin
                        .from("csv_rows")
                        .update({ custom_data: cd })
                        .eq("id", row.id);
                    rowsUpdated++;
                }

                if (rows.length < PAGE) break;
                offset += PAGE;
            }
        } else {
            rowsUpdated = typeof updated === "number" ? updated : 0;
        }

        return NextResponse.json({
            success: true,
            alias,
            rows_updated: rowsUpdated,
        });
    } catch (err: any) {
        console.error("Clinic merge POST error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    }

    try {
        const { error } = await supabaseAdmin
            .from("clinic_aliases")
            .delete()
            .eq("id", parseInt(id));

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Clinic merge DELETE error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
