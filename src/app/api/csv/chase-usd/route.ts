/**
 * API Route: Upload CSV Chase USD
 * 
 * Processa arquivos CSV de extrato bancário do Chase Bank (formato americano)
 * Formato esperado: CSV com colunas Details, Posting Date, Description, Amount, Type, Balance, Check or Slip #
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: NextRequest) {
    try {
        console.log("🚀 [Chase USD] Starting CSV processing...")

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
                { success: false, error: "Invalid format. Please upload a CSV file from Chase" },
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

        // Parse headers (first line)
        const headerLine = lines[0]
        const headers = parseCSVLine(headerLine).map(h => h.trim().toUpperCase())
        console.log("🔑 Headers found:", headers)

        // Map column indices - Chase format
        const colIndex = {
            details: headers.findIndex(h => h.includes("DETAILS")),
            postingDate: headers.findIndex(h => h.includes("POSTING") && h.includes("DATE")),
            description: headers.findIndex(h => h === "DESCRIPTION"),
            amount: headers.findIndex(h => h === "AMOUNT"),
            type: headers.findIndex(h => h === "TYPE"),
            balance: headers.findIndex(h => h === "BALANCE"),
            checkNumber: headers.findIndex(h => h.includes("CHECK") || h.includes("SLIP"))
        }

        console.log("\n🗺️ Column mapping:")
        console.log("  DETAILS:", colIndex.details !== -1 ? `Column ${colIndex.details}` : "❌")
        console.log("  POSTING DATE:", colIndex.postingDate !== -1 ? `Column ${colIndex.postingDate}` : "❌")
        console.log("  DESCRIPTION:", colIndex.description !== -1 ? `Column ${colIndex.description}` : "❌")
        console.log("  AMOUNT:", colIndex.amount !== -1 ? `Column ${colIndex.amount}` : "❌")
        console.log("  TYPE:", colIndex.type !== -1 ? `Column ${colIndex.type}` : "⚠️")
        console.log("  BALANCE:", colIndex.balance !== -1 ? `Column ${colIndex.balance}` : "⚠️")
        console.log("  CHECK #:", colIndex.checkNumber !== -1 ? `Column ${colIndex.checkNumber}` : "⚠️")

        // Validate required columns
        if (colIndex.postingDate === -1 || colIndex.description === -1 || colIndex.amount === -1) {
            return NextResponse.json(
                { success: false, error: "Required columns not found (Posting Date, Description, Amount)" },
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
                const row = parseCSVLine(dataLines[i])

                if (row.length < 3) {
                    skippedCount++
                    continue
                }

                const postingDateRaw = colIndex.postingDate !== -1 ? row[colIndex.postingDate]?.trim() : null
                const description = colIndex.description !== -1 ? row[colIndex.description]?.trim() : ""
                const amountRaw = colIndex.amount !== -1 ? row[colIndex.amount]?.trim() : null
                const details = colIndex.details !== -1 ? row[colIndex.details]?.trim() : null
                const type = colIndex.type !== -1 ? row[colIndex.type]?.trim() : null
                const balanceRaw = colIndex.balance !== -1 ? row[colIndex.balance]?.trim() : null
                const checkNumber = colIndex.checkNumber !== -1 ? row[colIndex.checkNumber]?.trim() : null

                // Debug first row
                if (i === 0) {
                    console.log("\n🔍 [DEBUG] FIRST ROW - Raw values:")
                    console.log("  postingDateRaw:", postingDateRaw)
                    console.log("  description:", description)
                    console.log("  amountRaw:", amountRaw)
                    console.log("  balanceRaw:", balanceRaw)
                    console.log("  details:", details)
                    console.log("  type:", type)
                }

                // Skip empty rows
                if (!postingDateRaw && !description) {
                    skippedCount++
                    continue
                }

                // Parse date (MM/DD/YYYY format)
                const dateISO = parseUSDate(postingDateRaw)
                if (!dateISO) {
                    console.log(`⚠️ Row ${i + 2}: Invalid date "${postingDateRaw}", skipping`)
                    skippedCount++
                    continue
                }

                // Parse amount (remove $ and commas)
                const amount = parseUSAmount(amountRaw)
                if (amount === null || isNaN(amount)) {
                    console.log(`⚠️ Row ${i + 2}: Invalid amount "${amountRaw}", skipping`)
                    skippedCount++
                    continue
                }

                // Parse balance
                const balance = parseUSAmount(balanceRaw)
                if (balance !== null) {
                    lastBalance = balance
                }

                // Track credits and debits
                if (amount > 0) {
                    totalCredits += amount
                } else {
                    totalDebits += amount
                }

                const rowId = `chase-usd-${uuidv4()}`

                rows.push({
                    id: rowId,
                    file_name: file.name,
                    source: "chase-usd",
                    date: dateISO,
                    description: description,
                    amount: amount.toString(),
                    category: "Other",
                    classification: "Other",
                    reconciled: false,
                    custom_data: {
                        post_date: postingDateRaw,
                        post_date_iso: dateISO,
                        details: details,
                        type: type,
                        check_number: checkNumber,
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
            .eq("source", "chase-usd")

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
                        totalDebits: totalDebits,
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

        console.log(`✅ [Chase USD] ${newRows.length} new rows inserted (${duplicateCount} duplicates skipped)`)

        return NextResponse.json({
            success: true,
            data: {
                rowCount: newRows.length,
                summary: {
                    totalCredits: totalCredits,
                    totalDebits: totalDebits,
                    finalBalance: lastBalance,
                    totalSkipped: skippedCount,
                    inserted: newRows.length,
                    duplicates: duplicateCount
                }
            }
        })

    } catch (error) {
        console.error("❌ [Chase USD] Error:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
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
        } else if (char === ',' && !inQuotes) {
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
 * Parse US date format (MM/DD/YYYY) to ISO (YYYY-MM-DD)
 */
function parseUSDate(dateStr: string | null): string | null {
    if (!dateStr) return null

    const cleaned = dateStr.trim()

    // Try MM/DD/YYYY format
    const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (match) {
        const month = match[1].padStart(2, "0")
        const day = match[2].padStart(2, "0")
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
 * Parse US amount format ($1,234.56 or -$1,234.56)
 */
function parseUSAmount(amountStr: string | null): number | null {
    if (!amountStr) return null

    // Remove $ and spaces
    let cleaned = amountStr.trim().replace(/\$/g, "").replace(/\s/g, "")

    // Handle negative amounts with parentheses: (1,234.56)
    const isNegative = cleaned.startsWith("(") && cleaned.endsWith(")") || cleaned.startsWith("-")
    cleaned = cleaned.replace(/[()]/g, "").replace(/^-/, "")

    // Remove commas (thousand separators)
    cleaned = cleaned.replace(/,/g, "")

    const amount = parseFloat(cleaned)
    if (isNaN(amount)) return null

    return isNegative ? -amount : amount
}

export async function GET() {
    return NextResponse.json({
        status: "ok",
        endpoint: "Chase USD CSV Upload",
        format: "CSV with columns: Posting Date, Description, Amount, Balance",
        source: "chase-usd"
    })
}
