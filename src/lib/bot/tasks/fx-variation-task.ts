/**
 * FX Variation Auto-Invoice Task
 * 
 * Calcula a variação cambial mensal usando fator fixo 1.1 e cria/atualiza
 * invoices na FA 300.0 (FX Variation) no Accounts Payable.
 * 
 * Fórmula: (USD_Revenue - USD_Expenses) * (1 - 1/1.1)
 *   onde fator ≈ 0.0909
 * 
 * Fluxo:
 * 1. Para cada scope com movimentos USD, busca revenue (csv_rows invoice-orders-usd)
 * 2. Busca expenses USD (invoices where currency=USD, invoice_type=INCURRED, FA≠300.0)
 * 3. Calcula variação FX
 * 4. Cria ou atualiza invoice BOT-FX-YYYYMM-{scope} na FA 300.0
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
    startBotTask,
    updateBotProgress,
    completeBotTask,
    failBotTask,
    BOT_NAME,
    logInvoiceCreated,
} from '@/lib/botella'

// ============================================
// CONFIGURAÇÃO DA TASK
// ============================================

export const FX_VARIATION_CONFIG = {
    taskName: 'fx-variation-monthly',
    taskType: 'reconciliation' as const,

    // Fator fixo de variação cambial
    fxMultiplier: 1.1,

    // Scopes que podem ter movimentos USD
    scopes: ['ES', 'US', 'GLOBAL'] as const,

    // Valores padrão para invoice
    defaults: {
        currency: 'EUR',
        eur_exchange: 1.0,
        provider_code: 'BOT-FX',
        cost_type_code: 'Fixed Cost',
        dep_cost_type_code: '3.0.0',
        cost_center_code: '3.0.0',
        financial_account_code: '300.0',
        entry_type: 'EXPENSE',
        invoice_type: 'INCURRED' as const,
        dre_impact: true,
        cash_impact: false,
    }
}

// ============================================
// INTERFACES
// ============================================

interface MonthScope {
    year: number
    month: number  // 1-12
    scope: string
    usdRevenue: number
    usdExpenses: number
    fxVariation: number
}

interface FxResult {
    invoiceNumber: string
    scope: string
    month: string
    amount: number
    action: 'created' | 'updated' | 'skipped'
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Busca revenue USD de csv_rows (source=invoice-orders-usd) para um mês/scope
 */
async function getUsdRevenue(year: number, month: number, scope: string): Promise<number> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    let total = 0
    let offset = 0
    const pageSize = 1000

    while (true) {
        const { data, error } = await supabaseAdmin
            .from('csv_rows')
            .select('amount')
            .eq('source', 'invoice-orders-usd')
            .gte('date', startDate)
            .lte('date', endDate)
            .contains('custom_data', { scope })
            .range(offset, offset + pageSize - 1)

        if (error) throw new Error(`Revenue query error: ${error.message}`)
        if (!data || data.length === 0) break

        total += data.reduce((sum: number, row: any) => sum + (row.amount || 0), 0)
        if (data.length < pageSize) break
        offset += pageSize
    }

    return total
}

/**
 * Busca expenses USD de invoices (currency=USD, INCURRED, FA≠300.0) para um mês/scope
 */
async function getUsdExpenses(year: number, month: number, scope: string): Promise<number> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    let total = 0
    let offset = 0
    const pageSize = 1000

    while (true) {
        const { data, error } = await supabaseAdmin
            .from('invoices')
            .select('invoice_amount')
            .eq('currency', 'USD')
            .eq('invoice_type', 'INCURRED')
            .eq('dre_impact', true)
            .eq('scope', scope)
            .neq('financial_account_code', '300.0')
            .gte('benefit_date', startDate)
            .lte('benefit_date', endDate)
            .range(offset, offset + pageSize - 1)

        if (error) throw new Error(`Expenses query error: ${error.message}`)
        if (!data || data.length === 0) break

        total += data.reduce((sum: number, row: any) => sum + (row.invoice_amount || 0), 0)
        if (data.length < pageSize) break
        offset += pageSize
    }

    return total
}

