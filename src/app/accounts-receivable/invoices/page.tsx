"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Search, ArrowUpDown, DollarSign, Trash2, Pencil, Download, CheckCircle2, AlertCircle, Clock, RefreshCw, FileText, TrendingUp, Loader2, Link2, Unlink, X, Eye, ExternalLink } from "lucide-react";
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { ScopeSelector } from "@/components/app/scope-selector";
import { type ScopeType, matchesScope } from "@/lib/scope-utils";
import { useGlobalScope } from "@/contexts/global-scope-context";

interface ARInvoice {
  id: number;
  invoice_number: string;
  order_id: string | null;
  order_date: string | null;
  order_status: string | null;
  deal_status: string | null;
  invoice_date: string;
  products: string | null;
  company_name: string | null;
  client_name: string | null;
  email: string | null;
  total_amount: number;
  currency: string;
  charged_amount: number | null;
  payment_method: string | null;
  billing_entity: string | null;
  note: string | null;
  discount_code: string | null;
  discount_names: string | null;
  status: string;
  due_date: string | null;
  payment_date: string | null;
  country_code: string;
  scope: string;
  source: string | null;
  source_id: string | null;
  reconciled?: boolean;
  reconciled_at?: string;
  reconciled_with?: string;
  payment_reference?: string;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-gray-700/50 text-gray-300 border border-gray-600" },
  pending: { label: "Pendente", color: "bg-yellow-900/30 text-yellow-400 border border-yellow-700" },
  sent: { label: "Enviada", color: "bg-blue-900/30 text-blue-400 border border-blue-700" },
  paid: { label: "Paga", color: "bg-green-900/30 text-green-400 border border-green-700" },
  partial: { label: "Parcial", color: "bg-orange-900/30 text-orange-400 border border-orange-700" },
  overdue: { label: "Vencida", color: "bg-red-900/30 text-red-400 border border-red-700" },
  cancelled: { label: "Cancelada", color: "bg-gray-800/50 text-gray-500 border border-gray-700" }
};

const PAYMENT_METHODS = ["Braintree", "Stripe", "GoCardless", "PayPal", "Bank Transfer", "Credit Card", "Other"];
const BILLING_ENTITIES = ["Planning Center SL.", "DSD ESP", "DSD US LLC"];

function formatEuropeanNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  // Usar UTC para evitar conversão de timezone (d-1)
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

const EMPTY_INVOICE: Partial<ARInvoice> = {
  invoice_number: "",
  order_id: "",
  order_date: "",
  order_status: "",
  invoice_date: new Date().toISOString().split("T")[0],
  products: "",
  company_name: "",
  client_name: "",
  email: "",
  total_amount: 0,
  currency: "EUR",
  charged_amount: null,
  payment_method: "",
  billing_entity: "",
  note: "",
  discount_code: "",
  discount_names: "",
  status: "pending",
  due_date: "",
  country_code: "ES",
  scope: "ES",
  source: "manual"
};

