"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
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
    AlertCircle,
    CheckCircle,
    Zap,
    X,
    FileText,
    User,
    ChevronDown,
    ChevronRight,
    Database,
    Key,
    Filter,
    Clock,
    TrendingUp,
    BarChart3,
    Package,
    Wallet,
    Eye,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

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
}

const BANK_ACCOUNTS: BankAccountConfig[] = [
    { key: "bankinter-eur", label: "Bankinter EUR", currency: "EUR", bgColor: "bg-blue-600", textColor: "text-blue-400", activeRing: "ring-blue-500" },
    { key: "bankinter-usd", label: "Bankinter USD", currency: "USD", bgColor: "bg-emerald-600", textColor: "text-emerald-400", activeRing: "ring-emerald-500" },
    { key: "sabadell", label: "Sabadell EUR", currency: "EUR", bgColor: "bg-orange-600", textColor: "text-orange-400", activeRing: "ring-orange-500" },
    { key: "chase-usd", label: "Chase 9186", currency: "USD", bgColor: "bg-purple-600", textColor: "text-purple-400", activeRing: "ring-purple-500" },
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
    // Enriched chain data (loaded on-demand)
    chainData?: ReconciliationChainData | null;
}

interface ReconciliationChainData {
    gateway_transactions: {
        transaction_id: string;
        amount: number;
        date: string;
        customer_name: string | null;
        customer_email: string | null;
        order_id: string | null;
        product_name: string | null;
        payment_method: string | null;
        source?: string;
        matched_invoice_number?: string | null;
        // Enriched fields
        subscription_id?: string | null;
        card_type?: string | null;
        country_of_issuance?: string | null;
        merchant_account_id?: string | null;
        settlement_amount?: number | null;
        settlement_currency?: string | null;
        amount_refunded?: number | null;
        company_name?: string | null;
        billing_name?: string | null;
        billing_country?: string | null;
        gc_subscription_id?: string | null;
        mandate_id?: string | null;
        descriptor_name?: string | null;
        refunded_transaction_id?: string | null;
        matched_invoice_fac?: string | null;
        matched_invoice_fac_name?: string | null;
    }[];
    invoices: {
        id: number;
        invoice_number: string;
        order_id: string;
        client_name: string;
        company_name: string | null;
        total_amount: number;
        currency: string;
        product: string | null;
        invoice_date: string | null;
    }[];
    orders: {
        invoice_number: string;
        order_number: string | null;
        customer_name: string | null;
        email: string | null;
        products: string | null;
        amount: number;
        currency: string;
        financial_account_code: string | null;
        financial_account_name: string | null;
        order_type: string | null;
        payment_method: string | null;
        billing_entity: string | null;
        country: string | null;
        date: string | null;
    }[];
    web_orders?: {
        order_reference: string;
        craft_id: string;
        customer_email: string | null;
        customer_name: string | null;
        currency: string;
        total_price: number;
        total_paid: number;
        paid_status: string | null;
        date_ordered: string | null;
        order_type: string | null;
        products: { sku: string; description: string; qty: number; price: number; subtotal: number }[];
        braintree_tx_ids: string[];
        billing_country: string | null;
        billing_organization: string | null;
        subscription_reference: string | null;
    }[];
    disbursement?: {
        id: string;
        date: string;
        amount: number;
        transaction_count: number;
    };
    summary?: {
        fac_codes: string[];
        fac_names: string[];
        has_refunds: boolean;
        total_refunded: number;
        countries: string[];
        subscription_count: number;
        customer_count: number;
        match_confidence: number | null;
        match_level: number | null;
        match_type: string | null;
        web_orders_count?: number;
    };
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

// ════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════

function detectGateway(description: string): string | null {
    const desc = description.toLowerCase();
    if (desc.includes("braintree") || desc.includes("paypal braintree")) return "braintree";
    if (desc.includes("stripe")) return "stripe";
    if (desc.includes("gocardless") || desc.includes("go cardless")) return "gocardless";
    if (desc.includes("paypal") && !desc.includes("braintree")) return "paypal";
    if (desc.includes("american express") || desc.includes("amex")) return "amex";
    if (desc.includes("adyen")) return "adyen";
    if (desc.includes("wise") || desc.includes("transferwise")) return "wise";
    if (desc.includes("gusto")) return "gusto";
    if (desc.includes("continental")) return "continental";
    if (desc.includes("intuit") || desc.includes("quickbooks") || desc.includes("qbooks")) return "quickbooks";
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
    braintree: { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    stripe: { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    gocardless: { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    paypal: { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    amex: { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    gusto: { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    quickbooks: { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    continental: { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    wise: { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    "sem-gateway": { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    "braintree (amex)": { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
};

const getGatewayStyle = (gw: string | null) => gatewayColors[gw?.toLowerCase() || ""] || { bg: "bg-gray-100 dark:bg-black/50", text: "text-gray-500 dark:text-gray-400", border: "border-gray-200 dark:border-gray-700" };

// ─── Chart stroke colors ───
const BANK_CHART_COLORS: Record<string, string> = {
    "bankinter-eur": "#3b82f6",
    "bankinter-usd": "#10b981",
    "sabadell": "#f97316",
    "chase-usd": "#a855f7",
};

const GATEWAY_CHART_COLORS: Record<string, string> = {
    braintree: "#60a5fa",
    stripe: "#818cf8",
    gocardless: "#facc15",
    paypal: "#22d3ee",
    amex: "#c084fc",
    gusto: "#f87171",
    quickbooks: "#34d399",
    continental: "#fb923c",
    wise: "#2dd4bf",
    other: "#9ca3af",
    "sem-gateway": "#6b7280",
    "braintree (amex)": "#c084fc",
};

const PNL_CHART_COLORS: Record<string, string> = {
    "101": "#34d399",
    "102": "#a78bfa",
    "103": "#38bdf8",
    "104": "#fbbf24",
    "105": "#f472b6",
    internal: "#94a3b8",
    unclassified: "#6b7280",
};

// ─── P&L Line definitions ───
const PNL_LINES: { code: string; label: string; bg: string; text: string; border: string; icon: string }[] = [
    { code: "101", label: "Growth", bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700", icon: "🚀" },
    { code: "102", label: "Delight", bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700", icon: "✨" },
    { code: "103", label: "Planning Center", bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700", icon: "📋" },
    { code: "104", label: "Lab", bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700", icon: "🔬" },
    { code: "105", label: "Other Income", bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700", icon: "💡" },
    { code: "internal", label: "Internal Transfers", bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700", icon: "🔄" },
];

const getPnlLineFromCode = (faCode: string | null): string => {
    if (!faCode) return "unclassified";
    const prefix = faCode.split(".")[0];
    return prefix || "unclassified";
};

const getPnlLineConfig = (code: string) => PNL_LINES.find(l => l.code === code);

// Product color palette for product cards inside popup
const PRODUCT_COLORS: { bg: string; text: string; border: string }[] = [
    { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
    { bg: "bg-white dark:bg-black", text: "text-gray-900 dark:text-white", border: "border-gray-200 dark:border-gray-700" },
];
const getProductStyle = (index: number) => PRODUCT_COLORS[index % PRODUCT_COLORS.length];

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

export default function BankCashFlowPage() {
    const currentYear = new Date().getFullYear();
    const defaultStartDate = `${currentYear}-01-01`;
    const defaultEndDate = `${currentYear}-12-31`;

    const [selectedBanks, setSelectedBanks] = useState<Set<string>>(new Set(["bankinter-eur"]));
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Detail panel
    const [selectedRow, setSelectedRow] = useState<BankTransaction | null>(null);
    const [chainLoading, setChainLoading] = useState(false);

    // Bank freshness metadata
    const [bankFreshness, setBankFreshness] = useState<Record<string, { lastUpload: string | null; lastRecord: string | null }>>({});

    // Filters — committed date range vs pending (to avoid re-fetch on arrow navigation)
    const [dateRange, setDateRange] = useState({ start: defaultStartDate, end: defaultEndDate });
    const [pendingDateRange, setPendingDateRange] = useState({ start: defaultStartDate, end: defaultEndDate });
    const [gatewayFilter, setGatewayFilter] = useState("all");
    const [flowFilter, setFlowFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [reconFilter, setReconFilter] = useState("all");
    const [gwReconFilter, setGwReconFilter] = useState("all");
    const [orderFilter, setOrderFilter] = useState("all");
    const [showReconciled, setShowReconciled] = useState(true);

    // Revenue view toggle: bank account vs gateway vs P&L line
    const [revenueViewMode, setRevenueViewMode] = useState<"bank" | "gateway" | "pnl">("gateway");

    // Invoice-orders data for P&L revenue breakdown
    const [invoiceOrders, setInvoiceOrders] = useState<{ description: string; amount: number; date: string; financial_account_name: string | null; financial_account_code: string | null; invoice_number: string | null }[]>([]);

    // BT reference map: transaction_id → { matched_invoice_number, matched_invoice_fac, customer_name }
    const [btTxMap, setBtTxMap] = useState<Record<string, { matched_invoice_number: string | null; matched_invoice_fac: string | null; customer_name: string | null }>>({});

    // P&L line drill-down popup
    const [selectedPnlLine, setSelectedPnlLine] = useState<string | null>(null);

    // Date groups
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const { toast } = useToast();

    // ─── Load enriched chain data when any inflow row is selected ───
    const loadChainData = useCallback(async (row: BankTransaction) => {
        if (row.chainData) return;
        // Load chain for all inflows (reconciled or not, amount >= 0)
        if (row.amount < 0) return;
        setChainLoading(true);
        try {
            const res = await fetch(`/api/reconcile/chain-details?bankRowId=${row.id}`);
            const data = await res.json();
            if (data.success) {
                setSelectedRow(prev => prev && prev.id === row.id ? { ...prev, chainData: data.chain } : prev);
            }
        } catch (err) {
            console.error('Error loading chain data:', err);
        } finally {
            setChainLoading(false);
        }
    }, []);

    // ─── Handle row selection ───
    const handleRowSelect = useCallback((tx: BankTransaction) => {
        setSelectedRow(tx);
        if (!tx.chainData && tx.amount >= 0) {
            loadChainData(tx);
        }
    }, [loadChainData]);

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
                // Gateway is ONLY for revenue (positive amounts)
                const gateway = amount > 0
                    ? (paymentSource?.toLowerCase() || detectGateway(row.description || ""))
                    : null;

                return {
                    id: row.id,
                    date: row.date || "",
                    description: row.description || "",
                    amount,
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

            // ─── Load invoice-orders for product revenue breakdown ───
            try {
                const orderRows: any[] = [];
                let oFrom = 0;
                while (true) {
                    const { data: oChunk, error: oErr } = await supabase
                        .from("csv_rows")
                        .select("description, amount, date, custom_data")
                        .in("source", ["invoice-orders", "invoice-orders-usd"])
                        .gte("date", dateRange.start)
                        .lte("date", dateRange.end)
                        .range(oFrom, oFrom + PAGE - 1);
                    if (oErr) { console.error("Error loading invoice-orders:", oErr); break; }
                    if (!oChunk || oChunk.length === 0) break;
                    orderRows.push(...oChunk);
                    if (oChunk.length < PAGE) break;
                    oFrom += PAGE;
                }
                setInvoiceOrders(orderRows.map(r => ({
                    description: r.description || "Unknown",
                    amount: parseFloat(r.amount) || 0,
                    date: r.date || "",
                    financial_account_name: r.custom_data?.financial_account_name || null,
                    financial_account_code: r.custom_data?.financial_account_code || null,
                    invoice_number: r.custom_data?.invoice_number || null,
                })));
            } catch (orderErr) {
                console.error("Error loading invoice-orders for product breakdown:", orderErr);
            }

            // ─── Load gateway reference data for P&L chain (BT + Stripe + GC) ───
            try {
                const txMap: Record<string, { matched_invoice_number: string | null; matched_invoice_fac: string | null; customer_name: string | null }> = {};
                for (const gwSource of ["braintree-api-revenue", "braintree-amex", "stripe-eur", "stripe-usd", "gocardless"]) {
                    let btFrom = 0;
                    while (true) {
                        const { data: btChunk, error: btErr } = await supabase
                            .from("csv_rows")
                            .select("custom_data")
                            .eq("source", gwSource)
                            .range(btFrom, btFrom + PAGE - 1);
                        if (btErr) { console.error(`Error loading ${gwSource}:`, btErr); break; }
                        if (!btChunk || btChunk.length === 0) break;
                        btChunk.forEach(r => {
                            // Support multiple ID fields: transaction_id (BT/Stripe), gocardless_id, payment_id (GC)
                            const txId = r.custom_data?.transaction_id || r.custom_data?.gocardless_id || r.custom_data?.payment_id;
                            if (txId) {
                                txMap[txId] = {
                                    matched_invoice_number: r.custom_data?.matched_invoice_number || null,
                                    matched_invoice_fac: r.custom_data?.matched_invoice_fac || null,
                                    customer_name: r.custom_data?.customer_name || null,
                                };
                            }
                        });
                        if (btChunk.length < PAGE) break;
                        btFrom += PAGE;
                    }
                }
                setBtTxMap(txMap);
            } catch (btErr) {
                console.error("Error loading gateway reference data:", btErr);
            }
        } catch (err) {
            console.error("Error loading data:", err);
            setError(err instanceof Error ? err.message : "Error loading data");
        } finally {
            setIsLoading(false);
        }
    }, [dateRange]);

    useEffect(() => { loadData(); }, [loadData]);

    const applyDateRange = () => {
        setDateRange({ ...pendingDateRange });
    };

    // ─── Load bank freshness data ───
    useEffect(() => {
        const SOURCE_MAP: Record<string, string> = { "sabadell": "sabadell-eur" };
        (async () => {
            try {
                const res = await fetch("/api/data-freshness");
                const data = await res.json();
                if (data.sources) {
                    const map: Record<string, { lastUpload: string | null; lastRecord: string | null }> = {};
                    for (const s of data.sources) {
                        map[s.source] = { lastUpload: s.lastSync, lastRecord: s.lastRecordDate };
                    }
                    // Map aliases
                    for (const [alias, real] of Object.entries(SOURCE_MAP)) {
                        if (map[real] && !map[alias]) map[alias] = map[real];
                    }
                    setBankFreshness(map);
                }
            } catch { /* silent */ }
        })();
    }, [bankTransactions]);

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
    }, [bankTransactions, selectedBanks, gatewayFilter, flowFilter, reconFilter, gwReconFilter, orderFilter, searchQuery, showReconciled]);

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

    // ─── Invoice number → P&L code map ───
    const invoiceToFAC = useMemo(() => {
        const map: Record<string, string> = {};
        invoiceOrders.forEach(o => {
            if (o.invoice_number && o.financial_account_code) {
                map[o.invoice_number] = o.financial_account_code;
            }
        });
        return map;
    }, [invoiceOrders]);

    // ─── Resolve P&L line for a bank inflow via chain lookup ───
    const resolvePnlLine = useCallback((tx: BankTransaction): string => {
        // Strategy 0: bank row has direct pnl_line classification
        const directPnl = tx.custom_data?.pnl_line as string | undefined;
        if (directPnl) return directPnl;

        // Strategy 1: bank row has transaction_ids (or gc_transaction_ids) → look up gateway tx → get P&L code
        const txIds = [
            ...(tx.custom_data?.transaction_ids as string[] || []),
            ...(tx.custom_data?.gc_transaction_ids as string[] || []),
        ];
        if (txIds.length > 0) {
            for (const txId of txIds) {
                const btRef = btTxMap[txId];
                if (btRef) {
                    // First try: use pre-computed FAC from reconciliation
                    if (btRef.matched_invoice_fac) {
                        return getPnlLineFromCode(btRef.matched_invoice_fac);
                    }
                    // Fallback: look up invoice_number in invoiceToFAC map
                    if (btRef.matched_invoice_number) {
                        const fac = invoiceToFAC[btRef.matched_invoice_number];
                        if (fac) return getPnlLineFromCode(fac);
                    }
                }
            }
        }
        // Strategy 2: bank row has pnl_fac (direct customer match)
        const directFac = tx.custom_data?.pnl_fac as string | undefined;
        if (directFac) return getPnlLineFromCode(directFac);

        // Strategy 3: bank row has matched_products → match against invoice-orders (legacy)
        const products = tx.custom_data?.matched_products as string[] | undefined;
        if (products && products.length > 0) {
            const matchedOrder = invoiceOrders.find(o =>
                products.some(p => o.description.toLowerCase().includes(p.toLowerCase()) || o.financial_account_name?.toLowerCase()?.includes(p.toLowerCase()))
            );
            if (matchedOrder?.financial_account_code) return getPnlLineFromCode(matchedOrder.financial_account_code);
        }
        return "unclassified";
    }, [btTxMap, invoiceToFAC, invoiceOrders]);

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

        // Gateway breakdown: ALL inflows (not just reconciled)
        const byGateway: Record<string, { amount: number; count: number }> = {};
        inflows.forEach(t => {
            const key = t.paymentSource?.toLowerCase() || t.gateway || "sem-gateway";
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

    // ─── Analytics Range controls ───
    const [analyticsRangeMode, setAnalyticsRangeMode] = useState<"days" | "months">("days");
    const [analyticsRangePreset, setAnalyticsRangePreset] = useState<string>("365d");
    const [analyticsCustomRange, setAnalyticsCustomRange] = useState<{ start: string; end: string }>({ start: "", end: "" });

    // Reset preset when mode changes
    const handleRangeModeChange = useCallback((mode: "days" | "months") => {
        setAnalyticsRangeMode(mode);
        setAnalyticsRangePreset(mode === "days" ? "365d" : "6m");
    }, []);

    // ─── Analytics filtered transactions (date-range filtered from filteredTransactions) ───
    const analyticsFilteredTx = useMemo(() => {
        const presetDaysMap: Record<string, number> = { "7d": 7, "15d": 15, "30d": 30, "60d": 60, "90d": 90, "120d": 120, "150d": 150, "180d": 180, "365d": 365 };
        const presetMonthsMap: Record<string, number> = { "1m": 30, "2m": 61, "3m": 91, "4m": 122, "5m": 152, "6m": 183, "7m": 213, "8m": 244, "9m": 274, "10m": 305, "11m": 335, "12m": 365 };
        if (analyticsRangePreset === "custom") {
            if (!analyticsCustomRange.start || !analyticsCustomRange.end) return filteredTransactions;
            return filteredTransactions.filter(tx => {
                const d = tx.date?.split("T")[0] || "";
                return d >= analyticsCustomRange.start && d <= analyticsCustomRange.end;
            });
        }
        const days = presetDaysMap[analyticsRangePreset] || presetMonthsMap[analyticsRangePreset] || 365;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        return filteredTransactions.filter(tx => (tx.date?.split("T")[0] || "") >= cutoffStr);
    }, [filteredTransactions, analyticsRangePreset, analyticsCustomRange]);

    // Whether analytics should use daily (for short ranges) or monthly aggregation
    const analyticsUseDaily = useMemo(() => {
        if (analyticsRangePreset === "custom") {
            if (analyticsCustomRange.start && analyticsCustomRange.end) {
                const diff = Math.ceil((new Date(analyticsCustomRange.end).getTime() - new Date(analyticsCustomRange.start).getTime()) / 86400000);
                return diff <= 60;
            }
            return false;
        }
        if (analyticsRangeMode === "months") return false;
        return ["7d", "15d", "30d", "60d"].includes(analyticsRangePreset);
    }, [analyticsRangePreset, analyticsRangeMode, analyticsCustomRange]);

    const analyticsRangeBadgeLabel = useMemo(() => {
        if (analyticsRangePreset === "custom") {
            return analyticsFilteredTx.length > 0 ? `${analyticsFilteredTx.length} txns` : "Custom";
        }
        if (analyticsRangePreset.endsWith("m")) {
            const n = analyticsRangePreset.replace("m", "");
            return `${n} month${Number(n) > 1 ? "s" : ""}`;
        }
        return analyticsRangePreset.replace("d", " days");
    }, [analyticsRangePreset, analyticsFilteredTx.length]);

    // ─── Aggregated data for analytics (daily or monthly based on range) ───
    const monthlyData = useMemo(() => {
        const map = new Map<string, { month: string; label: string; inflows: number; outflows: number; balance: number; runningBalance: number }>();
        const txs = analyticsFilteredTx;
        if (analyticsUseDaily) {
            // Daily aggregation
            txs.forEach(tx => {
                const key = tx.date?.split("T")[0] || "unknown";
                if (!map.has(key)) {
                    const label = new Date(key + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
                    map.set(key, { month: key, label, inflows: 0, outflows: 0, balance: 0, runningBalance: 0 });
                }
                const entry = map.get(key)!;
                if (tx.amount > 0) entry.inflows += tx.amount;
                else entry.outflows += Math.abs(tx.amount);
            });
        } else {
            // Monthly aggregation
            txs.forEach(tx => {
                const key = tx.date?.substring(0, 7) || "unknown";
                if (!map.has(key)) {
                    const [y, m] = key.split("-");
                    const d = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, 1));
                    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
                    map.set(key, { month: key, label, inflows: 0, outflows: 0, balance: 0, runningBalance: 0 });
                }
                const entry = map.get(key)!;
                if (tx.amount > 0) entry.inflows += tx.amount;
                else entry.outflows += Math.abs(tx.amount);
            });
        }
        const sorted = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
        let running = 0;
        sorted.forEach(m => {
            m.balance = m.inflows - m.outflows;
            running += m.balance;
            m.runningBalance = running;
        });
        return sorted;
    }, [analyticsFilteredTx, analyticsUseDaily]);

    // ─── Chart data: range-filtered (no longer sliced) ───
    const chartData = useMemo(() => {
        return monthlyData;
    }, [monthlyData]);

    // ─── Breakdown by BANK ACCOUNT (for chart) ───
    const monthlyByBank = useMemo(() => {
        const map = new Map<string, Record<string, number> & { month: string; label: string }>();
        analyticsFilteredTx.forEach(tx => {
            if (tx.amount <= 0) return;
            const key = analyticsUseDaily ? (tx.date?.split("T")[0] || "unknown") : (tx.date?.substring(0, 7) || "unknown");
            if (!map.has(key)) {
                const label = analyticsUseDaily
                    ? new Date(key + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
                    : (() => { const [y, m] = key.split("-"); return new Date(Date.UTC(parseInt(y), parseInt(m) - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }); })();
                map.set(key, { month: key, label } as any);
            }
            const entry = map.get(key)!;
            const bankKey = tx.source;
            entry[bankKey] = (entry[bankKey] as number || 0) + tx.amount;
        });
        return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    }, [analyticsFilteredTx, analyticsUseDaily]);

    // ─── Breakdown by GATEWAY (for chart) — ALL inflows ───
    const monthlyByGateway = useMemo(() => {
        const map = new Map<string, Record<string, number> & { month: string; label: string }>();
        analyticsFilteredTx.forEach(tx => {
            if (tx.amount <= 0) return;
            const key = analyticsUseDaily ? (tx.date?.split("T")[0] || "unknown") : (tx.date?.substring(0, 7) || "unknown");
            if (!map.has(key)) {
                const label = analyticsUseDaily
                    ? new Date(key + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
                    : (() => { const [y, m] = key.split("-"); return new Date(Date.UTC(parseInt(y), parseInt(m) - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }); })();
                map.set(key, { month: key, label } as any);
            }
            const entry = map.get(key)!;
            const gwKey = tx.paymentSource?.toLowerCase() || tx.gateway || "sem-gateway";
            entry[gwKey] = (entry[gwKey] as number || 0) + tx.amount;
        });
        return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    }, [analyticsFilteredTx, analyticsUseDaily]);

    // ─── Breakdown by P&L LINE (for chart) — ALL inflows via chain lookup (excludes internal transfers) ───
    const monthlyByPnl = useMemo(() => {
        const map = new Map<string, Record<string, number> & { month: string; label: string }>();
        analyticsFilteredTx.forEach(tx => {
            if (tx.amount <= 0) return;
            const lineCode = resolvePnlLine(tx);
            if (lineCode === "internal") return;
            const key = analyticsUseDaily ? (tx.date?.split("T")[0] || "unknown") : (tx.date?.substring(0, 7) || "unknown");
            if (!map.has(key)) {
                const label = analyticsUseDaily
                    ? new Date(key + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
                    : (() => { const [y, m] = key.split("-"); return new Date(Date.UTC(parseInt(y), parseInt(m) - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }); })();
                map.set(key, { month: key, label } as any);
            }
            const entry = map.get(key)!;
            entry[lineCode] = (entry[lineCode] as number || 0) + tx.amount;
        });
        return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    }, [analyticsFilteredTx, analyticsUseDaily, resolvePnlLine]);

    // ─── Collect active keys per breakdown for chart legend ───
    const activeBankKeys = useMemo(() => {
        const keys = new Set<string>();
        monthlyByBank.forEach(m => { Object.keys(m).forEach(k => { if (k !== "month" && k !== "label" && (m as any)[k] > 0) keys.add(k); }); });
        return [...keys];
    }, [monthlyByBank]);

    const activeGatewayKeys = useMemo(() => {
        const keys = new Set<string>();
        monthlyByGateway.forEach(m => { Object.keys(m).forEach(k => { if (k !== "month" && k !== "label" && (m as any)[k] > 0) keys.add(k); }); });
        return [...keys];
    }, [monthlyByGateway]);

    const activePnlKeys = useMemo(() => {
        const keys = new Set<string>();
        monthlyByPnl.forEach(m => { Object.keys(m).forEach(k => { if (k !== "month" && k !== "label" && (m as any)[k] > 0) keys.add(k); }); });
        return [...keys];
    }, [monthlyByPnl]);

    // ─── Analytics gateway breakdown (range-filtered, separate from summary) ───
    const analyticsByGateway = useMemo(() => {
        const map: Record<string, { amount: number; count: number }> = {};
        let totalInflow = 0;
        analyticsFilteredTx.forEach(tx => {
            if (tx.amount <= 0) return;
            totalInflow += tx.amount;
            const gwKey = tx.paymentSource?.toLowerCase() || tx.gateway || "sem-gateway";
            if (!map[gwKey]) map[gwKey] = { amount: 0, count: 0 };
            map[gwKey].amount += tx.amount;
            map[gwKey].count++;
        });
        return { byGateway: map, totalInflow };
    }, [analyticsFilteredTx]);

    // ─── Revenue breakdown by bank (from analytics filtered) ───
    const revenueByBank = useMemo(() => {
        const map: Record<string, { inflows: number; outflows: number; count: number }> = {};
        analyticsFilteredTx.forEach(tx => {
            if (!map[tx.source]) map[tx.source] = { inflows: 0, outflows: 0, count: 0 };
            map[tx.source].count++;
            if (tx.amount > 0) map[tx.source].inflows += tx.amount;
            else map[tx.source].outflows += Math.abs(tx.amount);
        });
        return map;
    }, [analyticsFilteredTx]);

    // ─── Revenue breakdown by P&L line — ALL inflows via chain lookup (internal transfers tracked separately) ───
    const pnlLineRevenue = useMemo(() => {
        const map: Record<string, { amount: number; count: number; products: Record<string, { amount: number; count: number; faCode: string | null; faName: string | null }> }> = {};
        let totalRevenue = 0;
        let internalTotal = 0;
        analyticsFilteredTx.forEach(tx => {
            if (tx.amount <= 0) return;
            const lineCode = resolvePnlLine(tx);
            // Track internal transfers separately — don't include in revenue total
            if (lineCode === "internal") {
                if (!map[lineCode]) map[lineCode] = { amount: 0, count: 0, products: {} };
                map[lineCode].amount += tx.amount;
                map[lineCode].count++;
                internalTotal += tx.amount;
                const productName = "🔄 Internal Transfer";
                if (!map[lineCode].products[productName]) map[lineCode].products[productName] = { amount: 0, count: 0, faCode: "internal", faName: "Internal Transfer" };
                map[lineCode].products[productName].amount += tx.amount;
                map[lineCode].products[productName].count++;
                return;
            }
            if (!map[lineCode]) map[lineCode] = { amount: 0, count: 0, products: {} };
            map[lineCode].amount += tx.amount;
            map[lineCode].count++;
            totalRevenue += tx.amount;
            // Try to get product name from chain
            let productName = "Unclassified";
            let faCode: string | null = null;
            let faName: string | null = null;
            const txIds = [
                ...(tx.custom_data?.transaction_ids as string[] || []),
                ...(tx.custom_data?.gc_transaction_ids as string[] || []),
            ];
            if (txIds.length > 0) {
                for (const txId of txIds) {
                    const btRef = btTxMap[txId];
                    if (btRef) {
                        // Try matched_invoice_fac (pre-computed, always available)
                        if (btRef.matched_invoice_fac) {
                            faCode = btRef.matched_invoice_fac;
                            // Try to find the FA name from invoice orders
                            if (btRef.matched_invoice_number) {
                                const matchedOrder = invoiceOrders.find(o => o.invoice_number === btRef.matched_invoice_number);
                                if (matchedOrder) {
                                    faName = matchedOrder.financial_account_name;
                                    productName = faName || matchedOrder.description;
                                } else {
                                    productName = faCode;
                                }
                            } else {
                                productName = faCode;
                            }
                            break;
                        }
                        // Fallback: look up invoice_number in loaded invoice-orders
                        if (btRef.matched_invoice_number) {
                            const matchedOrder = invoiceOrders.find(o => o.invoice_number === btRef.matched_invoice_number);
                            if (matchedOrder) {
                                productName = matchedOrder.financial_account_name || matchedOrder.description;
                                faCode = matchedOrder.financial_account_code;
                                faName = matchedOrder.financial_account_name;
                                break;
                            }
                        }
                    }
                }
            }
            // Fallback: use pnl_fac directly to resolve product name from invoiceOrders
            if (productName === "Unclassified") {
                const directFac = tx.custom_data?.pnl_fac as string | undefined;
                if (directFac) {
                    faCode = directFac;
                    const matchedOrder = invoiceOrders.find(o => o.financial_account_code === directFac);
                    if (matchedOrder?.financial_account_name) {
                        faName = matchedOrder.financial_account_name;
                        productName = faName;
                    } else {
                        const prefix = directFac.split(".")[0];
                        const pnlDef = PNL_LINES.find(l => l.code === prefix);
                        productName = pnlDef ? `${pnlDef.icon} ${pnlDef.label}` : directFac;
                    }
                }
            }
            // Fallback: use pnl_line directly
            if (productName === "Unclassified") {
                const directPnl = tx.custom_data?.pnl_line as string | undefined;
                if (directPnl && directPnl !== "unclassified") {
                    const pnlDef = PNL_LINES.find(l => l.code === directPnl);
                    productName = pnlDef ? `${pnlDef.icon} ${pnlDef.label}` : directPnl;
                    faCode = directPnl;
                }
            }
            // Final fallback: payment source label
            if (productName === "Unclassified" && tx.paymentSource) {
                productName = tx.paymentSource;
            }
            const productKey = productName;
            if (!map[lineCode].products[productKey]) {
                map[lineCode].products[productKey] = { amount: 0, count: 0, faCode, faName };
            }
            map[lineCode].products[productKey].amount += tx.amount;
            map[lineCode].products[productKey].count++;
        });
        return { byLine: map, total: totalRevenue, internalTotal };
    }, [analyticsFilteredTx, resolvePnlLine, btTxMap, invoiceOrders]);

    const toggleGroup = (date: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date); else next.add(date);
            return next;
        });
    };

    // ─── Run reconciliation ───
    const [isReconciling, setIsReconciling] = useState(false);
    const runDeepReconciliation = async () => {
        setIsReconciling(true);
        try {
            const res = await fetch("/api/reconcile/run-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dryRun: false }),
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: "Reconciliação concluída", description: `${data.summary.totalMatched} transações reconciliadas (${formatCurrency(data.summary.totalValue, dominantCurrency)})` });
                loadData(); // Reload
            } else {
                toast({ title: "Erro", description: data.error, variant: "destructive" });
            }
        } catch (err: any) {
            toast({ title: "Erro", description: err.message, variant: "destructive" });
        } finally {
            setIsReconciling(false);
        }
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

    // ─── Cash Position controls ───
    const [highlightDate, setHighlightDate] = useState<string>("");
    const [cashRangePreset, setCashRangePreset] = useState<"7d" | "30d" | "90d" | "180d" | "365d" | "custom">("30d");
    const [cashCustomRange, setCashCustomRange] = useState<{ start: string; end: string }>({ start: "", end: "" });

    // ─── Cash Position Data (dynamic range, per bank, with carry-forward) ───
    const cashPositionData = useMemo(() => {
        const presetDaysMap: Record<"7d" | "30d" | "90d" | "180d" | "365d", number> = {
            "7d": 7,
            "30d": 30,
            "90d": 90,
            "180d": 180,
            "365d": 365,
        };

        // Build days array based on selected range
        const days: string[] = [];
        if (cashRangePreset === "custom") {
            if (!cashCustomRange.start || !cashCustomRange.end || cashCustomRange.start > cashCustomRange.end) {
                return [];
            }
            const start = new Date(cashCustomRange.start + "T00:00:00");
            const end = new Date(cashCustomRange.end + "T00:00:00");
            const cursor = new Date(start);
            let guard = 0;
            while (cursor <= end && guard < 730) {
                days.push(cursor.toISOString().slice(0, 10));
                cursor.setDate(cursor.getDate() + 1);
                guard++;
            }
        } else {
            const today = new Date();
            const totalDays = presetDaysMap[cashRangePreset];
            for (let i = totalDays - 1; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                days.push(d.toISOString().slice(0, 10));
            }
        }

        if (days.length === 0) {
            return [];
        }

        // Group transactions by (source, date) — pick last balance per day per bank
        const balanceBySourceDate: Record<string, Record<string, number>> = {};
        const activeSources = BANK_ACCOUNTS.map(b => b.key);

        for (const source of activeSources) {
            balanceBySourceDate[source] = {};
        }

        // Sort all bank transactions by date ascending, then iterate
        const sorted = [...bankTransactions]
            .filter(tx => activeSources.includes(tx.source))
            .sort((a, b) => a.date.localeCompare(b.date));

        for (const tx of sorted) {
            const day = tx.date.split("T")[0];
            const bal = tx.custom_data?.saldo ?? tx.custom_data?.balance;
            if (bal != null) {
                const parsed = typeof bal === "number" ? bal : parseFloat(String(bal));
                if (!isNaN(parsed)) {
                    balanceBySourceDate[tx.source][day] = parsed;
                }
            }
        }

        // Build daily position with carry-forward
        const lastKnown: Record<string, number> = {};
        // Seed: find the latest balance BEFORE our 30-day window for each source
        for (const source of activeSources) {
            const allDates = Object.keys(balanceBySourceDate[source]).sort();
            const firstDay = days[0];
            const before = allDates.filter(d => d < firstDay);
            if (before.length > 0) {
                lastKnown[source] = balanceBySourceDate[source][before[before.length - 1]];
            }
        }

        const result = days.map(day => {
            const row: Record<string, any> = {
                date: day,
                label: new Date(day + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
            };
            let total = 0;
            for (const bank of BANK_ACCOUNTS) {
                const dayBal = balanceBySourceDate[bank.key]?.[day];
                if (dayBal != null) {
                    lastKnown[bank.key] = dayBal;
                }
                const val = lastKnown[bank.key] ?? 0;
                row[bank.key] = val;
                total += val;
            }
            row.total = total;
            return row;
        });

        return result;
    }, [bankTransactions, cashRangePreset, cashCustomRange]);

    // ─── Actual balance: most recent bank balance across all sources ───
    const actualBalance = useMemo(() => {
        let latestDate = "";
        const lastKnown: Record<string, number> = {};
        const lastKnownDate: Record<string, string> = {};
        const sorted = [...bankTransactions]
            .filter(tx => BANK_ACCOUNTS.some(b => b.key === tx.source))
            .sort((a, b) => a.date.localeCompare(b.date));
        for (const tx of sorted) {
            const bal = tx.custom_data?.saldo ?? tx.custom_data?.balance;
            if (bal != null) {
                const parsed = typeof bal === "number" ? bal : parseFloat(String(bal));
                if (!isNaN(parsed)) {
                    lastKnown[tx.source] = parsed;
                    const day = tx.date.split("T")[0];
                    lastKnownDate[tx.source] = day;
                    if (day > latestDate) latestDate = day;
                }
            }
        }
        const total = Object.values(lastKnown).reduce((s, v) => s + v, 0);
        const perBank = BANK_ACCOUNTS.map(b => ({
            key: b.key,
            label: b.label,
            currency: b.currency,
            balance: lastKnown[b.key] ?? 0,
            date: lastKnownDate[b.key] || "",
        })).filter(b => b.date !== "");
        return { total, date: latestDate, perBank };
    }, [bankTransactions]);

    // ─── Cash position for highlighted date ───
    const highlightedPosition = useMemo(() => {
        if (!highlightDate) return null;
        return cashPositionData.find(d => d.date === highlightDate) || null;
    }, [highlightDate, cashPositionData]);

    // ─── Day flows for highlighted date (inflows/outflows/intercompany) ───
    const highlightedDayFlows = useMemo(() => {
        if (!highlightDate) return { inflows: 0, outflows: 0, intercompanyCount: 0, intercompanyTotal: 0 };
        const dayTxs = bankTransactions.filter(tx => tx.date?.startsWith(highlightDate));
        let inflows = 0, outflows = 0, intercompanyCount = 0, intercompanyTotal = 0;
        for (const tx of dayTxs) {
            if (tx.amount > 0) inflows += tx.amount;
            else outflows += Math.abs(tx.amount);
            const isIntercompany = tx.custom_data?.is_intercompany === true ||
                tx.custom_data?.gw_reconciliation_type === "intercompany" ||
                (tx.description && /transfer|intercompany|traspaso/i.test(tx.description));
            if (isIntercompany) {
                intercompanyCount++;
                intercompanyTotal += Math.abs(tx.amount);
            }
        }
        return { inflows, outflows, intercompanyCount, intercompanyTotal };
    }, [highlightDate, bankTransactions]);

    const cashRangeBadgeLabel = useMemo(() => {
        if (cashRangePreset === "custom") {
            return cashPositionData.length > 0 ? `${cashPositionData.length} days` : "Custom";
        }
        return `${cashRangePreset.replace("d", "")} days`;
    }, [cashRangePreset, cashPositionData.length]);

    useEffect(() => {
        if (highlightDate && !cashPositionData.some(d => d.date === highlightDate)) {
            setHighlightDate("");
        }
    }, [cashPositionData, highlightDate]);

    // ════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-white dark:bg-black">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-900 dark:text-white" />
            </div>
        );
    }

    const showBankColumn = selectedBanks.size > 1;

    return (
        <div className="h-full flex flex-col bg-white dark:bg-black text-gray-900 dark:text-white overflow-hidden">
            {/* Main content area shifts when panel is open */}
            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${selectedRow ? "mr-[450px]" : ""}`}>

                {/* ─── Header ─── */}
                <PageHeader
                    title="Cashflow Summary"
                    subtitle={`${summary.transactionCount} transactions • ${[...selectedBanks].map(b => BANK_ACCOUNTS.find(a => a.key === b)?.label).join(", ")}`}
                >
                    <div className="text-right">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Actual Balance</p>
                        <p className={`text-2xl font-bold ${actualBalance.total >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {formatCurrency(actualBalance.total, dominantCurrency)}
                        </p>
                        {actualBalance.date && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                Most Recent Data: {new Date(actualBalance.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}
                            </p>
                        )}
                    </div>
                </PageHeader>

                {/* Scrolling bank balances marquee */}
                <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black overflow-hidden relative h-8">
                    <div className="flex items-center gap-8 animate-marquee whitespace-nowrap absolute top-1/2 -translate-y-1/2">
                        {[...actualBalance.perBank, ...actualBalance.perBank].map((bank, i) => (
                            <span key={`${bank.key}-${i}`} className="inline-flex items-center gap-2 text-sm">
                                <span className="text-gray-500 dark:text-gray-400 font-medium">{bank.label}</span>
                                <span className={`font-semibold ${bank.balance >= 0 ? "text-green-500" : "text-red-400"}`}>
                                    {formatCurrency(bank.balance, bank.currency)}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                    ({new Date(bank.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })})
                                </span>
                                <span className="text-gray-300 dark:text-gray-600 mx-1">•</span>
                            </span>
                        ))}
                    </div>
                </div>

                {/* ─── Bank Account Tabs ─── */}
                <div className="flex-shrink-0 px-6 py-3 bg-white dark:bg-black">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Accounts:</span>
                        {BANK_ACCOUNTS.map(bank => {
                            const isActive = selectedBanks.has(bank.key);
                            const stats = summary.byBank[bank.key];
                            const fresh = bankFreshness[bank.key];
                            return (
                                <button key={bank.key} onClick={() => toggleBank(bank.key)} onDoubleClick={() => selectSingleBank(bank.key)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm ${isActive ? bank.bgColor + " text-gray-900 dark:text-white border-transparent" : "bg-transparent border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-500"} ${!stats?.count ? "opacity-40" : ""}`}
                                    title="Double-click to select only this one">
                                    <div className="flex flex-col items-start">
                                        <div className="flex items-center gap-2">
                                            <Building className="h-3.5 w-3.5" />
                                            <span className="font-medium">{bank.label}</span>
                                            {stats?.count ? <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-gray-100 dark:bg-[#0a0a0a]"}`}>{stats.count}</span> : null}
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
                            );
                        })}
                        <button onClick={() => setSelectedBanks(new Set(BANK_ACCOUNTS.map(b => b.key)))} className="text-xs text-gray-500 hover:text-gray-900 dark:text-white ml-auto">
                            All
                        </button>
                    </div>
                </div>

                {/* ═══ ACCORDION SECTIONS ═══ */}
                <Accordion type="multiple" defaultValue={[]} className="flex-1 flex flex-col overflow-hidden">

                    {/* ─── Section 1: Cash Position ─── */}
                    <AccordionItem value="cash-position" className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
                        <AccordionTrigger className="px-6 py-3 hover:no-underline hover:bg-gray-50 dark:hover:bg-[#0a0a0a]">
                            <div className="flex items-center gap-2">
                                <Wallet className="h-4 w-4 text-emerald-500" />
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">Cash Position</span>
                                <Badge variant="outline" className="text-[10px] ml-2 bg-transparent border-gray-300 dark:border-gray-600 text-gray-500">{cashRangeBadgeLabel}</Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="px-6 py-4 space-y-5 bg-white dark:bg-black">

                                {/* Range selector */}
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <Filter className="h-4 w-4 text-gray-500" />
                                        <span className="text-xs text-gray-500 uppercase tracking-wider">Range:</span>
                                        <Select value={cashRangePreset} onValueChange={(value: "7d" | "30d" | "90d" | "180d" | "365d" | "custom") => setCashRangePreset(value)}>
                                            <SelectTrigger className="w-40 h-8 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs">
                                                <SelectValue placeholder="Select range" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="7d">Last 7 days</SelectItem>
                                                <SelectItem value="30d">Last 30 days</SelectItem>
                                                <SelectItem value="90d">Last 90 days</SelectItem>
                                                <SelectItem value="180d">Last 180 days</SelectItem>
                                                <SelectItem value="365d">Last 365 days</SelectItem>
                                                <SelectItem value="custom">Custom range</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {cashRangePreset === "custom" && (
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="date"
                                                value={cashCustomRange.start}
                                                onChange={e => setCashCustomRange(prev => ({ ...prev, start: e.target.value }))}
                                                className="w-40 h-8 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs"
                                            />
                                            <span className="text-gray-600 text-xs">to</span>
                                            <Input
                                                type="date"
                                                value={cashCustomRange.end}
                                                onChange={e => setCashCustomRange(prev => ({ ...prev, end: e.target.value }))}
                                                className="w-40 h-8 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs"
                                            />
                                        </div>
                                    )}

                                    {highlightDate && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                                                Selected: {new Date(highlightDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                                            </span>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-gray-900 dark:hover:text-white" onClick={() => setHighlightDate("")}>
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Highlighted date summary card — balances + day flows side by side */}
                                {highlightedPosition && (
                                    <div className="flex flex-wrap items-stretch gap-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg px-4 py-3">
                                        {/* Left: Balance by account */}
                                        <div className="text-center min-w-[120px]">
                                            <p className="text-[10px] text-yellow-600 dark:text-yellow-400 uppercase font-medium">
                                                {new Date(highlightDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                                            </p>
                                            <p className={`text-lg font-bold ${highlightedPosition.total >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                                {formatCurrency(highlightedPosition.total, "EUR")}
                                            </p>
                                            <p className="text-[9px] text-gray-500">Total balance</p>
                                        </div>
                                        <div className="border-l border-yellow-200 dark:border-yellow-700 pl-3 space-y-0.5">
                                            {BANK_ACCOUNTS.map(bank => (
                                                <div key={bank.key} className="flex items-center justify-between gap-4 text-[10px]">
                                                    <span className={bank.textColor}>{bank.label}</span>
                                                    <span className="text-gray-900 dark:text-white font-medium">
                                                        {formatCurrency(highlightedPosition[bank.key] || 0, bank.currency)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Right: Day flows (inflows/outflows/intercompany) */}
                                        <div className="border-l border-yellow-200 dark:border-yellow-700 pl-3 space-y-0.5">
                                            <div className="flex items-center justify-between gap-4 text-[10px]">
                                                <span className="text-gray-500">Inflows</span>
                                                <span className="text-green-600 dark:text-green-400 font-bold">
                                                    {formatCurrency(highlightedDayFlows.inflows, dominantCurrency)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-4 text-[10px]">
                                                <span className="text-gray-500">Outflows</span>
                                                <span className="text-red-500 font-bold">
                                                    {formatCurrency(highlightedDayFlows.outflows, dominantCurrency)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-4 text-[10px]">
                                                <span className="text-gray-500">Intercompany</span>
                                                <span className="text-gray-900 dark:text-white font-medium">
                                                    {highlightedDayFlows.intercompanyCount} txns ({formatCurrency(highlightedDayFlows.intercompanyTotal, dominantCurrency)})
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-4 text-[10px] border-t border-yellow-200 dark:border-yellow-700 pt-0.5">
                                                <span className="text-gray-500">Net flow</span>
                                                <span className={`font-bold ${highlightedDayFlows.inflows - highlightedDayFlows.outflows >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                                                    {formatCurrency(highlightedDayFlows.inflows - highlightedDayFlows.outflows, dominantCurrency)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Area chart — cash position evolution (click to highlight) */}
                                {cashPositionData.length > 0 && (
                                    <div className="h-[220px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart
                                                data={cashPositionData}
                                                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                                                onClick={(e: any) => { if (e?.activePayload?.[0]?.payload?.date) setHighlightDate(e.activePayload[0].payload.date); }}
                                                style={{ cursor: "pointer" }}
                                            >
                                                <defs>
                                                    <linearGradient id="cpGradTotal" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="cpGradBkEur" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="cpGradBkUsd" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="cpGradSab" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="cpGradChase" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                                <XAxis dataKey="label" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#4B5563" }} />
                                                <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#4B5563" }} tickFormatter={(v: number) => formatCompactCurrency(v, "EUR")} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: "var(--content-bg, #ffffff)", border: "1px solid var(--input-border, #e5e7eb)", borderRadius: "8px", fontSize: 12 }}
                                                    labelStyle={{ color: "var(--header-text, #6b7280)" }}
                                                    formatter={(value: number, name: string) => {
                                                        const bank = BANK_ACCOUNTS.find(b => b.key === name);
                                                        return [formatCurrency(value, bank?.currency || "EUR"), bank?.label || name];
                                                    }}
                                                />
                                                <Legend wrapperStyle={{ fontSize: 11, color: "var(--header-text, #6b7280)" }} />
                                                <Area type="monotone" dataKey="total" name="Total" stroke="#10b981" strokeWidth={2.5} fill="url(#cpGradTotal)" dot={false} />
                                                <Area type="monotone" dataKey="bankinter-eur" name="Bankinter EUR" stroke="#3b82f6" strokeWidth={1.5} fill="url(#cpGradBkEur)" dot={false} strokeDasharray="4 2" />
                                                <Area type="monotone" dataKey="bankinter-usd" name="Bankinter USD" stroke="#10b981" strokeWidth={1.5} fill="url(#cpGradBkUsd)" dot={false} strokeDasharray="4 2" />
                                                <Area type="monotone" dataKey="sabadell" name="Sabadell EUR" stroke="#f97316" strokeWidth={1.5} fill="url(#cpGradSab)" dot={false} strokeDasharray="4 2" />
                                                <Area type="monotone" dataKey="chase-usd" name="Chase USD" stroke="#a855f7" strokeWidth={1.5} fill="url(#cpGradChase)" dot={false} strokeDasharray="4 2" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                {/* Daily position table */}
                                <div className="overflow-x-auto max-h-[400px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0 bg-gray-50 dark:bg-[#0a0a0a] z-10">
                                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Date</th>
                                                {BANK_ACCOUNTS.map(bank => (
                                                    <th key={bank.key} className={`px-3 py-2 text-right text-[10px] font-medium uppercase ${bank.textColor}`}>{bank.label}</th>
                                                ))}
                                                <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cashPositionData.map((row, idx) => {
                                                const isHighlighted = highlightDate && row.date === highlightDate;
                                                const isToday = row.date === new Date().toISOString().slice(0, 10);
                                                return (
                                                    <tr
                                                        key={row.date}
                                                        className={`border-b border-gray-100 dark:border-gray-800 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-[#111111] ${isHighlighted ? "bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-300 dark:ring-yellow-700" : isToday ? "bg-blue-50/50 dark:bg-blue-900/10" : idx % 2 === 0 ? "bg-white dark:bg-black" : "bg-gray-50/50 dark:bg-[#050505]"}`}
                                                        onClick={() => setHighlightDate(row.date)}
                                                    >
                                                        <td className={`px-3 py-1.5 font-medium whitespace-nowrap ${isHighlighted ? "text-yellow-700 dark:text-yellow-300" : isToday ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}>
                                                            {row.label}
                                                            {isToday && <span className="ml-1 text-[8px] text-blue-500">(today)</span>}
                                                        </td>
                                                        {BANK_ACCOUNTS.map(bank => {
                                                            const val = row[bank.key] || 0;
                                                            return (
                                                                <td key={bank.key} className={`px-3 py-1.5 text-right font-mono ${val === 0 ? "text-gray-400" : val > 0 ? "text-gray-900 dark:text-white" : "text-red-400"}`}>
                                                                    {val === 0 ? "—" : formatCurrency(val, bank.currency)}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className={`px-3 py-1.5 text-right font-bold font-mono ${row.total >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                                                            {formatCurrency(row.total, "EUR")}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {cashPositionData.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
                                        <p className="text-sm">No bank balance data available for this range</p>
                                        <p className="text-xs mt-1">Upload statements with SALDO/BALANCE columns</p>
                                    </div>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* ─── Section 2: Inflow Analytics ─── */}
                    <AccordionItem value="charts" className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
                        <AccordionTrigger className="px-6 py-3 hover:no-underline hover:bg-gray-50 dark:hover:bg-[#0a0a0a]">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-blue-500" />
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">Inflow Analytics</span>
                                <Badge variant="outline" className="text-[10px] ml-2 bg-transparent border-gray-300 dark:border-gray-600 text-gray-500">{analyticsRangeBadgeLabel}</Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>

                            {/* ─── Analytics Range Selector ─── */}
                            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-3 bg-white dark:bg-black">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <Filter className="h-4 w-4 text-gray-500" />
                                        <span className="text-xs text-gray-500 uppercase tracking-wider">Range:</span>
                                        {/* Days / Months toggle */}
                                        <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
                                            <button onClick={() => handleRangeModeChange("days")} className={`px-2.5 py-1 text-xs font-medium transition-colors ${analyticsRangeMode === "days" ? "bg-blue-600 text-white" : "bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>Days</button>
                                            <button onClick={() => handleRangeModeChange("months")} className={`px-2.5 py-1 text-xs font-medium transition-colors ${analyticsRangeMode === "months" ? "bg-blue-600 text-white" : "bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>Months</button>
                                        </div>
                                        <Select value={analyticsRangePreset} onValueChange={(value: string) => setAnalyticsRangePreset(value)}>
                                            <SelectTrigger className="w-44 h-8 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs">
                                                <SelectValue placeholder="Select range" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {analyticsRangeMode === "days" ? (
                                                    <>
                                                        <SelectItem value="7d">Last 7 days</SelectItem>
                                                        <SelectItem value="15d">Last 15 days</SelectItem>
                                                        <SelectItem value="30d">Last 30 days</SelectItem>
                                                        <SelectItem value="60d">Last 60 days</SelectItem>
                                                        <SelectItem value="90d">Last 90 days</SelectItem>
                                                        <SelectItem value="120d">Last 120 days</SelectItem>
                                                        <SelectItem value="150d">Last 150 days</SelectItem>
                                                        <SelectItem value="180d">Last 180 days</SelectItem>
                                                        <SelectItem value="365d">Last 365 days</SelectItem>
                                                    </>
                                                ) : (
                                                    <>
                                                        <SelectItem value="1m">1 month</SelectItem>
                                                        <SelectItem value="2m">2 months</SelectItem>
                                                        <SelectItem value="3m">3 months</SelectItem>
                                                        <SelectItem value="4m">4 months</SelectItem>
                                                        <SelectItem value="5m">5 months</SelectItem>
                                                        <SelectItem value="6m">6 months</SelectItem>
                                                        <SelectItem value="7m">7 months</SelectItem>
                                                        <SelectItem value="8m">8 months</SelectItem>
                                                        <SelectItem value="9m">9 months</SelectItem>
                                                        <SelectItem value="10m">10 months</SelectItem>
                                                        <SelectItem value="11m">11 months</SelectItem>
                                                        <SelectItem value="12m">12 months</SelectItem>
                                                    </>
                                                )}
                                                <SelectItem value="custom">Custom range</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Badge variant="outline" className="text-[10px] bg-transparent border-gray-300 dark:border-gray-600 text-gray-500">{analyticsRangeBadgeLabel}</Badge>
                                    </div>

                                    {analyticsRangePreset === "custom" && (
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="date"
                                                value={analyticsCustomRange.start}
                                                onChange={e => setAnalyticsCustomRange(prev => ({ ...prev, start: e.target.value }))}
                                                className="w-40 h-8 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs"
                                            />
                                            <span className="text-gray-600 text-xs">to</span>
                                            <Input
                                                type="date"
                                                value={analyticsCustomRange.end}
                                                onChange={e => setAnalyticsCustomRange(prev => ({ ...prev, end: e.target.value }))}
                                                className="w-40 h-8 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ─── Overview + Chart ─── */}
                            {chartData.length > 0 && (
                                <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-white dark:bg-black">
                                    {/* Period cards */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <TrendingUp className="h-4 w-4 text-gray-500" />
                                        <span className="text-xs text-gray-500 uppercase tracking-wider">{analyticsUseDaily ? "Daily" : "Monthly"} Overview ({chartData.length} {analyticsUseDaily ? "days" : "months"})</span>
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                                        {chartData.map(m => (
                                            <div key={m.month} className="flex-shrink-0 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 min-w-[130px]">
                                                <p className="text-[10px] text-gray-500 uppercase font-medium mb-1">{m.label}</p>
                                                <div className="space-y-0.5">
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="text-gray-500">In</span>
                                                        <span className="text-green-400 font-medium">{formatCompactCurrency(m.inflows, dominantCurrency)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="text-gray-500">Out</span>
                                                        <span className="text-red-400 font-medium">{formatCompactCurrency(m.outflows, dominantCurrency)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] border-t border-gray-200 dark:border-gray-700 pt-0.5">
                                                        <span className="text-gray-500">Net</span>
                                                        <span className={`font-bold ${m.balance >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCompactCurrency(m.balance, dominantCurrency)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="text-gray-500">Bal</span>
                                                        <span className={`font-medium ${m.runningBalance >= 0 ? "text-blue-400" : "text-orange-400"}`}>{formatCompactCurrency(m.runningBalance, dominantCurrency)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* ─── View Mode Toggle (controls chart + breakdown) ─── */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            {revenueViewMode === "bank" ? <Building className="h-4 w-4 text-gray-500" /> : revenueViewMode === "gateway" ? <CreditCard className="h-4 w-4 text-gray-500" /> : <BarChart3 className="h-4 w-4 text-gray-500" />}
                                            <span className="text-xs text-gray-500 uppercase tracking-wider">
                                                {revenueViewMode === "bank" ? "Inflows by Bank Account" : revenueViewMode === "gateway" ? "Inflows by Payment Gateway" : "Inflows by P&L Line"}
                                            </span>
                                        </div>
                                        <div className="flex items-center bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
                                            <button
                                                onClick={() => setRevenueViewMode("bank")}
                                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-medium transition-all ${revenueViewMode === "bank" ? "bg-[#117ACA] text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}
                                            >
                                                <Building className="h-3 w-3" />Bank Account
                                            </button>
                                            <button
                                                onClick={() => setRevenueViewMode("gateway")}
                                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-medium transition-all ${revenueViewMode === "gateway" ? "bg-[#117ACA] text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}
                                            >
                                                <CreditCard className="h-3 w-3" />Gateway
                                            </button>
                                            <button
                                                onClick={() => setRevenueViewMode("pnl")}
                                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-medium transition-all ${revenueViewMode === "pnl" ? "bg-[#117ACA] text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}
                                            >
                                                <BarChart3 className="h-3 w-3" />P&L Line
                                            </button>
                                        </div>
                                    </div>

                                    {/* Line chart — dynamic based on revenueViewMode */}
                                    <div className="h-[200px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            {revenueViewMode === "bank" ? (
                                                <LineChart data={monthlyByBank.length > 0 ? monthlyByBank : chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                                    <XAxis dataKey="label" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#4B5563" }} />
                                                    <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#4B5563" }} tickFormatter={(v: number) => formatCompactCurrency(v, dominantCurrency)} />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: "var(--content-bg, #ffffff)", border: "1px solid var(--input-border, #e5e7eb)", borderRadius: "8px", fontSize: 12 }}
                                                        labelStyle={{ color: "var(--header-text, #6b7280)" }}
                                                        formatter={(value: number, name: string) => [formatCurrency(value, dominantCurrency), name]}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: 11, color: "var(--header-text, #6b7280)" }} />
                                                    {activeBankKeys.map(bankKey => (
                                                        <Line key={bankKey} type="monotone" dataKey={bankKey} name={BANK_ACCOUNTS.find(b => b.key === bankKey)?.label || bankKey} stroke={BANK_CHART_COLORS[bankKey] || "#9ca3af"} strokeWidth={2} dot={{ fill: BANK_CHART_COLORS[bankKey] || "#9ca3af", r: 3 }} connectNulls />
                                                    ))}
                                                </LineChart>
                                            ) : revenueViewMode === "gateway" ? (
                                                <LineChart data={monthlyByGateway.length > 0 ? monthlyByGateway : chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                                    <XAxis dataKey="label" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#4B5563" }} />
                                                    <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#4B5563" }} tickFormatter={(v: number) => formatCompactCurrency(v, dominantCurrency)} />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: "var(--content-bg, #ffffff)", border: "1px solid var(--input-border, #e5e7eb)", borderRadius: "8px", fontSize: 12 }}
                                                        labelStyle={{ color: "var(--header-text, #6b7280)" }}
                                                        formatter={(value: number, name: string) => [formatCurrency(value, dominantCurrency), name]}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: 11, color: "var(--header-text, #6b7280)" }} />
                                                    {activeGatewayKeys.map(gwKey => (
                                                        <Line key={gwKey} type="monotone" dataKey={gwKey} name={gwKey === "sem-gateway" ? "Sem Gateway" : (gwKey.charAt(0).toUpperCase() + gwKey.slice(1))} stroke={GATEWAY_CHART_COLORS[gwKey] || "#9ca3af"} strokeWidth={2} dot={{ fill: GATEWAY_CHART_COLORS[gwKey] || "#9ca3af", r: 3 }} connectNulls />
                                                    ))}
                                                </LineChart>
                                            ) : activePnlKeys.length > 0 ? (
                                                <LineChart data={monthlyByPnl} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                                    <XAxis dataKey="label" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#4B5563" }} />
                                                    <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#4B5563" }} tickFormatter={(v: number) => formatCompactCurrency(v, dominantCurrency)} />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: "var(--content-bg, #ffffff)", border: "1px solid var(--input-border, #e5e7eb)", borderRadius: "8px", fontSize: 12 }}
                                                        labelStyle={{ color: "var(--header-text, #6b7280)" }}
                                                        formatter={(value: number, name: string) => [formatCurrency(value, dominantCurrency), name]}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: 11, color: "var(--header-text, #6b7280)" }} />
                                                    {activePnlKeys.map(pnlKey => {
                                                        const pnlConfig = PNL_LINES.find(l => l.code === pnlKey);
                                                        const label = pnlConfig ? `${pnlConfig.icon} ${pnlConfig.label}` : (pnlKey === "unclassified" ? "❓ Unclassified" : pnlKey);
                                                        return <Line key={pnlKey} type="monotone" dataKey={pnlKey} name={label} stroke={PNL_CHART_COLORS[pnlKey] || "#9ca3af"} strokeWidth={2} dot={{ fill: PNL_CHART_COLORS[pnlKey] || "#9ca3af", r: 3 }} connectNulls />;
                                                    })}
                                                </LineChart>
                                            ) : (
                                                /* No inflows at all */
                                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                                    <XAxis dataKey="label" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#4B5563" }} />
                                                    <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#4B5563" }} tickFormatter={(v: number) => formatCompactCurrency(v, dominantCurrency)} />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: "var(--content-bg, #ffffff)", border: "1px solid var(--input-border, #e5e7eb)", borderRadius: "8px", fontSize: 12 }}
                                                        labelStyle={{ color: "var(--header-text, #6b7280)" }}
                                                        formatter={(value: number, name: string) => [formatCurrency(value, dominantCurrency), name]}
                                                    />
                                                    <Line type="monotone" dataKey="inflows" name="Inflows" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: "#6b7280", r: 3 }} />
                                                </LineChart>
                                            )}
                                        </ResponsiveContainer>
                                    </div>

                                    {/* ─── Inflows Breakdown Cards (Bank Account / Gateway / P&L Line) ─── */}
                                    {(Object.keys(revenueByBank).length > 0 || Object.keys(analyticsByGateway.byGateway).length > 0 || Object.keys(pnlLineRevenue.byLine).length > 0) && (
                                        <div className="mt-5">
                                            {/* Bank Account view */}
                                            {revenueViewMode === "bank" && (
                                                <div className="flex gap-2 overflow-x-auto pb-2">
                                                    {BANK_ACCOUNTS.filter(b => revenueByBank[b.key]).map(bank => {
                                                        const stats = revenueByBank[bank.key];
                                                        const net = stats.inflows - stats.outflows;
                                                        return (
                                                            <div key={bank.key} className="flex-shrink-0 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 min-w-[145px]">
                                                                <p className={`text-[10px] uppercase font-medium mb-1 ${bank.textColor}`}>{bank.label}</p>
                                                                <div className="space-y-0.5">
                                                                    <div className="flex justify-between text-[10px]">
                                                                        <span className="text-gray-500">In</span>
                                                                        <span className="text-green-400 font-medium">{formatCompactCurrency(stats.inflows, bank.currency)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-[10px]">
                                                                        <span className="text-gray-500">Out</span>
                                                                        <span className="text-red-400 font-medium">{formatCompactCurrency(stats.outflows, bank.currency)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-[10px] border-t border-gray-200 dark:border-gray-700 pt-0.5">
                                                                        <span className="text-gray-500">Net</span>
                                                                        <span className={`font-bold ${net >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCompactCurrency(net, bank.currency)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-[10px]">
                                                                        <span className="text-gray-500">Txns</span>
                                                                        <span className="text-gray-700 dark:text-gray-300 font-medium">{stats.count}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Gateway view — ALL bank inflows by gateway */}
                                            {revenueViewMode === "gateway" && Object.keys(analyticsByGateway.byGateway).length > 0 && (
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2 px-1">
                                                        <span className="text-[10px] text-gray-500">
                                                            All inflows by payment gateway
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                                        {Object.entries(analyticsByGateway.byGateway).sort(([, a], [, b]) => b.amount - a.amount).map(([gw, stats]) => {
                                                            const gwStyle = getGatewayStyle(gw);
                                                            const gwLabel = gw === "sem-gateway" ? "Sem Gateway" : (gw.charAt(0).toUpperCase() + gw.slice(1));
                                                            const pct = analyticsByGateway.totalInflow > 0 ? Math.round((stats.amount / analyticsByGateway.totalInflow) * 100) : 0;
                                                            return (
                                                                <div key={gw} className={`flex-shrink-0 rounded-lg border px-3 py-2 min-w-[130px] ${gwStyle.bg} ${gwStyle.border}`}>
                                                                    <p className={`text-[10px] uppercase font-medium mb-1 ${gwStyle.text}`}>{gwLabel}</p>
                                                                    <div className="space-y-0.5">
                                                                        <div className="flex justify-between text-[10px]">
                                                                            <span className="text-gray-500">Amount</span>
                                                                            <span className="text-green-400 font-bold">{formatCompactCurrency(stats.amount, dominantCurrency)}</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-[10px]">
                                                                            <span className="text-gray-500">Txns</span>
                                                                            <span className="text-gray-700 dark:text-gray-300 font-medium">{stats.count}</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-[10px] border-t border-gray-200 dark:border-gray-700 pt-0.5">
                                                                            <span className="text-gray-500">Share</span>
                                                                            <span className="text-gray-700 dark:text-gray-300 font-medium">{pct}%</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Gateway empty state */}
                                            {revenueViewMode === "gateway" && Object.keys(analyticsByGateway.byGateway).length === 0 && (
                                                <div className="text-center py-4">
                                                    <CreditCard className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                                                    <p className="text-xs text-gray-500">No inflows in this period</p>
                                                </div>
                                            )}

                                            {/* P&L Line view — ALL bank inflows with chain-based classification */}
                                            {revenueViewMode === "pnl" && (
                                                <div>
                                                    {Object.keys(pnlLineRevenue.byLine).length > 0 ? (
                                                        <>
                                                            {/* Total banner */}
                                                            <div className="flex items-center justify-between mb-2 px-1">
                                                                <span className="text-[10px] text-gray-500">
                                                                    {PNL_LINES.filter(l => l.code !== "internal" && pnlLineRevenue.byLine[l.code]).length} P&L lines
                                                                    {pnlLineRevenue.byLine["unclassified"] ? ` + unclassified` : ""}
                                                                    {pnlLineRevenue.byLine["internal"] ? ` • ${pnlLineRevenue.byLine["internal"].count} internal excluded` : ""}
                                                                    {" • "}
                                                                    {Object.entries(pnlLineRevenue.byLine).filter(([k]) => k !== "internal").reduce((s, [, l]) => s + l.count, 0)} revenue inflows
                                                                </span>
                                                                <span className="text-xs text-green-400 font-bold">{formatCompactCurrency(pnlLineRevenue.total, dominantCurrency)} revenue</span>
                                                            </div>
                                                            {/* P&L Line cards — clickable */}
                                                            <div className="flex gap-2 overflow-x-auto pb-2">
                                                                {PNL_LINES.filter(l => l.code !== "internal").map(line => {
                                                                    const lineData = pnlLineRevenue.byLine[line.code];
                                                                    if (!lineData) return null;
                                                                    const pct = pnlLineRevenue.total > 0 ? Math.round((lineData.amount / pnlLineRevenue.total) * 100) : 0;
                                                                    const productCount = Object.keys(lineData.products).length;
                                                                    return (
                                                                        <div
                                                                            key={line.code}
                                                                            onClick={() => setSelectedPnlLine(line.code)}
                                                                            className={`flex-shrink-0 rounded-lg border px-3 py-2 min-w-[155px] max-w-[200px] cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg ${line.bg} ${line.border}`}
                                                                        >
                                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                                <span className="text-sm">{line.icon}</span>
                                                                                <p className={`text-[10px] uppercase font-medium truncate ${line.text}`} title={line.label}>{line.label}</p>
                                                                            </div>
                                                                            <div className="space-y-0.5">
                                                                                <div className="flex justify-between text-[10px]">
                                                                                    <span className="text-gray-500">Inflows</span>
                                                                                    <span className="text-green-400 font-bold">{formatCompactCurrency(lineData.amount, dominantCurrency)}</span>
                                                                                </div>
                                                                                <div className="flex justify-between text-[10px]">
                                                                                    <span className="text-gray-500">Orders</span>
                                                                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{lineData.count}</span>
                                                                                </div>
                                                                                <div className="flex justify-between text-[10px]">
                                                                                    <span className="text-gray-500">Products</span>
                                                                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{productCount}</span>
                                                                                </div>
                                                                                <div className="flex justify-between text-[10px] border-t border-gray-200 dark:border-gray-700 pt-0.5">
                                                                                    <span className="text-gray-500">Share</span>
                                                                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{pct}%</span>
                                                                                </div>
                                                                                <div className="w-full bg-gray-100 dark:bg-[#0a0a0a] rounded-full h-1 mt-0.5">
                                                                                    <div className="h-1 rounded-full bg-gray-400 dark:bg-gray-500" style={{ width: `${pct}%` }} />
                                                                                </div>
                                                                            </div>
                                                                            <p className="text-[8px] text-gray-600 mt-1 text-center">Click for products</p>
                                                                        </div>
                                                                    );
                                                                })}
                                                                {/* Unclassified bucket */}
                                                                {pnlLineRevenue.byLine["unclassified"] && (() => {
                                                                    const uncData = pnlLineRevenue.byLine["unclassified"];
                                                                    const pct = pnlLineRevenue.total > 0 ? Math.round((uncData.amount / pnlLineRevenue.total) * 100) : 0;
                                                                    return (
                                                                        <div
                                                                            onClick={() => setSelectedPnlLine("unclassified")}
                                                                            className="flex-shrink-0 rounded-lg border px-3 py-2 min-w-[155px] max-w-[200px] cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg bg-gray-100 dark:bg-black/50 border-gray-200 dark:border-gray-700"
                                                                        >
                                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                                <span className="text-sm">❓</span>
                                                                                <p className="text-[10px] uppercase font-medium text-gray-500 dark:text-gray-400">Unclassified</p>
                                                                            </div>
                                                                            <div className="space-y-0.5">
                                                                                <div className="flex justify-between text-[10px]">
                                                                                    <span className="text-gray-500">Inflows</span>
                                                                                    <span className="text-green-400 font-bold">{formatCompactCurrency(uncData.amount, dominantCurrency)}</span>
                                                                                </div>
                                                                                <div className="flex justify-between text-[10px]">
                                                                                    <span className="text-gray-500">Orders</span>
                                                                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{uncData.count}</span>
                                                                                </div>
                                                                                <div className="flex justify-between text-[10px] border-t border-gray-200 dark:border-gray-700 pt-0.5">
                                                                                    <span className="text-gray-500">Share</span>
                                                                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{pct}%</span>
                                                                                </div>
                                                                            </div>
                                                                            <p className="text-[8px] text-gray-600 mt-1 text-center">Click for products</p>
                                                                        </div>
                                                                    );
                                                                })()}
                                                                {/* Internal transfers bucket (non-revenue, shown separately) */}
                                                                {pnlLineRevenue.byLine["internal"] && (() => {
                                                                    const intData = pnlLineRevenue.byLine["internal"];
                                                                    const grossTotal = pnlLineRevenue.total + pnlLineRevenue.internalTotal;
                                                                    const pct = grossTotal > 0 ? Math.round((intData.amount / grossTotal) * 100) : 0;
                                                                    return (
                                                                        <div
                                                                            onClick={() => setSelectedPnlLine("internal")}
                                                                            className="flex-shrink-0 rounded-lg border px-3 py-2 min-w-[155px] max-w-[200px] cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg bg-white dark:bg-black border-gray-200 dark:border-gray-700 opacity-70"
                                                                        >
                                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                                <span className="text-sm">🔄</span>
                                                                                <p className="text-[10px] uppercase font-medium text-gray-900 dark:text-white">Internal Transfers</p>
                                                                            </div>
                                                                            <div className="space-y-0.5">
                                                                                <div className="flex justify-between text-[10px]">
                                                                                    <span className="text-gray-500">Amount</span>
                                                                                    <span className="text-gray-900 dark:text-white font-bold">{formatCompactCurrency(intData.amount, dominantCurrency)}</span>
                                                                                </div>
                                                                                <div className="flex justify-between text-[10px]">
                                                                                    <span className="text-gray-500">Txns</span>
                                                                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{intData.count}</span>
                                                                                </div>
                                                                                <div className="flex justify-between text-[10px] border-t border-gray-200 dark:border-gray-700 pt-0.5">
                                                                                    <span className="text-gray-500">% of gross</span>
                                                                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{pct}%</span>
                                                                                </div>
                                                                            </div>
                                                                            <p className="text-[8px] text-gray-500 mt-1 text-center">Non-revenue</p>
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="text-center py-4">
                                                            <BarChart3 className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                                                            <p className="text-xs text-gray-500">No inflows in this period</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                        </AccordionContent>
                    </AccordionItem>

                    {/* ─── Section 3: Bank Statements ─── */}
                    <AccordionItem value="statements" className="flex-1 flex flex-col overflow-hidden border-b-0">
                        <AccordionTrigger className="px-6 py-3 hover:no-underline hover:bg-gray-50 dark:hover:bg-[#0a0a0a] flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-violet-500" />
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">Bank Statements</span>
                                <Badge variant="outline" className="text-[10px] ml-2 bg-transparent border-gray-300 dark:border-gray-600 text-gray-500">{filteredTransactions.length} transactions</Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="flex-1 flex flex-col overflow-hidden">

                            {/* ─── Filters ─── */}
                            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-2 bg-gray-100 dark:bg-[#0a0a0a]">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <Filter className="h-3.5 w-3.5 text-gray-500" />
                                    <Input type="date" value={pendingDateRange.start} onChange={e => setPendingDateRange(p => ({ ...p, start: e.target.value }))} className="w-36 h-8 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs" />
                                    <span className="text-gray-600">→</span>
                                    <Input type="date" value={pendingDateRange.end} onChange={e => setPendingDateRange(p => ({ ...p, end: e.target.value }))} className="w-36 h-8 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs" />
                                    <Button onClick={applyDateRange} variant="outline" size="sm" className="h-8 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111] text-xs">
                                        Apply
                                    </Button>
                                    <Select value={gatewayFilter} onValueChange={setGatewayFilter}>
                                        <SelectTrigger className="w-28 h-8 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs"><SelectValue placeholder="Gateway" /></SelectTrigger>
                                        <SelectContent><SelectItem value="all">Gateways</SelectItem><SelectItem value="braintree">Braintree</SelectItem><SelectItem value="stripe">Stripe</SelectItem><SelectItem value="gocardless">GoCardless</SelectItem><SelectItem value="paypal">PayPal</SelectItem><SelectItem value="gusto">Gusto</SelectItem><SelectItem value="quickbooks">QuickBooks</SelectItem></SelectContent>
                                    </Select>
                                    <Select value={flowFilter} onValueChange={setFlowFilter}>
                                        <SelectTrigger className="w-28 h-8 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs"><SelectValue placeholder="Flow" /></SelectTrigger>
                                        <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="income">Inflows</SelectItem><SelectItem value="expense">Outflows</SelectItem></SelectContent>
                                    </Select>
                                    <Select value={reconFilter} onValueChange={setReconFilter}>
                                        <SelectTrigger className="w-32 h-8 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs"><SelectValue placeholder="Reconciliation" /></SelectTrigger>
                                        <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="reconciled">Reconciled</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent>
                                    </Select>
                                    <Select value={gwReconFilter} onValueChange={setGwReconFilter}>
                                        <SelectTrigger className="w-28 h-8 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs"><SelectValue placeholder="GW Type" /></SelectTrigger>
                                        <SelectContent><SelectItem value="all">GW All</SelectItem><SelectItem value="auto">Auto</SelectItem><SelectItem value="manual">Manual</SelectItem><SelectItem value="intercompany">Intercompany</SelectItem><SelectItem value="not-reconciled">Not Recon.</SelectItem></SelectContent>
                                    </Select>
                                    <Select value={orderFilter} onValueChange={setOrderFilter}>
                                        <SelectTrigger className="w-28 h-8 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs"><SelectValue placeholder="Order" /></SelectTrigger>
                                        <SelectContent><SelectItem value="all">Ord All</SelectItem><SelectItem value="matched">Matched</SelectItem><SelectItem value="not-matched">Not Matched</SelectItem></SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* ─── Table Header ─── */}
                            <div className="flex-shrink-0 sticky top-0 z-10 bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                                <div className="flex items-center gap-1 px-4 py-2 text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase min-w-[700px]">
                                    <div className="w-[60px] flex-shrink-0">Date</div>
                                    {showBankColumn && <div className="w-[90px] flex-shrink-0">Bank</div>}
                                    <div className="flex-1 min-w-[200px]">Description</div>
                                    <div className="w-[100px] flex-shrink-0 text-right">Debit</div>
                                    <div className="w-[100px] flex-shrink-0 text-right">Credit</div>
                                    <div className="w-[100px] flex-shrink-0 text-right">Balance</div>
                                    <div className="w-[40px] flex-shrink-0 text-center">View</div>
                                </div>
                            </div>

                            {/* ─── Content (date-grouped rows) ─── */}
                            <div className="flex-1 overflow-y-auto overflow-x-auto">
                                {dateGroups.map(group => (
                                    <div key={group.date} className="border-b border-gray-200 dark:border-gray-800">
                                        {/* Date group header */}
                                        <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-100 dark:bg-black/50 cursor-pointer" onClick={() => toggleGroup(group.date)}>
                                            {expandedGroups.has(group.date) ? <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
                                            <span className="font-medium text-gray-900 dark:text-white text-sm">{group.dateLabel}</span>
                                            <span className="text-gray-500 text-xs ml-auto">
                                                {group.rows.length} Transactions <span className="mx-1">|</span>
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
                                                    className={`flex items-center gap-1 px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 dark:bg-black/30 border-t border-gray-200 dark:border-gray-800/50 min-w-[700px] ${selectedRow?.id === tx.id ? "bg-gray-100 dark:bg-[#0a0a0a]/50" : ""}`}>
                                                    <div className="w-[60px] flex-shrink-0 text-[10px] text-gray-700 dark:text-gray-300">{formatShortDate(tx.date)}</div>
                                                    {showBankColumn && (
                                                        <div className="w-[90px] flex-shrink-0">
                                                            <Badge variant="outline" className={`text-[8px] px-1 py-0 ${bankInfo?.textColor || "text-gray-500 dark:text-gray-400"} border-gray-300 dark:border-gray-600`}>{bankInfo?.label || tx.source}</Badge>
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-[200px] text-[11px] text-gray-900 dark:text-white truncate" title={tx.description}>{parseChaseShortDescription(tx.description, tx.source)}</div>
                                                    <div className="w-[100px] flex-shrink-0 text-right text-[10px] font-mono">
                                                        {isDebit ? <span className="text-red-400">{formatCurrency(Math.abs(tx.amount), tx.currency)}</span> : <span className="text-gray-600">-</span>}
                                                    </div>
                                                    <div className="w-[100px] flex-shrink-0 text-right text-[10px] font-mono">
                                                        {isCredit ? <span className="text-green-400">{formatCurrency(tx.amount, tx.currency)}</span> : <span className="text-gray-600">-</span>}
                                                    </div>
                                                    <div className="w-[100px] flex-shrink-0 text-right text-[10px] font-mono">
                                                        {(() => {
                                                            const bal = tx.custom_data?.saldo ?? tx.custom_data?.balance;
                                                            if (bal != null) {
                                                                const parsed = typeof bal === "number" ? bal : parseFloat(String(bal));
                                                                if (!isNaN(parsed)) return <span className="text-gray-700 dark:text-gray-300">{formatCurrency(parsed, tx.currency)}</span>;
                                                            }
                                                            return <span className="text-gray-600">-</span>;
                                                        })()}
                                                    </div>
                                                    <div className="w-[40px] flex-shrink-0 text-center">
                                                        <button onClick={(e) => { e.stopPropagation(); handleRowSelect(tx); }} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                                            <Eye className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" />
                                                        </button>
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

                        </AccordionContent>
                    </AccordionItem>

                </Accordion>
            </div>

            {/* ════════════════════════════════════════════════════════ */}
            {/* DETAIL PANEL (right side) */}
            {/* ════════════════════════════════════════════════════════ */}
            {
                selectedRow && (
                    <div className="fixed right-0 top-0 h-full w-[450px] bg-white dark:bg-black border-l border-gray-200 dark:border-gray-700 flex flex-col z-[1040] shadow-2xl">
                        {/* Panel Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-2 min-w-0">
                                {selectedRow.isReconciled ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />}
                                <span className="font-medium text-gray-900 dark:text-white truncate">{selectedRow.description}</span>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white flex-shrink-0" onClick={() => setSelectedRow(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Panel Content */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Transaction Info */}
                            <div className="px-4 py-4 space-y-4 border-b border-gray-200 dark:border-gray-800">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3">
                                        <Calendar className="h-4 w-4 text-gray-500" />
                                        <div>
                                            <p className="text-xs text-gray-500">Date</p>
                                            <p className="text-sm text-gray-900 dark:text-white">{formatShortDate(selectedRow.date)}</p>
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
                                        <p className="text-sm text-gray-900 dark:text-white break-words">{selectedRow.description}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500">Bank</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">{BANK_ACCOUNTS.find(b => b.key === selectedRow.source)?.label || selectedRow.source}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Currency</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">{selectedRow.currency}</p>
                                    </div>
                                </div>

                                {/* Custom data fields */}
                                {selectedRow.custom_data && Object.keys(selectedRow.custom_data).length > 0 && (
                                    <div className="space-y-2">
                                        {selectedRow.custom_data.details && (
                                            <div><p className="text-xs text-gray-500">Type</p><p className="text-sm text-gray-700 dark:text-gray-300">{selectedRow.custom_data.details}</p></div>
                                        )}
                                        {selectedRow.custom_data.type && (
                                            <div><p className="text-xs text-gray-500">Transaction Type</p><p className="text-sm text-gray-700 dark:text-gray-300">{selectedRow.custom_data.type}</p></div>
                                        )}
                                        {selectedRow.custom_data.balance != null && (
                                            <div><p className="text-xs text-gray-500">Balance</p><p className="text-sm text-gray-900 dark:text-white font-medium">{formatCurrency(selectedRow.custom_data.balance, selectedRow.currency)}</p></div>
                                        )}
                                        {selectedRow.custom_data.saldo != null && (
                                            <div><p className="text-xs text-gray-500">Balance</p><p className="text-sm text-gray-900 dark:text-white font-medium">{formatCurrency(selectedRow.custom_data.saldo, selectedRow.currency)}</p></div>
                                        )}
                                        {selectedRow.custom_data.check_number && (
                                            <div><p className="text-xs text-gray-500">Check/Slip #</p><p className="text-sm text-gray-700 dark:text-gray-300 font-mono">{selectedRow.custom_data.check_number}</p></div>
                                        )}
                                        {selectedRow.custom_data.referencia && (
                                            <div><p className="text-xs text-gray-500">Reference</p><p className="text-sm text-gray-700 dark:text-gray-300 font-mono">{selectedRow.custom_data.referencia}</p></div>
                                        )}
                                        {selectedRow.custom_data.clave && (
                                            <div><p className="text-xs text-gray-500">Key</p><p className="text-sm text-gray-700 dark:text-gray-300">{selectedRow.custom_data.clave}</p></div>
                                        )}
                                        {selectedRow.custom_data.categoria && (
                                            <div><p className="text-xs text-gray-500">Category</p><p className="text-sm text-gray-700 dark:text-gray-300">{selectedRow.custom_data.categoria}</p></div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ─── RECONCILIATION STATUS ─── */}
                            <div className="px-4 py-4 space-y-4 border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-[#0a0a0a]">
                                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    {selectedRow.amount >= 0
                                        ? <><CreditCard className="h-4 w-4" /> Gateway Reconciliation</>
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
                                            {selectedRow.custom_data?.match_level ? ` L${selectedRow.custom_data.match_level}` : ""}
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

                                {selectedRow.custom_data?.match_confidence != null && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Confidence</p>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full h-1.5">
                                                <div className={`h-1.5 rounded-full ${selectedRow.custom_data.match_confidence >= 0.9 ? 'bg-green-500' : selectedRow.custom_data.match_confidence >= 0.7 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                                                    style={{ width: `${Math.round(selectedRow.custom_data.match_confidence * 100)}%` }} />
                                            </div>
                                            <span className="text-xs text-gray-700 dark:text-gray-300">{Math.round(selectedRow.custom_data.match_confidence * 100)}%</span>
                                        </div>
                                    </div>
                                )}

                                {/* ─── REVENUE: Payment Source / Gateway info ─── */}
                                {selectedRow.amount >= 0 && selectedRow.paymentSource && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Payment Source</p>
                                        <Badge variant="outline" className={`${getGatewayStyle(selectedRow.paymentSource).bg} ${getGatewayStyle(selectedRow.paymentSource).text} ${getGatewayStyle(selectedRow.paymentSource).border}`}>
                                            {selectedRow.paymentSource}
                                        </Badge>
                                    </div>
                                )}

                                {/* Quick summary from custom_data enriched fields — revenue only */}
                                {selectedRow.amount >= 0 && selectedRow.custom_data?.matched_customer_names?.length > 0 && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Customers ({selectedRow.custom_data.matched_customer_names.length})</p>
                                        <div className="space-y-1">
                                            {selectedRow.custom_data.matched_customer_names.slice(0, 5).map((name: string, i: number) => (
                                                <div key={i} className="flex items-center gap-1.5">
                                                    <User className="h-3 w-3 text-blue-400" />
                                                    <span className="text-sm text-gray-900 dark:text-white">{name}</span>
                                                </div>
                                            ))}
                                            {selectedRow.custom_data.matched_customer_names.length > 5 && (
                                                <p className="text-xs text-gray-500">+{selectedRow.custom_data.matched_customer_names.length - 5} more</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {selectedRow.amount >= 0 && selectedRow.custom_data?.matched_order_ids?.length > 0 && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Orders ({selectedRow.custom_data.matched_order_ids.length})</p>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedRow.custom_data.matched_order_ids.slice(0, 8).map((oid: string, i: number) => (
                                                <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0 bg-amber-900/20 text-amber-300 border-amber-700">
                                                    {oid}
                                                </Badge>
                                            ))}
                                            {selectedRow.custom_data.matched_order_ids.length > 8 && (
                                                <span className="text-xs text-gray-500">+{selectedRow.custom_data.matched_order_ids.length - 8} more</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {selectedRow.amount >= 0 && selectedRow.custom_data?.matched_products?.length > 0 && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Products</p>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedRow.custom_data.matched_products.slice(0, 5).map((prod: string, i: number) => (
                                                <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0 bg-violet-900/20 text-violet-300 border-violet-700">
                                                    {prod}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedRow.amount >= 0 && selectedRow.custom_data?.braintree_transaction_count && (
                                    <div>
                                        <p className="text-xs text-gray-500">Transactions in Batch</p>
                                        <p className="text-sm text-gray-900 dark:text-white">{selectedRow.custom_data.braintree_transaction_count}</p>
                                    </div>
                                )}

                                {/* ─── FAC Classification (from matched invoice-orders) ─── */}
                                {selectedRow.amount >= 0 && selectedRow.custom_data?.matched_invoice_fac && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Financial Account</p>
                                        <div className="flex items-center gap-2">
                                            {(() => {
                                                const lineCode = getPnlLineFromCode(selectedRow.custom_data.matched_invoice_fac);
                                                const lineConfig = getPnlLineConfig(lineCode);
                                                return (
                                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${lineConfig?.bg || 'bg-gray-100 dark:bg-black'} ${lineConfig?.text || 'text-gray-500 dark:text-gray-400'} ${lineConfig?.border || 'border-gray-300 dark:border-gray-600'}`}>
                                                        {lineConfig?.icon || '📊'} {selectedRow.custom_data.matched_invoice_fac}
                                                    </Badge>
                                                );
                                            })()}
                                            {selectedRow.custom_data.matched_invoice_fac_name && (
                                                <span className="text-xs text-gray-700 dark:text-gray-300">{selectedRow.custom_data.matched_invoice_fac_name}</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ─── Chain summary (from chain-details API) ─── */}
                                {selectedRow.amount >= 0 && selectedRow.chainData?.summary && (
                                    <div className="space-y-2">
                                        {/* FAC codes from chain */}
                                        {selectedRow.chainData.summary.fac_codes.length > 0 && !selectedRow.custom_data?.matched_invoice_fac && (
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">P&amp;L Lines (from chain)</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {selectedRow.chainData.summary.fac_codes.map((fac: string, i: number) => {
                                                        const lc = getPnlLineFromCode(fac);
                                                        const lconf = getPnlLineConfig(lc);
                                                        return (
                                                            <Badge key={i} variant="outline" className={`text-[9px] px-1 py-0 ${lconf?.bg || 'bg-gray-100 dark:bg-black'} ${lconf?.text || 'text-gray-500 dark:text-gray-400'} ${lconf?.border || 'border-gray-300 dark:border-gray-600'}`}>
                                                                {lconf?.icon || ''} {fac}
                                                            </Badge>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {/* Refund alert */}
                                        {selectedRow.chainData.summary.has_refunds && (
                                            <div className="flex items-center gap-2 p-2 bg-red-900/20 rounded-lg border border-red-800/40">
                                                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                                                <div>
                                                    <p className="text-xs text-red-300 font-medium">Refunds Detected</p>
                                                    {selectedRow.chainData.summary.total_refunded > 0 && (
                                                        <p className="text-[10px] text-red-400">Total: {formatCurrency(selectedRow.chainData.summary.total_refunded, selectedRow.currency)}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {/* Countries */}
                                        {selectedRow.chainData.summary.countries.length > 0 && (
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">Countries</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {selectedRow.chainData.summary.countries.map((c: string, i: number) => (
                                                        <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0 bg-gray-100 dark:bg-black text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600">
                                                            {c}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {/* Subscriptions count */}
                                        {selectedRow.chainData.summary.subscription_count > 0 && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-gray-500">🔄 Subscriptions:</span>
                                                <span className="text-xs text-teal-400 font-medium">{selectedRow.chainData.summary.subscription_count}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedRow.custom_data?.disbursement_reference && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Disbursement Reference</p>
                                        <div className="flex items-center gap-2">
                                            <Key className="h-3 w-3 text-gray-500" />
                                            <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{selectedRow.custom_data.disbursement_reference}</span>
                                        </div>
                                    </div>
                                )}

                                {/* ─── EXPENSE: AP Invoice details ─── */}
                                {selectedRow.amount < 0 && selectedRow.custom_data?.matched_provider && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Matched Provider</p>
                                        <p className="text-sm text-gray-900 dark:text-white font-medium">{selectedRow.custom_data.matched_provider}</p>
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
                                        <span className="text-sm text-gray-700 dark:text-gray-300">{formatShortDate(selectedRow.custom_data.matched_payment_date)}</span>
                                    </div>
                                )}

                                {selectedRow.amount < 0 && selectedRow.custom_data?.ap_financial_account && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Financial Account</p>
                                        <span className="text-sm text-gray-700 dark:text-gray-300">{selectedRow.custom_data.ap_financial_account}</span>
                                    </div>
                                )}

                                {/* ─── COMMON fields ─── */}
                                {selectedRow.custom_data?.reconciled_at && (
                                    <div>
                                        <p className="text-xs text-gray-500">Reconciled at</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">{new Date(selectedRow.custom_data.reconciled_at).toLocaleString("pt-BR")}</p>
                                    </div>
                                )}

                                {selectedRow.custom_data?.manual_note && (
                                    <div>
                                        <p className="text-xs text-gray-500">Note</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">{selectedRow.custom_data.manual_note}</p>
                                    </div>
                                )}

                                {selectedRow.custom_data?.match_type && (
                                    <div>
                                        <p className="text-xs text-gray-500">Match Type</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">{selectedRow.custom_data.match_type.replace(/_/g, " ")}</p>
                                    </div>
                                )}

                                {/* ─── INTERCOMPANY details ─── */}
                                {selectedRow.reconciliationType === "intercompany" && selectedRow.custom_data?.intercompany_matched_bank && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Matched Bank</p>
                                        <p className="text-sm text-amber-300">{selectedRow.custom_data.intercompany_matched_bank}</p>
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
                                            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Date:</span><span className="text-gray-900 dark:text-white">{formatShortDate(selectedRow.custom_data.bank_match_date)}</span></div>
                                        )}
                                        <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Amount:</span><span className="text-green-400 font-medium">{formatCurrency(selectedRow.custom_data.bank_match_amount, selectedRow.currency)}</span></div>
                                        {selectedRow.custom_data.bank_match_description && (
                                            <div><span className="text-gray-500 dark:text-gray-400">Description:</span><p className="text-gray-900 dark:text-white text-xs mt-1">{selectedRow.custom_data.bank_match_description}</p></div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Order Reconciliation — only for revenue */}
                            {selectedRow.amount >= 0 && (
                                <div className="px-4 py-4 space-y-4 border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-[#0a0a0a]">
                                    <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                                        <FileText className="h-4 w-4" /> Orders &amp; Invoices
                                    </h3>

                                    {/* Orders summary */}
                                    {selectedRow.chainData?.orders && selectedRow.chainData.orders.length > 0 ? (
                                        <div className="space-y-3">
                                            {/* Summary stats */}
                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                <div className="bg-gray-50 dark:bg-black rounded-lg p-2">
                                                    <p className="text-amber-400 text-lg font-bold">{selectedRow.chainData.orders.length}</p>
                                                    <p className="text-[10px] text-gray-500">Orders</p>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-black rounded-lg p-2">
                                                    <p className="text-blue-400 text-lg font-bold">{[...new Set(selectedRow.chainData.orders.map(o => o.customer_name).filter(Boolean))].length}</p>
                                                    <p className="text-[10px] text-gray-500">Clients</p>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-black rounded-lg p-2">
                                                    <p className="text-green-400 text-lg font-bold">{formatCurrency(selectedRow.chainData.orders.reduce((s, o) => s + o.amount, 0), selectedRow.currency)}</p>
                                                    <p className="text-[10px] text-gray-500">Total</p>
                                                </div>
                                            </div>

                                            {/* Order cards */}
                                            {selectedRow.chainData.orders.slice(0, 20).map((order, i) => (
                                                <div key={i} className="bg-amber-900/10 rounded-lg border border-amber-800/30 p-3 space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-amber-300 text-xs font-mono truncate max-w-[200px]">{order.invoice_number}</span>
                                                        <span className="text-green-400 font-medium text-sm">{formatCurrency(order.amount, order.currency || selectedRow.currency)}</span>
                                                    </div>
                                                    {order.customer_name && (
                                                        <div className="flex items-center gap-1.5">
                                                            <User className="h-3 w-3 text-blue-400 flex-shrink-0" />
                                                            <span className="text-gray-900 dark:text-white text-sm font-medium truncate">{order.customer_name}</span>
                                                        </div>
                                                    )}
                                                    {order.email && (
                                                        <p className="text-gray-500 dark:text-gray-400 text-xs pl-[18px] truncate">{order.email}</p>
                                                    )}
                                                    {order.products && (
                                                        <div className="flex items-center gap-1.5">
                                                            <CreditCard className="h-3 w-3 text-violet-400 flex-shrink-0" />
                                                            <span className="text-violet-300 text-xs truncate">{order.products}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                                        {order.financial_account_name && (
                                                            <Badge variant="outline" className="text-[10px] bg-emerald-900/20 text-emerald-400 border-emerald-700/50">
                                                                {order.financial_account_name}
                                                            </Badge>
                                                        )}
                                                        {order.order_type && (
                                                            <Badge variant="outline" className="text-[10px] bg-purple-900/20 text-purple-400 border-purple-700/50">
                                                                {order.order_type}
                                                            </Badge>
                                                        )}
                                                        {order.payment_method && (
                                                            <Badge variant="outline" className="text-[10px] bg-gray-100 dark:bg-black text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600">
                                                                {order.payment_method}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                                        {order.date && <span>{formatShortDate(order.date)}</span>}
                                                        {order.billing_entity && <span>{order.billing_entity}</span>}
                                                        {order.country && <span>{order.country}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                            {selectedRow.chainData.orders.length > 20 && (
                                                <p className="text-xs text-gray-500 text-center">+ {selectedRow.chainData.orders.length - 20} more orders</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-gray-500">Status</p>
                                                {selectedRow.isOrderReconciled ? (
                                                    <Badge variant="outline" className="bg-blue-900/30 text-blue-400 border-blue-700">
                                                        Matched
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-gray-100 dark:bg-black/50 text-gray-500 border-gray-200 dark:border-gray-700">
                                                        Not Matched
                                                    </Badge>
                                                )}
                                            </div>
                                            {selectedRow.invoiceNumber && (
                                                <div className="mt-2">
                                                    <p className="text-xs text-gray-500 mb-1">Invoice</p>
                                                    <span className="text-sm font-mono text-blue-300">{selectedRow.invoiceNumber}</span>
                                                </div>
                                            )}
                                            {selectedRow.invoiceOrderId && (
                                                <div className="mt-2">
                                                    <p className="text-xs text-gray-500 mb-1">Order ID</p>
                                                    <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{selectedRow.invoiceOrderId}</span>
                                                </div>
                                            )}
                                            {chainLoading && (
                                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mt-2">
                                                    <RefreshCw className="h-3 w-3 animate-spin" /> Loading orders...
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Web Orders (Craft Commerce) */}
                                    {selectedRow.chainData?.web_orders && selectedRow.chainData.web_orders.length > 0 && (
                                        <div className="space-y-3 mt-4">
                                            <h4 className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider">
                                                🛒 E-Commerce Orders ({selectedRow.chainData.web_orders.length})
                                            </h4>
                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                <div className="bg-gray-50 dark:bg-black rounded-lg p-2">
                                                    <p className="text-teal-400 text-lg font-bold">{selectedRow.chainData.web_orders.length}</p>
                                                    <p className="text-[10px] text-gray-500">Orders</p>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-black rounded-lg p-2">
                                                    <p className="text-blue-400 text-lg font-bold">{[...new Set(selectedRow.chainData.web_orders.map(o => o.customer_name).filter(Boolean))].length}</p>
                                                    <p className="text-[10px] text-gray-500">Clients</p>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-black rounded-lg p-2">
                                                    <p className="text-green-400 text-lg font-bold">{formatCurrency(selectedRow.chainData.web_orders.reduce((s, o) => s + o.total_price, 0), selectedRow.currency)}</p>
                                                    <p className="text-[10px] text-gray-500">Total</p>
                                                </div>
                                            </div>
                                            {selectedRow.chainData.web_orders.slice(0, 30).map((wo, i) => (
                                                <div key={`wo-${i}`} className="bg-teal-900/10 rounded-lg border border-teal-800/30 p-3 space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-teal-300 text-xs font-mono">{wo.order_reference}</span>
                                                        <span className="text-green-400 font-medium text-sm">{formatCurrency(wo.total_price, wo.currency)}</span>
                                                    </div>
                                                    {wo.customer_name && (
                                                        <div className="flex items-center gap-1.5">
                                                            <User className="h-3 w-3 text-blue-400 flex-shrink-0" />
                                                            <span className="text-gray-900 dark:text-white text-sm font-medium truncate">{wo.customer_name}</span>
                                                        </div>
                                                    )}
                                                    {wo.customer_email && (
                                                        <p className="text-gray-500 dark:text-gray-400 text-xs pl-[18px] truncate">{wo.customer_email}</p>
                                                    )}
                                                    {wo.products && wo.products.length > 0 && (
                                                        <div className="flex items-start gap-1.5">
                                                            <CreditCard className="h-3 w-3 text-violet-400 flex-shrink-0 mt-0.5" />
                                                            <span className="text-violet-300 text-xs">
                                                                {wo.products.map(p => p.description || p.sku).join(", ")}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                                        {wo.order_type && (
                                                            <Badge variant="outline" className="text-[10px] bg-purple-900/20 text-purple-400 border-purple-700/50">
                                                                {wo.order_type}
                                                            </Badge>
                                                        )}
                                                        {wo.paid_status && (
                                                            <Badge variant="outline" className={`text-[10px] ${wo.paid_status === "paid" ? "bg-green-900/20 text-green-400 border-green-700/50" : "bg-red-900/20 text-red-400 border-red-700/50"}`}>
                                                                {wo.paid_status}
                                                            </Badge>
                                                        )}
                                                        {wo.billing_country && (
                                                            <Badge variant="outline" className="text-[10px] bg-gray-100 dark:bg-black text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600">
                                                                {wo.billing_country}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                                        {wo.date_ordered && <span>{formatShortDate(wo.date_ordered)}</span>}
                                                        {wo.billing_organization && <span>{wo.billing_organization}</span>}
                                                        {wo.subscription_reference && <span>Sub: {wo.subscription_reference}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                            {selectedRow.chainData.web_orders.length > 30 && (
                                                <p className="text-xs text-gray-500 text-center">+ {selectedRow.chainData.web_orders.length - 30} more orders</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ═══ Enriched Chain Data (loaded on-demand) ═══ */}
                            {selectedRow.amount >= 0 && (
                                <div className="px-4 py-4 space-y-4 border-b border-gray-200 dark:border-gray-800">
                                    <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                        <Database className="h-4 w-4" /> Gateway &amp; Chain Details
                                    </h3>

                                    {chainLoading && (
                                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                                            <RefreshCw className="h-4 w-4 animate-spin" /> Loading details...
                                        </div>
                                    )}

                                    {selectedRow.chainData && (
                                        <>
                                            {/* Disbursement Info */}
                                            {selectedRow.chainData.disbursement && (
                                                <div className="bg-gray-100 dark:bg-[#0a0a0a] rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                                                    <p className="text-[10px] text-gray-500 uppercase font-medium">Disbursement (Payout)</p>
                                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                                        <div>
                                                            <span className="text-gray-500 text-xs">Date:</span>
                                                            <span className="text-gray-900 dark:text-white ml-1">{formatShortDate(selectedRow.chainData.disbursement.date)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500 text-xs">Amount:</span>
                                                            <span className="text-green-400 font-medium ml-1">{formatCurrency(selectedRow.chainData.disbursement.amount, selectedRow.currency)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500 text-xs">Transactions:</span>
                                                            <span className="text-gray-900 dark:text-white ml-1">{selectedRow.chainData.disbursement.transaction_count}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Gateway Transactions — collapsible */}
                                            {selectedRow.chainData.gateway_transactions.length > 0 && (
                                                <details className="group">
                                                    <summary className="text-[10px] text-gray-500 uppercase font-medium cursor-pointer hover:text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                                        <span className="group-open:rotate-90 transition-transform">▸</span>
                                                        Gateway Transactions ({selectedRow.chainData.gateway_transactions.length})
                                                    </summary>
                                                    <div className="space-y-2 mt-2">
                                                        {selectedRow.chainData.gateway_transactions.slice(0, 15).map((tx, i) => (
                                                            <div key={i} className="bg-gray-100 dark:bg-[#0a0a0a] rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-[180px]">{tx.transaction_id}</span>
                                                                    <span className="text-green-400 font-medium text-sm">{formatCurrency(tx.amount, selectedRow.currency)}</span>
                                                                </div>
                                                                {tx.customer_name && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <User className="h-3 w-3 text-blue-400" />
                                                                        <span className="text-gray-900 dark:text-white text-sm font-medium truncate">{tx.customer_name}</span>
                                                                    </div>
                                                                )}
                                                                {tx.customer_email && (
                                                                    <p className="text-gray-500 dark:text-gray-400 text-xs pl-[18px] truncate">{tx.customer_email}</p>
                                                                )}
                                                                {tx.order_id && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <FileText className="h-3 w-3 text-amber-400" />
                                                                        <span className="text-amber-300 text-xs font-mono">Order: {tx.order_id}</span>
                                                                    </div>
                                                                )}
                                                                {tx.product_name && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <CreditCard className="h-3 w-3 text-violet-400" />
                                                                        <span className="text-violet-300 text-xs">{tx.product_name}</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                                                    <span>{formatShortDate(tx.date)}</span>
                                                                    {tx.payment_method && <span>{tx.payment_method}</span>}
                                                                    {tx.source && <span className="text-gray-600">{tx.source}</span>}
                                                                </div>
                                                                {/* Enriched badges */}
                                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                                    {tx.card_type && (
                                                                        <Badge variant="outline" className="text-[8px] px-1 py-0 bg-gray-100 dark:bg-black/50 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700">
                                                                            {tx.card_type}
                                                                        </Badge>
                                                                    )}
                                                                    {tx.country_of_issuance && (
                                                                        <Badge variant="outline" className="text-[8px] px-1 py-0 bg-gray-100 dark:bg-black/50 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700">
                                                                            {tx.country_of_issuance}
                                                                        </Badge>
                                                                    )}
                                                                    {tx.subscription_id && (
                                                                        <Badge variant="outline" className="text-[8px] px-1 py-0 bg-teal-900/30 text-teal-400 border-teal-700">
                                                                            🔄 {tx.subscription_id}
                                                                        </Badge>
                                                                    )}
                                                                    {tx.matched_invoice_fac && (
                                                                        <Badge variant="outline" className="text-[8px] px-1 py-0 bg-emerald-900/20 text-emerald-400 border-emerald-700/50">
                                                                            {tx.matched_invoice_fac}
                                                                        </Badge>
                                                                    )}
                                                                    {tx.amount_refunded != null && tx.amount_refunded > 0 && (
                                                                        <Badge variant="outline" className="text-[8px] px-1 py-0 bg-red-900/30 text-red-400 border-red-700">
                                                                            ⚠ Refund: {formatCurrency(tx.amount_refunded, selectedRow.currency)}
                                                                        </Badge>
                                                                    )}
                                                                    {tx.company_name && (
                                                                        <Badge variant="outline" className="text-[8px] px-1 py-0 bg-blue-900/20 text-blue-300 border-blue-700/50">
                                                                            🏢 {tx.company_name}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {selectedRow.chainData.gateway_transactions.length > 15 && (
                                                            <p className="text-xs text-gray-500 text-center">
                                                                + {selectedRow.chainData.gateway_transactions.length - 15} more transactions
                                                            </p>
                                                        )}
                                                    </div>
                                                </details>
                                            )}

                                            {/* Linked Invoices — collapsible */}
                                            {selectedRow.chainData.invoices.length > 0 && (
                                                <details className="group">
                                                    <summary className="text-[10px] text-gray-500 uppercase font-medium cursor-pointer hover:text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                                        <span className="group-open:rotate-90 transition-transform">▸</span>
                                                        AR Invoices ({selectedRow.chainData.invoices.length})
                                                    </summary>
                                                    <div className="space-y-2 mt-2">
                                                        {selectedRow.chainData.invoices.slice(0, 10).map((inv, i) => (
                                                            <div key={i} className="bg-blue-900/10 rounded-lg border border-blue-800/30 p-3 space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-blue-300 text-xs font-mono truncate max-w-[200px]">{inv.invoice_number || `INV-${inv.id}`}</span>
                                                                    <span className="text-green-400 font-medium text-sm">{formatCurrency(inv.total_amount, inv.currency || selectedRow.currency)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <User className="h-3 w-3 text-blue-400" />
                                                                    <span className="text-gray-900 dark:text-white text-sm">{inv.client_name || inv.company_name || 'N/A'}</span>
                                                                </div>
                                                                {inv.order_id && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <FileText className="h-3 w-3 text-amber-400" />
                                                                        <span className="text-amber-300 text-xs font-mono">Order: {inv.order_id}</span>
                                                                    </div>
                                                                )}
                                                                {inv.product && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <CreditCard className="h-3 w-3 text-violet-400" />
                                                                        <span className="text-violet-300 text-xs">{inv.product}</span>
                                                                    </div>
                                                                )}
                                                                {inv.invoice_date && (
                                                                    <p className="text-[10px] text-gray-500">{formatShortDate(inv.invoice_date)}</p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            )}

                                            {/* No data found */}
                                            {selectedRow.chainData.gateway_transactions.length === 0 && selectedRow.chainData.invoices.length === 0 && (!selectedRow.chainData.orders || selectedRow.chainData.orders.length === 0) && (!selectedRow.chainData.web_orders || selectedRow.chainData.web_orders.length === 0) && (
                                                <p className="text-xs text-gray-500 italic">No linked transactions, invoices or orders found.</p>
                                            )}
                                        </>
                                    )}

                                    {!chainLoading && !selectedRow.chainData && (
                                        <Button variant="outline" size="sm" className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111] text-xs"
                                            onClick={() => loadChainData(selectedRow)}>
                                            <Database className="h-3 w-3 mr-1" /> Load Details
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Panel Footer */}
                        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex justify-end">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedRow(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white">
                                Close
                            </Button>
                        </div>
                    </div>
                )
            }

            {/* Error banner */}
            {
                error && (
                    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-900/90 border border-red-700 rounded-lg px-6 py-3 text-red-200 text-sm z-50 flex items-center gap-3">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                        <button onClick={() => setError(null)} className="text-red-400 hover:text-gray-900 dark:text-white ml-2">✕</button>
                    </div>
                )
            }

            {/* ═══ P&L Line Products Popup ═══ */}
            <Dialog open={!!selectedPnlLine} onOpenChange={(open) => { if (!open) setSelectedPnlLine(null); }}>
                <DialogContent className="bg-white dark:bg-black border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                    {(() => {
                        const lineConfig = selectedPnlLine === "unclassified"
                            ? { code: "unclassified", label: "Unclassified", bg: "bg-gray-100 dark:bg-black/50", text: "text-gray-500 dark:text-gray-400", border: "border-gray-200 dark:border-gray-700", icon: "❓" }
                            : getPnlLineConfig(selectedPnlLine || "");
                        const lineData = selectedPnlLine ? pnlLineRevenue.byLine[selectedPnlLine] : null;
                        if (!lineConfig || !lineData) return null;

                        const sortedProducts = Object.entries(lineData.products).sort(([, a], [, b]) => b.amount - a.amount);

                        return (
                            <>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                                        <span className="text-lg">{lineConfig.icon}</span>
                                        <span>{lineConfig.label} — Products</span>
                                    </DialogTitle>
                                    <div className="flex items-center gap-4 mt-2 text-sm">
                                        <span className="text-green-400 font-bold">{formatCurrency(lineData.amount, dominantCurrency)}</span>
                                        <span className="text-gray-500">•</span>
                                        <span className="text-gray-500 dark:text-gray-400">{lineData.count} orders</span>
                                        <span className="text-gray-500">•</span>
                                        <span className="text-gray-500 dark:text-gray-400">{sortedProducts.length} products</span>
                                    </div>
                                </DialogHeader>
                                <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1">
                                    {sortedProducts.map(([product, stats], idx) => {
                                        const pStyle = getProductStyle(idx);
                                        const pct = lineData.amount > 0 ? Math.round((stats.amount / lineData.amount) * 100) : 0;
                                        return (
                                            <div key={product} className={`rounded-lg border p-3 ${pStyle.bg} ${pStyle.border}`}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Package className="h-3.5 w-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                                                        <span className={`text-sm font-medium truncate ${pStyle.text}`} title={product}>{product}</span>
                                                    </div>
                                                    <span className="text-green-400 font-bold text-sm flex-shrink-0 ml-2">{formatCurrency(stats.amount, dominantCurrency)}</span>
                                                </div>
                                                {stats.faCode && (
                                                    <p className="text-[9px] text-gray-500 font-mono ml-5 mb-1">{stats.faCode}</p>
                                                )}
                                                <div className="flex items-center gap-4 ml-5 text-[10px]">
                                                    <span className="text-gray-500">{stats.count} orders</span>
                                                    <span className="text-gray-500">Avg: {formatCurrency(stats.amount / stats.count, dominantCurrency)}</span>
                                                    <span className="text-gray-500 dark:text-gray-400 font-medium">{pct}%</span>
                                                </div>
                                                <div className="w-full bg-gray-100 dark:bg-[#0a0a0a] rounded-full h-1 mt-1.5 ml-5" style={{ width: 'calc(100% - 20px)' }}>
                                                    <div className={`h-1 rounded-full ${pStyle.border.replace('border-', 'bg-')}`} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {sortedProducts.length === 0 && (
                                        <p className="text-center text-gray-500 text-sm py-6">No products found for this P&L line</p>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div >
    );
}
