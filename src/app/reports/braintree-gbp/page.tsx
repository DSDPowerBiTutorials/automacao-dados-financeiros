"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Download,
  Edit2,
  Save,
  X,
  Trash2,
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Settings,
  Database,
  XIcon,
  Zap,
  User,
  Columns3,
  Filter,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { formatDate, formatCurrency, formatTimestamp } from "@/lib/formatters";
import BraintreeApiSync from "@/components/braintree/api-sync-button";
import BraintreeUpdatePendingButton from "@/components/braintree/update-pending-button";

interface BraintreeGBPRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  conciliado: boolean;
  destinationAccount: string | null;
  reconciliationType?: "automatic" | "manual" | null;

  // Campos adicionais da Braintree API
  transaction_id?: string;
  status?: string;
  type?: string;
  currency?: string;
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  payment_method?: string;
  merchant_account_id?: string;
  created_at?: string;
  updated_at?: string;
  disbursement_date?: string | null;
  settlement_amount?: number | null;
  settlement_currency?: string | null;

  // 🔑 ID do payout agrupado (agrupa transações pagas juntas)
  disbursement_id?: string | null;

  // 💰 FEES E DEDUÇÕES
  service_fee_amount?: number | null;
  discount_amount?: number | null;
  tax_amount?: number | null;
  refunded_transaction_id?: string | null;
  merchant_account_fee?: number | null;
  processing_fee?: number | null;
  authorization_adjustment?: number | null;
  dispute_amount?: number | null;
  reserve_amount?: number | null;

  // Propriedades de agrupamento calculadas
  _groupSize?: number;
  _groupTotal?: number;
  _isGroupExpanded?: boolean;
  _isFirstInGroup?: boolean;

  [key: string]: any;
}

interface DisbursementGroup {
  disbursement_id: string;
  transactions: BraintreeGBPRow[];
  grossAmount: number;
  totalFees: number;
  netDisbursement: number;
  feesBreakdown: {
    service_fee: number;
    processing_fee: number;
    merchant_fee: number;
    discount: number;
    tax: number;
    dispute: number;
    reserve: number;
  };
}

interface BankStatementRow {
  date: string;
  amount: number;
  source: string;
}

// Mapeamento de cores por destination account
const destinationAccountColors: {
  [key: string]: { bg: string; text: string; border: string };
} = {
  "Bankinter EUR": {
    bg: "bg-[#FF7300]/10",
    text: "text-[#FF7300]",
    border: "border-[#FF7300]/20",
  },
  "Bankinter USD": {
    bg: "bg-[#FF7300]/10",
    text: "text-[#FF7300]",
    border: "border-[#FF7300]/20",
  },
  "Bankinter GBP": {
    bg: "bg-[#FF7300]/10",
    text: "text-[#FF7300]",
    border: "border-[#FF7300]/20",
  },
};

