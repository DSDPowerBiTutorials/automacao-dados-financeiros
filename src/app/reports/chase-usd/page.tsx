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
    Key,
    Search,
    Link2,
    ArrowLeftRight,
    Building2
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatTimestamp, formatDate } from "@/lib/formatters"
import { useToast } from "@/hooks/use-toast"

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
    isIntercompany?: boolean
    intercompanyAccountCode?: string | null
    intercompanyAccountName?: string | null
    intercompanyNote?: string | null
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
        is_intercompany?: boolean
        intercompany_account_code?: string
        intercompany_account_name?: string
        intercompany_note?: string
        intercompany_linked_id?: string
        exclude_from_pnl?: boolean
        cash_flow_category?: string
        reconciliationType?: string
        reconciled_at?: string
    }
    [key: string]: any
}

// Intercompany Match
interface IntercompanyMatch {
    id: string
    source: string
    sourceLabel: string
    date: string
    amount: number
    currency: string
    description: string
}

// Bank Account interface for intercompany
interface BankAccount {
    code: string
    name: string
    currency: string
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
    const [isAutoReconciling, setIsAutoReconciling] = useState(false)

    // Intercompany states
    const [reconciliationDialogOpen, setReconciliationDialogOpen] = useState(false)
    const [reconciliationTransaction, setReconciliationTransaction] = useState<ChaseUSDRow | null>(null)
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
    const [selectedBankAccount, setSelectedBankAccount] = useState<string | null>(null)
    const [intercompanyNote, setIntercompanyNote] = useState("")
    const [intercompanyMatches, setIntercompanyMatches] = useState<IntercompanyMatch[]>([])
    const [selectedIntercompanyMatch, setSelectedIntercompanyMatch] = useState<string | null>(null)
    const [showIntercompany, setShowIntercompany] = useState(true)
    const [isReverting, setIsReverting] = useState(false)

