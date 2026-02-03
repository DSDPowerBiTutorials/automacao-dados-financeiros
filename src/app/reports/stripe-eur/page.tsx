"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Download,
    Edit2,
    Save,
    X,
    Trash2,
    ArrowLeft,
    Loader2,
    CheckCircle,
    XCircle,
    RefreshCw,
    Filter,
    ArrowUpDown,
    Calendar,
    DollarSign,
    User,
    CreditCard,
    Search,
    Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/formatters";

interface StripeRow {
    id: string;
    date: string;
    description: string;
    amount: number;
    reconciled: boolean;
    destinationAccount: string | null;
    reconciliationType?: "automatic" | "manual" | null;

    // Campos Stripe
    transaction_id?: string;
    charge_id?: string;
    session_id?: string;
    order_id?: string | null;
    status?: string;
    type?: string;
    currency?: string;
    customer_name?: string;
    customer_email?: string;
    payment_method?: string;
    products?: string[];
    product_count?: number;

    [key: string]: any;
}

interface BankStatementRow {
    date: string;
    amount: number;
    source: string;
}

export default function StripeEURPage() {
    const [rows, setRows] = useState<StripeRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [editedData, setEditedData] = useState<Partial<StripeRow>>({});
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);

    // Sorting
    const [sortField, setSortField] = useState<string>("date");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 150;

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
        start: "2024-12-01",
        end: new Date().toISOString().split("T")[0],
    });

    // Reconciliation
    const [isReconciling, setIsReconciling] = useState(false);
    const [autoReconcileSummary, setAutoReconcileSummary] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // Load data
    useEffect(() => {
        loadData();
    }, [dateFilter]);

    const loadData = async () => {
        setIsLoading(true);
        setLoadError(null);

        try {
            const { data, error } = await supabase
                .from("csv_rows")
                .select("*")
                .eq("source", "stripe-eur")
                .gte("date", dateFilter.start)
                .lte("date", dateFilter.end)
                .order("date", { ascending: false })
                .limit(2000);

            if (error) throw error;

            const mapped: StripeRow[] = (data || []).map((row) => {
                const cd = row.custom_data || {};
                return {
                    id: row.id,
                    date: row.date,
                    description: row.description || cd.description || "",
                    amount: parseFloat(row.amount) || 0,
                    reconciled: row.reconciled || false,
                    destinationAccount: cd.destination_account || null,
                    reconciliationType: cd.reconciliation_type || null,
                    transaction_id: cd.transaction_id || cd.charge_id || cd.session_id,
                    charge_id: cd.charge_id,
                    session_id: cd.session_id,
                    order_id: cd.order_id,
                    status: cd.status || "succeeded",
                    type: cd.type || "sale",
                    currency: cd.currency || "EUR",
                    customer_name: cd.customer_name || "",
                    customer_email: cd.customer_email || "",
                    payment_method: cd.payment_method || "",
                    products: cd.products || [],
                    product_count: cd.product_count || 0,
                    custom_data: cd,
                };
            });

            setRows(mapped);

            // Get last sync date
            if (mapped.length > 0) {
                const latestSync = mapped.reduce((latest, row) => {
                    const syncDate = row.custom_data?.webhook_received_at || row.custom_data?.created_at;
                    if (syncDate && (!latest || syncDate > latest)) return syncDate;
                    return latest;
                }, null as string | null);
                setLastSyncDate(latestSync);
            }
        } catch (err) {
            console.error("Error loading Stripe EUR data:", err);
            setLoadError(err instanceof Error ? err.message : "Erro ao carregar dados");
        } finally {
            setIsLoading(false);
        }
    };

    // Sync from Stripe API
    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch("/api/stripe/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currency: "EUR",
                    sinceDate: dateFilter.start,
                }),
            });

            const result = await response.json();

            if (result.success) {
                await loadData();
                setAutoReconcileSummary(`✅ Synced: ${result.summary?.charges_synced || 0} transactions`);
            } else {
                setAutoReconcileSummary(`❌ Erro: ${result.error}`);
            }
        } catch (err) {
            setAutoReconcileSummary(`❌ Erro ao sincronizar: ${err instanceof Error ? err.message : "Erro"}`);
        } finally {
            setIsSyncing(false);
            setTimeout(() => setAutoReconcileSummary(null), 5000);
        }
    };

    // Auto reconciliation with bank statements
    const handleAutoReconcile = async () => {
        setIsReconciling(true);
        setAutoReconcileSummary(null);

        try {
            // Fetch bank statements (Bankinter EUR)
            const { data: bankData, error: bankError } = await supabase
                .from("csv_rows")
                .select("date, amount, description, custom_data")
                .eq("source", "bankinter-eur")
                .gte("date", dateFilter.start)
                .lte("date", dateFilter.end);

            if (bankError) throw bankError;

            const bankRows: BankStatementRow[] = (bankData || []).map((row) => ({
                date: row.date,
                amount: parseFloat(row.amount) || 0,
                source: "bankinter-eur",
            }));

            let matchCount = 0;
            const tolerance = 3; // dias de tolerância
            const amountTolerance = 0.05; // 5 centavos

            // Para cada transação Stripe não reconciliada
            for (const stripeRow of rows.filter((r) => !r.reconciled && r.amount > 0)) {
                const stripeDate = new Date(stripeRow.date);
                const stripeAmount = stripeRow.amount;

                // Procurar match no extrato bancário
                const match = bankRows.find((bank) => {
                    const bankDate = new Date(bank.date);
                    const daysDiff = Math.abs(
                        (bankDate.getTime() - stripeDate.getTime()) / (1000 * 60 * 60 * 24)
                    );
                    const amountDiff = Math.abs(bank.amount - stripeAmount);

                    return daysDiff <= tolerance && amountDiff <= amountTolerance;
                });

                if (match) {
                    // Marcar como reconciliado
                    const { error: updateError } = await supabase
                        .from("csv_rows")
                        .update({
                            reconciled: true,
                            custom_data: {
                                ...stripeRow.custom_data,
                                reconciliation_type: "automatic",
                                reconciled_with_date: match.date,
                                reconciled_at: new Date().toISOString(),
                                destination_account: "Bankinter EUR",
                            },
                        })
                        .eq("id", stripeRow.id);

                    if (!updateError) {
                        matchCount++;
                        // Remover do array para não fazer match duplicado
                        const idx = bankRows.findIndex(
                            (b) => b.date === match.date && b.amount === match.amount
                        );
                        if (idx >= 0) bankRows.splice(idx, 1);
                    }
                }
            }

            setAutoReconcileSummary(
                `✅ Auto reconciliation: ${matchCount} transactions reconciled`
            );
            await loadData();
        } catch (err) {
            console.error("Auto reconcile error:", err);
            setAutoReconcileSummary(
                `❌ Erro na reconciliation: ${err instanceof Error ? err.message : "Erro"}`
            );
        } finally {
            setIsReconciling(false);
            setTimeout(() => setAutoReconcileSummary(null), 5000);
        }
    };

    // Edit row
    const startEditing = (row: StripeRow) => {
        setEditingRow(row.id);
        setEditedData({ ...row });
    };

    const cancelEditing = () => {
        setEditingRow(null);
        setEditedData({});
    };

    const saveRow = async () => {
        if (!editingRow || !editedData) return;
        setIsSaving(true);

        try {
            const { error } = await supabase
                .from("csv_rows")
                .update({
                    description: editedData.description,
                    amount: editedData.amount,
                    reconciled: editedData.reconciled,
                    custom_data: {
                        ...rows.find((r) => r.id === editingRow)?.custom_data,
                        destination_account: editedData.destinationAccount,
                        reconciliation_type: editedData.reconciled ? "manual" : null,
                    },
                })
                .eq("id", editingRow);

            if (error) throw error;

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
            await loadData();
            setEditingRow(null);
            setEditedData({});
        } catch (err) {
            console.error("Error saving row:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteRow = async (id: string) => {
        if (!confirm("Are you sure you want to delete this transaction?")) return;
        setIsDeleting(true);

        try {
            const { error } = await supabase.from("csv_rows").delete().eq("id", id);
            if (error) throw error;
            await loadData();
        } catch (err) {
            console.error("Error deleting row:", err);
        } finally {
            setIsDeleting(false);
        }
    };

    // Toggle reconciled status
    const toggleReconciled = async (row: StripeRow) => {
        try {
            const newReconciled = !row.reconciled;
            const { error } = await supabase
                .from("csv_rows")
                .update({
                    reconciled: newReconciled,
                    custom_data: {
                        ...row.custom_data,
                        reconciliation_type: newReconciled ? "manual" : null,
                        reconciled_at: newReconciled ? new Date().toISOString() : null,
                    },
                })
                .eq("id", row.id);

            if (error) throw error;
            await loadData();
        } catch (err) {
            console.error("Error toggling reconciled:", err);
        }
    };

    // Sorting
    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("desc");
        }
    };

    // Filtered and sorted rows
    const filteredRows = useMemo(() => {
        let result = [...rows];

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(
                (r) =>
                    r.description?.toLowerCase().includes(term) ||
                    r.customer_name?.toLowerCase().includes(term) ||
                    r.customer_email?.toLowerCase().includes(term) ||
                    r.order_id?.toLowerCase().includes(term) ||
                    r.transaction_id?.toLowerCase().includes(term)
            );
        }

        // Status filter
        if (statusFilter !== "all") {
            if (statusFilter === "reconciled") {
                result = result.filter((r) => r.reconciled);
            } else if (statusFilter === "pending") {
                result = result.filter((r) => !r.reconciled);
            }
        }

        // Type filter
        if (typeFilter !== "all") {
            result = result.filter((r) => r.type === typeFilter);
        }

        // Sorting
        result.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            if (sortField === "amount") {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            }

            if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
            if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
            return 0;
        });

        return result;
    }, [rows, searchTerm, statusFilter, typeFilter, sortField, sortDirection]);

    // Pagination
    const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
    const paginatedRows = filteredRows.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    // Summary stats
    const stats = useMemo(() => {
        const sales = filteredRows.filter((r) => r.type === "sale" && r.amount > 0);
        const refunds = filteredRows.filter((r) => r.type === "refund" || r.amount < 0);
        const reconciled = filteredRows.filter((r) => r.reconciled);

        return {
            totalSales: sales.reduce((sum, r) => sum + r.amount, 0),
            salesCount: sales.length,
            totalRefunds: Math.abs(refunds.reduce((sum, r) => sum + r.amount, 0)),
            refundsCount: refunds.length,
            netAmount: filteredRows.reduce((sum, r) => sum + r.amount, 0),
            reconciledCount: reconciled.length,
            pendingCount: filteredRows.length - reconciled.length,
            reconciledPercent:
                filteredRows.length > 0
                    ? Math.round((reconciled.length / filteredRows.length) * 100)
                    : 0,
        };
    }, [filteredRows]);

    // Export CSV
    const handleExport = () => {
        const headers = [
            "Data",
            "Description",
            "Amount",
            "Status",
            "Tipo",
            "Cliente",
            "Email",
            "Payment Method",
            "Transaction ID",
            "Order ID",
            "Reconciliado",
        ];

        const csvContent = [
            headers.join(","),
            ...filteredRows.map((row) =>
                [
                    row.date,
                    `"${row.description?.replace(/"/g, '""') || ""}"`,
                    row.amount.toFixed(2),
                    row.status,
                    row.type,
                    `"${row.customer_name?.replace(/"/g, '""') || ""}"`,
                    row.customer_email,
                    row.payment_method,
                    row.transaction_id,
                    row.order_id || "",
                    row.reconciled ? "Yes" : "No",
                ].join(",")
            ),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `stripe-eur-${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-full bg-[#1e1f21] text-white">
            {/* Header */}
            <header className="bg-gradient-to-r from-[#635BFF] to-[#4B44C9] px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/payment-channels">
                            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                <CreditCard className="w-6 h-6 text-white" />
                                Stripe EUR
                            </h1>
                            <p className="text-sm text-white/70">
                                Transactions em Euro • {rows.length} records
                                {lastSyncDate && (
                                    <span className="ml-2">
                                        • Last sync: {formatDate(lastSyncDate)}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="border-white text-white hover:bg-white/10"
                        >
                            {isSyncing ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4 mr-2" />
                            )}
                            Sync API
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAutoReconcile}
                            disabled={isReconciling}
                        >
                            {isReconciling ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Zap className="w-4 h-4 mr-2" />
                            )}
                            Auto Reconcile
                        </Button>

                        <Button variant="outline" size="sm" onClick={handleExport}>
                            <Download className="w-4 h-4 mr-2" />
                            Export
                        </Button>
                    </div>
                </div>
            </header>

            {/* Alerts */}
            {autoReconcileSummary && (
                <div className="px-6 pt-4">
                    <Alert
                        className={
                            autoReconcileSummary && autoReconcileSummary.startsWith("✅")
                                ? "bg-green-50 border-green-200"
                                : "bg-red-50 border-red-200"
                        }
                    >
                        <AlertDescription>{autoReconcileSummary}</AlertDescription>
                    </Alert>
                </div>
            )
            }

            {
                loadError && (
                    <div className="px-6 pt-4">
                        <Alert className="bg-red-50 border-red-200">
                            <AlertDescription>❌ {loadError}</AlertDescription>
                        </Alert>
                    </div>
                )
            }

            {/* Stats Cards */}
            <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <DollarSign className="w-4 h-4" />
                            Total Sales
                        </div>
                        <div className="text-xl font-bold text-green-600">
                            €{stats.totalSales.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-400">{stats.salesCount} transactions</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <DollarSign className="w-4 h-4" />
                            Refunds
                        </div>
                        <div className="text-xl font-bold text-red-600">
                            €{stats.totalRefunds.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-400">{stats.refundsCount} transactions</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <DollarSign className="w-4 h-4" />
                            Net
                        </div>
                        <div className={`text-xl font-bold ${stats.netAmount >= 0 ? "text-green-600" : "text-red-600"}`}>
                            €{stats.netAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <CheckCircle className="w-4 h-4" />
                            Reconciled
                        </div>
                        <div className="text-xl font-bold text-blue-600">{stats.reconciledCount}</div>
                        <div className="text-xs text-gray-400">{stats.reconciledPercent}% of total</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <XCircle className="w-4 h-4" />
                            Pending
                        </div>
                        <div className="text-xl font-bold text-orange-600">{stats.pendingCount}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="w-4 h-4" />
                            Period
                        </div>
                        <div className="text-sm font-medium">
                            {dateFilter.start} a {dateFilter.end}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="px-6 py-2 flex flex-wrap items-center gap-4 bg-white border-y border-gray-200">
                <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Search by name, email, order ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <Input
                        type="date"
                        value={dateFilter.start}
                        onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                        className="w-36"
                    />
                    <span className="text-gray-400">to</span>
                    <Input
                        type="date"
                        value={dateFilter.end}
                        onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                        className="w-36"
                    />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="reconciled">Reconciled</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-32">
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="sale">Sale</SelectItem>
                        <SelectItem value="refund">Refund</SelectItem>
                        <SelectItem value="invoice">Invoice</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="px-6 py-4">
                <Card>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                <span className="ml-2 text-gray-500">Loading...</span>
                            </div>
                        ) : filteredRows.length === 0 ? (
                            <div className="text-center py-20 text-gray-500">
                                <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>No transactions found</p>
                                <p className="text-sm">Try syncing with the Stripe API</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="table-standard">
                                    <thead>
                                        <tr>
                                            <th>
                                                <button
                                                    className="flex items-center gap-1 font-medium hover:text-gray-900"
                                                    onClick={() => handleSort("date")}
                                                >
                                                    Date
                                                    <ArrowUpDown className="w-3 h-3" />
                                                </button>
                                            </th>
                                            <th>
                                                Description
                                            </th>
                                            <th>
                                                Customer
                                            </th>
                                            <th className="text-right">
                                                <button
                                                    className="flex items-center gap-1 font-medium hover:text-gray-900 ml-auto"
                                                    onClick={() => handleSort("amount")}
                                                >
                                                    Amount
                                                    <ArrowUpDown className="w-3 h-3" />
                                                </button>
                                            </th>
                                            <th className="text-center">
                                                Type
                                            </th>
                                            <th className="text-center">
                                                Method
                                            </th>
                                            <th className="text-center">
                                                Reconciled
                                            </th>
                                            <th className="text-center">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedRows.map((row) => (
                                            <tr
                                                key={row.id}
                                                className={`hover:bg-gray-50 ${row.reconciled ? "bg-green-50/30" : ""
                                                    }`}
                                            >
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {formatDate(row.date)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {editingRow === row.id ? (
                                                        <Input
                                                            value={editedData.description || ""}
                                                            onChange={(e) =>
                                                                setEditedData({
                                                                    ...editedData,
                                                                    description: e.target.value,
                                                                })
                                                            }
                                                            className="w-full"
                                                        />
                                                    ) : (
                                                        <div>
                                                            <div className="font-medium text-gray-900 truncate max-w-xs">
                                                                {row.description}
                                                            </div>
                                                            {row.order_id && (
                                                                <div className="text-xs text-gray-400">
                                                                    Order: {row.order_id}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-4 h-4 text-gray-400" />
                                                        <div>
                                                            <div className="font-medium text-gray-900 text-sm">
                                                                {row.customer_name || "—"}
                                                            </div>
                                                            <div className="text-xs text-gray-400">
                                                                {row.customer_email || "—"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    {editingRow === row.id ? (
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={editedData.amount || 0}
                                                            onChange={(e) =>
                                                                setEditedData({
                                                                    ...editedData,
                                                                    amount: parseFloat(e.target.value),
                                                                })
                                                            }
                                                            className="w-24 text-right"
                                                        />
                                                    ) : (
                                                        <span
                                                            className={`font-medium ${row.amount >= 0
                                                                ? "text-green-600"
                                                                : "text-red-600"
                                                                }`}
                                                        >
                                                            €{row.amount.toLocaleString("pt-BR", {
                                                                minimumFractionDigits: 2,
                                                            })}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge
                                                        variant={row.type === "sale" ? "default" : "destructive"}
                                                        className="text-xs"
                                                    >
                                                        {row.type === "sale"
                                                            ? "Sale"
                                                            : row.type === "refund"
                                                                ? "Refund"
                                                                : row.type}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="text-xs text-gray-500">
                                                        {row.payment_method || "—"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Checkbox
                                                        checked={
                                                            editingRow === row.id
                                                                ? editedData.reconciled
                                                                : row.reconciled
                                                        }
                                                        onCheckedChange={() => {
                                                            if (editingRow === row.id) {
                                                                setEditedData({
                                                                    ...editedData,
                                                                    reconciled: !editedData.reconciled,
                                                                });
                                                            } else {
                                                                toggleReconciled(row);
                                                            }
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {editingRow === row.id ? (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={saveRow}
                                                                    disabled={isSaving}
                                                                >
                                                                    {isSaving ? (
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                    ) : (
                                                                        <Save className="w-4 h-4 text-green-600" />
                                                                    )}
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={cancelEditing}
                                                                >
                                                                    <X className="w-4 h-4 text-gray-500" />
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => startEditing(row)}
                                                                >
                                                                    <Edit2 className="w-4 h-4 text-gray-500" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => deleteRow(row.id)}
                                                                    disabled={isDeleting}
                                                                >
                                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                                <div className="text-sm text-gray-500">
                                    Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
                                    {Math.min(currentPage * rowsPerPage, filteredRows.length)} of{" "}
                                    {filteredRows.length}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        Previous
                                    </Button>
                                    <span className="text-sm text-gray-500">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div >
    );
}
