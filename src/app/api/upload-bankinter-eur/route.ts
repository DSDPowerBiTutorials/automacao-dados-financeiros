"use client";

import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import formidable from "formidable";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const config = { api: { bodyParser: false } };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// 🧩 Funções auxiliares seguras
const normalizeNumber = (val?: any) => {
  if (val === undefined || val === null) return 0;
  return (
    parseFloat(String(val).replace(/\./g, "").replace(",", ".").trim()) || 0
  );
};

const normalizeDate = (val: any) => {
  if (!val) return "";
  if (typeof val === "number") {
    const { y, m, d } = XLSX.SSF.parse_date_code(val);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const parts = String(val)
    .trim()
    .split(/[\/\-]/);
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    const fullYear = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    return `${fullYear}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return "";
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const form = formidable({ multiples: false });
    const [_, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const buffer = await fs.readFile(file.filepath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    // === Regras específicas Bankinter EUR ===
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

    if (fechaIdx === -1 || descIdx === -1)
      throw new Error(
        "Formato inesperado — colunas principais não encontradas.",
      );

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
          file_name: file.originalFilename,
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

    // === Converter em CSV ===
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

    // === Upload CSV ao Supabase ===
    const { error: uploadError } = await supabase.storage
      .from("csv_files")
      .upload(filename, await fs.readFile(tmpPath), {
        contentType: "text/csv",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    // === Inserir no banco ===
    const { error: dbError } = await supabase.from("csv_rows").insert(clean);
    if (dbError) throw dbError;

    await fs.unlink(tmpPath);

    return res.status(200).json({
      success: true,
      message: `✅ ${clean.length} linhas importadas e armazenadas.`,
      file: filename,
    });
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
    return res
      .status(500)
      .json({ error: "Upload failed", details: err.message });
  }
}
