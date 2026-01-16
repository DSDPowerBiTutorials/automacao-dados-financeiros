"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
    Download,
    ArrowLeft,
    Loader2,
    CheckCircle,
    XCircle,
    RefreshCw,
    Calendar,
    DollarSign,
    TrendingUp,
    TrendingDown,
    ArrowUpDown,
    PiggyBank,
    Search
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { formatTimestamp } from "@/lib/formatters"

// Formatar USD
const formatUSD = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return "$0.00"
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value)
}

// Formatar data US
const formatUSDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "-"
    try {
        const date = new Date(dateString)
        if (isNaN(date.getTime())) return dateString
        return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
    } catch {
        return dateString
    }
}

interface ChaseTransaction {
    id: string
    source: string
    date: string
    description: string
    amount: number
    category?: string
    classification?: string
    reconciled: boolean
    custom_data: {
        quickbooks_id?: string
        deposit_account?: string
        deposit_account_id?: string
        from_account?: string
        from_account_id?: string
        to_account?: string
        to_account_id?: string
        total_amount?: number
        currency?: string
        private_note?: string
        line_count?: number
        synced_at?: string
        // QuickBooks Expenses/Payments fields
        account_name?: string
        account_id?: string
        entity_name?: string
        entity_id?: string
        payment_type?: string
        doc_number?: string
        vendor_name?: string
        vendor_id?: string
        bill_id?: string
    }
}

