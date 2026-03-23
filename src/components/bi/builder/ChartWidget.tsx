"use client";

import { useState } from "react";
import { Settings, BarChart3, LineChart, AreaChart as AreaChartIcon, PieChart as PieChartIcon } from "lucide-react";
import { type ChartWidgetConfig, type ChartType } from "@/lib/bi-types";
import { useDroppable } from "@dnd-kit/core";
import {
    BarChart, Bar, LineChart as RechartsLineChart, Line,
    AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    RadarChart, Radar, PolarGrid, PolarAngleAxis,
    ComposedChart, FunnelChart, Funnel, LabelList,
    ScatterChart, Scatter, Treemap,
} from "recharts";

interface ChartWidgetProps {
    config: ChartWidgetConfig;
    onUpdate: (updates: Partial<ChartWidgetConfig>) => void;
    height?: number;
}

const CHART_TYPE_OPTIONS: { value: ChartType; label: string; icon: React.ElementType }[] = [
    { value: "bar", label: "Bar Vertical", icon: BarChart3 },
    { value: "bar-horizontal", label: "Bar Horizontal", icon: BarChart3 },
    { value: "bar-stacked", label: "Bar Stacked", icon: BarChart3 },
    { value: "line", label: "Line", icon: LineChart },
    { value: "area", label: "Area", icon: AreaChartIcon },
    { value: "area-stacked", label: "Area Stacked", icon: AreaChartIcon },
    { value: "pie", label: "Pie", icon: PieChartIcon },
    { value: "donut", label: "Donut", icon: PieChartIcon },
    { value: "combo-bar-line", label: "Bar + Line", icon: BarChart3 },
    { value: "radar", label: "Radar", icon: BarChart3 },
    { value: "treemap", label: "Treemap", icon: BarChart3 },
    { value: "funnel", label: "Funnel", icon: BarChart3 },
    { value: "scatter", label: "Scatter", icon: BarChart3 },
    { value: "waterfall", label: "Waterfall", icon: BarChart3 },
];

// Sample data for preview
const SAMPLE_DATA = [
    { name: "Jan", value: 400, value2: 240 },
    { name: "Feb", value: 300, value2: 139 },
    { name: "Mar", value: 500, value2: 380 },
    { name: "Apr", value: 280, value2: 200 },
    { name: "May", value: 590, value2: 430 },
    { name: "Jun", value: 350, value2: 310 },
];

