import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST(request: NextRequest) {
    try {
        console.log("🚀 [Bankinter EUR] Iniciando processamento...")

        const formData = await request.formData()
        const file = formData.get("file") as File

        if (!file) {
            console.error("❌ Nenhum arquivo enviado")
            return NextResponse.json(
                { success: false, error: "Nenhum arquivo foi enviado" },
                { status: 400 }
            )
        }

        const validExtensions = [".xlsx", ".xls"]
        const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))

        if (!hasValidExtension) {
            console.error("❌ Formato inválido:", file.name)
            return NextResponse.json(
                { success: false, error: "Formato inválido. Envie apenas arquivos XLSX ou XLS do Bankinter" },
                { status: 400 }
            )
        }

        console.log("📁 Arquivo:", file.name, "| Tamanho:", file.size, "bytes")

        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]

        console.log("📊 Planilha:", sheetName, "| Range:", worksheet['!ref'])

        // Ler como array de arrays (método mais confiável para Bankinter)
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][]
        console.log("📋 Total de linhas:", rawData.length)

        if (rawData.length === 0) {
            return NextResponse.json(
                { success: false, error: "Arquivo vazio" },
                { status: 400 }
            )
        }

        // Encontrar linha de headers (procurar por "FECHA")
        let headerRowIndex = -1
        for (let i = 0; i < Math.min(15, rawData.length); i++) {
            const row = rawData[i]
            const hasDateHeader = row.some((cell: any) => {
                const str = String(cell || "").toUpperCase()
                return str.includes("FECHA") && (str.includes("CONTABLE") || str.includes("VALOR"))
            })

            if (hasDateHeader) {
                headerRowIndex = i
                console.log(`\n📌 Headers encontrados na linha ${i + 1}:`)
                console.log(row.map((c: any) => c || "[vazio]"))
                break
            }
        }

        if (headerRowIndex === -1) {
            console.error("❌ Headers não encontrados nas primeiras 15 linhas")
            return NextResponse.json(
                { success: false, error: "Formato inválido: não foi possível identificar os headers (FECHA CONTABLE, FECHA VALOR, etc.)" },
                { status: 400 }
            )
        }

        const headers = rawData[headerRowIndex].map((h: any) => String(h || "").trim().toUpperCase())
        console.log("\n🔑 Headers normalizados:", headers)

        // Mapear índices das colunas
        const colIndex = {
            fechaContable: headers.findIndex(h => h.includes("FECHA") && h.includes("CONTABLE")),
            fechaValor: headers.findIndex(h => h.includes("FECHA") && h.includes("VALOR")),
            descripcion: headers.findIndex(h => h.includes("DESCRIPCIÓN") || h.includes("DESCRIPCION")),
            debe: headers.findIndex(h => h === "DEBE"),
            haber: headers.findIndex(h => h === "HABER"),
            importe: headers.findIndex(h => h.includes("IMPORTE")),
            saldo: headers.findIndex(h => h === "SALDO"),
            referencia: headers.findIndex(h => h === "REFERENCIA"),
            clave: headers.findIndex(h => h === "CLAVE"),
            categoria: headers.findIndex(h => h.includes("CATEGOR"))
        }

        console.log("\n🗺️ Mapeamento de colunas:")
        console.log("  FECHA CONTABLE:", colIndex.fechaContable !== -1 ? `Coluna ${colIndex.fechaContable}` : "❌")
        console.log("  FECHA VALOR:", colIndex.fechaValor !== -1 ? `Coluna ${colIndex.fechaValor}` : "❌")
        console.log("  DESCRIPCIÓN:", colIndex.descripcion !== -1 ? `Coluna ${colIndex.descripcion}` : "❌")
        console.log("  DEBE:", colIndex.debe !== -1 ? `Coluna ${colIndex.debe}` : "❌")
        console.log("  HABER:", colIndex.haber !== -1 ? `Coluna ${colIndex.haber}` : "❌")
        console.log("  IMPORTE:", colIndex.importe !== -1 ? `Coluna ${colIndex.importe}` : "⚠️")
        console.log("  SALDO:", colIndex.saldo !== -1 ? `Coluna ${colIndex.saldo}` : "⚠️")

        if (colIndex.fechaValor === -1 || colIndex.descripcion === -1) {
            return NextResponse.json(
                { success: false, error: "Colunas obrigatórias não encontradas (FECHA VALOR, DESCRIPCIÓN)" },
                { status: 400 }
            )
        }

        // Processar linhas de dados (após headers)
        const dataRows = rawData.slice(headerRowIndex + 1)
        let processedCount = 0
        let skippedCount = 0

        const rows = dataRows.map((row, index) => {
            try {
                // Pegar valores
                const fechaValorRaw = colIndex.fechaValor !== -1 ? row[colIndex.fechaValor] : null
                const descripcion = colIndex.descripcion !== -1 ? String(row[colIndex.descripcion] || "").trim() : ""
                const debeRaw = colIndex.debe !== -1 ? row[colIndex.debe] : null
                const haberRaw = colIndex.haber !== -1 ? row[colIndex.haber] : null
                const importeRaw = colIndex.importe !== -1 ? row[colIndex.importe] : null
                const saldoRaw = colIndex.saldo !== -1 ? row[colIndex.saldo] : null

                // Skip linhas vazias
                if (!fechaValorRaw && !descripcion) {
                    skippedCount++
                    return null
                }

                // Parse data (Excel serial number ou DD/MM/YYYY)
                let date: Date
                if (typeof fechaValorRaw === "number") {
                    // Excel serial date
                    const jsDate = XLSX.SSF.parse_date_code(fechaValorRaw)
                    date = new Date(jsDate.y, jsDate.m - 1, jsDate.d)
                } else if (typeof fechaValorRaw === "string") {
                    const parts = fechaValorRaw.split(/[\/\-]/)
                    if (parts.length === 3) {
                        date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
                    } else {
                        date = new Date(fechaValorRaw)
                    }
                } else {
                    console.warn(`⚠️ [Linha ${headerRowIndex + index + 2}] Data inválida:`, fechaValorRaw)
                    skippedCount++
                    return null
                }

                if (isNaN(date.getTime())) {
                    console.warn(`⚠️ [Linha ${headerRowIndex + index + 2}] Data não parseável:`, fechaValorRaw)
                    skippedCount++
                    return null
                }

                // Parse valores monetários (suporta 1234.56 e -1234)
                const parseAmount = (val: any): number => {
                    if (val === null || val === undefined || val === "") return 0
                    if (typeof val === "number") return val

                    const str = String(val)
                        .trim()
                        .replace(/\s/g, "")
                        .replace(/\./g, "")
                        .replace(",", ".")

                    const num = parseFloat(str)
                    return isNaN(num) ? 0 : num
                }

                const debe = parseAmount(debeRaw)
                const haber = parseAmount(haberRaw)
                const importe = parseAmount(importeRaw)
                const saldo = parseAmount(saldoRaw)

                // Amount = HABER - DEBE (ou usar IMPORTE se disponível)
                let amount: number
                if (importe !== 0) {
                    amount = importe
                } else {
                    amount = haber - debe
                }

                // Se não tem valores, skip
                if (debe === 0 && haber === 0 && importe === 0) {
                    console.warn(`⚠️ [Linha ${headerRowIndex + index + 2}] Sem valores monetários`)
                    skippedCount++
                    return null
                }

                processedCount++

                // Coletar dados adicionais
                const referencia = colIndex.referencia !== -1 ? String(row[colIndex.referencia] || "") : ""
                const clave = colIndex.clave !== -1 ? String(row[colIndex.clave] || "") : ""
                const categoria = colIndex.categoria !== -1 ? String(row[colIndex.categoria] || "") : ""

                return {
                    source: "bankinter-eur",
                    file_name: file.name,
                    date: date.toISOString().split("T")[0],
                    description: descripcion || "Sin descripción",
                    amount: amount.toString(),
                    category: categoria || "Other",
                    classification: categoria || "Other",
                    reconciled: false,
                    custom_data: {
                        debe,
                        haber,
                        importe,
                        saldo,
                        referencia,
                        clave,
                        categoria,
                        row_index: headerRowIndex + index + 2,
                        file_name: file.name,
                        fecha_contable: colIndex.fechaContable !== -1 ? row[colIndex.fechaContable] : null
                    }
                }
            } catch (error) {
                console.error(`❌ [Linha ${headerRowIndex + index + 2}] Erro:`, error)
                skippedCount++
                return null
            }
        }).filter((row): row is NonNullable<typeof row> => row !== null)

        console.log(`\n✅ Processadas: ${processedCount} | ⚠️ Ignoradas: ${skippedCount}`)

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, error: "Nenhuma transação válida encontrada no arquivo" },
                { status: 400 }
            )
        }

        // Amostra
        console.log("\n📋 Primeiras 2 transações:")
        console.log(JSON.stringify(rows.slice(0, 2), null, 2))

        // Validar campos obrigatórios
        const invalidRows = rows.filter(row =>
            !row || !row.source || !row.file_name || !row.date ||
            !row.description || !row.amount || !row.category || !row.classification
        )

        if (invalidRows.length > 0) {
            console.error("❌ Linhas inválidas encontradas:", invalidRows.length)
            console.error("Exemplo de linha inválida:", JSON.stringify(invalidRows[0], null, 2))
            return NextResponse.json(
                { success: false, error: `${invalidRows.length} linhas com campos obrigatórios faltando` },
                { status: 400 }
            )
        }

        // Garantir que não há campos 'id' nos objetos (Supabase auto-gera)
        const cleanRows = rows.map(({ ...row }) => {
            // @ts-ignore
            delete row.id
            return row
        })

        // Salvar no Supabase
        console.log(`\n💾 Salvando ${cleanRows.length} registros no Supabase...`)
        const { data: insertedRows, error: dbError } = await supabaseAdmin
            .from("csv_rows")
            .insert(cleanRows)
            .select()

        if (dbError) {
            console.error("❌ Erro Supabase:", dbError)
            return NextResponse.json(
                { success: false, error: `Erro ao salvar: ${dbError.message}` },
                { status: 500 }
            )
        }

        console.log("✅ Salvo:", insertedRows?.length, "registros")

        // Salvar arquivo no storage
        const fileName = `bankinter-eur/${Date.now()}-${file.name}`
        const { error: storageError } = await supabaseAdmin
            .storage
            .from("csv_files")
            .upload(fileName, arrayBuffer, {
                contentType: file.type,
                upsert: false
            })

        if (storageError) {
            console.warn("⚠️ Storage warning:", storageError.message)
        } else {
            console.log("✅ Arquivo salvo no storage:", fileName)
        }

        // Estatísticas
        const totalCredito = rows.reduce((sum, r: any) => sum + r.custom_data.haber, 0)
        const totalDebito = rows.reduce((sum, r: any) => sum + Math.abs(r.custom_data.debe), 0)
        const saldoFinal = rows.length > 0 ? rows[0].custom_data.saldo : 0

        console.log(`\n📊 RESUMO:`)
        console.log(`  Total Crédito: €${totalCredito.toFixed(2)}`)
        console.log(`  Total Débito: €${totalDebito.toFixed(2)}`)
        console.log(`  Saldo Final: €${saldoFinal.toFixed(2)}`)
        console.log(`\n🎉 Processamento concluído!\n`)

        return NextResponse.json({
            success: true,
            message: `${rows.length} transações importadas com sucesso!`,
            data: {
                rowCount: rows.length,
                fileName: file.name,
                storagePath: fileName,
                insertedIds: insertedRows?.map(r => r.id),
                summary: {
                    totalProcessed: rows.length,
                    totalSkipped: skippedCount,
                    totalCredito,
                    totalDebito,
                    saldoFinal,
                    dateRange: rows.length > 0 ? {
                        min: rows.reduce((min, r: any) => r.date < min ? r.date : min, rows[0].date),
                        max: rows.reduce((max, r: any) => r.date > max ? r.date : max, rows[0].date)
                    } : null
                }
            }
        })

    } catch (error) {
        console.error("\n❌ ERRO GERAL:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Erro desconhecido ao processar arquivo"
            },
            { status: 500 }
        )
    }
}
