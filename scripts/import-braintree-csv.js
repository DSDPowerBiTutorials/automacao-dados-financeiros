#!/usr/bin/env node
/**
 * Import Braintree Transaction Search CSV into csv_rows table.
 * Uses the same logic as /api/csv/braintree-csv but runs standalone.
 *
 * Usage: node scripts/import-braintree-csv.js <path-to-csv>
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// ============================================================
// Config
// ============================================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const CSV_PATH = process.argv[2];
if (!CSV_PATH) {
    console.error("Usage: node scripts/import-braintree-csv.js <path-to-csv>");
    process.exit(1);
}

const FILE_NAME = path.basename(CSV_PATH);
const BATCH_SIZE = 500;

// ============================================================
// Utilities (mirror the API route logic)
// ============================================================

function parseCSVLine(line, separator) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === separator && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function detectSeparator(firstLine) {
    const counts = {
        ",": (firstLine.match(/,/g) || []).length,
        ";": (firstLine.match(/;/g) || []).length,
        "\t": (firstLine.match(/\t/g) || []).length,
    };
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function findCol(headers, ...alternatives) {
    const h = headers.map((c) => c.toLowerCase().trim());
    for (const alt of alternatives) {
        const idx = h.findIndex((c) => c === alt.toLowerCase());
        if (idx !== -1) return idx;
    }
    for (const alt of alternatives) {
        const idx = h.findIndex((c) => c.includes(alt.toLowerCase()));
        if (idx !== -1) return idx;
    }
    return -1;
}

function parseBraintreeDate(dateStr) {
    if (!dateStr || dateStr === "" || dateStr === "-" || dateStr === "N/A") return null;
    const trimmed = dateStr.toString().trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.substring(0, 10);
    const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (usMatch) {
        return `${usMatch[3]}-${usMatch[1].padStart(2, "0")}-${usMatch[2].padStart(2, "0")}`;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    return null;
}

function parseAmount(val) {
    if (!val || val === "" || val === "-" || val === "N/A") return 0;
    const cleaned = val.toString().trim().replace(/,/g, "");
    return parseFloat(cleaned) || 0;
}

function detectCurrency(merchantAccount, currencyIso) {
    if (currencyIso) return currencyIso.toUpperCase();
    const ma = (merchantAccount || "").toLowerCase();
    if (ma.includes("eur")) return "EUR";
    if (ma.includes("usd")) return "USD";
    if (ma.includes("gbp")) return "GBP";
    if (ma.includes("aud")) return "AUD";
    return "EUR";
}

// ============================================================
// Main
// ============================================================

async function main() {
    console.log("═══════════════════════════════════════════════════");
    console.log("🚀 Braintree CSV Import — Standalone Script");
    console.log("═══════════════════════════════════════════════════");
    console.log(`📁 Arquivo: ${FILE_NAME}`);

    const text = fs.readFileSync(CSV_PATH, "utf-8");
    const lines = text.split("\n").filter((l) => l.trim());

    if (lines.length < 2) {
        console.error("❌ Ficheiro vazio.");
        process.exit(1);
    }

    const sep = detectSeparator(lines[0]);
    const headers = parseCSVLine(lines[0], sep);

    console.log(`📏 Linhas de dados: ${lines.length - 1}`);
    console.log(`🔤 Separador: "${sep === "\t" ? "TAB" : sep}"`);
    console.log(`📋 Colunas: ${headers.length}`);

    const transactionIdCol = findCol(headers, "transaction id");
    if (transactionIdCol === -1) {
        console.error('❌ CSV inválido — coluna "Transaction ID" não encontrada.');
        process.exit(1);
    }

    // Map columns
    const colIndex = {
        transactionId: transactionIdCol,
        subscriptionId: findCol(headers, "subscription id"),
        transactionType: findCol(headers, "transaction type"),
        transactionStatus: findCol(headers, "transaction status"),
        createdDatetime: findCol(headers, "created datetime"),
        createdTimezone: findCol(headers, "created timezone"),
        settlementDate: findCol(headers, "settlement date"),
        disbursementDate: findCol(headers, "disbursement date"),
        merchantAccount: findCol(headers, "merchant account"),
        currencyIsoCode: findCol(headers, "currency iso code"),
        amountAuthorized: findCol(headers, "amount authorized"),
        amountSubmitted: findCol(headers, "amount submitted for settlement"),
        serviceFee: findCol(headers, "service fee"),
        orderId: findCol(headers, "order id"),
        cardType: findCol(headers, "card type"),
        paymentInstrumentType: findCol(headers, "payment instrument type"),
        cardholderName: findCol(headers, "cardholder name"),
        customerFirstName: findCol(headers, "customer first name"),
        customerLastName: findCol(headers, "customer last name"),
        customerCompany: findCol(headers, "customer company"),
        customerEmail: findCol(headers, "customer email"),
        customerID: findCol(headers, "customer id"),
        settlementAmount: findCol(headers, "settlement amount"),
        settlementCurrencyIso: findCol(headers, "settlement currency iso code"),
        settlementCurrencyExchangeRate: findCol(headers, "settlement currency exchange rate"),
        settlementBatchId: findCol(headers, "settlement batch id"),
        countryOfIssuance: findCol(headers, "country of issuance"),
        issuingBank: findCol(headers, "issuing bank"),
        billingCompany: findCol(headers, "billing company"),
        billingCity: findCol(headers, "billing city (locality)"),
        billingCountry: findCol(headers, "billing country"),
        refundedTransactionId: findCol(headers, "refunded transaction id"),
        descriptorName: findCol(headers, "descriptor name"),
    };

    console.log("\n🗺️ Mapeamento de colunas:");
    console.log("  Transaction ID:", colIndex.transactionId);
    console.log("  Settlement Date:", colIndex.settlementDate);
    console.log("  Disbursement Date:", colIndex.disbursementDate);
    console.log("  Merchant Account:", colIndex.merchantAccount);
    console.log("  Amount Submitted:", colIndex.amountSubmitted);
    console.log("  Settlement Batch ID:", colIndex.settlementBatchId);
    console.log("  Order ID:", colIndex.orderId);
    console.log("  Customer Email:", colIndex.customerEmail);

    // Process rows
    const revenueRows = [];
    const feeRows = [];
    const stats = {
        total: 0,
        skipped: 0,
        declined: 0,
        noAmount: 0,
        noDate: 0,
        credits: 0,
        byCurrency: {},
    };

    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i], sep);
        if (cols.length < 3) continue;
        stats.total++;

        const getValue = (idx) => (idx >= 0 && idx < cols.length && cols[idx] !== "" ? cols[idx] : null);

        const transactionId = getValue(colIndex.transactionId) || `csv-import-${i}-${Date.now()}`;
        const transactionStatus = (getValue(colIndex.transactionStatus) || "").toLowerCase();
        const transactionType = (getValue(colIndex.transactionType) || "sale").toLowerCase();

        // Skip declined/voided/failed/gateway_rejected
        if (["voided", "failed", "gateway_rejected", "processor_declined"].includes(transactionStatus)) {
            stats.declined++;
            stats.skipped++;
            continue;
        }

        // Amount
        const rawAmount = getValue(colIndex.amountSubmitted) || getValue(colIndex.amountAuthorized);
        let amount = parseAmount(rawAmount);

        if (!amount || amount <= 0) {
            // For credits (refunds), amount may still be positive in CSV, but type is "credit"
            if (transactionType === "credit" && amount === 0) {
                stats.noAmount++;
                stats.skipped++;
                continue;
            }
        }

        // For credit/refund transactions, make amount negative
        if (transactionType === "credit") {
            amount = -Math.abs(amount);
            stats.credits++;
        }

        if (amount === 0) {
            stats.noAmount++;
            stats.skipped++;
            continue;
        }

        // Date
        const settlementDateStr = getValue(colIndex.settlementDate);
        const createdDatetimeStr = getValue(colIndex.createdDatetime);
        const disbursementDateStr = getValue(colIndex.disbursementDate);

        const settlementDate = parseBraintreeDate(settlementDateStr);
        const createdDate = parseBraintreeDate(createdDatetimeStr);
        const disbursementDate = parseBraintreeDate(disbursementDateStr);
        const date = settlementDate || createdDate;

        if (!date) {
            stats.noDate++;
            stats.skipped++;
            continue;
        }

        // Currency / Merchant Account
        const merchantAccount = getValue(colIndex.merchantAccount) || "unknown";
        const currencyIso = getValue(colIndex.currencyIsoCode) || "";
        const currency = detectCurrency(merchantAccount, currencyIso);

        // Customer info
        const firstName = getValue(colIndex.customerFirstName) || "";
        const lastName = getValue(colIndex.customerLastName) || "";
        const customerName = `${firstName} ${lastName}`.trim() || getValue(colIndex.cardholderName) || "Braintree Customer";
        const customerEmail = getValue(colIndex.customerEmail);
        const customerCompany = getValue(colIndex.customerCompany) || getValue(colIndex.billingCompany);
        const customerId = getValue(colIndex.customerID);

        // Payment info
        const cardType = getValue(colIndex.cardType);
        const paymentMethod = getValue(colIndex.paymentInstrumentType) || cardType || "Unknown";

        // Settlement data
        const settlementAmount = parseAmount(getValue(colIndex.settlementAmount)) || Math.abs(amount);
        const settlementCurrency = getValue(colIndex.settlementCurrencyIso) || currency;
        const settlementExchangeRate = parseAmount(getValue(colIndex.settlementCurrencyExchangeRate)) || (settlementCurrency === currency ? 1.0 : null);
        const settlementBatchId = getValue(colIndex.settlementBatchId);

        // Order / Subscription
        const orderId = getValue(colIndex.orderId);
        const subscriptionId = getValue(colIndex.subscriptionId);

        // Service Fee
        const serviceFee = parseAmount(getValue(colIndex.serviceFee));

        // Refund info
        const refundedTransactionId = getValue(colIndex.refundedTransactionId);

        // Track stats
        if (!stats.byCurrency[currency]) stats.byCurrency[currency] = { count: 0, amount: 0, credits: 0 };
        stats.byCurrency[currency].count++;
        stats.byCurrency[currency].amount += amount;
        if (transactionType === "credit") stats.byCurrency[currency].credits++;

        // Build revenue row
        const rowId = `braintree-rev-${currency.toLowerCase()}-${transactionId}`;
        revenueRows.push({
            id: rowId,
            file_name: `braintree-csv-${FILE_NAME}`,
            source: "braintree-api-revenue",
            date: date,
            description: `${customerName} - ${paymentMethod}${transactionType === "credit" ? " (Refund)" : ""}`,
            amount: amount.toString(),
            currency: currency,
            category: transactionType === "credit" ? "Refund" : "Revenue",
            reconciled: false,
            customer_email: customerEmail,
            customer_name: customerName,
            external_id: transactionId,
            payment_method: paymentMethod,
            custom_data: {
                transaction_id: transactionId,
                subscription_id: subscriptionId || null,
                order_id: orderId || null,
                status: transactionStatus || "settled",
                type: transactionType,
                currency: currency,
                customer_id: customerId || null,
                customer_name: customerName,
                customer_email: customerEmail,
                billing_name: getValue(colIndex.cardholderName) || customerName,
                company_name: customerCompany || null,
                payment_method: paymentMethod,
                card_type: cardType,
                merchant_account_id: merchantAccount,
                created_at: createdDate ? `${createdDate}T00:00:00.000Z` : null,
                updated_at: new Date().toISOString(),
                disbursement_date: disbursementDate || null,
                settlement_amount: transactionType === "credit" ? -settlementAmount : settlementAmount,
                settlement_currency: settlementCurrency,
                settlement_currency_iso_code: settlementCurrency,
                settlement_currency_exchange_rate: settlementExchangeRate,
                settlement_date: settlementDate || null,
                settlement_batch_id: settlementBatchId || null,
                disbursement_id: settlementBatchId || null,
                refunded_transaction_id: refundedTransactionId || null,
                status_history: [],
                country_of_issuance: getValue(colIndex.countryOfIssuance) || null,
                issuing_bank: getValue(colIndex.issuingBank) || null,
                _imported: true,
                _import_source: FILE_NAME,
                _import_date: new Date().toISOString(),
                _import_method: "csv-upload-script",
            },
        });

        // Fee row
        if (serviceFee && serviceFee > 0) {
            feeRows.push({
                id: `braintree-fee-${currency.toLowerCase()}-${transactionId}`,
                file_name: `braintree-csv-${FILE_NAME}`,
                source: "braintree-api-fees",
                date: date,
                description: `Fee Braintree - ${transactionId}`,
                amount: (-serviceFee).toString(),
                currency: currency,
                category: "Fee",
                reconciled: false,
                external_id: `fee-${transactionId}`,
                custom_data: {
                    transaction_id: transactionId,
                    related_revenue_amount: amount.toString(),
                    fee_type: "service_fee",
                    currency: currency,
                    merchant_account_id: merchantAccount,
                    _imported: true,
                    _import_source: FILE_NAME,
                },
            });
        }
    }

    // Summary
    console.log("\n═══════════════════════════════════════════════════");
    console.log("📊 RESUMO DO PROCESSAMENTO");
    console.log("═══════════════════════════════════════════════════");
    console.log(`  Total linhas processadas: ${stats.total}`);
    console.log(`  Revenue rows (válidos): ${revenueRows.length}`);
    console.log(`  Fee rows: ${feeRows.length}`);
    console.log(`  Declined/gateway rejected: ${stats.declined}`);
    console.log(`  Credits/Refunds: ${stats.credits}`);
    console.log(`  Sem amount: ${stats.noAmount}`);
    console.log(`  Sem data: ${stats.noDate}`);

    for (const [cur, data] of Object.entries(stats.byCurrency)) {
        console.log(`  ${cur}: ${data.count} transações | Total: ${cur} ${data.amount.toFixed(2)} | Refunds: ${data.credits}`);
    }

    if (revenueRows.length === 0) {
        console.error("\n❌ Nenhuma transação válida encontrada.");
        process.exit(1);
    }

    // Deduplication check — query existing IDs in batches
    console.log("\n🔍 Verificando duplicatas...");
    const existingIds = new Set();
    const allIds = revenueRows.map((r) => r.id);

    for (let i = 0; i < allIds.length; i += 1000) {
        const batch = allIds.slice(i, i + 1000);
        const { data: existing } = await supabase
            .from("csv_rows")
            .select("id")
            .in("id", batch);
        if (existing) existing.forEach((r) => existingIds.add(r.id));
    }

    const newRevenueRows = revenueRows.filter((r) => !existingIds.has(r.id));
    const duplicateCount = revenueRows.length - newRevenueRows.length;

    console.log(`  Já existentes (duplicatas): ${duplicateCount}`);
    console.log(`  Novas a inserir: ${newRevenueRows.length}`);

    if (newRevenueRows.length === 0) {
        console.log("\n✅ Todas as transações já existem no sistema. Nada a fazer.");
        process.exit(0);
    }

    // Insert revenue rows in batches
    console.log("\n📤 Inserindo revenue rows...");
    let insertedRevenue = 0;
    let errors = 0;

    for (let i = 0; i < newRevenueRows.length; i += BATCH_SIZE) {
        const batch = newRevenueRows.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(newRevenueRows.length / BATCH_SIZE);

        const { error } = await supabase
            .from("csv_rows")
            .upsert(batch, { onConflict: "id" });

        if (error) {
            console.error(`  ❌ Batch ${batchNum}/${totalBatches}: ${error.message}`);
            errors++;
            // Try one-by-one for failed batch
            for (const row of batch) {
                const { error: singleError } = await supabase
                    .from("csv_rows")
                    .upsert([row], { onConflict: "id" });
                if (!singleError) insertedRevenue++;
                else console.error(`    ❌ Row ${row.id}: ${singleError.message}`);
            }
        } else {
            insertedRevenue += batch.length;
            console.log(`  ✅ Batch ${batchNum}/${totalBatches}: ${batch.length} rows`);
        }
    }

    // Insert fee rows
    let insertedFees = 0;
    const newTransactionIds = new Set(newRevenueRows.map((r) => r.custom_data.transaction_id));
    const newFeeRows = feeRows.filter((r) => newTransactionIds.has(r.custom_data.transaction_id));

    if (newFeeRows.length > 0) {
        console.log(`\n📤 Inserindo ${newFeeRows.length} fee rows...`);
        for (let i = 0; i < newFeeRows.length; i += BATCH_SIZE) {
            const batch = newFeeRows.slice(i, i + BATCH_SIZE);
            const { error } = await supabase
                .from("csv_rows")
                .upsert(batch, { onConflict: "id" });
            if (error) {
                console.error(`  ❌ Fee batch: ${error.message}`);
            } else {
                insertedFees += batch.length;
            }
        }
    }

    // Final summary
    console.log("\n═══════════════════════════════════════════════════");
    console.log("✅ IMPORTAÇÃO CONCLUÍDA");
    console.log("═══════════════════════════════════════════════════");
    console.log(`  Revenue rows inseridos: ${insertedRevenue}`);
    console.log(`  Fee rows inseridos: ${insertedFees}`);
    console.log(`  Duplicatas ignoradas: ${duplicateCount}`);
    console.log(`  Erros: ${errors}`);

    // Reconciliation readiness
    const withOrderId = newRevenueRows.filter((r) => r.custom_data.order_id).length;
    const withDisbursement = newRevenueRows.filter((r) => r.custom_data.disbursement_date).length;
    const withSettlementBatch = newRevenueRows.filter((r) => r.custom_data.settlement_batch_id).length;
    const withEmail = newRevenueRows.filter((r) => r.customer_email).length;

    console.log("\n📋 Dados para conciliação:");
    console.log(`  Com Order ID: ${withOrderId}/${newRevenueRows.length}`);
    console.log(`  Com Disbursement Date: ${withDisbursement}/${newRevenueRows.length}`);
    console.log(`  Com Settlement Batch ID: ${withSettlementBatch}/${newRevenueRows.length}`);
    console.log(`  Com Email: ${withEmail}/${newRevenueRows.length}`);

    // Currency breakdown
    console.log("\n💰 Breakdown por moeda:");
    for (const [cur, data] of Object.entries(stats.byCurrency)) {
        const sales = data.count - data.credits;
        console.log(`  ${cur}: ${sales} vendas + ${data.credits} refunds = ${data.count} total | Valor líquido: ${cur} ${data.amount.toFixed(2)}`);
    }
}

main().catch((err) => {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
});
