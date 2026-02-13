#!/usr/bin/env node
/**
 * AP Bulk Reconciliation — One-time script
 * 
 * Reads "accounts payable 2025.xlsx" and cross-references with bank transactions
 * (csv_rows) and AP invoices (invoices table) in Supabase to perform bulk reconciliation.
 *
 * Usage:
 *   node scripts/ap-bulk-reconciliation.js              # dry-run (shows matches, writes nothing)
 *   node scripts/ap-bulk-reconciliation.js --execute     # writes reconciliation to Supabase
 */

const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

// ─── CONFIG ────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EXECUTE = process.argv.includes("--execute");
const DATE_TOLERANCE_DAYS = 3;
const AMOUNT_TOLERANCE = 0.50; // €0.50 tolerance for rounding differences

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── BANK ACCOUNT MAPPING (Excel name → system source) ────────────────
const BANK_MAP = {
    "BANKINTER 4605": "bankinter-eur",
    "bANKINTER 4605": "bankinter-eur",
    "BANKINTER USD 2174": "bankinter-usd",
    "SABADELL 8692": "sabadell",
    "SABADELL 9037": "sabadell",
    "CHASE USD 9186": "chase-usd",
};

// ─── HELPERS ───────────────────────────────────────────────────────────

/** Sørensen-Dice coefficient for fuzzy string matching */
function stringSimilarity(a, b) {
    if (!a || !b) return 0;
    a = a.toLowerCase().trim();
    b = b.toLowerCase().trim();
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const bigrams = new Map();
    for (let i = 0; i < a.length - 1; i++) {
        const bi = a.substring(i, i + 2);
        bigrams.set(bi, (bigrams.get(bi) || 0) + 1);
    }

    let matches = 0;
    for (let i = 0; i < b.length - 1; i++) {
        const bi = b.substring(i, i + 2);
        const count = bigrams.get(bi) || 0;
        if (count > 0) {
            bigrams.set(bi, count - 1);
            matches++;
        }
    }

    return (2 * matches) / (a.length - 1 + b.length - 1);
}

/** Noise words to remove before comparing supplier names */
const NOISE_WORDS = [
    "recibo", "recib", "transferencia", "pago", "cobro", "ingreso",
    "domiciliacion", "adeudo", "comision", "gastos", "sepa", "swift",
    "transf", "trans", "nómina", "n/ref", "ref", "s.l", "s.l.", "s.a",
    "s.a.", "sl", "sa", "slu", "s.l.u", "s.l.u.",
];

function cleanName(name) {
    if (!name) return "";
    let cleaned = name.toLowerCase().trim();
    for (const w of NOISE_WORDS) {
        cleaned = cleaned.replace(new RegExp(`\\b${w}\\b`, "gi"), "");
    }
    return cleaned.replace(/[^a-záéíóúñüàèìòù0-9\s]/gi, "").replace(/\s+/g, " ").trim();
}

function extractSupplierFromDesc(desc) {
    if (!desc) return "";
    // Bankinter pattern: "Recibo/supplier name" or "Transferencia/supplier"
    const slashIdx = desc.indexOf("/");
    if (slashIdx >= 0 && slashIdx < desc.length - 1) {
        return desc.substring(slashIdx + 1).trim();
    }
    return desc;
}

function daysDiff(d1, d2) {
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    return Math.abs(t1 - t2) / (1000 * 60 * 60 * 24);
}

function formatDate(d) {
    if (!d) return "N/A";
    return new Date(d).toISOString().split("T")[0];
}

// ─── MAIN ──────────────────────────────────────────────────────────────

