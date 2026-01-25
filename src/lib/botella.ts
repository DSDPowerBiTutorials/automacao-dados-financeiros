/**
 * BOTella - Sistema de Automação com Logs
 * 
 * Biblioteca para gerenciar tarefas automáticas do sistema.
 * O nome "BOTella" aparece com "BOT" em negrito na UI.
 */

import { supabaseAdmin } from "./supabase-admin";

// ============================================================================
// TIPOS
// ============================================================================

export type BotTaskType =
    | "sync"
    | "reconciliation"
    | "cleanup"
    | "notification"
    | "backup";

export type BotLogStatus =
    | "PENDING"
    | "STARTED"
    | "SUCCESS"
    | "FAILURE"
    | "RETRY"
    | "REVOKED";

export interface BotLog {
    id?: string;
    task_id?: string;
    task_name: string;
    status: BotLogStatus;
    attempt?: number;
    records_processed?: number;
    records_created?: number;
    records_updated?: number;
    records_failed?: number;
    started_at?: string;
    completed_at?: string;
    duration_ms?: number;
    result?: Record<string, unknown>;
    error_message?: string;
    error_stack?: string;
    metadata?: Record<string, unknown>;
    executed_by?: string;
}

export interface BotTask {
    id: number;
    task_key: string;
    task_name: string;
    task_type: BotTaskType;
    description?: string;
    schedule?: string;
    is_enabled: boolean;
    last_run_at?: string;
    last_status?: BotLogStatus;
    next_run_at?: string;
    config?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface BotTaskContext {
    logId: string;
    taskName: string;
    taskType: BotTaskType;
    startTime: number;
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsFailed: number;
}

// ============================================================================
// CONSTANTES
// ============================================================================

export const BOT_NAME = "BOTella";

/**
 * Renderiza o nome do BOT com formatação (para uso em React)
 * Retorna: { bold: "BOT", normal: "ella" }
 */
export const BOT_NAME_PARTS = {
    bold: "BOT",
    normal: "ella",
};

/**
 * Renderiza o nome completo para logs de console
 */
export const BOT_CONSOLE_NAME = "🤖 BOTella";

// ============================================================================
// FUNÇÕES DE LOGGING
// ============================================================================

/**
 * Inicia uma nova tarefa do BOT e retorna o contexto
 */
export async function startBotTask(
    taskName: string,
    taskType: BotTaskType,
    message?: string
): Promise<BotTaskContext> {
    const startTime = Date.now();

    console.log(`${BOT_CONSOLE_NAME} [${taskName}] ▶️ Iniciando...`);

    const { data, error } = await supabaseAdmin
        .from("bot_logs")
        .insert({
            task_name: taskName,
            status: "STARTED",
            attempt: 1,
            started_at: new Date().toISOString(),
            executed_by: BOT_NAME,
            metadata: {
                task_type: taskType,
                message: message || `Tarefa "${taskName}" iniciada`
            },
        })
        .select("id")
        .single();

    if (error) {
        console.error(`${BOT_CONSOLE_NAME} [${taskName}] ❌ Erro ao criar log:`, error.message);
        throw error;
    }

    return {
        logId: data.id,
        taskName,
        taskType,
        startTime,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
    };
}

/**
 * Atualiza o progresso de uma tarefa em execução
 */
export async function updateBotProgress(
    context: BotTaskContext,
    message: string,
    details?: Record<string, unknown>
): Promise<void> {
    console.log(`${BOT_CONSOLE_NAME} [${context.taskName}] 🔄 ${message}`);

    await supabaseAdmin
        .from("bot_logs")
        .update({
            status: "STARTED",
            records_processed: context.recordsProcessed,
            records_created: context.recordsCreated,
            records_updated: context.recordsUpdated,
            records_failed: context.recordsFailed,
            metadata: { message, ...details },
        })
        .eq("id", context.logId);
}

/**
 * Finaliza uma tarefa com sucesso
 */
export async function completeBotTask(
    context: BotTaskContext,
    message?: string,
    details?: Record<string, unknown>
): Promise<void> {
    const durationMs = Date.now() - context.startTime;
    const durationSec = (durationMs / 1000).toFixed(1);

    console.log(`${BOT_CONSOLE_NAME} [${context.taskName}] ✅ Concluído em ${durationSec}s`);
    console.log(`   📊 Processados: ${context.recordsProcessed} | Criados: ${context.recordsCreated} | Atualizados: ${context.recordsUpdated} | Falhas: ${context.recordsFailed}`);

    await supabaseAdmin
        .from("bot_logs")
        .update({
            status: "SUCCESS",
            records_processed: context.recordsProcessed,
            records_created: context.recordsCreated,
            records_updated: context.recordsUpdated,
            records_failed: context.recordsFailed,
            duration_ms: durationMs,
            completed_at: new Date().toISOString(),
            result: { message: message || `Tarefa concluída com sucesso`, ...details },
        })
        .eq("id", context.logId);

    // Atualizar última execução na tabela de tarefas
    await supabaseAdmin
        .from("bot_tasks")
        .update({
            last_run_at: new Date().toISOString(),
            last_status: "SUCCESS",
            updated_at: new Date().toISOString(),
        })
        .eq("task_key", context.taskName);
}

/**
 * Finaliza uma tarefa com erro
 */
export async function failBotTask(
    context: BotTaskContext,
    error: Error | string,
    details?: Record<string, unknown>
): Promise<void> {
    const durationMs = Date.now() - context.startTime;
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`${BOT_CONSOLE_NAME} [${context.taskName}] ❌ Falhou: ${errorMessage}`);

