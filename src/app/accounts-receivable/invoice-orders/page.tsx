"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Upload,
    Download,
    Search,
    ArrowUpDown,
    Trash2,
    Pencil,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    FileText,
    Loader2,
    Link2,
    X,
    Eye,
    Filter,
    ArrowUp,
    ArrowDown,
    Zap,
    Settings2,
    Columns,
    Check
} from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { ScopeSelector } from "@/components/app/scope-selector";
import { type ScopeType, matchesScope } from "@/lib/scope-utils";
import { useGlobalScope } from "@/contexts/global-scope-context";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

// Interface para Invoice Order (dados do CSV)
interface InvoiceOrder {
    id: string;
    invoice_id: string;
    invoice_number: string;
    order_id: string | null;
    order_number: string | null;
    date: string;
    description: string;
    amount: number;
    currency: string;
    reconciled: boolean;
    source: string;
    custom_data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

// Colunas disponíveis para exibição
interface ColumnConfig {
    key: string;
    label: string;
    visible: boolean;
    width?: string;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
    { key: "invoice_number", label: "Invoice #", visible: true, width: "100px" },
    { key: "order_number", label: "Order #", visible: true, width: "90px" },
    { key: "date", label: "Date", visible: true, width: "90px" },
    { key: "description", label: "Description", visible: true, width: "200px" },
    { key: "financial_account", label: "Fin. Account", visible: true, width: "120px" },
    { key: "amount", label: "Amount", visible: true, width: "100px" },
    { key: "currency", label: "Currency", visible: true, width: "70px" },
    { key: "reconciled", label: "Status", visible: true, width: "100px" }
];

function formatEuropeanNumber(value: number, decimals: number = 2): string {
    return value.toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatDate(date: string | null): string {
    if (!date) return "-";
    const d = new Date(date);
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
}

export default function InvoiceOrdersPage() {
    const { selectedScope, setSelectedScope } = useGlobalScope();
    const [invoiceOrders, setInvoiceOrders] = useState<InvoiceOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortField, setSortField] = useState<string>("date");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [showReconciled, setShowReconciled] = useState(true);
    const [selectedRow, setSelectedRow] = useState<InvoiceOrder | null>(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [reconciling, setReconciling] = useState(false);
    const [bankReconciling, setBankReconciling] = useState(false);

    // Column visibility
    const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
    const [allCustomColumns, setAllCustomColumns] = useState<ColumnConfig[]>([]);

    // Load data
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from("csv_rows")
                .select("*")
                .eq("source", "invoice-orders")
                .order("date", { ascending: false });

            if (fetchError) throw fetchError;

            const mappedData: InvoiceOrder[] = (data || []).map((row) => ({
                id: row.id,
                invoice_id: row.custom_data?.ID || row.id,
                invoice_number: row.custom_data?.Number || row.description || "",
                order_id: row.custom_data?.order_id || null,
                order_number: row.custom_data?.order_number || null,
                date: row.date,
                description: row.description || "",
                amount: parseFloat(row.amount) || 0,
                currency: row.custom_data?.currency || "EUR",
                reconciled: row.reconciled || false,
                source: row.source,
                custom_data: row.custom_data || {},
                created_at: row.created_at,
                updated_at: row.updated_at
            }));

            setInvoiceOrders(mappedData);

            // Extract custom columns from first row
            if (mappedData.length > 0 && mappedData[0].custom_data) {
                const customKeys = Object.keys(mappedData[0].custom_data).filter(
                    (key) =>
                        !["ID", "Number", "order_id", "order_number", "currency", "file_name", "row_index"].includes(key)
                );
                const customCols: ColumnConfig[] = customKeys.map((key) => ({
                    key: `custom_${key}`,
                    label: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
                    visible: false,
                    width: "120px"
                }));
                setAllCustomColumns(customCols);
            }
        } catch (err) {
            console.error("Error loading data:", err);
            setError("Erro ao carregar dados");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Handle file upload
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/csv/invoice-orders", {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                toast({
                    title: "Erro no upload",
                    description: result.error || "Erro desconhecido",
                    variant: "destructive"
                });
                return;
            }

            toast({
                title: "Upload concluído",
                description: `${result.data.rowCount} invoices importadas com sucesso!`
            });

            loadData();
        } catch (err) {
            console.error("Upload error:", err);
            toast({
                title: "Erro no upload",
                description: "Falha ao enviar o arquivo",
                variant: "destructive"
            });
        } finally {
            setUploading(false);
            event.target.value = "";
        }
    };

    // Filter and sort
    const filteredData = useMemo(() => {
        let filtered = invoiceOrders;

        if (!showReconciled) {
            filtered = filtered.filter((inv) => !inv.reconciled);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (inv) =>
                    inv.invoice_number?.toLowerCase().includes(term) ||
                    inv.order_number?.toLowerCase().includes(term) ||
                    inv.description?.toLowerCase().includes(term) ||
                    Object.values(inv.custom_data || {}).some((v) =>
                        String(v).toLowerCase().includes(term)
                    )
            );
        }

        // Sort
        filtered.sort((a, b) => {
            let aVal: string | number = "";
            let bVal: string | number = "";

            if (sortField === "amount") {
                aVal = a.amount;
                bVal = b.amount;
            } else if (sortField === "date") {
                aVal = a.date || "";
                bVal = b.date || "";
            } else if (sortField.startsWith("custom_")) {
                const key = sortField.replace("custom_", "");
                aVal = String(a.custom_data?.[key] || "");
                bVal = String(b.custom_data?.[key] || "");
            } else {
                aVal = String((a as Record<string, unknown>)[sortField] || "");
                bVal = String((b as Record<string, unknown>)[sortField] || "");
            }

            if (typeof aVal === "number" && typeof bVal === "number") {
                return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
            }
            return sortDirection === "asc"
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });

        return filtered;
    }, [invoiceOrders, showReconciled, searchTerm, sortField, sortDirection]);

    // Stats
    const stats = useMemo(() => {
        const total = filteredData.length;
        const reconciled = filteredData.filter((inv) => inv.reconciled).length;
        const unreconciled = total - reconciled;
        const totalAmount = filteredData.reduce((sum, inv) => sum + inv.amount, 0);

        return { total, reconciled, unreconciled, totalAmount };
    }, [filteredData]);

    // Handle sort
    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("desc");
        }
    };

    // Toggle column visibility
    const toggleColumn = (key: string) => {
        if (key.startsWith("custom_")) {
            setAllCustomColumns((prev) =>
                prev.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col))
            );
        } else {
            setColumns((prev) =>
                prev.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col))
            );
        }
    };

    // View details
    const viewDetails = (row: InvoiceOrder) => {
        setSelectedRow(row);
        setDetailsDialogOpen(true);
    };

    // Delete row
    const deleteRow = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este registro?")) return;

        try {
            const { error } = await supabase.from("csv_rows").delete().eq("id", id);

            if (error) throw error;

            toast({ title: "Registro excluído" });
            loadData();
        } catch (err) {
            console.error("Delete error:", err);
            toast({
                title: "Erro ao excluir",
                description: String(err),
                variant: "destructive"
            });
        }
    };

    // Delete all
    const deleteAll = async () => {
        if (!confirm("⚠️ Tem certeza que deseja excluir TODOS os registros de Invoice Orders?")) return;
        if (!confirm("⚠️ Esta ação NÃO pode ser desfeita! Continuar?")) return;

        try {
            const response = await fetch("/api/csv-rows?source=invoice-orders", { method: "DELETE" });
            const result = await response.json();

            if (!result.success) throw new Error(result.error);

            toast({ title: "Todos os registros excluídos" });
            loadData();
        } catch (err) {
            console.error("Delete all error:", err);
            toast({
                title: "Erro ao excluir",
                description: String(err),
                variant: "destructive"
            });
        }
    };

    // Auto reconcile with bank
    const runBankReconcile = async () => {
        setBankReconciling(true);
        try {
            const response = await fetch("/api/reconcile/invoice-orders-bank?dryRun=true");
            const result = await response.json();

            if (!result.success) throw new Error(result.error);

            toast({
                title: "Reconciliação com Banco",
                description: `${result.summary?.matchedInvoices || 0} invoices vinculadas ao banco`
            });

            if (result.summary?.matchedInvoices > 0) {
                // Execute real reconciliation
                await fetch("/api/reconcile/invoice-orders-bank");
                loadData();
            }
        } catch (err) {
            console.error("Bank reconcile error:", err);
            toast({
                title: "Erro na reconciliação",
                description: String(err),
                variant: "destructive"
            });
        } finally {
            setBankReconciling(false);
        }
    };

    // Export to Excel
    const exportToExcel = () => {
        const exportData = filteredData.map((inv) => ({
            "Invoice #": inv.invoice_number,
            "Order #": inv.order_number || "",
            Date: formatDate(inv.date),
            Amount: inv.amount,
            Currency: inv.currency,
            Status: inv.reconciled ? "Reconciled" : "Pending",
            ...inv.custom_data
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Invoice Orders");
        XLSX.writeFile(wb, `invoice-orders-${new Date().toISOString().split("T")[0]}.xlsx`);
    };

    // Get all visible columns
    const visibleColumns = useMemo(() => {
        return [...columns.filter((c) => c.visible), ...allCustomColumns.filter((c) => c.visible)];
    }, [columns, allCustomColumns]);

    // Get cell value
    const getCellValue = (row: InvoiceOrder, colKey: string): React.ReactNode => {
        if (colKey === "invoice_number") return row.invoice_number || "-";
        if (colKey === "order_number") return row.order_number || "-";
        if (colKey === "date") return formatDate(row.date);
        if (colKey === "description") return row.description || "-";
        if (colKey === "amount")
            return (
                <span className={row.amount >= 0 ? "text-green-400" : "text-red-400"}>
                    {formatEuropeanNumber(row.amount)}
                </span>
            );
        if (colKey === "currency") return row.currency;
        if (colKey === "financial_account") {
            const code = row.custom_data?.financial_account_code as string | null;
            const name = row.custom_data?.financial_account_name as string | null;
            if (!code) return <span className="text-gray-500">—</span>;
            return (
                <Badge className="bg-blue-900/30 text-blue-400 border border-blue-700 text-xs">
                    {code} {name ? `- ${name}` : ''}
                </Badge>
            );
        }
        if (colKey === "reconciled")
            return row.reconciled ? (
                <Badge className="bg-green-900/30 text-green-400 border border-green-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Reconciled
                </Badge>
            ) : (
                <Badge className="bg-yellow-900/30 text-yellow-400 border border-yellow-700">
                    <AlertCircle className="h-3 w-3 mr-1" /> Pending
                </Badge>
            );
        if (colKey.startsWith("custom_")) {
            const key = colKey.replace("custom_", "");
            const value = row.custom_data?.[key];
            if (value === null || value === undefined) return "-";
            return String(value);
        }
        return "-";
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
            <div className="p-4 md:p-6 space-y-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <Breadcrumbs
                            items={[
                                { label: "Home", href: "/" },
                                { label: "Accounts Receivable", href: "/accounts-receivable" },
                                { label: "Invoice Orders" }
                            ]}
                        />
                        <h1 className="text-2xl font-bold mt-2 flex items-center gap-2">
                            <FileText className="h-6 w-6 text-blue-400" />
                            Invoice Orders
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Gerencie e reconcilie Invoice Orders importadas de CSV
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <ScopeSelector value={selectedScope} onValueChange={setSelectedScope} />
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase">Total Invoices</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                                </div>
                                <FileText className="h-8 w-8 text-blue-400 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase">Reconciled</p>
                                    <p className="text-2xl font-bold text-green-400">{stats.reconciled}</p>
                                </div>
                                <CheckCircle2 className="h-8 w-8 text-green-400 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase">Pending</p>
                                    <p className="text-2xl font-bold text-yellow-400">{stats.unreconciled}</p>
                                </div>
                                <AlertCircle className="h-8 w-8 text-yellow-400 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase">Total Amount</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                        €{formatEuropeanNumber(stats.totalAmount)}
                                    </p>
                                </div>
                                <Zap className="h-8 w-8 text-purple-400 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Actions Bar */}
                <Card className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <CardContent className="p-4">
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Upload Button */}
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    disabled={uploading}
                                />
                                <Button
                                    variant="outline"
                                    className="bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
                                    disabled={uploading}
                                >
                                    {uploading ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Upload className="h-4 w-4 mr-2" />
                                    )}
                                    Upload CSV
                                </Button>
                            </div>

                            {/* Refresh */}
                            <Button
                                variant="outline"
                                className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                                onClick={loadData}
                                disabled={loading}
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                                Refresh
                            </Button>

                            {/* Bank Reconcile */}
                            <Button
                                variant="outline"
                                className="bg-green-600 hover:bg-green-700 text-white border-green-500"
                                onClick={runBankReconcile}
                                disabled={bankReconciling}
                            >
                                {bankReconciling ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Link2 className="h-4 w-4 mr-2" />
                                )}
                                Bank Match
                            </Button>

                            {/* Export */}
                            <Button
                                variant="outline"
                                className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                                onClick={exportToExcel}
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Export
                            </Button>

                            {/* Column Selector */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600">
                                        <Columns className="h-4 w-4 mr-2" />
                                        Columns
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white w-56">
                                    <DropdownMenuLabel>Standard Columns</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-700" />
                                    {columns.map((col) => (
                                        <DropdownMenuCheckboxItem
                                            key={col.key}
                                            checked={col.visible}
                                            onCheckedChange={() => toggleColumn(col.key)}
                                            className="text-gray-700 dark:text-gray-300 focus:bg-gray-700 focus:text-gray-900 dark:text-white"
                                        >
                                            {col.label}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                    {allCustomColumns.length > 0 && (
                                        <>
                                            <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-700" />
                                            <DropdownMenuLabel>Custom Columns</DropdownMenuLabel>
                                            <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-700" />
                                            {allCustomColumns.map((col) => (
                                                <DropdownMenuCheckboxItem
                                                    key={col.key}
                                                    checked={col.visible}
                                                    onCheckedChange={() => toggleColumn(col.key)}
                                                    className="text-gray-700 dark:text-gray-300 focus:bg-gray-700 focus:text-gray-900 dark:text-white"
                                                >
                                                    {col.label}
                                                </DropdownMenuCheckboxItem>
                                            ))}
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Delete All */}
                            {invoiceOrders.length > 0 && (
                                <Button
                                    variant="outline"
                                    className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border-red-600/50"
                                    onClick={deleteAll}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete All
                                </Button>
                            )}

                            <div className="flex-1" />

                            {/* Search */}
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                                <Input
                                    type="text"
                                    placeholder="Search invoices..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
                                />
                            </div>

                            {/* Show Reconciled Toggle */}
                            <Button
                                variant="outline"
                                className={`border-gray-300 dark:border-gray-600 ${showReconciled ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                    }`}
                                onClick={() => setShowReconciled(!showReconciled)}
                            >
                                {showReconciled ? <Eye className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2 opacity-50" />}
                                {showReconciled ? "All" : "Pending Only"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Data Table */}
                <Card className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center h-64 text-red-400">
                                <AlertCircle className="h-6 w-6 mr-2" />
                                {error}
                            </div>
                        ) : filteredData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                                <FileText className="h-12 w-12 mb-4 opacity-50" />
                                <p className="text-lg">Nenhum Invoice Order encontrado</p>
                                <p className="text-sm">Faça upload de um arquivo CSV para começar</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-100 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                            {visibleColumns.map((col) => (
                                                <th
                                                    key={col.key}
                                                    className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:bg-gray-100 dark:bg-gray-700/50"
                                                    style={{ width: col.width }}
                                                    onClick={() => handleSort(col.key)}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        {col.label}
                                                        {sortField === col.key ? (
                                                            sortDirection === "asc" ? (
                                                                <ArrowUp className="h-3 w-3" />
                                                            ) : (
                                                                <ArrowDown className="h-3 w-3" />
                                                            )
                                                        ) : (
                                                            <ArrowUpDown className="h-3 w-3 opacity-30" />
                                                        )}
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-medium w-24">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredData.map((row) => (
                                            <tr
                                                key={row.id}
                                                className="border-b border-gray-200 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors"
                                            >
                                                {visibleColumns.map((col) => (
                                                    <td key={col.key} className="px-3 py-2 text-gray-700 dark:text-gray-300">
                                                        {getCellValue(row, col.key)}
                                                    </td>
                                                ))}
                                                <td className="px-3 py-2 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-600"
                                                            onClick={() => viewDetails(row)}
                                                        >
                                                            <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 hover:bg-red-600/30"
                                                            onClick={() => deleteRow(row.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-400" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Footer Stats */}
                <div className="text-center text-gray-500 text-sm">
                    Showing {filteredData.length} of {invoiceOrders.length} invoice orders
                </div>
            </div>

            {/* Details Dialog */}
            <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
                <DialogContent className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-400" />
                            Invoice Details
                        </DialogTitle>
                        <DialogDescription className="text-gray-500 dark:text-gray-400">
                            {selectedRow?.invoice_number}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRow && (
                        <div className="space-y-4">
                            {/* Main Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-gray-500 dark:text-gray-400 text-xs">Invoice Number</Label>
                                    <p className="text-gray-900 dark:text-white font-mono">{selectedRow.invoice_number || "-"}</p>
                                </div>
                                <div>
                                    <Label className="text-gray-500 dark:text-gray-400 text-xs">Order Number</Label>
                                    <p className="text-gray-900 dark:text-white font-mono">{selectedRow.order_number || "-"}</p>
                                </div>
                                <div>
                                    <Label className="text-gray-500 dark:text-gray-400 text-xs">Date</Label>
                                    <p className="text-gray-900 dark:text-white">{formatDate(selectedRow.date)}</p>
                                </div>
                                <div>
                                    <Label className="text-gray-500 dark:text-gray-400 text-xs">Amount</Label>
                                    <p className="text-gray-900 dark:text-white font-mono">
                                        {selectedRow.currency} {formatEuropeanNumber(selectedRow.amount)}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-gray-500 dark:text-gray-400 text-xs">Status</Label>
                                    <p>
                                        {selectedRow.reconciled ? (
                                            <Badge className="bg-green-900/30 text-green-400 border border-green-700">
                                                Reconciled
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-yellow-900/30 text-yellow-400 border border-yellow-700">
                                                Pending
                                            </Badge>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Custom Data */}
                            {selectedRow.custom_data && Object.keys(selectedRow.custom_data).length > 0 && (
                                <div>
                                    <Label className="text-gray-500 dark:text-gray-400 text-xs block mb-2">Additional Details</Label>
                                    <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-3 space-y-2">
                                        {Object.entries(selectedRow.custom_data)
                                            .filter(([key]) => !["file_name", "row_index"].includes(key))
                                            .map(([key, value]) => (
                                                <div key={key} className="flex justify-between text-sm">
                                                    <span className="text-gray-500 dark:text-gray-400">
                                                        {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                                                    </span>
                                                    <span className="text-gray-900 dark:text-white font-mono">
                                                        {value === null || value === undefined ? "-" : String(value)}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
