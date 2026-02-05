"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Plus, Search, Edit2, ArrowUpDown, FileText, TrendingUp, RefreshCw, DollarSign, Trash2, X, Pencil, Filter, ChevronDown, Check, Save, Download, FileSpreadsheet, Columns3, Split, Eye, Zap, User } from "lucide-react";
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InvoiceSidePanel } from "@/components/app/invoice-side-panel";
import {
  formatDateForDB,
  formatDateForInput,
  getCurrentDateForDB,
  getCurrentTimestamp
} from "@/lib/date-utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { ScopeSelector } from "@/components/app/scope-selector";
import { type ScopeType, getRecordScope, getScopeIcon, matchesScope, scopeToFields, SCOPE_CONFIG } from "@/lib/scope-utils";
import { useGlobalScope } from "@/contexts/global-scope-context";

type InvoiceType = "INCURRED" | "BUDGET" | "ADJUSTMENT";
type SortField = "invoice_date" | "invoice_number" | "provider_code" | "invoice_amount" | "invoice_type";
type SortDirection = "asc" | "desc";

type Invoice = {
  id: number;
  input_date: string;
  invoice_date: string;
  benefit_date: string;
  due_date?: string | null;
  schedule_date?: string | null;
  payment_date?: string | null;
  invoice_type: InvoiceType;
  entry_type: string;
  financial_account_code: string;
  financial_account_name?: string | null;
  invoice_amount: number;
  amount: number; // Alias for invoice_amount
  currency: string;
  paid_amount?: number | null;
  paid_currency?: string | null;
  eur_exchange: number;
  provider_code: string;
  bank_account_code?: string | null;
  course_code?: string | null;
  payment_method_code?: string | null;
  cost_type_code?: string | null;
  dep_cost_type_code?: string | null;
  cost_center_code?: string | null;
  sub_department_code?: string | null;
  description?: string | null;
  invoice_number?: string | null;
  country_code: string;
  scope: string; // Country scope
  applies_to_all_countries?: boolean;
  dre_impact: boolean;
  cash_impact: boolean;
  is_intercompany: boolean;
  is_reconciled?: boolean; // Payment reconciliation status
  payment_status?: string | null;
  notes?: string | null;
  is_split?: boolean;
  parent_invoice_id?: number | null;
  split_number?: number | null;
  total_splits?: number | null;
  split_type?: string | null;
  created_at: string;
  updated_at: string;
};

const INVOICE_TYPE_CONFIG = {
  INCURRED: {
    label: "Incurred",
    color: "bg-blue-900/30 text-blue-400 border border-blue-700",
    icon: DollarSign,
    description: "Actual expenses - impacts DRE and Cash Flow"
  },
  BUDGET: {
    label: "Budget",
    color: "bg-amber-900/30 text-amber-400 border border-amber-700",
    icon: TrendingUp,
    description: "Planned expenses - for budget tracking only"
  },
  ADJUSTMENT: {
    label: "Adjustments",
    color: "bg-gray-700/50 text-gray-300 border border-gray-600",
    icon: RefreshCw,
    description: "Balance adjustments - affects cash but not DRE"
  }
};

const COUNTRIES = [
  { code: "ES", name: "Spain", defaultCurrency: "EUR" },
  { code: "US", name: "United States", defaultCurrency: "USD" },
  { code: "GLOBAL", name: "Global (Consolidated)", defaultCurrency: "EUR" }
];

