import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const FILE_PATH =
  "Movimientos_cuenta_corriente_ES7201280074060100064605 (86) (4).xlsx";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = `${SUPABASE_URL}/rest/v1/csv_rows`;
const LOG_DIR = path.join(process.cwd(), "logs", "errors");
const LOG_FILE = path.join(LOG_DIR, "bankinter-learning.log");

fs.mkdirSync(LOG_DIR, { recursive: true });

let attempt = 1;
let headerOffset = 0;
let dateColumnHint = /fecha contable|fecha valor/i;

/**
 * Normalize localized number strings into standard float values.
 * @param {string | number} value
 * @returns {number}
 */
function normalizeNumber(value) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = parseFloat(String(value).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Normalize spreadsheet date values (numeric or dd/mm/yyyy strings) to ISO.
 * @param {string | number} value
 * @returns {string}
 */
function normalizeDate(value) {
  if (!value) return "";
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const { y, m, d } = parsed;
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  const parts = String(value).trim().split(/[\/\-]/);
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    const fullYear = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    return `${fullYear}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  return "";
}

/**
 * Persist a log entry to disk.
 * @param {string} message
 */
function logError(message) {
  const entry = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, entry);
  console.error(entry.trim());
}

/**
 * Upload parsed rows to Supabase REST endpoint.
 * @param {Record<string, unknown>[]} payload
 */
async function uploadToSupabase(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload falhou: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Save a CSV snapshot of the parsed sheet for traceability.
 * @param {XLSX.WorkSheet} sheet
 * @returns {string}
 */
function persistCsvSnapshot(sheet) {
  const csvContent = XLSX.utils.sheet_to_csv(sheet, { FS: ";" });
  const snapshotPath = path.join(process.cwd(), "logs", "bankinter-eur.csv");
  fs.writeFileSync(snapshotPath, csvContent, "utf-8");
  return snapshotPath;
}

/**
 * Try to locate header row and extract normalized data rows.
 * @param {XLSX.WorkBook} workbook
 * @returns {{ clean: Record<string, unknown>[]; sheet: XLSX.WorkSheet }}
 */
function parseWorkbook(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => dateColumnHint.test(String(cell)))
  );

  const startIndex = headerRowIndex >= 0 ? headerRowIndex : headerOffset;
  const filtered = rows
    .slice(startIndex)
    .filter((row) => row[0] && !String(row[0]).includes("INFORMACIÓN DE INTERÉS"));

  if (!filtered.length) {
    throw new Error("Nenhuma linha útil encontrada após a detecção de cabeçalho.");
  }

  const headers = filtered[0];
  const fechaIdx = headers.findIndex((value) => /fecha/i.test(String(value)));
  const descIdx = headers.findIndex((value) => /descrip/i.test(String(value)));
  const haberIdx = headers.findIndex((value) => /haber/i.test(String(value)));
  const debeIdx = headers.findIndex((value) => /debe/i.test(String(value)));
  const saldoIdx = headers.findIndex((value) => /saldo/i.test(String(value)));
  const refIdx = headers.findIndex((value) => /ref/i.test(String(value)));

  if (fechaIdx < 0 || descIdx < 0 || (haberIdx < 0 && debeIdx < 0)) {
    throw new Error("Colunas obrigatórias não encontradas (fecha/descrição/valor).");
  }

  const dataRows = filtered.slice(1);
  const clean = dataRows
    .map((row, index) => {
      const date = normalizeDate(row[fechaIdx]);
      const description = String(row[descIdx] || "").trim();
      const haber = normalizeNumber(row[haberIdx]);
      const debe = normalizeNumber(row[debeIdx]);
      const balance = saldoIdx >= 0 ? normalizeNumber(row[saldoIdx]) : 0;
      const amount = haber - debe;
      const reference = refIdx >= 0 ? row[refIdx] : "";

      if (!date || !description || amount === 0) return null;

      return {
        id: `BANKINTER-EUR-${Date.now()}-${index}`,
        file_name: "bankinter-eur.csv",
        source: "bankinter-eur",
        date,
        description,
        amount,
        balance,
        category: "Other",
        classification: "Other",
        reconciled: false,
        custom_data: {
          conciliado: false,
          paymentSource: null,
          reconciliationType: null,
          reference,
        },
      };
    })
    .filter(Boolean);

  if (!clean.length) {
    throw new Error("Nenhuma linha válida após normalização.");
  }

  return { clean, sheet };
}

/**
 * Validate successful insertion by re-querying Supabase.
 * @param {number} expectedCount
 */
async function verifyUpload(expectedCount) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/csv_rows?source=eq.bankinter-eur`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Falha ao validar no Supabase: ${message}`);
  }

  const data = await response.json();
  if (data.length < expectedCount) {
    throw new Error("Upload incompleto detectado, reaprendendo...");
  }
}

/**
 * Update parsing hints based on failure reason.
 * @param {string} reason
 */
function learnFromError(reason) {
  if (/cabeçalho|Nenhuma linha útil/.test(reason)) {
    headerOffset += 1;
  }

  if (/colunas obrigatórias/i.test(reason)) {
    dateColumnHint = /fecha|valor/i;
  }
}

async function runLearningCycle() {
  console.log(`\n🚀 Tentativa #${attempt} — aprendizado ativo iniciado...`);
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.");
    }

    const buffer = fs.readFileSync(FILE_PATH);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const { clean, sheet } = parseWorkbook(workbook);
    const snapshotPath = persistCsvSnapshot(sheet);

    console.log(`🧾 ${clean.length} linhas prontas. Snapshot salvo em ${snapshotPath}`);
    console.log("📡 Subindo para Supabase...");

    const uploaded = await uploadToSupabase(clean);
    console.log(`✅ Upload bem-sucedido! ${uploaded.length} registros inseridos.`);

    console.log("🔎 Validando presença no relatório Bankinter EUR...");
    await verifyUpload(clean.length);

    console.log("🎉 Dados confirmados no relatório Bankinter EUR.");
    process.exit(0);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`❌ Erro na tentativa #${attempt}: ${reason}`);
    logError(reason);
    learnFromError(reason);
    attempt += 1;
    setTimeout(runLearningCycle, 5000);
  }
}

runLearningCycle();
