"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    ChevronDown,
    ChevronRight,
    Plus,
    Calendar,
    User,
    CheckCircle,
    Circle,
    Loader2,
    Filter,
    ArrowUpDown,
    Settings,
    Search,
    MoreHorizontal,
    Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { supabase } from "@/lib/supabase";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { matchesScope, SCOPE_CONFIG } from "@/lib/scope-utils";
import {
    formatDateForDB,
    formatDateForDisplay,
} from "@/lib/date-utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
    is_paid?: boolean;
};

type Provider = {
    code: string;
    name: string;
};

type ScheduleGroup = {
    date: string;
    dateLabel: string;
    invoices: Invoice[];
    totalEUR: number;
    totalUSD: number;
    isExpanded: boolean;
};

// Format date for group header (e.g., "January 1st")
function formatDateForHeader(dateStr: string): string {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
    const formatted = date.toLocaleDateString("en-US", options);

    // Add ordinal suffix
    const day = date.getDate();
    const suffix =
        day === 1 || day === 21 || day === 31 ? "st" :
            day === 2 || day === 22 ? "nd" :
                day === 3 || day === 23 ? "rd" : "th";

    return formatted.replace(/\d+/, day + suffix);
}

// Format date for display (e.g., "21 jan")
function formatShortDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Check if date is today
function isToday(dateStr: string): boolean {
    const today = new Date();
    const date = new Date(dateStr);
    return date.toDateString() === today.toDateString();
}

// Check if date is yesterday
function isYesterday(dateStr: string): boolean {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = new Date(dateStr);
    return date.toDateString() === yesterday.toDateString();
}

// Format relative date
function formatRelativeDate(dateStr: string): string {
    if (isToday(dateStr)) return "Today";
    if (isYesterday(dateStr)) return "Yesterday";
    return formatShortDate(dateStr);
}

