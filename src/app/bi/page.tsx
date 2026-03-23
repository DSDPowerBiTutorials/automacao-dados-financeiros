"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, BarChart3 } from "lucide-react";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { type BISummaryResponse, type ChartType, type Granularity, type ChartDataPoint, type MonthlyData } from "@/lib/bi-types";
import { ALL_METRICS, REVENUE_METRICS, EXPENSE_METRICS, MONTH_LABELS, MONTH_KEYS, QUARTER_MAP, getMetricById } from "@/lib/bi-metrics";
import { BIFilterBar } from "@/components/bi/BIFilterBar";
import { BISidebar } from "@/components/bi/BISidebar";
import { BIChart } from "@/components/bi/BIChart";
import { BIKPICards } from "@/components/bi/BIKPICards";
import { BIComparisonChart } from "@/components/bi/BIComparisonChart";

function buildChartData(
    summary: BISummaryResponse | null,
    selectedMetrics: string[],
    granularity: Granularity
): ChartDataPoint[] {
    if (!summary) return [];

    if (granularity === "ytd") {
        // Cumulative YTD
        const points: ChartDataPoint[] = [];
        const running: Record<string, number> = {};
        selectedMetrics.forEach((id) => (running[id] = 0));

        for (let i = 0; i < 12; i++) {
            const mk = MONTH_KEYS[i];
            const point: ChartDataPoint = { month: MONTH_LABELS[i] };
            for (const id of selectedMetrics) {
                const acct = summary.revenue.byAccount[id] || summary.expenses.byAccount[id];
                const val = acct ? (acct as any)[mk] || 0 : 0;
                running[id] = (running[id] || 0) + val;
                point[id] = running[id];
            }
            points.push(point);
        }
        return points;
    }

    if (granularity === "quarterly") {
        return Object.entries(QUARTER_MAP).map(([qLabel, months]) => {
            const point: ChartDataPoint = { month: qLabel };
            for (const id of selectedMetrics) {
                const acct = summary.revenue.byAccount[id] || summary.expenses.byAccount[id];
                let total = 0;
                if (acct) {
                    for (const mk of months) {
                        total += (acct as any)[mk] || 0;
                    }
                }
                point[id] = total;
            }
            return point;
        });
    }

    // Monthly (default)
    return MONTH_LABELS.map((label, i) => {
        const mk = MONTH_KEYS[i];
        const point: ChartDataPoint = { month: label };
        for (const id of selectedMetrics) {
            const acct = summary.revenue.byAccount[id] || summary.expenses.byAccount[id];
            point[id] = acct ? (acct as any)[mk] || 0 : 0;
        }
        return point;
    });
}

function buildComparisonData(summary: BISummaryResponse | null) {
    if (!summary) return [];
    return MONTH_LABELS.map((label, i) => {
        const mk = MONTH_KEYS[i];
        const rev = (summary.revenue.monthly as any)[mk] || 0;
        const exp = (summary.expenses.monthly as any)[mk] || 0;
        return { month: label, revenue: rev, expenses: exp, net: rev - exp };
    });
}

