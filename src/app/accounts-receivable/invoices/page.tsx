"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Search, ArrowUpDown, DollarSign, Trash2, Pencil, Download, CheckCircle2, AlertCircle, Clock, RefreshCw, FileText, TrendingUp, Loader2 } from "lucide-react";
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
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-gray-100 text-gray-700" },
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
  sent: { label: "Enviada", color: "bg-blue-100 text-blue-800" },
  paid: { label: "Paga", color: "bg-green-100 text-green-800" },
  partial: { label: "Parcial", color: "bg-orange-100 text-orange-800" },
  overdue: { label: "Vencida", color: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelada", color: "bg-gray-200 text-gray-500" }
};

const PAYMENT_METHODS = ["Braintree", "Stripe", "GoCardless", "PayPal", "Bank Transfer", "Credit Card", "Other"];
const BILLING_ENTITIES = ["Planning Center SL.", "DSD ESP", "DSD US LLC"];

function formatEuropeanNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR");
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
  const { selectedScope } = useGlobalScope();
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Partial<ARInvoice> | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [sortField, setSortField] = useState<string>("invoice_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("ar_invoices")
        .select("*")
        .order("invoice_date", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
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
      // Buscar orders do HubSpot que ainda não foram importadas
      const { data: hubspotOrders, error: hubspotError } = await supabase
        .from("csv_rows")
        .select("*")
        .eq("source", "hubspot")
        .order("date", { ascending: false });

      if (hubspotError) throw hubspotError;

      if (!hubspotOrders || hubspotOrders.length === 0) {
        toast({ title: "Info", description: "Nenhum pedido HubSpot encontrado para sincronizar" });
        setSyncing(false);
        return;
      }

      // Filtrar por data: >= 2025-11-01 e <= hoje
      const minDate = new Date('2025-11-01');
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      const validOrders = hubspotOrders.filter(order => {
        const cd = order.custom_data || {};
        const dateStr = cd.date_ordered || cd.date_paid || order.date;
        if (!dateStr) return false;
        const orderDate = new Date(dateStr);
        return orderDate >= minDate && orderDate <= today;
      });

      // Buscar source_ids que já existem na tabela ar_invoices
      const { data: existingInvoices } = await supabase
        .from("ar_invoices")
        .select("source_id")
        .eq("source", "hubspot");

      const existingSourceIds = new Set((existingInvoices || []).map((i) => i.source_id));

      // Filtrar orders que ainda não foram importadas
      const newOrders = validOrders.filter((order) => !existingSourceIds.has(String(order.id)));

      if (newOrders.length === 0) {
        toast({ title: "Info", description: "Todas as invoices já estão sincronizadas" });
        setSyncing(false);
        return;
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
      const invoicesToInsert = newOrders.map((order) => {
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

      const { error: insertError } = await supabase.from("ar_invoices").insert(invoicesToInsert);
      if (insertError) throw insertError;

      toast({ title: "Sucesso", description: `${invoicesToInsert.length} invoices sincronizadas do HubSpot` });
      loadInvoices();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("Erro ao sincronizar HubSpot:", err);
      toast({ title: "Erro", description: `Falha ao sincronizar: ${errorMessage}`, variant: "destructive" });
    } finally {
      setSyncing(false);
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
    return {
      total, totalCount: scopeInvoices.length,
      paidTotal, paidCount: paid.length,
      pendingTotal, pendingCount: pending.length,
      overdueTotal, overdueCount: overdue.length
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
    <div className="min-h-full px-6 space-y-6 py-6">
      <Breadcrumbs items={[
        { label: "Accounts Receivable", href: "/accounts-receivable" },
        { label: "Invoices" }
      ]} />

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AR Invoices</h1>
          <p className="text-sm text-gray-600">Gestão de faturas de clientes - sincronizado com HubSpot</p>
        </div>
        <div className="flex items-center gap-3">
          <ScopeSelector />
          <Button variant="outline" size="sm" onClick={syncFromHubSpot} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync HubSpot
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button onClick={() => { setEditingInvoice({ ...EMPTY_INVOICE, scope: selectedScope }); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Invoice
          </Button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" /> Revenue Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{formatEuropeanNumber(stats.total)}</div>
            <p className="text-xs text-gray-500">{stats.totalCount} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" /> Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">€{formatEuropeanNumber(stats.paidTotal)}</div>
            <p className="text-xs text-gray-500">{stats.paidCount} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" /> Pendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">€{formatEuropeanNumber(stats.pendingTotal)}</div>
            <p className="text-xs text-gray-500">{stats.pendingCount} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" /> Vencido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">€{formatEuropeanNumber(stats.overdueTotal)}</div>
            <p className="text-xs text-gray-500">{stats.overdueCount} invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por número, cliente, empresa, email, produtos..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">{error}</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhuma invoice encontrada</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Ações</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600 cursor-pointer" onClick={() => handleSort("invoice_number")}>
                      <div className="flex items-center gap-1">Number <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600 cursor-pointer" onClick={() => handleSort("invoice_date")}>
                      <div className="flex items-center gap-1">Invoice Date <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Order</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Order Status</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Products</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Company</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Client</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-600">Total</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Payment Method</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Billing Entity</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredInvoices.map(inv => {
                    const statusConfig = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(inv)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(inv.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{inv.invoice_number}</td>
                        <td className="px-3 py-2">{formatDate(inv.invoice_date)}</td>
                        <td className="px-3 py-2 font-mono text-xs">{inv.order_id || "-"}</td>
                        <td className="px-3 py-2">{inv.order_status || "-"}</td>
                        <td className="px-3 py-2 max-w-[150px] truncate" title={inv.products || ""}>{inv.products || "-"}</td>
                        <td className="px-3 py-2">{inv.company_name || "-"}</td>
                        <td className="px-3 py-2">
                          <div>{inv.client_name || "-"}</div>
                          {inv.email && <div className="text-xs text-gray-400">{inv.email}</div>}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {inv.currency === "EUR" ? "€" : inv.currency === "USD" ? "$" : inv.currency}{formatEuropeanNumber(inv.total_amount)}
                        </td>
                        <td className="px-3 py-2">{inv.payment_method || "-"}</td>
                        <td className="px-3 py-2 text-xs">{inv.billing_entity || "-"}</td>
                        <td className="px-3 py-2">
                          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInvoice?.id ? "Editar Invoice" : "Nova Invoice"}</DialogTitle>
            <DialogDescription>Campos do relatório HubSpot/Backend</DialogDescription>
          </DialogHeader>

          {editingInvoice && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Number *</Label>
                <Input
                  value={editingInvoice.invoice_number || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, invoice_number: e.target.value })}
                  placeholder="#DSDFS4F46AC9-53077"
                />
              </div>
              <div className="space-y-2">
                <Label>Order ID</Label>
                <Input
                  value={editingInvoice.order_id || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, order_id: e.target.value })}
                  placeholder="4f46ac9"
                />
              </div>
              <div className="space-y-2">
                <Label>Order Date</Label>
                <Input
                  type="date"
                  value={editingInvoice.order_date || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, order_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Invoice Date *</Label>
                <Input
                  type="date"
                  value={editingInvoice.invoice_date || ""}
                  onChange={e => setEditingInvoice({ ...editingInvoice, invoice_date: e.target.value })}
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
