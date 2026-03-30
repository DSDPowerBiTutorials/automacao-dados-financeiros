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
    Heart,
    Loader2,
    RefreshCw,
    Info,
    Play,
    Users,
    DollarSign,
    AlertCircle,
    RotateCcw,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
    LEVEL_LABELS,
    ALL_LEVELS,
    formatCurrency,
    ClientLevel,
} from "@/lib/executive-insights/level-utils";
import { TOOLTIPS } from "@/lib/executive-insights/tooltip-content";

interface CustomerHealthMetrics {
    customerCount: number;
    ltv: number;
    churnRate: number;
    avgOrderValue: number;
    repeatRate: number;
    recentTrend: "up" | "down" | "stable";
}

interface CustomerHealthData {
    levels: Record<ClientLevel, CustomerHealthMetrics>;
}

export default function CustomerHealthPage() {
    const [data, setData] = useState<CustomerHealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [faCodeFilter, setFaCodeFilter] = useState("all");

    const loadData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append("faCodeFilter", faCodeFilter);

            const res = await fetch(
                `/api/executive-insights/customer-health-by-level?${params}`,
                { cache: "no-store" }
            );
            const result = await res.json();

            if (result.data) {
                setData(result.data);
            }
        } catch (error) {
            console.error("Error loading customer health:", error);
            toast({
                title: "Error",
                description: "Failed to load customer health data",
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
                    <Heart className="h-8 w-8 text-red-600 dark:text-red-400" />
                    <div>
                        <PageHeader
                            title="Customer Health by Level"
                            subtitle="12-month snapshot"
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
                            const tip = TOOLTIPS.customerHealthHeader;
                            toast({
                                title: "Customer Health",
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div className="space-y-6">
                    {ALL_LEVELS.map((level) => {
                        const metrics = data.levels[level];
                        const trendIcon = getTrendIcon(metrics.recentTrend);
                        const trendColor = getTrendColor(metrics.recentTrend);

                        return (
                            <Card key={level}>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <span>{LEVEL_LABELS[level]}</span>
                                        <span className={`text-lg font-bold ${trendColor}`}>
                                            {trendIcon}
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                        {/* Customer Count */}
                                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Users className="h-4 w-4 text-gray-500" />
                                                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                                    Customers
                                                </p>
                                            </div>
                                            <p className="text-2xl font-bold">{metrics.customerCount}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                Active in period
                                            </p>
                                        </div>

                                        {/* LTV */}
                                        <div
                                            className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg cursor-help"
                                            title={TOOLTIPS.customerHealthLTV}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                                <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                                    Lifetime Value
                                                </p>
                                            </div>
                                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                                {formatCurrency(metrics.ltv)}
                                            </p>
                                            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                                                Per customer
                                            </p>
                                        </div>

                                        {/* Churn Rate */}
                                        <div
                                            className="bg-red-50 dark:bg-red-900 p-4 rounded-lg cursor-help"
                                            title={TOOLTIPS.customerHealthChurn}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                                <p className="text-xs font-medium text-red-700 dark:text-red-300">
                                                    Churn Rate
                                                </p>
                                            </div>
                                            <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                                                {metrics.churnRate.toFixed(1)}%
                                            </p>
                                            <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                                                Inactive &gt;90d
                                            </p>
                                        </div>

                                        {/* Avg Order Value */}
                                        <div
                                            className="bg-green-50 dark:bg-green-900 p-4 rounded-lg cursor-help"
                                            title={TOOLTIPS.customerHealthAvgOrderValue}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                                                <p className="text-xs font-medium text-green-700 dark:text-green-300">
                                                    Avg Order Value
                                                </p>
                                            </div>
                                            <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                                                {formatCurrency(metrics.avgOrderValue)}
                                            </p>
                                            <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                                                Per transaction
                                            </p>
                                        </div>

                                        {/* Repeat Rate */}
                                        <div
                                            className="bg-purple-50 dark:bg-purple-900 p-4 rounded-lg cursor-help"
                                            title={TOOLTIPS.customerHealthRepeatRate}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <RotateCcw className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                                <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
                                                    Repeat Rate
                                                </p>
                                            </div>
                                            <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                                                {metrics.repeatRate.toFixed(1)}%
                                            </p>
                                            <p className="text-xs text-purple-600 dark:text-purple-300 mt-1">
                                                2+ purchases
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12">
                    <p className="text-gray-500">No data available</p>
                </div>
            )}
        </div>
    );
}
