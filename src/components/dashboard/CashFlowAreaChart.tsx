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

export interface CashFlowPoint {
    month: string;
    inflow: number;
    outflow: number;
    net: number;
    icInflow?: number;
    icOutflow?: number;
}

interface CashFlowAreaChartProps {
    data: CashFlowPoint[];
    showIntercompany?: boolean;
}

function CustomTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: Array<{ value: number; name: string; color: string }>;
    label?: string;
}) {
    if (!active || !payload) return null;
    return (
        <div className="dashboard-tooltip" style={{ borderRadius: 8, padding: "12px 16px" }}>
            <p className="dashboard-text-primary" style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                {label}
            </p>
            {payload.map((entry) => (
                <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: entry.color,
                            display: "inline-block",
                        }}
                    />
                    <span className="dashboard-text-muted" style={{ fontSize: 12 }}>{entry.name}:</span>
                    <span className="dashboard-text-primary" style={{ fontWeight: 600, fontSize: 12 }}>
                        €{entry.value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                    </span>
                </div>
            ))}
        </div>
    );
}

export function CashFlowAreaChart({ data, showIntercompany }: CashFlowAreaChartProps) {
    const formatValue = (value: number) => {
        if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
        if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
        return `€${value}`;
    };

    return (
        <div className="dashboard-card">
            <div className="dashboard-card-header">
                <h3 className="text-sm font-semibold dashboard-text-primary">
                    Cash Flow — Últimos 12 Meses
                </h3>
                <p className="text-xs dashboard-text-muted mt-0.5">
                    Entrada, saída e resultado líquido mensal
                </p>
            </div>
            <div className="dashboard-card-content">
                <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="gradInflow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gradOutflow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gradICInflow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gradICOutflow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
                        <XAxis
                            dataKey="month"
                            stroke="#6b7280"
                            tick={{ fill: "#6b7280", fontSize: 11 }}
                            axisLine={{ stroke: "#2a3142" }}
                            tickLine={false}
                        />
                        <YAxis
                            stroke="#6b7280"
                            tick={{ fill: "#6b7280", fontSize: 11 }}
                            axisLine={{ stroke: "#2a3142" }}
                            tickLine={false}
                            tickFormatter={formatValue}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
                            iconType="circle"
                            iconSize={8}
                            formatter={(value: string) => (
                                <span className="dashboard-text-muted" style={{ fontSize: 12 }}>{value}</span>
                            )}
                        />
                        <Area
                            type="monotone"
                            dataKey="inflow"
                            name="Entrada"
                            stroke="#10b981"
                            strokeWidth={2}
                            fill="url(#gradInflow)"
                            dot={false}
                            activeDot={{ r: 4, fill: "#10b981", stroke: "#0f1419", strokeWidth: 2 }}
                        />
                        <Area
                            type="monotone"
                            dataKey="outflow"
                            name="Saída"
                            stroke="#ef4444"
                            strokeWidth={2}
                            fill="url(#gradOutflow)"
                            dot={false}
                            activeDot={{ r: 4, fill: "#ef4444", stroke: "#0f1419", strokeWidth: 2 }}
                        />
                        <Area
                            type="monotone"
                            dataKey="net"
                            name="Líquido"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            fill="none"
                            dot={false}
                            activeDot={{ r: 5, fill: "#3b82f6", stroke: "#0f1419", strokeWidth: 2 }}
                            strokeDasharray="6 3"
                        />
                        {showIntercompany && (
                            <>
                                <Area
                                    type="monotone"
                                    dataKey="icInflow"
                                    name="IC Entrada"
                                    stroke="#8b5cf6"
                                    strokeWidth={1.5}
                                    fill="url(#gradICInflow)"
                                    dot={false}
                                    activeDot={{ r: 3, fill: "#8b5cf6", stroke: "#0f1419", strokeWidth: 2 }}
                                    strokeDasharray="4 2"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="icOutflow"
                                    name="IC Saída"
                                    stroke="#f59e0b"
                                    strokeWidth={1.5}
                                    fill="url(#gradICOutflow)"
                                    dot={false}
                                    activeDot={{ r: 3, fill: "#f59e0b", stroke: "#0f1419", strokeWidth: 2 }}
                                    strokeDasharray="4 2"
                                />
                            </>
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