// Helper function to format numbers in European format (1.250,00)
function formatEuropeanNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export default function InvoicesPage() {
  const { selectedScope } = useGlobalScope();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [splitInvoice, setSplitInvoice] = useState<Invoice | null>(null);
  const [viewSplitsDialogOpen, setViewSplitsDialogOpen] = useState(false);
  const [viewingSplitInvoice, setViewingSplitInvoice] = useState<Invoice | null>(null);
  const [splitConfig, setSplitConfig] = useState({
    type: 'installments' as 'installments' | 'financial_account' | 'cost_center' | 'cost_type' | 'dep_cost_type',
    installments: 1,
    splits: [] as Array<{
      financial_account_code?: string | null;
      cost_center_code?: string | null;
      cost_type_code?: string | null;
      dep_cost_type_code?: string | null;
      amount: number;
      percentage: number;
    }>
  });
  const [submitting, setSubmitting] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<InvoiceType | "ALL">("ALL");
  const [selectedCountry, setSelectedCountry] = useState<string>("ALL");
  const [sortField, setSortField] = useState<SortField>("invoice_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [appliedFilters, setAppliedFilters] = useState<{ field: string, value: string, label: string }[]>([]);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [multiSelectFilters, setMultiSelectFilters] = useState<Record<string, string[]>>({});
  const [filterPopoverOpen, setFilterPopoverOpen] = useState<{ field: string, anchor: HTMLElement } | null>(null);
  const [tempFilterSelection, setTempFilterSelection] = useState<string[]>([]);
  const [filterSearchTerm, setFilterSearchTerm] = useState("");

  // Date and amount filters
  const [dateFilters, setDateFilters] = useState<Record<string, { start?: string, end?: string }>>({});
  const [amountFilter, setAmountFilter] = useState<{ operator: 'lt' | 'gt' | 'eq' | 'between', value1: number, value2?: number } | null>(null);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    "actions", "split", "scope", "impact", "type", "input_date", "invoice_date", "benefit_date", "due_date", "schedule_date",
    "provider", "description", "invoice_number", "amount", "currency", "financial_account",
    "cost_center", "cost_type", "dep_cost_type", "payment_status", "payment_method",
    "bank_account", "payment_date"
  ]));
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
  const [tempVisibleColumns, setTempVisibleColumns] = useState<Set<string>>(new Set());

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ invoiceId: number, field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectSearchTerm, setSelectSearchTerm] = useState("");

  // Master data creation popups
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [financialAccountDialogOpen, setFinancialAccountDialogOpen] = useState(false);
  const [newProviderData, setNewProviderData] = useState({
    code: "",
    name: "",
    country: "ES",
    email: "",
    payment_terms: "Net 30",
    currency: "EUR"
  });
  const [newAccountData, setNewAccountData] = useState({
    code: "",
    name: "",
    type: "Expense",
    level: 1,
    parent_code: "",
    scope: "ES" as ScopeType
  });

  // Master data for dropdowns
  const [providers, setProviders] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [costTypes, setCostTypes] = useState<any[]>([]);
  const [depCostTypes, setDepCostTypes] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [subDepartments, setSubDepartments] = useState<any[]>([]);
  const [entryTypes, setEntryTypes] = useState<any[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  // View mode: separate automatic vs manual invoices
  const [invoiceViewMode, setInvoiceViewMode] = useState<"all" | "automatic" | "manual">("all");

  const [formData, setFormData] = useState({
    invoice_date: getCurrentDateForDB(),
    benefit_date: getCurrentDateForDB(),
    due_date: "",
    schedule_date: "",
    payment_date: "",
    invoice_type: "INCURRED" as InvoiceType,
    entry_type: "",
    financial_account_code: "",
    invoice_amount: "",
    currency: "EUR",
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
    country_code: "ES",
    scope: "ES" as ScopeType,
    dre_impact: true,
    cash_impact: true,
    is_intercompany: false,
    notes: "",
    paid_amount: "",
    paid_currency: ""
  });

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    loadMasterData();
  }, [selectedScope]);

  // Sincronizar form com scope global quando abrir diálogo
  useEffect(() => {
    if (dialogOpen && !editingInvoice) {
      setFormData(prev => ({
        ...prev,
        scope: selectedScope,
        country_code: selectedScope
      }));
    }
  }, [dialogOpen, selectedScope, editingInvoice]);

  async function loadMasterData() {
    try {
      // Build bank accounts query with scope filter
      let bankAccountsQuery = supabase
        .from("bank_accounts")
        .select("*")
        .eq("is_active", true);

      // Apply scope filter for bank accounts
      if (selectedScope === "GLOBAL") {
        // GLOBAL: show all accounts
        // No additional filter needed
      } else {
        // ES or US: show only accounts matching the scope or those that apply to all countries
        bankAccountsQuery = bankAccountsQuery.or(`country.eq.${selectedScope},applies_to_all_countries.eq.true`);
      }

      const [providersRes, bankAccountsRes, paymentMethodsRes, costTypesRes, depCostTypesRes, costCentersRes, subDepartmentsRes, entryTypesRes, financialAccountsRes, coursesRes] = await Promise.all([
        supabase.from("providers").select("*").eq("is_active", true),
        bankAccountsQuery,
        supabase.from("payment_methods").select("*").eq("is_active", true),
        supabase.from("cost_types").select("*").eq("is_active", true),
        supabase.from("dep_cost_types").select("*").eq("is_active", true),
        supabase.from("cost_centers").select("*").eq("is_active", true).eq("level", 1),
        supabase.from("sub_departments").select("*").eq("is_active", true),
        supabase.from("entry_types").select("*").eq("is_active", true),
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
      setEntryTypes(entryTypesRes.data || []);
      setFinancialAccounts(financialAccountsRes.data || []);
      setCourses(coursesRes.data || []);
    } catch (e: any) {
      console.error("Failed to load master data:", e);
    }
  }

  async function loadInvoices() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("invoice_date", { ascending: false });

      if (error) throw error;
      // Map invoice_amount to amount for compatibility
      const mappedData = (data || []).map(invoice => ({
        ...invoice,
        amount: invoice.invoice_amount,
        scope: invoice.country_code // Map country_code to scope for backward compatibility
      }));
      setInvoices(mappedData as Invoice[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load invoices");
      toast({
        title: "Error",
        description: e?.message || "Failed to load invoices",
        variant: "destructive",

      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validar campos obrigatórios
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
      if (!formData.schedule_date) {
        toast({ title: "Error", description: "Schedule Date is required", variant: "destructive" });
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
        entry_type: formData.entry_type,
        financial_account_code: formData.financial_account_code,
        invoice_amount: parseFloat(formData.invoice_amount),
        currency: formData.currency,
        eur_exchange: parseFloat(formData.eur_exchange),
        provider_code: formData.provider_code,
        bank_account_code: formData.bank_account_code || null,
        course_code: formData.course_code || null,
        payment_method_code: formData.payment_method_code || null,
        cost_type_code: formData.cost_type_code || null,
        dep_cost_type_code: formData.dep_cost_type_code || null,
        cost_center_code: formData.cost_center_code || null,
        description: formData.description || null,
        invoice_number: finalInvoiceNumber,
        ...scopeFields,
        dre_impact: formData.dre_impact,
        cash_impact: formData.cash_impact,
        is_intercompany: formData.is_intercompany,
        notes: formData.notes || null,
        paid_amount: formData.paid_amount ? parseFloat(formData.paid_amount) : null,
        paid_currency: formData.paid_currency || null,
        updated_at: getCurrentTimestamp(),
      };

      if (editingInvoice) {
        const { error } = await supabase
          .from("invoices")
          .update(payload)
          .eq("id", editingInvoice.id);

        if (error) throw error;
        toast({ title: "Success", description: "Invoice updated successfully" });
      } else {
        const { error } = await supabase.from("invoices").insert([{
          ...payload,
          input_date: getCurrentTimestamp(),
        }]);

        if (error) throw error;
        toast({ title: "Success", description: "Invoice created successfully" });
      }

      setDialogOpen(false);
      resetForm();
      loadInvoices();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "Failed to save invoice",
        variant: "destructive",

      });
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setFormData({
      invoice_date: getCurrentDateForDB(),
      benefit_date: getCurrentDateForDB(),
      due_date: "",
      schedule_date: "",
      payment_date: "",
      invoice_type: "INCURRED",
      entry_type: "",
      financial_account_code: "",
      invoice_amount: "",
      currency: "EUR",
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
      country_code: "ES",
      scope: "ES" as ScopeType,
      dre_impact: true,
      cash_impact: true,
      is_intercompany: false,
      notes: "",
      paid_amount: "",
      paid_currency: ""
    });
    setEditingInvoice(null);
  }

  async function handleDelete(invoice: Invoice) {
    if (!confirm(`Delete invoice ${invoice.invoice_number || invoice.id}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoice.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invoice deleted successfully",

      });

      loadInvoices();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",

      });
    }
  }

  function openSplitDialog(invoice: Invoice) {
    setSplitInvoice(invoice);
    setSplitConfig({
      type: 'installments',
      installments: 1,
      splits: []
    });
    setSplitDialogOpen(true);
  }

  async function handleSplitInvoice() {
    if (!splitInvoice) return;

    try {
      setSubmitting(true);

      if (splitConfig.type === 'installments') {
        // Split by installments
        const installmentAmount = splitInvoice.invoice_amount / splitConfig.installments;
        const baseDueDate = new Date(splitInvoice.due_date || splitInvoice.invoice_date);

        const splits = [];
        for (let i = 0; i < splitConfig.installments; i++) {
          const dueDate = new Date(baseDueDate);
          dueDate.setMonth(dueDate.getMonth() + i);

          splits.push({
            ...splitInvoice,
            id: undefined,
            invoice_amount: installmentAmount,
            due_date: dueDate.toISOString().split('T')[0],
            schedule_date: dueDate.toISOString().split('T')[0],
            is_split: true,
            parent_invoice_id: splitInvoice.id,
            split_number: i + 1,
            total_splits: splitConfig.installments,
            split_type: 'INSTALLMENTS',
            invoice_number: `${splitInvoice.invoice_number || splitInvoice.id}-${i + 1}/${splitConfig.installments}`,
            created_at: undefined,
            updated_at: undefined
          });
        }

        // Insert all splits
        const { error } = await supabase.from('accounts_payable').insert(splits);

        if (error) throw error;

        // Mark original as parent
        await supabase
          .from('accounts_payable')
          .update({ is_split: true, total_splits: splitConfig.installments })
          .eq('id', splitInvoice.id);

      } else {
        // Split by dimensions (financial account, cost center, etc.)
        const splits = splitConfig.splits.map((split, index) => ({
          ...splitInvoice,
          id: undefined,
          invoice_amount: split.amount,
          financial_account_code: split.financial_account_code || splitInvoice.financial_account_code,
          cost_center_code: split.cost_center_code || splitInvoice.cost_center_code,
          cost_type_code: split.cost_type_code || splitInvoice.cost_type_code,
          dep_cost_type_code: split.dep_cost_type_code || splitInvoice.dep_cost_type_code,
          is_split: true,
          parent_invoice_id: splitInvoice.id,
          split_number: index + 1,
          total_splits: splitConfig.splits.length,
          split_type: splitConfig.type.toUpperCase(),
          invoice_number: `${splitInvoice.invoice_number || splitInvoice.id}-${index + 1}/${splitConfig.splits.length}`,
          created_at: undefined,
          updated_at: undefined
        }));

        const { error } = await supabase.from('accounts_payable').insert(splits);

        if (error) throw error;

        await supabase
          .from('accounts_payable')
          .update({ is_split: true, total_splits: splitConfig.splits.length })
          .eq('id', splitInvoice.id);
      }

      toast({
        title: "Success",
        description: `Invoice split into ${splitConfig.type === 'installments' ? splitConfig.installments : splitConfig.splits.length} parts`,

      });

      setSplitDialogOpen(false);
      loadInvoices();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",

      });
    } finally {
      setSubmitting(false);
    }
  }

  async function viewSplits(invoice: Invoice) {
    setViewingSplitInvoice(invoice);
    setViewSplitsDialogOpen(true);
  }

  async function handleInlineEdit(invoiceId: number, field: string, value: any) {
    console.log("Handling inline edit:", { invoiceId, field, value });
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ [field]: value, updated_at: getCurrentTimestamp() })
        .eq("id", invoiceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Field updated successfully",

      });

      await loadInvoices();
      setEditingCell(null);
      setEditValue("");
      setSelectSearchTerm("");
    } catch (err: any) {
      console.error("Error updating field:", err);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",

      });
    }
  }

  function startInlineEdit(invoiceId: number, field: string, currentValue: any) {
    console.log("Starting inline edit:", { invoiceId, field, currentValue });
    setEditingCell({ invoiceId, field });
    setEditValue(currentValue || "");
    setSelectSearchTerm("");
  }

  function cancelInlineEdit() {
    console.log("Canceling inline edit");
    setEditingCell(null);
    setEditValue("");
    setSelectSearchTerm("");
  }

  function saveInlineEdit(invoiceId: number, field: string) {
    console.log("Saving inline edit:", { invoiceId, field, editValue });
    if (editValue !== null && editValue !== undefined && editValue !== "") {
      handleInlineEdit(invoiceId, field, editValue);
    } else {
      toast({
        title: "Warning",
        description: "Please select a value before saving",
        variant: "destructive",

      });
    }
  }

  async function createNewProvider() {
    try {
      const { data, error } = await supabase
        .from("providers")
        .insert([{
          code: newProviderData.code,
          name: newProviderData.name,
          country_code: newProviderData.country,
          email: newProviderData.email,
          payment_terms: newProviderData.payment_terms,
          currency: newProviderData.currency,
          applies_to_all_countries: false
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Provider created",
        description: `Provider ${newProviderData.name} created successfully`,

      });

      loadMasterData();
      setProviderDialogOpen(false);
      setNewProviderData({
        code: "",
        name: "",
        country: "ES",
        email: "",
        payment_terms: "Net 30",
        currency: "EUR"
      });

      // Set the new provider as selected value
      if (editingCell) {
        setEditValue(data.code);
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",

      });
    }
  }

  async function createNewFinancialAccount() {
    try {
      const scopeFields = scopeToFields(newAccountData.scope);

      const { data, error } = await supabase
        .from("financial_accounts")
        .insert([{
          code: newAccountData.code,
          name: newAccountData.name,
          type: newAccountData.type,
          level: newAccountData.level,
          parent_code: newAccountData.parent_code || null,
          ...scopeFields
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Financial Account created",
        description: `Account ${newAccountData.name} created successfully`,

      });

      loadMasterData();
      setFinancialAccountDialogOpen(false);
      setNewAccountData({
        code: "",
        name: "",
        type: "Expense",
        level: 1,
        parent_code: "",
        scope: "ES"
      });

      // Set the new account as selected value
      if (editingCell) {
        setEditValue(data.code);
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",

      });
    }
  }

  function addColumnFilter(field: string, value: string, label: string) {
    setColumnFilters(prev => ({ ...prev, [field]: value }));
    setAppliedFilters(prev => {
      const exists = prev.find(f => f.field === field);
      if (exists) {
        return prev.map(f => f.field === field ? { field, value, label } : f);
      }
      return [...prev, { field, value, label }];
    });
  }

  function removeFilter(field: string) {
    setColumnFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[field];
      return newFilters;
    });
    setMultiSelectFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[field];
      return newFilters;
    });
    setDateFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[field];
      return newFilters;
    });
    if (field === 'invoice_amount') {
      setAmountFilter(null);
    }
    setAppliedFilters(prev => prev.filter(f => f.field !== field));
  }

  function clearAllFilters() {
    setColumnFilters({});
    setMultiSelectFilters({});
    setDateFilters({});
    setAmountFilter(null);
    setAppliedFilters([]);
    setSearchTerm("");
  }

  function openFilterPopover(field: string, event: React.MouseEvent<HTMLButtonElement>) {
    const currentFilters = multiSelectFilters[field] || [];
    setTempFilterSelection(currentFilters);
    setFilterSearchTerm("");
    setFilterPopoverOpen({ field, anchor: event.currentTarget });
  }

  function closeFilterPopover() {
    setFilterPopoverOpen(null);
    setTempFilterSelection([]);
    setFilterSearchTerm("");
  }

  function toggleFilterOption(value: string) {
    setTempFilterSelection(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  }

  function applyMultiSelectFilter(field: string) {
    if (tempFilterSelection.length > 0) {
      setMultiSelectFilters(prev => ({ ...prev, [field]: tempFilterSelection }));

      // Create friendly labels for filters
      const fieldLabels: Record<string, string> = {
        'provider_code': 'Provider',
        'financial_account_code': 'Financial Account',
        'cost_center_code': 'Department',
        'cost_type_code': 'Cost Type',
        'dep_cost_type_code': 'Dep Cost Type',
        'currency': 'Currency',
        'invoice_type': 'Type',
        'payment_status': 'Payment Status',
        'entry_type': 'Entry Type'
      };

      const friendlyLabel = fieldLabels[field] || field;
      const displayValues = tempFilterSelection.map(code => {
        if (field === 'provider_code') return getNameByCode(providers, code);
        if (field === 'financial_account_code') return getNameByCode(financialAccounts, code);
        if (field === 'cost_center_code') return getNameByCode(costCenters, code);
        if (field === 'cost_type_code') return getNameByCode(costTypes, code);
        if (field === 'dep_cost_type_code') return getNameByCode(depCostTypes, code);
        return code;
      }).join(', ');

      setAppliedFilters(prev => {
        const filtered = prev.filter(f => f.field !== field);
        return [...filtered, {
          field,
          value: tempFilterSelection.join(", "),
          label: `${friendlyLabel}: ${displayValues.length > 50 ? tempFilterSelection.length + ' selected' : displayValues}`
        }];
      });
    } else {
      setMultiSelectFilters(prev => {
        const newFilters = { ...prev };
        delete newFilters[field];
        return newFilters;
      });
      setAppliedFilters(prev => prev.filter(f => f.field !== field));
    }
    closeFilterPopover();
  }

  function getDatePreset(preset: string): { start: string, end: string } {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (preset) {
      case "This Week":
        start.setDate(now.getDate() - now.getDay());
        end.setDate(start.getDate() + 6);
        break;
      case "Last Week":
        start.setDate(now.getDate() - now.getDay() - 7);
        end.setDate(start.getDate() + 6);
        break;
      case "Next Week":
        start.setDate(now.getDate() - now.getDay() + 7);
        end.setDate(start.getDate() + 6);
        break;
      case "This Month":
        start.setDate(1);
        end.setMonth(now.getMonth() + 1, 0);
        break;
      case "Last Month":
        start.setMonth(now.getMonth() - 1, 1);
        end.setMonth(now.getMonth(), 0);
        break;
      case "Next Year":
        start.setFullYear(now.getFullYear() + 1, 0, 1);
        end.setFullYear(now.getFullYear() + 1, 11, 31);
        break;
      default:
        return { start: now.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }

  function getNameByCode(array: any[], code: string) {
    return array.find(item => item.code === code)?.name || code;
  }

  // Export to Excel
  function exportToExcel() {
    try {
      const columnMap: Record<string, string> = {
        actions: "Actions",
        scope: "Scope",
        impact: "Impact",
        type: "Type",
        input_date: "Input Date",
        invoice_date: "Invoice Date",
        benefit_date: "Benefit Date",
        due_date: "Due Date",
        schedule_date: "Schedule Date",
        provider: "Provider",
        description: "Description",
        invoice_number: "Invoice ID",
        amount: "Amount",
        currency: "Currency",
        financial_account: "Financial Account",
        cost_center: "Department",
        cost_type: "Cost Type",
        dep_cost_type: "Dep Cost Type",
        payment_status: "Payment Status",
        payment_method: "Payment Method",
        bank_account: "Bank Account",
        payment_date: "Payment Date"
      };

      const exportData = filteredInvoices.map(invoice => {
        const row: any = {};

        if (visibleColumns.has('scope')) row['Scope'] = getRecordScope(invoice);
        if (visibleColumns.has('impact')) {
          const impacts = [];
          if (invoice.dre_impact) impacts.push('DRE');
          if (invoice.cash_impact) impacts.push('Cash');
          if (invoice.is_intercompany) impacts.push('IC');
          row['Impact'] = impacts.join(', ');
        }
        if (visibleColumns.has('type')) row['Type'] = invoice.invoice_type;
        if (visibleColumns.has('input_date')) row['Input Date'] = invoice.input_date;
        if (visibleColumns.has('invoice_date')) row['Invoice Date'] = invoice.invoice_date;
        if (visibleColumns.has('benefit_date')) row['Benefit Date'] = invoice.benefit_date;
        if (visibleColumns.has('due_date')) row['Due Date'] = invoice.due_date || '';
        if (visibleColumns.has('schedule_date')) row['Schedule Date'] = invoice.schedule_date || '';
        if (visibleColumns.has('provider')) row['Provider'] = getNameByCode(providers, invoice.provider_code);
        if (visibleColumns.has('description')) row['Description'] = invoice.description;
        if (visibleColumns.has('invoice_number')) row['Invoice ID'] = invoice.invoice_number || '';
        if (visibleColumns.has('amount')) row['Amount'] = formatEuropeanNumber(invoice.invoice_amount * invoice.eur_exchange);
        if (visibleColumns.has('currency')) row['Currency'] = invoice.currency;
        if (visibleColumns.has('financial_account')) row['Financial Account'] = getNameByCode(financialAccounts, invoice.financial_account_code);
        if (visibleColumns.has('cost_center')) row['Department'] = invoice.cost_center_code ? getNameByCode(costCenters, invoice.cost_center_code) : '';
        if (visibleColumns.has('cost_type')) row['Cost Type'] = invoice.cost_type_code ? getNameByCode(costTypes, invoice.cost_type_code) : '';
        if (visibleColumns.has('dep_cost_type')) row['Dep Cost Type'] = invoice.dep_cost_type_code ? getNameByCode(depCostTypes, invoice.dep_cost_type_code) : '';
        if (visibleColumns.has('payment_status')) row['Payment Status'] = invoice.payment_status || '';
        if (visibleColumns.has('payment_method')) row['Payment Method'] = invoice.payment_method_code ? getNameByCode(paymentMethods, invoice.payment_method_code) : '';
        if (visibleColumns.has('bank_account')) row['Bank Account'] = invoice.bank_account_code ? getNameByCode(bankAccounts, invoice.bank_account_code) : '';
        if (visibleColumns.has('payment_date')) row['Payment Date'] = invoice.payment_date || '';

        return row;
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Invoices");
      XLSX.writeFile(wb, `invoices_${getCurrentDateForDB()}.xlsx`);

      toast({
        title: "Export Successful",
        description: `${exportData.length} invoices exported to Excel`,
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting to Excel",
        variant: "destructive",
      });
    }
  }

  // Export to PDF
  async function exportToPDF() {
    try {
      // Dynamic import to avoid SSR issues
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF('landscape');

      // Header
      doc.setFontSize(16);
      doc.text('Accounts Payable - Invoices', 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
      doc.text(`Total Records: ${filteredInvoices.length}`, 14, 27);

      // Table columns
      const columns: string[] = [];
      if (visibleColumns.has('scope')) columns.push('Scope');
      if (visibleColumns.has('impact')) columns.push('Impact');
      if (visibleColumns.has('type')) columns.push('Type');
      if (visibleColumns.has('input_date')) columns.push('Input Date');
      if (visibleColumns.has('invoice_date')) columns.push('Invoice Date');
      if (visibleColumns.has('benefit_date')) columns.push('Benefit Date');
      if (visibleColumns.has('due_date')) columns.push('Due Date');
      if (visibleColumns.has('schedule_date')) columns.push('Schedule Date');
      if (visibleColumns.has('provider')) columns.push('Provider');
      if (visibleColumns.has('description')) columns.push('Description');
      if (visibleColumns.has('invoice_number')) columns.push('Invoice ID');
      if (visibleColumns.has('amount')) columns.push('Amount');
      if (visibleColumns.has('currency')) columns.push('Currency');
      if (visibleColumns.has('financial_account')) columns.push('Financial Account');
      if (visibleColumns.has('cost_center')) columns.push('Department');
      if (visibleColumns.has('cost_type')) columns.push('Cost Type');
      if (visibleColumns.has('dep_cost_type')) columns.push('Dep Cost Type');
      if (visibleColumns.has('payment_status')) columns.push('Payment Status');
      if (visibleColumns.has('payment_method')) columns.push('Payment Method');
      if (visibleColumns.has('bank_account')) columns.push('Bank Account');
      if (visibleColumns.has('payment_date')) columns.push('Payment Date');

      // Table data
      const rows = filteredInvoices.map(invoice => {
        const row: string[] = [];

        if (visibleColumns.has('scope')) row.push(getRecordScope(invoice));
        if (visibleColumns.has('impact')) {
          const impacts = [];
          if (invoice.dre_impact) impacts.push('DRE');
          if (invoice.cash_impact) impacts.push('Cash');
          if (invoice.is_intercompany) impacts.push('IC');
          row.push(impacts.join(', '));
        }
        if (visibleColumns.has('type')) row.push(invoice.invoice_type);
        if (visibleColumns.has('input_date')) row.push(invoice.input_date);
        if (visibleColumns.has('invoice_date')) row.push(invoice.invoice_date);
        if (visibleColumns.has('benefit_date')) row.push(invoice.benefit_date);
        if (visibleColumns.has('due_date')) row.push(invoice.due_date || '');
        if (visibleColumns.has('schedule_date')) row.push(invoice.schedule_date || '');
        if (visibleColumns.has('provider')) row.push(getNameByCode(providers, invoice.provider_code));
        if (visibleColumns.has('description')) row.push((invoice.description || '').substring(0, 50));
        if (visibleColumns.has('invoice_number')) row.push(invoice.invoice_number || '');
        if (visibleColumns.has('amount')) row.push(formatEuropeanNumber(invoice.invoice_amount * invoice.eur_exchange));
        if (visibleColumns.has('currency')) row.push(invoice.currency);
        if (visibleColumns.has('financial_account')) row.push(getNameByCode(financialAccounts, invoice.financial_account_code).substring(0, 30));
        if (visibleColumns.has('cost_center')) row.push(invoice.cost_center_code ? getNameByCode(costCenters, invoice.cost_center_code).substring(0, 30) : '');
        if (visibleColumns.has('cost_type')) row.push(invoice.cost_type_code ? getNameByCode(costTypes, invoice.cost_type_code).substring(0, 30) : '');
        if (visibleColumns.has('dep_cost_type')) row.push(invoice.dep_cost_type_code ? getNameByCode(depCostTypes, invoice.dep_cost_type_code).substring(0, 30) : '');
        if (visibleColumns.has('payment_status')) row.push(invoice.payment_status || '');
        if (visibleColumns.has('payment_method')) row.push(invoice.payment_method_code ? getNameByCode(paymentMethods, invoice.payment_method_code) : '');
        if (visibleColumns.has('bank_account')) row.push(invoice.bank_account_code ? getNameByCode(bankAccounts, invoice.bank_account_code) : '');
        if (visibleColumns.has('payment_date')) row.push(invoice.payment_date || '');

        return row;
      });

      autoTable(doc, {
        head: [columns],
        body: rows,
        startY: 32,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [66, 66, 66], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 32 },
      });

      doc.save(`invoices_${getCurrentDateForDB()}.pdf`);

      toast({
        title: "Export Successful",
        description: `${filteredInvoices.length} invoices exported to PDF`,
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting to PDF. Make sure jspdf is installed.",
        variant: "destructive",
      });
    }
  }

  function toggleColumnVisibility(column: string) {
    setTempVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(column)) {
        newSet.delete(column);
      } else {
        newSet.add(column);
      }
      return newSet;
    });
  }

  function openColumnSelector() {
    setTempVisibleColumns(new Set(visibleColumns));
    setColumnSelectorOpen(true);
  }

  function confirmColumnSelection() {
    setVisibleColumns(new Set(tempVisibleColumns));
    setColumnSelectorOpen(false);
  }

  function cancelColumnSelection() {
    setTempVisibleColumns(new Set(visibleColumns));
    setColumnSelectorOpen(false);
  }

  function isColumnFiltered(field: string): boolean {
    return !!multiSelectFilters[field] || !!dateFilters[field] || (field === 'invoice_amount' && !!amountFilter);
  }

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field as SortField);
      setSortDirection("asc");
    }
  }

  function handleEdit(invoice: Invoice) {
    setEditingInvoice(invoice);
    setFormData({
      invoice_date: formatDateForInput(invoice.invoice_date),
      benefit_date: formatDateForInput(invoice.benefit_date),
      due_date: formatDateForInput(invoice.due_date) || "",
      schedule_date: formatDateForInput(invoice.schedule_date) || "",
      payment_date: formatDateForInput(invoice.payment_date) || "",
      invoice_type: invoice.invoice_type,
      entry_type: invoice.entry_type,
      financial_account_code: invoice.financial_account_code,
      invoice_amount: invoice.invoice_amount.toString(),
      currency: invoice.currency,
      paid_amount: invoice.paid_amount?.toString() || "",
      paid_currency: invoice.paid_currency || "",
      eur_exchange: invoice.eur_exchange.toString(),
      provider_code: invoice.provider_code,
      bank_account_code: invoice.bank_account_code || "",
      course_code: invoice.course_code || "",
      payment_method_code: invoice.payment_method_code || "",
      cost_type_code: invoice.cost_type_code || "",
      dep_cost_type_code: invoice.dep_cost_type_code || "",
      cost_center_code: invoice.cost_center_code || "",
      sub_department_code: invoice.sub_department_code || "",
      description: invoice.description || "",
      invoice_number: invoice.invoice_number || "",
      country_code: invoice.country_code,
      scope: getRecordScope(invoice),
      dre_impact: invoice.dre_impact,
      cash_impact: invoice.cash_impact,
      is_intercompany: invoice.is_intercompany,
      notes: invoice.notes || "",
    });
    setSidePanelOpen(true);
  }

  function handleTypeChange(type: InvoiceType) {
    let dre_impact = true;
    let cash_impact = true;

    if (type === "BUDGET") {
      dre_impact = false;
      cash_impact = false;
    } else if (type === "ADJUSTMENT") {
      dre_impact = false;
      cash_impact = true;
    }

    setFormData({ ...formData, invoice_type: type, dre_impact, cash_impact });
  }

  function handleCountryChange(countryCode: string) {
    const country = COUNTRIES.find(c => c.code === countryCode);
    const defaultCurrency = country?.defaultCurrency || "EUR";
    setFormData({
      ...formData,
      country_code: countryCode,
      currency: defaultCurrency,
      eur_exchange: defaultCurrency === "EUR" ? "1.00" : formData.eur_exchange
    });
  }

  function handleScopeChange(_scope: ScopeType) {
    // Scope is managed by global context, no local state needed
  }

  function handleFormScopeChange(scope: ScopeType) {
    setFormData({ ...formData, scope });
  }

  const filteredInvoices = useMemo(() => {
    let filtered = invoices;

    // Filter by global scope (from sidebar)
    if (selectedScope === "ES") {
      filtered = filtered.filter(inv => inv.scope === "ES");
    } else if (selectedScope === "US") {
      filtered = filtered.filter(inv => inv.scope === "US");
    } else if (selectedScope === "GLOBAL") {
      // GLOBAL mostra ES + US consolidado (não há invoices com scope=GLOBAL)
      filtered = filtered.filter(inv => inv.scope === "ES" || inv.scope === "US");
    }

    // Filter by type
    if (selectedType !== "ALL") {
      filtered = filtered.filter(inv => inv.invoice_type === selectedType);
    }

    // Filter by country
    if (selectedCountry !== "ALL") {
      filtered = filtered.filter(inv => inv.country_code === selectedCountry);
    }

    // Filter by column filters
    Object.entries(columnFilters).forEach(([field, value]) => {
      if (value) {
        filtered = filtered.filter(inv => (inv as any)[field] === value);
      }
    });

    // Filter by multi-select filters
    Object.entries(multiSelectFilters).forEach(([field, values]) => {
      if (values && values.length > 0) {
        filtered = filtered.filter(inv => values.includes((inv as any)[field]));
      }
    });

    // Filter by date ranges
    Object.entries(dateFilters).forEach(([field, range]) => {
      if (range.start || range.end) {
        filtered = filtered.filter(inv => {
          const invDate = (inv as any)[field];
          if (!invDate) return false;
          if (range.start && invDate < range.start) return false;
          if (range.end && invDate > range.end) return false;
          return true;
        });
      }
    });

    // Filter by amount
    if (amountFilter) {
      filtered = filtered.filter(inv => {
        const amount = inv.invoice_amount * inv.eur_exchange;
        switch (amountFilter.operator) {
          case 'lt': return amount < amountFilter.value1;
          case 'gt': return amount > amountFilter.value1;
          case 'eq': return Math.abs(amount - amountFilter.value1) < 0.01;
          case 'between': return amount >= amountFilter.value1 && amount <= (amountFilter.value2 || amountFilter.value1);
          default: return true;
        }
      });
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        inv =>
          inv.invoice_number?.toLowerCase().includes(search) ||
          inv.provider_code?.toLowerCase().includes(search) ||
          inv.description?.toLowerCase().includes(search) ||
          inv.financial_account_code?.toLowerCase().includes(search)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === "invoice_date") {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [invoices, selectedType, selectedCountry, searchTerm, sortField, sortDirection, selectedScope, columnFilters, multiSelectFilters, dateFilters, amountFilter]);

  // Separate manual vs automatic invoices (BOT- prefix = automatic/BOTella)
  const manualInvoices = useMemo(() =>
    filteredInvoices.filter(inv => !inv.invoice_number?.startsWith("BOT-")),
    [filteredInvoices]
  );

  const automaticInvoices = useMemo(() =>
    filteredInvoices.filter(inv => inv.invoice_number?.startsWith("BOT-")),
    [filteredInvoices]
  );

  const stats = useMemo(() => {
    const incurred = invoices.filter(i => i.invoice_type === "INCURRED");
    const budget = invoices.filter(i => i.invoice_type === "BUDGET");
    const adjustments = invoices.filter(i => i.invoice_type === "ADJUSTMENT");

    return {
      incurred: {
        count: incurred.length,
        total: incurred.reduce((sum, i) => sum + (i.invoice_amount * i.eur_exchange), 0)
      },
      budget: {
        count: budget.length,
        total: budget.reduce((sum, i) => sum + (i.invoice_amount * i.eur_exchange), 0)
      },
      adjustments: {
        count: adjustments.length,
        total: adjustments.reduce((sum, i) => sum + (i.invoice_amount * i.eur_exchange), 0)
      }
    };
  }, [invoices]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1e1f21] px-6 py-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Fixed Header and Cards - Dark Theme */}
      <div className="min-h-screen bg-[#1e1f21] text-white px-6 py-6 pb-0">
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-white">Invoices</h1>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400 text-sm">{SCOPE_CONFIG[selectedScope].label}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              disabled={selectedScope === "GLOBAL"}
              variant="outline"
              className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
              onClick={() => {
                setEditingInvoice(null);
                resetForm();
                setSidePanelOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Invoice
            </Button>
            {selectedScope === "GLOBAL" && (
              <p className="text-xs text-gray-500">
                Switch to ES or US to create invoices
              </p>
            )}
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogContent className="max-w-none max-h-[90vh] overflow-y-auto bg-white p-8" style={{ width: '80vw' }}>
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="text-2xl">{editingInvoice ? "Edit Invoice" : "Create New Invoice"}</DialogTitle>
                <DialogDescription className="text-base mt-2">
                  {editingInvoice ? "Update invoice details" : "Add a new financial entry to accounts payable"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-8 pt-6">
                {/* Invoice Type Selection */}
                <div className="space-y-3">
                  <Label className="text-base">Invoice Type *</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(INVOICE_TYPE_CONFIG).map(([type, config]) => {
                      const Icon = config.icon;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleTypeChange(type as InvoiceType)}
                          className={`p-4 border-2 rounded-lg text-left transition-all ${formData.invoice_type === type
                            ? config.color
                            : "border-gray-200 hover:border-gray-300"
                            }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className="h-4 w-4" />
                            <span className="font-semibold text-sm">{config.label}</span>
                          </div>
                          <p className="text-xs opacity-75">{config.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dates Row */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="invoice_date">Invoice Date *</Label>
                    <Input
                      id="invoice_date"
                      type="date"
                      value={formData.invoice_date}
                      onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                      required
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="benefit_date">Benefit Date *</Label>
                    <Input
                      id="benefit_date"
                      type="date"
                      value={formData.benefit_date}
                      onChange={(e) => setFormData({ ...formData, benefit_date: e.target.value })}
                      required
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Due & Schedule Dates */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Due Date *</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => {
                        const newDueDate = e.target.value;
                        setFormData({
                          ...formData,
                          due_date: newDueDate,
                          schedule_date: formData.schedule_date || newDueDate
                        });
                      }}
                      required
                      className="h-10"
                    />
                    <p className="text-xs text-muted-foreground">Invoice due date</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule_date">Schedule Date *</Label>
                    <Input
                      id="schedule_date"
                      type="date"
                      value={formData.schedule_date}
                      onChange={(e) => setFormData({ ...formData, schedule_date: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Defaults to Due Date</p>
                  </div>
                </div>

                {/* Scope & Invoice Number */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="scope">Scope (Country) *</Label>
                    <Select
                      value={formData.scope}
                      onValueChange={(val) => setFormData({ ...formData, scope: val as ScopeType, country_code: val })}
                      required
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="ES">
                          <span className="flex items-center gap-2">
                            <span>🇪🇸</span>
                            <span>Spain (EUR)</span>
                          </span>
                        </SelectItem>
                        <SelectItem value="US">
                          <span className="flex items-center gap-2">
                            <span>🇺🇸</span>
                            <span>United States (USD)</span>
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Company location, not invoice currency
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice_number">
                      Invoice Number
                      {!editingInvoice && <span className="text-xs text-gray-500 ml-1">(auto-generated if empty)</span>}
                    </Label>
                    <Input
                      id="invoice_number"
                      value={formData.invoice_number}
                      onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                      placeholder={editingInvoice ? "INV-2024-001" : "Leave empty for auto-generation"}
                    />
                    {!editingInvoice && (
                      <p className="text-xs text-gray-500 mt-1">
                        Format: {formData.scope}-INV-YYYYMM-0001
                      </p>
                    )}
                  </div>
                </div>

                {/* Provider & Financial Account */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="provider_code">Provider *</Label>
                    <Select value={formData.provider_code} onValueChange={(val) => setFormData({ ...formData, provider_code: val })} required>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent className="bg-white max-h-[300px]">
                        {providers.map((provider) => (
                          <SelectItem key={provider.code} value={provider.code}>{provider.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="financial_account_code">Financial Account *</Label>
                    <Select value={formData.financial_account_code} onValueChange={(val) => setFormData({ ...formData, financial_account_code: val })} required>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent className="bg-white max-h-[300px]">
                        {financialAccounts
                          .filter(acc => acc.level >= 2)
                          .map((account) => (
                            <SelectItem key={account.code} value={account.code} className="cursor-pointer hover:bg-gray-100">{account.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Amount & Currency */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="invoice_amount">Amount *</Label>
                    <Input
                      id="invoice_amount"
                      type="number"
                      step="0.01"
                      value={formData.invoice_amount}
                      onChange={(e) => setFormData({ ...formData, invoice_amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency *</Label>
                    <Select value={formData.currency} onValueChange={(val) => setFormData({ ...formData, currency: val })}>
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="BRL">BRL - Brazilian Real</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Invoice currency (can differ from company country)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eur_exchange">EUR Exchange Rate</Label>
                    <Input
                      id="eur_exchange"
                      type="number"
                      step="0.000001"
                      value={formData.eur_exchange}
                      onChange={(e) => setFormData({ ...formData, eur_exchange: e.target.value })}
                    />
                  </div>
                </div>

                {/* Paid Amount & Paid Currency */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="paid_amount">Paid Amount</Label>
                    <Input
                      id="paid_amount"
                      type="number"
                      step="any"
                      value={formData.paid_amount}
                      onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paid_currency">Paid Currency</Label>
                    <Select value={formData.paid_currency} onValueChange={(val) => setFormData({ ...formData, paid_currency: val })}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="BRL">BRL - Brazilian Real</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_date">Payment Date</Label>
                    <Input
                      id="payment_date"
                      type="date"
                      value={formData.payment_date}
                      onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    />
                  </div>
                </div>

                {/* Cost Type, Dep Cost Type, Department & Sub-Department */}
                <div className="grid grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="cost_type_code">Cost Type *</Label>
                    <Select value={formData.cost_type_code} onValueChange={(val) => setFormData({ ...formData, cost_type_code: val })} required>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select cost type" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {costTypes.map((type) => (
                          <SelectItem key={type.code} value={type.code}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dep_cost_type_code">Dep Cost Type *</Label>
                    <Select value={formData.dep_cost_type_code} onValueChange={(val) => setFormData({ ...formData, dep_cost_type_code: val })} required>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select dep cost type" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {depCostTypes.map((type) => (
                          <SelectItem key={type.code} value={type.code}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost_center_code">Department *</Label>
                    <Select value={formData.cost_center_code} onValueChange={(val) => setFormData({ ...formData, cost_center_code: val, sub_department_code: "" })} required>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {costCenters.map((center) => (
                          <SelectItem key={center.code} value={center.code}>
                            {center.code} - {center.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sub_department_code">Sub-Department</Label>
                    <Select
                      value={formData.sub_department_code}
                      onValueChange={(val) => setFormData({ ...formData, sub_department_code: val })}
                      disabled={!formData.cost_center_code}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select sub-department" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {subDepartments
                          .filter(sd => sd.parent_department_code === formData.cost_center_code)
                          .map((sd) => (
                            <SelectItem key={sd.code} value={sd.code}>
                              {sd.code} - {sd.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="bank_account_code">Bank Account</Label>
                    <Select value={formData.bank_account_code} onValueChange={(val) => setFormData({ ...formData, bank_account_code: val })}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select bank account" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {bankAccounts.map((account) => (
                          <SelectItem key={account.code} value={account.code}>{account.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_method_code">Payment Method</Label>
                    <Select value={formData.payment_method_code} onValueChange={(val) => setFormData({ ...formData, payment_method_code: val })}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {paymentMethods.map((method) => (
                          <SelectItem key={method.code} value={method.code}>{method.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="course_code">Course</Label>
                    <Select value={formData.course_code} onValueChange={(val) => setFormData({ ...formData, course_code: val })}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select course" />
                      </SelectTrigger>
                      <SelectContent className="bg-white max-h-[300px]">
                        {courses.map((course) => (
                          <SelectItem key={course.code} value={course.code}>{course.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Description & Notes */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    placeholder="Invoice description..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Internal Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    placeholder="Internal notes (not visible to providers)..."
                  />
                </div>

                {/* Impact Flags */}
                <div className="space-y-3 pt-2">
                  <Label>Financial Impact</Label>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="dre_impact"
                        checked={formData.dre_impact}
                        onCheckedChange={(checked) => setFormData({ ...formData, dre_impact: checked as boolean })}
                      />
                      <Label htmlFor="dre_impact" className="font-normal cursor-pointer">
                        Impacts Income Statement (DRE)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="cash_impact"
                        checked={formData.cash_impact}
                        onCheckedChange={(checked) => setFormData({ ...formData, cash_impact: checked as boolean })}
                      />
                      <Label htmlFor="cash_impact" className="font-normal cursor-pointer">
                        Impacts Cash Flow
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_intercompany"
                        checked={formData.is_intercompany}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_intercompany: checked as boolean })}
                      />
                      <Label htmlFor="is_intercompany" className="font-normal cursor-pointer">
                        Intercompany Transaction
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className={editingInvoice ? "bg-green-600 hover:bg-green-700" : ""}>
                    {submitting ? "Saving..." : editingInvoice ? "Update Invoice" : "Create Invoice"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Provider Creation Dialog */}
          <Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
            <DialogContent className="max-w-none max-h-[90vh] bg-white" style={{ width: '80vw' }}>
              <DialogHeader>
                <DialogTitle>Create New Provider</DialogTitle>
                <DialogDescription>Add a new provider to the system</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createNewProvider(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-provider-code">Code *</Label>
                    <Input
                      id="new-provider-code"
                      value={newProviderData.code}
                      onChange={(e) => setNewProviderData({ ...newProviderData, code: e.target.value })}
                      placeholder="DSD-ES-AP-PV0001"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-provider-name">Name *</Label>
                    <Input
                      id="new-provider-name"
                      value={newProviderData.name}
                      onChange={(e) => setNewProviderData({ ...newProviderData, name: e.target.value })}
                      placeholder="Provider Name"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-provider-country">Country *</Label>
                    <Select
                      value={newProviderData.country}
                      onValueChange={(val) => setNewProviderData({ ...newProviderData, country: val })}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="ES">Spain</SelectItem>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="BR">Brazil</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-provider-currency">Currency *</Label>
                    <Select
                      value={newProviderData.currency}
                      onValueChange={(val) => setNewProviderData({ ...newProviderData, currency: val })}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="BRL">BRL - Brazilian Real</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-provider-email">Email</Label>
                    <Input
                      id="new-provider-email"
                      type="email"
                      value={newProviderData.email}
                      onChange={(e) => setNewProviderData({ ...newProviderData, email: e.target.value })}
                      placeholder="provider@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-provider-payment-terms">Payment Terms</Label>
                    <Input
                      id="new-provider-payment-terms"
                      value={newProviderData.payment_terms}
                      onChange={(e) => setNewProviderData({ ...newProviderData, payment_terms: e.target.value })}
                      placeholder="Net 30"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setProviderDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Create Provider
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Financial Account Creation Dialog */}
          <Dialog open={financialAccountDialogOpen} onOpenChange={setFinancialAccountDialogOpen}>
            <DialogContent className="max-w-none max-h-[90vh] bg-white" style={{ width: '80vw' }}>
              <DialogHeader>
                <DialogTitle>Create New Financial Account</DialogTitle>
                <DialogDescription>Add a new account to the chart of accounts</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createNewFinancialAccount(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-account-code">Code *</Label>
                    <Input
                      id="new-account-code"
                      value={newAccountData.code}
                      onChange={(e) => setNewAccountData({ ...newAccountData, code: e.target.value })}
                      placeholder="201.5"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-account-name">Name *</Label>
                    <Input
                      id="new-account-name"
                      value={newAccountData.name}
                      onChange={(e) => setNewAccountData({ ...newAccountData, name: e.target.value })}
                      placeholder="Account Name"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-account-type">Type *</Label>
                    <Select
                      value={newAccountData.type}
                      onValueChange={(val) => setNewAccountData({ ...newAccountData, type: val })}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="Expense">Expense</SelectItem>
                        <SelectItem value="Revenue">Revenue</SelectItem>
                        <SelectItem value="Asset">Asset</SelectItem>
                        <SelectItem value="Liability">Liability</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-account-level">Level *</Label>
                    <Input
                      id="new-account-level"
                      type="number"
                      min="1"
                      max="5"
                      value={newAccountData.level}
                      onChange={(e) => setNewAccountData({ ...newAccountData, level: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-account-parent">Parent Code</Label>
                    <Input
                      id="new-account-parent"
                      value={newAccountData.parent_code}
                      onChange={(e) => setNewAccountData({ ...newAccountData, parent_code: e.target.value })}
                      placeholder="201.0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Scope *</Label>
                  <ScopeSelector
                    value={newAccountData.scope}
                    onValueChange={(scope: ScopeType) => setNewAccountData({ ...newAccountData, scope })}
                    label=""
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setFinancialAccountDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Create Account
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Split Invoice Configuration Dialog */}
          <Dialog open={splitDialogOpen} onOpenChange={setSplitDialogOpen}>
            <DialogContent className="max-w-none max-h-[90vh] overflow-y-auto bg-white" style={{ width: '80vw' }}>
              <DialogHeader>
                <DialogTitle>Split Invoice</DialogTitle>
                <DialogDescription>
                  Divide this invoice into multiple parts by installments or by dimensions
                </DialogDescription>
              </DialogHeader>

              {splitInvoice && (
                <div className="space-y-4">
                  {/* Original Invoice Info */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold mb-2">Original Invoice</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Invoice:</span> {splitInvoice.invoice_number}</div>
                      <div><span className="text-muted-foreground">Provider:</span> {providers.find(p => p.code === splitInvoice.provider_code)?.name}</div>
                      <div><span className="text-muted-foreground">Amount:</span> {formatEuropeanNumber(splitInvoice.amount)}</div>
                      <div><span className="text-muted-foreground">Due Date:</span> {splitInvoice.due_date ? new Date(splitInvoice.due_date).toLocaleDateString('pt-BR') : '-'}</div>
                    </div>
                  </div>

                  {/* Split Type Selection */}
                  <div className="space-y-2">
                    <Label>Split Type</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="split-installments"
                          checked={splitConfig.type === 'installments'}
                          onChange={() => setSplitConfig({ ...splitConfig, type: 'installments', installments: 2, splits: [] })}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="split-installments" className="cursor-pointer">
                          Split by Installments (Monthly)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="split-financial-account"
                          checked={splitConfig.type === 'financial_account'}
                          onChange={() => setSplitConfig({ ...splitConfig, type: 'financial_account', installments: 1, splits: [] })}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="split-financial-account" className="cursor-pointer">
                          Split by Financial Account
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="split-cost-center"
                          checked={splitConfig.type === 'cost_center'}
                          onChange={() => setSplitConfig({ ...splitConfig, type: 'cost_center', installments: 1, splits: [] })}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="split-cost-center" className="cursor-pointer">
                          Split by Department
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="split-cost-type"
                          checked={splitConfig.type === 'cost_type'}
                          onChange={() => setSplitConfig({ ...splitConfig, type: 'cost_type', installments: 1, splits: [] })}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="split-cost-type" className="cursor-pointer">
                          Split by Cost Type
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="split-dep-cost-type"
                          checked={splitConfig.type === 'dep_cost_type'}
                          onChange={() => setSplitConfig({ ...splitConfig, type: 'dep_cost_type', installments: 1, splits: [] })}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="split-dep-cost-type" className="cursor-pointer">
                          Split by Department Cost Type
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Installments Selector (1-12) */}
                  {splitConfig.type === 'installments' && (
                    <div className="space-y-2">
                      <Label>Number of Installments</Label>
                      <Select
                        value={splitConfig.installments.toString()}
                        onValueChange={(value) => setSplitConfig({ ...splitConfig, installments: parseInt(value) })}
                      >
                        <option value="">Select...</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                          <option key={num} value={num.toString()}>
                            {num} {num === 1 ? 'installment' : 'installments'}
                          </option>
                        ))}
                      </Select>

                      {splitConfig.installments > 0 && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                          <h5 className="font-semibold mb-2">Preview</h5>
                          <div className="space-y-1 text-sm">
                            {Array.from({ length: splitConfig.installments }, (_, i) => {
                              const installmentAmount = splitInvoice.amount / splitConfig.installments;
                              const dueDate = new Date(splitInvoice.due_date || new Date());
                              dueDate.setMonth(dueDate.getMonth() + i);
                              return (
                                <div key={i} className="flex justify-between">
                                  <span>Installment {i + 1}/{splitConfig.installments}:</span>
                                  <span className="font-mono">{formatEuropeanNumber(installmentAmount)} - Due: {dueDate.toLocaleDateString('pt-BR')}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dimension Split Configuration */}
                  {splitConfig.type !== 'installments' && (
                    <div className="space-y-2">
                      <Label>Split Configuration</Label>
                      <p className="text-sm text-muted-foreground">
                        Add multiple splits by selecting different {splitConfig.type.replace('_', ' ')}s and specifying amounts or percentages.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSplitConfig({
                            ...splitConfig,
                            splits: [
                              ...splitConfig.splits,
                              {
                                financial_account_code: splitConfig.type === 'financial_account' ? '' : (splitInvoice.financial_account_code || ''),
                                cost_center_code: splitConfig.type === 'cost_center' ? '' : (splitInvoice.cost_center_code || ''),
                                cost_type_code: splitConfig.type === 'cost_type' ? '' : (splitInvoice.cost_type_code || ''),
                                dep_cost_type_code: splitConfig.type === 'dep_cost_type' ? '' : (splitInvoice.dep_cost_type_code || ''),
                                amount: 0,
                                percentage: 0
                              }
                            ]
                          });
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Split
                      </Button>

                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {splitConfig.splits.map((split, index) => (
                          <div key={index} className="p-3 border rounded-lg space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-sm">Split {index + 1}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSplitConfig({
                                    ...splitConfig,
                                    splits: splitConfig.splits.filter((_, i) => i !== index)
                                  });
                                }}
                                className="h-6 w-6 p-0 text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>

                            {splitConfig.type === 'financial_account' && (
                              <Select
                                value={split.financial_account_code || ''}
                                onValueChange={(value) => {
                                  const newSplits = [...splitConfig.splits];
                                  newSplits[index].financial_account_code = value;
                                  setSplitConfig({ ...splitConfig, splits: newSplits });
                                }}
                              >
                                <option value="">Select Financial Account...</option>
                                {financialAccounts.filter(acc => acc.level >= 2).map(acc => (
                                  <option key={acc.code} value={acc.code}>{acc.name}</option>
                                ))}
                              </Select>
                            )}

                            {splitConfig.type === 'cost_center' && (
                              <Select
                                value={split.cost_center_code || ''}
                                onValueChange={(value) => {
                                  const newSplits = [...splitConfig.splits];
                                  newSplits[index].cost_center_code = value;
                                  setSplitConfig({ ...splitConfig, splits: newSplits });
                                }}
                              >
                                <option value="">Select Department...</option>
                                {costCenters.map(cc => (
                                  <option key={cc.code} value={cc.code}>{cc.name}</option>
                                ))}
                              </Select>
                            )}

                            {splitConfig.type === 'cost_type' && (
                              <Select
                                value={split.cost_type_code || ''}
                                onValueChange={(value) => {
                                  const newSplits = [...splitConfig.splits];
                                  newSplits[index].cost_type_code = value;
                                  setSplitConfig({ ...splitConfig, splits: newSplits });
                                }}
                              >
                                <option value="">Select Cost Type...</option>
                                {costTypes.map(ct => (
                                  <option key={ct.code} value={ct.code}>{ct.name}</option>
                                ))}
                              </Select>
                            )}

                            {splitConfig.type === 'dep_cost_type' && (
                              <Select
                                value={split.dep_cost_type_code || ''}
                                onValueChange={(value) => {
                                  const newSplits = [...splitConfig.splits];
                                  newSplits[index].dep_cost_type_code = value;
                                  setSplitConfig({ ...splitConfig, splits: newSplits });
                                }}
                              >
                                <option value="">Select Department Cost Type...</option>
                                {depCostTypes.map(dct => (
                                  <option key={dct.code} value={dct.code}>{dct.name}</option>
                                ))}
                              </Select>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Amount</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={split.amount}
                                  onChange={(e) => {
                                    const newSplits = [...splitConfig.splits];
                                    const amount = parseFloat(e.target.value) || 0;
                                    newSplits[index].amount = amount;
                                    newSplits[index].percentage = (amount / splitInvoice.amount) * 100;
                                    setSplitConfig({ ...splitConfig, splits: newSplits });
                                  }}
                                  className="h-8"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Percentage</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={split.percentage.toFixed(2)}
                                  onChange={(e) => {
                                    const newSplits = [...splitConfig.splits];
                                    const percentage = parseFloat(e.target.value) || 0;
                                    newSplits[index].percentage = percentage;
                                    newSplits[index].amount = (splitInvoice.amount * percentage) / 100;
                                    setSplitConfig({ ...splitConfig, splits: newSplits });
                                  }}
                                  className="h-8"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {splitConfig.splits.length > 0 && (
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="flex justify-between text-sm font-semibold">
                            <span>Total:</span>
                            <span className={splitConfig.splits.reduce((sum, s) => sum + s.amount, 0) !== splitInvoice.amount ? 'text-destructive' : 'text-green-600'}>
                              {formatEuropeanNumber(splitConfig.splits.reduce((sum, s) => sum + s.amount, 0))} / {formatEuropeanNumber(splitInvoice.amount)}
                            </span>
                          </div>
                          {splitConfig.splits.reduce((sum, s) => sum + s.amount, 0) !== splitInvoice.amount && (
                            <p className="text-xs text-destructive mt-1">
                              Total must equal the original invoice amount
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setSplitDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSplitInvoice}>
                      <Split className="h-4 w-4 mr-2" />
                      Create Splits
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* View Splits Dialog */}
          <Dialog open={viewSplitsDialogOpen} onOpenChange={setViewSplitsDialogOpen}>
            <DialogContent className="max-w-none max-h-[90vh] overflow-y-auto bg-white" style={{ width: '80vw' }}>
              <DialogHeader>
                <DialogTitle>Split Invoice Details</DialogTitle>
                <DialogDescription>
                  View all parts of this split invoice
                </DialogDescription>
              </DialogHeader>

              {viewingSplitInvoice && (
                <div className="space-y-4">
                  {/* Original/Parent Invoice */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold mb-2">
                      {viewingSplitInvoice.parent_invoice_id ? 'Parent Invoice' : 'Original Invoice'}
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Invoice:</span> {viewingSplitInvoice.invoice_number}</div>
                      <div><span className="text-muted-foreground">Provider:</span> {providers.find(p => p.code === viewingSplitInvoice.provider_code)?.name}</div>
                      <div><span className="text-muted-foreground">Amount:</span> {formatEuropeanNumber(viewingSplitInvoice.amount)}</div>
                      <div><span className="text-muted-foreground">Split Type:</span> {viewingSplitInvoice.split_type || 'Installments'}</div>
                    </div>
                  </div>

                  {/* Split Parts */}
                  <div className="space-y-2">
                    <h4 className="font-semibold">Split Parts ({viewingSplitInvoice.total_splits || 0})</h4>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {invoices
                        .filter(inv =>
                          inv.parent_invoice_id === (viewingSplitInvoice.parent_invoice_id || viewingSplitInvoice.id)
                        )
                        .sort((a, b) => (a.split_number || 0) - (b.split_number || 0))
                        .map(splitPart => (
                          <div key={splitPart.id} className="p-3 border rounded-lg hover:bg-muted/50">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    Part {splitPart.split_number}/{splitPart.total_splits}
                                  </Badge>
                                  <span className="font-medium">{splitPart.invoice_number}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                                  <div>Amount: {formatEuropeanNumber(splitPart.amount)}</div>
                                  <div>Due: {splitPart.due_date ? new Date(splitPart.due_date).toLocaleDateString('pt-BR') : '-'}</div>
                                  <div>Status: {splitPart.is_reconciled ? 'Reconciled' : 'Pending'}</div>
                                </div>
                                {splitPart.financial_account_code !== viewingSplitInvoice.financial_account_code && (
                                  <div className="text-xs">
                                    <Badge variant="outline" className="text-[10px]">
                                      {financialAccounts.find(a => a.code === splitPart.financial_account_code)?.name}
                                    </Badge>
                                  </div>
                                )}
                                {splitPart.cost_center_code !== viewingSplitInvoice.cost_center_code && (
                                  <div className="text-xs">
                                    <Badge variant="outline" className="text-[10px]">
                                      {costCenters.find(c => c.code === splitPart.cost_center_code)?.name}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingInvoice(splitPart);
                                  setFormData({
                                    invoice_number: splitPart.invoice_number || "",
                                    provider_code: splitPart.provider_code,
                                    invoice_date: splitPart.invoice_date,
                                    invoice_amount: splitPart.amount.toString(),
                                    currency: splitPart.currency,
                                    financial_account_code: splitPart.financial_account_code,
                                    cost_center_code: splitPart.cost_center_code || "",
                                    cost_type_code: splitPart.cost_type_code || "",
                                    dep_cost_type_code: splitPart.dep_cost_type_code || "",
                                    sub_department_code: splitPart.sub_department_code || "",
                                    bank_account_code: splitPart.bank_account_code || "",
                                    payment_method_code: splitPart.payment_method_code || "",
                                    entry_type: splitPart.entry_type,
                                    invoice_type: splitPart.invoice_type,
                                    description: splitPart.description || "",
                                    scope: (splitPart.scope as ScopeType) || "ES",
                                    due_date: splitPart.due_date || "",
                                    schedule_date: splitPart.schedule_date || splitPart.due_date || "",
                                    benefit_date: splitPart.benefit_date,
                                    payment_date: splitPart.payment_date || "",
                                    eur_exchange: splitPart.eur_exchange.toString(),
                                    country_code: splitPart.country_code,
                                    dre_impact: splitPart.dre_impact,
                                    cash_impact: splitPart.cash_impact,
                                    is_intercompany: splitPart.is_intercompany,
                                    notes: splitPart.notes || "",
                                    course_code: splitPart.course_code || "",
                                    paid_amount: splitPart.paid_amount?.toString() || "",
                                    paid_currency: splitPart.paid_currency || ""
                                  });
                                  setViewSplitsDialogOpen(false);
                                  setSidePanelOpen(true);
                                }}
                                className="h-8"
                              >
                                <Edit2 className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>

                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Total of all splits:</span>
                        <span className="text-green-600">
                          {formatEuropeanNumber(
                            invoices
                              .filter(inv => inv.parent_invoice_id === (viewingSplitInvoice.parent_invoice_id || viewingSplitInvoice.id))
                              .reduce((sum, inv) => sum + inv.amount, 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button onClick={() => setViewSplitsDialogOpen(false)}>
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {/* Select Columns */}
            <Dialog open={columnSelectorOpen} onOpenChange={(open) => {
              if (open) {
                openColumnSelector();
              } else {
                cancelColumnSelection();
              }
            }}>
              <DialogTrigger asChild>
                <Button
                  variant={columnSelectorOpen ? "default" : "outline"}
                  size="sm"
                  onClick={openColumnSelector}
                  className={`relative overflow-visible ${columnSelectorOpen ? 'bg-[#243140] hover:bg-[#1a2530] text-white' : ''}`}
                >
                  <Columns3 className="h-4 w-4 mr-2" />
                  Select Columns
                  {visibleColumns.size < 23 && (
                    <>
                      <span
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const allColumns = new Set(['actions', 'split', 'scope', 'impact', 'type', 'input_date', 'invoice_date', 'benefit_date', 'due_date', 'schedule_date', 'provider', 'description', 'invoice_number', 'amount', 'currency', 'financial_account', 'cost_center', 'cost_type', 'dep_cost_type', 'payment_status', 'payment_method', 'bank_account', 'payment_date']);
                          setVisibleColumns(allColumns);
                        }}
                        className="absolute -top-2 -left-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white z-10 cursor-pointer"
                        title="Clear column filter (show all)"
                      >
                        <X className="h-3 w-3" />
                      </span>
                      <span className="absolute -top-2 -right-2 bg-[#243140] text-white text-[10px] font-bold rounded-full min-w-[28px] h-5 px-1.5 flex items-center justify-center border-2 border-white whitespace-nowrap">
                        {visibleColumns.size}/23
                      </span>
                    </>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-white">
                <DialogHeader>
                  <DialogTitle>Select Visible Columns</DialogTitle>
                  <DialogDescription>
                    Choose which columns to display in the table
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {[
                    { id: 'actions', label: 'Actions' },
                    { id: 'split', label: 'Split Status' },
                    { id: 'scope', label: 'Scope' },
                    { id: 'impact', label: 'Impact' },
                    { id: 'type', label: 'Type' },
                    { id: 'input_date', label: 'Input Date' },
                    { id: 'invoice_date', label: 'Invoice Date' },
                    { id: 'benefit_date', label: 'Benefit Date' },
                    { id: 'due_date', label: 'Due Date' },
                    { id: 'schedule_date', label: 'Schedule Date' },
                    { id: 'provider', label: 'Provider' },
                    { id: 'description', label: 'Description' },
                    { id: 'invoice_number', label: 'Invoice ID' },
                    { id: 'amount', label: 'Amount' },
                    { id: 'currency', label: 'Currency' },
                    { id: 'financial_account', label: 'Financial Account' },
                    { id: 'cost_center', label: 'Department' },
                    { id: 'sub_department', label: 'Sub-Department' },
                    { id: 'cost_type', label: 'Cost Type' },
                    { id: 'dep_cost_type', label: 'Dep Cost Type' },
                    { id: 'payment_status', label: 'Payment Status' },
                    { id: 'payment_method', label: 'Payment Method' },
                    { id: 'bank_account', label: 'Bank Account' },
                    { id: 'payment_date', label: 'Payment Date' },
                  ].map(column => (
                    <div key={column.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={column.id}
                        checked={tempVisibleColumns.has(column.id)}
                        onCheckedChange={() => toggleColumnVisibility(column.id)}
                      />
                      <label
                        htmlFor={column.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {column.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allColumns = new Set(['actions', 'scope', 'impact', 'type', 'input_date', 'invoice_date', 'benefit_date', 'provider', 'description', 'invoice_number', 'amount', 'currency', 'financial_account', 'cost_center', 'cost_type', 'dep_cost_type', 'payment_status', 'payment_method', 'bank_account', 'payment_date']);
                      setTempVisibleColumns(allColumns);
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTempVisibleColumns(new Set(['actions']))}
                  >
                    Deselect All
                  </Button>
                  <div className="flex-1"></div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelColumnSelection}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={confirmColumnSelection}
                  >
                    Confirm
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Export to Excel */}
            <Button variant="outline" size="sm" onClick={exportToExcel} className="bg-transparent border-gray-600 text-white hover:bg-gray-700">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>

            {/* Export to PDF */}
            <Button variant="outline" size="sm" onClick={exportToPDF} className="bg-transparent border-gray-600 text-white hover:bg-gray-700">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-transparent border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Applied Filters */}
          {appliedFilters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {appliedFilters.map(filter => (
                <Badge key={filter.field} variant="secondary" className="gap-1 pr-1 bg-gray-700 text-gray-200">
                  {filter.label}
                  <button
                    onClick={() => removeFilter(filter.field)}
                    className="ml-1 hover:bg-gray-600 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-6 text-xs text-gray-400 hover:text-white"
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Table */}
        {error ? (
          <div className="text-center py-8 text-red-400">{error}</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No invoices found</p>
            <p className="text-sm">Create your first invoice to get started</p>
          </div>
        ) : (
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-[#2a2b2d] shadow-sm">
                  <tr className="border-b border-gray-700 bg-[#2a2b2d]">
                    {visibleColumns.has('actions') && (
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-300 bg-[#2a2b2d]">Actions</th>
                    )}
                    {visibleColumns.has('split') && (
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-300 bg-[#2a2b2d]">Split</th>
                    )}
                    {/* Created By column - between Split and Scope */}
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-300 w-14 bg-[#2a2b2d]" title="Created by user or BOTella automation">
                      Created
                    </th>
                    {visibleColumns.has('scope') && (
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center justify-center gap-1">
                          Scope
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('impact') && (
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center justify-center gap-1">
                          Impact
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('type') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleSort("invoice_type")} className="flex items-center gap-1 hover:text-primary">
                            Type
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => openFilterPopover("invoice_type", e)}
                            className="hover:text-primary"
                            title="Filter by Type"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('input_date') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleSort("input_date")} className="flex items-center gap-1 hover:text-primary">
                            Input Date
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => openFilterPopover("input_date", e)} className="hover:text-primary" title="Filter by Input Date">
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('invoice_date') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleSort("invoice_date")} className="flex items-center gap-1 hover:text-primary">
                            Invoice Date
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => openFilterPopover("invoice_date", e)} className="hover:text-primary" title="Filter by Invoice Date">
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('benefit_date') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleSort("benefit_date")} className="flex items-center gap-1 hover:text-primary">
                            Benefit Date
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => openFilterPopover("benefit_date", e)} className="hover:text-primary" title="Filter by Benefit Date">
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('due_date') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleSort("due_date")} className="flex items-center gap-1 hover:text-primary">
                            Due Date
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => openFilterPopover("due_date", e)} className="hover:text-primary" title="Filter by Due Date">
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('schedule_date') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleSort("schedule_date")} className="flex items-center gap-1 hover:text-primary">
                            Schedule Date
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => openFilterPopover("schedule_date", e)} className="hover:text-primary" title="Filter by Schedule Date">
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('provider') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleSort("provider_code")} className="flex items-center gap-1 hover:text-primary">
                            Provider
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => openFilterPopover("provider_code", e)}
                            className={`hover:text-primary ${isColumnFiltered('provider_code') ? 'text-green-600' : ''}`}
                            title="Filter by Provider"
                          >
                            <Filter className={`h-3 w-3 ${isColumnFiltered('provider_code') ? 'fill-green-600' : ''}`} />
                          </button>
                          {isColumnFiltered('provider_code') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFilter('provider_code');
                              }}
                              className="hover:text-destructive"
                              title="Clear filter"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('description') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center gap-1">
                          Description
                          <button
                            onClick={() => {
                              const value = prompt("Filter by Description:");
                              if (value) addColumnFilter("description", value, value);
                            }}
                            className="hover:text-primary"
                            title="Filter by Description"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('invoice_number') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleSort("invoice_number")} className="flex items-center gap-1 hover:text-primary">
                            Invoice ID
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => openFilterPopover("invoice_number", e)} className="hover:text-primary" title="Filter by Invoice ID">
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('amount') && (
                      <th className="px-2 py-1.5 text-right font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleSort("invoice_amount")} className="flex items-center gap-1 hover:text-primary ml-auto">
                            Amount
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => openFilterPopover("invoice_amount", e)}
                            className={`hover:text-primary ${isColumnFiltered('invoice_amount') ? 'text-green-600' : ''}`}
                            title="Filter by Amount"
                          >
                            <Filter className={`h-3 w-3 ${isColumnFiltered('invoice_amount') ? 'fill-green-600' : ''}`} />
                          </button>
                          {isColumnFiltered('invoice_amount') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFilter('invoice_amount');
                              }}
                              className="hover:text-destructive"
                              title="Clear filter"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('currency') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center gap-1">
                          Currency
                          <button onClick={(e) => openFilterPopover("currency", e)}
                            className="hover:text-primary"
                            title="Filter by Currency"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('financial_account') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center gap-1">
                          Financial Account
                          <button
                            onClick={(e) => openFilterPopover("financial_account_code", e)}
                            className="hover:text-primary"
                            title="Filter by Financial Account"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('cost_center') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center gap-1">
                          Department
                          <button onClick={(e) => openFilterPopover("cost_center_code", e)} className="hover:text-primary" title="Filter by Department">
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('sub_department') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center gap-1">
                          Sub-Department
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('cost_type') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center gap-1">
                          Cost Type
                          <button onClick={(e) => openFilterPopover("cost_type_code", e)} className="hover:text-primary" title="Filter by Cost Type">
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('dep_cost_type') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <div className="flex items-center gap-1">
                          Dep Cost Type
                          <button onClick={(e) => openFilterPopover("dep_cost_type_code", e)} className="hover:text-primary" title="Filter by Dep Cost Type">
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('payment_status') && (
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-300 bg-[#2a2b2d]">Payment Status</th>
                    )}
                    {visibleColumns.has('payment_method') && (
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-300 bg-[#2a2b2d]">Payment Method</th>
                    )}
                    {visibleColumns.has('bank_account') && (
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-300 bg-[#2a2b2d]">Bank Account</th>
                    )}
                    {visibleColumns.has('payment_date') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-300 bg-[#2a2b2d]">
                        <button onClick={() => handleSort("payment_date")} className="flex items-center gap-1 hover:text-primary">
                          Payment Date
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredInvoices.map((invoice) => {
                    const config = INVOICE_TYPE_CONFIG[invoice.invoice_type];
                    const Icon = config.icon;
                    const financialAccount = financialAccounts.find(a => a.code === invoice.financial_account_code);
                    const paymentStatus = invoice.payment_status || 'NOT_SCHEDULED';
                    const isBotInvoice = invoice.invoice_number?.startsWith('BOT-');

                    return (
                      <tr key={invoice.id} className="hover:bg-gray-800/50 group">
                        {/* Actions */}
                        {visibleColumns.has('actions') && (
                          <td className="px-2 py-1 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openSplitDialog(invoice)} className="h-6 w-6 p-0 hover:bg-gray-700" title="Split Invoice">
                                <Split className="h-3 w-3 text-blue-400" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(invoice)} className="h-6 w-6 p-0 hover:bg-gray-700">
                                <Edit2 className="h-3 w-3 text-gray-400" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(invoice)} className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-gray-700">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        )}

                        {/* Split Status */}
                        {visibleColumns.has('split') && (
                          <td className="px-2 py-1 text-center">
                            {invoice.is_split && invoice.parent_invoice_id && (
                              <Button variant="ghost" size="sm" onClick={() => viewSplits(invoice)} className="h-6 px-2 py-0 hover:bg-gray-700" title={`Part ${invoice.split_number}/${invoice.total_splits}`}>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-900/30 text-blue-400 border border-blue-700">
                                  {invoice.split_number}/{invoice.total_splits}
                                </Badge>
                              </Button>
                            )}
                            {invoice.is_split && !invoice.parent_invoice_id && (
                              <Button variant="ghost" size="sm" onClick={() => viewSplits(invoice)} className="h-6 px-2 py-0" title="View splits">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-900/30 text-green-400 border border-green-700 cursor-pointer hover:bg-green-900/50">
                                  <Eye className="h-3 w-3 mr-1 inline" />
                                  {invoice.total_splits}
                                </Badge>
                              </Button>
                            )}
                            {!invoice.is_split && (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        )}

                        {/* Created By - Manual (User) or Automatic (BOTella) */}
                        <td className="px-2 py-1 text-center">
                          {isBotInvoice ? (
                            <span title="Created automatically by BOTella" className="inline-flex items-center justify-center">
                              <Zap className="h-4 w-4 text-yellow-400" />
                            </span>
                          ) : (
                            <span title="Created manually by user" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-700">
                              <User className="h-3.5 w-3.5 text-gray-300" />
                            </span>
                          )}
                        </td>

                        {/* Scope */}
                        {visibleColumns.has('scope') && (
                          <td className="px-2 py-1 text-center">
                            <span
                              className="cursor-help inline-block"
                              title={SCOPE_CONFIG[getRecordScope(invoice) as ScopeType].description}
                            >
                              {getRecordScope(invoice) === ("ES" as ScopeType) && (
                                <Image src="/spain.svg" alt="Spain" width={20} height={15} className="rounded" />
                              )}
                              {getRecordScope(invoice) === ("US" as ScopeType) && (
                                <Image src="/united-states.svg" alt="USA" width={20} height={15} className="rounded" />
                              )}
                              {getRecordScope(invoice) === ("GLOBAL" as ScopeType) && (
                                <Image src="/globe.svg" alt="Global" width={18} height={18} className="rounded" />
                              )}
                            </span>
                          </td>
                        )}

                        {/* Impact */}
                        {visibleColumns.has('impact') && (
                          <td className="px-2 py-1">
                            <div className="flex gap-1 justify-center">
                              {invoice.dre_impact && <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-gray-700 text-gray-200">DRE</Badge>}
                              {invoice.cash_impact && <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-gray-700 text-gray-200">Cash</Badge>}
                              {invoice.is_intercompany && <Badge variant="outline" className="text-[10px] px-1 py-0 border-gray-600 text-gray-300">IC</Badge>}
                            </div>
                          </td>
                        )}

                        {/* Type */}
                        {visibleColumns.has('type') && (
                          <td className="px-2 py-1">
                            <Badge className={`text-[10px] px-1.5 py-0 ${config.color}`}>
                              {config.label}
                            </Badge>
                          </td>
                        )}

                        {/* Input Date */}
                        {visibleColumns.has('input_date') && (
                          <td className="px-2 py-1 text-[11px]">{new Date(invoice.input_date).toLocaleDateString('pt-BR')}</td>
                        )}

                        {/* Invoice Date */}
                        {visibleColumns.has('invoice_date') && (
                          <td className="px-2 py-1 text-[11px] font-medium">{new Date(invoice.invoice_date).toLocaleDateString('pt-BR')}</td>
                        )}

                        {/* Benefit Date */}
                        {visibleColumns.has('benefit_date') && (
                          <td className="px-2 py-1 text-[11px]">{new Date(invoice.benefit_date).toLocaleDateString('pt-BR')}</td>
                        )}

                        {/* Due Date */}
                        {visibleColumns.has('due_date') && (
                          <td className="px-2 py-1 text-[11px]">
                            {invoice.due_date ? (
                              <Badge variant={new Date(invoice.due_date) < new Date() ? "destructive" : "outline"} className="text-[10px] px-1.5 py-0">
                                {new Date(invoice.due_date).toLocaleDateString('pt-BR')}
                              </Badge>
                            ) : '-'}
                          </td>
                        )}

                        {/* Schedule Date */}
                        {visibleColumns.has('schedule_date') && (
                          <td className="px-2 py-1 text-[11px]">
                            {invoice.schedule_date ? new Date(invoice.schedule_date).toLocaleDateString('pt-BR') : '-'}
                          </td>
                        )}

                        {/* Provider */}
                        {visibleColumns.has('provider') && (
                          <td className="px-2 py-1 text-center group/cell relative">
                            {editingCell?.invoiceId === invoice.id && editingCell?.field === "provider_code" ? (
                              <div className="flex items-center gap-1">
                                <Select
                                  value={editValue}
                                  onValueChange={setEditValue}
                                >
                                  <SelectTrigger className="h-6 text-[10px] bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white max-h-[300px]">
                                    <div className="p-2 space-y-2 sticky top-0 bg-white border-b z-10">
                                      <Input
                                        placeholder="Search providers..."
                                        value={selectSearchTerm}
                                        onChange={(e) => setSelectSearchTerm(e.target.value)}
                                        className="h-7 text-xs"
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="w-full h-7 text-xs"
                                        onClick={() => {
                                          setProviderDialogOpen(true);
                                        }}
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add New Provider
                                      </Button>
                                    </div>
                                    <div className="max-h-[150px] overflow-y-auto">
                                      {providers
                                        .filter(p =>
                                          p.name.toLowerCase().includes(selectSearchTerm.toLowerCase()) ||
                                          p.code.toLowerCase().includes(selectSearchTerm.toLowerCase())
                                        )
                                        .map(p => (
                                          <SelectItem key={p.code} value={p.code} className="cursor-pointer hover:bg-gray-100">{p.name}</SelectItem>
                                        ))}
                                    </div>
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    saveInlineEdit(invoice.id, "provider_code");
                                  }}
                                  className="h-6 w-6 p-0 flex-shrink-0"
                                >
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    cancelInlineEdit();
                                  }}
                                  className="h-6 w-6 p-0 flex-shrink-0"
                                >
                                  <X className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white">
                                  {getNameByCode(providers, invoice.provider_code)}
                                </Badge>
                                <button
                                  onClick={() => startInlineEdit(invoice.id, "provider_code", invoice.provider_code)}
                                  className="opacity-0 group-hover/cell:opacity-100 transition-opacity"
                                >
                                  <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}

                        {/* Description */}
                        {visibleColumns.has('description') && (
                          <td className="px-2 py-1 group/cell relative">
                            {editingCell?.invoiceId === invoice.id && editingCell?.field === "description" ? (
                              <div className="flex items-center gap-1">
                                <Textarea
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="h-20 text-xs w-full"
                                  autoFocus
                                  onFocus={(e) => e.target.select()}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => saveInlineEdit(invoice.id, "description")}
                                  className="h-6 w-6 p-0"
                                >
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelInlineEdit}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <div className="text-[11px] max-w-xs truncate hover:whitespace-normal hover:absolute hover:bg-popover hover:border hover:p-2 hover:rounded hover:shadow-lg hover:z-10" title={invoice.description || ""}>
                                  {invoice.description || "-"}
                                </div>
                                <button
                                  onClick={() => startInlineEdit(invoice.id, "description", invoice.description)}
                                  className="opacity-0 group-hover/cell:opacity-100 transition-opacity flex-shrink-0"
                                >
                                  <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}

                        {/* Invoice ID */}
                        {visibleColumns.has('invoice_number') && (
                          <td className="px-2 py-1 group/cell relative">
                            {editingCell?.invoiceId === invoice.id && editingCell?.field === "invoice_number" ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="h-6 text-xs w-full"
                                  autoFocus
                                  onFocus={(e) => e.target.select()}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => saveInlineEdit(invoice.id, "invoice_number")}
                                  className="h-6 w-6 p-0"
                                >
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelInlineEdit}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                {isBotInvoice && (
                                  <span title="Created by BOTella">
                                    <Zap className="h-3 w-3 text-purple-400" />
                                  </span>
                                )}
                                <span
                                  className="text-[11px] font-mono max-w-[100px] truncate inline-block cursor-default"
                                  title={invoice.invoice_number || ""}
                                >
                                  {invoice.invoice_number || "-"}
                                </span>
                                <button
                                  onClick={() => startInlineEdit(invoice.id, "invoice_number", invoice.invoice_number)}
                                  className="opacity-0 group-hover/cell:opacity-100 transition-opacity"
                                >
                                  <Pencil className="h-3 w-3 text-gray-400 hover:text-white" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}

                        {/* Amount */}
                        {visibleColumns.has('amount') && (
                          <td className="px-2 py-1 text-right font-semibold group/cell relative">
                            {editingCell?.invoiceId === invoice.id && editingCell?.field === "invoice_amount" ? (
                              <div className="flex items-center gap-1 justify-end">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="h-6 text-xs w-24 text-right"
                                  autoFocus
                                  onFocus={(e) => e.target.select()}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => saveInlineEdit(invoice.id, "invoice_amount")}
                                  className="h-6 w-6 p-0"
                                >
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelInlineEdit}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-[11px]">
                                  {formatEuropeanNumber(invoice.invoice_amount)}
                                </span>
                                <button
                                  onClick={() => startInlineEdit(invoice.id, "invoice_amount", invoice.invoice_amount.toString())}
                                  className="opacity-0 group-hover/cell:opacity-100 transition-opacity"
                                >
                                  <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}

                        {/* Currency */}
                        {visibleColumns.has('currency') && (
                          <td className="px-2 py-1 text-center">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono bg-white">{invoice.currency}</Badge>
                          </td>
                        )}

                        {/* Financial Account */}
                        {visibleColumns.has('financial_account') && (
                          <td className="px-2 py-1 group/cell relative">
                            {editingCell?.invoiceId === invoice.id && editingCell?.field === "financial_account_code" ? (
                              <div className="flex items-center gap-1">
                                <Select
                                  value={editValue}
                                  onValueChange={setEditValue}
                                >
                                  <SelectTrigger className="h-6 text-[10px] bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white max-h-[300px]">
                                    <div className="p-2 space-y-2 sticky top-0 bg-white border-b z-10">
                                      <Input
                                        placeholder="Search accounts..."
                                        value={selectSearchTerm}
                                        onChange={(e) => setSelectSearchTerm(e.target.value)}
                                        className="h-7 text-xs"
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="w-full h-7 text-xs"
                                        onClick={() => {
                                          setFinancialAccountDialogOpen(true);
                                        }}
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add New Account
                                      </Button>
                                    </div>
                                    <div className="max-h-[150px] overflow-y-auto">
                                      {financialAccounts
                                        .filter(a =>
                                          a.name.toLowerCase().includes(selectSearchTerm.toLowerCase()) ||
                                          a.code.toLowerCase().includes(selectSearchTerm.toLowerCase())
                                        )
                                        .map(a => (
                                          <SelectItem key={a.code} value={a.code}>{a.code} - {a.name}</SelectItem>
                                        ))}
                                    </div>
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    saveInlineEdit(invoice.id, "financial_account_code");
                                  }}
                                  className="h-6 w-6 p-0 flex-shrink-0"
                                >
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    cancelInlineEdit();
                                  }}
                                  className="h-6 w-6 p-0 flex-shrink-0"
                                >
                                  <X className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 max-w-[180px] truncate bg-white" title={financialAccount?.name}>
                                  {financialAccount?.name || invoice.financial_account_code}
                                </Badge>
                                <button
                                  onClick={() => startInlineEdit(invoice.id, "financial_account_code", invoice.financial_account_code)}
                                  className="opacity-0 group-hover/cell:opacity-100 transition-opacity flex-shrink-0"
                                >
                                  <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}

                        {/* Department */}
                        {visibleColumns.has('cost_center') && (
                          <td className="px-2 py-1 text-center group/cell relative">
                            {editingCell?.invoiceId === invoice.id && editingCell?.field === "cost_center_code" ? (
                              <div className="flex items-center gap-1">
                                <Select
                                  value={editValue}
                                  onValueChange={setEditValue}
                                >
                                  <SelectTrigger className="h-6 text-[10px] bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white max-h-[300px]">
                                    <div className="p-2 sticky top-0 bg-white border-b z-10">
                                      <Input
                                        placeholder="Search departments..."
                                        value={selectSearchTerm}
                                        onChange={(e) => setSelectSearchTerm(e.target.value)}
                                        className="h-7 text-xs"
                                      />
                                    </div>
                                    <div className="max-h-[150px] overflow-y-auto">
                                      {costCenters
                                        .filter(c =>
                                          c.name.toLowerCase().includes(selectSearchTerm.toLowerCase()) ||
                                          c.code.toLowerCase().includes(selectSearchTerm.toLowerCase())
                                        )
                                        .map(c => (
                                          <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>
                                        ))}
                                    </div>
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    saveInlineEdit(invoice.id, "cost_center_code");
                                  }}
                                  className="h-6 w-6 p-0 flex-shrink-0"
                                >
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    cancelInlineEdit();
                                  }}
                                  className="h-6 w-6 p-0 flex-shrink-0"
                                >
                                  <X className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                {invoice.cost_center_code ? (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-white">
                                    {getNameByCode(costCenters, invoice.cost_center_code)}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                                <button
                                  onClick={() => startInlineEdit(invoice.id, "cost_center_code", invoice.cost_center_code)}
                                  className="opacity-0 group-hover/cell:opacity-100 transition-opacity"
                                >
                                  <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}

                        {/* Sub-Department */}
                        {visibleColumns.has('sub_department') && (
                          <td className="px-2 py-1 text-center">
                            {invoice.sub_department_code ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-800 border-purple-300">
                                {subDepartments.find(sd => sd.code === invoice.sub_department_code)?.name || invoice.sub_department_code}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        )}

                        {/* Cost Type */}
                        {visibleColumns.has('cost_type') && (
                          <td className="px-2 py-1 text-center group/cell relative">
                            {editingCell?.invoiceId === invoice.id && editingCell?.field === "cost_type_code" ? (
                              <div className="flex items-center gap-1">
                                <Select
                                  value={editValue}
                                  onValueChange={setEditValue}
                                >
                                  <SelectTrigger className="h-6 text-[10px] bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white max-h-[300px]">
                                    <div className="p-2 sticky top-0 bg-white border-b z-10">
                                      <Input
                                        placeholder="Search cost types..."
                                        value={selectSearchTerm}
                                        onChange={(e) => setSelectSearchTerm(e.target.value)}
                                        className="h-7 text-xs"
                                      />
                                    </div>
                                    <div className="max-h-[150px] overflow-y-auto">
                                      {costTypes
                                        .filter(t =>
                                          t.name.toLowerCase().includes(selectSearchTerm.toLowerCase()) ||
                                          t.code.toLowerCase().includes(selectSearchTerm.toLowerCase())
                                        )
                                        .map(t => (
                                          <SelectItem key={t.code} value={t.code}>{t.code} - {t.name}</SelectItem>
                                        ))}
                                    </div>
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    saveInlineEdit(invoice.id, "cost_type_code");
                                  }}
                                  className="h-6 w-6 p-0 flex-shrink-0"
                                >
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    cancelInlineEdit();
                                  }}
                                  className="h-6 w-6 p-0 flex-shrink-0"
                                >
                                  <X className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                {invoice.cost_type_code ? (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-white">
                                    {getNameByCode(costTypes, invoice.cost_type_code)}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                                <button
                                  onClick={() => startInlineEdit(invoice.id, "cost_type_code", invoice.cost_type_code)}
                                  className="opacity-0 group-hover/cell:opacity-100 transition-opacity"
                                >
                                  <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}

                        {/* Dep Cost Type */}
                        {visibleColumns.has('dep_cost_type') && (
                          <td className="px-2 py-1 text-center group/cell relative">
                            {editingCell?.invoiceId === invoice.id && editingCell?.field === "dep_cost_type_code" ? (
                              <div className="flex items-center gap-1">
                                <Select
                                  value={editValue}
                                  onValueChange={setEditValue}
                                >
                                  <SelectTrigger className="h-6 text-[10px] bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white max-h-[300px]">
                                    <div className="p-2 sticky top-0 bg-white border-b z-10">
                                      <Input
                                        placeholder="Search dep cost types..."
                                        value={selectSearchTerm}
                                        onChange={(e) => setSelectSearchTerm(e.target.value)}
                                        className="h-7 text-xs"
                                      />
                                    </div>
                                    <div className="max-h-[150px] overflow-y-auto">
                                      {depCostTypes
                                        .filter(d =>
                                          d.name.toLowerCase().includes(selectSearchTerm.toLowerCase()) ||
                                          d.code.toLowerCase().includes(selectSearchTerm.toLowerCase())
                                        )
                                        .map(d => (
                                          <SelectItem key={d.code} value={d.code}>{d.code} - {d.name}</SelectItem>
                                        ))}
                                    </div>
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    saveInlineEdit(invoice.id, "dep_cost_type_code");
                                  }}
                                  className="h-6 w-6 p-0 flex-shrink-0"
                                >
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    cancelInlineEdit();
                                  }}
                                  className="h-6 w-6 p-0 flex-shrink-0"
                                >
                                  <X className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                {invoice.dep_cost_type_code ? (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-white">
                                    {getNameByCode(depCostTypes, invoice.dep_cost_type_code)}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                                <button
                                  onClick={() => startInlineEdit(invoice.id, "dep_cost_type_code", invoice.dep_cost_type_code)}
                                  className="opacity-0 group-hover/cell:opacity-100 transition-opacity"
                                >
                                  <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}

                        {/* Payment Status */}
                        {visibleColumns.has('payment_status') && (
                          <td className="px-2 py-1 text-center">
                            <Badge
                              variant={paymentStatus === 'PAID' ? 'default' : paymentStatus === 'OVERDUE' ? 'destructive' : 'outline'}
                              className="text-[10px] px-1.5 py-0 bg-white"
                            >
                              {paymentStatus.replace('_', ' ')}
                            </Badge>
                          </td>
                        )}

                        {/* Payment Method - NO INLINE EDIT (set by reconciliation) */}
                        {visibleColumns.has('payment_method') && (
                          <td className="px-2 py-1 text-center">
                            {invoice.payment_method_code ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white">
                                {getNameByCode(paymentMethods, invoice.payment_method_code)}
                              </Badge>
                            ) : <span className="text-gray-400">-</span>}
                          </td>
                        )}

                        {/* Bank Account - NO INLINE EDIT (set by reconciliation) */}
                        {visibleColumns.has('bank_account') && (
                          <td className="px-2 py-1 text-center">
                            {invoice.bank_account_code ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white">
                                {getNameByCode(bankAccounts, invoice.bank_account_code)}
                              </Badge>
                            ) : <span className="text-gray-400">-</span>}
                          </td>
                        )}

                        {/* Payment Date - NO INLINE EDIT (set by reconciliation) */}
                        {visibleColumns.has('payment_date') && (
                          <td className="px-2 py-1 text-[11px]">
                            {invoice.payment_date ? new Date(invoice.payment_date).toLocaleDateString('pt-BR') : <span className="text-gray-400">-</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4 pb-6 text-sm text-gray-400">
          Showing {filteredInvoices.length} of {invoices.length} invoices
        </div>
      </div>

      {/* Multi-Select Filter Dialog */}
      {filterPopoverOpen && (
        <Dialog open={!!filterPopoverOpen} onOpenChange={() => closeFilterPopover()}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Filter by {filterPopoverOpen.field.replace(/_/g, ' ')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {(() => {
                const field = filterPopoverOpen.field;

                // Date filters
                if (['input_date', 'invoice_date', 'benefit_date'].includes(field)) {
                  const presets = ["This Week", "Last Week", "Next Week", "This Month", "Last Month", "Next Year"];
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        {presets.map(preset => (
                          <Button
                            key={preset}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const range = getDatePreset(preset);
                              setDateFilters(prev => ({ ...prev, [field]: range }));
                              setAppliedFilters(prev => {
                                const filtered = prev.filter(f => f.field !== field);
                                return [...filtered, { field, value: preset, label: `${field}: ${preset}` }];
                              });
                              closeFilterPopover();
                            }}
                            className="text-xs"
                          >
                            {preset}
                          </Button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Custom Range:</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">From:</Label>
                            <Input type="date" className="h-8 text-xs" id="date-start" />
                          </div>
                          <div>
                            <Label className="text-xs">To:</Label>
                            <Input type="date" className="h-8 text-xs" id="date-end" />
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            const start = (document.getElementById('date-start') as HTMLInputElement).value;
                            const end = (document.getElementById('date-end') as HTMLInputElement).value;
                            if (start || end) {
                              setDateFilters(prev => ({ ...prev, [field]: { start, end } }));
                              setAppliedFilters(prev => {
                                const filtered = prev.filter(f => f.field !== field);
                                return [...filtered, { field, value: `${start} to ${end}`, label: `${field}: ${start} to ${end}` }];
                              });
                              closeFilterPopover();
                            }
                          }}
                        >
                          Apply Custom Range
                        </Button>
                      </div>
                    </div>
                  );
                }

                // Amount filter
                if (field === 'invoice_amount') {
                  return (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            const value = prompt("Less than:");
                            if (value) {
                              setAmountFilter({ operator: 'lt', value1: parseFloat(value) });
                              setAppliedFilters(prev => {
                                const filtered = prev.filter(f => f.field !== field);
                                return [...filtered, { field, value: `< ${value}`, label: `Amount: < ${value}` }];
                              });
                              closeFilterPopover();
                            }
                          }}
                        >
                          Less than (-)
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            const value = prompt("Greater than:");
                            if (value) {
                              setAmountFilter({ operator: 'gt', value1: parseFloat(value) });
                              setAppliedFilters(prev => {
                                const filtered = prev.filter(f => f.field !== field);
                                return [...filtered, { field, value: `> ${value}`, label: `Amount: > ${value}` }];
                              });
                              closeFilterPopover();
                            }
                          }}
                        >
                          Greater than (+)
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            const value = prompt("Exact value:");
                            if (value) {
                              setAmountFilter({ operator: 'eq', value1: parseFloat(value) });
                              setAppliedFilters(prev => {
                                const filtered = prev.filter(f => f.field !== field);
                                return [...filtered, { field, value: `= ${value}`, label: `Amount: = ${value}` }];
                              });
                              closeFilterPopover();
                            }
                          }}
                        >
                          Exact value (=)
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            const min = prompt("Minimum value:");
                            if (min) {
                              const max = prompt("Maximum value:");
                              if (max) {
                                setAmountFilter({ operator: 'between', value1: parseFloat(min), value2: parseFloat(max) });
                                setAppliedFilters(prev => {
                                  const filtered = prev.filter(f => f.field !== field);
                                  return [...filtered, { field, value: `${min} - ${max}`, label: `Amount: ${min} - ${max}` }];
                                });
                                closeFilterPopover();
                              }
                            }
                          }}
                        >
                          Between (range)
                        </Button>
                      </div>
                    </div>
                  );
                }

                // Invoice Number filter
                if (field === 'invoice_number') {
                  const availableInvoiceNumbers = Array.from(new Set(
                    filteredInvoices.map(inv => inv.invoice_number).filter(Boolean)
                  )) as string[];

                  return (
                    <>
                      <Input
                        placeholder="Search..."
                        value={filterSearchTerm}
                        onChange={(e) => setFilterSearchTerm(e.target.value)}
                        className="h-9"
                      />
                      <div className="max-h-[300px] overflow-y-auto border rounded-md">
                        {availableInvoiceNumbers
                          .filter(num => num.toLowerCase().includes(filterSearchTerm.toLowerCase()))
                          .map(num => (
                            <div
                              key={num}
                              className="flex items-center justify-between p-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => toggleFilterOption(num)}
                            >
                              <span className="text-sm">{num}</span>
                              {tempFilterSelection.includes(num) && (
                                <Check className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                          ))}
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={closeFilterPopover}>
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => applyMultiSelectFilter(field)}>
                          <Check className="h-3 w-3 mr-1" />
                          OK ({tempFilterSelection.length})
                        </Button>
                      </div>
                    </>
                  );
                }

                // Multi-select filters with cascade (only show available options)
                let options: { value: string, label: string }[] = [];

                if (field === "provider_code") {
                  const availableCodes = new Set(filteredInvoices.map(inv => inv.provider_code));
                  options = providers.filter(p => availableCodes.has(p.code)).map(p => ({ value: p.code, label: p.name }));
                } else if (field === "financial_account_code") {
                  const availableCodes = new Set(filteredInvoices.map(inv => inv.financial_account_code));
                  options = financialAccounts.filter(acc => acc.level >= 2 && availableCodes.has(acc.code)).map(acc => ({ value: acc.code, label: acc.name }));
                } else if (field === "cost_center_code") {
                  const availableCodes = new Set(filteredInvoices.map(inv => inv.cost_center_code).filter(Boolean));
                  options = costCenters.filter(c => availableCodes.has(c.code)).map(c => ({ value: c.code, label: c.name }));
                } else if (field === "cost_type_code") {
                  const availableCodes = new Set(filteredInvoices.map(inv => inv.cost_type_code).filter(Boolean));
                  options = costTypes.filter(c => availableCodes.has(c.code)).map(c => ({ value: c.code, label: c.name }));
                } else if (field === "dep_cost_type_code") {
                  const availableCodes = new Set(filteredInvoices.map(inv => inv.dep_cost_type_code).filter(Boolean));
                  options = depCostTypes.filter(c => availableCodes.has(c.code)).map(c => ({ value: c.code, label: c.name }));
                } else if (field === "bank_account_code") {
                  const availableCodes = new Set(filteredInvoices.map(inv => inv.bank_account_code).filter(Boolean));
                  options = bankAccounts.filter(b => availableCodes.has(b.code)).map(b => ({ value: b.code, label: b.name }));
                } else if (field === "payment_method_code") {
                  const availableCodes = new Set(filteredInvoices.map(inv => inv.payment_method_code).filter(Boolean));
                  options = paymentMethods.filter(p => availableCodes.has(p.code)).map(p => ({ value: p.code, label: p.name }));
                } else if (field === "entry_type") {
                  const availableCodes = new Set(filteredInvoices.map(inv => inv.entry_type));
                  options = entryTypes.filter(e => availableCodes.has(e.code)).map(e => ({ value: e.code, label: e.name }));
                } else if (field === "invoice_type") {
                  const availableTypes = new Set(filteredInvoices.map(inv => inv.invoice_type));
                  options = [
                    { value: "INCURRED", label: "Incurred" },
                    { value: "BUDGET", label: "Budget" },
                    { value: "ADJUSTMENT", label: "Adjustments" }
                  ].filter(opt => availableTypes.has(opt.value as InvoiceType));
                } else if (field === "currency") {
                  const availableCurrencies = new Set(filteredInvoices.map(i => i.currency));
                  options = Array.from(availableCurrencies).map(c => ({ value: c, label: c }));
                }

                const filtered = options.filter(opt =>
                  opt.label.toLowerCase().includes(filterSearchTerm.toLowerCase())
                );

                return (
                  <>
                    <Input
                      placeholder="Search..."
                      value={filterSearchTerm}
                      onChange={(e) => setFilterSearchTerm(e.target.value)}
                      className="h-9"
                    />
                    <div className="max-h-[300px] overflow-y-auto border rounded-md">
                      {filtered.map(opt => (
                        <div
                          key={opt.value}
                          className="flex items-center justify-between p-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => toggleFilterOption(opt.value)}
                        >
                          <span className="text-sm">{opt.label}</span>
                          {tempFilterSelection.includes(opt.value) && (
                            <Check className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={closeFilterPopover}>
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => applyMultiSelectFilter(field)}>
                        <Check className="h-3 w-3 mr-1" />
                        OK ({tempFilterSelection.length})
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>
      )
      }

      {/* Invoice Side Panel */}
      <InvoiceSidePanel
        open={sidePanelOpen}
        onClose={() => {
          setSidePanelOpen(false);
          setEditingInvoice(null);
          resetForm();
        }}
        editingInvoice={editingInvoice}
        defaultScope={selectedScope as ScopeType}
        onSuccess={() => {
          loadInvoices();
          setSidePanelOpen(false);
          setEditingInvoice(null);
          resetForm();
        }}
      />
    </>
  );
}
