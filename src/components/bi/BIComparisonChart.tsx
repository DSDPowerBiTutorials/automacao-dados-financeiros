"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";

interface ComparisonDataPoint {
    month: string;
    revenue: number;
    expenses: number;
    net: number;
}

interface BIComparisonChartProps {
    data: ComparisonDataPoint[];
}

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 shadow-lg text-xs">
            <p className="font-semibold text-gray-900 dark:text-white mb-1.5">{label}</p>
            {payload.map((entry: any) => (
                <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-gray-600 dark:text-gray-400">{entry.name}</span>
                    <span className="ml-auto font-mono font-medium text-gray-900 dark:text-white">
                        {formatCurrency(entry.value, "EUR")}
                    </span>
                </div>
            ))}
        </div>
    );
}

export function BIComparisonChart({ data }: BIComparisonChartProps) {
    return (
        <div className="h-full flex flex-col">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 px-1">
                Revenue vs Expenses
            </h4>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <defs>
                            <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                            </linearGradient>
                            <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend formatter={(v: string) => <span className="text-xs text-gray-600 dark:text-gray-400">{v}</span>} />
                        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} fill="url(#fillRevenue)" />
                        <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} fill="url(#fillExpenses)" />
                        <Area type="monotone" dataKey="net" name="Net Result" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
