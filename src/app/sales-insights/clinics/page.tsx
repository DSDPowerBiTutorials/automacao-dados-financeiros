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
    Building2, Users, UserPlus, UserMinus, TrendingUp, TrendingDown,
    DollarSign, Loader2, ChevronDown, ChevronRight, RotateCcw,
    Activity, AlertCircle, Minus, RefreshCw,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";

// ============================================================
// Sales Insights → Clinics Overview
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
    new: { label: "New", className: "bg-emerald-900/50 text-emerald-400 border-emerald-600" },
    paused: { label: "Paused", className: "bg-yellow-900/50 text-yellow-400 border-yellow-600" },
    churned: { label: "Churned", className: "bg-red-900/50 text-red-400 border-red-600" },
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ClinicsOverviewPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<OverviewData | null>(null);
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [region, setRegion] = useState("all");
    const [expandedClinic, setExpandedClinic] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ year: String(year), month: String(month), region });
            const res = await fetch(`/api/sales-insights/clinics/overview?${params}`);
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

    const filteredClinics = data?.clinics.filter(c => {
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term);
        }
        return true;
    }) || [];

    // KPI Card component
    const KPICard = ({ title, value, subtitle, icon: Icon, color }: {
        title: string; value: string | number; subtitle?: string;
        icon: React.ElementType; color: string;
    }) => (
        <Card className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
                        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
                    </div>
                    <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-800`}>
                        <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Clinics Overview</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Level 3 clinic performance, monthly fees, churn analysis &amp; product breakdown
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
                        <SelectTrigger className="w-[100px] bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-200">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[2024, 2025, 2026].map(y => (
                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
                        <SelectTrigger className="w-[120px] bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-200">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTH_NAMES.map((m, i) => (
                                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={region} onValueChange={setRegion}>
                        <SelectTrigger className="w-[120px] bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-200">
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
                        className="border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

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
                            title="Active Clinics"
                            value={data.kpis.active_clinics}
                            subtitle={`of ${data.kpis.total_clinics} total`}
                            icon={Users}
                            color="text-green-400"
                        />
                        <KPICard
                            title="Total MRR"
                            value={formatCurrency(data.kpis.total_mrr, "EUR")}
                            subtitle={`Avg ${formatCurrency(data.kpis.avg_mrr, "EUR")}/clinic`}
                            icon={DollarSign}
                            color="text-blue-400"
                        />
                        <KPICard
                            title="New This Month"
                            value={`+${data.kpis.new_clinics}`}
                            subtitle={`Net: ${data.kpis.net_change >= 0 ? "+" : ""}${data.kpis.net_change}`}
                            icon={UserPlus}
                            color="text-emerald-400"
                        />
                        <KPICard
                            title="Churned"
                            value={data.kpis.churned_clinics}
                            subtitle={`${data.kpis.churn_rate.toFixed(1)}% rate`}
                            icon={UserMinus}
                            color="text-red-400"
                        />
                        <KPICard
                            title="Paused"
                            value={data.kpis.paused_clinics}
                            icon={AlertCircle}
                            color="text-yellow-400"
                        />
                        <KPICard
                            title="Revenue YTD"
                            value={formatCurrency(data.kpis.total_revenue_ytd, "EUR")}
                            subtitle="All clinic products"
                            icon={TrendingUp}
                            color="text-purple-400"
                        />
                    </div>

                    {/* Monthly Timeline */}
                    <Card className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-200 flex items-center gap-2">
                                <Activity className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                Monthly Timeline — {year}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="grid grid-cols-12 gap-1">
                                {/* Header row */}
                                {data.timeline.map((t, i) => (
                                    <div key={`h-${i}`} className="text-center">
                                        <span className="text-xs text-gray-500">{MONTH_NAMES[i]}</span>
                                    </div>
                                ))}
                                {/* Active count row */}
                                {data.timeline.map((t, i) => (
                                    <div key={`a-${i}`} className="text-center">
                                        <span className="text-sm font-bold text-gray-600 dark:text-gray-200">{t.active_count || "-"}</span>
                                    </div>
                                ))}
                                {/* MRR row */}
                                {data.timeline.map((t, i) => (
                                    <div key={`m-${i}`} className="text-center">
                                        <span className="text-[10px] text-gray-500">
                                            {t.mrr > 0 ? formatCurrency(t.mrr, "EUR") : "-"}
                                        </span>
                                    </div>
                                ))}
                                {/* Events row */}
                                {data.timeline.map((t, i) => (
                                    <div key={`e-${i}`} className="flex justify-center gap-0.5 mt-1">
                                        {t.new > 0 && (
                                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-900/60 text-green-400 text-[9px] font-bold">
                                                +{t.new}
                                            </span>
                                        )}
                                        {t.churn > 0 && (
                                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-900/60 text-red-400 text-[9px] font-bold">
                                                -{t.churn}
                                            </span>
                                        )}
                                        {t.pause > 0 && (
                                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-900/60 text-yellow-400 text-[9px] font-bold">
                                                P{t.pause}
                                            </span>
                                        )}
                                        {t.return > 0 && (
                                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-900/60 text-blue-400 text-[9px] font-bold">
                                                R{t.return}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
                                <span className="flex items-center gap-1">
                                    <span className="w-2.5 h-2.5 rounded-full bg-green-900/60" /> New
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-900/60" /> Churn
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-900/60" /> Pause
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-900/60" /> Return
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Clinic Table */}
                    <Card className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                        <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-200 flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                    All Clinics ({filteredClinics.length})
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="Search clinic..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-gray-600 dark:text-gray-200 placeholder-gray-500 w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-[120px] h-8 text-xs bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-200">
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
                                    <TableHeader className="sticky top-0 bg-gray-100 dark:bg-gray-800 z-10">
                                        <TableRow className="border-gray-200 dark:border-gray-700">
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300 w-8"></TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300">Clinic</TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300">Region</TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300">Status</TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Current MRR</TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">MRR Change</TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right">Revenue YTD</TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-center">Months</TableHead>
                                            <TableHead className="text-xs text-gray-700 dark:text-gray-300">Last Payment</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredClinics.map((clinic, idx) => (
                                            <React.Fragment key={clinic.name}>
                                                <TableRow
                                                    className={`border-gray-200 dark:border-gray-700 cursor-pointer transition-colors hover:bg-gray-100 dark:bg-gray-800/50 ${clinic.status === "churned" ? "bg-red-900/10" :
                                                            clinic.status === "paused" ? "bg-yellow-900/10" :
                                                                clinic.status === "new" ? "bg-green-900/10" : ""
                                                        }`}
                                                    onClick={() => setExpandedClinic(
                                                        expandedClinic === clinic.name ? null : clinic.name
                                                    )}
                                                >
                                                    <TableCell className="py-2 px-2">
                                                        {expandedClinic === clinic.name
                                                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                                                            : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                                                        }
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <div>
                                                            <span className="text-xs font-medium text-gray-600 dark:text-gray-200 block truncate max-w-[200px]" title={clinic.name}>
                                                                {clinic.name}
                                                            </span>
                                                            {clinic.email && (
                                                                <span className="text-[10px] text-gray-500 block truncate max-w-[200px]">
                                                                    {clinic.email}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Badge variant="outline" className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600">
                                                            {clinic.region}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] ${STATUS_BADGES[clinic.status]?.className || ""}`}
                                                        >
                                                            {STATUS_BADGES[clinic.status]?.label || clinic.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-200">
                                                            {formatCurrency(clinic.current_mrr, "EUR")}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <MRRChangeCell change={clinic.mrr_change} pct={clinic.mrr_change_pct} />
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <span className="text-xs text-gray-700 dark:text-gray-300">
                                                            {formatCurrency(clinic.total_revenue_ytd, "EUR")}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-center">
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            {clinic.consecutive_months > 0
                                                                ? `${clinic.consecutive_months}/${clinic.months_active}`
                                                                : clinic.months_active
                                                            }
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            {formatDate(clinic.last_date)}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>

                                                {/* Expanded detail */}
                                                {expandedClinic === clinic.name && (
                                                    <TableRow className="border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
                                                        <TableCell colSpan={9} className="p-4">
                                                            <ClinicDetail clinic={clinic} year={year} />
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        ))}
                                        {filteredClinics.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={9} className="text-center py-8 text-gray-500 text-sm">
                                                    No clinics found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Summary footer */}
                            {data.kpis && (
                                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-4 py-2 flex items-center justify-between text-xs">
                                    <span className="text-gray-500 dark:text-gray-400">
                                        Showing {filteredClinics.length} of {data.clinics.length} clinics
                                    </span>
                                    <div className="flex items-center gap-4">
                                        <span className="flex items-center gap-1 text-green-400">
                                            <UserPlus className="h-3 w-3" /> {data.kpis.new_clinics} new
                                        </span>
                                        <span className="flex items-center gap-1 text-red-400">
                                            <UserMinus className="h-3 w-3" /> {data.kpis.churned_clinics} churned
                                        </span>
                                        <span className="flex items-center gap-1 text-yellow-400">
                                            <AlertCircle className="h-3 w-3" /> {data.kpis.paused_clinics} paused
                                        </span>
                                    </div>
                                </div>
                            )}
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

