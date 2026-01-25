/**
 * Swift Commission Auto-Invoice Task
 * 
 * Detecta débitos "Comis.pago swift" no Bankinter EUR e cria 
 * automaticamente invoices no Accounts Payable com pagamento marcado como pago.
 * 
 * Fluxo:
 * 1. Busca csv_rows do Bankinter EUR com description LIKE 'Comis.pago swift%'
 * 2. Filtra apenas débitos (amount < 0) não processados
 * 3. Cria invoice na tabela invoices (Accounts Payable)
 * 4. Marca como pago e reconciliado
 * 5. Marca csv_row como processado
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
    startBotTask,
    updateBotProgress,
    completeBotTask,
    failBotTask,
    BOT_NAME,
} from '@/lib/botella'

// ============================================
// CONFIGURAÇÃO DA TASK
// ============================================

export const SWIFT_COMMISSION_CONFIG = {
    taskName: 'swift-commission-auto-invoice',
    taskType: 'reconciliation' as const,

    // Filtros para busca no csv_rows
    source: 'bankinter-eur',
    descriptionPattern: 'Comis.pago swift%',

    // Valores padrão para invoice (tabela invoices do Accounts Payable)
    // ATENÇÃO: Todos os códigos abaixo são valores REAIS das tabelas de master data
    defaults: {
        currency: 'EUR',
        eur_exchange: 1.0,
        scope: 'ES',
        country_code: 'ES',
        provider_code: 'BANKINTER',                    // providers.code = 'BANKINTER'
        cost_type_code: 'VARIABLE',                    // cost_types.code = 'VARIABLE' (Variable Cost)
        dep_cost_type_code: 'GENEXP',                  // dep_cost_types.code = 'GENEXP' (General Expenses)
        cost_center_code: '3.0.0',                     // cost_centers.code = '3.0.0' (Corporate - Department)
        sub_department_code: '3.1.1',                  // sub_departments.code = '3.1.1' (Finance)
        financial_account_code: '209.1',               // financial_accounts.code = '209.1' (Bank and Financial Fees SPAIN)
        financial_account_name: '209.1 - Bank and Financial Fees SPAIN',
        bank_account_code: 'BANKINTER-4605',           // bank_accounts.code = 'BANKINTER-4605'
        payment_method_code: 'DIRECT_DEBIT',           // payment_methods.code = 'DIRECT_DEBIT'
        entry_type: 'EXPENSE',
        invoice_type: 'INCURRED',
        dre_impact: true,
        cash_impact: true,
    }
}

// ============================================
// INTERFACES
// ============================================

interface SwiftTransaction {
    id: string
    date: string
    description: string
    amount: number
    custom_data?: Record<string, unknown>
}

interface InvoiceResult {
    invoiceId: number
    transactionId: string
    amount: number
    success: boolean
    error?: string
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Verifica se transação já foi processada (já tem invoice criada)
 */
async function isAlreadyProcessed(transactionId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
        .from('csv_rows')
        .select('reconciled')
        .eq('id', transactionId)
        .single()

    return data?.reconciled === true
}

/**
 * Gera número de invoice sequencial para BOTella
 */
async function generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear()
    const prefix = `BOT-SWIFT-${year}-`

    const { data } = await supabaseAdmin
        .from('invoices')
        .select('invoice_number')
        .ilike('invoice_number', `${prefix}%`)
        .order('invoice_number', { ascending: false })
        .limit(1)
        .single()

    if (!data) {
        return `${prefix}0001`
    }

    const lastNum = parseInt(data.invoice_number.replace(prefix, '')) || 0
    return `${prefix}${String(lastNum + 1).padStart(4, '0')}`
}

// ============================================
// MAIN TASK EXECUTION
// ============================================

