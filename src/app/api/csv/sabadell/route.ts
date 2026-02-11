/**
 * API Route: Upload CSV Sabadell EUR
 * 
 * Processa arquivos CSV de extrato bancário do Banco Sabadell (formato espanhol)
 * Formato esperado: CSV com colunas Fecha, Concepto, Movimiento (EUR), Saldo
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: NextRequest) {
    try {
        console.log("🚀 [Sabadell EUR] Starting CSV processing...")

        const formData = await request.formData()
        const file = formData.get("file") as File

        if (!file) {
            console.error("❌ No file uploaded")
            return NextResponse.json(
                { success: false, error: "No file was uploaded" },
                { status: 400 }
            )
        }

        if (!file.name.toLowerCase().endsWith(".csv")) {
            console.error("❌ Invalid format:", file.name)
            return NextResponse.json(
                { success: false, error: "Invalid format. Please upload a CSV file from Sabadell" },
                { status: 400 }
            )
        }

        console.log("📁 File:", file.name, "| Size:", file.size, "bytes")

        const text = await file.text()
        const lines = text.split("\n").filter(line => line.trim())

        console.log("📋 Total lines:", lines.length)

        if (lines.length < 2) {
            return NextResponse.json(
                { success: false, error: "Empty or invalid file" },
                { status: 400 }
            )
        }

        // Parse headers (first line) - Sabadell uses ; as separator
        const headerLine = lines[0]
        const separator = headerLine.includes(";") ? ";" : ","
        const headers = parseCSVLine(headerLine, separator).map(h => h.trim().toUpperCase())
        console.log("🔑 Headers found:", headers)
        console.log("📌 Separator detected:", separator)

        // Map column indices - Sabadell format (Spanish)
        const colIndex = {
            fecha: headers.findIndex(h => h.includes("FECHA")),
            concepto: headers.findIndex(h => h.includes("CONCEPTO") || h.includes("DESCRIPCION") || h.includes("DESCRIPTION")),
            movimiento: headers.findIndex(h => h.includes("MOVIMIENTO") || h.includes("IMPORTE") || h.includes("AMOUNT")),
            saldo: headers.findIndex(h => h.includes("SALDO") || h.includes("BALANCE")),
            referencia: headers.findIndex(h => h.includes("REFERENCIA") || h.includes("REF")),
            categoria: headers.findIndex(h => h.includes("CATEGORIA") || h.includes("CATEGORY"))
        }

        console.log("\n🗺️ Column mapping:")
        console.log("  FECHA:", colIndex.fecha !== -1 ? `Column ${colIndex.fecha}` : "❌")
        console.log("  CONCEPTO:", colIndex.concepto !== -1 ? `Column ${colIndex.concepto}` : "❌")
        console.log("  MOVIMIENTO:", colIndex.movimiento !== -1 ? `Column ${colIndex.movimiento}` : "❌")
        console.log("  SALDO:", colIndex.saldo !== -1 ? `Column ${colIndex.saldo}` : "⚠️")
        console.log("  REFERENCIA:", colIndex.referencia !== -1 ? `Column ${colIndex.referencia}` : "⚠️")

        // Validate required columns
        if (colIndex.fecha === -1 || colIndex.concepto === -1 || colIndex.movimiento === -1) {
            return NextResponse.json(
                { success: false, error: "Required columns not found (Fecha, Concepto, Movimiento)" },
                { status: 400 }
            )
        }

        // Process data rows
        const dataLines = lines.slice(1)
        let processedCount = 0
        let skippedCount = 0
        let totalCredits = 0
        let totalDebits = 0
        let lastBalance = 0

        const rows = []

        for (let i = 0; i < dataLines.length; i++) {
            try {
                const row = parseCSVLine(dataLines[i], separator)

                if (row.length < 3) {
                    skippedCount++
                    continue
                }

                const fechaRaw = colIndex.fecha !== -1 ? row[colIndex.fecha]?.trim() : null
                const concepto = colIndex.concepto !== -1 ? row[colIndex.concepto]?.trim() : ""
                const movimientoRaw = colIndex.movimiento !== -1 ? row[colIndex.movimiento]?.trim() : null
                const saldoRaw = colIndex.saldo !== -1 ? row[colIndex.saldo]?.trim() : null
                const referencia = colIndex.referencia !== -1 ? row[colIndex.referencia]?.trim() : null
                const categoria = colIndex.categoria !== -1 ? row[colIndex.categoria]?.trim() : null

                // Debug first row
                if (i === 0) {
                    console.log("\n🔍 [DEBUG] FIRST ROW - Raw values:")
                    console.log("  fechaRaw:", fechaRaw)
                    console.log("  concepto:", concepto)
                    console.log("  movimientoRaw:", movimientoRaw)
                    console.log("  saldoRaw:", saldoRaw)
                    console.log("  referencia:", referencia)
                }

                // Skip empty rows
                if (!fechaRaw && !concepto) {
                    skippedCount++
                    continue
                }

                // Parse date (DD/MM/YYYY format - Spanish)
                const dateISO = parseEUDate(fechaRaw)
                if (!dateISO) {
                    console.log(`⚠️ Row ${i + 2}: Invalid date "${fechaRaw}", skipping`)
                    skippedCount++
                    continue
                }

                // Parse amount (European format: 1.234,56)
                const amount = parseEUAmount(movimientoRaw)
                if (amount === null || isNaN(amount)) {
                    console.log(`⚠️ Row ${i + 2}: Invalid amount "${movimientoRaw}", skipping`)
                    skippedCount++
                    continue
                }

                // Parse balance
                const balance = parseEUAmount(saldoRaw)
                if (balance !== null) {
                    lastBalance = balance
                }

                // Track credits and debits
                if (amount > 0) {
                    totalCredits += amount
                } else {
                    totalDebits += amount
                }

                const rowId = `sabadell-${uuidv4()}`

                rows.push({
                    id: rowId,
                    file_name: file.name,
                    source: "sabadell",
                    date: dateISO,
                    description: concepto,
                    amount: amount.toString(),
                    category: categoria || "Other",
                    classification: "Other",
                    reconciled: false,
                    custom_data: {
                        fecha: fechaRaw,
                        fecha_iso: dateISO,
                        concepto: concepto,
                        referencia: referencia,
                        categoria: categoria,
                        debit: amount < 0 ? amount : null,
                        credit: amount > 0 ? amount : null,
                        balance: balance,
                        row_index: i + 2,
                        file_name: file.name,
                        imported_at: new Date().toISOString()
                    }
                })

                processedCount++
            } catch (err) {
                console.error(`❌ Error processing row ${i + 2}:`, err)
                skippedCount++
            }
        }

        console.log(`\n📊 Processing complete: ${processedCount} rows, ${skippedCount} skipped`)

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, error: "No valid rows found in file" },
                { status: 400 }
            )
        }

        // Insert into Supabase
        if (!supabaseAdmin) {
            throw new Error("Supabase not configured")
        }

        // Deduplication: fetch existing rows to avoid duplicates on re-upload
        console.log(`\n🔍 Checking for duplicates...`)
        const { data: existingRows } = await supabaseAdmin
            .from("csv_rows")
            .select("date, description, amount")
            .eq("source", "sabadell")

        const existingKeys = new Set(
            (existingRows || []).map(r => `${r.date}|${r.description}|${r.amount}`)
        )

        const newRows = rows.filter(row => {
            const key = `${row.date}|${row.description}|${row.amount}`
            return !existingKeys.has(key)
        })

        const duplicateCount = rows.length - newRows.length
        console.log(`📊 Total: ${rows.length} | Duplicates: ${duplicateCount} | New: ${newRows.length}`)

        if (newRows.length === 0) {
            console.log("⚠️ No new transactions to insert (all duplicates)")
            return NextResponse.json({
                success: true,
                data: {
                    rowCount: 0,
                    summary: {
                        totalCredits: totalCredits,
                        totalDebits: Math.abs(totalDebits),
                        finalBalance: lastBalance,
                        totalSkipped: skippedCount,
                        inserted: 0,
                        duplicates: duplicateCount
                    }
                },
                message: "Upload complete — no new transactions found (all already existed)"
            })
        }

        const { error } = await supabaseAdmin
            .from("csv_rows")
            .insert(newRows)

        if (error) {
            console.error("❌ Supabase error:", error)
            throw new Error(`Database error: ${error.message}`)
        }

        console.log(`✅ [Sabadell EUR] ${newRows.length} new rows inserted (${duplicateCount} duplicates skipped)`)

        return NextResponse.json({
            success: true,
            data: {
                rowCount: newRows.length,
                summary: {
                    totalCredits: totalCredits,
                    totalDebits: Math.abs(totalDebits),
                    finalBalance: lastBalance,
                    totalSkipped: skippedCount,
                    inserted: newRows.length,
                    duplicates: duplicateCount
                }
            }
        })

    } catch (error) {
        console.error("❌ [Sabadell EUR] Error:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line: string, separator: string = ","): string[] {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
        const char = line[i]

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"'
                i++
            } else {
                inQuotes = !inQuotes
            }
        } else if (char === separator && !inQuotes) {
            result.push(current)
            current = ""
        } else {
            current += char
        }
    }

    result.push(current)
    return result
}

/**
 * Parse European date format (DD/MM/YYYY) to ISO (YYYY-MM-DD)
 */
