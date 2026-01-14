"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Transaction {
    id: string;
    date: string;
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

// Simplificar método de pagamento ("visa ***0888" -> "Visa")
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

    // Filters com debounce
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
        start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        end: new Date().toISOString().split("T")[0],
    });
    const [pendingDateRange, setPendingDateRange] = useState(dateRange);
    const [sourceFilter, setSourceFilter] = useState<string>("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    // Debounce timer ref
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 50;

    // Debounce para filtro de data (só carrega após 800ms sem alteração)
    const handleDateChange = useCallback((field: 'start' | 'end', value: string) => {
        setPendingDateRange(prev => ({ ...prev, [field]: value }));

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            setDateRange(prev => ({ ...prev, [field]: value }));
        }, 800);
    }, []);

    // Aplicar filtro de data imediatamente (botão)
    const applyDateFilter = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        setDateRange(pendingDateRange);
    }, [pendingDateRange]);

    useEffect(() => {
        loadData();
    }, [dateRange]);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Buscar todas as transações de receita (Braintree + GoCardless)
            const { data, error: supabaseError } = await supabase
                .from("csv_rows")
                .select("*")
                .in("source", [
                    "braintree-api-revenue",
                    "braintree-eur",
                    "braintree-usd",
                    "gocardless",
                ])
                .gte("date", dateRange.start)
                .lte("date", dateRange.end)
                .order("date", { ascending: false });

            if (supabaseError) throw supabaseError;

            const mapped: Transaction[] = (data || []).map((row) => {
                const cd = row.custom_data || {};
                const amount = parseFloat(row.amount) || 0;

                const desc = cd.description || row.description || "";
                return {
                    id: row.id,
                    date: row.date,
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
                    settlement_date: cd.settlement_date || cd.disbursement_date || null,
                };
            });

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

        // By month
        const byMonthMap: Record<string, { inflow: number; outflow: number }> = {};
        filteredTransactions.forEach((t) => {
            const month = t.date.substring(0, 7);
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

        return {
            totalInflow,
            totalOutflow,
            netCashFlow: totalInflow - totalOutflow,
            transactionCount: filteredTransactions.length,
            avgTransactionValue: inflows.length > 0 ? totalInflow / inflows.length : 0,
            byPaymentMethod,
            byProductCategory,
            byMonth,
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
            "Descrição",
            "Valor",
            "Moeda",
            "Cliente",
            "Email",
            "Método",
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
        return new Intl.NumberFormat("pt-PT", {
            style: "currency",
            currency,
        }).format(value);
    };

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Carregando fluxo de caixa...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Fluxo de Caixa Real</h1>
                    <p className="text-gray-600 mt-1">
                        Receitas reais de Braintree e GoCardless com categorização de produtos
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={loadData} className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Atualizar
                    </Button>
                    <Button onClick={exportCSV} className="gap-2">
                        <Download className="h-4 w-4" />
                        Exportar CSV
                    </Button>
                </div>
            </div>

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
                                <p className="text-sm text-gray-600">Entradas</p>
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
                                <p className="text-sm text-gray-600">Saídas (Refunds)</p>
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
                                <p className="text-sm text-gray-600">Fluxo Líquido</p>
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
                                <p className="text-sm text-gray-600">Transações</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {summary.transactionCount}
                                </p>
                                <p className="text-xs text-gray-500">
                                    Média: {formatCurrency(summary.avgTransactionValue)}
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
                        Filtros
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Data Início
                            </label>
                            <Input
                                type="date"
                                value={pendingDateRange.start}
                                onChange={(e) => handleDateChange('start', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Data Fim
                            </label>
                            <Input
                                type="date"
                                value={pendingDateRange.end}
                                onChange={(e) => handleDateChange('end', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Fonte
                            </label>
                            <Select value={sourceFilter} onValueChange={setSourceFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    <SelectItem value="braintree">Braintree</SelectItem>
                                    <SelectItem value="gocardless">GoCardless</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Categoria
                            </label>
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
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
                                Buscar
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Cliente, email, order..."
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
                            Receita por Categoria de Produto
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
                            Volume por Método de Pagamento
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

            {/* Monthly Trend */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Fluxo Mensal
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mês</TableHead>
                                    <TableHead className="text-right">Entradas</TableHead>
                                    <TableHead className="text-right">Saídas</TableHead>
                                    <TableHead className="text-right">Líquido</TableHead>
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
                        Transações ({filteredTransactions.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Produto</TableHead>
                                    <TableHead>Categoria</TableHead>
                                    <TableHead>Método</TableHead>
                                    <TableHead>Order ID</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                    <TableHead>Fonte</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((tx) => (
                                    <TableRow key={tx.id}>
                                        <TableCell className="whitespace-nowrap">{formatDateBR(tx.date)}</TableCell>
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
                                                <span className="text-gray-400">—</span>
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
                                Mostrando {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredTransactions.length)} de {filteredTransactions.length}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((p) => p - 1)}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage((p) => p + 1)}
                                >
                                    Próximo
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
