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

        // Ler como array de arrays COM raw: true para preservar números e datas originais
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null }) as any[][]
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
        console.log("  REFERENCIA:", colIndex.referencia !== -1 ? `Coluna ${colIndex.referencia}` : "⚠️")
        console.log("  CLAVE:", colIndex.clave !== -1 ? `Coluna ${colIndex.clave}` : "⚠️")
        console.log("  CATEGORIA:", colIndex.categoria !== -1 ? `Coluna ${colIndex.categoria}` : "⚠️")

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

                // DEBUG: Log primeira linha para ver valores brutos
                if (index === 0) {
                    console.log("\n🔍 [DEBUG] PRIMEIRA LINHA - Valores brutos:")
                    console.log("  fechaValorRaw:", fechaValorRaw, typeof fechaValorRaw)
                    console.log("  descripcion:", descripcion)
                    console.log("  debeRaw:", debeRaw, typeof debeRaw)
                    console.log("  haberRaw:", haberRaw, typeof haberRaw)
                    console.log("  importeRaw:", importeRaw, typeof importeRaw)
                    console.log("  saldoRaw:", saldoRaw, typeof saldoRaw)
                    console.log("  referencia (col", colIndex.referencia, "):", row[colIndex.referencia])
                    console.log("  clave (col", colIndex.clave, "):", row[colIndex.clave])
                    console.log("  categoria (col", colIndex.categoria, "):", row[colIndex.categoria])
                    console.log("  fechaContable (col", colIndex.fechaContable, "):", row[colIndex.fechaContable])
                }

                // Skip linhas vazias
                if (!fechaValorRaw && !descripcion) {
                    skippedCount++
                    return null
                }

                // Parse data SIMPLES - converter serial Excel direto para DD/MM/YYYY string
                let dateString: string
                if (typeof fechaValorRaw === "number") {
                    // XLSX.SSF.format converte serial Excel direto sem timezone bullshit
                    dateString = XLSX.SSF.format("dd/mm/yyyy", fechaValorRaw)
                    console.log(`📅 [DEBUG] Serial ${fechaValorRaw} → ${dateString}`)
                } else if (typeof fechaValorRaw === "string") {
                    // Já é string, usar diretamente
                    dateString = fechaValorRaw.trim()
                } else {
                    console.warn(`⚠️ [Linha ${headerRowIndex + index + 2}] Data inválida:`, fechaValorRaw)
                    skippedCount++
                    return null
                }

                // Validar formato DD/MM/YYYY
                const dateParts = dateString.split(/[\/\-\.]/)
                if (dateParts.length !== 3) {
                    console.warn(`⚠️ [Linha ${headerRowIndex + index + 2}] Data não parseável:`, dateString)
                    skippedCount++
                    return null
                }

                // Converter para ISO YYYY-MM-DD para Supabase (banco precisa desse formato)
                const day = dateParts[0].padStart(2, "0")
                const month = dateParts[1].padStart(2, "0")
                const year = dateParts[2]
                const isoDate = `${year}-${month}-${day}`

                // Parse valores monetários - formato europeu: 1.234,56 ou -2.636,09
                const parseAmount = (val: any): number => {
                    if (val === null || val === undefined || val === "") return 0
                    if (typeof val === "number") return val

                    const str = String(val)
                        .trim()
                        .replace(/\s/g, "")           // Remove espaços
                        .replace(/\./g, "")           // Remove pontos (separador de milhares)
                        .replace(",", ".")            // Substitui vírgula por ponto (decimal)

                    const num = parseFloat(str)
                    return isNaN(num) ? 0 : num
                }

                const debe = parseAmount(debeRaw)
                const haber = parseAmount(haberRaw)
                const importe = parseAmount(importeRaw)
                const saldo = parseAmount(saldoRaw)

                console.log(`💰 [DEBUG Linha ${headerRowIndex + index + 2}] debe=${debe}, haber=${haber}, importe=${importe}, saldo=${saldo}`)

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

                // Parse fecha_contable
                const fechaContableRaw = colIndex.fechaContable !== -1 ? row[colIndex.fechaContable] : null
                let fechaContable: string | null = null
                if (fechaContableRaw) {
                    if (typeof fechaContableRaw === "number") {
                        // Usar XLSX.SSF.format direto
                        fechaContable = XLSX.SSF.format("dd/mm/yyyy", fechaContableRaw)
                    } else if (typeof fechaContableRaw === "string") {
                        fechaContable = fechaContableRaw
                    }
                }

                // DEBUG CRÍTICO: Log do objeto custom_data ANTES de construir
                if (index === 0) {
                    console.log("\n🚨 [DEBUG CRÍTICO] Valores ANTES de construir custom_data:")
                    console.log("  debe:", debe, typeof debe)
                    console.log("  haber:", haber, typeof haber)
                    console.log("  importe:", importe, typeof importe)
                    console.log("  saldo:", saldo, typeof saldo)
                }

                return {
                    source: "bankinter-eur",
                    file_name: file.name,
                    date: isoDate,
                    description: descripcion || "Sin descripción",
                    amount: amount.toString(),
                    category: categoria || "Other",
                    classification: categoria || "Other",
                    reconciled: false,
                    custom_data: {
                        fecha_contable: fechaContable,
                        debe,
                        haber,
                        importe,
                        saldo,
                        referencia,
                        clave,
                        categoria,
                        row_index: headerRowIndex + index + 2,
                        file_name: file.name
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

        // DEBUG: Log específico do custom_data da primeira linha
        if (rows.length > 0) {
            console.log("\n🔍 [DEBUG] custom_data da primeira linha:")
            console.log("  debe:", rows[0].custom_data.debe, typeof rows[0].custom_data.debe)
            console.log("  haber:", rows[0].custom_data.haber, typeof rows[0].custom_data.haber)
            console.log("  importe:", rows[0].custom_data.importe, typeof rows[0].custom_data.importe)
            console.log("  saldo:", rows[0].custom_data.saldo, typeof rows[0].custom_data.saldo)
        }

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
