"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
    Activity,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Clock,
    Upload,
    Zap,
    ChevronRight,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface DataSourceStatus {
    source: string;
    displayName: string;
    type: "auto" | "csv";
    lastSync: string | null;
    lastRecordDate: string | null;
    status: "fresh" | "stale" | "error" | "never";
    syncStatus: "idle" | "syncing" | "success" | "error";
    totalRecords: number;
    uploadPath?: string;
    syncEndpoint?: string;
}

interface DataFreshnessResponse {
    sources: DataSourceStatus[];
    overallStatus: "fresh" | "stale" | "error";
    hasErrors: boolean;
    freshCount: number;
    staleCount: number;
    errorCount: number;
}

function inferCurrencyFromSource(sourceId: string): string {
    // Expected formats: braintree-eur, braintree-usd, stripe-eur, etc.
    const lower = sourceId.toLowerCase();
    if (lower.includes("-eur")) return "EUR";
    if (lower.includes("-usd")) return "USD";
    if (lower.includes("-gbp")) return "GBP";
    if (lower.includes("-aud")) return "AUD";
    // Special-case known ids
    if (lower.includes("amex")) return "USD";
    return "EUR";
}

function buildSyncRequest(source: DataSourceStatus): RequestInit {
    const endpoint = source.syncEndpoint || "";

    // Braintree endpoint requires a JSON body (otherwise req.json() or validation fails)
    if (endpoint.startsWith("/api/braintree/sync")) {
        const currency = inferCurrencyFromSource(source.source);
        return {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                daysBack: 14,
                updateType: "safe",
                currency,
                preserveReconciliation: true,
                skipIfConciliado: true,
            }),
        };
    }

    return { method: "POST" };
}

async function parseJsonSafely(res: Response): Promise<any | null> {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return "Never";

    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
    });
}

const STATUS_CONFIG = {
    fresh: {
        icon: CheckCircle2,
        color: "text-green-400",
        bgColor: "bg-green-500/20",
        borderColor: "border-green-500/50",
        label: "Fresh",
    },
    stale: {
        icon: AlertTriangle,
        color: "text-yellow-400",
        bgColor: "bg-yellow-500/20",
        borderColor: "border-yellow-500/50",
        label: "Stale",
    },
    error: {
        icon: XCircle,
        color: "text-red-400",
        bgColor: "bg-red-500/20",
        borderColor: "border-red-500/50",
        label: "Error",
    },
    never: {
        icon: Clock,
        color: "text-gray-500 dark:text-gray-400",
        bgColor: "bg-gray-500/20",
        borderColor: "border-gray-500/50",
        label: "Never",
    },
};

interface DataFreshnessIndicatorProps {
    collapsed?: boolean;
    placement?: "sidebar" | "topbar";
}

