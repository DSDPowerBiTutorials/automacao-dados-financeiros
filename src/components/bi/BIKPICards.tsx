"use client";

import { TrendingUp, TrendingDown, DollarSign, Percent } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatters";

interface BIKPICardsProps {
    totalRevenue: number;
    totalExpenses: number;
    grossProfit: number;
    netMargin: number;
    loading?: boolean;
}

export function BIKPICards({ totalRevenue, totalExpenses, grossProfit, netMargin, loading }: BIKPICardsProps) {
    const cards = [
        {
            label: "Total Revenue",
            value: formatCurrency(totalRevenue, "EUR"),
            icon: TrendingUp,
            iconColor: "text-emerald-500",
            bgColor: "bg-emerald-50 dark:bg-emerald-500/10",
        },
        {
            label: "Total Expenses",
            value: formatCurrency(totalExpenses, "EUR"),
            icon: TrendingDown,
            iconColor: "text-red-500",
            bgColor: "bg-red-50 dark:bg-red-500/10",
        },
        {
            label: "Gross Profit",
            value: formatCurrency(grossProfit, "EUR"),
            icon: DollarSign,
            iconColor: grossProfit >= 0 ? "text-blue-500" : "text-red-500",
            bgColor: grossProfit >= 0 ? "bg-blue-50 dark:bg-blue-500/10" : "bg-red-50 dark:bg-red-500/10",
            valueColor: grossProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
        },
        {
            label: "Net Margin",
            value: `${formatNumber(netMargin, 1)}%`,
            icon: Percent,
            iconColor: netMargin >= 0 ? "text-violet-500" : "text-red-500",
            bgColor: netMargin >= 0 ? "bg-violet-50 dark:bg-violet-500/10" : "bg-red-50 dark:bg-red-500/10",
            valueColor: netMargin >= 0 ? "text-violet-600 dark:text-violet-400" : "text-red-600 dark:text-red-400",
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((card) => {
                const Icon = card.icon;
                return (
                    <div
                        key={card.label}
                        className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-xl p-4 transition-shadow hover:shadow-md"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {card.label}
                            </span>
                            <div className={`p-1.5 rounded-lg ${card.bgColor}`}>
                                <Icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
                            </div>
                        </div>
                        {loading ? (
                            <div className="h-7 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        ) : (
                            <p className={`text-xl font-bold tracking-tight ${card.valueColor || "text-gray-900 dark:text-white"}`}>
                                {card.value}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
