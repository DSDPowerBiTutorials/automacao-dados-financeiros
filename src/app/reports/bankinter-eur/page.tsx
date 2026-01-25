"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Upload, Download, Edit2, Save, X, Trash2, Loader2, CheckCircle, XCircle,
  Database, Zap, User, RefreshCw, Calendar, DollarSign, FileText, Key,
  ChevronDown, ChevronRight, Search, Link2, AlertCircle, Building2, ArrowLeftRight
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatTimestamp } from "@/lib/formatters"
import { useToast } from "@/hooks/use-toast"

interface Invoice {
  id: number
  provider_code: string | null
  invoice_number: string | null
  invoice_amount: number
  currency: string
  paid_amount: number | null
  paid_currency: string | null
  schedule_date: string | null
  is_reconciled: boolean
  reconciled_transaction_id: string | null
}

interface BankAccount {
  code: string
  name: string
  currency: string
  iban?: string | null
  bank_name?: string | null
}

const formatEuropeanCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return "-"
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

const formatShortDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "-"
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  } catch { return dateString }
}

const formatDateForHeader = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

interface BankinterEURRow {
  id: string
  date: string
  description: string
  amount: number
  reconciled: boolean
  paymentSource?: string | null
  reconciliationType?: "automatic" | "manual" | null
  braintreeSettlementBatchId?: string | null
  braintreeTransactionCount?: number | null
  reconciledAt?: string | null
  bankMatchAmount?: number | null
  bankMatchDate?: string | null
  bankMatchDescription?: string | null
  custom_data?: {
    fecha_contable?: string | null
    debe?: number
    haber?: number
    importe?: number
    saldo?: number
    referencia?: string
    clave?: string
    categoria?: string
  }
}

const paymentSourceColors: { [key: string]: { bg: string; text: string; border: string } } = {
  "Braintree EUR": { bg: "bg-blue-900/30", text: "text-blue-400", border: "border-blue-700" },
  "Braintree USD": { bg: "bg-blue-900/30", text: "text-blue-400", border: "border-blue-700" },
  "Braintree Amex": { bg: "bg-purple-900/30", text: "text-purple-400", border: "border-purple-700" },
  Stripe: { bg: "bg-indigo-900/30", text: "text-indigo-400", border: "border-indigo-700" },
  GoCardless: { bg: "bg-yellow-900/30", text: "text-yellow-400", border: "border-yellow-700" }
}

interface DateGroup { date: string; dateLabel: string; rows: BankinterEURRow[]; totalCredits: number; totalDebits: number }

