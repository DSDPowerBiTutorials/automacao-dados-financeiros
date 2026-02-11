"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    ArrowDownCircle,
    ArrowUpCircle,
    TrendingUp,
    Download,
    RefreshCw,
    Search,
    CreditCard,
    Calendar,
    DollarSign,
    Building,
    Filter,
    Link2,
    AlertCircle,
    CheckCircle2,
    Loader2,
    Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ════════════════════════════════════════════════════════
// Types & Constants
// ════════════════════════════════════════════════════════

interface BankAccount {
    key: string;
    label: string;
    currency: string;
    bgColor: string;
    textColor: string;
}

const BANK_ACCOUNTS: BankAccount[] = [
    { key: "bankinter-eur", label: "Bankinter EUR", currency: "EUR", bgColor: "bg-blue-600", textColor: "text-blue-600" },
    { key: "bankinter-usd", label: "Bankinter USD", currency: "USD", bgColor: "bg-emerald-600", textColor: "text-emerald-600" },
    { key: "sabadell", label: "Sabadell EUR", currency: "EUR", bgColor: "bg-orange-600", textColor: "text-orange-600" },
    { key: "chase-usd", label: "Chase 9186", currency: "USD", bgColor: "bg-purple-600", textColor: "text-purple-600" },
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
    return null;
}

const formatCurrency = (value: number, currency = "EUR") =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);

const getGatewayColor = (gateway: string | null) => {
    switch (gateway?.toLowerCase()) {
        case "braintree": return "bg-blue-100 text-blue-800";
        case "stripe": return "bg-purple-100 text-purple-800";
        case "gocardless": return "bg-green-100 text-green-800";
        case "paypal": return "bg-yellow-100 text-yellow-800";
        case "amex": return "bg-indigo-100 text-indigo-800";
        case "quickbooks": return "bg-cyan-100 text-cyan-800";
        default: return "bg-gray-100 text-gray-800";
    }
};

// ════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════

