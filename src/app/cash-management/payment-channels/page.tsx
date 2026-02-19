"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
    ArrowDownCircle,
    ArrowUpCircle,
    Download,
    RefreshCw,
    Search,
    CreditCard,
    Calendar,
    DollarSign,
    CheckCircle2,
    AlertCircle,
    Loader2,
    X,
    Upload,
    Clock,
    ChevronDown,
    ChevronRight,
    Filter,
    Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

// ════════════════════════════════════════════════════════
// Types & Constants
// ════════════════════════════════════════════════════════

interface GatewayConfig {
    key: string;
    label: string;
    currency: string;
    bgColor: string;
    textColor: string;
    activeRing: string;
    uploadEndpoint: string;
    uploadAccept: string;
    uploadType: "formdata" | "json";
}

const GATEWAYS: GatewayConfig[] = [
    { key: "stripe-eur", label: "Stripe EUR", currency: "EUR", bgColor: "bg-indigo-600", textColor: "text-indigo-400", activeRing: "ring-indigo-500", uploadEndpoint: "/api/csv-rows", uploadAccept: ".csv", uploadType: "json" },
    { key: "stripe-usd", label: "Stripe USD", currency: "USD", bgColor: "bg-indigo-500", textColor: "text-indigo-300", activeRing: "ring-indigo-400", uploadEndpoint: "/api/csv-rows", uploadAccept: ".csv", uploadType: "json" },
    { key: "braintree-eur", label: "Braintree EUR", currency: "EUR", bgColor: "bg-sky-600", textColor: "text-sky-400", activeRing: "ring-sky-500", uploadEndpoint: "/api/csv-rows", uploadAccept: ".csv", uploadType: "json" },
    { key: "braintree-usd", label: "Braintree USD", currency: "USD", bgColor: "bg-sky-500", textColor: "text-sky-300", activeRing: "ring-sky-400", uploadEndpoint: "/api/csv-rows", uploadAccept: ".csv", uploadType: "json" },
    { key: "braintree-gbp", label: "Braintree GBP", currency: "GBP", bgColor: "bg-teal-600", textColor: "text-teal-400", activeRing: "ring-teal-500", uploadEndpoint: "/api/csv-rows", uploadAccept: ".csv", uploadType: "json" },
    { key: "braintree-aud", label: "Braintree AUD", currency: "AUD", bgColor: "bg-teal-500", textColor: "text-teal-300", activeRing: "ring-teal-400", uploadEndpoint: "/api/csv-rows", uploadAccept: ".csv", uploadType: "json" },
    { key: "braintree-amex", label: "Braintree AMEX", currency: "EUR", bgColor: "bg-cyan-600", textColor: "text-cyan-400", activeRing: "ring-cyan-500", uploadEndpoint: "/api/csv-rows", uploadAccept: ".csv", uploadType: "json" },
    { key: "paypal", label: "PayPal", currency: "EUR", bgColor: "bg-blue-600", textColor: "text-blue-400", activeRing: "ring-blue-500", uploadEndpoint: "/api/csv-rows", uploadAccept: ".csv", uploadType: "json" },
    { key: "gocardless", label: "GoCardless", currency: "EUR", bgColor: "bg-emerald-600", textColor: "text-emerald-400", activeRing: "ring-emerald-500", uploadEndpoint: "/api/csv-rows", uploadAccept: ".csv", uploadType: "json" },
    { key: "pleo", label: "Pleo", currency: "EUR", bgColor: "bg-pink-600", textColor: "text-pink-400", activeRing: "ring-pink-500", uploadEndpoint: "/api/csv-rows", uploadAccept: ".csv", uploadType: "json" },
];

interface GatewayTransaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    source: string;
    currency: string;
    isReconciled: boolean;
    reconciliationType: string | null;
    custom_data: Record<string, any>;
    customer_name?: string;
    customer_email?: string;
    order_id?: string;
    transaction_id?: string;
    status?: string;
    type?: string;
}

