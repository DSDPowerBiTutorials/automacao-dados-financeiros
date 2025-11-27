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
  XCircle,
} from "lucide-react"
import { loadAllCSVFiles, saveCSVFile, updateCSVRow, deleteCSVRow } from "@/lib/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sidebar } from "@/components/custom/sidebar"
import Link from "next/link"

interface BraintreeEURRow {
  id: string
  date: string
  description: string
  amount: number
  payout: number
  disbursement_date: string
  bank_conciliation: boolean
  bank_name: string
  [key: string]: any
}

interface BankinterEURRow {
  id: string
  fecha_contable: string
  fecha_valor: string
  importe: number
  [key: string]: any
}

export default function BraintreeEURPage() {
  const [rows, setRows] = useState<BraintreeEURRow[]>([])
  const [bankinterRows, setBankinterRows] = useState<BankinterEURRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editedData, setEditedData] = useState<Partial<BraintreeEURRow>>({})
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const data = await loadAllCSVFiles()

      // Braintree EUR
      const braintreeFile = data.find((f) => f.source === "braintree-eur")
      if (braintreeFile) {
        setRows(braintreeFile.rows as BraintreeEURRow[])
      } else {
        setRows([])
      }

      // Bankinter EUR para conciliação
      const bankinterFile = data.find((f) => f.source === "bankinter-eur")
      if (bankinterFile) {
        setBankinterRows(bankinterFile.rows as BankinterEURRow[])
      }

      // Conciliação automática se ambos existirem
      if (braintreeFile && bankinterFile) {
        performConciliation(
          braintreeFile.rows as BraintreeEURRow[],
          bankinterFile.rows as BankinterEURRow[],
        )
      }
    } catch (error) {
      console.error("Error loading data:", error)
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  const performConciliation = (
    braintreeData: BraintreeEURRow[],
    bankinterData: BankinterEURRow[],
  ) => {
    const reconciledRows = braintreeData.map((btRow) => {
      const matchingBankRow = bankinterData.find((bkRow) => {
        const valueMatch = Math.abs(btRow.payout - bkRow.importe) < 0.01

        const btDate = new Date(btRow.disbursement_date)
        const bkDate = new Date(bkRow.fecha_valor)
        const dateDiff =
          Math.abs(btDate.getTime() - bkDate.getTime()) / (1000 * 60 * 60 * 24)
        const dateMatch = dateDiff <= 2 // até 2 dias de diferença

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

    setRows(reconciledRows)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const reader = new FileReader()

    reader.onload = async (e) => {
      const text = e.target?.result as string
      const lines = text.split("\n")
      if (lines.length < 2) return

      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""))

      const newRows: BraintreeEURRow[] = []
      let idCounter = rows.length + 1

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue

        const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""))
        const row: any = {}

        headers.forEach((header, index) => {
          row[header] = values[index] || ""
        })

        // cálculos específicos do Braintree EUR
        const settlementSales = parseFloat(row["settlement_currency_sales_EUR"]) || 0
        const discount = parseFloat(row["discount_EUR"]) || 0
        const multicurrencyFees = parseFloat(row["multicurrency_fees_EUR"]) || 0
        const perTransactionFees = parseFloat(row["per_transaction_fees_EUR"]) || 0
        const crossBorderFees = parseFloat(row["cross_border_fees_EUR"]) || 0

        const payout =
          settlementSales +
          discount +
          multicurrencyFees +
          perTransactionFees +
          crossBorderFees

        newRows.push({
          id: `BT-EUR-${String(idCounter).padStart(4, "0")}`,
          date: row["disbursement_date"] || "",
          description: `Braintree EUR Disbursement - ${row["disbursement_date"]}`,
          amount: payout,
          payout,
          disbursement_date: row["disbursement_date"] || "",
          bank_conciliation: false,
          bank_name: "",
          ...row,
        })
        idCounter++
      }

      const updatedRows = [...rows, ...newRows]
      setRows(updatedRows)

      // conciliação com Bankinter
      performConciliation(updatedRows, bankinterRows)

      // salvar no Supabase via csv_files/csv_rows
      const totalAmount = updatedRows.reduce((sum, row) => sum + row.amount, 0)
      const today = new Date()
      const formattedDate = `${String(today.getDate()).padStart(2, "0")}/${String(
        today.getMonth() + 1,
      ).padStart(2, "0")}/${today.getFullYear()}`

      await saveCSVFile({
        name: file.name,
        lastUpdated: formattedDate,
        rows: updatedRows,
        totalAmount,
        source: "braintree-eur",
      })
    }

    reader.readAsText(file)
  }

  const startEditing = (row: BraintreeEURRow) => {
    setEditingRow(row.id)
    setEditedData({ ...row })
  }

  const saveEdit = async () => {
    if (!editingRow) return

    const updatedRows = rows.map((row) =>
      row.id === editingRow ? { ...row, ...editedData } : row,
    )
    setRows(updatedRows)

    const rowToUpdate = updatedRows.find((r) => r.id === editingRow)
    if (rowToUpdate) {
      await updateCSVRow(rowToUpdate as any)
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

  const downloadCSV = () => {
    const headers = ["ID", "Date", "Description", "Payout", "Bank Conciliation", "Bank Name"]

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row.id,
          row.date,
          `"${row.description.replace(/"/g, '""')}"`,
          row.payout.toFixed(2),
          row.bank_conciliation ? "Yes" : "No",
          row.bank_name,
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

  const reconciledCount = rows.filter((r) => r.bank_conciliation).length
  const unreconciledCount = rows.length - reconciledCount

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#1a2b4a]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <Sidebar currentPage="braintree-eur" paymentSourceDates={{}} />

      <div className="md:pl-64">
        {/* HEADER IGUAL AO BANKINTER EUR */}
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

        {/* TABELA PRINCIPAL NO ESTILO DO BANKINTER EUR */}
        <div className="container mx-auto px-6 py-8">
          <Card className="shadow-xl">
            <CardHeader className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white">
              <CardTitle>Braintree EUR Payouts</CardTitle>
              <CardDescription className="text-white/80">
                Payouts from Braintree with automatic conciliation against Bankinter EUR
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
                        Disbursement Date
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
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-[#e5e7eb] dark:border-[#2c3e5f] hover:bg-gray-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="py-3 px-4 text-sm font-bold">{row.id}</td>

                        {/* DATE EDITÁVEL IGUAL BANKINTER */}
                        <td className="py-3 px-4 text-sm">
                          {editingRow === row.id ? (
                            <Input
                              value={editedData.date ?? row.date}
                              onChange={(e) =>
                                setEditedData({ ...editedData, date: e.target.value })
                              }
                              className="w-40"
                            />
                          ) : (
                            row.date
                          )}
                        </td>

                        {/* DESCRIPTION EDITÁVEL */}
                        <td className="py-3 px-4 text-sm max-w-xs truncate">
                          {editingRow === row.id ? (
                            <Input
                              value={editedData.description ?? row.description}
                              onChange={(e) =>
                                setEditedData({
                                  ...editedData,
                                  description: e.target.value,
                                })
                              }
                              className="w-full"
                            />
                          ) : (
                            row.description
                          )}
                        </td>

                        {/* PAYOUT EDITÁVEL */}
                        <td className="py-3 px-4 text-sm text-right font-bold text-[#4fc3f7]">
                          {editingRow === row.id ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={
                                editedData.payout !== undefined
                                  ? editedData.payout
                                  : row.payout
                              }
                              onChange={(e) =>
                                setEditedData({
                                  ...editedData,
                                  payout: parseFloat(e.target.value),
                                  amount: parseFloat(e.target.value),
                                })
                              }
                              className="w-32"
                            />
                          ) : (
                            `€${row.payout.toFixed(2)}`
                          )}
                        </td>

                        {/* CONCILIAÇÃO NO ESTILO DO BANKINTER (CHECK / X) */}
                        <td className="py-3 px-4 text-center">
                          {row.bank_conciliation ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-5 w-5 text-gray-400 mx-auto" />
                          )}
                        </td>

                        {/* NOME DO BANCO */}
                        <td className="py-3 px-4 text-center text-sm">
                          {row.bank_name || <span className="text-gray-400 text-xs">-</span>}
                        </td>

                        {/* AÇÕES IGUAIS AO BANKINTER */}
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
