"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
    Search,
    MoreHorizontal,
    Zap,
    X,
    Hash,
    DollarSign,
    CreditCard,
    FileText,
    Building2,
    Send,
    Paperclip,
    ThumbsUp,
    Link2,
    Maximize2,
    MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { matchesScope, SCOPE_CONFIG } from "@/lib/scope-utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { InvoiceFormModal } from "@/components/app/invoice-form-modal";

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
    payment_method_code?: string | null;
    bank_account_code?: string | null;
    cost_type_code?: string | null;
    dep_cost_type_code?: string | null;
    cost_center_code?: string | null;
    notes?: string | null;
    created_at?: string;
    updated_at?: string;
};

type Provider = {
    code: string;
    name: string;
};

type Activity = {
    id: number;
    invoice_id: number;
    user_email: string;
    user_name: string;
    activity_type: string;
    content: string;
    metadata: any;
    created_at: string;
};

type MasterData = {
    code: string;
    name: string;
};

type ScheduleGroup = {
    date: string;
    dateLabel: string;
    invoices: Invoice[];
    totalEUR: number;
    totalUSD: number;
};

// Format date for group header
function formatDateForHeader(dateStr: string): string {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
    const formatted = date.toLocaleDateString("en-US", options);
    const day = date.getDate();
    const suffix =
        day === 1 || day === 21 || day === 31 ? "st" :
            day === 2 || day === 22 ? "nd" :
                day === 3 || day === 23 ? "rd" : "th";
    return formatted.replace(/\d+/, day + suffix);
}

function formatShortDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatRelativeDate(dateStr: string): string {
    const today = new Date();
    const date = new Date(dateStr);
    if (date.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return formatShortDate(dateStr);
}

function formatActivityTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return formatShortDate(dateStr);
}

