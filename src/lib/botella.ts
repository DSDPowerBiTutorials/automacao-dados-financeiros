/**
 * BOTella v2 - Sistema de Automação com Notificações
 * 
 * Padrões inspirados no Celery:
 * - Retry com exponential backoff
 * - Rate limiting
 * - Task chaining (workflows)
 * - Dead letter queue
 * - Estados de tarefa (PENDING → STARTED → SUCCESS/FAILURE)
 */

import { supabaseAdmin } from './supabase-admin'

// ============================================
// TIPOS
// ============================================

export type TaskStatus = 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'RETRY' | 'REVOKED'
export type TaskType = 'sync' | 'reconciliation' | 'report' | 'notification' | 'cleanup' | 'backup'
export type NotificationChannel = 'email' | 'push' | 'sms' | 'in_app'
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'read'

// Alias para compatibilidade com código anterior
export type BotTaskType = TaskType
export type BotLogStatus = 'started' | 'running' | 'completed' | 'failed' | 'warning'

export interface BotTask {
    id: string
    task_key: string
    name: string
    description?: string
    task_type: TaskType
    cron_expression?: string
    is_active: boolean
    priority: number
    max_retries: number
    retry_delay_seconds: number
    rate_limit_per_minute: number
    timeout_seconds: number
    config: Record<string, unknown>
    last_run_at?: string
    last_status?: TaskStatus
}

export interface BotLog {
    id: string
    task_id?: string
    task_name: string
    status: TaskStatus
    attempt: number
    records_processed: number
    records_created: number
    records_updated: number
    records_failed: number
    started_at: string
    completed_at?: string
    duration_ms?: number
    result?: Record<string, unknown>
    error_message?: string
    error_stack?: string
    metadata?: Record<string, unknown>
    executed_by: string
}

export interface BotNotification {
    id: string
    user_id: string
    channel: NotificationChannel
    title: string
    message: string
    priority: NotificationPriority
    status: NotificationStatus
    scheduled_for: string
    sent_at?: string
    read_at?: string
    metadata?: Record<string, unknown>
}

export interface BotTaskContext {
    logId: string
    taskName: string
    taskType: TaskType
    taskId?: string
    startTime: Date
    attempt: number
    recordsProcessed: number
    recordsCreated: number
    recordsUpdated: number
    recordsFailed: number
    metadata: Record<string, unknown>
}

export interface ExecutionResult<T = unknown> {
    success: boolean
    result?: T
    error?: string
    attempts: number
    durationMs: number
}

// ============================================
// CONSTANTES
// ============================================

export const BOT_NAME = 'BOTella'
export const BOT_EMAIL = 'botella@system.local'
export const BOT_CONSOLE_NAME = '🤖 BOTella'

export const BOT_NAME_PARTS = {
    bold: 'BOT',
    normal: 'ella'
}

// ============================================
// RATE LIMITER
// ============================================

const rateLimitCache: Map<string, { count: number; resetAt: number }> = new Map()

export function checkRateLimit(key: string, maxPerMinute: number): boolean {
    const now = Date.now()
    const cached = rateLimitCache.get(key)

    if (!cached || now > cached.resetAt) {
        rateLimitCache.set(key, { count: 1, resetAt: now + 60000 })
        return true
    }

    if (cached.count >= maxPerMinute) {
        console.warn(`${BOT_CONSOLE_NAME} [${key}] Rate limit atingido (${maxPerMinute}/min)`)
        return false
    }

    cached.count++
    return true
}

// ============================================
// LOGGING - Core Functions
// ============================================

/**
 * Inicia uma nova tarefa e retorna o contexto
 */
export async function startBotTask(
    taskName: string,
    taskType: TaskType,
    message?: string
): Promise<BotTaskContext> {
    const startTime = new Date()

    console.log(`${BOT_CONSOLE_NAME} [${taskName}] ▶️ Iniciando...`)

    const { data, error } = await supabaseAdmin
        .from('bot_logs')
        .insert({
            task_name: taskName,
            status: 'STARTED',
            attempt: 1,
            started_at: startTime.toISOString(),
            metadata: message ? { message } : {},
            executed_by: BOT_NAME
        })
        .select('id')
        .single()

    if (error) {
        console.error(`${BOT_CONSOLE_NAME} [${taskName}] ❌ Erro ao criar log:`, error.message)
        return {
            logId: 'local-' + Date.now(),
            taskName,
            taskType,
            startTime,
            attempt: 1,
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            metadata: {}
        }
    }

    return {
        logId: data.id,
        taskName,
        taskType,
        startTime,
        attempt: 1,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        metadata: {}
    }
}

