"use client"

import React, { useState, useEffect } from "react"
import {
    Upload,
    Download,
    Edit2,
    Save,
    X,
    Trash2,
    ArrowLeft,
    Loader2,
    CheckCircle,
    XCircle,
    Settings,
    Database,
    Zap,
    User,
    Filter,
    RefreshCw,
    Calendar,
    Euro,
    FileText
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { formatTimestamp, formatDate } from "@/lib/formatters"

// Formatar números no padrão europeu: 19172.80 → 19.172,80 €
const formatEURCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return "-"

    const formatted = new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value)

    return formatted
}

// Formatar data: Date → "DD/MM/YYYY"
interface SabadellRow {
    id: string
    date: string
    description: string
    amount: number
    conciliado: boolean
    paymentSource?: string | null
    reconciliationType?: "automatic" | "manual" | null
    destinationAccount?: string | null
    reconciledAt?: string | null
    bankMatchAmount?: number | null
    bankMatchDate?: string | null
    bankMatchDescription?: string | null
    custom_data?: {
        fecha?: string | null
        fecha_iso?: string | null
        concepto?: string | null
        referencia?: string | null
        categoria?: string | null
        debit?: number
        credit?: number
        balance?: number
        row_index?: number
        file_name?: string
    }
    [key: string]: any
}

// Mapeamento de cores por fonte de pagamento
const paymentSourceColors: { [key: string]: { bg: string; text: string; border: string } } = {
    "Braintree EUR": { bg: "bg-[#002991]/10", text: "text-[#002991]", border: "border-[#002991]/20" },
    "Braintree USD": { bg: "bg-[#002991]/10", text: "text-[#002991]", border: "border-[#002991]/20" },
    "Stripe EUR": { bg: "bg-[#635BFF]/10", text: "text-[#635BFF]", border: "border-[#635BFF]/20" },
    "GoCardless": { bg: "bg-[#F1F252]/20", text: "text-black", border: "border-[#F1F252]/40" },
}