export default function PaymentSchedulePage() {
    const { selectedScope } = useGlobalScope();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<MasterData[]>([]);
    const [costTypes, setCostTypes] = useState<MasterData[]>([]);
    const [depCostTypes, setDepCostTypes] = useState<MasterData[]>([]);
    const [costCenters, setCostCenters] = useState<MasterData[]>([]);
    const [financialAccounts, setFinancialAccounts] = useState<MasterData[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [updatingInvoice, setUpdatingInvoice] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showCompleted, setShowCompleted] = useState(false);

    // Invoice form modal
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [defaultScheduleDateForModal, setDefaultScheduleDateForModal] = useState<string | null>(null);

    // Detail panel
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [detailPanelOpen, setDetailPanelOpen] = useState(false);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [submittingComment, setSubmittingComment] = useState(false);
    const [activeTab, setActiveTab] = useState<"comments" | "all">("all");

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (invoices.length > 0) {
            const allDates = new Set<string>();
            invoices.forEach((inv) => {
                if (inv.schedule_date) allDates.add(inv.schedule_date);
            });
            allDates.add("unscheduled");
            setExpandedGroups(allDates);
        }
    }, [invoices]);

    useEffect(() => {
        if (selectedInvoice) {
            loadActivities(selectedInvoice.id);
        }
    }, [selectedInvoice]);

    async function loadData() {
        setLoading(true);
        try {
            const [invoicesRes, providersRes, paymentMethodsRes, costTypesRes, depCostTypesRes, costCentersRes, financialAccountsRes] = await Promise.all([
                supabase.from("invoices").select("*").eq("invoice_type", "INCURRED").order("schedule_date", { ascending: true, nullsFirst: false }),
                supabase.from("providers").select("code, name"),
                supabase.from("payment_methods").select("code, name"),
                supabase.from("cost_types").select("code, name"),
                supabase.from("dep_cost_types").select("code, name"),
                supabase.from("cost_centers").select("code, name"),
                supabase.from("financial_accounts").select("code, name"),
            ]);

            if (invoicesRes.error) throw invoicesRes.error;
            setInvoices(invoicesRes.data || []);
            setProviders(providersRes.data || []);
            setPaymentMethods(paymentMethodsRes.data || []);
            setCostTypes(costTypesRes.data || []);
            setDepCostTypes(depCostTypesRes.data || []);
            setCostCenters(costCentersRes.data || []);
            setFinancialAccounts(financialAccountsRes.data || []);
        } catch (e: any) {
            toast({ title: "Error", description: e?.message || "Failed to load data", variant: "destructive", className: "bg-white" });
        } finally {
            setLoading(false);
        }
    }

    async function loadActivities(invoiceId: number) {
        setLoadingActivities(true);
        try {
            const { data, error } = await supabase
                .from("invoice_activities")
                .select("*")
                .eq("invoice_id", invoiceId)
                .order("created_at", { ascending: false });

            if (error) {
                // Table might not exist yet
                console.log("Activities table not found or error:", error.message);
                setActivities([]);
            } else {
                setActivities(data || []);
            }
        } catch (e: any) {
            console.log("Error loading activities:", e);
            setActivities([]);
        } finally {
            setLoadingActivities(false);
        }
    }

    async function addComment() {
        if (!newComment.trim() || !selectedInvoice) return;
        setSubmittingComment(true);
        try {
            const { data: userData } = await supabase.auth.getUser();
            const userEmail = userData?.user?.email || "Unknown";
            const userName = userData?.user?.user_metadata?.name || userEmail.split("@")[0];

            const { data, error } = await supabase.from("invoice_activities").insert([{
                invoice_id: selectedInvoice.id,
                user_email: userEmail,
                user_name: userName,
                activity_type: "comment",
                content: newComment,
            }]).select().single();

            if (error) throw error;

            setActivities([data, ...activities]);
            setNewComment("");
            toast({ title: "Comment added", className: "bg-white" });
        } catch (e: any) {
            toast({ title: "Error", description: e?.message || "Failed to add comment", variant: "destructive", className: "bg-white" });
        } finally {
            setSubmittingComment(false);
        }
    }

    const filteredInvoices = useMemo(() => {
        let filtered = invoices.filter((inv) => matchesScope(inv.country_code, selectedScope));
        if (!showCompleted) filtered = filtered.filter((inv) => !inv.payment_date);
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter((inv) =>
                inv.description?.toLowerCase().includes(term) ||
                inv.invoice_number?.toLowerCase().includes(term) ||
                getProviderName(inv.provider_code).toLowerCase().includes(term)
            );
        }
        return filtered;
    }, [invoices, selectedScope, searchTerm, showCompleted]);

    const groups = useMemo(() => {
        const groupsMap = new Map<string, ScheduleGroup>();
        groupsMap.set("unscheduled", { date: "unscheduled", dateLabel: "Unscheduled", invoices: [], totalEUR: 0, totalUSD: 0 });

        filteredInvoices.forEach((inv) => {
            const key = inv.schedule_date || "unscheduled";
            if (!groupsMap.has(key)) {
                groupsMap.set(key, {
                    date: key,
                    dateLabel: key === "unscheduled" ? "Unscheduled" : `Scheduled Payments - ${formatDateForHeader(key)}`,
                    invoices: [],
                    totalEUR: 0,
                    totalUSD: 0,
                });
            }
            const group = groupsMap.get(key)!;
            group.invoices.push(inv);
            if (inv.currency === "EUR") group.totalEUR += inv.invoice_amount;
            else if (inv.currency === "USD") group.totalUSD += inv.invoice_amount;
        });

        return Array.from(groupsMap.values()).sort((a, b) => {
            if (a.date === "unscheduled") return 1;
            if (b.date === "unscheduled") return -1;
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
    }, [filteredInvoices]);

    function getProviderName(code: string): string {
        return providers.find((p) => p.code === code)?.name || code;
    }

    function getMasterDataName(list: MasterData[], code: string | null | undefined): string {
        if (!code) return "—";
        return list.find((item) => item.code === code)?.name || code;
    }

    function toggleGroup(date: string) {
        setExpandedGroups((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(date)) newSet.delete(date);
            else newSet.add(date);
            return newSet;
        });
    }

    async function togglePaid(invoice: Invoice) {
        setUpdatingInvoice(invoice.id);
        try {
            const newPaymentDate = invoice.payment_date ? null : new Date().toISOString().split("T")[0];
            const { error } = await supabase.from("invoices").update({ payment_date: newPaymentDate }).eq("id", invoice.id);
            if (error) throw error;
            setInvoices((prev) => prev.map((inv) => (inv.id === invoice.id ? { ...inv, payment_date: newPaymentDate } : inv)));
            if (selectedInvoice?.id === invoice.id) setSelectedInvoice({ ...selectedInvoice, payment_date: newPaymentDate });
            toast({ title: newPaymentDate ? "Marked as paid" : "Marked as unpaid", className: "bg-white" });
        } catch (e: any) {
            toast({ title: "Error", description: e?.message, variant: "destructive", className: "bg-white" });
        } finally {
            setUpdatingInvoice(null);
        }
    }

    async function updateScheduleDate(invoiceId: number, date: string | null) {
        setUpdatingInvoice(invoiceId);
        try {
            const { error } = await supabase.from("invoices").update({ schedule_date: date }).eq("id", invoiceId);
            if (error) throw error;
            setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, schedule_date: date } : inv)));
            if (selectedInvoice?.id === invoiceId) setSelectedInvoice({ ...selectedInvoice, schedule_date: date });
            if (date) setExpandedGroups((prev) => new Set([...prev, date]));
            toast({ title: date ? "Scheduled" : "Unscheduled", className: "bg-white" });
        } catch (e: any) {
            toast({ title: "Error", description: e?.message, variant: "destructive", className: "bg-white" });
        } finally {
            setUpdatingInvoice(null);
        }
    }

    function formatCurrency(amount: number): string {
        return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    }

    function getCurrencyBadge(currency: string) {
        const colors = { EUR: "bg-blue-100 text-blue-700", USD: "bg-green-100 text-green-700" };
        return (
            <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-medium ${colors[currency as keyof typeof colors] || "bg-gray-100 text-gray-700"}`}>
                {currency === "EUR" ? "€" : currency === "USD" ? "US$" : currency}
            </span>
        );
    }

    function openDetailPanel(invoice: Invoice) {
        setSelectedInvoice(invoice);
        setDetailPanelOpen(true);
    }

    function closeDetailPanel() {
        setDetailPanelOpen(false);
        setSelectedInvoice(null);
        setActivities([]);
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#1e1f21]">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#1e1f21] text-white flex">
            {/* Main Content */}
            <div className={`flex-1 transition-all duration-300 ${detailPanelOpen ? "mr-[500px]" : ""}`}>
                {/* Header */}
                <div className="border-b border-gray-700 px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <h1 className="text-xl font-semibold">Payments & Invoice Control</h1>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-400 text-sm">{SCOPE_CONFIG[selectedScope].label}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
                            onClick={() => {
                                setDefaultScheduleDateForModal(null);
                                setInvoiceModalOpen(true);
                            }}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Add payment
                        </Button>

                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-64 bg-transparent border-gray-600 text-white placeholder:text-gray-500" />
                            </div>
                            <Button variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-700">
                                <Filter className="h-4 w-4 mr-1" />
                                Filter
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setShowCompleted(!showCompleted)} className={`bg-transparent border-gray-600 hover:bg-gray-700 ${showCompleted ? "text-green-400" : "text-white"}`}>
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
                        <div className="col-span-1 text-center">Schedule</div>
                        <div className="col-span-1">Invoice Date</div>
                        <div className="col-span-2">Invoice Nº</div>
                        <div className="col-span-1 text-right">Amount</div>
                        <div className="col-span-1 text-center">Currency</div>
                        <div className="col-span-1"></div>
                    </div>
                </div>

                {/* Content */}
                <div className="pb-20">
                    {groups.map((group) => (
                        <div key={group.date} className="border-b border-gray-800">
                            <div className="flex items-center gap-2 px-4 py-3 hover:bg-gray-800/50 cursor-pointer" onClick={() => toggleGroup(group.date)}>
                                {expandedGroups.has(group.date) ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                                <span className="font-medium text-white">{group.dateLabel}</span>
                                <Zap className="h-4 w-4 text-yellow-500" />
                                <span className="text-gray-500 text-sm ml-auto">
                                    {group.invoices.length > 0 && (
                                        <>TOT: <span className="text-white font-medium">
                                            {group.totalEUR > 0 && `€${formatCurrency(group.totalEUR)}`}
                                            {group.totalEUR > 0 && group.totalUSD > 0 && " + "}
                                            {group.totalUSD > 0 && `$${formatCurrency(group.totalUSD)}`}
                                        </span></>
                                    )}
                                </span>
                            </div>

                            {expandedGroups.has(group.date) && (
                                <div>
                                    {group.invoices.map((invoice) => (
                                        <div
                                            key={invoice.id}
                                            className={`grid grid-cols-12 gap-2 px-6 py-2.5 hover:bg-gray-800/30 border-t border-gray-800/50 items-center group cursor-pointer ${selectedInvoice?.id === invoice.id ? "bg-gray-700/50" : ""}`}
                                            onClick={() => openDetailPanel(invoice)}
                                        >
                                            <div className="col-span-4 flex items-center gap-3">
                                                <button onClick={(e) => { e.stopPropagation(); togglePaid(invoice); }} disabled={updatingInvoice === invoice.id} className="flex-shrink-0">
                                                    {updatingInvoice === invoice.id ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : invoice.payment_date ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-gray-500 hover:text-gray-300" />}
                                                </button>
                                                <div className="flex flex-col min-w-0">
                                                    <span className={`truncate ${invoice.payment_date ? "text-gray-500 line-through" : "text-white"}`}>{getProviderName(invoice.provider_code)}</span>
                                                    {invoice.description && <span className="text-xs text-gray-500 truncate">{invoice.description}</span>}
                                                </div>
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center"><User className="h-4 w-4 text-gray-400" /></div>
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                <span className="text-xs text-gray-400">{invoice.schedule_date ? formatRelativeDate(invoice.schedule_date) : "—"}</span>
                                            </div>
                                            <div className="col-span-1 text-sm text-gray-300">{invoice.invoice_date ? formatShortDate(invoice.invoice_date) : "-"}</div>
                                            <div className="col-span-2 text-sm text-gray-300 truncate">{invoice.invoice_number || "-"}</div>
                                            <div className={`col-span-1 text-sm text-right font-medium ${invoice.invoice_amount < 0 ? "text-red-400" : "text-white"}`}>{formatCurrency(invoice.invoice_amount)}</div>
                                            <div className="col-span-1 flex justify-center">{getCurrencyBadge(invoice.currency)}</div>
                                            <div className="col-span-1 flex justify-center opacity-0 group-hover:opacity-100">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-white" onClick={(e) => e.stopPropagation()}>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-[#2a2b2d] border-gray-700 text-white">
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); togglePaid(invoice); }} className="hover:bg-gray-700">
                                                            <CheckCircle className="h-4 w-4 mr-2" />{invoice.payment_date ? "Mark as unpaid" : "Mark as paid"}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    ))}
                                    <div 
                                        className="px-6 py-2 text-gray-500 text-sm hover:text-gray-300 cursor-pointer flex items-center gap-2"
                                        onClick={() => {
                                            setDefaultScheduleDateForModal(group.date === "unscheduled" ? null : group.date);
                                            setInvoiceModalOpen(true);
                                        }}
                                    >
                                        <Plus className="h-4 w-4" />Add payment...
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Invoice Form Modal */}
            <InvoiceFormModal
                open={invoiceModalOpen}
                onOpenChange={setInvoiceModalOpen}
                defaultScope={selectedScope === "GLOBAL" ? "ES" : selectedScope}
                defaultScheduleDate={defaultScheduleDateForModal}
                onSuccess={loadData}
            />

            {/* Detail Panel */}
            {detailPanelOpen && selectedInvoice && (
                <div className="fixed right-0 top-0 h-full w-[500px] bg-[#1e1f21] border-l border-gray-700 flex flex-col z-50 shadow-2xl">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                        <div className="flex items-center gap-2">
                            <button onClick={() => togglePaid(selectedInvoice)} disabled={updatingInvoice === selectedInvoice.id}>
                                {updatingInvoice === selectedInvoice.id ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : selectedInvoice.payment_date ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-gray-500 hover:text-gray-300" />}
                            </button>
                            <span className="font-medium text-white">{getProviderName(selectedInvoice.provider_code)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white"><ThumbsUp className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white"><Paperclip className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white"><Link2 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white"><Maximize2 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white" onClick={closeDetailPanel}><X className="h-4 w-4" /></Button>
                        </div>
                    </div>

                    {/* Panel Content */}
                    <div className="flex-1 overflow-y-auto">
                        {/* Section Badge */}
                        <div className="px-4 py-3 border-b border-gray-800">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-400">Payments & Invoice Control</span>
                                <span className="text-gray-600">•</span>
                                <span className="text-gray-400">{selectedInvoice.schedule_date ? `Scheduled Payments - ${formatDateForHeader(selectedInvoice.schedule_date)}` : "Unscheduled"}</span>
                            </div>
                        </div>

                        {/* Fields */}
                        <div className="px-4 py-4 space-y-4 border-b border-gray-800">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="text-xs text-gray-500">Invoice Date</p>
                                        <p className="text-sm text-white">{selectedInvoice.invoice_date ? formatShortDate(selectedInvoice.invoice_date) : "—"}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <FileText className="h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="text-xs text-gray-500">Invoice Nº</p>
                                        <p className="text-sm text-white">{selectedInvoice.invoice_number || "—"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-3">
                                    <Hash className="h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="text-xs text-gray-500">Total Amount</p>
                                        <p className="text-sm text-white font-medium">{formatCurrency(selectedInvoice.invoice_amount)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <DollarSign className="h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="text-xs text-gray-500">Currency</p>
                                        {getCurrencyBadge(selectedInvoice.currency)}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <CreditCard className="h-4 w-4 text-gray-500" />
                                <div>
                                    <p className="text-xs text-gray-500">Payment Method</p>
                                    <Badge variant="outline" className="bg-blue-900/30 text-blue-400 border-blue-700">{getMasterDataName(paymentMethods, selectedInvoice.payment_method_code)}</Badge>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <CheckCircle className="h-4 w-4 text-gray-500" />
                                <div>
                                    <p className="text-xs text-gray-500">Invoice Status</p>
                                    <Badge variant="outline" className={selectedInvoice.payment_date ? "bg-green-900/30 text-green-400 border-green-700" : "bg-yellow-900/30 text-yellow-400 border-yellow-700"}>
                                        {selectedInvoice.payment_date ? "Paid" : "Pending"}
                                    </Badge>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Calendar className="h-4 w-4 text-gray-500" />
                                <div>
                                    <p className="text-xs text-gray-500">Payment Due</p>
                                    <p className="text-sm text-white">{selectedInvoice.due_date ? formatShortDate(selectedInvoice.due_date) : "—"}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Building2 className="h-4 w-4 text-gray-500" />
                                <div>
                                    <p className="text-xs text-gray-500">P&L - COGS</p>
                                    <Badge variant="outline" className="bg-red-900/30 text-red-400 border-red-700">{getMasterDataName(financialAccounts, selectedInvoice.financial_account_code)}</Badge>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Building2 className="h-4 w-4 text-gray-500" />
                                <div>
                                    <p className="text-xs text-gray-500">Departamental Big Line</p>
                                    <Badge variant="outline" className="bg-green-900/30 text-green-400 border-green-700">{getMasterDataName(depCostTypes, selectedInvoice.dep_cost_type_code)}</Badge>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Building2 className="h-4 w-4 text-gray-500" />
                                <div>
                                    <p className="text-xs text-gray-500">Department</p>
                                    <Badge variant="outline" className="bg-blue-900/30 text-blue-400 border-blue-700">{getMasterDataName(costCenters, selectedInvoice.cost_center_code)}</Badge>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Building2 className="h-4 w-4 text-gray-500" />
                                <div>
                                    <p className="text-xs text-gray-500">Cost Type</p>
                                    <Badge variant="outline" className="bg-pink-900/30 text-pink-400 border-pink-700">{getMasterDataName(costTypes, selectedInvoice.cost_type_code)}</Badge>
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="px-4 py-4 border-b border-gray-800">
                            <h3 className="text-sm font-medium text-white mb-2">Description</h3>
                            <div className="bg-[#2a2b2d] rounded-lg p-3 min-h-[80px]">
                                <p className="text-sm text-gray-400">{selectedInvoice.description || selectedInvoice.notes || "No description provided."}</p>
                            </div>
                        </div>

                        {/* Activities & Comments */}
                        <div className="px-4 py-4">
                            <div className="flex items-center gap-4 mb-4 border-b border-gray-800 pb-2">
                                <button onClick={() => setActiveTab("comments")} className={`text-sm pb-2 border-b-2 ${activeTab === "comments" ? "text-white border-white" : "text-gray-500 border-transparent hover:text-gray-300"}`}>
                                    Comments
                                </button>
                                <button onClick={() => setActiveTab("all")} className={`text-sm pb-2 border-b-2 ${activeTab === "all" ? "text-white border-white" : "text-gray-500 border-transparent hover:text-gray-300"}`}>
                                    All Activities
                                </button>
                            </div>

                            {loadingActivities ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {activities.length === 0 ? (
                                        <p className="text-center text-gray-500 py-4 text-sm">No activities yet.</p>
                                    ) : (
                                        activities
                                            .filter((a) => activeTab === "all" || a.activity_type === "comment")
                                            .map((activity) => (
                                                <div key={activity.id} className="flex gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-white text-xs font-medium">{activity.user_name?.charAt(0).toUpperCase() || "?"}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium text-white">{activity.user_name}</span>
                                                            {activity.activity_type !== "comment" && (
                                                                <span className="text-sm text-gray-400">{activity.activity_type === "created" ? "created this task" : activity.activity_type}</span>
                                                            )}
                                                            <span className="text-xs text-gray-500">{formatActivityTime(activity.created_at)}</span>
                                                        </div>
                                                        {activity.activity_type === "comment" && activity.content && (
                                                            <p className="text-sm text-gray-300 mt-1">{activity.content}</p>
                                                        )}
                                                        {activity.activity_type === "attachment" && activity.metadata?.filename && (
                                                            <div className="mt-2 flex items-center gap-2 bg-[#2a2b2d] rounded p-2">
                                                                <FileText className="h-8 w-8 text-red-500" />
                                                                <div>
                                                                    <p className="text-sm text-white">{activity.metadata.filename}</p>
                                                                    <p className="text-xs text-gray-500">PDF • Download</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Comment Input */}
                    <div className="border-t border-gray-700 px-4 py-3">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                                <User className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1">
                                <Textarea
                                    placeholder="Add a comment..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    className="bg-[#2a2b2d] border-gray-700 text-white placeholder:text-gray-500 min-h-[60px] resize-none"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            addComment();
                                        }
                                    }}
                                />
                                <div className="flex justify-end mt-2">
                                    <Button size="sm" onClick={addComment} disabled={!newComment.trim() || submittingComment} className="bg-blue-600 hover:bg-blue-700">
                                        {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Collaborators */}
                    <div className="border-t border-gray-700 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Collaborators</span>
                            <div className="flex -space-x-2">
                                <div className="w-7 h-7 rounded-full bg-blue-600 border-2 border-[#1e1f21] flex items-center justify-center">
                                    <span className="text-xs text-white font-medium">S</span>
                                </div>
                                <div className="w-7 h-7 rounded-full bg-gray-600 border-2 border-[#1e1f21] flex items-center justify-center">
                                    <User className="h-3 w-3 text-gray-400" />
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-500 hover:text-white">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <Button variant="ghost" size="sm" className="text-gray-500 hover:text-white text-xs">
                            <MessageCircle className="h-4 w-4 mr-1" />
                            Join task
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
