"use client";

import React, { useState, useEffect } from "react";
import { DollarSign, TrendingUp, RefreshCw, Loader2, X, Calendar, FileText, Hash, CreditCard, Building2, CheckCircle, Send, ThumbsUp, Paperclip, Link2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { type ScopeType, scopeToFields } from "@/lib/scope-utils";
import { formatDateForDB, getCurrentDateForDB } from "@/lib/date-utils";
import { InvoiceAttachments } from "@/components/app/invoice-attachments";

type InvoiceType = "INCURRED" | "BUDGET" | "ADJUSTMENT";

type Invoice = {
    id: number;
    invoice_date: string;
    benefit_date: string;
    due_date?: string | null;
    schedule_date?: string | null;
    payment_date?: string | null;
    invoice_type: InvoiceType;
    entry_type?: string;
    financial_account_code: string;
    invoice_amount: number;
    currency: string;
    eur_exchange?: number;
    provider_code: string;
    bank_account_code?: string | null;
    course_code?: string | null;
    payment_method_code?: string | null;
    cost_type_code?: string | null;
    dep_cost_type_code?: string | null;
    cost_center_code?: string | null;
    description?: string | null;
    invoice_number?: string | null;
    country_code: string;
    dre_impact?: boolean;
    cash_impact?: boolean;
    is_intercompany?: boolean;
    notes?: string | null;
};

type MasterData = {
    code: string;
    name: string;
    [key: string]: any;
};

const INVOICE_TYPE_CONFIG = {
    INCURRED: { label: "Incurred", color: "bg-blue-100 text-blue-800 border-blue-300", colorSelected: "bg-blue-500 text-white border-blue-500", icon: DollarSign },
    BUDGET: { label: "Budget", color: "bg-amber-100 text-amber-800 border-amber-300", colorSelected: "bg-amber-500 text-white border-amber-500", icon: TrendingUp },
};

interface InvoiceSidePanelProps {
    open: boolean;
    onClose: () => void;
    editingInvoice?: Invoice | null;
    defaultScope?: ScopeType;
    defaultScheduleDate?: string | null;
    onSuccess?: () => void;
}

export function InvoiceSidePanel({
    open,
    onClose,
    editingInvoice,
    defaultScope = "ES",
    defaultScheduleDate,
    onSuccess
}: InvoiceSidePanelProps) {
    const [submitting, setSubmitting] = useState(false);
    const [loadingMasterData, setLoadingMasterData] = useState(true);
    const [attachmentBatchId, setAttachmentBatchId] = useState<string | null>(null);

    // Master data
    const [providers, setProviders] = useState<MasterData[]>([]);
    const [bankAccounts, setBankAccounts] = useState<MasterData[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<MasterData[]>([]);
    const [costTypes, setCostTypes] = useState<MasterData[]>([]);
    const [depCostTypes, setDepCostTypes] = useState<MasterData[]>([]);
    const [costCenters, setCostCenters] = useState<MasterData[]>([]);
    const [subDepartments, setSubDepartments] = useState<MasterData[]>([]);
    const [financialAccounts, setFinancialAccounts] = useState<MasterData[]>([]);
    const [courses, setCourses] = useState<MasterData[]>([]);

    const [formData, setFormData] = useState({
        invoice_date: getCurrentDateForDB(),
        benefit_date: getCurrentDateForDB(),
        due_date: "",
        schedule_date: defaultScheduleDate || "",
        payment_date: "",
        invoice_type: "INCURRED" as InvoiceType,
        financial_account_code: "",
        invoice_amount: "",
        currency: defaultScope === "US" ? "USD" : "EUR",
        eur_exchange: "1.00",
        provider_code: "",
        bank_account_code: "",
        course_code: "",
        payment_method_code: "",
        cost_type_code: "",
        dep_cost_type_code: "",
        cost_center_code: "",
        sub_department_code: "",
        description: "",
        invoice_number: "",
        country_code: defaultScope,
        scope: defaultScope,
        dre_impact: true,
        cash_impact: true,
        is_intercompany: false,
        notes: ""
    });

    useEffect(() => {
        if (open) {
            loadMasterData();
            if (editingInvoice) {
                setFormData({
                    invoice_date: editingInvoice.invoice_date || getCurrentDateForDB(),
                    benefit_date: editingInvoice.benefit_date || getCurrentDateForDB(),
                    due_date: editingInvoice.due_date || "",
                    schedule_date: editingInvoice.schedule_date || "",
                    payment_date: editingInvoice.payment_date || "",
                    invoice_type: editingInvoice.invoice_type || "INCURRED",
                    financial_account_code: editingInvoice.financial_account_code || "",
                    invoice_amount: String(editingInvoice.invoice_amount) || "",
                    currency: editingInvoice.currency || "EUR",
                    eur_exchange: String(editingInvoice.eur_exchange || "1.00"),
                    provider_code: editingInvoice.provider_code || "",
                    bank_account_code: editingInvoice.bank_account_code || "",
                    course_code: editingInvoice.course_code || "",
                    payment_method_code: editingInvoice.payment_method_code || "",
                    cost_type_code: editingInvoice.cost_type_code || "",
                    dep_cost_type_code: editingInvoice.dep_cost_type_code || "",
                    cost_center_code: editingInvoice.cost_center_code || "",
                    description: editingInvoice.description || "",
                    invoice_number: editingInvoice.invoice_number || "",
                    country_code: (editingInvoice.country_code || defaultScope) as ScopeType,
                    scope: (editingInvoice.country_code || defaultScope) as ScopeType,
                    dre_impact: editingInvoice.dre_impact ?? true,
                    cash_impact: editingInvoice.cash_impact ?? true,
                    is_intercompany: editingInvoice.is_intercompany ?? false,
                    notes: editingInvoice.notes || ""
                });
            } else {
                resetForm();
            }
        }
    }, [open, editingInvoice, defaultScope, defaultScheduleDate]);

    function resetForm() {
        setFormData({
            invoice_date: getCurrentDateForDB(),
            benefit_date: getCurrentDateForDB(),
            due_date: "",
            schedule_date: defaultScheduleDate || "",
            payment_date: "",
            invoice_type: "INCURRED",
            financial_account_code: "",
            invoice_amount: "",
            currency: defaultScope === "US" ? "USD" : "EUR",
            eur_exchange: "1.00",
            provider_code: "",
            bank_account_code: "",
            course_code: "",
            payment_method_code: "",
            cost_type_code: "",
            dep_cost_type_code: "",
            cost_center_code: "",
            description: "",
            invoice_number: "",
            country_code: defaultScope,
            scope: defaultScope,
            dre_impact: true,
            cash_impact: true,
            is_intercompany: false,
            notes: ""
        });
    }

    async function loadMasterData() {
        setLoadingMasterData(true);
        try {
            const [providersRes, bankAccountsRes, paymentMethodsRes, costTypesRes, depCostTypesRes, costCentersRes, subDepartmentsRes, financialAccountsRes, coursesRes] = await Promise.all([
                supabase.from("providers").select("*").eq("is_active", true),
                supabase.from("bank_accounts").select("*").eq("is_active", true),
                supabase.from("payment_methods").select("*").eq("is_active", true),
                supabase.from("cost_types").select("*").eq("is_active", true),
                supabase.from("dep_cost_types").select("*").eq("is_active", true),
                supabase.from("cost_centers").select("*").eq("is_active", true),
                supabase.from("sub_departments").select("*").eq("is_active", true),
                supabase.from("financial_accounts").select("*").eq("is_active", true),
                supabase.from("courses").select("*").eq("is_active", true)
            ]);
            setProviders(providersRes.data || []);
            setBankAccounts(bankAccountsRes.data || []);
            setPaymentMethods(paymentMethodsRes.data || []);
            setCostTypes(costTypesRes.data || []);
            setDepCostTypes(depCostTypesRes.data || []);
            setCostCenters(costCentersRes.data || []);
            setSubDepartments(subDepartmentsRes.data || []);
            setFinancialAccounts(financialAccountsRes.data || []);
            setCourses(coursesRes.data || []);
            setPaymentMethods(paymentMethodsRes.data || []);
            setCostTypes(costTypesRes.data || []);
            setDepCostTypes(depCostTypesRes.data || []);
            setCostCenters(costCentersRes.data || []);
            setFinancialAccounts(financialAccountsRes.data || []);
            setCourses(coursesRes.data || []);
        } catch (e: any) {
            console.error("Failed to load master data:", e);
        } finally {
            setLoadingMasterData(false);
        }
    }

    function handleTypeChange(type: InvoiceType) {
        let dre = true, cash = true;
        if (type === "BUDGET") { dre = false; cash = false; }
        setFormData({ ...formData, invoice_type: type, dre_impact: dre, cash_impact: cash });
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (!formData.provider_code) { toast({ title: "Error", description: "Provider is required", variant: "destructive", className: "bg-white" }); setSubmitting(false); return; }
            if (!formData.financial_account_code) { toast({ title: "Error", description: "Financial Account is required", variant: "destructive", className: "bg-white" }); setSubmitting(false); return; }
            if (!formData.cost_center_code) { toast({ title: "Error", description: "Department is required", variant: "destructive", className: "bg-white" }); setSubmitting(false); return; }
            if (!formData.cost_type_code) { toast({ title: "Error", description: "Cost Type is required", variant: "destructive", className: "bg-white" }); setSubmitting(false); return; }
            if (!formData.dep_cost_type_code) { toast({ title: "Error", description: "Dep Cost Type is required", variant: "destructive", className: "bg-white" }); setSubmitting(false); return; }
            if (!formData.due_date) { toast({ title: "Error", description: "Due Date is required", variant: "destructive", className: "bg-white" }); setSubmitting(false); return; }

            const scopeFields = scopeToFields(formData.scope);

            let finalInvoiceNumber = formData.invoice_number?.trim() || null;
            if (!editingInvoice && !finalInvoiceNumber) {
                const year = new Date(formData.invoice_date).getFullYear();
                const month = String(new Date(formData.invoice_date).getMonth() + 1).padStart(2, '0');
                const { data: maxInvoiceData } = await supabase
                    .from("invoices")
                    .select("invoice_number")
                    .like("invoice_number", `${formData.scope}-INV-${year}${month}%`)
                    .order("invoice_number", { ascending: false })
                    .limit(1);
                let nextNumber = 1;
                if (maxInvoiceData && maxInvoiceData.length > 0 && maxInvoiceData[0].invoice_number) {
                    const match = maxInvoiceData[0].invoice_number.match(/-(\d+)$/);
                    if (match) nextNumber = parseInt(match[1]) + 1;
                }
                finalInvoiceNumber = `${formData.scope}-INV-${year}${month}-${String(nextNumber).padStart(4, '0')}`;
            }

            const payload = {
                input_date: getCurrentDateForDB(),
                invoice_date: formatDateForDB(formData.invoice_date),
                benefit_date: formatDateForDB(formData.benefit_date),
                due_date: formData.due_date ? formatDateForDB(formData.due_date) : null,
                schedule_date: formData.schedule_date ? formatDateForDB(formData.schedule_date) : (formData.due_date ? formatDateForDB(formData.due_date) : null),
                payment_date: formData.payment_date ? formatDateForDB(formData.payment_date) : null,
                invoice_type: formData.invoice_type,
                entry_type: formData.invoice_type === "INCURRED" ? "invoice" : formData.invoice_type === "BUDGET" ? "budget" : "adjustment",
                financial_account_code: formData.financial_account_code,
                invoice_amount: parseFloat(formData.invoice_amount),
                currency: formData.currency,
                eur_exchange: parseFloat(formData.eur_exchange) || 1,
                provider_code: formData.provider_code,
                bank_account_code: formData.bank_account_code || null,
                course_code: formData.course_code || null,
                payment_method_code: formData.payment_method_code || null,
                cost_type_code: formData.cost_type_code || null,
                dep_cost_type_code: formData.dep_cost_type_code || null,
                cost_center_code: formData.cost_center_code || null,
                description: formData.description || null,
                invoice_number: finalInvoiceNumber,
                country_code: scopeFields.country_code,
                scope: formData.scope,
                dre_impact: formData.dre_impact,
                cash_impact: formData.cash_impact,
                is_intercompany: formData.is_intercompany,
                notes: formData.notes || null
            };

            if (editingInvoice) {
                const { error } = await supabase.from("invoices").update(payload).eq("id", editingInvoice.id);
                if (error) throw error;
                toast({ title: "Invoice updated successfully", className: "bg-white" });
            } else {
                const { data: insertData, error } = await supabase.from("invoices").insert([payload]).select("id").single();
                if (error) throw error;

                // Link attachment batch to newly created invoice
                if (attachmentBatchId && insertData?.id) {
                    await fetch("/api/attachment-batches", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            batch_id: attachmentBatchId,
                            entity_type: "ap_invoice",
                            entity_id: insertData.id
                        })
                    });
                }

                toast({ title: "Invoice created successfully", className: "bg-white" });
            }

            onClose();
            onSuccess?.();
        } catch (e: any) {
            toast({ title: "Error", description: e?.message || "Failed to save invoice", variant: "destructive", className: "bg-white" });
        } finally {
            setSubmitting(false);
        }
    }

    if (!open) return null;

    return (
        <div className="fixed right-0 top-[64px] h-[calc(100vh-64px)] w-[520px] bg-white border-l border-gray-200 flex flex-col z-[9999] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">
                    {editingInvoice ? "Edit Invoice" : "New Invoice"}
                </h2>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {loadingMasterData ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-5 space-y-5">
                        {/* Invoice Type */}
                        <div className="flex gap-3">
                            {Object.entries(INVOICE_TYPE_CONFIG).map(([type, config]) => {
                                const Icon = config.icon;
                                const isSelected = formData.invoice_type === type;
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => handleTypeChange(type as InvoiceType)}
                                        className={`flex-1 p-3 border-2 rounded-lg text-left transition-all ${isSelected ? config.colorSelected : config.color}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Icon className="h-4 w-4" />
                                            <span className="font-medium text-sm">{config.label}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Section: Dates */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase">Dates</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div><Label className="text-xs text-gray-700">Invoice Date *</Label><Input type="date" value={formData.invoice_date} onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })} required className="mt-1 h-9 bg-white text-gray-900 border-gray-300" /></div>
                                <div><Label className="text-xs text-gray-700">Benefit Date *</Label><Input type="date" value={formData.benefit_date} onChange={(e) => setFormData({ ...formData, benefit_date: e.target.value })} required className="mt-1 h-9 bg-white text-gray-900 border-gray-300" /></div>
                                <div><Label className="text-xs text-gray-700">Due Date *</Label><Input type="date" value={formData.due_date} onChange={(e) => { setFormData({ ...formData, due_date: e.target.value, schedule_date: formData.schedule_date || e.target.value }); }} required className="mt-1 h-9 bg-white text-gray-900 border-gray-300" /></div>
                                <div><Label className="text-xs text-gray-700">Schedule Date</Label><Input type="date" value={formData.schedule_date} onChange={(e) => setFormData({ ...formData, schedule_date: e.target.value })} className="mt-1 h-9 bg-white text-gray-900 border-gray-300" /></div>
                            </div>
                        </div>

                        {/* Section: Amount */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase">Amount</h3>
                            <div className="grid grid-cols-4 gap-3">
                                <div><Label className="text-xs text-gray-700">Scope</Label>
                                    <Select value={formData.scope} onValueChange={(val) => setFormData({ ...formData, scope: val as ScopeType, country_code: val as ScopeType, currency: val === "US" ? "USD" : "EUR" })}>
                                        <SelectTrigger className="mt-1 h-9 bg-white text-gray-900 border-gray-300"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-white"><SelectItem value="ES">🇪🇸 ES</SelectItem><SelectItem value="US">🇺🇸 US</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2"><Label className="text-xs text-gray-700">Amount *</Label><Input type="number" step="0.01" value={formData.invoice_amount} onChange={(e) => setFormData({ ...formData, invoice_amount: e.target.value })} required className="mt-1 h-9 text-lg font-bold bg-white text-gray-900 border-gray-300" /></div>
                                <div><Label className="text-xs text-gray-700">Currency</Label>
                                    <Select value={formData.currency} onValueChange={(val) => setFormData({ ...formData, currency: val })}>
                                        <SelectTrigger className="mt-1 h-9 bg-white text-gray-900 border-gray-300"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-white"><SelectItem value="EUR">€</SelectItem><SelectItem value="USD">$</SelectItem><SelectItem value="GBP">£</SelectItem></SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div><Label className="text-xs text-gray-700">Invoice #</Label><Input value={formData.invoice_number} onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })} placeholder="Auto-generated" className="mt-1 h-9 bg-white text-gray-900 border-gray-300" /></div>
                        </div>

                        {/* Section: Provider */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase">Provider & Account</h3>
                            <div><Label className="text-xs text-gray-700">Provider *</Label>
                                <Select value={formData.provider_code} onValueChange={(val) => setFormData({ ...formData, provider_code: val })}>
                                    <SelectTrigger className="mt-1 h-9 bg-white text-gray-900 border-gray-300"><SelectValue placeholder="Select provider" /></SelectTrigger>
                                    <SelectContent className="bg-white max-h-[250px]">{providers.map((p) => (<SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                            <div><Label className="text-xs text-gray-700">Financial Account *</Label>
                                <Select value={formData.financial_account_code} onValueChange={(val) => setFormData({ ...formData, financial_account_code: val })}>
                                    <SelectTrigger className="mt-1 h-9 bg-white text-gray-900 border-gray-300"><SelectValue placeholder="Select account" /></SelectTrigger>
                                    <SelectContent className="bg-white max-h-[250px]">{financialAccounts.filter((a: any) => a.level >= 2).map((a) => (<SelectItem key={a.code} value={a.code}>{a.name}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Section: Classification */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase">Classification</h3>
                            <div className="grid grid-cols-3 gap-3">
                                <div><Label className="text-xs text-gray-700">Cost Type *</Label>
                                    <Select value={formData.cost_type_code} onValueChange={(val) => setFormData({ ...formData, cost_type_code: val })}>
                                        <SelectTrigger className="mt-1 h-9 bg-white text-gray-900 border-gray-300"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent className="bg-white max-h-[250px]">{costTypes.map((t) => (<SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                                <div><Label className="text-xs text-gray-700">Dep Cost *</Label>
                                    <Select value={formData.dep_cost_type_code} onValueChange={(val) => setFormData({ ...formData, dep_cost_type_code: val })}>
                                        <SelectTrigger className="mt-1 h-9 bg-white text-gray-900 border-gray-300"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent className="bg-white max-h-[250px]">{depCostTypes.map((t) => (<SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                                <div><Label className="text-xs text-gray-700">Department *</Label>
                                    <Select value={formData.cost_center_code} onValueChange={(val) => setFormData({ ...formData, cost_center_code: val, sub_department_code: "" })}>
                                        <SelectTrigger className="mt-1 h-9 bg-white text-gray-900 border-gray-300"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent className="bg-white max-h-[250px]">{costCenters.map((c) => (<SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div><Label className="text-xs text-gray-700">Sub-Department</Label>
                                <Select value={formData.sub_department_code || ""} onValueChange={(val) => setFormData({ ...formData, sub_department_code: val })}>
                                    <SelectTrigger className="mt-1 h-9 bg-white text-gray-900 border-gray-300"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent className="bg-white max-h-[250px]">{subDepartments.filter((s) => s.parent_department_code === formData.cost_center_code).map((s) => (<SelectItem key={s.code} value={s.code}>{s.code} - {s.name}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Section: Payment */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase">Payment</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div><Label className="text-xs text-gray-700">Bank Account</Label>
                                    <Select value={formData.bank_account_code || ""} onValueChange={(val) => setFormData({ ...formData, bank_account_code: val })}>
                                        <SelectTrigger className="mt-1 h-9 bg-white text-gray-900 border-gray-300"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent className="bg-white max-h-[250px]">{bankAccounts.map((b) => (<SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                                <div><Label className="text-xs text-gray-700">Payment Method</Label>
                                    <Select value={formData.payment_method_code || ""} onValueChange={(val) => setFormData({ ...formData, payment_method_code: val })}>
                                        <SelectTrigger className="mt-1 h-9 bg-white text-gray-900 border-gray-300"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent className="bg-white max-h-[250px]">{paymentMethods.map((m) => (<SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div><Label className="text-xs text-gray-700">Course</Label>
                                <Select value={formData.course_code || ""} onValueChange={(val) => setFormData({ ...formData, course_code: val })}>
                                    <SelectTrigger className="mt-1 h-9 bg-white text-gray-900 border-gray-300"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent className="bg-white max-h-[250px]">{courses.map((c) => (<SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Section: Notes */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase">Notes</h3>
                            <div><Label className="text-xs text-gray-700">Description</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Invoice description..." className="mt-1 resize-none bg-white text-gray-900 border-gray-300" /></div>
                            <div><Label className="text-xs text-gray-700">Internal Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} placeholder="Internal notes..." className="mt-1 resize-none bg-white text-gray-900 border-gray-300" /></div>
                        </div>

                        {/* Section: Attachments */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase">Attachments</h3>
                            <InvoiceAttachments
                                entityType="invoice"
                                entityId={editingInvoice?.id || null}
                                batchId={attachmentBatchId}
                                invoiceDate={formData.invoice_date}
                                onBatchCreated={(id) => setAttachmentBatchId(id)}
                            />
                        </div>

                        {/* Flags */}
                        <div className="flex items-center gap-5 py-3 px-4 bg-gray-50 rounded-lg">
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700"><Checkbox checked={formData.dre_impact} onCheckedChange={(checked) => setFormData({ ...formData, dre_impact: checked as boolean })} /><span>DRE</span></label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700"><Checkbox checked={formData.cash_impact} onCheckedChange={(checked) => setFormData({ ...formData, cash_impact: checked as boolean })} /><span>Cash</span></label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700"><Checkbox checked={formData.is_intercompany} onCheckedChange={(checked) => setFormData({ ...formData, is_intercompany: checked as boolean })} /><span>Intercompany</span></label>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-3">
                            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
                            <Button type="submit" disabled={submitting} className={`flex-1 ${editingInvoice ? "bg-green-600 hover:bg-green-700" : ""}`}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {submitting ? "Saving..." : editingInvoice ? "Update" : "Create Invoice"}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