export default function BIPage() {
    const { selectedScope } = useGlobalScope();
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [chartType, setChartType] = useState<ChartType>("bar");
    const [granularity, setGranularity] = useState<Granularity>("monthly");
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["101", "102", "103", "104", "105"]);
    const [summary, setSummary] = useState<BISummaryResponse | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const scopeParam = selectedScope === "GLOBAL" ? "" : `&scope=${selectedScope}`;
            const res = await fetch(`/api/bi/summary?year=${year}${scopeParam}`);
            const data = await res.json();
            if (data.success) {
                setSummary(data);
            }
        } catch (err) {
            console.error("Error fetching BI data:", err);
        } finally {
            setLoading(false);
        }
    }, [year, selectedScope]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Metric toggle handlers
    const toggleMetric = useCallback((id: string) => {
        setSelectedMetrics((prev) =>
            prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
        );
    }, []);

    const selectAll = useCallback((type: "revenue" | "expense") => {
        const ids = (type === "revenue" ? REVENUE_METRICS : EXPENSE_METRICS).map((m) => m.id);
        setSelectedMetrics((prev) => [...new Set([...prev, ...ids])]);
    }, []);

    const deselectAll = useCallback((type: "revenue" | "expense") => {
        const ids = new Set((type === "revenue" ? REVENUE_METRICS : EXPENSE_METRICS).map((m) => m.id));
        setSelectedMetrics((prev) => prev.filter((m) => !ids.has(m)));
    }, []);

    // Build chart data
    const chartData = useMemo(
        () => buildChartData(summary, selectedMetrics, granularity),
        [summary, selectedMetrics, granularity]
    );

    const comparisonData = useMemo(() => buildComparisonData(summary), [summary]);

    const activeMetrics = useMemo(
        () => selectedMetrics.map((id) => getMetricById(id)).filter(Boolean) as typeof ALL_METRICS,
        [selectedMetrics]
    );

    // Split selected metrics into revenue and expense for dual-panel view
    const revenueMetrics = useMemo(
        () => activeMetrics.filter((m) => m.type === "revenue"),
        [activeMetrics]
    );
    const expenseMetrics = useMemo(
        () => activeMetrics.filter((m) => m.type === "expense"),
        [activeMetrics]
    );

    const revenueChartData = useMemo(
        () => buildChartData(summary, revenueMetrics.map((m) => m.id), granularity),
        [summary, revenueMetrics, granularity]
    );
    const expenseChartData = useMemo(
        () => buildChartData(summary, expenseMetrics.map((m) => m.id), granularity),
        [summary, expenseMetrics, granularity]
    );

    return (
        <div className="flex h-full bg-gray-50 dark:bg-[#0a0a0a]">
            {/* Main content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-5">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-[#FF7300]/10">
                                <BarChart3 className="w-5 h-5 text-[#FF7300]" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-gray-900 dark:text-white">DSD B-i</h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Business Intelligence Dashboard</p>
                            </div>
                        </div>
                        <BIFilterBar
                            year={year}
                            onYearChange={setYear}
                            chartType={chartType}
                            onChartTypeChange={setChartType}
                            granularity={granularity}
                            onGranularityChange={setGranularity}
                        />
                    </div>

                    {/* KPI Cards */}
                    <BIKPICards
                        totalRevenue={summary?.kpis.totalRevenue ?? 0}
                        totalExpenses={summary?.kpis.totalExpenses ?? 0}
                        grossProfit={summary?.kpis.grossProfit ?? 0}
                        netMargin={summary?.kpis.netMargin ?? 0}
                        loading={loading}
                    />

                    {/* Loading state */}
                    {loading && (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-[#FF7300]" />
                            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading data...</span>
                        </div>
                    )}

                    {!loading && summary && (
                        <>
                            {/* Comparison chart — always visible */}
                            <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-xl p-4 h-[320px]">
                                <BIComparisonChart data={comparisonData} />
                            </div>

                            {/* Chart panels grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Revenue panel */}
                                {revenueMetrics.length > 0 && (
                                    <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-xl p-4 h-[340px]">
                                        <BIChart
                                            data={revenueChartData}
                                            metrics={revenueMetrics}
                                            chartType={chartType}
                                            title="Revenue Breakdown"
                                        />
                                    </div>
                                )}

                                {/* Expense panel */}
                                {expenseMetrics.length > 0 && (
                                    <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-xl p-4 h-[340px]">
                                        <BIChart
                                            data={expenseChartData}
                                            metrics={expenseMetrics}
                                            chartType={chartType}
                                            title="Expense Breakdown"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* All selected metrics combined chart */}
                            {activeMetrics.length > 0 && (
                                <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-xl p-4 h-[380px]">
                                    <BIChart
                                        data={chartData}
                                        metrics={activeMetrics}
                                        chartType={chartType}
                                        title="All Selected Metrics"
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Right sidebar */}
            <div className="hidden lg:block">
                <BISidebar
                    selectedMetrics={selectedMetrics}
                    onToggleMetric={toggleMetric}
                    onSelectAll={selectAll}
                    onDeselectAll={deselectAll}
                />
            </div>

            {/* Mobile metric toggle (bottom bar) */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#111111] border-t border-gray-200 dark:border-gray-800 p-3 z-50">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {ALL_METRICS.map((m) => {
                        const isSelected = selectedMetrics.includes(m.id);
                        return (
                            <button
                                key={m.id}
                                onClick={() => toggleMetric(m.id)}
                                className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${isSelected
                                        ? "text-white border-transparent"
                                        : "text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                                    }`}
                                style={isSelected ? { backgroundColor: m.color } : undefined}
                            >
                                {m.shortLabel}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
