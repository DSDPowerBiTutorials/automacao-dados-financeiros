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
    RefreshCw,
    Database,
    Zap,
    Link as LinkIcon,
    AlertTriangle,
    TrendingUp,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/formatters";

interface HubSpotRow {
    id: string;
    date: string;
    description: string;
    amount: number;
    reconciled: boolean;
    customer_email?: string;
    customer_name?: string;
    matched_with?: string;
    matched_source?: string;
    match_confidence?: number;
    match_details?: {
        emailScore?: number;
        nameScore?: number;
        dateScore?: number;
        amountScore?: number;
        totalScore?: number;
        method?: string;
    };
    matched_at?: string;
    custom_data?: {
        deal_id?: string;
        dealname?: string;
        stage?: string;
        pipeline?: string;
        owner?: string;
        company?: string;
        currency?: string;
        closedate?: string;
        amount?: number;
        dealstage?: string;
        hs_object_id?: string;
        // Campos para "All Totals"
        quantity?: number;
        items_total?: number;
        discount_amount?: number;
        final_price?: number;
    };
    [key: string]: any;
}

export default function HubSpotReportPage() {
    const [rows, setRows] = useState<HubSpotRow[]>([]);
    const [filteredRows, setFilteredRows] = useState<HubSpotRow[]>([]);
    const [paginatedRows, setPaginatedRows] = useState<HubSpotRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [matching, setMatching] = useState(false);
    const [matchStats, setMatchStats] = useState<any>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingData, setEditingData] = useState<Partial<HubSpotRow>>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [filterReconciled, setFilterReconciled] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(50);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [alert, setAlert] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    useEffect(() => {
        fetchRows();
    }, []);

    useEffect(() => {
        filterRows();
    }, [rows, searchTerm, filterReconciled]);

    useEffect(() => {
        // Aplicar paginação aos filteredRows
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        setPaginatedRows(filteredRows.slice(startIndex, endIndex));
    }, [filteredRows, currentPage, pageSize]);

    const fetchRows = async () => {
        try {
            setLoading(true);
            setCurrentPage(1); // Resetar página ao carregar novos dados

            // Usar range com limit para carregar apenas dados paginados do servidor
            const { data, error, count } = await supabase
                .from("csv_rows")
                .select("*", { count: "exact" })
                .eq("source", "hubspot")
                .order("date", { ascending: false });

            if (error) throw error;
            setRows(data || []);
        } catch (error: any) {
            showAlert("error", `Erro ao carregar dados: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const filterRows = () => {
        let filtered = [...rows];

        if (searchTerm) {
            filtered = filtered.filter(
                (row) =>
                    row.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    row.custom_data?.deal_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    row.custom_data?.company?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (filterReconciled !== "all") {
            filtered = filtered.filter((row) =>
                filterReconciled === "reconciled" ? row.reconciled : !row.reconciled
            );
        }

        setFilteredRows(filtered);
    };

    const syncFromSQLServer = async () => {
        try {
            setSyncing(true);
            showAlert("success", "Sincronizando dados do SQL Server...");

            const response = await fetch("/api/hubspot/sync", {
                method: "POST",
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Erro na sincronização");
            }

            showAlert("success", result.message);
            await fetchRows();
        } catch (error: any) {
            showAlert("error", `Erro ao sincronizar: ${error.message}`);
        } finally {
            setSyncing(false);
        }
    };

    const runAutoMatch = async (dryRun: boolean = false) => {
        try {
            setMatching(true);
            showAlert("success", dryRun ? "Analisando matches possíveis..." : "Executando auto-match...");

            const response = await fetch("/api/hubspot/auto-match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dryRun }),
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Erro no auto-match");
            }

            setMatchStats(result.stats);
            showAlert("success", dryRun
                ? `Análise completa: ${result.stats.matched} matches encontrados (${result.stats.averageConfidence}% confiança média)`
                : `Auto-match completo: ${result.stats.matched} registros reconciliados`
            );

            if (!dryRun) {
                await fetchRows();
            }
        } catch (error: any) {
            showAlert("error", `Erro no auto-match: ${error.message}`);
        } finally {
            setMatching(false);
        }
    };

    const getMatchIndicator = (row: HubSpotRow) => {
        if (!row.matched_with) return null;

        const confidence = row.match_confidence || 0;
        if (confidence >= 85) return <Badge className="bg-green-500">🟢 {confidence}%</Badge>;
        if (confidence >= 70) return <Badge className="bg-yellow-500">🟡 {confidence}%</Badge>;
        return <Badge className="bg-red-500">🔴 {confidence}%</Badge>;
    };

    const getStatusIcon = (stage: string) => {
        // Mapear status do HubSpot para ícones coloridos
        const stageColors: Record<string, string> = {
            'closedwon': 'text-green-500',
            'closedlost': 'text-red-500',
            'contractsent': 'text-blue-500',
            'qualifiedtobuy': 'text-yellow-500',
            'appointmentscheduled': 'text-orange-500',
            'presentationscheduled': 'text-purple-500',
        };

        const normalizedStage = stage?.toLowerCase().replace(/[^a-z]/g, '') || '';
        const color = stageColors[normalizedStage] || 'text-gray-500';

        return <span className={`text-2xl ${color}`}>●</span>;
    };

    const getPaidStatusIcon = (reconciled: boolean) => {
        return reconciled
            ? <span className="text-red-500 text-xl">●</span>  // Unpaid
            : <span className="text-green-500 text-xl">●</span>; // Paid
    };

    const toggleRowExpansion = (rowId: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(rowId)) {
                newSet.delete(rowId);
            } else {
                newSet.add(rowId);
            }
            return newSet;
        });
    };

    const handleEdit = (row: HubSpotRow) => {
        setEditingId(row.id);
        setEditingData({
            date: row.date,
            description: row.description,
            amount: row.amount,
            reconciled: row.reconciled,
        });
    };

    const handleSave = async (id: string) => {
        try {
            const { error } = await supabase
                .from("csv_rows")
                .update(editingData)
                .eq("id", id);

            if (error) throw error;

            setRows(
                rows.map((row) => (row.id === id ? { ...row, ...editingData } : row))
            );
            setEditingId(null);
            showAlert("success", "Linha atualizada com sucesso");
        } catch (error: any) {
            showAlert("error", `Erro ao salvar: ${error.message}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja deletar esta linha?")) return;

        try {
            const { error } = await supabase.from("csv_rows").delete().eq("id", id);

            if (error) throw error;

            setRows(rows.filter((row) => row.id !== id));
            showAlert("success", "Linha deletada com sucesso");
        } catch (error: any) {
            showAlert("error", `Erro ao deletar: ${error.message}`);
        }
    };

    const toggleReconciled = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from("csv_rows")
                .update({ reconciled: !currentStatus })
                .eq("id", id);

            if (error) throw error;

            setRows(
                rows.map((row) =>
                    row.id === id ? { ...row, reconciled: !currentStatus } : row
                )
            );
            showAlert("success", "Status atualizado");
        } catch (error: any) {
            showAlert("error", `Erro ao atualizar: ${error.message}`);
        }
    };

    const exportToCSV = () => {
        const headers = ["Data", "Descrição", "Valor", "Conciliado", "Deal ID", "Stage", "Pipeline", "Owner", "Company"];
        const csvData = filteredRows.map((row) => [
            row.date,
            row.description,
            row.amount,
            row.reconciled ? "Sim" : "Não",
            row.custom_data?.deal_id || "",
            row.custom_data?.stage || "",
            row.custom_data?.pipeline || "",
            row.custom_data?.owner || "",
            row.custom_data?.company || "",
        ]);

        const csv = [headers, ...csvData].map((row) => row.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hubspot-report-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
    };

    const showAlert = (type: "success" | "error", message: string) => {
        setAlert({ type, message });
        setTimeout(() => setAlert(null), 5000);
    };

    const stats = useMemo(() => {
        return {
            total: rows.length,
            reconciled: rows.filter((r) => r.reconciled).length,
            pending: rows.filter((r) => !r.reconciled).length,
            matched: rows.filter((r) => r.matched_with).length,
            unmatched: rows.filter((r) => !r.matched_with).length,
            totalAmount: rows.reduce((sum, r) => sum + r.amount, 0),
            reconciledAmount: rows
                .filter((r) => r.reconciled)
                .reduce((sum, r) => sum + r.amount, 0),
            avgConfidence: rows.filter(r => r.match_confidence).length > 0
                ? Math.round(
                    rows
                        .filter(r => r.match_confidence)
                        .reduce((sum, r) => sum + (r.match_confidence || 0), 0) /
                    rows.filter(r => r.match_confidence).length
                )
                : 0,
        };
    }, [rows]);

    // Calcular total de registros após filtros (para paginação correta)
    const totalFilteredCount = filteredRows.length;
    const totalPages = Math.ceil(totalFilteredCount / pageSize);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold">HubSpot Deals</h1>
                        <p className="text-gray-500">
                            Dados sincronizados via SQL Server Data Warehouse
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={syncFromSQLServer}
                        disabled={syncing}
                        variant="outline"
                        className="gap-2"
                    >
                        {syncing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Sincronizando...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4" />
                                Sincronizar
                            </>
                        )}
                    </Button>
                    <Button onClick={exportToCSV} variant="outline" className="gap-2">
                        <Download className="w-4 h-4" />
                        Exportar
                    </Button>
                </div>
            </div>

            {/* Alert */}
            {alert && (
                <Alert
                    className={
                        alert.type === "success"
                            ? "bg-green-50 border-green-200"
                            : "bg-red-50 border-red-200"
                    }
                >
                    {alert.type === "success" ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <AlertDescription>{alert.message}</AlertDescription>
                </Alert>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Total Deals
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Conciliados
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {stats.reconciled}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Pendentes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">
                            {stats.pending}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-purple-200 bg-purple-50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-1">
                            <LinkIcon className="w-4 h-4" />
                            Matched
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">
                            {stats.matched}
                        </div>
                        <p className="text-xs text-purple-600 mt-1">
                            {stats.avgConfidence}% confiança média
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Valor Total
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(stats.totalAmount)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Conciliado
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(stats.reconciledAmount)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Auto-Match Section */}
            <Card className="border-purple-200">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="w-5 h-5 text-purple-600" />
                                Auto-Matching Inteligente
                            </CardTitle>
                            <CardDescription>
                                Sistema de reconciliação automática com matching por email, nome, data e valor
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => runAutoMatch(true)}
                                disabled={matching}
                                variant="outline"
                                className="gap-2"
                            >
                                {matching ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Analisando...
                                    </>
                                ) : (
                                    <>
                                        <TrendingUp className="w-4 h-4" />
                                        Simular Matches
                                    </>
                                )}
                            </Button>
                            <Button
                                onClick={() => runAutoMatch(false)}
                                disabled={matching}
                                className="gap-2 bg-purple-600 hover:bg-purple-700"
                            >
                                {matching ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Processando...
                                    </>
                                ) : (
                                    <>
                                        <LinkIcon className="w-4 h-4" />
                                        Executar Auto-Match
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                {matchStats && (
                    <CardContent className="bg-purple-50">
                        <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-gray-600">Analisados</p>
                                <p className="text-lg font-bold">{matchStats.analyzed}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Matches Encontrados</p>
                                <p className="text-lg font-bold text-green-600">{matchStats.matched}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Sem Match</p>
                                <p className="text-lg font-bold text-yellow-600">{matchStats.unmatched}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Confiança Média</p>
                                <p className="text-lg font-bold text-purple-600">{matchStats.averageConfidence}%</p>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                    <Input
                        placeholder="Buscar por descrição, deal ID, empresa..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-md"
                    />
                    <select
                        value={filterReconciled}
                        onChange={(e) => setFilterReconciled(e.target.value)}
                        className="border rounded px-3 py-2"
                    >
                        <option value="all">Todos</option>
                        <option value="reconciled">Conciliados</option>
                        <option value="pending">Pendentes</option>
                    </select>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">

                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Order
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Reference
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Date Ordered
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Date Paid
                                    </th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                                        Total Paid
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                                        Paid Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        All Totals
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Customer
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {paginatedRows.map((row) => {
                                    const isEditing = editingId === row.id;
                                    const isExpanded = expandedRows.has(row.id);

                                    return (
                                        <>
                                            <tr key={row.id} className="hover:bg-gray-50">
                                                {/* Checkbox */}
                                                <td className="px-4 py-3">
                                                    <Checkbox
                                                        checked={row.reconciled}
                                                        onCheckedChange={() =>
                                                            toggleReconciled(row.id, row.reconciled)
                                                        }
                                                    />
                                                </td>

                                                {/* Order (Deal ID) */}
                                                <td className="px-4 py-3">
                                                    <a
                                                        href={`#deal-${row.custom_data?.deal_id}`}
                                                        className="text-blue-600 hover:underline font-mono text-sm"
                                                    >
                                                        {row.custom_data?.deal_id || "-"}
                                                    </a>
                                                </td>

                                                {/* Reference (Deal Name) */}
                                                <td className="px-4 py-3 text-sm font-mono">
                                                    {row.custom_data?.dealname || row.custom_data?.deal_id || "-"}
                                                </td>

                                                {/* Status (com ícone colorido) */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {getStatusIcon(row.custom_data?.stage || "")}
                                                        <span className="text-sm">
                                                            {row.custom_data?.stage || "Unknown"}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Date Ordered (closedate) */}
                                                <td className="px-4 py-3 text-sm">
                                                    {row.date ? new Date(row.date).toLocaleString('en-US', {
                                                        hour: 'numeric',
                                                        minute: '2-digit',
                                                        hour12: true
                                                    }) : "-"}
                                                </td>

                                                {/* Date Paid (matched_at) */}
                                                <td className="px-4 py-3 text-sm">
                                                    {row.matched_at ? formatDate(row.matched_at) : "-"}
                                                </td>

                                                {/* Total Paid */}
                                                <td className="px-4 py-3 text-right font-medium">
                                                    {formatCurrency(row.amount)}
                                                </td>

                                                {/* Paid Status (com ícone) */}
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {getPaidStatusIcon(row.reconciled)}
                                                        <span className="text-sm">
                                                            {row.reconciled ? "Paid" : "Unpaid"}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* All Totals (expandível) */}
                                                <td className="px-4 py-3">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleRowExpansion(row.id)}
                                                        className="w-full justify-start"
                                                    >
                                                        <div className="flex flex-col items-start text-xs">
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-semibold">Qty</span>
                                                                <span className="text-gray-600">
                                                                    {row.custom_data?.quantity || 0}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-semibold">Price</span>
                                                                <span className="text-gray-600">
                                                                    {formatCurrency(row.custom_data?.final_price || row.amount)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </Button>
                                                </td>

                                                {/* Customer (email) */}
                                                <td className="px-4 py-3">
                                                    <a
                                                        href={`mailto:${row.customer_email}`}
                                                        className="text-blue-600 hover:underline text-sm truncate block max-w-[200px]"
                                                        title={row.customer_email}
                                                    >
                                                        {row.customer_email || "-"}
                                                    </a>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-4 py-3">
                                                    <div className="flex gap-1 justify-center">
                                                        {isEditing ? (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => handleSave(row.id)}
                                                                >
                                                                    <Save className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => setEditingId(null)}
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => handleEdit(row)}
                                                                    title="Edit"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => handleDelete(row.id)}
                                                                    className="text-red-600"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expanded Row - All Totals Details */}
                                            {isExpanded && (
                                                <tr key={`${row.id}-expanded`} className="bg-gray-50">
                                                    <td colSpan={11} className="px-4 py-4">
                                                        <div className="ml-8 p-4 bg-white rounded border border-gray-200">
                                                            <h4 className="font-semibold text-sm mb-3 text-gray-700">
                                                                Order Details
                                                            </h4>
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                                <div>
                                                                    <span className="text-gray-600">Qty:</span>
                                                                    <p className="font-medium">
                                                                        {row.custom_data?.quantity || 0}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-600">Items:</span>
                                                                    <p className="font-medium text-green-600">
                                                                        {formatCurrency(row.custom_data?.items_total || row.amount)}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-600">Discounts:</span>
                                                                    <p className="font-medium text-red-600">
                                                                        -{formatCurrency(row.custom_data?.discount_amount || 0)}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-600">Price:</span>
                                                                    <p className="font-medium text-blue-600">
                                                                        {formatCurrency(row.custom_data?.final_price || row.amount)}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {row.customer_name && (
                                                                <div className="mt-3 pt-3 border-t border-gray-200">
                                                                    <span className="text-gray-600 text-sm">Customer:</span>
                                                                    <p className="font-medium">{row.customer_name}</p>
                                                                    <p className="text-sm text-gray-500">{row.customer_email}</p>
                                                                </div>
                                                            )}

                                                            {row.custom_data?.company && (
                                                                <div className="mt-2">
                                                                    <span className="text-gray-600 text-sm">Company:</span>
                                                                    <p className="font-medium">{row.custom_data.company}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filteredRows.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Nenhum deal encontrado</p>
                            <Button
                                onClick={syncFromSQLServer}
                                variant="outline"
                                className="mt-4"
                            >
                                Sincronizar Agora
                            </Button>
                        </div>
                    )}

                    {/* Paginação */}
                    {filteredRows.length > 0 && (
                        <div className="flex items-center justify-between p-4 bg-gray-50 border-t">
                            <div className="text-sm text-gray-600">
                                Mostrando {totalFilteredCount === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, totalFilteredCount)} de {totalFilteredCount} registros
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    variant="outline"
                                    size="sm"
                                >
                                    Anterior
                                </Button>
                                <div className="flex items-center gap-2 px-3">
                                    <span className="text-sm font-medium">
                                        Página {currentPage} de {totalPages}
                                    </span>
                                </div>
                                <Button
                                    onClick={() => setCurrentPage(currentPage + 1)}
                                    disabled={currentPage >= totalPages}
                                    variant="outline"
                                    size="sm"
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