/**
 * Gera invoice number para FX variation
 */
function generateFxInvoiceNumber(year: number, month: number, scope: string): string {
    return `BOT-FX-${year}${String(month).padStart(2, '0')}-${scope}`
}

// ============================================
// MAIN TASK EXECUTION
// ============================================

export async function executeFxVariationTask(): Promise<{
    success: boolean
    processed: number
    created: number
    updated: number
    failed: number
    errors: string[]
}> {
    const config = FX_VARIATION_CONFIG
    const ctx = await startBotTask(config.taskName, config.taskType, 'Iniciando cálculo de variação cambial FX...')

    const errors: string[] = []
    const results: FxResult[] = []
    let created = 0
    let updated = 0
    let failed = 0

    try {
        const fxFactor = 1 - (1 / config.fxMultiplier)  // ≈ 0.0909

        // Determinar meses a processar: do Jan do ano corrente até o mês anterior
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth() + 1 // 1-indexed

        // Processar todos os meses até o mês anterior (dados completos)
        // No dia 1 incluímos o mês anterior; para outros dias o mês atual pode ter dados parciais
        const lastMonthToProcess = now.getDate() === 1 ? currentMonth - 1 : currentMonth

        // Backfill: processar desde janeiro do ano corrente
        const monthsToProcess: { year: number; month: number }[] = []
        for (let m = 1; m <= Math.min(lastMonthToProcess, 12); m++) {
            monthsToProcess.push({ year: currentYear, month: m })
        }

        await updateBotProgress(ctx, `Processando ${monthsToProcess.length} meses para ${config.scopes.length} scopes`)

        ctx.recordsProcessed = monthsToProcess.length * config.scopes.length

        for (const { year, month } of monthsToProcess) {
            for (const scope of config.scopes) {
                try {
                    // Calcular revenue e expenses USD
                    const usdRevenue = await getUsdRevenue(year, month, scope)
                    const usdExpenses = await getUsdExpenses(year, month, scope)

                    const netUsd = usdRevenue - usdExpenses
                    const fxVariation = netUsd * fxFactor

                    // Pular se não há movimentos USD para este scope/mês
                    if (usdRevenue === 0 && usdExpenses === 0) {
                        results.push({
                            invoiceNumber: generateFxInvoiceNumber(year, month, scope),
                            scope,
                            month: `${year}-${String(month).padStart(2, '0')}`,
                            amount: 0,
                            action: 'skipped'
                        })
                        continue
                    }

                    const invoiceNumber = generateFxInvoiceNumber(year, month, scope)
                    const benefitDate = `${year}-${String(month).padStart(2, '0')}-01`
                    const amount = Math.round(fxVariation * 100) / 100  // 2 decimais

                    // Check if invoice already exists
                    const { data: existing } = await supabaseAdmin
                        .from('invoices')
                        .select('id, invoice_amount')
                        .eq('invoice_number', invoiceNumber)
                        .single()

                    if (existing) {
                        // Update if amount changed
                        if (Math.abs(existing.invoice_amount - amount) > 0.01) {
                            const { error: updateError } = await supabaseAdmin
                                .from('invoices')
                                .update({
                                    invoice_amount: amount,
                                    notes: `Auto-recalculated by ${BOT_NAME}: USD Revenue=${usdRevenue.toFixed(2)}, USD Expenses=${usdExpenses.toFixed(2)}, Net=${netUsd.toFixed(2)}, Factor=${fxFactor.toFixed(4)}, FX Variation=${amount.toFixed(2)}`,
                                })
                                .eq('id', existing.id)

                            if (updateError) throw new Error(`Update error: ${updateError.message}`)

                            updated++
                            ctx.recordsUpdated = (ctx.recordsUpdated || 0) + 1
                            results.push({ invoiceNumber, scope, month: `${year}-${String(month).padStart(2, '0')}`, amount, action: 'updated' })
                            console.log(`🤖 BOTella: FX invoice ${invoiceNumber} updated to ${amount.toFixed(2)} EUR`)
                        } else {
                            results.push({ invoiceNumber, scope, month: `${year}-${String(month).padStart(2, '0')}`, amount, action: 'skipped' })
                        }
                    } else {
                        // Create new invoice
                        const { data: invoice, error: insertError } = await supabaseAdmin
                            .from('invoices')
                            .insert({
                                input_date: new Date().toISOString().split('T')[0],
                                invoice_date: benefitDate,
                                benefit_date: benefitDate,
                                due_date: benefitDate,
                                schedule_date: null,
                                payment_date: null,

                                invoice_type: config.defaults.invoice_type,
                                entry_type: config.defaults.entry_type,

                                financial_account_code: config.defaults.financial_account_code,

                                invoice_amount: amount,
                                currency: config.defaults.currency,
                                eur_exchange: config.defaults.eur_exchange,

                                provider_code: config.defaults.provider_code,
                                bank_account_code: null,
                                payment_method_code: null,

                                cost_type_code: config.defaults.cost_type_code,
                                dep_cost_type_code: config.defaults.dep_cost_type_code,
                                cost_center_code: config.defaults.cost_center_code,

                                description: `FX Variation ${String(month).padStart(2, '0')}/${year} - ${scope}`,
                                invoice_number: invoiceNumber,

                                country_code: scope === 'GLOBAL' ? 'ES' : scope,
                                scope: scope,

                                dre_impact: config.defaults.dre_impact,
                                cash_impact: config.defaults.cash_impact,

                                notes: `Auto-generated by ${BOT_NAME}: USD Revenue=${usdRevenue.toFixed(2)}, USD Expenses=${usdExpenses.toFixed(2)}, Net=${netUsd.toFixed(2)}, Factor=${fxFactor.toFixed(4)}, FX Variation=${amount.toFixed(2)}`,
                            })
                            .select('id')
                            .single()

                        if (insertError || !invoice) {
                            throw new Error(`Insert error: ${insertError?.message}`)
                        }

                        await logInvoiceCreated(
                            invoice.id,
                            invoiceNumber,
                            amount,
                            config.defaults.currency,
                            `FX Variation ${String(month).padStart(2, '0')}/${year} - ${scope}`
                        )

                        created++
                        ctx.recordsCreated = (ctx.recordsCreated || 0) + 1
                        results.push({ invoiceNumber, scope, month: `${year}-${String(month).padStart(2, '0')}`, amount, action: 'created' })
                        console.log(`🤖 BOTella: FX invoice ${invoiceNumber} created: ${amount.toFixed(2)} EUR`)
                    }
                } catch (scopeError) {
                    failed++
                    ctx.recordsFailed = (ctx.recordsFailed || 0) + 1
                    const errorMsg = scopeError instanceof Error ? scopeError.message : String(scopeError)
                    errors.push(`${year}-${String(month).padStart(2, '0')} ${scope}: ${errorMsg}`)
                }
            }
        }

        await completeBotTask(ctx,
            `FX Variation: ${created} criadas, ${updated} atualizadas, ${failed} falhas`,
            { results, errors }
        )

        return {
            success: true,
            processed: monthsToProcess.length * config.scopes.length,
            created,
            updated,
            failed,
            errors
        }

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)
        await failBotTask(ctx, errorMsg)

        return {
            success: false,
            processed: 0,
            created,
            updated,
            failed,
            errors
        }
    }
}

// ============================================
// TASK METADATA
// ============================================

export const fxVariationTaskMeta = {
    key: 'fx-variation-monthly',
    name: 'FX Variation Monthly',
    description: 'Calcula variação cambial mensal (USD Revenue - USD Expenses) × (1-1/1.1) e cria/atualiza invoices na FA 300.0',
    taskType: 'reconciliation' as const,
    cronExpression: '0 4 * * *', // Todo dia às 4h (junto com o cron diário)
    isActive: true,
    priority: 6,
    maxRetries: 3,
    retryDelaySeconds: 300,
    rateLimitPerMinute: 10,
    timeoutSeconds: 600,
    execute: executeFxVariationTask
}
