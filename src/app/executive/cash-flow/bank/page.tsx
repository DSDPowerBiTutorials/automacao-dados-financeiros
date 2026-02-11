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
    Building,
    AlertCircle,
    CheckCircle,
    Zap,
    X,
    FileText,
    User,
    ChevronDown,
    ChevronRight,
    Database,
    Key,
    Filter,
    Clock,
    TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

// ════════════════════════════════════════════════════════
// Types & Constants
// ════════════════════════════════════════════════════════

interface BankAccountConfig {
    key: string;
    label: string;
    currency: string;
    bgColor: string;
    textColor: string;
    activeRing: string;
}

const BANK_ACCOUNTS: BankAccountConfig[] = [
    { key: "bankinter-eur", label: "Bankinter EUR", currency: "EUR", bgColor: "bg-blue-600", textColor: "text-blue-400", activeRing: "ring-blue-500" },
    { key: "bankinter-usd", label: "Bankinter USD", currency: "USD", bgColor: "bg-emerald-600", textColor: "text-emerald-400", activeRing: "ring-emerald-500" },
    { key: "sabadell", label: "Sabadell EUR", currency: "EUR", bgColor: "bg-orange-600", textColor: "text-orange-400", activeRing: "ring-orange-500" },
    { key: "chase-usd", label: "Chase 9186", currency: "USD", bgColor: "bg-purple-600", textColor: "text-purple-400", activeRing: "ring-purple-500" },
];

interface BankTransaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    source: string;
    currency: string;
    gateway: string | null;
    paymentSource: string | null;
    matchType: string | null;
    isReconciled: boolean;
    reconciliationType: string | null;
    custom_data: Record<string, any>;
}

interface ReconcileResult {
    bankSource: string;
    success: boolean;
    matched: number;
    unmatched: number;
    total: number;
    error?: string;
}

interface DateGroup {
    date: string;
    dateLabel: string;
    rows: BankTransaction[];
    totalCredits: number;
    totalDebits: number;
}

// ════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════

function detectGateway(description: string): string | null {
    const desc = description.toLowerCase();
    if (desc.includes("braintree") || desc.includes("paypal braintree")) return "braintree";
    if (desc.includes("stripe")) return "stripe";
    if (desc.includes("gocardless") || desc.includes("go cardless")) return "gocardless";
    if (desc.includes("paypal") && !desc.includes("braintree")) return "paypal";
    if (desc.includes("american express") || desc.includes("amex")) return "amex";
    if (desc.includes("adyen")) return "adyen";
    if (desc.includes("wise") || desc.includes("transferwise")) return "wise";
    if (desc.includes("gusto")) return "gusto";
    if (desc.includes("continental")) return "continental";
    if (desc.includes("intuit") || desc.includes("quickbooks") || desc.includes("qbooks")) return "quickbooks";
    return null;
}

