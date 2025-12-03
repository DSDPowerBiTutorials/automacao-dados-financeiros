```tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { Upload, Download, Edit2, Save, X, Trash2, ArrowLeft, Loader2, CheckCircle, XCircle } from "lucide-react"
import { loadAllCSVFiles, saveCSVFile, updateCSVRow, deleteCSVRow } from "@/lib/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sidebar } from "@/components/custom/sidebar"
import Link from "next/link"

interface BraintreeTransactionRow {
  id: string
  payout: string
  transaction_id: string
  disbursement_date: string
  currency_iso_code: string
  amount_authorized: number
  customer_first_name: string
  customer_last_name: string
  customer_email: string
  order_id_1: string
  order_id_2: string
  order_id_3: string
  order_id_4: string
  customer_name: string
  bank_conciliation: boolean
  braintree_eur_conciliation: boolean
  [key: string]: any
}

interface BraintreeEURRow {
  id: string
  disbursement_date: string
  payout: number
  [key: string]: any
}

export default function BraintreeTransactionsPage() {
  const [rows, setRows] = useState<BraintreeTransactionRow[]>([])
  const [braintreeEURRows, setBraintreeEURRows] = useState<BraintreeEURRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editedData, setEditedData] = useState<Partial<BraintreeTransactionRow>>({})
  const [isDeleting, setIsDeleting] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await loadAllCSVFiles()
      const transactionsFile = data.find(f => f.source === 'braintree-transactions')
      const braintreeEURFile = data.find(f => f.source === 'braintree-eur')

      if (transactionsFile) setRows(transactionsFile.rows as BraintreeTransactionRow[])
      if (braintreeEURFile) setBraintreeEURRows(braintreeEURFile.rows as BraintreeEURRow[])
      if (transactionsFile && braintreeEURFile)
        performConciliation(transactionsFile.rows as BraintreeTransactionRow[], braintreeEURFile.rows as BraintreeEURRow[])
    } catch (error) {
      console.error('Error loading data:', error)
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const performConciliation = (transactionsData: BraintreeTransactionRow[], braintreeEURData: BraintreeEURRow[]) => {
    const groupedTransactions = new Map<string, BraintreeTransactionRow[]>()
    transactionsData.forEach(tx => {
      if (tx.currency_iso_code === 'EUR' && tx.disbursement_date) {
        if (!groupedTransactions.has(tx.disbursement_date)) groupedTransactions.set(tx.disbursement_date, [])
        groupedTransactions.get(tx.disbursement_date)!.push(tx)
      }
    })

    const reconciledRows = transactionsData.map(tx => {
      if (tx.currency_iso_code !== 'EUR' || !tx.disbursement_date)
        return { ...tx, customer_name: `${tx.customer_first_name || ''} ${tx.customer_last_name || ''}`.trim(), bank_conciliation: false, braintree_eur_conciliation: false }

      const sameDayTransactions = groupedTransactions.get(tx.disbursement_date) || []
      const totalAmount = sameDayTransactions.reduce((sum, t) => sum + (parseFloat(t.amount_authorized?.toString() || '0') || 0), 0)
      const matchingPayout = braintreeEURData.find(btEUR => Math.abs(totalAmount - btEUR.payout) < 0.01 && btEUR.disbursement_date === tx.disbursement_date)

      return { ...tx, customer_name: `${tx.customer_first_name || ''} ${tx.customer_last_name || ''}`.trim(), bank_conciliation: !!matchingPayout, braintree_eur_conciliation: !!matchingPayout }
    })
    setRows(reconciledRows)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async e => {
      const text = e.target?.result as string
      const lines = text.split('\n')
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const newRows: BraintreeTransactionRow[] = []
      let idCounter = rows.length + 1

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row: any = {}
        headers.forEach((h, idx) => (row[h] = values[idx] || ''))
        newRows.push({
          id: `BT-TX-${String(idCounter).padStart(4, '0')}`,
          payout: row['PAYOUT'] || '',
          transaction_id: row['Transaction ID'] || '',
          disbursement_date: row['Disbursement Date'] || '',
          currency_iso_code: row['Currency ISO Code'] || '',
          amount_authorized: parseFloat(row['Amount Authorized']) || 0,
          customer_first_name: row['Customer First Name'] || '',
          customer_last_name: row['Customer Last Name'] || '',
          customer_email: row['Customer Email'] || '',
          customer_name: `${row['Customer First Name'] || ''} ${row['Customer Last Name'] || ''}`.trim(),
          bank_conciliation: false,
          braintree_eur_conciliation: false,
          ...row
        })
        idCounter++
      }

      const updatedRows = [...rows, ...newRows]
      setRows(updatedRows)
      performConciliation(updatedRows, braintreeEURRows)

      const today = new Date()
      await saveCSVFile({
        name: file.name,
        lastUpdated: `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`,
        rows: updatedRows as any,
        totalAmount: updatedRows.reduce((s, r) => s + r.amount_authorized, 0),
        source: 'braintree-transactions'
      })
    }
    reader.readAsText(file)
  }

  const handleDeleteRow = async (rowId: string) => {
    if (!confirm('Are you sure you want to delete this row?')) return
    setIsDeleting(true)
    try {
      await deleteCSVRow(rowId)
      await loadData()
    } catch (err) {
      console.error(err)
      alert('Error deleting row')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm('⚠️ Delete all rows? This cannot be undone!')) return
    setIsDeleting(true)
    try {
      for (const row of rows) await deleteCSVRow(row.id)
      await loadData()
    } catch (err) {
      console.error(err)
      alert('Error deleting rows')
    } finally {
      setIsDeleting(false)
    }
  }

  const downloadCSV = () => {
    const headers = ['ID', 'Transaction ID', 'Date', 'Currency', 'Amount', 'Customer Name', 'Email', 'Bank', 'EUR Match']
    const csv = [headers.join(','), ...rows.map(r => [r.id, r.transaction_id, r.disbursement_date, r.currency_iso_code, r.amount_authorized, r.customer_name, r.customer_email, r.bank_conciliation ? 'Yes' : 'No', r.braintree_eur_conciliation ? 'Yes' : 'No'].join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `braintree-transactions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const reconciledCount = rows.filter(r => r.bank_conciliation && r.braintree_eur_conciliation).length
  const unreconciledCount = rows.length - reconciledCount

  if (isLoading)
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-[#1a2b4a]" /></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar currentPage="braintree-transactions" paymentSourceDates={{}} />
      <div className="md:pl-64">
        <header className="border-b bg-white shadow-lg sticky top-0 z-30">
          <div className="container mx-auto px-6 py-5 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" />Back</Button></Link>
              <div>
                <h1 className="text-2xl font-bold text-[#1a2b4a]">Braintree Transactions</h1>
                <p className="text-sm text-gray-600">{rows.length} records | {reconciledCount} reconciled | {unreconciledCount} pending</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="file-upload-transactions" />
              <label htmlFor="file-upload-transactions">
                <Button variant="outline" className="gap-2"><Upload className="h-4 w-4" />Upload CSV</Button>
              </label>
              <Button onClick={downloadCSV} className="gap-2 bg-[#1a2b4a] text-white"><Download className="h-4 w-4" />Download</Button>
              <Button onClick={handleDeleteAll} variant="destructive" className="gap-2" disabled={isDeleting}><Trash2 className="h-4 w-4" />Delete All</Button>
            </div>
          </div>
        </header>
        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card><CardContent><CardTitle>Total Transactions</CardTitle><p className="text-3xl font-bold">{rows.length}</p></CardContent></Card>
            <Card><CardContent><CardTitle>Reconciled</CardTitle><p className="text-3xl font-bold text-green-600">{reconciledCount}</p></CardContent></Card>
            <Card><CardContent><CardTitle>Pending</CardTitle><p className="text-3xl font-bold text-orange-600">{unreconciledCount}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader className="bg-[#1a2b4a] text-white"><CardTitle>Transactions</CardTitle><CardDescription>Braintree conciliation data</CardDescription></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 text-sm">
                    <th>ID</th><th>Transaction ID</th><th>Date</th><th>Currency</th><th>Amount</th><th>Customer</th><th>Email</th><th>Bank</th><th>EUR Match</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-t text-sm">
                      <td>{r.id}</td>
                      <td>{r.transaction_id}</td>
                      <td>{r.disbursement_date}</td>
                      <td>{r.currency_iso_code}</td>
                      <td className="text-right">€{r.amount_authorized.toFixed(2)}</td>
                      <td>{r.customer_name}</td>
                      <td>{r.customer_email}</td>
                      <td className="text-center">{r.bank_conciliation ? <CheckCircle className="text-green-600 h-4 w-4 inline" /> : <XCircle className="text-gray-400 h-4 w-4 inline" />}</td>
                      <td className="text-center">{r.braintree_eur_conciliation ? <CheckCircle className="text-green-600 h-4 w-4 inline" /> : <XCircle className="text-gray-400 h-4 w-4 inline" />}</td>
                      <td className="text-center"><Button variant="ghost" size="sm" onClick={() => handleDeleteRow(r.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
```
