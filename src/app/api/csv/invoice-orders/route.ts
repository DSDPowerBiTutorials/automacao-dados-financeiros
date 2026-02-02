import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ============================================================
// 💰 MAPEAMENTO PRODUTO → FINANCIAL ACCOUNT CODE
// Baseado nas contas de receita designadas para cada produto
// ============================================================
function getFinancialAccountCode(productName: string, description: string): { code: string | null; name: string | null } {
    // Combinar todas as strings para busca
    const searchText = `${productName} ${description}`.toLowerCase();

    // ====== 101.0 - Growth (Education) ======

    // 101.1 - DSD Courses
    if (
        searchText.includes('dsd provider') ||
        searchText.includes('designing smiles') ||
        searchText.includes('dsd course') ||
        searchText.includes('increase case acceptance') ||
        searchText.includes('case acceptance mastery') ||
        searchText.includes('ios festival') ||
        searchText.includes('intraoral scanner') ||
        searchText.includes('kois & coachman') ||
        searchText.includes('dsd aligners') ||
        searchText.includes('dsd clinical') ||
        searchText.includes('wtd meeting') ||
        searchText.includes('smile to success') ||
        searchText.includes('implement and learn') ||
        searchText.includes('mastering dsd')
    ) {
        return { code: '101.1', name: 'DSD Courses' };
    }

    // 101.3 - Mastership
    if (
        searchText.includes('mastership') ||
        searchText.includes('master ship') ||
        searchText.includes('residency')
    ) {
        return { code: '101.3', name: 'Mastership' };
    }

    // 101.4 - PC Membership (Provider/Planning Center Membership)
    if (
        searchText.includes('provider annual membership') ||
        searchText.includes('provider membership') ||
        searchText.includes('pc membership') ||
        searchText.includes('planning center membership')
    ) {
        return { code: '101.4', name: 'PC Membership' };
    }

    // 101.5 - Partnerships / Sponsorships
    if (
        searchText.includes('sponsorship') ||
        searchText.includes('partnership') ||
        searchText.includes('sponsor') ||
        searchText.includes('exhibit space')
    ) {
        return { code: '101.5', name: 'Partnerships' };
    }

    // ====== 102.0 - Delight (Clinic Services) ======

    // 102.5 - Consultancies
    if (
        searchText.includes('dsd clinic transformation') ||
        searchText.includes('clinic transformation') ||
        searchText.includes('dsd clinic -') ||
        searchText.includes('consultancy') ||
        searchText.includes('consulting')
    ) {
        return { code: '102.5', name: 'Consultancies' };
    }

    // 102.6 - Marketing Coaching
    if (
        searchText.includes('fractional cmo') ||
        searchText.includes('marketing coaching') ||
        searchText.includes('growth hub onboarding')
    ) {
        return { code: '102.6', name: 'Marketing Coaching' };
    }

    // ====== 103.0 - Planning Center ======
    if (
        searchText.includes('planning center') ||
        searchText.includes('prep guide') ||
        searchText.includes('smile design') ||
        searchText.includes('planning service')
    ) {
        return { code: '103.0', name: 'Planning Center' };
    }

    // ====== 104.0 - LAB (Manufacture) ======
    if (
        searchText.includes('natural restoration') ||
        searchText.includes('lab ') ||
        searchText.includes('prosthesis') ||
        searchText.includes('crown') ||
        searchText.includes('veneer') ||
        searchText.includes('surgical guide') ||
        searchText.includes('abutment')
    ) {
        return { code: '104.0', name: 'LAB' };
    }

    // ====== 105.0 - Other Income ======

    // 105.1 - Level 1 Subscriptions (Growth Hub subscriptions)
    if (
        searchText.includes('dsd growth hub') ||
        searchText.includes('growth hub') ||
        searchText.includes('monthly subscription') ||
        searchText.includes('subscription')
    ) {
        return { code: '105.1', name: 'Level 1 Subscriptions' };
    }

    // 105.4 - Other Marketing Revenues
    if (
        searchText.includes('cancellation fee') ||
        searchText.includes('reschedule fee') ||
        searchText.includes('late fee')
    ) {
        return { code: '105.4', name: 'Other Marketing Revenues' };
    }

    // Fallback: sem mapeamento
    return { code: null, name: null };
}

/**
 * API para upload de Invoice Orders via CSV/XLSX
 * Aceita arquivos com colunas flexíveis, mapeando todas as colunas para custom_data
 */

