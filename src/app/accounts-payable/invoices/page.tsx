"use client";

import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from "react";
import Image from "next/image";
import { Plus, Search, Edit2, ArrowUpDown, FileText, TrendingUp, RefreshCw, DollarSign, Trash2, X, Pencil, Filter, ChevronDown, ChevronRight, ChevronLeft, Check, Save, Download, FileSpreadsheet, Columns3, Split, Eye, Zap, User, CheckCircle2, Building2 } from "lucide-react";
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { ScopeSelector } from "@/components/app/scope-selector";
import { type ScopeType, getRecordScope, getScopeIcon, matchesScope, scopeToFields, SCOPE_CONFIG } from "@/lib/scope-utils";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { PageHeader } from "@/components/ui/page-header";

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
  reconciled_at?: string | null; // Date of reconciliation
  reconciled_transaction_id?: string | null;
  reconciled_amount?: number | null;
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
    color: "bg-gray-100 dark:bg-[#0a0a0a]/50 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600",
    icon: RefreshCw,
    description: "Balance adjustments - affects cash but not DRE"
  }
};

const COUNTRIES = [
  { code: "ES", name: "Spain", defaultCurrency: "EUR" },
  { code: "US", name: "United States", defaultCurrency: "USD" },
  { code: "GLOBAL", name: "Global (Consolidated)", defaultCurrency: "EUR" }
];

const COLUMN_OPTIONS = [
  { id: 'actions', label: 'Actions' },
  { id: 'split', label: 'Split Status' },
  { id: 'created_by', label: 'Created' },
  { id: 'scope', label: 'Scope' },
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
  { id: 'is_reconciled', label: 'Recon' },
  { id: 'payment_method', label: 'Payment Method' },
  { id: 'bank_account', label: 'Bank Account' },
  { id: 'payment_date', label: 'Payment Date' },
];