function parseEUDate(dateStr: string | null): string | null {
    if (!dateStr) return null

    const cleaned = dateStr.trim()

    // Try DD/MM/YYYY format (European)
    const match = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (match) {
        const day = match[1].padStart(2, "0")
        const month = match[2].padStart(2, "0")
        const year = match[3]
        return `${year}-${month}-${day}`
    }

    // Try YYYY-MM-DD format (already ISO)
    const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoMatch) {
        return cleaned
    }

    return null
}

/**
 * Parse European amount format (1.234,56 or -1.234,56)
 */
function parseEUAmount(amountStr: string | null): number | null {
    if (!amountStr) return null

    // Remove € and spaces
    let cleaned = amountStr.trim().replace(/€/g, "").replace(/\s/g, "")

    // Handle negative amounts with parentheses: (1.234,56)
    const isNegative = cleaned.startsWith("(") && cleaned.endsWith(")") || cleaned.startsWith("-")
    cleaned = cleaned.replace(/[()]/g, "").replace(/^-/, "")

    // European format: remove dots (thousand separators) and replace comma with dot (decimal)
    cleaned = cleaned.replace(/\./g, "").replace(",", ".")

    const amount = parseFloat(cleaned)
    if (isNaN(amount)) return null

    return isNegative ? -amount : amount
}

export async function GET() {
    return NextResponse.json({
        status: "ok",
        endpoint: "Sabadell EUR CSV Upload",
        format: "CSV with columns: Fecha, Concepto, Movimiento (EUR), Saldo",
        source: "sabadell"
    })
}
