import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * API para upload de CSV do Craft Commerce (Web Orders)
 *
 * Aceita CSVs exportados do Craft CMS/Commerce com ~200 colunas.
 * Insere/atualiza na tabela ar_invoices com source "craft-commerce".
 *
 * POST /api/csv/craft-commerce
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
            result.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current);
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
    for (const alt of alternatives) {
        const idx = h.findIndex((c) => c.includes(alt.toLowerCase()));
        if (idx !== -1) return idx;
    }
    return -1;
}

/** Parse número: limpa tab characters e whitespace, trata negativos */
function parseAmount(str: string | null | undefined): number {
    if (!str || str.trim() === "" || str.trim() === "-") return 0;
    // Remove tab characters, quotes, whitespace
    const cleaned = str.replace(/[\t"'\s]/g, "").trim();
    if (cleaned === "" || cleaned === "-") return 0;
    return parseFloat(cleaned) || 0;
}

/** Parse data Craft Commerce: "2025-01-19 15:38:51" → "2025-01-19" */
function parseCraftDate(dateStr: string | null | undefined): string | null {
    if (!dateStr || dateStr.trim() === "" || dateStr.trim() === "-") return null;
    const trimmed = dateStr.replace(/["\t]/g, "").trim();

    // ISO or Craft format: YYYY-MM-DD HH:MM:SS or YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.substring(0, 10);
    }

    // Fallback
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
    }
    return null;
}

/** Mapear orderStatusId para label */
function getOrderStatusLabel(statusId: string): string {
    const map: Record<string, string> = {
        "5": "Completed",
        "7": "Refunded",
        "9": "Expired",
        "10": "Pending Payment",
        "12": "Processing",
    };
    return map[statusId] || `Status ${statusId}`;
}

/** Mapear orderType + dados para deal_status */
function getDealStatus(
    orderType: string,
    storedTotalPaid: number,
    couponCode: string
): string {
    if (orderType === "Credit") return "Credit Order";
    if (orderType === "subscriptionPayment") return "Subscription Payment";
    if (orderType === "freeProduct") return "Free Product";
    if (couponCode && storedTotalPaid === 0) return "Coupon Order";
    return "Web Order";
}

/** Mapear para status de pagamento */
function getPaymentStatus(
    storedTotalPaid: number,
    storedTotalPrice: number,
    orderStatusId: string
): string {
    if (orderStatusId === "7") return "cancelled";
    if (orderStatusId === "9") return "cancelled";
    if (storedTotalPaid <= 0 && storedTotalPrice <= 0) return "paid"; // Free/coupon
    if (storedTotalPaid <= 0) return "pending";
    if (Math.abs(storedTotalPaid - storedTotalPrice) < 0.01) return "paid";
    if (storedTotalPaid > 0 && storedTotalPaid < storedTotalPrice) return "partial";
    return "paid";
}

/** Mapear gatewayId para nome legível */
function getGatewayName(gatewayId: string): string {
    const map: Record<string, string> = {
        "2": "Braintree",
        "3": "Stripe",
        "1": "Manual",
    };
    return map[gatewayId] || gatewayId ? `Gateway ${gatewayId}` : "";
}

// ============================================================
// POST handler
// ============================================================

const BATCH_SIZE = 500;

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: "Nenhum arquivo enviado" },
                { status: 400 }
            );
        }

        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

        if (lines.length < 2) {
            return NextResponse.json(
                { success: false, error: "CSV vazio ou sem dados" },
                { status: 400 }
            );
        }

        // Detect separator and parse header
        const separator = detectSeparator(lines[0]);
        const headers = parseCSVLine(lines[0], separator).map((h) =>
            h.replace(/^["'\s]+|["'\s]+$/g, "").trim()
        );

        // Validate required columns
        const colId = findCol(headers, "id");
        const colReference = findCol(headers, "reference");
        const colDateOrdered = findCol(headers, "dateordered");
        const colDatePaid = findCol(headers, "datepaid");
        const colDateCreated = findCol(headers, "datecreated");
        const colCurrency = findCol(headers, "currency");
        const colEmail = findCol(headers, "ordercompletedemail");
        const colTotalPrice = findCol(headers, "storedtotalprice");
        const colTotalPaid = findCol(headers, "storedtotalpaid");
        const colItemTotal = findCol(headers, "storeditemtotal");
        const colTotalDiscount = findCol(headers, "storedtotaldiscount");
        const colItemSubtotal = findCol(headers, "storeditemsubtotal");
        const colTotalQty = findCol(headers, "storedtotalqty");
        const colTotalShipping = findCol(headers, "storedtotalshippingcost");
        const colTotalTax = findCol(headers, "storedtotaltax");
        const colTotalTaxIncluded = findCol(headers, "storedtotaltaxincluded");
        const colIsCompleted = findCol(headers, "iscompleted");
        const colCouponCode = findCol(headers, "couponcode");
        const colOrderStatusId = findCol(headers, "orderstatusid");
        const colCustomerId = findCol(headers, "customerid");
        const colGatewayId = findCol(headers, "gatewayid");
        const colNumber = findCol(headers, "number");
        const colOrderType = findCol(headers, "field_ordertype");
        const colHubspotCompanyId = findCol(headers, "field_hubspotcompanyid");
        const colUid = findCol(headers, "uid");
        const colPaymentCurrency = findCol(headers, "paymentcurrency");
        const colLastIp = findCol(headers, "lastip");
        const colOrigin = findCol(headers, "origin");
        const colPaymentSourceId = findCol(headers, "paymentsourceid");
        const colDateUpdated = findCol(headers, "dateupdated");

        if (colReference === -1 || colDateOrdered === -1) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Colunas obrigatórias não encontradas. O CSV deve ter pelo menos "reference" e "dateOrdered".',
                },
                { status: 400 }
            );
        }

        // Parse all data rows
        const records: any[] = [];
        const stats = {
            total: 0,
            eur: 0,
            usd: 0,
            other: 0,
            paid: 0,
            unpaid: 0,
            coupon: 0,
            credit: 0,
            subscription: 0,
            freeProduct: 0,
            skipped: 0,
        };

        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i], separator);
            if (cols.length < 10) {
                stats.skipped++;
                continue;
            }

            const getVal = (idx: number): string =>
                idx >= 0 && idx < cols.length
                    ? cols[idx].replace(/^["'\s]+|["'\s]+$/g, "").trim()
                    : "";

            const craftId = getVal(colId);
            const reference = getVal(colReference);
            const dateOrdered = parseCraftDate(getVal(colDateOrdered));
            const datePaid = parseCraftDate(getVal(colDatePaid));
            const dateCreated = parseCraftDate(getVal(colDateCreated));
            const currency = getVal(colCurrency) || "EUR";
            const email = getVal(colEmail);
            const storedTotalPrice = parseAmount(getVal(colTotalPrice));
            const storedTotalPaid = parseAmount(getVal(colTotalPaid));
            const storedItemTotal = parseAmount(getVal(colItemTotal));
            const storedTotalDiscount = parseAmount(getVal(colTotalDiscount));
            const storedItemSubtotal = parseAmount(getVal(colItemSubtotal));
            const storedTotalQty = parseAmount(getVal(colTotalQty));
            const storedTotalShipping = parseAmount(getVal(colTotalShipping));
            const storedTotalTax = parseAmount(getVal(colTotalTax));
            const storedTotalTaxIncluded = parseAmount(getVal(colTotalTaxIncluded));
            const couponCode = getVal(colCouponCode);
            const orderStatusId = getVal(colOrderStatusId);
            const customerId = getVal(colCustomerId);
            const gatewayId = getVal(colGatewayId);
            const orderNumber = getVal(colNumber);
            const orderType = getVal(colOrderType);
            const hubspotCompanyId = getVal(colHubspotCompanyId);
            const uid = getVal(colUid);

            if (!reference && !craftId) {
                stats.skipped++;
                continue;
            }

            stats.total++;

            // Currency stats
            if (currency.toUpperCase() === "EUR") stats.eur++;
            else if (currency.toUpperCase() === "USD") stats.usd++;
            else stats.other++;

            // Type stats
            const dealStatus = getDealStatus(orderType, storedTotalPaid, couponCode);
            if (dealStatus === "Credit Order") stats.credit++;
            else if (dealStatus === "Subscription Payment") stats.subscription++;
            else if (dealStatus === "Free Product") stats.freeProduct++;
            else if (dealStatus === "Coupon Order") stats.coupon++;

            // Payment stats
            const paymentStatus = getPaymentStatus(
                storedTotalPaid,
                storedTotalPrice,
                orderStatusId
            );
            if (paymentStatus === "paid") stats.paid++;
            else stats.unpaid++;

            const invoiceNumber = `CC-${reference}`;

            const record = {
                invoice_number: invoiceNumber,
                order_id: reference,
                order_date: dateCreated,
                order_status: getOrderStatusLabel(orderStatusId),
                deal_status: dealStatus,
                invoice_date: dateOrdered || dateCreated || new Date().toISOString().split("T")[0],
                products: null, // Not available in this CSV export
                company_name: null,
                client_name: null,
                email: email || null,
                total_amount: storedItemSubtotal > 0 ? storedItemSubtotal : storedTotalPrice,
                currency: currency.toUpperCase(),
                charged_amount: storedTotalPaid,
                payment_method: getGatewayName(gatewayId),
                billing_entity: currency.toUpperCase() === "USD" ? "DSD US LLC" : "Planning Center SL.",
                note: null,
                discount_code: couponCode || null,
                discount_names: null,
                status: paymentStatus,
                due_date: null,
                payment_date: datePaid,
                country_code: currency.toUpperCase() === "USD" ? "US" : "ES",
                scope: currency.toUpperCase() === "USD" ? "US" : "ES",
                source: "craft-commerce",
                source_id: craftId,
                source_data: {
                    craft_id: craftId,
                    uid: uid,
                    order_number: orderNumber,
                    reference: reference,
                    coupon_code: couponCode,
                    order_status_id: orderStatusId,
                    order_type: orderType,
                    date_created: getVal(colDateCreated),
                    date_ordered: getVal(colDateOrdered),
                    date_paid: getVal(colDatePaid),
                    date_updated: getVal(colDateUpdated),
                    stored_total_price: storedTotalPrice,
                    stored_total_paid: storedTotalPaid,
                    stored_item_total: storedItemTotal,
                    stored_total_discount: storedTotalDiscount,
                    stored_total_shipping: storedTotalShipping,
                    stored_total_tax: storedTotalTax,
                    stored_total_tax_included: storedTotalTaxIncluded,
                    stored_item_subtotal: storedItemSubtotal,
                    stored_total_qty: storedTotalQty,
                    customer_id: customerId,
                    customer_email: email,
                    gateway_id: gatewayId,
                    gateway_name: getGatewayName(gatewayId),
                    hubspot_company_id: hubspotCompanyId || null,
                    payment_currency: getVal(colPaymentCurrency),
                    last_ip: getVal(colLastIp),
                    origin: getVal(colOrigin),
                    payment_source_id: getVal(colPaymentSourceId),
                    _imported: true,
                    _import_source: "craft-commerce-csv",
                    _import_date: new Date().toISOString(),
                    _import_method: "csv-upload",
                },
            };

            records.push(record);
        }

        if (records.length === 0) {
            return NextResponse.json(
                { success: false, error: "Nenhum registro válido encontrado no CSV" },
                { status: 400 }
            );
        }

        // Batch upsert into ar_invoices
        let inserted = 0;
        let errors = 0;

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);

            const { error } = await supabaseAdmin
                .from("ar_invoices")
                .upsert(batch, {
                    onConflict: "invoice_number,scope",
                    ignoreDuplicates: false,
                });

            if (error) {
                console.error(
                    `[craft-commerce] Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`,
                    error.message
                );
                errors += batch.length;
            } else {
                inserted += batch.length;
            }
        }

        // Store raw CSV in storage bucket
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const storagePath = `craft-commerce/${timestamp}-${file.name}`;
            await supabaseAdmin.storage
                .from("csv_files")
                .upload(storagePath, new Blob([text], { type: "text/csv" }), {
                    contentType: "text/csv",
                    upsert: true,
                });
        } catch (storageErr: any) {
            console.error("[craft-commerce] Storage error (non-fatal):", storageErr.message);
        }

        return NextResponse.json({
            success: true,
            summary: {
                total: stats.total,
                inserted,
                errors,
                skipped: stats.skipped,
                eur: stats.eur,
                usd: stats.usd,
                paid: stats.paid,
                unpaid: stats.unpaid,
                coupon: stats.coupon,
                credit: stats.credit,
                subscription: stats.subscription,
                freeProduct: stats.freeProduct,
            },
        });
    } catch (err: any) {
        console.error("[craft-commerce] Error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Erro interno" },
            { status: 500 }
        );
    }
}
