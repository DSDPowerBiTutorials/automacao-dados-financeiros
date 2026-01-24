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
    Upload,
    AlertCircle,
    Clock,
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
import { InvoiceSidePanel } from "@/components/app/invoice-side-panel";

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
    sub_department_code?: string | null;
    notes?: string | null;
    created_at?: string;
    updated_at?: string;
    // New tracking fields
    finance_payment_status?: string | null;
    invoice_status?: string | null;
    finance_status_changed_at?: string | null;
    invoice_status_changed_at?: string | null;
    is_reconciled?: boolean | null;
    reconciled_transaction_id?: string | null;
    reconciled_at?: string | null;
    // Paid amount tracking
    paid_amount?: number | null;
    paid_currency?: string | null;
};

type Provider = {
    code: string;
    name: string;
};

type Activity = {
    id: number | string;
    invoice_id: number;
    user_email: string;
    user_name: string;
    activity_type: string;
    content: string;
    metadata: any;
    created_at: string;
    // History specific fields
    old_value?: string | null;
    new_value?: string | null;
    field_name?: string | null;
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

// Parse date string without timezone issues (treats as local date)
function parseLocalDate(dateStr: string): Date {
    // Handle ISO date strings like "2026-01-24" by parsing as local time
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    // Fallback for other formats
    return new Date(dateStr);
}

// Format date for group header
function formatDateForHeader(dateStr: string): string {
    const date = parseLocalDate(dateStr);
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
    const date = parseLocalDate(dateStr);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatRelativeDate(dateStr: string): string {
    const today = new Date();
    const date = parseLocalDate(dateStr);
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
    const [bankAccounts, setBankAccounts] = useState<MasterData[]>([]);
    const [costTypes, setCostTypes] = useState<MasterData[]>([]);
    const [depCostTypes, setDepCostTypes] = useState<MasterData[]>([]);
    const [costCenters, setCostCenters] = useState<MasterData[]>([]);
    const [subDepartments, setSubDepartments] = useState<MasterData[]>([]);
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

    // Reconciliation dialog
    const [reconciliationDialogOpen, setReconciliationDialogOpen] = useState(false);
    const [reconciliationInvoice, setReconciliationInvoice] = useState<Invoice | null>(null);
    const [bankTransactions, setBankTransactions] = useState<any[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);

    // Payment confirmation dialog
    const [paymentConfirmDialogOpen, setPaymentConfirmDialogOpen] = useState(false);
    const [paymentConfirmInvoice, setPaymentConfirmInvoice] = useState<Invoice | null>(null);
    const [paymentConfirmData, setPaymentConfirmData] = useState({
        paid_amount: "",
        paid_currency: "",
        payment_date: ""
    });

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
            const [invoicesRes, providersRes, paymentMethodsRes, bankAccountsRes, costTypesRes, depCostTypesRes, costCentersRes, subDepartmentsRes, financialAccountsRes] = await Promise.all([
                supabase.from("invoices").select("*").eq("invoice_type", "INCURRED").order("schedule_date", { ascending: true, nullsFirst: false }),
                supabase.from("providers").select("code, name"),
                supabase.from("payment_methods").select("code, name"),
                supabase.from("bank_accounts").select("code, name"),
                supabase.from("cost_types").select("code, name"),
                supabase.from("dep_cost_types").select("code, name"),
                supabase.from("cost_centers").select("code, name"),
                supabase.from("sub_departments").select("code, name, parent_department_code"),
                supabase.from("financial_accounts").select("code, name"),
            ]);

            if (invoicesRes.error) throw invoicesRes.error;
            setInvoices(invoicesRes.data || []);
            setProviders(providersRes.data || []);
            setPaymentMethods(paymentMethodsRes.data || []);
            setBankAccounts(bankAccountsRes.data || []);
            setCostTypes(costTypesRes.data || []);
            setDepCostTypes(depCostTypesRes.data || []);
            setCostCenters(costCentersRes.data || []);
            setSubDepartments(subDepartmentsRes.data || []);
            setFinancialAccounts(financialAccountsRes.data || []);
        } catch (e: any) {
            toast({ title: "Error", description: e?.message || "Failed to load data", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    async function loadActivities(invoiceId: number) {
        setLoadingActivities(true);
        try {
            // Fetch both activities and history in parallel
            const [activitiesResult, historyResult] = await Promise.all([
                supabase
                    .from("invoice_activities")
                    .select("*")
                    .eq("invoice_id", invoiceId)
                    .order("created_at", { ascending: false }),
                fetch(`/api/invoice-history?invoice_id=${invoiceId}`).then(r => r.json())
            ]);

            const activitiesData = activitiesResult.data || [];
            const historyData = historyResult.success ? (historyResult.history || []) : [];

            // Convert history entries to activity format
            const historyAsActivities: Activity[] = historyData.map((h: any) => ({
                id: `history-${h.id}`,
                invoice_id: h.invoice_id,
                user_email: h.changed_by || "system",
                user_name: h.changed_by === "system" ? "System" : (h.changed_by === "user" ? "User" : h.changed_by || "System"),
                activity_type: h.change_type,
                content: "",
                metadata: h.metadata || {},
                created_at: h.changed_at,
                old_value: h.old_value,
                new_value: h.new_value,
                field_name: h.field_name,
            }));

            // Combine and sort by date (newest first)
            const combined = [...activitiesData, ...historyAsActivities].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setActivities(combined);
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
            toast({ title: "Comment added", variant: "success" });
        } catch (e: any) {
            toast({ title: "Error", description: e?.message || "Failed to add comment", variant: "destructive" });
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
            return parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
        });
    }, [filteredInvoices]);

    function getProviderName(code: string): string {
        return providers.find((p) => p.code === code)?.name || code;
    }

    function getMasterDataName(list: MasterData[], code: string | null | undefined): string {
        if (!code) return "—";
        return list.find((item) => item.code === code)?.name || code;
    }

    function getPaymentMethodName(code: string | null | undefined): string {
        if (!code) return "—";
        return paymentMethods.find((pm) => pm.code === code)?.name || code;
    }

    function getBankAccountName(code: string | null | undefined): string {
        if (!code) return "—";
        return bankAccounts.find((ba) => ba.code === code)?.name || code;
    }

    function getDepartmentName(code: string | null | undefined): string {
        if (!code) return "—";
        const dept = costCenters.find((c) => c.code === code);
        return dept ? `${dept.code} - ${dept.name}` : code;
    }

    function getSubDepartmentName(code: string | null | undefined): string {
        if (!code) return "—";
        const subDept = subDepartments.find((s) => s.code === code);
        return subDept ? `${subDept.code} - ${subDept.name}` : code;
    }

    function toggleGroup(date: string) {
        setExpandedGroups((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(date)) newSet.delete(date);
            else newSet.add(date);
            return newSet;
        });
    }

    function openPaymentConfirmDialog(invoice: Invoice) {
        // If already paid, just unmark it directly
        if (invoice.payment_date) {
            unmarkAsPaid(invoice);
            return;
        }

        // Validate required fields before opening dialog
        const missingFields: string[] = [];
        if (!invoice.bank_account_code) missingFields.push("Bank Account");
        if (!invoice.payment_method_code) missingFields.push("Payment Method");
        if (!invoice.schedule_date) missingFields.push("Scheduled Date");

        const isBankTransfer = invoice.payment_method_code?.toLowerCase().includes("transfer") ||
            invoice.payment_method_code?.toLowerCase().includes("bank") ||
            invoice.payment_method_code === "BANK_TRANSFER" ||
            invoice.payment_method_code === "bank_transfer";

        if (isBankTransfer) {
            const financeStatus = invoice.finance_payment_status || "pending";
            if (financeStatus !== "uploaded" && financeStatus !== "done") {
                missingFields.push("Finance Status must be 'Uploaded' or 'Done' for Bank Transfer payments");
            }
        }

        if (missingFields.length > 0) {
            toast({
                title: "Cannot mark as paid",
                description: `Please complete the following before marking as paid: ${missingFields.join(", ")}`,
                variant: "warning",
            });
            return;
        }

        // Pre-fill with invoice data
        setPaymentConfirmData({
            paid_amount: invoice.paid_amount?.toString() || invoice.invoice_amount.toString(),
            paid_currency: invoice.paid_currency || invoice.currency,
            payment_date: invoice.schedule_date || new Date().toISOString().split("T")[0]
        });
        setPaymentConfirmInvoice(invoice);
        setPaymentConfirmDialogOpen(true);
    }

    async function unmarkAsPaid(invoice: Invoice) {
        setUpdatingInvoice(invoice.id);
        try {
            const { error } = await supabase.from("invoices").update({
                payment_date: null,
                paid_amount: null,
                paid_currency: null
            }).eq("id", invoice.id);
            if (error) throw error;
            setInvoices((prev) => prev.map((inv) => (inv.id === invoice.id ? { ...inv, payment_date: null, paid_amount: null, paid_currency: null } : inv)));
            if (selectedInvoice?.id === invoice.id) setSelectedInvoice({ ...selectedInvoice, payment_date: null, paid_amount: null, paid_currency: null });
            toast({ title: "Marked as unpaid", variant: "success" });
        } catch (e: any) {
            toast({ title: "Error", description: e?.message, variant: "destructive" });
        } finally {
            setUpdatingInvoice(null);
        }
    }

    async function confirmPayment() {
        if (!paymentConfirmInvoice) return;

        // Validate payment data
        if (!paymentConfirmData.paid_amount || !paymentConfirmData.paid_currency || !paymentConfirmData.payment_date) {
            toast({
                title: "Missing fields",
                description: "Please fill in Paid Amount, Paid Currency and Payment Date",
                variant: "warning",
            });
            return;
        }

        setUpdatingInvoice(paymentConfirmInvoice.id);
        try {
            const updatePayload = {
                payment_date: paymentConfirmData.payment_date,
                paid_amount: parseFloat(paymentConfirmData.paid_amount),
                paid_currency: paymentConfirmData.paid_currency
            };

            const { error } = await supabase.from("invoices").update(updatePayload).eq("id", paymentConfirmInvoice.id);
            if (error) throw error;

            setInvoices((prev) => prev.map((inv) => (inv.id === paymentConfirmInvoice.id ? { ...inv, ...updatePayload } : inv)));
            if (selectedInvoice?.id === paymentConfirmInvoice.id) setSelectedInvoice({ ...selectedInvoice, ...updatePayload });

            toast({ title: "Payment confirmed", variant: "success" });
            setPaymentConfirmDialogOpen(false);
            setPaymentConfirmInvoice(null);
        } catch (e: any) {
            toast({ title: "Error", description: e?.message, variant: "destructive" });
        } finally {
            setUpdatingInvoice(null);
        }
    }

    // Legacy function kept for compatibility - now redirects to dialog
    async function togglePaid(invoice: Invoice) {
        openPaymentConfirmDialog(invoice);
    }

    async function updateScheduleDate(invoiceId: number, date: string | null) {
        setUpdatingInvoice(invoiceId);
        try {
            const { error } = await supabase.from("invoices").update({ schedule_date: date }).eq("id", invoiceId);
            if (error) throw error;
            setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, schedule_date: date } : inv)));
            if (selectedInvoice?.id === invoiceId) setSelectedInvoice({ ...selectedInvoice, schedule_date: date });
            if (date) setExpandedGroups((prev) => new Set([...prev, date]));
            toast({ title: date ? "Scheduled" : "Unscheduled", variant: "success" });
        } catch (e: any) {
            toast({ title: "Error", description: e?.message, variant: "destructive" });
        } finally {
            setUpdatingInvoice(null);
        }
    }

    async function updateInvoiceField(invoiceId: number, field: string, value: any) {
        setUpdatingInvoice(invoiceId);
        try {
            // Get current user info
            const { data: userData } = await supabase.auth.getUser();
            const userEmail = userData?.user?.email || "unknown";
            const userName = userData?.user?.user_metadata?.name || userData?.user?.user_metadata?.full_name || userEmail.split("@")[0];

            // Get old value before update
            const currentInvoice = invoices.find(inv => inv.id === invoiceId);
            const oldValue = currentInvoice ? (currentInvoice as any)[field] : null;

            const updatePayload: any = { [field]: value };

            // Update payment_status based on payment_date
            if (field === "payment_date") {
                updatePayload.payment_status = value ? "paid" : "pending";
            }

            // Track status change timestamps
            if (field === "finance_payment_status") {
                updatePayload.finance_status_changed_at = new Date().toISOString();
            }
            if (field === "invoice_status") {
                updatePayload.invoice_status_changed_at = new Date().toISOString();
            }

            const { error } = await supabase.from("invoices").update(updatePayload).eq("id", invoiceId);

            // Record history with user name for tracked fields
            if (!error && ["finance_payment_status", "invoice_status", "schedule_date", "payment_date"].includes(field)) {
                const changeType = field === "payment_date"
                    ? (value ? "paid" : "unpaid")
                    : field === "finance_payment_status"
                        ? "finance_status"
                        : field === "invoice_status"
                            ? "invoice_status"
                            : "schedule_date";

                await fetch("/api/invoice-history", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        invoice_id: invoiceId,
                        change_type: changeType,
                        field_name: field,
                        old_value: oldValue?.toString() || null,
                        new_value: value?.toString() || null,
                        changed_by: userName
                    })
                });
            }
            if (error) throw error;

            setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, ...updatePayload } : inv)));
            if (selectedInvoice?.id === invoiceId) {
                setSelectedInvoice({ ...selectedInvoice, ...updatePayload });
            }

            // Expand group if schedule_date changed
            if (field === "schedule_date" && value) {
                setExpandedGroups((prev) => new Set([...prev, value]));
            }

            toast({ title: "Updated successfully", variant: "success" });
        } catch (e: any) {
            toast({ title: "Error", description: e?.message, variant: "destructive" });
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

    async function openReconciliationDialog(invoice: Invoice) {
        setReconciliationInvoice(invoice);
        setReconciliationDialogOpen(true);
        setLoadingTransactions(true);
        setSelectedTransaction(null);

        try {
            // Fetch bank transactions that could match this invoice
            // Looking for transactions within ±3 days and similar amount
            const scheduleDate = invoice.schedule_date || invoice.payment_date;
            if (!scheduleDate) {
                setBankTransactions([]);
                return;
            }

            const startDate = parseLocalDate(scheduleDate);
            startDate.setDate(startDate.getDate() - 3);
            const endDate = parseLocalDate(scheduleDate);
            endDate.setDate(endDate.getDate() + 3);

            // Query csv_rows for bank transactions
            const { data, error } = await supabase
                .from("csv_rows")
                .select("*")
                .in("source", ["bankinter-eur", "bankinter-usd", "sabadell"])
                .gte("date", startDate.toISOString().split("T")[0])
                .lte("date", endDate.toISOString().split("T")[0])
                .eq("reconciled", false)
                .order("date", { ascending: false });

            if (error) throw error;

            // Filter by approximate amount (±5% tolerance)
            const invoiceAmount = Math.abs(invoice.invoice_amount);
            const matchingTransactions = (data || []).filter((tx: any) => {
                const txAmount = Math.abs(tx.amount);
                const diff = Math.abs(txAmount - invoiceAmount);
                const tolerance = invoiceAmount * 0.05; // 5% tolerance
                return diff <= tolerance || diff <= 1; // Also allow €1 difference
            });

            setBankTransactions(matchingTransactions);
        } catch (e: any) {
            console.error("Error loading transactions:", e);
            toast({ title: "Error", description: "Failed to load bank transactions", variant: "destructive" });
            setBankTransactions([]);
        } finally {
            setLoadingTransactions(false);
        }
    }

    async function performManualReconciliation() {
        if (!reconciliationInvoice || !selectedTransaction) return;

        try {
            const { data: userData } = await supabase.auth.getUser();
            const userName = userData?.user?.user_metadata?.name || userData?.user?.email?.split("@")[0] || "User";

            // Update invoice as reconciled
            const { error: invoiceError } = await supabase
                .from("invoices")
                .update({
                    is_reconciled: true,
                    reconciled_transaction_id: selectedTransaction,
                    reconciled_at: new Date().toISOString()
                })
                .eq("id", reconciliationInvoice.id);

            if (invoiceError) throw invoiceError;

            // Mark bank transaction as reconciled
            const { error: txError } = await supabase
                .from("csv_rows")
                .update({ reconciled: true })
                .eq("id", selectedTransaction);

            if (txError) throw txError;

            // Log history
            await fetch("/api/invoice-history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    invoice_id: reconciliationInvoice.id,
                    change_type: "reconciled",
                    field_name: "is_reconciled",
                    old_value: "false",
                    new_value: "true",
                    changed_by: userName,
                    metadata: { transaction_id: selectedTransaction, method: "manual" }
                })
            });

            // Update local state
            setInvoices((prev) => prev.map((inv) =>
                inv.id === reconciliationInvoice.id
                    ? { ...inv, is_reconciled: true, reconciled_transaction_id: selectedTransaction }
                    : inv
            ));

            toast({ title: "Reconciliation successful!", variant: "success" });
            setReconciliationDialogOpen(false);
            setReconciliationInvoice(null);
            setSelectedTransaction(null);
        } catch (e: any) {
            toast({ title: "Error", description: e?.message || "Failed to reconcile", variant: "destructive" });
        }
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
                    <div className="flex items-center gap-1 px-4 py-2 text-[11px] text-gray-400 font-medium uppercase">
                        <div className="w-[130px] flex-shrink-0">Provider</div>
                        <div className="w-[85px] flex-shrink-0">Finance</div>
                        <div className="w-[75px] flex-shrink-0">Invoice</div>
                        <div className="w-[65px] flex-shrink-0">Inv Date</div>
                        <div className="w-[65px] flex-shrink-0">Due Date</div>
                        <div className="w-[75px] flex-shrink-0">Sched</div>
                        <div className="w-[85px] flex-shrink-0">Pay Method</div>
                        <div className="w-[90px] flex-shrink-0">Bank</div>
                        <div className="w-[85px] flex-shrink-0">Reconciliation</div>
                        <div className="w-[110px] flex-shrink-0 text-right">Amount</div>
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
                                    {group.invoices.map((invoice) => {
                                        const financeStatus = invoice.finance_payment_status || "pending";
                                        const invoiceStatus = invoice.invoice_status || "pending";

                                        const financeStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
                                            pending: { label: "Pending", color: "bg-yellow-900/30 text-yellow-400 border-yellow-700", icon: Clock },
                                            uploaded: { label: "Uploaded", color: "bg-blue-900/30 text-blue-400 border-blue-700", icon: Upload },
                                            done: { label: "Done", color: "bg-green-900/30 text-green-400 border-green-700", icon: CheckCircle },
                                            info_required: { label: "Info Required", color: "bg-red-900/30 text-red-400 border-red-700", icon: AlertCircle },
                                        };

                                        const invoiceStatusConfig: Record<string, { label: string; color: string }> = {
                                            pending: { label: "Pending", color: "bg-yellow-900/30 text-yellow-400 border-yellow-700" },
                                            available: { label: "Available", color: "bg-green-900/30 text-green-400 border-green-700" },
                                        };

                                        return (
                                            <div
                                                key={invoice.id}
                                                className={`flex items-center gap-1 px-4 py-2 hover:bg-gray-800/30 border-t border-gray-800/50 group cursor-pointer ${selectedInvoice?.id === invoice.id ? "bg-gray-700/50" : ""}`}
                                                onClick={() => openDetailPanel(invoice)}
                                            >
                                                {/* Provider */}
                                                <div className="w-[130px] flex-shrink-0 flex items-center gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); togglePaid(invoice); }} disabled={updatingInvoice === invoice.id} className="flex-shrink-0">
                                                        {updatingInvoice === invoice.id ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : invoice.payment_date ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-gray-500 hover:text-gray-300" />}
                                                    </button>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className={`text-[12px] truncate ${invoice.payment_date ? "text-gray-500 line-through" : "text-white"}`}>{getProviderName(invoice.provider_code)}</span>
                                                    </div>
                                                </div>

                                                {/* Finance Payment Status - Editable */}
                                                <div className="w-[85px] flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                    <select
                                                        value={financeStatus}
                                                        onChange={(e) => updateInvoiceField(invoice.id, "finance_payment_status", e.target.value)}
                                                        className={`text-[10px] px-1 py-0.5 rounded border cursor-pointer w-full ${financeStatusConfig[financeStatus]?.color || financeStatusConfig.pending.color} bg-transparent`}
                                                    >
                                                        <option value="pending" className="bg-gray-800 text-white">Pending</option>
                                                        <option value="uploaded" className="bg-gray-800 text-white">Uploaded</option>
                                                        <option value="done" className="bg-gray-800 text-white">Done</option>
                                                        <option value="info_required" className="bg-gray-800 text-white">Info Required</option>
                                                    </select>
                                                </div>

                                                {/* Invoice Status - Editable */}
                                                <div className="w-[75px] flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                    <select
                                                        value={invoiceStatus}
                                                        onChange={(e) => updateInvoiceField(invoice.id, "invoice_status", e.target.value)}
                                                        className={`text-[10px] px-1 py-0.5 rounded border cursor-pointer w-full ${invoiceStatusConfig[invoiceStatus]?.color || invoiceStatusConfig.pending.color} bg-transparent`}
                                                    >
                                                        <option value="pending" className="bg-gray-800 text-white">Pending</option>
                                                        <option value="available" className="bg-gray-800 text-white">Available</option>
                                                    </select>
                                                </div>

                                                {/* Invoice Date */}
                                                <div className="w-[65px] flex-shrink-0 text-[11px] text-gray-300">{invoice.invoice_date ? formatShortDate(invoice.invoice_date) : "—"}</div>

                                                {/* Due Date */}
                                                <div className="w-[65px] flex-shrink-0 text-[11px] text-gray-300">{invoice.due_date ? formatShortDate(invoice.due_date) : "—"}</div>

                                                {/* Schedule Date - Editable */}
                                                <div className="w-[75px] flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="date"
                                                        defaultValue={invoice.schedule_date || ""}
                                                        key={`sched-${invoice.id}-${invoice.schedule_date}`}
                                                        onBlur={(e) => {
                                                            const newVal = e.target.value || null;
                                                            if (newVal !== invoice.schedule_date) {
                                                                updateInvoiceField(invoice.id, "schedule_date", newVal);
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                e.currentTarget.blur();
                                                            }
                                                        }}
                                                        className="text-[10px] px-1 py-0.5 rounded border border-gray-600 bg-transparent text-white w-full cursor-pointer [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70"
                                                    />
                                                </div>

                                                {/* Payment Method - Editable */}
                                                <div className="w-[85px] flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                    <select
                                                        value={invoice.payment_method_code || ""}
                                                        onChange={(e) => updateInvoiceField(invoice.id, "payment_method_code", e.target.value || null)}
                                                        className="text-[10px] px-1 py-0.5 rounded border border-gray-600 bg-transparent text-gray-300 w-full cursor-pointer"
                                                    >
                                                        <option value="" className="bg-gray-800 text-white">—</option>
                                                        {paymentMethods.map((pm) => (
                                                            <option key={pm.code} value={pm.code} className="bg-gray-800 text-white">{pm.name}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Bank Account - Editable */}
                                                <div className="w-[90px] flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                    <select
                                                        value={invoice.bank_account_code || ""}
                                                        onChange={(e) => updateInvoiceField(invoice.id, "bank_account_code", e.target.value || null)}
                                                        className="text-[10px] px-1 py-0.5 rounded border border-gray-600 bg-transparent text-gray-300 w-full cursor-pointer"
                                                    >
                                                        <option value="" className="bg-gray-800 text-white">—</option>
                                                        {bankAccounts.map((ba) => (
                                                            <option key={ba.code} value={ba.code} className="bg-gray-800 text-white">{ba.name}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Reconciliation Status */}
                                                <div className="w-[85px] flex-shrink-0">
                                                    {invoice.is_reconciled ? (
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-900/30 text-green-400 border-green-700">
                                                            <CheckCircle className="h-3 w-3 mr-1" />
                                                            Reconciled
                                                        </Badge>
                                                    ) : invoice.payment_date ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-5 text-[10px] px-1 bg-orange-900/30 text-orange-400 border-orange-700 hover:bg-orange-800/50"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openReconciliationDialog(invoice);
                                                            }}
                                                        >
                                                            Match
                                                        </Button>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-gray-800/50 text-gray-500 border-gray-700">
                                                            Pending
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Invoice Amount - Last column, right aligned */}
                                                <div className="w-[110px] flex-shrink-0 text-right">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <span className="text-[9px] text-gray-500">Inv:</span>
                                                            <span className="text-[11px] font-medium text-white">
                                                                {invoice.currency === "EUR" ? "€" : invoice.currency === "USD" ? "$" : invoice.currency}{formatCurrency(invoice.invoice_amount)}
                                                            </span>
                                                        </div>
                                                        {invoice.paid_amount != null && (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <span className="text-[9px] text-green-400">Paid:</span>
                                                                <span className="text-[11px] font-medium text-green-400">
                                                                    {invoice.paid_currency === "EUR" ? "€" : invoice.paid_currency === "USD" ? "$" : invoice.paid_currency || ""}{formatCurrency(invoice.paid_amount)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
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

            {/* Invoice Side Panel */}
            <InvoiceSidePanel
                open={invoiceModalOpen}
                onClose={() => setInvoiceModalOpen(false)}
                defaultScope={selectedScope === "GLOBAL" ? "ES" : selectedScope}
                defaultScheduleDate={defaultScheduleDateForModal}
                onSuccess={() => {
                    loadData();
                    setInvoiceModalOpen(false);
                }}
            />

            {/* Detail Panel */}
            {detailPanelOpen && selectedInvoice && (
                <div className="fixed right-0 top-[64px] h-[calc(100vh-64px)] w-[500px] bg-[#1e1f21] border-l border-gray-700 flex flex-col z-[100] shadow-2xl">
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
                            {/* Invoice Info (read-only) */}
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
                                <Calendar className="h-4 w-4 text-gray-500" />
                                <div>
                                    <p className="text-xs text-gray-500">Due Date</p>
                                    <p className="text-sm text-white">{selectedInvoice.due_date ? formatShortDate(selectedInvoice.due_date) : "—"}</p>
                                </div>
                            </div>
                        </div>

                        {/* Payment Control (editable) */}
                        <div className="px-4 py-4 space-y-4 border-b border-gray-800 bg-[#252627]">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                Payment Control
                            </h3>

                            {/* Schedule Date */}
                            <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Schedule Date</Label>
                                <Input
                                    type="date"
                                    value={selectedInvoice.schedule_date || ""}
                                    onChange={(e) => updateInvoiceField(selectedInvoice.id, "schedule_date", e.target.value || null)}
                                    className="bg-[#1e1f21] border-gray-600 text-white h-9"
                                />
                            </div>

                            {/* Bank Account */}
                            <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Bank Account</Label>
                                <select
                                    value={selectedInvoice.bank_account_code || ""}
                                    onChange={(e) => updateInvoiceField(selectedInvoice.id, "bank_account_code", e.target.value || null)}
                                    className="w-full h-9 px-3 rounded-md bg-[#1e1f21] border border-gray-600 text-white text-sm"
                                >
                                    <option value="">Select bank account...</option>
                                    {bankAccounts.map((ba) => (
                                        <option key={ba.code} value={ba.code}>{ba.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Payment Method */}
                            <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Payment Method</Label>
                                <select
                                    value={selectedInvoice.payment_method_code || ""}
                                    onChange={(e) => updateInvoiceField(selectedInvoice.id, "payment_method_code", e.target.value || null)}
                                    className="w-full h-9 px-3 rounded-md bg-[#1e1f21] border border-gray-600 text-white text-sm"
                                >
                                    <option value="">Select payment method...</option>
                                    {paymentMethods.map((pm) => (
                                        <option key={pm.code} value={pm.code}>{pm.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Payment Date */}
                            <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Payment Date</Label>
                                <Input
                                    type="date"
                                    value={selectedInvoice.payment_date || ""}
                                    onChange={(e) => updateInvoiceField(selectedInvoice.id, "payment_date", e.target.value || null)}
                                    className="bg-[#1e1f21] border-gray-600 text-white h-9"
                                />
                            </div>

                            {/* Paid Amount */}
                            <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Paid Amount</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={selectedInvoice.paid_amount || ""}
                                    onChange={(e) => updateInvoiceField(selectedInvoice.id, "paid_amount", e.target.value ? parseFloat(e.target.value) : null)}
                                    placeholder={selectedInvoice.invoice_amount.toString()}
                                    className="bg-[#1e1f21] border-gray-600 text-white h-9"
                                />
                            </div>

                            {/* Paid Currency */}
                            <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Paid Currency</Label>
                                <select
                                    value={selectedInvoice.paid_currency || ""}
                                    onChange={(e) => updateInvoiceField(selectedInvoice.id, "paid_currency", e.target.value || null)}
                                    className="w-full h-9 px-3 rounded-md bg-[#1e1f21] border border-gray-600 text-white text-sm"
                                >
                                    <option value="">Select currency...</option>
                                    <option value="EUR">EUR</option>
                                    <option value="USD">USD</option>
                                    <option value="GBP">GBP</option>
                                    <option value="BRL">BRL</option>
                                </select>
                            </div>

                            {/* Finance Payment Status */}
                            <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Finance Payment Status</Label>
                                <select
                                    value={selectedInvoice.finance_payment_status || "pending"}
                                    onChange={(e) => updateInvoiceField(selectedInvoice.id, "finance_payment_status", e.target.value)}
                                    className="w-full h-9 px-3 rounded-md bg-[#1e1f21] border border-gray-600 text-white text-sm"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="uploaded">Uploaded</option>
                                    <option value="done">Done</option>
                                    <option value="info_required">Info Required</option>
                                </select>
                            </div>

                            {/* Invoice Status */}
                            <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Invoice Status</Label>
                                <select
                                    value={selectedInvoice.invoice_status || "pending"}
                                    onChange={(e) => updateInvoiceField(selectedInvoice.id, "invoice_status", e.target.value)}
                                    className="w-full h-9 px-3 rounded-md bg-[#1e1f21] border border-gray-600 text-white text-sm"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="available">Available</option>
                                </select>
                            </div>

                            {/* Payment Status */}
                            <div className="flex items-center gap-3 pt-2">
                                <CheckCircle className="h-4 w-4 text-gray-500" />
                                <div>
                                    <p className="text-xs text-gray-500">Payment Status</p>
                                    <Badge variant="outline" className={selectedInvoice.payment_date ? "bg-green-900/30 text-green-400 border-green-700" : "bg-yellow-900/30 text-yellow-400 border-yellow-700"}>
                                        {selectedInvoice.payment_date ? "Paid" : "Pending"}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {/* Classification (read-only badges) */}
                        <div className="px-4 py-4 space-y-3 border-b border-gray-800">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Classification</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">P&L Account</p>
                                    <Badge variant="outline" className="bg-red-900/30 text-red-400 border-red-700 text-xs">{getMasterDataName(financialAccounts, selectedInvoice.financial_account_code)}</Badge>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Dep Cost Type</p>
                                    <Badge variant="outline" className="bg-green-900/30 text-green-400 border-green-700 text-xs">{getMasterDataName(depCostTypes, selectedInvoice.dep_cost_type_code)}</Badge>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Department</p>
                                    <Badge variant="outline" className="bg-blue-900/30 text-blue-400 border-blue-700 text-xs">{getDepartmentName(selectedInvoice.cost_center_code)}</Badge>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Sub-Department</p>
                                    <Badge variant="outline" className="bg-purple-900/30 text-purple-400 border-purple-700 text-xs">{getSubDepartmentName(selectedInvoice.sub_department_code)}</Badge>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Cost Type</p>
                                    <Badge variant="outline" className="bg-pink-900/30 text-pink-400 border-pink-700 text-xs">{getMasterDataName(costTypes, selectedInvoice.cost_type_code)}</Badge>
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
                                <div className="space-y-4 max-h-[300px] overflow-y-auto">
                                    {activities.length === 0 ? (
                                        <p className="text-center text-gray-500 py-4 text-sm">No activities yet.</p>
                                    ) : (
                                        activities
                                            .filter((a) => activeTab === "all" || a.activity_type === "comment")
                                            .map((activity) => {
                                                // Determine icon color based on activity type
                                                const getActivityColor = () => {
                                                    switch (activity.activity_type) {
                                                        case "created": return "bg-blue-600";
                                                        case "finance_status": return "bg-purple-600";
                                                        case "invoice_status": return "bg-cyan-600";
                                                        case "schedule_date": return "bg-orange-600";
                                                        case "paid": return "bg-green-600";
                                                        case "unpaid": return "bg-yellow-600";
                                                        case "comment": return "bg-blue-600";
                                                        case "attachment": return "bg-indigo-600";
                                                        default: return "bg-gray-600";
                                                    }
                                                };

                                                // Format activity description
                                                const getActivityDescription = () => {
                                                    const statusLabels: Record<string, string> = {
                                                        pending: "Pending", uploaded: "Uploaded", done: "Done",
                                                        info_required: "Info Required", available: "Available"
                                                    };
                                                    switch (activity.activity_type) {
                                                        case "created": return "created this payment";
                                                        case "finance_status":
                                                            return `changed Finance Status: ${statusLabels[activity.old_value || ""] || activity.old_value || "—"} → ${statusLabels[activity.new_value || ""] || activity.new_value || "—"}`;
                                                        case "invoice_status":
                                                            return `changed Invoice Status: ${statusLabels[activity.old_value || ""] || activity.old_value || "—"} → ${statusLabels[activity.new_value || ""] || activity.new_value || "—"}`;
                                                        case "schedule_date":
                                                            const oldDate = activity.old_value ? parseLocalDate(activity.old_value).toLocaleDateString("pt-BR") : "none";
                                                            const newDate = activity.new_value ? parseLocalDate(activity.new_value).toLocaleDateString("pt-BR") : "none";
                                                            return `changed Schedule Date: ${oldDate} → ${newDate}`;
                                                        case "paid": return "marked as Paid";
                                                        case "unpaid": return "marked as Unpaid";
                                                        default: return activity.activity_type;
                                                    }
                                                };

                                                return (
                                                    <div key={activity.id} className="flex gap-3">
                                                        <div className={`w-8 h-8 rounded-full ${getActivityColor()} flex items-center justify-center flex-shrink-0`}>
                                                            <span className="text-white text-xs font-medium">{activity.user_name?.charAt(0).toUpperCase() || "?"}</span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-sm font-medium text-white">{activity.user_name}</span>
                                                                {activity.activity_type !== "comment" && (
                                                                    <span className="text-sm text-gray-400">{getActivityDescription()}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-xs text-gray-500">{formatActivityTime(activity.created_at)}</span>
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
                                                );
                                            })
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

            {/* Payment Confirmation Dialog */}
            {paymentConfirmDialogOpen && paymentConfirmInvoice && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]">
                    <div className="bg-[#2a2b2d] rounded-lg w-[450px] overflow-hidden flex flex-col">
                        {/* Dialog Header */}
                        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Confirm Payment</h3>
                                <p className="text-sm text-gray-400">{getProviderName(paymentConfirmInvoice.provider_code)}</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                                onClick={() => {
                                    setPaymentConfirmDialogOpen(false);
                                    setPaymentConfirmInvoice(null);
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Dialog Content */}
                        <div className="px-6 py-4 space-y-4">
                            {/* Invoice Info */}
                            <div className="bg-[#1e1f21] rounded-lg p-3 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Invoice Amount:</span>
                                    <span className="text-white font-medium">{formatCurrency(paymentConfirmInvoice.invoice_amount)} {paymentConfirmInvoice.currency}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Schedule Date:</span>
                                    <span className="text-white">{paymentConfirmInvoice.schedule_date ? formatShortDate(paymentConfirmInvoice.schedule_date) : "—"}</span>
                                </div>
                            </div>

                            {/* Paid Amount */}
                            <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Paid Amount *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={paymentConfirmData.paid_amount}
                                    onChange={(e) => setPaymentConfirmData({ ...paymentConfirmData, paid_amount: e.target.value })}
                                    className="bg-[#1e1f21] border-gray-600 text-white h-9"
                                    placeholder="0.00"
                                />
                            </div>

                            {/* Paid Currency */}
                            <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Paid Currency *</Label>
                                <select
                                    value={paymentConfirmData.paid_currency}
                                    onChange={(e) => setPaymentConfirmData({ ...paymentConfirmData, paid_currency: e.target.value })}
                                    className="w-full h-9 px-3 rounded-md bg-[#1e1f21] border border-gray-600 text-white text-sm"
                                >
                                    <option value="">Select currency...</option>
                                    <option value="EUR">EUR - Euro</option>
                                    <option value="USD">USD - US Dollar</option>
                                    <option value="GBP">GBP - British Pound</option>
                                    <option value="BRL">BRL - Brazilian Real</option>
                                </select>
                            </div>

                            {/* Payment Date */}
                            <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Payment Date *</Label>
                                <Input
                                    type="date"
                                    value={paymentConfirmData.payment_date}
                                    onChange={(e) => setPaymentConfirmData({ ...paymentConfirmData, payment_date: e.target.value })}
                                    className="bg-[#1e1f21] border-gray-600 text-white h-9"
                                />
                            </div>
                        </div>

                        {/* Dialog Footer */}
                        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setPaymentConfirmDialogOpen(false);
                                    setPaymentConfirmInvoice(null);
                                }}
                                className="text-gray-400 hover:text-white"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmPayment}
                                disabled={updatingInvoice === paymentConfirmInvoice.id}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                {updatingInvoice === paymentConfirmInvoice.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                )}
                                Confirm Payment
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Reconciliation Dialog */}
            {reconciliationDialogOpen && reconciliationInvoice && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]">
                    <div className="bg-[#2a2b2d] rounded-lg w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
                        {/* Dialog Header */}
                        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Manual Reconciliation</h3>
                                <p className="text-sm text-gray-400">Match invoice with a bank transaction</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setReconciliationDialogOpen(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Invoice Info */}
                        <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-700">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500">Provider</span>
                                    <p className="text-white font-medium">{getProviderName(reconciliationInvoice.provider_code)}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">Amount</span>
                                    <p className="text-white font-medium">
                                        {reconciliationInvoice.currency === "EUR" ? "€" : "$"}
                                        {formatCurrency(reconciliationInvoice.invoice_amount)}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-gray-500">Bank Account</span>
                                    <p className="text-white font-medium">{getBankAccountName(reconciliationInvoice.bank_account_code)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Matching Transactions */}
                        <div className="flex-1 overflow-auto px-6 py-4">
                            <h4 className="text-sm font-medium text-gray-400 mb-3">Matching Bank Transactions (±3 days, ±5% amount)</h4>

                            {loadingTransactions ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                </div>
                            ) : bankTransactions.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                                    <p>No matching transactions found</p>
                                    <p className="text-xs mt-1">Try adjusting the date range or check the bank account</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {bankTransactions.map((tx) => (
                                        <div
                                            key={tx.id}
                                            onClick={() => setSelectedTransaction(tx.id)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedTransaction === tx.id
                                                ? "border-blue-500 bg-blue-900/20"
                                                : "border-gray-700 hover:border-gray-600 bg-gray-800/30"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="radio"
                                                        checked={selectedTransaction === tx.id}
                                                        onChange={() => setSelectedTransaction(tx.id)}
                                                        className="h-4 w-4 text-blue-600"
                                                    />
                                                    <div>
                                                        <p className="text-white text-sm">{tx.description || "Bank Transaction"}</p>
                                                        <p className="text-xs text-gray-500">{tx.date} • {tx.source}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`font-medium ${tx.amount < 0 ? "text-red-400" : "text-green-400"}`}>
                                                        {tx.amount < 0 ? "-" : "+"}€{formatCurrency(Math.abs(tx.amount))}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Dialog Footer */}
                        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setReconciliationDialogOpen(false)}
                                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={performManualReconciliation}
                                disabled={!selectedTransaction}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Confirm Reconciliation
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
