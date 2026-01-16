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
    ExternalLink,
    User,
    CreditCard,
    Filter,
    Calendar,
    DollarSign,
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/formatters";

interface PleoExpenseRow {
    id: string;
    date: string;
    description: string;
    amount: number;
    reconciled: boolean;
    custom_data?: {
        pleo_expense_id?: string;
        merchant?: string;
        category?: string;
        user_name?: string;
        user_email?: string;
        status?: string;
        currency?: string;
        note?: string;
        receipt_url?: string;
        created_at?: string;
        updated_at?: string;
    };
    [key: string]: any;
}

interface SyncStats {
    total: number;
    byStatus: { [key: string]: number };
    byCategory: { [key: string]: number };
    byUser: { [key: string]: number };
    totalAmount: number;
}

export default function PleoReportPage() {
    const [expenses, setExpenses] = useState<PleoExpenseRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<PleoExpenseRow>>({});

    // Filtros
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [userFilter, setUserFilter] = useState<string>("all");
    const [showReconciled, setShowReconciled] = useState(true);

    useEffect(() => {
        loadExpenses();
    }, []);

    async function loadExpenses() {
        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('csv_rows')
                .select('*')
                .eq('source', 'pleo')
                .order('date', { ascending: false });

            if (fetchError) throw fetchError;

            setExpenses(data || []);
        } catch (err: any) {
            console.error('[Pleo Report] Error loading expenses:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function syncPleo() {
        setSyncing(true);
        setError(null);

        try {
            console.log('[Pleo Report] Starting sync com API...');

            const response = await fetch('/api/pleo/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();
            console.log('[Pleo Report] Resposta da API:', result);

            if (!response.ok || !result.success) {
                const errorMsg = result.error || `Erro HTTP ${response.status}`;
                throw new Error(errorMsg);
            }

            const count = result.imported || 0;
            alert(`✅ ${count} despesa(s) importada(s) do Pleo`);
            await loadExpenses();
        } catch (err: any) {
            console.error('[Pleo Report] Sync error:', err);
            const errorMsg = err.message || 'Erro desconhecido ao sincronizar';
            setError(errorMsg);
            alert(`❌ Erro ao sincronizar Pleo:\n\n${errorMsg}`);
        } finally {
            setSyncing(false);
        }
    }

    async function handleEdit(expense: PleoExpenseRow) {
        setEditingId(expense.id);
        setEditData({
            description: expense.description,
            amount: expense.amount,
            date: expense.date,
            reconciled: expense.reconciled
        });
    }

    async function handleSave() {
        if (!editingId) return;

        try {
            const { error: updateError } = await supabase
                .from('csv_rows')
                .update(editData)
                .eq('id', editingId);

            if (updateError) throw updateError;

            setExpenses(expenses.map(exp =>
                exp.id === editingId ? { ...exp, ...editData } : exp
            ));

            setEditingId(null);
            setEditData({});
        } catch (err: any) {
            console.error('[Pleo Report] Error saving:', err);
            alert(`Erro ao salvar: ${err.message}`);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;

        try {
            const { error: deleteError } = await supabase
                .from('csv_rows')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            setExpenses(expenses.filter(exp => exp.id !== id));
        } catch (err: any) {
            console.error('[Pleo Report] Error deleting:', err);
            alert(`Erro ao excluir: ${err.message}`);
        }
    }

    async function toggleReconciled(id: string, currentStatus: boolean) {
        try {
            const { error: updateError } = await supabase
                .from('csv_rows')
                .update({ reconciled: !currentStatus })
                .eq('id', id);

            if (updateError) throw updateError;

            setExpenses(expenses.map(exp =>
                exp.id === id ? { ...exp, reconciled: !currentStatus } : exp
            ));
        } catch (err: any) {
            console.error('[Pleo Report] Error toggling reconciled:', err);
            alert(`Erro ao atualizar: ${err.message}`);
        }
    }

    // Filtros aplicados
    const filteredExpenses = useMemo(() => {
        return expenses.filter(exp => {
            // Filter by busca
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const matchDescription = exp.description?.toLowerCase().includes(searchLower);
                const matchMerchant = exp.custom_data?.merchant?.toLowerCase().includes(searchLower);
                const matchUser = exp.custom_data?.user_name?.toLowerCase().includes(searchLower);
                const matchEmail = exp.custom_data?.user_email?.toLowerCase().includes(searchLower);

                if (!matchDescription && !matchMerchant && !matchUser && !matchEmail) {
                    return false;
                }
            }

            // Filter by status
            if (statusFilter !== 'all' && exp.custom_data?.status !== statusFilter) {
                return false;
            }

            // Filter by categoria
            if (categoryFilter !== 'all' && exp.custom_data?.category !== categoryFilter) {
                return false;
            }

            // Filter by user
            if (userFilter !== 'all' && exp.custom_data?.user_email !== userFilter) {
                return false;
            }

            // Filter by reconciliado
            if (!showReconciled && exp.reconciled) {
                return false;
            }

            return true;
        });
    }, [expenses, searchTerm, statusFilter, categoryFilter, userFilter, showReconciled]);

    // Estatísticas
    const stats: SyncStats = useMemo(() => {
        const result: SyncStats = {
            total: filteredExpenses.length,
            byStatus: {},
            byCategory: {},
            byUser: {},
            totalAmount: 0
        };

        filteredExpenses.forEach(exp => {
            // Status
            const status = exp.custom_data?.status || 'unknown';
            result.byStatus[status] = (result.byStatus[status] || 0) + 1;

            // Categoria
            const category = exp.custom_data?.category || 'Sem categoria';
            result.byCategory[category] = (result.byCategory[category] || 0) + 1;

            // User
            const user = exp.custom_data?.user_email || 'Desconhecido';
            result.byUser[user] = (result.byUser[user] || 0) + 1;

            // Total
            result.totalAmount += Math.abs(exp.amount);
        });

        return result;
    }, [filteredExpenses]);

    // Amountes únicos para filtros
    const uniqueStatuses = useMemo(() =>
        Array.from(new Set(expenses.map(e => e.custom_data?.status).filter(Boolean))),
        [expenses]
    );

    const uniqueCategories = useMemo(() =>
        Array.from(new Set(expenses.map(e => e.custom_data?.category).filter(Boolean))),
        [expenses]
    );

    const uniqueUsers = useMemo(() =>
        Array.from(new Set(expenses.map(e => e.custom_data?.user_email).filter(Boolean))),
        [expenses]
    );

    const exportToCSV = () => {
        const headers = ['Data', 'Merchant', 'User', 'Email', 'Categoria', 'Amount', 'Moeda', 'Status', 'Nota', 'Reconciliado'];
        const rows = filteredExpenses.map(exp => [
            exp.date,
            exp.custom_data?.merchant || '',
            exp.custom_data?.user_name || '',
            exp.custom_data?.user_email || '',
            exp.custom_data?.category || '',
            exp.amount,
            exp.custom_data?.currency || 'EUR',
            exp.custom_data?.status || '',
            exp.custom_data?.note || '',
            exp.reconciled ? 'Yes' : 'No'
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pleo-expenses-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Despesas Pleo</h1>
                        <p className="text-gray-500">Corporate expense management</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button onClick={exportToCSV} variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Exportar CSV
                    </Button>
                    <Button
                        onClick={syncPleo}
                        disabled={true}
                        variant="outline"
                        className="opacity-50 cursor-not-allowed"
                        title="API Pleo Legacy discontinued. Use manual export."
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sincronizar Pleo (Unavailable)
                    </Button>
                </div>
            </div>

            {/* API Legacy Warning */}
            <Alert className="bg-yellow-50 border-yellow-200">
                <AlertDescription className="text-yellow-800">
                    <strong>⚠️ Pleo Legacy API Discontinued:</strong> A auto sync is not available.
                    Please, export data manually do Pleo Dashboard e upload via CSV.
                    <a
                        href="https://app.pleo.io/settings/export"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 underline font-medium hover:text-yellow-900"
                    >
                        Acessar Pleo Dashboard →
                    </a>
                </AlertDescription>
            </Alert>

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Total de Despesas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Amount Total
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(stats.totalAmount, 'EUR')}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Users
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {Object.keys(stats.byUser).length}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Categorias
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {Object.keys(stats.byCategory).length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filtros
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Buscar</label>
                            <Input
                                placeholder="Merchant, user, email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">Status</label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {uniqueStatuses.map(status => (
                                        <SelectItem key={status} value={status!}>
                                            {status}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">Categoria</label>
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {uniqueCategories.map(cat => (
                                        <SelectItem key={cat} value={cat!}>
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">User</label>
                            <Select value={userFilter} onValueChange={setUserFilter}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {uniqueUsers.map(user => (
                                        <SelectItem key={user} value={user!}>
                                            {user}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="showReconciled"
                            checked={showReconciled}
                            onCheckedChange={(checked) => setShowReconciled(checked as boolean)}
                        />
                        <label htmlFor="showReconciled" className="text-sm">
                            Show reconciled
                        </label>
                    </div>
                </CardContent>
            </Card>

            {/* Expenses Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Despesas ({filteredExpenses.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b">
                                <tr className="text-left text-sm font-medium text-gray-500">
                                    <th className="pb-3 px-2">Reconciliada</th>
                                    <th className="pb-3 px-2">Data</th>
                                    <th className="pb-3 px-2">Merchant</th>
                                    <th className="pb-3 px-2">User</th>
                                    <th className="pb-3 px-2">Categoria</th>
                                    <th className="pb-3 px-2 text-right">Amount</th>
                                    <th className="pb-3 px-2">Status</th>
                                    <th className="pb-3 px-2">Nota</th>
                                    <th className="pb-3 px-2 text-center">Recibo</th>
                                    <th className="pb-3 px-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredExpenses.map(expense => {
                                    const isEditing = editingId === expense.id;

                                    return (
                                        <tr key={expense.id} className="hover:bg-gray-50">
                                            <td className="py-3 px-2">
                                                <Checkbox
                                                    checked={expense.reconciled}
                                                    onCheckedChange={() => toggleReconciled(expense.id, expense.reconciled)}
                                                />
                                            </td>

                                            <td className="py-3 px-2">
                                                {isEditing ? (
                                                    <Input
                                                        type="date"
                                                        value={editData.date}
                                                        onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                                                        className="w-32"
                                                    />
                                                ) : (
                                                    <span className="text-sm">{formatDate(expense.date)}</span>
                                                )}
                                            </td>

                                            <td className="py-3 px-2">
                                                <div className="flex items-center gap-2">
                                                    <CreditCard className="h-4 w-4 text-gray-400" />
                                                    <span className="text-sm font-medium">
                                                        {expense.custom_data?.merchant || '-'}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="py-3 px-2">
                                                <div className="flex items-center gap-2">
                                                    <User className="h-4 w-4 text-gray-400" />
                                                    <div>
                                                        <div className="text-sm font-medium">
                                                            {expense.custom_data?.user_name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {expense.custom_data?.user_email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-3 px-2">
                                                <Badge variant="outline" className="text-xs">
                                                    {expense.custom_data?.category || 'Sem categoria'}
                                                </Badge>
                                            </td>

                                            <td className="py-3 px-2 text-right">
                                                {isEditing ? (
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={editData.amount}
                                                        onChange={(e) => setEditData({ ...editData, amount: parseFloat(e.target.value) })}
                                                        className="w-24"
                                                    />
                                                ) : (
                                                    <span className="text-sm font-medium text-red-600">
                                                        {formatCurrency(Math.abs(expense.amount), expense.custom_data?.currency || 'EUR')}
                                                    </span>
                                                )}
                                            </td>

                                            <td className="py-3 px-2">
                                                <Badge
                                                    className={
                                                        expense.custom_data?.status === 'approved'
                                                            ? 'bg-green-100 text-green-800'
                                                            : expense.custom_data?.status === 'rejected'
                                                                ? 'bg-red-100 text-red-800'
                                                                : 'bg-yellow-100 text-yellow-800'
                                                    }
                                                >
                                                    {expense.custom_data?.status || 'pending'}
                                                </Badge>
                                            </td>

                                            <td className="py-3 px-2 max-w-xs truncate text-sm text-gray-600">
                                                {expense.custom_data?.note || '-'}
                                            </td>

                                            <td className="py-3 px-2 text-center">
                                                {expense.custom_data?.receipt_url && (
                                                    <a
                                                        href={expense.custom_data.receipt_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                )}
                                            </td>

                                            <td className="py-3 px-2">
                                                <div className="flex justify-end gap-1">
                                                    {isEditing ? (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={handleSave}
                                                            >
                                                                <Save className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => {
                                                                    setEditingId(null);
                                                                    setEditData({});
                                                                }}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleEdit(expense)}
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleDelete(expense.id)}
                                                                className="text-red-600 hover:text-red-800"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
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

                        {filteredExpenses.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Nenhuma despesa encontrada</p>
                                <p className="text-sm mt-2">
                                    Clique em &quot;Sincronizar Pleo&quot; para importar despesas
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
