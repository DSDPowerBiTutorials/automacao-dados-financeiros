"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, X, ArrowUpDown } from "lucide-react";

interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    customer: string;
    orderType: string;
}

interface DrillDownModalProps {
    open: boolean;
    onClose: () => void;
    faCode: string;
    faName: string;
    year: number;
    month: number; // 0-indexed
}

const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function DrillDownModal({ open, onClose, faCode, faName, year, month }: DrillDownModalProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [sortBy, setSortBy] = useState<"date" | "amount">("date");
    const [sortDesc, setSortDesc] = useState(true);

    useEffect(() => {
        if (open && faCode) {
            fetchData(1);
        }
    }, [open, faCode, year, month]);

    const fetchData = async (pageNum: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/pnl/drilldown?fa=${faCode}&year=${year}&month=${month}&page=${pageNum}&limit=15`);
            const data = await res.json();

            if (data.success) {
                setTransactions(data.transactions);
                setTotalPages(data.pagination.totalPages);
                setTotal(data.pagination.total);
                setPage(pageNum);
            }
        } catch (error) {
            console.error("Erro ao buscar drill-down:", error);
        } finally {
            setLoading(false);
        }
    };

    const sortedTransactions = [...transactions].sort((a, b) => {
        if (sortBy === "date") {
            return sortDesc
                ? new Date(b.date).getTime() - new Date(a.date).getTime()
                : new Date(a.date).getTime() - new Date(b.date).getTime();
        } else {
            return sortDesc ? b.amount - a.amount : a.amount - b.amount;
        }
    });

    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-PT", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 2,
        }).format(value);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("pt-PT", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-none max-h-[90vh] bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white overflow-hidden flex flex-col" style={{ width: '80vw' }}>
                <DialogHeader className="flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-xl font-bold text-emerald-400">
                            {faCode} - {faName}
                        </DialogTitle>
                        <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {monthNames[month]} {year} • {total} transações
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-auto mt-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="flex items-center justify-center h-64 text-gray-500">
                            Nenhuma transação encontrada
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-200 dark:bg-gray-800/80 sticky top-0">
                                <tr>
                                    <th
                                        className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-900 dark:text-white"
                                        onClick={() => { setSortBy("date"); setSortDesc(sortBy === "date" ? !sortDesc : true); }}
                                    >
                                        <span className="flex items-center gap-1">
                                            Data <ArrowUpDown className="h-3 w-3" />
                                        </span>
                                    </th>
                                    <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Descrição</th>
                                    <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Cliente</th>
                                    <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Tipo</th>
                                    <th
                                        className="text-right px-3 py-2 text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-900 dark:text-white"
                                        onClick={() => { setSortBy("amount"); setSortDesc(sortBy === "amount" ? !sortDesc : true); }}
                                    >
                                        <span className="flex items-center justify-end gap-1">
                                            Valor <ArrowUpDown className="h-3 w-3" />
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedTransactions.map((t, idx) => (
                                    <tr
                                        key={t.id}
                                        className={`border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:bg-gray-800/50 ${idx % 2 === 0 ? "bg-gray-100 dark:bg-gray-900/50" : ""}`}
                                    >
                                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDate(t.date)}</td>
                                        <td className="px-3 py-2 text-gray-600 dark:text-gray-200 max-w-xs truncate" title={t.description}>
                                            {t.description}
                                        </td>
                                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[150px] truncate" title={t.customer}>
                                            {t.customer}
                                        </td>
                                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{t.orderType}</td>
                                        <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${t.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                            {formatCurrency(t.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 dark:bg-gray-800/60 font-semibold">
                                <tr>
                                    <td colSpan={4} className="px-3 py-2 text-gray-700 dark:text-gray-300">
                                        Total da página
                                    </td>
                                    <td className={`px-3 py-2 text-right font-mono ${totalAmount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                        {formatCurrency(totalAmount)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            Página {page} de {totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchData(page - 1)}
                                disabled={page <= 1 || loading}
                                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchData(page + 1)}
                                disabled={page >= totalPages || loading}
                                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
