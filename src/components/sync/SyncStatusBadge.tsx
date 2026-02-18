"use client";

import { useEffect, useState } from "react";
import { Clock, Zap, Database, AlertCircle } from "lucide-react";
import { formatTimestamp } from "@/lib/formatters";

interface SyncStatusBadgeProps {
    source: string;
}

export function SyncStatusBadge({ source }: SyncStatusBadgeProps) {
    const [metadata, setMetadata] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMetadata();

        // Refresh a cada 30 segundos
        const interval = setInterval(loadMetadata, 30000);
        return () => clearInterval(interval);
    }, [source]);

    async function loadMetadata() {
        try {
            // Chamada para API route ao invés de função direta
            const response = await fetch(`/api/sync-metadata/${encodeURIComponent(source)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch sync metadata');
            }
            const data = await response.json();
            setMetadata(data);
        } catch (error) {
            console.error("Error loading sync metadata:", error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-white/60">
                <Clock className="h-4 w-4 animate-spin" />
                <span>Loading sync info...</span>
            </div>
        );
    }

    if (!metadata) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-white/60">
                <AlertCircle className="h-4 w-4" />
                <span>No sync data available</span>
            </div>
        );
    }

    const lastSync = metadata.last_sync_at || metadata.last_incremental_sync;
    const lastWebhook = metadata.last_webhook_received_at;
    const mostRecent = metadata.most_recent_record_date;

    return (
        <div className="flex flex-col gap-1 text-sm text-gray-900 dark:text-white/90">
            {/* Last Sync */}
            {lastSync && (
                <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-400" />
                    <span className="text-gray-900 dark:text-white/70">Last sync:</span>
                    <span className="font-mono text-gray-900 dark:text-white">
                        {formatTimestamp(new Date(lastSync))}
                    </span>
                </div>
            )}

            {/* Last Webhook */}
            {lastWebhook && (
                <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-400" />
                    <span className="text-gray-900 dark:text-white/70">Last webhook:</span>
                    <span className="font-mono text-gray-900 dark:text-white">
                        {formatTimestamp(new Date(lastWebhook))}
                    </span>
                </div>
            )}

            {/* Most Recent Record */}
            {mostRecent && (
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-green-400" />
                    <span className="text-gray-900 dark:text-white/70">Most recent:</span>
                    <span className="font-mono text-gray-900 dark:text-white">
                        {new Date(mostRecent).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                        })}
                    </span>
                </div>
            )}
        </div>
    );
}
