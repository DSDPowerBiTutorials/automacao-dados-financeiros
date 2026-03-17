"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Building2, Users, UserPlus, UserMinus, TrendingUp, TrendingDown,
    DollarSign, Loader2, ChevronDown, ChevronRight, RotateCcw,
    Activity, AlertCircle, Minus, RefreshCw, Lock, Unlock,
    Link2, Search, MoreHorizontal, Edit3, X,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { PageHeader } from "@/components/ui/page-header";

// ============================================================
// Sales Insights → Clinics Overview
// Baseline logic: Dec (year-1) = starting roster of clinics.
// Events detected: New, Pause, Return. Churn = manual only.
// ============================================================

interface ClinicProduct {
    code: string;
    name: string;
    revenue: number;
    count: number;
}

interface ClinicEvent {
    type: string;
    month: string;
    confirmed: boolean;
}

interface AutoEvent {
    type: string;
    month: string;
    is_manual: boolean;
}

interface Clinic {
    name: string;
    email: string;
    region: string;
    status: "active" | "paused" | "churned" | "new";
    current_mrr: number;
    previous_mrr: number;
    mrr_change: number;
    mrr_change_pct: number;
    total_revenue_ytd: number;
    total_monthly_fee_ytd: number;
    first_date: string;
    last_date: string;
    tx_count: number;
    products: ClinicProduct[];
    events: ClinicEvent[];
    auto_events: AutoEvent[];
    monthly_fees: Record<string, number>;
    baseline_mrr: number;
    was_in_baseline: boolean;
    months_active: number;
    consecutive_months: number;
}

interface TimelineEntry {
    month: string;
    new: number;
    churn: number;
    pause: number;
    return: number;
    active_count: number;
    mrr: number;
}

interface KPIs {
    total_clinics: number;
    active_clinics: number;
    paused_clinics: number;
    churned_clinics: number;
    new_clinics: number;
    total_mrr: number;
    avg_mrr: number;
    total_revenue_ytd: number;
    churn_rate: number;
    net_change: number;
    baseline_clinics_count: number;
}

interface OverviewData {
    kpis: KPIs;
    clinics: Clinic[];
    timeline: TimelineEntry[];
    year: number;
    month: number;
    region: string;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-green-900/50 text-green-400 border-green-600" },
    new: { label: "New", className: "bg-white text-blue-600 border-blue-300" },
    paused: { label: "Paused", className: "bg-yellow-900/50 text-yellow-400 border-yellow-600" },
    churned: { label: "Churned", className: "bg-white text-red-600 border-red-300" },
};

