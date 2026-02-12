#!/usr/bin/env node
/**
 * Repair Braintree CSV-imported rows — adds missing settlement fields to custom_data.
 * 
 * The initial import only stored 12 fields in custom_data.
 * This script re-reads the original CSV and patches each row with the missing fields:
 * settlement_batch_id, disbursement_date, settlement_amount, settlement_currency,
 * settlement_currency_exchange_rate, card_type, country_of_issuance, issuing_bank, etc.
 *
 * Usage: node scripts/repair-braintree-custom-data.js <path-to-csv>
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("❌ Missing env vars"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const CSV_PATH = process.argv[2] || "/tmp/braintree_transactions.csv";
const BATCH_SIZE = 100;

// ============================================================
// CSV Utilities (same as import script)
// ============================================================

function parseCSVLine(line, separator) {
    const result = [];
    let current = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
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
    const counts = { ",": (firstLine.match(/,/g) || []).length, ";": (firstLine.match(/;/g) || []).length, "\t": (firstLine.match(/\t/g) || []).length };
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function findCol(headers, ...alternatives) {
    const h = headers.map(c => c.toLowerCase().trim());
    for (const alt of alternatives) {
        const idx = h.findIndex(c => c === alt.toLowerCase());
        if (idx !== -1) return idx;
    }
    for (const alt of alternatives) {
        const idx = h.findIndex(c => c.includes(alt.toLowerCase()));
        if (idx !== -1) return idx;
    }
    return -1;
}

function parseBraintreeDate(dateStr) {
    if (!dateStr || dateStr === "" || dateStr === "-" || dateStr === "N/A") return null;
    const trimmed = dateStr.toString().trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.substring(0, 10);
    const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (usMatch) return `${usMatch[3]}-${usMatch[1].padStart(2, "0")}-${usMatch[2].padStart(2, "0")}`;
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    return null;
}

function parseAmount(val) {
    if (!val || val === "" || val === "-" || val === "N/A") return 0;
    return parseFloat(val.toString().trim().replace(/,/g, "")) || 0;
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
    console.log("═".repeat(60));
    console.log("  🔧 REPAIR — Braintree custom_data missing fields");
    console.log("═".repeat(60));
    console.log(`📁 CSV: ${CSV_PATH}`);

    const text = fs.readFileSync(CSV_PATH, "utf-8");
    const lines = text.split("\n").filter(l => l.trim());
    const sep = detectSeparator(lines[0]);
    const headers = parseCSVLine(lines[0], sep);

    console.log(`📏 Linhas: ${lines.length - 1} | Colunas: ${headers.length}`);

    const colIndex = {
        transactionId: findCol(headers, "transaction id"),
        subscriptionId: findCol(headers, "subscription id"),
        transactionType: findCol(headers, "transaction type"),
        transactionStatus: findCol(headers, "transaction status"),
        createdDatetime: findCol(headers, "created datetime"),
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
        refundedTransactionId: findCol(headers, "refunded transaction id"),
        descriptorName: findCol(headers, "descriptor name"),
    };

    // Build a map: transactionId → missing fields
    const patches = new Map();
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i], sep);
        if (cols.length < 3) continue;

        const getValue = (idx) => (idx >= 0 && idx < cols.length && cols[idx] !== "" ? cols[idx] : null);

        const transactionId = getValue(colIndex.transactionId);
        if (!transactionId) continue;

        const transactionStatus = (getValue(colIndex.transactionStatus) || "").toLowerCase();
        const transactionType = (getValue(colIndex.transactionType) || "sale").toLowerCase();

        // Skip declined
        if (["voided", "failed", "gateway_rejected", "processor_declined"].includes(transactionStatus)) {
            skipped++;
            continue;
        }

        const rawAmount = getValue(colIndex.amountSubmitted) || getValue(colIndex.amountAuthorized);
        const amount = parseAmount(rawAmount);
        if (!amount || amount <= 0) { skipped++; continue; }

        const merchantAccount = getValue(colIndex.merchantAccount) || "unknown";
        const currencyIso = getValue(colIndex.currencyIsoCode) || "";
        const currency = detectCurrency(merchantAccount, currencyIso);

        // Build the row ID
        const rowId = `braintree-rev-${currency.toLowerCase()}-${transactionId}`;

        // Parse all the settlement fields that were missing
        const settlementDateStr = getValue(colIndex.settlementDate);
        const createdDatetimeStr = getValue(colIndex.createdDatetime);
        const disbursementDateStr = getValue(colIndex.disbursementDate);

        const settlementDate = parseBraintreeDate(settlementDateStr);
        const createdDate = parseBraintreeDate(createdDatetimeStr);
        const disbursementDate = parseBraintreeDate(disbursementDateStr);

        const settlementAmount = parseAmount(getValue(colIndex.settlementAmount)) || Math.abs(amount);
        const settlementCurrency = getValue(colIndex.settlementCurrencyIso) || currency;
        const settlementExchangeRate = parseAmount(getValue(colIndex.settlementCurrencyExchangeRate)) || (settlementCurrency === currency ? 1.0 : null);
        const settlementBatchId = getValue(colIndex.settlementBatchId);
        const cardType = getValue(colIndex.cardType);
        const subscriptionId = getValue(colIndex.subscriptionId);
        const orderId = getValue(colIndex.orderId);
        const refundedTransactionId = getValue(colIndex.refundedTransactionId);
        const countryOfIssuance = getValue(colIndex.countryOfIssuance);
        const issuingBank = getValue(colIndex.issuingBank);
        const paymentMethod = getValue(colIndex.paymentInstrumentType) || cardType || "Unknown";

        // Customer info
        const firstName = getValue(colIndex.customerFirstName) || "";
        const lastName = getValue(colIndex.customerLastName) || "";
        const customerName = `${firstName} ${lastName}`.trim() || getValue(colIndex.cardholderName) || "";
        const customerEmail = getValue(colIndex.customerEmail);
        const customerCompany = getValue(colIndex.customerCompany) || getValue(colIndex.billingCompany);
        const customerId = getValue(colIndex.customerID);

        patches.set(rowId, {
            // These are the fields that were MISSING from the original import
            type: transactionType,
            subscription_id: subscriptionId || null,
            card_type: cardType || null,
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
            country_of_issuance: countryOfIssuance || null,
            issuing_bank: issuingBank || null,
            _imported: true,
            _import_source: path.basename(CSV_PATH),
            _import_date: new Date().toISOString(),
            _import_method: "csv-upload-script",
            _repaired: true,
            _repair_date: new Date().toISOString(),
        });
    }

    console.log(`\n📊 Patches preparados: ${patches.size} | Skipped: ${skipped}`);

    // Now update rows in batches
    const patchEntries = Array.from(patches.entries());
    let updated = 0, errors = 0, notFound = 0;

    for (let i = 0; i < patchEntries.length; i += BATCH_SIZE) {
        const batch = patchEntries.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(patchEntries.length / BATCH_SIZE);

        // Fetch existing custom_data for this batch
        const ids = batch.map(([id]) => id);
        const { data: existing } = await supabase
            .from("csv_rows")
            .select("id, custom_data")
            .in("id", ids);

        if (!existing) {
            console.error(`  ❌ Batch ${batchNum}: fetch failed`);
            errors++;
            continue;
        }

        const existingMap = new Map(existing.map(r => [r.id, r.custom_data || {}]));

        // Prepare updates  
        const updates = [];
        for (const [id, newFields] of batch) {
            const currentData = existingMap.get(id);
            if (!currentData) {
                notFound++;
                continue;
            }
            // Merge: keep existing fields, add new ones (don't overwrite existing non-null values)
            const merged = { ...currentData };
            for (const [key, value] of Object.entries(newFields)) {
                // Only update if the field is missing or null in current data
                if (merged[key] === undefined || merged[key] === null) {
                    merged[key] = value;
                }
            }
            updates.push({ id, custom_data: merged });
        }

        // Execute updates in parallel (20 concurrent)
        const CONCURRENCY = 20;
        for (let j = 0; j < updates.length; j += CONCURRENCY) {
            const chunk = updates.slice(j, j + CONCURRENCY);
            const results = await Promise.allSettled(
                chunk.map(u =>
                    supabase.from("csv_rows").update({ custom_data: u.custom_data }).eq("id", u.id)
                )
            );
            for (const r of results) {
                if (r.status === "fulfilled" && !r.value.error) updated++;
                else errors++;
            }
        }

        if (batchNum % 5 === 0 || batchNum === totalBatches) {
            console.log(`  ✅ Batch ${batchNum}/${totalBatches}: ${updated} updated so far`);
        }
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log(`  ✅ REPAIR CONCLUÍDO`);
    console.log(`${"═".repeat(60)}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Not found: ${notFound}`);
    console.log(`  Errors: ${errors}`);

    // Verify: check a sample
    const { data: verify } = await supabase
        .from("csv_rows")
        .select("id, custom_data")
        .eq("source", "braintree-api-revenue")
        .like("id", "braintree-rev-%")
        .not("custom_data->settlement_batch_id", "is", null)
        .limit(3);

    console.log(`\n📋 Verificação — rows com settlement_batch_id após repair:`);
    verify?.forEach(r => {
        const cd = r.custom_data;
        console.log(`  ${r.id}: batch=${cd.settlement_batch_id} | disb=${cd.disbursement_date} | settl_amt=${cd.settlement_amount} | card=${cd.card_type}`);
    });

    // Count rows now having the critical fields
    const { count: withBatch } = await supabase
        .from("csv_rows").select("id", { count: "exact", head: true })
        .eq("source", "braintree-api-revenue")
        .not("custom_data->settlement_batch_id", "is", null);
    const { count: withDisb } = await supabase
        .from("csv_rows").select("id", { count: "exact", head: true })
        .eq("source", "braintree-api-revenue")
        .not("custom_data->disbursement_date", "is", null);

    console.log(`\n📊 Após repair:`);
    console.log(`  Com settlement_batch_id: ${withBatch}`);
    console.log(`  Com disbursement_date: ${withDisb}`);
}

main().catch(err => {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
});
