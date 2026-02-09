"use client";

import { useState, useEffect, useCallback } from "react";
import {
    TrendingUp,
    Landmark,
    CreditCard,
    ChevronDown,
    ChevronRight,
    Download,
    Loader2,
    BarChart3,
    RefreshCw,
    Banknote,
    ArrowUpRight,
    ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface MonthlyData {
    jan: number; feb: number; mar: number; apr: number; may: number; jun: number;
    jul: number; aug: number; sep: number; oct: number; nov: number; dec: number;
}

interface RevenueChild {
    code: string;
    name: string;
    monthly: MonthlyData;
}

interface RevenueGroup {
    code: string;
    name: string;
    monthly: MonthlyData;
    children: RevenueChild[];
}

interface GatewaySource {
    source: string;
    label: string;
    currency: string;
    monthly: MonthlyData;
    count: number;
}

interface BankAccount {
    source: string;
    label: string;
    currency: string;
    monthly: MonthlyData;
    inflows: MonthlyData;
    outflows: MonthlyData;
    count: number;
}

interface CashflowData {
    year: string;
    revenue: {
        groups: RevenueGroup[];
        total: MonthlyData;
        invoiceOrdersProcessed: number;
    };
    gateways: {
        sources: GatewaySource[];
        total: MonthlyData;
    };
    banks: {
        accounts: BankAccount[];
        totalInflows: MonthlyData;
        totalOutflows: MonthlyData;
        totalNet: MonthlyData;
    };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

function getMonthValue(m: MonthlyData, idx: number): number {
    return m[monthKeys[idx]];
}

function sumMonthly(m: MonthlyData): number {
    return monthKeys.reduce((s, k) => s + m[k], 0);
}

// Compact number format: 1.234.567
function formatCompact(value: number): string {
    return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────
export default function ConsolidatedCashflowPage() {
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
    const [data, setData] = useState<CashflowData | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(["101.0", "102.0", "103.0", "104.0", "105.0", "banks-detail"])
    );

    const toggleSection = useCallback((code: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    }, []);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const res = await fetch(`/api/executive/cashflow/consolidated?year=${selectedYear}`);
                const json = await res.json();
                if (json.success) setData(json);
                else console.error("API error:", json.error);
            } catch (err) {
                console.error("Fetch error:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [selectedYear]);

    // ───── Export CSV handler ─────
    const exportCSV = useCallback(() => {
        if (!data) return;
        const lines: string[] = [];
        const hdr = ["Account", ...MONTHS, "Total"].join(",");

        // Revenue section
        lines.push("--- REVENUE BY FINANCIAL ACCOUNT ---");
        lines.push(hdr);
        for (const g of data.revenue.groups) {
            const gTotal = sumMonthly(g.monthly);
            if (gTotal === 0 && !g.children.length) continue;
            lines.push([g.name, ...monthKeys.map(k => g.monthly[k].toFixed(2)), gTotal.toFixed(2)].join(","));
            for (const c of g.children) {
                const cTotal = sumMonthly(c.monthly);
                lines.push(["  " + c.name, ...monthKeys.map(k => c.monthly[k].toFixed(2)), cTotal.toFixed(2)].join(","));
            }
        }
        lines.push(["TOTAL REVENUE", ...monthKeys.map(k => data.revenue.total[k].toFixed(2)), sumMonthly(data.revenue.total).toFixed(2)].join(","));

        // Gateway section
        lines.push("");
        lines.push("--- CASH INFLOW BY GATEWAY ---");
        lines.push(hdr);
        for (const gw of data.gateways.sources) {
            const gwTotal = sumMonthly(gw.monthly);
            lines.push([gw.label + " (" + gw.currency + ")", ...monthKeys.map(k => gw.monthly[k].toFixed(2)), gwTotal.toFixed(2)].join(","));
        }
        lines.push(["TOTAL GATEWAYS", ...monthKeys.map(k => data.gateways.total[k].toFixed(2)), sumMonthly(data.gateways.total).toFixed(2)].join(","));

        // Bank section
        lines.push("");
        lines.push("--- BANK STATEMENT FLOWS ---");
        lines.push(hdr);
        for (const b of data.banks.accounts) {
            lines.push([b.label + " Inflows", ...monthKeys.map(k => b.inflows[k].toFixed(2)), sumMonthly(b.inflows).toFixed(2)].join(","));
            lines.push([b.label + " Outflows", ...monthKeys.map(k => b.outflows[k].toFixed(2)), sumMonthly(b.outflows).toFixed(2)].join(","));
            lines.push([b.label + " Net", ...monthKeys.map(k => b.monthly[k].toFixed(2)), sumMonthly(b.monthly).toFixed(2)].join(","));
        }
        lines.push(["TOTAL BANK NET", ...monthKeys.map(k => data.banks.totalNet[k].toFixed(2)), sumMonthly(data.banks.totalNet).toFixed(2)].join(","));

        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `consolidated-cashflow-${selectedYear}.csv`;
        a.click();
    }, [data, selectedYear]);

    // ─────────────────────────────────────────
    // Render helpers
    // ─────────────────────────────────────────

    const gridCls = "grid grid-cols-[160px_repeat(12,minmax(55px,1fr))_70px] gap-1";

    // Render a month-value row
    const renderRow = (
        label: string,
        code: string | null,
        monthly: MonthlyData,
        color: string,
        isChild = false,
        hasChildren = false,
    ) => {
        const total = sumMonthly(monthly);
        return (
            <div key={code || label}>
                <div className={`${gridCls} py-1.5 px-2 border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${isChild ? "pl-6 bg-gray-900/30" : "bg-gray-900/60"}`}>
                    <div className="flex items-center gap-1 min-w-0">
                        {hasChildren ? (
                            <button onClick={() => code && toggleSection(code)} className="p-0.5 hover:bg-gray-700 rounded shrink-0">
                                {expandedSections.has(code || "") ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                            </button>
                        ) : (
                            <div className="w-3" />
                        )}
                        {code && <span className="text-[9px] text-gray-500 font-mono shrink-0">{code}</span>}
                        <span className={`text-[11px] truncate ${isChild ? "text-gray-400" : "font-medium text-white"}`} title={label}>{label}</span>
                    </div>
                    {MONTHS.map((_, i) => {
                        const val = getMonthValue(monthly, i);
                        return (
                            <div key={i} className="text-right">
                                <span className={`text-[10px] font-mono ${val === 0 ? "text-gray-600" : `text-${color}-400`}`}>
                                    {val === 0 ? "-" : formatCompact(val)}
                                </span>
                            </div>
                        );
                    })}
                    <div className="text-right bg-gray-800/50 px-1 rounded">
                        <span className={`text-[10px] font-mono font-bold text-${color}-300`}>
                            {formatCompact(total)}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    // Subtotal row
    const renderSubtotal = (label: string, monthly: MonthlyData, color: string, icon?: React.ReactNode) => {
        const total = sumMonthly(monthly);
        return (
            <div className={`${gridCls} py-2 px-2 bg-${color}-900/30 border-y border-${color}-700/40`}>
                <div className="flex items-center gap-2">
                    <div className="w-3" />
                    {icon}
                    <span className={`text-xs font-semibold text-${color}-300`}>{label}</span>
                </div>
                {MONTHS.map((_, i) => {
                    const val = getMonthValue(monthly, i);
                    return (
                        <div key={i} className="text-right">
                            <span className={`text-[10px] font-mono font-bold ${val >= 0 ? `text-${color}-300` : "text-red-300"}`}>
                                {val === 0 ? "-" : formatCompact(val)}
                            </span>
                        </div>
                    );
                })}
                <div className={`text-right bg-${color}-900/40 px-1 rounded-lg py-0.5`}>
                    <span className={`text-[10px] font-mono font-bold ${total >= 0 ? `text-${color}-200` : "text-red-300"}`}>
                        {formatCompact(total)}
                    </span>
                </div>
            </div>
        );
    };

    // ─────────────────────────────────────────
    // KPI Cards
    // ─────────────────────────────────────────
    const renderKPIs = () => {
        if (!data) return null;
        const totalRev = sumMonthly(data.revenue.total);
        const totalGw = sumMonthly(data.gateways.total);
        const totalBankIn = sumMonthly(data.banks.totalInflows);
        const totalBankNet = sumMonthly(data.banks.totalNet);

        const cards = [
            { label: "Revenue (Invoiced)", value: totalRev, icon: <TrendingUp className="h-4 w-4 text-emerald-400" />, color: "emerald", sub: `${data.revenue.invoiceOrdersProcessed.toLocaleString()} invoice lines` },
            { label: "Gateway Inflows", value: totalGw, icon: <CreditCard className="h-4 w-4 text-blue-400" />, color: "blue", sub: `${data.gateways.sources.length} active sources` },
            { label: "Bank Inflows", value: totalBankIn, icon: <ArrowUpRight className="h-4 w-4 text-cyan-400" />, color: "cyan", sub: `${data.banks.accounts.length} bank accounts` },
            { label: "Bank Net", value: totalBankNet, icon: <Landmark className="h-4 w-4 text-amber-400" />, color: "amber", sub: "Inflows − Outflows" },
        ];

        return (
            <div className="grid grid-cols-4 gap-4">
                {cards.map((c) => (
                    <Card key={c.label} className={`bg-gradient-to-br from-${c.color}-900/50 to-${c.color}-950/80 border-${c.color}-700/50`}>
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className={`text-xs font-semibold text-${c.color}-300 uppercase tracking-wider`}>{c.label}</span>
                                {c.icon}
                            </div>
                            <p className="text-2xl font-bold text-white mb-1">{formatCompact(c.value)}</p>
                            <p className={`text-[10px] text-${c.color}-400/70`}>{c.sub}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    };

    // ─────────────────────────────────────────
    // Loading State
    // ─────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950">
                <header className="bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800 border-b border-gray-800 px-6 py-5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-xl border border-emerald-500/30">
                            <Loader2 className="h-7 w-7 text-emerald-400 animate-spin" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Consolidated Cashflow</h1>
                            <p className="text-sm text-gray-400 mt-0.5">Loading data for {selectedYear}...</p>
                        </div>
                    </div>
                </header>
                <div className="p-6 space-y-6 animate-pulse">
                    <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-800 rounded-lg" />)}</div>
                    <div className="h-64 bg-gray-800 rounded-lg" />
                    <div className="h-48 bg-gray-800 rounded-lg" />
                    <div className="h-48 bg-gray-800 rounded-lg" />
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────
    // Main Render
    // ─────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <header className="bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800 border-b border-gray-800 px-6 py-5 sticky top-0 z-20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-xl border border-emerald-500/30">
                            <BarChart3 className="h-7 w-7 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Consolidated Cashflow</h1>
                            <p className="text-sm text-gray-400 mt-0.5">
                                Revenue by FA × Payment Sources × Bank Inflows • {selectedYear}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-gray-800/60 rounded-lg p-1 border border-gray-700">
                            {[2024, 2025, 2026].map((year) => (
                                <button
                                    key={year}
                                    onClick={() => setSelectedYear(year)}
                                    className={`px-3 py-1.5 text-sm rounded-md transition-all ${selectedYear === year ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800" onClick={() => { setLoading(true); setTimeout(() => setSelectedYear(selectedYear), 0); }}>
                            <RefreshCw className="h-4 w-4 mr-2" />Refresh
                        </Button>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={exportCSV}>
                            <Download className="h-4 w-4 mr-2" />Export CSV
                        </Button>
                    </div>
                </div>
            </header>

            <div className="p-6 space-y-6">
                {/* KPI Cards */}
                {renderKPIs()}

                {/* ═══════ SECTION 1: Revenue by Financial Account ═══════ */}
                <Card className="bg-gray-900 border-gray-800 overflow-hidden">
                    <CardHeader className="border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-800/80 py-4">
                        <CardTitle className="text-white flex items-center gap-2 text-base">
                            <Banknote className="h-5 w-5 text-emerald-400" />
                            Revenue by Financial Account
                            <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-500/30 ml-2">
                                Invoice Orders
                            </Badge>
                        </CardTitle>
                    </CardHeader>

                    {/* Table Header */}
                    <div className={`${gridCls} py-2 px-2 bg-gray-800/80 border-b border-gray-700 text-[9px] font-semibold uppercase tracking-wider text-gray-400`}>
                        <div>Account</div>
                        {MONTHS.map((m) => <div key={m} className="text-right">{m}</div>)}
                        <div className="text-right text-amber-400 bg-amber-900/20 px-1 rounded">Total</div>
                    </div>

                    {/* Section Banner */}
                    <div className="bg-gradient-to-r from-emerald-900/40 to-emerald-900/20 border-b border-emerald-800/50 py-2 px-3">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp className="h-3 w-3" />
                            Revenue
                        </span>
                    </div>

                    {/* Revenue Rows */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {data?.revenue.groups.map((group) => {
                            const hasChildren = group.children.length > 0;
                            const isExpanded = expandedSections.has(group.code);
                            return (
                                <div key={group.code}>
                                    {renderRow(group.name, group.code, group.monthly, "emerald", false, hasChildren)}
                                    {hasChildren && isExpanded && group.children.map((child) => (
                                        <div key={child.code}>
                                            {renderRow(child.name, child.code, child.monthly, "emerald", true)}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>

                    {/* Total Revenue */}
                    {data && renderSubtotal("TOTAL REVENUE", data.revenue.total, "emerald", <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />)}
                </Card>

                {/* ═══════ SECTION 2: Cash Inflow by Gateway ═══════ */}
                <Card className="bg-gray-900 border-gray-800 overflow-hidden">
                    <CardHeader className="border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-800/80 py-4">
                        <CardTitle className="text-white flex items-center gap-2 text-base">
                            <CreditCard className="h-5 w-5 text-blue-400" />
                            Cash Inflow by Payment Gateway
                            <Badge className="text-[10px] bg-blue-500/20 text-blue-300 border-blue-500/30 ml-2">
                                Positive Amounts Only
                            </Badge>
                        </CardTitle>
                    </CardHeader>

                    {/* Table Header */}
                    <div className={`${gridCls} py-2 px-2 bg-gray-800/80 border-b border-gray-700 text-[9px] font-semibold uppercase tracking-wider text-gray-400`}>
                        <div>Gateway</div>
                        {MONTHS.map((m) => <div key={m} className="text-right">{m}</div>)}
                        <div className="text-right text-amber-400 bg-amber-900/20 px-1 rounded">Total</div>
                    </div>

                    {/* Banner */}
                    <div className="bg-gradient-to-r from-blue-900/40 to-blue-900/20 border-b border-blue-800/50 py-2 px-3">
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                            <CreditCard className="h-3 w-3" />
                            Payment Sources
                        </span>
                    </div>

                    {/* Gateway Rows */}
                    {data?.gateways.sources.map((gw) => (
                        <div key={gw.source}>
                            {renderRow(
                                `${gw.label}`,
                                null,
                                gw.monthly,
                                "blue",
                                false,
                                false,
                            )}
                        </div>
                    ))}
                    {data?.gateways.sources.length === 0 && (
                        <div className="py-8 text-center text-gray-500 text-sm">No gateway data for {selectedYear}</div>
                    )}

                    {/* Total Gateways */}
                    {data && renderSubtotal("TOTAL GATEWAY INFLOWS", data.gateways.total, "blue", <CreditCard className="h-3.5 w-3.5 text-blue-400" />)}
                </Card>

                {/* ═══════ SECTION 3: Bank Statement Flows ═══════ */}
                <Card className="bg-gray-900 border-gray-800 overflow-hidden">
                    <CardHeader className="border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-800/80 py-4">
                        <CardTitle className="text-white flex items-center gap-2 text-base">
                            <Landmark className="h-5 w-5 text-purple-400" />
                            Bank Statement Flows
                            <Badge className="text-[10px] bg-purple-500/20 text-purple-300 border-purple-500/30 ml-2">
                                Inflows &amp; Outflows
                            </Badge>
                        </CardTitle>
                    </CardHeader>

                    {/* Table Header */}
                    <div className={`${gridCls} py-2 px-2 bg-gray-800/80 border-b border-gray-700 text-[9px] font-semibold uppercase tracking-wider text-gray-400`}>
                        <div>Bank Account</div>
                        {MONTHS.map((m) => <div key={m} className="text-right">{m}</div>)}
                        <div className="text-right text-amber-400 bg-amber-900/20 px-1 rounded">Total</div>
                    </div>

                    {/* Banner */}
                    <div className="bg-gradient-to-r from-purple-900/40 to-purple-900/20 border-b border-purple-800/50 py-2 px-3">
                        <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                            <Landmark className="h-3 w-3" />
                            Bank Accounts
                        </span>
                    </div>

                    {/* Bank Rows — collapsible per bank showing inflows/outflows/net */}
                    {data?.banks.accounts.map((bank) => {
                        const bankKey = `bank-${bank.source}`;
                        const isExpanded = expandedSections.has(bankKey);
                        return (
                            <div key={bank.source}>
                                {/* Bank parent row (net) */}
                                <div className={`${gridCls} py-1.5 px-2 border-b border-gray-800 hover:bg-gray-800/50 transition-colors bg-gray-900/60`}>
                                    <div className="flex items-center gap-1 min-w-0">
                                        <button onClick={() => toggleSection(bankKey)} className="p-0.5 hover:bg-gray-700 rounded shrink-0">
                                            {isExpanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                                        </button>
                                        <Badge variant="outline" className="text-[8px] px-1 py-0 border-gray-600 text-gray-400 shrink-0">{bank.currency}</Badge>
                                        <span className="text-[11px] font-medium text-white truncate" title={bank.label}>{bank.label}</span>
                                    </div>
                                    {MONTHS.map((_, i) => {
                                        const val = getMonthValue(bank.monthly, i);
                                        return (
                                            <div key={i} className="text-right">
                                                <span className={`text-[10px] font-mono ${val === 0 ? "text-gray-600" : val > 0 ? "text-purple-400" : "text-red-400"}`}>
                                                    {val === 0 ? "-" : formatCompact(val)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <div className="text-right bg-gray-800/50 px-1 rounded">
                                        <span className={`text-[10px] font-mono font-bold ${sumMonthly(bank.monthly) >= 0 ? "text-purple-300" : "text-red-300"}`}>
                                            {formatCompact(sumMonthly(bank.monthly))}
                                        </span>
                                    </div>
                                </div>

                                {/* Expanded: Inflows + Outflows detail rows */}
                                {isExpanded && (
                                    <>
                                        <div className={`${gridCls} py-1 px-2 pl-8 border-b border-gray-800/50 bg-gray-900/30`}>
                                            <div className="flex items-center gap-1 min-w-0">
                                                <div className="w-3" />
                                                <ArrowUpRight className="h-3 w-3 text-emerald-500 shrink-0" />
                                                <span className="text-[10px] text-emerald-400">Inflows</span>
                                            </div>
                                            {MONTHS.map((_, i) => {
                                                const val = getMonthValue(bank.inflows, i);
                                                return (
                                                    <div key={i} className="text-right">
                                                        <span className={`text-[10px] font-mono ${val === 0 ? "text-gray-600" : "text-emerald-400/80"}`}>
                                                            {val === 0 ? "-" : formatCompact(val)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            <div className="text-right bg-gray-800/30 px-1 rounded">
                                                <span className="text-[10px] font-mono text-emerald-300/80">{formatCompact(sumMonthly(bank.inflows))}</span>
                                            </div>
                                        </div>
                                        <div className={`${gridCls} py-1 px-2 pl-8 border-b border-gray-800/50 bg-gray-900/30`}>
                                            <div className="flex items-center gap-1 min-w-0">
                                                <div className="w-3" />
                                                <ArrowDownRight className="h-3 w-3 text-red-500 shrink-0" />
                                                <span className="text-[10px] text-red-400">Outflows</span>
                                            </div>
                                            {MONTHS.map((_, i) => {
                                                const val = getMonthValue(bank.outflows, i);
                                                return (
                                                    <div key={i} className="text-right">
                                                        <span className={`text-[10px] font-mono ${val === 0 ? "text-gray-600" : "text-red-400/80"}`}>
                                                            {val === 0 ? "-" : formatCompact(Math.abs(val))}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            <div className="text-right bg-gray-800/30 px-1 rounded">
                                                <span className="text-[10px] font-mono text-red-300/80">{formatCompact(Math.abs(sumMonthly(bank.outflows)))}</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                    {data?.banks.accounts.length === 0 && (
                        <div className="py-8 text-center text-gray-500 text-sm">No bank statement data for {selectedYear}</div>
                    )}

                    {/* Bank Totals: Inflows, Outflows, Net */}
                    {data && (
                        <>
                            {renderSubtotal("TOTAL BANK INFLOWS", data.banks.totalInflows, "emerald", <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />)}
                            {renderSubtotal("TOTAL BANK OUTFLOWS", data.banks.totalOutflows, "red", <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />)}
                            <div className="bg-gradient-to-r from-amber-900/60 via-orange-900/50 to-amber-900/60 border-y-2 border-amber-500/50 py-3 px-2">
                                <div className={gridCls}>
                                    <div className="flex items-center gap-2">
                                        <Landmark className="h-4 w-4 text-amber-400" />
                                        <span className="text-sm font-bold text-amber-300">BANK NET</span>
                                    </div>
                                    {MONTHS.map((_, i) => {
                                        const val = getMonthValue(data.banks.totalNet, i);
                                        return (
                                            <div key={i} className="text-right">
                                                <span className={`text-[11px] font-mono font-bold ${val >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                                                    {val === 0 ? "-" : formatCompact(val)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <div className="text-right bg-amber-900/40 px-1 rounded-lg py-1">
                                        <span className={`text-[11px] font-mono font-bold ${sumMonthly(data.banks.totalNet) >= 0 ? "text-amber-200" : "text-red-300"}`}>
                                            {formatCompact(sumMonthly(data.banks.totalNet))}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </Card>
            </div>
        </div>
    );
}
