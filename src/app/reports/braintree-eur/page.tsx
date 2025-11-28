"use client"

import { useState, useEffect } from "react"
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
  XCircle 
} from "lucide-react"

import { 
  loadAllCSVFiles, 
  saveCSVFile, 
  updateCSVRow, 
  deleteCSVRow,
  type CSVRow,
} from "@/lib/database"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sidebar } from "@/components/custom/sidebar"
import Link from "next/link"

// --------------------------------------------------
// TIPOS
// --------------------------------------------------

// Braintree EUR = tudo que um CSVRow tem + campos específicos
type BraintreeEURRow = CSVRow & {
  payout: number
  disbursement_date: string
  bank_conciliation: boolean
  bank_name: string
}

// Bankinter EUR para conciliação
type BankinterEURRow = CSVRow & {
  fecha_contable?: string
  fecha_valor?: string
  importe?: number
}

// helper simples pra tentar parsear datas (ISO ou dd/MM/yyyy)
function parseDate(d: string | undefined | null): Date | null {
  if (!d) return null
  // ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
    const dt = new Date(d)
    return isNaN(dt.getTime()) ? null : dt
  }
  // dd/MM/yyyy
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) {
    const [, dd, mm, yyyy] = m
    const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
    return isNaN(dt.getTime()) ? null : dt
  }
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? null : dt
}

