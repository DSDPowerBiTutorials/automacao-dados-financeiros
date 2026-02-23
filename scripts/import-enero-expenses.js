#!/usr/bin/env node
/**
 * import-enero-expenses.js
 * 
 * Importa despesas de Janeiro 2026 (Benefit Date) a partir do ficheiro ENEROEXPENSES.xlsx
 * para a tabela `invoices` no Supabase.
 * 
 * Uso: node scripts/import-enero-expenses.js [--dry-run]
 */

const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");

// ── Supabase ──
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const DRY_RUN = process.argv.includes("--dry-run");

// ── Excel serial date → ISO string ──
function excelDateToISO(serial) {
    if (!serial) return null;
    if (typeof serial === "string") {
        // Already a date string? Try to parse
        const parts = serial.split("/");
        if (parts.length === 3) {
            const [m, d, y] = parts;
            const year = y.length === 2 ? "20" + y : y;
            return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        }
        return serial;
    }
    if (typeof serial !== "number") return null;
    // Excel serial date: days since Jan 0, 1900 (with the Lotus 1-2-3 bug)
    const d = new Date(Date.UTC(1900, 0, serial - 1));
    return d.toISOString().split("T")[0];
}

// ── Parse EUR exchange amount (can be European format with comma as decimal) ──
function parseAmount(val) {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === "number") return val;
    // Remove thousands dots, convert comma to decimal
    const str = String(val).trim();
    const cleaned = str.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

// ── Map bank account names from XLSX to system codes ──
const BANK_ACCOUNT_MAP = {
    "BANKINTER 4605": "BANKINTER 4605",
    "BANKINTER TC 5731": "BANKINTER TC 5731",
    "CHASE USD 9186": "CHASE USD 9186",
    "CHASE USD 0687": "CHASE USD 0687",
    "SABADELL 8692": "SABADELL 8692",
    "SABADELL 9037": "SABADELL 9037",
    "Pleo": "Pleo",
    "Divvy": "Divvy",
};

// ── Determine scope from bank account ──
function getScope(bankAccount, currency) {
    const ba = (bankAccount || "").toUpperCase();
    if (ba.includes("CHASE") || ba.includes("DIVVY")) return "US";
    if (currency === "USD" && !ba.includes("BANKINTER") && !ba.includes("SABADELL")) return "US";
    return "ES";
}

// ── Determine cost_type_code from Departmental Big Line ──
function mapCostType(deptBigLine) {
    const d = String(deptBigLine || "").trim();
    if (!d) return "300"; // General
    // Extract the numeric prefix: "300 - General Expenses" → "300"
    const match = d.match(/^(\d+)/);
    return match ? match[1] : d;
}

// ── Determine dep_cost_type_code from Department ──
function mapDepCostType(dept) {
    const d = String(dept || "").trim();
    if (!d || d === "VERIFY") return null;
    return d;
}

// ── Determine cost_center_code ──
function mapCostCenter(dept) {
    const d = String(dept || "").trim();
    if (!d || d === "VERIFY") return null;
    // "3.0.0 - Corp" → use full string as code
    return d;
}

