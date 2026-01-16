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
    DollarSign,
    FileText,
    CreditCard,
    Users,
    Building,
    TrendingUp,
    TrendingDown,
    Calendar,
    Filter,
    ArrowUpDown,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/formatters";

interface QuickBooksRow {
    id: string;
    source: string;
    date: string;
    description: string;
    amount: number;
    category?: string;
    classification?: string;
    reconciled: boolean;
    custom_data: {
        quickbooks_id: string;
        doc_number?: string;
        customer_name?: string;
        customer_id?: string;
        vendor_name?: string;
        vendor_id?: string;
        due_date?: string;
        balance?: number;
        total_amount?: number;
        currency?: string;
        payment_method?: string;
        payment_type?: string;
        ap_account?: string;
        synced_at?: string;
        line_items?: Array<{
            description?: string;
            amount: number;
            account?: string;
        }>;
    };
    created_at?: string;
    updated_at?: string;
}

interface SyncStatus {
    connected: boolean;
    company?: {
        CompanyName: string;
        Country?: string;
    };
    lastSync?: string;
    error?: string;
}

// Cores por tipo de transação
const sourceColors: Record<string, { bg: string; text: string; icon: any }> = {
    "quickbooks-invoices": {
        bg: "bg-green-100",
        text: "text-green-700",
        icon: FileText,
    },
    "quickbooks-payments": {
        bg: "bg-blue-100",
        text: "text-blue-700",
        icon: DollarSign,
    },
    "quickbooks-bills": {
        bg: "bg-orange-100",
        text: "text-orange-700",
        icon: CreditCard,
    },
    "quickbooks-expenses": {
        bg: "bg-red-100",
        text: "text-red-700",
        icon: TrendingDown,
    },
    "quickbooks-deposits": {
        bg: "bg-emerald-100",
        text: "text-emerald-700",
        icon: TrendingUp,
    },
    "quickbooks-transfers": {
        bg: "bg-purple-100",
        text: "text-purple-700",
        icon: ArrowUpDown,
    },
};

