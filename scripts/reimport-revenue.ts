/**
 * Script para reimportar Revenue Import.csv com mapeamento correto de campos
 * Corrige a discrepância: Excel 543.338 vs App 537.490 para Março 2025 FA 101.1
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const CSV_PATH = path.join(process.cwd(), "public", "Revenue Import.csv");
const SOURCE = "invoice-orders";
const FILE_NAME = "Revenue Import.csv";

interface ParsedRow {
    invoice_date: string;       // Col 0: Invoice Date (dd/MM/yyyy)
    financial_dimension: string; // Col 1: Financial Dimension
    customer_name: string;       // Col 2: Customer Name
    financial_account: string;   // Col 3: Financial Account (ex: "   101.1 - DSD Courses")
    description: string;         // Col 4: Description
    amount: number;              // Col 10: EUR Ex (European format)
    invoice_number: string;      // Col 17: Invoice Number
    order_type: string;          // Col 6: Order Type
}

function parseEuropeanDate(dateStr: string): string | null {
    // dd/MM/yyyy -> yyyy-MM-dd
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
}

function parseEuropeanNumber(numStr: string): number {
    if (!numStr || numStr.trim() === "") return 0;
    // Remove thousand separator (.) and convert decimal separator (,) to (.)
    const cleaned = numStr.replace(/\./g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
}

function extractFACode(faString: string): string | null {
    // "   101.1 - DSD Courses" -> "101.1"
    const match = faString.match(/(\d{3}\.\d)/);
    return match ? match[1] : null;
}

async function main() {
    console.log("🚀 Reimportando Revenue Import.csv...\n");

    // Ler CSV - normalizar line endings (CRLF -> LF)
    const csvContent = fs.readFileSync(CSV_PATH, "utf-8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = csvContent.split("\n");
    console.log(`📄 Total de linhas no CSV: ${lines.length}`);

    // Parse header (linha 0)
    const header = lines[0].split(";");
    console.log(`📋 Colunas: ${header.length}`);

    // Parse data rows
    const rows: ParsedRow[] = [];
    let skippedNonIncurred = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(";");
        if (cols.length < 18) continue;

        const financialDimension = cols[1]?.trim() || "";

        // Filtrar apenas "Incurred"
        if (financialDimension !== "Incurred") {
            skippedNonIncurred++;
            continue;
        }

        const invoiceDateStr = cols[0]?.trim() || "";
        const invoiceDate = parseEuropeanDate(invoiceDateStr);
        if (!invoiceDate) continue;

        const amount = parseEuropeanNumber(cols[10] || "0");
        const faString = cols[3]?.trim() || "";
        const faCode = extractFACode(faString);

        rows.push({
            invoice_date: invoiceDate,
            financial_dimension: financialDimension,
            customer_name: cols[2]?.trim() || "",
            financial_account: faCode || "",
            description: cols[4]?.trim() || "",
            amount,
            invoice_number: cols[17]?.trim() || "",
            order_type: cols[6]?.trim() || "",
        });
    }

    console.log(`✅ Registros Incurred parseados: ${rows.length}`);
    console.log(`⏭️  Registros não-Incurred ignorados: ${skippedNonIncurred}`);

    // Verificar Março 2025 FA 101.1
    const mar2025_101_1 = rows.filter(
        (r) => r.invoice_date.startsWith("2025-03") && r.financial_account === "101.1"
    );
    const mar2025_total = mar2025_101_1.reduce((s, r) => s + r.amount, 0);
    console.log(`\n📊 Março 2025 FA 101.1:`);
    console.log(`   Registros: ${mar2025_101_1.length}`);
    console.log(`   Valor total: €${mar2025_total.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`);
    console.log(`   (Esperado: 128 registros = €543.337,50)\n`);

    // Executar importação
    console.log("🗑️  Deletando registros antigos...");
    const { error: deleteError, count: deleteCount } = await supabase
        .from("csv_rows")
        .delete({ count: "exact" })
        .eq("source", SOURCE);

    if (deleteError) {
        console.error("❌ Erro ao deletar:", deleteError);
        process.exit(1);
    }
    console.log(`✅ Deletados ${deleteCount} registros antigos`);

    // Preparar registros para inserção
    const insertRows = rows.map((r) => ({
        source: SOURCE,
        file_name: FILE_NAME,
        date: r.invoice_date,
        description: r.description || r.customer_name,
        amount: r.amount,
        reconciled: false,
        custom_data: {
            invoice_date: r.invoice_date,
            financial_dimension: r.financial_dimension,
            customer_name: r.customer_name,
            financial_account: r.financial_account,
            financial_account_code: r.financial_account,
            invoice_number: r.invoice_number,
            order_type: r.order_type,
        },
    }));

    // Inserir em batches de 500
    const BATCH_SIZE = 500;
    let inserted = 0;

    console.log(`\n📥 Inserindo ${insertRows.length} registros...`);

    for (let i = 0; i < insertRows.length; i += BATCH_SIZE) {
        const batch = insertRows.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from("csv_rows").insert(batch);

        if (insertError) {
            console.error(`❌ Erro no batch ${i / BATCH_SIZE + 1}:`, insertError);
            process.exit(1);
        }

        inserted += batch.length;
        process.stdout.write(`\r   Inseridos: ${inserted}/${insertRows.length}`);
    }

    console.log(`\n\n✅ Importação concluída!`);
    console.log(`   Total inserido: ${inserted} registros`);

    // Verificação final
    const { data: verifyData, error: verifyError } = await supabase
        .from("csv_rows")
        .select("date, custom_data, amount")
        .eq("source", SOURCE)
        .gte("date", "2025-03-01")
        .lte("date", "2025-03-31");

    if (!verifyError && verifyData) {
        const verify101_1 = verifyData.filter(
            (r: any) => r.custom_data?.financial_account_code === "101.1"
        );
        const verifyTotal = verify101_1.reduce((s: number, r: any) => s + r.amount, 0);
        console.log(`\n🔍 Verificação Março 2025 FA 101.1:`);
        console.log(`   Registros no DB: ${verify101_1.length}`);
        console.log(`   Valor total: €${verifyTotal.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`);

        if (verify101_1.length === 128 && Math.abs(verifyTotal - 543337.50) < 1) {
            console.log(`   ✅ CORRETO! Igual ao Excel.`);
        } else {
            console.log(`   ⚠️  Diferença detectada`);
        }
    }
}

main().catch(console.error);