export default function BankCashFlowPage() {
    const [selectedBanks, setSelectedBanks] = useState<Set<string>>(new Set(["bankinter-eur"]));
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Reconciliation
    const [isReconciling, setIsReconciling] = useState(false);
    const [reconcileResults, setReconcileResults] = useState<ReconcileResult[] | null>(null);

    // Filters
    const [dateRange, setDateRange] = useState({ start: "2025-01-01", end: "2025-12-31" });
    const [gatewayFilter, setGatewayFilter] = useState("all");
    const [flowFilter, setFlowFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [reconFilter, setReconFilter] = useState("all");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 150;

    // ─── Bank toggle ───
    const toggleBank = useCallback((bankKey: string) => {
        setSelectedBanks(prev => {
            const next = new Set(prev);
            if (next.has(bankKey)) { if (next.size > 1) next.delete(bankKey); }
            else next.add(bankKey);
            return next;
        });
        setCurrentPage(1);
    }, []);

    const selectSingleBank = useCallback((bankKey: string) => {
        setSelectedBanks(new Set([bankKey]));
        setCurrentPage(1);
    }, []);

    // ─── Load data ───
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Paginated fetch — Supabase default limit is 1000
            const allSources = BANK_ACCOUNTS.map(b => b.key);
            let allRows: any[] = [];
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

            const transactions: BankTransaction[] = (allRows).map(row => {
                const cd = row.custom_data || {};
                const source = row.source || "";
                const paymentSource = cd.paymentSource || null;
                const gateway = paymentSource?.toLowerCase() || detectGateway(row.description || "");

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
                    custom_data: cd,
                };
            });

            setBankTransactions(transactions);
        } catch (err) {
            console.error("Error loading data:", err);
            setError(err instanceof Error ? err.message : "Erro ao carregar dados");
        } finally {
            setIsLoading(false);
        }
    }, [dateRange]);

    useEffect(() => { loadData(); }, [loadData]);

    // ─── Reconciliation ───
    const runReconciliation = async (dryRun = false) => {
        setIsReconciling(true);
        setReconcileResults(null);
        try {
            const res = await fetch("/api/reconcile/run-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dryRun, banks: BANK_ACCOUNTS.map(b => b.key) }),
            });
            const data = await res.json();
            if (data.success) {
                setReconcileResults(data.banks);
                if (!dryRun) await loadData();
            } else {
                setError("Reconciliação falhou: " + (data.error || ""));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro na reconciliação");
        } finally {
            setIsReconciling(false);
        }
    };

    // ─── Filtered transactions ───
    const filteredTransactions = useMemo(() => {
        return bankTransactions.filter(tx => {
            if (!selectedBanks.has(tx.source)) return false;
            if (gatewayFilter !== "all" && (!tx.gateway || tx.gateway !== gatewayFilter)) return false;
            if (flowFilter === "income" && tx.amount <= 0) return false;
            if (flowFilter === "expense" && tx.amount >= 0) return false;
            if (reconFilter === "reconciled" && !tx.isReconciled) return false;
            if (reconFilter === "pending" && tx.isReconciled) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return (
                    tx.description.toLowerCase().includes(q) ||
                    tx.custom_data?.customer_name?.toLowerCase()?.includes(q) ||
                    tx.custom_data?.disbursement_reference?.toLowerCase()?.includes(q)
                );
            }
            return true;
        });
    }, [bankTransactions, selectedBanks, gatewayFilter, flowFilter, reconFilter, searchQuery]);

    // ─── Summary ───
    const summary = useMemo(() => {
        const inflows = filteredTransactions.filter(t => t.amount > 0);
        const outflows = filteredTransactions.filter(t => t.amount < 0);
        const totalInflow = inflows.reduce((s, t) => s + t.amount, 0);
        const totalOutflow = Math.abs(outflows.reduce((s, t) => s + t.amount, 0));
        const reconciledTx = filteredTransactions.filter(t => t.isReconciled && t.amount > 0);
        const reconciledAmount = reconciledTx.reduce((s, t) => s + t.amount, 0);
        const pendingTx = inflows.filter(t => !t.isReconciled && detectGateway(t.description));

        const byGateway: Record<string, { amount: number; count: number }> = {};
        inflows.forEach(t => {
            const key = t.paymentSource || t.gateway || "other";
            if (!byGateway[key]) byGateway[key] = { amount: 0, count: 0 };
            byGateway[key].amount += t.amount;
            byGateway[key].count++;
        });

        const byMonthMap: Record<string, { inflow: number; outflow: number; reconciled: number }> = {};
        filteredTransactions.forEach(t => {
            const month = t.date.substring(0, 7);
            if (!byMonthMap[month]) byMonthMap[month] = { inflow: 0, outflow: 0, reconciled: 0 };
            if (t.amount > 0) {
                byMonthMap[month].inflow += t.amount;
                if (t.isReconciled) byMonthMap[month].reconciled += t.amount;
            } else {
                byMonthMap[month].outflow += Math.abs(t.amount);
            }
        });

        const byMonth = Object.entries(byMonthMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, d]) => ({
                month,
                inflow: d.inflow,
                outflow: d.outflow,
                net: d.inflow - d.outflow,
                reconciled: d.reconciled,
                reconPct: d.inflow > 0 ? Math.round((d.reconciled / d.inflow) * 100) : 0,
            }));

        const byBank: Record<string, { inflows: number; outflows: number; count: number; reconciledCount: number }> = {};
        bankTransactions.forEach(t => {
            if (!byBank[t.source]) byBank[t.source] = { inflows: 0, outflows: 0, count: 0, reconciledCount: 0 };
            byBank[t.source].count++;
            if (t.amount > 0) {
                byBank[t.source].inflows += t.amount;
                if (t.isReconciled) byBank[t.source].reconciledCount++;
            } else {
                byBank[t.source].outflows += Math.abs(t.amount);
            }
        });

        return {
            totalInflow, totalOutflow,
            netCashFlow: totalInflow - totalOutflow,
            reconciledAmount,
            reconciledCount: reconciledTx.length,
            reconciledPct: totalInflow > 0 ? Math.round((reconciledAmount / totalInflow) * 100) : 0,
            pendingCount: pendingTx.length,
            transactionCount: filteredTransactions.length,
            byGateway, byMonth, byBank,
        };
    }, [filteredTransactions, bankTransactions]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredTransactions.slice(start, start + pageSize);
    }, [filteredTransactions, currentPage]);
    const totalPages = Math.ceil(filteredTransactions.length / pageSize);

    // ─── Export CSV ───
    const exportCSV = () => {
        const headers = ["Banco", "Data", "Descrição", "Montante", "Moeda", "Gateway", "Match Type", "Referência", "Reconciliado"];
        const rows = filteredTransactions.map(t => [
            BANK_ACCOUNTS.find(b => b.key === t.source)?.label || t.source,
            t.date,
            '"' + t.description.replace(/"/g, '""') + '"',
            t.amount.toFixed(2),
            t.currency,
            t.paymentSource || t.gateway || "",
            t.matchType || "",
            t.custom_data?.disbursement_reference || "",
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

    // ════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════

    if (isLoading) {
        return (
            <div className="min-h-full px-6 py-6 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">A carregar extratos bancários...</p>
                </div>
            </div>
        );
    }

    const showMultiBankColumn = selectedBanks.size > 1;

    return (
        <div className="min-h-full px-6 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <header className="page-header-standard">
                    <h1 className="header-title">Cash Flow Bancário</h1>
                    <p className="header-subtitle">
                        Extratos bancários consolidados com reconciliação de pagamentos
                    </p>
                </header>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => runReconciliation(true)} disabled={isReconciling} className="gap-2" title="Simular reconciliação (dry run)">
                        {isReconciling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        Preview
                    </Button>
                    <Button onClick={() => runReconciliation(false)} disabled={isReconciling} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                        {isReconciling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                        Reconciliar
                    </Button>
                    <Button variant="outline" onClick={loadData} className="gap-2">
                        <RefreshCw className="h-4 w-4" /> Refresh
                    </Button>
                    <Button variant="outline" onClick={exportCSV} className="gap-2">
                        <Download className="h-4 w-4" /> CSV
                    </Button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error}
                    <button onClick={() => setError(null)} className="ml-4 underline text-sm">Fechar</button>
                </div>
            )}

            {/* Reconciliation Results */}
            {reconcileResults && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <h3 className="font-semibold text-emerald-800">Resultado da Reconciliação</h3>
                        <button onClick={() => setReconcileResults(null)} className="ml-auto text-sm text-emerald-600 underline">Fechar</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {reconcileResults.map(r => (
                            <div key={r.bankSource} className="bg-white rounded-lg p-3 border">
                                <p className="text-sm font-medium">{BANK_ACCOUNTS.find(b => b.key === r.bankSource)?.label || r.bankSource}</p>
                                {r.success ? (
                                    <div className="text-xs text-gray-600 mt-1">
                                        <span className="text-emerald-600 font-semibold">{r.matched}</span> conciliadas |{" "}
                                        <span className="text-amber-600 font-semibold">{r.unmatched}</span> pendentes
                                    </div>
                                ) : (
                                    <p className="text-xs text-red-600 mt-1">{r.error || "Sem dados"}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bank Account Tabs */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium text-gray-600 mr-2">Contas Bancárias:</span>
                        {BANK_ACCOUNTS.map(bank => {
                            const isActive = selectedBanks.has(bank.key);
                            const bankStats = summary.byBank[bank.key];
                            const hasData = bankStats && bankStats.count > 0;
                            return (
                                <button
                                    key={bank.key}
                                    onClick={() => toggleBank(bank.key)}
                                    onDoubleClick={() => selectSingleBank(bank.key)}
                                    className={[
                                        "flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all",
                                        isActive ? bank.bgColor + " text-white border-transparent shadow-md" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300",
                                        !hasData ? "opacity-50" : "",
                                    ].join(" ")}
                                    title={hasData ? "Duplo-clique para selecionar apenas este banco" : "Sem dados no período"}
                                >
                                    <Building className="h-4 w-4" />
                                    <span className="font-medium text-sm">{bank.label}</span>
                                    {bankStats && (
                                        <span className={"text-xs px-1.5 py-0.5 rounded-full " + (isActive ? "bg-white/20" : "bg-gray-100")}>
                                            {bankStats.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                        <div className="ml-auto">
                            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedBanks(new Set(BANK_ACCOUNTS.map(b => b.key)))}>
                                Todos
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="bg-green-100 p-2 rounded-lg"><ArrowDownCircle className="h-5 w-5 text-green-600" /></div><div><p className="text-xs text-gray-600">Entradas</p><p className="text-lg font-bold text-green-600">{formatCurrency(summary.totalInflow)}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="bg-red-100 p-2 rounded-lg"><ArrowUpCircle className="h-5 w-5 text-red-600" /></div><div><p className="text-xs text-gray-600">Saídas</p><p className="text-lg font-bold text-red-600">{formatCurrency(summary.totalOutflow)}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="bg-blue-100 p-2 rounded-lg"><TrendingUp className="h-5 w-5 text-blue-600" /></div><div><p className="text-xs text-gray-600">Saldo</p><p className={"text-lg font-bold " + (summary.netCashFlow >= 0 ? "text-green-600" : "text-red-600")}>{formatCurrency(summary.netCashFlow)}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="bg-emerald-100 p-2 rounded-lg"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div><div><p className="text-xs text-gray-600">Conciliadas</p><p className="text-lg font-bold text-emerald-600">{summary.reconciledCount}</p><p className="text-xs text-gray-500">{summary.reconciledPct}% das entradas</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="bg-amber-100 p-2 rounded-lg"><AlertCircle className="h-5 w-5 text-amber-600" /></div><div><p className="text-xs text-gray-600">Pendentes</p><p className="text-lg font-bold text-amber-600">{summary.pendingCount}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="bg-violet-100 p-2 rounded-lg"><DollarSign className="h-5 w-5 text-violet-600" /></div><div><p className="text-xs text-gray-600">Valor Conciliado</p><p className="text-lg font-bold text-violet-600">{formatCurrency(summary.reconciledAmount)}</p></div></div></CardContent></Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><Filter className="h-5 w-5" />Filtros</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Data Início</label><Input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} /></div>
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Data Fim</label><Input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} /></div>
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Gateway</label>
                            <Select value={gatewayFilter} onValueChange={setGatewayFilter}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="braintree">Braintree</SelectItem><SelectItem value="stripe">Stripe</SelectItem><SelectItem value="gocardless">GoCardless</SelectItem><SelectItem value="paypal">PayPal</SelectItem><SelectItem value="amex">Amex</SelectItem></SelectContent></Select>
                        </div>
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Fluxo</label>
                            <Select value={flowFilter} onValueChange={setFlowFilter}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="income">Entradas</SelectItem><SelectItem value="expense">Saídas</SelectItem></SelectContent></Select>
                        </div>
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Conciliação</label>
                            <Select value={reconFilter} onValueChange={setReconFilter}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="reconciled">Conciliadas</SelectItem><SelectItem value="pending">Pendentes</SelectItem></SelectContent></Select>
                        </div>
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Pesquisa</label>
                            <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Descrição, cliente..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" /></div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Analytics: Revenue by Gateway + Bank Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><CreditCard className="h-5 w-5" />Revenue por Gateway</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {Object.entries(summary.byGateway)
                                .sort((a, b) => b[1].amount - a[1].amount)
                                .map(([gw, data]) => (
                                    <div key={gw} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge className={getGatewayColor(gw)}>{gw === "other" ? "Outros" : gw.charAt(0).toUpperCase() + gw.slice(1)}</Badge>
                                            <span className="text-xs text-gray-500">({data.count})</span>
                                        </div>
                                        <span className="font-semibold text-green-600">{formatCurrency(data.amount)}</span>
                                    </div>
                                ))}
                            {Object.keys(summary.byGateway).length === 0 && <p className="text-sm text-gray-400">Nenhuma entrada no período</p>}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Building className="h-5 w-5" />Resumo por Conta</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {BANK_ACCOUNTS.map(bank => {
                                const stats = summary.byBank[bank.key];
                                if (!stats || stats.count === 0) return (
                                    <div key={bank.key} className="flex items-center justify-between opacity-40">
                                        <span className="text-sm">{bank.label}</span>
                                        <span className="text-xs text-gray-400">Sem dados</span>
                                    </div>
                                );
                                return (
                                    <div key={bank.key} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={"w-3 h-3 rounded-full " + bank.bgColor} />
                                            <span className="text-sm font-medium">{bank.label}</span>
                                            <span className="text-xs text-gray-500">({stats.count} mov.)</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-semibold text-green-600 text-sm">+{formatCurrency(stats.inflows, bank.currency)}</span>
                                            <span className="text-gray-400 mx-1">|</span>
                                            <span className="font-semibold text-red-600 text-sm">-{formatCurrency(stats.outflows, bank.currency)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Monthly Flow Table */}
            <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5" />Fluxo Mensal</CardTitle></CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mês</TableHead>
                                    <TableHead className="text-right">Entradas</TableHead>
                                    <TableHead className="text-right">Saídas</TableHead>
                                    <TableHead className="text-right">Saldo</TableHead>
                                    <TableHead className="text-right">Conciliado</TableHead>
                                    <TableHead className="text-right">% Conc.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summary.byMonth.map(m => (
                                    <TableRow key={m.month}>
                                        <TableCell className="font-medium">{m.month}</TableCell>
                                        <TableCell className="text-right text-green-600">{formatCurrency(m.inflow)}</TableCell>
                                        <TableCell className="text-right text-red-600">{formatCurrency(m.outflow)}</TableCell>
                                        <TableCell className={"text-right font-semibold " + (m.net >= 0 ? "text-green-600" : "text-red-600")}>{formatCurrency(m.net)}</TableCell>
                                        <TableCell className="text-right text-emerald-600">{formatCurrency(m.reconciled)}</TableCell>
                                        <TableCell className="text-right">
                                            <span className={"text-sm font-semibold " + (m.reconPct >= 80 ? "text-emerald-600" : m.reconPct >= 50 ? "text-amber-600" : "text-red-600")}>{m.reconPct}%</span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Bank Movements Table */}
            <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Building className="h-5 w-5" />Movimentos Bancários ({filteredTransactions.length})</CardTitle></CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    {showMultiBankColumn && <TableHead>Banco</TableHead>}
                                    <TableHead>Descrição</TableHead>
                                    <TableHead>Gateway</TableHead>
                                    <TableHead>Match Type</TableHead>
                                    <TableHead>Referência</TableHead>
                                    <TableHead className="text-right">Montante</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map(tx => {
                                    const bankInfo = BANK_ACCOUNTS.find(b => b.key === tx.source);
                                    return (
                                        <TableRow key={tx.id} className={tx.isReconciled ? "bg-green-50/30" : ""}>
                                            <TableCell className="whitespace-nowrap text-sm">{tx.date}</TableCell>
                                            {showMultiBankColumn && (
                                                <TableCell><Badge variant="outline" className={"text-xs " + (bankInfo?.textColor || "")}>{bankInfo?.label || tx.source}</Badge></TableCell>
                                            )}
                                            <TableCell className="max-w-[250px] truncate text-sm" title={tx.description}>{tx.description}</TableCell>
                                            <TableCell>
                                                {(tx.paymentSource || tx.gateway) ? (
                                                    <Badge className={getGatewayColor(tx.paymentSource || tx.gateway)}>
                                                        {(tx.paymentSource || tx.gateway || "").charAt(0).toUpperCase() + (tx.paymentSource || tx.gateway || "").slice(1)}
                                                    </Badge>
                                                ) : <span className="text-gray-400">—</span>}
                                            </TableCell>
                                            <TableCell>
                                                {tx.matchType ? (
                                                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">{tx.matchType.replace(/_/g, " ")}</span>
                                                ) : <span className="text-gray-300">—</span>}
                                            </TableCell>
                                            <TableCell>
                                                {tx.custom_data?.disbursement_reference ? (
                                                    <code className="text-xs bg-gray-100 px-1 rounded">{String(tx.custom_data.disbursement_reference).substring(0, 20)}</code>
                                                ) : <span className="text-gray-300">—</span>}
                                            </TableCell>
                                            <TableCell className={"text-right font-semibold " + (tx.amount >= 0 ? "text-green-600" : "text-red-600")}>
                                                {formatCurrency(tx.amount, tx.currency)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {tx.isReconciled ? <Link2 className="h-4 w-4 text-green-600 mx-auto" /> :
                                                    tx.gateway ? <AlertCircle className="h-4 w-4 text-amber-500 mx-auto" /> :
                                                        <span className="text-gray-300">—</span>}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                            <p className="text-sm text-gray-600">{(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredTransactions.length)} de {filteredTransactions.length}</p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Anterior</Button>
                                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Próximo</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