export default function BraintreeEURPage() {
  const [rows, setRows] = useState<BraintreeEURRow[]>([])
  const [bankinterRows, setBankinterRows] = useState<BankinterEURRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editedData, setEditedData] = useState<Partial<BraintreeEURRow>>({})
  const [isDeleting, setIsDeleting] = useState(false)

  // --------------------------------------------------
  // LOAD INICIAL
  // --------------------------------------------------
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const data = await loadAllCSVFiles()

      const braintreeFile = data.find(f => f.source === "braintree-eur")
      const bankinterFile = data.find(f => f.source === "bankinter-eur")

      let braintreeRows: BraintreeEURRow[] = []
      let bankRows: BankinterEURRow[] = []

      if (braintreeFile) {
        braintreeRows = braintreeFile.rows as unknown as BraintreeEURRow[]
      }
      if (bankinterFile) {
        bankRows = bankinterFile.rows as unknown as BankinterEURRow[]
      }

      // conciliação se tiver os dois
      if (braintreeRows.length && bankRows.length) {
        braintreeRows = performConciliation(braintreeRows, bankRows)
      }

      setRows(braintreeRows)
      setBankinterRows(bankRows)
    } catch (error) {
      console.error("Error loading data:", error)
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  // --------------------------------------------------
  // CONCILIAÇÃO
  // --------------------------------------------------
  const performConciliation = (
    braintreeData: BraintreeEURRow[],
    bankinterData: BankinterEURRow[],
  ): BraintreeEURRow[] => {
    return braintreeData.map(btRow => {
      const btPayout = btRow.payout ?? btRow.amount ?? 0

      const btDateObj = parseDate(btRow.disbursement_date || btRow.date)
      if (!btDateObj) {
        return {
          ...btRow,
          bank_conciliation: false,
          bank_name: "",
        }
      }

      const matchingBankRow = bankinterData.find(bkRow => {
        const importe = typeof bkRow.importe === "number"
          ? bkRow.importe
          : Number(bkRow.importe ?? 0)

        const valueMatch = Math.abs(btPayout - importe) < 0.01

        const bkDateObj = parseDate(bkRow.fecha_valor || bkRow.date)
        if (!bkDateObj) return false

        const diffDays = Math.abs(
          (btDateObj.getTime() - bkDateObj.getTime()) / (1000 * 60 * 60 * 24),
        )

        const dateMatch = diffDays <= 2

        return valueMatch && dateMatch
      })

      if (matchingBankRow) {
        return {
          ...btRow,
          bank_conciliation: true,
          bank_name: "Bankinter EUR",
        }
      }

      return {
        ...btRow,
        bank_conciliation: false,
        bank_name: "",
      }
    })
  }

  // --------------------------------------------------
  // UPLOAD CSV BRAINTREE EUR
  // --------------------------------------------------
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const reader = new FileReader()

    reader.onload = async e => {
      const text = e.target?.result as string
      const lines = text.split("\n").filter(l => l.trim() !== "")

      if (lines.length < 2) {
        alert("❌ File is empty or invalid")
        return
      }

      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""))

      const newRows: BraintreeEURRow[] = []
      let idCounter = rows.length + 1

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        if (!line.trim()) continue

        // parse CSV com vírgulas e aspas
        const values: string[] = []
        let current = ""
        let insideQuotes = false

        for (let j = 0; j < line.length; j++) {
          const ch = line[j]
          if (ch === '"') {
            insideQuotes = !insideQuotes
          } else if (ch === "," && !insideQuotes) {
            values.push(current.trim())
            current = ""
          } else {
            current += ch
          }
        }
        values.push(current.trim())

        const row: Record<string, string> = {}
        headers.forEach((h, idx) => {
          row[h] = values[idx] ?? ""
        })

        // Ajuste para os nomes de coluna que você já usa
        const settlementSales = parseFloat(row["settlement_currency_sales_EUR"] || "0")
        const discount = parseFloat(row["discount_EUR"] || "0")
        const multicurrencyFees = parseFloat(row["multicurrency_fees_EUR"] || "0")
        const perTransactionFees = parseFloat(row["per_transaction_fees_EUR"] || "0")
        const crossBorderFees = parseFloat(row["cross_border_fees_EUR"] || "0")

        const payout =
          settlementSales +
          discount +
          multicurrencyFees +
          perTransactionFees +
          crossBorderFees

        const disbursementDate = row["disbursement_date"] || ""

        const base: BraintreeEURRow = {
          id: `BT-EUR-${String(idCounter).padStart(4, "0")}`,
          date: disbursementDate,
          description: `Braintree EUR Disbursement - ${disbursementDate}`,
          amount: payout,
          category: "Other",
          classification: "Other",
          source: "braintree-eur",
          payout,
          disbursement_date: disbursementDate,
          bank_conciliation: false,
          bank_name: "",
          reconciled: false,
          matchedWith: undefined,
          orderNumbers: [],
          depositAccount: "",
          paymentMethod: "",
          bank_conciliation: false,
          bank_name: "",
          // espalha o resto das colunas originais
          ...row,
        }

        newRows.push(base)
        idCounter++
      }

      if (newRows.length === 0) {
        alert("❌ No valid data found in file")
        return
      }

      // junta com o que já existe
      let updatedRows = [...rows, ...newRows]

      // concilia se já tiver bankinter carregado
      if (bankinterRows.length) {
        updatedRows = performConciliation(updatedRows, bankinterRows)
      }

      setRows(updatedRows)

      // salvar no Supabase via saveCSVFile
      const totalAmount = updatedRows.reduce((sum, r) => sum + (r.amount || 0), 0)
      const today = new Date()
      const formattedDate = `${String(today.getDate()).padStart(2, "0")}/${String(
        today.getMonth() + 1,
      ).padStart(2, "0")}/${today.getFullYear()}`

      await saveCSVFile({
        name: file.name,
        lastUpdated: formattedDate,
        rows: updatedRows, // BraintreeEURRow estende CSVRow → ok
        totalAmount,
        source: "braintree-eur",
      })
    }

    reader.readAsText(file)
  }

  // --------------------------------------------------
  // EDITAR / SALVAR LINHA
  // --------------------------------------------------
  const startEditing = (row: BraintreeEURRow) => {
    setEditingRow(row.id)
    setEditedData({ ...row })
  }

  const saveEdit = async () => {
    if (!editingRow) return

    const updatedRows = rows.map(row =>
      row.id === editingRow ? { ...row, ...editedData } : row,
    )

    setRows(updatedRows)

    const rowToUpdate = updatedRows.find(r => r.id === editingRow)
    if (rowToUpdate) {
      await updateCSVRow(rowToUpdate) // BraintreeEURRow estende CSVRow
    }

    setEditingRow(null)
    setEditedData({})
  }

  const cancelEdit = () => {
    setEditingRow(null)
    setEditedData({})
  }

  // --------------------------------------------------
  // DELETE ÚNICO / DELETE ALL
  // --------------------------------------------------
  const handleDeleteRow = async (rowId: string) => {
    if (!confirm("Are you sure you want to delete this row?")) return

    setIsDeleting(true)
    try {
      const result = await deleteCSVRow(rowId)
      if (result.success) {
        await loadData()
      } else {
        alert("Error deleting row. Please try again.")
      }
    } catch (error) {
      console.error("Error deleting row:", error)
      alert("Error deleting row. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm("⚠️ WARNING: This will DELETE ALL rows from Braintree EUR! Are you sure?"))
      return
    if (!confirm("⚠️ FINAL WARNING: This action CANNOT be undone! Continue?")) return

    setIsDeleting(true)
    try {
      // deleta uma por uma (poderia ter endpoint próprio, mas segue sua lógica atual)
      for (const row of rows) {
        await deleteCSVRow(row.id)
      }

      await loadData()
      alert("✅ All rows deleted successfully!")
    } catch (error) {
      console.error("Error deleting all rows:", error)
      alert("Error deleting rows. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  // --------------------------------------------------
  // DOWNLOAD CSV
  // --------------------------------------------------
  const downloadCSV = () => {
    const headers = [
      "ID",
      "Date",
      "Description",
      "Payout",
      "Bank Conciliation",
      "Bank Name",
    ]

    const csvContent = [
      headers.join(","),
      ...rows.map(row =>
        [
          row.id,
          row.date,
          `"${(row.description || "").replace(/"/g, '""')}"`,
          row.payout.toFixed(2),
          row.bank_conciliation ? "Yes" : "No",
          row.bank_name || "",
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `braintree-eur-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const reconciledCount = rows.filter(r => r.bank_conciliation).length
  const unreconciledCount = rows.length - reconciledCount

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#1a2b4a]" />
      </div>
    )
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <Sidebar currentPage="braintree-eur" paymentSourceDates={{}} />

      <div className="md:pl-64">
        <header className="border-b-2 border-[#e5e7eb] dark:border-[#2c3e5f] bg-white dark:bg-[#1a2b4a] shadow-lg sticky top-0 z-30">
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
                  <h1 className="text-2xl font-bold text-[#1a2b4a] dark:text-white">
                    Braintree EUR - Payouts
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {rows.length} records | {reconciledCount} reconciled | {unreconciledCount} pending
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload-braintree"
                />
                <label htmlFor="file-upload-braintree">
                  <Button variant="outline" className="gap-2" asChild>
                    <span>
                      <Upload className="h-4 w-4" />
                      Upload CSV
                    </span>
                  </Button>
                </label>
                <Button onClick={downloadCSV} className="gap-2 bg-[#1a2b4a]">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button
                  onClick={handleDeleteAll}
                  variant="destructive"
                  className="gap-2"
                  disabled={isDeleting || rows.length === 0}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete All
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-6 py-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="shadow-xl border-2 border-[#e5e7eb]">
              <div className="bg-gradient-to-br from-[#1a2b4a] to-[#2c3e5f] p-6">
                <p className="text-sm font-bold text-white/80 mb-2">Total Records</p>
                <p className="text-4xl font-bold text-white">{rows.length}</p>
              </div>
            </Card>
            <Card className="shadow-xl border-2 border-green-200">
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-6">
                <p className="text-sm font-bold text-white/80 mb-2">Reconciled</p>
                <p className="text-4xl font-bold text-white">{reconciledCount}</p>
              </div>
            </Card>
            <Card className="shadow-xl border-2 border-orange-200">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6">
                <p className="text-sm font-bold text-white/80 mb-2">Pending</p>
                <p className="text-4xl font-bold text-white">{unreconciledCount}</p>
              </div>
            </Card>
          </div>

          <Card className="shadow-xl">
            <CardHeader className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white">
              <CardTitle>Braintree EUR Payouts with Bank Conciliation</CardTitle>
              <CardDescription className="text-white/80">
                Automatic reconciliation with Bankinter EUR bank statement
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-[#e5e7eb] dark:border-[#2c3e5f] bg-gray-50 dark:bg-slate-800">
                      <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                        ID
                      </th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                        Date
                      </th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                        Description
                      </th>
                      <th className="text-right py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                        Payout
                      </th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                        Bank Conciliation
                      </th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                        Bank Name
                      </th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr
                        key={row.id}
                        className="border-b border-[#e5e7eb] dark:border-[#2c3e5f] hover:bg-gray-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="py-3 px-4 text-sm font-bold">{row.id}</td>
                        <td className="py-3 px-4 text-sm">{row.date}</td>
                        <td className="py-3 px-4 text-sm max-w-xs truncate">
                          {row.description}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-bold text-[#4fc3f7]">
                          €{row.payout.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.bank_conciliation ? (
                            <Badge className="bg-green-100 text-green-800 border-green-300">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Reconciled
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-orange-50 text-orange-800 border-orange-300"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.bank_name ? (
                            <Badge className="bg-[#1a2b4a]/10 text-[#1a2b4a]">
                              {row.bank_name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {editingRow === row.id ? (
                            <div className="flex items-center justify-center gap-2">
                              <Button size="sm" onClick={saveEdit} className="h-8 w-8 p-0">
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
                                className="h-8 w-8 p-0"
                                disabled={isDeleting}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteRow(row.id)}
                                className="h-8 w-8 p-0 text-red-600"
                                disabled={isDeleting}
                              >
                                {isDeleting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
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
