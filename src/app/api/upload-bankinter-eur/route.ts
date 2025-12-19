export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"

type AnyRow = Record<string, any>

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { success: false, error: "Supabase environment variables not configured" },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 })
    }

    // Parse XLSX
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<AnyRow>(sheet, { defval: "" })

    // Map columns (Bankinter format)
    const records = rows
      .map((r) => {
        const date = String(r["FECHA VALOR"] ?? "").trim()
        const description = String(r["DESCRIPCIÓN"] ?? "").trim()
        const amountRaw = r["HABER"]

        if (!date && !description && (amountRaw === "" || amountRaw == null)) return null

        const amount = String(amountRaw ?? 0)

        return {
          source: "bankinter-eur",
          file_name: `bankinter_eur_${Date.now()}.xlsx`,
          date,
          description,
          amount,
          category: "Other",
          classification: "Other",
          reconciled: false,
          custom_data: {
            conciliado: false
          }
        }
      })
      .filter(Boolean) as AnyRow[]

    if (records.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 })
    }

    const { error } = await supabase.from("csv_rows").insert(records)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, inserted: records.length })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json(
      { success: false, error: err?.message || "Unexpected error" },
      { status: 500 }
    )
  }
}
