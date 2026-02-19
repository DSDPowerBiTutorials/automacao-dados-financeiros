"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Info, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatTimestamp } from "@/lib/formatters";

interface UpdateResult {
    success: boolean;
    stats: {
        total: number;
        created: number;
        updated: number;
        skipped: number;
        failed: number;
        reconciled_preserved: number;
    };
    message: string;
}

interface SyncTimestamps {
    automatic: string | null;
    safe: string | null;
    force: string | null;
}

export default function BraintreeUpdatePendingButton() {
    const [isUpdating, setIsUpdating] = useState(false);
    const [result, setResult] = useState<UpdateResult | null>(null);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [timestamps, setTimestamps] = useState<SyncTimestamps>({
        automatic: null,
        safe: null,
        force: null,
    });

    // Buscar timestamps ao montar
    useEffect(() => {
        fetchTimestamps();
    }, []);

    const fetchTimestamps = async () => {
        try {
            const response = await fetch("/api/braintree/sync-status");
            const data = await response.json();
            if (data.success) {
                setTimestamps(data.timestamps);
            }
        } catch (error) {
            console.error("Error fetching sync timestamps:", error);
        }
    };

    const handleUpdate = async (forceUpdate: boolean = false) => {
        setIsUpdating(true);
        setResult(null);
        setConfirmDialogOpen(false);

        try {
            const response = await fetch("/api/braintree/sync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    preserveReconciliation: !forceUpdate,
                    skipIfConciliado: !forceUpdate,
                    daysBack: 7,
                    updateType: forceUpdate ? "force" : "safe",
                }),
            });

            const data = await response.json();

            if (data.success) {
                setResult({
                    success: true,
                    stats: data.stats || {
                        total: 0,
                        created: 0,
                        updated: 0,
                        skipped: 0,
                        failed: 0,
                        reconciled_preserved: 0,
                    },
                    message: data.message || "✅ Update completed successfully",
                });

                // Atualizar timestamps
                fetchTimestamps();
            } else {
                setResult({
                    success: false,
                    stats: {
                        total: 0,
                        created: 0,
                        updated: 0,
                        skipped: 0,
                        failed: 0,
                        reconciled_preserved: 0,
                    },
                    message: data.error || "❌ Failed to update transactions",
                });
            }
        } catch (error) {
            console.error("Error updating transactions:", error);
            setResult({
                success: false,
                stats: {
                    total: 0,
                    created: 0,
                    updated: 0,
                    skipped: 0,
                    failed: 0,
                    reconciled_preserved: 0,
                },
                message: "❌ Network error - please try again",
            });
        } finally {
            setIsUpdating(false);
            setTimeout(() => setResult(null), 10000);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            {/* Timestamps Header */}
            <div className="flex items-center gap-3 text-xs text-gray-900 dark:text-white/70">
                {timestamps.automatic && (
                    <div className="flex items-center gap-1" title="Last automatic sync">
                        <Clock className="h-3 w-3" />
                        <span>Auto: {formatTimestamp(timestamps.automatic)}</span>
                    </div>
                )}
                {timestamps.safe && (
                    <div className="flex items-center gap-1" title="Last safe update">
                        <Clock className="h-3 w-3" />
                        <span>Safe: {formatTimestamp(timestamps.safe)}</span>
                    </div>
                )}
                {timestamps.force && (
                    <div className="flex items-center gap-1" title="Last force update">
                        <Clock className="h-3 w-3 text-orange-400" />
                        <span>Force: {formatTimestamp(timestamps.force)}</span>
                    </div>
                )}
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center gap-2">
                {/* Botão Safe Update */}
                <Button
                    onClick={() => handleUpdate(false)}
                    disabled={isUpdating}
                    variant="outline"
                    size="sm"
                    className="gap-2 border-blue-400 text-blue-200 hover:bg-blue-500/20 hover:text-gray-900 dark:hover:text-white"
                    title="Update pending transactions (preserves reconciliations)"
                >
                    <RefreshCw className={`h-4 w-4 ${isUpdating ? "animate-spin" : ""}`} />
                    {isUpdating ? "Updating..." : "Update Pending"}
                </Button>

                {/* Botão Force Update */}
                <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                    <DialogTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 border-orange-400 text-orange-200 hover:bg-orange-500/20 hover:text-gray-900 dark:hover:text-white"
                            title="Force update all transactions (may override reconciliations)"
                            disabled={isUpdating}
                        >
                            <AlertTriangle className="h-4 w-4" />
                            Force
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-orange-600">
                                <AlertTriangle className="h-5 w-5" />
                                Force Update - Warning
                            </DialogTitle>
                            <DialogDescription className="space-y-3 pt-2">
                                <p className="text-sm">
                                    This will update <strong>ALL</strong> transactions, including reconciled ones.
                                </p>
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Caution</AlertTitle>
                                    <AlertDescription>
                                        Manual reconciliations may be overwritten if Braintree data changed.
                                        Use this only if you need to fix incorrect data.
                                    </AlertDescription>
                                </Alert>
                                <p className="text-sm text-gray-600">
                                    <strong>Recommendation:</strong> Use regular &quot;Update Pending&quot; instead.
                                </p>
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setConfirmDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => handleUpdate(true)}
                                className="gap-2"
                            >
                                <AlertTriangle className="h-4 w-4" />
                                Yes, Force Update
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Info Dialog */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-900 dark:text-white/70 hover:text-gray-900 dark:text-white hover:bg-white/10">
                            <Info className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-none max-h-[90vh]" style={{ width: '80vw' }}>
                        <DialogHeader>
                            <DialogTitle>Update Strategies Explained</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 text-sm">
                            <div className="border-l-4 border-blue-500 pl-4">
                                <h4 className="font-semibold text-blue-600 mb-2 flex items-center gap-2">
                                    <RefreshCw className="h-4 w-4" />
                                    Update Pending (Safe Mode)
                                </h4>
                                <ul className="text-gray-600 space-y-1 list-disc list-inside">
                                    <li>Updates only <strong>non-reconciled</strong> transactions</li>
                                    <li>Preserves all manual reconciliations</li>
                                    <li>Fetches last 7 days from Braintree API</li>
                                    <li>Adds missing disbursement_id and dates</li>
                                    <li>Updates status changes (authorized → settled)</li>
                                    <li><strong className="text-green-600">✅ Recommended for daily use</strong></li>
                                </ul>
                            </div>

                            <div className="border-l-4 border-orange-500 pl-4">
                                <h4 className="font-semibold text-orange-600 mb-2 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Force Update (Override Mode)
                                </h4>
                                <ul className="text-gray-600 space-y-1 list-disc list-inside">
                                    <li>Updates <strong>ALL</strong> transactions including reconciled</li>
                                    <li>May override manual reconciliations</li>
                                    <li>Fetches last 7 days from Braintree API</li>
                                    <li>Use to fix incorrect data in bulk</li>
                                    <li>Requires explicit confirmation</li>
                                    <li><strong className="text-red-600">⚠️ Use only when necessary</strong></li>
                                </ul>
                            </div>

                            <div className="border-l-4 border-green-500 pl-4">
                                <h4 className="font-semibold text-green-600 mb-2 flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Automatic Sync (Background)
                                </h4>
                                <ul className="text-gray-600 space-y-1 list-disc list-inside">
                                    <li>Runs automatically daily at 3:00 AM</li>
                                    <li>Safe mode: preserves reconciliations</li>
                                    <li>Syncs last 30 days automatically</li>
                                    <li>No user action required</li>
                                    <li><strong className="text-green-600">✅ Always active</strong></li>
                                </ul>
                            </div>

                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                <h4 className="font-semibold text-blue-800 mb-1">💡 Best Practice</h4>
                                <p className="text-sm text-blue-700">
                                    Use <strong>&quot;Update Pending&quot;</strong> when you notice missing disbursement_id or status updates.
                                    Only use <strong>&quot;Force Update&quot;</strong> if you absolutely need to correct wrong data and understand
                                    that manual reconciliations will be lost.
                                </p>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Resultado */}
            {result && (
                <Alert className={`${result.success ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}>
                    <div className="flex items-start gap-3">
                        {result.success ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        ) : (
                            <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                        )}
                        <div className="flex-1">
                            <AlertTitle className={result.success ? "text-green-800" : "text-red-800"}>
                                {result.message}
                            </AlertTitle>
                            {result.success && result.stats.total > 0 && (
                                <AlertDescription className="mt-2 space-y-1">
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="outline" className="bg-white dark:bg-black">
                                            {result.stats.total} processed
                                        </Badge>
                                        {result.stats.created > 0 && (
                                            <Badge variant="default" className="bg-green-600">
                                                {result.stats.created} new
                                            </Badge>
                                        )}
                                        {result.stats.updated > 0 && (
                                            <Badge variant="default" className="bg-blue-600">
                                                {result.stats.updated} updated
                                            </Badge>
                                        )}
                                        {result.stats.skipped > 0 && (
                                            <Badge variant="secondary">
                                                {result.stats.skipped} skipped
                                            </Badge>
                                        )}
                                        {result.stats.reconciled_preserved > 0 && (
                                            <Badge variant="default" className="bg-purple-600">
                                                {result.stats.reconciled_preserved} reconciliations preserved
                                            </Badge>
                                        )}
                                    </div>
                                </AlertDescription>
                            )}
                        </div>
                    </div>
                </Alert>
            )}
        </div>
    );
}
