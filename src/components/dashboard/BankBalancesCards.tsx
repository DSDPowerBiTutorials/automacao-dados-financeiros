"use client";

import { Landmark } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

export interface BankBalance {
    bank: string;
    currency: string;
    balance: number;
    lastDate: string;
    source: string;
}

interface BankBalancesCardsProps {
    data: BankBalance[];
}

const BANK_ICONS: Record<string, { bg: string; text: string }> = {
    bankinter: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
    sabadell: { bg: "bg-blue-500/10", text: "text-blue-400" },
    chase: { bg: "bg-cyan-500/10", text: "text-cyan-400" },
};

function getBankStyle(source: string) {
    const lower = source.toLowerCase();
    for (const [key, style] of Object.entries(BANK_ICONS)) {
        if (lower.includes(key)) return style;
    }
    return { bg: "bg-gray-500/10", text: "text-gray-500 dark:text-gray-400" };
}

export function BankBalancesCards({ data }: BankBalancesCardsProps) {
    return (
        <div className="dashboard-card h-full">
            <div className="dashboard-card-header">
                <h3 className="text-sm font-semibold dashboard-text-primary">
                    Saldos Bancários
                </h3>
                <p className="text-xs dashboard-text-muted mt-0.5">
                    Último saldo registado por conta
                </p>
            </div>
            <div className="dashboard-card-content space-y-3">
                {data.length === 0 ? (
                    <p className="text-xs dashboard-text-muted text-center py-4">
                        Sem dados de saldo disponíveis
                    </p>
                ) : (
                    data.map((item) => {
                        const style = getBankStyle(item.source);
                        return (
                            <div
                                key={item.source}
                                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-black/40"
                            >
                                <div
                                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${style.bg}`}
                                >
                                    <Landmark className={`w-4 h-4 ${style.text}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold dashboard-text-primary truncate">
                                        {item.bank}
                                    </p>
                                    <p className="text-[0.625rem] dashboard-text-muted">
                                        {item.lastDate} · {item.currency}
                                    </p>
                                </div>
                                <p
                                    className={`text-sm font-bold ${item.balance >= 0 ? "text-emerald-400" : "text-red-400"
                                        }`}
                                >
                                    {formatCurrency(item.balance, item.currency)}
                                </p>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