export default function ARInvoicesPage() {
  const { selectedScope, setSelectedScope } = useGlobalScope();
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Partial<ARInvoice> | null>(null);
  const [manualReconcileDialog, setManualReconcileDialog] = useState(false);
  const [reconcileTarget, setReconcileTarget] = useState<ARInvoice | null>(null);
  const [reconcileSource, setReconcileSource] = useState("credit-payment");
  const [reconcileReference, setReconcileReference] = useState("");
  const [transactionDetailsDialog, setTransactionDetailsDialog] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const [loadingTransactionDetails, setLoadingTransactionDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [sortField, setSortField] = useState<string>("invoice_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Buscar TODOS os registros usando paginação
      let allData: any[] = [];
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from("ar_invoices")
          .select("*")
          .order("invoice_date", { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allData = allData.concat(data);
        if (data.length < batchSize) break;
        offset += batchSize;
      }

      setInvoices(allData);
    } catch (e: any) {
      if (e?.message?.includes("does not exist") || e?.code === "42P01") {
        setError("Tabela ar_invoices não existe. Execute a migration SQL primeiro.");
      } else {
        setError(e?.message || "Erro ao carregar invoices");
      }
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Sync automático com HubSpot (dados do csv_rows)
  const syncFromHubSpot = async () => {
    setSyncing(true);
    try {
      // Buscar TODAS as orders do HubSpot usando paginação
      let hubspotOrders: any[] = [];
      let offset = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from("csv_rows")
          .select("*")
          .eq("source", "hubspot")
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        hubspotOrders = hubspotOrders.concat(data);
        console.log(`📦 Carregados ${hubspotOrders.length} registros...`);

        if (data.length < pageSize) break;
        offset += pageSize;
      }

      if (hubspotOrders.length === 0) {
        toast({ title: "Info", description: "Nenhum pedido HubSpot encontrado para sincronizar" });
        setSyncing(false);
        return;
      }

      console.log(`📦 Total carregado: ${hubspotOrders.length} registros`);

      // Filtrar por data: >= 2025-12-01 e <= hoje
      const minDate = new Date('2025-12-01');
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      // Filtrar: data válida + ecommerce_deal = true + não TEST_
      const validOrders = hubspotOrders.filter(order => {
        const cd = order.custom_data || {};

        // Filtro de data
        const dateStr = cd.date_ordered || cd.date_paid || order.date;
        if (!dateStr) return false;
        const orderDate = new Date(dateStr);
        if (orderDate < minDate || orderDate > today) return false;

        // Excluir orders de teste
        const dealname = (cd.dealname || "").toUpperCase();
        const orderCode = (cd.order_code || "").toUpperCase();
        if (dealname.startsWith('TEST_') || orderCode.startsWith('TEST_')) return false;

        // Excluir se ecommerce_deal = false (não é order de produção)
        if (cd.ecommerce_deal === false || cd.ecommerce_deal === "false") return false;

        return true;
      });

      console.log(`📦 Após filtros: ${validOrders.length} orders válidas`);

      // Deletar todos os registros HubSpot existentes para fazer sync completo
      // Isso evita erro 409 de conflito de source_id
      const { error: deleteError } = await supabase
        .from("ar_invoices")
        .delete()
        .eq("source", "hubspot");

      if (deleteError) {
        console.error("Erro ao deletar registros antigos:", deleteError);
        // Continuar mesmo com erro de delete
      }

      // Helper para formatar status
      const mapStatus = (paidStatus: string | undefined): string => {
        if (!paidStatus) return "pending";
        const status = paidStatus.toLowerCase();
        if (status === "paid" || status.includes("paid")) return "paid";
        if (status === "partial") return "partial";
        return "pending";
      };

      // Helper para extrair código de ordem (apenas se for hash curto)
      const extractOrderCode = (orderCode: string | undefined, dealname: string | undefined): string | null => {
        if (orderCode && orderCode.length < 15 && orderCode !== dealname) return orderCode;
        if (orderCode && (orderCode.startsWith('TEST_') || /^[a-f0-9]{7,8}$/i.test(orderCode))) return orderCode;
        return null;
      };

      // Helper para extrair nome do produto
      const extractProductName = (cd: Record<string, unknown>): string | null => {
        if (cd.product_name && cd.product_name !== cd.order_code) return String(cd.product_name);
        let name = String(cd.dealname || cd.product_name || "");
        if (name) {
          name = name.replace(/^(PM|TA|WIN BACK STRATEGY|CHECKOUT PENDING|CONTACT US COURSES)\s*-?\s*/i, '');
          name = name.replace(/\s*-\s*[^\s]+@[^\s]+\s*(ROW|AMEX|APAC)?$/i, '');
          if (/^[a-f0-9]{6,8}$/i.test(name.trim())) return String(cd.dealname) || null;
        }
        return name || null;
      };

      // Criar invoices com mapeamento CORRIGIDO
      const invoicesToInsert = validOrders.map((order) => {
        const cd = order.custom_data || {};
        const shortId = String(order.id).replace(/-/g, '').slice(0, 12).toUpperCase();
        const orderCode = extractOrderCode(cd.order_code as string, cd.dealname as string);
        const productName = extractProductName(cd);
        const invoiceDate = cd.date_paid || cd.date_ordered || order.date;

        const firstName = cd.customer_firstname || cd.customerFirstname || "";
        const lastName = cd.customer_lastname || cd.customerLastname || "";
        const clientName = `${firstName} ${lastName}`.trim() || null;

        return {
          invoice_number: `HS-${shortId}`,
          order_id: orderCode,
          order_date: cd.date_ordered || order.date || null,
          order_status: cd.paid_status || null,
          invoice_date: invoiceDate,
          products: productName,
          company_name: cd.company_name || cd.company || null,
          client_name: clientName,
          email: cd.customer_email || null,
          total_amount: parseFloat(String(cd.final_price || cd.total_price || order.amount)) || 0,
          currency: cd.currency || "EUR",
          payment_method: cd.gateway_name || null,
          status: mapStatus(cd.paid_status as string),
          country_code: "ES",
          scope: "ES",
          source: "hubspot",
          source_id: String(order.id)
        };
      });

      // Inserir em batches para evitar timeout
      const BATCH_SIZE = 100;
      let insertedCount = 0;
      for (let i = 0; i < invoicesToInsert.length; i += BATCH_SIZE) {
        const batch = invoicesToInsert.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from("ar_invoices").insert(batch);
        if (insertError) throw insertError;
        insertedCount += batch.length;
      }

      toast({ title: "Sucesso", description: `${insertedCount} invoices sincronizadas do HubSpot` });
      loadInvoices();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("Erro ao sincronizar HubSpot:", err);
      toast({ title: "Erro", description: `Falha ao sincronizar: ${errorMessage}`, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  // Reconciliação automática com gateways de pagamento
  const runAutoReconcile = async () => {
    setReconciling(true);
    try {
      const response = await fetch('/api/reconcile/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false })
      });
      const result = await response.json();

      if (result.success) {
        const { summary } = result;
        toast({
          title: "Reconciliação Concluída",
          description: `${summary.updated} invoices reconciliadas (Braintree: ${summary.bySource.braintree}, Stripe: ${summary.bySource.stripe}, GoCardless: ${summary.bySource.gocardless})`
        });
        loadInvoices();
      } else {
        throw new Error(result.error || 'Erro na reconciliação');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("Erro na reconciliação:", err);
      toast({ title: "Erro", description: `Falha na reconciliação: ${errorMessage}`, variant: "destructive" });
    } finally {
      setReconciling(false);
    }
  };

  // Reconciliação manual
  const openManualReconcile = (invoice: ARInvoice) => {
    setReconcileTarget(invoice);
    setReconcileSource("credit-payment");
    setReconcileReference("");
    setManualReconcileDialog(true);
  };

  const handleManualReconcile = async () => {
    if (!reconcileTarget) return;

    try {
      const response = await fetch('/api/reconcile/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: reconcileTarget.id,
          paymentSource: reconcileSource,
          paymentReference: reconcileReference || undefined
        })
      });
      const result = await response.json();

      if (result.success) {
        toast({ title: "Sucesso", description: `Invoice ${reconcileTarget.invoice_number} reconciliada manualmente` });
        setManualReconcileDialog(false);
        loadInvoices();
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleRemoveReconciliation = async (invoice: ARInvoice) => {
    if (!confirm(`Remover reconciliação de ${invoice.invoice_number}?`)) return;

    try {
      const response = await fetch(`/api/reconcile/manual?invoiceId=${invoice.id}`, {
        method: 'DELETE'
      });
      const result = await response.json();

      if (result.success) {
        toast({ title: "Sucesso", description: "Reconciliação removida" });
        loadInvoices();
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // Carregar detalhes da transação reconciliada
  const loadTransactionDetails = async (invoice: ARInvoice) => {
    if (!invoice.reconciled || !invoice.reconciled_with) return;

    setLoadingTransactionDetails(true);
    setTransactionDetailsDialog(true);
    setTransactionDetails(null);

    try {
      const [source, transactionId] = invoice.reconciled_with.split(':');

      if (!transactionId || !['braintree', 'gocardless', 'stripe'].includes(source)) {
        // Mostrar apenas informações básicas para reconciliações manuais
        setTransactionDetails({
          type: 'manual',
          source: source,
          invoice: invoice,
          reference: invoice.payment_reference || transactionId || 'N/A'
        });
        return;
      }

      // Buscar transação no csv_rows
      let query = supabase.from("csv_rows").select("*");

      if (source === 'braintree') {
        query = query.or(`custom_data->>transaction_id.eq.${transactionId},id.eq.${transactionId}`);
      } else if (source === 'gocardless') {
        query = query.or(`custom_data->>gocardless_id.eq.${transactionId},custom_data->>payment_id.eq.${transactionId}`);
      } else if (source === 'stripe') {
        query = query.or(`custom_data->>transaction_id.eq.${transactionId},custom_data->>charge_id.eq.${transactionId}`);
      }

      const { data, error } = await query.limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const tx = data[0];
        setTransactionDetails({
          type: 'payment',
          source: source,
          invoice: invoice,
          transaction: tx,
          custom_data: tx.custom_data || {}
        });
      } else {
        setTransactionDetails({
          type: 'not_found',
          source: source,
          invoice: invoice,
          transactionId: transactionId
        });
      }
    } catch (err) {
      console.error("Erro ao carregar detalhes:", err);
      setTransactionDetails({
        type: 'error',
        source: invoice.reconciled_with?.split(':')[0],
        invoice: invoice,
        error: err instanceof Error ? err.message : 'Erro desconhecido'
      });
    } finally {
      setLoadingTransactionDetails(false);
    }
  };

  // Gerar URL para payment source
  const getPaymentSourceUrl = (source: string, transactionId: string) => {
    switch (source) {
      case 'braintree':
        return `https://www.braintreegateway.com/merchants/YOUR_MERCHANT_ID/transactions/${transactionId}`;
      case 'gocardless':
        return `https://manage.gocardless.com/payments/${transactionId}`;
      case 'stripe':
        return `https://dashboard.stripe.com/payments/${transactionId}`;
      default:
        return null;
    }
  };

  const handleSave = async () => {
    if (!editingInvoice) return;
    if (!editingInvoice.invoice_number?.trim()) {
      toast({ title: "Erro", description: "Número da invoice é obrigatório", variant: "destructive" });
      return;
    }
    if (!editingInvoice.invoice_date) {
      toast({ title: "Erro", description: "Data da invoice é obrigatória", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingInvoice.id) {
        const { error } = await supabase
          .from("ar_invoices")
          .update({ ...editingInvoice, updated_at: new Date().toISOString() })
          .eq("id", editingInvoice.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Invoice atualizada" });
      } else {
        const { error } = await supabase.from("ar_invoices").insert({
          ...editingInvoice,
          created_at: new Date().toISOString()
        });
        if (error) throw error;
        toast({ title: "Sucesso", description: "Invoice criada" });
      }
      setDialogOpen(false);
      setEditingInvoice(null);
      loadInvoices();
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      toast({ title: "Erro", description: err?.message || "Falha ao salvar invoice", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta invoice?")) return;
    try {
      const { error } = await supabase.from("ar_invoices").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Invoice excluída" });
      loadInvoices();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  const handleEdit = (invoice: ARInvoice) => {
    setEditingInvoice({ ...invoice });
    setDialogOpen(true);
  };

  const filteredInvoices = useMemo(() => {
    let result = invoices.filter(inv => matchesScope(inv.scope, selectedScope));

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(inv =>
        inv.invoice_number?.toLowerCase().includes(term) ||
        inv.client_name?.toLowerCase().includes(term) ||
        inv.company_name?.toLowerCase().includes(term) ||
        inv.email?.toLowerCase().includes(term) ||
        inv.products?.toLowerCase().includes(term) ||
        inv.order_id?.toLowerCase().includes(term)
      );
    }

    if (selectedStatus !== "ALL") {
      result = result.filter(inv => inv.status === selectedStatus);
    }

    result.sort((a, b) => {
      let aVal: any = a[sortField as keyof ARInvoice];
      let bVal: any = b[sortField as keyof ARInvoice];
      if (sortField.includes("date")) {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      }
      if (sortDirection === "asc") return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });

    return result;
  }, [invoices, searchTerm, selectedStatus, sortField, sortDirection, selectedScope]);

  // Stats
  const stats = useMemo(() => {
    const scopeInvoices = invoices.filter(inv => matchesScope(inv.scope, selectedScope));
    const total = scopeInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
    const paid = scopeInvoices.filter(i => i.status === "paid");
    const paidTotal = paid.reduce((sum, i) => sum + (i.total_amount || 0), 0);
    const pending = scopeInvoices.filter(i => ["pending", "sent"].includes(i.status));
    const pendingTotal = pending.reduce((sum, i) => sum + (i.total_amount || 0), 0);
    const overdue = scopeInvoices.filter(i => i.status === "overdue");
    const overdueTotal = overdue.reduce((sum, i) => sum + (i.total_amount || 0), 0);
    const reconciled = scopeInvoices.filter(i => i.reconciled === true);
    const reconciledTotal = reconciled.reduce((sum, i) => sum + (i.total_amount || 0), 0);
    const notReconciled = scopeInvoices.filter(i => !i.reconciled);
    return {
      total, totalCount: scopeInvoices.length,
      paidTotal, paidCount: paid.length,
      pendingTotal, pendingCount: pending.length,
      overdueTotal, overdueCount: overdue.length,
      reconciledTotal, reconciledCount: reconciled.length,
      notReconciledCount: notReconciled.length
    };
  }, [invoices, selectedScope]);

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }

  function exportToExcel() {
    const data = filteredInvoices.map(inv => ({
      "Number": inv.invoice_number,
      "Order": inv.order_id,
      "Order Date": inv.order_date,
      "Order Status": inv.order_status,
      "Invoice Date": inv.invoice_date,
      "Products": inv.products,
      "Company": inv.company_name,
      "Client": inv.client_name,
      "Email": inv.email,
      "Total": inv.total_amount,
      "Currency": inv.currency,
      "Charged": inv.charged_amount,
      "Payment Method": inv.payment_method,
      "Billing Entity": inv.billing_entity,
      "Note": inv.note,
      "Discount Code": inv.discount_code,
      "Discount Names": inv.discount_names,
      "Status": inv.status,
      "Source": inv.source
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AR Invoices");
    XLSX.writeFile(wb, `ar-invoices-${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  return (
    <div className="min-h-screen bg-[#1e1f21] text-white">
      {/* Header */}
      <div className="border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">AR Invoices</h1>
            <span className="text-gray-400">•</span>
            <span className="text-gray-400 text-sm">Contas a Receber</span>
          </div>
          <ScopeSelector value={selectedScope} onValueChange={setSelectedScope} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-700" onClick={runAutoReconcile} disabled={reconciling}>
              {reconciling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
              Reconciliar
            </Button>
            <Button variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-700" onClick={syncFromHubSpot} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Sync
            </Button>
            <Button variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-700" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => { setEditingInvoice({ ...EMPTY_INVOICE, scope: selectedScope }); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 w-64 bg-transparent border-gray-600 text-white placeholder:text-gray-500"
              />
            </div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[130px] bg-transparent border-gray-600 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="ALL" className="text-white hover:bg-gray-700">Todos</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key} className="text-white hover:bg-gray-700">{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Stats Bar */}
      <div className="flex items-center gap-6 px-6 py-3 bg-[#2a2b2d] border-b border-gray-700 text-sm">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-purple-400" />
          <span className="text-gray-400">Reconciliado:</span>
          <span className="text-purple-400 font-semibold">€{formatEuropeanNumber(stats.reconciledTotal)}</span>
          <span className="text-gray-500 text-xs">({stats.reconciledCount})</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-blue-400" />
          <span className="text-gray-400">Total:</span>
          <span className="text-white font-semibold">€{formatEuropeanNumber(stats.total)}</span>
          <span className="text-gray-500 text-xs">({stats.totalCount})</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <span className="text-gray-400">Pago:</span>
          <span className="text-green-400 font-semibold">€{formatEuropeanNumber(stats.paidTotal)}</span>
          <span className="text-gray-500 text-xs">({stats.paidCount})</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-400" />
          <span className="text-gray-400">Pendente:</span>
          <span className="text-yellow-400 font-semibold">€{formatEuropeanNumber(stats.pendingTotal)}</span>
          <span className="text-gray-500 text-xs">({stats.pendingCount})</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-gray-400">Vencido:</span>
          <span className="text-red-400 font-semibold">€{formatEuropeanNumber(stats.overdueTotal)}</span>
          <span className="text-gray-500 text-xs">({stats.overdueCount})</span>
        </div>
      </div>

      {/* Table Header */}
      <div className="sticky top-0 z-10 bg-[#2a2b2d] border-b border-gray-700">
        <div className="flex items-center gap-1 px-3 py-2 text-[10px] text-gray-400 font-medium uppercase">
          <div className="w-[55px] flex-shrink-0"></div>
          <div className="w-[100px] flex-shrink-0 cursor-pointer hover:text-white" onClick={() => handleSort("invoice_number")}>Invoice</div>
          <div className="w-[70px] flex-shrink-0 cursor-pointer hover:text-white" onClick={() => handleSort("invoice_date")}>Date</div>
          <div className="w-[65px] flex-shrink-0">Order</div>
          <div className="w-[55px] flex-shrink-0">Paid</div>
          <div className="w-[70px] flex-shrink-0">Order Status</div>
          <div className="w-[140px] flex-shrink-0">Products</div>
          <div className="w-[100px] flex-shrink-0">Company</div>
          <div className="w-[120px] flex-shrink-0">Client</div>
          <div className="w-[85px] flex-shrink-0 text-right">Total</div>
          <div className="w-[100px] flex-shrink-0">Reconciliation</div>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto pb-20">
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
        ) : error ? (
          <div className="p-8 text-center text-red-400">{error}</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhuma invoice encontrada</div>
        ) : (
          filteredInvoices.map(inv => {
            const statusConfig = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
            return (
              <div
                key={inv.id}
                className={`flex items-center gap-1 px-3 py-1.5 border-b border-gray-800/50 hover:bg-gray-800/30 text-[11px] ${inv.reconciled ? 'bg-green-900/10' : ''}`}
              >
                {/* Actions */}
                <div className="w-[55px] flex-shrink-0 flex items-center gap-0.5">
                  <button onClick={() => handleEdit(inv)} className="p-1 text-gray-500 hover:text-white">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={() => handleDelete(inv.id)} className="p-1 text-gray-500 hover:text-red-400">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                {/* Invoice */}
                <div className="w-[100px] flex-shrink-0 font-mono text-gray-300 truncate" title={inv.invoice_number}>{inv.invoice_number.replace('HS-', '')}</div>
                {/* Date */}
                <div className="w-[70px] flex-shrink-0 text-gray-400">{formatDate(inv.invoice_date)}</div>
                {/* Order */}
                <div className="w-[65px] flex-shrink-0 font-mono text-gray-500 truncate">{inv.order_id || "-"}</div>
                {/* Paid Status */}
                <div className="w-[55px] flex-shrink-0">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${inv.order_status === 'Paid' ? 'bg-green-900/30 text-green-400' :
                    inv.order_status === 'Partial' ? 'bg-orange-900/30 text-orange-400' :
                      'bg-gray-700/50 text-gray-400'
                    }`}>{inv.order_status || "-"}</span>
                </div>
                {/* Deal Status */}
                <div className="w-[70px] flex-shrink-0 text-gray-500 truncate">{inv.deal_status || "-"}</div>
                {/* Products */}
                <div className="w-[140px] flex-shrink-0 text-gray-400 truncate" title={inv.products || ""}>{inv.products || "-"}</div>
                {/* Company */}
                <div className="w-[100px] flex-shrink-0 text-gray-300 truncate" title={inv.company_name || ""}>{inv.company_name || "-"}</div>
                {/* Client */}
                <div className="w-[120px] flex-shrink-0 truncate">
                  <span className="text-gray-300">{inv.client_name || "-"}</span>
                  {inv.email && <span className="text-gray-600 ml-1 text-[9px]">{inv.email.split('@')[0]}</span>}
                </div>
                {/* Total */}
                <div className="w-[85px] flex-shrink-0 text-right font-medium text-white">
                  <span className={inv.currency === "EUR" ? "text-blue-400" : "text-green-400"}>{inv.currency === "EUR" ? "€" : "$"}</span>
                  {formatEuropeanNumber(inv.total_amount)}
                </div>
                {/* Reconciliation */}
                <div className="w-[100px] flex-shrink-0">
                  {inv.reconciled ? (
                    <div className="flex items-center gap-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-700/50">{inv.reconciled_with?.split(':')[0] || 'Yes'}</span>
                      <button onClick={() => loadTransactionDetails(inv)} className="p-0.5 text-gray-500 hover:text-blue-400" title="Ver detalhes"><Eye className="h-2.5 w-2.5" /></button>
                      <button onClick={() => handleRemoveReconciliation(inv)} className="p-0.5 text-gray-600 hover:text-red-400" title="Remover"><X className="h-2.5 w-2.5" /></button>
                    </div>
                  ) : (
                    <button onClick={() => openManualReconcile(inv)} className="p-1 text-gray-600 hover:text-purple-400" title="Reconciliar"><Link2 className="h-3 w-3" /></button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#2a2b2d] border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{editingInvoice?.id ? "Editar Invoice" : "Nova Invoice"}</DialogTitle>
            <DialogDescription className="text-gray-400">Campos do relatório HubSpot/Backend</DialogDescription>
          </DialogHeader>

          {editingInvoice && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Invoice Number *</Label>
                <Input
                  value={editingInvoice.invoice_number || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, invoice_number: e.target.value })}
                  placeholder="#DSDFS4F46AC9-53077"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Order ID</Label>
                <Input
                  value={editingInvoice.order_id || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, order_id: e.target.value })}
                  placeholder="4f46ac9"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Order Date</Label>
                <Input
                  type="date"
                  value={editingInvoice.order_date || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, order_date: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Invoice Date *</Label>
                <Input
                  type="date"
                  value={editingInvoice.invoice_date || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, invoice_date: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label>Order Status</Label>
                <Input
                  value={editingInvoice.order_status || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, order_status: e.target.value })}
                  placeholder="Subscription Plan, Single Payment..."
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingInvoice.status || "pending"}
                  onValueChange={v => setEditingInvoice({ ...editingInvoice, status: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Products</Label>
                <Input
                  value={editingInvoice.products || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, products: e.target.value })}
                  placeholder="Level 1 Subscription - DO NOT DELETE"
                />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  value={editingInvoice.company_name || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, company_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input
                  value={editingInvoice.client_name || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, client_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editingInvoice.email || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingInvoice.total_amount || 0}
                  onChange={e => setEditingInvoice({ ...editingInvoice, total_amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={editingInvoice.currency || "EUR"}
                  onValueChange={v => setEditingInvoice({ ...editingInvoice, currency: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="AUD">AUD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Charged Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingInvoice.charged_amount || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, charged_amount: parseFloat(e.target.value) || null })}
                  placeholder="Deixe vazio se não cobrado"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={editingInvoice.payment_method || ""}
                  onValueChange={v => setEditingInvoice({ ...editingInvoice, payment_method: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(pm => <SelectItem key={pm} value={pm}>{pm}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Billing Entity</Label>
                <Select
                  value={editingInvoice.billing_entity || ""}
                  onValueChange={v => setEditingInvoice({ ...editingInvoice, billing_entity: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {BILLING_ENTITIES.map(be => <SelectItem key={be} value={be}>{be}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Code</Label>
                <Input
                  value={editingInvoice.discount_code || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, discount_code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Discount Names</Label>
                <Input
                  value={editingInvoice.discount_names || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, discount_names: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Note</Label>
                <Textarea
                  value={editingInvoice.note || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, note: e.target.value })}
                  placeholder="*Exención IVA Artículo 20..."
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className="bg-transparent border-gray-600 text-white hover:bg-gray-700" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Reconciliation Dialog */}
      <Dialog open={manualReconcileDialog} onOpenChange={setManualReconcileDialog}>
        <DialogContent className="max-w-md bg-[#2a2b2d] border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Reconciliação Manual</DialogTitle>
            <DialogDescription className="text-gray-400">
              {reconcileTarget && (
                <span>
                  {reconcileTarget.invoice_number} • <span className={reconcileTarget.currency === "EUR" ? "text-blue-400" : "text-green-400"}>{reconcileTarget.currency === "EUR" ? "€" : "$"}{formatEuropeanNumber(reconcileTarget.total_amount)}</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Fonte do Pagamento</Label>
              <Select value={reconcileSource} onValueChange={setReconcileSource}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="credit-payment" className="text-white hover:bg-gray-700">Credit Payment (crédito interno)</SelectItem>
                  <SelectItem value="bank-transfer" className="text-white hover:bg-gray-700">Bank Transfer (transferência)</SelectItem>
                  <SelectItem value="hubspot-confirmed" className="text-white hover:bg-gray-700">HubSpot Confirmed (paid_status)</SelectItem>
                  <SelectItem value="check" className="text-white hover:bg-gray-700">Check (cheque)</SelectItem>
                  <SelectItem value="cash" className="text-white hover:bg-gray-700">Cash (dinheiro)</SelectItem>
                  <SelectItem value="other" className="text-white hover:bg-gray-700">Other (outro)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Referência do Pagamento</Label>
              <Input
                value={reconcileReference}
                onChange={e => setReconcileReference(e.target.value)}
                placeholder="Ex: ID da transação, número do cheque..."
                className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
              />
              <p className="text-xs text-gray-500">
                Opcional. Se vazio, será gerado automaticamente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="bg-transparent border-gray-600 text-white hover:bg-gray-700" onClick={() => setManualReconcileDialog(false)}>Cancelar</Button>
            <Button onClick={handleManualReconcile} className="bg-purple-600 hover:bg-purple-700">
              <Link2 className="h-4 w-4 mr-2" />
              Reconciliar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Details Dialog */}
      <Dialog open={transactionDetailsDialog} onOpenChange={setTransactionDetailsDialog}>
        <DialogContent className="max-w-2xl bg-[#2a2b2d] border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-400" />
              Detalhes da Reconciliação
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {transactionDetails?.invoice && (
                <span>
                  Invoice: {transactionDetails.invoice.invoice_number} • {transactionDetails.invoice.client_name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {loadingTransactionDetails ? (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-400" />
              <p className="text-gray-400 mt-2">Carregando detalhes...</p>
            </div>
          ) : transactionDetails?.type === 'manual' ? (
            <div className="space-y-4">
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Reconciliação Manual</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Fonte:</span>
                    <span className="ml-2 text-white capitalize">{transactionDetails.source}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Referência:</span>
                    <span className="ml-2 text-white">{transactionDetails.reference}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Valor:</span>
                    <span className="ml-2 text-green-400">
                      {transactionDetails.invoice.currency === "EUR" ? "€" : "$"}
                      {formatEuropeanNumber(transactionDetails.invoice.total_amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Data:</span>
                    <span className="ml-2 text-white">{formatDate(transactionDetails.invoice.reconciled_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : transactionDetails?.type === 'payment' ? (
            <div className="space-y-4">
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300">Transação {transactionDetails.source.toUpperCase()}</h4>
                  {transactionDetails.source === 'braintree' && transactionDetails.custom_data?.transaction_id && (
                    <a
                      href={`https://www.braintreegateway.com/merchants/plncntrspdsd/transactions/${transactionDetails.custom_data.transaction_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Abrir no Braintree
                    </a>
                  )}
                  {transactionDetails.source === 'gocardless' && transactionDetails.custom_data?.payment_id && (
                    <a
                      href={`https://manage.gocardless.com/payments/${transactionDetails.custom_data.payment_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Abrir no GoCardless
                    </a>
                  )}
                  {transactionDetails.source === 'stripe' && transactionDetails.custom_data?.charge_id && (
                    <a
                      href={`https://dashboard.stripe.com/payments/${transactionDetails.custom_data.charge_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Abrir no Stripe
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Transaction ID:</span>
                    <span className="ml-2 text-white font-mono text-xs">
                      {transactionDetails.custom_data?.transaction_id || transactionDetails.custom_data?.payment_id || transactionDetails.custom_data?.charge_id || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${transactionDetails.custom_data?.status === 'settled' || transactionDetails.custom_data?.status === 'confirmed' || transactionDetails.custom_data?.status === 'succeeded'
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-yellow-900/30 text-yellow-400'
                      }`}>
                      {transactionDetails.custom_data?.status || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Valor:</span>
                    <span className="ml-2 text-green-400 font-medium">
                      {transactionDetails.custom_data?.currency || transactionDetails.transaction?.currency || 'EUR'} {formatEuropeanNumber(parseFloat(transactionDetails.transaction?.amount) || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Data:</span>
                    <span className="ml-2 text-white">{formatDate(transactionDetails.transaction?.date)}</span>
                  </div>
                  {transactionDetails.custom_data?.customer_name && (
                    <div>
                      <span className="text-gray-500">Cliente:</span>
                      <span className="ml-2 text-white">{transactionDetails.custom_data.customer_name}</span>
                    </div>
                  )}
                  {transactionDetails.custom_data?.customer_email && (
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2 text-gray-300 text-xs">{transactionDetails.custom_data.customer_email}</span>
                    </div>
                  )}
                  {transactionDetails.custom_data?.payment_method && (
                    <div>
                      <span className="text-gray-500">Método:</span>
                      <span className="ml-2 text-white">{transactionDetails.custom_data.payment_method}</span>
                    </div>
                  )}
                  {transactionDetails.custom_data?.order_id && (
                    <div>
                      <span className="text-gray-500">Order ID:</span>
                      <span className="ml-2 text-white font-mono text-xs">{transactionDetails.custom_data.order_id}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Details */}
              <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
                <h4 className="text-xs font-medium text-gray-400 mb-2">Dados Adicionais</h4>
                <div className="text-xs text-gray-500 space-y-1 max-h-32 overflow-auto">
                  {Object.entries(transactionDetails.custom_data || {})
                    .filter(([key]) => !['transaction_id', 'status', 'customer_name', 'customer_email', 'payment_method', 'order_id', 'currency'].includes(key))
                    .slice(0, 10)
                    .map(([key, value]) => (
                      <div key={key} className="flex">
                        <span className="text-gray-600 w-36 flex-shrink-0">{key}:</span>
                        <span className="text-gray-400 truncate">{String(value)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : transactionDetails?.type === 'not_found' ? (
            <div className="py-8 text-center">
              <AlertCircle className="h-8 w-8 mx-auto text-yellow-400" />
              <p className="text-gray-400 mt-2">Transação não encontrada</p>
              <p className="text-gray-500 text-sm mt-1">ID: {transactionDetails.transactionId}</p>
            </div>
          ) : transactionDetails?.type === 'error' ? (
            <div className="py-8 text-center">
              <AlertCircle className="h-8 w-8 mx-auto text-red-400" />
              <p className="text-gray-400 mt-2">Erro ao carregar detalhes</p>
              <p className="text-red-400 text-sm mt-1">{transactionDetails.error}</p>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" className="bg-transparent border-gray-600 text-white hover:bg-gray-700" onClick={() => setTransactionDetailsDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
