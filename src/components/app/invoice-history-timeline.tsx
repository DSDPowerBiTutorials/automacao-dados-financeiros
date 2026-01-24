"use client";

import React, { useState, useEffect } from "react";
import {
    Plus,
    Calendar,
    CheckCircle,
    FileText,
    Upload,
    Clock,
    AlertCircle,
    DollarSign,
    ArrowRight,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

type HistoryEntry = {
    id: number;
    invoice_id: number;
    change_type: string;
    field_name: string | null;
    old_value: string | null;
    new_value: string | null;
    changed_by: string | null;
    changed_at: string;
    metadata: any;
};

type InvoiceHistoryTimelineProps = {
    invoiceId: number;
    trigger: React.ReactNode;
};

const changeTypeConfig: Record<string, {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    label: string;
}> = {
    created: {
        icon: Plus,
        color: "text-blue-400",
        bgColor: "bg-blue-900/30",
        label: "Payment Created",
    },
    finance_status: {
        icon: DollarSign,
        color: "text-purple-400",
        bgColor: "bg-purple-900/30",
        label: "Finance Status Changed",
    },
    invoice_status: {
        icon: FileText,
        color: "text-cyan-400",
        bgColor: "bg-cyan-900/30",
        label: "Invoice Status Changed",
    },
    schedule_date: {
        icon: Calendar,
        color: "text-orange-400",
        bgColor: "bg-orange-900/30",
        label: "Schedule Date Changed",
    },
    paid: {
        icon: CheckCircle,
        color: "text-green-400",
        bgColor: "bg-green-900/30",
        label: "Marked as Paid",
    },
    unpaid: {
        icon: AlertCircle,
        color: "text-yellow-400",
        bgColor: "bg-yellow-900/30",
        label: "Marked as Unpaid",
    },
    attachment: {
        icon: Upload,
        color: "text-indigo-400",
        bgColor: "bg-indigo-900/30",
        label: "Attachment Added",
    },
};

const statusLabels: Record<string, string> = {
    pending: "Pending",
    uploaded: "Uploaded",
    done: "Done",
    info_required: "Info Required",
    available: "Available",
};

export function InvoiceHistoryTimeline({ invoiceId, trigger }: InvoiceHistoryTimelineProps) {
    const [open, setOpen] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && invoiceId) {
            fetchHistory();
        }
    }, [open, invoiceId]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/invoice-history?invoice_id=${invoiceId}`);
            const data = await res.json();
            if (data.success) {
                setHistory(data.history || []);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const formatTime = (date: string) => {
        return new Date(date).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatValue = (value: string | null, fieldName: string | null): string => {
        if (!value) return "—";
        if (fieldName === "schedule_date" || fieldName === "payment_date") {
            try {
                return formatDate(value);
            } catch {
                return value;
            }
        }
        return statusLabels[value] || value;
    };

    const getConfig = (changeType: string) => {
        return changeTypeConfig[changeType] || {
            icon: Clock,
            color: "text-gray-400",
            bgColor: "bg-gray-900/30",
            label: "Updated",
        };
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="bg-[#1e1f21] border-gray-700 text-white w-[600px] max-w-[90vw] min-h-[400px]">
                <DialogHeader className="pb-4 border-b border-gray-700">
                    <DialogTitle className="flex items-center gap-3 text-white text-xl">
                        <Clock className="h-6 w-6 text-yellow-500" />
                        Payment History
                    </DialogTitle>
                </DialogHeader>

                <div className="overflow-y-auto max-h-[70vh] py-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                            <Clock className="h-16 w-16 mb-4 opacity-50" />
                            <p className="text-lg font-medium">No history yet</p>
                            <p className="text-sm text-gray-500 mt-2">Changes will appear here when you update this payment</p>
                        </div>
                    ) : (
                        <div className="relative pl-4">
                            {/* Timeline line */}
                            <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-gray-700" />

                            {/* Timeline entries */}
                            <div className="space-y-6">
                                {history.map((entry, index) => {
                                    const config = getConfig(entry.change_type);
                                    const Icon = config.icon;
                                    const isLast = index === history.length - 1;

                                    return (
                                        <div key={entry.id} className="relative pl-14">
                                            {/* Icon circle */}
                                            <div
                                                className={`absolute left-1 w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor} border-2 border-gray-800`}
                                            >
                                                <Icon className={`h-5 w-5 ${config.color}`} />
                                            </div>

                                            {/* Content card */}
                                            <div className={`${config.bgColor} rounded-lg p-4 border border-gray-700/50`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={`text-base font-semibold ${config.color}`}>
                                                        {config.label}
                                                    </span>
                                                    <span className="text-sm text-gray-400">
                                                        {formatTime(entry.changed_at)}
                                                    </span>
                                                </div>

                                                <div className="text-sm text-gray-400">
                                                    {formatDate(entry.changed_at)}
                                                </div>

                                                {/* Show value changes */}
                                                {entry.old_value || entry.new_value ? (
                                                    <div className="mt-3 flex items-center gap-3 text-sm">
                                                        {entry.old_value && (
                                                            <span className="px-3 py-1.5 rounded-md bg-gray-800/50 text-gray-300">
                                                                {formatValue(entry.old_value, entry.field_name)}
                                                            </span>
                                                        )}
                                                        {entry.old_value && entry.new_value && (
                                                            <ArrowRight className="h-5 w-5 text-gray-500" />
                                                        )}
                                                        {entry.new_value && (
                                                            <span className={`px-3 py-1.5 rounded-md ${config.bgColor} ${config.color} font-semibold`}>
                                                                {formatValue(entry.new_value, entry.field_name)}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : null}

                                                {/* Changed by */}
                                                {entry.changed_by && entry.changed_by !== "user" && entry.changed_by !== "system" && (
                                                    <div className="mt-2 text-sm text-gray-500">
                                                        by {entry.changed_by}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
