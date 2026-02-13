"use client";

export interface ReconciliationSource {
    source: string;
    label: string;
    total: number;
    reconciled: number;
    color: string;
}

interface ReconciliationStatusProps {
    data: ReconciliationSource[];
}

const SOURCE_COLORS: Record<string, string> = {
    "bankinter-eur": "#10b981",
    "bankinter-usd": "#34d399",
    "sabadell-eur": "#3b82f6",
    "chase-usd": "#06b6d4",
    braintree: "#818cf8",
    "braintree-eur": "#818cf8",
    "braintree-usd": "#6366f1",
    stripe: "#a78bfa",
    "stripe-eur": "#a78bfa",
    "stripe-usd": "#8b5cf6",
    gocardless: "#fbbf24",
    paypal: "#60a5fa",
    pleo: "#f472b6",
};

export function getSourceColor(source: string): string {
    return SOURCE_COLORS[source] || "#6b7280";
}

export function ReconciliationStatus({ data }: ReconciliationStatusProps) {
    return (
        <div className="dashboard-card h-full">
            <div className="dashboard-card-header">
                <h3 className="text-sm font-semibold dashboard-text-primary">
                    Reconciliação por Fonte
                </h3>
                <p className="text-xs dashboard-text-muted mt-0.5">
                    Progresso de reconciliação por canal
                </p>
            </div>
            <div className="dashboard-card-content space-y-3">
                {data.length === 0 ? (
                    <p className="text-xs dashboard-text-muted text-center py-4">
                        Sem dados de reconciliação
                    </p>
                ) : (
                    data.map((item) => {
                        const pct =
                            item.total > 0
                                ? Math.round((item.reconciled / item.total) * 100)
                                : 0;
                        const color = item.color || getSourceColor(item.source);

                        return (
                            <div key={item.source}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs dashboard-text-secondary truncate">
                                        {item.label}
                                    </span>
                                    <span className="text-xs font-semibold dashboard-text-primary ml-2">
                                        {pct}%
                                    </span>
                                </div>
                                <div className="dashboard-progress-track">
                                    <div
                                        className="dashboard-progress-fill"
                                        style={{
                                            width: `${pct}%`,
                                            background: color,
                                        }}
                                    />
                                </div>
                                <div className="flex justify-between mt-0.5">
                                    <span className="text-[0.625rem] dashboard-text-muted">
                                        {item.reconciled.toLocaleString("pt-BR")} de{" "}
                                        {item.total.toLocaleString("pt-BR")}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