/**
 * Atualiza o progresso de uma tarefa
 */
export async function updateBotProgress(
    ctx: BotTaskContext,
    message: string,
    details?: Record<string, unknown>
): Promise<void> {
    console.log(`${BOT_CONSOLE_NAME} [${ctx.taskName}] 🔄 ${message}`)

    if (ctx.logId.startsWith('local-')) return

    await supabaseAdmin
        .from('bot_logs')
        .update({
            status: 'STARTED',
            records_processed: ctx.recordsProcessed,
            records_created: ctx.recordsCreated,
            records_updated: ctx.recordsUpdated,
            records_failed: ctx.recordsFailed,
            metadata: { ...ctx.metadata, progress: message, ...details }
        })
        .eq('id', ctx.logId)
}

/**
 * Finaliza uma tarefa com sucesso
 */
export async function completeBotTask(
    ctx: BotTaskContext,
    message?: string,
    details?: Record<string, unknown>
): Promise<void> {
    const durationMs = Date.now() - ctx.startTime.getTime()
    const durationSec = (durationMs / 1000).toFixed(1)

    console.log(`${BOT_CONSOLE_NAME} [${ctx.taskName}] ✅ Concluído em ${durationSec}s`)
    console.log(`   📊 Processados: ${ctx.recordsProcessed} | Criados: ${ctx.recordsCreated} | Atualizados: ${ctx.recordsUpdated} | Falhas: ${ctx.recordsFailed}`)

    if (ctx.logId.startsWith('local-')) return

    await supabaseAdmin
        .from('bot_logs')
        .update({
            status: 'SUCCESS',
            completed_at: new Date().toISOString(),
            duration_ms: durationMs,
            records_processed: ctx.recordsProcessed,
            records_created: ctx.recordsCreated,
            records_updated: ctx.recordsUpdated,
            records_failed: ctx.recordsFailed,
            result: details,
            metadata: { ...ctx.metadata, message }
        })
        .eq('id', ctx.logId)

    if (ctx.taskId) {
        await supabaseAdmin
            .from('bot_tasks')
            .update({ last_run_at: new Date().toISOString(), last_status: 'SUCCESS' })
            .eq('id', ctx.taskId)
    }
}

/**
 * Finaliza uma tarefa com erro
 */
export async function failBotTask(
    ctx: BotTaskContext,
    error: Error | string,
    details?: Record<string, unknown>
): Promise<void> {
    const durationMs = Date.now() - ctx.startTime.getTime()
    const errorMessage = error instanceof Error ? error.message : error
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error(`${BOT_CONSOLE_NAME} [${ctx.taskName}] ❌ Falhou: ${errorMessage}`)

    if (ctx.logId.startsWith('local-')) return

    await supabaseAdmin
        .from('bot_logs')
        .update({
            status: 'FAILURE',
            completed_at: new Date().toISOString(),
            duration_ms: durationMs,
            records_processed: ctx.recordsProcessed,
            records_created: ctx.recordsCreated,
            records_updated: ctx.recordsUpdated,
            records_failed: ctx.recordsFailed,
            error_message: errorMessage,
            error_stack: errorStack,
            result: details,
            metadata: ctx.metadata
        })
        .eq('id', ctx.logId)

    if (ctx.taskId) {
        await supabaseAdmin
            .from('bot_tasks')
            .update({ last_run_at: new Date().toISOString(), last_status: 'FAILURE' })
            .eq('id', ctx.taskId)
    }

    // Adicionar à dead letter queue
    await supabaseAdmin.from('bot_dead_letter_queue').insert({
        original_log_id: ctx.logId,
        task_name: ctx.taskName,
        payload: ctx.metadata,
        error_message: errorMessage,
        attempts: ctx.attempt
    })
}

/**
 * Finaliza uma tarefa com warning (parcialmente bem-sucedida)
 */
