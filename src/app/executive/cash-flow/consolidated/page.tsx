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
    ArrowUpRight,
    ArrowDownRight,
    ShieldCheck,
    AlertTriangle,
    Activity,
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

interface GatewayEntry {
    name: string;
    monthly: MonthlyData;
    count: number;
    total: number;
}

interface RevenueChild { code: string; name: string; monthly: MonthlyData; }
interface RevenueGroup { code: string; name: string; monthly: MonthlyData; children: RevenueChild[]; }

interface BankBreakdownEntry {
    name: string;
    inflows: MonthlyData;
    outflows: MonthlyData;
    net: MonthlyData;
    reconciledInflows: MonthlyData;
    count: number;
    reconciledCount: number;
    totalInflows: number;
    totalOutflows: number;
}

interface CashflowData {
    year: string;
    summary: {
        totalInflows: number;
        totalOutflows: number;
        netFlow: number;
        reconciledAmount: number;
        reconciledPct: number;
        totalRevenueInvoiced: number;
        bankRowCount: number;
        reconciledRowCount: number;
        invoiceCount: number;
    };
    bank: {
        inflows: MonthlyData;
        outflows: MonthlyData;
        net: MonthlyData;
        reconciledInflows: MonthlyData;
        unreconciledInflows: MonthlyData;
        reconPct: MonthlyData;
        gateways: GatewayEntry[];
        byBank?: BankBreakdownEntry[];
    };
    revenue: {
        groups: RevenueGroup[];
        total: MonthlyData;
    };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

function mv(m: MonthlyData, idx: number): number { return m[monthKeys[idx]]; }
function sumM(m: MonthlyData): number { return monthKeys.reduce((s, k) => s + m[k], 0); }
function fmt(v: number): string { return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
function emptyMonthly(): MonthlyData {
    return { jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0 };
}

const gwIcons: Record<string, string> = {
    Braintree: "🔷",
    Stripe: "🟣",
    GoCardless: "🟢",
    QuickBooks: "🔵",
    Other: "⚪",
};

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────
export default function RevenueCashflowPage() {
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
    const [data, setData] = useState<CashflowData | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set(["gateways", "revenue"]));

    const toggle = useCallback((key: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/executive/cashflow/consolidated?year=${selectedYear}`);
                const json = await res.json();
                if (json.success) setData(json);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        })();
    }, [selectedYear]);

    // CSV export
    const exportCSV = useCallback(() => {
        if (!data) return;
        const lines: string[] = [];
        const hdr = ["", ...MONTHS, "Total"].join(",");
        lines.push("REVENUE CASHFLOW — " + data.year);
        lines.push(hdr);
        lines.push(["BANK INFLOWS", ...monthKeys.map(k => data.bank.inflows[k].toFixed(2)), sumM(data.bank.inflows).toFixed(2)].join(","));
        for (const gw of data.bank.gateways) {
            lines.push(["  " + gw.name, ...monthKeys.map(k => gw.monthly[k].toFixed(2)), gw.total.toFixed(2)].join(","));
        }
        lines.push(["  Unreconciled", ...monthKeys.map(k => data.bank.unreconciledInflows[k].toFixed(2)), sumM(data.bank.unreconciledInflows).toFixed(2)].join(","));
        lines.push(["BANK OUTFLOWS", ...monthKeys.map(k => data.bank.outflows[k].toFixed(2)), sumM(data.bank.outflows).toFixed(2)].join(","));
        lines.push(["NET FLOW", ...monthKeys.map(k => data.bank.net[k].toFixed(2)), sumM(data.bank.net).toFixed(2)].join(","));
        lines.push(["RECON %", ...monthKeys.map(k => data.bank.reconPct[k] + "%"), data.summary.reconciledPct + "%"].join(","));
        lines.push("");
        lines.push("REVENUE BY FINANCIAL ACCOUNT");
        lines.push(hdr);
        for (const g of data.revenue.groups) {
            lines.push([g.name, ...monthKeys.map(k => g.monthly[k].toFixed(2)), sumM(g.monthly).toFixed(2)].join(","));
            for (const c of g.children) {
                lines.push(["  " + c.name, ...monthKeys.map(k => c.monthly[k].toFixed(2)), sumM(c.monthly).toFixed(2)].join(","));
            }
        }
        lines.push(["TOTAL REVENUE", ...monthKeys.map(k => data.revenue.total[k].toFixed(2)), sumM(data.revenue.total).toFixed(2)].join(","));

        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `revenue-cashflow-${selectedYear}.csv`;
        a.click();
    }, [data, selectedYear]);

    // Grid class — 14-col (label + 12 months + total)
    const grid = "grid grid-cols-[180px_repeat(12,minmax(58px,1fr))_75px] gap-0.5";

    // ─────────────────────────────────────────
    // Render helpers
    // ─────────────────────────────────────────

    const MonthHeader = () => (
        <div className={`${grid} py-2 px-3 bg-gray-800/80 border-b border-gray-700 text-[9px] font-semibold uppercase tracking-wider text-gray-400 sticky top-0 z-10`}>
            <div>Account</div>
            {MONTHS.map(m => <div key={m} className="text-right">{m}</div>)}
            <div className="text-right text-amber-400 bg-amber-900/20 px-1 rounded">Total</div>
        </div>
    );

    const DataRow = ({
        label, monthly, color, bold = false, indent = 0, icon, badge, onClick, expandable, isExpanded
    }: {
        label: string; monthly: MonthlyData; color: string; bold?: boolean; indent?: number;
        icon?: React.ReactNode; badge?: string; onClick?: () => void; expandable?: boolean; isExpanded?: boolean;
    }) => {
        const total = sumM(monthly);
        const paddingLeft = indent * 16 + 12;
        return (
            <div
                className={`${grid} py-1.5 px-3 border-b border-gray-800/60 hover:bg-gray-800/40 transition-colors ${onClick ? "cursor-pointer" : ""}`}
                style={{ paddingLeft }}
                onClick={onClick}
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    {expandable && (
                        <span className="shrink-0">
                            {isExpanded
                                ? <ChevronDown className="h-3 w-3 text-gray-400" />
                                : <ChevronRight className="h-3 w-3 text-gray-400" />
                            }
                        </span>
                    )}
                    {icon && <span className="shrink-0 text-xs">{icon}</span>}
                    <span className={`text-[11px] truncate ${bold ? `font-semibold text-${color}-300` : `text-${color}-400`}`} title={label}>
                        {label}
                    </span>
                    {badge && (
                        <Badge className={`text-[8px] px-1 py-0 ml-1 bg-${color}-500/20 text-${color}-300 border-${color}-500/30`}>{badge}</Badge>
                    )}
                </div>
                {MONTHS.map((_, i) => {
                    const v = mv(monthly, i);
                    return (
                        <div key={i} className="text-right">
                            <span className={`text-[10px] font-mono ${v === 0 ? "text-gray-600" : bold ? `font-bold text-${color}-300` : `text-${color}-400/90`}`}>
                                {v === 0 ? "–" : fmt(v)}
                            </span>
                        </div>
                    );
                })}
                <div className="text-right bg-gray-800/40 px-1 rounded">
                    <span className={`text-[10px] font-mono font-bold text-${color}-300`}>
                        {total === 0 ? "–" : fmt(total)}
                    </span>
                </div>
            </div>
        );
    };

    const TotalRow = ({
        label, monthly, color, icon, border = false
    }: {
        label: string; monthly: MonthlyData; color: string; icon?: React.ReactNode; border?: boolean;
    }) => {
        const total = sumM(monthly);
        return (
            <div className={`${grid} py-2.5 px-3 ${border ? `border-y-2 border-${color}-500/50` : `border-y border-${color}-700/40`} bg-gradient-to-r from-${color}-900/40 to-${color}-900/20`}>
                <div className="flex items-center gap-2">
                    {icon}
                    <span className={`text-xs font-bold text-${color}-300 uppercase tracking-wide`}>{label}</span>
                </div>
                {MONTHS.map((_, i) => {
                    const v = mv(monthly, i);
                    return (
                        <div key={i} className="text-right">
                            <span className={`text-[10px] font-mono font-bold ${v >= 0 ? `text-${color}-300` : "text-red-300"}`}>
                                {v === 0 ? "–" : fmt(v)}
                            </span>
                        </div>
                    );
                })}
                <div className={`text-right bg-${color}-900/40 px-1 rounded py-0.5`}>
                    <span className={`text-[10px] font-mono font-bold ${total >= 0 ? `text-${color}-200` : "text-red-200"}`}>
                        {fmt(total)}
                    </span>
                </div>
            </div>
        );
    };

    // Percentage row for reconciliation
    const PctRow = ({ monthly, overallPct }: { monthly: MonthlyData; overallPct: number }) => (
        <div className={`${grid} py-1.5 px-3 border-b border-gray-800/60 bg-gray-900/40`}>
            <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-teal-400" />
                <span className="text-[10px] font-semibold text-teal-400">Reconciliation %</span>
            </div>
            {MONTHS.map((_, i) => {
                const pct = mv(monthly, i);
                return (
                    <div key={i} className="text-right">
                        <span className={`text-[10px] font-mono font-bold ${pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : pct > 0 ? "text-red-400" : "text-gray-600"}`}>
                            {pct === 0 ? "–" : `${pct}%`}
                        </span>
                    </div>
                );
            })}
            <div className="text-right bg-gray-800/40 px-1 rounded">
                <span className={`text-[10px] font-mono font-bold ${overallPct >= 80 ? "text-emerald-300" : overallPct >= 50 ? "text-amber-300" : "text-red-300"}`}>
                    {overallPct}%
                </span>
            </div>
        </div>
    );

    // ─────────────────────────────────────────
    // KPI Cards
    // ─────────────────────────────────────────
    const KPIs = () => {
        if (!data) return null;
        const s = data.summary;
        const cards = [
            {
                label: "Bank Inflows", value: s.totalInflows,
                icon: <ArrowUpRight className="h-4 w-4 text-emerald-400" />,
                color: "emerald",
                sub: `${data.bank.gateways.length} gateways identified`,
            },
            {
                label: "Reconciled", value: s.reconciledAmount,
                icon: <ShieldCheck className="h-4 w-4 text-teal-400" />,
                color: "teal",
                sub: `${s.reconciledPct}% of inflows • ${s.reconciledRowCount} rows`,
            },
            {
                label: "Revenue Invoiced", value: s.totalRevenueInvoiced,
                icon: <TrendingUp className="h-4 w-4 text-blue-400" />,
                color: "blue",
                sub: `${s.invoiceCount.toLocaleString()} invoice lines`,
            },
            {
                label: "Net Bank Flow", value: s.netFlow,
                icon: <Activity className="h-4 w-4 text-amber-400" />,
                color: "amber",
                sub: `Inflows (${fmt(s.totalInflows)}) − Outflows (${fmt(Math.abs(s.totalOutflows))})`,
            },
        ];
        return (
            <div className="grid grid-cols-4 gap-4">
                {cards.map(c => (
                    <Card key={c.label} className={`bg-gradient-to-br from-${c.color}-900/50 to-${c.color}-950/80 border-${c.color}-700/50`}>
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className={`text-xs font-semibold text-${c.color}-300 uppercase tracking-wider`}>{c.label}</span>
                                {c.icon}
                            </div>
                            <p className="text-2xl font-bold text-white mb-1">{fmt(c.value)}</p>
                            <p className={`text-[10px] text-${c.color}-400/70`}>{c.sub}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    };

    // ─────────────────────────────────────────
    // Loading
    // ─────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950">
                <header className="bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800 border-b border-gray-800 px-6 py-5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl border border-emerald-500/30">
                            <Loader2 className="h-7 w-7 text-emerald-400 animate-spin" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Revenue Cashflow</h1>
                            <p className="text-sm text-gray-400 mt-0.5">Loading {selectedYear}...</p>
                        </div>
                    </div>
                </header>
                <div className="p-6 space-y-6 animate-pulse">
                    <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-800 rounded-lg" />)}</div>
                    <div className="h-96 bg-gray-800 rounded-lg" />
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────
    // Main
    // ─────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <header className="bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800 border-b border-gray-800 px-6 py-5 sticky top-0 z-20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl border border-emerald-500/30">
                            <BarChart3 className="h-7 w-7 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Revenue Cashflow</h1>
                            <p className="text-sm text-gray-400 mt-0.5">
                                Bank Inflows × Gateways × Financial Accounts • All Banks • {selectedYear}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-gray-800/60 rounded-lg p-1 border border-gray-700">
                            {[2024, 2025, 2026].map(y => (
                                <button key={y} onClick={() => setSelectedYear(y)}
                                    className={`px-3 py-1.5 text-sm rounded-md transition-all ${selectedYear === y ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}>
                                    {y}
                                </button>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800"
                            onClick={() => { setLoading(true); setTimeout(() => setSelectedYear(selectedYear), 0); }}>
                            <RefreshCw className="h-4 w-4 mr-2" />Refresh
                        </Button>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={exportCSV}>
                            <Download className="h-4 w-4 mr-2" />Export
                        </Button>
                    </div>
                </div>
            </header>

            <div className="p-6 space-y-6">
                <KPIs />

                {/* ═══════════════════════════════════════════════════════════════
                    UNIFIED GRID: Bank Inflows → Gateways → Revenue → Outflows
                   ═══════════════════════════════════════════════════════════════ */}
                <Card className="bg-gray-900 border-gray-800 overflow-hidden">
                    <CardHeader className="border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-800/80 py-4">
                        <CardTitle className="text-white flex items-center gap-2 text-base">
                            <Landmark className="h-5 w-5 text-emerald-400" />
                            Revenue Cashflow — All Banks
                            <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-500/30 ml-2">
                                Bank-Centric View
                            </Badge>
                            {data && data.summary.reconciledPct < 50 && (
                                <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/30 ml-1">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    {data.summary.reconciledPct}% reconciled
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>

                    <MonthHeader />

                    {data && (
                        <>
                            {/* ───── BANK INFLOWS (Total) ───── */}
                            <div className="bg-gradient-to-r from-emerald-900/30 to-emerald-900/10 border-b border-emerald-800/40 py-1.5 px-3">
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <ArrowUpRight className="h-3 w-3" />
                                    Bank Inflows
                                </span>
                            </div>
                            <TotalRow
                                label="TOTAL INFLOWS"
                                monthly={data.bank.inflows}
                                color="emerald"
                                icon={<ArrowUpRight className="h-4 w-4 text-emerald-400" />}
                            />

                            {/* ───── BANK ACCOUNT breakdown ───── */}
                            {data.bank.byBank && data.bank.byBank.length > 0 && (
                                <>
                                    <DataRow
                                        label="By Bank Account"
                                        monthly={data.bank.inflows}
                                        color="emerald"
                                        bold
                                        indent={0}
                                        icon={<Landmark className="h-3 w-3 text-emerald-400" />}
                                        expandable
                                        isExpanded={expanded.has("banks")}
                                        onClick={() => toggle("banks")}
                                        badge={`${data.bank.byBank.length} accounts`}
                                    />
                                    {expanded.has("banks") && data.bank.byBank.map(bb => (
                                        <DataRow
                                            key={bb.name}
                                            label={bb.name}
                                            monthly={bb.inflows}
                                            color="emerald"
                                            indent={2}
                                            badge={`${bb.count} rows`}
                                        />
                                    ))}
                                </>
                            )}

                            {/* ───── GATEWAYS breakdown ───── */}
                            <DataRow
                                label="Reconciled Inflows"
                                monthly={data.bank.reconciledInflows}
                                color="teal"
                                bold
                                indent={0}
                                icon={<ShieldCheck className="h-3 w-3 text-teal-400" />}
                                expandable
                                isExpanded={expanded.has("gateways")}
                                onClick={() => toggle("gateways")}
                                badge={`${data.summary.reconciledPct}%`}
                            />
                            {expanded.has("gateways") && data.bank.gateways.map(gw => (
                                <DataRow
                                    key={gw.name}
                                    label={gw.name}
                                    monthly={gw.monthly}
                                    color="teal"
                                    indent={2}
                                    icon={gwIcons[gw.name] || "⚪"}
                                    badge={`${gw.count} rows`}
                                />
                            ))}

                            {/* Unreconciled */}
                            <DataRow
                                label="Unreconciled Inflows"
                                monthly={data.bank.unreconciledInflows}
                                color="amber"
                                bold
                                indent={0}
                                icon={<AlertTriangle className="h-3 w-3 text-amber-400" />}
                                badge={`${100 - data.summary.reconciledPct}%`}
                            />

                            {/* Reconciliation % row */}
                            <PctRow monthly={data.bank.reconPct} overallPct={data.summary.reconciledPct} />

                            {/* ───── REVENUE ATTRIBUTION (FA Codes) ───── */}
                            <div className="bg-gradient-to-r from-blue-900/30 to-blue-900/10 border-b border-blue-800/40 py-1.5 px-3 mt-0">
                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <TrendingUp className="h-3 w-3" />
                                    Revenue Attribution (Invoice Orders)
                                </span>
                            </div>

                            <DataRow
                                label="Total Revenue Invoiced"
                                monthly={data.revenue.total}
                                color="blue"
                                bold
                                indent={0}
                                icon={<TrendingUp className="h-3 w-3 text-blue-400" />}
                                expandable
                                isExpanded={expanded.has("revenue")}
                                onClick={() => toggle("revenue")}
                                badge={`${data.summary.invoiceCount.toLocaleString()} lines`}
                            />

                            {expanded.has("revenue") && data.revenue.groups.map(group => {
                                if (monthKeys.every(k => group.monthly[k] === 0)) return null;
                                const groupKey = `fa-${group.code}`;
                                const isGroupExpanded = expanded.has(groupKey);
                                return (
                                    <div key={group.code}>
                                        <DataRow
                                            label={group.name}
                                            monthly={group.monthly}
                                            color="blue"
                                            indent={1}
                                            expandable={group.children.length > 0}
                                            isExpanded={isGroupExpanded}
                                            onClick={() => toggle(groupKey)}
                                            badge={group.code}
                                        />
                                        {isGroupExpanded && group.children.map(child => (
                                            <DataRow
                                                key={child.code}
                                                label={child.name}
                                                monthly={child.monthly}
                                                color="blue"
                                                indent={2}
                                                badge={child.code}
                                            />
                                        ))}
                                    </div>
                                );
                            })}

                            {/* ───── BANK OUTFLOWS ───── */}
                            <div className="bg-gradient-to-r from-red-900/30 to-red-900/10 border-b border-red-800/40 py-1.5 px-3 mt-0">
                                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <ArrowDownRight className="h-3 w-3" />
                                    Bank Outflows
                                </span>
                            </div>
                            <TotalRow
                                label="TOTAL OUTFLOWS"
                                monthly={data.bank.outflows}
                                color="red"
                                icon={<ArrowDownRight className="h-4 w-4 text-red-400" />}
                            />

                            {/* ───── NET FLOW ───── */}
                            <div className="bg-gradient-to-r from-amber-900/60 via-orange-900/50 to-amber-900/60 border-y-2 border-amber-500/50 py-0">
                                <TotalRow
                                    label="NET BANK FLOW"
                                    monthly={data.bank.net}
                                    color="amber"
                                    icon={<Landmark className="h-4 w-4 text-amber-400" />}
                                    border
                                />
                            </div>

                            {/* ───── GAP ANALYSIS ───── */}
                            {(() => {
                                const gap = { ...emptyMonthly() };
                                for (const mk of monthKeys) {
                                    gap[mk] = data.bank.inflows[mk] - data.revenue.total[mk];
                                }
                                const totalGap = sumM(gap);
                                return (
                                    <div className="px-3 py-3 border-t border-gray-800 bg-gray-900/60">
                                        <div className={grid}>
                                            <div className="flex items-center gap-1.5">
                                                <CreditCard className="h-3 w-3 text-purple-400" />
                                                <span className="text-[10px] font-semibold text-purple-400">
                                                    Gap (Bank − Invoiced)
                                                </span>
                                            </div>
                                            {MONTHS.map((_, i) => {
                                                const v = mv(gap, i);
                                                return (
                                                    <div key={i} className="text-right">
                                                        <span className={`text-[10px] font-mono ${v === 0 ? "text-gray-600" : v > 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>
                                                            {v === 0 ? "–" : (v > 0 ? "+" : "") + fmt(v)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            <div className="text-right bg-gray-800/40 px-1 rounded">
                                                <span className={`text-[10px] font-mono font-bold ${totalGap >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                                                    {(totalGap > 0 ? "+" : "") + fmt(totalGap)}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-[9px] text-gray-500 mt-1 pl-5">
                                            Positive = bank received more than invoiced (fees, timing, FX). Negative = invoiced more than received (receivables, refunds).
                                        </p>
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </Card>
            </div>
        </div>
    );
}
