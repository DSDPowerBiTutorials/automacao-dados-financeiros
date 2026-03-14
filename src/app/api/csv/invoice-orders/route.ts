import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ============================================================
// 💰 SUGESTÃO AUTOMÁTICA PRODUTO → FINANCIAL ACCOUNT CODE
// Retorna uma sugestão baseada em keywords do nome do produto
// O valor FINAL é definido pelo usuário no popup de classificação
// ============================================================
function suggestFinancialAccountCode(productName: string, description: string): { code: string | null; name: string | null } {
    const searchText = `${productName} ${description}`.toLowerCase();

    // 101.1 - DSD Courses
    if (
        searchText.includes('dsd provider') || searchText.includes('designing smiles') ||
        searchText.includes('dsd course') || searchText.includes('increase case acceptance') ||
        searchText.includes('case acceptance mastery') || searchText.includes('ios festival') ||
        searchText.includes('intraoral scanner') || searchText.includes('kois & coachman') ||
        searchText.includes('dsd aligners') || searchText.includes('dsd clinical') ||
        searchText.includes('wtd meeting') || searchText.includes('smile to success') ||
        searchText.includes('implement and learn') || searchText.includes('mastering dsd')
    ) return { code: '101.1', name: 'DSD Course' };

    // 101.2 - Others Courses
    if (searchText.includes('other course') || searchText.includes('workshop') || searchText.includes('webinar'))
        return { code: '101.2', name: 'Others Courses' };

    // 101.3 - Mastership
    if (searchText.includes('mastership') || searchText.includes('master ship') || searchText.includes('residency'))
        return { code: '101.3', name: 'Mastership' };

    // 101.4 - PC Membership
    if (
        searchText.includes('provider annual membership') || searchText.includes('provider membership') ||
        searchText.includes('pc membership') || searchText.includes('planning center membership')
    ) return { code: '101.4', name: 'PC Membership' };

    // 101.5 - Partnerships
    if (searchText.includes('sponsorship') || searchText.includes('partnership') || searchText.includes('sponsor') || searchText.includes('exhibit space'))
        return { code: '101.5', name: 'Partnerships' };

    // 102.0 - Delight (parent — sub-account will be refined in Popup 2)
    if (
        searchText.includes('dsd clinic transformation') || searchText.includes('clinic transformation') ||
        searchText.includes('dsd clinic -') || searchText.includes('dsd clinic services') ||
        searchText.includes('monthly fee') || searchText.includes('consultancy') ||
        searchText.includes('consulting') || searchText.includes('fractional cmo') ||
        searchText.includes('marketing coaching') || searchText.includes('growth hub onboarding') ||
        searchText.includes('patient attraction') || searchText.includes('dsd coaching') ||
        searchText.includes('coaching') || searchText.includes('delight')
    ) return { code: '102.0', name: 'Delight' };

    // 104.0 - LAB (before 103 due to overlap)
    if (
        searchText.includes('manufacture') || searchText.includes('natural restoration') ||
        searchText.includes('lab ') || searchText.includes('prosthesis') ||
        searchText.includes('crown') || searchText.includes('veneer') ||
        searchText.includes('surgical guide') || searchText.includes('abutment') ||
        searchText.includes('direct restoration') || searchText.includes('bridge manufacture') ||
        searchText.includes('mockup manufacture')
    ) return { code: '104.0', name: 'LAB' };

    // 103.0 - Planning Center
    if (
        searchText.includes('planning center') || searchText.includes('prep guide') ||
        searchText.includes('prep kit') || searchText.includes('smile design') ||
        searchText.includes('planning service') || searchText.includes('dsd upper') ||
        searchText.includes('dsd lower') || searchText.includes('dsd diagnostic') ||
        searchText.includes('diagnostic design') || searchText.includes('ortho planning') ||
        searchText.includes('ortho tps') || searchText.includes('ortho quality') ||
        searchText.includes('mockup design') || searchText.includes('motivational mockup') ||
        searchText.includes('clic guide') || searchText.includes('update upper') ||
        searchText.includes('update lower') || searchText.includes('denture design') ||
        searchText.includes('deprogrammer design') || searchText.includes('implant planning') ||
        searchText.includes('guide design') || searchText.includes('tad guide') ||
        searchText.includes('interdisciplinary') || searchText.includes('restorative planning') ||
        searchText.includes('injected design') || searchText.includes('additional design') ||
        searchText.includes('over prep') || searchText.includes('invisalign')
    ) return { code: '103.0', name: 'Planning Center' };

    // 105.1 - Level 1
    if (
        searchText.includes('dsd growth hub') || searchText.includes('growth hub') ||
        searchText.includes('monthly subscription') || searchText.includes('subscription') ||
        searchText.includes('online access') || searchText.includes('dsd online') ||
        searchText.includes('level 2 annual') || searchText.includes('annual plan')
    ) return { code: '105.1', name: 'Level 1' };

    // 105.2 - CORE Partnerships
    if (searchText.includes('core partnership') || searchText.includes('core member'))
        return { code: '105.2', name: 'CORE Partnerships' };

    // 105.3 - Study Club
    if (searchText.includes('study club'))
        return { code: '105.3', name: 'Study Club' };

    // 105.4 - Other Marketing Revenues
    if (searchText.includes('cancellation fee') || searchText.includes('reschedule fee') || searchText.includes('late fee'))
        return { code: '105.4', name: 'Other Marketing Revenues' };

    return { code: null, name: null };
}