export default function BraintreeGBPPage() {
  const [rows, setRows] = useState<BraintreeGBPRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<BraintreeGBPRow>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [splitScreenUrl, setSplitScreenUrl] = useState<string | null>(null);
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set([
      "id",
      "date",
      "description",
      "amount",
      "destinationAccount",
      "reconciliation",
      "actions",
      "transaction_id",
      "status",
      "type",
      "currency",
      "customer_name",
      "customer_email",
      "payment_method",
      "merchant_account_id",
      "disbursement_date",
      "settlement_amount",
      "net_disbursement",
      "disbursement_id",
    ])
  );
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
  const [tempVisibleColumns, setTempVisibleColumns] = useState<Set<string>>(
    new Set()
  );

  // Sorting
  const [sortField, setSortField] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // Webhook tracking
  const [mostRecentWebhookTransaction, setMostRecentWebhookTransaction] = useState<BraintreeGBPRow | null>(null);

  // Disbursement grouping
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [disbursementFilter, setDisbursementFilter] = useState<string>("");
  const [disbursementGroups, setDisbursementGroups] = useState<Map<string, DisbursementGroup>>(new Map());

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [amountFilter, setAmountFilter] = useState<{
    operator: string;
    value: number;
  } | null>(null);
  const [dateFilters, setDateFilters] = useState<{
    [key: string]: { start?: string; end?: string };
  }>({});
  const [statusFilter, setStatusFilter] = useState<string>("settled"); // Default to settled
  const [merchantFilter, setMerchantFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [currencyFilter, setCurrencyFilter] = useState<string>("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("");

  useEffect(() => {
    loadData();

    // ✅ Escutar mudanças em tempo real do Supabase
    const subscription = supabase
      .channel('braintree_gbp_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'csv_rows',
          filter: 'source=in.(braintree-api-revenue,braintree-api-fees,braintree-api-disbursement)',
        },
        (payload) => {
          console.log('[Realtime Braintree GBP] Mudança detectada:', payload);
          loadData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    statusFilter,
    merchantFilter,
    typeFilter,
    currencyFilter,
    paymentMethodFilter,
    amountFilter,
    dateFilters,
    sortField,
    sortDirection,
    disbursementFilter,
  ]);

  // Função para carregar última data de sync
  const loadLastSyncDate = async () => {
    try {
      const { data, error } = await supabase
        .from("csv_rows")
        .select("created_at")
        .or("source.eq.braintree-api-revenue,source.eq.braintree-gbp")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        setLastSyncDate(formatTimestamp(new Date(data[0].created_at)));
      }
    } catch (error) {
      console.error("Error loading last sync date:", error);
    }
  };

  // Função para abrir seletor de colunas
  const openColumnSelector = () => {
    setTempVisibleColumns(new Set(visibleColumns));
    setColumnSelectorOpen(true);
  };

  // Função para cancelar seleção de colunas
  const cancelColumnSelection = () => {
    setTempVisibleColumns(new Set());
    setColumnSelectorOpen(false);
  };

  // Função para aplicar seleção de colunas
  const applyColumnSelection = () => {
    setVisibleColumns(new Set(tempVisibleColumns));
    setColumnSelectorOpen(false);
  };

  // Função para alternar coluna temporária
  const toggleTempColumn = (column: string) => {
    const newSet = new Set(tempVisibleColumns);
    if (newSet.has(column)) {
      newSet.delete(column);
    } else {
      newSet.add(column);
    }
    setTempVisibleColumns(newSet);
  };

  // Função para alternar ordenação
  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Função para toggle de grupos de disbursement
  const toggleGroup = (disbursementId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(disbursementId)) {
      newExpanded.delete(disbursementId);
    } else {
      newExpanded.add(disbursementId);
    }
    setExpandedGroups(newExpanded);
  };

  // Função para calcular o valor líquido do disbursement
  const calculateNetDisbursement = (row: BraintreeGBPRow): number => {
    const grossAmount = row.settlement_amount || row.amount;
    const fees =
      (row.service_fee_amount || 0) +
      (row.processing_fee || 0) +
      (row.merchant_account_fee || 0) +
      (row.discount_amount || 0) +
      (row.tax_amount || 0) +
      (row.dispute_amount || 0) +
      (row.reserve_amount || 0);
    const adjustments = row.authorization_adjustment || 0;

    return grossAmount - fees + adjustments;
  };

  // Função para calcular grupo completo de disbursement
  const calculateDisbursementGroup = (rows: BraintreeGBPRow[]): DisbursementGroup | null => {
    if (rows.length === 0 || !rows[0].disbursement_id) return null;

    const grossAmount = rows.reduce((sum, r) => sum + (r.settlement_amount || r.amount), 0);

    const feesBreakdown = {
      service_fee: rows.reduce((sum, r) => sum + (r.service_fee_amount || 0), 0),
      processing_fee: rows.reduce((sum, r) => sum + (r.processing_fee || 0), 0),
      merchant_fee: rows.reduce((sum, r) => sum + (r.merchant_account_fee || 0), 0),
      discount: rows.reduce((sum, r) => sum + (r.discount_amount || 0), 0),
      tax: rows.reduce((sum, r) => sum + (r.tax_amount || 0), 0),
      dispute: rows.reduce((sum, r) => sum + (r.dispute_amount || 0), 0),
      reserve: rows.reduce((sum, r) => sum + (r.reserve_amount || 0), 0),
    };

    const totalFees = Object.values(feesBreakdown).reduce((sum, fee) => sum + fee, 0);
    const adjustments = rows.reduce((sum, r) => sum + (r.authorization_adjustment || 0), 0);
    const netDisbursement = grossAmount - totalFees + adjustments;

    return {
      disbursement_id: rows[0].disbursement_id!,
      transactions: rows,
      grossAmount,
      totalFees,
      netDisbursement,
      feesBreakdown,
    };
  };

  // Função para unconcile (limpar reconciliação)
  const handleUnconcile = async (rowId: string) => {
    if (!confirm("Are you sure you want to clear the reconciliation for this transaction?")) return;

    setIsDeleting(true);
    try {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;

      // Limpar campos de reconciliação
      const { error } = await supabase
        .from("csv_rows")
        .update({
          custom_data: {
            ...row,
            conciliado: false,
            destinationAccount: null,
            reconciliationType: null,
          },
        })
        .eq("id", rowId);

      if (error) {
        console.error("Error updating row:", error);
        alert(`❌ Error clearing reconciliation: ${error.message}`);
      } else {
        await loadData();
        const now = new Date();
        const formattedTime = formatTimestamp(now);
        setLastSaved(formattedTime);
      }
    } catch (error) {
      console.error("Error clearing reconciliation:", error);
      alert("Error clearing reconciliation. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // ==========================================
  // RECONCILIAÇÃO AUTOMÁTICA COM BANK STATEMENTS
  // ==========================================
  // DESABILITADO TEMPORARIAMENTE - Aguardando dados de bank statements
  // Quando houver dados do Bankinter, altere ENABLE_AUTO_RECONCILIATION para true
  const ENABLE_AUTO_RECONCILIATION = false;

  // Função para verificar se duas datas estão dentro de ±3 dias
  const isWithinDateRange = (
    date1: string,
    date2: string,
    dayRange: number = 3,
  ): boolean => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= dayRange;
  };

  const reconcileBankStatements = async (
    braintreeRows: BraintreeGBPRow[],
  ): Promise<BraintreeGBPRow[]> => {
    // Verifica se a reconciliação automática está habilitada
    if (!ENABLE_AUTO_RECONCILIATION) {
      console.log("Auto-reconciliation is currently disabled");
      return braintreeRows;
    }

    try {
      if (!supabase) return braintreeRows;

      // Buscar dados dos bank statements (Bankinter EUR, USD, etc.)
      const { data: bankStatementsData, error } = await supabase
        .from("csv_rows")
        .select("*")
        .like("source", "bankinter-%");

      if (error || !bankStatementsData) {
        console.error("Error loading bank statements:", error);
        return braintreeRows;
      }

      // Mapear bank statements
      const bankStatements: BankStatementRow[] = bankStatementsData.map(
        (row) => ({
          date: row.date,
          amount: parseFloat(row.amount) || 0,
          source:
            row.source === "bankinter-eur"
              ? "Bankinter EUR"
              : row.source === "bankinter-usd"
                ? "Bankinter USD"
                : "Bankinter",
        }),
      );

      // Reconciliar cada linha do Braintree GBP
      const reconciledRows = braintreeRows.map((braintreeRow) => {
        // Filtrar bank statements dentro do intervalo de ±3 dias
        const matchingStatements = bankStatements.filter((bs) =>
          isWithinDateRange(braintreeRow.date, bs.date, 3),
        );

        // Tentar match exato com um único ingresso
        const exactMatch = matchingStatements.find(
          (bs) => Math.abs(bs.amount - braintreeRow.amount) < 0.01,
        );

        if (exactMatch) {
          return {
            ...braintreeRow,
            destinationAccount: exactMatch.source,
            conciliado: true,
            reconciliationType: "automatic" as const,
          };
        }

        // Tentar match com soma de múltiplos ingressos da mesma conta
        const accountGroups = new Map<string, number>();
        matchingStatements.forEach((bs) => {
          const currentSum = accountGroups.get(bs.source) || 0;
          accountGroups.set(bs.source, currentSum + bs.amount);
        });

        for (const [account, totalAmount] of accountGroups.entries()) {
          if (Math.abs(totalAmount - braintreeRow.amount) < 0.01) {
            return {
              ...braintreeRow,
              destinationAccount: account,
              conciliado: true,
              reconciliationType: "automatic" as const,
            };
          }
        }

        // Sem match encontrado
        return {
          ...braintreeRow,
          destinationAccount: null,
          conciliado: false,
          reconciliationType: null,
        };
      });

      return reconciledRows;
    } catch (error) {
      console.error("Error reconciling bank statements:", error);
      return braintreeRows;
    }
  };

  const loadData = async () => {
    console.log("[Braintree GBP] Starting loadData...");
    setIsLoading(true);

    try {
      if (!supabase) {
        console.error("[Braintree GBP] Supabase not configured!");
        setRows([]);
        return;
      }

      console.log("[Braintree GBP] Fetching data from Supabase...");

      // Carregar dados da API Braintree (source: braintree-api-revenue)
      // Filtrar apenas merchant account EUR, a partir de 01/01/2024
      const { data: rowsData, error } = await supabase
        .from("csv_rows")
        .select("*")
        .or("source.eq.braintree-api-revenue,source.eq.braintree-gbp")
        .gte("date", "2024-01-01")
        .order("date", { ascending: false });

      if (error) {
        console.error("[Braintree GBP] Error loading data:", error);
        setRows([]);
        return;
      }

      if (!rowsData || rowsData.length === 0) {
        console.log("[Braintree GBP] No data found");
        setRows([]);
        return;
      }

      console.log(`[Braintree GBP] Found ${rowsData.length} rows`);

      const mappedRows: BraintreeGBPRow[] = rowsData
        .filter((row) => {
          // Filtrar apenas merchant account EUR
          const merchantAccount = row.custom_data?.merchant_account_id;
          return !merchantAccount || merchantAccount === "digitalsmiledesignGBP" || row.source === "braintree-gbp";
        })
        .map((row) => ({
          id: row.id,
          date: row.date,
          description: row.description || "",
          amount: parseFloat(row.amount) || 0,
          conciliado: row.custom_data?.conciliado || false,
          destinationAccount: row.custom_data?.destinationAccount || null,
          reconciliationType: row.custom_data?.reconciliationType || null,

          // Campos adicionais da Braintree
          transaction_id: row.custom_data?.transaction_id,
          status: row.custom_data?.status,
          type: row.custom_data?.type,
          currency: row.custom_data?.currency,
          customer_id: row.custom_data?.customer_id,
          customer_name: row.custom_data?.customer_name,
          customer_email: row.custom_data?.customer_email,
          payment_method: row.custom_data?.payment_method,
          merchant_account_id: row.custom_data?.merchant_account_id,
          created_at: row.custom_data?.created_at,
          updated_at: row.custom_data?.updated_at,
          disbursement_date: row.custom_data?.disbursement_date,
          settlement_amount: row.custom_data?.settlement_amount,
          settlement_currency: row.custom_data?.settlement_currency,

          // 🔑 ID do payout agrupado
          disbursement_id: row.custom_data?.disbursement_id,

          // 💰 FEES E DEDUÇÕES
          service_fee_amount: row.custom_data?.service_fee_amount,
          discount_amount: row.custom_data?.discount_amount,
          tax_amount: row.custom_data?.tax_amount,
          refunded_transaction_id: row.custom_data?.refunded_transaction_id,
          merchant_account_fee: row.custom_data?.merchant_account_fee,
          processing_fee: row.custom_data?.processing_fee,
          authorization_adjustment: row.custom_data?.authorization_adjustment,
          dispute_amount: row.custom_data?.dispute_amount,
          reserve_amount: row.custom_data?.reserve_amount,
        }));

      setRows(mappedRows);

      // Identificar transação mais recente (primeira da lista, já que está ordenada por data DESC)
      if (mappedRows.length > 0) {
        setMostRecentWebhookTransaction(mappedRows[0]);
        console.log("[Braintree GBP] Most recent transaction:", mappedRows[0].date, mappedRows[0].description);
      }

      // Reset para página 1 quando dados são carregados
      setCurrentPage(1);

      console.log("[Braintree GBP] Data loaded successfully");

      // Carregar última data de sync (sem bloquear)
      loadLastSyncDate().catch(err => console.error("[Braintree GBP] Error loading sync date:", err));
    } catch (error) {
      console.error("[Braintree GBP] Unexpected error:", error);
      setRows([]);
    } finally {
      console.log("[Braintree GBP] Setting isLoading to false");
      setIsLoading(false);
    }
  };

  const handleDestinationAccountClick = (destinationAccount: string | null) => {
    if (!destinationAccount) return;

    // Mapear o nome da conta para a URL correspondente
    const accountUrlMap: { [key: string]: string } = {
      "Bankinter EUR": "/reports/bankinter-eur",
      "Bankinter USD": "/reports/bankinter-usd",
      "Bankinter GBP": "/reports/bankinter-gbp",
    };

    const url = accountUrlMap[destinationAccount];
    if (url) {
      setSplitScreenUrl(url);
    }
  };

  const closeSplitScreen = () => {
    setSplitScreenUrl(null);
  };

  const startEditing = (row: BraintreeGBPRow) => {
    setEditingRow(row.id);
    setEditedData({ ...row });
  };

  const saveEdit = async () => {
    if (!editingRow) return;

    // Atualizar conciliado se destinationAccount foi definido
    const shouldBeConciliado =
      editedData.destinationAccount !== null &&
      editedData.destinationAccount !== undefined &&
      editedData.destinationAccount !== "";

    const updatedRows = rows.map((row) =>
      row.id === editingRow
        ? {
          ...row,
          ...editedData,
          conciliado: shouldBeConciliado,
          reconciliationType: "manual" as const,
        }
        : row,
    );
    setRows(updatedRows);

    const rowToUpdate = updatedRows.find((r) => r.id === editingRow);
    if (rowToUpdate && supabase) {
      try {
        // Atualizar a linha existente diretamente
        const { error } = await supabase
          .from("csv_rows")
          .update({
            date: rowToUpdate.date,
            description: rowToUpdate.description,
            amount: rowToUpdate.amount.toString(),
            custom_data: {
              id: rowToUpdate.id,
              date: rowToUpdate.date,
              description: rowToUpdate.description,
              amount: rowToUpdate.amount,
              conciliado: rowToUpdate.conciliado,
              destinationAccount: rowToUpdate.destinationAccount,
              reconciliationType: rowToUpdate.reconciliationType,
            },
          })
          .eq("id", rowToUpdate.id);

        if (error) {
          console.error("Error updating row:", error);
          alert(`❌ Error updating row: ${error.message}`);
        } else {
          const now = new Date();
          const formattedTime = formatTimestamp(now);
          setLastSaved(formattedTime);
        }
      } catch (error) {
        console.error("Error updating row:", error);
      }
    }

    setEditingRow(null);
    setEditedData({});
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditedData({});
  };



  const downloadCSV = () => {
    try {
      const headers = [
        "ID",
        "Date",
        "Description",
        "Amount",
        "Destination Account",
        "Payout Reconciliation",
      ];

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          [
            row.id.substring(0, 8) + "...",
            formatDate(row.date),
            `"${row.description.replace(/"/g, '""')}"`,
            row.amount.toFixed(2),
            row.destinationAccount || "",
            row.conciliado ? "Yes" : "No",
          ].join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `braintree-gbp-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error saving CSV file:", error);
      alert("Error downloading CSV file");
    }
  };

  // Processar dados com filtros e ordenação
  const processedRows = useMemo(() => {
    let filtered = rows
      .filter((row) => {
        // Filtro de busca
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          const matchesSearch =
            row.description.toLowerCase().includes(search) ||
            row.id.toLowerCase().includes(search) ||
            (row.destinationAccount &&
              row.destinationAccount.toLowerCase().includes(search)) ||
            (row.transaction_id &&
              row.transaction_id.toLowerCase().includes(search)) ||
            (row.customer_name &&
              row.customer_name.toLowerCase().includes(search)) ||
            (row.customer_email &&
              row.customer_email.toLowerCase().includes(search)) ||
            (row.disbursement_id &&
              row.disbursement_id.toLowerCase().includes(search));
          if (!matchesSearch) return false;
        }

        // Filtro específico de disbursement_id
        if (disbursementFilter && disbursementFilter !== "all") {
          if (disbursementFilter === "ungrouped") {
            if (row.disbursement_id) return false;
          } else if (row.disbursement_id !== disbursementFilter) {
            return false;
          }
        }

        // Filtro de status (padrão: settled)
        if (statusFilter && statusFilter !== "all") {
          if (statusFilter === "settled") {
            // Match both "settled" and "settled_successfully"
            if (!row.status || (!row.status.includes("settled") && row.status !== "settled_successfully")) return false;
          } else if (row.status !== statusFilter) {
            return false;
          }
        }

        // Filtro de merchant account
        if (merchantFilter && merchantFilter !== "all") {
          if (!row.merchant_account_id || row.merchant_account_id !== merchantFilter) return false;
        }

        // Filtro de tipo
        if (typeFilter && typeFilter !== "all") {
          if (!row.type || row.type !== typeFilter) return false;
        }

        // Filtro de currency
        if (currencyFilter && currencyFilter !== "all") {
          const rowCurrency = row.currency || "GBP";
          if (rowCurrency !== currencyFilter) return false;
        }

        // Filtro de payment method
        if (paymentMethodFilter && paymentMethodFilter !== "all") {
          if (!row.payment_method || row.payment_method !== paymentMethodFilter) return false;
        }

        // Filtro de valor
        if (amountFilter) {
          const { operator, value } = amountFilter;
          switch (operator) {
            case "eq":
              if (Math.abs(row.amount - value) > 0.01) return false;
              break;
            case "gt":
              if (row.amount <= value) return false;
              break;
            case "lt":
              if (row.amount >= value) return false;
              break;
            case "gte":
              if (row.amount < value) return false;
              break;
            case "lte":
              if (row.amount > value) return false;
              break;
          }
        }

        // Filtro de data
        if (dateFilters.date) {
          const rowDate = new Date(row.date);
          if (dateFilters.date.start) {
            const startDate = new Date(dateFilters.date.start);
            if (rowDate < startDate) return false;
          }
          if (dateFilters.date.end) {
            const endDate = new Date(dateFilters.date.end);
            if (rowDate > endDate) return false;
          }
        }

        return true;
      });

    // 🆕 Agrupar por disbursement_id e calcular totais
    const grouped = filtered.reduce((acc, row) => {
      const disbursementId = row.disbursement_id || 'ungrouped';
      if (!acc[disbursementId]) {
        acc[disbursementId] = [];
      }
      acc[disbursementId].push(row);
      return acc;
    }, {} as Record<string, BraintreeGBPRow[]>);

    // Calcular grupos de disbursement com fees
    const newDisbursementGroups = new Map<string, DisbursementGroup>();
    Object.entries(grouped).forEach(([id, groupRows]) => {
      if (id !== 'ungrouped') {
        const group = calculateDisbursementGroup(groupRows);
        if (group) {
          newDisbursementGroups.set(id, group);
        }
      }
    });
    setDisbursementGroups(newDisbursementGroups);

    // Adicionar informações de grupo a cada row
    filtered = filtered.map((row, index, array) => {
      const disbursementId = row.disbursement_id || 'ungrouped';
      const groupRows = grouped[disbursementId];
      const groupSize = groupRows?.length || 1;
      const groupTotal = groupRows?.reduce((sum, r) => sum + r.amount, 0) || row.amount;

      // Calcular net disbursement individual e do grupo
      const netDisbursement = calculateNetDisbursement(row);
      const groupNetDisbursement = groupRows?.reduce((sum, r) => sum + calculateNetDisbursement(r), 0) || netDisbursement;

      // Verificar se é o primeiro da lista deste grupo
      const isFirstInGroup = array.findIndex(r =>
        (r.disbursement_id || 'ungrouped') === disbursementId
      ) === index;

      return {
        ...row,
        _groupSize: groupSize,
        _groupTotal: groupTotal,
        _netDisbursement: netDisbursement,
        _groupNetDisbursement: groupNetDisbursement,
        _isGroupExpanded: expandedGroups.has(disbursementId),
        _isFirstInGroup: isFirstInGroup,
      };
    });

    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "disbursement_date":
        case "created_at":
          comparison = new Date(a[sortField] || 0).getTime() - new Date(b[sortField] || 0).getTime();
          break;
        case "amount":
        case "settlement_amount":
          comparison = (a[sortField] || 0) - (b[sortField] || 0);
          break;
        case "description":
        case "transaction_id":
        case "status":
        case "type":
        case "currency":
        case "customer_name":
        case "customer_email":
        case "payment_method":
        case "merchant_account_id":
        case "destinationAccount":
          const aValue = (a[sortField] || "").toString();
          const bValue = (b[sortField] || "").toString();
          comparison = aValue.localeCompare(bValue);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [rows, searchTerm, statusFilter, merchantFilter, typeFilter, currencyFilter, paymentMethodFilter, amountFilter, dateFilters, sortField, sortDirection, disbursementFilter, expandedGroups]);

  // Paginação
  const { totalPages, adjustedCurrentPage, paginatedRows } = useMemo(() => {
    const totalPages = Math.ceil(processedRows.length / rowsPerPage);
    const adjustedCurrentPage = currentPage > totalPages && totalPages > 0 ? totalPages : (totalPages === 0 ? 1 : currentPage);
    const startIndex = (adjustedCurrentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedRows = processedRows.slice(startIndex, endIndex);

    return { totalPages, adjustedCurrentPage, paginatedRows };
  }, [processedRows, currentPage, rowsPerPage]);

  const startIndex = (adjustedCurrentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;

  const getDestinationAccountStyle = (account: string | null) => {
    if (!account)
      return {
        bg: "bg-gray-100",
        text: "text-gray-400",
        border: "border-gray-200",
      };
    return (
      destinationAccountColors[account] || {
        bg: "bg-gray-100",
        text: "text-gray-600",
        border: "border-gray-200",
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#1a2b4a]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">

      <div
        className={` transition-all duration-300 ${splitScreenUrl ? "md:pr-[50%]" : ""}`}
      >
        <header className="border-b border-[#0f1c34] bg-[#1a2b4a] text-white shadow-lg sticky top-0 z-30">
          <div className="container mx-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Braintree GBP - Payment Source
                  </h1>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-sm text-gray-300">
                      {rows.length} records ({processedRows.length} filtered) - Page {adjustedCurrentPage} of {Math.max(1, totalPages)}
                    </p>
                    {mostRecentWebhookTransaction && (
                      <p className="text-sm text-green-300 flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Latest Sale: {formatDate(mostRecentWebhookTransaction.date)}
                      </p>
                    )}
                    {lastSyncDate && (
                      <p className="text-sm text-blue-300 flex items-center gap-1">
                        <Database className="h-3 w-3" />
                        Last Webhook: {lastSyncDate}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {/* Botão de Forçar Atualização */}
                <Button
                  onClick={loadData}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-white text-white hover:bg-white/10"
                  title="Forçar atualização dos dados"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>

                {/* Sincronização direta via API */}
                <BraintreeApiSync />

                {/* Update Pending/Force Update com timestamps */}
                <BraintreeUpdatePendingButton />

                <Button onClick={downloadCSV} variant="outline" size="sm" className="gap-2 border-white text-white hover:bg-white/10">
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </div>
            </div>

            {saveSuccess && (
              <Alert className="mt-4 border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <AlertDescription className="text-emerald-800 dark:text-emerald-200 font-medium">
                  ✅ All changes saved successfully to database! Last saved:{" "}
                  {lastSaved}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </header>

        <div className="container mx-auto px-6 py-8">
          <Card className="shadow-xl">
            <CardHeader className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white">
              <CardTitle>Payment Source Details</CardTitle>
              <CardDescription className="text-white/80">
                Manage Braintree GBP transactions with filtering and sorting
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {/* Controles de Filtros e Colunas */}
              <div className="mb-6 space-y-4">
                {/* Search and Column Selector */}
                <div className="flex gap-4 items-center">
                  <div className="flex-1">
                    <Input
                      placeholder="Search by description, ID or destination account..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-md"
                    />
                  </div>

                  {/* Column Selector */}
                  <Dialog
                    open={columnSelectorOpen}
                    onOpenChange={(open) => {
                      if (open) {
                        openColumnSelector();
                      } else {
                        cancelColumnSelection();
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant={columnSelectorOpen ? "default" : "outline"}
                        size="sm"
                        onClick={openColumnSelector}
                        className={`relative overflow-visible ${columnSelectorOpen ? "bg-[#243140] hover:bg-[#1a2530] text-white" : ""}`}
                      >
                        <Columns3 className="h-4 w-4 mr-2" />
                        Select Columns
                        {visibleColumns.size < 17 && (
                          <>
                            <span
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const allColumns = new Set([
                                  "id",
                                  "date",
                                  "description",
                                  "amount",
                                  "destinationAccount",
                                  "reconciliation",
                                  "actions",
                                  "transaction_id",
                                  "status",
                                  "type",
                                  "currency",
                                  "customer_name",
                                  "customer_email",
                                  "payment_method",
                                  "merchant_account_id",
                                  "disbursement_date",
                                  "settlement_amount",
                                  "disbursement_id",
                                ]);
                                setVisibleColumns(allColumns);
                              }}
                              className="absolute -top-2 -left-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white z-10 cursor-pointer"
                              title="Clear column filter (show all)"
                            >
                              <X className="h-3 w-3" />
                            </span>
                            <span className="absolute -top-2 -right-2 bg-[#243140] text-white text-[10px] font-bold rounded-full min-w-[28px] h-5 px-1.5 flex items-center justify-center border-2 border-white whitespace-nowrap">
                              {visibleColumns.size}/17
                            </span>
                          </>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Select Visible Columns</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-3 py-4 max-h-[60vh] overflow-y-auto">
                        {[
                          { id: "id", label: "ID" },
                          { id: "date", label: "Date" },
                          { id: "description", label: "Description" },
                          { id: "amount", label: "Amount" },
                          {
                            id: "destinationAccount",
                            label: "Destination Account",
                          },
                          {
                            id: "reconciliation",
                            label: "Payout Reconciliation",
                          },
                          { id: "actions", label: "Actions" },
                          { id: "transaction_id", label: "Transaction ID" },
                          { id: "status", label: "Status" },
                          { id: "type", label: "Type" },
                          { id: "currency", label: "Currency" },
                          { id: "customer_name", label: "Customer Name" },
                          { id: "customer_email", label: "Customer Email" },
                          { id: "payment_method", label: "Payment Method" },
                          { id: "merchant_account_id", label: "Merchant Account" },
                          { id: "disbursement_date", label: "Disbursement Date" },
                          { id: "settlement_amount", label: "Settlement Amount" },
                          { id: "net_disbursement", label: "💰 Net to Bank (after fees)" },
                          { id: "disbursement_id", label: "Disbursement ID" },
                          { id: "service_fee_amount", label: "💰 Service Fee" },
                          { id: "discount_amount", label: "💰 Discount" },
                          { id: "tax_amount", label: "💰 Tax" },
                          { id: "processing_fee", label: "💰 Processing Fee" },
                          { id: "merchant_account_fee", label: "💰 Merchant Fee" },
                          { id: "authorization_adjustment", label: "💰 Auth Adjustment" },
                          { id: "dispute_amount", label: "⚠️ Dispute/Chargeback" },
                          { id: "reserve_amount", label: "🔒 Reserve" },
                          { id: "refunded_transaction_id", label: "↩️ Refund Ref" },
                        ].map((column) => (
                          <div
                            key={column.id}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={column.id}
                              checked={tempVisibleColumns.has(column.id)}
                              onCheckedChange={() =>
                                toggleTempColumn(column.id)
                              }
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
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={cancelColumnSelection}
                        >
                          Cancel
                        </Button>
                        <Button onClick={applyColumnSelection}>Apply</Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadData}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>

                {/* Quick Filters */}
                <div className="flex gap-2 flex-wrap">
                  {/* Status Filter */}
                  <Select
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                  >
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="settled">Settled</SelectItem>
                      <SelectItem value="settling">Settling</SelectItem>
                      <SelectItem value="submitted_for_settlement">Submitted</SelectItem>
                      <SelectItem value="authorized">Authorized</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Merchant Account Filter */}
                  <Select
                    value={merchantFilter}
                    onValueChange={setMerchantFilter}
                  >
                    <SelectTrigger className="w-[220px] h-9">
                      <SelectValue placeholder="Filter by merchant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Merchants</SelectItem>
                      <SelectItem value="digitalsmiledesignGBP">digitalsmiledesignGBP</SelectItem>
                      <SelectItem value="digitalsmiledesignUSD">digitalsmiledesignUSD</SelectItem>
                      <SelectItem value="digitalsmiledesignGBP">digitalsmiledesignGBP</SelectItem>
                      <SelectItem value="digitalsmiledesign_instant">digitalsmiledesign_instant</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Type Filter */}
                  <Select
                    value={typeFilter}
                    onValueChange={setTypeFilter}
                  >
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="sale">Sale</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Currency Filter */}
                  <Select
                    value={currencyFilter}
                    onValueChange={setCurrencyFilter}
                  >
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Currencies</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Payment Method Filter */}
                  <Select
                    value={paymentMethodFilter}
                    onValueChange={setPaymentMethodFilter}
                  >
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder="Payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Amount Filter */}
                  <div className="flex gap-1">
                    <Select
                      value={
                        amountFilter ? `${amountFilter.operator}:${amountFilter.value}` : "none"
                      }
                      onValueChange={(value) => {
                        if (!value || value === "none") {
                          setAmountFilter(null);
                          return;
                        }
                        const [operator, val] = value.split(":");
                        setAmountFilter({ operator, value: parseFloat(val) });
                      }}
                    >
                      <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="Filter by amount" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No filter</SelectItem>
                        <SelectItem value="gt:0">Amount {">"} 0</SelectItem>
                        <SelectItem value="gt:100">
                          Amount {">"} €100
                        </SelectItem>
                        <SelectItem value="gt:1000">
                          Amount {">"} €1000
                        </SelectItem>
                        <SelectItem value="lt:100">
                          Amount {"<"} €100
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Disbursement Filter */}
                  <Select
                    value={disbursementFilter}
                    onValueChange={setDisbursementFilter}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Payout Group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Payouts</SelectItem>
                      <SelectItem value="ungrouped">Ungrouped Only</SelectItem>
                      {Array.from(new Set(rows.map(r => r.disbursement_id).filter(Boolean))).map(id => (
                        <SelectItem key={id} value={id!}>
                          {id!.substring(0, 16)}...
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Clear All Filters */}
                  {(searchTerm || statusFilter !== "settled" || merchantFilter || typeFilter || currencyFilter || paymentMethodFilter || disbursementFilter || Object.keys(dateFilters).length > 0) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("settled");
                        setMerchantFilter("");
                        setTypeFilter("");
                        setCurrencyFilter("");
                        setPaymentMethodFilter("");
                        setDisbursementFilter("");
                        setDateFilters({});
                        setAmountFilter(null);
                      }}
                      className="gap-2"
                    >
                      <XIcon className="h-4 w-4" />
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>

              {/* Disbursement Summary */}
              {disbursementFilter && disbursementFilter !== "all" && disbursementFilter !== "ungrouped" && (
                <div className="mb-4 p-6 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-2 border-green-300 dark:border-green-700 rounded-xl shadow-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-green-600 text-white p-2 rounded-lg">
                          <Database className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-green-900 dark:text-green-100">
                            Payout Group Details
                          </h3>
                          <p className="text-sm text-green-700 dark:text-green-300 font-mono">
                            {disbursementFilter.substring(0, 32)}...
                          </p>
                        </div>
                      </div>

                      {(() => {
                        const group = disbursementGroups.get(disbursementFilter);
                        if (!group) {
                          return (
                            <p className="text-sm text-gray-600">
                              {processedRows.length} transactions • Total: £{processedRows.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                            </p>
                          );
                        }

                        return (
                          <div className="grid grid-cols-2 gap-6">
                            {/* Coluna Esquerda: Valores */}
                            <div className="space-y-3">
                              <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-lg">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                  Transactions:
                                </span>
                                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                  {group.transactions.length}
                                </span>
                              </div>

                              <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-lg">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                  Gross Amount:
                                </span>
                                <span className="text-lg font-bold text-gray-900 dark:text-white">
                                  £{group.grossAmount.toFixed(2)}
                                </span>
                              </div>

                              <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                  Total Fees:
                                </span>
                                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                                  -£{group.totalFees.toFixed(2)}
                                </span>
                              </div>

                              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-md">
                                <span className="text-sm font-bold text-white uppercase tracking-wide">
                                  💰 Net to Bank:
                                </span>
                                <span className="text-2xl font-black text-white">
                                  £{group.netDisbursement.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {/* Coluna Direita: Breakdown de Fees */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                                Fees Breakdown:
                              </h4>

                              {group.feesBreakdown.service_fee > 0 && (
                                <div className="flex justify-between items-center p-2 bg-white dark:bg-slate-800 rounded text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">Service Fee</span>
                                  <span className="font-semibold text-red-600">-£{group.feesBreakdown.service_fee.toFixed(2)}</span>
                                </div>
                              )}

                              {group.feesBreakdown.processing_fee > 0 && (
                                <div className="flex justify-between items-center p-2 bg-white dark:bg-slate-800 rounded text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">Processing Fee</span>
                                  <span className="font-semibold text-red-600">-£{group.feesBreakdown.processing_fee.toFixed(2)}</span>
                                </div>
                              )}

                              {group.feesBreakdown.merchant_fee > 0 && (
                                <div className="flex justify-between items-center p-2 bg-white dark:bg-slate-800 rounded text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">Merchant Fee</span>
                                  <span className="font-semibold text-red-600">-£{group.feesBreakdown.merchant_fee.toFixed(2)}</span>
                                </div>
                              )}

                              {group.feesBreakdown.discount > 0 && (
                                <div className="flex justify-between items-center p-2 bg-white dark:bg-slate-800 rounded text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">Discount</span>
                                  <span className="font-semibold text-orange-600">-£{group.feesBreakdown.discount.toFixed(2)}</span>
                                </div>
                              )}

                              {group.feesBreakdown.tax > 0 && (
                                <div className="flex justify-between items-center p-2 bg-white dark:bg-slate-800 rounded text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">Tax</span>
                                  <span className="font-semibold text-purple-600">-£{group.feesBreakdown.tax.toFixed(2)}</span>
                                </div>
                              )}

                              {group.feesBreakdown.dispute > 0 && (
                                <div className="flex justify-between items-center p-2 bg-red-100 dark:bg-red-900/30 rounded text-sm border border-red-300">
                                  <span className="text-red-700 dark:text-red-400">⚠️ Disputes</span>
                                  <span className="font-bold text-red-700 dark:text-red-400">-£{group.feesBreakdown.dispute.toFixed(2)}</span>
                                </div>
                              )}

                              {group.feesBreakdown.reserve > 0 && (
                                <div className="flex justify-between items-center p-2 bg-blue-100 dark:bg-blue-900/30 rounded text-sm border border-blue-300">
                                  <span className="text-blue-700 dark:text-blue-400">🔒 Reserve</span>
                                  <span className="font-bold text-blue-700 dark:text-blue-400">-£{group.feesBreakdown.reserve.toFixed(2)}</span>
                                </div>
                              )}

                              {Object.values(group.feesBreakdown).every(v => v === 0) && (
                                <p className="text-sm text-gray-500 italic">No fees recorded</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Botão para buscar match no Bankinter */}
                      {disbursementGroups.get(disbursementFilter) && (
                        <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                          <Button
                            onClick={() => {
                              const group = disbursementGroups.get(disbursementFilter);
                              if (group) {
                                const bankUrl = `/reports/bankinter-gbp?amount=${group.netDisbursement.toFixed(2)}`;
                                window.open(bankUrl, '_blank');
                              }
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                          >
                            <Database className="h-4 w-4" />
                            Find Match in Bankinter GBP (£{disbursementGroups.get(disbursementFilter)!.netDisbursement.toFixed(2)})
                          </Button>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisbursementFilter("")}
                      className="gap-2 ml-4"
                    >
                      <XIcon className="h-4 w-4" />
                      Clear
                    </Button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-[#1a2b4a] bg-gray-50 dark:bg-slate-800">
                      {/* Coluna de Grupo de Payout */}
                      {visibleColumns.has("disbursement_id") && (
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[#1a2b4a] dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
                          onClick={() => toggleSort("disbursement_id")}>
                          <div className="flex items-center gap-2">
                            <span>Payout Group</span>
                            {sortField === "disbursement_id" && (
                              sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </th>
                      )}
                      {visibleColumns.has("id") && (
                        <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white w-24">
                          <button
                            onClick={() => toggleSort("id")}
                            className="flex items-center gap-1 hover:text-blue-600"
                          >
                            ID
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("date") && (
                        <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <button
                            onClick={() => toggleSort("date")}
                            className="flex items-center gap-1 hover:text-blue-600"
                          >
                            Date
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("description") && (
                        <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <button
                            onClick={() => toggleSort("description")}
                            className="flex items-center gap-1 hover:text-blue-600"
                          >
                            Description
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("amount") && (
                        <th className="text-right py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <button
                            onClick={() => toggleSort("amount")}
                            className="flex items-center gap-1 hover:text-blue-600 ml-auto"
                          >
                            Amount
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("destinationAccount") && (
                        <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <button
                            onClick={() => toggleSort("destinationAccount")}
                            className="flex items-center gap-1 hover:text-blue-600 mx-auto"
                          >
                            Destination Account
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("reconciliation") && (
                        <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          Payout Reconciliation
                        </th>
                      )}
                      {visibleColumns.has("actions") && (
                        <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          Actions
                        </th>
                      )}
                      {visibleColumns.has("transaction_id") && (
                        <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <button
                            onClick={() => toggleSort("transaction_id")}
                            className="flex items-center gap-1 hover:text-blue-600"
                          >
                            Transaction ID
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("status") && (
                        <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <button
                            onClick={() => toggleSort("status")}
                            className="flex items-center gap-1 hover:text-blue-600 mx-auto"
                          >
                            Status
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("type") && (
                        <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <button
                            onClick={() => toggleSort("type")}
                            className="flex items-center gap-1 hover:text-blue-600 mx-auto"
                          >
                            Type
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("currency") && (
                        <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <button
                            onClick={() => toggleSort("currency")}
                            className="flex items-center gap-1 hover:text-blue-600 mx-auto"
                          >
                            Currency
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("customer_name") && (
                        <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <button
                            onClick={() => toggleSort("customer_name")}
                            className="flex items-center gap-1 hover:text-blue-600"
                          >
                            Customer Name
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("customer_email") && (
                        <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <button
                            onClick={() => toggleSort("customer_email")}
                            className="flex items-center gap-1 hover:text-blue-600"
                          >
                            Customer Email
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("payment_method") && (
                        <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <button
                            onClick={() => toggleSort("payment_method")}
                            className="flex items-center gap-1 hover:text-blue-600"
                          >
                            Payment Method
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("merchant_account_id") && (
                        <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <button
                            onClick={() => toggleSort("merchant_account_id")}
                            className="flex items-center gap-1 hover:text-blue-600"
                          >
                            Merchant Account
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("disbursement_date") && (
                        <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <button
                            onClick={() => toggleSort("disbursement_date")}
                            className="flex items-center gap-1 hover:text-blue-600"
                          >
                            Disbursement Date
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("disbursement_id") && (
                        <th className="border px-2 py-2 bg-gray-100 text-xs font-medium text-gray-700">
                          Disbursement ID
                          <br />
                          <span className="text-[10px] text-gray-500">(Payout Group)</span>
                        </th>
                      )}
                      {visibleColumns.has("settlement_amount") && (
                        <th className="text-right py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <button
                            onClick={() => toggleSort("settlement_amount")}
                            className="flex items-center gap-1 hover:text-blue-600 ml-auto"
                          >
                            Settlement Amount
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("net_disbursement") && (
                        <th className="text-right py-4 px-4 font-bold text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20">
                          <button
                            onClick={() => toggleSort("_netDisbursement")}
                            className="flex items-center gap-1 hover:text-green-800 ml-auto"
                          >
                            💰 Net to Bank
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("service_fee_amount") && (
                        <th className="text-right py-4 px-4 font-bold text-sm text-red-600 dark:text-red-400">
                          <button
                            onClick={() => toggleSort("service_fee_amount")}
                            className="flex items-center gap-1 hover:text-red-700 ml-auto"
                          >
                            Service Fee
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("discount_amount") && (
                        <th className="text-right py-4 px-4 font-bold text-sm text-orange-600 dark:text-orange-400">
                          <button
                            onClick={() => toggleSort("discount_amount")}
                            className="flex items-center gap-1 hover:text-orange-700 ml-auto"
                          >
                            Discount
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("tax_amount") && (
                        <th className="text-right py-4 px-4 font-bold text-sm text-purple-600 dark:text-purple-400">
                          <button
                            onClick={() => toggleSort("tax_amount")}
                            className="flex items-center gap-1 hover:text-purple-700 ml-auto"
                          >
                            Tax
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("processing_fee") && (
                        <th className="text-right py-4 px-4 font-bold text-sm text-red-600 dark:text-red-400">
                          <button
                            onClick={() => toggleSort("processing_fee")}
                            className="flex items-center gap-1 hover:text-red-700 ml-auto"
                          >
                            Processing Fee
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("merchant_account_fee") && (
                        <th className="text-right py-4 px-4 font-bold text-sm text-red-600 dark:text-red-400">
                          <button
                            onClick={() => toggleSort("merchant_account_fee")}
                            className="flex items-center gap-1 hover:text-red-700 ml-auto"
                          >
                            Merchant Fee
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("authorization_adjustment") && (
                        <th className="text-right py-4 px-4 font-bold text-sm text-yellow-600 dark:text-yellow-400">
                          <button
                            onClick={() => toggleSort("authorization_adjustment")}
                            className="flex items-center gap-1 hover:text-yellow-700 ml-auto"
                          >
                            Auth Adjustment
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("dispute_amount") && (
                        <th className="text-right py-4 px-4 font-bold text-sm text-red-700 dark:text-red-500">
                          <button
                            onClick={() => toggleSort("dispute_amount")}
                            className="flex items-center gap-1 hover:text-red-800 ml-auto"
                          >
                            ⚠️ Dispute
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("reserve_amount") && (
                        <th className="text-right py-4 px-4 font-bold text-sm text-blue-600 dark:text-blue-400">
                          <button
                            onClick={() => toggleSort("reserve_amount")}
                            className="flex items-center gap-1 hover:text-blue-700 ml-auto"
                          >
                            🔒 Reserve
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("refunded_transaction_id") && (
                        <th className="text-left py-4 px-4 font-bold text-sm text-orange-600 dark:text-orange-400">
                          <button
                            onClick={() => toggleSort("refunded_transaction_id")}
                            className="flex items-center gap-1 hover:text-orange-700"
                          >
                            ↩️ Refund Ref
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row, index) => {
                      const isEditing = editingRow === row.id;
                      const style = getDestinationAccountStyle(row.destinationAccount);
                      const disbursementId = row.disbursement_id || 'ungrouped';
                      const isGrouped = row.disbursement_id && row._groupSize && row._groupSize > 1;

                      return (
                        <tr
                          key={row.id}
                          className={`
                            border-b hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors
                            ${isGrouped ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}
                            ${row._isFirstInGroup && isGrouped ? 'border-t-2 border-blue-400' : ''}
                          `}
                        >
                          {/* Coluna de Grupo de Payout */}
                          {visibleColumns.has("disbursement_id") && (
                            <td className="px-4 py-3 text-sm">
                              {row.disbursement_id ? (
                                <div className="flex items-center gap-2">
                                  {/* Botão de Expandir/Colapsar */}
                                  {row._isFirstInGroup && row._groupSize && row._groupSize > 1 && (
                                    <button
                                      onClick={() => toggleGroup(disbursementId)}
                                      className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors"
                                      title={row._isGroupExpanded ? "Collapse group" : "Expand group"}
                                    >
                                      {row._isGroupExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-blue-600" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-blue-600" />
                                      )}
                                    </button>
                                  )}

                                  <div className="flex flex-col">
                                    <button
                                      onClick={() => setDisbursementFilter(row.disbursement_id || "")}
                                      className="text-blue-600 dark:text-blue-400 hover:underline text-left font-mono text-xs"
                                      title={`Filter by this payout group (${row._groupSize} txns)`}
                                    >
                                      {row.disbursement_id.substring(0, 12)}...
                                    </button>

                                    {/* Indicador de Grupo */}
                                    {row._isFirstInGroup && row._groupSize && row._groupSize > 1 && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                          {row._groupSize} txns
                                        </span>
                                        <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                                          £{row._groupTotal?.toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs italic">No payout</span>
                              )}
                            </td>
                          )}

                          {visibleColumns.has("id") && (
                            <td className="py-3 px-4 text-sm font-bold">
                              {row.id.substring(0, 8)}...
                            </td>
                          )}
                          {visibleColumns.has("date") && (
                            <td className="py-3 px-4 text-sm">
                              {editingRow === row.id ? (
                                <Input
                                  value={editedData.date || ""}
                                  onChange={(e) =>
                                    setEditedData({
                                      ...editedData,
                                      date: e.target.value,
                                    })
                                  }
                                  className="w-32"
                                />
                              ) : (
                                formatDate(row.date)
                              )}
                            </td>
                          )}
                          {visibleColumns.has("description") && (
                            <td className="py-3 px-4 text-sm max-w-xs truncate">
                              {editingRow === row.id ? (
                                <Input
                                  value={editedData.description || ""}
                                  onChange={(e) =>
                                    setEditedData({
                                      ...editedData,
                                      description: e.target.value,
                                    })
                                  }
                                  className="w-full"
                                />
                              ) : (
                                row.description
                              )}
                            </td>
                          )}
                          {visibleColumns.has("amount") && (
                            <td className="py-3 px-4 text-sm text-right font-bold text-[#4fc3f7]">
                              {editingRow === row.id ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editedData.amount || 0}
                                  onChange={(e) =>
                                    setEditedData({
                                      ...editedData,
                                      amount: parseFloat(e.target.value),
                                    })
                                  }
                                  className="w-32"
                                />
                              ) : (
                                formatCurrency(row.amount)
                              )}
                            </td>
                          )}
                          {visibleColumns.has("destinationAccount") && (
                            <td className="py-3 px-4 text-center text-sm">
                              {editingRow === row.id ? (
                                <Select
                                  value={editedData.destinationAccount || ""}
                                  onValueChange={(value) =>
                                    setEditedData({
                                      ...editedData,
                                      destinationAccount: value,
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select account" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Bankinter EUR">
                                      Bankinter EUR
                                    </SelectItem>
                                    <SelectItem value="Bankinter USD">
                                      Bankinter USD
                                    </SelectItem>
                                    <SelectItem value="Bankinter GBP">
                                      Bankinter GBP
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : row.destinationAccount ? (
                                <button
                                  onClick={() =>
                                    handleDestinationAccountClick(
                                      row.destinationAccount,
                                    )
                                  }
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text} border ${style.border} hover:opacity-80 transition-opacity cursor-pointer`}
                                >
                                  {row.destinationAccount}
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs">
                                  N/A
                                </span>
                              )}
                            </td>
                          )}
                          {visibleColumns.has("reconciliation") && (
                            <td className="py-3 px-4 text-center">
                              {row.conciliado ? (
                                <div className="flex items-center justify-center gap-2">
                                  {row.reconciliationType === "automatic" ? (
                                    <div className="relative group">
                                      <Zap className="h-5 w-5 text-green-600 mx-auto" />
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                        Automatic reconciliation
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="relative group">
                                      <User className="h-5 w-5 text-blue-600 mx-auto" />
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                        Manual reconciliation
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <XCircle className="h-5 w-5 text-gray-400 mx-auto" />
                              )}
                            </td>
                          )}
                          {visibleColumns.has("actions") && (
                            <td className="py-3 px-4 text-center">
                              {editingRow === row.id ? (
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={saveEdit}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEdit}
                                    className="h-8 w-8 p-0"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEditing(row)}
                                    className="h-8 w-8 p-0"
                                    disabled={isDeleting}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  {row.conciliado && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleUnconcile(row.id)}
                                      className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                      disabled={isDeleting}
                                      title="Clear reconciliation"
                                    >
                                      {isDeleting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <RefreshCw className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                          {visibleColumns.has("transaction_id") && (
                            <td className="py-3 px-4 text-sm font-mono text-xs">
                              {row.transaction_id || "N/A"}
                            </td>
                          )}
                          {visibleColumns.has("status") && (
                            <td className="py-3 px-4 text-center">
                              <Badge variant={row.status === "settled" || row.status === "settled_successfully" ? "default" : "secondary"}>
                                {row.status || "N/A"}
                              </Badge>
                            </td>
                          )}
                          {visibleColumns.has("type") && (
                            <td className="py-3 px-4 text-center text-sm">
                              {row.type || "N/A"}
                            </td>
                          )}
                          {visibleColumns.has("currency") && (
                            <td className="py-3 px-4 text-center text-sm font-bold">
                              {row.currency || "GBP"}
                            </td>
                          )}
                          {visibleColumns.has("customer_name") && (
                            <td className="py-3 px-4 text-sm">
                              {row.customer_name || "N/A"}
                            </td>
                          )}
                          {visibleColumns.has("customer_email") && (
                            <td className="py-3 px-4 text-sm text-blue-600">
                              {row.customer_email || "N/A"}
                            </td>
                          )}
                          {visibleColumns.has("payment_method") && (
                            <td className="py-3 px-4 text-sm">
                              {row.payment_method || "N/A"}
                            </td>
                          )}
                          {visibleColumns.has("merchant_account_id") && (
                            <td className="py-3 px-4 text-sm font-mono text-xs">
                              {row.merchant_account_id || "N/A"}
                            </td>
                          )}
                          {visibleColumns.has("disbursement_date") && (
                            <td className="py-3 px-4 text-sm">
                              {row.disbursement_date ? formatDate(row.disbursement_date) : "N/A"}
                            </td>
                          )}
                          {visibleColumns.has("disbursement_id") && (
                            <td className="py-3 px-4 text-sm">
                              {row.disbursement_id ? (
                                <span className="font-mono text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                  {row.disbursement_id.substring(0, 12)}...
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.has("settlement_amount") && (
                            <td className="py-3 px-4 text-right text-sm font-bold text-green-600">
                              {row.settlement_amount ? formatCurrency(row.settlement_amount) : "N/A"}
                            </td>
                          )}
                          {visibleColumns.has("net_disbursement") && (
                            <td className="py-3 px-4 text-right bg-green-50 dark:bg-green-900/20">
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-sm font-bold text-green-700 dark:text-green-400">
                                  £{(row._netDisbursement || 0).toFixed(2)}
                                </span>
                                {row._isFirstInGroup && row._groupSize && row._groupSize > 1 && (
                                  <span className="text-xs text-green-600 dark:text-green-500 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded">
                                    Group: £{(row._groupNetDisbursement || 0).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.has("service_fee_amount") && (
                            <td className="py-3 px-4 text-right text-sm font-bold text-red-600">
                              {row.service_fee_amount ? `-${formatCurrency(row.service_fee_amount)}` : "-"}
                            </td>
                          )}
                          {visibleColumns.has("discount_amount") && (
                            <td className="py-3 px-4 text-right text-sm font-bold text-orange-600">
                              {row.discount_amount ? `-${formatCurrency(row.discount_amount)}` : "-"}
                            </td>
                          )}
                          {visibleColumns.has("tax_amount") && (
                            <td className="py-3 px-4 text-right text-sm font-bold text-purple-600">
                              {row.tax_amount ? `-${formatCurrency(row.tax_amount)}` : "-"}
                            </td>
                          )}
                          {visibleColumns.has("processing_fee") && (
                            <td className="py-3 px-4 text-right text-sm font-bold text-red-600">
                              {row.processing_fee ? `-${formatCurrency(row.processing_fee)}` : "-"}
                            </td>
                          )}
                          {visibleColumns.has("merchant_account_fee") && (
                            <td className="py-3 px-4 text-right text-sm font-bold text-red-600">
                              {row.merchant_account_fee ? `-${formatCurrency(row.merchant_account_fee)}` : "-"}
                            </td>
                          )}
                          {visibleColumns.has("authorization_adjustment") && (
                            <td className="py-3 px-4 text-right text-sm font-bold text-yellow-600">
                              {row.authorization_adjustment ? formatCurrency(row.authorization_adjustment) : "-"}
                            </td>
                          )}
                          {visibleColumns.has("dispute_amount") && (
                            <td className="py-3 px-4 text-right text-sm font-bold text-red-700">
                              {row.dispute_amount ? (
                                <span className="bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded">
                                  -{formatCurrency(row.dispute_amount)}
                                </span>
                              ) : "-"}
                            </td>
                          )}
                          {visibleColumns.has("reserve_amount") && (
                            <td className="py-3 px-4 text-right text-sm font-bold text-blue-600">
                              {row.reserve_amount ? (
                                <span className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                                  -{formatCurrency(row.reserve_amount)}
                                </span>
                              ) : "-"}
                            </td>
                          )}
                          {visibleColumns.has("refunded_transaction_id") && (
                            <td className="py-3 px-4 text-sm font-mono text-xs text-orange-600">
                              {row.refunded_transaction_id ? (
                                <span title={row.refunded_transaction_id}>
                                  {row.refunded_transaction_id.substring(0, 8)}...
                                </span>
                              ) : "-"}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Showing {startIndex + 1} to {Math.min(endIndex, processedRows.length)} of {processedRows.length} results
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-2 px-3">
                      <span className="text-sm font-medium">
                        Page {adjustedCurrentPage} of {totalPages}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Split Screen Panel */}
      {splitScreenUrl && (
        <div className="fixed top-0 right-0 w-1/2 h-screen bg-white dark:bg-slate-900 shadow-2xl z-40 border-l-4 border-blue-500">
          <div className="h-full flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Bank Statement Details</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeSplitScreen}
                className="text-white hover:bg-blue-800"
              >
                <XIcon className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={splitScreenUrl}
                className="w-full h-full border-0"
                title="Bank Statement"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
