"use client";

import { formatCurrency, formatDate } from "@/lib/formatters";
import { CalendarClock } from "lucide-react";

export interface ScheduledPayment {
    id: number;
    schedule_date: string;
    provider_code: string;
    description: string | null;
    invoice_number: string | null;
    invoice_amount: number;
    currency: string;
    payment_status: string | null;
    payment_date: string | null;
}

interface WeeklyPaymentsProps {
    data: ScheduledPayment[];
}

function getStatusBadge(payment: ScheduledPayment) {
    if (payment.payment_date) {
        return (
            <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Paid
            </span>
        );
    }
    const status = (payment.payment_status || "pending").toLowerCase();
    if (status === "paid") {
        return (
            <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Paid
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Pending
        </span>
    );
}

export function WeeklyPayments({ data }: WeeklyPaymentsProps) {
    return (
        <div className="dashboard-card">
            <div className="dashboard-card-header">
                <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 dashboard-text-muted" />
                    <h3 className="text-sm font-semibold dashboard-text-primary">
                        This Week&apos;s Payments
                    </h3>
                </div>
                <p className="text-xs dashboard-text-muted mt-0.5">
                    Scheduled payments for the current week
                </p>
            </div>
            <div className="dashboard-card-content p-0">
                <div className="overflow-x-auto">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Provider</th>
                                <th>Description</th>
                                <th className="text-right">Amount</th>
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
                                        No payments scheduled this week
                                    </td>
                                </tr>
                            ) : (
                                data.map((p) => (
                                    <tr key={p.id}>
                                        <td className="whitespace-nowrap text-xs">
                                            {formatDate(p.schedule_date)}
                                        </td>
                                        <td className="text-xs font-medium max-w-[120px] truncate">
                                            {p.provider_code || "—"}
                                        </td>
                                        <td className="max-w-[220px] truncate text-xs">
                                            {p.description || p.invoice_number || "—"}
                                        </td>
                                        <td className="text-right whitespace-nowrap">
                                            <span className="text-xs font-semibold text-red-400">
                                                {formatCurrency(p.invoice_amount, p.currency || "EUR")}
                                            </span>
                                        </td>
                                        <td className="text-center">{getStatusBadge(p)}</td>
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
