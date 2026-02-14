"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Download,
    RefreshCw,
    Search,
    CreditCard,
    Calendar,
    DollarSign,
    Building,
    Link2,
    AlertCircle,
    CheckCircle,
    CheckCircle2,
    Loader2,
    Zap,
    X,
    FileText,
    User,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Database,
    Key,
    Filter,
    Upload,
    Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

// ════════════════════════════════════════════════════════
// Types & Constants
// ════════════════════════════════════════════════════════

interface BankAccountConfig {
    key: string;
    label: string;
    currency: string;
    bgColor: string;
    textColor: string;
    activeRing: string;
    uploadEndpoint: string;
    uploadAccept: string;
    uploadType: "formdata" | "json";
}

const BANK_ACCOUNTS: BankAccountConfig[] = [
    { key: "bankinter-eur", label: "Bankinter EUR", currency: "EUR", bgColor: "bg-blue-600", textColor: "text-blue-400", activeRing: "ring-blue-500", uploadEndpoint: "/api/csv/bankinter-eur", uploadAccept: ".xlsx", uploadType: "formdata" },
    { key: "bankinter-usd", label: "Bankinter USD", currency: "USD", bgColor: "bg-emerald-600", textColor: "text-emerald-400", activeRing: "ring-emerald-500", uploadEndpoint: "/api/csv-rows", uploadAccept: ".csv", uploadType: "json" },
    { key: "sabadell", label: "Sabadell EUR", currency: "EUR", bgColor: "bg-orange-600", textColor: "text-orange-400", activeRing: "ring-orange-500", uploadEndpoint: "/api/csv/sabadell", uploadAccept: ".csv", uploadType: "formdata" },
    { key: "chase-usd", label: "Chase 9186", currency: "USD", bgColor: "bg-purple-600", textColor: "text-purple-400", activeRing: "ring-purple-500", uploadEndpoint: "/api/csv/chase-usd", uploadAccept: ".csv", uploadType: "formdata" },
];

interface BankTransaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    source: string;
    currency: string;
    gateway: string | null;
    paymentSource: string | null;
    matchType: string | null;
    isReconciled: boolean;
    reconciliationType: string | null;
    isOrderReconciled: boolean;
    invoiceOrderId: string | null;
    invoiceNumber: string | null;
    custom_data: Record<string, any>;
}

interface ReconcileResult {
    bankSource: string;
    success: boolean;
    matched: number;
    unmatched: number;
    total: number;
    error?: string;
}

interface DateGroup {
    date: string;
    dateLabel: string;
    rows: BankTransaction[];
    totalCredits: number;
    totalDebits: number;
}

// ── Smart Reconciliation Match Types ──
interface APInvoiceMatch {
    id: number;
    invoice_number: string;
    provider_code: string;
    description: string;
    invoice_amount: number;
    paid_amount: number | null;
    schedule_date: string;
    payment_date: string | null;
    currency: string;
    is_reconciled: boolean;
    invoice_type: string;
    bank_account_code: string | null;
    matchScore: number;
    matchReason: string;
}

interface PaymentSourceMatch {
    id: string;
    source: string;
    sourceLabel: string;
    disbursementDate: string;
    amount: number;
    transactionCount: number;
    matchScore: number;
    matchReason: string;
}

interface RevenueOrderMatch {
    id: string;
    source: string;
    sourceLabel: string;
    orderId: string | null;
    invoiceNumber: string | null;
    customerName: string;
    amount: number;
    date: string;
    matchScore: number;
    matchReason: string;
}

interface IntercompanyMatch {
    id: string;
    source: string;
    sourceLabel: string;
    amount: number;
    currency: string;
    date: string;
    description: string;
    matchScore: number;
}

interface DisbursementTransaction {
    id: string;
    date: string;
    customerName: string;
    customerEmail: string;
    orderId: string | null;
    amount: number;
    currency: string;
    cardType: string | null;
    paymentMethod: string | null;
    transactionId: string;
}

// ════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════

function detectGateway(description: string): string | null {
    const desc = description.toLowerCase();
    if (desc.includes("braintree") && (desc.includes("amex") || desc.includes("american express"))) return "braintree-amex";
    if (desc.includes("braintree") && desc.includes("gbp")) return "braintree-gbp";
    if (desc.includes("braintree") && desc.includes("usd")) return "braintree-usd";
    if (desc.includes("braintree") || desc.includes("paypal braintree")) return "braintree-eur";
    if (desc.includes("stripe")) return "stripe";
    if (desc.includes("gocardless") || desc.includes("go cardless")) return "gocardless";
    if (desc.includes("paypal") && !desc.includes("braintree")) return "paypal";
    return null;
}

