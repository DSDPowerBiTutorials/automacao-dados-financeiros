"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  Calendar,
  DollarSign,
  FileText,
  Key,
  ChevronDown, // 🆕
  ChevronRight, // 🆕
  Eye, // 🆕 Status history viewer
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  reconciliationType?: "automatic" | "manual" | "assumed" | null;

  // Campos adicionais da Braintree API
  transaction_id?: string;
  order_id?: string | null;
  hubspot_order_code?: string | null;
  hubspot_deal_id?: string | null;
  hubspot_row_id?: string | null;
  status?: string;
  status_history?: Array<{ status: string; timestamp: string }>; // 🆕 Histórico de status
  type?: string;
  currency?: string;
  customer_id?: string;
  customer_name?: string;
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

// Safely coerce values to numbers to avoid toFixed on non-numeric inputs
const toNumber = (value: any, fallback = 0) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export default function BraintreeEURPage() {
  const ALL_COLUMN_IDS = [
    "id",
    "date",
    "description",
    "amount",
    "hubspot",
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
    "settlement_batch_id",
    "settlement_date",
    "settlement_currency_iso_code",
    "settlement_currency_exchange_rate",
  ] as const;
  const TOTAL_COLUMNS = ALL_COLUMN_IDS.length;

  const [rows, setRows] = useState<BraintreeEURRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
      "hubspot",
      "destinationAccount",
      "reconciliation",
      "actions",
      "transaction_id",
      "status",
      "type",
      "currency",
      "settlement_batch_id",
      "settlement_date",
      "settlement_currency_iso_code",
      "settlement_currency_exchange_rate",
      "customer_name",
      "customer_email",
      "payment_method",
      "merchant_account_id",
      "disbursement_date",
      "settlement_amount",
    ])
  );
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
  const [tempVisibleColumns, setTempVisibleColumns] = useState<Set<string>>(
    new Set()
  );

  const [hubspotLinksByOrderId, setHubspotLinksByOrderId] = useState<
    Map<
      string,
      {
        hubspot_row_id: string | null;
        hubspot_deal_id: string | null;
        braintree_transaction_id: string | null;
        linked: boolean;
      }
    >
  >(new Map());

  // Sorting
  const [sortField, setSortField] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // Server-side fetch (incremental)
  const SERVER_PAGE_SIZE = 1000;
  const [serverPage, setServerPage] = useState(0);
  const [hasMoreServerRows, setHasMoreServerRows] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const rowsRef = useRef<BraintreeEURRow[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Webhook tracking
  const [mostRecentWebhookTransaction, setMostRecentWebhookTransaction] = useState<BraintreeEURRow | null>(null);

  // Disbursement grouping
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [disbursementFilter, setDisbursementFilter] = useState<string>("");

  // 🆕 Settlement Batch grouping
  const [settlementBatches, setSettlementBatches] = useState<Map<string, BraintreeEURRow[]>>(new Map());
  const [expandedSettlementBatches, setExpandedSettlementBatches] = useState<Set<string>>(new Set());
  const [settlementBatchFilter, setSettlementBatchFilter] = useState<string>("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [amountFilter, setAmountFilter] = useState<{
    operator: string;
    value: number;
  } | null>(null);
  const [dateFilters, setDateFilters] = useState<{
    [key: string]: { start?: string; end?: string };
  }>(() => {
    // Default: sempre desde Dez/2024 até hoje
    return { date: { start: "2024-12-01" } };
  });
  const [statusFilter, setStatusFilter] = useState<string>("settled"); // Default to settled
  const [merchantFilter, setMerchantFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [currencyFilter, setCurrencyFilter] = useState<string>("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("");
  const [isReconciling, setIsReconciling] = useState(false);
  const [autoReconcileSummary, setAutoReconcileSummary] = useState<string | null>(null);

  // ===== Cache-first (snapshot) =====
  const CACHE_VERSION = 1;
  const CACHE_KEY = "braintree-eur:snapshot:v1";
  const dateFiltersRef = useRef(dateFilters);
  useEffect(() => {
    dateFiltersRef.current = dateFilters;
  }, [dateFilters]);

  const serverPageRef = useRef(serverPage);
  useEffect(() => {
    serverPageRef.current = serverPage;
  }, [serverPage]);

  const didInitRef = useRef(false);

  const loadSnapshot = (): {
    rows: BraintreeEURRow[];
    serverPage: number;
    hasMoreServerRows: boolean;
    dateFilters?: any;
  } | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== CACHE_VERSION) return null;
      if (!Array.isArray(parsed.rows)) return null;
      return {
        rows: parsed.rows,
        serverPage: typeof parsed.serverPage === "number" ? parsed.serverPage : 0,
        hasMoreServerRows: !!parsed.hasMoreServerRows,
        dateFilters: parsed.dateFilters,
      };
    } catch {
      return null;
    }
  };

  const saveSnapshot = (payload: {
    rows: BraintreeEURRow[];
    serverPage: number;
    hasMoreServerRows: boolean;
    dateFilters: any;
  }) => {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          version: CACHE_VERSION,
          savedAt: new Date().toISOString(),
          ...payload,
        })
      );
    } catch {
      // ignore (quota/disabled)
    }
  };

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    try {
      // 1) Render imediato via snapshot
      const snap = loadSnapshot();
      if (snap && snap.rows.length > 0) {
        setRows(snap.rows);
        setServerPage(snap.serverPage);
        setHasMoreServerRows(snap.hasMoreServerRows);
        if (snap.dateFilters?.date?.start) {
          setDateFilters(snap.dateFilters);
        }
        isLoadingRef.current = false;
        setIsLoading(false);

        // 2) Revalidar em background (sem auto-reconcile)
        setTimeout(() => {
          loadData({ runReconcile: false, force: true });
        }, 50);
      } else {
        // Sem cache: carregar normalmente (pode rodar auto-reconcile)
        loadData();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao inicializar a página";
      setLoadError(message);
      isLoadingRef.current = false;
      setIsLoading(false);
    }

    const realtimeRefreshTimerRef: { current: ReturnType<typeof setTimeout> | null } = { current: null };

    // ✅ Escutar mudanças em tempo real do Supabase (filter simplificado)
    const subscription = supabase
      .channel('braintree_eur_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'csv_rows',
        },
        (payload) => {
          // Filtrar manualmente já que filter complexo causa CHANNEL_ERROR
          const source = payload.new?.source || payload.old?.source;
          if (source && (source.includes('braintree-api') || source === 'braintree-eur')) {
            console.log('[Realtime Braintree EUR] ✅ Change detected:', payload.eventType, payload.new?.id);
            // Evitar loop e rajada de reloads: debounce + não reexecuta auto reconcile aqui
            if (realtimeRefreshTimerRef.current) {
              clearTimeout(realtimeRefreshTimerRef.current);
            }
            realtimeRefreshTimerRef.current = setTimeout(() => {
              realtimeRefreshTimerRef.current = null;

              if (isLoadingRef.current) return;
              // Revalidar sem auto-reconcile para não travar
              loadData({ runReconcile: false, force: true });
            }, 800);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime Braintree EUR] Status: ${status}`);
      });

    // Cleanup ao desmontar
    return () => {
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
      subscription.unsubscribe();
    };
  }, []);

  // Failsafe: nunca ficar preso no loading infinito
  const isLoadingStateRef = useRef(isLoading);
  useEffect(() => {
    isLoadingStateRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    const t = setTimeout(() => {
      if ((isLoadingRef.current || isLoadingStateRef.current) && rowsRef.current.length === 0) {
        setLoadError("Timeout ao carregar Braintree EUR. Tente clicar em Recarregar.");
        isLoadingRef.current = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }, 30000);
    return () => clearTimeout(t);
  }, []);

  // Recarregar quando o filtro de datas muda (server-side)
  useEffect(() => {
    if (!didInitRef.current) return;
    const t = setTimeout(() => {
      // quando usuário mexe, recarrega sem auto-reconcile (manual via botão)
      loadData({ runReconcile: false, force: true });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilters?.date?.start, dateFilters?.date?.end]);

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

  // 🆕 Componente de filtro com popover (igual Invoices)
  const ColumnFilter = ({
    field,
    label,
    options
  }: {
    field: string;
    label: string;
    options: { value: string; label: string }[]
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const currentValue =
      field === "status" ? statusFilter :
        field === "merchant_account_id" ? merchantFilter :
          field === "type" ? typeFilter :
            field === "currency" ? currencyFilter :
              field === "payment_method" ? paymentMethodFilter :
                settlementBatchFilter;

    const hasFilter = currentValue && currentValue !== "all" && currentValue !== "settled";

    const handleSelect = (value: string) => {
      if (field === "status") setStatusFilter(value);
      else if (field === "merchant_account_id") setMerchantFilter(value);
      else if (field === "type") setTypeFilter(value);
      else if (field === "currency") setCurrencyFilter(value);
      else if (field === "payment_method") setPaymentMethodFilter(value);
      else if (field === "settlement_batch_id") setSettlementBatchFilter(value);
      setIsOpen(false);
    };

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-slate-700 ${hasFilter ? "text-blue-600 dark:text-blue-400" : ""
              }`}
          >
            <Filter className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-56 p-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-lg"
          align="start"
        >
          <div className="space-y-1">
            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
              {label}
            </div>
            {options.map((option) => (
              <Button
                key={option.value}
                variant="ghost"
                size="sm"
                className={`w-full justify-start text-left font-normal ${currentValue === option.value
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                  : ""
                  }`}
                onClick={() => handleSelect(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
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

  // 🆕 Função para toggle de settlement batch
  const toggleSettlementBatch = (batchId: string) => {
    const newExpanded = new Set(expandedSettlementBatches);
    if (newExpanded.has(batchId)) {
      newExpanded.delete(batchId);
    } else {
      newExpanded.add(batchId);
    }
    setExpandedSettlementBatches(newExpanded);
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
  const ENABLE_AUTO_RECONCILIATION = true;

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

  const isLoadingRef = useRef(false);

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label} timeout after ${ms}ms`));
      }, ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const loadData = async (options: { runReconcile?: boolean; force?: boolean; append?: boolean } = {}) => {
    const { runReconcile = true, force = false, append = false } = options;

    if (isLoadingRef.current && !force) {
      console.log("[Braintree EUR] loadData skipped: already running");
      return;
    }

    isLoadingRef.current = true;
    console.log("[Braintree EUR] Starting loadData...");

    if (!append) setLoadError(null);

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      if (!supabase) {
        console.error("[Braintree EUR] Supabase not configured!");
        setRows([]);
        setHasMoreServerRows(false);
        setServerPage(0);
        return;
      }

      console.log("[Braintree EUR] Fetching data from Supabase...");

      const DEBUG = false;

      const df = dateFiltersRef.current;
      const dateStart = df?.date?.start || "2024-12-01";
      const dateEnd = df?.date?.end;

      const currentServerPage = serverPageRef.current;
      const nextPage = append ? currentServerPage + 1 : 0;
      const from = nextPage * SERVER_PAGE_SIZE;
      const to = from + SERVER_PAGE_SIZE - 1;

      // Carregar dados da API Braintree (source: braintree-api-revenue)
      // Filtrar apenas EUR e dentro da janela de datas
      let query = supabase
        .from("csv_rows")
        .select("id,date,description,amount,source,custom_data,reconciled,currency,created_at")
        // Evita OR: melhora uso de índice (source/date)
        .in("source", ["braintree-api-revenue", "braintree-eur"])
        .gte("date", dateStart)
        .order("date", { ascending: false })
        .range(from, to);

      if (dateEnd) {
        query = query.lte("date", dateEnd);
      }

      const { data: rowsData, error } = await withTimeout(
        query,
        20000,
        "Supabase load csv_rows (Braintree EUR)"
      );

      if (error) {
        console.error("[Braintree EUR] Error loading data:", error);
        setLoadError(error.message || "Erro ao carregar dados do Supabase");
        if (!append) {
          setRows([]);
        }
        return;
      }

      setHasMoreServerRows((rowsData?.length || 0) === SERVER_PAGE_SIZE);
      setServerPage(nextPage);

      if (!rowsData || rowsData.length === 0) {
        console.log("[Braintree EUR] No data found");
        if (!append) {
          setRows([]);
        }
        return;
      }

      console.log(`[Braintree EUR] Found ${rowsData.length} rows`);

      const mappedRows: BraintreeEURRow[] = rowsData
        .filter((row) => {
          const merchantAccount = row.custom_data?.merchant_account_id;
          const currencyIsoCode = row.custom_data?.currencyIsoCode || row.custom_data?.currency_iso_code;
          const currency = currencyIsoCode || row.custom_data?.currency || row.currency;

          const isEUR = currency === 'EUR' || (merchantAccount && merchantAccount.toLowerCase().includes('eur'));

          return isEUR;
        })
        .map((row) => {
          if (DEBUG && row.custom_data?.transaction_id === 'ensq9tm6') {
            console.log('[DEBUG Frontend] Transaction ensq9tm6 custom_data:', row.custom_data);
          }

          // 🆕 Extrair settlement_date do settlement_batch_id se não existir
          let settlementDate = row.custom_data?.settlement_date;

          if (!settlementDate && row.custom_data?.settlement_batch_id) {
            // settlement_batch_id formato: "2026-01-09_digitalsmiledesignEUR_gr150wce"
            // Extrair a parte da data (primeiros 10 caracteres: YYYY-MM-DD)
            const batchId = row.custom_data.settlement_batch_id;
            const dateMatch = batchId.match(/^(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              settlementDate = dateMatch[1];
              if (DEBUG) console.log(`[Settlement Date] ✅ Extracted from batch_id: ${settlementDate} (${batchId})`);
            }
          }

          if (DEBUG) {
            console.log('[DEBUG settlement_date mapping]', {
              transaction_id: row.custom_data?.transaction_id,
              settlement_date: settlementDate,
              settlement_batch_id: row.custom_data?.settlement_batch_id,
            });
          }

          return {
            id: row.id,
            date: row.date,
            description: row.description || "",
            amount: toNumber(row.amount, 0),
            conciliado: (row as any).reconciled ?? row.custom_data?.conciliado ?? false,
            destinationAccount: row.custom_data?.destinationAccount || null,
            reconciliationType: row.custom_data?.reconciliationType || ((row as any).reconciled ? "automatic" : null),

            // Campos adicionais da Braintree
            transaction_id: row.custom_data?.transaction_id,
            order_id: row.custom_data?.order_id || null,
            hubspot_order_code: row.custom_data?.hubspot_order_code || null,
            hubspot_deal_id: row.custom_data?.hubspot_deal_id || null,
            hubspot_row_id: row.custom_data?.hubspot_row_id || null,
            status: row.custom_data?.status,
            status_history: row.custom_data?.status_history || [],
            type: row.custom_data?.type,
            currency: row.custom_data?.currencyIsoCode || row.custom_data?.currency_iso_code || row.custom_data?.currency || row.currency || "EUR",
            customer_id: row.custom_data?.customer_id,
            customer_name: row.custom_data?.customer_name,
            customer_email: row.custom_data?.customer_email,
            payment_method: row.custom_data?.payment_method,
            merchant_account_id: row.custom_data?.merchant_account_id,
            created_at: row.custom_data?.created_at,
            updated_at: row.custom_data?.updated_at,
            disbursement_date: row.custom_data?.disbursement_date || (row as any).disbursement_date,
            settlement_amount: toNumber(
              row.custom_data?.settlement_amount ?? (row as any).settlement_amount ?? row.amount,
              0
            ),
            settlement_currency: row.custom_data?.settlement_currency,
            settlement_currency_iso_code: row.custom_data?.settlement_currency_iso_code,
            settlement_currency_exchange_rate:
              row.custom_data?.settlement_currency_exchange_rate != null
                ? toNumber(row.custom_data?.settlement_currency_exchange_rate, 1)
                : null,
            settlement_batch_id: row.custom_data?.settlement_batch_id || (row as any).settlement_batch_id,
            settlement_date: settlementDate, // 🆕 Agora usa a variável com extração do batch_id

            // 🔑 ID do payout agrupado
            disbursement_id: row.custom_data?.disbursement_id,

            // 🏦 Informações do match bancário
            bank_match_id: row.custom_data?.bank_match_id,
            bank_match_date: row.custom_data?.bank_match_date,
            bank_match_amount:
              row.custom_data?.bank_match_amount != null
                ? toNumber(row.custom_data?.bank_match_amount, 0)
                : null,
            bank_match_description: row.custom_data?.bank_match_description,

            // 💰 FEES E DEDUÇÕES
            service_fee_amount:
              row.custom_data?.service_fee_amount != null
                ? toNumber(row.custom_data?.service_fee_amount, 0)
                : null,
            discount_amount:
              row.custom_data?.discount_amount != null
                ? toNumber(row.custom_data?.discount_amount, 0)
                : null,
            tax_amount:
              row.custom_data?.tax_amount != null
                ? toNumber(row.custom_data?.tax_amount, 0)
                : null,
            refunded_transaction_id: row.custom_data?.refunded_transaction_id,
            merchant_account_fee:
              row.custom_data?.merchant_account_fee != null
                ? toNumber(row.custom_data?.merchant_account_fee, 0)
                : null,
            processing_fee:
              row.custom_data?.processing_fee != null
                ? toNumber(row.custom_data?.processing_fee, 0)
                : null,
            authorization_adjustment:
              row.custom_data?.authorization_adjustment != null
                ? toNumber(row.custom_data?.authorization_adjustment, 0)
                : null,
            dispute_amount:
              row.custom_data?.dispute_amount != null
                ? toNumber(row.custom_data?.dispute_amount, 0)
                : null,
            reserve_amount:
              row.custom_data?.reserve_amount != null
                ? toNumber(row.custom_data?.reserve_amount, 0)
                : null,
          };
        });

      console.log(`[Braintree EUR] Mapped ${mappedRows.length} rows`);

      const mergedRows = append
        ? (() => {
          const prev = rowsRef.current || [];
          const seen = new Set(prev.map(r => r.id));
          const next = [...prev];
          for (const r of mappedRows) {
            if (!seen.has(r.id)) {
              seen.add(r.id);
              next.push(r);
            }
          }
          return next;
        })()
        : mappedRows;

      // 🔗 Linkagem HubSpot (order_code ↔ order_id) em background
      if (!append) {
        const orderIds = Array.from(
          new Set(
            mergedRows
              .map((r) => r.order_id)
              .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          )
        ).slice(0, 250);

        if (orderIds.length > 0) {
          fetch("/api/linking/braintree-hubspot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderIds, currency: "EUR", dryRun: false }),
          })
            .then((r) => r.json())
            .then((payload) => {
              if (!payload?.success) return;
              const links = payload.links || [];
              setHubspotLinksByOrderId((prev) => {
                const next = new Map(prev);
                for (const l of links) {
                  if (!l?.order_id) continue;
                  next.set(String(l.order_id), {
                    hubspot_row_id: l.hubspot_row_id ?? null,
                    hubspot_deal_id: l.hubspot_deal_id ?? null,
                    braintree_transaction_id: l.braintree_transaction_id ?? null,
                    linked: Boolean(l.linked),
                  });
                }
                return next;
              });
            })
            .catch((err) => console.error("[Braintree EUR] HubSpot linking error:", err));
        }
      }

      // 🆕 AGRUPAR POR SETTLEMENT BATCH ID
      const batchGroups = new Map<string, BraintreeEURRow[]>();

      mergedRows.forEach(row => {
        const batchId = row.settlement_batch_id || 'no-batch';
        if (!batchGroups.has(batchId)) {
          batchGroups.set(batchId, []);
        }
        batchGroups.get(batchId)!.push(row);
      });

      console.log(`[Braintree EUR] Found ${batchGroups.size} settlement batches`);

      if (DEBUG) {
        batchGroups.forEach((rows, batchId) => {
          if (batchId !== 'no-batch') {
            const totalAmount = rows.reduce(
              (sum, r) => sum + toNumber(r.settlement_amount ?? r.amount, 0),
              0
            );
            console.log(`[Batch ${batchId}] ${rows.length} transactions, Total: €${totalAmount.toFixed(2)}`);
          }
        });
      }

      setSettlementBatches(batchGroups);

      setRows(mergedRows);

      // Persistir snapshot (sem bloquear UI)
      setTimeout(() => {
        saveSnapshot({
          rows: mergedRows,
          serverPage: nextPage,
          hasMoreServerRows: (rowsData?.length || 0) === SERVER_PAGE_SIZE,
          dateFilters: df,
        });
      }, 0);

      // Identificar transação mais recente (primeira da lista, já que está ordenada por date desc)
      if (mergedRows.length > 0 && !append) {
        setMostRecentWebhookTransaction(mergedRows[0]);
        console.log("[Braintree EUR] Most recent transaction:", mergedRows[0].date, mergedRows[0].description);
      }

      // Reset para página 1 quando um novo load (não-append) acontece
      if (!append) setCurrentPage(1);

      console.log("[Braintree EUR] Data loaded successfully");

      // Libera o spinner principal antes da conciliação automática
      isLoadingRef.current = false;
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }

      // Carregar última data de sync (sem bloquear)
      loadLastSyncDate().catch(err => console.error("[Braintree EUR] Error loading sync date:", err));

      // Disparar conciliação automática por settlement_batch_id (Bankinter EUR) via API server-side
      if (!append && runReconcile && ENABLE_AUTO_RECONCILIATION && !isReconciling) {
        (async () => {
          try {
            setIsReconciling(true);
            const response = await fetch("/api/reconciliation/braintree-eur", {
              method: "POST",
            });

            const payload = await response.json();

            if (!response.ok || !payload?.success) {
              const errorMessage = payload?.error || response.statusText || "Unknown error";
              setAutoReconcileSummary(`Auto-reconcile failed: ${errorMessage}`);
            } else {
              const { reconciled, total, failed, mode } = payload.data || {
                reconciled: 0,
                total: 0,
                failed: 0,
                mode: null,
              };
              if (mode === "assume-paid") {
                setAutoReconcileSummary(
                  `Marcados como pagos (assumido): ${reconciled}/${total} (falhas: ${failed})`,
                );
              } else {
                setAutoReconcileSummary(`Auto conciliated ${reconciled}/${total} batches (failures: ${failed})`);
              }
              // Recarrega dados para refletir reconciled/bank_match_* mesmo se já houver carregamento em andamento
              await loadData({ runReconcile: false, force: true });
            }
          } catch (reconcileError) {
            console.error("[Braintree EUR] Auto-reconcile error:", reconcileError);
            setAutoReconcileSummary("Auto-reconcile failed. See console.");
          } finally {
            setIsReconciling(false);
          }
        })();
      }
    } catch (error) {
      console.error("[Braintree EUR] Unexpected error:", error);
      const message = error instanceof Error ? error.message : "Erro inesperado ao carregar";
      setLoadError(message);
      if (!append) setRows([]);
    } finally {
      if (isLoadingRef.current) {
        console.log("[Braintree EUR] Forcing isLoading to false in finally");
        isLoadingRef.current = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
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
            toNumber(row.amount, 0).toFixed(2),
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

        // 🆕 Filtro de settlement batch
        if (settlementBatchFilter && settlementBatchFilter !== "all") {
          if (settlementBatchFilter === "no-batch") {
            if (row.settlement_batch_id) return false;
          } else if (row.settlement_batch_id !== settlementBatchFilter) {
            return false;
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

      // 🆕 Informações de Settlement Batch
      const batchId = row.settlement_batch_id || 'no-batch';
      const batchRows = settlementBatches.get(batchId) || [];
      const batchSize = batchRows.length;
      const batchTotal = batchRows.reduce((sum, r) => sum + (r.settlement_amount || r.amount), 0);
      const isFirstInBatch = array.findIndex((r) => (r.settlement_batch_id || 'no-batch') === batchId) === index;

      return {
        ...row,
        _groupSize: groupSize,
        _groupTotal: groupTotal,
        _isGroupExpanded: expandedGroups.has(disbursementId),
        _isFirstInGroup: isFirstInGroup,
        _batchSize: batchSize,
        _batchTotal: batchTotal,
        _isBatchExpanded: expandedSettlementBatches.has(batchId),
        _isFirstInBatch: isFirstInBatch,
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
        case "settlement_batch_id":
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
    disbursementFilter,
    settlementBatchFilter,
    settlementBatches,
    expandedSettlementBatches,
    expandedGroups,
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

  if (isLoading && rows.length === 0) {
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
                    {processedRows.length} records (carregados: {rows.length}{hasMoreServerRows ? "+" : ""})
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {/* Botão de Forçar Atualização */}
                <Button
                  onClick={loadData}
                  disabled={isLoading || isLoadingMore}
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

            {/* Status da conciliação automática */}
            {ENABLE_AUTO_RECONCILIATION && (
              <div className="mt-3 flex items-center gap-3 text-sm text-white/80">
                <Badge variant="outline" className="border-emerald-300 text-emerald-50 bg-emerald-500/20">
                  ⚡ Auto conciliação ativa
                </Badge>
                {isReconciling ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Reconciling settlement batches with Bankinter EUR...</span>
                  </div>
                ) : autoReconcileSummary ? (
                  <span>{autoReconcileSummary}</span>
                ) : (
                  <span>Será executada ao carregar os dados.</span>
                )}
              </div>
            )}

            {saveSuccess && (
              <Alert className="mt-4 border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <AlertDescription className="text-emerald-800 dark:text-emerald-200 font-medium">
                  ✅ All changes saved successfully to database! Last saved:{" "}
                  {lastSaved}
                </AlertDescription>
              </Alert>
            )}

            {loadError && (
              <Alert className="mt-4 border-2 border-red-500 bg-red-50 dark:bg-red-900/20">
                <XCircle className="h-5 w-5 text-red-600" />
                <AlertDescription className="text-red-800 dark:text-red-200 font-medium">
                  ❌ Erro ao carregar Braintree EUR: {loadError}
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
                        className={`relative overflow-visible ${columnSelectorOpen ? "bg-[#243140] hover:bg-[#1a2530] text-white" : ""}`}
                      >
                        <Columns3 className="h-4 w-4 mr-2" />
                        Select Columns
                        {visibleColumns.size < TOTAL_COLUMNS && (
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
                            <span className="absolute -top-2 -right-2 bg-[#243140] text-white text-[10px] font-bold rounded-full min-w-[28px] h-5 px-1.5 flex items-center justify-center border-2 border-white whitespace-nowrap">
                              {visibleColumns.size}/{TOTAL_COLUMNS}
                            </span>
                          </>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="!bg-white dark:!bg-slate-900 text-slate-900 dark:text-slate-50 flex flex-col" style={{ backgroundColor: 'white' }}>
                      <DialogHeader className="bg-white dark:bg-slate-900">
                        <DialogTitle className="text-slate-900 dark:text-slate-50">Select Visible Columns</DialogTitle>
                      </DialogHeader>
                      {/*
                        Nota: evitamos a classe 'grid' aqui porque o Tabler pode redefinir '.grid'
                        e quebrar o layout (lista fica "vazia").
                      */}
                      <div className="flex flex-col gap-3 py-4 max-h-[60vh] overflow-y-auto pr-1 bg-white dark:bg-slate-900">
                        {[
                          { id: "id", label: "ID" },
                          { id: "date", label: "📅 Created Date" },
                          { id: "description", label: "Description" },
                          { id: "amount", label: "Amount" },
                          { id: "hubspot", label: "🔗 HubSpot Order" },
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
                          { id: "settlement_batch_id", label: "🔑 Settlement Batch ID" },
                          { id: "settlement_date", label: "🏦 Settlement Date" },
                          { id: "settlement_amount", label: "Settlement Amount" },
                          { id: "settlement_currency_iso_code", label: "🌍 Settlement Currency (Real)" },
                          { id: "settlement_currency_exchange_rate", label: "💱 FX Exchange Rate" },
                        ].map((column) => {
                          // Adicionar descrições explicativas para campos de data
                          const descriptions: { [key: string]: string } = {
                            date: "When customer paid",
                            settlement_date: "When bank confirmed",
                            disbursement_date: "When money arrived in account"
                          };

                          return (
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
                                {descriptions[column.id] && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                                    {descriptions[column.id]}
                                  </span>
                                )}
                              </label>
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex justify-end gap-2 bg-white dark:bg-slate-900 pt-4 border-t border-gray-200 dark:border-slate-700">
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
                <table className="w-full min-w-max table-auto">
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
                      {visibleColumns.has("hubspot") && (
                        <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          HubSpot
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
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => toggleSort("status")}
                              className="flex items-center gap-1 hover:text-blue-600"
                            >
                              Status
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                            <ColumnFilter
                              field="status"
                              label="Filter by Status"
                              options={[
                                { value: "all", label: "All Status" },
                                { value: "settled", label: "Settled" },
                                { value: "settling", label: "Settling" },
                                { value: "submitted_for_settlement", label: "Submitted" },
                                { value: "authorized", label: "Authorized" },
                              ]}
                            />
                          </div>
                        </th>
                      )}
                      {visibleColumns.has("type") && (
                        <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => toggleSort("type")}
                              className="flex items-center gap-1 hover:text-blue-600"
                            >
                              Type
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                            <ColumnFilter
                              field="type"
                              label="Filter by Type"
                              options={[
                                { value: "all", label: "All Types" },
                                { value: "sale", label: "Sale" },
                                { value: "credit", label: "Credit" },
                              ]}
                            />
                          </div>
                        </th>
                      )}
                      {visibleColumns.has("currency") && (
                        <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => toggleSort("currency")}
                              className="flex items-center gap-1 hover:text-blue-600"
                            >
                              Currency
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                            <ColumnFilter
                              field="currency"
                              label="Filter by Currency"
                              options={[
                                { value: "all", label: "All Currencies" },
                                { value: "EUR", label: "EUR" },
                                { value: "USD", label: "USD" },
                                { value: "GBP", label: "GBP" },
                              ]}
                            />
                          </div>
                        </th>
                      )}
                      {visibleColumns.has("settlement_batch_id") && (
                        <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleSort("settlement_batch_id")}
                              className="flex items-center gap-1 hover:text-blue-600"
                            >
                              🔑 Settlement Batch ID
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                            <ColumnFilter
                              field="settlement_batch_id"
                              label="Filter by Settlement Batch"
                              options={[
                                { value: "all", label: "All Batches" },
                                { value: "no-batch", label: "No Batch" },
                                ...Array.from(settlementBatches.keys())
                                  .filter(id => id !== 'no-batch')
                                  .sort((a, b) => b.localeCompare(a))
                                  .slice(0, 20)
                                  .map(id => ({ value: id, label: id.substring(0, 20) + '...' }))
                              ]}
                            />
                          </div>
                        </th>
                      )}
                      {visibleColumns.has("settlement_date") && (
                        <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <button
                            onClick={() => toggleSort("settlement_date")}
                            className="flex items-center gap-1 hover:text-blue-600"
                          >
                            🏦 Settlement Date
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      )}
                      {visibleColumns.has("settlement_currency_iso_code") && (
                        <th className="py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          🌍 Settlement Currency
                        </th>
                      )}
                      {visibleColumns.has("settlement_currency_exchange_rate") && (
                        <th className="text-right py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          💱 FX Rate
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
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleSort("payment_method")}
                              className="flex items-center gap-1 hover:text-blue-600"
                            >
                              Payment Method
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                            <ColumnFilter
                              field="payment_method"
                              label="Filter by Payment Method"
                              options={[
                                { value: "all", label: "All Methods" },
                                { value: "credit_card", label: "Credit Card" },
                                { value: "paypal", label: "PayPal" },
                              ]}
                            />
                          </div>
                        </th>
                      )}
                      {visibleColumns.has("merchant_account_id") && (
                        <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleSort("merchant_account_id")}
                              className="flex items-center gap-1 hover:text-blue-600"
                            >
                              Merchant Account
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                            <ColumnFilter
                              field="merchant_account_id"
                              label="Filter by Merchant"
                              options={[
                                { value: "all", label: "All Merchants" },
                                { value: "digitalsmiledesignEUR", label: "digitalsmiledesignEUR" },
                                { value: "digitalsmiledesignUSD", label: "digitalsmiledesignUSD" },
                                { value: "digitalsmiledesignGBP", label: "digitalsmiledesignGBP" },
                                { value: "digitalsmiledesign_instant", label: "digitalsmiledesign_instant" },
                              ]}
                            />
                          </div>
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
                            {visibleColumns.has("hubspot") && (
                              <td className="py-3 px-4 text-sm">
                                {row.order_id ? (
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="font-mono text-xs text-gray-800 dark:text-gray-200"
                                      title={`Order ID: ${row.order_id}`}
                                    >
                                      {row.order_id}
                                    </span>
                                    {(() => {
                                      const link = hubspotLinksByOrderId.get(row.order_id || "");
                                      const dealId = row.hubspot_deal_id || link?.hubspot_deal_id;
                                      if (link?.linked || dealId) {
                                        return (
                                          <Badge
                                            variant="secondary"
                                            className="bg-emerald-50 text-emerald-700 border border-emerald-200"
                                            title={dealId ? `HubSpot deal_id: ${dealId}` : "Vinculado ao HubSpot"}
                                          >
                                            HS
                                          </Badge>
                                        );
                                      }
                                      return (
                                        <Badge
                                          variant="outline"
                                          className="text-gray-500"
                                          title="Sem vínculo HubSpot (order_code não encontrado)"
                                        >
                                          sem HS
                                        </Badge>
                                      );
                                    })()}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
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
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg min-w-[220px]">
                                          <div className="font-bold mb-2 text-green-400">⚡ Auto-Reconciled</div>
                                          {row.bank_match_date && (
                                            <div className="flex items-center gap-1 mb-1">
                                              <Calendar className="h-3 w-3" />
                                              <span>Date: {formatDate(row.bank_match_date)}</span>
                                            </div>
                                          )}
                                          {row.bank_match_amount !== null && row.bank_match_amount !== undefined && (
                                            <div className="flex items-center gap-1 mb-1">
                                              <DollarSign className="h-3 w-3" />
                                              <span>Amount: {formatCurrency(row.bank_match_amount)}</span>
                                            </div>
                                          )}
                                          {row.bank_match_description && (
                                            <div className="flex items-start gap-1 mb-1">
                                              <FileText className="h-3 w-3 mt-0.5" />
                                              <span className="text-[10px]">
                                                {row.bank_match_description.substring(0, 40)}...
                                              </span>
                                            </div>
                                          )}
                                          {row.settlement_batch_id && (
                                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-700">
                                              <Key className="h-3 w-3" />
                                              <span className="text-[10px] font-mono">
                                                {row.settlement_batch_id.substring(0, 20)}...
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="relative group">
                                        <User className="h-5 w-5 text-blue-600 mx-auto" />
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                          👤 Manual reconciliation
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
                                <div className="flex items-center justify-center gap-2">
                                  <Badge variant={row.status === "settled" || row.status === "settled_successfully" ? "default" : "secondary"}>
                                    {row.status || "N/A"}
                                  </Badge>

                                  {/* 👁️ Ícone "Olho" com histórico de status */}
                                  {row.status_history && row.status_history.length > 0 && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                        >
                                          <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        className="w-80 p-0 !bg-white dark:!bg-slate-900 text-slate-900 dark:text-slate-50 border border-gray-200 dark:border-slate-700 shadow-xl !opacity-100"
                                        align="end"
                                        style={{ backgroundColor: 'white' }}
                                      >
                                        <div className="bg-gradient-to-r !from-[#1a2b4a] !to-[#2c3e5f] from-[#1a2b4a] to-[#2c3e5f] text-white px-4 py-3 rounded-t-lg">
                                          <h4 className="font-bold flex items-center gap-2">
                                            <Eye className="h-4 w-4" />
                                            Status History
                                          </h4>
                                          <p className="text-xs text-white/80 mt-1">
                                            Transaction: {row.transaction_id}
                                          </p>
                                        </div>
                                        <div className="p-4 max-h-[300px] overflow-y-auto bg-white dark:bg-slate-900">
                                          <div className="space-y-3">
                                            {row.status_history
                                              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                              .map((historyEntry, index) => {
                                                const isSettled = historyEntry.status === "settled" || historyEntry.status === "settled_successfully";
                                                const isLatest = index === 0;

                                                return (
                                                  <div
                                                    key={index}
                                                    className={`flex items-start gap-3 pb-3 ${index < row.status_history!.length - 1
                                                      ? 'border-b border-gray-200 dark:border-gray-700'
                                                      : ''
                                                      }`}
                                                  >
                                                    <div
                                                      className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${isSettled
                                                        ? 'bg-green-500'
                                                        : isLatest
                                                          ? 'bg-blue-500'
                                                          : 'bg-gray-400'
                                                        }`}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                      <div className="flex items-center justify-between gap-2">
                                                        <Badge
                                                          variant={isSettled ? "default" : isLatest ? "secondary" : "outline"}
                                                          className="text-xs"
                                                        >
                                                          {historyEntry.status}
                                                        </Badge>
                                                        {isLatest && (
                                                          <span className="text-[10px] text-[#1a2b4a] dark:text-slate-200 font-semibold">
                                                            CURRENT
                                                          </span>
                                                        )}
                                                      </div>
                                                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-600 dark:text-gray-400">
                                                        <Calendar className="h-3 w-3" />
                                                        <span className="font-mono">
                                                          {formatTimestamp(new Date(historyEntry.timestamp))}
                                                        </span>
                                                      </div>
                                                      {isSettled && (
                                                        <div className="mt-1 text-[10px] text-green-600 dark:text-green-400 font-semibold">
                                                          ✓ Settlement confirmed at this time
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                          </div>
                                        </div>
                                        {row.settlement_batch_id && (
                                          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-slate-800/50 rounded-b-lg">
                                            <div className="flex items-start gap-2">
                                              <Key className="h-3 w-3 text-gray-500 mt-0.5 flex-shrink-0" />
                                              <div className="min-w-0 flex-1">
                                                <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                                                  Settlement Batch ID:
                                                </div>
                                                <div className="font-mono text-xs text-gray-700 dark:text-gray-300 break-all">
                                                  {row.settlement_batch_id}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                </div>
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
                            {visibleColumns.has("settlement_batch_id") && (
                              <td className="py-3 px-4 text-xs font-mono">
                                {row.settlement_batch_id ? (
                                  <span className="text-gray-700 dark:text-gray-300" title={row.settlement_batch_id}>
                                    {row.settlement_batch_id.substring(0, 16)}...
                                  </span>
                                ) : (
                                  <span className="text-gray-400">N/A</span>
                                )}
                              </td>
                            )}
                            {visibleColumns.has("settlement_date") && (
                              <td className="py-3 px-4 text-sm">
                                {row.settlement_date ? (
                                  <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">
                                    {formatDate(row.settlement_date)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs">Not settled</span>
                                )}
                              </td>
                            )}
                            {visibleColumns.has("settlement_currency_iso_code") && (
                              <td className="py-3 px-4 text-sm">
                                {row.settlement_currency_iso_code && row.currency &&
                                  row.settlement_currency_iso_code !== row.currency ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800"
                                  >
                                    {row.currency} → {row.settlement_currency_iso_code}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {row.settlement_currency_iso_code || row.currency || "N/A"}
                                  </span>
                                )}
                              </td>
                            )}
                            {visibleColumns.has("settlement_currency_exchange_rate") && (
                              <td className="py-3 px-4 text-right text-sm">
                                {(() => {
                                  const rate = row.settlement_currency_exchange_rate != null
                                    ? toNumber(row.settlement_currency_exchange_rate, 1)
                                    : null;

                                  if (rate && rate !== 1) {
                                    return (
                                      <span className="text-blue-600 dark:text-blue-400 font-mono">
                                        {rate.toFixed(5)}
                                      </span>
                                    );
                                  }

                                  return <span className="text-gray-400">1.00000</span>;
                                })()}
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
                                {(() => {
                                  const paymentMethod = row.payment_method;
                                  if (!paymentMethod || paymentMethod === "N/A") return "N/A";

                                  // Extrair apenas a bandeira do cartão (antes do espaço/dígitos)
                                  const cleanMethod = paymentMethod
                                    .replace(/\s*(ending in|\*\*\*\*|\d{4}).*$/i, '')
                                    .trim();

                                  // Se for PayPal, manter como está
                                  if (cleanMethod.toLowerCase().includes('paypal')) {
                                    return (
                                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                                        PayPal
                                      </Badge>
                                    );
                                  }

                                  // Para cartões, mostrar badge com cor específica
                                  const cardBrandColors: { [key: string]: string } = {
                                    'visa': 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
                                    'mastercard': 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
                                    'amex': 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
                                    'discover': 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
                                  };

                                  const brandLower = cleanMethod.toLowerCase();
                                  const colorClass = Object.keys(cardBrandColors).find(brand =>
                                    brandLower.includes(brand)
                                  );

                                  return (
                                    <Badge
                                      variant="outline"
                                      className={colorClass ? cardBrandColors[colorClass] : 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400'}
                                    >
                                      {cleanMethod || "Card"}
                                    </Badge>
                                  );
                                })()}
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
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Showing {processedRows.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, processedRows.length)} of {processedRows.length} results
                  {hasMoreServerRows ? " (há mais no servidor)" : ""}
                </div>
                <div className="flex gap-2">
                  {hasMoreServerRows && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadData({ runReconcile: false, append: true })}
                      disabled={isLoading || isLoadingMore}
                      className="gap-2"
                      title="Carregar mais linhas do período selecionado"
                    >
                      {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                      Carregar mais
                    </Button>
                  )}

                  {totalPages > 1 && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div >
      </div >

      {/* Split Screen Panel */}
      {
        splitScreenUrl && (
          <div className="fixed top-0 right-0 w-1/2 h-screen bg-white dark:bg-slate-900 shadow-2xl z-40 border-l-4 border-blue-500">
            <div className="h-full flex flex-col">
              <div className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white p-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Bank Statement Details</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeSplitScreen}
                  className="text-white hover:bg-white/10"
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
        )
      }
    </div >
  );
}