    const { toast } = useToast()

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        applyFilters()
    }, [rows, dateFrom, dateTo, showIntercompany])

    const applyFilters = () => {
        let filtered = rows

        if (dateFrom) {
            filtered = filtered.filter((row) => row.date >= dateFrom)
        }

        if (dateTo) {
            filtered = filtered.filter((row) => row.date <= dateTo)
        }

        if (!showIntercompany) {
            filtered = filtered.filter(row => !row.isIntercompany)
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
                    isIntercompany: row.custom_data?.is_intercompany || false,
                    intercompanyAccountCode: row.custom_data?.intercompany_account_code || null,
                    intercompanyAccountName: row.custom_data?.intercompany_account_name || null,
                    intercompanyNote: row.custom_data?.intercompany_note || null,
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

    const deleteRow = async (id: string) => {
        if (!confirm("Delete this row?")) return
        try {
            const { error } = await supabase.from("csv_rows").delete().eq("id", id)
            if (error) throw error
            setRows((prev) => prev.filter((r) => r.id !== id))
        } catch (error) {
            console.error("Error deleting row:", error)
            alert("Error deleting row")
        }
    }

    const handleDeleteAll = async () => {
        if (!confirm("⚠️ WARNING: This will DELETE ALL rows from Chase 9186! Are you sure?")) return
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

    const handleAutoReconcile = async () => {
        setIsAutoReconciling(true)
        try {
            const response = await fetch("/api/reconcile/bank-disbursement", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bankSource: "chase-usd",
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

    // === INTERCOMPANY FUNCTIONS ===

    // Load bank accounts for intercompany selection
    useEffect(() => {
        const loadBankAccounts = async () => {
            try {
                const { data } = await supabase
                    .from("bank_accounts")
                    .select("code, name, currency")
                    .eq("is_active", true)
                if (data) setBankAccounts(data)
            } catch (e) {
                console.error("Error loading bank accounts:", e)
            }
        }
        loadBankAccounts()
    }, [])

    const loadIntercompanyMatches = async (transaction: ChaseUSDRow) => {
        try {
            const transactionDate = transaction.date?.split("T")[0]
            if (!transactionDate) return

            const txAmount = Math.abs(transaction.amount)
            const startDate = new Date(transactionDate)
            startDate.setDate(startDate.getDate() - 10)
            const endDate = new Date(transactionDate)
            endDate.setDate(endDate.getDate() + 10)

            const otherBankSources = ["bankinter-eur", "sabadell-eur", "bankinter-usd"]
            const matches: IntercompanyMatch[] = []

            for (const source of otherBankSources) {
                const { data: candidates } = await supabase
                    .from("csv_rows")
                    .select("id, date, amount, description, custom_data")
                    .eq("source", source)
                    .eq("reconciled", false)
                    .gte("date", startDate.toISOString().split("T")[0])
                    .lte("date", endDate.toISOString().split("T")[0])
                    .limit(50)

                if (!candidates) continue

                const isCrossCurrency = source.includes("eur")

                candidates.forEach(tx => {
                    const txAmt = parseFloat(tx.amount) || 0

                    let isMatch = false
                    if (isCrossCurrency) {
                        // Cross-currency: USD→EUR ratio check
                        const absUsd = txAmount
                        const absEur = Math.abs(txAmt)
                        const ratio = absEur > 0 ? absUsd / absEur : 0
                        isMatch = ratio >= 1.02 && ratio <= 1.25
                    } else {
                        // Same currency: 1% tolerance
                        const amountDiff = Math.abs(Math.abs(txAmt) - txAmount)
                        isMatch = amountDiff < txAmount * 0.01
                    }

                    const hasOppositeSigns = (transaction.amount > 0 && txAmt < 0) || (transaction.amount < 0 && txAmt > 0)

                    if (isMatch && hasOppositeSigns) {
                        const currency = source.includes("usd") ? "USD" : "EUR"
                        const sourceLabel = source === "bankinter-eur" ? "Bankinter EUR"
                            : source === "bankinter-usd" ? "Bankinter USD"
                                : source === "sabadell-eur" ? "Sabadell EUR" : source

                        matches.push({
                            id: tx.id,
                            source,
                            sourceLabel,
                            date: tx.date?.split("T")[0] || "",
                            amount: txAmt,
                            currency,
                            description: tx.description || ""
                        })
                    }
                })
            }

            setIntercompanyMatches(matches)
        } catch (e) {
            console.error("Error loading intercompany matches:", e)
        }
    }

    const openReconciliationDialog = (row: ChaseUSDRow) => {
        setReconciliationTransaction(row)
        setReconciliationDialogOpen(true)
        setSelectedBankAccount(null)
        setIntercompanyNote("")
        setSelectedIntercompanyMatch(null)
        loadIntercompanyMatches(row)
    }

    const performIntercompanyReconciliation = async () => {
        if (!reconciliationTransaction || !selectedBankAccount) return

        try {
            const bankAccount = bankAccounts.find(acc => acc.code === selectedBankAccount)
            if (!bankAccount) throw new Error("Bank account not found")

            const now = new Date().toISOString()
            const txDate = new Date(reconciliationTransaction.date)
            const startDate = new Date(txDate)
            startDate.setDate(startDate.getDate() - 10)
            const endDate = new Date(txDate)
            endDate.setDate(endDate.getDate() + 10)

            const counterpartSource = selectedBankAccount.toLowerCase()
            const isCrossCurrencyLink = counterpartSource.includes("eur") || counterpartSource.includes("sabadell")

            const { data: candidates } = await supabase
                .from("csv_rows")
                .select("*")
                .eq("source", counterpartSource)
                .eq("reconciled", false)
                .gte("date", startDate.toISOString().split("T")[0])
                .lte("date", endDate.toISOString().split("T")[0])

            // eslint-disable-next-line
            let counterpartMatch: any = null

            if (candidates && candidates.length > 0) {
                if (isCrossCurrencyLink) {
                    counterpartMatch = candidates.find(c => {
                        const cAmount = parseFloat(c.amount) || 0
                        const hasOppositeSigns = (reconciliationTransaction.amount > 0 && cAmount < 0) || (reconciliationTransaction.amount < 0 && cAmount > 0)
                        if (!hasOppositeSigns) return false
                        const absUsd = Math.abs(reconciliationTransaction.amount)
                        const absEur = Math.abs(cAmount)
                        const ratio = absEur > 0 ? absUsd / absEur : 0
                        return ratio >= 1.02 && ratio <= 1.25
                    })
                } else {
                    const oppositeAmount = -reconciliationTransaction.amount
                    counterpartMatch = candidates.find(c => {
                        const cAmount = parseFloat(c.amount) || 0
                        return Math.abs(cAmount - oppositeAmount) < 0.01
                    })
                    if (!counterpartMatch) {
                        const tolerance = Math.abs(reconciliationTransaction.amount) * 0.005
                        counterpartMatch = candidates.find(c => {
                            const cAmount = parseFloat(c.amount) || 0
                            return Math.abs(cAmount + reconciliationTransaction.amount) <= tolerance
                        })
                    }
                }
            }

            // Update THIS transaction as intercompany
            const { error: txError } = await supabase
                .from("csv_rows")
                .update({
                    reconciled: true,
                    custom_data: {
                        ...reconciliationTransaction.custom_data,
                        reconciliationType: "manual",
                        reconciled_at: now,
                        is_intercompany: true,
                        intercompany_account_code: selectedBankAccount,
                        intercompany_account_name: bankAccount.name,
                        intercompany_note: intercompanyNote || null,
                        intercompany_linked_id: counterpartMatch?.id || null,
                        exclude_from_pnl: true,
                        cash_flow_category: "intercompany_transfer"
                    }
                })
                .eq("id", reconciliationTransaction.id)

            if (txError) throw txError

            // If counterpart found, update it too
            if (counterpartMatch) {
                await supabase
                    .from("csv_rows")
                    .update({
                        reconciled: true,
                        custom_data: {
                            ...counterpartMatch.custom_data,
                            reconciliationType: "manual",
                            reconciled_at: now,
                            is_intercompany: true,
                            intercompany_account_code: "chase-usd",
                            intercompany_account_name: "Chase USD",
                            intercompany_note: intercompanyNote || null,
                            intercompany_linked_id: reconciliationTransaction.id,
                            exclude_from_pnl: true,
                            cash_flow_category: "intercompany_transfer"
                        }
                    })
                    .eq("id", counterpartMatch.id)
            }

            // Update local state
            setRows(prev => prev.map(row =>
                row.id === reconciliationTransaction.id
                    ? {
                        ...row,
                        conciliado: true,
                        reconciliationType: "manual" as const,
                        isIntercompany: true,
                        intercompanyAccountCode: selectedBankAccount,
                        intercompanyAccountName: bankAccount.name,
                        intercompanyNote: intercompanyNote || null
                    }
                    : row
            ))

            const direction = reconciliationTransaction.amount > 0 ? "from" : "to"
            toast({
                title: counterpartMatch ? "✓ Intercompany Linked" : "Intercompany Transfer",
                description: counterpartMatch
                    ? `Both transactions marked as transfer ${direction} ${bankAccount.name}`
                    : `Marked as transfer ${direction} ${bankAccount.name} (counterpart not found)`
            })

            setReconciliationDialogOpen(false)
            setReconciliationTransaction(null)
            setSelectedBankAccount(null)
            setIntercompanyNote("")
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to reconcile"
            toast({ title: "Error", description: msg })
        }
    }

    const revertIntercompanyReconciliation = async (row: ChaseUSDRow) => {
        const hasLinked = row.custom_data?.intercompany_linked_id
        const confirmMsg = hasLinked
            ? "Revert this intercompany transaction AND its linked counterpart?"
            : "Revert this intercompany transaction?"

        if (!confirm(confirmMsg)) return

        setIsReverting(true)
        try {
            const cleanedCustomData = { ...row.custom_data }
            delete cleanedCustomData.is_intercompany
            delete cleanedCustomData.intercompany_account_code
            delete cleanedCustomData.intercompany_account_name
            delete cleanedCustomData.intercompany_note
            delete cleanedCustomData.intercompany_linked_id
            delete cleanedCustomData.exclude_from_pnl
            delete cleanedCustomData.cash_flow_category
            delete cleanedCustomData.reconciliationType
            delete cleanedCustomData.reconciled_at

            const { error } = await supabase
                .from("csv_rows")
                .update({ reconciled: false, custom_data: cleanedCustomData })
                .eq("id", row.id)

            if (error) throw error

            if (hasLinked) {
                const { data: counterpart } = await supabase
                    .from("csv_rows")
                    .select("*")
                    .eq("id", row.custom_data!.intercompany_linked_id!)
                    .single()

                if (counterpart) {
                    const counterpartClean = { ...counterpart.custom_data }
                    delete counterpartClean.is_intercompany
                    delete counterpartClean.intercompany_account_code
                    delete counterpartClean.intercompany_account_name
                    delete counterpartClean.intercompany_note
                    delete counterpartClean.intercompany_linked_id
                    delete counterpartClean.exclude_from_pnl
                    delete counterpartClean.cash_flow_category
                    delete counterpartClean.reconciliationType
                    delete counterpartClean.reconciled_at

                    await supabase
                        .from("csv_rows")
                        .update({ reconciled: false, custom_data: counterpartClean })
                        .eq("id", counterpart.id)
                }
            }

            setRows(prev => prev.map(r =>
                r.id === row.id
                    ? { ...r, conciliado: false, reconciliationType: null, isIntercompany: false, intercompanyAccountCode: null, intercompanyAccountName: null, intercompanyNote: null }
                    : r
            ))

            toast({ title: "Reverted", description: "Intercompany reconciliation reverted" })
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to revert"
            toast({ title: "Error", description: msg })
        } finally {
            setIsReverting(false)
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
        if (!source) return { bg: "bg-gray-100", text: "text-gray-500 dark:text-gray-400", border: "border-gray-200" }
        return paymentSourceColors[source] || { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200" }
    }

    // Calcular estatísticas
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

        const totalIncomes = filteredRows.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0)
        const totalExpenses = filteredRows.filter((row) => row.amount < 0).reduce((sum, row) => sum + row.amount, 0)
        const incomesBySource = filteredRows
            .filter((row) => row.amount > 0 && row.paymentSource)
            .reduce((acc, row) => {
                acc[row.paymentSource!] = (acc[row.paymentSource!] || 0) + row.amount
                return acc
            }, {} as Record<string, number>)
        const unreconciledCount = filteredRows.filter((row) => !row.conciliado).length

        // Ordenar por data (mais antiga primeiro)
        const sortedByDate = [...filteredRows].sort((a, b) => a.date.localeCompare(b.date))

        // Usar balance real do CSV (primeira transação = opening, última = closing)
        const firstRow = sortedByDate[0]
        const lastRow = sortedByDate[sortedByDate.length - 1]

        // Opening Balance = balance da primeira transação MENOS o amount dessa transação
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
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
                <Loader2 className="h-12 w-12 animate-spin text-[#117ACA]" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
            <div>
                <header className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-[#117ACA] p-2 rounded-lg">
                                <Database className="h-6 w-6 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold">Chase 9186 - Bank Statement</h1>
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
                                {formatUSDCurrency(stats.closingBalance)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="file-upload-chase" />
                        <label htmlFor="file-upload-chase">
                            <Button variant="outline" size="sm" className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]" asChild>
                                <span><Upload className="h-4 w-4 mr-1" />Upload CSV</span>
                            </Button>
                        </label>
                        <Button onClick={loadData} disabled={isLoading} variant="outline" size="sm" className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]">
                            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />Refresh
                        </Button>
                        <Button onClick={handleAutoReconcile} disabled={isAutoReconciling} variant="outline" size="sm" className="bg-transparent border-green-700 text-green-400 hover:bg-green-900/30">
                            {isAutoReconciling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                            Auto-Reconcile
                        </Button>
                        <Button onClick={downloadCSV} variant="outline" size="sm" className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]">
                            <Download className="h-4 w-4 mr-1" />Download
                        </Button>
                        <Button onClick={handleDeleteAll} variant="outline" size="sm" className="bg-transparent border-red-800 text-red-400 hover:bg-red-900/30" disabled={isDeleting || rows.length === 0}>
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                            Delete All
                        </Button>
                    </div>
                </header>
            </div>

            {/* Stats Bar */}
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-3 bg-gray-100 dark:bg-[#0a0a0a]">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">Credits:</span>
                        <span className="text-green-400 font-medium">{formatUSDCurrency(stats.totalIncomes)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">Debits:</span>
                        <span className="text-red-400 font-medium">{formatUSDCurrency(stats.totalExpenses)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-yellow-500" />
                        <span className="text-gray-500 dark:text-gray-400 text-sm">Unreconciled:</span>
                        <span className="text-yellow-400 font-medium">{stats.unreconciledCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ArrowLeftRight className="h-4 w-4 text-purple-400" />
                        <span className="text-gray-500 dark:text-gray-400 text-sm">Intercompany:</span>
                        <span className="text-purple-400 font-medium">{filteredRows.filter(r => r.isIntercompany).length}</span>
                    </div>
                </div>
            </div>

            {/* Table Header */}
            <div className="sticky top-0 z-10 bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
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
                            className="flex items-center gap-1 px-4 py-2 hover:bg-gray-50 dark:bg-black/30 border-t border-gray-200 dark:border-gray-800/50 min-w-[800px]"
                        >
                            <div className="w-[70px] flex-shrink-0 text-[11px] text-gray-700 dark:text-gray-300">
                                {formatDate(row.date)}
                            </div>
                            <div className="flex-1 min-w-[200px] text-[11px] text-gray-900 dark:text-white truncate" title={row.description}>
                                {row.description}
                            </div>
                            <div className="w-[90px] flex-shrink-0 text-right text-[11px] font-mono">
                                {isDebit ? (
                                    <span className="text-red-400">{formatUSDCurrency(Math.abs(row.amount))}</span>
                                ) : (
                                    <span className="text-gray-600">-</span>
                                )}
                            </div>
                            <div className="w-[90px] flex-shrink-0 text-right text-[11px] font-mono">
                                {isCredit ? (
                                    <span className="text-green-400">{formatUSDCurrency(row.amount)}</span>
                                ) : (
                                    <span className="text-gray-600">-</span>
                                )}
                            </div>
                            <div className="w-[100px] flex-shrink-0 text-right text-[11px] font-mono font-medium text-gray-900 dark:text-white">
                                {formatUSDCurrency(customData.balance || 0)}
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
                                {row.isIntercompany && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400 border border-purple-700 ml-1">IC</span>
                                )}
                            </div>
                            <div className="w-[70px] flex-shrink-0 flex items-center justify-center gap-1">
                                {editingRow === row.id ? (
                                    <>
                                        <Button size="sm" variant="ghost" onClick={saveEdit} className="h-6 w-6 p-0 text-green-400 hover:text-green-300 hover:bg-green-900/30">
                                            <Save className="h-3 w-3" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111111]">
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button size="sm" variant="ghost" onClick={() => startEditing(row)} className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]">
                                            <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => deleteRow(row.id)} className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-red-400 hover:bg-red-900/30">
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                        {row.isIntercompany ? (
                                            <Button size="sm" variant="ghost" onClick={() => revertIntercompanyReconciliation(row)} disabled={isReverting} className="h-6 w-6 p-0 text-purple-400 hover:text-purple-300 hover:bg-purple-900/30" title="Revert Intercompany">
                                                <ArrowLeftRight className="h-3 w-3" />
                                            </Button>
                                        ) : (
                                            <Button size="sm" variant="ghost" onClick={() => openReconciliationDialog(row)} className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-purple-400 hover:bg-purple-900/30" title="Intercompany">
                                                <Link2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Intercompany Reconciliation Dialog */}
            {reconciliationDialogOpen && reconciliationTransaction && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Intercompany Reconciliation</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {formatDate(reconciliationTransaction.date)} — {reconciliationTransaction.description}
                                </p>
                                <p className="text-sm font-mono mt-1">
                                    <span className={reconciliationTransaction.amount >= 0 ? "text-green-400" : "text-red-400"}>
                                        {formatUSDCurrency(reconciliationTransaction.amount)}
                                    </span>
                                </p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setReconciliationDialogOpen(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Auto-detected matches */}
                            {intercompanyMatches.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-yellow-400" />
                                        Suggested Matches
                                    </h4>
                                    <div className="space-y-2">
                                        {intercompanyMatches.map(match => (
                                            <div
                                                key={match.id}
                                                onClick={() => {
                                                    setSelectedIntercompanyMatch(match.id)
                                                    setSelectedBankAccount(match.source)
                                                }}
                                                className={`p-3 rounded border cursor-pointer transition-all ${selectedIntercompanyMatch === match.id
                                                        ? "border-purple-500 bg-purple-900/20"
                                                        : "border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-black/50 hover:border-gray-300 dark:border-gray-600"
                                                    }`}
                                            >
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-900 dark:text-white">{match.sourceLabel}</span>
                                                    <span className={`text-sm font-mono ${match.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                                                        {match.currency === "EUR" ? "€" : "$"} {Math.abs(match.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    {formatDate(match.date)} — {match.description}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Manual bank account selection */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-blue-400" />
                                    Target Bank Account
                                </h4>
                                <select
                                    value={selectedBankAccount || ""}
                                    onChange={(e) => setSelectedBankAccount(e.target.value || null)}
                                    className="w-full bg-gray-100 dark:bg-black border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded px-3 py-2 text-sm"
                                >
                                    <option value="">Select bank account...</option>
                                    {bankAccounts
                                        .filter(acc => acc.code.toLowerCase() !== "chase-usd")
                                        .map(acc => (
                                            <option key={acc.code} value={acc.code}>
                                                {acc.name} ({acc.currency})
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>

                            {/* Note */}
                            <div>
                                <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">Note (optional)</label>
                                <input
                                    type="text"
                                    value={intercompanyNote}
                                    onChange={(e) => setIntercompanyNote(e.target.value)}
                                    className="w-full bg-gray-100 dark:bg-black border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded px-3 py-2 text-sm"
                                    placeholder="e.g. FX transfer via Continental Exchange"
                                />
                            </div>

                            {/* Confirm button */}
                            <Button
                                onClick={performIntercompanyReconciliation}
                                disabled={!selectedBankAccount}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                <ArrowLeftRight className="h-4 w-4 mr-2" />
                                Confirm Intercompany Transfer
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
