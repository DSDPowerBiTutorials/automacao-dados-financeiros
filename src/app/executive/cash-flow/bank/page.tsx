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
    Building,
    Package,
    Filter,
    Link2,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface BankTransaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    source: string;
    currency: string;
    category: string;
    gateway: string | null;
    gatewayMatch: GatewayMatch | null;
    productCategory: string;
    isReconciled: boolean;
}

interface GatewayMatch {
    id: string;
    date: string;
    amount: number;
    customer_name: string;
    customer_email: string;
    order_id: string | null;
    payment_method: string;
    source: string;
}

interface GatewayTransaction {
    id: string;
    date: string;
    amount: number;
    source: string;
    custom_data: {
        customer_name?: string;
        customer_email?: string;
        order_id?: string;
        payment_method?: string;
        settlement_date?: string;
        disbursement_date?: string;
        currency?: string;
    };
}

// Detectar gateway baseado na descrição do extrato bancário
function detectGateway(description: string): string | null {
    const desc = description.toLowerCase();

    if (desc.includes("braintree") || desc.includes("paypal braintree")) return "braintree";
    if (desc.includes("stripe")) return "stripe";
    if (desc.includes("gocardless") || desc.includes("go cardless")) return "gocardless";
    if (desc.includes("paypal") && !desc.includes("braintree")) return "paypal";
    if (desc.includes("american express") || desc.includes("amex")) return "amex";
    if (desc.includes("adyen")) return "adyen";
    if (desc.includes("square")) return "square";
    if (desc.includes("wise") || desc.includes("transferwise")) return "wise";

    return null;
}

// Categorizar tipo de transação bancária
function categorizeBank(description: string, amount: number): string {
    const desc = description.toLowerCase();

    // Receitas de gateways
    if (detectGateway(description)) return "Gateway Payment";

    // Transferências
    if (desc.includes("transfer") || desc.includes("trans/") || desc.includes("mxiso")) return "Transfer";

    // Taxas/Comissões
    if (desc.includes("fee") || desc.includes("commission") || desc.includes("comision")) return "Fee";

    // Salários
    if (desc.includes("salary") || desc.includes("nomina") || desc.includes("payroll")) return "Payroll";

    // Impostos
    if (desc.includes("tax") || desc.includes("impuesto") || desc.includes("hacienda")) return "Tax";

    // Por valor
    if (amount > 0) return "Income";
    return "Expense";
}

// Categorizar produto baseado no valor
function categorizeProduct(amount: number): string {
    const absAmount = Math.abs(amount);

    if (absAmount >= 10000) return "Enterprise/Bulk";
    if (absAmount >= 5000) return "Premium Course";
    if (absAmount >= 2000) return "Standard Course";
    if (absAmount >= 500) return "Workshop";
    if (absAmount >= 100) return "Subscription";
    return "Misc/Fee";
}