export default function BankinterEURPage() {
  const [rows, setRows] = useState<BankinterEURRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editedData, setEditedData] = useState<Partial<BankinterEURRow>>({})
  const [isDeleting, setIsDeleting] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showReconciled, setShowReconciled] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [selectedRow, setSelectedRow] = useState<BankinterEURRow | null>(null)

  // Reconciliation dialog states
  const [reconciliationDialogOpen, setReconciliationDialogOpen] = useState(false)
  const [reconciliationTransaction, setReconciliationTransaction] = useState<BankinterEURRow | null>(null)
  const [matchingInvoices, setMatchingInvoices] = useState<Invoice[]>([])
  const [allAvailableInvoices, setAllAvailableInvoices] = useState<Invoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<number | null>(null)

  // Intercompany states
  const [isIntercompany, setIsIntercompany] = useState(false)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedBankAccount, setSelectedBankAccount] = useState<string | null>(null)

  const { toast } = useToast()

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (rows.length > 0) {
      const allDates = new Set<string>()
      rows.forEach((row) => { if (row.date) allDates.add(row.date.split("T")[0]) })
      setExpandedGroups(allDates)
    }
  }, [rows])

  const loadData = async () => {
    setIsLoading(true)
    try {
      if (!supabase) { setRows([]); setIsLoading(false); return }
      const { data: rowsData, error } = await supabase.from("csv_rows").select("*").eq("source", "bankinter-eur").order("date", { ascending: false })
      if (error) { setRows([]) }
      else if (rowsData) {
        setRows(rowsData.map((row) => ({
          id: row.id,
          date: row.custom_data?.fecha_contable_iso || row.date,
          description: row.description || "",
          amount: parseFloat(row.amount) || 0,
          reconciled: row.reconciled ?? row.custom_data?.conciliado ?? false,
          paymentSource: row.custom_data?.paymentSource || row.custom_data?.destinationAccount || null,
          reconciliationType: row.custom_data?.reconciliationType || (row.reconciled ? "automatic" : null),
          braintreeSettlementBatchId: row.custom_data?.braintree_settlement_batch_id || null,
          braintreeTransactionCount: row.custom_data?.braintree_transaction_count || null,
          reconciledAt: row.custom_data?.reconciled_at || null,
          bankMatchAmount: row.custom_data?.bank_match_amount || null,
          bankMatchDate: row.custom_data?.bank_match_date || null,
          bankMatchDescription: row.custom_data?.bank_match_description || null,
          custom_data: row.custom_data || {}
        })))
      } else { setRows([]) }
    } catch { setRows([]) }
    finally { setIsLoading(false) }
  }

  const filteredRows = useMemo(() => {
    let filtered = rows
    if (!showReconciled) filtered = filtered.filter((row) => !row.reconciled)
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((row) => row.description?.toLowerCase().includes(term) || row.paymentSource?.toLowerCase().includes(term) || row.braintreeSettlementBatchId?.toLowerCase().includes(term))
    }
    return filtered
  }, [rows, showReconciled, searchTerm])

  const groups = useMemo(() => {
    const groupsMap = new Map<string, DateGroup>()
    filteredRows.forEach((row) => {
      const key = row.date?.split("T")[0] || "unknown"
      if (!groupsMap.has(key)) groupsMap.set(key, { date: key, dateLabel: key === "unknown" ? "Unknown Date" : formatDateForHeader(key), rows: [], totalCredits: 0, totalDebits: 0 })
      const group = groupsMap.get(key)!
      group.rows.push(row)
      if (row.amount > 0) group.totalCredits += row.amount
      else group.totalDebits += Math.abs(row.amount)
    })
    return Array.from(groupsMap.values()).sort((a, b) => { if (a.date === "unknown") return 1; if (b.date === "unknown") return -1; return new Date(b.date).getTime() - new Date(a.date).getTime() })
  }, [filteredRows])

  const stats = useMemo(() => {
    const totalCredits = filteredRows.filter(r => r.amount > 0).reduce((sum, r) => sum + r.amount, 0)
    const totalDebits = filteredRows.filter(r => r.amount < 0).reduce((sum, r) => sum + Math.abs(r.amount), 0)
    const reconciledCount = filteredRows.filter(r => r.reconciled).length
    const unreconciledCount = filteredRows.filter(r => !r.reconciled).length
    const sortedByDate = [...rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const closingBalance = sortedByDate[0]?.custom_data?.saldo ?? 0
    return { totalCredits, totalDebits, reconciledCount, unreconciledCount, closingBalance }
  }, [filteredRows, rows])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsLoading(true)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const response = await fetch("/api/csv/bankinter-eur", { method: "POST", body: formData })
      const result = await response.json()
      if (!response.ok || !result.success) { alert("Erro no upload: " + result.error); return }
      alert(result.data.rowCount + " transactions imported!")
      loadData()
    } catch { alert("Falha ao enviar o arquivo.") }
    finally { setIsLoading(false); event.target.value = "" }
  }

  const startEditing = (row: BankinterEURRow) => { setEditingRow(row.id); setEditedData({ ...row }) }

  const saveEdit = async () => {
    if (!editingRow) return
    const updatedRows = rows.map((row) => row.id === editingRow ? { ...row, ...editedData, reconciliationType: "manual" as const } : row)
    setRows(updatedRows)
    const rowToUpdate = updatedRows.find((r) => r.id === editingRow)
    if (rowToUpdate && supabase) {
      const { error } = await supabase.from("csv_rows").update({ date: rowToUpdate.date, description: rowToUpdate.description, amount: rowToUpdate.amount.toString(), reconciled: rowToUpdate.reconciled, custom_data: { ...rowToUpdate.custom_data, paymentSource: rowToUpdate.paymentSource, reconciliationType: rowToUpdate.reconciliationType } }).eq("id", rowToUpdate.id)
      if (!error) setLastSaved(formatTimestamp(new Date()))
    }
    setEditingRow(null); setEditedData({})
  }

  const cancelEdit = () => { setEditingRow(null); setEditedData({}) }

  const handleDeleteRow = async (rowId: string) => {
    if (!confirm("Are you sure you want to delete this row?")) return
    setIsDeleting(true)
    try {
      const response = await fetch("/api/csv-rows?id=" + rowId, { method: "DELETE" })
      const result = await response.json()
      if (response.ok && result.success) { await loadData(); setLastSaved(formatTimestamp(new Date())) }
    } catch {}
    finally { setIsDeleting(false) }
  }

  const handleDeleteAll = async () => {
    if (!confirm("WARNING: This will DELETE ALL rows from Bankinter EUR! Are you sure?")) return
    if (!confirm("FINAL WARNING: This action CANNOT be undone! Continue?")) return
    setIsDeleting(true)
    try {
      const response = await fetch("/api/csv-rows?source=bankinter-eur", { method: "DELETE" })
      const result = await response.json()
      if (response.ok && result.success) { await loadData(); alert("All rows deleted successfully!") }
    } catch {}
    finally { setIsDeleting(false) }
  }

  const downloadCSV = () => {
    const headers = ["ID", "Date", "Description", "Amount", "Payment Source", "Reconciled"]
    const csvContent = [headers.join(","), ...filteredRows.map((row) => [row.id.substring(0, 8), row.date, '"' + row.description.replace(/"/g, '""') + '"', row.amount.toFixed(2), row.paymentSource || "N/A", row.reconciled ? "Yes" : "No"].join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "bankinter-eur-" + new Date().toISOString().split("T")[0] + ".csv"
    document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url)
  }

  const toggleGroup = (date: string) => { setExpandedGroups((prev) => { const newSet = new Set(prev); if (newSet.has(date)) newSet.delete(date); else newSet.add(date); return newSet }) }

  const getPaymentSourceStyle = (source: string | null | undefined) => {
    if (!source) return { bg: "bg-gray-800/50", text: "text-gray-500", border: "border-gray-700" }
    return paymentSourceColors[source] || { bg: "bg-gray-800/50", text: "text-gray-400", border: "border-gray-700" }
  }

  // Open reconciliation dialog
  const openReconciliationDialog = async (transaction: BankinterEURRow) => {
    setReconciliationTransaction(transaction)
    setReconciliationDialogOpen(true)
    setLoadingInvoices(true)
    setSelectedInvoice(null)
    setMatchingInvoices([])
    setAllAvailableInvoices([])
    setIsIntercompany(false)
    setSelectedBankAccount(null)

    try {
      // Load bank accounts for intercompany
      const { data: accountsData } = await supabase.from("bank_accounts").select("code, name, currency, iban, bank_name").eq("is_active", true).order("code")
      const otherAccounts = (accountsData || []).filter((acc: BankAccount) => acc.code !== "BANKINTER-EUR" && acc.code !== "bankinter-eur")
      setBankAccounts(otherAccounts)

      const transactionDate = transaction.date?.split("T")[0]
      if (!transactionDate) { setMatchingInvoices([]); setAllAvailableInvoices([]); return }

      const startDate = new Date(transactionDate)
      startDate.setDate(startDate.getDate() - 3)
      const endDate = new Date(transactionDate)
      endDate.setDate(endDate.getDate() + 3)
      const matchAmount = Math.abs(transaction.amount)

      const { data: exactData, error: exactError } = await supabase
        .from("invoices").select("*").eq("invoice_type", "INCURRED").eq("currency", "EUR").eq("is_reconciled", false)
        .gte("schedule_date", startDate.toISOString().split("T")[0]).lte("schedule_date", endDate.toISOString().split("T")[0])
        .order("schedule_date", { ascending: false })
      if (exactError) throw exactError

      const exactMatches = (exactData || []).filter((inv: Invoice) => {
        const invAmount = inv.paid_amount ?? inv.invoice_amount ?? 0
        return Math.abs(invAmount - matchAmount) < 0.01
      })

      const allStartDate = new Date()
      allStartDate.setDate(allStartDate.getDate() - 60)

      const { data: allData, error: allError } = await supabase
        .from("invoices").select("*").eq("invoice_type", "INCURRED").eq("currency", "EUR").eq("is_reconciled", false)
        .gte("schedule_date", allStartDate.toISOString().split("T")[0]).order("schedule_date", { ascending: false }).limit(100)
      if (allError) throw allError

      const exactMatchIds = new Set(exactMatches.map((inv: Invoice) => inv.id))
      const availableForPartial = (allData || []).filter((inv: Invoice) => !exactMatchIds.has(inv.id))

      setMatchingInvoices(exactMatches)
      setAllAvailableInvoices(availableForPartial)
    } catch (e: any) {
      console.error("Error loading invoices:", e)
      toast({ title: "Error", description: "Failed to load invoices", variant: "destructive" })
      setMatchingInvoices([]); setAllAvailableInvoices([])
    } finally { setLoadingInvoices(false) }
  }

  // Perform reconciliation with invoice
  const performReconciliation = async () => {
    if (!reconciliationTransaction || !selectedInvoice) return
    try {
      const txAmount = Math.abs(reconciliationTransaction.amount)
      const invoice = [...matchingInvoices, ...allAvailableInvoices].find(inv => inv.id === selectedInvoice)
      if (!invoice) throw new Error("Invoice not found")

      const paidAmount = invoice.paid_amount ?? invoice.invoice_amount ?? 0
      const isFullyReconciled = Math.abs(txAmount - paidAmount) < 0.01

      const { error: invoiceError } = await supabase.from("invoices").update({
        is_reconciled: true, reconciled_transaction_id: reconciliationTransaction.id,
        reconciled_at: new Date().toISOString(), reconciled_amount: paidAmount
      }).eq("id", selectedInvoice)
      if (invoiceError) throw invoiceError

      const { error: txError } = await supabase.from("csv_rows").update({
        reconciled: isFullyReconciled,
        custom_data: { ...reconciliationTransaction.custom_data, reconciliationType: "manual", reconciled_at: new Date().toISOString(), matched_invoice_id: selectedInvoice, matched_invoice_amount: paidAmount }
      }).eq("id", reconciliationTransaction.id)
      if (txError) throw txError

      setRows((prev) => prev.map((row) => row.id === reconciliationTransaction.id ? { ...row, reconciled: isFullyReconciled, reconciliationType: "manual" as const } : row))
      toast({ title: isFullyReconciled ? "Fully reconciled!" : "Partial reconciliation", description: isFullyReconciled ? "Transaction matched with invoice" : "Remaining: €" + (txAmount - paidAmount).toFixed(2), variant: "success" })
      setReconciliationDialogOpen(false); setReconciliationTransaction(null); setSelectedInvoice(null)
    } catch (e: any) { toast({ title: "Error", description: e?.message || "Failed to reconcile", variant: "destructive" }) }
  }

  // Perform intercompany reconciliation
  const performIntercompanyReconciliation = async () => {
    if (!reconciliationTransaction || !selectedBankAccount) return
    try {
      const bankAccount = bankAccounts.find(acc => acc.code === selectedBankAccount)
      if (!bankAccount) throw new Error("Bank account not found")

      const { error: txError } = await supabase.from("csv_rows").update({
        reconciled: true,
        custom_data: {
          ...reconciliationTransaction.custom_data,
          reconciliationType: "manual",
          reconciled_at: new Date().toISOString(),
          is_intercompany: true,
          intercompany_account_code: selectedBankAccount,
          intercompany_account_name: bankAccount.name,
          exclude_from_pnl: true,
          cash_flow_category: "intercompany_transfer"
        }
      }).eq("id", reconciliationTransaction.id)
      if (txError) throw txError

      setRows((prev) => prev.map((row) => row.id === reconciliationTransaction.id ? { ...row, reconciled: true, reconciliationType: "manual" as const } : row))
      const direction = reconciliationTransaction.amount > 0 ? "from" : "to"
      toast({ title: "Intercompany Transfer", description: "Marked as transfer " + direction + " " + bankAccount.name, variant: "success" })
      setReconciliationDialogOpen(false); setReconciliationTransaction(null); setIsIntercompany(false); setSelectedBankAccount(null)
    } catch (e: any) { toast({ title: "Error", description: e?.message || "Failed to reconcile", variant: "destructive" }) }
  }

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-[#1e1f21]"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>

  return (
    <div className="min-h-screen bg-[#1e1f21] text-white flex">
      <div className={"flex-1 transition-all duration-300 " + (selectedRow ? "mr-[450px]" : "")}>
        {/* Header */}
        <div className="border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="bg-[#FF7300] p-2 rounded-lg"><Database className="h-6 w-6 text-white" /></div>
              <div>
                <h1 className="text-xl font-semibold">Bankinter EUR - Bank Statement</h1>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-gray-400 text-sm">{rows.length} records</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-400 text-sm">ES91 0128 0823 3901 0005 8256</span>
                  {lastSaved && <><span className="text-gray-600">•</span><span className="text-blue-400 text-sm flex items-center gap-1"><Database className="h-3 w-3" />Last saved: {lastSaved}</span></>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Current Balance</p>
              <p className={"text-2xl font-bold " + (stats.closingBalance >= 0 ? "text-green-400" : "text-red-400")}>€{formatEuropeanCurrency(stats.closingBalance)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input type="file" accept=".xlsx" onChange={handleFileUpload} className="hidden" id="file-upload-bankinter" />
              <label htmlFor="file-upload-bankinter"><Button variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-700" asChild><span><Upload className="h-4 w-4 mr-1" />Upload XLSX</span></Button></label>
              <Button onClick={loadData} disabled={isLoading} variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-700"><RefreshCw className={"h-4 w-4 mr-1 " + (isLoading ? "animate-spin" : "")} />Refresh</Button>
              <Button onClick={downloadCSV} variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-700"><Download className="h-4 w-4 mr-1" />Download</Button>
              <Button onClick={handleDeleteAll} variant="outline" size="sm" className="bg-transparent border-red-800 text-red-400 hover:bg-red-900/30" disabled={isDeleting || rows.length === 0}>{isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}Delete All</Button>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-64 bg-transparent border-gray-600 text-white placeholder:text-gray-500" /></div>
              <Button variant="outline" size="sm" onClick={() => setShowReconciled(!showReconciled)} className={"bg-transparent border-gray-600 hover:bg-gray-700 " + (showReconciled ? "text-white" : "text-green-400")}><CheckCircle className="h-4 w-4 mr-1" />{showReconciled ? "Hide Reconciled" : "Show Reconciled"}</Button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="border-b border-gray-700 px-6 py-3 bg-[#252627]">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2"><span className="text-gray-400 text-sm">Credits:</span><span className="text-green-400 font-medium">€{formatEuropeanCurrency(stats.totalCredits)}</span></div>
            <div className="flex items-center gap-2"><span className="text-gray-400 text-sm">Debits:</span><span className="text-red-400 font-medium">€{formatEuropeanCurrency(stats.totalDebits)}</span></div>
            <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-gray-400 text-sm">Reconciled:</span><span className="text-white font-medium">{stats.reconciledCount}</span></div>
            <div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-yellow-500" /><span className="text-gray-400 text-sm">Unreconciled:</span><span className="text-yellow-400 font-medium">{stats.unreconciledCount}</span></div>
          </div>
        </div>

        {/* Table Header */}
        <div className="sticky top-0 z-10 bg-[#2a2b2d] border-b border-gray-700">
          <div className="flex items-center gap-1 px-4 py-2 text-[11px] text-gray-400 font-medium uppercase">
            <div className="w-[70px] flex-shrink-0">Date</div>
            <div className="w-[70px] flex-shrink-0">Key</div>
            <div className="w-[90px] flex-shrink-0">Reference</div>
            <div className="flex-1 min-w-[200px]">Description</div>
            <div className="w-[90px] flex-shrink-0 text-right">Debit</div>
            <div className="w-[90px] flex-shrink-0 text-right">Credit</div>
            <div className="w-[100px] flex-shrink-0 text-right">Balance</div>
            <div className="w-[100px] flex-shrink-0 text-center">Source</div>
            <div className="w-[80px] flex-shrink-0 text-center">Reconciled</div>
            <div className="w-[70px] flex-shrink-0 text-center">Actions</div>
          </div>
        </div>

        {/* Content */}
        <div className="pb-20">
          {groups.map((group) => (
            <div key={group.date} className="border-b border-gray-800">
              <div className="flex items-center gap-2 px-4 py-3 hover:bg-gray-800/50 cursor-pointer" onClick={() => toggleGroup(group.date)}>
                {expandedGroups.has(group.date) ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                <span className="font-medium text-white">{group.dateLabel}</span>
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-gray-500 text-sm ml-auto">{group.rows.length} transactions<span className="mx-2">|</span><span className="text-green-400">+€{formatEuropeanCurrency(group.totalCredits)}</span><span className="mx-1">/</span><span className="text-red-400">-€{formatEuropeanCurrency(group.totalDebits)}</span></span>
              </div>
              {expandedGroups.has(group.date) && (
                <div>
                  {group.rows.map((row) => {
                    const sourceStyle = getPaymentSourceStyle(row.paymentSource)
                    const customData = row.custom_data || {}
                    const isDebit = row.amount < 0
                    const isCredit = row.amount > 0
                    return (
                      <div key={row.id} className={"flex items-center gap-1 px-4 py-2 hover:bg-gray-800/30 border-t border-gray-800/50 group cursor-pointer " + (selectedRow?.id === row.id ? "bg-gray-700/50" : "")} onClick={() => setSelectedRow(row)}>
                        <div className="w-[70px] flex-shrink-0 text-[11px] text-gray-300">{formatShortDate(row.date)}</div>
                        <div className="w-[70px] flex-shrink-0 text-[11px] text-gray-500">{customData.clave || "-"}</div>
                        <div className="w-[90px] flex-shrink-0 text-[11px] text-gray-500 truncate">{customData.referencia || "-"}</div>
                        <div className="flex-1 min-w-[200px] text-[12px] text-white truncate" title={row.description}>{row.description}</div>
                        <div className="w-[90px] flex-shrink-0 text-right text-[11px] font-mono">{isDebit ? <span className="text-red-400">€{formatEuropeanCurrency(Math.abs(row.amount))}</span> : <span className="text-gray-600">-</span>}</div>
                        <div className="w-[90px] flex-shrink-0 text-right text-[11px] font-mono">{isCredit ? <span className="text-green-400">€{formatEuropeanCurrency(row.amount)}</span> : <span className="text-gray-600">-</span>}</div>
                        <div className="w-[100px] flex-shrink-0 text-right text-[11px] font-mono font-medium text-white">€{formatEuropeanCurrency(customData.saldo)}</div>
                        <div className="w-[100px] flex-shrink-0 text-center">{row.paymentSource ? <Badge variant="outline" className={"text-[9px] px-1.5 py-0 " + sourceStyle.bg + " " + sourceStyle.text + " " + sourceStyle.border}>{row.paymentSource}</Badge> : <span className="text-gray-600 text-[10px]">-</span>}</div>
                        <div className="w-[80px] flex-shrink-0 text-center" onClick={(e) => e.stopPropagation()}>
                          {row.reconciled ? (
                            <div className="flex items-center justify-center gap-1">
                              {row.reconciliationType === "automatic" ? <><Zap className="h-4 w-4 text-green-500" /><span className="text-[9px] text-green-400">Auto</span></> : <><User className="h-4 w-4 text-blue-500" /><span className="text-[9px] text-blue-400">Manual</span></>}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openReconciliationDialog(row)} className="h-5 w-5 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/30" title="Find matching invoice"><Link2 className="h-3.5 w-3.5" /></Button>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-yellow-900/30 text-yellow-400 border-yellow-700">Pending</Badge>
                            </div>
                          )}
                        </div>
                        <div className="w-[70px] flex-shrink-0 flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {editingRow === row.id ? <><Button size="sm" variant="ghost" onClick={saveEdit} className="h-6 w-6 p-0 text-green-400 hover:text-green-300 hover:bg-green-900/30"><Save className="h-3 w-3" /></Button><Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 w-6 p-0 text-gray-400 hover:text-gray-300 hover:bg-gray-700"><X className="h-3 w-3" /></Button></> : <><Button size="sm" variant="ghost" onClick={() => startEditing(row)} className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-700" disabled={isDeleting}><Edit2 className="h-3 w-3" /></Button><Button size="sm" variant="ghost" onClick={() => handleDeleteRow(row.id)} className="h-6 w-6 p-0 text-gray-400 hover:text-red-400 hover:bg-red-900/30" disabled={isDeleting}>{isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}</Button></>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
          {groups.length === 0 && <div className="text-center py-20 text-gray-500"><Database className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No transactions found</p><p className="text-sm mt-1">Upload an XLSX file to get started</p></div>}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedRow && (
        <div className="fixed right-0 top-0 h-full w-[450px] bg-[#1e1f21] border-l border-gray-700 flex flex-col z-[100] shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <div className="flex items-center gap-2">{selectedRow.reconciled ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-yellow-500" />}<span className="font-medium text-white truncate max-w-[300px]">{selectedRow.description}</span></div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white" onClick={() => setSelectedRow(null)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-4 space-y-4 border-b border-gray-800">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-gray-500" /><div><p className="text-xs text-gray-500">Date</p><p className="text-sm text-white">{formatShortDate(selectedRow.date)}</p></div></div>
                <div className="flex items-center gap-3"><DollarSign className="h-4 w-4 text-gray-500" /><div><p className="text-xs text-gray-500">Amount</p><p className={"text-sm font-bold " + (selectedRow.amount >= 0 ? "text-green-400" : "text-red-400")}>€{formatEuropeanCurrency(selectedRow.amount)}</p></div></div>
              </div>
              <div className="flex items-center gap-3"><FileText className="h-4 w-4 text-gray-500" /><div className="flex-1"><p className="text-xs text-gray-500">Description</p><p className="text-sm text-white">{selectedRow.description}</p></div></div>
              <div className="grid grid-cols-2 gap-4"><div><p className="text-xs text-gray-500">Key</p><p className="text-sm text-gray-300">{selectedRow.custom_data?.clave || "-"}</p></div><div><p className="text-xs text-gray-500">Reference</p><p className="text-sm text-gray-300">{selectedRow.custom_data?.referencia || "-"}</p></div></div>
              <div className="grid grid-cols-2 gap-4"><div><p className="text-xs text-gray-500">Category</p><p className="text-sm text-gray-300">{selectedRow.custom_data?.categoria || "-"}</p></div><div><p className="text-xs text-gray-500">Balance</p><p className="text-sm text-white font-medium">€{formatEuropeanCurrency(selectedRow.custom_data?.saldo)}</p></div></div>
            </div>
            <div className="px-4 py-4 space-y-4 border-b border-gray-800 bg-[#252627]">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Link2 className="h-4 w-4" />Reconciliation</h3>
              <div className="flex items-center gap-3"><div className="flex-1"><p className="text-xs text-gray-500">Status</p>{selectedRow.reconciled ? <Badge variant="outline" className="bg-green-900/30 text-green-400 border-green-700">Reconciled ({selectedRow.reconciliationType === "automatic" ? "Auto" : "Manual"})</Badge> : <Badge variant="outline" className="bg-yellow-900/30 text-yellow-400 border-yellow-700">Not Reconciled</Badge>}</div></div>
              {selectedRow.paymentSource && <div><p className="text-xs text-gray-500 mb-1">Payment Source</p><Badge variant="outline" className={getPaymentSourceStyle(selectedRow.paymentSource).bg + " " + getPaymentSourceStyle(selectedRow.paymentSource).text + " " + getPaymentSourceStyle(selectedRow.paymentSource).border}>{selectedRow.paymentSource}</Badge></div>}
              {selectedRow.braintreeSettlementBatchId && <div><p className="text-xs text-gray-500 mb-1">Braintree Batch ID</p><div className="flex items-center gap-2"><Key className="h-3 w-3 text-gray-500" /><span className="text-xs font-mono text-gray-300">{selectedRow.braintreeSettlementBatchId}</span></div>{selectedRow.braintreeTransactionCount && <p className="text-xs text-gray-500 mt-1">{selectedRow.braintreeTransactionCount} transactions</p>}</div>}
              {selectedRow.reconciledAt && <div><p className="text-xs text-gray-500">Reconciled At</p><p className="text-sm text-gray-300">{formatTimestamp(new Date(selectedRow.reconciledAt))}</p></div>}
            </div>
            {selectedRow.reconciled && selectedRow.bankMatchAmount && (
              <div className="px-4 py-4 space-y-3 bg-green-900/10">
                <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider flex items-center gap-2"><Zap className="h-4 w-4" />Matched Transaction</h3>
                <div className="space-y-2 text-sm">{selectedRow.bankMatchDate && <div className="flex justify-between"><span className="text-gray-400">Date:</span><span className="text-white">{formatShortDate(selectedRow.bankMatchDate)}</span></div>}<div className="flex justify-between"><span className="text-gray-400">Amount:</span><span className="text-green-400 font-medium">€{formatEuropeanCurrency(selectedRow.bankMatchAmount)}</span></div>{selectedRow.bankMatchDescription && <div><span className="text-gray-400">Description:</span><p className="text-white text-xs mt-1">{selectedRow.bankMatchDescription}</p></div>}</div>
              </div>
            )}
            {editingRow === selectedRow.id && (
              <div className="px-4 py-4 space-y-4 border-b border-gray-800">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Edit</h3>
                <div className="space-y-2"><label className="text-xs text-gray-400">Payment Source</label><Select value={editedData.paymentSource || ""} onValueChange={(value) => setEditedData({ ...editedData, paymentSource: value })}><SelectTrigger className="bg-[#1e1f21] border-gray-600 text-white"><SelectValue placeholder="Select source" /></SelectTrigger><SelectContent><SelectItem value="Braintree EUR">Braintree EUR</SelectItem><SelectItem value="Braintree USD">Braintree USD</SelectItem><SelectItem value="Braintree Amex">Braintree Amex</SelectItem><SelectItem value="Stripe">Stripe</SelectItem><SelectItem value="GoCardless">GoCardless</SelectItem></SelectContent></Select></div>
              </div>
            )}
          </div>
          <div className="border-t border-gray-700 px-4 py-3 flex justify-end gap-2">
            {editingRow === selectedRow.id ? <><Button variant="ghost" size="sm" onClick={cancelEdit} className="text-gray-400 hover:text-white">Cancel</Button><Button size="sm" onClick={saveEdit} className="bg-green-600 hover:bg-green-700 text-white"><Save className="h-4 w-4 mr-1" />Save</Button></> : <Button variant="outline" size="sm" onClick={() => startEditing(selectedRow)} className="border-gray-600 text-white hover:bg-gray-700"><Edit2 className="h-4 w-4 mr-1" />Edit</Button>}
          </div>
        </div>
      )}

      {/* Reconciliation Dialog */}
      {reconciliationDialogOpen && reconciliationTransaction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]">
          <div className="bg-[#2a2b2d] rounded-lg w-[650px] max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <div><h3 className="text-lg font-semibold text-white">Find Matching Invoice</h3><p className="text-sm text-gray-400">Link bank transaction to an invoice or mark as intercompany</p></div>
              <Button variant="ghost" size="sm" onClick={() => setReconciliationDialogOpen(false)} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></Button>
            </div>
            <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-700">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-gray-500">Date</span><p className="text-white font-medium">{formatShortDate(reconciliationTransaction.date)}</p></div>
                <div><span className="text-gray-500">Amount</span><p className={"font-medium " + (reconciliationTransaction.amount >= 0 ? "text-green-400" : "text-red-400")}>€{formatEuropeanCurrency(reconciliationTransaction.amount)}</p></div>
                <div><span className="text-gray-500">Description</span><p className="text-white font-medium truncate" title={reconciliationTransaction.description}>{reconciliationTransaction.description.substring(0, 30)}...</p></div>
              </div>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
              {/* Intercompany Toggle */}
              <div className="p-4 rounded-lg border border-orange-700/50 bg-orange-900/10">
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="intercompany-toggle" checked={isIntercompany} onChange={(e) => { setIsIntercompany(e.target.checked); if (e.target.checked) setSelectedInvoice(null); else setSelectedBankAccount(null) }} className="h-5 w-5 rounded border-orange-600 bg-transparent text-orange-500 focus:ring-orange-500" />
                  <label htmlFor="intercompany-toggle" className="flex items-center gap-2 cursor-pointer"><ArrowLeftRight className="h-4 w-4 text-orange-400" /><span className="text-sm font-medium text-orange-400">Intercompany Transfer</span></label>
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-8">Transfer between company bank accounts. Does not affect P&L.</p>
                {isIntercompany && (
                  <div className="mt-4 ml-8 space-y-3">
                    <p className="text-xs text-gray-400">{reconciliationTransaction.amount > 0 ? "Select the account this money came FROM:" : "Select the account this money went TO:"}</p>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {bankAccounts.length === 0 ? <div className="text-center py-3 text-gray-500 bg-gray-800/30 rounded-lg border border-gray-700"><p className="text-sm">No other bank accounts found</p></div> : bankAccounts.map((acc) => (
                        <div key={acc.code} onClick={() => setSelectedBankAccount(acc.code)} className={"p-3 rounded-lg border cursor-pointer transition-all " + (selectedBankAccount === acc.code ? "border-orange-500 bg-orange-900/20" : "border-gray-700 hover:border-orange-600 bg-gray-800/30")}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <input type="radio" checked={selectedBankAccount === acc.code} onChange={() => setSelectedBankAccount(acc.code)} className="h-4 w-4 text-orange-600" />
                              <div><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-orange-400" /><p className="text-white text-sm font-medium">{acc.name}</p></div><p className="text-xs text-gray-500">{acc.bank_name || acc.code} • {acc.currency}</p></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Invoice Sections (hidden when intercompany) */}
              {!isIntercompany && (
                <>
                <div>
                  <h4 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2"><Zap className="h-4 w-4" />Suggested Match (exact amount, ±3 days)</h4>
                  {loadingInvoices ? <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                  : matchingInvoices.length === 0 ? <div className="text-center py-4 text-gray-500 bg-gray-800/30 rounded-lg border border-gray-700"><p className="text-sm">No exact match found</p><p className="text-xs mt-1">Select from available invoices below</p></div>
                  : <div className="space-y-2">{matchingInvoices.map((inv) => (
                      <div key={inv.id} onClick={() => setSelectedInvoice(inv.id)} className={"p-3 rounded-lg border cursor-pointer transition-all " + (selectedInvoice === inv.id ? "border-green-500 bg-green-900/20" : "border-green-700/50 hover:border-green-600 bg-green-900/10")}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3"><input type="radio" checked={selectedInvoice === inv.id} onChange={() => setSelectedInvoice(inv.id)} className="h-4 w-4 text-green-600" /><div><p className="text-white text-sm">{inv.invoice_number || "Invoice #" + inv.id}</p><p className="text-xs text-gray-500">{inv.schedule_date ? formatShortDate(inv.schedule_date) : "No date"} • {inv.provider_code || "No provider"}</p></div></div>
                          <div className="text-right"><p className="font-medium text-red-400">€{formatEuropeanCurrency(inv.paid_amount ?? inv.invoice_amount)}</p><span className="text-[10px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">EXACT MATCH</span></div>
                        </div>
                      </div>
                    ))}</div>}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2"><Search className="h-4 w-4" />All Available Invoices</h4>
                  {loadingInvoices ? <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                  : allAvailableInvoices.length === 0 ? <div className="text-center py-4 text-gray-500 bg-gray-800/30 rounded-lg border border-gray-700"><p className="text-sm">No other invoices available</p></div>
                  : <div className="space-y-2 max-h-[250px] overflow-y-auto">{allAvailableInvoices.map((inv) => (
                      <div key={inv.id} onClick={() => setSelectedInvoice(inv.id)} className={"p-3 rounded-lg border cursor-pointer transition-all " + (selectedInvoice === inv.id ? "border-blue-500 bg-blue-900/20" : "border-gray-700 hover:border-gray-600 bg-gray-800/30")}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3"><input type="radio" checked={selectedInvoice === inv.id} onChange={() => setSelectedInvoice(inv.id)} className="h-4 w-4 text-blue-600" /><div><p className="text-white text-sm">{inv.invoice_number || "Invoice #" + inv.id}</p><p className="text-xs text-gray-500">{inv.schedule_date ? formatShortDate(inv.schedule_date) : "No date"} • {inv.provider_code || "No provider"}</p></div></div>
                          <div className="text-right"><p className="font-medium text-red-400">€{formatEuropeanCurrency(inv.paid_amount ?? inv.invoice_amount)}</p></div>
                        </div>
                      </div>
                    ))}</div>}
                </div>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setReconciliationDialogOpen(false)} className="border-gray-600 text-gray-300 hover:bg-gray-700">Cancel</Button>
              {isIntercompany ? (
                <Button onClick={performIntercompanyReconciliation} disabled={!selectedBankAccount} className="bg-orange-600 hover:bg-orange-700"><ArrowLeftRight className="h-4 w-4 mr-2" />Mark Intercompany</Button>
              ) : (
                <Button onClick={performReconciliation} disabled={!selectedInvoice} className="bg-cyan-600 hover:bg-cyan-700"><Link2 className="h-4 w-4 mr-2" />Reconcile</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
