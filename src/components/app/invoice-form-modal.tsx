"use client";

import React, { useState, useEffect } from "react";
import { DollarSign, TrendingUp, RefreshCw, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { type ScopeType, scopeToFields } from "@/lib/scope-utils";
import { formatDateForDB, getCurrentDateForDB } from "@/lib/date-utils";

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
    INCURRED: {
        label: "Incurred",
        color: "border-blue-500 bg-blue-50 text-blue-700",
        colorSelected: "border-blue-500 bg-blue-100 text-blue-800 ring-2 ring-blue-500",
        icon: DollarSign,
        description: "Actual expenses - impacts DRE and Cash Flow"
    },
    BUDGET: {
        label: "Budget",
        color: "border-amber-500 bg-amber-50 text-amber-700",
        colorSelected: "border-amber-500 bg-amber-100 text-amber-800 ring-2 ring-amber-500",
        icon: TrendingUp,
        description: "Planned expenses - for budget tracking only"
    },
    ADJUSTMENT: {
        label: "Adjustments",
        color: "border-gray-400 bg-gray-50 text-gray-700",
        colorSelected: "border-gray-500 bg-gray-100 text-gray-800 ring-2 ring-gray-500",
        icon: RefreshCw,
        description: "Balance adjustments - affects cash but not DRE"
    }
};

interface InvoiceFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingInvoice?: Invoice | null;
    defaultScope?: ScopeType;
    defaultScheduleDate?: string | null;
    onSuccess?: () => void;
}