function MRRChangeCell({ change, pct }: { change: number; pct: number }) {
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

function ClinicDetail({ clinic, year }: { clinic: Clinic; year: number }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Products breakdown */}
            <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                    Products Purchased ({year} YTD)
                </h4>
                <div className="space-y-1.5">
                    {clinic.products.length > 0 ? clinic.products.map(p => (
                        <div key={p.code} className="flex items-center justify-between bg-gray-100 dark:bg-gray-800/50 rounded px-3 py-1.5">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[9px] bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 font-mono">
                                    {p.code}
                                </Badge>
                                <span className="text-xs text-gray-700 dark:text-gray-300">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] text-gray-500">{p.count} tx</span>
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-200">{formatCurrency(p.revenue, "EUR")}</span>
                            </div>
                        </div>
                    )) : (
                        <p className="text-xs text-gray-500">No products found</p>
                    )}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                    <span className="text-xs text-gray-500">Total {year} YTD</span>
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-200">{formatCurrency(clinic.total_revenue_ytd, "EUR")}</span>
                </div>
            </div>

            {/* Events history + Info */}
            <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                    Clinic Information
                </h4>
                <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between bg-gray-100 dark:bg-gray-800/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">First Transaction</span>
                        <span className="text-gray-700 dark:text-gray-300">{formatDate(clinic.first_date)}</span>
                    </div>
                    <div className="flex justify-between bg-gray-100 dark:bg-gray-800/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">Last Transaction</span>
                        <span className="text-gray-700 dark:text-gray-300">{formatDate(clinic.last_date)}</span>
                    </div>
                    <div className="flex justify-between bg-gray-100 dark:bg-gray-800/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">Total Transactions</span>
                        <span className="text-gray-700 dark:text-gray-300">{clinic.tx_count}</span>
                    </div>
                    <div className="flex justify-between bg-gray-100 dark:bg-gray-800/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">Consecutive Months</span>
                        <span className="text-gray-700 dark:text-gray-300">{clinic.consecutive_months}</span>
                    </div>
                    <div className="flex justify-between bg-gray-100 dark:bg-gray-800/50 rounded px-3 py-1.5">
                        <span className="text-gray-500">Monthly Fee YTD</span>
                        <span className="text-gray-700 dark:text-gray-300">{formatCurrency(clinic.total_monthly_fee_ytd, "EUR")}</span>
                    </div>
                </div>

                {/* Events */}
                {clinic.events.length > 0 && (
                    <div className="mt-3">
                        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                            Lifecycle Events
                        </h4>
                        <div className="space-y-1">
                            {clinic.events.map((e, i) => {
                                const colors: Record<string, string> = {
                                    New: "text-green-400",
                                    Churn: "text-red-400",
                                    Pause: "text-yellow-400",
                                    Return: "text-blue-400",
                                };
                                const icons: Record<string, React.ReactNode> = {
                                    New: <UserPlus className="h-3 w-3" />,
                                    Churn: <UserMinus className="h-3 w-3" />,
                                    Pause: <AlertCircle className="h-3 w-3" />,
                                    Return: <RotateCcw className="h-3 w-3" />,
                                };
                                return (
                                    <div key={i} className={`flex items-center gap-2 text-xs ${colors[e.type] || "text-gray-500 dark:text-gray-400"}`}>
                                        {icons[e.type] || <Minus className="h-3 w-3" />}
                                        <span className="font-medium">{e.type}</span>
                                        <span className="text-gray-500">— {e.month}</span>
                                        {e.confirmed && (
                                            <Badge variant="outline" className="text-[8px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 py-0 px-1">
                                                confirmed
                                            </Badge>
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
