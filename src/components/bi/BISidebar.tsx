"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { REVENUE_METRICS, EXPENSE_METRICS } from "@/lib/bi-metrics";
import { type BIMetric } from "@/lib/bi-types";

interface BISidebarProps {
    selectedMetrics: string[];
    onToggleMetric: (id: string) => void;
    onSelectAll: (type: "revenue" | "expense") => void;
    onDeselectAll: (type: "revenue" | "expense") => void;
}

function MetricGroup({
    title,
    metrics,
    selectedMetrics,
    onToggleMetric,
    onSelectAll,
    onDeselectAll,
    defaultOpen,
}: {
    title: string;
    metrics: BIMetric[];
    selectedMetrics: string[];
    onToggleMetric: (id: string) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    defaultOpen: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const allSelected = metrics.every((m) => selectedMetrics.includes(m.id));
    const someSelected = metrics.some((m) => selectedMetrics.includes(m.id));

    return (
        <div className="mb-1">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            >
                {open ? (
                    <ChevronDown className="w-3.5 h-3.5 mr-1.5" />
                ) : (
                    <ChevronRight className="w-3.5 h-3.5 mr-1.5" />
                )}
                {title}
                <span className="ml-auto text-[10px] font-normal text-gray-400">
                    {metrics.filter((m) => selectedMetrics.includes(m.id)).length}/{metrics.length}
                </span>
            </button>

            {open && (
                <div className="mt-0.5 space-y-0.5">
                    {/* Select all / deselect all */}
                    <button
                        onClick={allSelected ? onDeselectAll : onSelectAll}
                        className="w-full px-3 py-1 text-[10px] text-left font-medium text-[#FF7300] hover:underline"
                    >
                        {allSelected ? "Deselect All" : "Select All"}
                    </button>

                    {metrics.map((metric) => {
                        const isSelected = selectedMetrics.includes(metric.id);
                        return (
                            <button
                                key={metric.id}
                                onClick={() => onToggleMetric(metric.id)}
                                className={`flex items-center w-full px-3 py-1.5 rounded-md text-xs transition-all ${isSelected
                                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium"
                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                                    }`}
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-sm mr-2.5 flex-shrink-0 border"
                                    style={{
                                        backgroundColor: isSelected ? metric.color : "transparent",
                                        borderColor: metric.color,
                                    }}
                                >
                                    {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                </span>
                                <span className="truncate">{metric.label}</span>
                                <span className="ml-auto text-[10px] text-gray-400 font-mono">{metric.faCode}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function BISidebar({ selectedMetrics, onToggleMetric, onSelectAll, onDeselectAll }: BISidebarProps) {
    return (
        <aside className="w-64 xl:w-72 flex-shrink-0 bg-white dark:bg-[#111111] border-l border-gray-200 dark:border-gray-800 overflow-y-auto">
            <div className="p-3 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                    Variables
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Select metrics to visualize
                </p>
            </div>

            <div className="p-2">
                <MetricGroup
                    title="Revenue"
                    metrics={REVENUE_METRICS}
                    selectedMetrics={selectedMetrics}
                    onToggleMetric={onToggleMetric}
                    onSelectAll={() => onSelectAll("revenue")}
                    onDeselectAll={() => onDeselectAll("revenue")}
                    defaultOpen={true}
                />
                <MetricGroup
                    title="Expenses"
                    metrics={EXPENSE_METRICS}
                    selectedMetrics={selectedMetrics}
                    onToggleMetric={onToggleMetric}
                    onSelectAll={() => onSelectAll("expense")}
                    onDeselectAll={() => onDeselectAll("expense")}
                    defaultOpen={true}
                />
            </div>
        </aside>
    );
}