export default function BankCashFlowPage() {
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
    const [gatewayTransactions, setGatewayTransactions] = useState<GatewayTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [matchingStats, setMatchingStats] = useState({ matched: 0, unmatched: 0 });

    // Filters
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
        start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        end: new Date().toISOString().split("T")[0],
    });
    const [gatewayFilter, setGatewayFilter] = useState<string>("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [flowFilter, setFlowFilter] = useState<string>("all"); // income, expense, all
    const [searchQuery, setSearchQuery] = useState("");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 50;

    // Match bank transactions with gateway transactions
    const matchTransactions = useCallback((
        bankTx: Array<{ id: string; date: string; description: string; amount: number; source: string; custom_data: Record<string, unknown> }>,
        gatewayTx: GatewayTransaction[]
    ): BankTransaction[] => {
        let matchedCount = 0;

        const result = bankTx.map((bank) => {
            const gateway = detectGateway(bank.description);
            const category = categorizeBank(bank.description, bank.amount);
            const productCategory = categorizeProduct(bank.amount);

            let gatewayMatch: GatewayMatch | null = null;

            // Tentar encontrar match no gateway
            if (gateway && bank.amount > 0) {
                // Buscar por data de settlement/disbursement próxima e valor aproximado
                const bankDate = new Date(bank.date);
                const candidates = gatewayTx.filter((gt) => {
                    // Filtrar por source do gateway
                    if (gateway === "braintree" && !gt.source.includes("braintree")) return false;
                    if (gateway === "gocardless" && !gt.source.includes("gocardless")) return false;
                    if (gateway === "stripe" && !gt.source.includes("stripe")) return false;

                    // Verificar data próxima (settlement pode ser alguns dias antes)
                    const settlementDate = gt.custom_data?.settlement_date || gt.custom_data?.disbursement_date || gt.date;
                    const gtDate = new Date(settlementDate);
                    const daysDiff = Math.abs((bankDate.getTime() - gtDate.getTime()) / (1000 * 60 * 60 * 24));

                    return daysDiff <= 5;
                });

                // Buscar pelo valor mais próximo
                if (candidates.length > 0) {
                    const sorted = candidates.sort((a, b) => {
                        const diffA = Math.abs(a.amount - bank.amount);
                        const diffB = Math.abs(b.amount - bank.amount);
                        return diffA - diffB;
                    });

                    const best = sorted[0];
                    const percentDiff = Math.abs(best.amount - bank.amount) / bank.amount;

                    // Aceitar se diferença < 5% (taxas podem causar pequenas diferenças)
                    if (percentDiff < 0.05 || Math.abs(best.amount - bank.amount) < 10) {
                        gatewayMatch = {
                            id: best.id,
                            date: best.date,
                            amount: best.amount,
                            customer_name: best.custom_data?.customer_name || "",
                            customer_email: best.custom_data?.customer_email || "",
                            order_id: best.custom_data?.order_id || null,
                            payment_method: best.custom_data?.payment_method || "",
                            source: best.source,
                        };
                        matchedCount++;
                    }
                }
            }

            return {
                id: bank.id,
                date: bank.date,
                description: bank.description,
                amount: bank.amount,
                source: bank.source,
                currency: bank.source.includes("usd") ? "USD" : "EUR",
                category,
                gateway,
                gatewayMatch,
                productCategory,
                isReconciled: !!gatewayMatch,
            };
        });

        setMatchingStats({
            matched: matchedCount,
            unmatched: result.filter((r) => r.gateway && !r.gatewayMatch).length,
        });

        return result;
    }, []);

    useEffect(() => {
        loadData();
    }, [dateRange]);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Carregar extratos bancários
            const { data: bankData, error: bankError } = await supabase
                .from("csv_rows")
                .select("*")
                .in("source", ["bankinter-eur", "bankinter-usd", "sabadell"])
                .gte("date", dateRange.start)
                .lte("date", dateRange.end)
                .order("date", { ascending: false });

            if (bankError) throw bankError;

            // Carregar transactions dos gateways para matching
            const { data: gatewayData, error: gatewayError } = await supabase
                .from("csv_rows")
                .select("id, date, amount, source, custom_data")
                .in("source", [
                    "braintree-api-revenue",
                    "braintree-api-disbursement",
                    "gocardless",
                    "stripe",
                    "stripe-eur",
                    "stripe-usd"
                ])
                .gte("date", new Date(new Date(dateRange.start).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
                .lte("date", dateRange.end);

            if (gatewayError) throw gatewayError;

            setGatewayTransactions(gatewayData || []);

            // Fazer matching
            const matched = matchTransactions(bankData || [], gatewayData || []);
            setBankTransactions(matched);

        } catch (err) {
            console.error("Error loading data:", err);
            setError(err instanceof Error ? err.message : "Erro ao carregar dados");
        } finally {
            setIsLoading(false);
        }
    };

    // Filtered transactions
    const filteredTransactions = useMemo(() => {
        return bankTransactions.filter((tx) => {
            if (gatewayFilter !== "all" && tx.gateway !== gatewayFilter) return false;
            if (categoryFilter !== "all" && tx.productCategory !== categoryFilter) return false;
            if (flowFilter === "income" && tx.amount <= 0) return false;
            if (flowFilter === "expense" && tx.amount >= 0) return false;
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    tx.description.toLowerCase().includes(query) ||
                    tx.gatewayMatch?.customer_name?.toLowerCase().includes(query) ||
                    tx.gatewayMatch?.customer_email?.toLowerCase().includes(query) ||
                    tx.gatewayMatch?.order_id?.toLowerCase().includes(query)
                );
            }
            return true;
        });
    }, [bankTransactions, gatewayFilter, categoryFilter, flowFilter, searchQuery]);

    // Summary calculations
    const summary = useMemo(() => {
        const inflows = filteredTransactions.filter((t) => t.amount > 0);
        const outflows = filteredTransactions.filter((t) => t.amount < 0);

        const totalInflow = inflows.reduce((sum, t) => sum + t.amount, 0);
        const totalOutflow = Math.abs(outflows.reduce((sum, t) => sum + t.amount, 0));

        // By gateway
        const byGateway: Record<string, number> = {};
        inflows.forEach((t) => {
            const key = t.gateway || "other";
            byGateway[key] = (byGateway[key] || 0) + t.amount;
        });

        // By product category
        const byProductCategory: Record<string, number> = {};
        inflows.forEach((t) => {
            byProductCategory[t.productCategory] = (byProductCategory[t.productCategory] || 0) + t.amount;
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
            byGateway,
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
    const productCategories = useMemo(() => {
        return [...new Set(bankTransactions.map((t) => t.productCategory))].sort();
    }, [bankTransactions]);

    // Export to CSV
    const exportCSV = () => {
        const headers = [
            "Data",
            "Description Banco",
            "Amount",
            "Moeda",
            "Gateway",
            "Cliente",
            "Email",
            "Order ID",
            "Categoria Produto",
            "Reconciliado",
        ];

        const rows = filteredTransactions.map((t) => [
            t.date,
            `"${t.description.replace(/"/g, '""')}"`,
            t.amount.toFixed(2),
            t.currency,
            t.gateway || "",
            `"${(t.gatewayMatch?.customer_name || "").replace(/"/g, '""')}"`,
            t.gatewayMatch?.customer_email || "",
            t.gatewayMatch?.order_id || "",
            t.productCategory,
            t.isReconciled ? "Yes" : "No",
        ]);

        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fluxo-caixa-bancario-${dateRange.start}-${dateRange.end}.csv`;
        a.click();
    };

    const formatCurrency = (value: number, currency = "EUR") => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency,
        }).format(value);
    };

    const getGatewayColor = (gateway: string | null) => {
        switch (gateway) {
            case "braintree": return "bg-blue-100 text-blue-800";
            case "stripe": return "bg-purple-100 text-purple-800";
            case "gocardless": return "bg-green-100 text-green-800";
            case "paypal": return "bg-yellow-100 text-yellow-800";
            case "amex": return "bg-indigo-100 text-indigo-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-full px-6 py-6 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading bank cash flow...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full px-6 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <header className="page-header-standard">
                    <h1 className="header-title">Bank Cash Flow</h1>
                    <p className="header-subtitle">
                        Bank statements with source identification (Braintree, GoCardless, Stripe)
                    </p>
                </header>
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
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error}
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 p-2 rounded-lg">
                                <ArrowDownCircle className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-600">Inflows</p>
                                <p className="text-lg font-bold text-green-600">
                                    {formatCurrency(summary.totalInflow)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-red-100 p-2 rounded-lg">
                                <ArrowUpCircle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-600">Outflows</p>
                                <p className="text-lg font-bold text-red-600">
                                    {formatCurrency(summary.totalOutflow)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <TrendingUp className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-600">Net</p>
                                <p className={`text-lg font-bold ${summary.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {formatCurrency(summary.netCashFlow)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-100 p-2 rounded-lg">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-600">Reconciled</p>
                                <p className="text-lg font-bold text-emerald-600">
                                    {matchingStats.matched}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-amber-100 p-2 rounded-lg">
                                <AlertCircle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-600">Pending</p>
                                <p className="text-lg font-bold text-amber-600">
                                    {matchingStats.unmatched}
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
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Start Date
                            </label>
                            <Input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                End Date
                            </label>
                            <Input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Gateway
                            </label>
                            <Select value={gatewayFilter} onValueChange={setGatewayFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="braintree">Braintree</SelectItem>
                                    <SelectItem value="stripe">Stripe</SelectItem>
                                    <SelectItem value="gocardless">GoCardless</SelectItem>
                                    <SelectItem value="paypal">PayPal</SelectItem>
                                    <SelectItem value="amex">Amex</SelectItem>
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
                                    {productCategories.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Flow
                            </label>
                            <Select value={flowFilter} onValueChange={setFlowFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="income">Inflows</SelectItem>
                                    <SelectItem value="expense">Outflows</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Search
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Customer, description..."
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
                {/* By Gateway */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Revenue by Payment Gateway
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {Object.entries(summary.byGateway)
                                .sort((a, b) => b[1] - a[1])
                                .map(([gateway, value]) => (
                                    <div key={gateway} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge className={getGatewayColor(gateway)}>
                                                {gateway === "other" ? "Others" : gateway.charAt(0).toUpperCase() + gateway.slice(1)}
                                            </Badge>
                                        </div>
                                        <span className="font-semibold text-green-600">
                                            {formatCurrency(value)}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>

                {/* By Product Category */}
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
            </div>

            {/* Monthly Trend */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Monthly Flow (Bank Statement)
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
                        <Building className="h-5 w-5" />
                        Bank Movements ({filteredTransactions.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Bank Description</TableHead>
                                    <TableHead>Gateway</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Order ID</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((tx) => (
                                    <TableRow key={tx.id} className={tx.isReconciled ? "bg-green-50/30" : ""}>
                                        <TableCell className="whitespace-nowrap">{tx.date}</TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={tx.description}>
                                            {tx.description}
                                        </TableCell>
                                        <TableCell>
                                            {tx.gateway ? (
                                                <Badge className={getGatewayColor(tx.gateway)}>
                                                    {tx.gateway.charAt(0).toUpperCase() + tx.gateway.slice(1)}
                                                </Badge>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {tx.gatewayMatch ? (
                                                <div>
                                                    <div className="font-medium text-sm">{tx.gatewayMatch.customer_name || "—"}</div>
                                                    <div className="text-xs text-gray-500">{tx.gatewayMatch.customer_email}</div>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">{tx.productCategory}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {tx.gatewayMatch?.order_id ? (
                                                <code className="text-xs bg-gray-100 px-1 rounded">{tx.gatewayMatch.order_id}</code>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className={`text-right font-semibold ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                                            {formatCurrency(tx.amount, tx.currency)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {tx.isReconciled ? (
                                                <Link2 className="h-4 w-4 text-green-600 mx-auto" />
                                            ) : tx.gateway ? (
                                                <AlertCircle className="h-4 w-4 text-amber-500 mx-auto" />
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
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
