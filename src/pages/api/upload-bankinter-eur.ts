import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import formidable, { File } from "formidable";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

type ParsedRow = {
  id: string;
  file_name: string | undefined;
  source: string;
  date: string;
  description: string;
  amount: number;
  balance: number;
  reference: string;
  category: string;
  classification: string;
  reconciled: boolean;
  custom_data: Record<string, unknown>;
  raw?: any[];
};

type ValidationResult = {
  validRows: ParsedRow[];
  errors: { line: number; message: string; raw: ParsedRow | undefined }[];
};

export const config = { api: { bodyParser: false } };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const normalizeNumber = (val?: any) => {
  if (!val) return 0;
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

async function validateAndFixRows(
  rows: ParsedRow[],
): Promise<ValidationResult> {
  const errors: ValidationResult["errors"] = [];
  const validRows: ParsedRow[] = [];

  rows.forEach((row, index) => {
    let errorMsg = "";

    if (!row.date) {
      errorMsg += "Data ausente; ";
    }
    if (!row.description) {
      errorMsg += "Descrição vazia; ";
    }
    if (Number.isNaN(row.amount)) {
      errorMsg += "Valor inválido; ";
    }

    if (errorMsg) {
      if (row.raw && row.raw[0]) {
        row.date = normalizeDate(row.raw[0]);
      }
      if (row.raw && row.raw[1] && !row.description) {
        row.description = String(row.raw[1]).trim();
      }
      if ((!row.amount || Number.isNaN(row.amount)) && row.raw) {
        const haber = normalizeNumber(row.raw[2]);
        const debe = normalizeNumber(row.raw[3]);
        row.amount = haber - debe;
      }
    }

    if (!row.date || !row.description || Number.isNaN(row.amount)) {
      errors.push({
        line: index + 1,
        message: errorMsg || "Erro desconhecido",
        raw: row,
      });
    } else {
      validRows.push(row);
    }
  });

  return { validRows, errors };
}

function buildCsvContent(rows: ParsedRow[]) {
  const csvHeader =
    "date,description,amount,balance,reference,category,classification,source";
  const csvBody = rows
    .map(
      (row) =>
        `${row.date},"${row.description.replace(/"/g, '""')}",${row.amount},${row.balance},"${row.reference}","${row.category}","${row.classification}",${row.source}`,
    )
    .join("\n");
  return `${csvHeader}\n${csvBody}`;
}

async function uploadLogs(key: string, payload: Record<string, unknown>) {
  await supabase.storage
    .from("logs")
    .upload(key, Buffer.from(JSON.stringify(payload, null, 2)), {
      contentType: "application/json",
      upsert: true,
    });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const form = formidable({ multiples: false });
    const [, files] = await form.parse(req);
    const uploadedFile = Array.isArray(files.file)
      ? (files.file[0] as File)
      : (files.file as File);

    if (!uploadedFile)
      return res.status(400).json({ error: "No file uploaded" });

    const buffer = await fs.readFile(uploadedFile.filepath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    }) as any[];

    const validData = rows
      .slice(5)
      .filter(
        (r: any[]) =>
          r[0] &&
          !String(r[0]).toUpperCase().includes("INFORMACIÓN DE INTERÉS"),
      );

    if (validData.length < 2) {
      throw new Error(
        "Formato inesperado — dados insuficientes para processamento.",
      );
    }

    const headers = validData[0];
    const fechaIdx = headers.findIndex((h: string) => /fecha valor/i.test(h));
    const descIdx = headers.findIndex((h: string) => /descrip/i.test(h));
    const haberIdx = headers.findIndex((h: string) => /haber/i.test(h));
    const debeIdx = headers.findIndex((h: string) => /debe/i.test(h));
    const saldoIdx = headers.findIndex((h: string) => /saldo/i.test(h));
    const refIdx = headers.findIndex((h: string) => /clave|referen/i.test(h));

    if (fechaIdx === -1 || descIdx === -1)
      throw new Error(
        "Formato inesperado — colunas principais não encontradas.",
      );

    const dataRows = validData.slice(1);
    const parsed: ParsedRow[] = dataRows
      .map((r: any[]) => {
        const date = normalizeDate(r[fechaIdx]);
        const desc = (r[descIdx] || "").trim();
        const haber = normalizeNumber(r[haberIdx]);
        const debe = normalizeNumber(r[debeIdx]);
        const amount = haber - debe;
        const saldo = normalizeNumber(r[saldoIdx]);
        const ref = String(r[refIdx] || "").trim();

        if (!date || !desc || amount === 0) return null;

        return {
          id: `BANKINTER-EUR-${crypto.randomUUID()}`,
          file_name: uploadedFile.originalFilename,
          source: "bankinter-eur",
          date,
          description: desc,
          amount,
          balance: saldo,
          reference: ref,
          category: "Other",
          classification: amount > 0 ? "Receita" : "Despesa",
          reconciled: false,
          custom_data: {
            conciliado: false,
            paymentSource: null,
            reconciliationType: null,
            raw: r,
          },
          raw: r,
        };
      })
      .filter(Boolean) as ParsedRow[];

    const { validRows, errors } = await validateAndFixRows(parsed);

    let rowsToPersist = validRows;
    if (errors.length > 0) {
      const erroredRows = errors
        .map((error) => error.raw)
        .filter(Boolean) as ParsedRow[];
      const { validRows: revalidatedRows, errors: reErrors } =
        await validateAndFixRows(erroredRows);

      rowsToPersist = [...validRows, ...revalidatedRows];

      if (reErrors.length > 0) {
        const errorLog = {
          message: "Falha na validação final do arquivo Bankinter EUR",
          errors: reErrors,
          file: uploadedFile.originalFilename,
          timestamp: new Date().toISOString(),
        };

        await uploadLogs(
          `errors/bankinter-validation-${Date.now()}.json`,
          errorLog,
        );

        return res.status(400).json({
          error: "Erro de validação — revise os campos informados",
          details: reErrors,
        });
      }
    }

    const csvContent = buildCsvContent(rowsToPersist);

    const filename = `bankinter-eur-${Date.now()}.csv`;
    const tmpPath = path.join("/tmp", filename);
    await fs.writeFile(tmpPath, csvContent);

    const { error: uploadError } = await supabase.storage
      .from("csv_files")
      .upload(filename, await fs.readFile(tmpPath), {
        contentType: "text/csv",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { error: dbError } = await supabase
      .from("csv_rows")
      .insert(rowsToPersist);
    if (dbError) throw dbError;

    await fs.unlink(tmpPath);
    return res.status(200).json({
      success: true,
      message: `✅ ${rowsToPersist.length} linhas importadas e validadas com sucesso.`,
      file: filename,
    });
  } catch (err: any) {
    console.error("❌ Erro no upload Bankinter:", err.message);
    await uploadLogs(`errors/bankinter-eur-${Date.now()}.json`, {
      error: err.message,
    });
    return res
      .status(500)
      .json({ error: "Upload failed", details: err.message });
  }
}
