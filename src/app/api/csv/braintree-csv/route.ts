import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * API para upload de CSV Braintree (Transaction Search Export)
 *
 * Aceita CSVs com ~120 colunas exportados do painel Braintree.
 * Grava na csv_rows com source "braintree-api-revenue" e "braintree-api-fees",
 * mantendo compatibilidade total com a reconciliação existente.
 *
 * POST /api/csv/braintree-csv
 * Body: FormData com campo "file" (CSV)
 */

// ============================================================
// Utilitários
// ============================================================

/** Parse CSV line respeitando aspas duplas */
function parseCSVLine(line: string, separator: string): string[] {
    const result: string[] = [];
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

/** Auto-detect separator */
function detectSeparator(firstLine: string): string {
    const counts: Record<string, number> = {
        ",": (firstLine.match(/,/g) || []).length,
        ";": (firstLine.match(/;/g) || []).length,
        "\t": (firstLine.match(/\t/g) || []).length,
    };
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** Encontra índice de coluna case-insensitive */
function findCol(headers: string[], ...alternatives: string[]): number {
    const h = headers.map((c) => c.toLowerCase().trim());
    for (const alt of alternatives) {
        const idx = h.findIndex((c) => c === alt.toLowerCase());
        if (idx !== -1) return idx;
    }
    // Fallback: partial match
    for (const alt of alternatives) {
        const idx = h.findIndex((c) => c.includes(alt.toLowerCase()));
        if (idx !== -1) return idx;
    }
    return -1;
}

/** Parse data MM/DD/YYYY HH:MM:SS → YYYY-MM-DD */
function parseBraintreeDate(dateStr: string | null | undefined): string | null {
    if (!dateStr || dateStr === "" || dateStr === "-" || dateStr === "N/A") return null;
    const trimmed = dateStr.toString().trim();

    // ISO: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.substring(0, 10);
    }

    // US format: MM/DD/YYYY HH:MM:SS or MM/DD/YYYY
    const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (usMatch) {
        const month = usMatch[1].padStart(2, "0");
        const day = usMatch[2].padStart(2, "0");
        const year = usMatch[3];
        return `${year}-${month}-${day}`;
    }

    // Fallback: try JS Date
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
    }

    return null;
}

/** Parse número (formato americano: "1,234.56" ou "650.00") */
function parseAmount(val: string | null | undefined): number {
    if (!val || val === "" || val === "-" || val === "N/A") return 0;
    const cleaned = val.toString().trim().replace(/,/g, "");
    return parseFloat(cleaned) || 0;
}

/** Detecta moeda pelo merchant account */
function detectCurrency(merchantAccount: string, currencyIso: string): string {
    if (currencyIso) return currencyIso.toUpperCase();
    const ma = (merchantAccount || "").toLowerCase();
    if (ma.includes("eur")) return "EUR";
    if (ma.includes("usd")) return "USD";
    if (ma.includes("gbp")) return "GBP";
    if (ma.includes("aud")) return "AUD";
    return "EUR"; // default
}

// ============================================================
// POST Handler
// ============================================================

