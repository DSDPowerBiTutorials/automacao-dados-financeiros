"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    BarChart3,
    Loader2,
    RefreshCw,
    Info,
    Play,
    TrendingUp,
    AlertTriangle,
    Trophy,
    Percent,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
    LEVEL_LABELS,
    LEVEL_COLORS,
    ALL_LEVELS,
    getScoreColor,
    getScoreBgColor,
    ClientLevel,
} from "@/lib/executive-insights/level-utils";
import { TOOLTIPS } from "@/lib/executive-insights/tooltip-content";

interface MarketPerformanceMetrics {
    revenueGrowth: number;
    customerCountTrend: number;
    concentrationRisk: number;
    performanceScore: number;
    trend: "up" | "down" | "stable";
}

interface MarketPerformanceData {
    levels: Record<ClientLevel, MarketPerformanceMetrics>;
    summary: {
        bestPerformer: ClientLevel | null;
        mostAtRisk: ClientLevel | null;
    };
}

export default function MarketPerformancePage() {
    const [data, setData] = useState<MarketPerformanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [faCodeFilter, setFaCodeFilter] = useState("all");
    const [comparisonPeriod, setComparisonPeriod] = useState("12");

    const loadData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append("faCodeFilter", faCodeFilter);
            params.append("comparisonPeriodMonths", comparisonPeriod);

            const res = await fetch(
                `/api/executive-insights/market-performance-by-level?${params}`,
                { cache: "no-store" }
            );
            const result = await res.json();

            if (result.data) {
                setData(result.data);
            }
        } catch (error) {
            console.error("Error loading market performance:", error);
            toast({
                title: "Error",
                description: "Failed to load market performance data",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleRefresh = () => {
        loadData();
    };

    const getTrendIcon = (trend: "up" | "down" | "stable") => {
        switch (trend) {
            case "up":
                return "↑";
            case "down":
                return "↓";
            default:
                return "→";
        }
    };

    const getTrendColor = (trend: "up" | "down" | "stable") => {
        switch (trend) {
            case "up":
                return "text-green-600 dark:text-green-400";
            case "down":
                return "text-red-600 dark:text-red-400";
            default:
                return "text-gray-600 dark:text-gray-400";
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BarChart3 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                    <div>
                        <PageHeader
                            title="Market Performance by Level"
                            subtitle={`${comparisonPeriod}-month analysis`}
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open("#", "_blank")}
                        className="gap-2"
                    >
                        <Play className="h-4 w-4" />
                        Watch Video
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const tip = TOOLTIPS.marketPerformanceHeader;
                            toast({
                                title: "Market Performance Score",
                                description: tip,
                            });
                        }}
                        className="gap-2"
                    >
                        <Info className="h-4 w-4" />
                        How It Works
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">FA Code Filter</label>
                            <Select value={faCodeFilter} onValueChange={setFaCodeFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All FA codes" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All FA Codes</SelectItem>
                                    <SelectItem value="104.1,104.3">Lvl3 ROW (104.1, 104.3)</SelectItem>
                                    <SelectItem value="104.2,104.4">Lvl3 AMEX (104.2, 104.4)</SelectItem>
                                    <SelectItem value="104.5">Level 2 (104.5)</SelectItem>
                                    <SelectItem value="104.6">Level 1 (104.6)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Comparison Period</label>
                            <Select value={comparisonPeriod} onValueChange={setComparisonPeriod}>
                                <SelectTrigger>
                                    <SelectValue placeholder="12 months" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="6">6 months</SelectItem>
                                    <SelectItem value="12">12 months</SelectItem>
                                    <SelectItem value="24">24 months</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-end">
                            <Button
                                onClick={handleRefresh}
                                disabled={loading}
                                className="w-full gap-2"
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4" />
                                )}
                                Refresh
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {loading && !data ? (
                <div className="flex items-center justify-center h-96">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : data ? (
                <>
                    {/* Alerts */}
                    {data.summary.bestPerformer && (
                        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <Trophy className="h-6 w-6 text-green-600 dark:text-green-400" />
                                    <div>
                                        <p className="font-semibold text-green-900 dark:text-green-100">
                                            Best Performer: {LEVEL_LABELS[data.summary.bestPerformer]}
                                        </p>
                                        <p className="text-sm text-green-700 dark:text-green-300">
                                            Score: {data.levels[data.summary.bestPerformer].performanceScore}/100
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {data.summary.mostAtRisk && (
                        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                                    <div>
                                        <p className="font-semibold text-red-900 dark:text-red-100">
                                            Most at Risk: {LEVEL_LABELS[data.summary.mostAtRisk]}
                                        </p>
                                        <p className="text-sm text-red-700 dark:text-red-300">
                                            Score: {data.levels[data.summary.mostAtRisk].performanceScore}/100
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Performance Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {ALL_LEVELS.map((level) => {
                            const metrics = data.levels[level];
                            const scoreColor = getScoreColor(metrics.performanceScore);
                            const scoreBgColor = getScoreBgColor(metrics.performanceScore);
                            const trendIcon = getTrendIcon(metrics.trend);
                            const trendColor = getTrendColor(metrics.trend);

                            return (
                                <Card key={level} className={`border-2 ${scoreBgColor}`}>
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm">
                                                {LEVEL_LABELS[level]}
                                            </CardTitle>
                                            <span className={`text-lg font-bold ${trendColor}`}>
                                                {trendIcon}
                                            </span>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {/* Score */}
                                        <div className="text-center pb-4 border-b">
                                            <p className={`text-4xl font-bold ${scoreColor}`}>
                                                {metrics.performanceScore}
                                            </p>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                Performance Score
                                            </p>
                                        </div>

                                        {/* Revenue Growth */}
                                        <div
                                            className="cursor-help"
                                            title={TOOLTIPS.marketPerformanceRevenueGrowth(
                                                comparisonPeriod
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                    Revenue Growth
                                                </span>
                                                <span className="text-xs font-semibold">
                                                    {metrics.revenueGrowth > 0 ? "+" : ""}
                                                    {metrics.revenueGrowth.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500"
                                                    style={{
                                                        width: `${Math.min(100, (metrics.revenueGrowth + 50) / 1)}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Customer Trend */}
                                        <div
                                            className="cursor-help"
                                            title={TOOLTIPS.marketPerformanceCustomerTrend}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                    Customer Trend
                                                </span>
                                                <span className="text-xs font-semibold">
                                                    {metrics.customerCountTrend > 0 ? "+" : ""}
                                                    {metrics.customerCountTrend.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500"
                                                    style={{
                                                        width: `${Math.min(100, (metrics.customerCountTrend + 50) / 1)}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Concentration Risk */}
                                        <div
                                            className="cursor-help"
                                            title={TOOLTIPS.marketPerformanceConcentration}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                    Concentration Risk
                                                </span>
                                                <span className="text-xs font-semibold">
                                                    {metrics.concentrationRisk.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-red-500"
                                                    style={{
                                                        width: `${Math.min(100, metrics.concentrationRisk)}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Methodology */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Calculation Methodology</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                            <div>
                                <h4 className="font-semibold mb-2">Performance Score Formula</h4>
                                <p className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded mb-2">
                                    (RevenueGrowth × 0.4 + CustomerTrend × 0.3 − ConcentrationRisk × 0.3)
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li>Revenue Growth: 40% weight — how fast are you growing?</li>
                                    <li>Customer Trend: 30% weight — are you gaining/losing customers?</li>
                                    <li>
                                        Concentration Risk: 30% weight (negative) — avoid over-reliance on few
                                        customers
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-2">Score Scale</h4>
                                <ul className="space-y-1 text-xs">
                                    <li>
                                        <strong>80-100:</strong> Strong market position and growth trajectory
                                    </li>
                                    <li>
                                        <strong>60-79:</strong> Moderate performance, room for improvement
                                    </li>
                                    <li>
                                        <strong>40-59:</strong> Needs attention, consider strategic initiatives
                                    </li>
                                    <li>
                                        <strong>Below 40:</strong> At-risk segment requiring action plan
                                    </li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <div className="text-center py-12">
                    <p className="text-gray-500">No data available</p>
                </div>
            )}
        </div>
    );
}
