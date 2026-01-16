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
    DollarSign,
    FileText,
    Key
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { formatTimestamp, formatDate } from "@/lib/formatters"

// Formatar USD no padrão brasileiro: $ 1.234,56
const formatUSDCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return "-"
    const isNegative = value < 0
    const absValue = Math.abs(value)
    const formatted = absValue.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
    return isNegative ? `$ (${formatted})` : `$ ${formatted}`
}

interface ChaseUSDRow {
    id: string
    date: string
    description: string
    amount: number
    conciliado: boolean
    paymentSource?: string | null
    reconciliationType?: "automatic" | "manual" | null
    destinationAccount?: string | null
    stripePayoutId?: string | null
    reconciledAt?: string | null
    bankMatchAmount?: number | null
    bankMatchDate?: string | null
    bankMatchDescription?: string | null
    custom_data?: {
        post_date?: string | null
        check_number?: string | null
        details?: string | null
        debit?: number
        credit?: number
        balance?: number
        category?: string
        row_index?: number
        file_name?: string
    }
    [key: string]: any
}

// Mapeamento de cores por fonte de pagamento
const paymentSourceColors: { [key: string]: { bg: string; text: string; border: string } } = {
    "Stripe USD": { bg: "bg-[#635BFF]/10", text: "text-[#635BFF]", border: "border-[#635BFF]/20" },
    "Braintree USD": { bg: "bg-[#002991]/10", text: "text-[#002991]", border: "border-[#002991]/20" },
    "PayPal": { bg: "bg-[#003087]/10", text: "text-[#003087]", border: "border-[#003087]/20" },
}