const ALL_COLUMN_IDS = COLUMN_OPTIONS.map((column) => column.id);
const DEFAULT_VISIBLE_COLUMN_IDS = [
  'actions', 'split', 'created_by', 'scope', 'type', 'input_date', 'invoice_date', 'benefit_date', 'due_date', 'schedule_date',
  'provider', 'description', 'invoice_number', 'amount', 'currency', 'financial_account',
  'cost_center', 'sub_department', 'cost_type', 'dep_cost_type', 'payment_status', 'is_reconciled', 'payment_method',
  'bank_account', 'payment_date'
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
  const deferredSearchTerm = useDeferredValue(searchTerm);
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
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>(undefined);
  const [createdFilter, setCreatedFilter] = useState<'all' | 'bot' | 'manual'>('all');

  // Year filter (server-side) and date/amount filters (client-side)
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [dateFilters, setDateFilters] = useState<Record<string, { start?: string, end?: string }>>({});
  const [amountFilter, setAmountFilter] = useState<{ operator: 'lt' | 'gt' | 'eq' | 'between', value1: number, value2?: number } | null>(null);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_VISIBLE_COLUMN_IDS));
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
  const [tempVisibleColumns, setTempVisibleColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMN_IDS);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ invoiceId: number, field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectSearchTerm, setSelectSearchTerm] = useState("");

  // Grouping mode
  const [groupByMode, setGroupByMode] = useState<"none" | "provider" | "financial_account" | "department">("none");
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());

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

  const providerNameByCode = useMemo(() => new Map((providers || []).map((item: any) => [item.code, item.name])), [providers]);
  const bankAccountNameByCode = useMemo(() => new Map((bankAccounts || []).map((item: any) => [item.code, item.name])), [bankAccounts]);
  const paymentMethodNameByCode = useMemo(() => new Map((paymentMethods || []).map((item: any) => [item.code, item.name])), [paymentMethods]);
  const costTypeNameByCode = useMemo(() => new Map((costTypes || []).map((item: any) => [item.code, item.name])), [costTypes]);
  const depCostTypeNameByCode = useMemo(() => new Map((depCostTypes || []).map((item: any) => [item.code, item.name])), [depCostTypes]);
  const costCenterNameByCode = useMemo(() => new Map((costCenters || []).map((item: any) => [item.code, item.name])), [costCenters]);
  const financialAccountNameByCode = useMemo(() => new Map((financialAccounts || []).map((item: any) => [item.code, item.name])), [financialAccounts]);

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
  }, [selectedYear]);

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

      const [providersRes, bankAccountsRes, paymentMethodsRes, costTypesRes, depCostTypesRes, costCentersRes, subDepartmentsRes, entryTypesRes, financialAccountsRes, coursesRes, dsdCoursesRes] = await Promise.all([
        supabase.from("providers").select("*").eq("is_active", true),
        bankAccountsQuery,
        supabase.from("payment_methods").select("*").eq("is_active", true),
        supabase.from("cost_types").select("*").eq("is_active", true),
        supabase.from("dep_cost_types").select("*").eq("is_active", true),
        supabase.from("cost_centers").select("*").eq("is_active", true).eq("level", 1),
        supabase.from("sub_departments").select("*").eq("is_active", true),
        supabase.from("entry_types").select("*").eq("is_active", true),
        supabase.from("financial_accounts").select("*").eq("is_active", true),
        supabase.from("courses").select("*").eq("is_active", true),
        supabase.from("dsd_courses").select("*").eq("is_active", true).order("start_date", { ascending: true })
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
      // Merge existing courses with DSD courses (normalized: code + name)
      const existingCourses = (coursesRes.data || []);
      const dsdCourses = (dsdCoursesRes.data || []).map((c: any) => ({
        code: c.id,
        name: `${c.name}${c.location ? ` (${c.location})` : ""}${c.start_date ? ` — ${c.start_date}` : ""}`,
        is_active: c.is_active,
      }));
      setCourses([...existingCourses, ...dsdCourses]);
    } catch (e: any) {
      console.error("Failed to load master data:", e);
    }
  }

  async function loadInvoices() {
    setLoading(true);
    setError(null);
    try {
      // Fetch via server-side API route (uses supabaseAdmin, no 1000-row limit)
      const yearParam = selectedYear !== "ALL" ? `?year=${selectedYear}` : "";
      const res = await fetch(`/api/invoices/list${yearParam}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      // Map invoice_amount to amount for compatibility
      const mappedData = (json.data || []).map((invoice: any) => ({
        ...invoice,
        amount: invoice.invoice_amount,
        scope: invoice.scope || invoice.country_code
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

      const baseSplitData = {
        input_date: splitInvoice.input_date,
        invoice_date: splitInvoice.invoice_date,
        benefit_date: splitInvoice.benefit_date,
        due_date: splitInvoice.due_date || null,
        schedule_date: splitInvoice.schedule_date || null,
        payment_date: splitInvoice.payment_date || null,
        invoice_type: splitInvoice.invoice_type,
        entry_type: splitInvoice.entry_type,
        financial_account_code: splitInvoice.financial_account_code,
        currency: splitInvoice.currency,
        paid_amount: splitInvoice.paid_amount || null,
        paid_currency: splitInvoice.paid_currency || null,
        eur_exchange: splitInvoice.eur_exchange,
        provider_code: splitInvoice.provider_code,
        bank_account_code: splitInvoice.bank_account_code || null,
        course_code: splitInvoice.course_code || null,
        payment_method_code: splitInvoice.payment_method_code || null,
        cost_type_code: splitInvoice.cost_type_code || null,
        dep_cost_type_code: splitInvoice.dep_cost_type_code || null,
        cost_center_code: splitInvoice.cost_center_code || null,
        sub_department_code: splitInvoice.sub_department_code || null,
        description: splitInvoice.description || null,
        country_code: splitInvoice.country_code,
        scope: splitInvoice.scope,
        applies_to_all_countries: splitInvoice.applies_to_all_countries || false,
        dre_impact: splitInvoice.dre_impact,
        cash_impact: splitInvoice.cash_impact,
        is_intercompany: splitInvoice.is_intercompany,
        is_reconciled: splitInvoice.is_reconciled || false,
        reconciled_at: splitInvoice.reconciled_at || null,
        reconciled_transaction_id: splitInvoice.reconciled_transaction_id || null,
        reconciled_amount: splitInvoice.reconciled_amount || null,
        payment_status: splitInvoice.payment_status || null,
        notes: splitInvoice.notes || null,
      };

      if (splitConfig.type === 'installments') {
        // Split by installments
        const installmentAmount = splitInvoice.invoice_amount / splitConfig.installments;
        const baseDueDate = new Date(splitInvoice.due_date || splitInvoice.invoice_date);

        const splits = [];
        for (let i = 0; i < splitConfig.installments; i++) {
          const dueDate = new Date(baseDueDate);
          dueDate.setMonth(dueDate.getMonth() + i);

          splits.push({
            ...baseSplitData,
            invoice_amount: installmentAmount,
            due_date: dueDate.toISOString().split('T')[0],
            schedule_date: dueDate.toISOString().split('T')[0],
            is_split: true,
            parent_invoice_id: splitInvoice.id,
            split_number: i + 1,
            total_splits: splitConfig.installments,
            split_type: 'INSTALLMENTS',
            invoice_number: `${splitInvoice.invoice_number || splitInvoice.id}-${i + 1}/${splitConfig.installments}`,
          });
        }

        // Insert all splits
        const { error } = await supabase.from('invoices').insert(splits);

        if (error) throw error;

        // Mark original as parent
        await supabase
          .from('invoices')
          .update({ is_split: true, total_splits: splitConfig.installments })
          .eq('id', splitInvoice.id);

      } else {
        // Split by dimensions (financial account, cost center, etc.)
        const splits = splitConfig.splits.map((split, index) => ({
          ...baseSplitData,
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
        }));

        const { error } = await supabase.from('invoices').insert(splits);

        if (error) throw error;

        await supabase
          .from('invoices')
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
    setCalendarRange(undefined);
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
        if (field === 'cost_type_code') return getCostTypeDisplay(code);
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
    if (array === providers) return providerNameByCode.get(code) || code;
    if (array === bankAccounts) return bankAccountNameByCode.get(code) || code;
    if (array === paymentMethods) return paymentMethodNameByCode.get(code) || code;
    if (array === costTypes) return costTypeNameByCode.get(code) || code;
    if (array === depCostTypes) return depCostTypeNameByCode.get(code) || code;
    if (array === costCenters) return costCenterNameByCode.get(code) || code;
    if (array === financialAccounts) return financialAccountNameByCode.get(code) || code;
    return array.find(item => item.code === code)?.name || code;
  }

  function getCostTypeDisplay(code?: string | null) {
    if (!code) return "-";

    const masterName = getNameByCode(costTypes, code);
    const candidate = (masterName && masterName !== code ? masterName : code).toString().trim();
    const normalized = candidate.toUpperCase().replace(/[\s-]+/g, "_");

    const map: Record<string, string> = {
      "100": "Fixed Cost",
      "200": "Variable Cost",
      "300": "Personnel Expenses",
      "400": "Cost of Good Sold",
      "1": "Fixed Cost",
      "2": "Variable Cost",
      "3": "Personnel Expenses",
      "4": "Cost of Good Sold",
      "FIXED_COST": "Fixed Cost",
      "FIXED": "Fixed Cost",
      "VARIABLE_COST": "Variable Cost",
      "VARIABLE": "Variable Cost",
      "PERSONNEL_EXPENSES": "Personnel Expenses",
      "PERSONNEL": "Personnel Expenses",
      "COST_OF_GOOD_SOLD": "Cost of Good Sold",
      "COST_OF_GOODS_SOLD": "Cost of Good Sold",
      "COGS": "Cost of Good Sold",
    };

    const label = map[normalized] || candidate;
    return label;
  }

  function getComputedPaymentStatus(invoice: Invoice): "PAID" | "SCHEDULED" | "NOT_SCHEDULED" {
    const storedStatus = (invoice.payment_status || "").toUpperCase();
    const isPaid = !!invoice.payment_date || (invoice.paid_amount || 0) > 0 || !!invoice.is_reconciled || storedStatus === "PAID";

    if (isPaid) return "PAID";
    if (invoice.schedule_date) return "SCHEDULED";
    return "NOT_SCHEDULED";
  }

  function getFilterableValue(invoice: Invoice, field: string): string | null {
    if (field === "payment_status") return getComputedPaymentStatus(invoice);
    const raw = (invoice as any)[field];
    if (raw === null || raw === undefined) return null;
    return String(raw);
  }

  function isAutomaticInvoice(invoice: Invoice): boolean {
    const invoiceNumber = String(invoice.invoice_number || "").toUpperCase();
    const notes = String(invoice.notes || "").toUpperCase();

    return (
      invoiceNumber.startsWith("BOT-") ||
      notes.includes("PAYROLL_AUTO|")
    );
  }

  // Export to Excel
  function exportToExcel() {
    try {
      const columnMap: Record<string, string> = {
        actions: "Actions",
        scope: "Scope",
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
        if (visibleColumns.has('cost_type')) row['Cost Type'] = invoice.cost_type_code ? getCostTypeDisplay(invoice.cost_type_code) : '';
        if (visibleColumns.has('dep_cost_type')) row['Dep Cost Type'] = invoice.dep_cost_type_code ? getNameByCode(depCostTypes, invoice.dep_cost_type_code) : '';
        if (visibleColumns.has('payment_status')) row['Payment Status'] = getComputedPaymentStatus(invoice);
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
        if (visibleColumns.has('cost_type')) row.push(invoice.cost_type_code ? getCostTypeDisplay(invoice.cost_type_code).substring(0, 30) : '');
        if (visibleColumns.has('dep_cost_type')) row.push(invoice.dep_cost_type_code ? getNameByCode(depCostTypes, invoice.dep_cost_type_code).substring(0, 30) : '');
        if (visibleColumns.has('payment_status')) row.push(getComputedPaymentStatus(invoice));
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

  function moveColumnOrder(columnId: string, targetColumnId: string) {
    if (!columnId || !targetColumnId || columnId === targetColumnId) return;

    setColumnOrder((prev) => {
      const from = prev.indexOf(columnId);
      const to = prev.indexOf(targetColumnId);
      if (from < 0 || to < 0) return prev;

      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, columnId);
      return next;
    });
  }

  const orderedColumnOptions = useMemo(() => {
    const mapped = columnOrder
      .map((columnId) => COLUMN_OPTIONS.find((item) => item.id === columnId) || null)
      .filter((item): item is { id: string; label: string } => !!item);

    return mapped.length > 0 ? mapped : COLUMN_OPTIONS;
  }, [columnOrder]);

  function scrollTableHorizontally(direction: "left" | "right") {
    const container = tableContainerRef.current;
    if (!container) return;

    const delta = Math.max(320, Math.floor(container.clientWidth * 0.7));
    container.scrollBy({
      left: direction === "left" ? -delta : delta,
      behavior: "smooth",
    });
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

  function getFilterBaseInvoices(targetField: string): Invoice[] {
    let base = [...invoices];

    base = base.filter(inv => matchesScope(inv, selectedScope));

    if (selectedType !== "ALL") {
      base = base.filter(inv => inv.invoice_type === selectedType);
    }

    if (selectedCountry !== "ALL") {
      base = base.filter(inv => inv.country_code === selectedCountry);
    }

    if (createdFilter === 'bot') {
      base = base.filter(inv => inv.invoice_number?.startsWith("BOT-"));
    } else if (createdFilter === 'manual') {
      base = base.filter(inv => !inv.invoice_number?.startsWith("BOT-"));
    }

    Object.entries(columnFilters).forEach(([field, value]) => {
      if (field !== targetField && value) {
        base = base.filter(inv => getFilterableValue(inv, field) === value);
      }
    });

    Object.entries(multiSelectFilters).forEach(([field, values]) => {
      if (field !== targetField && values && values.length > 0) {
        base = base.filter(inv => {
          const v = getFilterableValue(inv, field);
          return v ? values.includes(v) : false;
        });
      }
    });

    Object.entries(dateFilters).forEach(([field, range]) => {
      if (field !== targetField && (range.start || range.end)) {
        base = base.filter(inv => {
          const invDate = (inv as any)[field];
          if (!invDate) return false;
          if (range.start && invDate < range.start) return false;
          if (range.end && invDate > range.end) return false;
          return true;
        });
      }
    });

    if (amountFilter && targetField !== 'invoice_amount') {
      base = base.filter(inv => {
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

    return base;
  }

  function getDynamicFilterOptions(field: string): { value: string, label: string }[] {
    const baseInvoices = getFilterBaseInvoices(field);
    const optionsMap = new Map<string, string>();

    if (field === "provider_code") {
      baseInvoices.forEach(inv => {
        if (inv.provider_code) {
          optionsMap.set(inv.provider_code, getNameByCode(providers, inv.provider_code));
        }
      });
    } else if (field === "financial_account_code") {
      baseInvoices.forEach(inv => {
        if (inv.financial_account_code) {
          optionsMap.set(inv.financial_account_code, getNameByCode(financialAccounts, inv.financial_account_code));
        }
      });
    } else if (field === "cost_center_code") {
      baseInvoices.forEach(inv => {
        if (inv.cost_center_code) {
          optionsMap.set(inv.cost_center_code, getNameByCode(costCenters, inv.cost_center_code));
        }
      });
    } else if (field === "cost_type_code") {
      baseInvoices.forEach(inv => {
        if (inv.cost_type_code) {
          optionsMap.set(inv.cost_type_code, getCostTypeDisplay(inv.cost_type_code));
        }
      });
    } else if (field === "dep_cost_type_code") {
      baseInvoices.forEach(inv => {
        if (inv.dep_cost_type_code) {
          optionsMap.set(inv.dep_cost_type_code, getNameByCode(depCostTypes, inv.dep_cost_type_code));
        }
      });
    } else if (field === "bank_account_code") {
      baseInvoices.forEach(inv => {
        if (inv.bank_account_code) {
          optionsMap.set(inv.bank_account_code, getNameByCode(bankAccounts, inv.bank_account_code));
        }
      });
    } else if (field === "payment_method_code") {
      baseInvoices.forEach(inv => {
        if (inv.payment_method_code) {
          optionsMap.set(inv.payment_method_code, getNameByCode(paymentMethods, inv.payment_method_code));
        }
      });
    } else if (field === "entry_type") {
      baseInvoices.forEach(inv => {
        if (inv.entry_type) {
          optionsMap.set(inv.entry_type, getNameByCode(entryTypes, inv.entry_type));
        }
      });
    } else if (field === "invoice_type") {
      [
        { value: "INCURRED", label: "Incurred" },
        { value: "BUDGET", label: "Budget" },
        { value: "ADJUSTMENT", label: "Adjustments" }
      ].forEach(option => optionsMap.set(option.value, option.label));
    } else if (field === "currency") {
      baseInvoices.forEach(inv => {
        if (inv.currency) {
          optionsMap.set(inv.currency, inv.currency);
        }
      });
    } else if (field === "payment_status") {
      baseInvoices.forEach(inv => {
        const status = getComputedPaymentStatus(inv);
        optionsMap.set(status, status.replace('_', ' '));
      });
    }

    return Array.from(optionsMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  const filteredInvoices = useMemo(() => {
    let filtered = [...invoices];

    // Filter by global scope (from sidebar)
    filtered = filtered.filter(inv => matchesScope(inv, selectedScope));

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
        filtered = filtered.filter(inv => getFilterableValue(inv, field) === value);
      }
    });

    // Filter by multi-select filters
    Object.entries(multiSelectFilters).forEach(([field, values]) => {
      if (values && values.length > 0) {
        filtered = filtered.filter(inv => {
          const v = getFilterableValue(inv, field);
          return v ? values.includes(v) : false;
        });
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
    if (deferredSearchTerm) {
      const search = deferredSearchTerm.toLowerCase();
      filtered = filtered.filter(
        inv => {
          const providerName = (providerNameByCode.get(inv.provider_code) || "").toLowerCase();

          return (
            inv.invoice_number?.toLowerCase().includes(search) ||
            inv.provider_code?.toLowerCase().includes(search) ||
            providerName.includes(search) ||
            inv.description?.toLowerCase().includes(search) ||
            inv.financial_account_code?.toLowerCase().includes(search) ||
            inv.notes?.toLowerCase().includes(search)
          );
        }
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
  }, [
    invoices,
    selectedType,
    selectedCountry,
    deferredSearchTerm,
    sortField,
    sortDirection,
    selectedScope,
    columnFilters,
    multiSelectFilters,
    dateFilters,
    amountFilter,
    providerNameByCode,
  ]);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const table = container.querySelector('table');
    if (!table) return;

    const headRow = table.querySelector('thead tr');
    if (!headRow) return;

    const headerCells = Array.from(headRow.children) as HTMLElement[];
    const nameToId = new Map<string, string>([
      ['actions', 'actions'],
      ['split', 'split'],
      ['created', 'created_by'],
      ['scope', 'scope'],
      ['type', 'type'],
      ['input date', 'input_date'],
      ['invoice date', 'invoice_date'],
      ['benefit date', 'benefit_date'],
      ['due date', 'due_date'],
      ['schedule date', 'schedule_date'],
      ['provider', 'provider'],
      ['description', 'description'],
      ['invoice id', 'invoice_number'],
      ['amount', 'amount'],
      ['currency', 'currency'],
      ['financial account', 'financial_account'],
      ['department', 'cost_center'],
      ['sub-department', 'sub_department'],
      ['cost type', 'cost_type'],
      ['dep cost type', 'dep_cost_type'],
      ['payment status', 'payment_status'],
      ['recon', 'is_reconciled'],
      ['payment method', 'payment_method'],
      ['bank account', 'bank_account'],
      ['payment date', 'payment_date'],
    ]);

    const currentIds = headerCells
      .map((cell) => (cell.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim())
      .map((name) => nameToId.get(name) || null)
      .filter((id): id is string => !!id);

    if (currentIds.length === 0) return;

    const targetIds = columnOrder.filter((id) => currentIds.includes(id));
    if (targetIds.length !== currentIds.length) return;

    const reorderRow = (row: Element) => {
      const cells = Array.from(row.children);
      if (cells.length !== currentIds.length) return;

      const ordered = targetIds
        .map((id) => cells[currentIds.indexOf(id)])
        .filter(Boolean);

      ordered.forEach((cell) => row.appendChild(cell));
    };

    reorderRow(headRow);
    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    bodyRows.forEach((row) => reorderRow(row));
  }, [columnOrder, visibleColumns, filteredInvoices, createdFilter, groupByMode, expandedGroupKeys]);

  const filteredByCreated = useMemo(() => {
    if (createdFilter === 'bot') {
      return filteredInvoices.filter(inv => isAutomaticInvoice(inv));
    }
    if (createdFilter === 'manual') {
      return filteredInvoices.filter(inv => !isAutomaticInvoice(inv));
    }
    return filteredInvoices;
  }, [filteredInvoices, createdFilter]);

  const groupedInvoices = useMemo(() => {
    if (groupByMode === "none") return null;

    const groups: Record<string, { key: string; label: string; invoices: Invoice[]; totalAmount: number; reconciledCount: number }> = {};

    filteredByCreated.forEach(inv => {
      const key = groupByMode === "provider"
        ? (inv.provider_code || "NO_PROVIDER")
        : groupByMode === "financial_account"
          ? (inv.financial_account_code || "NO_FINANCIAL_ACCOUNT")
          : (inv.cost_center_code || "NO_DEPARTMENT");

      const label = groupByMode === "provider"
        ? getNameByCode(providers, key)
        : groupByMode === "financial_account"
          ? getNameByCode(financialAccounts, key)
          : getNameByCode(costCenters, key);

      if (!groups[key]) {
        groups[key] = {
          key,
          label,
          invoices: [],
          totalAmount: 0,
          reconciledCount: 0
        };
      }

      groups[key].invoices.push(inv);
      groups[key].totalAmount += inv.invoice_amount * inv.eur_exchange;
      if (inv.is_reconciled) groups[key].reconciledCount++;
    });

    return Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredByCreated, groupByMode, providers, financialAccounts, costCenters]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroupKeys(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const setGroupingMode = (mode: "none" | "provider" | "financial_account" | "department") => {
    const isSameMode = groupByMode === mode;
    setGroupByMode(isSameMode ? "none" : mode);
    setExpandedGroupKeys(new Set());
  };

  const expandAllGroups = () => {
    if (groupedInvoices) {
      setExpandedGroupKeys(new Set(groupedInvoices.map(g => g.key)));
    }
  };

  const collapseAllGroups = () => {
    setExpandedGroupKeys(new Set());
  };

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
      <div className="min-h-screen bg-white dark:bg-black px-6 py-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 dark:text-gray-400">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Fixed Header and Cards - Dark Theme */}
      <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white px-6 py-6 pb-0">
        <PageHeader title="Invoices" subtitle={SCOPE_CONFIG[selectedScope].label}>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportToExcel} className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportToPDF} className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button
              disabled={selectedScope === "GLOBAL"}
              variant="outline"
              className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]"
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
        </PageHeader>
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
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} {num === 1 ? 'installment' : 'installments'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {splitConfig.installments > 0 && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <h5 className="font-semibold mb-2">Preview</h5>
                        <div className="space-y-1 text-sm">
                          {Array.from({ length: splitConfig.installments }, (_, i) => {
                            const installmentAmount = splitInvoice.invoice_amount / splitConfig.installments;
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
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Select Financial Account..." />
                              </SelectTrigger>
                              <SelectContent className="bg-white max-h-[300px]">
                                {financialAccounts.filter(acc => acc.level >= 2).map(acc => (
                                  <SelectItem key={acc.code} value={acc.code}>{acc.name}</SelectItem>
                                ))}
                              </SelectContent>
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
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Select Department..." />
                              </SelectTrigger>
                              <SelectContent className="bg-white max-h-[300px]">
                                {costCenters.map(cc => (
                                  <SelectItem key={cc.code} value={cc.code}>{cc.name}</SelectItem>
                                ))}
                              </SelectContent>
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
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Select Cost Type..." />
                              </SelectTrigger>
                              <SelectContent className="bg-white max-h-[300px]">
                                {costTypes.map(ct => (
                                  <SelectItem key={ct.code} value={ct.code}>{ct.name}</SelectItem>
                                ))}
                              </SelectContent>
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
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Select Department Cost Type..." />
                              </SelectTrigger>
                              <SelectContent className="bg-white max-h-[300px]">
                                {depCostTypes.map(dct => (
                                  <SelectItem key={dct.code} value={dct.code}>{dct.name}</SelectItem>
                                ))}
                              </SelectContent>
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
                                  newSplits[index].percentage = (amount / splitInvoice.invoice_amount) * 100;
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
                                  newSplits[index].amount = (splitInvoice.invoice_amount * percentage) / 100;
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
                          <span className={splitConfig.splits.reduce((sum, s) => sum + s.amount, 0) !== splitInvoice.invoice_amount ? 'text-destructive' : 'text-green-600'}>
                            {formatEuropeanNumber(splitConfig.splits.reduce((sum, s) => sum + s.amount, 0))} / {formatEuropeanNumber(splitInvoice.invoice_amount)}
                          </span>
                        </div>
                        {splitConfig.splits.reduce((sum, s) => sum + s.amount, 0) !== splitInvoice.invoice_amount && (
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

        {/* Action Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {/* Select Columns */}
            <Dialog
              open={columnSelectorOpen}
              onOpenChange={(open) => {
                if (open) {
                  setTempVisibleColumns(new Set(visibleColumns));
                  setColumnSelectorOpen(true);
                } else {
                  cancelColumnSelection();
                }
              }}
            >
              <Button
                type="button"
                onClick={() => {
                  setTempVisibleColumns(new Set(visibleColumns));
                  setColumnSelectorOpen(true);
                }}
                variant={columnSelectorOpen ? "default" : "outline"}
                size="sm"
                className={`relative overflow-visible ${columnSelectorOpen ? 'bg-[#243140] hover:bg-gray-100 dark:hover:bg-[#1a2530] text-gray-900 dark:text-white' : ''}`}
              >
                <Columns3 className="h-4 w-4 mr-2" />
                Select Columns
                {visibleColumns.size < ALL_COLUMN_IDS.length && (
                  <>
                    <span
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setVisibleColumns(new Set(ALL_COLUMN_IDS));
                      }}
                      className="absolute -top-2 -left-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white z-10 cursor-pointer"
                      title="Clear column filter (show all)"
                    >
                      <X className="h-3 w-3" />
                    </span>
                    <span className="absolute -top-2 -right-2 bg-gray-50 dark:bg-black text-gray-900 dark:text-white text-[10px] font-bold rounded-full min-w-[28px] h-5 px-1.5 flex items-center justify-center border-2 border-white whitespace-nowrap">
                      {visibleColumns.size}/{ALL_COLUMN_IDS.length}
                    </span>
                  </>
                )}
              </Button>
              <DialogContent className="max-w-2xl bg-white dark:bg-black border-gray-200 dark:border-gray-700">
                <DialogHeader>
                  <DialogTitle className="text-gray-900 dark:text-white">Select Visible Columns</DialogTitle>
                  <DialogDescription className="text-gray-500 dark:text-gray-400">
                    Choose columns and drag to reorder their display sequence
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {orderedColumnOptions.map((column) => {
                    return (
                      <div
                        key={column.id}
                        draggable
                        onDragStart={() => setDraggedColumnId(column.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggedColumnId) moveColumnOrder(draggedColumnId, column.id);
                          setDraggedColumnId(null);
                        }}
                        onDragEnd={() => setDraggedColumnId(null)}
                        className={`flex items-center space-x-2 rounded border border-gray-200 dark:border-gray-700 px-2 py-1.5 cursor-move ${draggedColumnId === column.id ? 'opacity-60' : ''}`}
                      >
                        <Checkbox
                          id={column.id}
                          checked={tempVisibleColumns.has(column.id)}
                          onCheckedChange={() => toggleColumnVisibility(column.id)}
                        />
                        <label
                          htmlFor={column.id}
                          className="text-sm font-medium leading-none cursor-pointer text-gray-800 dark:text-gray-200"
                        >
                          {column.label}
                        </label>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTempVisibleColumns(new Set(ALL_COLUMN_IDS))}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTempVisibleColumns(new Set())}
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

            {/* Group buttons */}
            <Button
              variant={groupByMode === "provider" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                const nextMode = groupByMode === "provider" ? "none" : "provider";
                setGroupingMode("provider");
                if (nextMode !== "none" && filteredByCreated.length > 0) {
                  setTimeout(() => expandAllGroups(), 0);
                }
              }}
              className={groupByMode === "provider"
                ? "bg-purple-600 hover:bg-purple-700 text-white border-none text-xs"
                : "bg-transparent border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111111] text-xs"
              }
            >
              <Building2 className="h-4 w-4 mr-1" />
              Group by Provider
            </Button>

            <Button
              variant={groupByMode === "financial_account" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                const nextMode = groupByMode === "financial_account" ? "none" : "financial_account";
                setGroupingMode("financial_account");
                if (nextMode !== "none" && filteredByCreated.length > 0) {
                  setTimeout(() => expandAllGroups(), 0);
                }
              }}
              className={groupByMode === "financial_account"
                ? "bg-purple-600 hover:bg-purple-700 text-white border-none text-xs"
                : "bg-transparent border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111111] text-xs"
              }
            >
              Group by Financial Account
            </Button>

            <Button
              variant={groupByMode === "department" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                const nextMode = groupByMode === "department" ? "none" : "department";
                setGroupingMode("department");
                if (nextMode !== "none" && filteredByCreated.length > 0) {
                  setTimeout(() => expandAllGroups(), 0);
                }
              }}
              className={groupByMode === "department"
                ? "bg-purple-600 hover:bg-purple-700 text-white border-none text-xs"
                : "bg-transparent border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111111] text-xs"
              }
            >
              Group by Department
            </Button>

            {groupByMode !== "none" && (
              <>
                <Button variant="ghost" size="sm" onClick={expandAllGroups} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white">
                  Expand All
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAllGroups} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white">
                  Collapse All
                </Button>
              </>
            )}
          </div>

          {/* Year Filter (server-side) */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="h-9 rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm text-gray-900 dark:text-white"
          >
            <option value="ALL" className="bg-gray-50 dark:bg-black">All Years</option>
            {[2026, 2025, 2024, 2023].map(y => (
              <option key={y} value={String(y)} className="bg-gray-50 dark:bg-black">{y}</option>
            ))}
          </select>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-500 dark:text-gray-400 pointer-events-none" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 bg-transparent border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 text-sm"
              />
            </div>
          </div>

          {/* Applied Filters */}
          {appliedFilters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {appliedFilters.map(filter => (
                <Badge key={filter.field} variant="secondary" className="gap-1 pr-1 bg-gray-100 dark:bg-[#0a0a0a] text-gray-600 dark:text-gray-200">
                  {filter.label}
                  <button
                    onClick={() => removeFilter(filter.field)}
                    className="ml-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-6 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white"
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => scrollTableHorizontally("left")}
              className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111111]"
              title="Scroll para a esquerda"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Scroll Left
            </Button>
          </div>
          <div className="ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => scrollTableHorizontally("right")}
              className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111111]"
              title="Scroll para a direita"
            >
              Scroll Right
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Table */}
        {error ? (
          <div className="text-center py-8 text-red-400">{error}</div>
        ) : filteredByCreated.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No invoices found</p>
            <p className="text-sm">Create your first invoice to get started</p>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div ref={tableContainerRef} className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#0a0a0a] shadow-sm">
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0a0a0a]">
                    {visibleColumns.has('actions') && (
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">Actions</th>
                    )}
                    {visibleColumns.has('split') && (
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">Split</th>
                    )}
                    {visibleColumns.has('created_by') && (
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-700 dark:text-gray-300 w-14 bg-gray-50 dark:bg-[#0a0a0a]" title="Created by user or BOTella automation">
                        <div className="flex items-center justify-center gap-1">
                          Created
                          <button
                            onClick={(e) => openFilterPopover("created_by", e)}
                            className={`hover:text-primary ${createdFilter !== 'all' ? 'text-green-400' : ''}`}
                            title="Filter by Created"
                          >
                            <Filter className={`h-3 w-3 ${createdFilter !== 'all' ? 'fill-green-400' : ''}`} />
                          </button>
                          {createdFilter !== 'all' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCreatedFilter('all');
                                setAppliedFilters(prev => prev.filter(f => f.field !== 'created_by'));
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
                    {visibleColumns.has('scope') && (
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">Scope</th>
                    )}
                    {visibleColumns.has('type') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleSort("invoice_type")} className="flex items-center gap-1 hover:text-primary">
                            Type
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => openFilterPopover("invoice_type", e)} className="hover:text-primary" title="Filter by Type">
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('input_date') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
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
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
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
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
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
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
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
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
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
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
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
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
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
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
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
                      <th className="px-2 py-1.5 text-right font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
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
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
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
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
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
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
                        <div className="flex items-center gap-1">
                          Department
                          <button onClick={(e) => openFilterPopover("cost_center_code", e)} className="hover:text-primary" title="Filter by Department">
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('sub_department') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
                        <div className="flex items-center gap-1">
                          Sub-Department
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('cost_type') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
                        <div className="flex items-center gap-1">
                          Cost Type
                          <button onClick={(e) => openFilterPopover("cost_type_code", e)} className="hover:text-primary" title="Filter by Cost Type">
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('dep_cost_type') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
                        <div className="flex items-center gap-1">
                          Dep Cost Type
                          <button onClick={(e) => openFilterPopover("dep_cost_type_code", e)} className="hover:text-primary" title="Filter by Dep Cost Type">
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('payment_status') && (
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
                        <div className="flex items-center justify-center gap-1">
                          Payment Status
                          <button
                            onClick={(e) => openFilterPopover("payment_status", e)}
                            className={`hover:text-primary ${isColumnFiltered('payment_status') ? 'text-green-600' : ''}`}
                            title="Filter by Payment Status"
                          >
                            <Filter className={`h-3 w-3 ${isColumnFiltered('payment_status') ? 'fill-green-600' : ''}`} />
                          </button>
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('is_reconciled') && (
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">Recon</th>
                    )}
                    {visibleColumns.has('payment_method') && (
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">Payment Method</th>
                    )}
                    {visibleColumns.has('bank_account') && (
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">Bank Account</th>
                    )}
                    {visibleColumns.has('payment_date') && (
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#0a0a0a]">
                        <button onClick={() => handleSort("payment_date")} className="flex items-center gap-1 hover:text-primary">
                          Payment Date
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {groupByMode !== "none" && groupedInvoices ? (
                    groupedInvoices.map((group) => (
                      <React.Fragment key={group.key}>
                        {/* Provider group header row */}
                        <tr
                          className="bg-gray-100 dark:bg-[#0a0a0a] hover:bg-gray-100 dark:hover:bg-[#2a2b2d] cursor-pointer border-b border-gray-300 dark:border-gray-600"
                          onClick={() => toggleGroup(group.key)}
                        >
                          <td colSpan={100} className="px-3 py-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {expandedGroupKeys.has(group.key) ? (
                                  <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                )}
                                <span className="font-semibold text-gray-900 dark:text-white text-sm">{group.label}</span>
                                <Badge variant="secondary" className="text-[10px] bg-gray-100 dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300">
                                  {group.invoices.length} invoice{group.invoices.length !== 1 ? "s" : ""}
                                </Badge>
                                {group.reconciledCount > 0 && (
                                  <Badge variant="secondary" className="text-[10px] bg-green-900/30 text-green-400 border border-green-700">
                                    {group.reconciledCount} reconciled
                                  </Badge>
                                )}
                              </div>
                              <span className="text-sm font-mono font-bold text-gray-900 dark:text-white">
                                € {formatEuropeanNumber(group.totalAmount)}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {/* Expanded invoices */}
                        {expandedGroupKeys.has(group.key) && group.invoices.map((invoice) => {
                          const config = INVOICE_TYPE_CONFIG[invoice.invoice_type];
                          const Icon = config.icon;
                          const financialAccount = financialAccounts.find(a => a.code === invoice.financial_account_code);
                          const paymentStatus = getComputedPaymentStatus(invoice);
                          const isBotInvoice = isAutomaticInvoice(invoice);

                          return (
                            <tr key={invoice.id} className="hover:bg-gray-100 dark:bg-black/50 group">
                              {/* Actions */}
                              {visibleColumns.has('actions') && (
                                <td className="px-2 py-1 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => openSplitDialog(invoice)} className="h-5 w-5 p-0 hover:bg-gray-100 dark:hover:bg-[#111111]" title="Split Invoice">
                                      <Split className="h-2.5 w-2.5 text-blue-400" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(invoice)} className="h-5 w-5 p-0 hover:bg-gray-100 dark:hover:bg-[#111111]">
                                      <Edit2 className="h-2.5 w-2.5 text-gray-500 dark:text-gray-400" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(invoice)} className="h-5 w-5 p-0 text-red-400 hover:text-red-300 hover:bg-gray-100 dark:hover:bg-[#111111]">
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </Button>
                                  </div>
                                </td>
                              )}

                              {/* Split Status */}
                              {visibleColumns.has('split') && (
                                <td className="px-2 py-1 text-center">
                                  {invoice.is_split && invoice.parent_invoice_id && (
                                    <Button variant="ghost" size="sm" onClick={() => viewSplits(invoice)} className="h-6 px-2 py-0 hover:bg-gray-100 dark:hover:bg-[#111111]" title={`Part ${invoice.split_number}/${invoice.total_splits}`}>
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
                                    <span className="text-gray-700 dark:text-gray-300">-</span>
                                  )}
                                </td>
                              )}

                              {/* Created By - Manual (User) or Automatic (BOTella) */}
                              {visibleColumns.has('created_by') && (
                                <td className="px-2 py-1 text-center">
                                  {isBotInvoice ? (
                                    <span title="Created automatically (BOTella/Payroll)" className="inline-flex items-center justify-center">
                                      <Zap className="h-4 w-4 text-yellow-400" />
                                    </span>
                                  ) : (
                                    <span title="Created manually by user" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-[#0a0a0a]">
                                      <User className="h-3.5 w-3.5 text-gray-700 dark:text-gray-300" />
                                    </span>
                                  )}
                                </td>
                              )}

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

                              {/* Type */}
                              {visibleColumns.has('type') && (
                                <td className="px-2 py-1">
                                  <Badge className={`text-[9px] px-1 py-0 ${config.color}`}>
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
                                        <SelectTrigger className="h-6 text-[10px] bg-gray-50 dark:bg-[#0a0a0a] text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600">
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
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-100 dark:bg-[#0a0a0a]/50 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                                        {getNameByCode(providers, invoice.provider_code)}
                                      </Badge>
                                      <button
                                        onClick={() => startInlineEdit(invoice.id, "provider_code", invoice.provider_code)}
                                        className="opacity-0 group-hover/cell:opacity-100 transition-opacity"
                                      >
                                        <Pencil className="h-3 w-3 text-gray-500 hover:text-gray-700 dark:text-gray-300" />
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
                                        <Pencil className="h-3 w-3 text-gray-500 hover:text-gray-700 dark:text-gray-300" />
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
                                        <Pencil className="h-3 w-3 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white" />
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
                                        <Pencil className="h-3 w-3 text-gray-500 hover:text-gray-700 dark:text-gray-300" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              )}

                              {/* Currency */}
                              {visibleColumns.has('currency') && (
                                <td className="px-2 py-1 text-center">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono bg-gray-100 dark:bg-[#0a0a0a]/50 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600">{invoice.currency}</Badge>
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
                                        <SelectTrigger className="h-6 text-[10px] bg-gray-50 dark:bg-[#0a0a0a] text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600">
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
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 max-w-[180px] truncate bg-gray-100 dark:bg-[#0a0a0a]/50 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600" title={financialAccount?.name}>
                                        {financialAccount?.name || invoice.financial_account_code}
                                      </Badge>
                                      <button
                                        onClick={() => startInlineEdit(invoice.id, "financial_account_code", invoice.financial_account_code)}
                                        className="opacity-0 group-hover/cell:opacity-100 transition-opacity flex-shrink-0"
                                      >
                                        <Pencil className="h-3 w-3 text-gray-500 hover:text-gray-700 dark:text-gray-300" />
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
                                        <SelectTrigger className="h-6 text-[10px] bg-gray-50 dark:bg-[#0a0a0a] text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600">
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
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 dark:bg-[#0a0a0a]/50 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                                          {getNameByCode(costCenters, invoice.cost_center_code)}
                                        </Badge>
                                      ) : (
                                        <span className="text-gray-500 dark:text-gray-400">-</span>
                                      )}
                                      <button
                                        onClick={() => startInlineEdit(invoice.id, "cost_center_code", invoice.cost_center_code)}
                                        className="opacity-0 group-hover/cell:opacity-100 transition-opacity"
                                      >
                                        <Pencil className="h-3 w-3 text-gray-500 hover:text-gray-700 dark:text-gray-300" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              )}

                              {/* Sub-Department */}
                              {visibleColumns.has('sub_department') && (
                                <td className="px-2 py-1 text-center">
                                  {invoice.sub_department_code ? (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-900/30 text-purple-400 border-purple-700">
                                      {subDepartments.find(sd => sd.code === invoice.sub_department_code)?.name || invoice.sub_department_code}
                                    </Badge>
                                  ) : (
                                    <span className="text-gray-500 dark:text-gray-400">-</span>
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
                                        <SelectTrigger className="h-6 text-[10px] bg-gray-50 dark:bg-[#0a0a0a] text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600">
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
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 dark:bg-[#0a0a0a]/50 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                                          {getCostTypeDisplay(invoice.cost_type_code)}
                                        </Badge>
                                      ) : (
                                        <span className="text-gray-500 dark:text-gray-400">-</span>
                                      )}
                                      <button
                                        onClick={() => startInlineEdit(invoice.id, "cost_type_code", invoice.cost_type_code)}
                                        className="opacity-0 group-hover/cell:opacity-100 transition-opacity"
                                      >
                                        <Pencil className="h-3 w-3 text-gray-500 hover:text-gray-700 dark:text-gray-300" />
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
                                        <SelectTrigger className="h-6 text-[10px] bg-gray-50 dark:bg-[#0a0a0a] text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600">
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
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 dark:bg-[#0a0a0a]/50 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                                          {getNameByCode(depCostTypes, invoice.dep_cost_type_code)}
                                        </Badge>
                                      ) : (
                                        <span className="text-gray-500 dark:text-gray-400">-</span>
                                      )}
                                      <button
                                        onClick={() => startInlineEdit(invoice.id, "dep_cost_type_code", invoice.dep_cost_type_code)}
                                        className="opacity-0 group-hover/cell:opacity-100 transition-opacity"
                                      >
                                        <Pencil className="h-3 w-3 text-gray-500 hover:text-gray-700 dark:text-gray-300" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              )}

                              {/* Payment Status */}
                              {visibleColumns.has('payment_status') && (
                                <td className="px-2 py-1 text-center">
                                  <Badge
                                    variant={paymentStatus === 'PAID' ? 'default' : 'outline'}
                                    className={`text-[10px] px-1.5 py-0 border ${paymentStatus === 'PAID'
                                      ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-200 dark:border-green-700'
                                      : paymentStatus === 'SCHEDULED'
                                        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700'
                                        : 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-[#111111] dark:text-gray-200 dark:border-gray-600'
                                      }`}
                                  >
                                    {paymentStatus.replace('_', ' ')}
                                  </Badge>
                                </td>
                              )}

                              {/* Recon Status */}
                              {visibleColumns.has('is_reconciled') && (
                                <td className="px-2 py-1 text-center">
                                  {invoice.is_reconciled ? (
                                    <span title={`Reconciled${invoice.reconciled_at ? ' on ' + new Date(invoice.reconciled_at).toLocaleDateString('pt-BR') : ''}`}>
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400 inline" />
                                    </span>
                                  ) : (
                                    <span className="text-gray-500" title="Not reconciled">-</span>
                                  )}
                                </td>
                              )}

                              {/* Payment Method - NO INLINE EDIT (set by reconciliation) */}
                              {visibleColumns.has('payment_method') && (
                                <td className="px-2 py-1 text-center">
                                  {invoice.payment_method_code ? (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-100 dark:bg-[#0a0a0a]/50 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                                      {getNameByCode(paymentMethods, invoice.payment_method_code)}
                                    </Badge>
                                  ) : <span className="text-gray-500 dark:text-gray-400">-</span>}
                                </td>
                              )}

                              {/* Bank Account - NO INLINE EDIT (set by reconciliation) */}
                              {visibleColumns.has('bank_account') && (
                                <td className="px-2 py-1 text-center">
                                  {invoice.bank_account_code ? (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-100 dark:bg-[#0a0a0a]/50 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                                      {getNameByCode(bankAccounts, invoice.bank_account_code)}
                                    </Badge>
                                  ) : <span className="text-gray-500 dark:text-gray-400">-</span>}
                                </td>
                              )}

                              {/* Payment Date - NO INLINE EDIT (set by reconciliation) */}
                              {visibleColumns.has('payment_date') && (
                                <td className="px-2 py-1 text-[11px]">
                                  {invoice.payment_date ? new Date(invoice.payment_date).toLocaleDateString('pt-BR') : <span className="text-gray-500 dark:text-gray-400">-</span>}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))
                  ) : (
                    filteredByCreated.map((invoice) => {
                      const config = INVOICE_TYPE_CONFIG[invoice.invoice_type];
                      const Icon = config.icon;
                      const financialAccount = financialAccounts.find(a => a.code === invoice.financial_account_code);
                      const paymentStatus = getComputedPaymentStatus(invoice);
                      const isBotInvoice = invoice.invoice_number?.startsWith('BOT-');

                      return (
                        <tr key={invoice.id} className="hover:bg-gray-100 dark:bg-black/50 group">

                          {visibleColumns.has('actions') && (
                            <td className="px-2 py-1 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openSplitDialog(invoice)} className="h-5 w-5 p-0 hover:bg-gray-100 dark:hover:bg-[#111111]" title="Split Invoice">
                                  <Split className="h-2.5 w-2.5 text-blue-400" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(invoice)} className="h-5 w-5 p-0 hover:bg-gray-100 dark:hover:bg-[#111111]">
                                  <Edit2 className="h-2.5 w-2.5 text-gray-500 dark:text-gray-400" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(invoice)} className="h-5 w-5 p-0 text-red-400 hover:text-red-300 hover:bg-gray-100 dark:hover:bg-[#111111]">
                                  <Trash2 className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                            </td>
                          )}

                          {visibleColumns.has('split') && (
                            <td className="px-2 py-1 text-center">
                              {invoice.is_split ? (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-900/30 text-blue-400 border border-blue-700">
                                  {invoice.split_number && invoice.total_splits ? `${invoice.split_number}/${invoice.total_splits}` : 'SPLIT'}
                                </Badge>
                              ) : <span className="text-gray-500 dark:text-gray-400">-</span>}
                            </td>
                          )}

                          {visibleColumns.has('created_by') && (
                            <td className="px-2 py-1 text-center">
                              {isBotInvoice ? (
                                <span title="Created automatically by BOTella" className="inline-flex items-center justify-center">
                                  <Zap className="h-4 w-4 text-yellow-400" />
                                </span>
                              ) : (
                                <span title="Created manually by user" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-[#0a0a0a]">
                                  <User className="h-3.5 w-3.5 text-gray-700 dark:text-gray-300" />
                                </span>
                              )}
                            </td>
                          )}

                          {visibleColumns.has('scope') && (
                            <td className="px-2 py-1 text-center">
                              <span className="text-[10px]">{getScopeIcon(getRecordScope(invoice))}</span>
                            </td>
                          )}

                          {visibleColumns.has('type') && (
                            <td className="px-2 py-1 text-center">
                              <div className={`inline-flex items-center gap-1 px-1 py-0 rounded text-[9px] ${config.color}`} title={invoice.invoice_type}>
                                <Icon className="h-2.5 w-2.5" />
                                {config.label}
                              </div>
                            </td>
                          )}

                          {visibleColumns.has('input_date') && (
                            <td className="px-2 py-1 text-[11px]">{invoice.input_date ? new Date(invoice.input_date).toLocaleDateString('pt-BR') : <span className="text-gray-500 dark:text-gray-400">-</span>}</td>
                          )}

                          {visibleColumns.has('invoice_date') && (
                            <td className="px-2 py-1 text-[11px]">{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('pt-BR') : <span className="text-gray-500 dark:text-gray-400">-</span>}</td>
                          )}

                          {visibleColumns.has('benefit_date') && (
                            <td className="px-2 py-1 text-[11px]">{invoice.benefit_date ? new Date(invoice.benefit_date).toLocaleDateString('pt-BR') : <span className="text-gray-500 dark:text-gray-400">-</span>}</td>
                          )}

                          {visibleColumns.has('due_date') && (
                            <td className="px-2 py-1 text-[11px]">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('pt-BR') : <span className="text-gray-500 dark:text-gray-400">-</span>}</td>
                          )}

                          {visibleColumns.has('schedule_date') && (
                            <td className="px-2 py-1 text-[11px]">{invoice.schedule_date ? new Date(invoice.schedule_date).toLocaleDateString('pt-BR') : <span className="text-gray-500 dark:text-gray-400">-</span>}</td>
                          )}

                          {visibleColumns.has('provider') && (
                            <td className="px-2 py-1 text-[11px] text-gray-600 dark:text-gray-200 whitespace-nowrap max-w-[150px] truncate" title={getNameByCode(providers, invoice.provider_code)}>
                              {getNameByCode(providers, invoice.provider_code)}
                            </td>
                          )}

                          {visibleColumns.has('description') && (
                            <td className="px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300 max-w-[200px] truncate" title={invoice.description || undefined}>
                              {invoice.description || <span className="text-gray-500">-</span>}
                            </td>
                          )}

                          {visibleColumns.has('invoice_number') && (
                            <td className="px-2 py-1 text-[11px] font-mono text-gray-900 dark:text-white whitespace-nowrap">
                              {invoice.invoice_number || <span className="text-gray-500 dark:text-gray-400">-</span>}
                            </td>
                          )}

                          {visibleColumns.has('amount') && (
                            <td className="px-2 py-1 text-right text-[11px] font-mono text-gray-900 dark:text-white whitespace-nowrap">
                              {invoice.currency !== "EUR" ? (
                                <div>
                                  <span>{formatEuropeanNumber(invoice.invoice_amount)} {invoice.currency}</span>
                                  <span className="text-gray-500 text-[9px] block">€ {formatEuropeanNumber(invoice.invoice_amount * invoice.eur_exchange)}</span>
                                </div>
                              ) : (
                                <>€ {formatEuropeanNumber(invoice.invoice_amount)}</>
                              )}
                            </td>
                          )}

                          {visibleColumns.has('currency') && (
                            <td className="px-2 py-1 text-center">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono bg-gray-100 dark:bg-[#0a0a0a]/50 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600">{invoice.currency}</Badge>
                            </td>
                          )}

                          {visibleColumns.has('financial_account') && (
                            <td className="px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300 max-w-[120px] truncate" title={financialAccount?.name || invoice.financial_account_code}>
                              {financialAccount?.name || invoice.financial_account_code || <span className="text-gray-500">-</span>}
                            </td>
                          )}

                          {visibleColumns.has('cost_center') && (
                            <td className="px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300 max-w-[100px] truncate" title={getNameByCode(costCenters, invoice.cost_center_code || '')}>
                              {getNameByCode(costCenters, invoice.cost_center_code || '') || <span className="text-gray-500 dark:text-gray-400">-</span>}
                            </td>
                          )}

                          {visibleColumns.has('sub_department') && (
                            <td className="px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300 max-w-[120px] truncate" title={invoice.sub_department_code ? (subDepartments.find(sd => sd.code === invoice.sub_department_code)?.name || invoice.sub_department_code) : '-'}>
                              {invoice.sub_department_code ? (subDepartments.find(sd => sd.code === invoice.sub_department_code)?.name || invoice.sub_department_code) : <span className="text-gray-500 dark:text-gray-400">-</span>}
                            </td>
                          )}

                          {visibleColumns.has('cost_type') && (
                            <td className="px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300 max-w-[100px] truncate" title={getCostTypeDisplay(invoice.cost_type_code || '')}>
                              {getCostTypeDisplay(invoice.cost_type_code || '') || <span className="text-gray-500 dark:text-gray-400">-</span>}
                            </td>
                          )}

                          {visibleColumns.has('dep_cost_type') && (
                            <td className="px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300 max-w-[100px] truncate" title={getNameByCode(depCostTypes, invoice.dep_cost_type_code || '')}>
                              {getNameByCode(depCostTypes, invoice.dep_cost_type_code || '') || <span className="text-gray-500 dark:text-gray-400">-</span>}
                            </td>
                          )}

                          {visibleColumns.has('payment_status') && (
                            <td className="px-2 py-1 text-center text-[10px]">
                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border ${paymentStatus === 'PAID' ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-200 dark:border-green-700' :
                                paymentStatus === 'SCHEDULED' ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700' :
                                  'bg-gray-100 text-gray-800 border-gray-300 dark:bg-[#111111] dark:text-gray-200 dark:border-gray-600'
                                }`}>
                                {paymentStatus.replace('_', ' ')}
                              </Badge>
                            </td>
                          )}

                          {visibleColumns.has('is_reconciled') && (
                            <td className="px-2 py-1 text-center">
                              {invoice.is_reconciled ? (
                                <div className="flex items-center justify-center gap-1">
                                  {isBotInvoice ? (
                                    <span title="Auto-reconciled"><Zap className="h-3.5 w-3.5 text-green-500" /></span>
                                  ) : (
                                    <span title="Manually reconciled"><User className="h-3.5 w-3.5 text-blue-500" /></span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-500 text-[10px]">-</span>
                              )}
                            </td>
                          )}

                          {visibleColumns.has('payment_method') && (
                            <td className="px-2 py-1 text-center text-[10px]">
                              {invoice.payment_method_code ? (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-gray-100 dark:bg-[#0a0a0a]/50 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                                  {invoice.payment_method_code}
                                </Badge>
                              ) : <span className="text-gray-500 dark:text-gray-400">-</span>}
                            </td>
                          )}

                          {visibleColumns.has('bank_account') && (
                            <td className="px-2 py-1 text-center">
                              {invoice.bank_account_code ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-100 dark:bg-[#0a0a0a]/50 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                                  {getNameByCode(bankAccounts, invoice.bank_account_code || '')}
                                </Badge>
                              ) : <span className="text-gray-500 dark:text-gray-400">-</span>}
                            </td>
                          )}

                          {visibleColumns.has('payment_date') && (
                            <td className="px-2 py-1 text-[11px]">
                              {invoice.payment_date ? new Date(invoice.payment_date).toLocaleDateString('pt-BR') : <span className="text-gray-500 dark:text-gray-400">-</span>}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table >
            </div >
          </div >
        )
        }

        <div className="mt-4 pb-6 text-sm text-gray-500 dark:text-gray-400">
          Showing {filteredInvoices.length} of {invoices.length} invoices{selectedYear !== "ALL" ? ` (${selectedYear})` : " (all years)"}
        </div>
      </div >

      {/* Multi-Select Filter Dialog */}
      {
        filterPopoverOpen && (
          <Dialog open={!!filterPopoverOpen} onOpenChange={() => closeFilterPopover()}>
            <DialogContent className={`bg-white dark:bg-black ${['input_date', 'invoice_date', 'benefit_date', 'due_date', 'schedule_date'].includes(filterPopoverOpen.field) ? 'max-w-[980px] w-[96vw] max-h-[90vh] overflow-y-auto' : 'max-w-md'}`}>
              <DialogHeader>
                <DialogTitle>Filter by {filterPopoverOpen.field.replace(/_/g, ' ')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {(() => {
                  const field = filterPopoverOpen.field;

                  // Date filters
                  if (['input_date', 'invoice_date', 'benefit_date', 'due_date', 'schedule_date'].includes(field)) {
                    const presets = ["This Week", "Last Week", "Next Week", "This Month", "Last Month", "Next Year"];
                    return (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
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
                        <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Selecionar intervalo:</Label>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0a0a0a] px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Data inicial</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                                {calendarRange?.from ? calendarRange.from.toLocaleDateString('pt-PT') : 'Não selecionada'}
                              </p>
                            </div>
                            <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0a0a0a] px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Data final</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                                {calendarRange?.to ? calendarRange.to.toLocaleDateString('pt-PT') : 'Não selecionada'}
                              </p>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-[680px]">
                              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-black">
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Calendário da data inicial</p>
                                <Calendar
                                  mode="single"
                                  selected={calendarRange?.from}
                                  onSelect={(date) => setCalendarRange(prev => ({ from: date, to: prev?.to }))}
                                  className="rounded-md"
                                />
                              </div>
                              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-black">
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Calendário da data final</p>
                                <Calendar
                                  mode="single"
                                  selected={calendarRange?.to}
                                  onSelect={(date) => setCalendarRange(prev => ({ from: prev?.from, to: date }))}
                                  className="rounded-md"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            {calendarRange?.from || calendarRange?.to ? (
                              <span className="text-xs text-gray-600 dark:text-gray-300">
                                {calendarRange?.from ? calendarRange.from.toLocaleDateString('pt-PT') : '...'}
                                {' → '}
                                {calendarRange?.to ? calendarRange.to.toLocaleDateString('pt-PT') : '...'}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-gray-400">Selecione a data inicial e final</span>
                            )}

                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCalendarRange(undefined)}
                              >
                                Limpar datas
                              </Button>
                              <Button
                                size="sm"
                                disabled={!calendarRange?.from || !calendarRange?.to}
                                onClick={() => {
                                  if (calendarRange?.from && calendarRange?.to) {
                                    const fromTime = calendarRange.from.getTime();
                                    const toTime = calendarRange.to.getTime();
                                    const startDate = fromTime <= toTime ? calendarRange.from : calendarRange.to;
                                    const endDate = fromTime <= toTime ? calendarRange.to : calendarRange.from;
                                    const start = startDate.toISOString().split('T')[0];
                                    const end = endDate.toISOString().split('T')[0];
                                    setDateFilters(prev => ({ ...prev, [field]: { start, end } }));
                                    setAppliedFilters(prev => {
                                      const filtered = prev.filter(f => f.field !== field);
                                      return [...filtered, { field, value: `${start} to ${end}`, label: `${field}: ${start} to ${end}` }];
                                    });
                                    closeFilterPopover();
                                  }
                                }}
                              >
                                Aplicar
                              </Button>
                            </div>
                          </div>
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

                  // Created By filter
                  if (field === 'created_by') {
                    const createdOptions = [
                      { value: 'all', label: 'Todos' },
                      { value: 'bot', label: 'Automáticas (BOTella/Payroll)' },
                      { value: 'manual', label: 'Manuais (Usuário)' },
                    ];
                    return (
                      <div className="space-y-1">
                        {createdOptions.map(opt => (
                          <div
                            key={opt.value}
                            className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-gray-100 ${createdFilter === opt.value ? 'bg-blue-50 border border-blue-200' : ''
                              }`}
                            onClick={() => {
                              setCreatedFilter(opt.value as 'all' | 'bot' | 'manual');
                              if (opt.value === 'all') {
                                setAppliedFilters(prev => prev.filter(f => f.field !== 'created_by'));
                              } else {
                                setAppliedFilters(prev => {
                                  const filtered = prev.filter(f => f.field !== 'created_by');
                                  return [...filtered, { field: 'created_by', value: opt.value, label: `Created: ${opt.label}` }];
                                });
                              }
                              closeFilterPopover();
                            }}
                          >
                            <span className="text-sm">{opt.label}</span>
                            {createdFilter === opt.value && (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                        ))}
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

                  const options = getDynamicFilterOptions(field);
                  const searchTermLower = filterSearchTerm.toLowerCase();
                  const filtered = options.filter(opt =>
                    opt.label.toLowerCase().includes(searchTermLower) ||
                    opt.value.toLowerCase().includes(searchTermLower)
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
