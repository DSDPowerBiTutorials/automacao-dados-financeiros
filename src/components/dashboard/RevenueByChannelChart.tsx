"use client";

import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
} from "recharts";

export interface ChannelData {
    name: string;
    value: number;
    color: string;
}

interface RevenueByChannelChartProps {
    data: ChannelData[];
}

const CHANNEL_COLORS: Record<string, string> = {
    braintree: "#818cf8",
    stripe: "#a78bfa",
    gocardless: "#fbbf24",
    paypal: "#60a5fa",
    other: "#6b7280",
};

function getChannelColor(name: string): string {
    const lower = name.toLowerCase();
    for (const [key, color] of Object.entries(CHANNEL_COLORS)) {
        if (lower.includes(key)) return color;
    }
    return CHANNEL_COLORS.other;
}

function CustomTooltip({
    active,
    payload,
}: {
    active?: boolean;
    // eslint-disable-next-line
    payload?: any[];
}) {
    if (!active || !payload || !payload[0]) return null;
    const item = payload[0];
    return (
        <div
            className="dashboard-tooltip"
            style={{
                borderRadius: 8,
                padding: "10px 14px",
            }}
        >
            <p className="dashboard-text-primary" style={{ fontWeight: 600, fontSize: 13 }}>
                {item.name}
            </p>
            <p className="dashboard-text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                €{item.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
        </div>
    );
}

export function RevenueByChannelChart({ data }: RevenueByChannelChartProps) {
    const total = data.reduce((sum, d) => sum + d.value, 0);

    const dataWithColors = data.map((d) => ({
        ...d,
        color: d.color || getChannelColor(d.name),
    }));

    return (
        <div className="dashboard-card h-full">
            <div className="dashboard-card-header">
                <h3 className="text-sm font-semibold dashboard-text-primary">
                    Receita por Canal
                </h3>
                <p className="text-xs dashboard-text-muted mt-0.5">
                    Distribuição por fonte de pagamento
                </p>
            </div>
            <div className="dashboard-card-content flex flex-col lg:flex-row items-center gap-4">
                <div className="w-48 h-48 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={dataWithColors}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={80}
                                paddingAngle={3}
                                dataKey="value"
                                stroke="none"
                            >
                                {dataWithColors.map((entry, idx) => (
                                    <Cell key={idx} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2 w-full">
                    {dataWithColors.map((item) => {
                        const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
                        return (
                            <div key={item.name} className="flex items-center gap-3">
                                <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ background: item.color }}
                                />
                                <span className="text-xs dashboard-text-secondary flex-1 truncate">
                                    {item.name}
                                </span>
                                <span className="text-xs font-semibold dashboard-text-primary">
                                    {pct}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