export default function ChaseSavingsPage() {
    const [transactions, setTransactions] = useState<ChaseTransaction[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSyncing, setIsSyncing] = useState(false)
    const [activeTab, setActiveTab] = useState("all")
    const [searchTerm, setSearchTerm] = useState("")
    const [dateFilter, setDateFilter] = useState<{ start?: string; end?: string }>({})
    const [lastSync, setLastSync] = useState<string | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setIsLoading(true)
        try {
            if (!supabase) {
                setTransactions([])
                setIsLoading(false)
                return
            }

            // Buscar TODAS as fontes de dados do QuickBooks
            const [depositsRes, transfersRes, expensesRes, paymentsRes] = await Promise.all([
                supabase.from("csv_rows").select("*").eq("source", "quickbooks-deposits").order("date", { ascending: false }),
                supabase.from("csv_rows").select("*").eq("source", "quickbooks-transfers").order("date", { ascending: false }),
                supabase.from("csv_rows").select("*").eq("source", "quickbooks-expenses").order("date", { ascending: false }),
                supabase.from("csv_rows").select("*").eq("source", "quickbooks-payments").order("date", { ascending: false })
            ])

            const deposits = depositsRes.data || []
            const transfers = transfersRes.data || []
            const expenses = expensesRes.data || []
            const payments = paymentsRes.data || []

            const allTransactions: ChaseTransaction[] = []

            // Helper para verificar se é conta Chase Savings
            const isChaseSavings = (accountName: string | undefined | null): boolean => {
                if (!accountName) return false
                const lower = accountName.toLowerCase()
                return lower.includes("chase") && lower.includes("savings")
            }

            // Deposits que entram na Chase Savings
            deposits.forEach((row) => {
                if (isChaseSavings(row.custom_data?.deposit_account)) {
                    allTransactions.push({
                        ...row,
                        amount: parseFloat(row.amount) || 0,
                        reconciled: row.reconciled || false,
                        classification: "Deposit"
                    })
                }
            })

            // Transfers - entrada e saída
            transfers.forEach((row) => {
                const fromAccount = row.custom_data?.from_account
                const toAccount = row.custom_data?.to_account

                if (isChaseSavings(fromAccount)) {
                    allTransactions.push({
                        ...row,
                        id: row.id + "-out",
                        amount: -(parseFloat(row.amount) || 0),
                        reconciled: row.reconciled || false,
                        classification: "Transfer Out"
                    })
                }

                if (isChaseSavings(toAccount)) {
                    allTransactions.push({
                        ...row,
                        id: row.id + "-in",
                        amount: parseFloat(row.amount) || 0,
                        reconciled: row.reconciled || false,
                        classification: "Transfer In"
                    })
                }
            })

            // Expenses (Purchase) - saídas da conta
            expenses.forEach((row) => {
                if (isChaseSavings(row.custom_data?.account_name)) {
                    allTransactions.push({
                        ...row,
                        amount: parseFloat(row.amount) || 0,
                        reconciled: row.reconciled || false,
                        classification: "Expense"
                    })
                }
            })

            // Payments received - entradas
            payments.forEach((row) => {
                if (isChaseSavings(row.custom_data?.deposit_account)) {
                    allTransactions.push({
                        ...row,
                        amount: parseFloat(row.amount) || 0,
                        reconciled: row.reconciled || false,
                        classification: "Payment Received"
                    })
                }
            })

            // Ordenar por data
            allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

            setTransactions(allTransactions)

            // Pegar última sincronização
            const syncDates = allTransactions
                .map((t) => t.custom_data?.synced_at)
                .filter(Boolean)
                .sort()
                .reverse()
            if (syncDates.length > 0) {
                setLastSync(syncDates[0] || null)
            }
        } catch (error) {
            console.error("Error loading data:", error)
            setTransactions([])
        } finally {
            setIsLoading(false)
        }
    }

    const handleSync = async () => {
        setIsSyncing(true)
        try {
            const response = await fetch("/api/quickbooks/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ syncType: "all" })
            })
            const result = await response.json()

            if (result.success) {
                await loadData()
                alert(`✅ Sync completo!\n• Expenses: ${result.expenses?.count || 0}\n• Deposits: ${result.deposits?.count || 0}\n• Transfers: ${result.transfers?.count || 0}`)
            } else {
                console.error("Sync failed:", result.error)
                alert(`Sync failed: ${result.error}`)
            }
        } catch (error) {
            console.error("Sync error:", error)
            alert("Error syncing data")
        } finally {
            setIsSyncing(false)
        }
    }

    // Filtrar dados
    const filteredTransactions = useMemo(() => {
        let filtered = [...transactions]

        if (activeTab === "inflows") {
            filtered = filtered.filter((t) => t.amount > 0)
        } else if (activeTab === "outflows") {
            filtered = filtered.filter((t) => t.amount < 0)
        } else if (activeTab === "transfers") {
            filtered = filtered.filter((t) => t.source === "quickbooks-transfers")
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            filtered = filtered.filter(
                (t) =>
                    t.description.toLowerCase().includes(term) ||
                    t.custom_data?.private_note?.toLowerCase().includes(term) ||
                    t.custom_data?.entity_name?.toLowerCase().includes(term)
            )
        }

        if (dateFilter.start) {
            filtered = filtered.filter((t) => t.date >= dateFilter.start!)
        }
        if (dateFilter.end) {
            filtered = filtered.filter((t) => t.date <= dateFilter.end!)
        }

        return filtered
    }, [transactions, activeTab, searchTerm, dateFilter])

    // Estatísticas
    const stats = useMemo(() => {
        // Entradas (positivo)
        const inflows = transactions.filter((t) => t.amount > 0)
        const totalInflows = inflows.reduce((sum, t) => sum + t.amount, 0)

        // Saídas (negativo)
        const outflows = transactions.filter((t) => t.amount < 0)
        const totalOutflows = outflows.reduce((sum, t) => sum + Math.abs(t.amount), 0)

        // Por tipo
        const deposits = transactions.filter((t) => t.classification === "Deposit" || t.classification === "Payment Received")
        const expenses = transactions.filter((t) => t.classification === "Expense")
        const transfers = transactions.filter((t) => t.classification?.includes("Transfer"))

        const netBalance = totalInflows - totalOutflows

        return {
            inflows: { count: inflows.length, total: totalInflows },
            outflows: { count: outflows.length, total: totalOutflows },
            deposits: { count: deposits.length },
            expenses: { count: expenses.length },
            transfers: { count: transfers.length },
            netBalance
        }
    }, [transactions])

    const exportToCSV = () => {
        const headers = ["Date", "Type", "Description", "Amount", "Notes"]
        const csvData = filteredTransactions.map((t) => [
            t.date,
            t.source.replace("quickbooks-", ""),
            `"${t.description.replace(/"/g, '""')}"`,
            t.amount.toFixed(2),
            t.custom_data?.private_note || ""
        ])

        const csv = [headers, ...csvData].map((row) => row.join(",")).join("\n")
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `chase-savings-${new Date().toISOString().split("T")[0]}.csv`
        a.click()
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-[#117ACA]" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <header className="border-b border-[#0f1c34] bg-[#117ACA] text-white shadow-lg sticky top-0 z-30">
                <div className="container mx-auto px-6 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/cash-management/chase-quickbooks">
                                <Button variant="ghost" size="sm" className="gap-2 text-white hover:bg-white/10">
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <span className="text-2xl">🇺🇸</span>
                                    Chase Savings
                                </h1>
                                <p className="text-sm text-white/80">
                                    Conta Poupança • QuickBooks Online
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {lastSync && (
                                <span className="text-xs text-white/70">
                                    Última sync: {formatTimestamp(new Date(lastSync))}
                                </span>
                            )}

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={exportToCSV}
                                className="border-white text-white hover:bg-white/10"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </Button>

                            <Button
                                onClick={handleSync}
                                disabled={isSyncing}
                                size="sm"
                                className="bg-white text-[#117ACA] hover:bg-gray-100"
                            >
                                {isSyncing ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                )}
                                Sync Now
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Account Card */}
            <div className="container mx-auto px-6 py-4">
                <Card className="bg-gradient-to-r from-[#2E8B57] to-[#3CB371] border-0 shadow-xl">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                                    <PiggyBank className="h-8 w-8 text-white" />
                                </div>
                                <div className="text-white">
                                    <h3 className="text-lg font-bold">Chase Business Savings</h3>
                                    <div className="flex items-center gap-4 mt-1 text-sm">
                                        <span className="flex items-center gap-1">
                                            <span className="font-semibold">Currency:</span> USD ($)
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="font-semibold">Source:</span> QuickBooks Online
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right text-white">
                                <p className="text-sm opacity-90">Net Activity</p>
                                <p className={`text-2xl font-bold ${stats.netBalance >= 0 ? "text-emerald-200" : "text-red-200"}`}>
                                    {formatUSD(stats.netBalance)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Stats Cards */}
            <div className="container mx-auto px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-600" />
                                Entradas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600">
                                {formatUSD(stats.inflows.total)}
                            </div>
                            <p className="text-xs text-gray-500">
                                {stats.inflows.count} transações
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                <TrendingDown className="w-4 h-4 text-red-600" />
                                Saídas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">
                                {formatUSD(stats.outflows.total)}
                            </div>
                            <p className="text-xs text-gray-500">
                                {stats.outflows.count} transações
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                <ArrowUpDown className="w-4 h-4 text-purple-600" />
                                Transfers
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-purple-600">
                                {stats.transfers.count}
                            </div>
                            <p className="text-xs text-gray-500">
                                movimentações
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-gray-600" />
                                Total
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-700">
                                {transactions.length}
                            </div>
                            <p className="text-xs text-gray-500">
                                movimentações
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="container mx-auto px-6 py-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Movimentações</CardTitle>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <Input
                                        placeholder="Buscar..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-64 pl-9"
                                    />
                                </div>

                                <Input
                                    type="date"
                                    value={dateFilter.start || ""}
                                    onChange={(e) => setDateFilter((prev) => ({ ...prev, start: e.target.value }))}
                                    className="w-36"
                                />
                                <span className="text-gray-400">até</span>
                                <Input
                                    type="date"
                                    value={dateFilter.end || ""}
                                    onChange={(e) => setDateFilter((prev) => ({ ...prev, end: e.target.value }))}
                                    className="w-36"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="mb-4">
                                <TabsTrigger value="all">
                                    Todos ({transactions.length})
                                </TabsTrigger>
                                <TabsTrigger value="inflows">
                                    <TrendingUp className="w-4 h-4 mr-1" />
                                    Entradas ({stats.inflows.count})
                                </TabsTrigger>
                                <TabsTrigger value="outflows">
                                    <TrendingDown className="w-4 h-4 mr-1" />
                                    Saídas ({stats.outflows.count})
                                </TabsTrigger>
                                <TabsTrigger value="transfers">
                                    <ArrowUpDown className="w-4 h-4 mr-1" />
                                    Transfers ({stats.transfers.count})
                                </TabsTrigger>
                            </TabsList>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b-2 border-gray-200 bg-gray-50">
                                            <th className="text-left py-3 px-4 font-bold text-sm text-gray-700">Data</th>
                                            <th className="text-left py-3 px-4 font-bold text-sm text-gray-700">Tipo</th>
                                            <th className="text-left py-3 px-4 font-bold text-sm text-gray-700">Descrição</th>
                                            <th className="text-right py-3 px-4 font-bold text-sm text-gray-700">Valor</th>
                                            <th className="text-center py-3 px-4 font-bold text-sm text-gray-700">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransactions.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-gray-500">
                                                    Nenhuma transação encontrada. Clique em "Sync Now" para sincronizar os dados do QuickBooks.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredTransactions.map((tx) => {
                                                const isDeposit = tx.source === "quickbooks-deposits";
                                                const isTransfer = tx.source === "quickbooks-transfers";
                                                const isExpense = tx.source === "quickbooks-expenses";
                                                const isPayment = tx.source === "quickbooks-payments";

                                                let badgeClass = "bg-gray-100 text-gray-700 border-gray-200";
                                                let badgeLabel = tx.source?.replace("quickbooks-", "") || "Unknown";

                                                if (isDeposit) {
                                                    badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200";
                                                    badgeLabel = "Depósito";
                                                } else if (isTransfer) {
                                                    badgeClass = tx.amount >= 0
                                                        ? "bg-blue-100 text-blue-700 border-blue-200"
                                                        : "bg-purple-100 text-purple-700 border-purple-200";
                                                    badgeLabel = tx.amount >= 0 ? "Transfer In" : "Transfer Out";
                                                } else if (isExpense) {
                                                    badgeClass = "bg-red-100 text-red-700 border-red-200";
                                                    badgeLabel = "Expense";
                                                } else if (isPayment) {
                                                    badgeClass = "bg-orange-100 text-orange-700 border-orange-200";
                                                    badgeLabel = "Payment";
                                                }

                                                return (
                                                    <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                        <td className="py-3 px-4 text-sm">{formatUSDate(tx.date)}</td>
                                                        <td className="py-3 px-4">
                                                            <Badge variant="outline" className={badgeClass}>
                                                                {badgeLabel}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm max-w-md truncate">
                                                            {tx.description}
                                                            {tx.custom_data?.private_note && (
                                                                <span className="text-gray-400 ml-2">
                                                                    - {tx.custom_data.private_note}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td
                                                            className={`py-3 px-4 text-sm text-right font-bold ${tx.amount >= 0 ? "text-emerald-600" : "text-red-600"
                                                                }`}
                                                        >
                                                            {tx.amount >= 0 ? "+" : ""}
                                                            {formatUSD(tx.amount)}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            {tx.reconciled ? (
                                                                <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto" />
                                                            ) : (
                                                                <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
