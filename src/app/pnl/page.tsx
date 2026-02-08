"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Download,
    Calendar,
    Building2,
    Layers,
    ChevronDown,
    ChevronRight,
    RefreshCw,
    Filter,
    BarChart3,
    FileSpreadsheet,
    Loader2,
    X,
    ExternalLink,
    AlertCircle,
    Eye,
    FileText,
    Hash,
    CreditCard,
    Paperclip,
    Pencil,
    Save,
    XCircle,
    History,
    ArrowLeft,
    Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { formatCurrency } from "@/lib/formatters";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { ClinicVariationsTable } from "@/components/clinic-variations-table";
import { Separator } from "@/components/ui/separator";

// Helper: Check if FA code is for clinics (102.x, 103.x, 104.x)
const isClinicsFACode = (code: string): boolean => {
    return code.startsWith("102.") || code.startsWith("103.") || code.startsWith("104.");
};

// Types for drill-down
interface DrilldownTransaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    customer: string;
    orderType: string;
    // Full invoice details
    invoiceNumber?: string;
    invoiceDate?: string;
    benefitDate?: string;
    inputDate?: string;
    dueDate?: string;
    scheduleDate?: string;
    paymentDate?: string;
    currency?: string;
    entryType?: string;
    scope?: string;
    // Codes + resolved names
    bankAccountCode?: string;
    bankAccountName?: string;
    paymentMethodCode?: string;
    paymentMethodName?: string;
    costCenterCode?: string;
    costCenterName?: string;
    costTypeCode?: string;
    costTypeName?: string;
    depCostTypeCode?: string;
    depCostTypeName?: string;
    courseCode?: string;
    courseName?: string;
    subDepartmentCode?: string;
    subDepartmentName?: string;
    providerName?: string;
    financialAccountName?: string;
    faCode?: string;
    source?: string;
    // Flags
    notes?: string;
    dreImpact?: boolean;
    cashImpact?: boolean;
    isIntercompany?: boolean;
    // Payment
    paidAmount?: number;
    paidCurrency?: string;
    eurExchange?: number;
    paymentStatus?: string;
    financePaymentStatus?: string;
    invoiceStatus?: string;
}

interface DrilldownState {
    isOpen: boolean;
    loading: boolean;
    faCode: string;
    faName: string;
    month: number;
    transactions: DrilldownTransaction[];
    total: number;
    count: number;
}

// Month names
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface MonthlyData {
    jan: number; feb: number; mar: number; apr: number; may: number; jun: number;
    jul: number; aug: number; sep: number; oct: number; nov: number; dec: number;
}

interface DRELineMonthly {
    code: string;
    name: string;
    type: "revenue" | "expense" | "subtotal" | "total";
    level: number;
    monthly: MonthlyData;
    budget: MonthlyData;
    children?: DRELineMonthly[];
}

// Helper: create empty monthly data
const emptyMonthlyData = (): MonthlyData => ({
    jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
    jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
});

// Helper: generate uniform monthly budget data (for revenue - still hardcoded)
const generateBudgetData = (baseAnnual: number): MonthlyData => {
    const monthlyBase = baseAnnual / 12;
    return {
        jan: Math.round(monthlyBase), feb: Math.round(monthlyBase), mar: Math.round(monthlyBase),
        apr: Math.round(monthlyBase), may: Math.round(monthlyBase), jun: Math.round(monthlyBase),
        jul: Math.round(monthlyBase), aug: Math.round(monthlyBase), sep: Math.round(monthlyBase),
        oct: Math.round(monthlyBase), nov: Math.round(monthlyBase), dec: Math.round(monthlyBase),
    };
};

const sumMonthly = (data: MonthlyData): number => {
    return data.jan + data.feb + data.mar + data.apr + data.may + data.jun +
        data.jul + data.aug + data.sep + data.oct + data.nov + data.dec;
};

const getMonthValue = (data: MonthlyData, month: number): number => {
    const keys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
    return data[keys[month]];
};

const getYTD = (data: MonthlyData, upToMonth: number): number => {
    const keys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
    return keys.slice(0, upToMonth + 1).reduce((sum, key) => sum + data[key], 0);
};

// ── Invoice Detail Popup (dark theme, full-width like the drilldown popup) ──
// Provider history invoice type
interface ProviderHistoryInvoice {
    id: string;
    invoiceDate: string | null;
    benefitDate: string | null;
    dueDate: string | null;
    scheduleDate: string | null;
    paymentDate: string | null;
    description: string;
    amount: number;
    currency: string;
    invoiceNumber: string | null;
    invoiceType: string | null;
    faCode: string | null;
    faName: string | null;
    bankAccountCode: string | null;
    bankAccountName: string | null;
    paymentStatus: string | null;
    paidAmount: number | null;
    paidCurrency: string | null;
    dreImpact: boolean | null;
    cashImpact: boolean | null;
    customerName?: string | null;
    source?: string;
}