/**
 * API para upload de Invoice Orders via CSV/XLSX
 * Retorna dados parseados para classificação no popup do frontend
 * Duplicados são detectados e sobrescritos (upsert)
 */
export async function POST(request: NextRequest) {
    try {
        console.log("🚀 [Invoice Orders] Iniciando processamento...");

        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ success: false, error: "Nenhum arquivo foi enviado" }, { status: 400 });
        }

        const validExtensions = [".csv", ".xlsx", ".xls"];
        if (!validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))) {
            return NextResponse.json({ success: false, error: "Formato inválido. Envie arquivos CSV, XLSX ou XLS" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null }) as unknown[][];

        if (rawData.length < 2) {
            return NextResponse.json({ success: false, error: "Arquivo vazio ou sem dados" }, { status: 400 });
        }

        const headers = (rawData[0] as string[]).map((h) => String(h || "").trim());

        const colIndex = {
            id: headers.findIndex((h) => h.toUpperCase() === "ID"),
            number: headers.findIndex((h) => h.toUpperCase() === "NUMBER"),
            date: headers.findIndex((h) => h.toUpperCase() === "INVOICE DATE") !== -1
                ? headers.findIndex((h) => h.toUpperCase() === "INVOICE DATE")
                : headers.findIndex((h) => h.toUpperCase().includes("DATE") || h.toUpperCase().includes("FECHA")),
            amount: headers.findIndex((h) => h.toUpperCase() === "TOTAL") !== -1
                ? headers.findIndex((h) => h.toUpperCase() === "TOTAL")
                : headers.findIndex((h) => h.toUpperCase().includes("AMOUNT") || h.toUpperCase().includes("TOTAL") || h.toUpperCase().includes("VALOR")),
            description: headers.findIndex((h) => h.toUpperCase() === "PRODUCTS") !== -1
                ? headers.findIndex((h) => h.toUpperCase() === "PRODUCTS")
                : headers.findIndex((h) => h.toUpperCase().includes("DESCRIPTION") || h.toUpperCase().includes("DESCRIPCION") || h.toUpperCase().includes("NAME")),
            orderNumber: headers.findIndex((h) => h.toUpperCase() === "ORDER"),
            currency: headers.findIndex((h) => h.toUpperCase() === "CURRENCY"),
            company: headers.findIndex((h) => h.toUpperCase() === "COMPANY"),
            client: headers.findIndex((h) => h.toUpperCase() === "CLIENT"),
            email: headers.findIndex((h) => h.toUpperCase() === "EMAIL"),
            country: headers.findIndex((h) => h.toUpperCase() === "COUNTRY"),
            paymentMethod: headers.findIndex((h) => h.toUpperCase() === "PAYMENT METHOD"),
            billingEntity: headers.findIndex((h) => h.toUpperCase() === "BILLING ENTITY"),
            charged: headers.findIndex((h) => h.toUpperCase() === "CHARGED")
        };

        // ── Buscar mapeamentos prévios de produto → FA do product_pnl_mappings ──
        const { data: priorMappings } = await supabaseAdmin
            .from("product_pnl_mappings")
            .select("product_name, financial_account_code");
        const productFAMap = new Map<string, string>();
        if (priorMappings) {
            for (const m of priorMappings) {
                productFAMap.set(m.product_name.toLowerCase().trim(), m.financial_account_code);
            }
        }

        const dataRows = rawData.slice(1);
        let skippedCount = 0;

        const parsedRows: Array<{
            invoiceNumber: string;
            invoiceId: string;
            date: string;
            amount: number;
            description: string;
            orderNumber: string | null;
            currency: string;
            customerName: string;
            customerEmail: string;
            suggestedFA: string | null;
            suggestedFAName: string | null;
            faSource: "prior_mapping" | "keyword" | "none";
            customData: Record<string, unknown>;
        }> = [];

        for (let index = 0; index < dataRows.length; index++) {
            try {
                const rowArr = dataRows[index] as unknown[];

                const invoiceId = colIndex.id !== -1 ? String(rowArr[colIndex.id] || "") : "";
                const invoiceNumber = colIndex.number !== -1 ? String(rowArr[colIndex.number] || "") : invoiceId;

                if (!invoiceId && !invoiceNumber) { skippedCount++; continue; }

                // Date parsing
                let dateValue: string | null = null;
                if (colIndex.date !== -1 && rowArr[colIndex.date]) {
                    const rawDate = rowArr[colIndex.date];
                    if (typeof rawDate === "number") {
                        const parsed = XLSX.SSF.parse_date_code(rawDate);
                        if (parsed) dateValue = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
                    } else if (typeof rawDate === "string") {
                        if (rawDate.match(/^\d{4}-\d{2}-\d{2}/)) dateValue = rawDate.substring(0, 10);
                        else if (rawDate.match(/^\d{2}\/\d{2}\/\d{4}/)) {
                            const [day, month, year] = rawDate.split("/");
                            dateValue = `${year}-${month}-${day}`;
                        } else dateValue = rawDate;
                    }
                }

                // Amount
                let amount = 0;
                if (colIndex.amount !== -1 && rowArr[colIndex.amount]) {
                    const rawAmount = rowArr[colIndex.amount];
                    if (typeof rawAmount === "number") amount = rawAmount;
                    else if (typeof rawAmount === "string") amount = parseFloat(rawAmount.replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
                }

                const description = colIndex.description !== -1 ? String(rowArr[colIndex.description] || "") : invoiceNumber;
                const orderNumber = colIndex.orderNumber !== -1 ? String(rowArr[colIndex.orderNumber] || "") : null;
                const currency = colIndex.currency !== -1 ? String(rowArr[colIndex.currency] || "EUR") : "EUR";

                // Custom data
                const customData: Record<string, unknown> = {
                    file_name: file.name,
                    row_index: index + 2,
                    ID: invoiceId,
                    Number: invoiceNumber,
                    order_id: orderNumber,
                    order_number: orderNumber,
                    currency: currency
                };

                headers.forEach((header, i) => {
                    if (header && rowArr[i] !== null && rowArr[i] !== undefined) {
                        const key = header.replace(/\s+/g, "_").replace(/[^\w]/g, "");
                        customData[key] = rowArr[i];
                    }
                });

                const custName = String(customData.Client || customData.CLIENT || customData.client || customData.Company || customData.COMPANY || customData.company || "").trim();
                const custEmail = String(customData.Email || customData.EMAIL || customData.email || "").trim();
                if (custName) customData.customer_name = custName;
                if (custEmail) customData.customer_email = custEmail;
                if (customData.Company || customData.COMPANY || customData.company) {
                    customData.company_name = String(customData.Company || customData.COMPANY || customData.company || "").trim();
                }

                // ── FA Suggestion: 1) prior mapping, 2) keyword, 3) none ──
                let suggestedFA: string | null = null;
                let suggestedFAName: string | null = null;
                let faSource: "prior_mapping" | "keyword" | "none" = "none";

                const productKey = description.toLowerCase().trim();
                if (productFAMap.has(productKey)) {
                    suggestedFA = productFAMap.get(productKey)!;
                    faSource = "prior_mapping";
                } else {
                    const suggestion = suggestFinancialAccountCode(description, invoiceNumber);
                    if (suggestion.code) {
                        suggestedFA = suggestion.code;
                        suggestedFAName = suggestion.name;
                        faSource = "keyword";
                    }
                }

                parsedRows.push({
                    invoiceNumber,
                    invoiceId,
                    date: dateValue || new Date().toISOString().split("T")[0],
                    amount,
                    description: description.substring(0, 500),
                    orderNumber,
                    currency,
                    customerName: custName,
                    customerEmail: custEmail,
                    suggestedFA,
                    suggestedFAName,
                    faSource,
                    customData
                });
            } catch (err) {
                console.error(`❌ Erro na linha ${index + 2}:`, err);
                skippedCount++;
            }
        }

        if (parsedRows.length === 0) {
            return NextResponse.json({ success: false, error: "Nenhuma linha válida encontrada" }, { status: 400 });
        }

        // ── Detecção de duplicados (invoice_number + date + amount + customer) ──
        const invoiceNumbers = parsedRows.map((r) => r.invoiceNumber).filter(Boolean);
        const existingRows = new Map<string, string>(); // key → existing row id

        if (invoiceNumbers.length > 0) {
            const uniqueInvs = [...new Set(invoiceNumbers)];
            for (let i = 0; i < uniqueInvs.length; i += 200) {
                const batch = uniqueInvs.slice(i, i + 200);
                const { data: existing } = await supabaseAdmin
                    .from("csv_rows")
                    .select("id, date, amount, description, custom_data")
                    .eq("source", "invoice-orders")
                    .in("custom_data->>Number", batch);
                if (existing) {
                    for (const row of existing) {
                        const invNum = (row.custom_data as Record<string, unknown>)?.Number as string;
                        if (invNum) {
                            // Build composite key for strong matching
                            const key = `${invNum}|${row.date}|${Math.round(parseFloat(row.amount) * 100)}`;
                            existingRows.set(key, row.id);
                            // Also index by invoice number alone as fallback
                            existingRows.set(`inv:${invNum}`, row.id);
                        }
                    }
                }
            }
        }

        // Classify each parsed row as new, duplicate-overwrite, or in-file-duplicate
        const seenInFile = new Map<string, number>(); // compositeKey → index in parsedRows
        const newRows: typeof parsedRows = [];
        const duplicateOverwriteRows: Array<{ parsed: typeof parsedRows[0]; existingId: string }> = [];
        let inFileDuplicates = 0;

        for (const row of parsedRows) {
            const compositeKey = `${row.invoiceNumber}|${row.date}|${Math.round(row.amount * 100)}`;
            const invKey = `inv:${row.invoiceNumber}`;

            // In-file duplicate? Keep last one
            if (seenInFile.has(compositeKey)) {
                inFileDuplicates++;
                const prevIdx = seenInFile.get(compositeKey)!;
                // Replace the previous occurrence
                const prevNew = newRows.findIndex((r) =>
                    `${r.invoiceNumber}|${r.date}|${Math.round(r.amount * 100)}` === compositeKey
                );
                if (prevNew >= 0) newRows[prevNew] = row;
                continue;
            }
            seenInFile.set(compositeKey, newRows.length);

            // DB duplicate? Mark for overwrite
            const existingId = existingRows.get(compositeKey) || existingRows.get(invKey);
            if (existingId) {
                duplicateOverwriteRows.push({ parsed: row, existingId });
            } else {
                newRows.push(row);
            }
        }

        console.log(`✅ Parsed: ${parsedRows.length} | New: ${newRows.length} | Overwrites: ${duplicateOverwriteRows.length} | In-file dupes: ${inFileDuplicates} | Skipped: ${skippedCount}`);

        return NextResponse.json({
            success: true,
            data: {
                fileName: file.name,
                headers,
                parsedRows: parsedRows.map((r) => ({
                    invoiceNumber: r.invoiceNumber,
                    invoiceId: r.invoiceId,
                    date: r.date,
                    amount: r.amount,
                    description: r.description,
                    orderNumber: r.orderNumber,
                    currency: r.currency,
                    customerName: r.customerName,
                    customerEmail: r.customerEmail,
                    suggestedFA: r.suggestedFA,
                    suggestedFAName: r.suggestedFAName,
                    faSource: r.faSource,
                    customData: r.customData
                })),
                duplicateCount: duplicateOverwriteRows.length,
                duplicateOverwrites: duplicateOverwriteRows.map((d) => ({
                    invoiceNumber: d.parsed.invoiceNumber,
                    existingId: d.existingId
                })),
                inFileDuplicates,
                skippedEmpty: skippedCount,
                totalParsed: parsedRows.length
            }
        });
    } catch (error) {
        console.error("❌ Erro no upload:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
