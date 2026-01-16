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
import { formatTimestamp } from "@/lib/formatters"

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
const formatEUDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "-"

    try {
        const date = new Date(dateString)
        if (isNaN(date.getTime())) return dateString

        const day = date.getDate().toString().padStart(2, "0")
        const month = (date.getMonth() + 1).toString().padStart(2, "0")
        const year = date.getFullYear()

        return `${day}/${month}/${year}`
    } catch {
        return dateString
    }
}

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
        if (!source) return { bg: "bg-gray-100", text: "text-gray-400", border: "border-gray-200" }
        return paymentSourceColors[source] || { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200" }
    }

    // Calcular estatísticas
    const calculateStats = () => {
        const totalIncomes = filteredRows.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0)
        const totalExpenses = filteredRows.filter((row) => row.amount < 0).reduce((sum, row) => sum + row.amount, 0)
        const incomesBySource = filteredRows
            .filter((row) => row.amount > 0 && row.paymentSource)
            .reduce((acc, row) => {
                acc[row.paymentSource!] = (acc[row.paymentSource!] || 0) + row.amount
                return acc
            }, {} as Record<string, number>)
        const unreconciledCount = filteredRows.filter((row) => !row.conciliado).length

        return { totalIncomes, totalExpenses, incomesBySource, unreconciledCount }
    }

    const { totalIncomes, totalExpenses, incomesBySource, unreconciledCount } = calculateStats()

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-[#004E8C]" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white">
            <div>
                <header className="border-b border-[#0f1c34] bg-[#004E8C] text-white shadow-lg sticky top-0 z-30">
                    <div className="container mx-auto px-6 py-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Link href="/">
                                    <Button variant="ghost" size="sm" className="gap-2 text-white hover:bg-white/10">
                                        <ArrowLeft className="h-4 w-4" />
                                        Back
                                    </Button>
                                </Link>
                                <div>
                                    <h1 className="text-2xl font-bold text-white">Sabadell EUR - Bank Statement</h1>
                                    <div className="flex items-center gap-4 mt-1">
                                        <p className="text-sm text-gray-200">
                                            {rows.length} records ({filteredRows.length} filtered)
                                        </p>
                                        {lastSaved && (
                                            <p className="text-sm text-blue-200 flex items-center gap-1">
                                                <Database className="h-3 w-3" />
                                                Last Saved: {lastSaved}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="gap-2 border-white text-white hover:bg-white/10">
                                    <Settings className="h-4 w-4" />
                                    Settings
                                </Button>
                                <Button
                                    onClick={saveAllChanges}
                                    disabled={isSaving || rows.length === 0}
                                    className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Database className="h-4 w-4" />
                                            Save All Changes
                                        </>
                                    )}
                                </Button>
                                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="file-upload-sabadell" />
                                <label htmlFor="file-upload-sabadell">
                                    <Button variant="outline" size="sm" className="gap-2 border-white text-white hover:bg-white/10" asChild>
                                        <span>
                                            <Upload className="h-4 w-4" />
                                            Upload CSV
                                        </span>
                                    </Button>
                                </label>
                                <Button
                                    onClick={loadData}
                                    disabled={isLoading}
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 border-white text-white hover:bg-white/10"
                                    title="Refresh data"
                                >
                                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </Button>
                                <Button onClick={downloadCSV} variant="outline" size="sm" className="gap-2 border-white text-white hover:bg-white/10">
                                    <Download className="h-4 w-4" />
                                    Download
                                </Button>
                                <Button onClick={handleDeleteAll} variant="outline" size="sm" className="gap-2 border-white text-white hover:bg-white/10" disabled={isDeleting || rows.length === 0}>
                                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    Delete All
                                </Button>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-white/80" />
                                <span className="text-sm font-medium text-white">Date Filters:</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-white/80">From:</label>
                                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40 bg-white/10 border-white/30 text-white" />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-white/80">To:</label>
                                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40 bg-white/10 border-white/30 text-white" />
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setDateFrom("")
                                    setDateTo("")
                                }}
                                className="gap-2 border-white text-white hover:bg-white/10"
                            >
                                <X className="h-4 w-4" />
                                Clear Filters
                            </Button>
                        </div>

                        {saveSuccess && (
                            <Alert className="mt-4 border-2 border-emerald-500 bg-emerald-50">
                                <CheckCircle className="h-5 w-5 text-emerald-600" />
                                <AlertDescription className="text-emerald-800 font-medium">
                                    ✅ All changes saved successfully to database! Last saved: {lastSaved}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </header>

                {/* 🏦 Account Information Card */}
                <div className="container mx-auto px-6 py-4">
                    <Card className="bg-gradient-to-r from-[#004E8C] to-[#003366] border-0 shadow-xl">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                                        <Database className="h-8 w-8 text-white" />
                                    </div>
                                    <div className="text-white">
                                        <h3 className="text-lg font-bold">Banco Sabadell</h3>
                                        <div className="flex items-center gap-4 mt-1 text-sm">
                                            <span className="flex items-center gap-1">
                                                <span className="font-semibold">Account:</span> Business EUR
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="font-semibold">Currency:</span> EUR (€)
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="font-semibold">Country:</span> Spain
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right text-white">
                                    <p className="text-sm opacity-90">Current Balance</p>
                                    <p className="text-2xl font-bold">
                                        {rows.length > 0
                                            ? formatEURCurrency(rows.reduce((sum, r) => sum + r.amount, 0))
                                            : "0,00 €"
                                        }
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="container mx-auto px-6 py-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">Total Credits</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{formatEURCurrency(totalIncomes)}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">Total Debits</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">{formatEURCurrency(Math.abs(totalExpenses))}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">Unreconciled Entries</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-orange-600">{unreconciledCount}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">Credits by Source</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
                                    {Object.entries(incomesBySource).map(([source, amount]) => (
                                        <div key={source} className="flex justify-between text-sm">
                                            <span>{source}:</span>
                                            <span className="font-medium">{formatEURCurrency(amount)}</span>
                                        </div>
                                    ))}
                                    {Object.keys(incomesBySource).length === 0 && <div className="text-sm text-gray-500">No reconciled credits</div>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-xl border-2 border-gray-200">
                        <CardHeader className="bg-[#004E8C] text-white">
                            <CardTitle className="text-white">Bank Statement Details</CardTitle>
                            <CardDescription className="text-white/90">
                                Upload CSV files - Columns: Fecha → Date | Concepto → Description | Movimiento → Amount
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b-2 border-gray-200 bg-gray-50">
                                            <th className="text-left py-4 px-4 font-bold text-sm text-black w-20">ID</th>
                                            <th className="text-left py-4 px-4 font-bold text-sm text-black">Date</th>
                                            <th className="text-left py-4 px-4 font-bold text-sm text-black">Reference</th>
                                            <th className="text-left py-4 px-4 font-bold text-sm text-black min-w-64">Description</th>
                                            <th className="text-right py-4 px-4 font-bold text-sm text-black">Debit</th>
                                            <th className="text-right py-4 px-4 font-bold text-sm text-black">Credit</th>
                                            <th className="text-right py-4 px-4 font-bold text-sm text-black">Amount</th>
                                            <th className="text-right py-4 px-4 font-bold text-sm text-black">Balance</th>
                                            <th className="text-center py-4 px-4 font-bold text-sm text-black">Payment Source</th>
                                            <th className="text-center py-4 px-4 font-bold text-sm text-black">Reconciled</th>
                                            <th className="text-center py-4 px-4 font-bold text-sm text-black">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={11} className="py-8 text-center text-gray-500">
                                                    No data available. Upload a CSV file to get started.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRows.map((row) => {
                                                const sourceStyle = getPaymentSourceStyle(row.paymentSource)
                                                const customData = row.custom_data || {}

                                                return (
                                                    <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50">
                                                        <td className="py-3 px-4 text-sm font-bold text-black">{row.id.substring(0, 6)}...</td>
                                                        <td className="py-3 px-4 text-sm text-black font-medium">
                                                            {formatEUDate(row.date)}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-700">
                                                            {customData.referencia || "-"}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-black max-w-xs">
                                                            <div className="truncate" title={row.description}>{row.description}</div>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-right text-red-600 font-mono">
                                                            {(customData.debit && customData.debit !== 0) ? formatEURCurrency(Math.abs(customData.debit)) : "-"}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-right text-green-600 font-mono">
                                                            {(customData.credit && customData.credit !== 0) ? formatEURCurrency(Math.abs(customData.credit)) : "-"}
                                                        </td>
                                                        <td className={`py-3 px-4 text-sm text-right font-bold font-mono ${row.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {formatEURCurrency(row.amount)}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-right font-medium text-black font-mono">
                                                            {formatEURCurrency(customData.balance)}
                                                        </td>
                                                        <td className="py-3 px-4 text-center text-sm">
                                                            {editingRow === row.id ? (
                                                                <Select
                                                                    value={editedData.paymentSource || ""}
                                                                    onValueChange={(value) => setEditedData({ ...editedData, paymentSource: value })}
                                                                >
                                                                    <SelectTrigger className="w-full">
                                                                        <SelectValue placeholder="Select source" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="Braintree EUR">Braintree EUR</SelectItem>
                                                                        <SelectItem value="Braintree USD">Braintree USD</SelectItem>
                                                                        <SelectItem value="Stripe EUR">Stripe EUR</SelectItem>
                                                                        <SelectItem value="GoCardless">GoCardless</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : row.paymentSource ? (
                                                                <span
                                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sourceStyle.bg} ${sourceStyle.text} border ${sourceStyle.border}`}
                                                                >
                                                                    {row.paymentSource}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400 text-xs">N/A</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            {row.conciliado ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    {row.reconciliationType === "automatic" ? (
                                                                        <div className="relative group">
                                                                            <Zap className="h-5 w-5 text-green-600 mx-auto" />
                                                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none min-w-[220px] text-left z-50">
                                                                                <div className="font-bold text-emerald-300 mb-1">⚡ Automatic reconciliation</div>
                                                                                {row.bankMatchDate && (
                                                                                    <div className="flex items-center gap-1 text-white/90">
                                                                                        <Calendar className="h-3 w-3" />
                                                                                        <span>{formatEUDate(row.bankMatchDate)}</span>
                                                                                    </div>
                                                                                )}
                                                                                {row.bankMatchAmount !== null && row.bankMatchAmount !== undefined && (
                                                                                    <div className="flex items-center gap-1 text-white/90">
                                                                                        <Euro className="h-3 w-3" />
                                                                                        <span>{formatEURCurrency(row.bankMatchAmount)}</span>
                                                                                    </div>
                                                                                )}
                                                                                {row.bankMatchDescription && (
                                                                                    <div className="flex items-start gap-1 text-white/90 mt-1">
                                                                                        <FileText className="h-3 w-3 mt-0.5" />
                                                                                        <span className="text-[10px] leading-snug">{row.bankMatchDescription.substring(0, 80)}{row.bankMatchDescription.length > 80 ? "..." : ""}</span>
                                                                                    </div>
                                                                                )}
                                                                                {row.reconciledAt && (
                                                                                    <div className="text-[10px] text-white/60 mt-2">Reconciled at: {formatTimestamp(new Date(row.reconciledAt))}</div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="relative group">
                                                                            <User className="h-5 w-5 text-blue-600 mx-auto" />
                                                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                                                                Manual reconciliation
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <XCircle className="h-5 w-5 text-gray-400 mx-auto" />
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            {editingRow === row.id ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <Button size="sm" onClick={saveEdit} variant="outline" className="gap-2">
                                                                        <Save className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={cancelEdit}
                                                                        className="h-8 w-8 p-0"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => startEditing(row)}
                                                                        className="h-8 w-8 p-0 text-black hover:bg-gray-100"
                                                                        disabled={isDeleting}
                                                                    >
                                                                        <Edit2 className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => handleDeleteRow(row.id)}
                                                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                        disabled={isDeleting}
                                                                    >
                                                                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
