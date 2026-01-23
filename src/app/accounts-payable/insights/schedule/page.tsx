"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Calendar,
    CalendarDays,
    Clock,
    DollarSign,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    CheckCircle2,
    Loader2,
    X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { supabase } from "@/lib/supabase";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { matchesScope, SCOPE_CONFIG } from "@/lib/scope-utils";
import {
    formatDateForDB,
    formatDateForDisplay,
} from "@/lib/date-utils";

type Invoice = {
    id: number;
    invoice_date: string;
    benefit_date: string;
    due_date?: string | null;
    schedule_date?: string | null;
    payment_date?: string | null;
    invoice_type: string;
    financial_account_code: string;
    invoice_amount: number;
    currency: string;
    provider_code: string;
    description?: string | null;
    invoice_number?: string | null;
    country_code: string;
    payment_status?: string | null;
};

type Provider = {
    code: string;
    name: string;
};

type WeekData = {
    weekStart: Date;
    weekEnd: Date;
    weekLabel: string;
    invoices: Invoice[];
    totalEUR: number;
    totalUSD: number;
};

// Helper to get Monday of a given week
function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Helper to get Sunday of a given week
function getWeekEnd(date: Date): Date {
    const start = getWeekStart(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
}

// Format week label
function formatWeekLabel(start: Date, end: Date): string {
    const options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
    const startStr = start.toLocaleDateString("en-GB", options);
    const endStr = end.toLocaleDateString("en-GB", options);
    const year = end.getFullYear();
    return `${startStr} - ${endStr}, ${year}`;
}

// Get week number
function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Check if date is in current week
function isCurrentWeek(date: Date): boolean {
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const targetWeekStart = getWeekStart(date);
    return currentWeekStart.getTime() === targetWeekStart.getTime();
}

// Check if date is overdue
function isOverdue(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
}

export default function PaymentSchedulePage() {
    const { selectedScope } = useGlobalScope();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentWeekOffset, setCurrentWeekOffset] = useState(0); // 0 = current week
    const [updatingInvoice, setUpdatingInvoice] = useState<number | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [invoicesRes, providersRes] = await Promise.all([
                supabase
                    .from("invoices")
                    .select("*")
                    .eq("invoice_type", "INCURRED")
                    .is("payment_date", null) // Only unpaid invoices
                    .order("schedule_date", { ascending: true, nullsFirst: true }),
                supabase.from("providers").select("code, name")
            ]);

            if (invoicesRes.error) throw invoicesRes.error;
            if (providersRes.error) throw providersRes.error;

            setInvoices(invoicesRes.data || []);
            setProviders(providersRes.data || []);
        } catch (e: any) {
            toast({
                title: "Error",
                description: e?.message || "Failed to load data",
                variant: "destructive",
                className: "bg-white"
            });
        } finally {
            setLoading(false);
        }
    }

    // Filter invoices by scope
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => matchesScope(inv.country_code, selectedScope));
    }, [invoices, selectedScope]);

    // Separate unscheduled (pool) from scheduled
    const { poolInvoices, scheduledInvoices } = useMemo(() => {
        const pool: Invoice[] = [];
        const scheduled: Invoice[] = [];

        filteredInvoices.forEach(inv => {
            if (!inv.schedule_date) {
                pool.push(inv);
            } else {
                scheduled.push(inv);
            }
        });

        return { poolInvoices: pool, scheduledInvoices: scheduled };
    }, [filteredInvoices]);

    // Organize scheduled invoices by weeks
    const weeks = useMemo(() => {
        const weeksMap = new Map<string, WeekData>();
        const today = new Date();

        // Generate 8 weeks starting from currentWeekOffset
        for (let i = 0; i < 8; i++) {
            const weekOffset = currentWeekOffset + i;
            const referenceDate = new Date(today);
            referenceDate.setDate(referenceDate.getDate() + (weekOffset * 7));

            const weekStart = getWeekStart(referenceDate);
            const weekEnd = getWeekEnd(referenceDate);
            const key = weekStart.toISOString();

            if (!weeksMap.has(key)) {
                weeksMap.set(key, {
                    weekStart,
                    weekEnd,
                    weekLabel: formatWeekLabel(weekStart, weekEnd),
                    invoices: [],
                    totalEUR: 0,
                    totalUSD: 0
                });
            }
        }

        // Assign invoices to weeks
        scheduledInvoices.forEach(inv => {
            if (inv.schedule_date) {
                const invDate = new Date(inv.schedule_date);
                const weekStart = getWeekStart(invDate);
                const key = weekStart.toISOString();

                let weekData = weeksMap.get(key);
                if (!weekData) {
                    // Create week if not in visible range but has invoice
                    weekData = {
                        weekStart,
                        weekEnd: getWeekEnd(invDate),
                        weekLabel: formatWeekLabel(weekStart, getWeekEnd(invDate)),
                        invoices: [],
                        totalEUR: 0,
                        totalUSD: 0
                    };
                    weeksMap.set(key, weekData);
                }

                weekData.invoices.push(inv);
                if (inv.currency === "EUR") {
                    weekData.totalEUR += inv.invoice_amount;
                } else if (inv.currency === "USD") {
                    weekData.totalUSD += inv.invoice_amount;
                }
            }
        });

        // Sort weeks by date
        return Array.from(weeksMap.values()).sort(
            (a, b) => a.weekStart.getTime() - b.weekStart.getTime()
        );
    }, [scheduledInvoices, currentWeekOffset]);

    // Get provider name
    function getProviderName(code: string): string {
        const provider = providers.find(p => p.code === code);
        return provider?.name || code;
    }

    // Schedule an invoice to a specific week
    async function scheduleToWeek(invoiceId: number, weekStart: Date) {
        setUpdatingInvoice(invoiceId);
        try {
            // Schedule to Monday of that week
            const scheduleDate = formatDateForDB(weekStart.toISOString().split("T")[0]);

            const { error } = await supabase
                .from("invoices")
                .update({ schedule_date: scheduleDate })
                .eq("id", invoiceId);

            if (error) throw error;

            // Update local state
            setInvoices(prev => prev.map(inv =>
                inv.id === invoiceId
                    ? { ...inv, schedule_date: scheduleDate }
                    : inv
            ));

            toast({
                title: "Scheduled",
                description: `Invoice scheduled for week of ${formatWeekLabel(weekStart, getWeekEnd(weekStart))}`,
                className: "bg-white"
            });
        } catch (e: any) {
            toast({
                title: "Error",
                description: e?.message || "Failed to schedule invoice",
                variant: "destructive",
                className: "bg-white"
            });
        } finally {
            setUpdatingInvoice(null);
        }
    }

    // Unschedule an invoice (move to pool)
    async function unscheduleInvoice(invoiceId: number) {
        setUpdatingInvoice(invoiceId);
        try {
            const { error } = await supabase
                .from("invoices")
                .update({ schedule_date: null })
                .eq("id", invoiceId);

            if (error) throw error;

            setInvoices(prev => prev.map(inv =>
                inv.id === invoiceId
                    ? { ...inv, schedule_date: null }
                    : inv
            ));

            toast({
                title: "Unscheduled",
                description: "Invoice moved back to pool",
                className: "bg-white"
            });
        } catch (e: any) {
            toast({
                title: "Error",
                description: e?.message || "Failed to unschedule invoice",
                variant: "destructive",
                className: "bg-white"
            });
        } finally {
            setUpdatingInvoice(null);
        }
    }

    // Format currency
    function formatCurrency(amount: number, currency: string): string {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: currency,
            minimumFractionDigits: 2
        }).format(amount);
    }

    // Calculate totals
    const totals = useMemo(() => {
        let poolEUR = 0, poolUSD = 0;
        let scheduledEUR = 0, scheduledUSD = 0;

        poolInvoices.forEach(inv => {
            if (inv.currency === "EUR") poolEUR += inv.invoice_amount;
            else if (inv.currency === "USD") poolUSD += inv.invoice_amount;
        });

        scheduledInvoices.forEach(inv => {
            if (inv.currency === "EUR") scheduledEUR += inv.invoice_amount;
            else if (inv.currency === "USD") scheduledUSD += inv.invoice_amount;
        });

        return { poolEUR, poolUSD, scheduledEUR, scheduledUSD };
    }, [poolInvoices, scheduledInvoices]);

    // Invoice card component
    const InvoiceCard = ({ invoice, showScheduleButtons = false }: { invoice: Invoice; showScheduleButtons?: boolean }) => {
        const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
        const isLate = dueDate && isOverdue(dueDate);
        const scheduleDate = invoice.schedule_date ? new Date(invoice.schedule_date) : null;

        return (
            <div className={`p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow ${isLate ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium truncate">
                                {getProviderName(invoice.provider_code)}
                            </span>
                            {isLate && (
                                <Badge variant="destructive" className="text-xs">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Overdue
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                            {invoice.invoice_number || `#${invoice.id}`}
                        </p>
                        {invoice.description && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                                {invoice.description}
                            </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`text-sm font-bold ${invoice.currency === "EUR" ? "text-blue-600" : "text-green-600"}`}>
                                {formatCurrency(invoice.invoice_amount, invoice.currency)}
                            </span>
                            {dueDate && (
                                <span className="text-xs text-gray-400">
                                    Due: {formatDateForDisplay(invoice.due_date!)}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        {scheduleDate && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                                onClick={() => unscheduleInvoice(invoice.id)}
                                disabled={updatingInvoice === invoice.id}
                            >
                                {updatingInvoice === invoice.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <X className="h-3 w-3" />
                                )}
                            </Button>
                        )}
                    </div>
                </div>

                {showScheduleButtons && (
                    <div className="mt-3 pt-2 border-t flex flex-wrap gap-1">
                        {weeks.slice(0, 4).map((week, idx) => (
                            <Button
                                key={week.weekStart.toISOString()}
                                variant="outline"
                                size="sm"
                                className="text-xs h-6 px-2"
                                onClick={() => scheduleToWeek(invoice.id, week.weekStart)}
                                disabled={updatingInvoice === invoice.id}
                            >
                                {idx === 0 && currentWeekOffset === 0 ? "This Week" : `W${getWeekNumber(week.weekStart)}`}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <Breadcrumbs items={[
                            { label: "Accounts Payable", href: "/accounts-payable" },
                            { label: "Payment Schedule" }
                        ]} />
                        <h1 className="text-2xl font-bold text-gray-900 mt-2">Payment Schedule</h1>
                        <p className="text-gray-500 mt-1">
                            Organize and schedule invoice payments by week • Scope: {SCOPE_CONFIG[selectedScope].label}
                        </p>
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentWeekOffset(prev => prev - 4)}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentWeekOffset(0)}
                            disabled={currentWeekOffset === 0}
                        >
                            Today
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentWeekOffset(prev => prev + 4)}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4 mt-6">
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2 text-gray-500 mb-1">
                                <Clock className="h-4 w-4" />
                                <span className="text-sm">Pool (Unscheduled)</span>
                            </div>
                            <p className="text-2xl font-bold">{poolInvoices.length}</p>
                            <div className="flex gap-2 mt-1">
                                {totals.poolEUR > 0 && (
                                    <span className="text-xs text-blue-600">{formatCurrency(totals.poolEUR, "EUR")}</span>
                                )}
                                {totals.poolUSD > 0 && (
                                    <span className="text-xs text-green-600">{formatCurrency(totals.poolUSD, "USD")}</span>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2 text-gray-500 mb-1">
                                <CalendarDays className="h-4 w-4" />
                                <span className="text-sm">Scheduled</span>
                            </div>
                            <p className="text-2xl font-bold">{scheduledInvoices.length}</p>
                            <div className="flex gap-2 mt-1">
                                {totals.scheduledEUR > 0 && (
                                    <span className="text-xs text-blue-600">{formatCurrency(totals.scheduledEUR, "EUR")}</span>
                                )}
                                {totals.scheduledUSD > 0 && (
                                    <span className="text-xs text-green-600">{formatCurrency(totals.scheduledUSD, "USD")}</span>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2 text-amber-600 mb-1">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-sm">Overdue</span>
                            </div>
                            <p className="text-2xl font-bold text-amber-600">
                                {filteredInvoices.filter(inv => inv.due_date && isOverdue(new Date(inv.due_date))).length}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2 text-gray-500 mb-1">
                                <DollarSign className="h-4 w-4" />
                                <span className="text-sm">Total Pending</span>
                            </div>
                            <p className="text-xl font-bold text-blue-600">
                                {formatCurrency(totals.poolEUR + totals.scheduledEUR, "EUR")}
                            </p>
                            {(totals.poolUSD + totals.scheduledUSD) > 0 && (
                                <p className="text-lg font-bold text-green-600">
                                    {formatCurrency(totals.poolUSD + totals.scheduledUSD, "USD")}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-6">
                <div className="flex gap-6">
                    {/* Pool - Left Sidebar */}
                    <div className="w-80 flex-shrink-0">
                        <Card className="sticky top-6">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Clock className="h-5 w-5 text-amber-500" />
                                    Payment Pool
                                </CardTitle>
                                <CardDescription>
                                    {poolInvoices.length} invoices waiting to be scheduled
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="max-h-[calc(100vh-300px)] overflow-y-auto">
                                {poolInvoices.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400">
                                        <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <p>All invoices are scheduled!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {poolInvoices.map(invoice => (
                                            <InvoiceCard
                                                key={invoice.id}
                                                invoice={invoice}
                                                showScheduleButtons={true}
                                            />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Weeks - Main Area */}
                    <div className="flex-1">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {weeks.map((week) => {
                                const isCurrent = isCurrentWeek(week.weekStart);
                                const weekNum = getWeekNumber(week.weekStart);

                                return (
                                    <Card
                                        key={week.weekStart.toISOString()}
                                        className={isCurrent ? "ring-2 ring-blue-500" : ""}
                                    >
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-sm font-medium">
                                                    Week {weekNum}
                                                    {isCurrent && (
                                                        <Badge className="ml-2 bg-blue-500">Current</Badge>
                                                    )}
                                                </CardTitle>
                                            </div>
                                            <CardDescription className="text-xs">
                                                {week.weekLabel}
                                            </CardDescription>
                                            <div className="flex gap-2 mt-1">
                                                {week.totalEUR > 0 && (
                                                    <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                                                        {formatCurrency(week.totalEUR, "EUR")}
                                                    </Badge>
                                                )}
                                                {week.totalUSD > 0 && (
                                                    <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                                                        {formatCurrency(week.totalUSD, "USD")}
                                                    </Badge>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            {week.invoices.length === 0 ? (
                                                <div className="text-center py-6 text-gray-300 border-2 border-dashed rounded-lg">
                                                    <Calendar className="h-8 w-8 mx-auto mb-1" />
                                                    <p className="text-xs">No payments</p>
                                                </div>
                                            ) : (
                                                week.invoices.map(invoice => (
                                                    <InvoiceCard key={invoice.id} invoice={invoice} />
                                                ))
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
