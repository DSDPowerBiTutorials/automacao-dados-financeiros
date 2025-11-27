import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"  // 👈 usa o mesmo client que no database.ts

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rows } = body

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Invalid rows data" }, { status: 400 })
    }

    // Inserir todas as linhas usando o client normal (respeita RLS)
    const { data, error } = await supabase.from("csv_rows").insert(rows).select()

    if (error) {
      console.error("Error inserting rows:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      data,
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { rows, source } = body

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Invalid rows data" }, { status: 400 })
    }

    if (!source) {
      return NextResponse.json({ error: "Missing source" }, { status: 400 })
    }

    // Primeiro, deletar todas as linhas existentes desse source
    const { error: deleteError } = await supabase
      .from("csv_rows")
      .delete()
      .eq("source", source)

    if (deleteError) {
      console.error("Error deleting old rows:", deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Depois, inserir as linhas novas/atualizadas
    const { data, error: insertError } = await supabase
      .from("csv_rows")
      .insert(rows)
      .select()

    if (insertError) {
      console.error("Error inserting rows:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      data,
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const source = searchParams.get("source")

    if (id) {
      // Deletar uma linha específica
      const { error } = await supabase.from("csv_rows").delete().eq("id", id)

      if (error) {
        console.error("Error deleting row:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    } else if (source) {
      // Deletar todas as linhas de um source
      const { error } = await supabase.from("csv_rows").delete().eq("source", source)

      if (error) {
        console.error("Error deleting rows:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: "Missing id or source parameter" },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
