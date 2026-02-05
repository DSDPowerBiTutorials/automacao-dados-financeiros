/**
 * Script para importar dados de Janeiro 2026 do Excel
 * Fonte: invoice-orders-2026-02-02.xlsx
 */

const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXCEL_PATH = "/tmp/invoice-orders-2026.xlsx";
const SOURCE = "invoice-orders";
const FILE_NAME = "invoice-orders-2026-02-02.xlsx";

function parseDate(dateStr) {
    // dd/MM/yyyy -> yyyy-MM-dd
    if (!dateStr) return null;
    if (typeof dateStr === "number") {
        // Excel serial date
        const date = new Date((dateStr - 25569) * 86400 * 1000);
        return date.toISOString().split("T")[0];
    }
    const match = String(dateStr).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
}

async function main() {
    console.log("🚀 Importando dados de Janeiro 2026 do Excel...\n");

    // Ler Excel
    const wb = XLSX.readFile(EXCEL_PATH);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);

    console.log(`📄 Total de linhas no Excel: ${data.length}`);

    // Filtrar apenas Janeiro 2026
    const jan2026Rows = data.filter((row) => {
        const date = parseDate(row.Date);
        return date && date.startsWith("2026-01");
    });

    console.log(`📅 Registros de Janeiro 2026: ${jan2026Rows.length}`);

    // Preparar para inserção
    const insertRows = jan2026Rows.map((row) => {
        const date = parseDate(row.Date);
        const amount = parseFloat(row.Amount) || 0;
        const faCode = row.financial_account_code || "";

        return {
            source: SOURCE,
            file_name: FILE_NAME,
            date: date,
            description: row.Products || row.Note || "",
            amount: amount,
            reconciled: row.Status === "Reconciled",
            custom_data: {
                invoice_number: row["Invoice #"] || "",
                order_number: row["Order #"] || row.order_id || "",
                customer_name: row.Client || row.Company || "",
                email: row.Email || "",
                currency: row.Currency || "EUR",
                financial_account_code: faCode,
                financial_account_name: row.financial_account_name || "",
                order_type: row.Order_Status || "",
                payment_method: row.Payment_Method || "",
                billing_entity: row.Billing_Entity || "",
                country: row.Country || "",
            },
        };
    });

    // Verificar totais por FA antes de importar
    const byFA = {};
    for (const row of insertRows) {
        const fa = row.custom_data.financial_account_code || "SEM_FA";
        byFA[fa] = byFA[fa] || { count: 0, total: 0 };
        byFA[fa].count++;
        byFA[fa].total += row.amount;
    }

    console.log("\n📋 Totais por FA a importar:");
    console.log("FA Code      | Count | Total EUR");
    console.log("-------------|-------|---------------");
    let grandTotal = 0;
    const sorted = Object.entries(byFA).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [fa, info] of sorted) {
        console.log(
            fa.toString().padEnd(12) +
            " | " +
            String(info.count).padStart(5) +
            " | " +
            info.total.toFixed(2).padStart(15)
        );
        grandTotal += info.total;
    }
    console.log("-------------|-------|---------------");
    console.log(
        "TOTAL        | " +
        String(insertRows.length).padStart(5) +
        " | " +
        grandTotal.toFixed(2).padStart(15)
    );

    // Deletar registros antigos de Janeiro 2026
    console.log("\n🗑️  Deletando registros antigos de Janeiro 2026...");
    const { error: deleteError, count: deleteCount } = await supabase
        .from("csv_rows")
        .delete({ count: "exact" })
        .eq("source", SOURCE)
        .gte("date", "2026-01-01")
        .lte("date", "2026-01-31");

    if (deleteError) {
        console.error("❌ Erro ao deletar:", deleteError);
        process.exit(1);
    }
    console.log(`✅ Deletados ${deleteCount || 0} registros antigos de Janeiro 2026`);

    // Inserir em batches
    console.log(`\n📥 Inserindo ${insertRows.length} registros...`);
    const BATCH_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < insertRows.length; i += BATCH_SIZE) {
        const batch = insertRows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("csv_rows").insert(batch);

        if (error) {
            console.error(`❌ Erro no batch ${i}:`, error);
            process.exit(1);
        }
        inserted += batch.length;
        process.stdout.write(`   Inseridos: ${inserted}/${insertRows.length}\r`);
    }

    console.log(`\n✅ Importação concluída! ${inserted} registros de Janeiro 2026`);

    // Verificar no banco
    console.log("\n🔍 Verificando no banco...");
    const { data: dbData, error: dbError } = await supabase
        .from("csv_rows")
        .select("custom_data, amount")
        .eq("source", SOURCE)
        .gte("date", "2026-01-01")
        .lte("date", "2026-01-31");

    if (dbError) {
        console.error("Erro:", dbError);
        return;
    }

    const dbByFA = {};
    for (const row of dbData) {
        const fa = row.custom_data?.financial_account_code || "SEM_FA";
        dbByFA[fa] = dbByFA[fa] || { count: 0, total: 0 };
        dbByFA[fa].count++;
        dbByFA[fa].total += parseFloat(row.amount) || 0;
    }

    console.log("\n📊 Totais no banco (Janeiro 2026):");
    console.log("FA Code      | Count | Total EUR");
    console.log("-------------|-------|---------------");
    let dbTotal = 0;
    for (const [fa, info] of Object.entries(dbByFA).sort((a, b) =>
        a[0].localeCompare(b[0])
    )) {
        console.log(
            fa.toString().padEnd(12) +
            " | " +
            String(info.count).padStart(5) +
            " | " +
            info.total.toFixed(2).padStart(15)
        );
        dbTotal += info.total;
    }
    console.log("-------------|-------|---------------");
    console.log(
        "TOTAL        | " +
        String(dbData.length).padStart(5) +
        " | " +
        dbTotal.toFixed(2).padStart(15)
    );
}

main().catch(console.error);
