// =====================================================
// Sync Metadata Display Component
// Mostra informações de última sincronização no cabeçalho das páginas
// =====================================================

'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Clock, Zap, Database } from 'lucide-react';

export interface SyncMetadataDisplayProps {
    source: string;
    totalRecords?: number;
    filteredRecords?: number;
}

interface SyncInfo {
    last_api_sync: string | null;
    last_webhook_received: string | null;
    last_record_date: string | null;
    total_records: number;
    last_sync_status: 'success' | 'error' | 'in_progress';
    last_sync_error: string | null;
}

export function SyncMetadataDisplay({ source, totalRecords, filteredRecords }: SyncMetadataDisplayProps) {
    const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSyncMetadata();
        // Atualizar a cada 30 segundos
        const interval = setInterval(fetchSyncMetadata, 30000);
        return () => clearInterval(interval);
    }, [source]);

    async function fetchSyncMetadata() {
        try {
            const res = await fetch(`/api/sync-metadata?source=${source}`);
            if (res.ok) {
                const data = await res.json();
                setSyncInfo(data);
            }
        } catch (error) {
            console.error('Error fetching sync metadata:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading sync info...</span>
            </div>
        );
    }

    if (!syncInfo) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <AlertCircle className="h-4 w-4" />
                <span>No sync data available</span>
            </div>
        );
    }

    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return 'Never';

        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;

        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    const formatDateTime = (dateStr: string | null): string => {
        if (!dateStr) return 'Never';

        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Determinar a data mais recente
    const mostRecentSync = [
        syncInfo.last_api_sync,
        syncInfo.last_webhook_received,
    ].filter(Boolean).sort().reverse()[0];

    const StatusIcon = syncInfo.last_sync_status === 'success'
        ? CheckCircle2
        : syncInfo.last_sync_status === 'error'
            ? AlertCircle
            : Loader2;

    const statusColor = syncInfo.last_sync_status === 'success'
        ? 'text-green-500'
        : syncInfo.last_sync_status === 'error'
            ? 'text-red-500'
            : 'text-blue-500';

    return (
        <div className="flex flex-wrap items-center gap-4 text-sm">
            {/* Most Recent Sync */}
            <div className="flex items-center gap-2">
                <StatusIcon className={`h-4 w-4 ${statusColor} ${syncInfo.last_sync_status === 'in_progress' ? 'animate-spin' : ''}`} />
                <span className="text-gray-700">
                    Most recent: <strong>{formatDate(mostRecentSync)}</strong>
                </span>
            </div>

            {/* Last API Sync */}
            {syncInfo.last_api_sync && (
                <div className="flex items-center gap-2 text-gray-600">
                    <Database className="h-4 w-4" />
                    <span>Last sync: {formatDateTime(syncInfo.last_api_sync)}</span>
                </div>
            )}

            {/* Last Webhook */}
            {syncInfo.last_webhook_received && (
                <div className="flex items-center gap-2 text-gray-600">
                    <Zap className="h-4 w-4" />
                    <span>Last webhook: {formatDateTime(syncInfo.last_webhook_received)}</span>
                </div>
            )}

            {/* Last Record Date */}
            {syncInfo.last_record_date && (
                <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Most recent data: {formatDate(syncInfo.last_record_date)}</span>
                </div>
            )}

            {/* Record Counts */}
            {(totalRecords !== undefined || filteredRecords !== undefined) && (
                <div className="text-gray-600">
                    {filteredRecords !== undefined ? (
                        <span>
                            {totalRecords} records ({filteredRecords} filtered)
                        </span>
                    ) : (
                        <span>{totalRecords} records</span>
                    )}
                </div>
            )}

            {/* Error Message */}
            {syncInfo.last_sync_status === 'error' && syncInfo.last_sync_error && (
                <div className="flex items-center gap-2 text-red-600 text-xs">
                    <AlertCircle className="h-3 w-3" />
                    <span>{syncInfo.last_sync_error}</span>
                </div>
            )}
        </div>
    );
}
