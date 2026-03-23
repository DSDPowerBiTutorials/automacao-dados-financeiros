"use client";

import { BarChart3, LineChart, AreaChart, PieChart } from "lucide-react";
import { type ChartType, type Granularity } from "@/lib/bi-types";

interface BIFilterBarProps {
    year: string;
    onYearChange: (year: string) => void;
    chartType: ChartType;
    onChartTypeChange: (type: ChartType) => void;
    granularity: Granularity;
    onGranularityChange: (g: Granularity) => void;
}

const YEARS = ["2024", "2025", "2026"];

const CHART_TYPES: { value: ChartType; icon: React.ElementType; label: string }[] = [
    { value: "bar", icon: BarChart3, label: "Bar" },
    { value: "line", icon: LineChart, label: "Line" },
    { value: "area", icon: AreaChart, label: "Area" },
    { value: "pie", icon: PieChart, label: "Pie" },
];

const GRANULARITIES: { value: Granularity; label: string }[] = [
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "ytd", label: "YTD" },
];

export function BIFilterBar({
    year,
    onYearChange,
    chartType,
    onChartTypeChange,
    granularity,
    onGranularityChange,
}: BIFilterBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            {/* Year selector */}
            <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Year</span>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {YEARS.map((y) => (
                        <button
                            key={y}
                            onClick={() => onYearChange(y)}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${year === y
                                    ? "bg-[#FF7300] text-white"
                                    : "bg-white dark:bg-[#111111] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                }`}
                        >
                            {y}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart type selector */}
            <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Chart</span>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {CHART_TYPES.map(({ value, icon: Icon, label }) => (
                        <button
                            key={value}
                            onClick={() => onChartTypeChange(value)}
                            title={label}
                            className={`px-2.5 py-1.5 transition-colors ${chartType === value
                                    ? "bg-[#FF7300] text-white"
                                    : "bg-white dark:bg-[#111111] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                        </button>
                    ))}
                </div>
            </div>

            {/* Granularity selector */}
            <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Period</span>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {GRANULARITIES.map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => onGranularityChange(value)}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${granularity === value
                                    ? "bg-[#FF7300] text-white"
                                    : "bg-white dark:bg-[#111111] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
