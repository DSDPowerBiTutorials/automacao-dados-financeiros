"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    ArrowDownCircle,
    ArrowUpCircle,
    TrendingUp,
    Download,
    RefreshCw,
    Search,
    CreditCard,
    Calendar,
    DollarSign,
    Users,
    Package,
    Filter,
    BarChart3,
    Play,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/page-header";

interface Transaction {
    id: string;
    date: string;  // Data da transação (created_at)
    cash_flow_date: string;  // Data do cash flow real (disbursement_date)
    description: string;
    amount: number;
    source: string;
    type: string;
    status: string;
    currency: string;
    customer_name: string;
    customer_email: string;
    payment_method: string;
    payment_method_display: string;
    order_id: string | null;
    product_category: string;
    product_name: string;
    settlement_date: string | null;
    disbursement_date: string | null;
}

interface Summary {
    totalInflow: number;
    totalOutflow: number;
    netCashFlow: number;
    transactionCount: number;
    avgTransactionValue: number;
    byPaymentMethod: Record<string, number>;
    byProductCategory: Record<string, number>;
    byMonth: Array<{ month: string; inflow: number; outflow: number; net: number }>;
    byDayOfMonth: Array<{ day: number; total: number; count: number }>;
}

// Formatar data para dd/mm/yyyy
function formatDateBR(dateStr: string | null | undefined): string {
    if (!dateStr) return "—";
    try {
        // Remove timezone e pega só a parte da data
        const cleanDate = dateStr.split("T")[0];
        const [year, month, day] = cleanDate.split("-");
        if (year && month && day) {
            return `${day}/${month}/${year}`;
        }
        return dateStr;
    } catch {
        return dateStr;
    }
}

// Yesplificar método de pagamento ("visa ***0888" -> "Visa")
function simplifyPaymentMethod(method: unknown): string {
    if (!method || typeof method !== "string") return "Desconhecido";
    const m = method.toLowerCase();

    if (m.includes("visa")) return "Visa";
    if (m.includes("mastercard") || m.includes("master card")) return "Mastercard";
    if (m.includes("amex") || m.includes("american express")) return "Amex";
    if (m.includes("paypal")) return "PayPal";
    if (m.includes("apple pay") || m.includes("apple_pay")) return "Apple Pay";
    if (m.includes("google pay") || m.includes("google_pay")) return "Google Pay";
    if (m.includes("sepa") || m.includes("direct debit")) return "SEPA";
    if (m.includes("bank") || m.includes("transfer")) return "Transferência";
    if (m.includes("credit") || m.includes("card")) return "Cartão";

    // Capitalizar primeira letra
    return method.charAt(0).toUpperCase() + method.slice(1).split(" ")[0].split("(")[0].trim();
}

// Detectar nome do produto baseado na descrição e valor
function detectProductName(description: string, amount: number): string {
    const descLower = description?.toLowerCase() || "";
    const absAmount = Math.abs(amount);

    // Detectar por descrição específica
    if (descLower.includes("masterclass") || descLower.includes("master class")) return "DSD Masterclass";
    if (descLower.includes("residency")) return "DSD Residency";
    if (descLower.includes("clinic fee") || descLower.includes("monthly fee")) return "DSD Clinic Fee";
    if (descLower.includes("coaching")) return "DSD Coaching";
    if (descLower.includes("planning") || descLower.includes("plan")) return "DSD Planning";
    if (descLower.includes("app") || descLower.includes("software")) return "DSD App";
    if (descLower.includes("workshop")) return "DSD Workshop";
    if (descLower.includes("concept")) return "DSD Concept";
    if (descLower.includes("certification")) return "DSD Certification";

    // Detectar por faixas de valor típicas
    if (absAmount >= 6500 && absAmount <= 7500) return "DSD Masterclass";
    if (absAmount >= 5500 && absAmount < 6500) return "DSD Residency";
    if (absAmount >= 4000 && absAmount <= 5500) return "DSD Clinic Fee";
    if (absAmount >= 2000 && absAmount < 4000) return "DSD Course";
    if (absAmount >= 500 && absAmount < 2000) return "DSD Workshop";
    if (absAmount >= 100 && absAmount < 500) return "DSD Subscription";

    return "Produto DSD";
}

