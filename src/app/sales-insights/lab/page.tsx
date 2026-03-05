"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    DollarSign, Loader2, ChevronDown, ChevronRight, TrendingUp, TrendingDown,
    AlertCircle, Minus, RefreshCw, Package, Users, ShoppingCart, Receipt,
    ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { PageHeader } from "@/components/ui/page-header";
import {
    BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";

// ============================================================
// Sales Insights → Lab Analysis
// LAB department products (FA 104.x)
// ============================================================

interface LabProduct {
    code: string;
    name: string;
    revenue: number;
    count: number;
}

interface LabClient {
    name: string;
    email: string;
    region: string;
    revenue_current: number;
    revenue_previous: number;
    revenue_change: number;
    revenue_change_pct: number;
    revenue_ytd: number;
    order_count: number;
    avg_ticket: number;
    first_date: string;
    last_date: string;
    products: LabProduct[];
    product_details: { name: string; revenue: number; count: number }[];
    months_active: number;
}

interface ProductBreakdown {
    code: string;
    name: string;
    revenue_ytd: number;
    revenue_current: number;
    revenue_previous: number;
    change_pct: number;
    order_count: number;
    pct_of_total: number;
}

interface ProductSales {
    name: string;
    revenue_ytd: number;
    revenue_current: number;
    revenue_previous: number;
    change_pct: number;
    order_count: number;
    client_count: number;
    pct_of_total: number;
    avg_ticket: number;
}

interface TimelineEntry {
    month: string;
    revenue: number;
    orders: number;
    active_clients: number;
    avg_ticket: number;
}

interface KPIs {
    revenue_this_month: number;
    revenue_prev_month: number;
    revenue_ytd: number;
    active_clients: number;
    total_clients: number;
    total_orders: number;
    avg_ticket: number;
    mom_growth: number;
}

interface LabData {
    kpis: KPIs;
    clients: LabClient[];
    product_breakdown: ProductBreakdown[];
    product_sales: ProductSales[];
    timeline: TimelineEntry[];
    year: number;
    month: number;
    region: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PRODUCT_COLORS: Record<string, string> = {
    "104.1": "#3b82f6", // blue
    "104.2": "#8b5cf6", // violet
    "104.3": "#06b6d4", // cyan
    "104.4": "#f59e0b", // amber
    "104.5": "#10b981", // emerald
    "104.6": "#ef4444", // red
    "104.7": "#6b7280", // gray
};

export default function LabAnalysisPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<LabData | null>(null);
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [region, setRegion] = useState("all");
    const [expandedClient, setExpandedClient] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [productSearch, setProductSearch] = useState("");
    const [showAllProducts, setShowAllProducts] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ year: String(year), month: String(month), region });
            const res = await fetch(`/api/sales-insights/lab/overview?${params}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Failed to load");
            setData(json);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [year, month, region]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredClients = data?.clients.filter(c => {
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term);
        }
        return true;
    }) || [];

    // Chart data: monthly revenue by product type (stacked bar)
    const chartData = data?.timeline.map((t, i) => {
        const entry: any = {
            month: MONTH_NAMES[i],
            revenue: t.revenue,
            orders: t.orders,
            clients: t.active_clients,
            avg_ticket: t.avg_ticket,
        };
        return entry;
    }) || [];

    // KPI Card
    const KPICard = ({ title, value, subtitle, icon: Icon, color, trend }: {
        title: string; value: string | number; subtitle?: string;
        icon: React.ElementType; color: string; trend?: { value: number; label: string };
    }) => (
        <Card className="bg-gray-50 dark:bg-black border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
                        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
                        {trend && (
                            <div className={`flex items-center gap-1 mt-1 text-xs ${trend.value >= 0 ? "text-green-500" : "text-red-500"}`}>
                                {trend.value >= 0
                                    ? <ArrowUpRight className="h-3 w-3" />
                                    : <ArrowDownRight className="h-3 w-3" />
                                }
                                <span>{trend.value >= 0 ? "+" : ""}{trend.value.toFixed(1)}% {trend.label}</span>
                            </div>
                        )}
                    </div>
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-black">
                        <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    // Custom tooltip for charts
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</p>
                {payload.map((p: any, i: number) => (
                    <p key={i} className="text-xs" style={{ color: p.color }}>
                        {p.name}: {p.name === "orders" || p.name === "clients"
                            ? p.value
                            : formatCurrency(p.value, "EUR")
                        }
                    </p>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <PageHeader title="🔬 Lab Analysis" subtitle="LAB department product sales, insights & month-over-month comparisons">
                <div className="flex items-center gap-3">
                    <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
                        <SelectTrigger className="w-[100px] bg-gray-100 dark:bg-black border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-200">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[2024, 2025, 2026].map(y => (
                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
                        <SelectTrigger className="w-[120px] bg-gray-100 dark:bg-black border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-200">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTH_NAMES.map((m, i) => (
                                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={region} onValueChange={setRegion}>
                        <SelectTrigger className="w-[120px] bg-gray-100 dark:bg-black border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-200">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Regions</SelectItem>
                            <SelectItem value="ROW">ROW</SelectItem>
                            <SelectItem value="AMEX">AMEX</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchData}
                        className="border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111111]"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </PageHeader>

            {/* Loading / Error */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-500 dark:text-gray-400" />
                </div>
            )}
            {error && (
                <Card className="border-red-700 bg-red-900/20">
                    <CardContent className="p-4 flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                        <p className="text-sm text-red-400">{error}</p>
                    </CardContent>
                </Card>
            )}

            {data && !loading && (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <KPICard
                            title="Revenue This Month"
                            value={formatCurrency(data.kpis.revenue_this_month, "EUR")}
                            subtitle={MONTH_NAMES[month - 1] + " " + year}
                            icon={DollarSign}
                            color="text-blue-400"
                            trend={{ value: data.kpis.mom_growth, label: "vs prev month" }}
                        />
                        <KPICard
                            title="Revenue YTD"
                            value={formatCurrency(data.kpis.revenue_ytd, "EUR")}
                            subtitle={`Jan–${MONTH_NAMES[month - 1]} ${year}`}
                            icon={TrendingUp}
                            color="text-purple-400"
                        />
                        <KPICard
                            title="Active Clients"
                            value={data.kpis.active_clients}
                            subtitle={`of ${data.kpis.total_clients} total`}
                            icon={Users}
                            color="text-green-400"
                        />
                        <KPICard
                            title="Total Orders"
                            value={data.kpis.total_orders}
                            subtitle="YTD"
                            icon={ShoppingCart}
                            color="text-cyan-400"
                        />
                        <KPICard
                            title="Avg Ticket"
                            value={formatCurrency(data.kpis.avg_ticket, "EUR")}
                            subtitle="per order YTD"
                            icon={Receipt}
                            color="text-amber-400"
                        />
                        <KPICard
                            title="MoM Growth"
                            value={`${data.kpis.mom_growth >= 0 ? "+" : ""}${data.kpis.mom_growth.toFixed(1)}%`}
                            subtitle={`${formatCurrency(data.kpis.revenue_prev_month, "EUR")} → ${formatCurrency(data.kpis.revenue_this_month, "EUR")}`}
                            icon={data.kpis.mom_growth >= 0 ? TrendingUp : TrendingDown}
                            color={data.kpis.mom_growth >= 0 ? "text-green-400" : "text-red-400"}
                        />
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Revenue Evolution */}
                        <Card className="bg-gray-50 dark:bg-black border-gray-200 dark:border-gray-700">
                            <CardHeader className="py-3 px-4">
                                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-200 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                    Revenue Evolution — {year}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4">
                                <ResponsiveContainer width="100%" height={260}>
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="labRevGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} />
                                        <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="revenue"
                                            name="Revenue"
                                            stroke="#3b82f6"
                                            strokeWidth={2}
                                            fill="url(#labRevGradient)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Orders & Clients */}
                        <Card className="bg-gray-50 dark:bg-black border-gray-200 dark:border-gray-700">
                            <CardHeader className="py-3 px-4">
                                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-200 flex items-center gap-2">
                                    <ShoppingCart className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                    Orders & Active Clients — {year}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4">
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} />
                                        <YAxis tick={{ fontSize: 11, fill: "#888" }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                        <Bar dataKey="orders" name="orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="clients" name="clients" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* FA Code Breakdown (compact) */}
                    <Card className="bg-gray-50 dark:bg-black border-gray-200 dark:border-gray-700">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-200 flex items-center gap-2">
                                <Package className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                Subscription Level Breakdown (FA 104.x)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            {data.product_breakdown.length > 0 ? (
                                <div className="space-y-3">
                                    {data.product_breakdown.map(p => {
                                        const barColor = PRODUCT_COLORS[p.code] || "#6b7280";
                                        return (
                                            <div key={p.code} className="flex items-center gap-3">
                                                <Badge variant="outline" className="text-[10px] font-mono w-12 justify-center bg-gray-100 dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600">
                                                    {p.code}
                                                </Badge>
                                                <span className="text-xs text-gray-600 dark:text-gray-300 w-40 truncate" title={p.name}>
                                                    {p.name}
                                                </span>
                                                <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden relative">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${Math.max(p.pct_of_total, 2)}%`,
                                                            backgroundColor: barColor,
                                                        }}
                                                    />
                                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-gray-700 dark:text-gray-200">
                                                        {p.pct_of_total.toFixed(1)}%
                                                    </span>
                                                </div>
                                                <span className="text-xs font-medium text-gray-600 dark:text-gray-200 w-24 text-right">
                                                    {formatCurrency(p.revenue_ytd, "EUR")}
                                                </span>
                                                <span className={`text-xs w-20 text-right flex items-center justify-end gap-0.5 ${p.change_pct >= 0 ? "text-green-500" : "text-red-500"}`}>
                                                    {p.change_pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                    {p.change_pct >= 0 ? "+" : ""}{p.change_pct.toFixed(0)}%
                                                </span>
                                                <span className="text-[10px] text-gray-500 w-14 text-right">
                                                    {p.order_count} orders
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <div className="flex items-center gap-3 border-t border-gray-200 dark:border-gray-700 pt-3 mt-2">
                                        <Badge variant="outline" className="text-[10px] font-mono w-12 justify-center bg-gray-100 dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 font-bold">
                                            Total
                                        </Badge>
                                        <span className="text-xs text-gray-600 dark:text-gray-300 w-40 font-medium">All Levels</span>
                                        <div className="flex-1" />
                                        <span className="text-xs font-bold text-gray-600 dark:text-gray-200 w-24 text-right">
                                            {formatCurrency(data.kpis.revenue_ytd, "EUR")}
                                        </span>
                                        <span className={`text-xs w-20 text-right flex items-center justify-end gap-0.5 font-medium ${data.kpis.mom_growth >= 0 ? "text-green-500" : "text-red-500"}`}>
                                            {data.kpis.mom_growth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                            {data.kpis.mom_growth >= 0 ? "+" : ""}{data.kpis.mom_growth.toFixed(0)}%
                                        </span>
                                        <span className="text-[10px] text-gray-500 w-14 text-right font-medium">
                                            {data.kpis.total_orders} orders
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-6">No data available</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Product Sales Breakdown (by product name) */}
                    <Card className="bg-gray-50 dark:bg-black border-gray-200 dark:border-gray-700">
                        <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-200 flex items-center gap-2">
                                    <ShoppingCart className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                    Product Sales Breakdown ({(data.product_sales || []).length} products)
                                </CardTitle>
                                <input
                                    type="text"
                                    placeholder="Search product..."
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                    className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-md text-gray-600 dark:text-gray-200 placeholder-gray-500 w-56 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="px-0 pb-0">
                            {(() => {
                                const allProducts = data.product_sales || [];
                                const filtered = allProducts.filter(p =>
                                    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
                                );
                                const displayed = showAllProducts ? filtered : filtered.slice(0, 15);
                                const hasMore = filtered.length > 15 && !showAllProducts;

                                return (
                                    <>
                                        <div className="max-h-[500px] overflow-auto">
                                            <Table>
                                                <TableHeader className="sticky top-0 bg-gray-100 dark:bg-black z-10">
                                                    <TableRow className="border-gray-200 dark:border-gray-700">
                                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300 w-8 text-center">#</TableHead>
                                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300">Product</TableHead>
                                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">
                                                            Rev. {MONTH_NAMES[month - 1]}
                                                        </TableHead>
                                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">
                                                            Rev. {MONTH_NAMES[month === 1 ? 11 : month - 2]}
                                                        </TableHead>
                                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">MoM Δ</TableHead>
                                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Revenue YTD</TableHead>
                                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">% Total</TableHead>
                                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Orders</TableHead>
                                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Clients</TableHead>
                                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Avg Ticket</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {displayed.map((p, idx) => (
                                                        <TableRow key={p.name} className="border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-[#111111]">
                                                            <TableCell className="py-2 text-center text-[10px] text-gray-500">{idx + 1}</TableCell>
                                                            <TableCell className="py-2">
                                                                <span className="text-xs text-gray-600 dark:text-gray-200 truncate block max-w-[300px]" title={p.name}>
                                                                    {p.name}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="py-2 text-right">
                                                                <span className="text-xs font-medium text-gray-600 dark:text-gray-200">
                                                                    {formatCurrency(p.revenue_current, "EUR")}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="py-2 text-right">
                                                                <span className="text-xs text-gray-500">
                                                                    {formatCurrency(p.revenue_previous, "EUR")}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="py-2 text-right">
                                                                {p.revenue_current === 0 && p.revenue_previous === 0 ? (
                                                                    <Minus className="h-3.5 w-3.5 text-gray-500 ml-auto" />
                                                                ) : (
                                                                    <span className={`text-xs flex items-center justify-end gap-0.5 ${p.change_pct >= 0 ? "text-green-500" : "text-red-500"}`}>
                                                                        {p.change_pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                                        {p.change_pct >= 0 ? "+" : ""}{p.change_pct.toFixed(0)}%
                                                                    </span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="py-2 text-right">
                                                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                                    {formatCurrency(p.revenue_ytd, "EUR")}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="py-2 text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-blue-500 rounded-full"
                                                                            style={{ width: `${Math.min(p.pct_of_total, 100)}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-[10px] text-gray-500 w-10 text-right">
                                                                        {p.pct_of_total.toFixed(1)}%
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-2 text-right text-xs text-gray-500">
                                                                {p.order_count}
                                                            </TableCell>
                                                            <TableCell className="py-2 text-right text-xs text-gray-500">
                                                                {p.client_count}
                                                            </TableCell>
                                                            <TableCell className="py-2 text-right text-xs text-gray-500">
                                                                {formatCurrency(p.avg_ticket, "EUR")}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {displayed.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={10} className="text-center py-8 text-gray-500 text-sm">
                                                                No products found
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        {/* Footer */}
                                        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-black px-4 py-2 flex items-center justify-between text-xs">
                                            <span className="text-gray-500 dark:text-gray-400">
                                                Showing {displayed.length} of {filtered.length} products
                                            </span>
                                            <div className="flex items-center gap-4">
                                                {hasMore && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setShowAllProducts(true)}
                                                        className="text-xs text-blue-500 hover:text-blue-400 h-6 px-2"
                                                    >
                                                        Show all {filtered.length} products
                                                    </Button>
                                                )}
                                                {showAllProducts && filtered.length > 15 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setShowAllProducts(false)}
                                                        className="text-xs text-gray-500 hover:text-gray-400 h-6 px-2"
                                                    >
                                                        Show top 15
                                                    </Button>
                                                )}
                                                <span className="text-gray-500 dark:text-gray-400">
                                                    Total: <span className="font-medium text-gray-700 dark:text-gray-200">{formatCurrency(data.kpis.revenue_ytd, "EUR")}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </CardContent>
                    </Card>

                    {/* Monthly Comparison Table */}
                    <Card className="bg-gray-50 dark:bg-black border-gray-200 dark:border-gray-700">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-200 flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                Monthly Summary — {year}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-0 pb-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-gray-200 dark:border-gray-700">
                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300">Month</TableHead>
                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Revenue</TableHead>
                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">MoM Δ</TableHead>
                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Orders</TableHead>
                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Clients</TableHead>
                                        <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Avg Ticket</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.timeline.map((t, i) => {
                                        const prevRev = i > 0 ? data.timeline[i - 1].revenue : 0;
                                        const momChange = prevRev > 0 ? ((t.revenue - prevRev) / prevRev) * 100 : (t.revenue > 0 ? 100 : 0);
                                        const isCurrentMonth = i === month - 1;
                                        return (
                                            <TableRow
                                                key={t.month}
                                                className={`border-gray-200 dark:border-gray-700 ${isCurrentMonth ? "bg-blue-50 dark:bg-blue-900/10" : ""}`}
                                            >
                                                <TableCell className="py-2 text-xs font-medium text-gray-600 dark:text-gray-200">
                                                    {MONTH_NAMES[i]} {year}
                                                    {isCurrentMonth && (
                                                        <Badge variant="outline" className="ml-2 text-[8px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600 py-0 px-1">
                                                            current
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-2 text-xs text-right font-medium text-gray-600 dark:text-gray-200">
                                                    {formatCurrency(t.revenue, "EUR")}
                                                </TableCell>
                                                <TableCell className="py-2 text-right">
                                                    {i === 0 ? (
                                                        <Minus className="h-3.5 w-3.5 text-gray-500 ml-auto" />
                                                    ) : (
                                                        <span className={`text-xs flex items-center justify-end gap-0.5 ${momChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                                                            {momChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                            {momChange >= 0 ? "+" : ""}{momChange.toFixed(1)}%
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-2 text-xs text-right text-gray-700 dark:text-gray-300">
                                                    {t.orders}
                                                </TableCell>
                                                <TableCell className="py-2 text-xs text-right text-gray-700 dark:text-gray-300">
                                                    {t.active_clients}
                                                </TableCell>
                                                <TableCell className="py-2 text-xs text-right text-gray-700 dark:text-gray-300">
                                                    {formatCurrency(t.avg_ticket, "EUR")}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Client Table */}
                    <Card className="bg-gray-50 dark:bg-black border-gray-200 dark:border-gray-700">
                        <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-200 flex items-center gap-2">
                                    <Users className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                    Lab Clients ({filteredClients.length})
                                </CardTitle>
                                <input
                                    type="text"
                                    placeholder="Search client..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-md text-gray-600 dark:text-gray-200 placeholder-gray-500 w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="px-0 py-0">
                            <div className="max-h-[600px] overflow-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-gray-100 dark:bg-black z-10">
                                        <TableRow className="border-gray-200 dark:border-gray-700">
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300 w-8"></TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300">Client</TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300">Region</TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">
                                                Rev. {MONTH_NAMES[month - 1]}
                                            </TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">
                                                Rev. {MONTH_NAMES[month === 1 ? 11 : month - 2]}
                                            </TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Variation</TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Revenue YTD</TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Orders</TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Avg Ticket</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredClients.map(client => (
                                            <React.Fragment key={client.name}>
                                                <TableRow
                                                    className="border-gray-200 dark:border-gray-700 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-[#111111]"
                                                    onClick={() => setExpandedClient(
                                                        expandedClient === client.name ? null : client.name
                                                    )}
                                                >
                                                    <TableCell className="py-2 px-2">
                                                        {expandedClient === client.name
                                                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                                                            : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                                                        }
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <div>
                                                            <span className="text-xs font-medium text-gray-600 dark:text-gray-200 block truncate max-w-[200px]" title={client.name}>
                                                                {client.name}
                                                            </span>
                                                            {client.email && (
                                                                <span className="text-[10px] text-gray-500 block truncate max-w-[200px]">
                                                                    {client.email}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Badge variant="outline" className="text-[10px] bg-gray-100 dark:bg-black text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600">
                                                            {client.region}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-200">
                                                            {formatCurrency(client.revenue_current, "EUR")}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            {formatCurrency(client.revenue_previous, "EUR")}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <RevenueChangeCell change={client.revenue_change} pct={client.revenue_change_pct} />
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <span className="text-xs text-gray-700 dark:text-gray-300">
                                                            {formatCurrency(client.revenue_ytd, "EUR")}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            {client.order_count}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            {formatCurrency(client.avg_ticket, "EUR")}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>

                                                {/* Expanded detail */}
                                                {expandedClient === client.name && (
                                                    <TableRow className="border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/30">
                                                        <TableCell colSpan={9} className="p-4">
                                                            <ClientDetail client={client} year={year} />
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        ))}
                                        {filteredClients.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={9} className="text-center py-8 text-gray-500 text-sm">
                                                    No clients found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            {/* Summary footer */}
                            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-black px-4 py-2 flex items-center justify-between text-xs">
                                <span className="text-gray-500 dark:text-gray-400">
                                    Showing {filteredClients.length} of {data.clients.length} clients
                                </span>
                                <div className="flex items-center gap-4">
                                    <span className="text-gray-500 dark:text-gray-400">
                                        Total YTD: <span className="font-medium text-gray-700 dark:text-gray-200">{formatCurrency(data.kpis.revenue_ytd, "EUR")}</span>
                                    </span>
                                    <span className="text-gray-500 dark:text-gray-400">
                                        Orders: <span className="font-medium text-gray-700 dark:text-gray-200">{data.kpis.total_orders}</span>
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}

// ============================================================
// Sub-components
// ============================================================

function RevenueChangeCell({ change, pct }: { change: number; pct: number }) {
    if (change === 0) {
        return <Minus className="h-3.5 w-3.5 text-gray-500 ml-auto" />;
    }
    const isPositive = change > 0;
    return (
        <span className={`text-xs flex items-center justify-end gap-1 ${isPositive ? "text-green-400" : "text-red-400"}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? "+" : ""}{formatCurrency(change, "EUR")}
            <span className="text-[10px] text-gray-500">({pct >= 0 ? "+" : ""}{pct.toFixed(0)}%)</span>
        </span>
    );
}

function ClientDetail({ client, year }: { client: LabClient; year: number }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Products by description */}
            <div className="lg:col-span-2">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                    Products Purchased ({year} YTD)
                </h4>
                <div className="space-y-1.5">
                    {(client.product_details || []).length > 0 ? (client.product_details || []).map((p, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-100 dark:bg-black/50 rounded px-3 py-1.5">
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[350px]" title={p.name}>
                                {p.name}
                            </span>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[10px] text-gray-500">{p.count} orders</span>
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-200 w-20 text-right">{formatCurrency(p.revenue, "EUR")}</span>
                            </div>
                        </div>
                    )) : (
                        <p className="text-xs text-gray-500">No products found</p>
                    )}
                </div>
                {/* FA level summary */}
                {client.products.length > 0 && (
                    <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-2">
                        <h4 className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                            By Subscription Level
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {client.products.map(p => (
                                <Badge key={p.code} variant="outline" className="text-[9px] bg-gray-100 dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600">
                                    {p.code} {p.name} — {formatCurrency(p.revenue, "EUR")} ({p.count}x)
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                    <span className="text-xs text-gray-500">Total {year} YTD</span>
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-200">{formatCurrency(client.revenue_ytd, "EUR")}</span>
                </div>
            </div>

            {/* Client info */}
            <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                    Client Information
                </h4>
                <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between bg-gray-100 dark:bg-black/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">First Transaction</span>
                        <span className="text-gray-700 dark:text-gray-300">{formatDate(client.first_date)}</span>
                    </div>
                    <div className="flex justify-between bg-gray-100 dark:bg-black/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">Last Transaction</span>
                        <span className="text-gray-700 dark:text-gray-300">{formatDate(client.last_date)}</span>
                    </div>
                    <div className="flex justify-between bg-gray-100 dark:bg-black/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">Total Orders</span>
                        <span className="text-gray-700 dark:text-gray-300">{client.order_count}</span>
                    </div>
                    <div className="flex justify-between bg-gray-100 dark:bg-black/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">Avg Ticket</span>
                        <span className="text-gray-700 dark:text-gray-300">{formatCurrency(client.avg_ticket, "EUR")}</span>
                    </div>
                    <div className="flex justify-between bg-gray-100 dark:bg-black/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">Months Active</span>
                        <span className="text-gray-700 dark:text-gray-300">{client.months_active}</span>
                    </div>
                    <div className="flex justify-between bg-gray-100 dark:bg-black/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">Region</span>
                        <span className="text-gray-700 dark:text-gray-300">{client.region}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