export async function warnBotTask(
    ctx: BotTaskContext,
    message: string,
    details?: Record<string, unknown>
): Promise<void> {
    const durationMs = Date.now() - ctx.startTime.getTime()

    console.warn(`${BOT_CONSOLE_NAME} [${ctx.taskName}] ⚠️ Warning: ${message}`)

    if (ctx.logId.startsWith('local-')) return

    await supabaseAdmin
        .from('bot_logs')
        .update({
            status: 'SUCCESS', // Consideramos warning como success parcial
            completed_at: new Date().toISOString(),
            duration_ms: durationMs,
            records_processed: ctx.recordsProcessed,
            records_created: ctx.recordsCreated,
            records_updated: ctx.recordsUpdated,
            records_failed: ctx.recordsFailed,
            result: details,
            metadata: { ...ctx.metadata, warning: message }
        })
        .eq('id', ctx.logId)
}

// ============================================
// EXECUTOR COM RETRY (Padrão Celery)
// ============================================

/**
 * Executa uma função com retry automático e backoff exponencial
 */
export async function executeWithRetry<T>(
    taskName: string,
    taskType: TaskType,
    fn: (ctx: BotTaskContext) => Promise<T>,
    options: {
        maxRetries?: number
        retryDelayMs?: number
        exponentialBackoff?: boolean
        taskId?: string
        metadata?: Record<string, unknown>
        rateLimit?: number
    } = {}
): Promise<ExecutionResult<T>> {
    const maxRetries = options.maxRetries ?? 3
    const baseDelay = options.retryDelayMs ?? 1000
    const useBackoff = options.exponentialBackoff ?? true
    const rateLimit = options.rateLimit ?? 60

    if (!checkRateLimit(taskName, rateLimit)) {
        return { success: false, error: 'Rate limit exceeded', attempts: 0, durationMs: 0 }
    }

    const ctx = await startBotTask(taskName, taskType)
    ctx.taskId = options.taskId
    ctx.metadata = options.metadata || {}

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        ctx.attempt = attempt

        try {
            const result = await fn(ctx)
            await completeBotTask(ctx, 'Sucesso', typeof result === 'object' ? (result as Record<string, unknown>) : { value: result })

            return {
                success: true,
                result,
                attempts: attempt,
                durationMs: Date.now() - ctx.startTime.getTime()
            }
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            if (attempt < maxRetries) {
                console.warn(`${BOT_CONSOLE_NAME} [${taskName}] 🔄 Retry #${attempt}: ${lastError.message}`)
                const delay = useBackoff ? baseDelay * Math.pow(2, attempt - 1) : baseDelay
                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }
    }

    await failBotTask(ctx, lastError!)

    return {
        success: false,
        error: lastError?.message,
        attempts: maxRetries,
        durationMs: Date.now() - ctx.startTime.getTime()
    }
}

/**
 * Wrapper simples para executar tarefa com logging automático
 */
export async function runBotTask<T>(
    taskName: string,
    taskType: TaskType,
    fn: (ctx: BotTaskContext) => Promise<T>
): Promise<T> {
    const ctx = await startBotTask(taskName, taskType)

    try {
        const result = await fn(ctx)
        await completeBotTask(ctx)
        return result
    } catch (error) {
        await failBotTask(ctx, error instanceof Error ? error : String(error))
        throw error
    }
}

// ============================================
// SISTEMA DE NOTIFICAÇÕES
// ============================================

/**
 * Cria uma notificação na fila
 */
export async function createNotification(
    userId: string,
    channel: NotificationChannel,
    title: string,
    message: string,
    options: {
        priority?: NotificationPriority
        scheduledFor?: Date
        metadata?: Record<string, unknown>
    } = {}
): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from('bot_notifications')
        .insert({
            user_id: userId,
            channel,
            title,
            message,
            priority: options.priority || 'normal',
            scheduled_for: (options.scheduledFor || new Date()).toISOString(),
            metadata: options.metadata || {}
        })
        .select('id')
        .single()

    if (error) {
        console.error(`${BOT_CONSOLE_NAME} Erro ao criar notificação:`, error.message)
        return null
    }

    console.log(`${BOT_CONSOLE_NAME} 📬 Notificação criada: ${title}`)
    return data?.id || null
}

/**
 * Notifica todos os usuários configurados para um tipo de evento
 */
