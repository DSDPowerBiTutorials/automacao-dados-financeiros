"use client";

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

const FILE_NAME = "bankinter-eur.csv";
const SOURCE = "bankinter-eur";
const HEADER_OFFSET = 5;

function parseAmount(value: any): number {
  if (value === undefined || value === null) return 0;

  const raw = String(value).replace(/\s+/g, "");

  if (raw.includes(",")) {
    const normalized = raw.replace(/\./g, "").replace(/,/g, ".");
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: any): string | null {
  if (!value) return null;

  if (typeof value === "number") {
    const dateObj = XLSX.SSF.parse_date_code(value);
    if (!dateObj) return null;
    return new Date(Date.UTC(dateObj.y, dateObj.m - 1, dateObj.d))
      .toISOString()
      .split("T")[0];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const delimiterMatch = trimmed.match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/,
    );

    if (delimiterMatch) {
      const [, day, month, year] = delimiterMatch;
      const parsedYear = year.length === 2 ? 2000 + Number(year) : Number(year);
      return `${parsedYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }

  return null;
}

function sanitizeDescription(value: any): string {
  if (!value) return "";
  return String(value).replace(/"/g, "").trim();
}

function buildCustomData(headers: string[], row: any[]) {
  const rowData = Object.fromEntries(
    headers.map((header, index) => [header, row[index] ?? ""]),
  );

  return {
    ...rowData,
    conciliado: false,
    paymentSource: null,
    reconciliationType: null,
  };
}

async function parseUploadedFile(file: File): Promise<any[][]> {
  const fileName = file.name?.toLowerCase() || "";

  if (
    !fileName.endsWith(".csv") &&
    !fileName.endsWith(".xlsx") &&
    !fileName.endsWith(".xls")
  ) {
    throw new Error(
      "❌ Formato não suportado. Envie um arquivo .csv ou .xlsx.",
    );
  }

  if (fileName.endsWith(".csv")) {
    const csvText = await file.text();
    if (!csvText.trim()) {
      throw new Error("❌ O arquivo CSV está vazio.");
    }
    const workbook = XLSX.read(csvText, { type: "string" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    }) as any[][];
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const csvText = XLSX.utils.sheet_to_csv(sheet);
  if (!csvText.trim()) {
    throw new Error("❌ O arquivo XLSX não pôde ser convertido para CSV.");
  }
  const parsedWorkbook = XLSX.read(csvText, { type: "string" });
  const parsedSheet = parsedWorkbook.Sheets[parsedWorkbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(parsedSheet, {
    header: 1,
    defval: "",
  }) as any[][];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Arquivo não enviado ou inválido." },
        { status: 400 },
      );
    }

    const data = await parseUploadedFile(file);

    let filteredData = data
      .slice(HEADER_OFFSET)
      .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));

    const endIndex = filteredData.findIndex((row) =>
      String(row[0] ?? "")
        .toUpperCase()
        .includes("INFORMACIÓN DE INTERÉS"),
    );
    if (endIndex !== -1) {
      filteredData = filteredData.slice(0, endIndex);
    }

    if (!filteredData.length) {
      throw new Error("❌ Nenhuma linha encontrada após processar o arquivo.");
    }

    const headers = (filteredData[0] as string[]).map((header) =>
      header.trim().toUpperCase(),
    );
    const rows = filteredData.slice(1);

    const fechaValorIndex = headers.indexOf("FECHA VALOR");
    const descripcionIndex = headers.indexOf("DESCRIPCIÓN");
    const haberIndex = headers.indexOf("HABER");
    const debeIndex = headers.indexOf("DEBE");

    if (fechaValorIndex === -1 || descripcionIndex === -1) {
      throw new Error(
        "❌ Colunas obrigatórias não encontradas (FECHA VALOR / DESCRIPCIÓN).",
      );
    }

    const parsedRows = rows
      .map((row, index) => {
        const fechaValor = row[fechaValorIndex];
        const descripcion = sanitizeDescription(row[descripcionIndex]);
        const haber = parseAmount(row[haberIndex]);
        const debe = parseAmount(row[debeIndex]);
        const amount = haber - debe;
        const parsedDate = parseDate(fechaValor);

        if (!parsedDate || (!haber && !debe)) {
          return null;
        }

        return {
          id: `BANKINTER-EUR-${Date.now()}-${index}`,
          file_name: FILE_NAME,
          source: SOURCE,
          date: parsedDate,
          description: descripcion,
          amount,
          category: "Other",
          classification: "Other",
          reconciled: false,
          custom_data: buildCustomData(headers, row),
        };
      })
      .filter(Boolean);

    if (!parsedRows.length) {
      throw new Error("❌ Nenhuma linha válida encontrada no arquivo.");
    }

    const csvRowsUrl = new URL("/api/csv-rows", request.url);
    const response = await fetch(csvRowsUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: parsedRows, source: SOURCE }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || "Falha ao salvar dados no Supabase.");
    }

    console.log(
      `✅ Upload concluído: ${FILE_NAME} (${parsedRows.length} registros)`,
    ); // eslint-disable-line no-console

    return NextResponse.json({ success: true, inserted: parsedRows.length });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro desconhecido ao processar upload.";
    console.error("❌ Erro ao processar upload:", message); // eslint-disable-line no-console
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
