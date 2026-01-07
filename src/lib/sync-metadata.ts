// =====================================================
// Sync Metadata Helper Functions
// Funções para atualizar e consultar metadata de sincronização
// =====================================================

import { supabaseAdmin } from './supabase-admin';

export interface SyncMetadata {
    id: string;
    source: string;
    last_api_sync: string | null;
    last_webhook_received: string | null;
    last_full_sync: string | null;
    last_record_date: string | null;
    total_records: number;
    records_added_last_sync: number;
    last_sync_status: 'success' | 'error' | 'in_progress';
    last_sync_error: string | null;
    sync_config: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export type SyncType = 'api' | 'webhook' | 'full';

/**
 * Atualiza metadata de sincronização para uma fonte específica
 */
export async function updateSyncMetadata(params: {
    source: string;
    syncType: SyncType;
    recordsAdded?: number;
    lastRecordDate?: Date;
    status?: 'success' | 'error' | 'in_progress';
    error?: string;
}) {
    const {
        source,
        syncType,
        recordsAdded = 0,
        lastRecordDate,
        status = 'success',
        error,
    } = params;

    const now = new Date().toISOString();

    // Construir objeto de update baseado no tipo de sync
    const updates: Record<string, any> = {
        last_sync_status: status,
        updated_at: now,
    };

    if (syncType === 'api') {
        updates.last_api_sync = now;
    } else if (syncType === 'webhook') {
        updates.last_webhook_received = now;
    } else if (syncType === 'full') {
        updates.last_full_sync = now;
        updates.last_api_sync = now;
    }

    if (recordsAdded > 0) {
        updates.records_added_last_sync = recordsAdded;
    }

    if (lastRecordDate) {
        updates.last_record_date = lastRecordDate.toISOString();
    }

    if (error) {
        updates.last_sync_error = error;
    } else if (status === 'success') {
        updates.last_sync_error = null;
    }

    // Atualizar ou inserir
    const { data, error: dbError } = await supabaseAdmin
        .from('sync_metadata')
        .upsert({
            source,
            ...updates,
        }, {
            onConflict: 'source',
        })
        .select()
        .single();

    if (dbError) {
        console.error('[updateSyncMetadata] Error:', dbError);
        throw dbError;
    }

    // Se há registros adicionados, atualizar total_records
    if (recordsAdded > 0) {
        await incrementTotalRecords(source, recordsAdded);
    }

    return data as SyncMetadata;
}

/**
 * Incrementa o contador total de registros
 */
async function incrementTotalRecords(source: string, increment: number) {
    const { error } = await supabaseAdmin.rpc('increment_sync_total_records', {
        p_source: source,
        p_increment: increment,
    });

    if (error) {
        console.error('[incrementTotalRecords] Error:', error);
        // Não lançar erro, apenas logar
    }
}

/**
 * Busca metadata de sincronização para uma ou mais fontes
 */
export async function getSyncMetadata(sources: string | string[]): Promise<SyncMetadata[]> {
    const sourceArray = Array.isArray(sources) ? sources : [sources];

    const { data, error } = await supabaseAdmin
        .from('sync_metadata')
        .select('*')
        .in('source', sourceArray);

    if (error) {
        console.error('[getSyncMetadata] Error:', error);
        throw error;
    }

    return (data || []) as SyncMetadata[];
}

/**
 * Busca metadata de uma fonte específica
 */
export async function getSyncMetadataBySource(source: string): Promise<SyncMetadata | null> {
    const { data, error } = await supabaseAdmin
        .from('sync_metadata')
        .select('*')
        .eq('source', source)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // Not found - retornar null
            return null;
        }
        console.error('[getSyncMetadataBySource] Error:', error);
        throw error;
    }

    return data as SyncMetadata;
}

/**
 * Marca sincronização como em progresso
 */
export async function markSyncInProgress(source: string, syncType: SyncType) {
    return updateSyncMetadata({
        source,
        syncType,
        status: 'in_progress',
    });
}

/**
 * Marca sincronização como concluída
 */
export async function markSyncComplete(params: {
    source: string;
    syncType: SyncType;
    recordsAdded: number;
    lastRecordDate?: Date;
}) {
    return updateSyncMetadata({
        ...params,
        status: 'success',
    });
}

/**
 * Marca sincronização como erro
 */
export async function markSyncError(params: {
    source: string;
    syncType: SyncType;
    error: string;
}) {
    return updateSyncMetadata({
        ...params,
        status: 'error',
    });
}

/**
 * Obtém a data mais recente entre todos os tipos de sync
 */
export function getMostRecentSyncDate(metadata: SyncMetadata): Date | null {
    const dates = [
        metadata.last_api_sync,
        metadata.last_webhook_received,
        metadata.last_full_sync,
    ].filter(Boolean).map(d => new Date(d!));

    if (dates.length === 0) return null;

    return new Date(Math.max(...dates.map(d => d.getTime())));
}

/**
 * Formata data de sync para exibição
 */
export function formatSyncDate(date: Date | string | null): string {
    if (!date) return 'Never';

    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