export function InvoiceFormModal({
    open,
    onOpenChange,
    editingInvoice,
    defaultScope = "ES",
    defaultScheduleDate,
    onSuccess
}: InvoiceFormModalProps) {
    const [submitting, setSubmitting] = useState(false);

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
    const [loadingMasterData, setLoadingMasterData] = useState(true);

    const [formData, setFormData] = useState({
        invoice_date: getCurrentDateForDB(),
        benefit_date: getCurrentDateForDB(),
        due_date: "",
        schedule_date: defaultScheduleDate || "",
        payment_date: "",
        invoice_type: "INCURRED" as InvoiceType,
        entry_type: "",
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
                    entry_type: editingInvoice.entry_type || "",
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
                // Reset form for new invoice
                setFormData({
                    invoice_date: getCurrentDateForDB(),
                    benefit_date: getCurrentDateForDB(),
                    due_date: "",
                    schedule_date: defaultScheduleDate || "",
                    payment_date: "",
                    invoice_type: "INCURRED",
                    entry_type: "",
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
        }
    }, [open, editingInvoice, defaultScope, defaultScheduleDate]);

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
        } catch (e: any) {
            console.error("Failed to load master data:", e);
        } finally {
            setLoadingMasterData(false);
        }
    }

    function handleTypeChange(type: InvoiceType) {
        let dre = true, cash = true;
        if (type === "BUDGET") { dre = false; cash = false; }
        if (type === "ADJUSTMENT") { dre = false; cash = true; }
        setFormData({ ...formData, invoice_type: type, dre_impact: dre, cash_impact: cash });
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);

        try {
            // Validate required fields
            if (!formData.provider_code) {
                toast({ title: "Error", description: "Provider is required", variant: "destructive" });
                setSubmitting(false);
                return;
            }
            if (!formData.financial_account_code) {
                toast({ title: "Error", description: "Financial Account is required", variant: "destructive" });
                setSubmitting(false);
                return;
            }
            if (!formData.cost_center_code) {
                toast({ title: "Error", description: "Department is required", variant: "destructive" });
                setSubmitting(false);
                return;
            }
            if (!formData.cost_type_code) {
                toast({ title: "Error", description: "Cost Type is required", variant: "destructive" });
                setSubmitting(false);
                return;
            }
            if (!formData.dep_cost_type_code) {
                toast({ title: "Error", description: "Dep Cost Type is required", variant: "destructive" });
                setSubmitting(false);
                return;
            }
            if (!formData.due_date) {
                toast({ title: "Error", description: "Due Date is required", variant: "destructive" });
                setSubmitting(false);
                return;
            }

            const scopeFields = scopeToFields(formData.scope);

            // Auto-generate invoice number for new invoices if not provided
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
                    const lastInvoiceNumber = maxInvoiceData[0].invoice_number;
                    const match = lastInvoiceNumber.match(/-(\d+)$/);
                    if (match) {
                        nextNumber = parseInt(match[1]) + 1;
                    }
                }

                finalInvoiceNumber = `${formData.scope}-INV-${year}${month}-${String(nextNumber).padStart(4, '0')}`;
            }

            const payload = {
                invoice_date: formatDateForDB(formData.invoice_date),
                benefit_date: formatDateForDB(formData.benefit_date),
                due_date: formData.due_date ? formatDateForDB(formData.due_date) : null,
                schedule_date: formData.schedule_date ? formatDateForDB(formData.schedule_date) : (formData.due_date ? formatDateForDB(formData.due_date) : null),
                payment_date: formData.payment_date ? formatDateForDB(formData.payment_date) : null,
                invoice_type: formData.invoice_type,
                entry_type: formData.entry_type || null,
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
                sub_department_code: formData.sub_department_code || null,
                description: formData.description || null,
                invoice_number: finalInvoiceNumber,
                country_code: scopeFields.country_code,
                dre_impact: formData.dre_impact,
                cash_impact: formData.cash_impact,
                is_intercompany: formData.is_intercompany,
                notes: formData.notes || null
            };

            if (editingInvoice) {
                const { error } = await supabase.from("invoices").update(payload).eq("id", editingInvoice.id);
                if (error) throw error;
                toast({ title: "Invoice updated successfully" });
            } else {
                const { error } = await supabase.from("invoices").insert([payload]);
                if (error) throw error;
                toast({ title: "Invoice created successfully" });
            }

            onOpenChange(false);
            onSuccess?.();
        } catch (e: any) {
            toast({ title: "Error", description: e?.message || "Failed to save invoice", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    }

    if (loadingMasterData && open) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-none max-h-[90vh] bg-white" style={{ width: '80vw' }}>
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-500 dark:text-gray-400" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-[1600px] max-h-[95vh] overflow-y-auto bg-white">
                <DialogHeader className="pb-4">
                    <DialogTitle className="text-xl font-bold">
                        {editingInvoice ? "Edit Invoice" : "Create New Invoice"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* ROW 1: Invoice Type (2 cards side by side) */}
                    <div className="flex gap-4">
                        {Object.entries(INVOICE_TYPE_CONFIG).filter(([type]) => type !== 'ADJUSTMENT').map(([type, config]) => {
                            const Icon = config.icon;
                            const isSelected = formData.invoice_type === type;
                            return (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => handleTypeChange(type as InvoiceType)}
                                    className={`flex-1 p-4 border-2 rounded-lg text-left transition-all ${isSelected ? config.colorSelected : config.color}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon className="h-5 w-5" />
                                        <span className="font-semibold">{config.label}</span>
                                    </div>
                                    <p className="text-xs mt-1 opacity-75">{config.description}</p>
                                </button>
                            );
                        })}
                    </div>

                    {/* ROW 2: ALL DATES in one row */}
                    <div className="grid grid-cols-5 gap-4">
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Invoice Date *</Label>
                            <Input type="date" value={formData.invoice_date} onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })} required className="mt-1" />
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Benefit Date *</Label>
                            <Input type="date" value={formData.benefit_date} onChange={(e) => setFormData({ ...formData, benefit_date: e.target.value })} required className="mt-1" />
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Due Date *</Label>
                            <Input type="date" value={formData.due_date} onChange={(e) => {
                                const newDueDate = e.target.value;
                                setFormData({ ...formData, due_date: newDueDate, schedule_date: formData.schedule_date || newDueDate });
                            }} required className="mt-1" />
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Schedule Date</Label>
                            <Input type="date" value={formData.schedule_date} onChange={(e) => setFormData({ ...formData, schedule_date: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Payment Date</Label>
                            <Input type="date" value={formData.payment_date || ""} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} className="mt-1" />
                        </div>
                    </div>

                    {/* ROW 3: Scope, Invoice #, Amount, Currency, EUR Rate */}
                    <div className="grid grid-cols-6 gap-4">
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Scope *</Label>
                            <Select value={formData.scope} onValueChange={(val) => setFormData({ ...formData, scope: val as ScopeType, country_code: val as ScopeType, currency: val === "US" ? "USD" : "EUR" })}>
                                <SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-white">
                                    <SelectItem value="ES">🇪🇸 Spain</SelectItem>
                                    <SelectItem value="US">🇺🇸 USA</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Invoice #</Label>
                            <Input value={formData.invoice_number} onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })} placeholder="Auto" className="mt-1" />
                        </div>
                        <div className="col-span-2">
                            <Label className="text-xs font-medium text-gray-600">Amount *</Label>
                            <Input type="number" step="0.01" value={formData.invoice_amount} onChange={(e) => setFormData({ ...formData, invoice_amount: e.target.value })} required className="mt-1 text-lg font-bold" />
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Currency *</Label>
                            <Select value={formData.currency} onValueChange={(val) => setFormData({ ...formData, currency: val })}>
                                <SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-white">
                                    <SelectItem value="EUR">EUR €</SelectItem>
                                    <SelectItem value="USD">USD $</SelectItem>
                                    <SelectItem value="GBP">GBP £</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-gray-600">EUR Rate</Label>
                            <Input type="number" step="0.0001" value={formData.eur_exchange || ""} onChange={(e) => setFormData({ ...formData, eur_exchange: e.target.value })} placeholder="1.0" className="mt-1" />
                        </div>
                    </div>

                    {/* ROW 4: Provider, Financial Account */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Provider *</Label>
                            <Select value={formData.provider_code} onValueChange={(val) => setFormData({ ...formData, provider_code: val })}>
                                <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Select provider" /></SelectTrigger>
                                <SelectContent className="bg-white max-h-[300px]">
                                    {providers.map((p) => (<SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Financial Account *</Label>
                            <Select value={formData.financial_account_code} onValueChange={(val) => setFormData({ ...formData, financial_account_code: val })}>
                                <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Select account" /></SelectTrigger>
                                <SelectContent className="bg-white max-h-[300px]">
                                    {financialAccounts.filter((a: any) => a.level >= 2 && a.type === 'expense').map((a) => (<SelectItem key={a.code} value={a.code}>{a.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* ROW 5: Cost Type, Dep Cost Type, Department, Sub-Department */}
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Cost Type *</Label>
                            <Select value={formData.cost_type_code} onValueChange={(val) => setFormData({ ...formData, cost_type_code: val })}>
                                <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent className="bg-white max-h-[300px]">
                                    {costTypes.map((t) => (<SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Dep Cost Type *</Label>
                            <Select value={formData.dep_cost_type_code} onValueChange={(val) => setFormData({ ...formData, dep_cost_type_code: val })}>
                                <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent className="bg-white max-h-[300px]">
                                    {depCostTypes.map((t) => (<SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Department *</Label>
                            <Select value={formData.cost_center_code} onValueChange={(val) => setFormData({ ...formData, cost_center_code: val, sub_department_code: "" })}>
                                <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent className="bg-white max-h-[300px]">
                                    {costCenters.map((c) => (<SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Sub-Department</Label>
                            <Select value={formData.sub_department_code || ""} onValueChange={(val) => setFormData({ ...formData, sub_department_code: val })}>
                                <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent className="bg-white max-h-[300px]">
                                    {subDepartments.filter((s) => s.parent_department_code === formData.cost_center_code).map((s) => (<SelectItem key={s.code} value={s.code}>{s.code} - {s.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* ROW 6: Bank, Payment Method, Course */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Bank Account</Label>
                            <Select value={formData.bank_account_code || ""} onValueChange={(val) => setFormData({ ...formData, bank_account_code: val })}>
                                <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent className="bg-white max-h-[300px]">
                                    {bankAccounts.map((b) => (<SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Payment Method</Label>
                            <Select value={formData.payment_method_code || ""} onValueChange={(val) => setFormData({ ...formData, payment_method_code: val })}>
                                <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent className="bg-white max-h-[300px]">
                                    {paymentMethods.map((m) => (<SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Course</Label>
                            <Select value={formData.course_code || ""} onValueChange={(val) => setFormData({ ...formData, course_code: val })}>
                                <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent className="bg-white max-h-[300px]">
                                    {courses.map((c) => (<SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* ROW 7: Description & Notes */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Description</Label>
                            <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Invoice description..." className="mt-1 resize-none" />
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-gray-600">Internal Notes</Label>
                            <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} placeholder="Internal notes..." className="mt-1 resize-none" />
                        </div>
                    </div>

                    {/* ROW 8: Flags + Actions in same row */}
                    <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex items-center gap-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox checked={formData.dre_impact} onCheckedChange={(checked) => setFormData({ ...formData, dre_impact: checked as boolean })} />
                                <span className="text-sm">Impacts DRE</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox checked={formData.cash_impact} onCheckedChange={(checked) => setFormData({ ...formData, cash_impact: checked as boolean })} />
                                <span className="text-sm">Impacts Cash Flow</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox checked={formData.is_intercompany} onCheckedChange={(checked) => setFormData({ ...formData, is_intercompany: checked as boolean })} />
                                <span className="text-sm">Intercompany</span>
                            </label>
                        </div>
                        <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={submitting} className={editingInvoice ? "bg-green-600 hover:bg-green-700" : ""}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {submitting ? "Saving..." : editingInvoice ? "Update Invoice" : "Create Invoice"}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
