"use client";

import {
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

export interface CostCenterData {
    name: string;
    value: number;
}

interface ExpensesByCostCenterProps {
    data: CostCenterData[];
}

function CustomTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    // eslint-disable-next-line
    payload?: any[];
    label?: string;
}) {
    if (!active || !payload || !payload[0]) return null;
    return (
        <div
            className="dashboard-tooltip"
            style={{
                borderRadius: 8,
                padding: "10px 14px",
            }}
        >
            <p className="dashboard-text-primary" style={{ fontWeight: 600, fontSize: 13 }}>
                {label}
            </p>
            <p className="dashboard-text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                €{payload[0].value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
        </div>
    );
}

export function ExpensesByCostCenter({ data }: ExpensesByCostCenterProps) {
    // Gradient bar colors
    const BAR_COLORS = [
        "#ef4444",
        "#f97316",
        "#f59e0b",
        "#eab308",
        "#84cc16",
        "#22c55e",
        "#14b8a6",
        "#06b6d4",
    ];

    const dataWithColors = data.map((item, i) => ({
        ...item,
        fill: BAR_COLORS[i % BAR_COLORS.length],
    }));

    return (
        <div className="dashboard-card h-full">
            <div className="dashboard-card-header">
                <h3 className="text-sm font-semibold dashboard-text-primary">
                    Despesas por Centro de Custo
                </h3>
                <p className="text-xs dashboard-text-muted mt-0.5">
                    Top 8 centros de custo por volume
                </p>
            </div>
            <div className="dashboard-card-content">
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                        data={dataWithColors}
                        layout="vertical"
                        margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#2a3142"
                            horizontal={false}
                        />
                        <XAxis
                            type="number"
                            stroke="#6b7280"
                            tick={{ fill: "#6b7280", fontSize: 11 }}
                            axisLine={{ stroke: "#2a3142" }}
                            tickLine={false}
                            tickFormatter={(v: number) => {
                                if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
                                if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}K`;
                                return `€${v}`;
                            }}
                        />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={100}
                            stroke="#6b7280"
                            tick={{ fill: "#9ca3af", fontSize: 11 }}
                            axisLine={{ stroke: "#2a3142" }}
                            tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar
                            dataKey="value"
                            radius={[0, 4, 4, 0]}
                            barSize={18}
                        >
                            {dataWithColors.map((entry, idx) => (
                                <Cell key={idx} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