export async function notifyByEvent(
    eventType: string,
    variables: Record<string, string | number>,
    options: { priority?: NotificationPriority } = {}
): Promise<number> {
    const { data: rules } = await supabaseAdmin
        .from('bot_notification_rules')
        .select('*, bot_users!inner(*)')
        .eq('event_type', eventType)
        .eq('is_active', true)

    if (!rules?.length) return 0

    const { data: template } = await supabaseAdmin
        .from('bot_notification_templates')
        .select('*')
        .eq('event_type', eventType)
        .eq('is_active', true)
        .single()

    if (!template) return 0

    let sent = 0

    for (const rule of rules) {
        if (!rule.bot_users?.is_active) continue

        let title = template.subject || template.name
        let message = template.body_template
        const userVars = { ...variables, user_name: rule.bot_users.name }

        for (const [key, value] of Object.entries(userVars)) {
            const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
            title = title.replace(placeholder, String(value))
            message = message.replace(placeholder, String(value))
        }

        for (const channel of rule.channels || ['email', 'in_app']) {
            const id = await createNotification(rule.user_id, channel as NotificationChannel, title, message, {
                priority: options.priority,
                metadata: { template_id: template.id, variables }
            })
            if (id) sent++
        }
    }

    console.log(`${BOT_CONSOLE_NAME} 📨 ${sent} notificações criadas para evento: ${eventType}`)
    return sent
}

/**
 * Log simples do BOT (para uso rápido sem contexto)
 */
export async function logBotAction(
    taskName: string,
    taskType: TaskType,
    status: 'STARTED' | 'SUCCESS' | 'FAILURE',
    message: string,
    details?: Record<string, unknown>
): Promise<void> {
    const emoji = status === 'SUCCESS' ? '✅' : status === 'FAILURE' ? '❌' : '▶️'
    console.log(`${BOT_CONSOLE_NAME} [${taskName}] ${emoji} ${message}`)

    await supabaseAdmin.from('bot_logs').insert({
        task_name: taskName,
        status,
        started_at: new Date().toISOString(),
        completed_at: status !== 'STARTED' ? new Date().toISOString() : null,
        metadata: { message, ...details },
        executed_by: BOT_NAME
    })
}

// ============================================
// CONSULTAS
// ============================================

export async function getBotLogs(limit: number = 50, taskType?: TaskType): Promise<BotLog[]> {
    let query = supabaseAdmin
        .from('bot_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit)

    if (taskType) {
        query = query.eq('task_type', taskType)
    }

    const { data } = await query
    return data || []
}

export async function getBotTasks(): Promise<BotTask[]> {
    const { data } = await supabaseAdmin
        .from('bot_tasks')
        .select('*')
        .order('priority')
    return data || []
}

export async function toggleBotTask(taskKey: string, enabled: boolean): Promise<void> {
    await supabaseAdmin
        .from('bot_tasks')
        .update({ is_active: enabled })
        .eq('task_key', taskKey)
}

export async function getBotStats(days: number = 7): Promise<{
    totalTasks: number
    completed: number
    failed: number
    warnings: number
    avgDurationMs: number
    totalRecordsProcessed: number
}> {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data } = await supabaseAdmin
        .from('bot_logs')
        .select('status, duration_ms, records_processed')
        .gte('started_at', since.toISOString())

    if (!data?.length) {
        return { totalTasks: 0, completed: 0, failed: 0, warnings: 0, avgDurationMs: 0, totalRecordsProcessed: 0 }
    }

    const durations = data.filter(l => l.duration_ms).map(l => l.duration_ms!)

    return {
        totalTasks: data.length,
        completed: data.filter(l => l.status === 'SUCCESS').length,
        failed: data.filter(l => l.status === 'FAILURE').length,
        warnings: data.filter(l => l.status === 'RETRY').length,
        avgDurationMs: durations.length > 0
            ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
            : 0,
        totalRecordsProcessed: data.reduce((sum, l) => sum + (l.records_processed || 0), 0)
    }
}

export async function getUnreadNotifications(userId: string): Promise<BotNotification[]> {
    const { data } = await supabaseAdmin
        .from('bot_notifications')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'sent'])
        .eq('channel', 'in_app')
        .order('created_at', { ascending: false })
        .limit(20)
    return data || []
}

export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
    const { error } = await supabaseAdmin
        .from('bot_notifications')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('id', notificationId)
    return !error
}
