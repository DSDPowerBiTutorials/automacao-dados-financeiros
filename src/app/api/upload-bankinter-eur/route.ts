/* eslint-disable */
/* prettier-ignore-start */
/* @auto-fix-disable */
/* @formatter:off */

// 🚫 This file must remain a Server Component.
// 🚫 DO NOT add "use client" or any fs/promises imports.
// 🚫 Protected from auto-fix bots and formatters.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import crypto from "crypto";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type SheetRow = (string | number)[];

function normalizeNumber(val?: any): number {
  if (val === undefined || val === null) return 0;
  return parseFloat(String(val).replace(/\./g, "").replace(",", ".").trim()) || 0;
}

function normalizeDate(val: any): string {
  if (!val) return "";
  if (typeof val === "number") {
    const { y, m, d } = XLSX.SSF.parse_date_code(val);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const parts = String(val).trim().split(/[\/\-]/);
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    const fullYear = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    return `${fullYear}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return "";
}

function safeTrim(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).replace(/^"+|"+$/g, "").trim();
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file)
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { header: 1, defval: "" });

    const validData = rows.slice(5).filter((r): r is SheetRow => {
      const firstCell = r?.[0];
      return (
        Array.isArray(r) &&
        Boolean(firstCell) &&
        !String(firstCell).toUpperCase().includes("INFORMACIÓN DE INTERÉS")
      );
    });
    if (!validData.length)
      throw new Error("Formato inesperado — nenhuma linha válida encontrada.");

    const headers = validData[0];
    const fechaIdx = headers.findIndex((h) => /fecha valor/i.test(String(h)));
    const descIdx = headers.findIndex((h) => /descrip/i.test(String(h)));
    const haberIdx = headers.findIndex((h) => /haber/i.test(String(h)));
    const debeIdx = headers.findIndex((h) => /debe/i.test(String(h)));
    const saldoIdx = headers.findIndex((h) => /saldo/i.test(String(h)));
    const refIdx = headers.findIndex((h) => /clave|referen/i.test(String(h)));

    if (fechaIdx === -1 || descIdx === -1)
      throw new Error("Formato inesperado — colunas principais não encontradas.");

    const clean = validData.slice(1)
      .map((r: any[]) => {
        const date = normalizeDate(r[fechaIdx]);
        const desc = safeTrim(r[descIdx]);
        const haber = normalizeNumber(r[haberIdx]);
        const debe = normalizeNumber(r[debeIdx]);
        const amount = haber - debe;
        const saldo = normalizeNumber(r[saldoIdx]);
        const ref = safeTrim(r[refIdx]);
        if (!date || !desc || amount === 0) return null;
        return {
          id: crypto.randomUUID(),
          file_name: file.name,
          source: "bankinter-eur",
          date,
          description: desc,
          amount,
          balance: saldo,
          reference: ref,
          category: "Other",
          classification: amount > 0 ? "Receita" : "Despesa",
          reconciled: false,
          custom_data: { raw: r },
        };
      })
      .filter(Boolean);

    const csvHeader =
      "date,description,amount,balance,reference,category,classification,source";
    const csvBody = clean
      .map(
        (r: any) =>
          `${r.date},"${r.description.replace(/"/g, '""')}",${r.amount},${r.balance},"${r.reference}","${r.category}","${r.classification}",${r.source}`,
      )
      .join("\n");

    const csvBuffer = Buffer.from(`${csvHeader}\n${csvBody}`, "utf-8");
    const filename = `bankinter-eur-${Date.now()}.csv`;

    const { error: uploadError } = await supabase.storage
      .from("csv_files")
      .upload(filename, csvBuffer, {
        contentType: "text/csv",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { error: dbError } = await supabase.from("csv_rows").insert(clean);
    if (dbError) throw dbError;

    return NextResponse.json({
      success: true,
      message: `✅ ${clean.length} linhas importadas e armazenadas.`,
      file: filename,
    });
  } catch (err: any) {
    console.error("❌ Erro no upload Bankinter EUR:", err.message);
    const logName = `logs/errors/bankinter-eur-${Date.now()}.json`;
    await supabase.storage
      .from("logs")
      .upload(logName, Buffer.from(JSON.stringify({ error: err.message }, null, 2)), {
        contentType: "application/json",
      });
    return NextResponse.json(
      { error: "Upload failed", details: err.message },
      { status: 500 },
    );
  }
}

/* prettier-ignore-end */