export async function executeSwiftCommissionTask(): Promise<{
    success: boolean
    processed: number
    created: number
    failed: number
    errors: string[]
}> {
    const config = SWIFT_COMMISSION_CONFIG
    const ctx = await startBotTask(config.taskName, config.taskType, 'Iniciando verificação de comissões Swift...')

    const errors: string[] = []
    const results: InvoiceResult[] = []

    try {
        // 1. Buscar transações Swift não processadas
        await updateBotProgress(ctx, 'Buscando transações Swift pendentes...')

        const { data: transactions, error: fetchError } = await supabaseAdmin
            .from('csv_rows')
            .select('id, date, description, amount, custom_data, reconciled')
            .eq('source', config.source)
            .ilike('description', config.descriptionPattern)
            .lt('amount', 0) // Apenas débitos
            .or('reconciled.is.null,reconciled.eq.false') // Não processados
            .order('date', { ascending: true })

        if (fetchError) {
            throw new Error(`Erro ao buscar transações: ${fetchError.message}`)
        }

        if (!transactions || transactions.length === 0) {
            await completeBotTask(ctx, 'Nenhuma comissão Swift pendente encontrada')
            return { success: true, processed: 0, created: 0, failed: 0, errors: [] }
        }

        ctx.recordsProcessed = transactions.length
        await updateBotProgress(ctx, `Encontradas ${transactions.length} transações Swift pendentes`)

        // 2. Processar cada transação
        for (const tx of transactions as SwiftTransaction[]) {
            try {
                // Verificar se já foi processada (double check)
                const processed = await isAlreadyProcessed(tx.id)
                if (processed) {
                    ctx.recordsUpdated++
                    continue
                }

                // Gerar número de invoice
                const invoiceNumber = await generateInvoiceNumber()
                const invoiceDate = tx.date
                const amount = Math.abs(tx.amount) // Converter para positivo

                // Criar invoice na tabela invoices (Accounts Payable)
                const { data: invoice, error: invoiceError } = await supabaseAdmin
                    .from('invoices')
                    .insert({
                        // Campos obrigatórios
                        invoice_date: invoiceDate,
                        benefit_date: invoiceDate,
                        due_date: invoiceDate,
                        schedule_date: invoiceDate,
                        payment_date: invoiceDate, // Já pago

                        invoice_type: config.defaults.invoice_type,
                        entry_type: config.defaults.entry_type,

                        financial_account_code: config.defaults.financial_account_code,
                        financial_account_name: config.defaults.financial_account_name,

                        invoice_amount: amount,
                        currency: config.defaults.currency,
                        eur_exchange: config.defaults.eur_exchange,

                        provider_code: config.defaults.provider_code,
                        bank_account_code: config.defaults.bank_account_code,
                        payment_method_code: config.defaults.payment_method_code,

                        cost_type_code: config.defaults.cost_type_code,
                        dep_cost_type_code: config.defaults.dep_cost_type_code,
                        cost_center_code: config.defaults.cost_center_code,
                        sub_department_code: config.defaults.sub_department_code,

                        description: `Swift Commission: ${tx.description}`,
                        invoice_number: invoiceNumber,

                        country_code: config.defaults.country_code,
                        scope: config.defaults.scope,

                        dre_impact: config.defaults.dre_impact,
                        cash_impact: config.defaults.cash_impact,

                        is_reconciled: true,
                        payment_status: 'PAID',

                        notes: `Auto-generated by ${BOT_NAME} from Bankinter EUR transaction ID: ${tx.id}`,
                    })
                    .select('id')
                    .single()

                if (invoiceError || !invoice) {
                    throw new Error(`Erro ao criar invoice: ${invoiceError?.message}`)
                }

                // Marcar transação original como reconciliada
                const { error: updateError } = await supabaseAdmin
                    .from('csv_rows')
                    .update({
                        reconciled: true,
                        custom_data: {
                            ...(tx.custom_data || {}),
                            invoice_id: invoice.id,
                            invoice_number: invoiceNumber,
                            processed_by: BOT_NAME,
                            processed_at: new Date().toISOString()
                        }
                    })
                    .eq('id', tx.id)

                if (updateError) {
                    console.warn(`Aviso: Não foi possível marcar transação como reconciliada: ${updateError.message}`)
                }

                ctx.recordsCreated++
                results.push({
                    invoiceId: invoice.id,
                    transactionId: tx.id,
                    amount: amount,
                    success: true
                })

                console.log(`🤖 BOTella: Invoice ${invoiceNumber} criada para comissão Swift de €${amount.toFixed(2)}`)

            } catch (txError) {
                ctx.recordsFailed++
                const errorMsg = txError instanceof Error ? txError.message : String(txError)
                errors.push(`Transação ${tx.id}: ${errorMsg}`)
                results.push({
                    invoiceId: 0,
                    transactionId: tx.id,
                    amount: Math.abs(tx.amount),
                    success: false,
                    error: errorMsg
                })
            }
        }

        // 3. Finalizar com sucesso
        await completeBotTask(ctx,
            `Processamento concluído: ${ctx.recordsCreated} invoices criadas, ${ctx.recordsFailed} falhas`,
            { results, errors }
        )

        return {
            success: true,
            processed: ctx.recordsProcessed,
            created: ctx.recordsCreated,
            failed: ctx.recordsFailed,
            errors
        }

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(errorMsg)

        await failBotTask(ctx, errorMsg)

        return {
            success: false,
            processed: ctx.recordsProcessed,
            created: ctx.recordsCreated,
            failed: ctx.recordsFailed,
            errors
        }
    }
}

// ============================================
// TASK METADATA (para registro no dispatcher)
// ============================================

export const swiftCommissionTaskMeta = {
    key: 'swift-commission-auto-invoice',
    name: 'Swift Commission Auto-Invoice',
    description: 'Detecta comissões Swift no Bankinter EUR e cria invoices no Accounts Payable automaticamente',
    taskType: 'reconciliation' as const,
    cronExpression: '0 8 * * *', // Todo dia às 8h
    isActive: true,
    priority: 5,
    maxRetries: 3,
    retryDelaySeconds: 300,
    rateLimitPerMinute: 10,
    timeoutSeconds: 600,
    execute: executeSwiftCommissionTask
}