const EVENT_BADGES: Record<string, { label: string; bg: string; text: string }> = {
    New: { label: "N", bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-400" },
    Pause: { label: "P", bg: "bg-yellow-100 dark:bg-yellow-900/40", text: "text-yellow-700 dark:text-yellow-400" },
    Return: { label: "R", bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-400" },
    Churn: { label: "C", bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-400" },
};

const EVENT_OPTIONS = ["New", "Pause", "Return", "Churn"] as const;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getDefaultMonth(): number {
    const now = new Date();
    const m = now.getMonth();
    return m === 0 ? 12 : m;
}
function getDefaultYear(): number {
    const now = new Date();
    return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
}

const CLOSED_MONTHS_KEY = "clinic-numbers-closed";
function loadClosedMonths(year: number): Record<number, boolean> {
    try {
        const raw = localStorage.getItem(`${CLOSED_MONTHS_KEY}-${year}`);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
}
function saveClosedMonths(year: number, closed: Record<number, boolean>) {
    try {
        localStorage.setItem(`${CLOSED_MONTHS_KEY}-${year}`, JSON.stringify(closed));
    } catch { /* ignore */ }
}

const formatCompact = (v: number): string =>
    Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// ============================================================
// Main Page Component
// ============================================================

export default function ClinicsOverviewPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<OverviewData | null>(null);
    const [year, setYear] = useState(getDefaultYear());
    const [month, setMonth] = useState(getDefaultMonth());
    const [region, setRegion] = useState("all");
    const [expandedClinic, setExpandedClinic] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [closedMonths, setClosedMonths] = useState<Record<number, boolean>>({});
    const [gridSearchTerm, setGridSearchTerm] = useState("");

    // Merge dialog state
    const [mergeOpen, setMergeOpen] = useState(false);
    const [mergeClinic, setMergeClinic] = useState<Clinic | null>(null);
    const [mergeSearch, setMergeSearch] = useState("");
    const [mergeResults, setMergeResults] = useState<{ name: string }[]>([]);
    const [mergeLoading, setMergeLoading] = useState(false);
    const [mergeTarget, setMergeTarget] = useState<string | null>(null);

    // Event editing state
    const [editingEvent, setEditingEvent] = useState<{ clinicName: string; month: string } | null>(null);
    const [savingEvent, setSavingEvent] = useState(false);

    useEffect(() => { setClosedMonths(loadClosedMonths(year)); }, [year]);

    const effectiveMonth = useMemo(() => {
        for (let m = month; m >= 1; m--) {
            if (closedMonths[m]) return m;
        }
        return month;
    }, [month, closedMonths]);

    const toggleClosedMonth = (m: number) => {
        const updated = { ...closedMonths, [m]: !closedMonths[m] };
        setClosedMonths(updated);
        saveClosedMonths(year, updated);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ year: String(year), month: String(effectiveMonth), region });
            const res = await fetch(`/api/sales-insights/clinics/overview?${params}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Failed to load");
            setData(json);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [year, effectiveMonth, region]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredClinics = data?.clinics.filter(c => {
        if (!c.was_in_baseline && c.status !== "new") return false;
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term);
        }
        return true;
    }) || [];

    const gridFilteredClinics = data?.clinics.filter(c => {
        if (!c.was_in_baseline && c.status !== "new") return false;
        if (gridSearchTerm) {
            const term = gridSearchTerm.toLowerCase();
            return c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term);
        }
        return true;
    }) || [];

    // ── Event editing handlers ──
    const handleEventChange = async (clinicName: string, monthStr: string, newEventType: string | null) => {
        setSavingEvent(true);
        try {
            if (newEventType === null) {
                // Remove: find existing event for this clinic+month
                const res = await fetch(`/api/clinics/events?year_month=${encodeURIComponent(monthStr)}`);
                const json = await res.json();
                const existing = json.events?.find((e: any) =>
                    (e.clinics as any)?.name === clinicName && e.year_month === monthStr
                );
                if (existing) {
                    await fetch(`/api/clinics/events?id=${existing.id}`, { method: "DELETE" });
                }
            } else {
                // Upsert: use clinic_name (API resolves to clinic_id)
                await fetch("/api/clinics/events", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        clinic_name: clinicName,
                        event_type: newEventType,
                        year_month: monthStr,
                    }),
                });
            }
        } catch (e) {
            console.error("Error saving event:", e);
        } finally {
            setSavingEvent(false);
            setEditingEvent(null);
            fetchData(); // Refresh
        }
    };

    // ── Merge handlers ──
    const searchMergeClinics = async (term: string) => {
        if (term.length < 2) { setMergeResults([]); return; }
        setMergeLoading(true);
        try {
            const res = await fetch(`/api/clinics/merge?search=${encodeURIComponent(term)}`);
            const json = await res.json();
            setMergeResults(json.results || []);
        } catch { setMergeResults([]); }
        finally { setMergeLoading(false); }
    };

    const executeMerge = async () => {
        if (!mergeClinic || !mergeTarget) return;
        setMergeLoading(true);
        try {
            const res = await fetch("/api/clinics/merge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    primary_name: mergeClinic.name,
                    alias_name: mergeTarget,
                }),
            });
            const json = await res.json();
            if (json.success) {
                setMergeOpen(false);
                setMergeClinic(null);
                setMergeTarget(null);
                setMergeSearch("");
                fetchData();
            } else {
                alert(json.error || "Merge failed");
            }
        } catch (e: any) { alert(e.message); }
        finally { setMergeLoading(false); }
    };

    // ── KPI Card ──
    const KPICard = ({ title, value, subtitle, icon: Icon, color }: {
        title: string; value: string | number; subtitle?: string;
        icon: React.ElementType; color: string;
    }) => (
        <Card className="bg-gray-50 dark:bg-black border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
                        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
                    </div>
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-black">
                        <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    // ── Build month columns for the grid ──
    // Use the API's effectiveMonth (data.month) when available, so grid matches actual data
    const gridMonth = data?.month ?? effectiveMonth;
    const monthColumns = useMemo(() => {
        const cols: string[] = [];
        for (let m = 1; m <= gridMonth; m++) {
            cols.push(`${year}-${String(m).padStart(2, "0")}`);
        }
        return cols;
    }, [year, gridMonth]);

    // Helper: get event for a clinic in a specific month
    const getEventForMonth = (clinic: Clinic, monthStr: string): AutoEvent | undefined => {
        return clinic.auto_events?.find(e => e.month === monthStr);
    };

    return (
        <div className="space-y-6 p-6">
            <PageHeader title="Clinics Overview" subtitle={`Baseline: Dec ${year - 1} · Level 3 clinic performance, monthly fees & lifecycle events`}>
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
                    <Button variant="outline" size="sm" onClick={fetchData}
                        className="border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111111]">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </PageHeader>

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
                        <KPICard title="Active Clinics" value={data.kpis.active_clinics}
                            subtitle={`of ${data.kpis.total_clinics} total · Baseline: ${data.kpis.baseline_clinics_count}`}
                            icon={Users} color="text-green-400" />
                        <KPICard title="Total MRR" value={formatCurrency(data.kpis.total_mrr, "EUR")}
                            subtitle={`Avg ${formatCurrency(data.kpis.avg_mrr, "EUR")}/clinic`}
                            icon={DollarSign} color="text-blue-400" />
                        <KPICard title="New This Year" value={`+${data.kpis.new_clinics}`}
                            subtitle={`Net: ${data.kpis.net_change >= 0 ? "+" : ""}${data.kpis.net_change}`}
                            icon={UserPlus} color="text-emerald-400" />
                        <KPICard title="Churned" value={data.kpis.churned_clinics}
                            subtitle={`${data.kpis.churn_rate.toFixed(1)}% rate`}
                            icon={UserMinus} color="text-red-400" />
                        <KPICard title="Paused" value={data.kpis.paused_clinics}
                            icon={AlertCircle} color="text-yellow-400" />
                        <KPICard title="Revenue YTD" value={formatCurrency(data.kpis.total_revenue_ytd, "EUR")}
                            subtitle="All clinic products"
                            icon={TrendingUp} color="text-purple-400" />
                    </div>

                    {/* Monthly Timeline */}
                    <Card className="bg-gray-50 dark:bg-black border-gray-200 dark:border-gray-700">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-200 flex items-center gap-2">
                                <Activity className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                Monthly Timeline — {year} <span className="text-[10px] text-gray-400 font-normal">(Baseline: Dec {year - 1})</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            {effectiveMonth !== month && (
                                <div className="mb-3 px-3 py-2 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 text-xs text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span>Numbers not closed for {MONTH_NAMES[month - 1]}. Status & KPIs based on <strong>{MONTH_NAMES[effectiveMonth - 1]}</strong>.</span>
                                </div>
                            )}
                            <div className="grid grid-cols-12 gap-1">
                                {Array.from({ length: month }, (_, i) => {
                                    const monthIdx = i + 1;
                                    const isClosed = !!closedMonths[monthIdx];
                                    const isEffective = monthIdx === effectiveMonth;
                                    return (
                                        <div key={`h-${i}`} className={`text-center ${!isClosed && monthIdx > effectiveMonth ? "opacity-40" : ""}`}>
                                            <span className={`text-xs ${isEffective ? "font-bold text-blue-500" : "text-gray-500"}`}>{MONTH_NAMES[i]}</span>
                                        </div>
                                    );
                                })}
                                {Array.from({ length: 12 - month }, (_, i) => <div key={`hp-${i}`} />)}

                                {Array.from({ length: month }, (_, i) => {
                                    const t = data.timeline[i];
                                    const isClosed = !!closedMonths[i + 1];
                                    return (
                                        <div key={`a-${i}`} className={`text-center ${!isClosed && (i + 1) > effectiveMonth ? "opacity-40" : ""}`}>
                                            <span className="text-sm font-bold text-gray-600 dark:text-gray-200">{t ? (t.active_count || "-") : "-"}</span>
                                        </div>
                                    );
                                })}
                                {Array.from({ length: 12 - month }, (_, i) => <div key={`ap-${i}`} />)}

                                {Array.from({ length: month }, (_, i) => {
                                    const t = data.timeline[i];
                                    const isClosed = !!closedMonths[i + 1];
                                    return (
                                        <div key={`m-${i}`} className={`text-center ${!isClosed && (i + 1) > effectiveMonth ? "opacity-40" : ""}`}>
                                            <span className="text-[10px] text-gray-500">{t && t.mrr > 0 ? formatCurrency(t.mrr, "EUR") : "-"}</span>
                                        </div>
                                    );
                                })}
                                {Array.from({ length: 12 - month }, (_, i) => <div key={`mp-${i}`} />)}

                                {Array.from({ length: month }, (_, i) => {
                                    const t = data.timeline[i];
                                    const isClosed = !!closedMonths[i + 1];
                                    return (
                                        <div key={`e-${i}`} className={`flex justify-center gap-0.5 mt-1 ${!isClosed && (i + 1) > effectiveMonth ? "opacity-40" : ""}`}>
                                            {t && t.new > 0 && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-900/60 text-blue-300 text-[9px] font-bold">+{t.new}</span>}
                                            {t && t.churn > 0 && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-900/60 text-red-400 text-[9px] font-bold">-{t.churn}</span>}
                                            {t && t.pause > 0 && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-900/60 text-yellow-400 text-[9px] font-bold">P{t.pause}</span>}
                                            {t && t.return > 0 && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-900/60 text-emerald-400 text-[9px] font-bold">R{t.return}</span>}
                                        </div>
                                    );
                                })}
                                {Array.from({ length: 12 - month }, (_, i) => <div key={`ep-${i}`} />)}

                                {Array.from({ length: month }, (_, i) => {
                                    const monthIdx = i + 1;
                                    const isClosed = !!closedMonths[monthIdx];
                                    return (
                                        <div key={`c-${i}`} className="flex justify-center mt-2">
                                            <button onClick={() => toggleClosedMonth(monthIdx)}
                                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${isClosed
                                                    ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700"
                                                    : "bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
                                                title={isClosed ? "Numbers closed — click to open" : "Numbers not closed — click to close"}>
                                                {isClosed ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                                                {isClosed ? "Closed" : "Open"}
                                            </button>
                                        </div>
                                    );
                                })}
                                {Array.from({ length: 12 - month }, (_, i) => <div key={`cp-${i}`} />)}
                            </div>
                            <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-900/60" /> New</span>
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-900/60" /> Churn</span>
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-900/60" /> Pause</span>
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-900/60" /> Return</span>
                                <span className="ml-2 flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> Numbers Closed</span>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col-reverse gap-6">
                        {/* ══════════════════════════════════════════════════════
                        Monthly Grid (PnL-style): Clinic × Month with MRR + events
                       ══════════════════════════════════════════════════════ */}
                        <Card className="bg-gray-50 dark:bg-black border-gray-200 dark:border-gray-700">
                            <CardHeader className="py-3 px-4">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-200 flex items-center gap-2">
                                        <DollarSign className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                        Monthly Fees Grid — {year}
                                        <span className="text-[10px] text-gray-400 font-normal ml-1">
                                            (Dec {year - 1} = Baseline · click event badge to edit)
                                        </span>
                                    </CardTitle>
                                    <input type="text" placeholder="Search clinic..." value={gridSearchTerm}
                                        onChange={e => setGridSearchTerm(e.target.value)}
                                        className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-md text-gray-600 dark:text-gray-200 placeholder-gray-500 w-48 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                </div>
                            </CardHeader>
                            <CardContent className="px-0 py-0">
                                <div className="overflow-auto max-h-[700px]">
                                    {/* Fixed grid: Clinic(180px) + Status(60px) + Dec baseline(65px) + months + MMRΔ(70px) + YTD(70px) + Action(60px) */}
                                    <div className="min-w-max">
                                        {/* Header */}
                                        <div className={`grid gap-0 sticky top-0 z-10 bg-gray-100 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-gray-700`}
                                            style={{ gridTemplateColumns: `180px 60px 65px repeat(${monthColumns.length}, 70px) 70px 70px 60px` }}>
                                            <div className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase">Clinic</div>
                                            <div className="px-1 py-2 text-[10px] font-semibold text-gray-500 uppercase text-center">Status</div>
                                            <div className="px-1 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">Dec {year - 1}</div>
                                            {monthColumns.map((mc, i) => (
                                                <div key={mc} className="px-1 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">
                                                    {MONTH_NAMES[i]}
                                                </div>
                                            ))}
                                            <div className="px-1 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">MMR Δ</div>
                                            <div className="px-1 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">YTD</div>
                                            <div className="px-1 py-2 text-[10px] font-semibold text-gray-500 uppercase text-center">Action</div>
                                        </div>

                                        {/* Rows */}
                                        {gridFilteredClinics.map((clinic) => {
                                            const ytd = Object.values(clinic.monthly_fees || {}).reduce((s, v) => s + v, 0);
                                            const lastMC = monthColumns[monthColumns.length - 1];
                                            const lastFee = clinic.monthly_fees?.[lastMC] || 0;
                                            const prevFee = monthColumns.length > 1
                                                ? (clinic.monthly_fees?.[monthColumns[monthColumns.length - 2]] || 0)
                                                : (clinic.baseline_mrr || 0);
                                            const mrrDelta = lastFee - prevFee;
                                            return (
                                                <div key={clinic.name}
                                                    className={`grid gap-0 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors ${clinic.status === "churned" ? "bg-red-50/50 dark:bg-red-900/5" :
                                                        clinic.status === "paused" ? "bg-yellow-50/50 dark:bg-yellow-900/5" :
                                                            clinic.status === "new" ? "bg-blue-50/50 dark:bg-blue-900/5" : ""
                                                        }`}
                                                    style={{ gridTemplateColumns: `180px 60px 65px repeat(${monthColumns.length}, 70px) 70px 70px 60px` }}>
                                                    {/* Clinic name */}
                                                    <div className="px-3 py-1.5 flex flex-col justify-center min-w-0">
                                                        <span className="text-[11px] font-medium text-gray-700 dark:text-gray-200 truncate" title={clinic.name}>
                                                            {clinic.name}
                                                        </span>
                                                        {clinic.email && (
                                                            <span className="text-[9px] text-gray-400 truncate">{clinic.email}</span>
                                                        )}
                                                    </div>

                                                    {/* Status badge */}
                                                    <div className="px-1 py-1.5 flex items-center justify-center">
                                                        <Badge variant="outline" className={`text-[8px] px-1 py-0 ${STATUS_BADGES[clinic.status]?.className || ""}`}>
                                                            {STATUS_BADGES[clinic.status]?.label || clinic.status}
                                                        </Badge>
                                                    </div>

                                                    {/* Baseline Dec */}
                                                    <div className="px-1 py-1.5 flex items-center justify-end">
                                                        <span className={`text-[10px] font-mono ${clinic.baseline_mrr > 0 ? "text-gray-600 dark:text-gray-300" : "text-gray-300 dark:text-gray-700"}`}>
                                                            {clinic.baseline_mrr > 0 ? formatCompact(clinic.baseline_mrr) : "-"}
                                                        </span>
                                                    </div>

                                                    {/* Monthly fee cells */}
                                                    {monthColumns.map(mc => {
                                                        const fee = clinic.monthly_fees?.[mc] || 0;
                                                        const evt = getEventForMonth(clinic, mc);
                                                        const isEditing = editingEvent?.clinicName === clinic.name && editingEvent?.month === mc;

                                                        return (
                                                            <div key={mc} className="px-1 py-1 flex flex-col items-end justify-center gap-0.5 relative">
                                                                <span className={`text-[10px] font-mono ${fee > 0 ? "text-gray-700 dark:text-gray-200" : "text-gray-300 dark:text-gray-700"}`}>
                                                                    {fee > 0 ? formatCompact(fee) : "-"}
                                                                </span>
                                                                {evt ? (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setEditingEvent({ clinicName: clinic.name, month: mc }); }}
                                                                        className={`inline-flex items-center gap-0.5 px-1 py-0 rounded text-[8px] font-bold border cursor-pointer hover:opacity-80 transition-opacity ${EVENT_BADGES[evt.type]?.bg || ""} ${EVENT_BADGES[evt.type]?.text || ""} ${evt.is_manual ? "border-current" : "border-transparent"}`}
                                                                        title={`${evt.type}${evt.is_manual ? " (manual)" : " (auto)"} — click to edit`}>
                                                                        {evt.type}
                                                                        {evt.is_manual && <Edit3 className="h-2 w-2" />}
                                                                    </button>
                                                                ) : fee === 0 && clinic.was_in_baseline ? (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setEditingEvent({ clinicName: clinic.name, month: mc }); }}
                                                                        className="text-[8px] text-gray-300 dark:text-gray-600 hover:text-gray-500 cursor-pointer"
                                                                        title="Add event">
                                                                        +
                                                                    </button>
                                                                ) : null}

                                                                {/* Inline event editor dropdown */}
                                                                {isEditing && (
                                                                    <div className="absolute top-full right-0 mt-0.5 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg p-1 min-w-[90px]"
                                                                        onClick={e => e.stopPropagation()}>
                                                                        {EVENT_OPTIONS.map(opt => (
                                                                            <button key={opt}
                                                                                disabled={savingEvent}
                                                                                onClick={() => handleEventChange(clinic.name, mc, opt)}
                                                                                className={`w-full text-left px-2 py-1 text-[10px] rounded hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1.5 ${EVENT_BADGES[opt]?.text || ""}`}>
                                                                                <span className={`w-2 h-2 rounded-full ${EVENT_BADGES[opt]?.bg || ""}`} />
                                                                                {opt}
                                                                            </button>
                                                                        ))}
                                                                        {evt && (
                                                                            <button
                                                                                disabled={savingEvent}
                                                                                onClick={() => handleEventChange(clinic.name, mc, null)}
                                                                                className="w-full text-left px-2 py-1 text-[10px] rounded hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1.5 text-gray-400">
                                                                                <X className="h-2 w-2" /> Remove
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => setEditingEvent(null)}
                                                                            className="w-full text-left px-2 py-1 text-[10px] rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 border-t border-gray-100 dark:border-gray-800 mt-0.5">
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    {/* MMR Δ */}
                                                    <div className="px-1 py-1.5 flex items-center justify-end">
                                                        <span className={`text-[10px] font-mono font-bold ${mrrDelta > 0 ? "text-green-600 dark:text-green-400" : mrrDelta < 0 ? "text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-600"}`}>
                                                            {mrrDelta > 0 ? `+${formatCompact(mrrDelta)}` : mrrDelta < 0 ? `-${formatCompact(Math.abs(mrrDelta))}` : "-"}
                                                        </span>
                                                    </div>

                                                    {/* YTD */}
                                                    <div className="px-1 py-1.5 flex items-center justify-end">
                                                        <span className="text-[10px] font-mono font-bold text-gray-700 dark:text-gray-200">
                                                            {ytd > 0 ? formatCompact(ytd) : "-"}
                                                        </span>
                                                    </div>

                                                    {/* Action */}
                                                    <div className="px-1 py-1.5 flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => { setMergeClinic(clinic); setMergeOpen(true); setMergeSearch(""); setMergeTarget(null); setMergeResults([]); }}
                                                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                                            title="Link / merge duplicate clinic">
                                                            <Link2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {gridFilteredClinics.length === 0 && (
                                            <div className="text-center py-8 text-gray-500 text-sm">No clinics found</div>
                                        )}

                                        {/* Totals row */}
                                        {gridFilteredClinics.length > 0 && (() => {
                                            const lastMC = monthColumns[monthColumns.length - 1];
                                            const totalMrrDelta = gridFilteredClinics.reduce((s, c) => {
                                                const lastFee = c.monthly_fees?.[lastMC] || 0;
                                                const prevFee = monthColumns.length > 1
                                                    ? (c.monthly_fees?.[monthColumns[monthColumns.length - 2]] || 0)
                                                    : (c.baseline_mrr || 0);
                                                return s + (lastFee - prevFee);
                                            }, 0);
                                            return (
                                                <div className={`grid gap-0 bg-gray-100 dark:bg-[#0a0a0a] border-t-2 border-gray-300 dark:border-gray-600 sticky bottom-0`}
                                                    style={{ gridTemplateColumns: `180px 60px 65px repeat(${monthColumns.length}, 70px) 70px 70px 60px` }}>
                                                    <div className="px-3 py-2 text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase">
                                                        Total ({gridFilteredClinics.length})
                                                    </div>
                                                    <div />
                                                    <div className="px-1 py-2 text-right">
                                                        <span className="text-[10px] font-mono font-bold text-gray-600 dark:text-gray-300">
                                                            {formatCompact(gridFilteredClinics.reduce((s, c) => s + (c.baseline_mrr || 0), 0))}
                                                        </span>
                                                    </div>
                                                    {monthColumns.map(mc => {
                                                        const total = gridFilteredClinics.reduce((s, c) => s + (c.monthly_fees?.[mc] || 0), 0);
                                                        return (
                                                            <div key={mc} className="px-1 py-2 text-right">
                                                                <span className="text-[10px] font-mono font-bold text-gray-600 dark:text-gray-300">
                                                                    {total > 0 ? formatCompact(total) : "-"}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                    <div className="px-1 py-2 text-right">
                                                        <span className={`text-[10px] font-mono font-bold ${totalMrrDelta > 0 ? "text-green-600 dark:text-green-400" : totalMrrDelta < 0 ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-300"}`}>
                                                            {totalMrrDelta > 0 ? `+${formatCompact(totalMrrDelta)}` : totalMrrDelta < 0 ? `-${formatCompact(Math.abs(totalMrrDelta))}` : "-"}
                                                        </span>
                                                    </div>
                                                    <div className="px-1 py-2 text-right">
                                                        <span className="text-[10px] font-mono font-bold text-gray-600 dark:text-gray-300">
                                                            {formatCompact(gridFilteredClinics.reduce((s, c) => s + Object.values(c.monthly_fees || {}).reduce((a, b) => a + b, 0), 0))}
                                                        </span>
                                                    </div>
                                                    <div />
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Legend */}
                                <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-[10px] text-gray-500">
                                    {Object.entries(EVENT_BADGES).map(([key, val]) => (
                                        <span key={key} className="flex items-center gap-1">
                                            <span className={`inline-block w-3 px-0.5 py-0 rounded text-[8px] font-bold text-center ${val.bg} ${val.text}`}>{val.label}</span>
                                            {key}
                                        </span>
                                    ))}
                                    <span className="ml-2 flex items-center gap-1"><Edit3 className="h-2.5 w-2.5" /> Manual override</span>
                                    <span className="flex items-center gap-1"><Link2 className="h-2.5 w-2.5" /> Merge clinics</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Clinic Detail Table */}
                        <Card className="bg-gray-50 dark:bg-black border-gray-200 dark:border-gray-700">
                            <CardHeader className="py-3 px-4">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-200 flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                        All Clinics ({filteredClinics.length})
                                    </CardTitle>
                                    <div className="flex items-center gap-2">
                                        <input type="text" placeholder="Search clinic..." value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-md text-gray-600 dark:text-gray-200 placeholder-gray-500 w-48 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                                            <SelectTrigger className="w-[120px] h-8 text-xs bg-gray-100 dark:bg-black border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-200">
                                                <SelectValue placeholder="Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Status</SelectItem>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="new">New</SelectItem>
                                                <SelectItem value="paused">Paused</SelectItem>
                                                <SelectItem value="churned">Churned</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="px-0 py-0">
                                <div className="max-h-[600px] overflow-auto">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-gray-100 dark:bg-black z-10">
                                            <TableRow className="border-gray-200 dark:border-gray-700">
                                                <TableHead className="text-xs text-gray-700 dark:text-gray-300 w-8"></TableHead>
                                                <TableHead className="text-xs text-gray-700 dark:text-gray-300">Clinic</TableHead>
                                                <TableHead className="text-xs text-gray-700 dark:text-gray-300">Region</TableHead>
                                                <TableHead className="text-xs text-gray-700 dark:text-gray-300">Status</TableHead>
                                                <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Baseline</TableHead>
                                                <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Current MRR</TableHead>
                                                <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">MRR Change</TableHead>
                                                <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Revenue YTD</TableHead>
                                                <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-center">Months</TableHead>
                                                <TableHead className="text-xs text-gray-700 dark:text-gray-300">Last Payment</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredClinics.map((clinic) => (
                                                <React.Fragment key={clinic.name}>
                                                    <TableRow
                                                        className={`border-gray-200 dark:border-gray-700 cursor-pointer transition-colors hover:bg-gray-100 dark:bg-black/50 ${clinic.status === "churned" ? "bg-red-900/10" :
                                                            clinic.status === "paused" ? "bg-yellow-900/10" :
                                                                clinic.status === "new" ? "bg-blue-900/10" : ""
                                                            }`}
                                                        onClick={() => setExpandedClinic(expandedClinic === clinic.name ? null : clinic.name)}>
                                                        <TableCell className="py-2 px-2">
                                                            {expandedClinic === clinic.name
                                                                ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                                                                : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />}
                                                        </TableCell>
                                                        <TableCell className="py-2">
                                                            <div>
                                                                <span className="text-xs font-medium text-gray-600 dark:text-gray-200 block truncate max-w-[200px]" title={clinic.name}>{clinic.name}</span>
                                                                {clinic.email && <span className="text-[10px] text-gray-500 block truncate max-w-[200px]">{clinic.email}</span>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-2">
                                                            <Badge variant="outline" className="text-[10px] bg-gray-100 dark:bg-black text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600">{clinic.region}</Badge>
                                                        </TableCell>
                                                        <TableCell className="py-2">
                                                            <Badge variant="outline" className={`text-[10px] ${STATUS_BADGES[clinic.status]?.className || ""}`}>
                                                                {STATUS_BADGES[clinic.status]?.label || clinic.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="py-2 text-right">
                                                            <span className={`text-xs ${clinic.was_in_baseline ? "text-gray-600 dark:text-gray-300" : "text-gray-300 dark:text-gray-600"}`}>
                                                                {clinic.was_in_baseline ? formatCurrency(clinic.baseline_mrr, "EUR") : "-"}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="py-2 text-right">
                                                            <span className="text-xs font-medium text-gray-600 dark:text-gray-200">{formatCurrency(clinic.current_mrr, "EUR")}</span>
                                                        </TableCell>
                                                        <TableCell className="py-2 text-right">
                                                            <MRRChangeCell change={clinic.mrr_change} pct={clinic.mrr_change_pct} />
                                                        </TableCell>
                                                        <TableCell className="py-2 text-right">
                                                            <span className="text-xs text-gray-700 dark:text-gray-300">{formatCurrency(clinic.total_revenue_ytd, "EUR")}</span>
                                                        </TableCell>
                                                        <TableCell className="py-2 text-center">
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                {clinic.consecutive_months > 0 ? `${clinic.consecutive_months}/${clinic.months_active}` : clinic.months_active}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="py-2">
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">{clinic.last_date ? formatDate(clinic.last_date) : "-"}</span>
                                                        </TableCell>
                                                    </TableRow>
                                                    {expandedClinic === clinic.name && (
                                                        <TableRow className="border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/30">
                                                            <TableCell colSpan={10} className="p-4">
                                                                <ClinicDetail clinic={clinic} year={year} />
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                            {filteredClinics.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={10} className="text-center py-8 text-gray-500 text-sm">No clinics found</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                {data.kpis && (
                                    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-black px-4 py-2 flex items-center justify-between text-xs">
                                        <span className="text-gray-500 dark:text-gray-400">Showing {filteredClinics.length} of {data.clinics.length} clinics</span>
                                        <div className="flex items-center gap-4">
                                            <span className="flex items-center gap-1 text-blue-400"><UserPlus className="h-3 w-3" /> {data.kpis.new_clinics} new</span>
                                            <span className="flex items-center gap-1 text-red-400"><UserMinus className="h-3 w-3" /> {data.kpis.churned_clinics} churned</span>
                                            <span className="flex items-center gap-1 text-yellow-400"><AlertCircle className="h-3 w-3" /> {data.kpis.paused_clinics} paused</span>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )
            }

            {/* ══════════ Merge Dialog ══════════ */}
            <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700">
                    <DialogHeader>
                        <DialogTitle className="text-gray-700 dark:text-gray-200 flex items-center gap-2">
                            <Link2 className="h-4 w-4" /> Link Duplicate Clinic
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Primary clinic (will keep this name):</p>
                            <div className="px-3 py-2 bg-gray-50 dark:bg-black rounded border border-gray-200 dark:border-gray-700">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{mergeClinic?.name}</span>
                                {mergeClinic?.email && <span className="text-xs text-gray-400 block">{mergeClinic.email}</span>}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Search for duplicate to merge into this clinic:</p>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                                <input type="text" placeholder="Search by name..." value={mergeSearch}
                                    onChange={e => { setMergeSearch(e.target.value); searchMergeClinics(e.target.value); }}
                                    className="w-full pl-8 pr-3 py-2 text-xs bg-gray-100 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-md text-gray-600 dark:text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            {mergeLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-2" />}
                            {mergeResults.length > 0 && (
                                <div className="mt-2 max-h-40 overflow-auto border border-gray-200 dark:border-gray-700 rounded-md">
                                    {mergeResults.filter(r => r.name !== mergeClinic?.name).map(r => (
                                        <button key={r.name}
                                            onClick={() => setMergeTarget(r.name)}
                                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0 ${mergeTarget === r.name ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "text-gray-600 dark:text-gray-300"
                                                }`}>
                                            {r.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {mergeTarget && (
                                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700 text-xs text-blue-700 dark:text-blue-400">
                                    <strong>&quot;{mergeTarget}&quot;</strong> will be merged into <strong>&quot;{mergeClinic?.name}&quot;</strong>.
                                    All transactions of the duplicate will be reassigned.
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" size="sm" onClick={() => setMergeOpen(false)}
                            className="border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                            Cancel
                        </Button>
                        <Button size="sm" disabled={!mergeTarget || mergeLoading}
                            onClick={executeMerge}
                            className="bg-blue-600 hover:bg-blue-700 text-white">
                            {mergeLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3 mr-1" />}
                            Merge
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}

// ============================================================
// Sub-components
// ============================================================

function MRRChangeCell({ change, pct }: { change: number; pct: number }) {
    if (change === 0) return <Minus className="h-3.5 w-3.5 text-gray-500 ml-auto" />;
    const isPositive = change > 0;
    return (
        <span className={`text-xs flex items-center justify-end gap-1 ${isPositive ? "text-green-400" : "text-red-400"}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? "+" : ""}{formatCurrency(change, "EUR")}
            <span className="text-[10px] text-gray-500">({pct >= 0 ? "+" : ""}{pct.toFixed(0)}%)</span>
        </span>
    );
}

function ClinicDetail({ clinic, year }: { clinic: Clinic; year: number }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Products ({year} YTD)</h4>
                <div className="space-y-1.5">
                    {clinic.products.length > 0 ? clinic.products.map(p => (
                        <div key={p.code} className="flex items-center justify-between bg-gray-100 dark:bg-black/50 rounded px-3 py-1.5">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[9px] bg-gray-100 dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 font-mono">{p.code}</Badge>
                                <span className="text-xs text-gray-700 dark:text-gray-300">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] text-gray-500">{p.count} tx</span>
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-200">{formatCurrency(p.revenue, "EUR")}</span>
                            </div>
                        </div>
                    )) : <p className="text-xs text-gray-500">No products found</p>}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                    <span className="text-xs text-gray-500">Total {year} YTD</span>
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-200">{formatCurrency(clinic.total_revenue_ytd, "EUR")}</span>
                </div>
            </div>

            <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Clinic Information</h4>
                <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between bg-gray-100 dark:bg-black/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">Baseline (Dec {year - 1})</span>
                        <span className="text-gray-700 dark:text-gray-300">{clinic.was_in_baseline ? formatCurrency(clinic.baseline_mrr, "EUR") : "Not in baseline"}</span>
                    </div>
                    <div className="flex justify-between bg-gray-100 dark:bg-black/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">First Transaction</span>
                        <span className="text-gray-700 dark:text-gray-300">{clinic.first_date ? formatDate(clinic.first_date) : "-"}</span>
                    </div>
                    <div className="flex justify-between bg-gray-100 dark:bg-black/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">Last Transaction</span>
                        <span className="text-gray-700 dark:text-gray-300">{clinic.last_date ? formatDate(clinic.last_date) : "-"}</span>
                    </div>
                    <div className="flex justify-between bg-gray-100 dark:bg-black/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">Total Transactions</span>
                        <span className="text-gray-700 dark:text-gray-300">{clinic.tx_count}</span>
                    </div>
                    <div className="flex justify-between bg-gray-100 dark:bg-black/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">Consecutive Months</span>
                        <span className="text-gray-700 dark:text-gray-300">{clinic.consecutive_months}</span>
                    </div>
                    <div className="flex justify-between bg-gray-100 dark:bg-black/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">Monthly Fee YTD</span>
                        <span className="text-gray-700 dark:text-gray-300">{formatCurrency(clinic.total_monthly_fee_ytd, "EUR")}</span>
                    </div>
                </div>

                {clinic.auto_events && clinic.auto_events.length > 0 && (
                    <div className="mt-3">
                        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Lifecycle Events</h4>
                        <div className="space-y-1">
                            {clinic.auto_events.map((e, i) => {
                                const badge = EVENT_BADGES[e.type];
                                return (
                                    <div key={i} className={`flex items-center gap-2 text-xs ${badge?.text || "text-gray-500"}`}>
                                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[8px] font-bold ${badge?.bg || ""}`}>
                                            {badge?.label || "?"}
                                        </span>
                                        <span className="font-medium">{e.type}</span>
                                        <span className="text-gray-500">— {e.month}</span>
                                        {e.is_manual && (
                                            <Badge variant="outline" className="text-[8px] bg-gray-100 dark:bg-[#0a0a0a] text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 py-0 px-1">manual</Badge>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