export default function SabadellPage() {
    const [rows, setRows] = useState<SabadellRow[]>([])
    const [filteredRows, setFilteredRows] = useState<SabadellRow[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [editingRow, setEditingRow] = useState<string | null>(null)
    const [editedData, setEditedData] = useState<Partial<SabadellRow>>({})
    const [isDeleting, setIsDeleting] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState<string | null>(null)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [dateFrom, setDateFrom] = useState<string>("")
    const [dateTo, setDateTo] = useState<string>("")
    const [isAutoReconciling, setIsAutoReconciling] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        applyFilters()
    }, [rows, dateFrom, dateTo])

    const applyFilters = () => {
        let filtered = rows

        if (dateFrom) {
            filtered = filtered.filter((row) => row.date >= dateFrom)
        }

        if (dateTo) {
            filtered = filtered.filter((row) => row.date <= dateTo)
        }

        setFilteredRows(filtered)
    }

    const loadData = async () => {
        setIsLoading(true)
        try {
            if (!supabase) {
                console.warn("Supabase not configured")
                setRows([])
                setIsLoading(false)
                return
            }

            const { data: rowsData, error } = await supabase
                .from("csv_rows")
                .select("*")
                .eq("source", "sabadell")
                .order("date", { ascending: false })

            if (error) {
                console.error("Error loading data:", error)
                setRows([])
            } else if (rowsData) {
                const mappedRows: SabadellRow[] = rowsData.map((row) => ({
                    id: row.id,
                    date: row.custom_data?.fecha_iso || row.date,
                    description: row.description || row.custom_data?.concepto || "",
                    amount: parseFloat(row.amount) || 0,
                    conciliado: (row as any).reconciled ?? row.custom_data?.conciliado ?? false,
                    paymentSource: row.custom_data?.paymentSource || row.custom_data?.destinationAccount || null,
                    reconciliationType: row.custom_data?.reconciliationType || ((row as any).reconciled ? "automatic" : null),
                    destinationAccount: row.custom_data?.destinationAccount || null,
                    reconciledAt: row.custom_data?.reconciled_at || null,
                    bankMatchAmount: row.custom_data?.bank_match_amount || null,
                    bankMatchDate: row.custom_data?.bank_match_date || null,
                    bankMatchDescription: row.custom_data?.bank_match_description || null,
                    custom_data: row.custom_data || {}
                }))
                setRows(mappedRows)
            } else {
                setRows([])
            }
        } catch (error) {
            console.error("Error loading data:", error)
            setRows([])
        } finally {
            setIsLoading(false)
        }
    }

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setIsLoading(true)
        const formData = new FormData()
        formData.append("file", file)

        try {
            console.log('📤 Uploading file:', file.name)

            const response = await fetch("/api/csv/sabadell", {
                method: "POST",
                body: formData
            })

            const result = await response.json()
            console.log('📥 Response:', result)

            if (!response.ok || !result.success) {
                console.error("Upload error:", result.error)
                alert(`❌ Upload error: ${result.error}`)
                return
            }

            const summary = result.data?.summary
            let message = `✅ ${result.data.rowCount} transactions imported!`

            if (summary) {
                message += `\n\n📊 Summary:`
                message += `\n• Total Credits: ${formatEURCurrency(summary.totalCredits)}`
                message += `\n• Total Debits: ${formatEURCurrency(summary.totalDebits)}`
                message += `\n• Final Balance: ${formatEURCurrency(summary.finalBalance)}`
                if (summary.totalSkipped > 0) {
                    message += `\n• Rows skipped: ${summary.totalSkipped}`
                }
            }

            alert(message)
            loadData()
        } catch (err) {
            console.error("Unexpected error:", err)
            alert("❌ Failed to upload file. Check format and try again.")
        } finally {
            setIsLoading(false)
            event.target.value = ""
        }
    }

    const saveAllChanges = async () => {
        setIsSaving(true)
        setSaveSuccess(false)

        try {
            const rowsToInsert = rows.map((row) => ({
                id: row.id,
                file_name: "sabadell.csv",
                source: "sabadell",
                date: row.date,
                description: row.description,
                amount: row.amount.toString(),
                category: "Other",
                classification: "Other",
                reconciled: row.conciliado,
                custom_data: {
                    ...row.custom_data,
                    id: row.id,
                    date: row.date,
                    description: row.description,
                    amount: row.amount,
                    conciliado: row.conciliado,
                    paymentSource: row.paymentSource,
                    reconciliationType: row.reconciliationType,
                    destinationAccount: row.destinationAccount,
                    reconciled_at: row.reconciledAt,
                    bank_match_amount: row.bankMatchAmount,
                    bank_match_date: row.bankMatchDate,
                    bank_match_description: row.bankMatchDescription
                }
            }))

            const response = await fetch("/api/csv-rows", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows: rowsToInsert, source: "sabadell" })
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                console.error("Error updating database:", result.error)
                alert(`❌ Error updating database: ${result.error || "Unknown error"}`)
                return
            }

            const now = new Date()
            const formattedTime = formatTimestamp(now)
            setLastSaved(formattedTime)
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 3000)
        } catch (error) {
            console.error("Error saving data:", error)
            alert("Error saving data. Please check your Supabase configuration.")
        } finally {
            setIsSaving(false)
        }
    }

    const startEditing = (row: SabadellRow) => {
        setEditingRow(row.id)
        setEditedData({ ...row })
    }

    const saveEdit = async () => {
        if (!editingRow) return

        const updatedRows = rows.map((row) =>
            row.id === editingRow ? { ...row, ...editedData, reconciliationType: "manual" as const } : row
        )
        setRows(updatedRows)

        const rowToUpdate = updatedRows.find((r) => r.id === editingRow)
        if (rowToUpdate && supabase) {
            try {
                const { error } = await supabase
                    .from("csv_rows")
                    .update({
                        date: rowToUpdate.date,
                        description: rowToUpdate.description,
                        amount: rowToUpdate.amount.toString(),
                        reconciled: rowToUpdate.conciliado,
                        custom_data: {
                            ...rowToUpdate.custom_data,
                            id: rowToUpdate.id,
                            date: rowToUpdate.date,
                            description: rowToUpdate.description,
                            amount: rowToUpdate.amount,
                            conciliado: rowToUpdate.conciliado,
                            paymentSource: rowToUpdate.paymentSource,
                            reconciliationType: rowToUpdate.reconciliationType,
                            destinationAccount: rowToUpdate.destinationAccount,
                            reconciled_at: rowToUpdate.reconciledAt,
                            bank_match_amount: rowToUpdate.bankMatchAmount,
                            bank_match_date: rowToUpdate.bankMatchDate,
                            bank_match_description: rowToUpdate.bankMatchDescription
                        }
                    })
                    .eq("id", rowToUpdate.id)

                if (error) {
                    console.error("Error updating row:", error)
                    alert(`❌ Error updating row: ${error.message}`)
                } else {
                    const now = new Date()
                    const formattedTime = formatTimestamp(now)
                    setLastSaved(formattedTime)
                }
            } catch (error) {
                console.error("Error updating row:", error)
            }
        }

        setEditingRow(null)
        setEditedData({})
    }

    const cancelEdit = () => {
        setEditingRow(null)
        setEditedData({})
    }

    const handleDeleteRow = async (rowId: string) => {
        if (!confirm("Are you sure you want to delete this row?")) return

        setIsDeleting(true)
        try {
            const response = await fetch(`/api/csv-rows?id=${rowId}`, {
                method: "DELETE"
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                console.error("Error deleting row:", result.error)
                alert(`❌ Error deleting row: ${result.error || "Unknown error"}`)
            } else {
                await loadData()

                const now = new Date()
                const formattedTime = formatTimestamp(now)
                setLastSaved(formattedTime)
            }
        } catch (error) {
            console.error("Error deleting row:", error)
            alert("Error deleting row. Please try again.")
        } finally {
            setIsDeleting(false)
        }
    }

    const handleDeleteAll = async () => {
        if (!confirm("⚠️ WARNING: This will DELETE ALL rows from Sabadell! Are you sure?")) return
        if (!confirm("⚠️ FINAL WARNING: This action CANNOT be undone! Continue?")) return

        setIsDeleting(true)
        try {
            const response = await fetch(`/api/csv-rows?source=sabadell`, {
                method: "DELETE"
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                console.error("Error deleting all rows:", result.error)
                alert(`❌ Error deleting rows: ${result.error || "Unknown error"}`)
            } else {
                await loadData()

                const now = new Date()
                const formattedTime = formatTimestamp(now)
                setLastSaved(formattedTime)

                alert("✅ All rows deleted successfully!")
            }
        } catch (error) {
            console.error("Error deleting all rows:", error)
            alert("Error deleting rows. Please try again.")
        } finally {
            setIsDeleting(false)
        }
    }

    const deleteRow = async (id: string) => {
        if (!confirm("Eliminar esta fila?")) return
        try {
            const { error } = await supabase.from("csv_rows").delete().eq("id", id)
            if (error) throw error
            setRows((prev) => prev.filter((r) => r.id !== id))
        } catch (error) {
            console.error("Error deleting row:", error)
            alert("Error al eliminar la fila")
        }
    }

    const handleAutoReconcile = async () => {
        setIsAutoReconciling(true)
        try {
            const response = await fetch("/api/reconcile/bank-disbursement", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bankSource: "sabadell",
                    dryRun: false
                })
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                console.error("Auto-reconcile error:", result.error)
                alert(`❌ Auto-Reconcile Error: ${result.error || "Unknown error"}`)
                return
            }

            const { matched, unmatched, total } = result

            let message = `✅ Auto-Reconciliation Complete!\n\n`
            message += `📊 Results:\n`
            message += `• Total bank transactions: ${total}\n`
            message += `• Matched: ${matched}\n`
            message += `• Unmatched: ${unmatched}\n`
            message += `• Match rate: ${total > 0 ? ((matched / total) * 100).toFixed(1) : 0}%`

            alert(message)
            loadData() // Reload data to show updated reconciliation status
        } catch (error) {
            console.error("Auto-reconcile error:", error)
            alert("❌ Failed to auto-reconcile. Please try again.")
        } finally {
            setIsAutoReconciling(false)
        }
    }

    const downloadCSV = () => {
        try {
            const headers = ["ID", "Date", "Description", "Amount", "Payment Source", "Reconciled"]

            const csvContent = [
                headers.join(","),
                ...filteredRows.map((row) =>
                    [
                        row.id.substring(0, 8) + "...",
                        row.date,
                        `"${row.description.replace(/"/g, '""')}"`,
                        row.amount.toFixed(2),
                        row.paymentSource || "N/A",
                        row.conciliado ? "Yes" : "No"
                    ].join(",")
                )
            ].join("\n")

            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `sabadell-${new Date().toISOString().split("T")[0]}.csv`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error("Error saving CSV file:", error)
            alert("Error downloading CSV file")
        }
    }

    const getPaymentSourceStyle = (source: string | null | undefined) => {
        if (!source) return { bg: "bg-gray-100", text: "text-gray-500 dark:text-gray-400", border: "border-gray-200" }
        return paymentSourceColors[source] || { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200" }
    }

    // Calcular estatísticas com saldo inicial e final
    const calculateStats = () => {
        if (filteredRows.length === 0) {
            return {
                totalIncomes: 0,
                totalExpenses: 0,
                incomesBySource: {} as Record<string, number>,
                unreconciledCount: 0,
                openingBalance: 0,
                closingBalance: 0,
                oldestDate: null as string | null,
                newestDate: null as string | null
            }
        }

        // Ordenar por data (mais antiga primeiro)
        const sortedByDate = [...filteredRows].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        )

        const totalIncomes = filteredRows.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0)
        const totalExpenses = filteredRows.filter((row) => row.amount < 0).reduce((sum, row) => sum + Math.abs(row.amount), 0)
        const incomesBySource = filteredRows
            .filter((row) => row.amount > 0 && row.paymentSource)
            .reduce((acc, row) => {
                acc[row.paymentSource!] = (acc[row.paymentSource!] || 0) + row.amount
                return acc
            }, {} as Record<string, number>)
        const unreconciledCount = filteredRows.filter((row) => !row.conciliado).length

        // Usar balance real do CSV (primeira transação = opening, última = closing)
        const firstRow = sortedByDate[0]
        const lastRow = sortedByDate[sortedByDate.length - 1]

        // Opening Balance = balance da primeira transação MENOS o amount dessa transação
        // (para obter o saldo ANTES dessa transação)
        const firstBalance = firstRow.custom_data?.balance ?? 0
        const openingBalance = firstBalance - firstRow.amount

        // Closing Balance = balance da última transação (saldo APÓS todas as transações)
        const closingBalance = lastRow.custom_data?.balance ?? 0

        const oldestDate = firstRow.date
        const newestDate = lastRow.date

        return { totalIncomes, totalExpenses, incomesBySource, unreconciledCount, openingBalance, closingBalance, oldestDate, newestDate }
    }

    const stats = calculateStats()

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#1e1f21]">
                <Loader2 className="h-12 w-12 animate-spin text-[#004E8C]" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white dark:bg-[#1e1f21] text-gray-900 dark:text-white">
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#004E8C] p-2 rounded-lg">
                            <Database className="h-6 w-6 text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold">Sabadell EUR - Bank Statement</h1>
                            <div className="flex items-center gap-4 mt-1">
                                <span className="text-gray-500 dark:text-gray-400 text-sm">{rows.length} records ({filteredRows.length} filtered)</span>
                                {lastSaved && (
                                    <>
                                        <span className="text-gray-600">•</span>
                                        <span className="text-blue-400 text-sm flex items-center gap-1">
                                            <Database className="h-3 w-3" />
                                            Last saved: {lastSaved}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Current Balance</p>
                        <p className={`text-2xl font-bold ${stats.closingBalance >= 0 ? "text-green-400" : "text-red-400"}`}>
                            €{formatEURCurrency(stats.closingBalance)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="file-upload-sabadell" />
                    <label htmlFor="file-upload-sabadell">
                        <Button variant="outline" size="sm" className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700" asChild>
                            <span><Upload className="h-4 w-4 mr-1" />Upload CSV</span>
                        </Button>
                    </label>
                    <Button onClick={loadData} disabled={isLoading} variant="outline" size="sm" className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
                        <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />Refresh
                    </Button>
                    <Button onClick={handleAutoReconcile} disabled={isAutoReconciling} variant="outline" size="sm" className="bg-transparent border-green-700 text-green-400 hover:bg-green-900/30">
                        {isAutoReconciling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                        Auto-Reconcile
                    </Button>
                    <Button onClick={downloadCSV} variant="outline" size="sm" className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
                        <Download className="h-4 w-4 mr-1" />Download
                    </Button>
                    <Button onClick={handleDeleteAll} variant="outline" size="sm" className="bg-transparent border-red-800 text-red-400 hover:bg-red-900/30" disabled={isDeleting || rows.length === 0}>
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                        Delete All
                    </Button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-3 bg-gray-100 dark:bg-[#252627]">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">Credits:</span>
                        <span className="text-green-400 font-medium">€{formatEURCurrency(stats.totalIncomes)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">Debits:</span>
                        <span className="text-red-400 font-medium">€{formatEURCurrency(stats.totalExpenses)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-yellow-500" />
                        <span className="text-gray-500 dark:text-gray-400 text-sm">Unreconciled:</span>
                        <span className="text-yellow-400 font-medium">{stats.unreconciledCount}</span>
                    </div>
                </div>
            </div>

            {/* Table Header */}
            <div className="sticky top-0 z-10 bg-gray-50 dark:bg-[#2a2b2d] border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <div className="flex items-center gap-1 px-4 py-2 text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase min-w-[800px]">
                    <div className="w-[70px] flex-shrink-0">Date</div>
                    <div className="flex-1 min-w-[200px]">Description</div>
                    <div className="w-[90px] flex-shrink-0 text-right">Debit</div>
                    <div className="w-[90px] flex-shrink-0 text-right">Credit</div>
                    <div className="w-[100px] flex-shrink-0 text-right">Balance</div>
                    <div className="w-[100px] flex-shrink-0 text-center">Source</div>
                    <div className="w-[80px] flex-shrink-0 text-center">Status</div>
                    <div className="w-[70px] flex-shrink-0 text-center">Actions</div>
                </div>
            </div>

            {/* Content */}
            <div className="pb-20 overflow-x-auto">
                {filteredRows.map((row) => {
                    const sourceStyle = getPaymentSourceStyle(row.paymentSource);
                    const isDebit = row.amount < 0;
                    const isCredit = row.amount > 0;
                    const customData = row.custom_data || {};

                    return (
                        <div
                            key={row.id}
                            className="flex items-center gap-1 px-4 py-2 hover:bg-gray-50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-800/50 min-w-[800px]"
                        >
                            <div className="w-[70px] flex-shrink-0 text-[11px] text-gray-700 dark:text-gray-300">
                                {formatDate(row.date)}
                            </div>
                            <div className="flex-1 min-w-[200px] text-[11px] text-gray-900 dark:text-white truncate" title={row.description}>
                                {row.description}
                            </div>
                            <div className="w-[90px] flex-shrink-0 text-right text-[11px] font-mono">
                                {isDebit ? (
                                    <span className="text-red-400">€{formatEURCurrency(Math.abs(row.amount))}</span>
                                ) : (
                                    <span className="text-gray-600">-</span>
                                )}
                            </div>
                            <div className="w-[90px] flex-shrink-0 text-right text-[11px] font-mono">
                                {isCredit ? (
                                    <span className="text-green-400">€{formatEURCurrency(row.amount)}</span>
                                ) : (
                                    <span className="text-gray-600">-</span>
                                )}
                            </div>
                            <div className="w-[100px] flex-shrink-0 text-right text-[11px] font-mono font-medium text-gray-900 dark:text-white">
                                €{formatEURCurrency(customData.balance || 0)}
                            </div>
                            <div className="w-[100px] flex-shrink-0 text-center">
                                {row.paymentSource ? (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${sourceStyle.bg} ${sourceStyle.text} border ${sourceStyle.border}`}>
                                        {row.paymentSource}
                                    </span>
                                ) : (
                                    <span className="text-gray-600 text-[10px]">-</span>
                                )}
                            </div>
                            <div className="w-[80px] flex-shrink-0 text-center">
                                {row.conciliado ? (
                                    <div className="flex items-center justify-center gap-1">
                                        {row.reconciliationType === "automatic" ? (
                                            <Zap className="h-3.5 w-3.5 text-green-500" />
                                        ) : (
                                            <User className="h-3.5 w-3.5 text-blue-500" />
                                        )}
                                    </div>
                                ) : (
                                    <XCircle className="h-3.5 w-3.5 text-yellow-500 mx-auto" />
                                )}
                            </div>
                            <div className="w-[70px] flex-shrink-0 flex items-center justify-center gap-1">
                                {editingRow === row.id ? (
                                    <>
                                        <Button size="sm" variant="ghost" onClick={saveEdit} className="h-6 w-6 p-0 text-green-400 hover:text-green-300 hover:bg-green-900/30">
                                            <Save className="h-3 w-3" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button size="sm" variant="ghost" onClick={() => startEditing(row)} className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
                                            <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => deleteRow(row.id)} className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-red-400 hover:bg-red-900/30">
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    )
}
