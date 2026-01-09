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
import BraintreeSyncControls from "@/components/braintree/sync-controls";
import { SyncStatusBadge } from "@/components/sync/SyncStatusBadge";

interface BraintreeEURRow {
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
  settlement_currency_iso_code?: string | null; // 🌍 Moeda real do depósito (pode diferir de currency)
  settlement_currency_exchange_rate?: number | null; // 💱 Taxa FX aplicada

  // 🔑 ID do payout agrupado (agrupa transações pagas juntas)
  disbursement_id?: string | null;
  settlement_batch_id?: string | null; // Formato: YYYY-MM-DD_merchant_uniqueid

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
  transactions: BraintreeEURRow[];
  netDisbursement: number; // settlement_amount já é líquido (fees deduzidos)
  // Nota: fees individuais não disponíveis no CSV, já deduzidos no settlement_amount
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

export default function BraintreeEURPage() {
  const [rows, setRows] = useState<BraintreeEURRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<BraintreeEURRow>>({});
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
      "settlement_currency_iso_code",
      "settlement_currency_exchange_rate",
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
  const [mostRecentWebhookTransaction, setMostRecentWebhookTransaction] = useState<BraintreeEURRow | null>(null);

  // Disbursement grouping
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [disbursementFilter, setDisbursementFilter] = useState<string>("");

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
      .channel('braintree_eur_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Qualquer evento (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'csv_rows',
          filter: 'source=in.(braintree-api-revenue,braintree-api-fees,braintree-api-disbursement)',
        },
        (payload) => {
          console.log('[Realtime Braintree EUR] Mudança detectada:', payload);
          // Recarregar dados quando houver mudança
          loadData();
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime Braintree EUR] Status: ${status}`);
      });

    // Cleanup ao desmontar
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Reset para página 1 quando filtros mudam
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
        .or("source.eq.braintree-api-revenue,source.eq.braintree-eur")
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

  // ⚠️ NOTA: settlement_amount JÁ contém o valor líquido (fees já deduzidos pela Braintree)
  // Não é necessário cálculo adicional - usar settlement_amount diretamente

  // 💰 Função para calcular grupo de disbursement agregado
  const calculateDisbursementGroup = (rows: BraintreeEURRow[]): DisbursementGroup | null => {
    if (!rows || rows.length === 0) return null;

    // settlement_amount JÁ é o valor líquido (fees deduzidos), então apenas somamos
    const netDisbursement = rows.reduce((sum, r) => sum + (r.settlement_amount ?? r.amount ?? 0), 0);

    // Nota: fees não são fornecidos separadamente no CSV Braintree,
    // eles já estão deduzidos no settlement_amount

    return {
      transactions: rows,
      netDisbursement,
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
    braintreeRows: BraintreeEURRow[],
  ): Promise<BraintreeEURRow[]> => {
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

      // Reconciliar cada linha do Braintree EUR
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
    console.log("[Braintree EUR] Starting loadData...");
    setIsLoading(true);

    try {
      if (!supabase) {
        console.error("[Braintree EUR] Supabase not configured!");
        setRows([]);
        return;
      }

      console.log("[Braintree EUR] Fetching data from Supabase...");

      // Carregar dados da API Braintree (source: braintree-api-revenue)
      // Filtrar apenas merchant account EUR, a partir de 01/01/2024
      const { data: rowsData, error } = await supabase
        .from("csv_rows")
        .select("*")
        .or("source.eq.braintree-api-revenue,source.eq.braintree-eur")
        .gte("date", "2024-01-01")
        .order("date", { ascending: false });

      if (error) {
        console.error("[Braintree EUR] Error loading data:", error);
        setRows([]);
        return;
      }

      if (!rowsData || rowsData.length === 0) {
        console.log("[Braintree EUR] No data found");
        setRows([]);
        return;
      }

      console.log(`[Braintree EUR] Found ${rowsData.length} rows`);

      const mappedRows: BraintreeEURRow[] = rowsData
        .filter((row) => {
          // Filtrar apenas merchant account EUR
          const merchantAccount = row.custom_data?.merchant_account_id;
          return !merchantAccount || merchantAccount === "digitalsmiledesignEUR" || row.source === "braintree-eur";
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
        console.log("[Braintree EUR] Most recent transaction:", mappedRows[0].date, mappedRows[0].description);
      }

      // Reset para página 1 quando dados são carregados
      setCurrentPage(1);

      console.log("[Braintree EUR] Data loaded successfully");

      // Carregar última data de sync (sem bloquear)
      loadLastSyncDate().catch(err => console.error("[Braintree EUR] Error loading sync date:", err));
    } catch (error) {
      console.error("[Braintree EUR] Unexpected error:", error);
      setRows([]);
    } finally {
      console.log("[Braintree EUR] Setting isLoading to false");
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

  const startEditing = (row: BraintreeEURRow) => {
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
      a.download = `braintree-eur-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error saving CSV file:", error);
      alert("Error downloading CSV file");
    }
  };

  // Processar dados com filtros e ordenação (memoizado para evitar recálculos infinitos)
  const processedRows = useMemo(() => {
    const filtered = rows
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
          const rowCurrency = row.currency || "EUR";
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
    const grouped = filtered.reduce((acc: Record<string, BraintreeEURRow[]>, row: BraintreeEURRow) => {
      const disbursementId = row.disbursement_id || 'ungrouped';
      if (!acc[disbursementId]) {
        acc[disbursementId] = [];
      }
      acc[disbursementId].push(row);
      return acc;
    }, {} as Record<string, BraintreeEURRow[]>);

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
    // Note: EUR não tem setDisbursementGroups - remover essa linha se não existir o estado

    // Adicionar informações de grupo a cada row
    let processedFiltered = filtered.map((row: BraintreeEURRow, index: number, array: BraintreeEURRow[]) => {
      const disbursementId = row.disbursement_id || 'ungrouped';
      const groupRows = grouped[disbursementId];
      const groupSize = groupRows?.length || 1;
      const groupTotal = groupRows?.reduce((sum: number, r: BraintreeEURRow) => sum + r.amount, 0) || row.amount;

      // Verificar se é o primeiro da lista deste grupo
      const isFirstInGroup = array.findIndex((r: BraintreeEURRow) =>
        (r.disbursement_id || 'ungrouped') === disbursementId
      ) === index;

      return {
        ...row,
        _groupSize: groupSize,
        _groupTotal: groupTotal,
        _isGroupExpanded: expandedGroups.has(disbursementId),
        _isFirstInGroup: isFirstInGroup,
      };
    });

    return processedFiltered.sort((a: BraintreeEURRow, b: BraintreeEURRow) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
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
  }, [
    rows,
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
  ]);

  // Paginação (memoizada para evitar recálculos)
  const { totalPages, adjustedCurrentPage, paginatedRows, startIndex, endIndex } = useMemo(() => {
    const totalPages = Math.ceil(processedRows.length / rowsPerPage);
    const adjustedCurrentPage =
      currentPage > totalPages && totalPages > 0
        ? totalPages
        : totalPages === 0
          ? 1
          : currentPage;
    const startIndex = (adjustedCurrentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedRows = processedRows.slice(startIndex, endIndex);

    return { totalPages, adjustedCurrentPage, paginatedRows, startIndex, endIndex };
  }, [processedRows, currentPage, rowsPerPage]);

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
                  <h1 className="text-2xl font-bold text-white mb-2">
                    Braintree EUR - Payment Source
                  </h1>
                  <SyncStatusBadge source="braintree-eur" />
                  <div className="text-sm text-white/80 mt-1">
                    {processedRows.length} records {rows.length !== processedRows.length && `(${rows.length} total)`}
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
                  Recarregar
                </Button>

                {/* Controles de Sincronização */}
                <BraintreeSyncControls />

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
                Manage Braintree EUR transactions with filtering and sorting
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
                          { id: "settlement_currency_iso_code", label: "🌍 Settlement Currency (Real)" },
                          { id: "settlement_currency_exchange_rate", label: "💱 FX Exchange Rate" },
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
                      <SelectItem value="digitalsmiledesignEUR">digitalsmiledesignEUR</SelectItem>
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

                  {/* Clear all filters button */}
                  {(searchTerm || amountFilter || statusFilter !== "settled" || merchantFilter || typeFilter || currencyFilter || paymentMethodFilter || Object.keys(dateFilters).length > 0) && (
                    <Badge
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive/20 px-3 h-9 flex items-center"
                      onClick={() => {
                        setSearchTerm("");
                        setAmountFilter(null);
                        setStatusFilter("settled");
                        setMerchantFilter("");
                        setTypeFilter("");
                        setCurrencyFilter("");
                        setPaymentMethodFilter("");
                        setDateFilters({});
                      }}
                    >
                      Clear all filters
                      <X className="h-3 w-3 ml-2" />
                    </Badge>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">{/* Tabela aqui */}
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-[#e5e7eb] dark:border-[#2c3e5f] bg-gray-50 dark:bg-slate-800">
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
                      {visibleColumns.has("disbursement_id") && (
                        <th className="border px-2 py-2 bg-gray-100 text-xs font-medium text-gray-700">
                          Disbursement ID
                          <br />
                          <span className="text-[10px] text-gray-500">(Payout Group)</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-gray-500"
                        >
                          No data available matching your filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row: BraintreeEURRow) => {
                        const accountStyle = getDestinationAccountStyle(
                          row.destinationAccount,
                        );
                        return (
                          <tr
                            key={row.id}
                            className="border-b border-[#e5e7eb] dark:border-[#2c3e5f] hover:bg-gray-50 dark:hover:bg-slate-800/50"
                          >
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
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${accountStyle.bg} ${accountStyle.text} border ${accountStyle.border} hover:opacity-80 transition-opacity cursor-pointer`}
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
                                {row.currency || "EUR"}
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
                            {visibleColumns.has("settlement_amount") && (
                              <td className="py-3 px-4 text-right text-sm font-bold text-green-600">
                                {row.settlement_amount ? formatCurrency(row.settlement_amount) : "N/A"}
                              </td>
                            )}
                            {visibleColumns.has("disbursement_id") && (
                              <td className="py-3 px-4 text-sm">
                                {row.disbursement_id || "N/A"}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
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
