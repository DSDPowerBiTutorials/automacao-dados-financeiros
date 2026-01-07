import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/schema - retorna o schema da tabela csv_rows via função RPC no Supabase.
 */
export async function GET() {
  try {
    if (!supabaseAdmin) {
      console.error("❌ Supabase admin client is not configured");
      return NextResponse.json(
        { error: "Supabase admin client is not configured" },
        { status: 500 },
      );
    }

    const { data, error } = await supabaseAdmin.rpc("get_table_schema", {
      table_name_input: "csv_rows",
    });

    if (error) {
      console.error("❌ Error fetching table schema:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ schema: data ?? [] });
  } catch (error) {
    console.error("❌ Unexpected error fetching table schema:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching table schema" },
      { status: 500 },
    );
  }
}