async function main() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  AP BULK RECONCILIATION" + (EXECUTE ? " [EXECUTE MODE]" : " [DRY-RUN]"));
    console.log("═══════════════════════════════════════════════════════════\n");

    // 1) Read Excel
    const xlsxPath = path.resolve(__dirname, "../public/accounts payable 2025.xlsx");
    console.log(`📂 Reading: ${xlsxPath}`);
    const workbook = XLSX.readFile(xlsxPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: "yyyy-mm-dd" });

    // Headers are in row index 1 (0-based), data starts at row index 2
    const headers = allRows[1];
    console.log(`📊 Total rows in Excel: ${allRows.length - 2}\n`);

    // Build column index map
    const colIdx = {};
    const COL_NAMES = {
        "Input Date": "inputDate", "Invoice Date": "invoiceDate", "Benefit Date": "benefitDate",
        "Due Date": "dueDate", "Schedule Date": "scheduleDate", "Payment Date": "paymentDate",
        "Bank Account": "bankAccount", "Payment Amount": "paymentAmount", "Payment Currency": "paymentCurrency",
        "Status": "status", "Invoice Nº": "invoiceNo", "Provider ": "provider", "Provider": "provider",
        "Description": "description", "Invoice Amount": "invoiceAmount", "Invoice Currency": "invoiceCurrency",
        "Finantial Account": "financialAccount",
    };
    headers.forEach((h, i) => {
        const key = COL_NAMES[h];
        if (key && !colIdx[key]) colIdx[key] = i;
    });

    // 2) Parse Excel rows — filter to Paid + bank in system
    const apRows = [];
    for (let i = 2; i < allRows.length; i++) {
        const row = allRows[i];
        if (!row || !row.length) continue;

        const status = (row[colIdx.status] || "").toString().trim();
        const bankRaw = (row[colIdx.bankAccount] || "").toString().trim();
        const source = BANK_MAP[bankRaw];

        if (status !== "Paid" || !source) continue;

        const paymentDateRaw = row[colIdx.paymentDate];
        const amountRaw = row[colIdx.paymentAmount];
        if (!paymentDateRaw || !amountRaw) continue;

        // Parse date — could be Excel serial number or string
        let paymentDate;
        if (typeof paymentDateRaw === "number" || /^\d{5}$/.test(paymentDateRaw)) {
            // Excel serial date
            const serial = parseFloat(paymentDateRaw);
            const epoch = new Date(1899, 11, 30);
            paymentDate = new Date(epoch.getTime() + serial * 86400000);
        } else {
            paymentDate = new Date(paymentDateRaw);
        }
        if (isNaN(paymentDate.getTime())) continue;

        // Parse amount
        let amount = parseFloat(String(amountRaw).replace(/,/g, ""));
        if (isNaN(amount) || amount <= 0) continue;

        apRows.push({
            excelRow: i + 1,
            paymentDate,
            paymentDateStr: formatDate(paymentDate),
            amount,
            currency: (row[colIdx.paymentCurrency] || "EUR").toString().trim(),
            source,
            bankRaw,
            provider: (row[colIdx.provider] || "").toString().trim(),
            invoiceNo: (row[colIdx.invoiceNo] || "").toString().trim(),
            description: (row[colIdx.description] || "").toString().trim(),
            financialAccount: (row[colIdx.financialAccount] || "").toString().trim(),
        });
    }

    console.log(`✅ Parsed ${apRows.length} reconcilable AP rows (Paid + bank in system)`);
    const bySource = {};
    apRows.forEach(r => { bySource[r.source] = (bySource[r.source] || 0) + 1; });
    Object.entries(bySource).forEach(([s, c]) => console.log(`   ${s}: ${c}`));
    console.log();

    // 3) Load unreconciled expense bank transactions from Supabase
    console.log("📡 Loading unreconciled expense bank transactions from Supabase...");
    const sources = [...new Set(apRows.map(r => r.source))];
    const allBankTxs = [];

    for (const src of sources) {
        let from = 0;
        const PAGE = 1000;
        while (true) {
            const { data, error } = await supabase
                .from("csv_rows")
                .select("id, date, description, amount, source, reconciled, custom_data")
                .eq("source", src)
                .eq("reconciled", false)
                .lt("amount", 0)
                .range(from, from + PAGE - 1);

            if (error) {
                console.error(`   ❌ Error loading ${src}:`, error.message);
                break;
            }
            if (!data || data.length === 0) break;
            allBankTxs.push(...data);
            if (data.length < PAGE) break;
            from += PAGE;
        }
    }

    console.log(`   Loaded ${allBankTxs.length} unreconciled expense transactions`);
    const txBySource = {};
    allBankTxs.forEach(t => { txBySource[t.source] = (txBySource[t.source] || 0) + 1; });
    Object.entries(txBySource).forEach(([s, c]) => console.log(`   ${s}: ${c}`));
    console.log();

    // 4) Load all unreconciled invoices from invoices table
    console.log("📡 Loading unreconciled AP invoices from Supabase...");
    const allInvoices = [];
    let invFrom = 0;
    while (true) {
        const { data, error } = await supabase
            .from("invoices")
            .select("id, invoice_number, provider_code, invoice_amount, paid_amount, currency, schedule_date, payment_date, is_reconciled, invoice_type")
            .eq("is_reconciled", false)
            .range(invFrom, invFrom + 999);

        if (error) {
            console.error("   ❌ Error loading invoices:", error.message);
            break;
        }
        if (!data || data.length === 0) break;
        allInvoices.push(...data);
        if (data.length < 1000) break;
        invFrom += 1000;
    }
    console.log(`   Loaded ${allInvoices.length} unreconciled invoices\n`);

    // 5) Index bank transactions by source for fast lookup
    const txIndex = {};
    for (const tx of allBankTxs) {
        if (!txIndex[tx.source]) txIndex[tx.source] = [];
        txIndex[tx.source].push(tx);
    }

    // 6) Build invoice index by invoice_number for quick lookup
    const invByNumber = {};
    for (const inv of allInvoices) {
        if (inv.invoice_number) {
            const key = inv.invoice_number.toString().toLowerCase().trim();
            if (!invByNumber[key]) invByNumber[key] = [];
            invByNumber[key].push(inv);
        }
    }

    // 7) Match AP rows to bank transactions
    console.log("🔄 Matching AP rows to bank transactions...\n");

    const matched = [];
    const noMatch = [];
    const alreadyUsedTxIds = new Set();
    const alreadyUsedInvIds = new Set();

    // Sort AP rows by amount descending (match larger amounts first to avoid ambiguity)
    apRows.sort((a, b) => b.amount - a.amount);

    for (const ap of apRows) {
        const candidates = (txIndex[ap.source] || []).filter(tx => {
            if (alreadyUsedTxIds.has(tx.id)) return false;

            const txAmount = Math.abs(parseFloat(tx.amount));
            const amountDiff = Math.abs(txAmount - ap.amount);
            if (amountDiff > AMOUNT_TOLERANCE) return false;

            const txDate = tx.date ? tx.date.split("T")[0] : "";
            if (!txDate) return false;
            const dd = daysDiff(ap.paymentDate, txDate);
            if (dd > DATE_TOLERANCE_DAYS) return false;

            return true;
        });

        if (candidates.length === 0) {
            noMatch.push(ap);
            continue;
        }

        // Score candidates by: amount closeness + date closeness + name similarity
        let bestCandidate = null;
        let bestScore = -1;

        for (const tx of candidates) {
            const txAmount = Math.abs(parseFloat(tx.amount));
            const amountDiff = Math.abs(txAmount - ap.amount);
            const dateDiff = daysDiff(ap.paymentDate, tx.date);

            // Amount score (0-40): exact = 40, tolerance edge = 0
            const amountScore = 40 * (1 - amountDiff / AMOUNT_TOLERANCE);

            // Date score (0-30): same day = 30, 3 days = 0
            const dateScore = 30 * (1 - dateDiff / DATE_TOLERANCE_DAYS);

            // Name similarity score (0-30)
            const txSupplier = cleanName(extractSupplierFromDesc(tx.description));
            const apProvider = cleanName(ap.provider);
            const nameSim = stringSimilarity(txSupplier, apProvider);
            const nameScore = 30 * nameSim;

            const totalScore = amountScore + dateScore + nameScore;

            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestCandidate = tx;
            }
        }

        if (bestCandidate) {
            alreadyUsedTxIds.add(bestCandidate.id);

            // Check if there's a matching invoice in the invoices table
            let matchedInvoice = null;
            if (ap.invoiceNo) {
                const invKey = ap.invoiceNo.toLowerCase().trim();
                const invCandidates = invByNumber[invKey] || [];
                for (const inv of invCandidates) {
                    if (alreadyUsedInvIds.has(inv.id)) continue;
                    // Match if provider is similar enough or amount is close
                    const invProvider = cleanName(inv.provider_code);
                    const apProviderClean = cleanName(ap.provider);
                    const provSim = stringSimilarity(invProvider, apProviderClean);
                    const invAmount = parseFloat(inv.paid_amount || inv.invoice_amount) || 0;
                    const amtClose = Math.abs(invAmount - ap.amount) < AMOUNT_TOLERANCE;

                    if (provSim >= 0.4 || amtClose) {
                        matchedInvoice = inv;
                        alreadyUsedInvIds.add(inv.id);
                        break;
                    }
                }
            }

            matched.push({
                ap,
                bankTx: bestCandidate,
                score: bestScore,
                invoice: matchedInvoice,
            });
        } else {
            noMatch.push(ap);
        }
    }

    // 8) Report results
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  RESULTS");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`  ✅ Matched:      ${matched.length}`);
    console.log(`     ├ With invoice table match: ${matched.filter(m => m.invoice).length}`);
    console.log(`     └ Without invoice table:    ${matched.filter(m => !m.invoice).length}`);
    console.log(`  ❌ No match:     ${noMatch.length}`);
    console.log(`  📊 Total AP rows: ${apRows.length}`);
    console.log(`  📊 Match rate:   ${(matched.length / apRows.length * 100).toFixed(1)}%\n`);

    // Show match breakdown by bank
    const matchByBank = {};
    matched.forEach(m => { matchByBank[m.ap.source] = (matchByBank[m.ap.source] || 0) + 1; });
    console.log("  Matches by bank:");
    Object.entries(matchByBank).forEach(([s, c]) => console.log(`    ${s}: ${c}`));
    console.log();

    // Show sample of matched rows
    console.log("── Sample Matched (first 15) ──");
    matched.slice(0, 15).forEach((m, i) => {
        const txAmt = Math.abs(parseFloat(m.bankTx.amount)).toFixed(2);
        const txSupplier = extractSupplierFromDesc(m.bankTx.description).substring(0, 30);
        console.log(
            `  ${String(i + 1).padStart(2)}. Excel: ${m.ap.paymentDateStr} | ${m.ap.provider.substring(0, 25).padEnd(25)} | ${m.ap.amount.toFixed(2).padStart(10)} ${m.ap.currency}` +
            `  →  Bank: ${formatDate(m.bankTx.date)} | ${txSupplier.padEnd(30)} | ${txAmt.padStart(10)}` +
            `  [score: ${m.score.toFixed(0)}]` +
            (m.invoice ? `  [INV: ${m.invoice.invoice_number}]` : "")
        );
    });

    // Show sample of unmatched rows
    if (noMatch.length > 0) {
        console.log(`\n── Sample Unmatched (first 15) ──`);
        noMatch.slice(0, 15).forEach((ap, i) => {
            console.log(
                `  ${String(i + 1).padStart(2)}. ${ap.paymentDateStr} | ${ap.provider.substring(0, 30).padEnd(30)} | ${ap.amount.toFixed(2).padStart(10)} ${ap.currency} | Bank: ${ap.source} | InvNo: ${ap.invoiceNo}`
            );
        });
    }

    // 9) Execute if --execute flag
    if (!EXECUTE) {
        console.log("\n═══════════════════════════════════════════════════════════");
        console.log("  DRY-RUN COMPLETE — no changes written.");
        console.log("  Run with --execute to apply reconciliations.");
        console.log("═══════════════════════════════════════════════════════════\n");
        return;
    }

    // EXECUTE MODE
    console.log("\n\n🚀 EXECUTING — Writing reconciliations to Supabase...\n");

    let successCount = 0;
    let errorCount = 0;
    const now = new Date().toISOString();

    // Process in batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < matched.length; i += BATCH_SIZE) {
        const batch = matched.slice(i, i + BATCH_SIZE);
        const progress = `[${Math.min(i + BATCH_SIZE, matched.length)}/${matched.length}]`;

        for (const m of batch) {
            try {
                // Update csv_rows (bank transaction)
                const existingCd = m.bankTx.custom_data || {};
                const { error: txErr } = await supabase
                    .from("csv_rows")
                    .update({
                        reconciled: true,
                        custom_data: {
                            ...existingCd,
                            reconciliationType: "automatic-ap-bulk",
                            reconciled_at: now,
                            matched_provider: m.ap.provider,
                            matched_invoice_number: m.ap.invoiceNo || null,
                            matched_amount: m.ap.amount,
                            matched_payment_date: m.ap.paymentDateStr,
                            ap_excel_source: true,
                            ap_excel_row: m.ap.excelRow,
                            ap_financial_account: m.ap.financialAccount || null,
                            ...(m.invoice ? { matched_invoice_ids: [m.invoice.id] } : {}),
                        },
                    })
                    .eq("id", m.bankTx.id);

                if (txErr) {
                    console.error(`   ❌ csv_rows update failed for tx ${m.bankTx.id}: ${txErr.message}`);
                    errorCount++;
                    continue;
                }

                // Update invoice table match (if exists)
                if (m.invoice) {
                    const { error: invErr } = await supabase
                        .from("invoices")
                        .update({
                            is_reconciled: true,
                            reconciled_transaction_id: m.bankTx.id,
                            reconciled_at: now,
                        })
                        .eq("id", m.invoice.id);

                    if (invErr) {
                        console.error(`   ⚠️ invoice update failed for inv ${m.invoice.id}: ${invErr.message}`);
                        // Don't count as error — csv_rows was updated successfully
                    }
                }

                successCount++;
            } catch (err) {
                console.error(`   ❌ Error processing match: ${err.message}`);
                errorCount++;
            }
        }

        process.stdout.write(`   ${progress} processed... ${successCount} ok, ${errorCount} errors\r`);
    }

    console.log(`\n\n═══════════════════════════════════════════════════════════`);
    console.log(`  EXECUTION COMPLETE`);
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`  ✅ Successfully reconciled: ${successCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📊 Total processed: ${matched.length}`);
    console.log(`═══════════════════════════════════════════════════════════\n`);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