export default function QuickBooksUSDPage() {
    const [rows, setRows] = useState<QuickBooksRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const [activeTab, setActiveTab] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFilter, setDateFilter] = useState<{ start?: string; end?: string }>({});
    const [reconciliationFilter, setReconciliationFilter] = useState<string>("all");
    const [sortField, setSortField] = useState<string>("date");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 50;

    // Carregar dados
    useEffect(() => {
        loadData();
        checkConnection();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from("csv_rows")
                .select("*")
                .like("source", "quickbooks-%")
                .order("date", { ascending: false });

            if (error) throw error;

            setRows(data || []);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const checkConnection = async () => {
        try {
            const response = await fetch("/api/quickbooks/sync");
            const data = await response.json();
            setSyncStatus({
                connected: data.connected || false,
                company: data.company,
                error: data.error,
            });
        } catch (error) {
            setSyncStatus({ connected: false, error: "Failed to check connection" });
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch("/api/quickbooks/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ syncType: "all" }),
            });
            const result = await response.json();

            if (result.success) {
                await loadData();
                setSyncStatus((prev) => ({
                    ...prev!,
                    lastSync: new Date().toISOString(),
                }));
            } else {
                console.error("Sync failed:", result.error);
            }
        } catch (error) {
            console.error("Sync error:", error);
        } finally {
            setIsSyncing(false);
        }
    };

    // Filtrar e ordenar dados
    const filteredRows = useMemo(() => {
        let filtered = [...rows];

        // Filter by tab/tipo
        if (activeTab !== "all") {
            filtered = filtered.filter((row) => row.source === `quickbooks-${activeTab}`);
        }

        // Filter by busca
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (row) =>
                    row.description.toLowerCase().includes(term) ||
                    row.custom_data?.doc_number?.toLowerCase().includes(term) ||
                    row.custom_data?.customer_name?.toLowerCase().includes(term) ||
                    row.custom_data?.vendor_name?.toLowerCase().includes(term)
            );
        }

        // Filter by data
        if (dateFilter.start) {
            filtered = filtered.filter((row) => row.date >= dateFilter.start!);
        }
        if (dateFilter.end) {
            filtered = filtered.filter((row) => row.date <= dateFilter.end!);
        }

        // Filter by reconciliation
        if (reconciliationFilter === "reconciled") {
            filtered = filtered.filter((row) => row.reconciled);
        } else if (reconciliationFilter === "pending") {
            filtered = filtered.filter((row) => !row.reconciled);
        }

        // Ordenação
        filtered.sort((a, b) => {
            let aVal: any = a[sortField as keyof QuickBooksRow];
            let bVal: any = b[sortField as keyof QuickBooksRow];

            if (sortField === "amount") {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            }

            if (sortDirection === "asc") {
                return aVal > bVal ? 1 : -1;
            }
            return aVal < bVal ? 1 : -1;
        });

        return filtered;
    }, [rows, activeTab, searchTerm, dateFilter, reconciliationFilter, sortField, sortDirection]);

    // Pagination
    const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
    const paginatedRows = filteredRows.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    // Estatísticas
    const stats = useMemo(() => {
        const invoices = rows.filter((r) => r.source === "quickbooks-invoices");
        const payments = rows.filter((r) => r.source === "quickbooks-payments");
        const bills = rows.filter((r) => r.source === "quickbooks-bills");
        const expenses = rows.filter((r) => r.source === "quickbooks-expenses");
        const deposits = rows.filter((r) => r.source === "quickbooks-deposits");
        const transfers = rows.filter((r) => r.source === "quickbooks-transfers");

        const totalInvoices = invoices.reduce((sum, r) => sum + parseFloat(String(r.amount)) || 0, 0);
        const totalPayments = payments.reduce((sum, r) => sum + parseFloat(String(r.amount)) || 0, 0);
        const totalBills = bills.reduce((sum, r) => sum + parseFloat(String(r.amount)) || 0, 0);
        const totalExpenses = expenses.reduce((sum, r) => sum + parseFloat(String(r.amount)) || 0, 0);
        const totalDeposits = deposits.reduce((sum, r) => sum + parseFloat(String(r.amount)) || 0, 0);
        const totalTransfers = transfers.reduce((sum, r) => sum + parseFloat(String(r.amount)) || 0, 0);

        const openInvoices = invoices.filter((r) => r.custom_data?.balance && r.custom_data.balance > 0);
        const openBills = bills.filter((r) => r.custom_data?.balance && r.custom_data.balance > 0);

        return {
            invoices: { count: invoices.length, total: totalInvoices, open: openInvoices.length },
            payments: { count: payments.length, total: totalPayments },
            bills: { count: bills.length, total: totalBills, open: openBills.length },
            expenses: { count: expenses.length, total: totalExpenses },
            deposits: { count: deposits.length, total: totalDeposits },
            transfers: { count: transfers.length, total: totalTransfers },
        };
    }, [rows]);

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortDirection("desc");
        }
    };

    const exportToCSV = () => {
        const headers = ["Date", "Type", "Doc #", "Description", "Amount", "Customer/Vendor", "Status"];
        const csvData = filteredRows.map((row) => [
            row.date,
            row.source.replace("quickbooks-", ""),
            row.custom_data?.doc_number || "",
            row.description,
            row.amount,
            row.custom_data?.customer_name || row.custom_data?.vendor_name || "",
            row.reconciled ? "Reconciled" : "Pending",
        ]);

        const csv = [headers, ...csvData].map((row) => row.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `quickbooks-usd-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
    };

    return (
        <div className="min-h-full px-6 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/reports">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <span className="text-2xl">🇺🇸</span>
                            QuickBooks USD
                        </h1>
                        <p className="text-gray-500 text-sm">
                            Escopo: Estados Unidos • DSD Planning LLC
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Connection Status */}
                    {syncStatus && (
                        <Badge
                            variant={syncStatus.connected ? "default" : "destructive"}
                            className="mr-2"
                        >
                            {syncStatus.connected ? (
                                <>
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    {syncStatus.company?.CompanyName || "Connected"}
                                </>
                            ) : (
                                <>
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Not Connected
                                </>
                            )}
                        </Badge>
                    )}

                    <Button variant="outline" onClick={exportToCSV}>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>

                    <Button
                        onClick={handleSync}
                        disabled={isSyncing || !syncStatus?.connected}
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

            {/* Alert if not connected */}
            {syncStatus && !syncStatus.connected && (
                <Alert variant="destructive">
                    <AlertDescription className="flex items-center justify-between">
                        <span>
                            QuickBooks is not connected.{" "}
                            {syncStatus.error && `Erro: ${syncStatus.error}`}
                        </span>
                        <Link href="/api/quickbooks/auth">
                            <Button size="sm" variant="outline">
                                Conectar QuickBooks
                            </Button>
                        </Link>
                    </AlertDescription>
                </Alert>
            )}

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-green-600" />
                            Invoices (AR)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-green-600">
                            {formatCurrency(stats.invoices.total, "USD")}
                        </div>
                        <p className="text-xs text-gray-500">
                            {stats.invoices.count} faturas • {stats.invoices.open} em aberto
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-blue-600" />
                            Payments
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-blue-600">
                            {formatCurrency(stats.payments.total, "USD")}
                        </div>
                        <p className="text-xs text-gray-500">
                            {stats.payments.count} recebidos
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-orange-600" />
                            Bills (AP)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-orange-600">
                            {formatCurrency(Math.abs(stats.bills.total), "USD")}
                        </div>
                        <p className="text-xs text-gray-500">
                            {stats.bills.count} contas • {stats.bills.open} a pagar
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-red-600" />
                            Expenses
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-red-600">
                            {formatCurrency(Math.abs(stats.expenses.total), "USD")}
                        </div>
                        <p className="text-xs text-gray-500">
                            {stats.expenses.count} despesas
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                            Deposits
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-emerald-600">
                            {formatCurrency(stats.deposits.total, "USD")}
                        </div>
                        <p className="text-xs text-gray-500">
                            {stats.deposits.count} deposits
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
                        <div className="text-xl font-bold text-purple-600">
                            {formatCurrency(stats.transfers.total, "USD")}
                        </div>
                        <p className="text-xs text-gray-500">
                            {stats.transfers.count} transfers
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs e Filtros */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Transactions</CardTitle>
                        <div className="flex items-center gap-2">
                            {/* Filter by busca */}
                            <div className="relative">
                                <Input
                                    placeholder="Buscar..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-64"
                                />
                            </div>

                            {/* Filter by data */}
                            <Input
                                type="date"
                                value={dateFilter.start || ""}
                                onChange={(e) =>
                                    setDateFilter((prev) => ({ ...prev, start: e.target.value }))
                                }
                                className="w-36"
                            />
                            <span className="text-gray-400">to</span>
                            <Input
                                type="date"
                                value={dateFilter.end || ""}
                                onChange={(e) =>
                                    setDateFilter((prev) => ({ ...prev, end: e.target.value }))
                                }
                                className="w-36"
                            />

                            {/* Filter by reconciliation */}
                            <Select
                                value={reconciliationFilter}
                                onValueChange={setReconciliationFilter}
                            >
                                <SelectTrigger className="w-36">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="reconciled">Reconciliados</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="mb-4 flex-wrap">
                            <TabsTrigger value="all">
                                Todos ({rows.length})
                            </TabsTrigger>
                            <TabsTrigger value="invoices">
                                <FileText className="w-4 h-4 mr-1" />
                                Invoices ({stats.invoices.count})
                            </TabsTrigger>
                            <TabsTrigger value="payments">
                                <DollarSign className="w-4 h-4 mr-1" />
                                Payments ({stats.payments.count})
                            </TabsTrigger>
                            <TabsTrigger value="bills">
                                <CreditCard className="w-4 h-4 mr-1" />
                                Bills ({stats.bills.count})
                            </TabsTrigger>
                            <TabsTrigger value="expenses">
                                <TrendingDown className="w-4 h-4 mr-1" />
                                Expenses ({stats.expenses.count})
                            </TabsTrigger>
                            <TabsTrigger value="deposits">
                                <TrendingUp className="w-4 h-4 mr-1" />
                                Deposits ({stats.deposits.count})
                            </TabsTrigger>
                            <TabsTrigger value="transfers">
                                <ArrowUpDown className="w-4 h-4 mr-1" />
                                Transfers ({stats.transfers.count})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value={activeTab} className="mt-0">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                </div>
                            ) : filteredRows.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    No transactions found
                                </div>
                            ) : (
                                <>
                                    {/* Tabela */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-gray-50">
                                                    <th
                                                        className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100"
                                                        onClick={() => handleSort("date")}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            Data
                                                            <ArrowUpDown className="w-3 h-3" />
                                                        </div>
                                                    </th>
                                                    <th className="px-4 py-3 text-left">Tipo</th>
                                                    <th className="px-4 py-3 text-left">Doc #</th>
                                                    <th className="px-4 py-3 text-left">Description</th>
                                                    <th
                                                        className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100"
                                                        onClick={() => handleSort("amount")}
                                                    >
                                                        <div className="flex items-center justify-end gap-1">
                                                            Amount
                                                            <ArrowUpDown className="w-3 h-3" />
                                                        </div>
                                                    </th>
                                                    <th className="px-4 py-3 text-left">Customer/Vendor</th>
                                                    <th className="px-4 py-3 text-left">Due Date</th>
                                                    <th className="px-4 py-3 text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedRows.map((row) => {
                                                    const sourceConfig = sourceColors[row.source] || {
                                                        bg: "bg-gray-100",
                                                        text: "text-gray-700",
                                                        icon: FileText,
                                                    };
                                                    const IconComponent = sourceConfig.icon;
                                                    const amount = parseFloat(String(row.amount)) || 0;
                                                    const isNegative = amount < 0;

                                                    return (
                                                        <tr
                                                            key={row.id}
                                                            className="border-b hover:bg-gray-50 transition-colors"
                                                        >
                                                            <td className="px-4 py-3">
                                                                {formatDate(row.date)}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <Badge
                                                                    variant="outline"
                                                                    className={`${sourceConfig.bg} ${sourceConfig.text}`}
                                                                >
                                                                    <IconComponent className="w-3 h-3 mr-1" />
                                                                    {row.source.replace("quickbooks-", "")}
                                                                </Badge>
                                                            </td>
                                                            <td className="px-4 py-3 font-mono text-xs">
                                                                {row.custom_data?.doc_number || "-"}
                                                            </td>
                                                            <td className="px-4 py-3 max-w-xs truncate">
                                                                {row.description}
                                                            </td>
                                                            <td
                                                                className={`px-4 py-3 text-right font-medium ${isNegative ? "text-red-600" : "text-green-600"
                                                                    }`}
                                                            >
                                                                {formatCurrency(Math.abs(amount), "USD")}
                                                                {isNegative && (
                                                                    <span className="text-xs ml-1">(outgoing)</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {row.custom_data?.customer_name ||
                                                                    row.custom_data?.vendor_name ||
                                                                    "-"}
                                                            </td>
                                                            <td className="px-4 py-3 text-xs">
                                                                {row.custom_data?.due_date
                                                                    ? formatDate(row.custom_data.due_date)
                                                                    : "-"}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                {row.reconciled ? (
                                                                    <Badge variant="default" className="bg-green-600">
                                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                                        OK
                                                                    </Badge>
                                                                ) : row.custom_data?.balance &&
                                                                    row.custom_data.balance > 0 ? (
                                                                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                                                                        ${row.custom_data.balance.toFixed(2)} pendente
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-gray-500">
                                                                        Pending
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                            <p className="text-sm text-gray-500">
                                                Mostrando {(currentPage - 1) * rowsPerPage + 1} -{" "}
                                                {Math.min(currentPage * rowsPerPage, filteredRows.length)} de{" "}
                                                {filteredRows.length}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                                    disabled={currentPage === 1}
                                                >
                                                    Anterior
                                                </Button>
                                                <span className="text-sm">
                                                    Page {currentPage} de {totalPages}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                                                    }
                                                    disabled={currentPage === totalPages}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