    await supabaseAdmin
        .from("bot_logs")
        .update({
            status: "FAILURE",
            records_processed: context.recordsProcessed,
            records_created: context.recordsCreated,
            records_updated: context.recordsUpdated,
            records_failed: context.recordsFailed,
            duration_ms: durationMs,
            error_message: errorMessage,
            error_stack: errorStack,
            completed_at: new Date().toISOString(),
            result: details,
        })
        .eq("id", context.logId);

    // Atualizar última execução na tabela de tarefas
    await supabaseAdmin
        .from("bot_tasks")
        .update({
            last_run_at: new Date().toISOString(),
            last_status: "FAILURE",
            updated_at: new Date().toISOString(),
        })
        .eq("task_key", context.taskName);
}

/**
 * Finaliza uma tarefa com warning (parcialmente bem-sucedida)
 * Nota: No schema v2, warning é mapeado para SUCCESS com flag em metadata
 */
export async function warnBotTask(
    context: BotTaskContext,
    message: string,
    details?: Record<string, unknown>
): Promise<void> {
    const durationMs = Date.now() - context.startTime;

    console.warn(`${BOT_CONSOLE_NAME} [${context.taskName}] ⚠️ Warning: ${message}`);

    await supabaseAdmin
        .from("bot_logs")
        .update({
            status: "SUCCESS",
            records_processed: context.recordsProcessed,
            records_created: context.recordsCreated,
            records_updated: context.recordsUpdated,
            records_failed: context.recordsFailed,
            duration_ms: durationMs,
            completed_at: new Date().toISOString(),
            result: { warning: true, message, ...details },
        })
        .eq("id", context.logId);

    // Atualizar última execução na tabela de tarefas
    await supabaseAdmin
        .from("bot_tasks")
        .update({
            last_run_at: new Date().toISOString(),
            last_status: "SUCCESS",
            updated_at: new Date().toISOString(),
        })
        .eq("task_key", context.taskName);
}

// ============================================================================
// FUNÇÕES DE CONSULTA
// ============================================================================

/**
 * Obtém os últimos logs do BOT
 */
