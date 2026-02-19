"use client";

import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShieldCheck,
    Clock,
    Landmark,
    ArrowLeftRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

export interface KPIData {
    revenueMonth: number;
    expenseMonth: number;
    netResult: number;
    reconciliationRate: number;
    pendingTransactions: number;
    totalBankBalance: number;
    intercompanyRevenue?: number;
    intercompanyExpense?: number;
    bankBalanceDate?: string;
    revenueCurrency?: string;
}

interface KPIStripProps {
    data: KPIData;
    showIntercompany?: boolean;
    onToggleIntercompany?: () => void;
}

export function KPIStrip({ data, showIntercompany, onToggleIntercompany }: KPIStripProps) {
    const balanceDateStr = data.bankBalanceDate
        ? new Date(data.bankBalanceDate + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
        : "";

    const cards = [
        {
            label: "Receita (mês)",
            value: formatCurrency(data.revenueMonth, "EUR"),
            icon: TrendingUp,
            iconColor: "text-emerald-400",
            kpiClass: "kpi-revenue",
            icValue: data.intercompanyRevenue ? formatCurrency(data.intercompanyRevenue, "EUR") : null,
            icLabel: "IC",
        },
        {
            label: "Despesas (mês)",
            value: formatCurrency(data.expenseMonth, "EUR"),
            icon: TrendingDown,
            iconColor: "text-red-400",
            kpiClass: "kpi-expense",
            icValue: data.intercompanyExpense ? formatCurrency(data.intercompanyExpense, "EUR") : null,
            icLabel: "IC",
        },
        {
            label: "Resultado Líquido",
            value: formatCurrency(data.netResult, "EUR"),
            icon: DollarSign,
            iconColor: data.netResult >= 0 ? "text-blue-400" : "text-red-400",
            kpiClass: "kpi-net",
            valueColor: data.netResult >= 0 ? "text-emerald-400" : "text-red-400",
        },
        {
            label: "Taxa de Reconciliação",
            value: `${data.reconciliationRate}%`,
            icon: ShieldCheck,
            iconColor: "text-amber-400",
            kpiClass: "kpi-reconciliation",
        },
        {
            label: "Transações Pendentes",
            value: data.pendingTransactions.toLocaleString("pt-BR"),
            icon: Clock,
            iconColor: "text-violet-400",
            kpiClass: "kpi-pending",
        },
        {
            label: "Current Bank Balance",
            value: formatCurrency(data.totalBankBalance, "EUR"),
            icon: Landmark,
            iconColor: "text-cyan-400",
            kpiClass: "kpi-balance",
            subtitle: balanceDateStr,
        },
    ];

    return (
        <div className="space-y-2">
            {/* Intercompany Toggle */}
            {onToggleIntercompany && (
                <div className="flex justify-end">
                    <button
                        onClick={onToggleIntercompany}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showIntercompany
                            ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                            : "bg-gray-100 dark:bg-black/60 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:bg-[#0a0a0a]/60"
                            }`}
                    >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        Intercompany
                    </button>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className={`dashboard-kpi ${card.kpiClass}`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[0.6875rem] font-medium dashboard-text-muted uppercase tracking-wider">
                                    {card.label}
                                </span>
                                <Icon className={`w-4 h-4 ${card.iconColor}`} />
                            </div>
                            <p
                                className={`text-xl font-bold tracking-tight ${card.valueColor || "dashboard-text-primary"
                                    }`}
                            >
                                {card.value}
                            </p>
                            {/* Bank balance reference date */}
                            {"subtitle" in card && card.subtitle && (
                                <p className="text-[0.5625rem] dashboard-text-muted mt-1">
                                    {card.subtitle}
                                </p>
                            )}
                            {/* Intercompany sub-line */}
                            {showIntercompany && "icValue" in card && card.icValue && (
                                <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-700/50">
                                    <ArrowLeftRight className="w-3 h-3 text-violet-400" />
                                    <span className="text-[0.5625rem] text-violet-300 font-medium">
                                        {card.icLabel}: {card.icValue}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