export default function PaymentSchedulePage() {
    const { selectedScope } = useGlobalScope();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [updatingInvoice, setUpdatingInvoice] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showCompleted, setShowCompleted] = useState(false);

    // Schedule dialog
    const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [newScheduleDate, setNewScheduleDate] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    // Expand all groups by default on load
    useEffect(() => {
        if (invoices.length > 0) {
            const allDates = new Set<string>();
            invoices.forEach(inv => {
                if (inv.schedule_date) {
                    allDates.add(inv.schedule_date);
                }
            });
            allDates.add("unscheduled");
            setExpandedGroups(allDates);
        }
    }, [invoices]);

    async function loadData() {
        setLoading(true);
        try {
            const [invoicesRes, providersRes] = await Promise.all([
                supabase
                    .from("invoices")
                    .select("*")
                    .eq("invoice_type", "INCURRED")
                    .order("schedule_date", { ascending: true, nullsFirst: false }),
                supabase.from("providers").select("code, name"),
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
                className: "bg-white",
            });
        } finally {
            setLoading(false);
        }
    }

    // Filter invoices by scope and search
    const filteredInvoices = useMemo(() => {
        let filtered = invoices.filter((inv) =>
            matchesScope(inv.country_code, selectedScope)
        );

        // Filter by paid status
        if (!showCompleted) {
            filtered = filtered.filter((inv) => !inv.payment_date);
        }

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (inv) =>
                    inv.description?.toLowerCase().includes(term) ||
                    inv.invoice_number?.toLowerCase().includes(term) ||
                    inv.provider_code?.toLowerCase().includes(term) ||
                    getProviderName(inv.provider_code).toLowerCase().includes(term)
            );
        }

        return filtered;
    }, [invoices, selectedScope, searchTerm, showCompleted]);

    // Group invoices by schedule_date
    const groups = useMemo(() => {
        const groupsMap = new Map<string, ScheduleGroup>();

        // First add unscheduled group
        groupsMap.set("unscheduled", {
            date: "unscheduled",
            dateLabel: "Unscheduled",
            invoices: [],
            totalEUR: 0,
            totalUSD: 0,
            isExpanded: expandedGroups.has("unscheduled"),
        });

        filteredInvoices.forEach((inv) => {
            const key = inv.schedule_date || "unscheduled";

            if (!groupsMap.has(key)) {
                groupsMap.set(key, {
                    date: key,
                    dateLabel:
                        key === "unscheduled"
                            ? "Unscheduled"
                            : `Scheduled Payments - ${formatDateForHeader(key)}`,
                    invoices: [],
                    totalEUR: 0,
                    totalUSD: 0,
                    isExpanded: expandedGroups.has(key),
                });
            }

            const group = groupsMap.get(key)!;
            group.invoices.push(inv);

            if (inv.currency === "EUR") {
                group.totalEUR += inv.invoice_amount;
            } else if (inv.currency === "USD") {
                group.totalUSD += inv.invoice_amount;
            }
        });

        // Sort groups by date
        return Array.from(groupsMap.values()).sort((a, b) => {
            if (a.date === "unscheduled") return 1;
            if (b.date === "unscheduled") return -1;
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
    }, [filteredInvoices, expandedGroups]);

    // Get provider name
    function getProviderName(code: string): string {
        const provider = providers.find((p) => p.code === code);
        return provider?.name || code;
    }

    // Toggle group expansion
    function toggleGroup(date: string) {
        setExpandedGroups((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(date)) {
                newSet.delete(date);
            } else {
                newSet.add(date);
            }
            return newSet;
        });
    }

    // Mark invoice as paid
    async function togglePaid(invoice: Invoice) {
        setUpdatingInvoice(invoice.id);
        try {
            const newPaymentDate = invoice.payment_date ? null : new Date().toISOString().split("T")[0];

            const { error } = await supabase
                .from("invoices")
                .update({ payment_date: newPaymentDate })
                .eq("id", invoice.id);

            if (error) throw error;

            setInvoices((prev) =>
                prev.map((inv) =>
                    inv.id === invoice.id ? { ...inv, payment_date: newPaymentDate } : inv
                )
            );

            toast({
                title: newPaymentDate ? "Marked as paid" : "Marked as unpaid",
                className: "bg-white",
            });
        } catch (e: any) {
            toast({
                title: "Error",
                description: e?.message || "Failed to update",
                variant: "destructive",
                className: "bg-white",
            });
        } finally {
            setUpdatingInvoice(null);
        }
    }

    // Update schedule date
    async function updateScheduleDate(invoiceId: number, date: string | null) {
        setUpdatingInvoice(invoiceId);
        try {
            const { error } = await supabase
                .from("invoices")
                .update({ schedule_date: date })
                .eq("id", invoiceId);

            if (error) throw error;

            setInvoices((prev) =>
                prev.map((inv) =>
                    inv.id === invoiceId ? { ...inv, schedule_date: date } : inv
                )
            );

            // Add new date to expanded groups
            if (date) {
                setExpandedGroups((prev) => new Set([...prev, date]));
            }

            toast({
                title: date ? "Scheduled" : "Unscheduled",
                className: "bg-white",
            });

            setScheduleDialogOpen(false);
            setSelectedInvoice(null);
        } catch (e: any) {
            toast({
                title: "Error",
                description: e?.message || "Failed to schedule",
                variant: "destructive",
                className: "bg-white",
            });
        } finally {
            setUpdatingInvoice(null);
        }
    }

    // Format currency
    function formatCurrency(amount: number, currency: string): string {
        return new Intl.NumberFormat("de-DE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    }

    // Currency badge color
    function getCurrencyBadge(currency: string) {
        if (currency === "EUR") {
            return (
                <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-blue-100 text-blue-700 text-xs font-medium">
                    €
                </span>
            );
        }
        if (currency === "USD") {
            return (
                <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-green-100 text-green-700 text-xs font-medium">
                    US$
                </span>
            );
        }
        return (
            <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                {currency}
            </span>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#1e1f21]">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#1e1f21] text-white">
            {/* Header */}
            <div className="border-b border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-semibold">Payments & Invoice Control</h1>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-400 text-sm">
                            {SCOPE_CONFIG[selectedScope].label}
                        </span>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Add payment
                        </Button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-64 bg-transparent border-gray-600 text-white placeholder:text-gray-500"
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
                        >
                            <Filter className="h-4 w-4 mr-1" />
                            Filter
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
                        >
                            <ArrowUpDown className="h-4 w-4 mr-1" />
                            Sort
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCompleted(!showCompleted)}
                            className={`bg-transparent border-gray-600 hover:bg-gray-700 ${showCompleted ? "text-green-400" : "text-white"
                                }`}
                        >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            {showCompleted ? "Hide Completed" : "Show Completed"}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Table Header */}
            <div className="sticky top-0 z-10 bg-[#2a2b2d] border-b border-gray-700">
                <div className="grid grid-cols-12 gap-2 px-6 py-2 text-xs text-gray-400 font-medium uppercase">
                    <div className="col-span-4">Name</div>
                    <div className="col-span-1 text-center">Responsible</div>
                    <div className="col-span-1 text-center">Completion</div>
                    <div className="col-span-1">Invoice Date</div>
                    <div className="col-span-2">Invoice Nº</div>
                    <div className="col-span-1 text-right">Total Amount</div>
                    <div className="col-span-1 text-center">Currency</div>
                    <div className="col-span-1 text-center">Actions</div>
                </div>
            </div>

            {/* Content */}
            <div className="pb-20">
                {groups.map((group) => (
                    <div key={group.date} className="border-b border-gray-800">
                        {/* Group Header */}
                        <div
                            className="flex items-center gap-2 px-4 py-3 hover:bg-gray-800/50 cursor-pointer"
                            onClick={() => toggleGroup(group.date)}
                        >
                            {expandedGroups.has(group.date) ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                            <span className="font-medium text-white">{group.dateLabel}</span>
                            <Zap className="h-4 w-4 text-yellow-500" />
                            <span className="text-gray-500 text-sm ml-auto">
                                {group.invoices.length > 0 && (
                                    <>
                                        TOT:{" "}
                                        <span className="text-white font-medium">
                                            {group.totalEUR > 0 && `€${formatCurrency(group.totalEUR, "EUR")}`}
                                            {group.totalEUR > 0 && group.totalUSD > 0 && " + "}
                                            {group.totalUSD > 0 && `$${formatCurrency(group.totalUSD, "USD")}`}
                                        </span>
                                    </>
                                )}
                            </span>
                        </div>

                        {/* Group Content */}
                        {expandedGroups.has(group.date) && (
                            <div>
                                {group.invoices.map((invoice) => (
                                    <div
                                        key={invoice.id}
                                        className="grid grid-cols-12 gap-2 px-6 py-2.5 hover:bg-gray-800/30 border-t border-gray-800/50 items-center group"
                                    >
                                        {/* Checkbox + Name */}
                                        <div className="col-span-4 flex items-center gap-3">
                                            <button
                                                onClick={() => togglePaid(invoice)}
                                                disabled={updatingInvoice === invoice.id}
                                                className="flex-shrink-0"
                                            >
                                                {updatingInvoice === invoice.id ? (
                                                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                                                ) : invoice.payment_date ? (
                                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                                ) : (
                                                    <Circle className="h-5 w-5 text-gray-500 hover:text-gray-300" />
                                                )}
                                            </button>
                                            <div className="flex flex-col min-w-0">
                                                <span
                                                    className={`truncate ${invoice.payment_date
                                                            ? "text-gray-500 line-through"
                                                            : "text-white"
                                                        }`}
                                                >
                                                    {getProviderName(invoice.provider_code)}
                                                </span>
                                                {invoice.description && (
                                                    <span className="text-xs text-gray-500 truncate">
                                                        {invoice.description}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Responsible */}
                                        <div className="col-span-1 flex justify-center">
                                            <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center">
                                                <User className="h-4 w-4 text-gray-400" />
                                            </div>
                                        </div>

                                        {/* Completion Date (schedule_date) */}
                                        <div className="col-span-1 flex justify-center">
                                            <button
                                                onClick={() => {
                                                    setSelectedInvoice(invoice);
                                                    setNewScheduleDate(invoice.schedule_date || "");
                                                    setScheduleDialogOpen(true);
                                                }}
                                                className="flex items-center gap-1 text-gray-400 hover:text-white hover:bg-gray-700 px-2 py-1 rounded"
                                            >
                                                <Calendar className="h-4 w-4" />
                                                {invoice.schedule_date ? (
                                                    <span className="text-xs">
                                                        {formatRelativeDate(invoice.schedule_date)}
                                                    </span>
                                                ) : (
                                                    <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                                                )}
                                            </button>
                                        </div>

                                        {/* Invoice Date */}
                                        <div className="col-span-1 text-sm text-gray-300">
                                            {invoice.invoice_date
                                                ? formatShortDate(invoice.invoice_date)
                                                : "-"}
                                        </div>

                                        {/* Invoice Number */}
                                        <div className="col-span-2 text-sm text-gray-300 truncate">
                                            {invoice.invoice_number || "-"}
                                        </div>

                                        {/* Amount */}
                                        <div
                                            className={`col-span-1 text-sm text-right font-medium ${invoice.invoice_amount < 0
                                                    ? "text-red-400"
                                                    : "text-white"
                                                }`}
                                        >
                                            {formatCurrency(invoice.invoice_amount, invoice.currency)}
                                        </div>

                                        {/* Currency */}
                                        <div className="col-span-1 flex justify-center">
                                            {getCurrencyBadge(invoice.currency)}
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-1 flex justify-center opacity-0 group-hover:opacity-100">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="end"
                                                    className="bg-[#2a2b2d] border-gray-700 text-white"
                                                >
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setSelectedInvoice(invoice);
                                                            setNewScheduleDate(invoice.schedule_date || "");
                                                            setScheduleDialogOpen(true);
                                                        }}
                                                        className="hover:bg-gray-700"
                                                    >
                                                        <Calendar className="h-4 w-4 mr-2" />
                                                        Set schedule date
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => togglePaid(invoice)}
                                                        className="hover:bg-gray-700"
                                                    >
                                                        <CheckCircle className="h-4 w-4 mr-2" />
                                                        {invoice.payment_date
                                                            ? "Mark as unpaid"
                                                            : "Mark as paid"}
                                                    </DropdownMenuItem>
                                                    {invoice.schedule_date && (
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                updateScheduleDate(invoice.id, null)
                                                            }
                                                            className="hover:bg-gray-700 text-red-400"
                                                        >
                                                            <Calendar className="h-4 w-4 mr-2" />
                                                            Remove from schedule
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                ))}

                                {/* Add task row */}
                                <div className="px-6 py-2 text-gray-500 text-sm hover:text-gray-300 cursor-pointer flex items-center gap-2">
                                    <Plus className="h-4 w-4" />
                                    Add payment...
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Schedule Dialog */}
            <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
                <DialogContent className="bg-[#2a2b2d] border-gray-700 text-white">
                    <DialogHeader>
                        <DialogTitle>Schedule Payment</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Payment</Label>
                            <p className="text-sm text-gray-400">
                                {selectedInvoice &&
                                    getProviderName(selectedInvoice.provider_code)}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Schedule Date</Label>
                            <Input
                                type="date"
                                value={newScheduleDate}
                                onChange={(e) => setNewScheduleDate(e.target.value)}
                                className="bg-transparent border-gray-600 text-white"
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setScheduleDialogOpen(false)}
                                className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() =>
                                    selectedInvoice &&
                                    updateScheduleDate(
                                        selectedInvoice.id,
                                        newScheduleDate || null
                                    )
                                }
                                disabled={updatingInvoice !== null}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {updatingInvoice ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    "Save"
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