const COLORS = ["#FF7300", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#f59e0b"];

export function ChartWidget({ config, onUpdate, height = 200 }: ChartWidgetProps) {
    const [showConfig, setShowConfig] = useState(false);
    const { setNodeRef, isOver } = useDroppable({
        id: `chart-drop-${Math.random().toString(36).slice(2)}`,
        data: { type: "chart", onDrop: (measureId: string) => onUpdate({ measureIds: [...config.measureIds, measureId] }) },
    });

    const renderChart = () => {
        const commonAxis = { tick: { fontSize: 9, fill: "#9ca3af" }, axisLine: false, tickLine: false };

        switch (config.chartType) {
            case "bar":
            case "bar-stacked":
                return (
                    <BarChart data={SAMPLE_DATA} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />}
                        <XAxis dataKey="name" {...commonAxis} />
                        <YAxis {...commonAxis} />
                        <Tooltip />
                        <Bar dataKey="value" fill={COLORS[0]} radius={[2, 2, 0, 0]} stackId={config.chartType === "bar-stacked" ? "a" : undefined} />
                        <Bar dataKey="value2" fill={COLORS[1]} radius={[2, 2, 0, 0]} stackId={config.chartType === "bar-stacked" ? "a" : undefined} />
                    </BarChart>
                );

            case "bar-horizontal":
                return (
                    <BarChart data={SAMPLE_DATA} layout="vertical" margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                        {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />}
                        <XAxis type="number" {...commonAxis} />
                        <YAxis type="category" dataKey="name" {...commonAxis} width={30} />
                        <Tooltip />
                        <Bar dataKey="value" fill={COLORS[0]} radius={[0, 2, 2, 0]} />
                    </BarChart>
                );

            case "line":
                return (
                    <RechartsLineChart data={SAMPLE_DATA} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />}
                        <XAxis dataKey="name" {...commonAxis} />
                        <YAxis {...commonAxis} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 2 }} />
                        <Line type="monotone" dataKey="value2" stroke={COLORS[1]} strokeWidth={2} dot={{ r: 2 }} />
                    </RechartsLineChart>
                );

            case "area":
            case "area-stacked":
                return (
                    <AreaChart data={SAMPLE_DATA} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <defs>
                            <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0.05} />
                            </linearGradient>
                            <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={COLORS[1]} stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />}
                        <XAxis dataKey="name" {...commonAxis} />
                        <YAxis {...commonAxis} />
                        <Tooltip />
                        <Area type="monotone" dataKey="value" stroke={COLORS[0]} fill="url(#grad1)" stackId={config.chartType === "area-stacked" ? "a" : undefined} />
                        <Area type="monotone" dataKey="value2" stroke={COLORS[1]} fill="url(#grad2)" stackId={config.chartType === "area-stacked" ? "a" : undefined} />
                    </AreaChart>
                );

            case "pie":
            case "donut":
                return (
                    <PieChart>
                        <Pie
                            data={SAMPLE_DATA}
                            cx="50%" cy="50%"
                            innerRadius={config.chartType === "donut" ? "40%" : 0}
                            outerRadius="75%"
                            dataKey="value"
                            nameKey="name"
                            paddingAngle={2}
                        >
                            {SAMPLE_DATA.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                );

            case "combo-bar-line":
                return (
                    <ComposedChart data={SAMPLE_DATA} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />}
                        <XAxis dataKey="name" {...commonAxis} />
                        <YAxis {...commonAxis} />
                        <Tooltip />
                        <Bar dataKey="value" fill={COLORS[0]} radius={[2, 2, 0, 0]} />
                        <Line type="monotone" dataKey="value2" stroke={COLORS[1]} strokeWidth={2} />
                    </ComposedChart>
                );

            case "radar":
                return (
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={SAMPLE_DATA}>
                        <PolarGrid stroke="#e5e7eb" />
                        <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                        <Radar dataKey="value" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.3} />
                    </RadarChart>
                );

            case "funnel":
                return (
                    <FunnelChart>
                        <Tooltip />
                        <Funnel dataKey="value" data={SAMPLE_DATA} isAnimationActive>
                            {SAMPLE_DATA.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            <LabelList position="center" fill="#fff" fontSize={9} />
                        </Funnel>
                    </FunnelChart>
                );

            case "scatter":
                return (
                    <ScatterChart margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />}
                        <XAxis type="number" dataKey="value" {...commonAxis} />
                        <YAxis type="number" dataKey="value2" {...commonAxis} />
                        <Tooltip />
                        <Scatter data={SAMPLE_DATA} fill={COLORS[0]} />
                    </ScatterChart>
                );

            case "treemap":
                return (
                    <Treemap
                        data={SAMPLE_DATA.map((d, i) => ({ ...d, fill: COLORS[i % COLORS.length] }))}
                        dataKey="value"
                        aspectRatio={4 / 3}
                        stroke="#fff"
                    />
                );

            case "waterfall":
                // Simplified waterfall using bar with custom colors
                return (
                    <BarChart data={SAMPLE_DATA.map((d, i) => ({
                        ...d,
                        positive: i === 0 || d.value > (SAMPLE_DATA[i - 1]?.value ?? 0) ? d.value : 0,
                        negative: i > 0 && d.value <= (SAMPLE_DATA[i - 1]?.value ?? 0) ? d.value : 0,
                    }))} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />}
                        <XAxis dataKey="name" {...commonAxis} />
                        <YAxis {...commonAxis} />
                        <Tooltip />
                        <Bar dataKey="positive" fill="#10b981" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="negative" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    </BarChart>
                );

            default:
                return (
                    <BarChart data={SAMPLE_DATA}>
                        <Bar dataKey="value" fill={COLORS[0]} />
                    </BarChart>
                );
        }
    };

    return (
        <div
            ref={setNodeRef}
            className={`relative bg-white dark:bg-[#111111] border rounded-xl p-3 group transition-all
                ${isOver ? "border-[#FF7300] ring-1 ring-[#FF7300]" : "border-gray-200 dark:border-gray-800"}`}
            style={{ height }}
        >
            {/* Config button */}
            <button
                onClick={() => setShowConfig(!showConfig)}
                className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all z-10"
            >
                <Settings size={12} className="text-gray-400" />
            </button>

            {/* Title */}
            {config.title && (
                <h4 className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 mb-1 px-1">{config.title}</h4>
            )}

            {/* Chart */}
            <div className="w-full" style={{ height: height - 40 }}>
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                </ResponsiveContainer>
            </div>

            {/* Chart type config panel */}
            {showConfig && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 max-h-60 overflow-y-auto">
                    <input
                        type="text"
                        value={config.title ?? ""}
                        onChange={(e) => onUpdate({ title: e.target.value })}
                        placeholder="Chart title"
                        className="w-full text-xs px-2 py-1.5 mb-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-[#FF7300] outline-none"
                    />
                    <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Chart Type</p>
                    <div className="grid grid-cols-3 gap-1.5">
                        {CHART_TYPE_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => onUpdate({ chartType: opt.value })}
                                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-colors
                                        ${config.chartType === opt.value
                                            ? "bg-[#FF7300] text-white"
                                            : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        }`}
                                >
                                    <Icon size={10} />
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <label className="flex items-center gap-1.5 text-[9px] text-gray-500">
                            <input
                                type="checkbox"
                                checked={config.showLegend ?? true}
                                onChange={(e) => onUpdate({ showLegend: e.target.checked })}
                                className="rounded border-gray-300"
                            />
                            Legend
                        </label>
                        <label className="flex items-center gap-1.5 text-[9px] text-gray-500">
                            <input
                                type="checkbox"
                                checked={config.showGrid ?? true}
                                onChange={(e) => onUpdate({ showGrid: e.target.checked })}
                                className="rounded border-gray-300"
                            />
                            Grid
                        </label>
                    </div>
                    <button onClick={() => setShowConfig(false)} className="w-full mt-2 text-[10px] text-[#FF7300] hover:underline font-medium">
                        Done
                    </button>
                </div>
            )}
        </div>
    );
}
