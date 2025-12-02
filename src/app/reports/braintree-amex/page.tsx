"use client"

import { useState, useEffect } from "react"
import { Upload, Download, Loader2, CheckCircle, XCircle, ArrowLeft, Trash2 } from "lucide-react"
import { loadAllCSVFiles, saveCSVFile, updateCSVRow, deleteCSVRow } from "@/lib/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sidebar } from "@/components/custom/sidebar"
import Link from "next/link"

interface BraintreeAmexRow {
  id: string
  disbursement_date: string
  payout: number
  transaction_id: string
  currency_iso_code: string
  amount_authorized: number
  customer_name: string
  bank_conciliation: boolean
  braintree_amex_conciliation: boolean
  [key: string]: any
}

export default function BraintreeAmexPage() {
  const [rows, setRows] = useState<BraintreeAmexRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const data = await loadAllCSVFiles()
      const amexFile = data.find(f => f.source === "braintree-amex")
      if (amexFile) {
        setRows(amexFile.rows as BraintreeAmexRow[])
      } else {
        setRows([])
      }
    } catch (error) {
      console.error("Error loading Amex data:", error)
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const reader = new FileReader()

    reader.onload = async (e) => {
      const text = e.target?.result as string
      const lines = text.split("\n").filter(line => line.trim() !== "")
      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""))

      const newRows: BraintreeAmexRow[] = []
      let idCounter = rows.length + 1

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""))
        const row: any = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ""
        })

        newRows.push({
          id: `BT-AMEX-${String(idCounter).padStart(4, "0")}`,
          disbursement_date: row["Disbursement Date"] || "",
          payout: parseFloat(row["Payout"] || "0"),
          transaction_id: row["Transaction ID"] || "",
          currency_iso_code: row["Currency ISO Code"] || "USD",
          amount_authorized: parseFloat(row["Amount Authorized"] || "0"),
          customer_name: row["Customer Name"] || "",
          bank_conciliation: false,
          braintree_amex_conciliation: false,
          ...row,
        })
        idCounter++
      }

      const updatedRows = [...rows, ...newRows]
      setRows(updatedRows)

      const totalAmount = updatedRows.reduce((sum, r) => sum + r.amount_authorized, 0)
      const today = new Date()
      const formattedDate = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`

      await saveCSVFile({
        name: file.name,
        lastUpdated: formattedDate,
        rows: updatedRows,
        totalAmount,
        source: "braintree-amex",
      })
    }

    reader.readAsText(file)
  }

  const handleDeleteAll = async () => {
    if (!confirm("⚠️ This will delete ALL Amex rows. Continue?")) return
    setIsDeleting(true)
    try {
      for (const row of rows) {
        await deleteCSVRow(row.id)
      }
      await loadData()
      alert("✅ All Braintree Amex rows deleted successfully!")
    } catch (error) {
      console.error("Error deleting Amex rows:", error)
      alert("Error deleting Amex rows.")
    } finally {
      setIsDeleting(false)
    }
  }

  const downloadCSV = () => {
    const headers = ["ID", "Disbursement Date", "Payout", "Transaction ID", "Currency", "Amount", "Customer Name"]
    const csvContent = [
      headers.join(","),
      ...rows.map(r => [
        r.id,
        r.disbursement_date,
        r.payout,
        r.transaction_id,
        r.currency_iso_code,
        r.amount_authorized,
        r.customer_name
      ].join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `braintree-amex-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-700" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100">
      <Sidebar currentPage="braintree-amex" paymentSourceDates={{}} />

      <div className="md:pl-64 p-6">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-[#1a2b4a]">Braintree Amex - Transactions</h1>
          </div>
          <div className="flex gap-2">
            <input id="file-upload-amex" type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            <label htmlFor="file-upload-amex">
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" /> Upload CSV
              </Button>
            </label>
            <Button onClick={downloadCSV} className="bg-[#1a2b4a] text-white gap-2">
              <Download className="h-4 w-4" /> Download
            </Button>
            <Button onClick={handleDeleteAll} variant="destructive" disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete All
            </Button>
          </div>
        </header>

        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white">
            <CardTitle>All Braintree Amex Transactions</CardTitle>
            <CardDescription className="text-white/80">Manage CSV uploads and payouts</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="p-3 text-left">ID</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Payout</th>
                    <th className="p-3 text-left">Transaction ID</th>
                    <th className="p-3 text-left">Currency</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-left">Customer</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-bold">{row.id}</td>
                      <td className="p-3">{row.disbursement_date}</td>
                      <td className="p-3">{row.payout.toFixed(2)}</td>
                      <td className="p-3">{row.transaction_id}</td>
                      <td className="p-3">{row.currency_iso_code}</td>
                      <td className="p-3 text-right">€{row.amount_authorized.toFixed(2)}</td>
                      <td className="p-3">{row.customer_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
