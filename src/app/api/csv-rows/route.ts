import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Função para criar cliente admin com validação robusta
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase credentials:");
    console.error(
      "URL:",
      supabaseUrl ? "✅" : "❌ NEXT_PUBLIC_SUPABASE_URL not found",
    );
    console.error(
      "Service Key:",
      supabaseServiceKey ? "✅" : "❌ SUPABASE_SERVICE_ROLE_KEY not found",
    );
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// GET - Buscar rows com paginação e filtros
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Supabase admin not configured",
        },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") || "hubspot";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search");

    // Construir query base
    let query = supabaseAdmin
      .from("csv_rows")
      .select("*", { count: "exact" })
      .eq("source", source)
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);

    // Adicionar busca se fornecida
    if (search) {
      query = query.or(
        `description.ilike.%${search}%,custom_data->deal_id.eq.${search}`,
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("❌ Error fetching rows:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: count || 0,
      limit,
      offset,
      hasMore: (offset + limit) < (count || 0),
    });
  } catch (error: any) {
    console.error("❌ API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// POST - Inserir rows
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Supabase admin not configured",
          details:
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Please restart the development server.",
        },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { rows, source } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid rows data" },
        { status: 400 },
      );
    }

    console.log(`📥 Inserting ${rows.length} rows for source: ${source}`);

    // Inserir todas as linhas usando supabaseAdmin (bypassa RLS)
    const { data, error } = await supabaseAdmin
      .from("csv_rows")
      .insert(rows)
      .select();

    if (error) {
      console.error("❌ Error inserting rows:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    console.log(`✅ Successfully inserted ${data?.length || 0} rows`);

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      data,
    });
  } catch (error) {
    console.error("❌ API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Supabase admin not configured",
          details:
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Please restart the development server.",
        },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { rows, source } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid rows data" },
        { status: 400 },
      );
    }

    console.log(`🔄 Updating ${rows.length} rows for source: ${source}`);

    // Deletar todas as linhas existentes do source
    const { error: deleteError } = await supabaseAdmin
      .from("csv_rows")
      .delete()
      .eq("source", source);

    if (deleteError) {
      console.error("❌ Error deleting old rows:", deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 },
      );
    }

    // Inserir todas as linhas atualizadas
    const { data, error: insertError } = await supabaseAdmin
      .from("csv_rows")
      .insert(rows)
      .select();

    if (insertError) {
      console.error("❌ Error inserting rows:", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 },
      );
    }

    console.log(`✅ Successfully updated ${data?.length || 0} rows`);

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      data,
    });
  } catch (error) {
    console.error("❌ API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Supabase admin not configured",
          details:
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Please restart the development server.",
        },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const source = searchParams.get("source");

    if (id) {
      console.log(`🗑️ Deleting row with id: ${id}`);

      // Deletar uma linha específica
      const { error } = await supabaseAdmin
        .from("csv_rows")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("❌ Error deleting row:", error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 },
        );
      }

      console.log("✅ Row deleted successfully");
      return NextResponse.json({ success: true });
    } else if (source) {
      console.log(`🗑️ Deleting all rows for source: ${source}`);

      // Deletar todas as linhas de um source
      const { error } = await supabaseAdmin
        .from("csv_rows")
        .delete()
        .eq("source", source);

      if (error) {
        console.error("❌ Error deleting rows:", error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 },
        );
      }

      console.log("✅ All rows deleted successfully");
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: "Missing id or source parameter" },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("❌ API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