// Categorizar produto baseado no valor
function categorizeProduct(amount: number, description: string): string {
    const absAmount = Math.abs(amount);
    const descLower = description?.toLowerCase() || "";

    // Detectar por descrição
    if (descLower.includes("masterclass") || descLower.includes("master class")) return "Masterclass";
    if (descLower.includes("residency")) return "Residency";
    if (descLower.includes("clinic fee") || descLower.includes("monthly fee")) return "Clinic Fee";
    if (descLower.includes("coaching")) return "Coaching";
    if (descLower.includes("subscription")) return "Subscription";
    if (descLower.includes("workshop")) return "Workshop";

    // Categorizar por valor se não detectado
    if (absAmount >= 5000) return "Premium Course";
    if (absAmount >= 2000) return "Standard Course";
    if (absAmount >= 500) return "Workshop/Module";
    if (absAmount >= 100) return "Subscription";
    return "Other";
}

export default function RealCashFlowPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters - default últimos 30 dias (reduzido de 90 para performance)
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        end: new Date().toISOString().split("T")[0],
    });
    const [pendingDateRange, setPendingDateRange] = useState(dateRange);
    const [sourceFilter, setSourceFilter] = useState<string>("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 150;

    // Handler simples para datas - só atualiza estado local
    const handleDateChange = useCallback((field: 'start' | 'end', value: string) => {
        setPendingDateRange(prev => ({ ...prev, [field]: value }));
    }, []);

    // Aplicar filtro de data quando user clicar no botão
    const applyDateFilter = useCallback(() => {
        setDateRange(pendingDateRange);
        setCurrentPage(1); // Reset página ao aplicar filtro
    }, [pendingDateRange]);

    // Verificar se há mudanças pendentes
    const hasPendingChanges = pendingDateRange.start !== dateRange.start || pendingDateRange.end !== dateRange.end;

    useEffect(() => {
        loadData();
        // Cleanup ao desmontar componente
        return () => {
            setTransactions([]);
        };
    }, [dateRange]);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Query otimizada: buscar apenas campos necessários e filtrar por date
            // O disbursement_date geralmente é to 5 dias após a date de criação
            const expandedStart = new Date(dateRange.start);
            expandedStart.setDate(expandedStart.getDate() - 7); // Reduzido para 7 dias
            const expandedStartStr = expandedStart.toISOString().split("T")[0];

            const { data, error: supabaseError } = await supabase
                .from("csv_rows")
                .select("id, date, description, amount, source, custom_data")
                .in("source", [
                    "braintree-api-revenue",
                    "gocardless",
                    "stripe-eur",
                    "stripe-usd",
                ])
                .gte("date", expandedStartStr)
                .lte("date", dateRange.end)
                .order("date", { ascending: false })
                .limit(2000);  // Reduzido para 2000

            if (supabaseError) throw supabaseError;

            // Mapear e filtrar por disbursement_date (data real do cash flow)
            const mapped: Transaction[] = (data || [])
                .map((row) => {
                    const cd = row.custom_data || {};
                    const amount = parseFloat(row.amount) || 0;
                    const desc = cd.description || row.description || "";

                    // disbursement_date é quando o dinheiro realmente entra no banco
                    // settlement_date é quando a transação é liquidada no gateway
                    const disbursementDate = cd.disbursement_date
                        ? cd.disbursement_date.split("T")[0]
                        : null;
                    const settlementDate = cd.settlement_date
                        ? cd.settlement_date.split("T")[0]
                        : null;

                    // Para Cash Flow Real, usamos disbursement_date como data principal
                    // Se não tiver, usamos settlement_date, depois date
                    const cashFlowDate = disbursementDate || settlementDate || row.date;

                    return {
                        id: row.id,
                        date: row.date,
                        cash_flow_date: cashFlowDate,
                        description: desc,
                        amount,
                        source: row.source,
                        type: cd.type || (amount >= 0 ? "sale" : "refund"),
                        status: cd.status || "settled",
                        currency: cd.currency || cd.currencyIsoCode || "EUR",
                        customer_name: cd.customer_name || cd.billing_name || "",
                        customer_email: cd.customer_email || "",
                        payment_method: cd.payment_method || "unknown",
                        payment_method_display: simplifyPaymentMethod(cd.payment_method),
                        order_id: cd.order_id || null,
                        product_category: categorizeProduct(amount, desc),
                        product_name: detectProductName(desc, amount),
                        settlement_date: settlementDate,
                        disbursement_date: disbursementDate,
                    };
                })
                // Filtrar por disbursement_date (cash_flow_date) dentro do range
                .filter((tx) => {
                    if (!tx.cash_flow_date) return false;
                    return tx.cash_flow_date >= dateRange.start && tx.cash_flow_date <= dateRange.end;
                })
                // Ordenar por cash_flow_date (disbursement) decrescente
                .sort((a, b) => b.cash_flow_date.localeCompare(a.cash_flow_date));

            setTransactions(mapped);
        } catch (err) {
            console.error("Error loading cash flow data:", err);
            setError(err instanceof Error ? err.message : "Erro ao carregar dados");
        } finally {
            setIsLoading(false);
        }
    };

    // Filtered transactions
    const filteredTransactions = useMemo(() => {
        return transactions.filter((tx) => {
            if (sourceFilter !== "all" && !tx.source.includes(sourceFilter)) return false;
            if (categoryFilter !== "all" && tx.product_category !== categoryFilter) return false;
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    tx.description.toLowerCase().includes(query) ||
                    tx.customer_name.toLowerCase().includes(query) ||
                    tx.customer_email.toLowerCase().includes(query) ||
                    tx.order_id?.toLowerCase().includes(query)
                );
            }
            return true;
        });
    }, [transactions, sourceFilter, categoryFilter, searchQuery]);

    // Summary calculations
    const summary: Summary = useMemo(() => {
        const inflows = filteredTransactions.filter((t) => t.amount > 0);
        const outflows = filteredTransactions.filter((t) => t.amount < 0);

        const totalInflow = inflows.reduce((sum, t) => sum + t.amount, 0);
        const totalOutflow = Math.abs(outflows.reduce((sum, t) => sum + t.amount, 0));

        // By payment method
        const byPaymentMethod: Record<string, number> = {};
        filteredTransactions.forEach((t) => {
            const method = t.payment_method || "unknown";
            byPaymentMethod[method] = (byPaymentMethod[method] || 0) + Math.abs(t.amount);
        });

        // By product category
        const byProductCategory: Record<string, number> = {};
        inflows.forEach((t) => {
            byProductCategory[t.product_category] = (byProductCategory[t.product_category] || 0) + t.amount;
        });

        // By month - usando cash_flow_date (disbursement_date)
        const byMonthMap: Record<string, { inflow: number; outflow: number }> = {};
        filteredTransactions.forEach((t) => {
            const month = t.cash_flow_date.substring(0, 7);
            if (!byMonthMap[month]) byMonthMap[month] = { inflow: 0, outflow: 0 };
            if (t.amount > 0) {
                byMonthMap[month].inflow += t.amount;
            } else {
                byMonthMap[month].outflow += Math.abs(t.amount);
            }
        });

        const byMonth = Object.entries(byMonthMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, data]) => ({
                month,
                inflow: data.inflow,
                outflow: data.outflow,
                net: data.inflow - data.outflow,
            }));

        // By day of month (1-31) - usando cash_flow_date para padrões de recebimento
        const byDayMap: Record<number, { total: number; count: number }> = {};
        // Inicializar todos os dias (1-31)
        for (let d = 1; d <= 31; d++) {
            byDayMap[d] = { total: 0, count: 0 };
        }
        inflows.forEach((t) => {
            try {
                const day = parseInt(t.cash_flow_date.split("-")[2]?.split("T")[0] || "0", 10);
                if (day >= 1 && day <= 31) {
                    byDayMap[day].total += t.amount;
                    byDayMap[day].count += 1;
                }
            } catch { /* ignore */ }
        });
        const byDayOfMonth = Object.entries(byDayMap)
            .map(([day, data]) => ({
                day: parseInt(day, 10),
                total: data.total,
                count: data.count,
            }))
            .sort((a, b) => a.day - b.day);

        return {
            totalInflow,
            totalOutflow,
            netCashFlow: totalInflow - totalOutflow,
            transactionCount: filteredTransactions.length,
            avgTransactionValue: inflows.length > 0 ? totalInflow / inflows.length : 0,
            byPaymentMethod,
            byProductCategory,
            byMonth,
            byDayOfMonth,
        };
    }, [filteredTransactions]);

    // Paginated data
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredTransactions.slice(start, start + pageSize);
    }, [filteredTransactions, currentPage]);

    const totalPages = Math.ceil(filteredTransactions.length / pageSize);

    // Get unique categories
    const categories = useMemo(() => {
        return [...new Set(transactions.map((t) => t.product_category))].sort();
    }, [transactions]);

    // Export to CSV
    const exportCSV = () => {
        const headers = [
            "Data",
            "Description",
            "Amount",
            "Moeda",
            "Cliente",
            "Email",
            "Method",
            "Categoria",
            "Order ID",
            "Source",
        ];

        const rows = filteredTransactions.map((t) => [
            t.date,
            `"${t.description.replace(/"/g, '""')}"`,
            t.amount.toFixed(2),
            t.currency,
            `"${t.customer_name.replace(/"/g, '""')}"`,
            t.customer_email,
            t.payment_method,
            t.product_category,
            t.order_id || "",
            t.source,
        ]);

        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fluxo-caixa-${dateRange.start}-${dateRange.end}.csv`;
        a.click();
    };

    const formatCurrency = (value: number, currency = "EUR") => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency,
        }).format(value);
    };

    if (isLoading) {
        return (
            <div className="min-h-full px-6 py-6 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading cash flow...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full px-6 py-6 space-y-6">
            {/* Header */}
            <PageHeader title="Real Cash Flow" subtitle="Actual revenue from Braintree and GoCardless with product categorization">
                <div className="flex gap-2">
                    <Button variant="outline" onClick={loadData} className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </Button>
                    <Button onClick={exportCSV} className="gap-2">
                        <Download className="h-4 w-4" />
                        Export CSV
                    </Button>
                </div>
            </PageHeader>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error}
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-green-100 p-3 rounded-lg">
                                <ArrowDownCircle className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Inflows</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {formatCurrency(summary.totalInflow)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-red-100 p-3 rounded-lg">
                                <ArrowUpCircle className="h-6 w-6 text-red-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Outflows (Refunds)</p>
                                <p className="text-2xl font-bold text-red-600">
                                    {formatCurrency(summary.totalOutflow)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-100 p-3 rounded-lg">
                                <TrendingUp className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Net Flow</p>
                                <p className={`text-2xl font-bold ${summary.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {formatCurrency(summary.netCashFlow)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-purple-100 p-3 rounded-lg">
                                <CreditCard className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Transactions</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {summary.transactionCount}
                                </p>
                                <p className="text-xs text-gray-500">
                                    Average: {formatCurrency(summary.avgTransactionValue)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Start Date
                            </label>
                            <Input
                                type="date"
                                value={pendingDateRange.start}
                                onChange={(e) => handleDateChange('start', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                End Date
                            </label>
                            <Input
                                type="date"
                                value={pendingDateRange.end}
                                onChange={(e) => handleDateChange('end', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                &nbsp;
                            </label>
                            <Button
                                onClick={applyDateFilter}
                                disabled={!hasPendingChanges}
                                className={`w-full gap-2 ${hasPendingChanges ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                            >
                                <Play className="h-4 w-4" />
                                Apply Dates
                            </Button>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Source
                            </label>
                            <Select value={sourceFilter} onValueChange={setSourceFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="braintree">Braintree</SelectItem>
                                    <SelectItem value="gocardless">GoCardless</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Category
                            </label>
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Search
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                                <Input
                                    placeholder="Customer, email, order..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* By Category */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Revenue by Product Category
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {Object.entries(summary.byProductCategory)
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 8)
                                .map(([category, value]) => (
                                    <div key={category} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">{category}</Badge>
                                        </div>
                                        <span className="font-semibold text-green-600">
                                            {formatCurrency(value)}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>

                {/* By Payment Method */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Volume by Payment Method
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {Object.entries(summary.byPaymentMethod)
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 8)
                                .map(([method, value]) => (
                                    <div key={method} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary">{method}</Badge>
                                        </div>
                                        <span className="font-semibold">
                                            {formatCurrency(value)}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Gráfico de Barras - Recebimentos Mensais */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Monthly Receipts
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {/* Gráfico de barras visual */}
                        <div className="space-y-3">
                            {(() => {
                                const maxValue = Math.max(...summary.byMonth.map(m => m.inflow), 1);
                                return summary.byMonth.map((month) => {
                                    const inflowWidth = (month.inflow / maxValue) * 100;
                                    const outflowWidth = (month.outflow / maxValue) * 100;
                                    const monthName = new Date(month.month + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                                    return (
                                        <div key={month.month} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium w-20">{monthName}</span>
                                                <div className="flex gap-4 text-xs">
                                                    <span className="text-green-600">+{formatCurrency(month.inflow)}</span>
                                                    <span className="text-red-600">-{formatCurrency(month.outflow)}</span>
                                                    <span className={`font-semibold ${month.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                                        ={formatCurrency(month.net)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                                                {/* Barra de entrada (verde) */}
                                                <div
                                                    className="absolute top-0 left-0 h-4 bg-gradient-to-r from-green-400 to-green-500 rounded-t transition-all duration-500"
                                                    style={{ width: `${inflowWidth}%` }}
                                                />
                                                {/* Barra de saída (vermelho) */}
                                                <div
                                                    className="absolute bottom-0 left-0 h-4 bg-gradient-to-r from-red-400 to-red-500 rounded-b transition-all duration-500"
                                                    style={{ width: `${outflowWidth}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Legenda */}
                        <div className="flex items-center justify-center gap-6 pt-4 border-t">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-gradient-to-r from-green-400 to-green-500 rounded" />
                                <span className="text-sm text-gray-600">Inflows</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-gradient-to-r from-red-400 to-red-500 rounded" />
                                <span className="text-sm text-gray-600">Outflows (Refunds)</span>
                            </div>
                        </div>

                        {/* Totais do período */}
                        <div className="grid grid-cols-3 gap-4 pt-4 border-t bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
                            <div className="text-center">
                                <p className="text-xs text-gray-500 uppercase">Total Inflows</p>
                                <p className="text-xl font-bold text-green-600">{formatCurrency(summary.totalInflow)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-gray-500 uppercase">Total Outflows</p>
                                <p className="text-xl font-bold text-red-600">{formatCurrency(summary.totalOutflow)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-gray-500 uppercase">Net Period</p>
                                <p className={`text-xl font-bold ${summary.netCashFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                    {formatCurrency(summary.netCashFlow)}
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Gráfico de Barras Verticais - Distribuição por Dia do Mês */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Receipts by Day of Month
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                        Visualize which days of the month payments occur most frequently
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {/* Gráfico de barras verticais */}
                        <div className="flex items-end justify-between gap-1 h-48 px-2">
                            {(() => {
                                const maxTotal = Math.max(...summary.byDayOfMonth.map(d => d.total), 1);
                                const maxCount = Math.max(...summary.byDayOfMonth.map(d => d.count), 1);
                                return summary.byDayOfMonth.map((dayData) => {
                                    const heightPercent = (dayData.total / maxTotal) * 100;
                                    const hasData = dayData.total > 0;
                                    // Intensidade da cor baseada na quantidade de transactions
                                    const intensity = Math.min(100, Math.round((dayData.count / maxCount) * 100));
                                    return (
                                        <div
                                            key={dayData.day}
                                            className="flex-1 flex flex-col items-center group relative"
                                        >
                                            {/* Tooltip on hover */}
                                            <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                                                <div className="bg-gray-50 dark:bg-black text-gray-900 dark:text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                                                    <div className="font-semibold">Dia {dayData.day}</div>
                                                    <div>{formatCurrency(dayData.total)}</div>
                                                    <div>{dayData.count} transação(ões)</div>
                                                </div>
                                            </div>
                                            {/* Barra vertical */}
                                            <div
                                                className={`w-full rounded-t transition-all duration-300 ${hasData
                                                    ? `bg-gradient-to-t from-blue-${Math.max(400, Math.min(700, 400 + Math.round(intensity / 20) * 100))} to-blue-${Math.max(500, Math.min(800, 500 + Math.round(intensity / 20) * 100))} hover:from-blue-500 hover:to-blue-700`
                                                    : 'bg-gray-100'
                                                    }`}
                                                style={{
                                                    height: `${hasData ? Math.max(heightPercent, 4) : 4}%`,
                                                    opacity: hasData ? Math.max(0.4, intensity / 100) : 0.3
                                                }}
                                            />
                                            {/* Label do dia */}
                                            <span className={`text-xs mt-1 ${dayData.day % 5 === 0 || dayData.day === 1 ? 'text-gray-700 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {dayData.day % 5 === 0 || dayData.day === 1 ? dayData.day : ''}
                                            </span>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Eixo X label */}
                        <div className="text-center text-xs text-gray-500 border-t pt-2">
                            Day of Month (1-31)
                        </div>

                        {/* Insights */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                            {(() => {
                                // Top 5 dias com mais recebimentos
                                const topDays = [...summary.byDayOfMonth]
                                    .filter(d => d.total > 0)
                                    .sort((a, b) => b.total - a.total)
                                    .slice(0, 5);

                                const totalWithData = summary.byDayOfMonth.filter(d => d.total > 0).length;
                                const avgPerActiveDay = totalWithData > 0
                                    ? summary.totalInflow / totalWithData
                                    : 0;

                                // Detectar padrão (início, meio ou fim do mês)
                                const earlyMonth = summary.byDayOfMonth.filter(d => d.day <= 10).reduce((s, d) => s + d.total, 0);
                                const midMonth = summary.byDayOfMonth.filter(d => d.day > 10 && d.day <= 20).reduce((s, d) => s + d.total, 0);
                                const lateMonth = summary.byDayOfMonth.filter(d => d.day > 20).reduce((s, d) => s + d.total, 0);

                                let pattern = 'Distributed';
                                let patternColor = 'text-gray-600';
                                if (earlyMonth > midMonth && earlyMonth > lateMonth) {
                                    pattern = 'Start of Month';
                                    patternColor = 'text-blue-600';
                                } else if (midMonth > earlyMonth && midMonth > lateMonth) {
                                    pattern = 'Mid Month';
                                    patternColor = 'text-purple-600';
                                } else if (lateMonth > earlyMonth && lateMonth > midMonth) {
                                    pattern = 'End of Month';
                                    patternColor = 'text-orange-600';
                                }

                                return (
                                    <>
                                        <div className="text-center">
                                            <p className="text-xs text-gray-500 uppercase">Best Day</p>
                                            <p className="text-lg font-bold text-blue-600">
                                                Day {topDays[0]?.day || '-'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {topDays[0] ? formatCurrency(topDays[0].total) : '—'}
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-gray-500 uppercase">Active Days</p>
                                            <p className="text-lg font-bold text-green-600">{totalWithData}</p>
                                            <p className="text-xs text-gray-500">of 31 days</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-gray-500 uppercase">Avg/Day</p>
                                            <p className="text-lg font-bold text-purple-600">
                                                {formatCurrency(avgPerActiveDay)}
                                            </p>
                                            <p className="text-xs text-gray-500">days with activity</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-gray-500 uppercase">Pattern</p>
                                            <p className={`text-lg font-bold ${patternColor}`}>{pattern}</p>
                                            <p className="text-xs text-gray-500">concentration</p>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Top 5 Dias */}
                        <div className="pt-4 border-t">
                            <p className="text-sm font-medium text-gray-700 mb-2">🏆 Top 5 Days with Most Receipts:</p>
                            <div className="flex flex-wrap gap-2">
                                {(() => {
                                    const topDays = [...summary.byDayOfMonth]
                                        .filter(d => d.total > 0)
                                        .sort((a, b) => b.total - a.total)
                                        .slice(0, 5);
                                    return topDays.map((d, i) => (
                                        <Badge
                                            key={d.day}
                                            variant={i === 0 ? "default" : "secondary"}
                                            className={i === 0 ? "bg-blue-600" : ""}
                                        >
                                            Dia {d.day}: {formatCurrency(d.total)} ({d.count}x)
                                        </Badge>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Monthly Trend Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Monthly Detail
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Month</TableHead>
                                    <TableHead className="text-right">Inflows</TableHead>
                                    <TableHead className="text-right">Outflows</TableHead>
                                    <TableHead className="text-right">Net</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summary.byMonth.map((month) => (
                                    <TableRow key={month.month}>
                                        <TableCell className="font-medium">{month.month}</TableCell>
                                        <TableCell className="text-right text-green-600">
                                            {formatCurrency(month.inflow)}
                                        </TableCell>
                                        <TableCell className="text-right text-red-600">
                                            {formatCurrency(month.outflow)}
                                        </TableCell>
                                        <TableCell className={`text-right font-semibold ${month.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                                            {formatCurrency(month.net)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Transactions ({filteredTransactions.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Receipt Date</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead>Order ID</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Source</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((tx) => (
                                    <TableRow key={tx.id}>
                                        <TableCell className="whitespace-nowrap">
                                            <div>
                                                <div className="font-medium">{formatDateBR(tx.cash_flow_date)}</div>
                                                {tx.date !== tx.cash_flow_date && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Created: {formatDateBR(tx.date)}</div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{tx.customer_name || "—"}</div>
                                                <div className="text-xs text-gray-500">{tx.customer_email}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm font-medium">{tx.product_name}</span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{tx.product_category}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{tx.payment_method_display}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {tx.order_id ? (
                                                <code className="text-xs bg-gray-100 px-1 rounded">{tx.order_id}</code>
                                            ) : (
                                                <span className="text-gray-500 dark:text-gray-400">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className={`text-right font-semibold ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                                            {formatCurrency(tx.amount, tx.currency)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={tx.source.includes("braintree") ? "default" : "secondary"}>
                                                {tx.source.includes("braintree") ? "Braintree" : "GoCardless"}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                            <p className="text-sm text-gray-600">
                                Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredTransactions.length)} of {filteredTransactions.length}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((p) => p - 1)}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage((p) => p + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