// ── Main import ──
async function main() {
    const filePath = path.resolve(__dirname, "../public/ENEROEXPENSES.xlsx");
    console.log(`📂 Reading: ${filePath}`);
    console.log(`${DRY_RUN ? "🔍 DRY RUN — no data will be written" : "💾 LIVE MODE — will insert into Supabase"}\n`);

    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    if (data.length < 2) {
        console.error("❌ No data rows found");
        process.exit(1);
    }

    const headers = data[0];
    console.log(`📊 Headers: ${headers.length} columns, ${data.length - 1} data rows\n`);

    /*
     * Column index mapping (from analysis):
     * [0]  Input Date
     * [1]  Invoice Date
     * [2]  Benefit Date
     * [3]  Due Date
     * [4]  Schedule Date
     * [5]  Payment Date
     * [6]  Bank Account
     * [7]  Payment Amount
     * [8]  Payment Currency
     * [9]  Status
     * [10] Invoice Nº
     * [11] Provider
     * [12] Description
     * [13] Course
     * [14] Week
     * [15] Invoice Amount
     * [16] Invoice Currency
     * [17] Finantial Account
     * [18] EUR Exchange
     * [19] Departmental Big Line
     * [20] Department
     * [21] Sub-Department
     * [22] Adicional Notes
     * [23] Report Date
     * [24] Cashflow TAG 1
     * [25] Cashflow TAG 2
     * [26] Invoice Link
     */

    const invoices = [];
    const errors = [];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        try {
            const invoiceDate = excelDateToISO(row[1]);
            const benefitDate = excelDateToISO(row[2]);
            const paymentAmount = parseAmount(row[7]);
            const invoiceAmount = parseAmount(row[15]);
            const eurExchange = parseAmount(row[18]);
            const currency = String(row[8] || "EUR").trim();
            const invoiceCurrency = String(row[16] || currency).trim();
            const bankAccount = row[6] ? String(row[6]).trim() : null;
            const status = String(row[9] || "").trim();
            const provider = row[11] ? String(row[11]).trim() : null;
            const invoiceNumber = row[10] != null ? String(row[10]).trim() : null;
            const description = row[12] ? String(row[12]).trim() : null;
            const course = row[13] ? String(row[13]).trim() : null;
            const financialAccount = row[17] ? String(row[17]).trim() : null;
            const deptBigLine = row[19] ? String(row[19]).trim() : null;
            const dept = row[20] ? String(row[20]).trim() : null;
            const subDept = row[21] ? String(row[21]).trim() : null;
            const notes = row[22] ? String(row[22]).trim() : null;

            // Skip empty rows
            if (!invoiceDate && !benefitDate && !paymentAmount) continue;

            // Determine scope
            const scope = getScope(bankAccount, currency);
            const scopeFields = scope === "US"
                ? { country_code: "US", scope: "US", applies_to_all_countries: false }
                : scope === "GLOBAL"
                    ? { country_code: "GLOBAL", scope: "GLOBAL", applies_to_all_countries: true }
                    : { country_code: "ES", scope: "ES", applies_to_all_countries: false };

            // Calculate EUR exchange rate (not amount)
            // eur_exchange is NUMERIC(10,6) — it's the EUR RATE, not the EUR amount
            // For EUR invoices, rate = 1.0
            // For non-EUR, rate = eurEquivalent / invoiceAmount (or 1.0 if can't calculate)
            const amt = invoiceAmount || paymentAmount || 0;
            let eurRate = 1.0;
            if (currency !== "EUR" && eurExchange && amt > 0) {
                eurRate = eurExchange / amt;
            }
            // Clamp to fit NUMERIC(10,6) — max 9999.999999
            if (eurRate > 9999) eurRate = 1.0;

            // Truncate sub_department_code to 20 chars (VARCHAR(20) constraint)
            const subDeptCode = subDept ? subDept.substring(0, 20) : null;

            // Build invoice record
            const invoice = {
                input_date: new Date().toISOString(),
                invoice_date: invoiceDate || benefitDate,
                benefit_date: benefitDate || invoiceDate,
                due_date: excelDateToISO(row[3]) || null,
                schedule_date: excelDateToISO(row[4]) || excelDateToISO(row[3]) || null,
                payment_date: excelDateToISO(row[5]) || null,
                invoice_type: "INCURRED",
                entry_type: "expense",
                financial_account_code: financialAccount || "UNKNOWN",
                financial_account_name: financialAccount || null,
                invoice_amount: amt,
                currency: invoiceCurrency || "EUR",
                eur_exchange: parseFloat(eurRate.toFixed(6)),
                provider_code: provider || "UNKNOWN",
                bank_account_code: bankAccount ? (BANK_ACCOUNT_MAP[bankAccount] || bankAccount) : null,
                course_code: course || null,
                payment_method_code: null,
                cost_type_code: mapCostType(deptBigLine) || "300",
                dep_cost_type_code: mapDepCostType(dept) || "3.0.0 - Corp",
                cost_center_code: mapCostCenter(dept) || "3.0.0 - Corp",
                sub_department_code: subDeptCode,
                description: description || null,
                invoice_number: invoiceNumber || null,
                ...scopeFields,
                dre_impact: true,
                cash_impact: true,
                is_intercompany: false,
                notes: notes || null,
                paid_amount: status === "Paid" ? (paymentAmount || amt) : null,
                paid_currency: status === "Paid" ? currency : null,
                payment_status: status === "Paid" ? "paid" : "pending",
            };

            invoices.push(invoice);
        } catch (err) {
            errors.push({ row: i + 1, error: err.message });
        }
    }

    console.log(`✅ Parsed ${invoices.length} invoices successfully`);
    if (errors.length > 0) {
        console.log(`⚠️  ${errors.length} rows with errors:`);
        errors.forEach(e => console.log(`   Row ${e.row}: ${e.error}`));
    }

    // Stats
    const byScope = {};
    const byBank = {};
    const byCurrency = {};
    const byStatus = {};
    invoices.forEach(inv => {
        byScope[inv.scope] = (byScope[inv.scope] || 0) + 1;
        byBank[inv.bank_account_code || "null"] = (byBank[inv.bank_account_code || "null"] || 0) + 1;
        byCurrency[inv.currency] = (byCurrency[inv.currency] || 0) + 1;
        byStatus[inv.payment_status] = (byStatus[inv.payment_status] || 0) + 1;
    });
    console.log("\n📊 Summary:");
    console.log("  By scope:", JSON.stringify(byScope));
    console.log("  By bank:", JSON.stringify(byBank));
    console.log("  By currency:", JSON.stringify(byCurrency));
    console.log("  By status:", JSON.stringify(byStatus));
    console.log("  Total amount (EUR):", invoices.reduce((s, inv) => s + (inv.eur_exchange || 0), 0).toFixed(2));

    if (DRY_RUN) {
        console.log("\n🔍 DRY RUN — showing first 3 records:");
        invoices.slice(0, 3).forEach((inv, i) => {
            console.log(`\n  [${i + 1}]`, JSON.stringify(inv, null, 2));
        });
        console.log("\n✅ Dry run complete. Run without --dry-run to insert.");
        return;
    }

    // ── Check for existing invoices with same benefit_date range to avoid duplicates ──
    const benefitDates = [...new Set(invoices.map(inv => inv.benefit_date).filter(Boolean))];
    console.log(`\n🔍 Checking for existing invoices with benefit dates: ${benefitDates[0]} to ${benefitDates[benefitDates.length - 1]}...`);

    const { data: existing, error: checkErr } = await supabase
        .from("invoices")
        .select("id, invoice_number, benefit_date, provider_code, invoice_amount")
        .gte("benefit_date", benefitDates[0])
        .lte("benefit_date", benefitDates[benefitDates.length - 1])
        .limit(5000);

    if (checkErr) {
        console.error("❌ Error checking existing:", checkErr.message);
        process.exit(1);
    }

    if (existing && existing.length > 0) {
        console.log(`⚠️  Found ${existing.length} existing invoices in this benefit date range.`);

        // Build a set of existing invoice signatures to detect duplicates
        const existingSet = new Set();
        existing.forEach(e => {
            const sig = `${e.benefit_date}|${e.provider_code}|${e.invoice_amount}|${e.invoice_number || ""}`;
            existingSet.add(sig);
        });

        // Filter out duplicates
        const newInvoices = invoices.filter(inv => {
            const sig = `${inv.benefit_date}|${inv.provider_code}|${inv.invoice_amount}|${inv.invoice_number || ""}`;
            return !existingSet.has(sig);
        });

        const dupeCount = invoices.length - newInvoices.length;
        if (dupeCount > 0) {
            console.log(`   🔄 Skipping ${dupeCount} duplicates. Inserting ${newInvoices.length} new invoices.`);
        }

        if (newInvoices.length === 0) {
            console.log("✅ All invoices already exist. Nothing to insert.");
            return;
        }

        // Replace invoices array with filtered
        invoices.length = 0;
        invoices.push(...newInvoices);
    }

    // ── Insert in batches of 100 ──
    const BATCH_SIZE = 100;
    let inserted = 0;
    let failed = 0;

    for (let i = 0; i < invoices.length; i += BATCH_SIZE) {
        const batch = invoices.slice(i, i + BATCH_SIZE);
        const { data: result, error: insertErr } = await supabase
            .from("invoices")
            .insert(batch)
            .select("id");

        if (insertErr) {
            console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, insertErr.message);
            // Try one by one for this batch
            for (const inv of batch) {
                const { error: singleErr } = await supabase
                    .from("invoices")
                    .insert([inv]);
                if (singleErr) {
                    console.error(`   ❌ Row failed: ${inv.provider_code} | ${inv.invoice_number} | ${singleErr.message}`);
                    failed++;
                } else {
                    inserted++;
                }
            }
        } else {
            inserted += batch.length;
            console.log(`   ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} rows inserted`);
        }
    }

    console.log(`\n🎉 Import complete!`);
    console.log(`   ✅ Inserted: ${inserted}`);
    if (failed > 0) console.log(`   ❌ Failed: ${failed}`);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
