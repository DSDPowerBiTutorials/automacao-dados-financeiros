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
  RefreshCw
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { formatCurrency, formatTimestamp } from "@/lib/formatters"

// Formatar números no padrão europeu: -19172.8 → -19.172,80
const formatEuropeanCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return "-"

  const formatted = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)

  return formatted
}

// Formatar data: Date → "DD/MM/YYYY"
const formatEuropeanDate = (dateString: string | null | undefined): string => {
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

interface BankinterEURRow {
  id: string
  date: string
  description: string
  amount: number
  conciliado: boolean
  paymentSource?: string | null
  reconciliationType?: "automatic" | "manual" | null
  custom_data?: {
    fecha_contable?: string | null
    debe?: number
    haber?: number
    importe?: number
    saldo?: number
    referencia?: string
    clave?: string
    categoria?: string
    row_index?: number
    file_name?: string
  }
  [key: string]: any
}

// Mapeamento de cores por fonte de pagamento
const paymentSourceColors: { [key: string]: { bg: string; text: string; border: string } } = {
  "Braintree EUR": { bg: "bg-[#002991]/10", text: "text-[#002991]", border: "border-[#002991]/20" },
  "Braintree USD": { bg: "bg-[#002991]/10", text: "text-[#002991]", border: "border-[#002991]/20" },
  "Braintree Amex": { bg: "bg-[#002991]/10", text: "text-[#002991]", border: "border-[#002991]/20" },
  Stripe: { bg: "bg-[#B1ADFF]/20", text: "text-black", border: "border-[#B1ADFF]/40" },
  GoCardless: { bg: "bg-[#F1F252]/20", text: "text-black", border: "border-[#F1F252]/40" }
}

export default function BankinterEURPage() {
  const [rows, setRows] = useState<BankinterEURRow[]>([])
  const [filteredRows, setFilteredRows] = useState<BankinterEURRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editedData, setEditedData] = useState<Partial<BankinterEURRow>>({})
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
        .eq("source", "bankinter-eur")
        .order("date", { ascending: false })

      if (error) {
        console.error("Error loading data:", error)
        setRows([])
      } else if (rowsData) {
        const mappedRows: BankinterEURRow[] = rowsData.map((row) => ({
          id: row.id,
          date: row.date,
          description: row.description || "",
          amount: parseFloat(row.amount) || 0,
          conciliado: row.custom_data?.conciliado || false,
          paymentSource: row.custom_data?.paymentSource || null,
          reconciliationType: row.custom_data?.reconciliationType || null
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
      console.log('📤 Enviando arquivo:', file.name)

      const response = await fetch("/api/csv/bankinter-eur", {
        method: "POST",
        body: formData
      })

      const result = await response.json()
      console.log('📥 Resposta:', result)

      if (!response.ok || !result.success) {
        console.error("Erro ao enviar:", result.error)
        alert(`❌ Erro no upload: ${result.error}`)
        return
      }

      const summary = result.data?.summary
      let message = `✅ ${result.data.rowCount} transações importadas!`

      if (summary) {
        message += `\n\n📊 Resumo:`
        message += `\n• Total Crédito: €${summary.totalCredito.toFixed(2)}`
        message += `\n• Total Débito: €${summary.totalDebito.toFixed(2)}`
        message += `\n• Saldo Final: €${summary.saldoFinal.toFixed(2)}`
        if (summary.totalSkipped > 0) {
          message += `\n• Linhas ignoradas: ${summary.totalSkipped}`
        }
      }

      alert(message)
      loadData()
    } catch (err) {
      console.error("Erro inesperado:", err)
      alert("❌ Falha ao enviar o arquivo. Verifique o formato e tente novamente.")
    } finally {
      setIsLoading(false)
      // Reset input
      event.target.value = ""
    }
  }

  const saveAllChanges = async () => {
    setIsSaving(true)
    setSaveSuccess(false)

    try {
      const rowsToInsert = rows.map((row) => ({
        id: row.id,
        file_name: "bankinter-eur.csv",
        source: "bankinter-eur",
        date: row.date,
        description: row.description,
        amount: row.amount.toString(),
        category: "Other",
        classification: "Other",
        reconciled: false,
        custom_data: {
          id: row.id,
          date: row.date,
          description: row.description,
          amount: row.amount,
          conciliado: row.conciliado,
          paymentSource: row.paymentSource,
          reconciliationType: row.reconciliationType
        }
      }))

      const response = await fetch("/api/csv-rows", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsToInsert, source: "bankinter-eur" })
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

  const startEditing = (row: BankinterEURRow) => {
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
            custom_data: {
              id: rowToUpdate.id,
              date: rowToUpdate.date,
              description: rowToUpdate.description,
              amount: rowToUpdate.amount,
              conciliado: rowToUpdate.conciliado,
              paymentSource: rowToUpdate.paymentSource,
              reconciliationType: rowToUpdate.reconciliationType
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
    if (!confirm("⚠️ WARNING: This will DELETE ALL rows from Bankinter EUR! Are you sure?")) return
    if (!confirm("⚠️ FINAL WARNING: This action CANNOT be undone! Continue?")) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/csv-rows?source=bankinter-eur`, {
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
      const headers = ["ID", "Date", "Description", "Amount", "Payment Source", "Payout Reconciliation"]

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
      a.download = `bankinter-eur-${new Date().toISOString().split("T")[0]}.csv`
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
    const incomesBySource = filteredRows
      .filter((row) => row.amount > 0 && row.paymentSource)
      .reduce((acc, row) => {
        acc[row.paymentSource!] = (acc[row.paymentSource!] || 0) + row.amount
        return acc
      }, {} as Record<string, number>)
    const unreconciledCount = filteredRows.filter((row) => !row.conciliado).length

    return { totalIncomes, incomesBySource, unreconciledCount }
  }

  const { totalIncomes, incomesBySource, unreconciledCount } = calculateStats()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#FF7300]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div>
        <header className="border-b border-[#0f1c34] bg-[#1a2b4a] text-white shadow-lg sticky top-0 z-30">
          <div className="container mx-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-black">Bankinter EUR - Bank Statement</h1>
                  <p className="text-sm text-gray-600 mt-1">{filteredRows.length} records</p>
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
                <input type="file" accept=".xlsx" onChange={handleFileUpload} className="hidden" id="file-upload-bankinter" />
                <label htmlFor="file-upload-bankinter">
                  <Button variant="outline" size="sm" className="gap-2 border-white text-white hover:bg-white/10" asChild>
                    <span>
                      <Upload className="h-4 w-4" />
                      Upload XLSX
                    </span>
                  </Button>
                </label>
                <Button
                  onClick={loadData}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-white text-white hover:bg-white/10"
                  title="Forçar atualização dos dados"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
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
                <Filter className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Date Filters:</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">From:</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">To:</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFrom("")
                  setDateTo("")
                }}
                className="gap-2"
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

            {lastSaved && !saveSuccess && (
              <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>Last saved: {lastSaved}</span>
              </div>
            )}
          </div>
        </header>

        <div className="container mx-auto px-6 py-8">
          {/* Alerta de dados antigos com erros */}
          {rows.length > 0 && rows.some(row => {
            const customData = row.custom_data || {}
            // Detectar dados com erro: fecha_valor em 1927 ou campos vazios
            return row.date?.includes('1927') || (!customData.debe && !customData.haber && !customData.saldo)
          }) && (
              <Alert className="mb-6 border-2 border-red-500 bg-red-50">
                <XCircle className="h-5 w-5 text-red-600" />
                <AlertDescription className="text-red-800">
                  <div className="font-bold mb-2">⚠️ ATENÇÃO: Dados com formato incorreto detectados!</div>
                  <div className="text-sm space-y-1">
                    <p>• Datas aparecendo como "1927-07-12" (Excel serial date não convertido)</p>
                    <p>• Valores monetários incorretos (ex: 8.121.793,00 ao invés de negativo)</p>
                    <p>• Colunas vazias (Fecha Contable, Clave, Referencia, etc.)</p>
                  </div>
                  <div className="mt-3 font-bold">
                    ✅ Solução: Clique em "Delete All" acima e faça novo upload do arquivo XLSX
                  </div>
                </AlertDescription>
              </Alert>
            )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Incomes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncomes)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Unreconciled Entries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{unreconciledCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Incomes by Source</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {Object.entries(incomesBySource).map(([source, amount]) => (
                    <div key={source} className="flex justify-between text-sm">
                      <span>{source}:</span>
                      <span className="font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                  {Object.keys(incomesBySource).length === 0 && <div className="text-sm text-gray-500">No reconciled incomes</div>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-xl border-2 border-gray-200">
            <CardHeader className="bg-[#FF7300] text-white">
              <CardTitle className="text-white">Bank Statement Details</CardTitle>
              <CardDescription className="text-white/90">
                Upload XLSX files - Columns: FECHA VALOR → Date | DESCRIPCIÓN → Description | HABER → Amount
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      <th className="text-left py-4 px-4 font-bold text-sm text-black w-20">ID</th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-black">Fecha Contable</th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-black">Fecha Valor</th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-black">Clave</th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-black">Referencia</th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-black">Categoría</th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-black min-w-64">Descripción</th>
                      <th className="text-right py-4 px-4 font-bold text-sm text-black">Debe</th>
                      <th className="text-right py-4 px-4 font-bold text-sm text-black">Haber</th>
                      <th className="text-right py-4 px-4 font-bold text-sm text-black">Importe</th>
                      <th className="text-right py-4 px-4 font-bold text-sm text-black">Saldo</th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-black">Payment Source</th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-black">Reconciliado</th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-black">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="py-8 text-center text-gray-500">
                          No data available. Upload an XLSX file to get started.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => {
                        const sourceStyle = getPaymentSourceStyle(row.paymentSource)
                        const customData = row.custom_data || {}

                        // DEBUG: Log first row to see structure
                        if (row === filteredRows[0]) {
                          console.log('🔍 [DEBUG] Primeira linha customData:', {
                            debe: customData.debe,
                            haber: customData.haber,
                            importe: customData.importe,
                            saldo: customData.saldo,
                            types: {
                              debe: typeof customData.debe,
                              haber: typeof customData.haber,
                              importe: typeof customData.importe,
                              saldo: typeof customData.saldo
                            }
                          })
                        }

                        return (
                          <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm font-bold text-black">{row.id.substring(0, 6)}...</td>
                            <td className="py-3 px-4 text-sm text-gray-700">
                              {customData.fecha_contable || "-"}
                            </td>
                            <td className="py-3 px-4 text-sm text-black font-medium">
                              {formatEuropeanDate(row.date)}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-700">
                              {customData.clave || "-"}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-700">
                              {customData.referencia || "-"}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-700">
                              {customData.categoria || "-"}
                            </td>
                            <td className="py-3 px-4 text-sm text-black max-w-xs">
                              <div className="truncate" title={row.description}>{row.description}</div>
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-red-600 font-mono">
                              {(customData.debe && customData.debe > 0) ? formatEuropeanCurrency(customData.debe) : "-"}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-green-600 font-mono">
                              {(customData.haber && customData.haber > 0) ? formatEuropeanCurrency(customData.haber) : "-"}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-bold text-[#FF7300] font-mono">
                              {formatEuropeanCurrency(
                                customData.importe !== undefined
                                  ? customData.importe
                                  : (typeof row.amount === 'number' ? row.amount : parseFloat(row.amount))
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-medium text-black font-mono">
                              {formatEuropeanCurrency(customData.saldo)}
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
                                    <SelectItem value="Braintree Amex">Braintree Amex</SelectItem>
                                    <SelectItem value="Stripe">Stripe</SelectItem>
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
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                        Automatic reconciliation
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="relative group">
                                      <User className="h-5 w-5 text-blue-600 mx-auto" />
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
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
                                  <Button size="sm" onClick={saveEdit} variant="outline" className="gap-2 border-white text-white hover:bg-white/10">
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEdit}
                                    className="h-8 w-8 p-0 border-black text-black"
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