const formatCurrency = (value: number, currency = "EUR") =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const formatCompactCurrency = (value: number, currency = "EUR") => {
    const sym = currency === "USD" ? "$" : "€";
    if (Math.abs(value) >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${sym}${(value / 1_000).toFixed(0)}k`;
    return `${sym}${value.toFixed(0)}`;
};

const formatShortDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "-";
    const parts = dateString.split("-");
    if (parts.length !== 3) return dateString;
    const [year, month, day] = parts.map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

const formatDateHeader = (dateStr: string): string => {
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts.map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
};

const gatewayColors: Record<string, { bg: string; text: string; border: string }> = {
    braintree: { bg: "bg-blue-900/30", text: "text-blue-400", border: "border-blue-700" },
    stripe: { bg: "bg-indigo-900/30", text: "text-indigo-400", border: "border-indigo-700" },
    gocardless: { bg: "bg-yellow-900/30", text: "text-yellow-400", border: "border-yellow-700" },
    paypal: { bg: "bg-cyan-900/30", text: "text-cyan-400", border: "border-cyan-700" },
    amex: { bg: "bg-purple-900/30", text: "text-purple-400", border: "border-purple-700" },
    gusto: { bg: "bg-red-900/30", text: "text-red-400", border: "border-red-700" },
    quickbooks: { bg: "bg-emerald-900/30", text: "text-emerald-400", border: "border-emerald-700" },
    continental: { bg: "bg-orange-900/30", text: "text-orange-400", border: "border-orange-700" },
    wise: { bg: "bg-teal-900/30", text: "text-teal-400", border: "border-teal-700" },
};

const getGatewayStyle = (gw: string | null) => gatewayColors[gw?.toLowerCase() || ""] || { bg: "bg-gray-800/50", text: "text-gray-400", border: "border-gray-700" };

/** Parse Chase ACH descriptions — extract ORIG CO NAME value for short display */
function parseChaseShortDescription(description: string, source: string): string {
    if (source !== "chase-usd") return description;
    // ACH: Match ORIG CO NAME:VALUE pattern
    const origMatch = description.match(/ORIG CO NAME:([^\s]+(?:\s+[^\s:]+)*?)(?:\s+ORIG ID:|$)/i)
        || description.match(/ORIG CO NAME:([^\s]+)/i);
    if (origMatch && origMatch[1]) return origMatch[1].trim();
    // ACH fallback: CO ENTRY DESCR
    const descrMatch = description.match(/CO ENTRY DESCR:([^\s]+(?:\s+[^\s:]+)*?)(?:\s+SEC:|$)/i);
    if (descrMatch && descrMatch[1]) return descrMatch[1].trim();
    // WIRE TRANSFER: extract A/C: value (stop at postal code or REF:)
    const acMatch = description.match(/A\/C:\s*(.+?)(?:\s+[A-Z]{1,2}\d{1,2}[A-Z0-9]*\s|\s+REF:|$)/i);
    if (acMatch && acMatch[1]) {
        return acMatch[1].trim().replace(/\s+/g, " ").split(" ").map(w =>
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(" ");
    }
    // CHIPS CREDIT: extract B/O: value (format: B/O: 1/NAME. 3/...)
    const boMatch = description.match(/B\/O:\s*(?:\d+\/)?(.+?)(?:\.\s*\d+\/|\s+\d+\/|$)/i);
    if (boMatch && boMatch[1]) {
        return boMatch[1].trim().replace(/\s+/g, " ").split(" ").map(w =>
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(" ");
    }
    return description;
}

// ════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════

export default function BankCashFlowPage() {
    const [selectedBanks, setSelectedBanks] = useState<Set<string>>(new Set(["bankinter-eur"]));
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Detail panel
    const [selectedRow, setSelectedRow] = useState<BankTransaction | null>(null);

    // Bank freshness metadata
    const [bankFreshness, setBankFreshness] = useState<Record<string, { lastUpload: string | null; lastRecord: string | null }>>({});

    // Filters — committed date range vs pending (to avoid re-fetch on arrow navigation)
    const [dateRange, setDateRange] = useState({ start: "2025-01-01", end: "2025-12-31" });
    const [pendingDateRange, setPendingDateRange] = useState({ start: "2025-01-01", end: "2025-12-31" });
    const [gatewayFilter, setGatewayFilter] = useState("all");
    const [flowFilter, setFlowFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [reconFilter, setReconFilter] = useState("all");
    const [showReconciled, setShowReconciled] = useState(true);

    // Date groups
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const { toast } = useToast();

    // ─── Bank toggle ───
    const toggleBank = useCallback((bankKey: string) => {
        setSelectedBanks(prev => {
            const next = new Set(prev);
            if (next.has(bankKey)) { if (next.size > 1) next.delete(bankKey); }
            else next.add(bankKey);
            return next;
        });
    }, []);

    const selectSingleBank = useCallback((bankKey: string) => {
        setSelectedBanks(new Set([bankKey]));
    }, []);

    // ─── Load data ───
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const allSources = BANK_ACCOUNTS.map(b => b.key);
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

            const transactions: BankTransaction[] = allRows.map(row => {
                const cd = row.custom_data || {};
                const source = row.source || "";
                const paymentSource = cd.paymentSource || null;
                const gateway = paymentSource?.toLowerCase() || detectGateway(row.description || "");

                return {
                    id: row.id,
                    date: row.date || "",
                    description: row.description || "",
                    amount: parseFloat(row.amount) || 0,
                    source,
                    currency: source.includes("usd") ? "USD" : "EUR",
                    gateway,
                    paymentSource,
                    matchType: cd.match_type || null,
                    isReconciled: !!row.reconciled,
                    reconciliationType: cd.reconciliationType || (row.reconciled ? "automatic" : null),
                    custom_data: cd,
                };
            });

            setBankTransactions(transactions);

            // Expand all date groups initially
            const allDates = new Set<string>();
            transactions.forEach(t => { if (t.date) allDates.add(t.date.split("T")[0]); });
            setExpandedGroups(allDates);
        } catch (err) {
            console.error("Error loading data:", err);
            setError(err instanceof Error ? err.message : "Error loading data");
        } finally {
            setIsLoading(false);
        }
    }, [dateRange]);

    useEffect(() => { loadData(); }, [loadData]);

    const applyDateRange = () => {
        setDateRange({ ...pendingDateRange });
    };

    // ─── Load bank freshness data ───
    useEffect(() => {
        const SOURCE_MAP: Record<string, string> = { "sabadell": "sabadell-eur" };
        (async () => {
            try {
                const res = await fetch("/api/data-freshness");
                const data = await res.json();
                if (data.sources) {
                    const map: Record<string, { lastUpload: string | null; lastRecord: string | null }> = {};
                    for (const s of data.sources) {
                        map[s.source] = { lastUpload: s.lastSync, lastRecord: s.lastRecordDate };
                    }
                    // Map aliases
                    for (const [alias, real] of Object.entries(SOURCE_MAP)) {
                        if (map[real] && !map[alias]) map[alias] = map[real];
                    }
                    setBankFreshness(map);
                }
            } catch { /* silent */ }
        })();
    }, [bankTransactions]);

    // ─── Filtered transactions ───
    const filteredTransactions = useMemo(() => {
        return bankTransactions.filter(tx => {
            if (!selectedBanks.has(tx.source)) return false;
            if (!showReconciled && tx.isReconciled) return false;
            if (gatewayFilter !== "all" && (!tx.gateway || tx.gateway !== gatewayFilter)) return false;
            if (flowFilter === "income" && tx.amount <= 0) return false;
            if (flowFilter === "expense" && tx.amount >= 0) return false;
            if (reconFilter === "reconciled" && !tx.isReconciled) return false;
            if (reconFilter === "pending" && tx.isReconciled) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return (
                    tx.description.toLowerCase().includes(q) ||
                    tx.custom_data?.customer_name?.toLowerCase()?.includes(q) ||
                    tx.custom_data?.disbursement_reference?.toLowerCase()?.includes(q) ||
                    tx.source.toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [bankTransactions, selectedBanks, gatewayFilter, flowFilter, reconFilter, searchQuery, showReconciled]);

    // ─── Date groups ───
    const dateGroups = useMemo(() => {
        const map = new Map<string, DateGroup>();
        filteredTransactions.forEach(tx => {
            const key = tx.date?.split("T")[0] || "unknown";
            if (!map.has(key)) {
                map.set(key, { date: key, dateLabel: key === "unknown" ? "Unknown Date" : formatDateHeader(key), rows: [], totalCredits: 0, totalDebits: 0 });
            }
            const g = map.get(key)!;
            g.rows.push(tx);
            if (tx.amount > 0) g.totalCredits += tx.amount;
            else g.totalDebits += Math.abs(tx.amount);
        });
        return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    }, [filteredTransactions]);

    // ─── Summary ───
    const summary = useMemo(() => {
        const inflows = filteredTransactions.filter(t => t.amount > 0);
        const outflows = filteredTransactions.filter(t => t.amount < 0);
        const totalInflow = inflows.reduce((s, t) => s + t.amount, 0);
        const totalOutflow = Math.abs(outflows.reduce((s, t) => s + t.amount, 0));
        const reconciledTx = filteredTransactions.filter(t => t.isReconciled);
        const reconciledCredits = reconciledTx.filter(t => t.amount > 0);
        const reconciledAmount = reconciledCredits.reduce((s, t) => s + t.amount, 0);
        const unreconciledCount = filteredTransactions.filter(t => !t.isReconciled).length;

        const byGateway: Record<string, { amount: number; count: number }> = {};
        inflows.forEach(t => {
            const key = t.paymentSource || t.gateway || "other";
            if (!byGateway[key]) byGateway[key] = { amount: 0, count: 0 };
            byGateway[key].amount += t.amount;
            byGateway[key].count++;
        });

        const byBank: Record<string, { inflows: number; outflows: number; count: number; reconCount: number }> = {};
        bankTransactions.forEach(t => {
            if (!byBank[t.source]) byBank[t.source] = { inflows: 0, outflows: 0, count: 0, reconCount: 0 };
            byBank[t.source].count++;
            if (t.amount > 0) byBank[t.source].inflows += t.amount;
            else byBank[t.source].outflows += Math.abs(t.amount);
            if (t.isReconciled) byBank[t.source].reconCount++;
        });

        return {
            totalInflow, totalOutflow,
            netCashFlow: totalInflow - totalOutflow,
            reconciledAmount,
            reconciledCount: reconciledTx.length,
            reconciledPct: totalInflow > 0 ? Math.round((reconciledAmount / totalInflow) * 100) : 0,
            unreconciledCount,
            transactionCount: filteredTransactions.length,
            byGateway, byBank,
        };
    }, [filteredTransactions, bankTransactions]);

    // ─── Monthly breakdown ───
    const monthlyData = useMemo(() => {
        const map = new Map<string, { month: string; label: string; inflows: number; outflows: number; balance: number; runningBalance: number }>();
        // Build months from filtered transactions
        filteredTransactions.forEach(tx => {
            const key = tx.date?.substring(0, 7) || "unknown";
            if (!map.has(key)) {
                const [y, m] = key.split("-");
                const d = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, 1));
                const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
                map.set(key, { month: key, label, inflows: 0, outflows: 0, balance: 0, runningBalance: 0 });
            }
            const entry = map.get(key)!;
            if (tx.amount > 0) entry.inflows += tx.amount;
            else entry.outflows += Math.abs(tx.amount);
        });
        // Sort chronologically and compute balance + running balance
        const sorted = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
        let running = 0;
        sorted.forEach(m => {
            m.balance = m.inflows - m.outflows;
            running += m.balance;
            m.runningBalance = running;
        });
        return sorted;
    }, [filteredTransactions]);

    const toggleGroup = (date: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date); else next.add(date);
            return next;
        });
    };

    // ─── Export CSV ───
    const exportCSV = () => {
        const headers = ["Bank", "Date", "Description", "Amount", "Currency", "Gateway", "Reconciled"];
        const rows = filteredTransactions.map(t => [
            BANK_ACCOUNTS.find(b => b.key === t.source)?.label || t.source,
            t.date,
            '"' + t.description.replace(/"/g, '""') + '"',
            t.amount.toFixed(2),
            t.currency,
            t.paymentSource || t.gateway || "",
            t.isReconciled ? "Yes" : "No",
        ]);
        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "cashflow-bancario-" + dateRange.start + "-" + dateRange.end + ".csv";
        a.click();
    };

    // ─── Get dominant currency for selected banks ───
    const dominantCurrency = useMemo(() => {
        const currencies = [...selectedBanks].map(k => BANK_ACCOUNTS.find(b => b.key === k)?.currency || "EUR");
        const unique = [...new Set(currencies)];
        return unique.length === 1 ? unique[0] : "EUR";
    }, [selectedBanks]);

    // ════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-[#1e1f21]">
                <RefreshCw className="h-8 w-8 animate-spin text-white" />
            </div>
        );
    }

    const showBankColumn = selectedBanks.size > 1;

    return (
        <div className="h-full flex flex-col bg-[#1e1f21] text-white overflow-hidden">
            {/* Main content area shifts when panel is open */}
            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${selectedRow ? "mr-[450px]" : ""}`}>

                {/* ─── Header ─── */}
                <div className="flex-shrink-0 border-b border-gray-700 px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-[#117ACA] p-2 rounded-lg">
                                <Database className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold">Bank Cash Flow</h1>
                                <span className="text-gray-400 text-sm">
                                    {summary.transactionCount} transactions • {[...selectedBanks].map(b => BANK_ACCOUNTS.find(a => a.key === b)?.label).join(", ")}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-400">Net Balance</p>
                            <p className={`text-2xl font-bold ${summary.netCashFlow >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {formatCurrency(summary.netCashFlow, dominantCurrency)}
                            </p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button onClick={loadData} variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-700">
                                <RefreshCw className="h-4 w-4 mr-1" />Refresh
                            </Button>
                            <Button onClick={exportCSV} variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-700">
                                <Download className="h-4 w-4 mr-1" />CSV
                            </Button>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 w-56 bg-transparent border-gray-600 text-white placeholder:text-gray-500" />
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setShowReconciled(!showReconciled)} className={`bg-transparent border-gray-600 hover:bg-gray-700 ${showReconciled ? "text-white" : "text-green-400"}`}>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                {showReconciled ? "Hide Recon." : "Show Recon."}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ─── Bank Account Tabs ─── */}
                <div className="flex-shrink-0 border-b border-gray-700 px-6 py-3 bg-[#252627]">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Accounts:</span>
                        {BANK_ACCOUNTS.map(bank => {
                            const isActive = selectedBanks.has(bank.key);
                            const stats = summary.byBank[bank.key];
                            const fresh = bankFreshness[bank.key];
                            return (
                                <button key={bank.key} onClick={() => toggleBank(bank.key)} onDoubleClick={() => selectSingleBank(bank.key)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm ${isActive ? bank.bgColor + " text-white border-transparent" : "bg-transparent border-gray-600 text-gray-400 hover:border-gray-500"} ${!stats?.count ? "opacity-40" : ""}`}
                                    title="Double-click to select only this one">
                                    <div className="flex flex-col items-start">
                                        <div className="flex items-center gap-2">
                                            <Building className="h-3.5 w-3.5" />
                                            <span className="font-medium">{bank.label}</span>
                                            {stats?.count ? <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-gray-700"}`}>{stats.count}</span> : null}
                                        </div>
                                        {fresh && (
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Clock className="h-2.5 w-2.5 text-gray-500" />
                                                <span className="text-[9px] text-gray-500">
                                                    {fresh.lastUpload ? `Upload: ${new Date(fresh.lastUpload).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "No upload"}
                                                    {fresh.lastRecord ? ` · Data: ${new Date(fresh.lastRecord + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                        <button onClick={() => setSelectedBanks(new Set(BANK_ACCOUNTS.map(b => b.key)))} className="text-xs text-gray-500 hover:text-white ml-auto">
                            All
                        </button>
                    </div>
                </div>

                {/* ─── Stats Bar (KPI inline) ─── */}
                <div className="flex-shrink-0 border-b border-gray-700 px-6 py-3 bg-[#1e1f21]">
                    <div className="grid grid-cols-6 gap-4">
                        <div className="flex items-center gap-2 min-w-0">
                            <ArrowDownCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-gray-500 uppercase">Inflows</p>
                                <p className="text-sm font-bold text-green-400 truncate" title={formatCurrency(summary.totalInflow, dominantCurrency)}>
                                    {formatCompactCurrency(summary.totalInflow, dominantCurrency)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                            <ArrowUpCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-gray-500 uppercase">Outflows</p>
                                <p className="text-sm font-bold text-red-400 truncate" title={formatCurrency(summary.totalOutflow, dominantCurrency)}>
                                    {formatCompactCurrency(summary.totalOutflow, dominantCurrency)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                            <DollarSign className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-gray-500 uppercase">Balance</p>
                                <p className={`text-sm font-bold truncate ${summary.netCashFlow >= 0 ? "text-green-400" : "text-red-400"}`} title={formatCurrency(summary.netCashFlow, dominantCurrency)}>
                                    {formatCompactCurrency(summary.netCashFlow, dominantCurrency)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-gray-500 uppercase">Reconciled</p>
                                <p className="text-sm font-bold text-emerald-400">{summary.reconciledCount} <span className="text-xs text-gray-500">({summary.reconciledPct}%)</span></p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-gray-500 uppercase">Pending</p>
                                <p className="text-sm font-bold text-amber-400">{summary.unreconciledCount}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                            <CreditCard className="h-4 w-4 text-violet-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-gray-500 uppercase">Reconciled Value</p>
                                <p className="text-sm font-bold text-violet-400 truncate" title={formatCurrency(summary.reconciledAmount, dominantCurrency)}>
                                    {formatCompactCurrency(summary.reconciledAmount, dominantCurrency)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Monthly Highlights + Chart ─── */}
                {monthlyData.length > 0 && (
                    <div className="flex-shrink-0 border-b border-gray-700 px-6 py-4 bg-[#1e1f21]">
                        {/* Monthly cards */}
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="h-4 w-4 text-gray-500" />
                            <span className="text-xs text-gray-500 uppercase tracking-wider">Monthly Overview</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                            {monthlyData.map(m => (
                                <div key={m.month} className="flex-shrink-0 bg-[#252627] rounded-lg border border-gray-700 px-3 py-2 min-w-[130px]">
                                    <p className="text-[10px] text-gray-500 uppercase font-medium mb-1">{m.label}</p>
                                    <div className="space-y-0.5">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-gray-500">In</span>
                                            <span className="text-green-400 font-medium">{formatCompactCurrency(m.inflows, dominantCurrency)}</span>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-gray-500">Out</span>
                                            <span className="text-red-400 font-medium">{formatCompactCurrency(m.outflows, dominantCurrency)}</span>
                                        </div>
                                        <div className="flex justify-between text-[10px] border-t border-gray-700 pt-0.5">
                                            <span className="text-gray-500">Net</span>
                                            <span className={`font-bold ${m.balance >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCompactCurrency(m.balance, dominantCurrency)}</span>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-gray-500">Bal</span>
                                            <span className={`font-medium ${m.runningBalance >= 0 ? "text-blue-400" : "text-orange-400"}`}>{formatCompactCurrency(m.runningBalance, dominantCurrency)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Line chart */}
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis dataKey="label" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#4B5563" }} />
                                    <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#4B5563" }} tickFormatter={(v: number) => formatCompactCurrency(v, dominantCurrency)} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#1e1f21", border: "1px solid #374151", borderRadius: "8px", fontSize: 12 }}
                                        labelStyle={{ color: "#9CA3AF" }}
                                        formatter={(value: number, name: string) => [formatCurrency(value, dominantCurrency), name]}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
                                    <Line type="monotone" dataKey="inflows" name="Inflows" stroke="#4ade80" strokeWidth={2} dot={{ fill: "#4ade80", r: 3 }} />
                                    <Line type="monotone" dataKey="outflows" name="Outflows" stroke="#f87171" strokeWidth={2} dot={{ fill: "#f87171", r: 3 }} />
                                    <Line type="monotone" dataKey="balance" name="Net" stroke="#60a5fa" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: "#60a5fa", r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* ─── Filters ─── */}
                <div className="flex-shrink-0 border-b border-gray-700 px-6 py-2 bg-[#252627]">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Filter className="h-3.5 w-3.5 text-gray-500" />
                        <Input type="date" value={pendingDateRange.start} onChange={e => setPendingDateRange(p => ({ ...p, start: e.target.value }))} className="w-36 h-8 bg-transparent border-gray-600 text-white text-xs" />
                        <span className="text-gray-600">→</span>
                        <Input type="date" value={pendingDateRange.end} onChange={e => setPendingDateRange(p => ({ ...p, end: e.target.value }))} className="w-36 h-8 bg-transparent border-gray-600 text-white text-xs" />
                        <Button onClick={applyDateRange} variant="outline" size="sm" className="h-8 bg-transparent border-gray-600 text-white hover:bg-gray-700 text-xs">
                            Apply
                        </Button>
                        <Select value={gatewayFilter} onValueChange={setGatewayFilter}>
                            <SelectTrigger className="w-28 h-8 bg-transparent border-gray-600 text-white text-xs"><SelectValue placeholder="Gateway" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">Gateways</SelectItem><SelectItem value="braintree">Braintree</SelectItem><SelectItem value="stripe">Stripe</SelectItem><SelectItem value="gocardless">GoCardless</SelectItem><SelectItem value="paypal">PayPal</SelectItem><SelectItem value="gusto">Gusto</SelectItem><SelectItem value="quickbooks">QuickBooks</SelectItem></SelectContent>
                        </Select>
                        <Select value={flowFilter} onValueChange={setFlowFilter}>
                            <SelectTrigger className="w-28 h-8 bg-transparent border-gray-600 text-white text-xs"><SelectValue placeholder="Flow" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="income">Inflows</SelectItem><SelectItem value="expense">Outflows</SelectItem></SelectContent>
                        </Select>
                        <Select value={reconFilter} onValueChange={setReconFilter}>
                            <SelectTrigger className="w-32 h-8 bg-transparent border-gray-600 text-white text-xs"><SelectValue placeholder="Reconciliation" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="reconciled">Reconciled</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent>
                        </Select>
                    </div>
                </div>

                {/* ─── Table Header ─── */}
                <div className="flex-shrink-0 sticky top-0 z-10 bg-[#2a2b2d] border-b border-gray-700 overflow-x-auto">
                    <div className="flex items-center gap-1 px-4 py-2 text-[10px] text-gray-400 font-medium uppercase min-w-[900px]">
                        <div className="w-[60px] flex-shrink-0">Date</div>
                        {showBankColumn && <div className="w-[90px] flex-shrink-0">Bank</div>}
                        <div className="flex-1 min-w-[200px]">Description</div>
                        <div className="w-[80px] flex-shrink-0 text-right">Debit</div>
                        <div className="w-[80px] flex-shrink-0 text-right">Credit</div>
                        <div className="w-[80px] flex-shrink-0 text-center">Gateway</div>
                        <div className="w-[60px] flex-shrink-0 text-center">Status</div>
                    </div>
                </div>

                {/* ─── Content (date-grouped rows) ─── */}
                <div className="flex-1 overflow-y-auto overflow-x-auto">
                    {dateGroups.map(group => (
                        <div key={group.date} className="border-b border-gray-800">
                            {/* Date group header */}
                            <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-800/50 cursor-pointer" onClick={() => toggleGroup(group.date)}>
                                {expandedGroups.has(group.date) ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                                <span className="font-medium text-white text-sm">{group.dateLabel}</span>
                                <span className="text-gray-500 text-xs ml-auto">
                                    {group.rows.length} txns <span className="mx-1">|</span>
                                    <span className="text-green-400">+{formatCurrency(group.totalCredits, dominantCurrency)}</span>
                                    <span className="mx-1">/</span>
                                    <span className="text-red-400">-{formatCurrency(group.totalDebits, dominantCurrency)}</span>
                                </span>
                            </div>

                            {/* Rows */}
                            {expandedGroups.has(group.date) && group.rows.map(tx => {
                                const bankInfo = BANK_ACCOUNTS.find(b => b.key === tx.source);
                                const gwStyle = getGatewayStyle(tx.paymentSource || tx.gateway);
                                const isDebit = tx.amount < 0;
                                const isCredit = tx.amount > 0;

                                return (
                                    <div key={tx.id}
                                        className={`flex items-center gap-1 px-4 py-2 hover:bg-gray-800/30 border-t border-gray-800/50 cursor-pointer min-w-[900px] ${selectedRow?.id === tx.id ? "bg-gray-700/50" : ""}`}
                                        onClick={() => setSelectedRow(tx)}>
                                        <div className="w-[60px] flex-shrink-0 text-[10px] text-gray-300">{formatShortDate(tx.date)}</div>
                                        {showBankColumn && (
                                            <div className="w-[90px] flex-shrink-0">
                                                <Badge variant="outline" className={`text-[8px] px-1 py-0 ${bankInfo?.textColor || "text-gray-400"} border-gray-600`}>{bankInfo?.label || tx.source}</Badge>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-[200px] text-[11px] text-white truncate" title={tx.description}>{parseChaseShortDescription(tx.description, tx.source)}</div>
                                        <div className="w-[80px] flex-shrink-0 text-right text-[10px] font-mono">
                                            {isDebit ? <span className="text-red-400">{formatCurrency(Math.abs(tx.amount), tx.currency)}</span> : <span className="text-gray-600">-</span>}
                                        </div>
                                        <div className="w-[80px] flex-shrink-0 text-right text-[10px] font-mono">
                                            {isCredit ? <span className="text-green-400">{formatCurrency(tx.amount, tx.currency)}</span> : <span className="text-gray-600">-</span>}
                                        </div>
                                        <div className="w-[80px] flex-shrink-0 text-center">
                                            {(tx.paymentSource || tx.gateway) ? (
                                                <Badge variant="outline" className={`text-[8px] px-1 py-0 ${gwStyle.bg} ${gwStyle.text} ${gwStyle.border}`}>
                                                    {(tx.paymentSource || tx.gateway || "").charAt(0).toUpperCase() + (tx.paymentSource || tx.gateway || "").slice(1)}
                                                </Badge>
                                            ) : <span className="text-gray-600 text-[9px]">-</span>}
                                        </div>
                                        <div className="w-[60px] flex-shrink-0 text-center">
                                            {tx.isReconciled ? (
                                                tx.reconciliationType === "manual" ? <User className="h-3.5 w-3.5 text-blue-500 mx-auto" /> : <Zap className="h-3.5 w-3.5 text-green-500 mx-auto" />
                                            ) : (
                                                <AlertCircle className="h-3.5 w-3.5 text-yellow-500 mx-auto" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    {dateGroups.length === 0 && (
                        <div className="text-center py-20 text-gray-500">
                            <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No transactions found</p>
                            <p className="text-sm mt-1">Adjust filters or select other accounts</p>
                        </div>
                    )}
                    <div className="h-8"></div>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════ */}
            {/* DETAIL PANEL (right side) */}
            {/* ════════════════════════════════════════════════════════ */}
            {selectedRow && (
                <div className="fixed right-0 top-0 h-full w-[450px] bg-[#1e1f21] border-l border-gray-700 flex flex-col z-[100] shadow-2xl">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                        <div className="flex items-center gap-2 min-w-0">
                            {selectedRow.isReconciled ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />}
                            <span className="font-medium text-white truncate">{selectedRow.description}</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white flex-shrink-0" onClick={() => setSelectedRow(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Panel Content */}
                    <div className="flex-1 overflow-y-auto">
                        {/* Transaction Info */}
                        <div className="px-4 py-4 space-y-4 border-b border-gray-800">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="text-xs text-gray-500">Date</p>
                                        <p className="text-sm text-white">{formatShortDate(selectedRow.date)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <DollarSign className="h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="text-xs text-gray-500">Amount</p>
                                        <p className={`text-sm font-bold ${selectedRow.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                                            {formatCurrency(selectedRow.amount, selectedRow.currency)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <FileText className="h-4 w-4 text-gray-500" />
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500">Description</p>
                                    <p className="text-sm text-white break-words">{selectedRow.description}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500">Bank</p>
                                    <p className="text-sm text-gray-300">{BANK_ACCOUNTS.find(b => b.key === selectedRow.source)?.label || selectedRow.source}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Currency</p>
                                    <p className="text-sm text-gray-300">{selectedRow.currency}</p>
                                </div>
                            </div>

                            {/* Custom data fields */}
                            {selectedRow.custom_data && Object.keys(selectedRow.custom_data).length > 0 && (
                                <div className="space-y-2">
                                    {selectedRow.custom_data.details && (
                                        <div><p className="text-xs text-gray-500">Type</p><p className="text-sm text-gray-300">{selectedRow.custom_data.details}</p></div>
                                    )}
                                    {selectedRow.custom_data.type && (
                                        <div><p className="text-xs text-gray-500">Transaction Type</p><p className="text-sm text-gray-300">{selectedRow.custom_data.type}</p></div>
                                    )}
                                    {selectedRow.custom_data.balance != null && (
                                        <div><p className="text-xs text-gray-500">Balance</p><p className="text-sm text-white font-medium">{formatCurrency(selectedRow.custom_data.balance, selectedRow.currency)}</p></div>
                                    )}
                                    {selectedRow.custom_data.saldo != null && (
                                        <div><p className="text-xs text-gray-500">Balance</p><p className="text-sm text-white font-medium">{formatCurrency(selectedRow.custom_data.saldo, selectedRow.currency)}</p></div>
                                    )}
                                    {selectedRow.custom_data.check_number && (
                                        <div><p className="text-xs text-gray-500">Check/Slip #</p><p className="text-sm text-gray-300 font-mono">{selectedRow.custom_data.check_number}</p></div>
                                    )}
                                    {selectedRow.custom_data.referencia && (
                                        <div><p className="text-xs text-gray-500">Reference</p><p className="text-sm text-gray-300 font-mono">{selectedRow.custom_data.referencia}</p></div>
                                    )}
                                    {selectedRow.custom_data.clave && (
                                        <div><p className="text-xs text-gray-500">Key</p><p className="text-sm text-gray-300">{selectedRow.custom_data.clave}</p></div>
                                    )}
                                    {selectedRow.custom_data.categoria && (
                                        <div><p className="text-xs text-gray-500">Category</p><p className="text-sm text-gray-300">{selectedRow.custom_data.categoria}</p></div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Reconciliation Status */}
                        <div className="px-4 py-4 space-y-4 border-b border-gray-800 bg-[#252627]">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <CreditCard className="h-4 w-4" /> Reconciliation
                            </h3>
                            <div>
                                <p className="text-xs text-gray-500">Status</p>
                                {selectedRow.isReconciled ? (
                                    <Badge variant="outline" className="bg-green-900/30 text-green-400 border-green-700">
                                        Reconciled ({selectedRow.reconciliationType === "automatic" ? "Auto" : "Manual"})
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="bg-yellow-900/30 text-yellow-400 border-yellow-700">
                                        Not Reconciled
                                    </Badge>
                                )}
                            </div>

                            {selectedRow.paymentSource && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Payment Source</p>
                                    <Badge variant="outline" className={`${getGatewayStyle(selectedRow.paymentSource).bg} ${getGatewayStyle(selectedRow.paymentSource).text} ${getGatewayStyle(selectedRow.paymentSource).border}`}>
                                        {selectedRow.paymentSource}
                                    </Badge>
                                </div>
                            )}

                            {selectedRow.custom_data?.disbursement_reference && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Disbursement Reference</p>
                                    <div className="flex items-center gap-2">
                                        <Key className="h-3 w-3 text-gray-500" />
                                        <span className="text-xs font-mono text-gray-300">{selectedRow.custom_data.disbursement_reference}</span>
                                    </div>
                                </div>
                            )}

                            {selectedRow.custom_data?.reconciled_at && (
                                <div>
                                    <p className="text-xs text-gray-500">Reconciled at</p>
                                    <p className="text-sm text-gray-300">{new Date(selectedRow.custom_data.reconciled_at).toLocaleString("pt-BR")}</p>
                                </div>
                            )}

                            {selectedRow.custom_data?.manual_note && (
                                <div>
                                    <p className="text-xs text-gray-500">Note</p>
                                    <p className="text-sm text-gray-300">{selectedRow.custom_data.manual_note}</p>
                                </div>
                            )}

                            {selectedRow.custom_data?.match_type && (
                                <div>
                                    <p className="text-xs text-gray-500">Match Type</p>
                                    <p className="text-sm text-gray-300">{selectedRow.custom_data.match_type.replace(/_/g, " ")}</p>
                                </div>
                            )}
                        </div>

                        {/* Matched transaction details */}
                        {selectedRow.isReconciled && selectedRow.custom_data?.bank_match_amount && (
                            <div className="px-4 py-4 space-y-3 bg-green-900/10">
                                <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider flex items-center gap-2">
                                    <Zap className="h-4 w-4" /> Matched Transaction
                                </h3>
                                <div className="space-y-2 text-sm">
                                    {selectedRow.custom_data.bank_match_date && (
                                        <div className="flex justify-between"><span className="text-gray-400">Date:</span><span className="text-white">{formatShortDate(selectedRow.custom_data.bank_match_date)}</span></div>
                                    )}
                                    <div className="flex justify-between"><span className="text-gray-400">Amount:</span><span className="text-green-400 font-medium">{formatCurrency(selectedRow.custom_data.bank_match_amount, selectedRow.currency)}</span></div>
                                    {selectedRow.custom_data.bank_match_description && (
                                        <div><span className="text-gray-400">Description:</span><p className="text-white text-xs mt-1">{selectedRow.custom_data.bank_match_description}</p></div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Panel Footer */}
                    <div className="border-t border-gray-700 px-4 py-3 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedRow(null)} className="text-gray-400 hover:text-white">
                            Close
                        </Button>
                    </div>
                </div>
            )}

            {/* Error banner */}
            {error && (
                <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-900/90 border border-red-700 rounded-lg px-6 py-3 text-red-200 text-sm z-50 flex items-center gap-3">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-white ml-2">✕</button>
                </div>
            )}
        </div>
    );
}
