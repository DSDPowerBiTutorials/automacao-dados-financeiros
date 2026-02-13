"use client";

import { formatCurrency, formatDate } from "@/lib/formatters";

export interface RecentTransaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    currency: string;
    source: string;
    reconciled: boolean;
}

interface RecentTransactionsProps {
    data: RecentTransaction[];
}

function getSourceBadgeClass(source: string): string {
    const lower = source.toLowerCase();
    if (lower.includes("bankinter")) return "source-bankinter";
    if (lower.includes("sabadell")) return "source-sabadell";
    if (lower.includes("chase")) return "source-chase";
    if (lower.includes("braintree")) return "source-braintree";
    if (lower.includes("stripe")) return "source-stripe";
    if (lower.includes("gocardless")) return "source-gocardless";
    if (lower.includes("paypal")) return "source-paypal";
    if (lower.includes("pleo")) return "source-pleo";
    return "";
}

function getSourceLabel(source: string): string {
    const labels: Record<string, string> = {
        "bankinter-eur": "Bankinter EUR",
        "bankinter-usd": "Bankinter USD",
        "sabadell-eur": "Sabadell EUR",
        "chase-usd": "Chase USD",
        "braintree-eur": "Braintree EUR",
        "braintree-usd": "Braintree USD",
        "braintree-gbp": "Braintree GBP",
        "braintree-aud": "Braintree AUD",
        "braintree-amex": "Braintree Amex",
        "braintree-transactions": "Braintree Trans.",
        "stripe-eur": "Stripe EUR",
        "stripe-usd": "Stripe USD",
        stripe: "Stripe",
        gocardless: "GoCardless",
        paypal: "PayPal",
        pleo: "Pleo",
    };
    return labels[source] || source;
}

export function RecentTransactions({ data }: RecentTransactionsProps) {
    return (
        <div className="dashboard-card">
            <div className="dashboard-card-header">
                <h3 className="text-sm font-semibold dashboard-text-primary">
                    Últimas Transações
                </h3>
                <p className="text-xs dashboard-text-muted mt-0.5">
                    10 transações mais recentes no sistema
                </p>
            </div>
            <div className="dashboard-card-content p-0">
                <div className="overflow-x-auto">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Descrição</th>
                                <th>Fonte</th>
                                <th className="text-right">Montante</th>
                                <th className="text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="text-center py-6 dashboard-text-muted text-xs"
                                    >
                                        Sem transações recentes
                                    </td>
                                </tr>
                            ) : (
                                data.map((tx) => (
                                    <tr key={tx.id}>
                                        <td className="whitespace-nowrap text-xs">
                                            {formatDate(tx.date)}
                                        </td>
                                        <td className="max-w-[260px] truncate text-xs">
                                            {tx.description || "—"}
                                        </td>
                                        <td>
                                            <span
                                                className={`dashboard-source-badge ${getSourceBadgeClass(
                                                    tx.source
                                                )}`}
                                            >
                                                {getSourceLabel(tx.source)}
                                            </span>
                                        </td>
                                        <td className="text-right whitespace-nowrap">
                                            <span
                                                className={`text-xs font-semibold ${tx.amount >= 0 ? "text-emerald-400" : "text-red-400"
                                                    }`}
                                            >
                                                {formatCurrency(tx.amount, tx.currency || "EUR")}
                                            </span>
                                        </td>
                                        <td className="text-center">
                                            {tx.reconciled ? (
                                                <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold text-emerald-400">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                    Rec.
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold text-amber-400">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                    Pend.
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
