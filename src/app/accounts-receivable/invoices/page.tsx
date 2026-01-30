"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Search, ArrowUpDown, DollarSign, Trash2, Pencil, Download, CheckCircle2, AlertCircle, Clock, RefreshCw, FileText, TrendingUp, Loader2, Link2, Unlink, X, Eye, ExternalLink, Globe, Filter, ArrowUp, ArrowDown, Ban, Zap, User, CalendarIcon } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  reconciliation_type?: string;
  reconciled_by?: string;
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

// Formatar valores dinâmicos para Additional Details (detecta datas ISO)
function formatDynamicValue(key: string, value: any): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  const strValue = String(value);
  // Detectar datas ISO (2025-12-17T00:00:00.000Z ou 2025-12-17)
  if (key.toLowerCase().includes('date') || key.toLowerCase().includes('_at') || key.toLowerCase().includes('timestamp')) {
    const isoMatch = strValue.match(/^\d{4}-\d{2}-\d{2}(T|$)/);
    if (isoMatch) {
      const d = new Date(strValue);
      if (!isNaN(d.getTime())) {
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        // Se tem hora, incluir
        if (strValue.includes('T') && !strValue.endsWith('T00:00:00.000Z')) {
          const hours = String(d.getUTCHours()).padStart(2, '0');
          const mins = String(d.getUTCMinutes()).padStart(2, '0');
          return `${day}/${month}/${year} ${hours}:${mins}`;
        }
        return `${day}/${month}/${year}`;
      }
    }
  }
  return strValue;
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
  const [bankReconciling, setBankReconciling] = useState(false);
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

  // Column filters
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });

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
        setError("Table ar_invoices does not exist. Run the SQL migration first.");
      } else {
        setError(e?.message || "Error loading invoices");
      }
      toast({ title: "Error", description: e?.message, variant: "destructive" });
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

      // INCREMENTAL SYNC: Preservar reconciliações existentes
      // 1. Buscar todos os registros existentes com suas reconciliações
      const { data: existingRecords } = await supabase
        .from("ar_invoices")
        .select("source_id, reconciled, reconciled_at, reconciled_with, reconciliation_type, reconciled_by, payment_reference")
        .eq("source", "hubspot");

      // Criar mapa de reconciliações existentes por source_id
      const existingReconciliations = new Map<string, any>();
      (existingRecords || []).forEach(rec => {
        if (rec.reconciled) {
          existingReconciliations.set(rec.source_id, {
            reconciled: rec.reconciled,
            reconciled_at: rec.reconciled_at,
            reconciled_with: rec.reconciled_with,
            reconciliation_type: rec.reconciliation_type,
            reconciled_by: rec.reconciled_by,
            payment_reference: rec.payment_reference
          });
        }
      });

      console.log(`🔒 Preservando ${existingReconciliations.size} reconciliações existentes`);

      // Delete all existing HubSpot records for full sync
      // This prevents 409 conflict error on source_id
      const { error: deleteError } = await supabase
        .from("ar_invoices")
        .delete()
        .eq("source", "hubspot");

      if (deleteError) {
        console.error("Error deleting old records:", deleteError);
        // Continue even with delete error
      }

      // Mapeamento de dealstage IDs para nomes legíveis
      const STAGE_MAPPING: Record<string, string> = {
        'checkout_completed': 'Web Order',
        'checkout_pending': 'Credit Order',
        'cancelled': 'Cancelled',
        'closedwon': 'Web Order',
        'presentationscheduled': 'New',
        '108197790': 'New',
        '108197794': 'Web Order',
        '206173276': 'Web Order',
        '1031801652': 'Credit Order',
        '1031823104': 'Credit Order',
        '1203581030': 'New',
        '1203581031': 'New',
        '1203581032': 'New',
        '1203581033': 'New',
        '1203581035': 'Web Order',
        '1203581036': 'Cancelled',
        '1067293738': 'Subscription Plan',
        '1065782346': 'Subscription Plan',
        '1065782348': 'Credit Order',
        '1065782349': 'Cancelled',
        '1065782350': 'Subscription Plan',
        '1026647932': 'New',
        '1026592320': 'Web Order',
        '22796161': 'New',
      };

      // Helper para calcular deal_status baseado em dealstage e paid_status
      const getDealStatus = (stageId: string | undefined, paidStatus: string | undefined): string => {
        if (!stageId) return 'New';
        const stage = stageId.toString();
        const paid = (paidStatus || '').toLowerCase();

        // Cancelled stages
        if (stage === 'cancelled' || stage === '1203581036' || stage === '1065782349') return 'Cancelled';

        // Credit Order stages (inclui antigo Outstanding Payment)
        if (stage === '1031801652' || stage === 'checkout_pending' || stage === '1031823104' || stage === '1065782348') return 'Credit Order';

        // Web Order stages (formerly Shipped)
        if (stage === 'checkout_completed' || stage === 'closedwon' || stage === '108197794' || stage === '206173276' || stage === '1203581035' || stage === '1026592320') return 'Web Order';

        // Subscription Plan stages
        if (stage === '1067293738' || stage === '1065782346' || stage === '1065782350') return 'Subscription Plan';

        // Fallback baseado em paid_status
        if (paid === 'paid') return 'Web Order';
        if (paid === 'partial') return 'Credit Order';
        if (paid === 'unpaid') return 'Credit Order';

        return STAGE_MAPPING[stage] || 'New';
      };

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

      // Criar invoices com mapeamento CORRIGIDO + PRESERVAR RECONCILIAÇÕES
      const invoicesToInsert = validOrders.map((order) => {
        const cd = order.custom_data || {};
        const shortId = String(order.id).replace(/-/g, '').slice(0, 12).toUpperCase();
        const orderCode = extractOrderCode(cd.order_code as string, cd.dealname as string);
        const productName = extractProductName(cd);
        const invoiceDate = cd.date_paid || cd.date_ordered || order.date;

        const firstName = cd.customer_firstname || cd.customerFirstname || "";
        const lastName = cd.customer_lastname || cd.customerLastname || "";
        const clientName = `${firstName} ${lastName}`.trim() || null;

        const sourceId = String(order.id);

        // Preservar reconciliação existente se houver
        const existingRecon = existingReconciliations.get(sourceId);

        const baseRecord = {
          invoice_number: `HS-${shortId}`,
          order_id: orderCode,
          order_date: cd.date_ordered || order.date || null,
          order_status: cd.paid_status || null,
          deal_status: getDealStatus(cd.dealstage as string, cd.paid_status as string),
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
          source_id: sourceId
        };

        // Se tinha reconciliação, preservar
        if (existingRecon) {
          return {
            ...baseRecord,
            reconciled: existingRecon.reconciled,
            reconciled_at: existingRecon.reconciled_at,
            reconciled_with: existingRecon.reconciled_with,
            reconciliation_type: existingRecon.reconciliation_type,
            reconciled_by: existingRecon.reconciled_by,
            payment_reference: existingRecon.payment_reference
          };
        }

        return baseRecord;
      });

      // Inserir em batches para evitar timeout
      const BATCH_SIZE = 100;
      let insertedCount = 0;
      let reconPreserved = 0;
      for (let i = 0; i < invoicesToInsert.length; i += BATCH_SIZE) {
        const batch = invoicesToInsert.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from("ar_invoices").insert(batch);
        if (insertError) throw insertError;
        insertedCount += batch.length;
        reconPreserved += batch.filter((b: any) => b.reconciled).length;
      }

      toast({
        title: "Sucesso",
        description: `${insertedCount} invoices sincronizadas do HubSpot (${reconPreserved} reconciliações preservadas)`
      });
      loadInvoices();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("Error syncing HubSpot:", err);
      toast({ title: "Error", description: `Sync failed: ${errorMessage}`, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  // Auto reconciliation with payment gateways
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
          title: "Reconciliation Complete",
          description: `${summary.updated} invoices reconciled (Braintree: ${summary.bySource.braintree}, Stripe: ${summary.bySource.stripe}, GoCardless: ${summary.bySource.gocardless})`
        });
        loadInvoices();
      } else {
        throw new Error(result.error || 'Reconciliation error');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Reconciliation error:", err);
      toast({ title: "Error", description: `Reconciliation failed: ${errorMessage}`, variant: "destructive" });
    } finally {
      setReconciling(false);
    }
  };

  // Bank reconciliation via disbursement chain (Web Orders → Braintree → Disbursement → Bank)
  const runBankReconcile = async () => {
    setBankReconciling(true);
    try {
      // Reconciliar EUR e USD em paralelo
      const [eurResult, usdResult] = await Promise.all([
        fetch('/api/reconcile/disbursement-chain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dryRun: false, currency: 'EUR' })
        }).then(r => r.json()),
        fetch('/api/reconcile/disbursement-chain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dryRun: false, currency: 'USD' })
        }).then(r => r.json())
      ]);

      const totalBankReconciled = (eurResult.stats?.bank_rows_reconciled || 0) + (usdResult.stats?.bank_rows_reconciled || 0);
      const totalOrdersUpdated = (eurResult.stats?.ar_invoices_updated || 0) + (usdResult.stats?.ar_invoices_updated || 0);
      const totalChains = (eurResult.summary?.chains_found || 0) + (usdResult.summary?.chains_found || 0);

      toast({
        title: "Bank Reconciliation Complete",
        description: `${totalChains} disbursements processed, ${totalBankReconciled} bank rows linked, ${totalOrdersUpdated} orders updated`
      });
      loadInvoices();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Bank reconciliation error:", err);
      toast({ title: "Error", description: `Bank reconciliation failed: ${errorMessage}`, variant: "destructive" });
    } finally {
      setBankReconciling(false);
    }
  };

  // Manual reconciliation
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
        toast({ title: "Success", description: `Invoice ${reconcileTarget.invoice_number} manually reconciled` });
        setManualReconcileDialog(false);
        loadInvoices();
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRemoveReconciliation = async (invoice: ARInvoice) => {
    if (!confirm(`Remove reconciliation from ${invoice.invoice_number}?`)) return;

    try {
      const response = await fetch(`/api/reconcile/manual?invoiceId=${invoice.id}`, {
        method: 'DELETE'
      });
      const result = await response.json();

      if (result.success) {
        toast({ title: "Success", description: "Reconciliation removed" });
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
        // Show basic info for manual reconciliations
        setTransactionDetails({
          type: 'manual',
          source: source,
          invoice: invoice,
          reference: invoice.payment_reference || transactionId || 'N/A'
        });
        return;
      }

      // Fetch transaction from csv_rows - use correct source names
      let query = supabase.from("csv_rows").select("*");

      if (source === 'braintree') {
        // Braintree uses braintree-api-revenue or braintree-api-fees
        query = query
          .in('source', ['braintree-api-revenue', 'braintree-api-fees'])
          .or(`custom_data->>transaction_id.eq.${transactionId},id.eq.${transactionId}`);
      } else if (source === 'gocardless') {
        query = query.or(`custom_data->>gocardless_id.eq.${transactionId},custom_data->>payment_id.eq.${transactionId}`);
      } else if (source === 'stripe') {
        query = query.or(`custom_data->>transaction_id.eq.${transactionId},custom_data->>charge_id.eq.${transactionId}`);
      }

      const { data, error } = await query.limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const tx = data[0];
        const cd = tx.custom_data || {};

        // For Braintree, settlement info is already in custom_data
        let settlementInfo = null;
        if (source === 'braintree') {
          const merchantId = cd.merchant_account_id || '';
          let bankAccount = merchantId;
          let bankSource = '';

          if (merchantId.toLowerCase().includes('eur') || merchantId === 'digitalsmiledesignEUR') {
            bankAccount = 'Bankinter EUR (ES91 0128 0380 27 0100038957)';
            bankSource = 'bankinter-eur';
          } else if (merchantId.toLowerCase().includes('usd') || merchantId === 'digitalsmiledesignUSD') {
            bankAccount = 'Bankinter USD (ES84 0128 0380 21 0100039197)';
            bankSource = 'bankinter-usd';
          }

          // Use dates from transaction custom_data
          const disbursementDate = cd.disbursement_date;
          const settlementDate = cd.settlement_date;
          const settlementAmount = cd.settlement_amount || tx.amount;

          // Buscar match no extrato bancário
          let bankMatch = null;
          if (bankSource && disbursementDate) {
            const disbDate = new Date(disbursementDate);
            const startDate = new Date(disbDate);
            startDate.setDate(startDate.getDate() - 3);
            const endDate = new Date(disbDate);
            endDate.setDate(endDate.getDate() + 3);

            const { data: bankRows } = await supabase
              .from("csv_rows")
              .select("*")
              .eq("source", bankSource)
              .gte("date", startDate.toISOString().split('T')[0])
              .lte("date", endDate.toISOString().split('T')[0])
              .order("date", { ascending: false })
              .limit(20);

            if (bankRows && bankRows.length > 0) {
              const disbAmount = Math.abs(parseFloat(String(settlementAmount)));
              const matchRow = bankRows.find((row: any) => {
                const rowAmount = Math.abs(parseFloat(row.amount));
                const amountMatch = Math.abs(rowAmount - disbAmount) < 0.10;
                const descMatch = row.description?.toLowerCase().includes('braintree') ||
                  row.description?.toLowerCase().includes('paypal');
                return amountMatch || descMatch;
              });
              if (matchRow) {
                bankMatch = {
                  id: matchRow.id,
                  date: matchRow.date,
                  description: matchRow.description,
                  amount: matchRow.amount,
                  reconciled: matchRow.reconciled
                };
              }
            }
          }

          settlementInfo = {
            settlement_date: settlementDate,
            disbursement_date: disbursementDate,
            disbursement_id: cd.disbursement_id || cd.settlement_batch_id,
            merchant_account_id: merchantId,
            bank_account: bankAccount,
            disbursement_amount: settlementAmount,
            bank_match: bankMatch
          };
        }

        setTransactionDetails({
          type: 'payment',
          source: source,
          invoice: invoice,
          transaction: tx,
          custom_data: cd,
          settlement: settlementInfo
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
      console.error("Error loading details:", err);
      setTransactionDetails({
        type: 'error',
        source: invoice.reconciled_with?.split(':')[0],
        invoice: invoice,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setLoadingTransactionDetails(false);
    }
  };

  // Generate URL for payment source
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
      toast({ title: "Error", description: "Invoice number is required", variant: "destructive" });
      return;
    }
    if (!editingInvoice.invoice_date) {
      toast({ title: "Error", description: "Invoice date is required", variant: "destructive" });
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
        toast({ title: "Success", description: "Invoice updated" });
      } else {
        const { error } = await supabase.from("ar_invoices").insert({
          ...editingInvoice,
          created_at: new Date().toISOString()
        });
        if (error) throw error;
        toast({ title: "Success", description: "Invoice created" });
      }
      setDialogOpen(false);
      setEditingInvoice(null);
      loadInvoices();
    } catch (err: any) {
      console.error("Error saving:", err);
      toast({ title: "Error", description: err?.message || "Failed to save invoice", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    try {
      const { error } = await supabase.from("ar_invoices").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Invoice deleted" });
      loadInvoices();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
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

    // Apply column filters
    Object.entries(columnFilters).forEach(([field, filterValue]) => {
      if (!filterValue) return;
      const lowerFilter = filterValue.toLowerCase();
      result = result.filter(inv => {
        const val = inv[field as keyof ARInvoice];
        if (val === null || val === undefined) return lowerFilter === '-' || lowerFilter === 'null' || lowerFilter === '';
        return String(val).toLowerCase().includes(lowerFilter);
      });
    });

    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      result = result.filter(inv => {
        if (!inv.invoice_date) return false;
        const invDate = new Date(inv.invoice_date);
        if (dateRange.from && invDate < dateRange.from) return false;
        if (dateRange.to) {
          const toEnd = new Date(dateRange.to);
          toEnd.setHours(23, 59, 59, 999);
          if (invDate > toEnd) return false;
        }
        return true;
      });
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
  }, [invoices, searchTerm, selectedStatus, sortField, sortDirection, selectedScope, columnFilters, dateRange]);

  // Valores únicos para filtros dropdown
  const columnUniqueValues = useMemo(() => {
    const scopeInvoices = invoices.filter(inv => matchesScope(inv.scope, selectedScope));
    return {
      order_status: [...new Set(scopeInvoices.map(i => i.order_status).filter(Boolean))].sort(),
      deal_status: [...new Set(scopeInvoices.map(i => i.deal_status).filter(Boolean))].sort(),
      products: [...new Set(scopeInvoices.map(i => i.products).filter(Boolean))].sort(),
      company_name: [...new Set(scopeInvoices.map(i => i.company_name).filter(Boolean))].sort(),
      currency: [...new Set(scopeInvoices.map(i => i.currency).filter(Boolean))].sort(),
      payment_method: [...new Set(scopeInvoices.map(i => i.payment_method).filter(Boolean))].sort(),
    };
  }, [invoices, selectedScope]);

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
    XLSX.utils.book_append_sheet(wb, ws, "Web Orders");
    XLSX.writeFile(wb, `ar-invoices-${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  return (
    <div className="min-h-screen bg-[#1e1f21] text-white">
      {/* Header */}
      <div className="border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Web Orders</h1>
            <span className="text-gray-400">•</span>
            <span className="text-gray-400 text-sm">Contas a Receber</span>
          </div>
          <ScopeSelector value={selectedScope} onValueChange={setSelectedScope} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-700" onClick={runAutoReconcile} disabled={reconciling}>
              {reconciling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
              Reconcile
            </Button>
            <Button variant="outline" size="sm" className="bg-transparent border-green-700 text-green-400 hover:bg-green-900/30" onClick={runBankReconcile} disabled={bankReconciling} title="Reconciliar com extrato bancário via Disbursement">
              {bankReconciling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <DollarSign className="h-4 w-4 mr-1" />}
              Bank Reconcile
            </Button>
            <Button variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-700" onClick={syncFromHubSpot} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Sync
            </Button>
            <Button variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-700" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => { setEditingInvoice({ ...EMPTY_INVOICE, scope: selectedScope }); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> New
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
          {/* Invoice */}
          <div className="w-[100px] flex-shrink-0 group relative">
            <div className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => handleSort("invoice_number")}>
              <span>Invoice</span>
              {sortField === "invoice_number" ? (sortDirection === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />) : <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />}
              <Filter className={`h-2.5 w-2.5 ${columnFilters.invoice_number ? 'text-blue-400' : 'opacity-30'}`} onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'invoice_number' ? null : 'invoice_number'); }} />
            </div>
            {activeFilterColumn === 'invoice_number' && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded p-1 z-20">
                <input type="text" placeholder="Filtrar..." value={columnFilters.invoice_number || ''} onChange={(e) => setColumnFilters({ ...columnFilters, invoice_number: e.target.value })} className="w-24 bg-gray-700 border-none text-white text-[10px] p-1 rounded" autoFocus />
              </div>
            )}
          </div>
          {/* Date */}
          <div className="w-[70px] flex-shrink-0 group relative">
            <div className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => handleSort("invoice_date")}>
              <span>Date</span>
              {sortField === "invoice_date" ? (sortDirection === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />) : <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />}
              <Popover>
                <PopoverTrigger asChild>
                  <button className={`h-2.5 w-2.5 ${(dateRange.from || dateRange.to) ? 'text-blue-400' : 'opacity-30 hover:opacity-100'}`} onClick={(e) => e.stopPropagation()}>
                    <CalendarIcon className="h-2.5 w-2.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-gray-800 border-gray-600" align="start">
                  <div className="p-2">
                    <div className="text-xs text-gray-400 mb-2">Selecionar intervalo de datas</div>
                    <Calendar
                      mode="range"
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                      numberOfMonths={2}
                      className="bg-gray-800 text-white"
                    />
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" className="text-xs h-6" onClick={() => setDateRange({ from: undefined, to: undefined })}>
                        Limpar
                      </Button>
                      {(dateRange.from || dateRange.to) && (
                        <span className="text-xs text-gray-400 self-center">
                          {dateRange.from ? formatDate(dateRange.from.toISOString()) : '...'} - {dateRange.to ? formatDate(dateRange.to.toISOString()) : '...'}
                        </span>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {/* Order */}
          <div className="w-[65px] flex-shrink-0 group relative">
            <div className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => handleSort("order_id")}>
              <span>Order</span>
              {sortField === "order_id" ? (sortDirection === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />) : <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />}
              <Filter className={`h-2.5 w-2.5 ${columnFilters.order_id ? 'text-blue-400' : 'opacity-30'}`} onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'order_id' ? null : 'order_id'); }} />
            </div>
            {activeFilterColumn === 'order_id' && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded p-1 z-20">
                <input type="text" placeholder="Filtrar..." value={columnFilters.order_id || ''} onChange={(e) => setColumnFilters({ ...columnFilters, order_id: e.target.value })} className="w-20 bg-gray-700 border-none text-white text-[10px] p-1 rounded" autoFocus />
              </div>
            )}
          </div>
          {/* Web */}
          <div className="w-[30px] flex-shrink-0">Web</div>
          {/* Paid */}
          <div className="w-[55px] flex-shrink-0 group relative">
            <div className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => handleSort("order_status")}>
              <span>Paid</span>
              {sortField === "order_status" ? (sortDirection === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />) : <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />}
              <Filter className={`h-2.5 w-2.5 ${columnFilters.order_status ? 'text-blue-400' : 'opacity-30'}`} onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'order_status' ? null : 'order_status'); }} />
            </div>
            {activeFilterColumn === 'order_status' && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded p-1 z-20 min-w-[100px]">
                <select value={columnFilters.order_status || ''} onChange={(e) => { setColumnFilters({ ...columnFilters, order_status: e.target.value }); setActiveFilterColumn(null); }} className="w-full bg-gray-700 text-white text-[10px] p-1 rounded border-none" autoFocus>
                  <option value="">Todos</option>
                  {columnUniqueValues.order_status.map(v => <option key={v} value={v || ''}>{v}</option>)}
                </select>
              </div>
            )}
          </div>
          {/* Deal Status */}
          <div className="w-[70px] flex-shrink-0 group relative">
            <div className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => handleSort("deal_status")}>
              <span>Status</span>
              {sortField === "deal_status" ? (sortDirection === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />) : <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />}
              <Filter className={`h-2.5 w-2.5 ${columnFilters.deal_status ? 'text-blue-400' : 'opacity-30'}`} onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'deal_status' ? null : 'deal_status'); }} />
            </div>
            {activeFilterColumn === 'deal_status' && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded p-1 z-20 min-w-[130px]">
                <select value={columnFilters.deal_status || ''} onChange={(e) => { setColumnFilters({ ...columnFilters, deal_status: e.target.value }); setActiveFilterColumn(null); }} className="w-full bg-gray-700 text-white text-[10px] p-1 rounded border-none" autoFocus>
                  <option value="">Todos</option>
                  {columnUniqueValues.deal_status.map(v => <option key={v} value={v || ''}>{v}</option>)}
                </select>
              </div>
            )}
          </div>
          {/* Products */}
          <div className="w-[140px] flex-shrink-0 group relative">
            <div className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => handleSort("products")}>
              <span>Products</span>
              {sortField === "products" ? (sortDirection === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />) : <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />}
              <Filter className={`h-2.5 w-2.5 ${columnFilters.products ? 'text-blue-400' : 'opacity-30'}`} onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'products' ? null : 'products'); }} />
            </div>
            {activeFilterColumn === 'products' && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded p-1 z-20 min-w-[180px] max-h-[200px] overflow-y-auto">
                <select value={columnFilters.products || ''} onChange={(e) => { setColumnFilters({ ...columnFilters, products: e.target.value }); setActiveFilterColumn(null); }} className="w-full bg-gray-700 text-white text-[10px] p-1 rounded border-none" autoFocus>
                  <option value="">Todos</option>
                  {columnUniqueValues.products.map(v => <option key={v} value={v || ''}>{v?.substring(0, 40)}</option>)}
                </select>
              </div>
            )}
          </div>
          {/* Company */}
          <div className="w-[100px] flex-shrink-0 group relative">
            <div className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => handleSort("company_name")}>
              <span>Company</span>
              {sortField === "company_name" ? (sortDirection === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />) : <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />}
              <Filter className={`h-2.5 w-2.5 ${columnFilters.company_name ? 'text-blue-400' : 'opacity-30'}`} onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'company_name' ? null : 'company_name'); }} />
            </div>
            {activeFilterColumn === 'company_name' && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded p-1 z-20 min-w-[150px] max-h-[200px] overflow-y-auto">
                <select value={columnFilters.company_name || ''} onChange={(e) => { setColumnFilters({ ...columnFilters, company_name: e.target.value }); setActiveFilterColumn(null); }} className="w-full bg-gray-700 text-white text-[10px] p-1 rounded border-none" autoFocus>
                  <option value="">Todos</option>
                  {columnUniqueValues.company_name.map(v => <option key={v} value={v || ''}>{v?.substring(0, 30)}</option>)}
                </select>
              </div>
            )}
          </div>
          {/* Client */}
          <div className="w-[120px] flex-shrink-0 group relative">
            <div className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => handleSort("client_name")}>
              <span>Client</span>
              {sortField === "client_name" ? (sortDirection === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />) : <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />}
              <Filter className={`h-2.5 w-2.5 ${columnFilters.client_name ? 'text-blue-400' : 'opacity-30'}`} onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'client_name' ? null : 'client_name'); }} />
            </div>
          </div>
          {/* Total */}
          <div className="w-[85px] flex-shrink-0 group relative">
            <div className="flex items-center gap-1 justify-end cursor-pointer hover:text-white" onClick={() => handleSort("total_amount")}>
              <span>Total</span>
              {sortField === "total_amount" ? (sortDirection === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />) : <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />}
              <Filter className={`h-2.5 w-2.5 ${columnFilters.total_amount ? 'text-blue-400' : 'opacity-30'}`} onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'total_amount' ? null : 'total_amount'); }} />
            </div>
            {activeFilterColumn === 'total_amount' && (
              <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-600 rounded p-1 z-20">
                <input type="text" placeholder="Filtrar..." value={columnFilters.total_amount || ''} onChange={(e) => setColumnFilters({ ...columnFilters, total_amount: e.target.value })} className="w-20 bg-gray-700 border-none text-white text-[10px] p-1 rounded" autoFocus />
              </div>
            )}
          </div>
          {/* Reconciliation */}
          <div className="w-[100px] flex-shrink-0 group relative">
            <div className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => handleSort("reconciled")}>
              <span>Reconciliation</span>
              {sortField === "reconciled" ? (sortDirection === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />) : <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />}
            </div>
          </div>
          {/* Type */}
          <div className="w-[40px] flex-shrink-0 text-center">Type</div>
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
                {/* Web URL */}
                <div className="w-[30px] flex-shrink-0">
                  {inv.order_id ? (
                    <a
                      href={`https://digitalsmiledesign.com/admin/commerce/orders?source=*&search=${inv.order_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-blue-400 hover:text-blue-300"
                      title={`Abrir ${inv.order_id} no backend`}
                    >
                      <Globe className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-gray-700">-</span>
                  )}
                </div>
                {/* Paid Status - Non-Billable for zero amount */}
                <div className="w-[55px] flex-shrink-0">
                  {inv.total_amount === 0 ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-900/30 text-orange-400">Non-Bill</span>
                  ) : (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${inv.order_status === 'Paid' ? 'bg-green-900/30 text-green-400' :
                      inv.order_status === 'Partial' ? 'bg-orange-900/30 text-orange-400' :
                        'bg-gray-700/50 text-gray-400'
                      }`}>{inv.order_status || "-"}</span>
                  )}
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
                {/* Reconciliation - Manual payments are NOT reconciled unless matched with bank transaction */}
                <div className="w-[100px] flex-shrink-0">
                  {inv.total_amount === 0 ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-900/30 text-orange-400 border border-orange-700/50 flex items-center gap-1">
                      <Ban className="h-2.5 w-2.5" />Non-Billable
                    </span>
                  ) : inv.payment_method?.toLowerCase().includes('manual') && !inv.reconciled_with ? (
                    <div className="flex items-center gap-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-900/30 text-yellow-400 border border-yellow-700/50" title="Manual payment - needs bank reconciliation">Manual</span>
                      <button onClick={() => openManualReconcile(inv)} className="p-0.5 text-gray-600 hover:text-purple-400" title="Reconcile with bank"><Link2 className="h-2.5 w-2.5" /></button>
                    </div>
                  ) : inv.reconciled ? (
                    <div className="flex items-center gap-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-700/50">{inv.reconciled_with?.split(':')[0] || 'Yes'}</span>
                      <button onClick={() => loadTransactionDetails(inv)} className="p-0.5 text-gray-500 hover:text-blue-400" title="Ver detalhes"><Eye className="h-2.5 w-2.5" /></button>
                      <button onClick={() => handleRemoveReconciliation(inv)} className="p-0.5 text-gray-600 hover:text-red-400" title="Remover"><X className="h-2.5 w-2.5" /></button>
                    </div>
                  ) : (
                    <button onClick={() => openManualReconcile(inv)} className="p-1 text-gray-600 hover:text-purple-400" title="Reconcile"><Link2 className="h-3 w-3" /></button>
                  )}
                </div>
                {/* Type - Auto or Manual reconciliation indicator */}
                <div className="w-[40px] flex-shrink-0 text-center">
                  {inv.reconciled && (inv.reconciliation_type === 'automatic' ||
                    ['braintree', 'stripe', 'gocardless'].some(g => inv.reconciled_with?.toLowerCase().startsWith(g))) ? (
                    <span title="Automatic"><Zap className="h-3.5 w-3.5 text-green-500 inline" /></span>
                  ) : inv.reconciled && (inv.reconciliation_type === 'manual' || inv.reconciled_by) ? (
                    <span title={`Manual${inv.reconciled_by ? ` by ${inv.reconciled_by}` : ''}`}><User className="h-3.5 w-3.5 text-blue-500 inline" /></span>
                  ) : inv.reconciled ? (
                    <span title="Reconciled"><CheckCircle2 className="h-3.5 w-3.5 text-gray-500 inline" /></span>
                  ) : null}
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
                  placeholder="Leave empty if not charged"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={editingInvoice.payment_method || ""}
                  onValueChange={v => setEditingInvoice({ ...editingInvoice, payment_method: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
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
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
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
            <Button variant="outline" className="bg-transparent border-gray-600 text-white hover:bg-gray-700" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Reconciliation Dialog */}
      <Dialog open={manualReconcileDialog} onOpenChange={setManualReconcileDialog}>
        <DialogContent className="max-w-md bg-[#2a2b2d] border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Manual Reconciliation</DialogTitle>
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
              <Label className="text-gray-300">Payment Source</Label>
              <Select value={reconcileSource} onValueChange={setReconcileSource}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="credit-payment" className="text-white hover:bg-gray-700">Credit Payment</SelectItem>
                  <SelectItem value="bank-transfer" className="text-white hover:bg-gray-700">Bank Transfer</SelectItem>
                  <SelectItem value="hubspot-confirmed" className="text-white hover:bg-gray-700">HubSpot Confirmed</SelectItem>
                  <SelectItem value="check" className="text-white hover:bg-gray-700">Check</SelectItem>
                  <SelectItem value="cash" className="text-white hover:bg-gray-700">Cash</SelectItem>
                  <SelectItem value="other" className="text-white hover:bg-gray-700">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Payment Reference</Label>
              <Input
                value={reconcileReference}
                onChange={e => setReconcileReference(e.target.value)}
                placeholder="e.g.: Transaction ID, check number..."
                className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
              />
              <p className="text-xs text-gray-500">
                Optional. If empty, will be auto-generated.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="bg-transparent border-gray-600 text-white hover:bg-gray-700" onClick={() => setManualReconcileDialog(false)}>Cancel</Button>
            <Button onClick={handleManualReconcile} className="bg-purple-600 hover:bg-purple-700">
              <Link2 className="h-4 w-4 mr-2" />
              Reconcile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Details Dialog */}
      <Dialog open={transactionDetailsDialog} onOpenChange={setTransactionDetailsDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto !bg-[#2a2b2d] !border-gray-600 [&>button]:text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-400" />
              Reconciliation Details
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
              <p className="text-gray-400 mt-2">Loading details...</p>
            </div>
          ) : transactionDetails?.type === 'manual' ? (
            <div className="space-y-4">
              {/* Reconciliation Info */}
              <div className="p-4 bg-[#1e1f21] rounded-lg border border-gray-600">
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  {transactionDetails.source === 'hubspot-confirmed' ? 'HubSpot Confirmed Payment' :
                    transactionDetails.source === 'credit-payment' ? 'Credit Payment' :
                      transactionDetails.source === 'bank-transfer' ? 'Bank Transfer' : 'Manual Reconciliation'}
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Source:</span>
                    <span className="ml-2 text-white capitalize">{transactionDetails.source?.replace('-', ' ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Reference:</span>
                    <span className="ml-2 text-white font-mono text-xs">{transactionDetails.reference}</span>
                  </div>
                </div>
              </div>

              {/* Invoice Details */}
              <div className="p-4 bg-[#1e1f21] rounded-lg border border-gray-600">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Invoice Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Invoice Number:</span>
                    <span className="ml-2 text-white font-mono">{transactionDetails.invoice.invoice_number}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Order ID:</span>
                    <span className="ml-2 text-white font-mono">{transactionDetails.invoice.order_id || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Amount:</span>
                    <span className="ml-2 text-green-400 font-medium">
                      {transactionDetails.invoice.currency === "EUR" ? "€" : "$"}
                      {formatEuropeanNumber(transactionDetails.invoice.total_amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Order Date:</span>
                    <span className="ml-2 text-white">{formatDate(transactionDetails.invoice.order_date)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Order Status:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${transactionDetails.invoice.order_status === 'Paid' ? 'bg-green-900/30 text-green-400' :
                      transactionDetails.invoice.order_status === 'Partial' ? 'bg-orange-900/30 text-orange-400' :
                        'bg-gray-700/50 text-gray-300'
                      }`}>{transactionDetails.invoice.order_status || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Deal Status:</span>
                    <span className="ml-2 text-white">{transactionDetails.invoice.deal_status || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Payment Method Details */}
              <div className="p-4 bg-[#1e1f21] rounded-lg border border-gray-600">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Payment Method</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Payment Method:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${transactionDetails.invoice.payment_method?.toLowerCase().includes('manual') ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/50' :
                      transactionDetails.invoice.payment_method?.toLowerCase().includes('credit') ? 'bg-purple-900/30 text-purple-400 border border-purple-700/50' :
                        'bg-blue-900/30 text-blue-400 border border-blue-700/50'
                      }`}>{transactionDetails.invoice.payment_method || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Reconciled At:</span>
                    <span className="ml-2 text-white">{formatDate(transactionDetails.invoice.reconciled_at)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Payment Reference:</span>
                    <span className="ml-2 text-white font-mono text-xs">{transactionDetails.invoice.payment_reference || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Currency:</span>
                    <span className="ml-2 text-white">{transactionDetails.invoice.currency}</span>
                  </div>
                </div>
              </div>

              {/* Customer Details */}
              <div className="p-4 bg-[#1e1f21] rounded-lg border border-gray-600">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Customer Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Client:</span>
                    <span className="ml-2 text-white">{transactionDetails.invoice.client_name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Company:</span>
                    <span className="ml-2 text-white">{transactionDetails.invoice.company_name || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Email:</span>
                    <span className="ml-2 text-blue-400">{transactionDetails.invoice.email || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Products:</span>
                    <span className="ml-2 text-gray-300">{transactionDetails.invoice.products || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Note if exists */}
              {transactionDetails.invoice.note && (
                <div className="p-4 bg-[#1e1f21] rounded-lg border border-gray-600">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Notes</h4>
                  <p className="text-sm text-gray-400">{transactionDetails.invoice.note}</p>
                </div>
              )}
            </div>
          ) : transactionDetails?.type === 'payment' ? (
            <div className="space-y-4">
              {/* Transaction Info */}
              <div className="p-4 bg-[#1e1f21] rounded-lg border border-gray-600">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300">{transactionDetails.source.toUpperCase()} Transaction</h4>
                  {transactionDetails.source === 'braintree' && transactionDetails.custom_data?.transaction_id && (
                    <a
                      href={`https://www.braintreegateway.com/merchants/plncntrspdsd/transactions/${transactionDetails.custom_data.transaction_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open in Braintree
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
                      Open in GoCardless
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
                      Open in Stripe
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm text-white">
                  <div>
                    <span className="text-gray-500">Transaction ID:</span>
                    <span className="ml-2 font-mono text-xs">
                      {transactionDetails.custom_data?.transaction_id || transactionDetails.custom_data?.payment_id || transactionDetails.custom_data?.charge_id || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${transactionDetails.custom_data?.status === 'settled' || transactionDetails.custom_data?.status === 'confirmed' || transactionDetails.custom_data?.status === 'succeeded'
                      ? 'bg-green-900/50 text-green-400'
                      : 'bg-yellow-900/50 text-yellow-400'
                      }`}>
                      {transactionDetails.custom_data?.status || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Amount:</span>
                    <span className="ml-2 text-green-400 font-medium">
                      {transactionDetails.custom_data?.currency || transactionDetails.transaction?.currency || 'EUR'} {formatEuropeanNumber(parseFloat(transactionDetails.transaction?.amount) || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Transaction Date:</span>
                    <span className="ml-2">{formatDate(transactionDetails.transaction?.date)}</span>
                  </div>
                  {transactionDetails.custom_data?.customer_name && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Customer:</span>
                      <span className="ml-2">{transactionDetails.custom_data.customer_name}</span>
                    </div>
                  )}
                  {transactionDetails.custom_data?.customer_email && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2 text-gray-300 text-xs">{transactionDetails.custom_data.customer_email}</span>
                    </div>
                  )}
                  {transactionDetails.custom_data?.payment_method && (
                    <div>
                      <span className="text-gray-500">Payment Method:</span>
                      <span className="ml-2">{typeof transactionDetails.custom_data.payment_method === 'object' ? 'Card' : transactionDetails.custom_data.payment_method}</span>
                    </div>
                  )}
                  {transactionDetails.custom_data?.order_id && (
                    <div>
                      <span className="text-gray-500">Order ID:</span>
                      <span className="ml-2 font-mono text-xs">{transactionDetails.custom_data.order_id}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Settlement Info */}
              {transactionDetails.settlement && (
                <div className="p-4 bg-[#1e1f21] rounded-lg border border-blue-900/50">
                  <h4 className="text-sm font-medium text-blue-400 mb-3 flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Settlement &amp; Bank Reconciliation
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm text-white">
                    <div>
                      <span className="text-gray-500">Settlement Date:</span>
                      <span className="ml-2 text-blue-300 font-medium">{formatDate(transactionDetails.settlement.settlement_date)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Disbursement Date:</span>
                      <span className="ml-2 text-green-400 font-medium">{formatDate(transactionDetails.settlement.disbursement_date)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Bank Account:</span>
                      <span className="ml-2 text-blue-300">{transactionDetails.settlement.bank_account}</span>
                    </div>
                    {transactionDetails.settlement.disbursement_amount && (
                      <div>
                        <span className="text-gray-500">Settlement Amount:</span>
                        <span className="ml-2 text-green-400 font-medium">
                          {formatEuropeanNumber(parseFloat(transactionDetails.settlement.disbursement_amount), 2)}
                        </span>
                      </div>
                    )}
                    {transactionDetails.settlement.disbursement_id && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Settlement Batch:</span>
                        <span className="ml-2 font-mono text-xs text-gray-300">{transactionDetails.settlement.disbursement_id}</span>
                      </div>
                    )}
                  </div>

                  {/* Bank Statement Match */}
                  {transactionDetails.settlement.bank_match ? (
                    <div className="mt-4 pt-3 border-t border-green-900/30">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="h-4 w-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium text-green-400">Bank Statement Match Found</span>
                      </div>
                      <div className="bg-green-900/20 rounded p-3 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Date:</span>
                          <span className="text-white">{formatDate(transactionDetails.settlement.bank_match.date)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Amount:</span>
                          <span className="text-green-400 font-medium">{formatEuropeanNumber(parseFloat(transactionDetails.settlement.bank_match.amount), 2)}</span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-gray-400">Description:</span>
                          <span className="text-gray-300 text-right max-w-[200px] truncate" title={transactionDetails.settlement.bank_match.description}>
                            {transactionDetails.settlement.bank_match.description}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-green-900/30">
                          <span className="text-gray-400">Bank Status:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${transactionDetails.settlement.bank_match.reconciled ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                            {transactionDetails.settlement.bank_match.reconciled ? 'RECONCILED' : 'PENDING'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : transactionDetails.settlement.settlement_date && (
                    <div className="mt-4 pt-3 border-t border-gray-700/50">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs text-yellow-500">No matching bank statement entry found (±3 days)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Status History */}
              {transactionDetails.custom_data?.status_history && Array.isArray(transactionDetails.custom_data.status_history) && transactionDetails.custom_data.status_history.length > 0 && (
                <div className="p-4 bg-[#1e1f21]/50 rounded-lg border border-gray-700">
                  <h4 className="text-xs font-medium text-gray-400 mb-3">Status History</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {transactionDetails.custom_data.status_history.map((entry: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 text-xs">
                        <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-blue-400"></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${entry.status === 'settled' || entry.status === 'confirmed' || entry.status === 'succeeded'
                              ? 'bg-green-900/50 text-green-400'
                              : entry.status === 'authorized' || entry.status === 'submitted_for_settlement'
                                ? 'bg-blue-900/50 text-blue-400'
                                : 'bg-gray-700 text-gray-300'
                              }`}>
                              {entry.status?.replace(/_/g, ' ').toUpperCase()}
                            </span>
                            {entry.amount && (
                              <span className="text-gray-400">${entry.amount}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-gray-500">
                            <span>{entry.timestamp ? (() => {
                              const d = new Date(entry.timestamp);
                              const day = String(d.getUTCDate()).padStart(2, '0');
                              const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                              const year = d.getUTCFullYear();
                              const hours = String(d.getUTCHours()).padStart(2, '0');
                              const mins = String(d.getUTCMinutes()).padStart(2, '0');
                              return `${day}/${month}/${year} ${hours}:${mins}`;
                            })() : ''}</span>
                            {entry.user && (
                              <>
                                <span>•</span>
                                <span className="truncate">{entry.user}</span>
                              </>
                            )}
                            {entry.transactionSource && (
                              <>
                                <span>•</span>
                                <span className="text-gray-600">{entry.transactionSource}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Details */}
              {transactionDetails.custom_data && Object.keys(transactionDetails.custom_data).filter(key => !['transaction_id', 'payment_id', 'charge_id', 'status', 'customer_name', 'customer_email', 'payment_method', 'order_id', 'currency', 'created_at', 'customer_id', 'billing_name', 'company_name', 'merchant_account_id', 'status_history'].includes(key)).length > 0 && (
                <div className="p-4 bg-[#1e1f21]/50 rounded-lg border border-gray-700">
                  <h4 className="text-xs font-medium text-gray-400 mb-2">Additional Details</h4>
                  <div className="text-xs space-y-1 max-h-20 overflow-y-auto">
                    {Object.entries(transactionDetails.custom_data)
                      .filter(([key]) => !['transaction_id', 'payment_id', 'charge_id', 'status', 'customer_name', 'customer_email', 'payment_method', 'order_id', 'currency', 'created_at', 'customer_id', 'billing_name', 'company_name', 'merchant_account_id', 'status_history'].includes(key))
                      .slice(0, 6)
                      .map(([key, value]) => (
                        <div key={key} className="flex">
                          <span className="text-gray-500 w-32 flex-shrink-0">{key}:</span>
                          <span className="text-gray-400 truncate">{formatDynamicValue(key, value)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : transactionDetails?.type === 'not_found' ? (
            <div className="py-8 text-center">
              <AlertCircle className="h-8 w-8 mx-auto text-yellow-400" />
              <p className="text-gray-400 mt-2">Transaction not found</p>
              <p className="text-gray-500 text-sm mt-1">ID: {transactionDetails.transactionId}</p>
            </div>
          ) : transactionDetails?.type === 'error' ? (
            <div className="py-8 text-center">
              <AlertCircle className="h-8 w-8 mx-auto text-red-400" />
              <p className="text-gray-400 mt-2">Error loading details</p>
              <p className="text-red-400 text-sm mt-1">{transactionDetails.error}</p>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600" onClick={() => setTransactionDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