const formatCurrency = (value: number, currency = "EUR") =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const formatCompactCurrency = (value: number, currency = "EUR") => {
    const sym = currency === "USD" ? "$" : "€";
    if (Math.abs(value) >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${sym}${(value / 1_000).toFixed(0)}k`;
    return `${sym}${value.toFixed(0)}`;
};

const formatShortDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "-";
    const parts = dateString.split("-");
    if (parts.length !== 3) return dateString;
    const [year, month, day] = parts.map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

const formatDateHeader = (dateStr: string): string => {
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts.map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
};

const gatewayColors: Record<string, { bg: string; text: string; border: string }> = {
    "braintree-eur": { bg: "bg-blue-900/30", text: "text-blue-400", border: "border-blue-700" },
    "braintree-usd": { bg: "bg-emerald-900/30", text: "text-emerald-400", border: "border-emerald-700" },
    "braintree-gbp": { bg: "bg-purple-900/30", text: "text-purple-400", border: "border-purple-700" },
    "braintree-amex": { bg: "bg-violet-900/30", text: "text-violet-400", border: "border-violet-700" },
    braintree: { bg: "bg-blue-900/30", text: "text-blue-400", border: "border-blue-700" },
    paypal: { bg: "bg-cyan-900/30", text: "text-cyan-400", border: "border-cyan-700" },
    gocardless: { bg: "bg-yellow-900/30", text: "text-yellow-400", border: "border-yellow-700" },
    stripe: { bg: "bg-indigo-900/30", text: "text-indigo-400", border: "border-indigo-700" },
};

const getGatewayStyle = (gw: string | null) => gatewayColors[gw?.toLowerCase() || ""] || { bg: "bg-gray-800/50", text: "text-gray-400", border: "border-gray-700" };

/** String similarity using Sørensen-Dice coefficient on bigrams — returns 0-1 */
function stringSimilarity(s1: string, s2: string): number {
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
    const a = norm(s1);
    const b = norm(s2);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.85;
    const getBigrams = (s: string): Map<string, number> => {
        const map = new Map<string, number>();
        for (let i = 0; i < s.length - 1; i++) {
            const bi = s.substring(i, i + 2);
            map.set(bi, (map.get(bi) || 0) + 1);
        }
        return map;
    };
    const biA = getBigrams(a);
    const biB = getBigrams(b);
    let matches = 0;
    biB.forEach((count, bi) => {
        const aCount = biA.get(bi) || 0;
        matches += Math.min(count, aCount);
    });
    const total = (a.length - 1) + (b.length - 1);
    return total > 0 ? (2 * matches) / total : 0;
}

/** Extract supplier name from "/" in Bankinter descriptions — e.g. "Recibo/iberent technology" → "iberent technology" */
function extractSupplierName(description: string): string | null {
    const slashIdx = description.indexOf('/');
    if (slashIdx >= 0 && slashIdx < description.length - 2) {
        const afterSlash = description.substring(slashIdx + 1).trim();
        // Ignore if it looks like a reference number or too short
        if (afterSlash.length >= 3 && !/^\d+$/.test(afterSlash)) return afterSlash;
    }
    return null;
}

/** Get date range for intercompany matching: ±1 day, Friday→Monday, Monday→Friday */
function getIntercompanyDateRange(txDate: Date): { start: string; end: string } {
    const start = new Date(txDate);
    const end = new Date(txDate);
    const dow = txDate.getUTCDay(); // 0=Sun, 5=Fri
    start.setUTCDate(start.getUTCDate() - 1);
    end.setUTCDate(end.getUTCDate() + 1);
    if (dow === 5) end.setUTCDate(txDate.getUTCDate() + 3); // Fri→Mon
    if (dow === 4) end.setUTCDate(txDate.getUTCDate() + 4); // Thu→Mon
    if (dow === 1) start.setUTCDate(txDate.getUTCDate() - 3); // Mon→Fri
    if (dow === 2) start.setUTCDate(txDate.getUTCDate() - 4); // Tue→Fri
    return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
}

/** Parse Chase ACH descriptions — extract ORIG CO NAME value for short display */
function parseChaseShortDescription(description: string, source: string): string {
    if (source !== "chase-usd") return description;
    // ACH: Match ORIG CO NAME:VALUE pattern
    const origMatch = description.match(/ORIG CO NAME:([^\s]+(?:\s+[^\s:]+)*?)(?:\s+ORIG ID:|$)/i)
        || description.match(/ORIG CO NAME:([^\s]+)/i);
    if (origMatch && origMatch[1]) return origMatch[1].trim();
    // ACH fallback: CO ENTRY DESCR
    const descrMatch = description.match(/CO ENTRY DESCR:([^\s]+(?:\s+[^\s:]+)*?)(?:\s+SEC:|$)/i);
    if (descrMatch && descrMatch[1]) return descrMatch[1].trim();
    // WIRE TRANSFER: extract A/C: value (stop at postal code or REF:)
    const acMatch = description.match(/A\/C:\s*(.+?)(?:\s+[A-Z]{1,2}\d{1,2}[A-Z0-9]*\s|\s+REF:|$)/i);
    if (acMatch && acMatch[1]) {
        return acMatch[1].trim().replace(/\s+/g, " ").split(" ").map(w =>
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(" ");
    }
    // CHIPS CREDIT: extract B/O: value (format: B/O: 1/NAME. 3/...)
    const boMatch = description.match(/B\/O:\s*(?:\d+\/)?(.+?)(?:\.\s*\d+\/|\s+\d+\/|$)/i);
    if (boMatch && boMatch[1]) {
        return boMatch[1].trim().replace(/\s+/g, " ").split(" ").map(w =>
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(" ");
    }
    return description;
}

// ════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════

export default function BankStatementsPage() {
    const [selectedBanks, setSelectedBanks] = useState<Set<string>>(new Set(["bankinter-eur"]));
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Detail panel
    const [selectedRow, setSelectedRow] = useState<BankTransaction | null>(null);

    // Disbursement transaction details
    const [disbursementTxns, setDisbursementTxns] = useState<DisbursementTransaction[]>([]);
    const [loadingDisbursementTxns, setLoadingDisbursementTxns] = useState(false);
    const [disbursementExpanded, setDisbursementExpanded] = useState(false);

    // Reconciliation
    const [isReconciling, setIsReconciling] = useState(false);
    const [reconcileResults, setReconcileResults] = useState<ReconcileResult[] | null>(null);

    // Manual reconciliation dialog
    const [reconDialogOpen, setReconDialogOpen] = useState(false);
    const [reconTransaction, setReconTransaction] = useState<BankTransaction | null>(null);
    const [manualPaymentSource, setManualPaymentSource] = useState("");
    const [manualNote, setManualNote] = useState("");
    const [isSavingManual, setIsSavingManual] = useState(false);

    // Smart reconciliation — matching suggestions
    const [matchingInvoices, setMatchingInvoices] = useState<APInvoiceMatch[]>([]);
    const [allAvailableInvoices, setAllAvailableInvoices] = useState<APInvoiceMatch[]>([]);
    const [providerNameMatches, setProviderNameMatches] = useState<APInvoiceMatch[]>([]);
    const [paymentSourceMatches, setPaymentSourceMatches] = useState<PaymentSourceMatch[]>([]);
    const [revenueOrderMatches, setRevenueOrderMatches] = useState<RevenueOrderMatch[]>([]);
    const [intercompanyMatches, setIntercompanyMatches] = useState<IntercompanyMatch[]>([]);
    const [selectedInvoices, setSelectedInvoices] = useState<Set<number>>(new Set());
    const [selectedPaymentMatch, setSelectedPaymentMatch] = useState<string | null>(null);
    const [selectedRevenueOrder, setSelectedRevenueOrder] = useState<string | null>(null);
    const [invoiceSearchTerm, setInvoiceSearchTerm] = useState("");
    const [manualSearchTerm, setManualSearchTerm] = useState("");
    const [manualSearchResults, setManualSearchResults] = useState<APInvoiceMatch[]>([]);
    const [isSearchingManual, setIsSearchingManual] = useState(false);
    const [loadingMatches, setLoadingMatches] = useState(false);
    const [reconTab, setReconTab] = useState<"suggestions" | "all" | "manual" | "intercompany">("suggestions");
    const [selectedIntercompanyMatch, setSelectedIntercompanyMatch] = useState<string | null>(null);

    // Sorting state for all tabs
    type SortCol = "supplier" | "invoice" | "date" | "amount" | "match" | "bank" | "currency" | "description" | null;
    type SortDir = "asc" | "desc";
    const [sortCol, setSortCol] = useState<SortCol>(null);
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    /** Toggle sort column — click same column flips direction, new column defaults desc */
    const toggleSort = useCallback((col: SortCol) => {
        if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortCol(col); setSortDir("desc"); }
    }, [sortCol]);

    /** Toggle invoice selection (multi-select) */
    const toggleInvoiceSelection = useCallback((id: number) => {
        setSelectedInvoices(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
        setSelectedPaymentMatch(null);
        setSelectedRevenueOrder(null);
        setSelectedIntercompanyMatch(null);
    }, []);

    /** Sort invoice array by current sortCol/sortDir */
    const sortInvoices = useCallback((items: APInvoiceMatch[]): APInvoiceMatch[] => {
        if (!sortCol) return items;
        const dir = sortDir === "asc" ? 1 : -1;
        return [...items].sort((a, b) => {
            switch (sortCol) {
                case "supplier": return (a.provider_code || "").localeCompare(b.provider_code || "") * dir;
                case "invoice": return (a.invoice_number || "").localeCompare(b.invoice_number || "") * dir;
                case "date": return (a.schedule_date || "").localeCompare(b.schedule_date || "") * dir;
                case "amount": return ((a.paid_amount ?? a.invoice_amount) - (b.paid_amount ?? b.invoice_amount)) * dir;
                case "match": return (a.matchScore - b.matchScore) * dir;
                default: return 0;
            }
        });
    }, [sortCol, sortDir]);

    /** Sort intercompany matches by current sortCol/sortDir */
    const sortIntercompany = useCallback((items: IntercompanyMatch[]): IntercompanyMatch[] => {
        if (!sortCol) return items;
        const dir = sortDir === "asc" ? 1 : -1;
        return [...items].sort((a, b) => {
            switch (sortCol) {
                case "bank": case "supplier": return (a.sourceLabel || "").localeCompare(b.sourceLabel || "") * dir;
                case "description": return (a.description || "").localeCompare(b.description || "") * dir;
                case "currency": return (a.currency || "").localeCompare(b.currency || "") * dir;
                case "date": return (a.date || "").localeCompare(b.date || "") * dir;
                case "amount": return (a.amount - b.amount) * dir;
                case "match": return (a.matchScore - b.matchScore) * dir;
                default: return 0;
            }
        });
    }, [sortCol, sortDir]);

    // Bank freshness metadata
    const [bankFreshness, setBankFreshness] = useState<Record<string, { lastUpload: string | null; lastRecord: string | null }>>({});
    const [isUploading, setIsUploading] = useState<string | null>(null);

    // KPI clickable filter: null | "inflows" | "outflows" | "reconciled" | "pending"
    const [kpiFilter, setKpiFilter] = useState<string | null>(null);

    // Filters — committed date range vs pending (to avoid re-fetch on arrow navigation)
    const [dateRange, setDateRange] = useState({ start: "2025-01-01", end: "2025-12-31" });
    const [pendingDateRange, setPendingDateRange] = useState({ start: "2025-01-01", end: "2025-12-31" });
    const [gatewayFilter, setGatewayFilter] = useState("all");
    const [flowFilter, setFlowFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [reconFilter, setReconFilter] = useState("all");
    const [gwReconFilter, setGwReconFilter] = useState("all");
    const [orderFilter, setOrderFilter] = useState("all");
    const [showReconciled, setShowReconciled] = useState(true);

    // Date groups
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const { toast } = useToast();

    // ─── Bank toggle ───
    const toggleBank = useCallback((bankKey: string) => {
        setSelectedBanks(prev => {
            const next = new Set(prev);
            if (next.has(bankKey)) { if (next.size > 1) next.delete(bankKey); }
            else next.add(bankKey);
            return next;
        });
    }, []);

    const selectSingleBank = useCallback((bankKey: string) => {
        setSelectedBanks(new Set([bankKey]));
    }, []);

    // ─── Load data ───
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const allSources = BANK_ACCOUNTS.map(b => b.key);
            const allRows: any[] = [];
            const PAGE = 1000;
            let from = 0;
            while (true) {
                const { data: chunk, error: chunkErr } = await supabase
                    .from("csv_rows")
                    .select("id, date, description, amount, source, reconciled, custom_data")
                    .in("source", allSources)
                    .gte("date", dateRange.start)
                    .lte("date", dateRange.end)
                    .order("date", { ascending: false })
                    .range(from, from + PAGE - 1);
                if (chunkErr) throw chunkErr;
                if (!chunk || chunk.length === 0) break;
                allRows.push(...chunk);
                if (chunk.length < PAGE) break;
                from += PAGE;
            }

            const transactions: BankTransaction[] = allRows.map(row => {
                const cd = row.custom_data || {};
                const source = row.source || "";
                const amount = parseFloat(row.amount) || 0;
                // paymentSource is ONLY for revenue — never for expenses
                const rawPaymentSource = cd.paymentSource || null;
                const paymentSource = amount > 0 ? rawPaymentSource : null;
                // Gateway is ONLY for revenue (positive amounts) — never for expenses
                const gateway = amount > 0
                    ? (paymentSource?.toLowerCase() || detectGateway(row.description || ""))
                    : null;

                return {
                    id: row.id,
                    date: row.date || "",
                    description: row.description || "",
                    amount: parseFloat(row.amount) || 0,
                    source,
                    currency: source.includes("usd") ? "USD" : "EUR",
                    gateway,
                    paymentSource,
                    matchType: cd.match_type || null,
                    isReconciled: !!row.reconciled,
                    reconciliationType: cd.reconciliationType || (row.reconciled ? "automatic" : null),
                    isOrderReconciled: !!cd.invoice_order_matched || (amount < 0 && !!row.reconciled),
                    invoiceOrderId: cd.invoice_order_id || null,
                    invoiceNumber: cd.invoice_number || null,
                    custom_data: cd,
                };
            });

            setBankTransactions(transactions);

            // Expand all date groups initially
            const allDates = new Set<string>();
            transactions.forEach(t => { if (t.date) allDates.add(t.date.split("T")[0]); });
            setExpandedGroups(allDates);
        } catch (err) {
            console.error("Error loading data:", err);
            setError(err instanceof Error ? err.message : "Error loading data");
        } finally {
            setIsLoading(false);
        }
    }, [dateRange]);

    useEffect(() => { loadData(); }, [loadData]);

    // ─── Load disbursement transaction details ───
    const loadDisbursementDetails = useCallback(async (row: BankTransaction) => {
        const cd = row.custom_data;
        const txIds: string[] = cd?.transaction_ids || [];
        const settlementBatch = cd?.settlement_batch_id;
        const disbDate = cd?.disbursement_date;
        const paySource = row.paymentSource?.toLowerCase() || "";

        if (txIds.length === 0 && !settlementBatch && !disbDate) {
            setDisbursementTxns([]);
            return;
        }

        setLoadingDisbursementTxns(true);
        try {
            let rows: any[] = [];

            // Strategy 1: query by transaction_ids if available
            if (txIds.length > 0) {
                // Braintree transactions are in csv_rows — match by custom_data.transaction_id
                const sources = paySource.includes("stripe")
                    ? ["stripe-eur", "stripe-usd"]
                    : paySource.includes("gocardless")
                        ? ["gocardless"]
                        : ["braintree-api-revenue", "braintree-api-revenue-usd", "braintree-api-revenue-gbp", "braintree-api-revenue-amex"];

                // Fetch in batches of 50 IDs to avoid URL-length issues
                for (let i = 0; i < txIds.length; i += 50) {
                    const batch = txIds.slice(i, i + 50);
                    for (const source of sources) {
                        const { data } = await supabase
                            .from("csv_rows")
                            .select("id, date, amount, description, custom_data")
                            .eq("source", source)
                            .in("custom_data->>transaction_id", batch)
                            .limit(100);
                        if (data) rows.push(...data);
                    }
                }
            }

            // Strategy 2: fallback — query by disbursement_date + source
            if (rows.length === 0 && disbDate) {
                const sources = paySource.includes("stripe")
                    ? ["stripe-eur", "stripe-usd"]
                    : paySource.includes("gocardless")
                        ? ["gocardless"]
                        : ["braintree-api-revenue", "braintree-api-revenue-usd", "braintree-api-revenue-gbp", "braintree-api-revenue-amex"];

                for (const source of sources) {
                    const { data } = await supabase
                        .from("csv_rows")
                        .select("id, date, amount, description, custom_data")
                        .eq("source", source)
                        .eq("custom_data->>disbursement_date", disbDate)
                        .order("date", { ascending: false })
                        .limit(200);
                    if (data) rows.push(...data);
                }
            }

            // Deduplicate by ID
            const seen = new Set<string>();
            const unique = rows.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });

            const txns: DisbursementTransaction[] = unique.map(r => {
                const rcd = r.custom_data || {};
                return {
                    id: r.id,
                    date: r.date || rcd.created_at || "",
                    customerName: rcd.customer_name || rcd.customerName || extractSupplierName(r.description || ""),
                    customerEmail: rcd.customer_email || rcd.email || "",
                    orderId: rcd.order_id || rcd.orderId || null,
                    amount: parseFloat(r.amount) || 0,
                    currency: rcd.currency || (r.source?.includes("usd") ? "USD" : "EUR"),
                    cardType: rcd.card_type || rcd.cardType || null,
                    paymentMethod: rcd.payment_method_type || rcd.payment_method || null,
                    transactionId: rcd.transaction_id || r.id,
                };
            });

            // Sort by amount descending
            txns.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
            setDisbursementTxns(txns);
        } catch (err) {
            console.error("Error loading disbursement details:", err);
            setDisbursementTxns([]);
        } finally {
            setLoadingDisbursementTxns(false);
        }
    }, []);

    // Auto-load disbursement details when selecting a reconciled revenue row
    useEffect(() => {
        if (selectedRow && selectedRow.amount >= 0 && selectedRow.isReconciled && selectedRow.paymentSource) {
            loadDisbursementDetails(selectedRow);
            setDisbursementExpanded(true);
        } else {
            setDisbursementTxns([]);
            setDisbursementExpanded(false);
        }
    }, [selectedRow, loadDisbursementDetails]);

    const applyDateRange = () => {
        setDateRange({ ...pendingDateRange });
    };

    // ─── Load bank freshness data ───
    const loadFreshness = useCallback(async () => {
        const SOURCE_MAP: Record<string, string> = { "sabadell": "sabadell-eur" };
        try {
            const res = await fetch("/api/data-freshness");
            const data = await res.json();
            if (data.sources) {
                const map: Record<string, { lastUpload: string | null; lastRecord: string | null }> = {};
                for (const s of data.sources) {
                    map[s.source] = { lastUpload: s.lastSync, lastRecord: s.lastRecordDate };
                }
                for (const [alias, real] of Object.entries(SOURCE_MAP)) {
                    if (map[real] && !map[alias]) map[alias] = map[real];
                }
                setBankFreshness(map);
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => { loadFreshness(); }, [loadFreshness]);

    // ─── Bank CSV Upload Handler ───
    const handleBankUpload = async (bankKey: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const bank = BANK_ACCOUNTS.find(b => b.key === bankKey);
        if (!bank) return;

        setIsUploading(bankKey);
        try {
            if (bank.uploadType === "formdata") {
                // FormData POST for chase-usd, bankinter-eur, sabadell
                const formData = new FormData();
                formData.append("file", file);
                const res = await fetch(bank.uploadEndpoint, { method: "POST", body: formData });
                const result = await res.json();
                if (!res.ok || !result.success) {
                    toast({ title: "Upload failed", description: result.error || "Unknown error", variant: "destructive" });
                    return;
                }
                const count = result.data?.rowCount || result.data?.rows?.length || 0;
                toast({ title: "Upload successful", description: `${count} transactions imported for ${bank.label}` });
            } else {
                // Client-side parsing for bankinter-usd
                const text = await file.text();
                const lines = text.split("\\n");
                if (lines.length < 2) { toast({ title: "Upload failed", description: "File is empty or invalid", variant: "destructive" }); return; }
                const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
                const fechaIdx = headers.findIndex(h => h.toUpperCase().replace(/[ÃÁ]/g, "A").includes("FECHA") && h.toUpperCase().includes("VALOR"));
                const descIdx = headers.findIndex(h => h.toUpperCase().replace(/[ÃÓÑ"]/g, "O").includes("DESCRIPCI"));
                const haberIdx = headers.findIndex(h => h.toUpperCase() === "HABER");
                const debeIdx = headers.findIndex(h => h.toUpperCase() === "DEBE");
                if (fechaIdx < 0 || descIdx < 0) { toast({ title: "Upload failed", description: "Could not find required columns", variant: "destructive" }); return; }

                const rows: any[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
                    const dateRaw = cols[fechaIdx];
                    if (!dateRaw) continue;
                    const parts = dateRaw.split("/");
                    const isoDate = parts.length === 3 ? `${parts[2].length === 2 ? "20" + parts[2] : parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}` : dateRaw;
                    const haber = haberIdx >= 0 ? parseFloat((cols[haberIdx] || "0").replace(/\\./g, "").replace(",", ".")) || 0 : 0;
                    const debe = debeIdx >= 0 ? parseFloat((cols[debeIdx] || "0").replace(/\\./g, "").replace(",", ".")) || 0 : 0;
                    const amount = haber - debe;
                    rows.push({
                        id: `bankinter-usd-${Date.now()}-${i}`,
                        file_name: "bankinter-usd.csv",
                        source: "bankinter-usd",
                        date: isoDate,
                        description: cols[descIdx] || "",
                        amount: amount.toString(),
                        category: "Other",
                        classification: "Other",
                        reconciled: false,
                        custom_data: { date: isoDate, description: cols[descIdx], amount },
                    });
                }
                if (rows.length === 0) { toast({ title: "Upload failed", description: "No valid rows found", variant: "destructive" }); return; }
                const res = await fetch("/api/csv-rows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, source: "bankinter-usd" }) });
                const result = await res.json();
                if (!res.ok || !result.success) { toast({ title: "Upload failed", description: result.error || "Unknown error", variant: "destructive" }); return; }
                toast({ title: "Upload successful", description: `${rows.length} transactions imported for ${bank.label}` });
            }
            await loadData();
            await loadFreshness();
        } catch (err) {
            toast({ title: "Upload error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
        } finally {
            setIsUploading(null);
            event.target.value = "";
        }
    };

    // ─── Auto Reconciliation ───
    const runReconciliation = async (dryRun = false) => {
        setIsReconciling(true);
        setReconcileResults(null);
        try {
            const res = await fetch("/api/reconcile/run-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dryRun, banks: [...selectedBanks] }),
            });
            const data = await res.json();
            if (data.success) {
                setReconcileResults(data.banks);
                if (!dryRun) {
                    toast({ title: "Reconciliation applied", description: `${data.summary?.totalMatched || 0} matches found` });
                    await loadData();
                }
            } else {
                setError("Reconciliation failed: " + (data.error || ""));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Reconciliation error");
        } finally {
            setIsReconciling(false);
        }
    };

    // ─── Smart Reconciliation: Matching Functions ───

    const parseDateSafe = (dateStr: string): Date | null => {
        if (!dateStr) return null;
        const parts = dateStr.split("-");
        if (parts.length !== 3) return null;
        return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    };

    /** Load AP invoice matches for EXPENSE transactions */
    const loadExpenseMatches = async (tx: BankTransaction) => {
        const txDate = parseDateSafe(tx.date?.split("T")[0]);
        if (!txDate) return;
        const txAmount = Math.abs(tx.amount);

        try {
            // 1) Extract supplier name from description (e.g., "Recibo/iberent technology" → "iberent technology")
            const extractedSupplier = extractSupplierName(tx.description);

            // Banking noise words — never use these for supplier matching
            const NOISE_WORDS = new Set([
                "recibo", "recib", "transferencia", "transfer", "pago", "paga", "pmt",
                "payment", "cobro", "cargo", "abono", "ingreso", "domiciliacion",
                "adeudo", "comision", "comisiones", "impuesto", "iva", "sepa",
                "swift", "ref", "fra", "factura", "orden", "concepto",
                "nro", "num", "numero", "cuenta", "cta", "iban",
            ]);

            // When we have an extracted supplier name, use ONLY those words for matching
            const rawWords = (extractedSupplier || tx.description)
                .split(/[\s,;.\/\-]+/)
                .filter(w => w.length > 2)
                .map(w => w.toLowerCase())
                .filter(w => !NOISE_WORDS.has(w));

            // Load all unreconciled AP invoices
            const allPages: any[] = [];
            let page = 0;
            const PAGE_SIZE = 1000;
            while (true) {
                const { data: chunk } = await supabase
                    .from("invoices")
                    .select("*")
                    .eq("is_reconciled", false)
                    .eq("invoice_type", "INCURRED")
                    .order("schedule_date", { ascending: false })
                    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
                if (!chunk || chunk.length === 0) break;
                allPages.push(...chunk);
                if (chunk.length < PAGE_SIZE) break;
                page++;
            }

            // Score every invoice: supplier name match from description
            const supplierMatches: APInvoiceMatch[] = [];
            const otherInvoices: APInvoiceMatch[] = [];

            allPages.forEach(inv => {
                const provider = (inv.provider_code || "").toLowerCase();
                const invDesc = (inv.description || "").toLowerCase();
                const invAmount = parseFloat(inv.paid_amount) || parseFloat(inv.invoice_amount) || 0;
                const amountDiff = Math.abs(invAmount - txAmount);

                // Method 1: Fuzzy match extracted supplier name vs provider_code (≥60%)
                let fuzzyScore = 0;
                let fuzzyMatch = false;
                if (extractedSupplier) {
                    fuzzyScore = stringSimilarity(extractedSupplier, inv.provider_code || "");
                    fuzzyMatch = fuzzyScore >= 0.60;
                }

                // Method 2: Word-based matching (fallback)
                const matchedWords = rawWords.filter(w => provider.includes(w) || invDesc.includes(w));
                const wordMatch = matchedWords.length > 0;

                const isSupplierMatch = fuzzyMatch || wordMatch;

                const parsed: APInvoiceMatch = {
                    ...inv,
                    invoice_amount: parseFloat(inv.invoice_amount) || 0,
                    paid_amount: inv.paid_amount ? parseFloat(inv.paid_amount) : null,
                    matchScore: 0,
                    matchReason: "",
                };

                if (isSupplierMatch) {
                    const isExact = amountDiff < 0.01;
                    const isClose = amountDiff <= txAmount * 0.15;
                    const matchLabel = fuzzyMatch
                        ? `"${extractedSupplier}" ≈ "${inv.provider_code}" (${Math.round(fuzzyScore * 100)}%)`
                        : `"${matchedWords.join(", ")}"`;
                    if (isExact) {
                        parsed.matchScore = 95;
                        parsed.matchReason = `Exact amount + supplier ${matchLabel}`;
                    } else if (isClose) {
                        parsed.matchScore = 75;
                        parsed.matchReason = `Supplier ${matchLabel}, amount ±${((amountDiff / txAmount) * 100).toFixed(0)}%`;
                    } else {
                        parsed.matchScore = fuzzyMatch ? Math.round(fuzzyScore * 100) : 60;
                        parsed.matchReason = `Supplier ${matchLabel}`;
                    }
                    supplierMatches.push(parsed);
                } else {
                    parsed.matchReason = "Unreconciled";
                    otherInvoices.push(parsed);
                }
            });

            // Sort supplier matches: highest score first, then by date
            supplierMatches.sort((a, b) => b.matchScore - a.matchScore || a.schedule_date.localeCompare(b.schedule_date));

            setMatchingInvoices([]); // Not used separately anymore
            setProviderNameMatches(supplierMatches);
            setAllAvailableInvoices(otherInvoices);
        } catch (err) {
            console.error("Error loading expense matches:", err);
        }
    };

    /** Load payment source & revenue matches for REVENUE transactions */
    const loadRevenueMatches = async (tx: BankTransaction) => {
        const txDate = parseDateSafe(tx.date?.split("T")[0]);
        if (!txDate) return;
        const txAmount = Math.abs(tx.amount);
        const currency = tx.currency;

        const startDate = new Date(txDate);
        startDate.setDate(startDate.getDate() - 10);
        const endDate = new Date(txDate);
        endDate.setDate(endDate.getDate() + 10);

        try {
            // 1) Payment Source Matches — show ALL unreconciled gateway invoices (not just matching amounts)
            const paymentSources = currency === "USD"
                ? ["braintree-api-revenue-usd", "stripe-usd"]
                : ["braintree-api-revenue", "braintree-api-revenue-gbp", "braintree-api-revenue-amex", "stripe-eur", "gocardless"];

            // Broader date range for gateway data
            const gwStart = new Date(txDate);
            gwStart.setDate(gwStart.getDate() - 15);
            const gwEnd = new Date(txDate);
            gwEnd.setDate(gwEnd.getDate() + 5);

            const { data: gatewayData } = await supabase
                .from("csv_rows")
                .select("*")
                .in("source", paymentSources)
                .eq("reconciled", false)
                .gte("date", gwStart.toISOString().split("T")[0])
                .lte("date", gwEnd.toISOString().split("T")[0])
                .limit(500);

            const pMatches: PaymentSourceMatch[] = [];
            if (gatewayData) {
                // Group Braintree by disbursement_date
                const braintreeRows = gatewayData.filter(r => (r.source || "").includes("braintree"));
                const otherRows = gatewayData.filter(r => !(r.source || "").includes("braintree"));

                // Braintree: group by disbursement date and sum — show ALL groups
                const disbGroups = new Map<string, { rows: any[]; total: number; source: string }>();
                braintreeRows.forEach(r => {
                    const cd = r.custom_data || {};
                    const disbDate = cd.disbursement_date || r.date?.split("T")[0] || "";
                    const key = `${r.source}|${disbDate}`;
                    if (!disbGroups.has(key)) disbGroups.set(key, { rows: [], total: 0, source: r.source });
                    const g = disbGroups.get(key)!;
                    g.rows.push(r);
                    g.total += Math.abs(parseFloat(r.amount) || 0);
                });

                disbGroups.forEach((group, key) => {
                    const date = key.split("|")[1];
                    const diff = Math.abs(group.total - txAmount);
                    const exact = diff < 0.10;
                    const srcName = group.source.includes("amex") ? "Braintree Amex"
                        : group.source.includes("gbp") ? "Braintree GBP"
                            : group.source.includes("usd") ? "Braintree USD" : "Braintree EUR";
                    pMatches.push({
                        id: `bt-disb-${key}`,
                        source: group.source,
                        sourceLabel: `${srcName} (${date})`,
                        disbursementDate: date,
                        amount: group.total,
                        transactionCount: group.rows.length,
                        matchScore: exact ? 95 : (diff < txAmount * 0.05 ? 80 : 40),
                        matchReason: exact
                            ? `Exact disbursement (${group.rows.length} txns)`
                            : `${group.rows.length} txns, total ${formatCurrency(group.total, currency)}`,
                    });
                });

                // Non-Braintree: show ALL
                otherRows.forEach(r => {
                    const rAmount = Math.abs(parseFloat(r.amount) || 0);
                    const diff = Math.abs(rAmount - txAmount);
                    const srcLabel = (r.source || "").includes("stripe") ? "Stripe" : "GoCardless";
                    pMatches.push({
                        id: r.id,
                        source: r.source,
                        sourceLabel: `${srcLabel} (${r.date?.split("T")[0]})`,
                        disbursementDate: r.date?.split("T")[0] || "",
                        amount: rAmount,
                        transactionCount: 1,
                        matchScore: diff < 0.10 ? 95 : (diff < txAmount * 0.05 ? 75 : 30),
                        matchReason: diff < 0.10 ? "Exact amount" : formatCurrency(rAmount, currency),
                    });
                });
            }
            setPaymentSourceMatches(pMatches.sort((a, b) => b.matchScore - a.matchScore));

            // 2) Customer name matching — only when description has a customer name
            const descLower = tx.description.toLowerCase();
            const descWords = tx.description.split(/[\s,;.\/\-]+/).filter(w => w.length > 2).map(w => w.toLowerCase());
            const hasCustomerName = descWords.length > 0 && !detectGateway(tx.description); // Only if it's NOT a gateway deposit

            const revMatches: RevenueOrderMatch[] = [];

            if (hasCustomerName) {
                // Search ar_invoices by customer name
                const revStart = new Date(txDate);
                revStart.setDate(revStart.getDate() - 60);
                const revEnd = new Date(txDate);
                revEnd.setDate(revEnd.getDate() + 5);

                const { data: arData } = await supabase
                    .from("ar_invoices")
                    .select("*")
                    .eq("reconciled", false)
                    .gte("order_date", revStart.toISOString().split("T")[0])
                    .lte("order_date", revEnd.toISOString().split("T")[0])
                    .limit(500);

                (arData || []).forEach(inv => {
                    const invAmount = parseFloat(inv.total_amount) || parseFloat(inv.charged_amount) || 0;
                    const custName = (inv.customer_name || inv.company_name || "").toLowerCase();
                    const nameWords = custName.split(/[\s,]+/).filter((w: string) => w.length > 2);
                    const nameMatch = nameWords.some((w: string) => descLower.includes(w));

                    if (nameMatch) {
                        const diff = Math.abs(invAmount - txAmount);
                        const isExact = diff < 0.01;
                        revMatches.push({
                            id: `ar-${inv.id}`,
                            source: "ar_invoices",
                            sourceLabel: "AR Invoice",
                            orderId: inv.order_id || null,
                            invoiceNumber: inv.invoice_number || null,
                            customerName: inv.customer_name || inv.company_name || "",
                            amount: invAmount,
                            date: inv.order_date || "",
                            matchScore: isExact ? 100 : 60,
                            matchReason: isExact ? "Exact amount + customer name" : `Customer name match`,
                        });
                    }
                });

                // Search invoice-orders csv_rows by customer name
                const orderSources = currency === "USD" ? ["invoice-orders-usd"] : ["invoice-orders"];
                const { data: orderData } = await supabase
                    .from("csv_rows")
                    .select("*")
                    .in("source", orderSources)
                    .eq("reconciled", false)
                    .gte("date", revStart.toISOString().split("T")[0])
                    .lte("date", revEnd.toISOString().split("T")[0])
                    .limit(500);

                (orderData || []).forEach(row => {
                    const cd = row.custom_data || {};
                    const custName = (cd.customer_name || cd.company_name || "").toLowerCase();
                    const nameWords = custName.split(/[\s,]+/).filter((w: string) => w.length > 2);
                    const nameMatch = nameWords.some((w: string) => descLower.includes(w));

                    if (nameMatch) {
                        const rowAmount = Math.abs(parseFloat(row.amount) || 0);
                        const diff = Math.abs(rowAmount - txAmount);
                        const isExact = diff < 0.01;
                        revMatches.push({
                            id: row.id,
                            source: "invoice-orders",
                            sourceLabel: "Invoice Order",
                            orderId: cd.order_id || null,
                            invoiceNumber: cd.invoice_number || null,
                            customerName: cd.customer_name || cd.company_name || "",
                            amount: rowAmount,
                            date: row.date?.split("T")[0] || "",
                            matchScore: isExact ? 100 : 55,
                            matchReason: isExact ? "Exact amount + customer match" : `Customer name match`,
                        });
                    }
                });
            }

            setRevenueOrderMatches(revMatches.sort((a, b) => b.matchScore - a.matchScore));
        } catch (err) {
            console.error("Error loading revenue matches:", err);
        }
    };

    /** Load intercompany matches — transfers between company bank accounts (±1 day, Fri→Mon, cross-currency) */
    const loadIntercompanyMatches = async (tx: BankTransaction) => {
        const txDate = parseDateSafe(tx.date?.split("T")[0]);
        if (!txDate) return;
        const txAmount = Math.abs(tx.amount);
        const txCurrency = tx.currency;
        const { start, end } = getIntercompanyDateRange(txDate);

        try {
            const otherBanks = BANK_ACCOUNTS.filter(b => b.key !== tx.source).map(b => b.key);

            const { data: icData } = await supabase
                .from("csv_rows")
                .select("*")
                .in("source", otherBanks)
                .eq("reconciled", false)
                .gte("date", start)
                .lte("date", end)
                .limit(500);

            const icMatches: IntercompanyMatch[] = [];

            (icData || []).forEach(r => {
                const rAmount = parseFloat(r.amount) || 0;
                const rAbsAmount = Math.abs(rAmount);
                const rSource = r.source || "";
                const rCurrency = rSource.includes("usd") || rSource === "chase-usd" ? "USD" : "EUR";
                const isCrossCurrency = txCurrency !== rCurrency;

                // Must be opposite sign (outflow ↔ inflow)
                if (tx.amount > 0 && rAmount > 0) return;
                if (tx.amount < 0 && rAmount < 0) return;

                let matchScore = 0;

                if (isCrossCurrency) {
                    // Cross-currency: ~20% tolerance for EUR/USD exchange rate
                    const ratio = rAbsAmount / txAmount;
                    if (ratio < 0.80 || ratio > 1.25) return;
                    const diff = Math.abs(1 - ratio);
                    matchScore = diff < 0.02 ? 90 : diff < 0.10 ? 75 : 55;
                } else {
                    // Same currency: tight tolerance (0.5% or €1)
                    const diff = Math.abs(rAbsAmount - txAmount);
                    const pct = txAmount > 0 ? diff / txAmount : 0;
                    if (pct >= 0.005 && diff >= 1) return;
                    matchScore = diff < 0.01 ? 98 : diff < 1 ? 90 : 75;
                }

                const bankLabel = BANK_ACCOUNTS.find(b => b.key === rSource)?.label || rSource;

                icMatches.push({
                    id: r.id,
                    source: rSource,
                    sourceLabel: bankLabel,
                    amount: rAbsAmount,
                    currency: rCurrency,
                    date: r.date?.split("T")[0] || "",
                    description: r.description || "",
                    matchScore,
                });
            });

            setIntercompanyMatches(icMatches.sort((a, b) => b.matchScore - a.matchScore));
        } catch (err) {
            console.error("Error loading intercompany matches:", err);
        }
    };

    /** Open smart reconciliation dialog — loads matching suggestions */
    const openManualRecon = async (tx: BankTransaction) => {
        // Reset all state
        setReconTransaction(tx);
        setManualPaymentSource(tx.gateway || "");
        setManualNote("");
        setSelectedInvoices(new Set());
        setSelectedPaymentMatch(null);
        setSelectedRevenueOrder(null);
        setSelectedIntercompanyMatch(null);
        setInvoiceSearchTerm("");
        setMatchingInvoices([]);
        setAllAvailableInvoices([]);
        setProviderNameMatches([]);
        setPaymentSourceMatches([]);
        setRevenueOrderMatches([]);
        setIntercompanyMatches([]);
        setManualSearchTerm("");
        setManualSearchResults([]);
        setReconTab("suggestions");
        setReconDialogOpen(true);
        setLoadingMatches(true);

        try {
            const isExpense = tx.amount < 0;
            if (isExpense) {
                await Promise.all([loadExpenseMatches(tx), loadIntercompanyMatches(tx)]);
            } else {
                await Promise.all([loadRevenueMatches(tx), loadIntercompanyMatches(tx)]);
            }
        } catch (err) {
            console.error("Error loading matches:", err);
        } finally {
            setLoadingMatches(false);
        }
    };

    const performManualReconciliation = async () => {
        if (!reconTransaction) return;
        setIsSavingManual(true);

        const isExpense = reconTransaction.amount < 0;
        const txAmount = Math.abs(reconTransaction.amount);
        const now = new Date().toISOString();

        try {
            // CASE 1: Expense → AP Invoice match (supports multiple invoices)
            if (isExpense && selectedInvoices.size > 0) {
                const allInvoiceLists = [...matchingInvoices, ...providerNameMatches, ...allAvailableInvoices, ...manualSearchResults];
                const selectedInvs = allInvoiceLists.filter(inv => selectedInvoices.has(inv.id));
                if (selectedInvs.length === 0) throw new Error("No invoices found");

                const totalInvoiceAmount = selectedInvs.reduce((s, inv) => s + (inv.paid_amount ?? inv.invoice_amount ?? 0), 0);
                const invoiceNumbers = selectedInvs.map(inv => inv.invoice_number).filter(Boolean).join(", ");
                const providers = [...new Set(selectedInvs.map(inv => inv.provider_code).filter(Boolean))].join(", ");

                // Update each AP invoice
                for (const inv of selectedInvs) {
                    const paidAmt = inv.paid_amount ?? inv.invoice_amount ?? 0;
                    const { error: invErr } = await supabase
                        .from("invoices")
                        .update({
                            is_reconciled: true,
                            reconciled_transaction_id: reconTransaction.id,
                            reconciled_at: now,
                            reconciled_amount: paidAmt,
                        })
                        .eq("id", inv.id);
                    if (invErr) throw invErr;
                }

                // Update bank transaction — NO gateway/paymentSource for expenses
                const { error: txErr } = await supabase
                    .from("csv_rows")
                    .update({
                        reconciled: true,
                        custom_data: {
                            ...reconTransaction.custom_data,
                            reconciliationType: "manual",
                            reconciled_at: now,
                            matched_invoice_ids: [...selectedInvoices],
                            matched_invoice_numbers: invoiceNumbers,
                            matched_invoice_total: totalInvoiceAmount,
                            matched_provider: providers,
                            manual_note: manualNote || null,
                        },
                    })
                    .eq("id", reconTransaction.id);
                if (txErr) throw txErr;

                setBankTransactions(prev => prev.map(t =>
                    t.id === reconTransaction.id
                        ? { ...t, isReconciled: true, reconciliationType: "manual" }
                        : t
                ));

                toast({ title: "Reconciled!", description: `Matched with ${selectedInvs.length} invoice(s): ${invoiceNumbers} (${providers})` });
                setReconDialogOpen(false);
                return;
            }

            // CASE 2: Revenue → Payment Source match
            if (!isExpense && selectedPaymentMatch) {
                const match = paymentSourceMatches.find(m => m.id === selectedPaymentMatch);
                if (!match) throw new Error("Payment source match not found");

                const { error: txErr } = await supabase
                    .from("csv_rows")
                    .update({
                        reconciled: true,
                        custom_data: {
                            ...reconTransaction.custom_data,
                            paymentSource: match.source,
                            reconciliationType: "manual",
                            reconciled_at: now,
                            matched_source: match.source,
                            matched_disbursement_date: match.disbursementDate,
                            matched_amount: match.amount,
                            matched_transaction_count: match.transactionCount,
                            manual_note: manualNote || null,
                        },
                    })
                    .eq("id", reconTransaction.id);
                if (txErr) throw txErr;

                setBankTransactions(prev => prev.map(t =>
                    t.id === reconTransaction.id
                        ? { ...t, isReconciled: true, reconciliationType: "manual", paymentSource: match.source }
                        : t
                ));

                toast({ title: "Reconciled!", description: `Matched with ${match.sourceLabel} (${match.transactionCount} txns)` });
                setReconDialogOpen(false);
                return;
            }

            // CASE 3: Revenue → AR Invoice / Revenue Order match
            if (!isExpense && selectedRevenueOrder) {
                const match = revenueOrderMatches.find(m => m.id === selectedRevenueOrder);
                if (!match) throw new Error("Revenue order not found");

                // Update matched source
                if (match.source === "invoice-orders") {
                    await supabase
                        .from("csv_rows")
                        .update({
                            reconciled: true,
                            custom_data: {
                                reconciled_at: now,
                                reconciled_with_bank_id: reconTransaction.id,
                                reconciled_bank_amount: txAmount,
                            },
                        })
                        .eq("id", match.id);
                } else if (match.source === "ar_invoices") {
                    const arId = parseInt(match.id.replace("ar-", ""));
                    await supabase
                        .from("ar_invoices")
                        .update({
                            reconciled: true,
                            reconciled_at: now,
                            reconciled_with: reconTransaction.id,
                            reconciliation_type: "manual-bank",
                        })
                        .eq("id", arId);
                }

                // Update bank transaction
                const { error: txErr } = await supabase
                    .from("csv_rows")
                    .update({
                        reconciled: true,
                        custom_data: {
                            ...reconTransaction.custom_data,
                            reconciliationType: "manual",
                            reconciled_at: now,
                            matched_order_id: match.orderId || match.id,
                            matched_order_source: match.source,
                            matched_customer_name: match.customerName,
                            matched_invoice_number: match.invoiceNumber,
                            matched_order_amount: match.amount,
                            manual_note: manualNote || null,
                        },
                    })
                    .eq("id", reconTransaction.id);
                if (txErr) throw txErr;

                setBankTransactions(prev => prev.map(t =>
                    t.id === reconTransaction.id
                        ? { ...t, isReconciled: true, reconciliationType: "manual" }
                        : t
                ));

                toast({ title: "Reconciled!", description: `Matched with ${match.sourceLabel}: ${match.customerName} (${formatCurrency(match.amount, reconTransaction.currency)})` });
                setReconDialogOpen(false);
                return;
            }

            // CASE IC: Intercompany match — reconcile BOTH bank transactions
            if (selectedIntercompanyMatch) {
                const match = intercompanyMatches.find(m => m.id === selectedIntercompanyMatch);
                if (!match) throw new Error("Intercompany match not found");

                // Reconcile the matched transaction in the other bank
                const { error: matchErr } = await supabase
                    .from("csv_rows")
                    .update({
                        reconciled: true,
                        custom_data: {
                            reconciliationType: "intercompany",
                            reconciled_at: now,
                            intercompany_matched_with: reconTransaction.id,
                            intercompany_matched_bank: reconTransaction.source,
                            intercompany_matched_amount: txAmount,
                            manual_note: manualNote || null,
                        },
                    })
                    .eq("id", match.id);
                if (matchErr) throw matchErr;

                // Reconcile the current transaction
                const { error: txErr } = await supabase
                    .from("csv_rows")
                    .update({
                        reconciled: true,
                        custom_data: {
                            ...reconTransaction.custom_data,
                            reconciliationType: "intercompany",
                            reconciled_at: now,
                            intercompany_matched_with: match.id,
                            intercompany_matched_bank: match.source,
                            intercompany_matched_amount: match.amount,
                            manual_note: manualNote || null,
                        },
                    })
                    .eq("id", reconTransaction.id);
                if (txErr) throw txErr;

                setBankTransactions(prev => prev.map(t => {
                    if (t.id === reconTransaction.id) return { ...t, isReconciled: true, reconciliationType: "intercompany" };
                    if (t.id === match.id) return { ...t, isReconciled: true, reconciliationType: "intercompany" };
                    return t;
                }));

                toast({ title: "Intercompany Reconciled!", description: `Matched with ${match.sourceLabel}: ${formatCurrency(match.amount, match.currency)} on ${formatShortDate(match.date)}` });
                setReconDialogOpen(false);
                return;
            }

            // CASE 4: Manual-only fallback (no match selected — just gateway + note)
            if (manualPaymentSource || manualNote) {
                const { error: txErr } = await supabase
                    .from("csv_rows")
                    .update({
                        reconciled: true,
                        custom_data: {
                            ...reconTransaction.custom_data,
                            // paymentSource is ONLY for revenue — never for expenses
                            ...(isExpense ? {} : { paymentSource: manualPaymentSource || null }),
                            reconciliationType: "manual",
                            reconciled_at: now,
                            manual_note: manualNote || null,
                        },
                    })
                    .eq("id", reconTransaction.id);
                if (txErr) throw txErr;

                setBankTransactions(prev => prev.map(t =>
                    t.id === reconTransaction.id
                        ? { ...t, isReconciled: true, reconciliationType: "manual", paymentSource: isExpense ? null : (manualPaymentSource || null) }
                        : t
                ));

                toast({ title: "Manual reconciliation", description: "Transaction marked as reconciled" });
                setReconDialogOpen(false);
                return;
            }

            toast({ title: "No selection", description: "Select a match or provide gateway/note to reconcile", variant: "destructive" });
        } catch (err) {
            toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to reconcile", variant: "destructive" });
        } finally {
            setIsSavingManual(false);
        }
    };

    const revertReconciliation = async (tx: BankTransaction) => {
        if (!confirm("Revert reconciliation for this transaction?")) return;
        try {
            const cleanData = { ...tx.custom_data };
            delete cleanData.paymentSource;
            delete cleanData.reconciliationType;
            delete cleanData.reconciled_at;
            delete cleanData.manual_note;
            delete cleanData.match_type;

            const { error: updateErr } = await supabase
                .from("csv_rows")
                .update({ reconciled: false, custom_data: cleanData })
                .eq("id", tx.id);

            if (updateErr) throw updateErr;

            setBankTransactions(prev => prev.map(t =>
                t.id === tx.id ? { ...t, isReconciled: false, reconciliationType: null, paymentSource: null, matchType: null } : t
            ));

            if (selectedRow?.id === tx.id) {
                setSelectedRow({ ...tx, isReconciled: false, reconciliationType: null, paymentSource: null, matchType: null });
            }

            toast({ title: "Reverted", description: "Reconciliation removed" });
        } catch (err) {
            toast({ title: "Error", description: "Failed to revert", variant: "destructive" });
        }
    };

    // ─── Filtered transactions ───
    const filteredTransactions = useMemo(() => {
        return bankTransactions.filter(tx => {
            if (!selectedBanks.has(tx.source)) return false;
            if (!showReconciled && tx.isReconciled) return false;
            if (gatewayFilter !== "all" && (!tx.gateway || tx.gateway !== gatewayFilter)) return false;
            if (flowFilter === "income" && tx.amount <= 0) return false;
            if (flowFilter === "expense" && tx.amount >= 0) return false;
            if (reconFilter === "reconciled" && !tx.isReconciled) return false;
            if (reconFilter === "pending" && tx.isReconciled) return false;
            // GW reconciliation type filter
            if (gwReconFilter === "auto" && (!tx.isReconciled || !tx.reconciliationType?.startsWith("automatic"))) return false;
            if (gwReconFilter === "manual" && (!tx.isReconciled || tx.reconciliationType !== "manual")) return false;
            if (gwReconFilter === "intercompany" && (!tx.isReconciled || tx.reconciliationType !== "intercompany")) return false;
            if (gwReconFilter === "not-reconciled" && tx.isReconciled) return false;
            // Order reconciliation filter
            if (orderFilter === "matched" && !tx.isOrderReconciled) return false;
            if (orderFilter === "not-matched" && tx.isOrderReconciled) return false;
            // KPI clickable filters
            if (kpiFilter === "inflows" && tx.amount <= 0) return false;
            if (kpiFilter === "outflows" && tx.amount >= 0) return false;
            if (kpiFilter === "reconciled" && !tx.isReconciled) return false;
            if (kpiFilter === "pending" && tx.isReconciled) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return (
                    tx.description.toLowerCase().includes(q) ||
                    tx.custom_data?.customer_name?.toLowerCase()?.includes(q) ||
                    tx.custom_data?.disbursement_reference?.toLowerCase()?.includes(q) ||
                    tx.source.toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [bankTransactions, selectedBanks, gatewayFilter, flowFilter, reconFilter, gwReconFilter, orderFilter, searchQuery, showReconciled, kpiFilter]);

    // ─── Date groups ───
    const dateGroups = useMemo(() => {
        const map = new Map<string, DateGroup>();
        filteredTransactions.forEach(tx => {
            const key = tx.date?.split("T")[0] || "unknown";
            if (!map.has(key)) {
                map.set(key, { date: key, dateLabel: key === "unknown" ? "Unknown Date" : formatDateHeader(key), rows: [], totalCredits: 0, totalDebits: 0 });
            }
            const g = map.get(key)!;
            g.rows.push(tx);
            if (tx.amount > 0) g.totalCredits += tx.amount;
            else g.totalDebits += Math.abs(tx.amount);
        });
        return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    }, [filteredTransactions]);

    // ─── Summary ───
    const summary = useMemo(() => {
        const inflows = filteredTransactions.filter(t => t.amount > 0);
        const outflows = filteredTransactions.filter(t => t.amount < 0);
        const totalInflow = inflows.reduce((s, t) => s + t.amount, 0);
        const totalOutflow = Math.abs(outflows.reduce((s, t) => s + t.amount, 0));
        const reconciledTx = filteredTransactions.filter(t => t.isReconciled);
        const reconciledCredits = reconciledTx.filter(t => t.amount > 0);
        const reconciledAmount = reconciledCredits.reduce((s, t) => s + t.amount, 0);
        const unreconciledCount = filteredTransactions.filter(t => !t.isReconciled).length;

        const byGateway: Record<string, { amount: number; count: number }> = {};
        inflows.forEach(t => {
            const key = t.paymentSource || t.gateway || "other";
            if (!byGateway[key]) byGateway[key] = { amount: 0, count: 0 };
            byGateway[key].amount += t.amount;
            byGateway[key].count++;
        });

        const byBank: Record<string, { inflows: number; outflows: number; count: number; reconCount: number }> = {};
        bankTransactions.forEach(t => {
            if (!byBank[t.source]) byBank[t.source] = { inflows: 0, outflows: 0, count: 0, reconCount: 0 };
            byBank[t.source].count++;
            if (t.amount > 0) byBank[t.source].inflows += t.amount;
            else byBank[t.source].outflows += Math.abs(t.amount);
            if (t.isReconciled) byBank[t.source].reconCount++;
        });

        return {
            totalInflow, totalOutflow,
            netCashFlow: totalInflow - totalOutflow,
            reconciledAmount,
            reconciledCount: reconciledTx.length,
            reconciledPct: totalInflow > 0 ? Math.round((reconciledAmount / totalInflow) * 100) : 0,
            unreconciledCount,
            transactionCount: filteredTransactions.length,
            byGateway, byBank,
        };
    }, [filteredTransactions, bankTransactions]);

    const toggleGroup = (date: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date); else next.add(date);
            return next;
        });
    };

    // ─── Export CSV ───
    const exportCSV = () => {
        const headers = ["Bank", "Date", "Description", "Amount", "Currency", "Gateway", "Reconciled"];
        const rows = filteredTransactions.map(t => [
            BANK_ACCOUNTS.find(b => b.key === t.source)?.label || t.source,
            t.date,
            '"' + t.description.replace(/"/g, '""') + '"',
            t.amount.toFixed(2),
            t.currency,
            t.paymentSource || t.gateway || "",
            t.isReconciled ? "Yes" : "No",
        ]);
        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "cashflow-bancario-" + dateRange.start + "-" + dateRange.end + ".csv";
        a.click();
    };

    // ─── Get dominant currency for selected banks ───
    const dominantCurrency = useMemo(() => {
        const currencies = [...selectedBanks].map(k => BANK_ACCOUNTS.find(b => b.key === k)?.currency || "EUR");
        const unique = [...new Set(currencies)];
        return unique.length === 1 ? unique[0] : "EUR";
    }, [selectedBanks]);

    // ════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-[#1e1f21]">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
        );
    }

    const showBankColumn = selectedBanks.size > 1;

    return (
        <div className="h-full flex flex-col bg-[#1e1f21] text-white overflow-hidden">
            {/* Main content area shifts when panel is open */}
            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${selectedRow ? "mr-[450px]" : ""}`}>

                {/* ─── Header ─── */}
                <div className="flex-shrink-0 border-b border-gray-700 px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-[#117ACA] p-2 rounded-lg">
                                <Database className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold">Bank Statements</h1>
                                <span className="text-gray-400 text-sm">
                                    {summary.transactionCount} transactions • {[...selectedBanks].map(b => BANK_ACCOUNTS.find(a => a.key === b)?.label).join(", ")}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-400">Net Balance</p>
                            <p className={`text-2xl font-bold ${summary.netCashFlow >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {formatCurrency(summary.netCashFlow, dominantCurrency)}
                            </p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button onClick={() => runReconciliation(true)} disabled={isReconciling} variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-700">
                                {isReconciling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                                Preview
                            </Button>
                            <Button onClick={() => runReconciliation(false)} disabled={isReconciling} variant="outline" size="sm" className="bg-transparent border-green-700 text-green-400 hover:bg-green-900/30">
                                {isReconciling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                                Auto-Reconcile
                            </Button>
                            <Button onClick={loadData} variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-700">
                                <RefreshCw className="h-4 w-4 mr-1" />Refresh
                            </Button>
                            <Button onClick={exportCSV} variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-700">
                                <Download className="h-4 w-4 mr-1" />CSV
                            </Button>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 w-56 bg-transparent border-gray-600 text-white placeholder:text-gray-500" />
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setShowReconciled(!showReconciled)} className={`bg-transparent border-gray-600 hover:bg-gray-700 ${showReconciled ? "text-white" : "text-green-400"}`}>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                {showReconciled ? "Hide Recon." : "Show Recon."}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ─── Bank Account Tabs ─── */}
                <div className="flex-shrink-0 border-b border-gray-700 px-6 py-3 bg-[#252627]">
                    {/* Hidden file inputs for each bank upload */}
                    {BANK_ACCOUNTS.map(bank => (
                        <input key={`upload-${bank.key}`} type="file" accept={bank.uploadAccept} onChange={e => handleBankUpload(bank.key, e)}
                            className="hidden" id={`file-upload-${bank.key}`} />
                    ))}
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Accounts:</span>
                        {BANK_ACCOUNTS.map(bank => {
                            const isActive = selectedBanks.has(bank.key);
                            const stats = summary.byBank[bank.key];
                            const fresh = bankFreshness[bank.key];
                            const uploading = isUploading === bank.key;
                            return (
                                <div key={bank.key} className="relative">
                                    <button onClick={() => toggleBank(bank.key)} onDoubleClick={() => selectSingleBank(bank.key)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm ${isActive ? bank.bgColor + " text-white border-transparent" : "bg-transparent border-gray-600 text-gray-400 hover:border-gray-500"} ${!stats?.count ? "opacity-40" : ""}`}
                                        title="Double-click to select only this one">
                                        <div className="flex flex-col items-start">
                                            <div className="flex items-center gap-2">
                                                <Building className="h-3.5 w-3.5" />
                                                <span className="font-medium">{bank.label}</span>
                                                {stats?.count ? <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-gray-700"}`}>{stats.count}</span> : null}
                                            </div>
                                            {fresh && (
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Clock className="h-2.5 w-2.5 text-gray-500" />
                                                    <span className="text-[9px] text-gray-500">
                                                        {fresh.lastUpload ? `Upload: ${new Date(fresh.lastUpload).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "No upload"}
                                                        {fresh.lastRecord ? ` · Data: ${new Date(fresh.lastRecord + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                    {/* Upload icon overlay */}
                                    <label htmlFor={`file-upload-${bank.key}`}
                                        className="absolute -top-1.5 -right-1.5 bg-[#1e1f21] border border-gray-600 rounded-full p-0.5 cursor-pointer hover:bg-gray-700 hover:border-gray-400 transition-all"
                                        title={`Upload ${bank.uploadAccept} for ${bank.label}`}
                                        onClick={e => e.stopPropagation()}>
                                        {uploading ? <Loader2 className="h-3 w-3 text-gray-400 animate-spin" /> : <Upload className="h-3 w-3 text-gray-400" />}
                                    </label>
                                </div>
                            );
                        })}
                        <button onClick={() => setSelectedBanks(new Set(BANK_ACCOUNTS.map(b => b.key)))} className="text-xs text-gray-500 hover:text-white ml-auto">
                            All
                        </button>
                    </div>
                </div>

                {/* ─── Stats Bar (KPI inline — clickable filters) ─── */}
                <div className="flex-shrink-0 border-b border-gray-700 px-6 py-3 bg-[#1e1f21]">
                    {kpiFilter && (
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-400">Filtering by: <span className="text-white font-medium capitalize">{kpiFilter}</span></span>
                            <button onClick={() => setKpiFilter(null)} className="text-xs text-red-400 hover:text-red-300 ml-2">✕ Clear</button>
                        </div>
                    )}
                    <div className="grid grid-cols-6 gap-4">
                        <button onClick={() => setKpiFilter(kpiFilter === "inflows" ? null : "inflows")} className={`flex items-center gap-2 min-w-0 rounded-lg px-2 py-1 transition-all ${kpiFilter === "inflows" ? "bg-green-900/30 ring-1 ring-green-600" : "hover:bg-gray-800/50"}`}>
                            <ArrowDownCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <div className="min-w-0 text-left">
                                <p className="text-[10px] text-gray-500 uppercase">Inflows</p>
                                <p className="text-sm font-bold text-green-400 truncate" title={formatCurrency(summary.totalInflow, dominantCurrency)}>
                                    {formatCompactCurrency(summary.totalInflow, dominantCurrency)}
                                </p>
                            </div>
                        </button>
                        <button onClick={() => setKpiFilter(kpiFilter === "outflows" ? null : "outflows")} className={`flex items-center gap-2 min-w-0 rounded-lg px-2 py-1 transition-all ${kpiFilter === "outflows" ? "bg-red-900/30 ring-1 ring-red-600" : "hover:bg-gray-800/50"}`}>
                            <ArrowUpCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            <div className="min-w-0 text-left">
                                <p className="text-[10px] text-gray-500 uppercase">Outflows</p>
                                <p className="text-sm font-bold text-red-400 truncate" title={formatCurrency(summary.totalOutflow, dominantCurrency)}>
                                    {formatCompactCurrency(summary.totalOutflow, dominantCurrency)}
                                </p>
                            </div>
                        </button>
                        <div className="flex items-center gap-2 min-w-0 px-2 py-1">
                            <DollarSign className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-gray-500 uppercase">Balance</p>
                                <p className={`text-sm font-bold truncate ${summary.netCashFlow >= 0 ? "text-green-400" : "text-red-400"}`} title={formatCurrency(summary.netCashFlow, dominantCurrency)}>
                                    {formatCompactCurrency(summary.netCashFlow, dominantCurrency)}
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setKpiFilter(kpiFilter === "reconciled" ? null : "reconciled")} className={`flex items-center gap-2 min-w-0 rounded-lg px-2 py-1 transition-all ${kpiFilter === "reconciled" ? "bg-emerald-900/30 ring-1 ring-emerald-600" : "hover:bg-gray-800/50"}`}>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                            <div className="min-w-0 text-left">
                                <p className="text-[10px] text-gray-500 uppercase">Reconciled</p>
                                <p className="text-sm font-bold text-emerald-400">{summary.reconciledCount} <span className="text-xs text-gray-500">({summary.reconciledPct}%)</span></p>
                            </div>
                        </button>
                        <button onClick={() => setKpiFilter(kpiFilter === "pending" ? null : "pending")} className={`flex items-center gap-2 min-w-0 rounded-lg px-2 py-1 transition-all ${kpiFilter === "pending" ? "bg-amber-900/30 ring-1 ring-amber-600" : "hover:bg-gray-800/50"}`}>
                            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                            <div className="min-w-0 text-left">
                                <p className="text-[10px] text-gray-500 uppercase">Pending</p>
                                <p className="text-sm font-bold text-amber-400">{summary.unreconciledCount}</p>
                            </div>
                        </button>
                        <div className="flex items-center gap-2 min-w-0 px-2 py-1">
                            <CreditCard className="h-4 w-4 text-violet-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-gray-500 uppercase">Reconciled Value</p>
                                <p className="text-sm font-bold text-violet-400 truncate" title={formatCurrency(summary.reconciledAmount, dominantCurrency)}>
                                    {formatCompactCurrency(summary.reconciledAmount, dominantCurrency)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Reconciliation Results Banner ─── */}
                {reconcileResults && (
                    <div className="flex-shrink-0 border-b border-gray-700 px-6 py-3 bg-emerald-900/20">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span className="text-sm font-medium text-emerald-400">Reconciliation Results</span>
                            <button onClick={() => setReconcileResults(null)} className="ml-auto text-xs text-gray-500 hover:text-white">Close</button>
                        </div>
                        <div className="flex gap-4">
                            {reconcileResults.map(r => (
                                <div key={r.bankSource} className="text-xs">
                                    <span className="text-gray-400">{BANK_ACCOUNTS.find(b => b.key === r.bankSource)?.label || r.bankSource}: </span>
                                    {r.success ? <><span className="text-emerald-400 font-semibold">{r.matched}</span> match | <span className="text-amber-400">{r.unmatched}</span> pend.</> : <span className="text-red-400">{r.error || "Failed"}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── Filters ─── */}
                <div className="flex-shrink-0 border-b border-gray-700 px-6 py-2 bg-[#252627]">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Filter className="h-3.5 w-3.5 text-gray-500" />
                        <Input type="date" value={pendingDateRange.start} onChange={e => setPendingDateRange(p => ({ ...p, start: e.target.value }))} className="w-36 h-8 bg-transparent border-gray-600 text-white text-xs" />
                        <span className="text-gray-600">→</span>
                        <Input type="date" value={pendingDateRange.end} onChange={e => setPendingDateRange(p => ({ ...p, end: e.target.value }))} className="w-36 h-8 bg-transparent border-gray-600 text-white text-xs" />
                        <Button onClick={applyDateRange} variant="outline" size="sm" className="h-8 bg-transparent border-gray-600 text-white hover:bg-gray-700 text-xs">
                            Apply
                        </Button>
                        <Select value={gatewayFilter} onValueChange={setGatewayFilter}>
                            <SelectTrigger className="w-28 h-8 bg-transparent border-gray-600 text-white text-xs"><SelectValue placeholder="Gateway" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">Gateways</SelectItem><SelectItem value="braintree-eur">Braintree EUR</SelectItem><SelectItem value="braintree-usd">Braintree USD</SelectItem><SelectItem value="braintree-gbp">Braintree GBP</SelectItem><SelectItem value="braintree-amex">Braintree Amex</SelectItem><SelectItem value="paypal">PayPal</SelectItem><SelectItem value="gocardless">GoCardless</SelectItem><SelectItem value="stripe">Stripe</SelectItem></SelectContent>
                        </Select>
                        <Select value={flowFilter} onValueChange={setFlowFilter}>
                            <SelectTrigger className="w-28 h-8 bg-transparent border-gray-600 text-white text-xs"><SelectValue placeholder="Flow" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="income">Inflows</SelectItem><SelectItem value="expense">Outflows</SelectItem></SelectContent>
                        </Select>
                        <Select value={reconFilter} onValueChange={setReconFilter}>
                            <SelectTrigger className="w-32 h-8 bg-transparent border-gray-600 text-white text-xs"><SelectValue placeholder="Reconciliation" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="reconciled">Reconciled</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent>
                        </Select>
                        <Select value={gwReconFilter} onValueChange={setGwReconFilter}>
                            <SelectTrigger className="w-28 h-8 bg-transparent border-gray-600 text-white text-xs"><SelectValue placeholder="GW Type" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">GW All</SelectItem><SelectItem value="auto">Auto</SelectItem><SelectItem value="manual">Manual</SelectItem><SelectItem value="intercompany">Intercompany</SelectItem><SelectItem value="not-reconciled">Not Recon.</SelectItem></SelectContent>
                        </Select>
                        <Select value={orderFilter} onValueChange={setOrderFilter}>
                            <SelectTrigger className="w-28 h-8 bg-transparent border-gray-600 text-white text-xs"><SelectValue placeholder="Order" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">Ord All</SelectItem><SelectItem value="matched">Matched</SelectItem><SelectItem value="not-matched">Not Matched</SelectItem></SelectContent>
                        </Select>
                    </div>
                </div>

                {/* ─── Table Header ─── */}
                <div className="flex-shrink-0 sticky top-0 z-10 bg-[#2a2b2d] border-b border-gray-700 overflow-x-auto">
                    <div className="flex items-center gap-1 px-4 py-2 text-[10px] text-gray-400 font-medium uppercase min-w-[900px]">
                        <div className="w-[60px] flex-shrink-0">Date</div>
                        {showBankColumn && <div className="w-[90px] flex-shrink-0">Bank</div>}
                        <div className="flex-1 min-w-[200px]">Description</div>
                        <div className="w-[80px] flex-shrink-0 text-right">Debit</div>
                        <div className="w-[80px] flex-shrink-0 text-right">Credit</div>
                        <div className="w-[80px] flex-shrink-0 text-center">Gateway</div>
                        <div className="w-[40px] flex-shrink-0 text-center">GW</div>
                        <div className="w-[40px] flex-shrink-0 text-center">Ord</div>
                        <div className="w-[40px] flex-shrink-0 text-center">Act</div>
                    </div>
                </div>

                {/* ─── Content (date-grouped rows) ─── */}
                <div className="flex-1 overflow-y-auto overflow-x-auto">
                    {dateGroups.map(group => (
                        <div key={group.date} className="border-b border-gray-800">
                            {/* Date group header */}
                            <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-800/50 cursor-pointer" onClick={() => toggleGroup(group.date)}>
                                {expandedGroups.has(group.date) ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                                <span className="font-medium text-white text-sm">{group.dateLabel}</span>
                                <span className="text-gray-500 text-xs ml-auto">
                                    {group.rows.length} txns <span className="mx-1">|</span>
                                    <span className="text-green-400">+{formatCurrency(group.totalCredits, dominantCurrency)}</span>
                                    <span className="mx-1">/</span>
                                    <span className="text-red-400">-{formatCurrency(group.totalDebits, dominantCurrency)}</span>
                                </span>
                            </div>

                            {/* Rows */}
                            {expandedGroups.has(group.date) && group.rows.map(tx => {
                                const bankInfo = BANK_ACCOUNTS.find(b => b.key === tx.source);
                                const gwStyle = getGatewayStyle(tx.paymentSource || tx.gateway);
                                const isDebit = tx.amount < 0;
                                const isCredit = tx.amount > 0;

                                return (
                                    <div key={tx.id}
                                        className={`flex items-center gap-1 px-4 py-2 hover:bg-gray-800/30 border-t border-gray-800/50 cursor-pointer min-w-[900px] ${selectedRow?.id === tx.id ? "bg-gray-700/50" : ""}`}
                                        onClick={() => setSelectedRow(tx)}>
                                        <div className="w-[60px] flex-shrink-0 text-[10px] text-gray-300">{formatShortDate(tx.date)}</div>
                                        {showBankColumn && (
                                            <div className="w-[90px] flex-shrink-0">
                                                <Badge variant="outline" className={`text-[8px] px-1 py-0 ${bankInfo?.textColor || "text-gray-400"} border-gray-600`}>{bankInfo?.label || tx.source}</Badge>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-[200px] text-[11px] text-white truncate" title={tx.description}>{parseChaseShortDescription(tx.description, tx.source)}</div>
                                        <div className="w-[80px] flex-shrink-0 text-right text-[10px] font-mono">
                                            {isDebit ? <span className="text-red-400">{formatCurrency(Math.abs(tx.amount), tx.currency)}</span> : <span className="text-gray-600">-</span>}
                                        </div>
                                        <div className="w-[80px] flex-shrink-0 text-right text-[10px] font-mono">
                                            {isCredit ? <span className="text-green-400">{formatCurrency(tx.amount, tx.currency)}</span> : <span className="text-gray-600">-</span>}
                                        </div>
                                        <div className="w-[80px] flex-shrink-0 text-center">
                                            {(tx.paymentSource || tx.gateway) ? (
                                                <Badge variant="outline" className={`text-[8px] px-1 py-0 ${gwStyle.bg} ${gwStyle.text} ${gwStyle.border}`}>
                                                    {(tx.paymentSource || tx.gateway || "").charAt(0).toUpperCase() + (tx.paymentSource || tx.gateway || "").slice(1)}
                                                </Badge>
                                            ) : <span className="text-gray-600 text-[9px]">-</span>}
                                        </div>
                                        <div className="w-[40px] flex-shrink-0 text-center" onClick={e => e.stopPropagation()}>
                                            {tx.isReconciled ? (
                                                tx.reconciliationType === "manual" ? <User className="h-3.5 w-3.5 text-blue-500 mx-auto" /> : <Zap className="h-3.5 w-3.5 text-green-500 mx-auto" />
                                            ) : (
                                                <Button size="sm" variant="ghost" onClick={() => openManualRecon(tx)} className="h-5 w-5 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/30" title="Manual reconcile">
                                                    <Link2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                        <div className="w-[40px] flex-shrink-0 text-center">
                                            {tx.isOrderReconciled ? (
                                                <CheckCircle className="h-3.5 w-3.5 text-blue-400 mx-auto" />
                                            ) : (
                                                <span className="text-gray-600 text-[9px]">-</span>
                                            )}
                                        </div>
                                        <div className="w-[40px] flex-shrink-0 text-center" onClick={e => e.stopPropagation()}>
                                            {tx.isReconciled && (
                                                <Button size="sm" variant="ghost" onClick={() => revertReconciliation(tx)} className="h-5 w-5 p-0 text-gray-500 hover:text-red-400 hover:bg-red-900/30" title="Revert">
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    {dateGroups.length === 0 && (
                        <div className="text-center py-20 text-gray-500">
                            <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No transactions found</p>
                            <p className="text-sm mt-1">Adjust filters or select other accounts</p>
                        </div>
                    )}
                    <div className="h-8"></div>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════ */}
            {/* DETAIL PANEL (right side) */}
            {/* ════════════════════════════════════════════════════════ */}
            {selectedRow && (
                <div className="fixed right-0 top-0 h-full w-[450px] bg-[#1e1f21] border-l border-gray-700 flex flex-col z-[100] shadow-2xl">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                        <div className="flex items-center gap-2 min-w-0">
                            {selectedRow.isReconciled ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />}
                            <span className="font-medium text-white truncate">{selectedRow.description}</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white flex-shrink-0" onClick={() => setSelectedRow(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Panel Content */}
                    <div className="flex-1 overflow-y-auto">
                        {/* Transaction Info */}
                        <div className="px-4 py-4 space-y-4 border-b border-gray-800">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="text-xs text-gray-500">Date</p>
                                        <p className="text-sm text-white">{formatShortDate(selectedRow.date)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <DollarSign className="h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="text-xs text-gray-500">Amount</p>
                                        <p className={`text-sm font-bold ${selectedRow.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                                            {formatCurrency(selectedRow.amount, selectedRow.currency)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <FileText className="h-4 w-4 text-gray-500" />
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500">Description</p>
                                    <p className="text-sm text-white break-words">{selectedRow.description}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500">Bank</p>
                                    <p className="text-sm text-gray-300">{BANK_ACCOUNTS.find(b => b.key === selectedRow.source)?.label || selectedRow.source}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Currency</p>
                                    <p className="text-sm text-gray-300">{selectedRow.currency}</p>
                                </div>
                            </div>

                            {/* Custom data fields */}
                            {selectedRow.custom_data && Object.keys(selectedRow.custom_data).length > 0 && (
                                <div className="space-y-2">
                                    {selectedRow.custom_data.details && (
                                        <div><p className="text-xs text-gray-500">Type</p><p className="text-sm text-gray-300">{selectedRow.custom_data.details}</p></div>
                                    )}
                                    {selectedRow.custom_data.type && (
                                        <div><p className="text-xs text-gray-500">Transaction Type</p><p className="text-sm text-gray-300">{selectedRow.custom_data.type}</p></div>
                                    )}
                                    {selectedRow.custom_data.balance != null && (
                                        <div><p className="text-xs text-gray-500">Balance</p><p className="text-sm text-white font-medium">{formatCurrency(selectedRow.custom_data.balance, selectedRow.currency)}</p></div>
                                    )}
                                    {selectedRow.custom_data.saldo != null && (
                                        <div><p className="text-xs text-gray-500">Balance</p><p className="text-sm text-white font-medium">{formatCurrency(selectedRow.custom_data.saldo, selectedRow.currency)}</p></div>
                                    )}
                                    {selectedRow.custom_data.check_number && (
                                        <div><p className="text-xs text-gray-500">Check/Slip #</p><p className="text-sm text-gray-300 font-mono">{selectedRow.custom_data.check_number}</p></div>
                                    )}
                                    {selectedRow.custom_data.referencia && (
                                        <div><p className="text-xs text-gray-500">Reference</p><p className="text-sm text-gray-300 font-mono">{selectedRow.custom_data.referencia}</p></div>
                                    )}
                                    {selectedRow.custom_data.clave && (
                                        <div><p className="text-xs text-gray-500">Key</p><p className="text-sm text-gray-300">{selectedRow.custom_data.clave}</p></div>
                                    )}
                                    {selectedRow.custom_data.categoria && (
                                        <div><p className="text-xs text-gray-500">Category</p><p className="text-sm text-gray-300">{selectedRow.custom_data.categoria}</p></div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── RECONCILIATION STATUS ── */}
                        <div className="px-4 py-4 space-y-4 border-b border-gray-800 bg-[#252627]">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                {selectedRow.amount >= 0
                                    ? <><Link2 className="h-4 w-4" /> Gateway Reconciliation</>
                                    : <><Building className="h-4 w-4" /> AP Reconciliation</>}
                            </h3>
                            <div>
                                <p className="text-xs text-gray-500">Status</p>
                                {selectedRow.isReconciled ? (
                                    <Badge variant="outline" className={`${selectedRow.reconciliationType?.startsWith("automatic") ? "bg-green-900/30 text-green-400 border-green-700"
                                        : selectedRow.reconciliationType === "intercompany" ? "bg-amber-900/30 text-amber-400 border-amber-700"
                                            : "bg-blue-900/30 text-blue-400 border-blue-700"
                                        }`}>
                                        Reconciled ({selectedRow.reconciliationType?.startsWith("automatic") ? "Auto" : selectedRow.reconciliationType === "intercompany" ? "Intercompany" : "Manual"})
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="bg-yellow-900/30 text-yellow-400 border-yellow-700">
                                        Not Reconciled
                                    </Badge>
                                )}
                            </div>

                            {/* Reconciliation method detail */}
                            {selectedRow.reconciliationType === "automatic-ap-bulk" && (
                                <div>
                                    <p className="text-xs text-gray-500">Method</p>
                                    <p className="text-sm text-green-300">AP Bulk Reconciliation (Excel)</p>
                                </div>
                            )}

                            {/* ── REVENUE: Payment Source / Gateway info ── */}
                            {selectedRow.amount >= 0 && selectedRow.paymentSource && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Payment Source</p>
                                    <Badge variant="outline" className={`${getGatewayStyle(selectedRow.paymentSource).bg} ${getGatewayStyle(selectedRow.paymentSource).text} ${getGatewayStyle(selectedRow.paymentSource).border}`}>
                                        {selectedRow.paymentSource}
                                    </Badge>
                                </div>
                            )}

                            {selectedRow.custom_data?.disbursement_reference && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Disbursement Reference</p>
                                    <div className="flex items-center gap-2">
                                        <Key className="h-3 w-3 text-gray-500" />
                                        <span className="text-xs font-mono text-gray-300">{selectedRow.custom_data.disbursement_reference}</span>
                                    </div>
                                </div>
                            )}

                            {/* Settlement batch & transaction count */}
                            {selectedRow.custom_data?.braintree_transaction_count > 0 && (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-500">Transactions in Disbursement</p>
                                        <p className="text-sm text-white font-medium">{selectedRow.custom_data.braintree_transaction_count} transactions</p>
                                    </div>
                                    {selectedRow.custom_data?.settlement_batch_id && (
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500">Settlement Batch</p>
                                            <p className="text-[10px] font-mono text-gray-400">{selectedRow.custom_data.settlement_batch_id}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ══ DISBURSEMENT TRANSACTIONS BREAKDOWN ══ */}
                        {selectedRow.amount >= 0 && selectedRow.isReconciled && selectedRow.paymentSource && (
                            <div className="border-b border-gray-800">
                                <button
                                    onClick={() => setDisbursementExpanded(!disbursementExpanded)}
                                    className="w-full px-4 py-3 flex items-center justify-between bg-[#1a1d23] hover:bg-[#1e2128] transition-colors"
                                >
                                    <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                                        <Database className="h-4 w-4" />
                                        Revenue Breakdown ({disbursementTxns.length} transactions)
                                    </h3>
                                    {disbursementExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                </button>

                                {disbursementExpanded && (
                                    <div className="bg-[#13151a]">
                                        {loadingDisbursementTxns ? (
                                            <div className="flex items-center justify-center py-6 gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                                                <span className="text-xs text-gray-400">Loading transactions...</span>
                                            </div>
                                        ) : disbursementTxns.length === 0 ? (
                                            <div className="py-4 px-4 text-center text-xs text-gray-500">
                                                No individual transactions found for this disbursement.
                                            </div>
                                        ) : (
                                            <div className="max-h-[400px] overflow-y-auto">
                                                {/* Summary */}
                                                <div className="px-4 py-2 border-b border-gray-800/50 flex items-center justify-between bg-[#1a1d23]">
                                                    <span className="text-[10px] text-gray-500 uppercase">Total: {disbursementTxns.length} txns</span>
                                                    <span className="text-xs font-mono text-green-400 font-medium">
                                                        {formatCurrency(disbursementTxns.reduce((s, t) => s + t.amount, 0), selectedRow.currency)}
                                                    </span>
                                                </div>

                                                {/* Transaction rows */}
                                                {disbursementTxns.map((txn, idx) => (
                                                    <div key={txn.id} className={`px-4 py-2 border-b border-gray-800/30 hover:bg-gray-800/30 ${idx % 2 === 0 ? "bg-[#13151a]" : "bg-[#161821]"}`}>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs text-white font-medium truncate" title={txn.customerName}>
                                                                    {txn.customerName || "—"}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    {txn.orderId && (
                                                                        <span className="text-[9px] font-mono text-blue-400 bg-blue-900/20 px-1 rounded">
                                                                            #{txn.orderId}
                                                                        </span>
                                                                    )}
                                                                    {txn.cardType && (
                                                                        <span className="text-[9px] text-gray-500">
                                                                            {txn.cardType}
                                                                        </span>
                                                                    )}
                                                                    {txn.paymentMethod && !txn.cardType && (
                                                                        <span className="text-[9px] text-gray-500">
                                                                            {txn.paymentMethod}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {txn.customerEmail && (
                                                                    <p className="text-[9px] text-gray-500 truncate mt-0.5">{txn.customerEmail}</p>
                                                                )}
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <p className="text-xs font-mono text-green-400 font-medium">
                                                                    {formatCurrency(txn.amount, txn.currency)}
                                                                </p>
                                                                <p className="text-[9px] text-gray-500 mt-0.5">
                                                                    {txn.date ? formatShortDate(txn.date) : "—"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── RECONCILIATION STATUS ── (continued - expenses) */}
                        <div className="px-4 py-4 space-y-4 border-b border-gray-800 bg-[#252627]">
                            {selectedRow.amount < 0 && selectedRow.custom_data?.matched_provider && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Matched Provider</p>
                                    <p className="text-sm text-white font-medium">{selectedRow.custom_data.matched_provider}</p>
                                </div>
                            )}

                            {selectedRow.amount < 0 && selectedRow.custom_data?.matched_invoice_number && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Invoice Number</p>
                                    <span className="text-sm font-mono text-blue-300">{selectedRow.custom_data.matched_invoice_number}</span>
                                </div>
                            )}

                            {selectedRow.amount < 0 && selectedRow.custom_data?.matched_invoice_numbers && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Matched Invoices</p>
                                    <span className="text-sm font-mono text-blue-300">{selectedRow.custom_data.matched_invoice_numbers}</span>
                                </div>
                            )}

                            {selectedRow.amount < 0 && selectedRow.custom_data?.matched_invoice_total != null && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Invoice Total</p>
                                    <span className="text-sm font-medium text-red-400">{formatCurrency(selectedRow.custom_data.matched_invoice_total, selectedRow.currency)}</span>
                                </div>
                            )}

                            {selectedRow.amount < 0 && selectedRow.custom_data?.matched_amount != null && !selectedRow.custom_data?.matched_invoice_total && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Matched Amount</p>
                                    <span className="text-sm font-medium text-red-400">{formatCurrency(selectedRow.custom_data.matched_amount, selectedRow.currency)}</span>
                                </div>
                            )}

                            {selectedRow.amount < 0 && selectedRow.custom_data?.matched_payment_date && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Payment Date (Excel)</p>
                                    <span className="text-sm text-gray-300">{formatShortDate(selectedRow.custom_data.matched_payment_date)}</span>
                                </div>
                            )}

                            {selectedRow.amount < 0 && selectedRow.custom_data?.ap_financial_account && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Financial Account</p>
                                    <span className="text-sm text-gray-300">{selectedRow.custom_data.ap_financial_account}</span>
                                </div>
                            )}

                            {/* ── COMMON fields ── */}
                            {selectedRow.custom_data?.reconciled_at && (
                                <div>
                                    <p className="text-xs text-gray-500">Reconciled at</p>
                                    <p className="text-sm text-gray-300">{new Date(selectedRow.custom_data.reconciled_at).toLocaleString("pt-BR")}</p>
                                </div>
                            )}

                            {selectedRow.custom_data?.manual_note && (
                                <div>
                                    <p className="text-xs text-gray-500">Note</p>
                                    <p className="text-sm text-gray-300">{selectedRow.custom_data.manual_note}</p>
                                </div>
                            )}

                            {selectedRow.custom_data?.match_type && (
                                <div>
                                    <p className="text-xs text-gray-500">Match Type</p>
                                    <p className="text-sm text-gray-300">{selectedRow.custom_data.match_type.replace(/_/g, " ")}</p>
                                </div>
                            )}

                            {/* ── INTERCOMPANY details ── */}
                            {selectedRow.reconciliationType === "intercompany" && selectedRow.custom_data?.intercompany_matched_bank && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Matched Bank</p>
                                    <p className="text-sm text-amber-300">{BANK_ACCOUNTS.find(b => b.key === selectedRow.custom_data.intercompany_matched_bank)?.label || selectedRow.custom_data.intercompany_matched_bank}</p>
                                </div>
                            )}
                            {selectedRow.reconciliationType === "intercompany" && selectedRow.custom_data?.intercompany_matched_amount != null && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Matched Amount</p>
                                    <span className="text-sm font-medium text-amber-400">{formatCurrency(selectedRow.custom_data.intercompany_matched_amount, selectedRow.currency)}</span>
                                </div>
                            )}
                        </div>

                        {/* Matched transaction details (gateway auto-match) */}
                        {selectedRow.isReconciled && selectedRow.custom_data?.bank_match_amount && (
                            <div className="px-4 py-4 space-y-3 bg-green-900/10">
                                <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider flex items-center gap-2">
                                    <Zap className="h-4 w-4" /> Matched Transaction
                                </h3>
                                <div className="space-y-2 text-sm">
                                    {selectedRow.custom_data.bank_match_date && (
                                        <div className="flex justify-between"><span className="text-gray-400">Date:</span><span className="text-white">{formatShortDate(selectedRow.custom_data.bank_match_date)}</span></div>
                                    )}
                                    <div className="flex justify-between"><span className="text-gray-400">Amount:</span><span className="text-green-400 font-medium">{formatCurrency(selectedRow.custom_data.bank_match_amount, selectedRow.currency)}</span></div>
                                    {selectedRow.custom_data.bank_match_description && (
                                        <div><span className="text-gray-400">Description:</span><p className="text-white text-xs mt-1">{selectedRow.custom_data.bank_match_description}</p></div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Order Reconciliation — only for revenue */}
                        {selectedRow.amount >= 0 && (
                            <div className="px-4 py-4 space-y-4 border-b border-gray-800 bg-[#252627]">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <FileText className="h-4 w-4" /> Order Reconciliation
                                </h3>
                                <div>
                                    <p className="text-xs text-gray-500">Status</p>
                                    {selectedRow.isOrderReconciled ? (
                                        <Badge variant="outline" className="bg-blue-900/30 text-blue-400 border-blue-700">
                                            Matched
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-gray-800/50 text-gray-500 border-gray-700">
                                            Not Matched
                                        </Badge>
                                    )}
                                </div>

                                {selectedRow.invoiceNumber && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Invoice Number</p>
                                        <span className="text-sm font-mono text-blue-300">{selectedRow.invoiceNumber}</span>
                                    </div>
                                )}

                                {selectedRow.invoiceOrderId && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Order ID</p>
                                        <span className="text-sm font-mono text-gray-300">{selectedRow.invoiceOrderId}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Panel Footer */}
                    <div className="border-t border-gray-700 px-4 py-3 flex justify-between gap-2">
                        {selectedRow.isReconciled ? (
                            <Button variant="outline" size="sm" onClick={() => revertReconciliation(selectedRow)} className="border-red-700 text-red-400 hover:bg-red-900/30">
                                <X className="h-4 w-4 mr-1" /> Revert
                            </Button>
                        ) : (
                            <Button variant="outline" size="sm" onClick={() => openManualRecon(selectedRow)} className="border-cyan-700 text-cyan-400 hover:bg-cyan-900/30">
                                <Link2 className="h-4 w-4 mr-1" /> Manual Reconcile
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setSelectedRow(null)} className="text-gray-400 hover:text-white">
                            Close
                        </Button>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════ */}
            {/* SMART RECONCILIATION DIALOG */}
            {/* ════════════════════════════════════════════════════════ */}
            {reconDialogOpen && reconTransaction && (() => {
                const isExpense = reconTransaction.amount < 0;
                const totalSuggestions = isExpense
                    ? providerNameMatches.length
                    : paymentSourceMatches.length + revenueOrderMatches.length;

                // Filtered unreconciled invoices for search
                const filteredAvailableInvoices = allAvailableInvoices.filter(inv => {
                    if (!invoiceSearchTerm) return true;
                    const q = invoiceSearchTerm.toLowerCase();
                    return (
                        (inv.provider_code || "").toLowerCase().includes(q) ||
                        (inv.invoice_number || "").toLowerCase().includes(q) ||
                        (inv.description || "").toLowerCase().includes(q) ||
                        String(inv.invoice_amount).includes(q)
                    );
                });

                return (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]">
                        <div className="bg-[#2a2b2d] rounded-lg w-[900px] max-h-[85vh] overflow-hidden flex flex-col">
                            {/* Dialog Header */}
                            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">
                                        {isExpense ? "Expense Reconciliation" : "Revenue Reconciliation"}
                                    </h3>
                                    <p className="text-sm text-gray-400">
                                        {loadingMatches ? "Searching for matches..." : `${totalSuggestions} suggestion(s) found`}
                                    </p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setReconDialogOpen(false)} className="text-gray-400 hover:text-white">
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>

                            {/* Transaction Info Bar */}
                            <div className="px-6 py-3 bg-gray-800/50 border-b border-gray-700">
                                <div className="grid grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500 text-xs">Date</span>
                                        <p className="text-white font-medium">{formatShortDate(reconTransaction.date)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 text-xs">Amount</span>
                                        <p className={`font-medium ${reconTransaction.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                                            {formatCurrency(reconTransaction.amount, reconTransaction.currency)}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 text-xs">Bank</span>
                                        <p className="text-white font-medium text-xs">{BANK_ACCOUNTS.find(b => b.key === reconTransaction.source)?.label}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 text-xs">Description</span>
                                        <p className="text-gray-300 text-xs truncate" title={reconTransaction.description}>{reconTransaction.description}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Tab Bar */}
                            <div className="px-6 py-2 border-b border-gray-700 flex gap-1">
                                <button
                                    onClick={() => setReconTab("suggestions")}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${reconTab === "suggestions" ? "bg-cyan-600/20 text-cyan-400 border border-cyan-700" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}
                                >
                                    Suggestions {totalSuggestions > 0 && <span className="ml-1 bg-cyan-600/30 px-1.5 py-0.5 rounded-full text-[10px]">{totalSuggestions}</span>}
                                </button>
                                <button
                                    onClick={() => setReconTab("all")}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${reconTab === "all" ? "bg-violet-600/20 text-violet-400 border border-violet-700" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}
                                >
                                    {isExpense ? "All Invoices" : "All Orders"} <span className="ml-1 text-[10px] text-gray-500">({allAvailableInvoices.length})</span>
                                </button>
                                <button
                                    onClick={() => setReconTab("manual")}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${reconTab === "manual" ? "bg-orange-600/20 text-orange-400 border border-orange-700" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}
                                >
                                    Manual
                                </button>
                                <button
                                    onClick={() => setReconTab("intercompany")}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${reconTab === "intercompany" ? "bg-amber-600/20 text-amber-400 border border-amber-700" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}
                                >
                                    Intercompany {intercompanyMatches.length > 0 && <span className="ml-1 bg-amber-600/30 px-1.5 py-0.5 rounded-full text-[10px]">{intercompanyMatches.length}</span>}
                                </button>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 overflow-auto px-6 py-4 space-y-4 min-h-0" style={{ maxHeight: "calc(85vh - 280px)" }}>
                                {loadingMatches && (
                                    <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span>Searching for matching transactions...</span>
                                    </div>
                                )}

                                {/* ── SUGGESTIONS TAB ── */}
                                {reconTab === "suggestions" && !loadingMatches && (
                                    <>
                                        {/* EXPENSE: All supplier invoices */}
                                        {isExpense && (
                                            <>
                                                {/* Supplier invoices — ALL unreconciled invoices for matched supplier */}
                                                {providerNameMatches.length > 0 && (
                                                    <div>
                                                        <h4 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1">
                                                            <Building className="h-3.5 w-3.5" /> Supplier Invoices ({providerNameMatches.length})
                                                        </h4>
                                                        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-3 py-1 text-[9px] text-gray-500 uppercase tracking-wider border-b border-gray-700/50 mb-1">
                                                            <span></span>
                                                            <button onClick={() => toggleSort("supplier")} className="flex items-center gap-0.5 hover:text-gray-300 text-left">Supplier {sortCol === "supplier" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                                            <button onClick={() => toggleSort("invoice")} className="flex items-center gap-0.5 hover:text-gray-300">Invoice # {sortCol === "invoice" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                                            <button onClick={() => toggleSort("date")} className="flex items-center gap-0.5 hover:text-gray-300">Date {sortCol === "date" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                                            <button onClick={() => toggleSort("amount")} className="flex items-center gap-0.5 hover:text-gray-300 justify-end">Amount {sortCol === "amount" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                                        </div>
                                                        <div className="space-y-1">
                                                            {sortInvoices(providerNameMatches).map(inv => (
                                                                <button
                                                                    key={inv.id}
                                                                    onClick={() => toggleInvoiceSelection(inv.id)}
                                                                    className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors ${selectedInvoices.has(inv.id) ? "border-cyan-500 bg-cyan-900/20" : "border-gray-700 bg-gray-800/30 hover:border-gray-500"}`}
                                                                >
                                                                    <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center">
                                                                        <div className="flex items-center">
                                                                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedInvoices.has(inv.id) ? "bg-cyan-500 border-cyan-500" : "border-gray-500"}`}>
                                                                                {selectedInvoices.has(inv.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                                                                            </div>
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <p className="text-xs text-white font-medium truncate">{inv.provider_code}</p>
                                                                            <p className="text-[10px] text-gray-500 truncate">{inv.matchReason}</p>
                                                                        </div>
                                                                        <div className="text-center">
                                                                            <span className="text-xs font-mono text-gray-300">{inv.invoice_number}</span>
                                                                        </div>
                                                                        <div className="text-center">
                                                                            <span className="text-[10px] text-gray-400">{formatShortDate(inv.schedule_date)}</span>
                                                                        </div>
                                                                        <div className="text-right flex items-center gap-1.5">
                                                                            <span className="text-sm font-medium text-red-400">{formatCurrency(inv.paid_amount ?? inv.invoice_amount, inv.currency || reconTransaction.currency)}</span>
                                                                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-900/20 text-green-400 border-green-700">{inv.matchScore}%</Badge>
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}



                                                {totalSuggestions === 0 && (
                                                    <div className="text-center py-6 text-gray-500">
                                                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                        <p className="text-sm">No matching invoices found</p>
                                                        <p className="text-xs mt-1">Check the &quot;All Invoices&quot; tab or use Manual mode</p>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* REVENUE: Payment source + Revenue order + Intercompany suggestions */}
                                        {!isExpense && (
                                            <>
                                                {/* Payment source matches */}
                                                {paymentSourceMatches.length > 0 && (
                                                    <div>
                                                        <h4 className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-1">
                                                            <CreditCard className="h-3.5 w-3.5" /> Payment Source Matches ({paymentSourceMatches.length})
                                                        </h4>
                                                        <div className="space-y-1">
                                                            {paymentSourceMatches.map(pm => (
                                                                <button
                                                                    key={pm.id}
                                                                    onClick={() => { setSelectedPaymentMatch(pm.id); setSelectedInvoices(new Set()); setSelectedRevenueOrder(null); }}
                                                                    className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors ${selectedPaymentMatch === pm.id ? "border-cyan-500 bg-cyan-900/20" : "border-gray-700 bg-gray-800/30 hover:border-gray-500"}`}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-xs text-white font-medium">{pm.sourceLabel}</p>
                                                                            <p className="text-[10px] text-gray-500">{pm.matchReason}</p>
                                                                        </div>
                                                                        <div className="text-right ml-3 flex items-center gap-2">
                                                                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-900/20 text-blue-400 border-blue-700">{pm.matchScore}%</Badge>
                                                                            <p className="text-sm font-medium text-green-400">{formatCurrency(pm.amount, reconTransaction.currency)}</p>
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Revenue order matches */}
                                                {revenueOrderMatches.length > 0 && (
                                                    <div>
                                                        <h4 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1">
                                                            <FileText className="h-3.5 w-3.5" /> Revenue Order Matches ({revenueOrderMatches.length})
                                                        </h4>
                                                        <div className="space-y-1">
                                                            {revenueOrderMatches.slice(0, 10).map(rm => (
                                                                <button
                                                                    key={rm.id}
                                                                    onClick={() => { setSelectedRevenueOrder(rm.id); setSelectedInvoices(new Set()); setSelectedPaymentMatch(null); }}
                                                                    className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors ${selectedRevenueOrder === rm.id ? "border-cyan-500 bg-cyan-900/20" : "border-gray-700 bg-gray-800/30 hover:border-gray-500"}`}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-xs font-mono text-gray-300">{rm.invoiceNumber || rm.orderId || "-"}</span>
                                                                                <Badge variant="outline" className={`text-[9px] px-1 py-0 ${rm.matchScore >= 80 ? "bg-green-900/20 text-green-400 border-green-700" : "bg-yellow-900/20 text-yellow-400 border-yellow-700"}`}>{rm.matchScore}%</Badge>
                                                                            </div>
                                                                            <p className="text-xs text-white mt-0.5 font-medium">{rm.customerName}</p>
                                                                            <p className="text-[10px] text-gray-500 truncate">{rm.matchReason}</p>
                                                                        </div>
                                                                        <div className="text-right ml-3">
                                                                            <p className="text-sm font-medium text-green-400">{formatCurrency(rm.amount, reconTransaction.currency)}</p>
                                                                            <p className="text-[10px] text-gray-500">{formatShortDate(rm.date)}</p>
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {totalSuggestions === 0 && (
                                                    <div className="text-center py-6 text-gray-500">
                                                        <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                        <p className="text-sm">No matching payment sources found</p>
                                                        <p className="text-xs mt-1">Use Manual mode to reconcile</p>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}

                                {/* ── ALL INVOICES TAB ── */}
                                {reconTab === "all" && !loadingMatches && (
                                    <div>
                                        <div className="mb-3">
                                            <Input
                                                placeholder="Search by supplier name or invoice number..."
                                                value={invoiceSearchTerm}
                                                onChange={e => setInvoiceSearchTerm(e.target.value)}
                                                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 text-sm h-8"
                                            />
                                        </div>
                                        {/* Column headers */}
                                        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-3 py-1.5 text-[9px] text-gray-500 uppercase tracking-wider border-b border-gray-700/50 mb-1">
                                            <span></span>
                                            <button onClick={() => toggleSort("supplier")} className="flex items-center gap-0.5 hover:text-gray-300 text-left">Supplier {sortCol === "supplier" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                            <button onClick={() => toggleSort("invoice")} className="flex items-center gap-0.5 hover:text-gray-300">Invoice # {sortCol === "invoice" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                            <button onClick={() => toggleSort("date")} className="flex items-center gap-0.5 hover:text-gray-300">Date {sortCol === "date" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                            <button onClick={() => toggleSort("amount")} className="flex items-center gap-0.5 hover:text-gray-300 justify-end">Amount {sortCol === "amount" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                        </div>
                                        {isExpense ? (
                                            <div className="space-y-1">
                                                {filteredAvailableInvoices.length === 0 ? (
                                                    <p className="text-center text-gray-500 text-sm py-4">No invoices found{invoiceSearchTerm ? " matching your search" : ""}</p>
                                                ) : (
                                                    sortInvoices(filteredAvailableInvoices).slice(0, 50).map(inv => (
                                                        <button
                                                            key={inv.id}
                                                            onClick={() => toggleInvoiceSelection(inv.id)}
                                                            className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${selectedInvoices.has(inv.id) ? "border-cyan-500 bg-cyan-900/20" : "border-gray-700 bg-gray-800/30 hover:border-gray-500"}`}
                                                        >
                                                            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center">
                                                                <div className="flex items-center">
                                                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedInvoices.has(inv.id) ? "bg-cyan-500 border-cyan-500" : "border-gray-500"}`}>
                                                                        {selectedInvoices.has(inv.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                                                                    </div>
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs text-white font-medium truncate">{inv.provider_code}</p>
                                                                    {inv.description && <p className="text-[10px] text-gray-500 truncate">{inv.description}</p>}
                                                                </div>
                                                                <div className="text-center">
                                                                    <span className="text-xs font-mono text-gray-300">{inv.invoice_number}</span>
                                                                </div>
                                                                <div className="text-center">
                                                                    <span className="text-[10px] text-gray-400">{formatShortDate(inv.schedule_date)}</span>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-xs font-medium text-red-400">{formatCurrency(inv.paid_amount ?? inv.invoice_amount, inv.currency || reconTransaction.currency)}</span>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))
                                                )}
                                                {filteredAvailableInvoices.length > 50 && (
                                                    <p className="text-center text-gray-500 text-[10px] py-1">Showing 50 of {filteredAvailableInvoices.length} — refine search</p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-center text-gray-500 text-sm py-4">Revenue orders are shown in the Suggestions tab</p>
                                        )}
                                    </div>
                                )}

                                {/* ── MANUAL TAB ── */}
                                {reconTab === "manual" && (
                                    <div className="space-y-4">
                                        {/* Invoice search by supplier name / invoice number */}
                                        <div>
                                            <label className="text-xs text-gray-400 block mb-1">Search Invoice by Supplier Name or Invoice Number</label>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Type supplier name or invoice number..."
                                                    value={manualSearchTerm}
                                                    onChange={e => setManualSearchTerm(e.target.value)}
                                                    onKeyDown={async e => {
                                                        if (e.key === "Enter" && manualSearchTerm.length >= 2) {
                                                            setIsSearchingManual(true);
                                                            try {
                                                                const q = manualSearchTerm.toLowerCase();
                                                                const { data } = await supabase
                                                                    .from("invoices")
                                                                    .select("*")
                                                                    .eq("is_reconciled", false)
                                                                    .eq("invoice_type", "INCURRED")
                                                                    .order("schedule_date", { ascending: false })
                                                                    .limit(500);
                                                                const results = (data || []).filter(inv =>
                                                                    (inv.provider_code || "").toLowerCase().includes(q) ||
                                                                    (inv.invoice_number || "").toLowerCase().includes(q)
                                                                ).map(inv => ({
                                                                    ...inv,
                                                                    invoice_amount: parseFloat(inv.invoice_amount) || 0,
                                                                    paid_amount: inv.paid_amount ? parseFloat(inv.paid_amount) : null,
                                                                    matchScore: 0,
                                                                    matchReason: "Manual search",
                                                                }));
                                                                setManualSearchResults(results);
                                                            } catch { /* silent */ }
                                                            setIsSearchingManual(false);
                                                        }
                                                    }}
                                                    className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 text-sm flex-1"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={isSearchingManual || manualSearchTerm.length < 2}
                                                    onClick={async () => {
                                                        setIsSearchingManual(true);
                                                        try {
                                                            const q = manualSearchTerm.toLowerCase();
                                                            const { data } = await supabase
                                                                .from("invoices")
                                                                .select("*")
                                                                .eq("is_reconciled", false)
                                                                .eq("invoice_type", "INCURRED")
                                                                .order("schedule_date", { ascending: false })
                                                                .limit(500);
                                                            const results = (data || []).filter(inv =>
                                                                (inv.provider_code || "").toLowerCase().includes(q) ||
                                                                (inv.invoice_number || "").toLowerCase().includes(q)
                                                            ).map(inv => ({
                                                                ...inv,
                                                                invoice_amount: parseFloat(inv.invoice_amount) || 0,
                                                                paid_amount: inv.paid_amount ? parseFloat(inv.paid_amount) : null,
                                                                matchScore: 0,
                                                                matchReason: "Manual search",
                                                            }));
                                                            setManualSearchResults(results);
                                                        } catch { /* silent */ }
                                                        setIsSearchingManual(false);
                                                    }}
                                                    className="border-gray-600 text-gray-300 hover:bg-gray-700 h-9"
                                                >
                                                    {isSearchingManual ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                                                </Button>
                                            </div>
                                            <p className="text-[10px] text-gray-500 mt-1">Press Enter or click search. Min 2 characters.</p>
                                        </div>

                                        {/* Manual search results */}
                                        {manualSearchResults.length > 0 && (
                                            <div>
                                                <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-3 py-1.5 text-[9px] text-gray-500 uppercase tracking-wider border-b border-gray-700/50 mb-1">
                                                    <span></span>
                                                    <button onClick={() => toggleSort("supplier")} className="flex items-center gap-0.5 hover:text-gray-300 text-left">Supplier {sortCol === "supplier" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                                    <button onClick={() => toggleSort("invoice")} className="flex items-center gap-0.5 hover:text-gray-300">Invoice # {sortCol === "invoice" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                                    <button onClick={() => toggleSort("date")} className="flex items-center gap-0.5 hover:text-gray-300">Date {sortCol === "date" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                                    <button onClick={() => toggleSort("amount")} className="flex items-center gap-0.5 hover:text-gray-300 justify-end">Amount {sortCol === "amount" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                                </div>
                                                <div className="space-y-1 max-h-[250px] overflow-auto">
                                                    {sortInvoices(manualSearchResults).slice(0, 50).map(inv => (
                                                        <button
                                                            key={inv.id}
                                                            onClick={() => toggleInvoiceSelection(inv.id)}
                                                            className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${selectedInvoices.has(inv.id) ? "border-cyan-500 bg-cyan-900/20" : "border-gray-700 bg-gray-800/30 hover:border-gray-500"}`}
                                                        >
                                                            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center">
                                                                <div className="flex items-center">
                                                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedInvoices.has(inv.id) ? "bg-cyan-500 border-cyan-500" : "border-gray-500"}`}>
                                                                        {selectedInvoices.has(inv.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                                                                    </div>
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs text-white font-medium truncate">{inv.provider_code}</p>
                                                                </div>
                                                                <div className="text-center">
                                                                    <span className="text-xs font-mono text-gray-300">{inv.invoice_number}</span>
                                                                </div>
                                                                <div className="text-center">
                                                                    <span className="text-[10px] text-gray-400">{formatShortDate(inv.schedule_date)}</span>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-xs font-medium text-red-400">{formatCurrency(inv.paid_amount ?? inv.invoice_amount, inv.currency || reconTransaction.currency)}</span>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                                {manualSearchResults.length > 50 && (
                                                    <p className="text-center text-gray-500 text-[10px] py-1">Showing 50 of {manualSearchResults.length} results</p>
                                                )}
                                            </div>
                                        )}
                                        {manualSearchResults.length === 0 && manualSearchTerm.length >= 2 && !isSearchingManual && (
                                            <p className="text-center text-gray-500 text-xs py-2">No invoices found for \"{manualSearchTerm}\"</p>
                                        )}

                                        {/* Divider */}
                                        <div className="border-t border-gray-700 pt-3">
                                            <label className="text-xs text-gray-400 block mb-1">Or reconcile without invoice:</label>
                                        </div>
                                        {/* Payment Source dropdown — ONLY for revenue, never for expenses */}
                                        {!isExpense && (
                                            <div>
                                                <label className="text-xs text-gray-400 block mb-1">Payment Source (gateway)</label>
                                                <Select value={manualPaymentSource} onValueChange={setManualPaymentSource}>
                                                    <SelectTrigger className="bg-[#1e1f21] border-gray-600 text-white">
                                                        <SelectValue placeholder="Select source..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="braintree-eur">Braintree EUR</SelectItem>
                                                        <SelectItem value="braintree-usd">Braintree USD</SelectItem>
                                                        <SelectItem value="braintree-gbp">Braintree GBP</SelectItem>
                                                        <SelectItem value="braintree-amex">Braintree Amex</SelectItem>
                                                        <SelectItem value="paypal">PayPal</SelectItem>
                                                        <SelectItem value="gocardless">GoCardless</SelectItem>
                                                        <SelectItem value="stripe">Stripe</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-xs text-gray-400 block mb-1">Note (optional)</label>
                                            <Input placeholder="Description or reference..." value={manualNote} onChange={e => setManualNote(e.target.value)} className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 text-sm" />
                                        </div>
                                    </div>
                                )}

                                {/* ── INTERCOMPANY TAB ── */}
                                {reconTab === "intercompany" && !loadingMatches && (
                                    <div>
                                        <p className="text-xs text-gray-400 mb-3">
                                            Matching transfers in other bank accounts (same day ±1, Fri→Mon). Includes cross-currency EUR↔USD matches.
                                        </p>
                                        {intercompanyMatches.length > 0 ? (
                                            <div>
                                                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-1.5 text-[9px] text-gray-500 uppercase tracking-wider border-b border-gray-700/50 mb-1">
                                                    <button onClick={() => toggleSort("bank")} className="flex items-center gap-0.5 hover:text-gray-300 text-left">Bank / Description {sortCol === "bank" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                                    <button onClick={() => toggleSort("currency")} className="flex items-center gap-0.5 hover:text-gray-300">Currency {sortCol === "currency" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                                    <button onClick={() => toggleSort("date")} className="flex items-center gap-0.5 hover:text-gray-300">Date {sortCol === "date" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                                    <button onClick={() => toggleSort("amount")} className="flex items-center gap-0.5 hover:text-gray-300 justify-end">Amount {sortCol === "amount" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                                    <button onClick={() => toggleSort("match")} className="flex items-center gap-0.5 hover:text-gray-300 justify-end">Match {sortCol === "match" && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}</button>
                                                </div>
                                                <div className="space-y-1">
                                                    {sortIntercompany(intercompanyMatches).map(ic => (
                                                        <button
                                                            key={ic.id}
                                                            onClick={() => { setSelectedIntercompanyMatch(ic.id); setSelectedInvoices(new Set()); setSelectedPaymentMatch(null); setSelectedRevenueOrder(null); }}
                                                            className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors ${selectedIntercompanyMatch === ic.id ? "border-cyan-500 bg-cyan-900/20" : "border-gray-700 bg-gray-800/30 hover:border-gray-500"}`}
                                                        >
                                                            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center">
                                                                <div className="min-w-0">
                                                                    <p className="text-xs text-white font-medium">{ic.sourceLabel}</p>
                                                                    <p className="text-[10px] text-gray-500 truncate">{ic.description}</p>
                                                                </div>
                                                                <div className="text-center">
                                                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-gray-600 text-gray-300">{ic.currency}</Badge>
                                                                </div>
                                                                <div className="text-center">
                                                                    <span className="text-[10px] text-gray-400">{formatShortDate(ic.date)}</span>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-sm font-medium text-amber-400">{formatCurrency(ic.amount, ic.currency)}</span>
                                                                </div>
                                                                <div className="text-right">
                                                                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${ic.matchScore >= 90 ? "bg-green-900/20 text-green-400 border-green-700" : ic.matchScore >= 70 ? "bg-yellow-900/20 text-yellow-400 border-yellow-700" : "bg-orange-900/20 text-orange-400 border-orange-700"}`}>{ic.matchScore}%</Badge>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 text-gray-500">
                                                <Building className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                <p className="text-sm">No intercompany transfers found</p>
                                                <p className="text-xs mt-1">No matching transfers in other bank accounts for this date range</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Note input (always visible when in suggestions/all tabs) */}
                            {reconTab !== "manual" && (selectedInvoices.size > 0 || selectedPaymentMatch || selectedRevenueOrder || selectedIntercompanyMatch) && (
                                <div className="px-6 py-2 border-t border-gray-700/50">
                                    <Input placeholder="Note (optional)..." value={manualNote} onChange={e => setManualNote(e.target.value)} className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 text-xs h-7" />
                                </div>
                            )}

                            {/* Dialog Footer */}
                            <div className="px-6 py-3 border-t border-gray-700 flex items-center justify-between">
                                <div className="text-[10px] text-gray-500">
                                    {selectedInvoices.size > 0 && (() => {
                                        const allInvLists = [...matchingInvoices, ...providerNameMatches, ...allAvailableInvoices, ...manualSearchResults];
                                        const selInvs = allInvLists.filter(inv => selectedInvoices.has(inv.id));
                                        const tot = selInvs.reduce((s, inv) => s + (inv.paid_amount ?? inv.invoice_amount ?? 0), 0);
                                        return <span className="text-cyan-400">{selectedInvoices.size} invoice(s) = {formatCurrency(tot, reconTransaction?.currency || "EUR")}</span>;
                                    })()}
                                    {selectedPaymentMatch && <span className="text-cyan-400">Payment source selected</span>}
                                    {selectedRevenueOrder && <span className="text-cyan-400">Revenue order selected</span>}
                                    {selectedIntercompanyMatch && <span className="text-amber-400">Intercompany transfer selected</span>}
                                    {selectedInvoices.size === 0 && !selectedPaymentMatch && !selectedRevenueOrder && !selectedIntercompanyMatch && reconTab !== "manual" && <span>Select a match or switch to Manual tab</span>}
                                </div>
                                <div className="flex gap-3">
                                    <Button variant="outline" onClick={() => setReconDialogOpen(false)} className="border-gray-600 text-gray-300 hover:bg-gray-700 h-8 text-xs">Cancel</Button>
                                    <Button
                                        onClick={performManualReconciliation}
                                        disabled={isSavingManual || (selectedInvoices.size === 0 && !selectedPaymentMatch && !selectedRevenueOrder && !selectedIntercompanyMatch && !manualPaymentSource && !manualNote)}
                                        className="bg-cyan-600 hover:bg-cyan-700 h-8 text-xs"
                                    >
                                        {isSavingManual ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Link2 className="h-3.5 w-3.5 mr-1" />}
                                        Reconcile
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Error banner */}
            {error && (
                <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-900/90 border border-red-700 rounded-lg px-6 py-3 text-red-200 text-sm z-50 flex items-center gap-3">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-white ml-2">✕</button>
                </div>
            )}
        </div>
    );
}