interface DateGroup {
    date: string;
    dateLabel: string;
    rows: GatewayTransaction[];
    totalCredits: number;
    totalDebits: number;
}

// ════════════════════════════════════════════════════════
// Formatters
// ════════════════════════════════════════════════════════

function formatCurrency(value: number, currency: string): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatCompactCurrency(value: number, currency: string): string {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ${currency}`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K ${currency}`;
    return formatCurrency(value, currency);
}

// ════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════

export default function PaymentChannelsPage() {
    // ─── State ───
    const [selectedGateways, setSelectedGateways] = useState<Set<string>>(new Set(GATEWAYS.map(g => g.key)));
    const [transactions, setTransactions] = useState<GatewayTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState<string | null>(null);

    // Filters
    const [dateRange, setDateRange] = useState({ start: "2025-01-01", end: "2025-12-31" });
    const [pendingDateRange, setPendingDateRange] = useState({ start: "2025-01-01", end: "2025-12-31" });
    const [searchQuery, setSearchQuery] = useState("");
    const [reconFilter, setReconFilter] = useState("all");
    const [flowFilter, setFlowFilter] = useState("all");
    const [showReconciled, setShowReconciled] = useState(true);

    // KPI filter
    const [kpiFilter, setKpiFilter] = useState<string | null>(null);

    // Expanded date groups
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const { toast } = useToast();

    // ─── Gateway toggle (same pattern as bank-statements) ───
    const toggleGateway = useCallback((key: string) => {
        setSelectedGateways(prev => {
            const next = new Set(prev);
            if (next.has(key)) { if (next.size > 1) next.delete(key); }
            else next.add(key);
            return next;
        });
    }, []);

    const selectSingleGateway = useCallback((key: string) => {
        setSelectedGateways(new Set([key]));
    }, []);

    // ─── Load data ───
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const allSources = GATEWAYS.map(g => g.key);
            const allRows: any[] = [];
            const PAGE = 1000;
            let from = 0;
            while (true) {
                const { data: chunk, error: chunkErr } = await supabase
                    .from("csv_rows")
                    .select("id, date, description, amount, source, reconciled, custom_data")
                    .in("source", allSources)
                    .gte("date", dateRange.start)
                    .lte("date", dateRange.end)
                    .order("date", { ascending: false })
                    .range(from, from + PAGE - 1);
                if (chunkErr) throw chunkErr;
                if (!chunk || chunk.length === 0) break;
                allRows.push(...chunk);
                if (chunk.length < PAGE) break;
                from += PAGE;
            }

            const txns: GatewayTransaction[] = allRows.map(row => {
                const cd = row.custom_data || {};
                const source = row.source || "";
                const gwConfig = GATEWAYS.find(g => g.key === source);
                return {
                    id: row.id,
                    date: row.date || "",
                    description: row.description || "",
                    amount: parseFloat(row.amount) || 0,
                    source,
                    currency: gwConfig?.currency || "EUR",
                    isReconciled: !!row.reconciled,
                    reconciliationType: cd.reconciliationType || (row.reconciled ? "automatic" : null),
                    custom_data: cd,
                    customer_name: cd.customer_name || cd.customerName || null,
                    customer_email: cd.customer_email || cd.customerEmail || null,
                    order_id: cd.order_id || cd.orderId || null,
                    transaction_id: cd.transaction_id || cd.transactionId || null,
                    status: cd.status || null,
                    type: cd.type || null,
                };
            });

            setTransactions(txns);

            // Expand all date groups
            const allDates = new Set<string>();
            txns.forEach(t => { if (t.date) allDates.add(t.date.split("T")[0]); });
            setExpandedGroups(allDates);
        } catch (err) {
            console.error("Error loading payment channels data:", err);
            setError(err instanceof Error ? err.message : "Error loading data");
        } finally {
            setIsLoading(false);
        }
    }, [dateRange]);

    useEffect(() => { loadData(); }, [loadData]);

    // ─── Filtered transactions ───
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            if (!selectedGateways.has(t.source)) return false;
            if (!showReconciled && t.isReconciled) return false;
            if (kpiFilter === "inflows" && t.amount <= 0) return false;
            if (kpiFilter === "outflows" && t.amount >= 0) return false;
            if (kpiFilter === "reconciled" && !t.isReconciled) return false;
            if (kpiFilter === "pending" && t.isReconciled) return false;
            if (reconFilter === "reconciled" && !t.isReconciled) return false;
            if (reconFilter === "pending" && t.isReconciled) return false;
            if (flowFilter === "inflows" && t.amount <= 0) return false;
            if (flowFilter === "outflows" && t.amount >= 0) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchesSearch =
                    t.description?.toLowerCase().includes(q) ||
                    t.customer_name?.toLowerCase().includes(q) ||
                    t.customer_email?.toLowerCase().includes(q) ||
                    t.order_id?.toLowerCase().includes(q) ||
                    t.transaction_id?.toLowerCase().includes(q) ||
                    t.source?.toLowerCase().includes(q);
                if (!matchesSearch) return false;
            }
            return true;
        });
    }, [transactions, selectedGateways, showReconciled, kpiFilter, reconFilter, flowFilter, searchQuery]);

    // ─── Date groups ───
    const dateGroups: DateGroup[] = useMemo(() => {
        const map = new Map<string, GatewayTransaction[]>();
        filteredTransactions.forEach(t => {
            const d = t.date?.split("T")[0] || "unknown";
            if (!map.has(d)) map.set(d, []);
            map.get(d)!.push(t);
        });
        return Array.from(map.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, rows]) => ({
                date,
                dateLabel: new Date(date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
                rows,
                totalCredits: rows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0),
                totalDebits: rows.filter(r => r.amount < 0).reduce((s, r) => s + r.amount, 0),
            }));
    }, [filteredTransactions]);

    // ─── Summary KPIs ───
    const summary = useMemo(() => {
        const visible = filteredTransactions;
        const totalInflow = visible.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const totalOutflow = visible.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
        const reconciledCount = visible.filter(t => t.isReconciled).length;
        const unreconciledCount = visible.filter(t => !t.isReconciled).length;
        const reconciledPct = visible.length > 0 ? Math.round((reconciledCount / visible.length) * 100) : 0;
        const reconciledAmount = visible.filter(t => t.isReconciled).reduce((s, t) => s + Math.abs(t.amount), 0);

        // Per-gateway stats
        const byGateway: Record<string, { count: number; total: number }> = {};
        transactions.forEach(t => {
            if (!byGateway[t.source]) byGateway[t.source] = { count: 0, total: 0 };
            byGateway[t.source].count++;
            byGateway[t.source].total += t.amount;
        });

        return { totalInflow, totalOutflow, netCashFlow: totalInflow + totalOutflow, reconciledCount, unreconciledCount, reconciledPct, reconciledAmount, total: visible.length, byGateway };
    }, [filteredTransactions, transactions]);

    // Dominant currency
    const dominantCurrency = useMemo(() => {
        const selected = GATEWAYS.filter(g => selectedGateways.has(g.key));
        const currencies = [...new Set(selected.map(g => g.currency))];
        return currencies.length === 1 ? currencies[0] : "EUR";
    }, [selectedGateways]);

    // ─── Upload handler ───
    const handleUpload = async (gatewayKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(gatewayKey);
        const gw = GATEWAYS.find(g => g.key === gatewayKey);
        if (!gw) return;
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("source", gatewayKey);
            const res = await fetch(gw.uploadEndpoint, { method: "POST", body: formData });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Upload failed");
            toast({ title: "Upload successful", description: `${json.count || 0} rows imported for ${gw.label}` });
            loadData();
        } catch (err) {
            toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
        } finally {
            setIsUploading(null);
            e.target.value = "";
        }
    };

    // ─── Export CSV ───
    const exportCSV = () => {
        const headers = ["Date", "Source", "Description", "Amount", "Currency", "Customer", "Order ID", "Reconciled"];
        const csvRows = [headers.join(",")];
        filteredTransactions.forEach(t => {
            csvRows.push([
                t.date?.split("T")[0] || "",
                t.source,
                `"${(t.description || "").replace(/"/g, '""')}"`,
                t.amount.toFixed(2),
                t.currency,
                `"${(t.customer_name || "").replace(/"/g, '""')}"`,
                t.order_id || "",
                t.isReconciled ? "Yes" : "No",
            ].join(","));
        });
        const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payment-channels-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ─── Render helpers ───
    const getGatewayBadge = (source: string) => {
        const gw = GATEWAYS.find(g => g.key === source);
        if (!gw) return <Badge variant="outline" className="text-xs">{source}</Badge>;
        return (
            <Badge className={`${gw.bgColor} text-white text-xs border-0`}>
                {gw.label}
            </Badge>
        );
    };

    const toggleGroup = (date: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date); else next.add(date);
            return next;
        });
    };

    // ════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black text-gray-900 dark:text-white">
            {/* ─── Header ─── */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-white dark:bg-black">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-indigo-500" />
                            Payment Channels
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Unified view of all payment gateways — {summary.total.toLocaleString()} transactions
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Date range */}
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <Input type="date" value={pendingDateRange.start} onChange={e => setPendingDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-36 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm" />
                            <span className="text-gray-500">→</span>
                            <Input type="date" value={pendingDateRange.end} onChange={e => setPendingDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-36 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm" />
                            <Button size="sm" variant="outline" onClick={() => setDateRange(pendingDateRange)} className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]">
                                Apply
                            </Button>
                        </div>
                        <Button size="sm" variant="outline" onClick={loadData} className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={exportCSV} className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]">
                            <Download className="h-4 w-4 mr-1" /> Export
                        </Button>
                    </div>
                </div>
                {/* Search & filter bar */}
                <div className="flex items-center gap-3 mt-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <Input placeholder="Search name, email, order, txn..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 w-64 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-500" />
                    </div>
                    <Select value={flowFilter} onValueChange={setFlowFilter}>
                        <SelectTrigger className="w-32 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                            <SelectValue placeholder="Flow" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Flows</SelectItem>
                            <SelectItem value="inflows">Inflows</SelectItem>
                            <SelectItem value="outflows">Outflows</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={reconFilter} onValueChange={setReconFilter}>
                        <SelectTrigger className="w-36 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                            <SelectValue placeholder="Reconciliation" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="reconciled">Reconciled</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => setShowReconciled(!showReconciled)} className={`bg-transparent border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-[#111111] ${showReconciled ? "text-gray-900 dark:text-white" : "text-green-400"}`}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        {showReconciled ? "Hide Recon." : "Show Recon."}
                    </Button>
                </div>
            </div>

            {/* ─── Gateway Toggle Tabs ─── */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-3 bg-gray-100 dark:bg-[#0a0a0a]">
                {/* Hidden file inputs for each gateway upload */}
                {GATEWAYS.map(gw => (
                    <input key={`upload-${gw.key}`} type="file" accept={gw.uploadAccept} onChange={e => handleUpload(gw.key, e)} className="hidden" id={`file-upload-${gw.key}`} />
                ))}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Channels:</span>
                    {GATEWAYS.map(gw => {
                        const isActive = selectedGateways.has(gw.key);
                        const stats = summary.byGateway[gw.key];
                        const uploading = isUploading === gw.key;
                        return (
                            <div key={gw.key} className="relative">
                                <button
                                    onClick={() => toggleGateway(gw.key)}
                                    onDoubleClick={() => selectSingleGateway(gw.key)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm ${isActive
                                            ? gw.bgColor + " text-white border-transparent"
                                            : "bg-transparent border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-500"
                                        } ${!stats?.count ? "opacity-40" : ""}`}
                                    title="Double-click to select only this one"
                                >
                                    <CreditCard className="h-3.5 w-3.5" />
                                    <span className="font-medium">{gw.label}</span>
                                    {stats?.count ? (
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-gray-100 dark:bg-[#0a0a0a]"}`}>
                                            {stats.count}
                                        </span>
                                    ) : null}
                                </button>
                                {/* Upload icon overlay */}
                                <label
                                    htmlFor={`file-upload-${gw.key}`}
                                    className="absolute -top-1.5 -right-1.5 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-full p-0.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#111111] hover:border-gray-400 transition-all"
                                    title={`Upload ${gw.uploadAccept} for ${gw.label}`}
                                    onClick={e => e.stopPropagation()}
                                >
                                    {uploading ? <Loader2 className="h-3 w-3 text-gray-500 dark:text-gray-400 animate-spin" /> : <Upload className="h-3 w-3 text-gray-500 dark:text-gray-400" />}
                                </label>
                            </div>
                        );
                    })}
                    <button onClick={() => setSelectedGateways(new Set(GATEWAYS.map(g => g.key)))} className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white ml-auto">
                        All
                    </button>
                </div>
            </div>

            {/* ─── KPI Stats Bar ─── */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-3 bg-white dark:bg-black">
                {kpiFilter && (
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Filtering by: <span className="text-gray-900 dark:text-white font-medium capitalize">{kpiFilter}</span></span>
                        <button onClick={() => setKpiFilter(null)} className="text-xs text-red-400 hover:text-red-300 ml-2">✕ Clear</button>
                    </div>
                )}
                <div className="grid grid-cols-6 gap-4">
                    <button onClick={() => setKpiFilter(kpiFilter === "inflows" ? null : "inflows")} className={`flex items-center gap-2 min-w-0 rounded-lg px-2 py-1 transition-all ${kpiFilter === "inflows" ? "bg-green-900/30 ring-1 ring-green-600" : "hover:bg-gray-100 dark:hover:bg-[#0a0a0a]"}`}>
                        <ArrowDownCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <div className="min-w-0 text-left">
                            <p className="text-[10px] text-gray-500 uppercase">Inflows</p>
                            <p className="text-sm font-bold text-green-400 truncate" title={formatCurrency(summary.totalInflow, dominantCurrency)}>
                                {formatCompactCurrency(summary.totalInflow, dominantCurrency)}
                            </p>
                        </div>
                    </button>
                    <button onClick={() => setKpiFilter(kpiFilter === "outflows" ? null : "outflows")} className={`flex items-center gap-2 min-w-0 rounded-lg px-2 py-1 transition-all ${kpiFilter === "outflows" ? "bg-red-900/30 ring-1 ring-red-600" : "hover:bg-gray-100 dark:hover:bg-[#0a0a0a]"}`}>
                        <ArrowUpCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        <div className="min-w-0 text-left">
                            <p className="text-[10px] text-gray-500 uppercase">Outflows</p>
                            <p className="text-sm font-bold text-red-400 truncate" title={formatCurrency(summary.totalOutflow, dominantCurrency)}>
                                {formatCompactCurrency(summary.totalOutflow, dominantCurrency)}
                            </p>
                        </div>
                    </button>
                    <div className="flex items-center gap-2 min-w-0 px-2 py-1">
                        <DollarSign className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[10px] text-gray-500 uppercase">Net</p>
                            <p className={`text-sm font-bold truncate ${summary.netCashFlow >= 0 ? "text-green-400" : "text-red-400"}`} title={formatCurrency(summary.netCashFlow, dominantCurrency)}>
                                {formatCompactCurrency(summary.netCashFlow, dominantCurrency)}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setKpiFilter(kpiFilter === "reconciled" ? null : "reconciled")} className={`flex items-center gap-2 min-w-0 rounded-lg px-2 py-1 transition-all ${kpiFilter === "reconciled" ? "bg-emerald-900/30 ring-1 ring-emerald-600" : "hover:bg-gray-100 dark:hover:bg-[#0a0a0a]"}`}>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <div className="min-w-0 text-left">
                            <p className="text-[10px] text-gray-500 uppercase">Reconciled</p>
                            <p className="text-sm font-bold text-emerald-400">{summary.reconciledCount} <span className="text-xs text-gray-500">({summary.reconciledPct}%)</span></p>
                        </div>
                    </button>
                    <button onClick={() => setKpiFilter(kpiFilter === "pending" ? null : "pending")} className={`flex items-center gap-2 min-w-0 rounded-lg px-2 py-1 transition-all ${kpiFilter === "pending" ? "bg-amber-900/30 ring-1 ring-amber-600" : "hover:bg-gray-100 dark:hover:bg-[#0a0a0a]"}`}>
                        <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        <div className="min-w-0 text-left">
                            <p className="text-[10px] text-gray-500 uppercase">Pending</p>
                            <p className="text-sm font-bold text-amber-400">{summary.unreconciledCount}</p>
                        </div>
                    </button>
                    <div className="flex items-center gap-2 min-w-0 px-2 py-1">
                        <CreditCard className="h-4 w-4 text-violet-500 flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[10px] text-gray-500 uppercase">Recon. Value</p>
                            <p className="text-sm font-bold text-violet-400 truncate" title={formatCurrency(summary.reconciledAmount, dominantCurrency)}>
                                {formatCompactCurrency(summary.reconciledAmount, dominantCurrency)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Main Content ─── */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                        <span className="ml-3 text-gray-500">Loading payment channels data...</span>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center py-20">
                        <AlertCircle className="h-6 w-6 text-red-500 mr-2" />
                        <span className="text-red-400">{error}</span>
                        <Button variant="outline" size="sm" className="ml-4" onClick={loadData}>Retry</Button>
                    </div>
                ) : filteredTransactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                        <CreditCard className="h-12 w-12 mb-4 opacity-40" />
                        <p>No transactions found for selected gateways and filters.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {dateGroups.map(group => {
                            const isExpanded = expandedGroups.has(group.date);
                            return (
                                <div key={group.date} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                    {/* Date group header */}
                                    <button
                                        onClick={() => toggleGroup(group.date)}
                                        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-[#0a0a0a] hover:bg-gray-100 dark:hover:bg-[#111111] transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">{group.dateLabel}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{group.rows.length} txns</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs">
                                            {group.totalCredits > 0 && <span className="text-green-500">+{formatCurrency(group.totalCredits, dominantCurrency)}</span>}
                                            {group.totalDebits < 0 && <span className="text-red-500">{formatCurrency(group.totalDebits, dominantCurrency)}</span>}
                                        </div>
                                    </button>
                                    {/* Transaction rows */}
                                    {isExpanded && (
                                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {group.rows.map(txn => (
                                                <div key={txn.id} className="flex items-center gap-4 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#0a0a0a] transition-colors text-sm">
                                                    {/* Gateway badge */}
                                                    <div className="w-32 flex-shrink-0">
                                                        {getGatewayBadge(txn.source)}
                                                    </div>
                                                    {/* Description */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-gray-900 dark:text-white truncate">{txn.description || "—"}</p>
                                                        {(txn.customer_name || txn.order_id) && (
                                                            <p className="text-xs text-gray-500 truncate">
                                                                {txn.customer_name && <span>{txn.customer_name}</span>}
                                                                {txn.customer_name && txn.order_id && <span className="mx-1">·</span>}
                                                                {txn.order_id && <span className="text-indigo-400">#{txn.order_id}</span>}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {/* Amount */}
                                                    <div className={`w-28 text-right font-mono font-medium ${txn.amount >= 0 ? "text-green-500" : "text-red-500"}`}>
                                                        {txn.amount >= 0 ? "+" : ""}{formatCurrency(txn.amount, txn.currency)}
                                                    </div>
                                                    {/* Reconciled */}
                                                    <div className="w-20 flex justify-center">
                                                        {txn.isReconciled ? (
                                                            <Badge className="bg-emerald-900/30 text-emerald-400 text-xs border border-emerald-700/50">Matched</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-amber-400 text-xs border-amber-700/50">Pending</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
