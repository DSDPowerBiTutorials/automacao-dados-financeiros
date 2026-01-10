"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Loader2, CheckCircle2, AlertCircle, Database, Trash2, RefreshCw } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SyncResult {
    success: boolean;
    message?: string;
    data?: {
        transactions_processed: number;
        revenue_rows_inserted: number;
        fee_rows_inserted: number;
        duplicates_skipped?: number;
        total_revenue: number;
        total_fees: number;
        net_amount: number;
    };
    error?: string;
}

export default function BraintreeSyncControls() {
    const [isInitialSyncOpen, setIsInitialSyncOpen] = useState(false);
    const [isIncrementalSyncOpen, setIsIncrementalSyncOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<SyncResult | null>(null);

    const [initialDates, setInitialDates] = useState({
        startDate: "2025-01-01",
        endDate: new Date().toISOString().split("T")[0],
    });
    const isInitialLoadingRef = useRef(false);

    const handleInitialSync = async () => {
        if (isInitialLoadingRef.current) return;
        isInitialLoadingRef.current = true;
        setIsLoading(true);
        setResult(null);

        try {
            const response = await fetch("/api/braintree/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startDate: initialDates.startDate,
                    endDate: initialDates.endDate,
                    currency: "EUR",
                    mode: "initial",
                }),
            });

            const data = await response.json();
            setResult(data);

            if (data.success) {
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            }
        } catch (error: any) {
            setResult({
                success: false,
                error: error.message || "Erro ao sincronizar",
            });
        } finally {
            setIsLoading(false);
            isInitialLoadingRef.current = false;
        }
    };

    const handleIncrementalSync = async () => {
        setIsLoading(true);
        setResult(null);

        try {
            // Últimos 30 dias
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 30);

            const response = await fetch("/api/braintree/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startDate: start.toISOString().split("T")[0],
                    endDate: end.toISOString().split("T")[0],
                    currency: "EUR",
                    mode: "incremental",
                }),
            });

            const data = await response.json();
            setResult(data);

            if (data.success) {
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            }
        } catch (error: any) {
            setResult({
                success: false,
                error: error.message || "Erro ao sincronizar",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAll = async () => {
        setIsLoading(true);

        try {
            const response = await fetch("/api/braintree/delete-all", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currency: "EUR" }),
            });

            const data = await response.json();

            if (data.success) {
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                alert(data.error || "Erro ao deletar dados");
            }
        } catch (error: any) {
            alert(error.message || "Erro ao deletar dados");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex gap-2">
            {/* Carga Inicial */}
            <Dialog open={isInitialSyncOpen} onOpenChange={setIsInitialSyncOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 border-white text-white hover:bg-white/10">
                        <Database className="h-4 w-4" />
                        Carga Inicial
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>🔄 Carga Inicial de Dados</DialogTitle>
                        <DialogDescription>
                            Busca todas as transações históricas do Braintree no período especificado.
                            Duplicatas serão automaticamente ignoradas.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label>Data Inicial</Label>
                            <Input
                                type="date"
                                value={initialDates.startDate}
                                onChange={(e) => setInitialDates({ ...initialDates, startDate: e.target.value })}
                                disabled={isLoading}
                            />
                        </div>
                        <div>
                            <Label>Data Final</Label>
                            <Input
                                type="date"
                                value={initialDates.endDate}
                                onChange={(e) => setInitialDates({ ...initialDates, endDate: e.target.value })}
                                disabled={isLoading}
                            />
                        </div>

                        {result && (
                            <Alert variant={result.success ? "default" : "destructive"}>
                                <AlertDescription>
                                    {result.success ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 font-medium">
                                                <CheckCircle2 className="h-4 w-4" />
                                                {result.message || "Sincronização concluída!"}
                                            </div>
                                            {result.data && (
                                                <div className="text-sm mt-2">
                                                    <div>✅ Transações: {result.data.transactions_processed}</div>
                                                    <div>➕ Novas receitas: {result.data.revenue_rows_inserted}</div>
                                                    <div>➕ Novas fees: {result.data.fee_rows_inserted}</div>
                                                    {result.data.duplicates_skipped !== undefined && (
                                                        <div>⏭️ Duplicatas ignoradas: {result.data.duplicates_skipped}</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4" />
                                            {result.error || result.message}
                                        </div>
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <DialogFooter>
                        <Button onClick={handleInitialSync} disabled={isLoading} className="w-full">
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sincronizando...
                                </>
                            ) : (
                                <>
                                    <Database className="mr-2 h-4 w-4" />
                                    Iniciar Carga
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Sync Incremental */}
            <Dialog open={isIncrementalSyncOpen} onOpenChange={setIsIncrementalSyncOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 border-white text-white hover:bg-white/10">
                        <RefreshCw className="h-4 w-4" />
                        Atualizar
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>⚡ Atualização Incremental</DialogTitle>
                        <DialogDescription>
                            Busca apenas transações dos últimos 30 dias. Use caso o webhook não esteja funcionando.
                        </DialogDescription>
                    </DialogHeader>

                    {result && (
                        <Alert variant={result.success ? "default" : "destructive"}>
                            <AlertDescription>
                                {result.success ? (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 font-medium">
                                            <CheckCircle2 className="h-4 w-4" />
                                            {result.message || "Atualização concluída!"}
                                        </div>
                                        {result.data && (
                                            <div className="text-sm mt-2">
                                                <div>✅ Transações: {result.data.transactions_processed}</div>
                                                <div>➕ Novas receitas: {result.data.revenue_rows_inserted}</div>
                                                <div>➕ Novas fees: {result.data.fee_rows_inserted}</div>
                                                {result.data.duplicates_skipped !== undefined && (
                                                    <div>⏭️ Duplicatas ignoradas: {result.data.duplicates_skipped}</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4" />
                                        {result.error || result.message}
                                    </div>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    <DialogFooter>
                        <Button onClick={handleIncrementalSync} disabled={isLoading} className="w-full">
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Atualizando...
                                </>
                            ) : (
                                <>
                                    <Zap className="mr-2 h-4 w-4" />
                                    Buscar Últimos 30 Dias
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Deletar Tudo */}
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 border-red-500 text-red-500 hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4" />
                        Deletar
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>⚠️ Deletar Todos os Dados do Braintree EUR?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação irá <strong>deletar permanentemente</strong> todas as transações do Braintree EUR (revenue + fees).
                            <br /><br />
                            Você poderá recarregar os dados usando a &quot;Carga Inicial&quot; depois.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteAll}
                            disabled={isLoading}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deletando...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Sim, Deletar Tudo
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