export async function POST(request: NextRequest) {
    try {
        console.log("🚀 [Invoice Orders] Iniciando processamento...");

        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            console.error("❌ Nenhum arquivo enviado");
            return NextResponse.json(
                { success: false, error: "Nenhum arquivo foi enviado" },
                { status: 400 }
            );
        }

        const validExtensions = [".csv", ".xlsx", ".xls"];
        const hasValidExtension = validExtensions.some((ext) =>
            file.name.toLowerCase().endsWith(ext)
        );

        if (!hasValidExtension) {
            console.error("❌ Formato inválido:", file.name);
            return NextResponse.json(
                { success: false, error: "Formato inválido. Envie arquivos CSV, XLSX ou XLS" },
                { status: 400 }
            );
        }

        console.log("📁 Arquivo:", file.name, "| Tamanho:", file.size, "bytes");

        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        console.log("📊 Planilha:", sheetName, "| Range:", worksheet["!ref"]);

        // Ler como array de objetos
        const rawData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: true,
            defval: null
        }) as unknown[][];

        console.log("📋 Total de linhas:", rawData.length);

        if (rawData.length < 2) {
            return NextResponse.json(
                { success: false, error: "Arquivo vazio ou sem dados" },
                { status: 400 }
            );
        }

        // Primeira linha é o header
        const headers = (rawData[0] as string[]).map((h) =>
            String(h || "").trim()
        );
        console.log("🔑 Headers encontrados:", headers);

        // Identificar colunas importantes - ordem de prioridade específica
        const colIndex = {
            id: headers.findIndex((h) => h.toUpperCase() === "ID"),
            number: headers.findIndex((h) => h.toUpperCase() === "NUMBER"),
            // Invoice Date tem prioridade sobre Order Date
            date: headers.findIndex((h) => h.toUpperCase() === "INVOICE DATE") !== -1
                ? headers.findIndex((h) => h.toUpperCase() === "INVOICE DATE")
                : headers.findIndex((h) =>
                    h.toUpperCase().includes("DATE") || h.toUpperCase().includes("FECHA")
                ),
            // Total é a coluna principal de valor
            amount: headers.findIndex((h) => h.toUpperCase() === "TOTAL") !== -1
                ? headers.findIndex((h) => h.toUpperCase() === "TOTAL")
                : headers.findIndex((h) =>
                    h.toUpperCase().includes("AMOUNT") ||
                    h.toUpperCase().includes("TOTAL") ||
                    h.toUpperCase().includes("VALOR")
                ),
            // Products como descrição principal
            description: headers.findIndex((h) => h.toUpperCase() === "PRODUCTS") !== -1
                ? headers.findIndex((h) => h.toUpperCase() === "PRODUCTS")
                : headers.findIndex((h) =>
                    h.toUpperCase().includes("DESCRIPTION") ||
                    h.toUpperCase().includes("DESCRIPCION") ||
                    h.toUpperCase().includes("NAME")
                ),
            // Order é a coluna do order ID (não confundir com Order Date/Status)
            orderNumber: headers.findIndex((h) => h.toUpperCase() === "ORDER"),
            // Colunas adicionais específicas do CSV de invoices
            currency: headers.findIndex((h) => h.toUpperCase() === "CURRENCY"),
            company: headers.findIndex((h) => h.toUpperCase() === "COMPANY"),
            client: headers.findIndex((h) => h.toUpperCase() === "CLIENT"),
            email: headers.findIndex((h) => h.toUpperCase() === "EMAIL"),
            country: headers.findIndex((h) => h.toUpperCase() === "COUNTRY"),
            paymentMethod: headers.findIndex((h) => h.toUpperCase() === "PAYMENT METHOD"),
            billingEntity: headers.findIndex((h) => h.toUpperCase() === "BILLING ENTITY"),
            charged: headers.findIndex((h) => h.toUpperCase() === "CHARGED")
        };

        console.log("🗺️ Mapeamento de colunas:");
        console.log("  ID:", colIndex.id !== -1 ? `Coluna ${colIndex.id} (${headers[colIndex.id]})` : "❌");
        console.log("  Number:", colIndex.number !== -1 ? `Coluna ${colIndex.number} (${headers[colIndex.number]})` : "❌");
        console.log("  Date:", colIndex.date !== -1 ? `Coluna ${colIndex.date} (${headers[colIndex.date]})` : "❌");
        console.log("  Amount/Total:", colIndex.amount !== -1 ? `Coluna ${colIndex.amount} (${headers[colIndex.amount]})` : "❌");
        console.log("  Description/Products:", colIndex.description !== -1 ? `Coluna ${colIndex.description} (${headers[colIndex.description]})` : "⚠️");
        console.log("  Order:", colIndex.orderNumber !== -1 ? `Coluna ${colIndex.orderNumber} (${headers[colIndex.orderNumber]})` : "⚠️");
        console.log("  Currency:", colIndex.currency !== -1 ? `Coluna ${colIndex.currency}` : "⚠️");
        console.log("  Payment Method:", colIndex.paymentMethod !== -1 ? `Coluna ${colIndex.paymentMethod}` : "⚠️");

        // Processar linhas de dados
        const dataRows = rawData.slice(1);
        let processedCount = 0;
        let skippedCount = 0;

        // Log da primeira linha para debug
        if (dataRows.length > 0) {
            console.log("🔍 Primeira linha de dados:", JSON.stringify(dataRows[0]));
        }

        const rows = dataRows
            .map((row, index) => {
                try {
                    const rowArr = row as unknown[];

                    // Pegar ID ou Number para identificação
                    const invoiceId =
                        colIndex.id !== -1 ? String(rowArr[colIndex.id] || "") : "";
                    const invoiceNumber =
                        colIndex.number !== -1 ? String(rowArr[colIndex.number] || "") : invoiceId;

                    // Pular linhas sem identificador
                    if (!invoiceId && !invoiceNumber) {
                        skippedCount++;
                        return null;
                    }

                    // Date - converter serial Excel se necessário
                    let dateValue: string | null = null;
                    if (colIndex.date !== -1 && rowArr[colIndex.date]) {
                        const rawDate = rowArr[colIndex.date];
                        if (typeof rawDate === "number") {
                            // Serial Excel
                            const parsed = XLSX.SSF.parse_date_code(rawDate);
                            if (parsed) {
                                dateValue = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(
                                    parsed.d
                                ).padStart(2, "0")}`;
                            }
                        } else if (typeof rawDate === "string") {
                            // Tentar parsear ISO ou dd/mm/yyyy
                            if (rawDate.match(/^\d{4}-\d{2}-\d{2}/)) {
                                dateValue = rawDate.substring(0, 10);
                            } else if (rawDate.match(/^\d{2}\/\d{2}\/\d{4}/)) {
                                const [day, month, year] = rawDate.split("/");
                                dateValue = `${year}-${month}-${day}`;
                            } else {
                                dateValue = rawDate;
                            }
                        }
                    }

                    // Amount
                    let amount = 0;
                    if (colIndex.amount !== -1 && rowArr[colIndex.amount]) {
                        const rawAmount = rowArr[colIndex.amount];
                        if (typeof rawAmount === "number") {
                            amount = rawAmount;
                        } else if (typeof rawAmount === "string") {
                            // Parse com vírgula como decimal
                            amount = parseFloat(rawAmount.replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
                        }
                    }

                    // Description
                    const description =
                        colIndex.description !== -1
                            ? String(rowArr[colIndex.description] || "")
                            : invoiceNumber;

                    // Order Number
                    const orderNumber =
                        colIndex.orderNumber !== -1
                            ? String(rowArr[colIndex.orderNumber] || "")
                            : null;

                    // Currency
                    const currency =
                        colIndex.currency !== -1
                            ? String(rowArr[colIndex.currency] || "EUR")
                            : "EUR";

                    // Mapear todas as colunas para custom_data
                    const customData: Record<string, unknown> = {
                        file_name: file.name,
                        row_index: index + 2, // +2 para contar header e 0-index
                        // Campos específicos normalizados
                        ID: invoiceId,
                        Number: invoiceNumber,
                        order_id: orderNumber,
                        order_number: orderNumber,
                        currency: currency
                    };

                    headers.forEach((header, i) => {
                        if (header && rowArr[i] !== null && rowArr[i] !== undefined) {
                            // Normalizar nome da chave (snake_case)
                            const key = header.replace(/\s+/g, "_").replace(/[^\w]/g, "");
                            customData[key] = rowArr[i];
                        }
                    });

                    // 💰 Financial Account: Mapear produto → conta de receita
                    const financialAccount = getFinancialAccountCode(description, invoiceNumber);
                    customData.financial_account_code = financialAccount.code;
                    customData.financial_account_name = financialAccount.name;

                    processedCount++;

                    return {
                        source: "invoice-orders",
                        file_name: file.name,
                        date: dateValue || new Date().toISOString().split("T")[0],
                        description: description.substring(0, 500),
                        amount: amount,
                        reconciled: false,
                        custom_data: customData
                    };
                } catch (err) {
                    console.error(`❌ Erro na linha ${index + 2}:`, err);
                    skippedCount++;
                    return null;
                }
            })
            .filter(Boolean);

        console.log(`\n✅ Processadas: ${processedCount} | Ignoradas: ${skippedCount}`);

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, error: "Nenhuma linha válida encontrada no arquivo" },
                { status: 400 }
            );
        }

        // Inserir no Supabase
        console.log("💾 Salvando no Supabase...");
        console.log("📊 Primeiro registro para debug:", JSON.stringify(rows[0], null, 2));

        // Deletar registros antigos (opcional - para evitar duplicatas)
        // await supabaseAdmin.from("csv_rows").delete().eq("source", "invoice-orders");

        // Inserir em batches de 500
        const batchSize = 500;
        let insertedCount = 0;

        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);

            const { error: insertError } = await supabaseAdmin.from("csv_rows").insert(batch);

            if (insertError) {
                console.error("❌ Erro ao inserir batch:", JSON.stringify(insertError, null, 2));
                throw insertError;
            }

            insertedCount += batch.length;
            console.log(`📦 Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} registros`);
        }

        console.log(`🎉 Upload concluído! ${insertedCount} registros salvos`);

        return NextResponse.json({
            success: true,
            data: {
                fileName: file.name,
                rowCount: insertedCount,
                skipped: skippedCount,
                headers: headers
            }
        });
    } catch (error) {
        console.error("❌ Erro no upload:", error);
        const errorMessage = error instanceof Error
            ? error.message
            : typeof error === 'object' && error !== null
                ? JSON.stringify(error)
                : "Erro desconhecido";
        console.error("❌ Detalhes do erro:", errorMessage);
        return NextResponse.json(
            {
                success: false,
                error: errorMessage
            },
            { status: 500 }
        );
    }
}