export function DataFreshnessIndicator({ collapsed = false, placement = "sidebar" }: DataFreshnessIndicatorProps) {
    const { toast } = useToast();
    const [data, setData] = useState<DataFreshnessResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [open, setOpen] = useState(false);
    const [previousStatus, setPreviousStatus] = useState<string | null>(null);

    const fetchFreshness = useCallback(async () => {
        try {
            const res = await fetch("/api/data-freshness");
            if (!res.ok) throw new Error("Failed to fetch");
            const result: DataFreshnessResponse = await res.json();

            // Check for status degradation and show notification
            if (previousStatus && result.overallStatus !== previousStatus) {
                if (result.overallStatus === "error") {
                    toast({
                        title: "⚠️ Data Sources Critical",
                        description: `${result.errorCount} source(s) need attention. Click the indicator to see details.`,
                        variant: "destructive",
                    });
                } else if (result.overallStatus === "stale" && previousStatus === "fresh") {
                    toast({
                        title: "📊 Data Sources Stale",
                        description: `${result.staleCount} source(s) are outdated. Consider syncing.`,
                    });
                }
            }

            setPreviousStatus(result.overallStatus);
            setData(result);
        } catch (err) {
            console.error("[DataFreshness] Error:", err);
        } finally {
            setLoading(false);
        }
    }, [previousStatus, toast]);

    useEffect(() => {
        fetchFreshness();
        // Polling a cada 60 segundos
        const interval = setInterval(fetchFreshness, 60000);
        return () => clearInterval(interval);
    }, [fetchFreshness]);

    const handleSyncAll = async () => {
        setSyncing(true);
        const autoSources = data?.sources.filter((s) => s.type === "auto" && s.syncEndpoint) || [];
        const uniqueByEndpoint = new Map<string, DataSourceStatus>();
        for (const s of autoSources) {
            if (s.syncEndpoint && !uniqueByEndpoint.has(s.syncEndpoint)) {
                uniqueByEndpoint.set(s.syncEndpoint, s);
            }
        }
        const sourcesToSync = Array.from(uniqueByEndpoint.values());

        toast({
            title: "🔄 Syncing All Sources",
            description: `Starting sync for ${sourcesToSync.length} endpoint(s)...`,
        });

        let successCount = 0;
        let errorCount = 0;
        const failures: Array<{ name: string; details?: string }> = [];

        for (const source of sourcesToSync) {
            try {
                const res = await fetch(source.syncEndpoint!, buildSyncRequest(source));
                const payload = await parseJsonSafely(res);

                const isOk = res.ok && (payload?.success !== false);
                if (isOk) {
                    successCount++;
                } else {
                    errorCount++;
                    failures.push({
                        name: source.displayName,
                        details: payload?.error || payload?.message || `HTTP ${res.status}`,
                    });
                }
            } catch {
                errorCount++;
                failures.push({ name: source.displayName, details: "Network/timeout" });
            }
        }

        setSyncing(false);
        await fetchFreshness();

        toast({
            title: successCount === sourcesToSync.length ? "✅ Sync Complete" : "⚠️ Sync Partial",
            description:
                errorCount > 0
                    ? `${successCount} ok, ${errorCount} falharam. Ex: ${failures
                        .slice(0, 2)
                        .map((f) => `${f.name} (${f.details})`)
                        .join(" • ")}`
                    : `${successCount} ok, ${errorCount} falharam.`,
            variant: errorCount > 0 ? "destructive" : "default",
        });
    };

    const handleSyncSingle = async (source: DataSourceStatus) => {
        if (!source.syncEndpoint) return;

        toast({
            title: `🔄 Syncing ${source.displayName}`,
            description: "Please wait...",
        });

        try {
            const res = await fetch(source.syncEndpoint, buildSyncRequest(source));
            const payload = await parseJsonSafely(res);

            const isOk = res.ok && (payload?.success !== false);
            if (isOk) {
                toast({
                    title: `✅ ${source.displayName} Synced`,
                    description: "Data updated successfully.",
                });
                await fetchFreshness();
            } else {
                const details = payload?.error || payload?.message || `HTTP ${res.status}`;
                throw new Error(details);
            }
        } catch (err) {
            toast({
                title: `❌ ${source.displayName} Failed`,
                description: err instanceof Error ? err.message : "Unable to sync. Try again later.",
                variant: "destructive",
            });
        }
    };

    if (loading) {
        return (
            <div className={cn("flex items-center justify-center", collapsed ? "p-2" : "p-4")}>
                <Loader2 className="h-5 w-5 text-gray-500 animate-spin" />
            </div>
        );
    }

    if (!data) return null;

    const overallConfig = STATUS_CONFIG[data.overallStatus];
    const OverallIcon = overallConfig.icon;

    const autoSources = data.sources.filter((s) => s.type === "auto");
    const csvSources = data.sources.filter((s) => s.type === "csv");

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        "relative flex items-center gap-2 rounded-lg transition-all border",
                        collapsed ? "p-2 justify-center" : "px-3 py-2 w-full",
                        overallConfig.bgColor,
                        overallConfig.borderColor,
                        "hover:opacity-80"
                    )}
                    title="Data Freshness Indicator"
                >
                    <Activity className={cn("h-5 w-5", overallConfig.color)} />
                    {!collapsed && (
                        <>
                            <span className="text-sm font-medium text-gray-900 dark:text-white flex-1 text-left">Data Status</span>
                            <Badge variant="outline" className={cn("text-xs", overallConfig.color, overallConfig.borderColor)}>
                                {data.freshCount}/{data.sources.length}
                            </Badge>
                        </>
                    )}
                    {/* Dot indicator for issues */}
                    {(data.hasErrors || data.staleCount > 0) && (
                        <span
                            className={cn(
                                "absolute -top-1 -right-1 h-3 w-3 rounded-full animate-pulse",
                                data.hasErrors ? "bg-red-500" : "bg-yellow-500"
                            )}
                        />
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                side={placement === "topbar" ? "bottom" : "right"}
                align={placement === "topbar" ? "end" : "start"}
                className="!bg-white dark:!bg-[#1a1b1d] border-gray-200 dark:border-gray-700 w-96 p-0 shadow-2xl"
                sideOffset={placement === "topbar" ? 8 : 12}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <OverallIcon className={cn("h-5 w-5", overallConfig.color)} />
                            <h3 className="font-semibold text-gray-900 dark:text-white">Data Freshness</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                                onClick={() => fetchFreshness()}
                            >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Refresh
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs">
                        <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle2 className="h-3 w-3" /> {data.freshCount} Fresh
                        </span>
                        <span className="flex items-center gap-1 text-yellow-400">
                            <AlertTriangle className="h-3 w-3" /> {data.staleCount} Stale
                        </span>
                        <span className="flex items-center gap-1 text-red-400">
                            <XCircle className="h-3 w-3" /> {data.errorCount} Error
                        </span>
                    </div>
                </div>

                {/* Sync All Button */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900/50">
                    <Button
                        size="sm"
                        className="w-full bg-[#FF7300] hover:bg-[#e66800] text-white"
                        onClick={handleSyncAll}
                        disabled={syncing}
                    >
                        {syncing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Zap className="h-4 w-4 mr-2" />
                        )}
                        Sync All Automatic Sources
                    </Button>
                </div>

                {/* Sources List */}
                <div className="max-h-80 overflow-y-auto">
                    {/* Automatic Sources */}
                    <div className="p-2">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
                            <Zap className="h-3 w-3" /> Automatic ({autoSources.length})
                        </div>
                        {autoSources.map((source) => {
                            const config = STATUS_CONFIG[source.status];
                            const StatusIcon = config.icon;
                            return (
                                <div
                                    key={source.source}
                                    className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 dark:bg-gray-800/50 transition-colors"
                                >
                                    <StatusIcon className={cn("h-4 w-4 flex-shrink-0", config.color)} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{source.displayName}</p>
                                        <p className="text-xs text-gray-500">{formatRelativeTime(source.lastSync)}</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                                        onClick={() => handleSyncSingle(source)}
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>

                    {/* CSV Sources */}
                    <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
                            <Upload className="h-3 w-3" /> CSV Uploads ({csvSources.length})
                        </div>
                        {csvSources.map((source) => {
                            const config = STATUS_CONFIG[source.status];
                            const StatusIcon = config.icon;
                            return (
                                <div
                                    key={source.source}
                                    className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 dark:bg-gray-800/50 transition-colors"
                                >
                                    <StatusIcon className={cn("h-4 w-4 flex-shrink-0", config.color)} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{source.displayName}</p>
                                        <p className="text-xs text-gray-500">{formatRelativeTime(source.lastSync)}</p>
                                    </div>
                                    <Link href={source.uploadPath || "#"}>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                                        >
                                            <Upload className="h-3 w-3 mr-1" />
                                            Upload
                                            <ChevronRight className="h-3 w-3 ml-1" />
                                        </Button>
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
                    <p className="text-xs text-gray-500 text-center">
                        Auto: 12h threshold • CSV: 4 days threshold
                    </p>
                </div>
            </PopoverContent>
        </Popover>
    );
}