export default function ChaseUSDPage() {
    const [rows, setRows] = useState<ChaseUSDRow[]>([])
    const [filteredRows, setFilteredRows] = useState<ChaseUSDRow[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [editingRow, setEditingRow] = useState<string | null>(null)
    const [editedData, setEditedData] = useState<Partial<ChaseUSDRow>>({})
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
                .eq("source", "chase-usd")
                .order("date", { ascending: false })

            if (error) {
                console.error("Error loading data:", error)
                setRows([])
            } else if (rowsData) {
                const mappedRows: ChaseUSDRow[] = rowsData.map((row) => ({
                    id: row.id,
                    date: row.custom_data?.post_date_iso || row.date,
                    description: row.description || "",
                    amount: parseFloat(row.amount) || 0,
                    conciliado: (row as any).reconciled ?? row.custom_data?.conciliado ?? false,
                    paymentSource: row.custom_data?.paymentSource || row.custom_data?.destinationAccount || null,
                    reconciliationType: row.custom_data?.reconciliationType || ((row as any).reconciled ? "automatic" : null),
                    destinationAccount: row.custom_data?.destinationAccount || null,
                    stripePayoutId: row.custom_data?.stripe_payout_id || null,
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

            const response = await fetch("/api/csv/chase-usd", {
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
                message += `\n• Total Credits: ${formatUSDCurrency(summary.totalCredits)}`
                message += `\n• Total Debits: ${formatUSDCurrency(summary.totalDebits)}`
                message += `\n• Final Balance: ${formatUSDCurrency(summary.finalBalance)}`
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
                file_name: "chase-usd.csv",
                source: "chase-usd",
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
                    stripe_payout_id: row.stripePayoutId,
                    reconciled_at: row.reconciledAt,
                    bank_match_amount: row.bankMatchAmount,
                    bank_match_date: row.bankMatchDate,
                    bank_match_description: row.bankMatchDescription
                }
            }))

            const response = await fetch("/api/csv-rows", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows: rowsToInsert, source: "chase-usd" })
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

    const startEditing = (row: ChaseUSDRow) => {
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
                            stripe_payout_id: rowToUpdate.stripePayoutId,
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
        if (!confirm("⚠️ WARNING: This will DELETE ALL rows from Chase USD! Are you sure?")) return
        if (!confirm("⚠️ FINAL WARNING: This action CANNOT be undone! Continue?")) return

        setIsDeleting(true)
        try {
            const response = await fetch(`/api/csv-rows?source=chase-usd`, {
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
            a.download = `chase-usd-${new Date().toISOString().split("T")[0]}.csv`
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

        // Calcular saldo inicial (transactions antes do período filtrado)
        let openingBalance = 0
        if (dateFrom) {
            openingBalance = rows
                .filter((row) => row.date < dateFrom)
                .reduce((sum, row) => sum + row.amount, 0)
        }

        // Calcular saldo final
        const closingBalance = openingBalance + totalIncomes + totalExpenses

        // Datas do período
        const sortedByDate = [...filteredRows].sort((a, b) => a.date.localeCompare(b.date))
        const oldestDate = sortedByDate.length > 0 ? sortedByDate[0].date : null
        const newestDate = sortedByDate.length > 0 ? sortedByDate[sortedByDate.length - 1].date : null

        return { totalIncomes, totalExpenses, incomesBySource, unreconciledCount, openingBalance, closingBalance, oldestDate, newestDate }
    }

    const stats = calculateStats()

    if (isLoading) {
        return (
            <div className="min-h-full flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-[#117ACA]" />
            </div>
        )
    }

    return (
        <div className="min-h-full">
            <div>
                <header className="page-header-standard bg-[#117ACA]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Link href="/">
                                    <Button variant="ghost" size="sm" className="gap-2 text-white hover:bg-white/10">
                                        <ArrowLeft className="h-4 w-4" />
                                        Back
                                    </Button>
                                </Link>
                                <div>
                                    <h1 className="text-2xl font-bold text-white">Chase USD - Bank Statement</h1>
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
                                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="file-upload-chase" />
                                <label htmlFor="file-upload-chase">
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
                    <Card className="bg-gradient-to-r from-[#117ACA] to-[#0052A5] border-0 shadow-xl">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                                        <Database className="h-8 w-8 text-white" />
                                    </div>
                                    <div className="text-white">
                                        <h3 className="text-lg font-bold">Chase Bank USA</h3>
                                        <div className="flex items-center gap-4 mt-1 text-sm">
                                            <span className="flex items-center gap-1">
                                                <span className="font-semibold">Account:</span> ****9186
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="font-semibold">Currency:</span> USD ($)
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="font-semibold">Type:</span> Business Checking
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right text-white">
                                    <p className="text-sm opacity-90">Current Balance</p>
                                    <p className={`text-2xl font-bold ${stats.closingBalance >= 0 ? "text-emerald-200" : "text-red-200"}`}>
                                        {formatUSDCurrency(stats.closingBalance)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Stats Cards - Opening Balance, Inflows, Outflows, Closing Balance */}
                <div className="container mx-auto px-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="border-l-4 border-l-blue-500">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-600" />
                                    Opening Balance
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${stats.openingBalance >= 0 ? "text-blue-600" : "text-red-600"}`}>
                                    {formatUSDCurrency(stats.openingBalance)}
                                </div>
                                <p className="text-xs text-gray-500">
                                    {stats.oldestDate ? formatDate(stats.oldestDate) : "No data"}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-emerald-500">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-emerald-600" />
                                    Inflows
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-emerald-600">
                                    {formatUSDCurrency(stats.totalIncomes)}
                                </div>
                                <p className="text-xs text-gray-500">
                                    {filteredRows.filter(r => r.amount > 0).length} transactions
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-red-500">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-red-600" />
                                    Outflows
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">
                                    {formatUSDCurrency(stats.totalExpenses)}
                                </div>
                                <p className="text-xs text-gray-500">
                                    {filteredRows.filter(r => r.amount < 0).length} transactions
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-purple-500">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                    <Database className="w-4 h-4 text-purple-600" />
                                    Closing Balance
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${stats.closingBalance >= 0 ? "text-purple-600" : "text-red-600"}`}>
                                    {formatUSDCurrency(stats.closingBalance)}
                                </div>
                                <p className="text-xs text-gray-500">
                                    {stats.newestDate ? formatDate(stats.newestDate) : "No data"}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="px-6 py-8">
                    <Card className="shadow-xl border-2 border-gray-200">
                        <CardHeader className="bg-[#117ACA] text-white">
                            <CardTitle className="text-white">Bank Statement Details</CardTitle>
                            <CardDescription className="text-white/90">
                                Upload CSV files - Columns: Posting Date → Date | Description → Description | Amount → Amount
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b-2 border-gray-200 bg-gray-50">
                                            <th className="text-left py-4 px-4 font-bold text-sm text-black w-20">ID</th>
                                            <th className="text-left py-4 px-4 font-bold text-sm text-black">Date</th>
                                            <th className="text-left py-4 px-4 font-bold text-sm text-black">Post Date</th>
                                            <th className="text-left py-4 px-4 font-bold text-sm text-black">Check #</th>
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
                                                <td colSpan={12} className="py-8 text-center text-gray-500">
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
                                                            {formatDate(row.date)}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-700">
                                                            {customData.post_date || "-"}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-700">
                                                            {customData.check_number || "-"}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-black max-w-xs">
                                                            <div className="truncate" title={row.description}>{row.description}</div>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-right text-red-600 font-mono">
                                                            {(customData.debit && customData.debit !== 0) ? formatUSDCurrency(Math.abs(customData.debit)) : "-"}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-right text-green-600 font-mono">
                                                            {(customData.credit && customData.credit !== 0) ? formatUSDCurrency(Math.abs(customData.credit)) : "-"}
                                                        </td>
                                                        <td className={`py-3 px-4 text-sm text-right font-bold font-mono ${row.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {formatUSDCurrency(row.amount)}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-right font-medium text-black font-mono">
                                                            {formatUSDCurrency(customData.balance)}
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
                                                                        <SelectItem value="Stripe USD">Stripe USD</SelectItem>
                                                                        <SelectItem value="Braintree USD">Braintree USD</SelectItem>
                                                                        <SelectItem value="PayPal">PayPal</SelectItem>
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
                                                                                        <span>{formatDate(row.bankMatchDate)}</span>
                                                                                    </div>
                                                                                )}
                                                                                {row.bankMatchAmount !== null && row.bankMatchAmount !== undefined && (
                                                                                    <div className="flex items-center gap-1 text-white/90">
                                                                                        <DollarSign className="h-3 w-3" />
                                                                                        <span>{formatUSDCurrency(row.bankMatchAmount)}</span>
                                                                                    </div>
                                                                                )}
                                                                                {row.bankMatchDescription && (
                                                                                    <div className="flex items-start gap-1 text-white/90 mt-1">
                                                                                        <FileText className="h-3 w-3 mt-0.5" />
                                                                                        <span className="text-[10px] leading-snug">{row.bankMatchDescription.substring(0, 80)}{row.bankMatchDescription.length > 80 ? "..." : ""}</span>
                                                                                    </div>
                                                                                )}
                                                                                {row.stripePayoutId && (
                                                                                    <div className="mt-2 pt-2 border-t border-white/20 text-white/80">
                                                                                        <div className="flex items-center gap-1">
                                                                                            <Key className="h-3 w-3" />
                                                                                            <span className="text-[10px] font-mono">{row.stripePayoutId.substring(0, 32)}...</span>
                                                                                        </div>
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
