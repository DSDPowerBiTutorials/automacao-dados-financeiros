"use client";

import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function normalizeNumber(val?: any): number {
  if (val === undefined || val === null) return 0;
  return (
    parseFloat(String(val).replace(/\./g, "").replace(",", ".").trim()) || 0
  );
}

function normalizeDate(val: any): string {
  if (!val) return "";
  if (typeof val === "number") {
    const { y, m, d } = XLSX.SSF.parse_date_code(val);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const parts = String(val ?? "")
    .trim()
    .split(/[\/\-]/);
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    const fullYear = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    return `${fullYear}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return "";
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(
        JSON.stringify({ error: "Nenhum arquivo enviado." }),
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    // Ignora cabeçalhos e rodapés
    const validData = rows
      .slice(5)
      .filter(
        (r: any[]) =>
          r[0] &&
          !String(r[0]).toUpperCase().includes("INFORMACIÓN DE INTERÉS"),
      );

    const headers = validData[0];
    const fechaIdx = headers.findIndex((h: string) =>
      /fecha valor/i.test(String(h)),
    );
    const descIdx = headers.findIndex((h: string) =>
      /descrip/i.test(String(h)),
    );
    const haberIdx = headers.findIndex((h: string) => /haber/i.test(String(h)));
    const debeIdx = headers.findIndex((h: string) => /debe/i.test(String(h)));
    const saldoIdx = headers.findIndex((h: string) => /saldo/i.test(String(h)));
    const refIdx = headers.findIndex((h: string) =>
      /clave|referen/i.test(String(h)),
    );

    if (fechaIdx === -1 || descIdx === -1) {
      throw new Error(
        "Formato inesperado — colunas principais não encontradas.",
      );
    }

    const dataRows = validData.slice(1);

    const clean = dataRows
      .map((r: any[]) => {
        const date = normalizeDate(r[fechaIdx]);
        const desc = String(r[descIdx] ?? "").trim();
        const haber = normalizeNumber(r[haberIdx]);
        const debe = normalizeNumber(r[debeIdx]);
        const amount = haber - debe;
        const saldo = normalizeNumber(r[saldoIdx]);
        const ref = String(r[refIdx] ?? "").trim();

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

    // Gera CSV
    const csvHeader =
      "date,description,amount,balance,reference,category,classification,source";
    const csvBody = clean
      .map(
        (r: any) =>
          `${r.date},"${r.description.replace(/"/g, '""')}",${r.amount},${r.balance},"${r.reference}","${r.category}","${r.classification}",${r.source}`,
      )
      .join("\n");

    const csvContent = `${csvHeader}\n${csvBody}`;
    const filename = `bankinter-eur-${Date.now()}.csv`;
    const tmpPath = path.join("/tmp", filename);
    await fs.writeFile(tmpPath, csvContent);

    // Upload CSV para Supabase
    const { error: uploadError } = await supabase.storage
      .from("csv_files")
      .upload(filename, await fs.readFile(tmpPath), {
        contentType: "text/csv",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    // Inserção no banco
    const { error: dbError } = await supabase.from("csv_rows").insert(clean);
    if (dbError) throw dbError;

    await fs.unlink(tmpPath);

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ ${clean.length} linhas importadas e armazenadas.`,
        file: filename,
      }),
      { status: 200 },
    );
  } catch (err: any) {
    console.error("❌ Erro no upload Bankinter EUR:", err.message);
    const logName = `logs/errors/bankinter-eur-${Date.now()}.json`;
    await supabase.storage
      .from("logs")
      .upload(
        logName,
        Buffer.from(JSON.stringify({ error: err.message }, null, 2)),
        {
          contentType: "application/json",
        },
      );

    return new Response(
      JSON.stringify({ error: "Upload failed", details: err.message }),
      { status: 500 },
    );
  }
}