export async function POST(request: NextRequest) {
    try {
        console.log("🚀 [Braintree CSV] Iniciando processamento...");

        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json(
                { success: false, error: "Nenhum arquivo foi enviado" },
                { status: 400 }
            );
        }

        const validExtensions = [".csv", ".txt"];
        const hasValidExtension = validExtensions.some((ext) =>
            file.name.toLowerCase().endsWith(ext)
        );

        if (!hasValidExtension) {
            return NextResponse.json(
                { success: false, error: "Formato inválido. Envie um ficheiro CSV exportado do Braintree." },
                { status: 400 }
            );
        }

        console.log("📁 Arquivo:", file.name, "| Tamanho:", file.size, "bytes");

        const text = await file.text();
        const lines = text.split("\n").filter((l) => l.trim());

        if (lines.length < 2) {
            return NextResponse.json(
                { success: false, error: "Ficheiro vazio ou sem dados." },
                { status: 400 }
            );
        }

        // Detect separator and parse headers
        const sep = detectSeparator(lines[0]);
        const headers = parseCSVLine(lines[0], sep);

        console.log(`📏 Linhas de dados: ${lines.length - 1}`);
        console.log(`🔤 Separador: "${sep === "\t" ? "TAB" : sep}"`);
        console.log(`📋 Colunas: ${headers.length}`);

        // Validar que é um CSV Braintree (deve ter Transaction ID)
        const transactionIdCol = findCol(headers, "transaction id");
        if (transactionIdCol === -1) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Formato não reconhecido. O CSV deve conter a coluna "Transaction ID". Exporte via Braintree → Transaction Search.',
                },
                { status: 400 }
            );
        }

        // Mapear colunas
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

        console.log("🗺️ Mapeamento de colunas principais:");
        console.log("  Transaction ID:", colIndex.transactionId);
        console.log("  Settlement Date:", colIndex.settlementDate);
        console.log("  Disbursement Date:", colIndex.disbursementDate);
        console.log("  Merchant Account:", colIndex.merchantAccount);
        console.log("  Amount Submitted:", colIndex.amountSubmitted);
        console.log("  Settlement Batch ID:", colIndex.settlementBatchId);
        console.log("  Order ID:", colIndex.orderId);
        console.log("  Customer Email:", colIndex.customerEmail);

        // Processar linhas
        const revenueRows: any[] = [];
        const feeRows: any[] = [];
        const stats = {
            total: 0,
            skipped: 0,
            declined: 0,
            noAmount: 0,
            noDate: 0,
            byCurrency: {} as Record<string, { count: number; amount: number }>,
        };

        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i], sep);
            if (cols.length < 3) continue;
            stats.total++;

            const getValue = (idx: number): string | null => {
                return idx >= 0 && idx < cols.length && cols[idx] !== "" ? cols[idx] : null;
            };

            // Extract fields
            const transactionId = getValue(colIndex.transactionId) || `csv-import-${i}-${Date.now()}`;
            const transactionStatus = (getValue(colIndex.transactionStatus) || "").toLowerCase();
            const transactionType = (getValue(colIndex.transactionType) || "sale").toLowerCase();

            // Skip declined/voided/failed
            if (["voided", "failed", "gateway_rejected", "processor_declined"].includes(transactionStatus)) {
                stats.declined++;
                stats.skipped++;
                continue;
            }

            // Amount: prefer "Amount Submitted For Settlement", fallback to "Amount Authorized"
            const rawAmount = getValue(colIndex.amountSubmitted) || getValue(colIndex.amountAuthorized);
            const amount = parseAmount(rawAmount);

            if (!amount || amount <= 0) {
                stats.noAmount++;
                stats.skipped++;
                continue;
            }

            // Date: prefer settlement date, fallback to created datetime
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

            // Payment info
            const cardType = getValue(colIndex.cardType);
            const paymentMethod = getValue(colIndex.paymentInstrumentType) || cardType || "Unknown";

            // Settlement data
            const settlementAmount = parseAmount(getValue(colIndex.settlementAmount)) || amount;
            const settlementCurrency = getValue(colIndex.settlementCurrencyIso) || currency;
            const settlementExchangeRate = parseAmount(getValue(colIndex.settlementCurrencyExchangeRate)) || (settlementCurrency === currency ? 1.0 : null);
            const settlementBatchId = getValue(colIndex.settlementBatchId);

            // Order / Subscription
            const orderId = getValue(colIndex.orderId);
            const subscriptionId = getValue(colIndex.subscriptionId);

            // Service Fee
            const serviceFee = parseAmount(getValue(colIndex.serviceFee));

            // Track stats
            if (!stats.byCurrency[currency]) {
                stats.byCurrency[currency] = { count: 0, amount: 0 };
            }
            stats.byCurrency[currency].count++;
            stats.byCurrency[currency].amount += amount;

            // Build revenue row (formato braintree-api-revenue)
            const rowId = `braintree-rev-${currency.toLowerCase()}-${transactionId}`;
            revenueRows.push({
                id: rowId,
                file_name: `braintree-csv-${file.name}`,
                source: "braintree-api-revenue",
                date: date,
                description: `${customerName} - ${paymentMethod}`,
                amount: amount.toString(),
                reconciled: false,
                customer_email: customerEmail,
                customer_name: customerName,
                custom_data: {
                    transaction_id: transactionId,
                    subscription_id: subscriptionId || null,
                    order_id: orderId || null,
                    status: transactionStatus || "settled",
                    type: transactionType,
                    currency: currency,
                    customer_id: null,
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
                    settlement_amount: settlementAmount,
                    settlement_currency: settlementCurrency,
                    settlement_currency_iso_code: settlementCurrency,
                    settlement_currency_exchange_rate: settlementExchangeRate,
                    settlement_date: settlementDate || null,
                    settlement_batch_id: settlementBatchId || null,
                    disbursement_id: settlementBatchId || null,
                    status_history: [],
                    country_of_issuance: getValue(colIndex.countryOfIssuance) || null,
                    issuing_bank: getValue(colIndex.issuingBank) || null,
                    // Import metadata
                    _imported: true,
                    _import_source: file.name,
                    _import_date: new Date().toISOString(),
                    _import_method: "csv-upload",
                },
            });

            // Build fee row if service fee exists
            if (serviceFee && serviceFee > 0) {
                feeRows.push({
                    id: `braintree-fee-${currency.toLowerCase()}-${transactionId}`,
                    file_name: `braintree-csv-${file.name}`,
                    source: "braintree-api-fees",
                    date: date,
                    description: `Fee Braintree - ${transactionId}`,
                    amount: (-serviceFee).toString(),
                    reconciled: false,
                    custom_data: {
                        transaction_id: transactionId,
                        related_revenue_amount: amount.toString(),
                        fee_type: "service_fee",
                        currency: currency,
                        _imported: true,
                        _import_source: file.name,
                    },
                });
            }
        }

        console.log("\n═══════════════════════════════════════════════════");
        console.log("📊 RESUMO — Braintree CSV Upload");
        console.log("═══════════════════════════════════════════════════");
        console.log(`   Total linhas: ${stats.total}`);
        console.log(`   Revenue rows: ${revenueRows.length}`);
        console.log(`   Fee rows: ${feeRows.length}`);
        console.log(`   Declined/Skip: ${stats.declined}`);
        console.log(`   Sem amount: ${stats.noAmount}`);
        console.log(`   Sem data: ${stats.noDate}`);

        for (const [cur, data] of Object.entries(stats.byCurrency)) {
            console.log(`   ${cur}: ${data.count} transações → ${cur} ${data.amount.toFixed(2)}`);
        }

        if (revenueRows.length === 0) {
            return NextResponse.json(
                { success: false, error: "Nenhuma transação válida encontrada no CSV." },
                { status: 400 }
            );
        }

        // Deduplicação: verificar existentes por transaction_id
        const transactionIds = revenueRows.map((r) => r.id);
        const { data: existingRows } = await supabaseAdmin
            .from("csv_rows")
            .select("id")
            .in("id", transactionIds.slice(0, 1000)); // Supabase limit

        const existingIds = new Set((existingRows || []).map((r: any) => r.id));
        const newRevenueRows = revenueRows.filter((r) => !existingIds.has(r.id));
        const duplicateCount = revenueRows.length - newRevenueRows.length;

        console.log(`\n🔍 Duplicatas: ${duplicateCount} | Novas: ${newRevenueRows.length}`);

        // Insert em batches
        const BATCH_SIZE = 500;
        let insertedRevenue = 0;
        let insertedFees = 0;

        for (let i = 0; i < newRevenueRows.length; i += BATCH_SIZE) {
            const batch = newRevenueRows.slice(i, i + BATCH_SIZE);
            const { error } = await supabaseAdmin
                .from("csv_rows")
                .upsert(batch, { onConflict: "id" });

            if (error) {
                console.error(`❌ Erro batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
                continue;
            }
            insertedRevenue += batch.length;
        }

        // Insert fees
        const newFeeIds = new Set(newRevenueRows.map((r) => r.custom_data.transaction_id));
        const newFeeRows = feeRows.filter((r) => newFeeIds.has(r.custom_data.transaction_id));

        for (let i = 0; i < newFeeRows.length; i += BATCH_SIZE) {
            const batch = newFeeRows.slice(i, i + BATCH_SIZE);
            const { error } = await supabaseAdmin
                .from("csv_rows")
                .upsert(batch, { onConflict: "id" });

            if (error) {
                console.error(`❌ Erro fees batch:`, error.message);
                continue;
            }
            insertedFees += batch.length;
        }

        // Save raw file to storage
        const storagePath = `braintree-csv/${Date.now()}-${file.name}`;
        const arrayBuffer = await file.arrayBuffer();
        await supabaseAdmin.storage
            .from("csv_files")
            .upload(storagePath, arrayBuffer, { contentType: "text/csv", upsert: false })
            .catch((e) => console.warn("⚠️ Storage:", e.message));

        console.log(`\n✅ Importação concluída! Revenue: ${insertedRevenue} | Fees: ${insertedFees}`);

        // Build summary per currency
        const currencySummary = Object.entries(stats.byCurrency).map(([currency, data]) => ({
            currency,
            count: data.count,
            total: data.amount,
        }));

        // Count rows with order_id for reconciliation readiness
        const withOrderId = revenueRows.filter((r) => r.custom_data.order_id).length;
        const withDisbursement = revenueRows.filter((r) => r.custom_data.disbursement_date).length;

        return NextResponse.json({
            success: true,
            message: `${insertedRevenue} transações importadas com sucesso!`,
            data: {
                rowCount: insertedRevenue,
                feeCount: insertedFees,
                duplicateCount,
                fileName: file.name,
                storagePath,
                summary: {
                    totalProcessed: stats.total,
                    totalValid: revenueRows.length,
                    totalInserted: insertedRevenue,
                    totalDuplicated: duplicateCount,
                    totalDeclined: stats.declined,
                    totalSkippedNoAmount: stats.noAmount,
                    totalSkippedNoDate: stats.noDate,
                    totalFees: insertedFees,
                    byCurrency: currencySummary,
                    withOrderId,
                    withDisbursement,
                    withoutOrderId: revenueRows.length - withOrderId,
                    withoutDisbursement: revenueRows.length - withDisbursement,
                },
            },
        });
    } catch (error) {
        console.error("\n❌ ERRO GERAL:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Erro desconhecido ao processar arquivo",
            },
            { status: 500 }
        );
    }
}
