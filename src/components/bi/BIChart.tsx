"use client";

import {
    BarChart,
    Bar,
    LineChart,
    Line,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { type ChartType, type ChartDataPoint } from "@/lib/bi-types";
import { type BIMetric } from "@/lib/bi-types";
import { formatCurrency } from "@/lib/formatters";

interface BIChartProps {
    data: ChartDataPoint[];
    metrics: BIMetric[];
    chartType: ChartType;
    title?: string;
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

export function BIChart({ data, metrics, chartType, title }: BIChartProps) {
    if (metrics.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
                Select metrics from the sidebar
            </div>
        );
    }

    // For pie chart, aggregate totals
    if (chartType === "pie") {
        const pieData = metrics.map((m) => ({
            name: m.shortLabel,
            value: data.reduce((sum, d) => sum + (Number(d[m.id]) || 0), 0),
            color: m.color,
        }));

        return (
            <div className="h-full flex flex-col">
                {title && (
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 px-1">{title}</h4>
                )}
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius="40%"
                                outerRadius="75%"
                                paddingAngle={2}
                                dataKey="value"
                                nameKey="name"
                            >
                                {pieData.map((entry, i) => (
                                    <Cell key={i} fill={entry.color} stroke="transparent" />
                                ))}
                            </Pie>
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const item = payload[0];
                                    return (
                                        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 shadow-lg text-xs">
                                            <span className="text-gray-600 dark:text-gray-400">{item.name}: </span>
                                            <span className="font-mono font-medium text-gray-900 dark:text-white">
                                                {formatCurrency(Number(item.value), "EUR")}
                                            </span>
                                        </div>
                                    );
                                }}
                            />
                            <Legend
                                formatter={(value: string) => (
                                    <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    const commonAxisProps = {
        tick: { fontSize: 11, fill: "#9ca3af" },
        axisLine: { stroke: "#e5e7eb" },
        tickLine: false,
    };

    const renderChart = () => {
        switch (chartType) {
            case "bar":
                return (
                    <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                        <XAxis dataKey="month" {...commonAxisProps} />
                        <YAxis {...commonAxisProps} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend formatter={(v: string) => <span className="text-xs text-gray-600 dark:text-gray-400">{v}</span>} />
                        {metrics.map((m) => (
                            <Bar key={m.id} dataKey={m.id} name={m.shortLabel} fill={m.color} radius={[3, 3, 0, 0]} />
                        ))}
                    </BarChart>
                );

            case "line":
                return (
                    <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                        <XAxis dataKey="month" {...commonAxisProps} />
                        <YAxis {...commonAxisProps} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend formatter={(v: string) => <span className="text-xs text-gray-600 dark:text-gray-400">{v}</span>} />
                        {metrics.map((m) => (
                            <Line
                                key={m.id}
                                type="monotone"
                                dataKey={m.id}
                                name={m.shortLabel}
                                stroke={m.color}
                                strokeWidth={2}
                                dot={{ r: 3, fill: m.color }}
                                activeDot={{ r: 5 }}
                            />
                        ))}
                    </LineChart>
                );

            case "area":
            default:
                return (
                    <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <defs>
                            {metrics.map((m) => (
                                <linearGradient key={m.id} id={`fill-${m.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={m.color} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={m.color} stopOpacity={0.05} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                        <XAxis dataKey="month" {...commonAxisProps} />
                        <YAxis {...commonAxisProps} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend formatter={(v: string) => <span className="text-xs text-gray-600 dark:text-gray-400">{v}</span>} />
                        {metrics.map((m) => (
                            <Area
                                key={m.id}
                                type="monotone"
                                dataKey={m.id}
                                name={m.shortLabel}
                                stroke={m.color}
                                strokeWidth={2}
                                fill={`url(#fill-${m.id})`}
                            />
                        ))}
                    </AreaChart>
                );
        }
    };

    return (
        <div className="h-full flex flex-col">
            {title && (
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 px-1">{title}</h4>
            )}
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                </ResponsiveContainer>
            </div>
        </div>
    );
}