export async function getBotLogs(
    limit: number = 50,
    taskType?: BotTaskType,
    status?: BotLogStatus
): Promise<BotLog[]> {
    let query = supabaseAdmin
        .from("bot_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(limit);

    // taskType está em metadata.task_type, não é filtrável diretamente
    // mas podemos filtrar por status
    if (status) {
        query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
        console.error(`${BOT_CONSOLE_NAME} Erro ao buscar logs:`, error.message);
        throw error;
    }

    // Filtrar por taskType se fornecido (filtragem em memória)
    if (taskType && data) {
        return data.filter(log =>
            log.metadata?.task_type === taskType
        );
    }

    return data || [];
}

/**
 * Obtém todas as tarefas configuradas
 */
export async function getBotTasks(): Promise<BotTask[]> {
    const { data, error } = await supabaseAdmin
        .from("bot_tasks")
        .select("*")
        .order("task_type", { ascending: true });

    if (error) {
        console.error(`${BOT_CONSOLE_NAME} Erro ao buscar tarefas:`, error.message);
        throw error;
    }

    return data || [];
}

/**
 * Ativa ou desativa uma tarefa
 */
export async function toggleBotTask(taskKey: string, enabled: boolean): Promise<void> {
    const { error } = await supabaseAdmin
        .from("bot_tasks")
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq("task_key", taskKey);

    if (error) {
        console.error(`${BOT_CONSOLE_NAME} Erro ao atualizar tarefa:`, error.message);
        throw error;
    }
}

/**
 * Obtém estatísticas do BOT
 */
export async function getBotStats(days: number = 7): Promise<{
    totalTasks: number;
    completed: number;
    failed: number;
    warnings: number;
    avgDurationMs: number;
    totalRecordsProcessed: number;
}> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabaseAdmin
        .from("bot_logs")
        .select("status, duration_ms, records_processed, result")
        .gte("started_at", since.toISOString());

    if (error) {
        console.error(`${BOT_CONSOLE_NAME} Erro ao buscar estatísticas:`, error.message);
        throw error;
    }

    const logs = data || [];

    return {
        totalTasks: logs.length,
        completed: logs.filter(l => l.status === "SUCCESS").length,
        failed: logs.filter(l => l.status === "FAILURE").length,
        warnings: logs.filter(l => l.status === "SUCCESS" && l.result?.warning === true).length,
        avgDurationMs: logs.length > 0
            ? Math.round(logs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / logs.length)
            : 0,
        totalRecordsProcessed: logs.reduce((sum, l) => sum + (l.records_processed || 0), 0),
    };
}

// ============================================================================
// HELPER: Executar tarefa com tratamento automático de erros
// ============================================================================

/**
 * Wrapper para executar uma tarefa do BOT com logging automático
 */
export async function runBotTask<T>(
    taskName: string,
    taskType: BotTaskType,
    fn: (context: BotTaskContext) => Promise<T>
): Promise<T> {
    const context = await startBotTask(taskName, taskType);

    try {
        const result = await fn(context);
        await completeBotTask(context);
        return result;
    } catch (error) {
        await failBotTask(context, error instanceof Error ? error : String(error));
        throw error;
    }
}

// ============================================================================
// LOG SIMPLES (para uso rápido sem contexto)
// ============================================================================

/**
 * Registra um log simples do BOT (sem contexto de tarefa)
 */
export async function logBotAction(
    taskName: string,
    taskType: BotTaskType,
    status: BotLogStatus,
    message: string,
    details?: Record<string, unknown>
): Promise<void> {
    console.log(`${BOT_CONSOLE_NAME} [${taskName}] ${getStatusEmoji(status)} ${message}`);

    await supabaseAdmin.from("bot_logs").insert({
        task_name: taskName,
        status,
        executed_by: BOT_NAME,
        metadata: { task_type: taskType, message, ...details },
        started_at: new Date().toISOString(),
        completed_at: status !== "PENDING" && status !== "STARTED"
            ? new Date().toISOString()
            : null,
    });
}

function getStatusEmoji(status: BotLogStatus): string {
    switch (status) {
        case "PENDING": return "⏳";
        case "STARTED": return "▶️";
        case "SUCCESS": return "✅";
        case "FAILURE": return "❌";
        case "RETRY": return "🔄";
        case "REVOKED": return "🚫";
        default: return "📝";
    }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

/**
 * Verifica rate limit para uma task (em memória)
 * Retorna true se pode executar, false se atingiu o limite
 */
export function checkRateLimit(taskKey: string, maxPerMinute: number): boolean {
    const now = Date.now();
    const entry = rateLimitCache.get(taskKey);

    if (!entry || now > entry.resetAt) {
        // Reset ou primeira execução
        rateLimitCache.set(taskKey, { count: 1, resetAt: now + 60000 });
        return true;
    }

    if (entry.count >= maxPerMinute) {
        return false;
    }

    entry.count++;
    return true;
}
