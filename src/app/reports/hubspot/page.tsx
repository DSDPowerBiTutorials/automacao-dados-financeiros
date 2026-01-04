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
    custom_data?: {
        deal_id?: string;
        stage?: string;
        pipeline?: string;
        owner?: string;
        company?: string;
        currency?: string;
    };
    [key: string]: any;
}

export default function HubSpotReportPage() {
    const [rows, setRows] = useState<HubSpotRow[]>([]);
    const [filteredRows, setFilteredRows] = useState<HubSpotRow[]>([]);
    const [paginatedRows, setPaginatedRows] = useState<HubSpotRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingData, setEditingData] = useState<Partial<HubSpotRow>>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [filterReconciled, setFilterReconciled] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(50); // Mostrar 50 linhas por página
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
            totalAmount: rows.reduce((sum, r) => sum + r.amount, 0),
            reconciledAmount: rows
                .filter((r) => r.reconciled)
                .reduce((sum, r) => sum + r.amount, 0),
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                                        ✓
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Data
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Deal ID
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Descrição
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Empresa
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                                        Stage
                                    </th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                                        Valor
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                                        Ações
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {paginatedRows.map((row) => {
                                    const isEditing = editingId === row.id;
                                    return (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <Checkbox
                                                    checked={row.reconciled}
                                                    onCheckedChange={() =>
                                                        toggleReconciled(row.id, row.reconciled)
                                                    }
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {isEditing ? (
                                                    <Input
                                                        type="date"
                                                        value={editingData.date}
                                                        onChange={(e) =>
                                                            setEditingData({
                                                                ...editingData,
                                                                date: e.target.value,
                                                            })
                                                        }
                                                        className="w-32"
                                                    />
                                                ) : (
                                                    formatDate(row.date)
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-xs">
                                                {row.custom_data?.deal_id || "-"}
                                            </td>
                                            <td className="px-4 py-3 text-sm max-w-xs">
                                                {isEditing ? (
                                                    <Input
                                                        value={editingData.description}
                                                        onChange={(e) =>
                                                            setEditingData({
                                                                ...editingData,
                                                                description: e.target.value,
                                                            })
                                                        }
                                                    />
                                                ) : (
                                                    <div className="truncate" title={row.description}>
                                                        {row.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {row.custom_data?.company || "-"}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <Badge variant="outline">
                                                    {row.custom_data?.stage || "-"}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-medium">
                                                {isEditing ? (
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={editingData.amount}
                                                        onChange={(e) =>
                                                            setEditingData({
                                                                ...editingData,
                                                                amount: parseFloat(e.target.value),
                                                            })
                                                        }
                                                        className="w-28 text-right"
                                                    />
                                                ) : (
                                                    formatCurrency(row.amount)
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {row.reconciled ? (
                                                    <Badge className="bg-green-100 text-green-700">
                                                        Conciliado
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary">Pendente</Badge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2 justify-center">
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
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleDelete(row.id)}
                                                                className="text-red-600"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
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
