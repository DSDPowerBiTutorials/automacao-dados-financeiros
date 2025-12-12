import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: "Supabase admin não configurado" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const { file } = body;

    // Validar dados
    if (!file.name || !file.source || !file.rows || file.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos" },
        { status: 400 },
      );
    }

    // Salvar informações do arquivo
    const { error: fileError } = await supabaseAdmin.from("csv_files").upsert({
      id: `${file.source}_${file.name}`,
      name: file.name,
      last_updated: file.lastUpdated,
      total_amount: file.totalAmount || 0,
      source: file.source,
      updated_at: new Date().toISOString(),
    });

    if (fileError) {
      console.error("Error saving file metadata:", fileError);
      return NextResponse.json(
        { success: false, error: fileError.message },
        { status: 500 },
      );
    }

    // Salvar todas as linhas
    const rowsToInsert = file.rows.map((row: any) => ({
      id: row.id,
      file_name: file.name,
      source: file.source,
      date: row.date || "",
      description: row.description || "",
      amount: row.amount || 0,
      category: row.category || "Other",
      classification: row.classification || "Other",
      deposit_account: row.depositAccount || null,
      payment_method: row.paymentMethod || null,
      order_numbers: row.orderNumbers || [],
      reconciled: row.reconciled || false,
      matched_with: row.matchedWith || null,
      custom_data: row,
      updated_at: new Date().toISOString(),
    }));

    const { error: rowsError } = await supabaseAdmin
      .from("csv_rows")
      .upsert(rowsToInsert);

    if (rowsError) {
      console.error("Error saving rows:", rowsError);
      return NextResponse.json(
        { success: false, error: rowsError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in save API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