function InvoiceDetailPopup({ invoice: initialInvoice, onClose }: { invoice: DrilldownTransaction; onClose: () => void }) {
    const [invoice, setInvoice] = useState(initialInvoice);
    const [attachments, setAttachments] = useState<{ id: number; file_name: string; url: string }[]>([]);
    const [loadingAttachments, setLoadingAttachments] = useState(false);

    // Edit mode
    const [isEditing, setIsEditing] = useState(false);
    const [editFields, setEditFields] = useState<Record<string, string | number | boolean | null>>({});
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Provider/Customer history
    const [providerHistory, setProviderHistory] = useState<ProviderHistoryInvoice[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyViewInvoice, setHistoryViewInvoice] = useState<ProviderHistoryInvoice | null>(null);
    const [historyFAFilter, setHistoryFAFilter] = useState<string>("all");
    const [uniqueFACodes, setUniqueFACodes] = useState<string[]>([]);

    useEffect(() => {
        if (invoice.source === "invoices" && invoice.id) {
            loadAttachments();
        }
        if (invoice.customer) {
            loadProviderHistory();
        }
    }, [invoice.id]);

    async function loadAttachments() {
        setLoadingAttachments(true);
        try {
            const res = await fetch(`/api/attachments?entity_type=ap_invoice&entity_id=${invoice.id}`);
            const data = await res.json();
            if (data.attachments) setAttachments(data.attachments);
        } catch (e) {
            console.error("Failed to load attachments:", e);
        } finally {
            setLoadingAttachments(false);
        }
    }

    async function loadProviderHistory() {
        if (!invoice.customer) return;
        setLoadingHistory(true);
        try {
            const isRevenue = invoice.source !== "invoices";
            const params = isRevenue
                ? `customer=${encodeURIComponent(invoice.customer)}&type=revenue`
                : `provider=${encodeURIComponent(invoice.customer)}&type=expense`;
            const res = await fetch(`/api/pnl/provider-history?${params}`);
            const data = await res.json();
            if (data.invoices) setProviderHistory(data.invoices);
            if (data.uniqueFACodes) setUniqueFACodes(data.uniqueFACodes);
        } catch (e) {
            console.error("Failed to load history:", e);
        } finally {
            setLoadingHistory(false);
        }
    }

    // ── Edit helpers ──
    function startEditing() {
        setEditFields({
            invoiceNumber: invoice.invoiceNumber || "",
            invoiceDate: invoice.invoiceDate || "",
            benefitDate: invoice.benefitDate || "",
            dueDate: invoice.dueDate || "",
            scheduleDate: invoice.scheduleDate || "",
            paymentDate: invoice.paymentDate || "",
            invoiceAmount: invoice.amount || 0,
            currency: invoice.currency || "EUR",
            paidAmount: invoice.paidAmount || 0,
            paidCurrency: invoice.paidCurrency || "",
            eurExchange: invoice.eurExchange || 0,
            description: invoice.description || "",
            notes: invoice.notes || "",
            providerCode: invoice.customer || "",
            bankAccountCode: invoice.bankAccountCode || "",
            paymentMethodCode: invoice.paymentMethodCode || "",
            costCenterCode: invoice.costCenterCode || "",
            costTypeCode: invoice.costTypeCode || "",
            depCostTypeCode: invoice.depCostTypeCode || "",
            courseCode: invoice.courseCode || "",
            financialAccountCode: invoice.faCode || "",
            financialAccountName: invoice.financialAccountName || "",
            entryType: invoice.entryType || "",
            dreImpact: invoice.dreImpact ?? false,
            cashImpact: invoice.cashImpact ?? false,
            isIntercompany: invoice.isIntercompany ?? false,
            paymentStatus: invoice.paymentStatus || "",
        });
        setIsEditing(true);
        setSaveMessage(null);
    }

    function cancelEditing() {
        setIsEditing(false);
        setEditFields({});
        setSaveMessage(null);
    }

    function updateField(key: string, value: string | number | boolean | null) {
        setEditFields(prev => ({ ...prev, [key]: value }));
    }

    async function saveChanges() {
        setSaving(true);
        setSaveMessage(null);
        try {
            const res = await fetch("/api/pnl/invoice-update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: invoice.id, ...editFields }),
            });
            const data = await res.json();
            if (data.success) {
                // Update local invoice state with new values
                setInvoice(prev => ({
                    ...prev,
                    invoiceNumber: String(editFields.invoiceNumber || ""),
                    invoiceDate: String(editFields.invoiceDate || ""),
                    benefitDate: String(editFields.benefitDate || ""),
                    dueDate: String(editFields.dueDate || ""),
                    scheduleDate: String(editFields.scheduleDate || ""),
                    paymentDate: String(editFields.paymentDate || ""),
                    amount: Number(editFields.invoiceAmount) || prev.amount,
                    currency: String(editFields.currency || "EUR"),
                    paidAmount: Number(editFields.paidAmount) || undefined,
                    paidCurrency: String(editFields.paidCurrency || ""),
                    eurExchange: Number(editFields.eurExchange) || undefined,
                    description: String(editFields.description || ""),
                    notes: String(editFields.notes || ""),
                    customer: String(editFields.providerCode || prev.customer),
                    bankAccountCode: String(editFields.bankAccountCode || ""),
                    paymentMethodCode: String(editFields.paymentMethodCode || ""),
                    costCenterCode: String(editFields.costCenterCode || ""),
                    costTypeCode: String(editFields.costTypeCode || ""),
                    depCostTypeCode: String(editFields.depCostTypeCode || ""),
                    courseCode: String(editFields.courseCode || ""),
                    faCode: String(editFields.financialAccountCode || prev.faCode),
                    financialAccountName: String(editFields.financialAccountName || prev.financialAccountName),
                    entryType: String(editFields.entryType || ""),
                    dreImpact: Boolean(editFields.dreImpact),
                    cashImpact: Boolean(editFields.cashImpact),
                    isIntercompany: Boolean(editFields.isIntercompany),
                    paymentStatus: String(editFields.paymentStatus || ""),
                }));
                setIsEditing(false);
                setSaveMessage({ type: "success", text: "Invoice updated successfully!" });
                setTimeout(() => setSaveMessage(null), 3000);
            } else {
                setSaveMessage({ type: "error", text: data.error || "Error saving" });
            }
        } catch (e) {
            setSaveMessage({ type: "error", text: "Connection error" });
        } finally {
            setSaving(false);
        }
    }

    const fmt = (d?: string | null) => {
        if (!d) return "-";
        return `${d.substring(8, 10)}/${d.substring(5, 7)}/${d.substring(0, 4)}`;
    };

    const currSym = (c?: string) => (c === "USD" ? "$" : c === "GBP" ? "£" : "€");

    // Determine payment/reconciliation status
    const isPaid = !!(invoice.paymentDate || (invoice.paidAmount && invoice.paidAmount !== 0));
    const isScheduled = !isPaid && !!invoice.scheduleDate;

    const paymentStatusLabel = invoice.paymentStatus
        || invoice.financePaymentStatus
        || (isPaid ? "PAID" : isScheduled ? "SCHEDULED" : "NOT_SCHEDULED");

    const paymentStatusColor = paymentStatusLabel.toLowerCase().includes("paid")
        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
        : paymentStatusLabel.toLowerCase().includes("scheduled")
            ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
            : "bg-gray-600/30 text-gray-400 border-gray-500/30";

    // Field display helper (supports editing)
    const Field = ({ label, value, fieldKey, highlight, mono, type }: { label: string; value?: string | null; fieldKey?: string; highlight?: string; mono?: boolean; type?: "text" | "date" | "number" }) => {
        if (isEditing && fieldKey) {
            const inputType = type || "text";
            return (
                <div>
                    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                    <Input
                        type={inputType}
                        value={String(editFields[fieldKey] ?? "")}
                        onChange={(e) => updateField(fieldKey, inputType === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
                        className="h-8 text-sm bg-[#1e1f21] border-gray-600 text-white focus:border-blue-500"
                    />
                </div>
            );
        }
        return (
            <div>
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className={`text-sm ${highlight || "text-white"} ${mono ? "font-mono" : ""}`}>{value || "-"}</p>
            </div>
        );
    };

    // Toggle field helper for booleans
    const ToggleField = ({ label, fieldKey, value }: { label: string; fieldKey: string; value?: boolean }) => {
        if (isEditing) {
            const isActive = Boolean(editFields[fieldKey]);
            return (
                <button
                    onClick={() => updateField(fieldKey, !isActive)}
                    className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${isActive
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-gray-700/50 text-gray-500 border-gray-600"
                        }`}
                >
                    {isActive && <Check className="h-3 w-3 inline mr-1" />}
                    {label}
                </button>
            );
        }
        if (!value) return null;
        return (
            <Badge className={`text-xs ${label === "DRE Impact" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : label === "Cash Impact" ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                    : "bg-red-500/20 text-red-300 border-red-500/30"
                }`}>{label}</Badge>
        );
    };

    // ── History detail view for a historical invoice ──
    if (historyViewInvoice) {
        return (
            <Dialog open onOpenChange={(open) => !open && onClose()}>
                <DialogContent
                    className="max-w-none max-h-[90vh] p-0 bg-[#1e1f21] border-gray-700 flex flex-col overflow-hidden"
                    style={{ width: '80vw' }}
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setHistoryViewInvoice(null)} className="text-gray-400 hover:text-white transition-colors">
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div>
                                <h3 className="text-lg font-semibold text-white">History Invoice Detail</h3>
                                <p className="text-xs text-gray-500">
                                    {historyViewInvoice.invoiceNumber || "No number"} • {historyViewInvoice.faName || historyViewInvoice.faCode || "-"}
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white h-8 w-8 p-0">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                        {/* Dates */}
                        <div>
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5" /> Dates
                            </h4>
                            <div className="grid grid-cols-5 gap-4 bg-[#252627] rounded-lg p-4">
                                <div><p className="text-xs text-gray-500 mb-0.5">Invoice Date</p><p className="text-sm text-white">{fmt(historyViewInvoice.invoiceDate)}</p></div>
                                <div><p className="text-xs text-gray-500 mb-0.5">Benefit Date</p><p className="text-sm text-white">{fmt(historyViewInvoice.benefitDate)}</p></div>
                                <div><p className="text-xs text-gray-500 mb-0.5">Due Date</p><p className="text-sm text-white">{fmt(historyViewInvoice.dueDate)}</p></div>
                                <div><p className="text-xs text-gray-500 mb-0.5">Schedule Date</p><p className="text-sm text-white">{fmt(historyViewInvoice.scheduleDate)}</p></div>
                                <div><p className="text-xs text-gray-500 mb-0.5">Payment Date</p><p className="text-sm text-white font-medium">{fmt(historyViewInvoice.paymentDate)}</p></div>
                            </div>
                        </div>
                        {/* Amount */}
                        <div>
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <DollarSign className="h-3.5 w-3.5" /> Amount
                            </h4>
                            <div className="grid grid-cols-4 gap-4 bg-[#252627] rounded-lg p-4">
                                <div>
                                    <p className="text-xs text-gray-500 mb-0.5">Total Amount</p>
                                    <p className="text-lg text-white font-bold font-mono">{formatCurrency(historyViewInvoice.amount, historyViewInvoice.currency || "EUR")}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-0.5">Currency</p>
                                    <span className="inline-flex items-center justify-center h-7 w-7 rounded bg-blue-600 text-white text-sm font-bold mt-0.5">
                                        {currSym(historyViewInvoice.currency)}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-0.5">Paid Amount</p>
                                    <p className="text-sm text-emerald-400 font-medium">{historyViewInvoice.paidAmount ? formatCurrency(historyViewInvoice.paidAmount, historyViewInvoice.paidCurrency || "EUR") : "-"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-0.5">Payment Status</p>
                                    <p className="text-sm text-white">{historyViewInvoice.paymentStatus?.replace(/_/g, " ") || "-"}</p>
                                </div>
                            </div>
                        </div>
                        {/* Classification */}
                        <div>
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Layers className="h-3.5 w-3.5" /> Classification
                            </h4>
                            <div className="grid grid-cols-3 gap-4 bg-[#252627] rounded-lg p-4">
                                <div>
                                    <p className="text-xs text-gray-500 mb-0.5">Type</p>
                                    <p className="text-sm text-white">{historyViewInvoice.invoiceType || "-"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-0.5">Financial Account</p>
                                    <p className="text-sm text-white">{historyViewInvoice.faName || "-"}</p>
                                    {historyViewInvoice.faCode && <p className="text-xs text-gray-600 font-mono">{historyViewInvoice.faCode}</p>}
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-0.5">Bank Account</p>
                                    <p className="text-sm text-white">{historyViewInvoice.bankAccountName || historyViewInvoice.bankAccountCode || "-"}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {historyViewInvoice.dreImpact && <Badge className="text-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/30">DRE Impact</Badge>}
                                {historyViewInvoice.cashImpact && <Badge className="text-xs bg-cyan-500/20 text-cyan-300 border-cyan-500/30">Cash Impact</Badge>}
                            </div>
                        </div>
                        {/* Description */}
                        {historyViewInvoice.description && (
                            <div>
                                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Description</h4>
                                <div className="bg-[#2a2b2d] rounded-lg p-4">
                                    <p className="text-sm text-gray-300">{historyViewInvoice.description}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="max-w-none max-h-[90vh] p-0 bg-[#1e1f21] border-gray-700 flex flex-col overflow-hidden"
                style={{ width: '80vw' }}
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-white truncate">
                                {invoice.providerName || invoice.customer}
                            </h3>
                            <p className="text-xs text-gray-500">
                                {invoice.financialAccountName || invoice.description}
                                {invoice.faCode && <span className="ml-2 font-mono text-gray-600">({invoice.faCode})</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Save message */}
                        {saveMessage && (
                            <span className={`text-xs px-2 py-1 rounded ${saveMessage.type === "success" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                                {saveMessage.text}
                            </span>
                        )}
                        {/* Edit / Save / Cancel buttons */}
                        {invoice.source === "invoices" && !isEditing && (
                            <Button variant="ghost" size="sm" onClick={startEditing} className="text-gray-400 hover:text-blue-400 gap-1.5 text-xs">
                                <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                        )}
                        {isEditing && (
                            <>
                                <Button variant="ghost" size="sm" onClick={cancelEditing} className="text-gray-400 hover:text-red-400 gap-1 text-xs">
                                    <XCircle className="h-3.5 w-3.5" /> Cancel
                                </Button>
                                <Button size="sm" onClick={saveChanges} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-1 text-xs">
                                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                    Save
                                </Button>
                            </>
                        )}
                        {/* History toggle */}
                        <Button
                            variant="ghost" size="sm"
                            onClick={() => setShowHistory(!showHistory)}
                            className={`gap-1.5 text-xs ${showHistory ? "text-blue-400" : "text-gray-400 hover:text-blue-400"}`}
                        >
                            <History className="h-3.5 w-3.5" />
                            History ({providerHistory.length})
                        </Button>
                        <Badge className={`text-xs ${paymentStatusColor}`}>
                            {paymentStatusLabel.replace(/_/g, " ")}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white h-8 w-8 p-0">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* ── Scrollable Content ── */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                    {/* ═══ Section: Invoice Identification ═══ */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5" /> Invoice Identification
                        </h4>
                        <div className="grid grid-cols-4 gap-4 bg-[#252627] rounded-lg p-4">
                            <Field label="Invoice Nº" value={invoice.invoiceNumber} fieldKey="invoiceNumber" mono />
                            <Field label="Invoice Type" value={invoice.orderType} />
                            <Field label="Entry Type" value={invoice.entryType} fieldKey="entryType" />
                            <Field label="Scope" value={invoice.scope} />
                        </div>
                    </div>

                    {/* ═══ Section: Dates ═══ */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" /> Dates
                        </h4>
                        <div className="grid grid-cols-6 gap-4 bg-[#252627] rounded-lg p-4">
                            <Field label="Input Date" value={fmt(invoice.inputDate)} />
                            <Field label="Invoice Date" value={isEditing ? undefined : fmt(invoice.invoiceDate)} fieldKey="invoiceDate" type="date" />
                            <Field label="Benefit Date" value={isEditing ? undefined : fmt(invoice.benefitDate)} fieldKey="benefitDate" type="date" />
                            <Field label="Due Date" value={isEditing ? undefined : fmt(invoice.dueDate)} fieldKey="dueDate" type="date" />
                            <Field label="Schedule Date" value={isEditing ? undefined : fmt(invoice.scheduleDate)} fieldKey="scheduleDate" type="date" highlight={isScheduled && !isPaid ? "text-blue-300" : "text-white"} />
                            <Field label="Payment Date" value={isEditing ? undefined : fmt(invoice.paymentDate)} fieldKey="paymentDate" type="date" highlight={isPaid ? "text-emerald-400" : "text-white"} />
                        </div>
                    </div>

                    {/* ═══ Section: Amount ═══ */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <DollarSign className="h-3.5 w-3.5" /> Amount
                        </h4>
                        <div className="grid grid-cols-5 gap-4 bg-[#252627] rounded-lg p-4">
                            {isEditing ? (
                                <Field label="Total Amount" fieldKey="invoiceAmount" type="number" />
                            ) : (
                                <div>
                                    <p className="text-xs text-gray-500 mb-0.5">Total Amount</p>
                                    <p className="text-lg text-white font-bold font-mono">{formatCurrency(invoice.amount, invoice.currency || "EUR")}</p>
                                </div>
                            )}
                            <Field label="Currency" value={invoice.currency || "EUR"} fieldKey="currency" />
                            {isEditing ? (
                                <Field label="Paid Amount" fieldKey="paidAmount" type="number" />
                            ) : (
                                <Field label="Paid Amount" value={invoice.paidAmount ? formatCurrency(invoice.paidAmount, invoice.paidCurrency || invoice.currency || "EUR") : "-"} highlight={invoice.paidAmount ? "text-emerald-400 font-medium" : "text-white"} />
                            )}
                            <Field label="Paid Currency" value={invoice.paidCurrency || "-"} fieldKey="paidCurrency" />
                            <Field label="EUR Exchange" value={isEditing ? undefined : (invoice.eurExchange ? String(invoice.eurExchange) : "-")} fieldKey="eurExchange" type="number" mono />
                        </div>
                    </div>

                    {/* ═══ Section: Provider & Account ═══ */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5" /> Provider & Financial Account
                        </h4>
                        <div className="grid grid-cols-4 gap-4 bg-[#252627] rounded-lg p-4">
                            <div>
                                {isEditing ? (
                                    <Field label="Provider Code" fieldKey="providerCode" />
                                ) : (
                                    <>
                                        <p className="text-xs text-gray-500 mb-0.5">Provider</p>
                                        <p className="text-sm text-white font-medium">{invoice.providerName || invoice.customer}</p>
                                        {invoice.customer && invoice.providerName && invoice.customer !== invoice.providerName && (
                                            <p className="text-xs text-gray-600 font-mono">{invoice.customer}</p>
                                        )}
                                    </>
                                )}
                            </div>
                            <div>
                                {isEditing ? (
                                    <>
                                        <Field label="FA Code" fieldKey="financialAccountCode" />
                                        <div className="mt-1">
                                            <Field label="FA Name" fieldKey="financialAccountName" />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-xs text-gray-500 mb-0.5">Financial Account</p>
                                        <p className="text-sm text-white">{invoice.financialAccountName || "-"}</p>
                                        {invoice.faCode && <p className="text-xs text-gray-600 font-mono">{invoice.faCode}</p>}
                                    </>
                                )}
                            </div>
                            <Field label="Course" value={isEditing ? undefined : (invoice.courseName || invoice.courseCode || "-")} fieldKey="courseCode" />
                            <Field label="Bank Account" value={isEditing ? undefined : (invoice.bankAccountName || invoice.bankAccountCode || "-")} fieldKey="bankAccountCode" />
                        </div>
                    </div>

                    {/* ═══ Section: Classification ═══ */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Layers className="h-3.5 w-3.5" /> Classification
                        </h4>
                        <div className="grid grid-cols-4 gap-4 bg-[#252627] rounded-lg p-4">
                            <Field label="Department" value={isEditing ? undefined : (invoice.costCenterName || invoice.costCenterCode || "-")} fieldKey="costCenterCode" />
                            <Field label="Sub-Department" value={isEditing ? undefined : (invoice.subDepartmentName || invoice.subDepartmentCode || "-")} />
                            <Field label="Cost Type" value={isEditing ? undefined : (invoice.costTypeName || invoice.costTypeCode || "-")} fieldKey="costTypeCode" />
                            <Field label="Dep Cost Type" value={isEditing ? undefined : (invoice.depCostTypeName || invoice.depCostTypeCode || "-")} fieldKey="depCostTypeCode" />
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                            <ToggleField label="DRE Impact" fieldKey="dreImpact" value={invoice.dreImpact} />
                            <ToggleField label="Cash Impact" fieldKey="cashImpact" value={invoice.cashImpact} />
                            <ToggleField label="Intercompany" fieldKey="isIntercompany" value={invoice.isIntercompany} />
                        </div>
                    </div>

                    {/* ═══ Section: Payment & Reconciliation ═══ */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <CreditCard className="h-3.5 w-3.5" /> Payment & Reconciliation
                        </h4>
                        <div className="bg-[#252627] rounded-lg p-4 space-y-4">
                            <div className="grid grid-cols-4 gap-4">
                                <div>
                                    {isEditing ? (
                                        <Field label="Payment Method" fieldKey="paymentMethodCode" />
                                    ) : (
                                        <>
                                            <p className="text-xs text-gray-500 mb-0.5">Payment Method</p>
                                            <p className="text-sm text-white">{invoice.paymentMethodName || invoice.paymentMethodCode || "-"}</p>
                                        </>
                                    )}
                                </div>
                                <Field label="Payment Status" value={isEditing ? undefined : paymentStatusLabel.replace(/_/g, " ")} fieldKey="paymentStatus" />
                                <div>
                                    <p className="text-xs text-gray-500 mb-0.5">Invoice Status</p>
                                    <p className="text-sm text-white">{invoice.invoiceStatus?.replace(/_/g, " ") || "-"}</p>
                                </div>
                                <div>
                                    {!isEditing && (
                                        <>
                                            <p className="text-xs text-gray-500 mb-0.5">Bank Account</p>
                                            <p className="text-sm text-white font-medium">{invoice.bankAccountName || invoice.bankAccountCode || "-"}</p>
                                            {invoice.bankAccountCode && invoice.bankAccountName && <p className="text-xs text-gray-600 font-mono">{invoice.bankAccountCode}</p>}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Reconciliation Summary */}
                            {!isEditing && (
                                <div className="border-t border-gray-700 pt-3">
                                    <div className="flex items-center gap-3">
                                        {isPaid ? (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400"></div>
                                                <span className="text-sm text-emerald-300 font-medium">
                                                    Paid {invoice.bankAccountName ? `via ${invoice.bankAccountName}` : ""} {invoice.paymentDate ? `on ${fmt(invoice.paymentDate)}` : ""}
                                                </span>
                                                {invoice.paidAmount ? (
                                                    <span className="text-sm text-emerald-400 font-mono font-bold ml-2">
                                                        {formatCurrency(invoice.paidAmount, invoice.paidCurrency || invoice.currency || "EUR")}
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : isScheduled ? (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                                <div className="h-2.5 w-2.5 rounded-full bg-blue-400"></div>
                                                <span className="text-sm text-blue-300 font-medium">
                                                    Scheduled for {fmt(invoice.scheduleDate)} {invoice.bankAccountName ? `via ${invoice.bankAccountName}` : ""}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg">
                                                <div className="h-2.5 w-2.5 rounded-full bg-gray-500"></div>
                                                <span className="text-sm text-gray-400">No payment scheduled</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ═══ Section: Description & Notes ═══ */}
                    {(invoice.description || invoice.notes || isEditing) && (
                        <div>
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Description & Notes</h4>
                            <div className="bg-[#2a2b2d] rounded-lg p-4 space-y-3">
                                {isEditing ? (
                                    <>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Description</p>
                                            <textarea
                                                value={String(editFields.description || "")}
                                                onChange={(e) => updateField("description", e.target.value)}
                                                rows={2}
                                                className="w-full text-sm bg-[#1e1f21] border border-gray-600 text-white rounded-md p-2 focus:border-blue-500 focus:outline-none resize-none"
                                            />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Internal Notes</p>
                                            <textarea
                                                value={String(editFields.notes || "")}
                                                onChange={(e) => updateField("notes", e.target.value)}
                                                rows={2}
                                                className="w-full text-sm bg-[#1e1f21] border border-gray-600 text-white rounded-md p-2 focus:border-blue-500 focus:outline-none resize-none"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {invoice.description && (
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">Description</p>
                                                <p className="text-sm text-gray-300">{invoice.description}</p>
                                            </div>
                                        )}
                                        {invoice.notes && (
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">Internal Notes</p>
                                                <p className="text-sm text-gray-300">{invoice.notes}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ═══ Section: Attachments ═══ */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Paperclip className="h-3.5 w-3.5" /> Attachments & Documents
                        </h4>
                        <div className="bg-[#252627] rounded-lg p-4">
                            {loadingAttachments ? (
                                <div className="flex items-center gap-2 py-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                                    <span className="text-xs text-gray-500">Loading attachments...</span>
                                </div>
                            ) : attachments.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {attachments.map((att) => (
                                        <a
                                            key={att.id}
                                            href={att.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-3 py-2.5 bg-[#1e1f21] rounded-lg hover:bg-gray-700 transition-colors group"
                                        >
                                            <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />
                                            <span className="text-sm text-blue-300 group-hover:text-blue-200 truncate flex-1">{att.file_name}</span>
                                            <ExternalLink className="h-3 w-3 text-gray-500 group-hover:text-blue-400 flex-shrink-0" />
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-500 py-1">No attachments found</p>
                            )}
                        </div>
                    </div>

                    {/* ═══ Section: Invoice History ═══ */}
                    {showHistory && (
                        <div>
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <History className="h-3.5 w-3.5" /> {invoice.source === "invoices" ? "Provider" : "Customer"} Invoice History — {invoice.providerName || invoice.customer}
                                <span className="text-gray-600 font-normal normal-case">({providerHistory.length} invoices)</span>
                            </h4>
                            <div className="bg-[#252627] rounded-lg overflow-hidden">
                                {loadingHistory ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                                        <span className="ml-2 text-sm text-gray-500">Loading history...</span>
                                    </div>
                                ) : providerHistory.length === 0 ? (
                                    <p className="text-xs text-gray-500 p-4">No invoices found for this {invoice.source === "invoices" ? "provider" : "customer"}.</p>
                                ) : (
                                    <>
                                        {/* Summary bar + FA filter */}
                                        <div className="flex items-center justify-between px-4 py-3 bg-[#2a2b2d] border-b border-gray-700">
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs text-gray-400">
                                                    Total: <span className="text-white font-medium">
                                                        {historyFAFilter === "all" ? providerHistory.length : providerHistory.filter(i => i.faCode === historyFAFilter).length}
                                                    </span> invoices
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {invoice.source === "invoices" ? "Total spend" : "Total revenue"}: <span className={`${invoice.source === "invoices" ? "text-red-400" : "text-emerald-400"} font-mono font-medium`}>
                                                        {formatCurrency(
                                                            (historyFAFilter === "all" ? providerHistory : providerHistory.filter(i => i.faCode === historyFAFilter))
                                                                .reduce((s, i) => s + (i.amount || 0), 0),
                                                            "EUR"
                                                        )}
                                                    </span>
                                                </span>
                                            </div>
                                            {/* FA Filter */}
                                            {uniqueFACodes.length > 1 && (
                                                <div className="flex items-center gap-2">
                                                    <Filter className="h-3.5 w-3.5 text-gray-500" />
                                                    <Select value={historyFAFilter} onValueChange={setHistoryFAFilter}>
                                                        <SelectTrigger className="h-7 w-[220px] text-xs bg-[#1e1f21] border-gray-600 text-white">
                                                            <SelectValue placeholder="All Financial Accounts" />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-[#252627] border-gray-600">
                                                            <SelectItem value="all" className="text-xs text-gray-300">All Financial Accounts</SelectItem>
                                                            {uniqueFACodes.map(fa => (
                                                                <SelectItem key={fa} value={fa} className="text-xs text-gray-300">
                                                                    {fa} ({providerHistory.filter(i => i.faCode === fa).length})
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>
                                        {/* History table */}
                                        <div className="max-h-[300px] overflow-y-auto">
                                            <table className="w-full">
                                                <thead className="bg-[#1e1f21] sticky top-0 z-10">
                                                    <tr>
                                                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase px-3 py-2"></th>
                                                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase px-3 py-2">Date</th>
                                                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase px-3 py-2">Nº</th>
                                                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase px-3 py-2">Description</th>
                                                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase px-3 py-2">FA</th>
                                                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase px-3 py-2">Status</th>
                                                        <th className="text-right text-[10px] font-semibold text-gray-500 uppercase px-3 py-2">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(historyFAFilter === "all" ? providerHistory : providerHistory.filter(i => i.faCode === historyFAFilter)).map((hi, idx) => {
                                                        const isCurrentInvoice = hi.id === invoice.id;
                                                        const hiPaid = !!hi.paymentDate || (hi.paidAmount && hi.paidAmount !== 0);
                                                        return (
                                                            <tr
                                                                key={hi.id}
                                                                className={`border-b border-gray-800 hover:bg-gray-700/30 transition-colors ${isCurrentInvoice ? "bg-blue-500/10 border-l-2 border-l-blue-500" : idx % 2 === 0 ? "bg-[#252627]" : "bg-[#2a2b2d]"}`}
                                                            >
                                                                <td className="px-3 py-2">
                                                                    {!isCurrentInvoice && (
                                                                        <button
                                                                            onClick={() => setHistoryViewInvoice(hi)}
                                                                            className="text-gray-500 hover:text-blue-400 transition-colors"
                                                                            title="View invoice details"
                                                                        >
                                                                            <Eye className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    )}
                                                                    {isCurrentInvoice && (
                                                                        <span className="text-blue-400 text-[10px] font-medium">CURRENT</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2 text-xs text-gray-300 font-mono">{fmt(hi.benefitDate || hi.invoiceDate)}</td>
                                                                <td className="px-3 py-2 text-xs text-gray-400 font-mono">{hi.invoiceNumber || "-"}</td>
                                                                <td className="px-3 py-2 text-xs text-gray-400 truncate max-w-[200px]" title={hi.description}>{hi.description || "-"}</td>
                                                                <td className="px-3 py-2 text-xs text-gray-500 font-mono">{hi.faCode || "-"}</td>
                                                                <td className="px-3 py-2">
                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${hiPaid
                                                                        ? "bg-emerald-500/20 text-emerald-300"
                                                                        : hi.scheduleDate
                                                                            ? "bg-blue-500/20 text-blue-300"
                                                                            : "bg-gray-600/30 text-gray-500"
                                                                        }`}>
                                                                        {hiPaid ? "PAID" : hi.scheduleDate ? "SCHED" : "OPEN"}
                                                                    </span>
                                                                </td>
                                                                <td className={`px-3 py-2 text-right text-xs font-mono ${invoice.source === "invoices" ? "text-red-400" : "text-emerald-400"}`}>{formatCurrency(hi.amount, hi.currency || "EUR")}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Drill-Down Modal component with pagination and credit note highlighting
interface DrilldownModalProps {
    drilldown: DrilldownState;
    selectedYear: number;
    onClose: () => void;
}

function DrilldownModal({ drilldown, selectedYear, onClose }: DrilldownModalProps) {
    const [selectedInvoice, setSelectedInvoice] = useState<DrilldownTransaction | null>(null);
    const {
        currentPage,
        totalPages,
        paginatedData,
        pageInfo,
        goToPage,
        nextPage,
        prevPage,
        firstPage,
        lastPage,
        canGoNext,
        canGoPrev,
    } = usePagination(drilldown.transactions, { pageSize: 150 });

    // Calculate separate totals
    const creditNoteCount = drilldown.transactions.filter(tx => tx.amount < 0).length;
    const creditNoteTotal = drilldown.transactions.filter(tx => tx.amount < 0).reduce((s, tx) => s + tx.amount, 0);
    const isExpense = !drilldown.faCode.startsWith("1");

    return (
        <>
            <Dialog open={drilldown.isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent
                    className="max-w-none max-h-[90vh] bg-gray-900 border-gray-700 flex flex-col"
                    style={{ width: '80vw' }}
                >
                    <DialogHeader className="border-b border-gray-700 pb-4 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-xl text-white flex items-center gap-2">
                                    <BarChart3 className={`h-5 w-5 ${isExpense ? "text-red-400" : "text-emerald-400"}`} />
                                    Drill-Down: {drilldown.faName}
                                </DialogTitle>
                                <div className="flex items-center gap-3 mt-1">
                                    <p className="text-sm text-gray-400">
                                        <span className={`font-mono ${isExpense ? "text-red-400" : "text-emerald-400"}`}>{drilldown.faCode}</span>
                                        {" • "}
                                        <span>{MONTHS_FULL[drilldown.month]} {selectedYear}</span>
                                        {" • "}
                                        <span className={isExpense ? "text-red-300" : "text-emerald-300"}>{drilldown.count} transactions</span>
                                    </p>
                                    {creditNoteCount > 0 && (
                                        <Badge className="text-xs bg-red-500/20 text-red-300 border-red-500/30">
                                            <AlertCircle className="h-3 w-3 mr-1" />
                                            {creditNoteCount} Credit Notes ({formatCurrency(creditNoteTotal, "EUR")})
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto mt-4">
                        {drilldown.loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className={`h-8 w-8 animate-spin ${isExpense ? "text-red-400" : "text-emerald-400"}`} />
                                <span className="ml-3 text-gray-400">Loading transactions...</span>
                            </div>
                        ) : drilldown.transactions.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                No transactions found for this period.
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="overflow-x-auto flex-1">
                                    <table className="w-full min-w-[800px]">
                                        <thead className="bg-gray-800 sticky top-0 z-10">
                                            <tr>
                                                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3 whitespace-nowrap">Date</th>
                                                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3 whitespace-nowrap">{isExpense ? "Provider" : "Customer"}</th>
                                                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3 whitespace-nowrap">Description</th>
                                                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3 whitespace-nowrap">Type</th>
                                                <th className="text-right text-xs font-semibold text-gray-400 uppercase px-4 py-3 whitespace-nowrap">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedData.map((tx, idx) => {
                                                const isCreditNote = tx.amount < 0;
                                                return (
                                                    <tr
                                                        key={tx.id}
                                                        className={`border-b border-gray-800 hover:bg-gray-800/50 ${idx % 2 === 0 ? "bg-gray-900/50" : ""} ${isCreditNote ? "bg-red-950/30" : ""}`}
                                                    >
                                                        <td className="px-4 py-2 text-sm text-gray-300 font-mono whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => setSelectedInvoice(tx)}
                                                                    className="text-gray-500 hover:text-blue-400 transition-colors flex-shrink-0"
                                                                    title="View invoice details"
                                                                >
                                                                    <Eye className="h-3.5 w-3.5" />
                                                                </button>
                                                                {tx.date ? `${tx.date.substring(8, 10)}/${tx.date.substring(5, 7)}/${tx.date.substring(0, 4)}` : "-"}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2 text-sm text-white" title={tx.customer}>
                                                            {tx.customer}
                                                        </td>
                                                        <td className="px-4 py-2 text-sm text-gray-400" title={tx.description}>
                                                            {tx.description}
                                                        </td>
                                                        <td className="px-4 py-2 whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
                                                                    {tx.orderType}
                                                                </Badge>
                                                                {isCreditNote && (
                                                                    <Badge className="text-[10px] bg-red-500/20 text-red-400 border-red-500/30">
                                                                        Credit Note
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className={`px-4 py-2 text-right text-sm font-mono font-semibold whitespace-nowrap ${(isExpense || isCreditNote) ? "text-red-400" : "text-emerald-400"}`}>
                                                            {formatCurrency(tx.amount, "EUR")}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-gray-800">
                                            <tr>
                                                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-white">
                                                    Total ({drilldown.count} transactions)
                                                </td>
                                                <td className={`px-4 py-3 text-right text-lg font-mono ${isExpense ? "text-red-300" : "text-emerald-300"} font-bold whitespace-nowrap`}>
                                                    {formatCurrency(drilldown.total, "EUR")}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <PaginationControls
                                        currentPage={currentPage}
                                        totalPages={totalPages}
                                        pageInfo={pageInfo}
                                        onFirstPage={firstPage}
                                        onPrevPage={prevPage}
                                        onNextPage={nextPage}
                                        onLastPage={lastPage}
                                        canGoNext={canGoNext}
                                        canGoPrev={canGoPrev}
                                    />
                                )}

                                {/* Clinic Variations - only for clinic FA codes */}
                                {isClinicsFACode(drilldown.faCode) && (
                                    <>
                                        <Separator className="my-6 bg-gray-700" />

                                        {/* Monthly Changes */}
                                        <div className="px-4">
                                            <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-emerald-400" />
                                                Contract Changes - {MONTHS_FULL[drilldown.month]} {selectedYear}
                                            </h3>
                                            <ClinicVariationsTable
                                                mode="monthly"
                                                yearMonth={`${selectedYear}-${String(drilldown.month + 1).padStart(2, "0")}`}
                                                faCode={drilldown.faCode}
                                                title={`Monthly Changes (${MONTHS_FULL[drilldown.month]})`}
                                                maxItems={30}
                                            />
                                        </div>

                                        <Separator className="my-6 bg-gray-700" />

                                        {/* YTD Changes */}
                                        <div className="px-4 pb-4">
                                            <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-blue-400" />
                                                YTD Changes - January to {MONTHS_FULL[drilldown.month]} {selectedYear}
                                            </h3>
                                            <ClinicVariationsTable
                                                mode="ytd"
                                                yearMonth={`${selectedYear}-${String(drilldown.month + 1).padStart(2, "0")}`}
                                                faCode={drilldown.faCode}
                                                title={`Year-to-Date Changes (Jan - ${MONTHS[drilldown.month]})`}
                                                maxItems={50}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Invoice Detail Popup */}
            {selectedInvoice && (
                <InvoiceDetailPopup
                    invoice={selectedInvoice}
                    onClose={() => setSelectedInvoice(null)}
                />
            )}
        </>
    );
}

export default function PnLReport() {
    const { selectedScope } = useGlobalScope();
    const [loading, setLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(["101.0", "102.0", "103.0", "104.0", "105.0", "201.0", "202.0"])
    );
    // Use current year dynamically (2026 in Feb 2026)
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
    const [viewMode, setViewMode] = useState<"monthly" | "quarterly" | "annual">("monthly");

    // Drill-down state
    const [drilldown, setDrilldown] = useState<DrilldownState>({
        isOpen: false,
        loading: false,
        faCode: "",
        faName: "",
        month: 0,
        transactions: [],
        total: 0,
        count: 0,
    });

    // Correct logic: last closed month
    // - For past years: all 12 months closed (index 11 = December)
    // - For current year: previous month (-1 if in January = none closed)
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonthIndex = currentDate.getMonth(); // 0-11 (Feb=1)
    // lastClosedMonth = index of last CLOSED month (inclusive), or -1 if none
    const lastClosedMonth = selectedYear < currentYear ? 11 : currentMonthIndex - 1;

    // State for real revenue data
    const [totalRevenue, setTotalRevenue] = useState<MonthlyData>(emptyMonthlyData());
    const [byFinancialAccount, setByFinancialAccount] = useState<{ [key: string]: MonthlyData }>({});

    // State for real expense data (Accounts Payable)
    const [byExpenseAccount, setByExpenseAccount] = useState<{ [key: string]: MonthlyData }>({});
    const [byExpenseBudget, setByExpenseBudget] = useState<{ [key: string]: MonthlyData }>({});

    // Fetch real data via API (revenue + expenses in parallel)
    useEffect(() => {
        async function fetchPnLData() {
            try {
                setLoading(true);

                const [revenueRes, expensesRes] = await Promise.all([
                    fetch(`/api/pnl/revenue?year=${selectedYear}`),
                    fetch(`/api/pnl/expenses?year=${selectedYear}`),
                ]);

                const revenueResult = await revenueRes.json();
                const expensesResult = await expensesRes.json();

                if (revenueRes.ok && revenueResult.success) {
                    setTotalRevenue(revenueResult.totalRevenue || emptyMonthlyData());
                    setByFinancialAccount(revenueResult.byFinancialAccount || {});
                    console.log('📊 Revenue loaded:', revenueResult.totalRecords, 'records');
                } else {
                    console.error('Error fetching revenue:', revenueResult.error);
                }

                if (expensesRes.ok && expensesResult.success) {
                    setByExpenseAccount(expensesResult.byExpenseAccount || {});
                    setByExpenseBudget(expensesResult.byExpenseBudget || {});
                    console.log('📊 Expenses loaded:', expensesResult.actualCount, 'actual,', expensesResult.budgetCount, 'budget');
                } else {
                    console.error('Error fetching expenses:', expensesResult.error);
                }

            } catch (err) {
                console.error('Error loading P&L:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchPnLData();
    }, [selectedYear]);

    // Function to open drill-down
    const openDrilldown = useCallback(async (faCode: string, faName: string, monthIndex: number) => {

        setDrilldown(prev => ({
            ...prev,
            isOpen: true,
            loading: true,
            faCode,
            faName,
            month: monthIndex,
            transactions: [],
            total: 0,
            count: 0,
        }));

        try {
            const response = await fetch(
                `/api/pnl/drilldown?fa=${faCode}&month=${monthIndex}&year=${selectedYear}`
            );
            const result = await response.json();

            if (result.success) {
                setDrilldown(prev => ({
                    ...prev,
                    loading: false,
                    transactions: result.transactions || [],
                    total: result.transactions?.reduce((s: number, t: DrilldownTransaction) => s + t.amount, 0) || 0,
                    count: result.pagination?.total || result.transactions?.length || 0,
                }));
            } else {
                console.error('Drill-down error:', result.error);
                setDrilldown(prev => ({ ...prev, loading: false }));
            }
        } catch (err) {
            console.error('Error fetching drill-down:', err);
            setDrilldown(prev => ({ ...prev, loading: false }));
        }
    }, [selectedYear]);

    const closeDrilldown = useCallback(() => {
        setDrilldown(prev => ({ ...prev, isOpen: false }));
    }, []);

    // Helper: get financial account data or zeros
    const getFA = (code: string): MonthlyData => byFinancialAccount[code] || emptyMonthlyData();

    // Helper: sum multiple financial accounts (revenue)
    const sumFA = (...codes: string[]): MonthlyData => {
        const result = emptyMonthlyData();
        const keys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
        for (const key of keys) {
            result[key] = codes.reduce((sum, code) => sum + (getFA(code)[key] || 0), 0);
        }
        return result;
    };

    // Helper: get expense (actual) data for financial account
    const getExpFA = (code: string): MonthlyData => byExpenseAccount[code] || emptyMonthlyData();

    // Helper: get expense budget data
    const getExpBudgetFA = (code: string): MonthlyData => byExpenseBudget[code] || emptyMonthlyData();

    // Helper: sum multiple expense financial accounts (actual)
    const sumExpFA = (...codes: string[]): MonthlyData => {
        const result = emptyMonthlyData();
        const keys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
        for (const key of keys) {
            result[key] = codes.reduce((sum, code) => sum + (getExpFA(code)[key] || 0), 0);
        }
        return result;
    };

    // Helper: sum multiple expense budget financial accounts
    const sumExpBudgetFA = (...codes: string[]): MonthlyData => {
        const result = emptyMonthlyData();
        const keys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
        for (const key of keys) {
            result[key] = codes.reduce((sum, code) => sum + (getExpBudgetFA(code)[key] || 0), 0);
        }
        return result;
    };

    // Revenue structure - based on Excel (without Allocations)
    const revenueStructure: DRELineMonthly[] = useMemo(() => [
        {
            code: "101.0", name: "Growth", type: "revenue", level: 0,
            monthly: sumFA("101.1", "101.2", "101.3", "101.4", "101.5"),
            budget: generateBudgetData(1761191),
            children: [
                { code: "101.1", name: "DSD Courses", type: "revenue", level: 1, monthly: getFA("101.1"), budget: generateBudgetData(1127617) },
                { code: "101.2", name: "Others Courses", type: "revenue", level: 1, monthly: getFA("101.2"), budget: generateBudgetData(0) },
                { code: "101.3", name: "Mastership", type: "revenue", level: 1, monthly: getFA("101.3"), budget: generateBudgetData(-1705) },
                { code: "101.4", name: "PC Membership", type: "revenue", level: 1, monthly: getFA("101.4"), budget: generateBudgetData(600227) },
                { code: "101.5", name: "Partnerships", type: "revenue", level: 1, monthly: getFA("101.5"), budget: generateBudgetData(35052) },
            ],
        },
        {
            code: "102.0", name: "Delight", type: "revenue", level: 0,
            monthly: sumFA("102.1", "102.2", "102.3", "102.4", "102.5", "102.6", "102.7"),
            budget: generateBudgetData(4442301),
            children: [
                { code: "102.1", name: "Contracted ROW", type: "revenue", level: 1, monthly: getFA("102.1"), budget: generateBudgetData(1430372) },
                { code: "102.2", name: "Contracted AMEX", type: "revenue", level: 1, monthly: getFA("102.2"), budget: generateBudgetData(2410940) },
                { code: "102.3", name: "Level 3 New ROW", type: "revenue", level: 1, monthly: getFA("102.3"), budget: generateBudgetData(43500) },
                { code: "102.4", name: "Level 3 New AMEX", type: "revenue", level: 1, monthly: getFA("102.4"), budget: generateBudgetData(257726) },
                { code: "102.5", name: "Consultancies", type: "revenue", level: 1, monthly: getFA("102.5"), budget: generateBudgetData(82190) },
                { code: "102.6", name: "Marketing Coaching", type: "revenue", level: 1, monthly: getFA("102.6"), budget: generateBudgetData(57622) },
                { code: "102.7", name: "Others", type: "revenue", level: 1, monthly: getFA("102.7"), budget: generateBudgetData(159952) },
            ],
        },
        {
            code: "103.0", name: "Planning Center", type: "revenue", level: 0,
            monthly: sumFA("103.1", "103.2", "103.3", "103.4", "103.5", "103.6", "103.7"),
            budget: generateBudgetData(1166274),
            children: [
                { code: "103.1", name: "Level 3 ROW", type: "revenue", level: 1, monthly: getFA("103.1"), budget: generateBudgetData(274582) },
                { code: "103.2", name: "Level 3 AMEX", type: "revenue", level: 1, monthly: getFA("103.2"), budget: generateBudgetData(298654) },
                { code: "103.3", name: "Level 3 New ROW", type: "revenue", level: 1, monthly: getFA("103.3"), budget: generateBudgetData(7520) },
                { code: "103.4", name: "Level 3 New AMEX", type: "revenue", level: 1, monthly: getFA("103.4"), budget: generateBudgetData(47072) },
                { code: "103.5", name: "Level 2", type: "revenue", level: 1, monthly: getFA("103.5"), budget: generateBudgetData(325171) },
                { code: "103.6", name: "Level 1", type: "revenue", level: 1, monthly: getFA("103.6"), budget: generateBudgetData(1090) },
                { code: "103.7", name: "Not a Subscriber", type: "revenue", level: 1, monthly: getFA("103.7"), budget: generateBudgetData(212185) },
            ],
        },
        {
            code: "104.0", name: "LAB", type: "revenue", level: 0,
            monthly: sumFA("104.1", "104.2", "104.3", "104.4", "104.5", "104.6", "104.7"),
            budget: generateBudgetData(1136386),
            children: [
                { code: "104.1", name: "Level 3 ROW", type: "revenue", level: 1, monthly: getFA("104.1"), budget: generateBudgetData(299426) },
                { code: "104.2", name: "Level 3 AMEX", type: "revenue", level: 1, monthly: getFA("104.2"), budget: generateBudgetData(452960) },
                { code: "104.3", name: "Level 3 New ROW", type: "revenue", level: 1, monthly: getFA("104.3"), budget: generateBudgetData(16470) },
                { code: "104.4", name: "Level 3 New AMEX", type: "revenue", level: 1, monthly: getFA("104.4"), budget: generateBudgetData(43359) },
                { code: "104.5", name: "Level 2", type: "revenue", level: 1, monthly: getFA("104.5"), budget: generateBudgetData(162167) },
                { code: "104.6", name: "Level 1", type: "revenue", level: 1, monthly: getFA("104.6"), budget: generateBudgetData(4733) },
                { code: "104.7", name: "Not a Subscriber", type: "revenue", level: 1, monthly: getFA("104.7"), budget: generateBudgetData(157272) },
            ],
        },
        {
            code: "105.0", name: "Other Income", type: "revenue", level: 0,
            monthly: sumFA("105.1", "105.2", "105.3", "105.4"),
            budget: generateBudgetData(42426),
            children: [
                { code: "105.1", name: "Level 1", type: "revenue", level: 1, monthly: getFA("105.1"), budget: generateBudgetData(42426) },
                { code: "105.2", name: "CORE Partnerships", type: "revenue", level: 1, monthly: getFA("105.2"), budget: generateBudgetData(0) },
                { code: "105.3", name: "Study Club", type: "revenue", level: 1, monthly: getFA("105.3"), budget: generateBudgetData(0) },
                { code: "105.4", name: "Other Marketing Revenues", type: "revenue", level: 1, monthly: getFA("105.4"), budget: generateBudgetData(0) },
            ],
        },
    ], [byFinancialAccount]);

    // Expense structure with REAL data from AP invoices
    const expenseStructure: DRELineMonthly[] = useMemo(() => [
        {
            code: "201.0", name: "Cost of Goods Sold (COGS)", type: "expense", level: 0,
            monthly: sumExpFA("201.1", "201.2", "201.3", "201.4", "201.5"),
            budget: sumExpBudgetFA("201.1", "201.2", "201.3", "201.4", "201.5"),
            children: [
                { code: "201.1", name: "COGS Growth", type: "expense", level: 1, monthly: getExpFA("201.1"), budget: getExpBudgetFA("201.1") },
                { code: "201.2", name: "COGS Delight", type: "expense", level: 1, monthly: getExpFA("201.2"), budget: getExpBudgetFA("201.2") },
                { code: "201.3", name: "COGS Planning Center", type: "expense", level: 1, monthly: getExpFA("201.3"), budget: getExpBudgetFA("201.3") },
                { code: "201.4", name: "COGS LAB", type: "expense", level: 1, monthly: getExpFA("201.4"), budget: getExpBudgetFA("201.4") },
                { code: "201.5", name: "COGS Other Income", type: "expense", level: 1, monthly: getExpFA("201.5"), budget: getExpBudgetFA("201.5") },
            ],
        },
        {
            code: "202.0", name: "Labour", type: "expense", level: 0,
            monthly: sumExpFA("202.1", "202.2", "202.3", "202.4", "202.5", "202.6", "202.7"),
            budget: sumExpBudgetFA("202.1", "202.2", "202.3", "202.4", "202.5", "202.6", "202.7"),
            children: [
                { code: "202.1", name: "Labour Growth", type: "expense", level: 1, monthly: getExpFA("202.1"), budget: getExpBudgetFA("202.1") },
                { code: "202.2", name: "Labour Marketing", type: "expense", level: 1, monthly: getExpFA("202.2"), budget: getExpBudgetFA("202.2") },
                { code: "202.3", name: "Labour Planning Center", type: "expense", level: 1, monthly: getExpFA("202.3"), budget: getExpBudgetFA("202.3") },
                { code: "202.4", name: "Labour LAB", type: "expense", level: 1, monthly: getExpFA("202.4"), budget: getExpBudgetFA("202.4") },
                { code: "202.5", name: "Labour Corporate", type: "expense", level: 1, monthly: getExpFA("202.5"), budget: getExpBudgetFA("202.5") },
                { code: "202.6", name: "Labour Delight ROW", type: "expense", level: 1, monthly: getExpFA("202.6"), budget: getExpBudgetFA("202.6") },
                { code: "202.7", name: "Labour AMEX", type: "expense", level: 1, monthly: getExpFA("202.7"), budget: getExpBudgetFA("202.7") },
            ],
        },
        {
            code: "203.0", name: "Travels and Meals", type: "expense", level: 0,
            monthly: sumExpFA("203.1", "203.2", "203.3", "203.4", "203.5", "203.6", "203.7"),
            budget: sumExpBudgetFA("203.1", "203.2", "203.3", "203.4", "203.5", "203.6", "203.7"),
            children: [
                { code: "203.1", name: "T&M Growth", type: "expense", level: 1, monthly: getExpFA("203.1"), budget: getExpBudgetFA("203.1") },
                { code: "203.2", name: "T&M Marketing", type: "expense", level: 1, monthly: getExpFA("203.2"), budget: getExpBudgetFA("203.2") },
                { code: "203.3", name: "T&M Planning Center", type: "expense", level: 1, monthly: getExpFA("203.3"), budget: getExpBudgetFA("203.3") },
                { code: "203.4", name: "T&M LAB", type: "expense", level: 1, monthly: getExpFA("203.4"), budget: getExpBudgetFA("203.4") },
                { code: "203.5", name: "T&M Corporate", type: "expense", level: 1, monthly: getExpFA("203.5"), budget: getExpBudgetFA("203.5") },
                { code: "203.6", name: "T&M Delight ROW", type: "expense", level: 1, monthly: getExpFA("203.6"), budget: getExpBudgetFA("203.6") },
                { code: "203.7", name: "T&M AMEX", type: "expense", level: 1, monthly: getExpFA("203.7"), budget: getExpBudgetFA("203.7") },
            ],
        },
        {
            code: "204.0", name: "Professional Fees", type: "expense", level: 0,
            monthly: sumExpFA("204.1", "204.2"),
            budget: sumExpBudgetFA("204.1", "204.2"),
            children: [
                { code: "204.1", name: "Professional Fees - General", type: "expense", level: 1, monthly: getExpFA("204.1"), budget: getExpBudgetFA("204.1") },
                { code: "204.2", name: "Professional Fees - Consulting", type: "expense", level: 1, monthly: getExpFA("204.2"), budget: getExpBudgetFA("204.2") },
            ],
        },
        { code: "205.0", name: "Marketing and Advertising", type: "expense", level: 0, monthly: getExpFA("205.0"), budget: getExpBudgetFA("205.0"), children: [] },
        {
            code: "206.0", name: "Office", type: "expense", level: 0,
            monthly: sumExpFA("206.1", "206.1.1", "206.2"),
            budget: sumExpBudgetFA("206.1", "206.1.1", "206.2"),
            children: [
                { code: "206.1", name: "Office - Rent & Facilities", type: "expense", level: 1, monthly: getExpFA("206.1"), budget: getExpBudgetFA("206.1") },
                { code: "206.1.1", name: "Office - Supplies", type: "expense", level: 1, monthly: getExpFA("206.1.1"), budget: getExpBudgetFA("206.1.1") },
                { code: "206.2", name: "Office - Other", type: "expense", level: 1, monthly: getExpFA("206.2"), budget: getExpBudgetFA("206.2") },
            ],
        },
        { code: "207.0", name: "Information Technology", type: "expense", level: 0, monthly: getExpFA("207.0"), budget: getExpBudgetFA("207.0"), children: [] },
        { code: "208.0", name: "Research and Development", type: "expense", level: 0, monthly: getExpFA("208.0"), budget: getExpBudgetFA("208.0"), children: [] },
        {
            code: "209.0", name: "Bank and Financial Fees", type: "expense", level: 0,
            monthly: sumExpFA("209.1", "209.2"),
            budget: sumExpBudgetFA("209.1", "209.2"),
            children: [
                { code: "209.1", name: "Bank Fees", type: "expense", level: 1, monthly: getExpFA("209.1"), budget: getExpBudgetFA("209.1") },
                { code: "209.2", name: "Financial Fees", type: "expense", level: 1, monthly: getExpFA("209.2"), budget: getExpBudgetFA("209.2") },
            ],
        },
        { code: "210.0", name: "Balance Adjustments", type: "expense", level: 0, monthly: getExpFA("210.0"), budget: getExpBudgetFA("210.0"), children: [] },
        { code: "211.0", name: "Amortization & Depreciation", type: "expense", level: 0, monthly: getExpFA("211.0"), budget: getExpBudgetFA("211.0"), children: [] },
        { code: "300.0", name: "FX Variation", type: "expense", level: 0, monthly: getExpFA("300.0"), budget: getExpBudgetFA("300.0"), children: [] },
        { code: "400.0", name: "Taxes & Other", type: "expense", level: 0, monthly: getExpFA("400.0"), budget: getExpBudgetFA("400.0"), children: [] },
    ], [byExpenseAccount, byExpenseBudget]);

    // Calculate monthly totals
    const monthlyTotals = useMemo(() => {
        const calcMonthlySum = (items: DRELineMonthly[], monthIndex: number) =>
            items.reduce((sum, item) => sum + getMonthValue(item.monthly, monthIndex), 0);
        const calcBudgetSum = (items: DRELineMonthly[], monthIndex: number) =>
            items.reduce((sum, item) => sum + getMonthValue(item.budget, monthIndex), 0);

        const cogs = expenseStructure.find(e => e.code === "201.0");
        const opexItems = expenseStructure.filter(e => e.code !== "201.0" && e.code !== "211.0");
        const amortization = expenseStructure.find(e => e.code === "211.0");

        const months = MONTHS.map((_, i) => {
            const revenue = calcMonthlySum(revenueStructure, i);
            const revenueBudget = calcBudgetSum(revenueStructure, i);
            const cogsVal = cogs ? getMonthValue(cogs.monthly, i) : 0;
            const cogsBudget = cogs ? getMonthValue(cogs.budget, i) : 0;
            const grossProfit = revenue - cogsVal;
            const grossProfitBudget = revenueBudget - cogsBudget;
            const opex = opexItems.reduce((sum, item) => sum + getMonthValue(item.monthly, i), 0);
            const opexBudget = opexItems.reduce((sum, item) => sum + getMonthValue(item.budget, i), 0);
            const ebitda = grossProfit - opex;
            const ebitdaBudget = grossProfitBudget - opexBudget;
            const totalExpenses = calcMonthlySum(expenseStructure, i);
            const totalExpensesBudget = calcBudgetSum(expenseStructure, i);
            const netIncome = revenue - totalExpenses;
            const netIncomeBudget = revenueBudget - totalExpensesBudget;

            return {
                revenue, revenueBudget,
                cogs: cogsVal, cogsBudget,
                grossProfit, grossProfitBudget,
                opex, opexBudget,
                ebitda, ebitdaBudget,
                totalExpenses, totalExpensesBudget,
                netIncome, netIncomeBudget,
            };
        });

        // Calculate YTD (up to last closed month)
        const ytd = {
            revenue: months.slice(0, lastClosedMonth + 1).reduce((s, m) => s + m.revenue, 0),
            revenueBudget: months.slice(0, lastClosedMonth + 1).reduce((s, m) => s + m.revenueBudget, 0),
            grossProfit: months.slice(0, lastClosedMonth + 1).reduce((s, m) => s + m.grossProfit, 0),
            grossProfitBudget: months.slice(0, lastClosedMonth + 1).reduce((s, m) => s + m.grossProfitBudget, 0),
            ebitda: months.slice(0, lastClosedMonth + 1).reduce((s, m) => s + m.ebitda, 0),
            ebitdaBudget: months.slice(0, lastClosedMonth + 1).reduce((s, m) => s + m.ebitdaBudget, 0),
            totalExpenses: months.slice(0, lastClosedMonth + 1).reduce((s, m) => s + m.totalExpenses, 0),
            totalExpensesBudget: months.slice(0, lastClosedMonth + 1).reduce((s, m) => s + m.totalExpensesBudget, 0),
            netIncome: months.slice(0, lastClosedMonth + 1).reduce((s, m) => s + m.netIncome, 0),
            netIncomeBudget: months.slice(0, lastClosedMonth + 1).reduce((s, m) => s + m.netIncomeBudget, 0),
        };

        // Full year totals
        const annual = {
            revenue: months.reduce((s, m) => s + m.revenue, 0),
            revenueBudget: months.reduce((s, m) => s + m.revenueBudget, 0),
            grossProfit: months.reduce((s, m) => s + m.grossProfit, 0),
            grossProfitBudget: months.reduce((s, m) => s + m.grossProfitBudget, 0),
            ebitda: months.reduce((s, m) => s + m.ebitda, 0),
            ebitdaBudget: months.reduce((s, m) => s + m.ebitdaBudget, 0),
            totalExpenses: months.reduce((s, m) => s + m.totalExpenses, 0),
            totalExpensesBudget: months.reduce((s, m) => s + m.totalExpensesBudget, 0),
            netIncome: months.reduce((s, m) => s + m.netIncome, 0),
            netIncomeBudget: months.reduce((s, m) => s + m.netIncomeBudget, 0),
        };

        return { months, ytd, annual };
    }, [revenueStructure, expenseStructure, lastClosedMonth]);

    const toggleSection = (code: string) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(code)) {
            newExpanded.delete(code);
        } else {
            newExpanded.add(code);
        }
        setExpandedSections(newExpanded);
    };

    // Forced format: 1.000.000 (dot as thousands separator)
    const formatNumber = (value: number): string => {
        return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    // Compact format for table cells (no abbreviation)
    const formatCompact = (value: number): string => {
        return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    // Render monthly P&L row
    const renderMonthlyRow = (line: DRELineMonthly, isChild = false) => {
        const hasChildren = line.children && line.children.length > 0;
        const isExpanded = expandedSections.has(line.code);
        // Non-closed months: i > lastClosedMonth (months AFTER the last closed)
        const monthlyValues = MONTHS.map((_, i) => i > lastClosedMonth ? 0 : getMonthValue(line.monthly, i));
        // Total = sum up to last closed month (inclusive), or 0 if none closed
        const total = lastClosedMonth >= 0 ? getYTD(line.monthly, lastClosedMonth) : 0;
        const isClickable = true;

        return (
            <div key={line.code}>
                <div className={`grid grid-cols-[160px_repeat(12,minmax(55px,1fr))_70px] gap-1 py-1.5 px-2 border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${isChild ? "pl-6 bg-gray-900/30" : "bg-gray-900/60"}`}>
                    {/* Account name */}
                    <div className="flex items-center gap-1 min-w-0">
                        {hasChildren ? (
                            <button onClick={() => toggleSection(line.code)} className="p-0.5 hover:bg-gray-700 rounded shrink-0">
                                {isExpanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                            </button>
                        ) : (
                            <div className="w-3" />
                        )}
                        <span className="text-[9px] text-gray-500 font-mono shrink-0">{line.code}</span>
                        <span className={`text-[11px] truncate ${isChild ? "text-gray-400" : "font-medium text-white"}`} title={line.name}>{line.name}</span>
                    </div>

                    {/* Monthly values - CLICKABLE for drill-down */}
                    {monthlyValues.map((val, i) => {
                        const realVal = getMonthValue(line.monthly, i);
                        const isNotClosed = i > lastClosedMonth; // Month not closed if after last closed month
                        const canClick = isClickable && realVal !== 0 && !isNotClosed;
                        const hoverClass = line.type === "revenue"
                            ? "cursor-pointer hover:bg-emerald-900/30 rounded transition-colors"
                            : "cursor-pointer hover:bg-red-900/30 rounded transition-colors";
                        return (
                            <div
                                key={i}
                                className={`text-right ${isNotClosed ? "opacity-30" : ""} ${canClick ? hoverClass : ""}`}
                                onClick={canClick ? () => openDrilldown(line.code, line.name, i) : undefined}
                                title={canClick ? `Clique para ver detalhes de ${line.name} em ${MONTHS[i]}` : undefined}
                            >
                                <span className={`text-[10px] font-mono ${line.type === "revenue" ? "text-emerald-400" : "text-red-400"} ${canClick ? "underline decoration-dotted underline-offset-2" : ""}`}>
                                    {isNotClosed ? "-" : formatCompact(val)}
                                </span>
                            </div>
                        );
                    })}

                    {/* Total */}
                    <div className="text-right bg-gray-800/50 px-1 rounded">
                        <span className={`text-[10px] font-mono font-bold ${line.type === "revenue" ? "text-emerald-300" : "text-red-300"}`}>
                            {formatCompact(total)}
                        </span>
                    </div>
                </div>
                {hasChildren && isExpanded && line.children?.map((child) => renderMonthlyRow(child, true))}
            </div>
        );
    };

    // Subtotal row for monthly view
    const renderMonthlySubtotal = (label: string, monthlyData: typeof monthlyTotals.months, field: keyof typeof monthlyTotals.months[0], _ytd: number, total: number, isProfit = false) => {
        return (
            <div className={`grid grid-cols-[160px_repeat(12,minmax(55px,1fr))_70px] gap-1 py-2 px-2 ${isProfit ? "bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-y border-blue-500/30" : "bg-gray-800/60 border-y border-gray-700"}`}>
                <div className="flex items-center gap-2">
                    <div className="w-3" />
                    <span className={`font-semibold ${isProfit ? "text-blue-300" : "text-white"} text-xs`}>{label}</span>
                </div>
                {monthlyData.map((m, i) => {
                    const isNotClosed = i > lastClosedMonth; // Month not closed if after last closed month
                    return (
                        <div key={i} className={`text-right ${isNotClosed ? "opacity-30" : ""}`}>
                            <span className={`text-[10px] font-mono font-semibold ${isProfit ? "text-blue-300" : "text-gray-200"}`}>
                                {isNotClosed ? "-" : formatCompact(m[field] as number)}
                            </span>
                        </div>
                    );
                })}
                <div className="text-right bg-amber-900/30 px-1 rounded">
                    <span className={`text-[10px] font-mono font-bold ${isProfit ? "text-amber-200" : "text-gray-100"}`}>{formatCompact(total)}</span>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-16 bg-gray-800 rounded-lg"></div>
                    <div className="grid grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <div key={i} className="h-32 bg-gray-800 rounded-lg"></div>)}</div>
                    <div className="h-96 bg-gray-800 rounded-lg"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Premium Dark Header */}
            <header className="bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800 border-b border-gray-800 px-6 py-5 sticky top-0 z-20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-xl border border-emerald-500/30">
                            <BarChart3 className="h-7 w-7 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">
                                P&L Statement
                            </h1>
                            <p className="text-sm text-gray-400 mt-0.5">
                                Income Statement • {selectedYear} • {selectedScope === "GLOBAL" ? "All Regions" : selectedScope}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-gray-800/60 rounded-lg p-1 border border-gray-700">
                            {[2024, 2025, 2026].map((year) => (
                                <button
                                    key={year}
                                    onClick={() => setSelectedYear(year)}
                                    className={`px-3 py-1.5 text-sm rounded-md transition-all ${selectedYear === year ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800">
                            <RefreshCw className="h-4 w-4 mr-2" />Sync
                        </Button>
                        <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800">
                            <FileSpreadsheet className="h-4 w-4 mr-2" />Excel
                        </Button>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Download className="h-4 w-4 mr-2" />Export PDF
                        </Button>
                    </div>
                </div>
            </header>

            <div className="p-6 space-y-6">
                {/* Executive Summary KPIs */}
                <div className="grid grid-cols-6 gap-4">
                    {/* Revenue Card */}
                    <Card className="bg-gradient-to-br from-emerald-900/50 to-emerald-950/80 border-emerald-700/50 col-span-1">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Revenue YTD</span>
                                <TrendingUp className="h-4 w-4 text-emerald-400" />
                            </div>
                            <p className="text-2xl font-bold text-white mb-1">{formatCompact(monthlyTotals.ytd.revenue)}</p>
                            <div className="flex items-center gap-2">
                                <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                    {((monthlyTotals.ytd.revenue / monthlyTotals.ytd.revenueBudget - 1) * 100).toFixed(1)}% vs Budget
                                </Badge>
                            </div>
                            <div className="mt-3 pt-3 border-t border-emerald-800/50">
                                <div className="flex justify-between text-xs">
                                    <span className="text-emerald-400/70">Full Year</span>
                                    <span className="text-emerald-300 font-semibold">{formatCompact(monthlyTotals.annual.revenue)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Gross Profit Card */}
                    <Card className="bg-gradient-to-br from-blue-900/50 to-blue-950/80 border-blue-700/50 col-span-1">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Gross Profit</span>
                                <Layers className="h-4 w-4 text-blue-400" />
                            </div>
                            <p className="text-2xl font-bold text-white mb-1">{formatCompact(monthlyTotals.ytd.grossProfit)}</p>
                            <div className="flex items-center gap-2">
                                <Badge className="text-[10px] bg-blue-500/20 text-blue-300 border-blue-500/30">
                                    {((monthlyTotals.ytd.grossProfit / monthlyTotals.ytd.revenue) * 100).toFixed(1)}% Margin
                                </Badge>
                            </div>
                            <div className="mt-3 pt-3 border-t border-blue-800/50">
                                <div className="flex justify-between text-xs">
                                    <span className="text-blue-400/70">Full Year</span>
                                    <span className="text-blue-300 font-semibold">{formatCompact(monthlyTotals.annual.grossProfit)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* EBITDA Card */}
                    <Card className="bg-gradient-to-br from-purple-900/50 to-purple-950/80 border-purple-700/50 col-span-1">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">EBITDA</span>
                                <Building2 className="h-4 w-4 text-purple-400" />
                            </div>
                            <p className="text-2xl font-bold text-white mb-1">{formatCompact(monthlyTotals.ytd.ebitda)}</p>
                            <div className="flex items-center gap-2">
                                <Badge className="text-[10px] bg-purple-500/20 text-purple-300 border-purple-500/30">
                                    {((monthlyTotals.ytd.ebitda / monthlyTotals.ytd.revenue) * 100).toFixed(1)}% Margin
                                </Badge>
                            </div>
                            <div className="mt-3 pt-3 border-t border-purple-800/50">
                                <div className="flex justify-between text-xs">
                                    <span className="text-purple-400/70">Full Year</span>
                                    <span className="text-purple-300 font-semibold">{formatCompact(monthlyTotals.annual.ebitda)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Expenses Card */}
                    <Card className="bg-gradient-to-br from-red-900/50 to-red-950/80 border-red-700/50 col-span-1">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-red-300 uppercase tracking-wider">Expenses</span>
                                <TrendingDown className="h-4 w-4 text-red-400" />
                            </div>
                            <p className="text-2xl font-bold text-white mb-1">{formatCompact(monthlyTotals.ytd.totalExpenses)}</p>
                            <div className="flex items-center gap-2">
                                <Badge className="text-[10px] bg-red-500/20 text-red-300 border-red-500/30">
                                    {((1 - monthlyTotals.ytd.totalExpenses / monthlyTotals.ytd.totalExpensesBudget) * 100).toFixed(1)}% Under
                                </Badge>
                            </div>
                            <div className="mt-3 pt-3 border-t border-red-800/50">
                                <div className="flex justify-between text-xs">
                                    <span className="text-red-400/70">Full Year</span>
                                    <span className="text-red-300 font-semibold">{formatCompact(monthlyTotals.annual.totalExpenses)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Net Income Card */}
                    <Card className="bg-gradient-to-br from-amber-900/50 to-amber-950/80 border-amber-700/50 col-span-2">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Net Income YTD</span>
                                <DollarSign className="h-4 w-4 text-amber-400" />
                            </div>
                            <div className="flex items-baseline gap-4">
                                <p className="text-3xl font-bold text-white">{formatCurrency(monthlyTotals.ytd.netIncome, "EUR")}</p>
                                <Badge className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/30">
                                    {((monthlyTotals.ytd.netIncome / monthlyTotals.ytd.revenue) * 100).toFixed(1)}% Net Margin
                                </Badge>
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-4 pt-3 border-t border-amber-800/50">
                                <div>
                                    <span className="text-[10px] text-amber-400/70 uppercase">vs Budget</span>
                                    <p className={`text-sm font-semibold ${monthlyTotals.ytd.netIncome >= monthlyTotals.ytd.netIncomeBudget ? "text-emerald-400" : "text-red-400"}`}>
                                        {monthlyTotals.ytd.netIncome >= monthlyTotals.ytd.netIncomeBudget ? "+" : ""}{formatCompact(monthlyTotals.ytd.netIncome - monthlyTotals.ytd.netIncomeBudget)}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] text-amber-400/70 uppercase">Full Year Est.</span>
                                    <p className="text-sm font-semibold text-amber-300">{formatCompact(monthlyTotals.annual.netIncome)}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] text-amber-400/70 uppercase">Variance %</span>
                                    <p className={`text-sm font-semibold ${monthlyTotals.ytd.netIncome >= monthlyTotals.ytd.netIncomeBudget ? "text-emerald-400" : "text-red-400"}`}>
                                        {((monthlyTotals.ytd.netIncome / monthlyTotals.ytd.netIncomeBudget - 1) * 100).toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Monthly P&L Table */}
                <Card className="bg-gray-900 border-gray-800 overflow-hidden">
                    <CardHeader className="border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-800/80 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-gray-400" />
                                    Monthly Income Statement
                                </CardTitle>
                                <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
                                    {lastClosedMonth >= 0 ? `${MONTHS_FULL[lastClosedMonth]} ${selectedYear}` : `No closed months`}
                                </Badge>
                                <Badge className="text-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                    📊 Invoice Orders: Dados Reais
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-emerald-500/50 rounded"></div>
                                    <span>Revenue</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-red-500/50 rounded"></div>
                                    <span>Expense</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-amber-500/50 rounded"></div>
                                    <span>Total</span>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    {/* Table Header */}
                    <div className="grid grid-cols-[160px_repeat(12,minmax(55px,1fr))_70px] gap-1 py-2 px-2 bg-gray-800/80 border-b border-gray-700 text-[9px] font-semibold uppercase tracking-wider text-gray-400 sticky top-[73px] z-10">
                        <div>Account</div>
                        {MONTHS.map((m, i) => (
                            <div key={m} className={`text-right ${i === lastClosedMonth ? "text-emerald-400" : ""} ${i > lastClosedMonth ? "opacity-40" : ""}`}>
                                {m}
                            </div>
                        ))}
                        <div className="text-right text-amber-400 bg-amber-900/20 px-1 rounded">Total</div>
                    </div>

                    {/* Revenue Section */}
                    <div className="bg-gradient-to-r from-emerald-900/40 to-emerald-900/20 border-b border-emerald-800/50 py-2 px-3">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp className="h-3 w-3" />
                            Revenue
                        </span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        {revenueStructure.map((line) => renderMonthlyRow(line))}
                    </div>
                    {renderMonthlySubtotal("TOTAL REVENUE", monthlyTotals.months, "revenue", monthlyTotals.ytd.revenue, monthlyTotals.annual.revenue)}

                    {/* Expenses Section */}
                    <div className="bg-gradient-to-r from-red-900/40 to-red-900/20 border-b border-red-800/50 py-2 px-3 mt-1">
                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                            <TrendingDown className="h-3 w-3" />
                            Expenses
                        </span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        {expenseStructure.map((line) => renderMonthlyRow(line))}
                    </div>
                    {renderMonthlySubtotal("TOTAL EXPENSES", monthlyTotals.months, "totalExpenses", monthlyTotals.ytd.totalExpenses, monthlyTotals.annual.totalExpenses)}

                    {/* Profit Lines */}
                    {renderMonthlySubtotal("GROSS PROFIT", monthlyTotals.months, "grossProfit", monthlyTotals.ytd.grossProfit, monthlyTotals.annual.grossProfit, true)}
                    {renderMonthlySubtotal("EBITDA", monthlyTotals.months, "ebitda", monthlyTotals.ytd.ebitda, monthlyTotals.annual.ebitda, true)}

                    {/* Net Income Final Row */}
                    <div className="bg-gradient-to-r from-amber-900/60 via-orange-900/50 to-amber-900/60 border-y-2 border-amber-500/50 py-3 px-2">
                        <div className="grid grid-cols-[160px_repeat(12,minmax(55px,1fr))_70px] gap-1">
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-amber-400" />
                                <span className="text-sm font-bold text-amber-300">NET INCOME</span>
                            </div>
                            {monthlyTotals.months.map((m, i) => {
                                const isNotClosed = i > lastClosedMonth; // Month not closed if after last closed month
                                const displayValue = isNotClosed ? 0 : m.netIncome;
                                return (
                                    <div key={i} className={`text-right ${isNotClosed ? "opacity-30" : ""}`}>
                                        <span className={`text-[11px] font-mono font-bold ${displayValue >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                                            {isNotClosed ? "-" : formatCompact(displayValue)}
                                        </span>
                                    </div>
                                );
                            })}
                            <div className="text-right bg-amber-900/40 px-1 rounded-lg py-1">
                                <span className={`text-[11px] font-mono font-bold ${monthlyTotals.ytd.netIncome >= 0 ? "text-amber-200" : "text-red-300"}`}>
                                    {formatCompact(monthlyTotals.ytd.netIncome)}
                                </span>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Budget vs Actual Comparison */}
                <Card className="bg-gray-900 border-gray-800">
                    <CardHeader className="border-b border-gray-800 py-4">
                        <CardTitle className="text-white flex items-center gap-2 text-base">
                            <Filter className="h-4 w-4 text-gray-400" />
                            Budget vs Actual Variance Analysis
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-5 gap-4">
                            {[
                                { label: "Revenue", ytdActual: monthlyTotals.ytd.revenue, ytdBudget: monthlyTotals.ytd.revenueBudget, color: "emerald" },
                                { label: "Gross Profit", ytdActual: monthlyTotals.ytd.grossProfit, ytdBudget: monthlyTotals.ytd.grossProfitBudget, color: "blue" },
                                { label: "EBITDA", ytdActual: monthlyTotals.ytd.ebitda, ytdBudget: monthlyTotals.ytd.ebitdaBudget, color: "purple" },
                                { label: "Expenses", ytdActual: monthlyTotals.ytd.totalExpenses, ytdBudget: monthlyTotals.ytd.totalExpensesBudget, color: "red", invertVariance: true },
                                { label: "Net Income", ytdActual: monthlyTotals.ytd.netIncome, ytdBudget: monthlyTotals.ytd.netIncomeBudget, color: "amber" },
                            ].map((item) => {
                                const variance = item.ytdActual - item.ytdBudget;
                                const variancePercent = item.ytdBudget !== 0 ? (variance / item.ytdBudget) * 100 : 0;
                                const isPositive = item.invertVariance ? variance <= 0 : variance >= 0;

                                return (
                                    <div key={item.label} className={`bg-${item.color}-900/20 border border-${item.color}-800/40 rounded-lg p-4`}>
                                        <div className="text-xs font-semibold text-gray-400 mb-3">{item.label}</div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Budget</span>
                                                <span className="text-gray-300 font-mono">{formatCompact(item.ytdBudget)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Actual</span>
                                                <span className="text-white font-mono font-semibold">{formatCompact(item.ytdActual)}</span>
                                            </div>
                                            <div className="border-t border-gray-700 pt-2 mt-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-gray-500">Variance</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-mono font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                                                            {variance >= 0 ? "+" : ""}{formatCompact(variance)}
                                                        </span>
                                                        <Badge className={`text-[10px] ${isPositive ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                                                            {variancePercent >= 0 ? "+" : ""}{variancePercent.toFixed(1)}%
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Drill-down Modal */}
            <DrilldownModal
                drilldown={drilldown}
                selectedYear={selectedYear}
                onClose={closeDrilldown}
            />
        </div>
    );
}
