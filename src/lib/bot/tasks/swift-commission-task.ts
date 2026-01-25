/**
 * Swift Commission Auto-Invoice Task
 * 
 * Detecta débitos "Comis.pago swift" no Bankinter EUR e cria 
 * automaticamente invoices no Accounts Payable com pagamento marcado como pago.
 * 
 * Fluxo:
 * 1. Busca csv_rows do Bankinter EUR com description LIKE 'Comis.pago swift%'
 * 2. Filtra apenas débitos (amount < 0) não processados
 * 3. Cria invoice com campos pré-definidos
 * 4. Marca payment como "Pago" 
 * 5. Reconcilia com a transação original
 * 6. Marca csv_row como processado
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
    startBotTask,
    updateBotProgress,
    completeBotTask,
    failBotTask,
    BOT_NAME,
    type BotTaskContext
} from '@/lib/botella'

// ============================================
// CONFIGURAÇÃO DA TASK
// ============================================

export const SWIFT_COMMISSION_CONFIG = {
    taskName: 'swift-commission-auto-invoice',
    taskType: 'reconciliation' as const,
    
    // Filtros para busca
    source: 'bankinter-eur',
    descriptionPattern: 'Comis.pago swift%',
    
    // Valores padrão para invoice
    defaults: {
        currency: 'EUR',
        scope: 'ES',
        provider_name: 'Bankinter',
        cost_type: 'Variable Cost',
        dep_cost: 'General Expenses',
        department: '3.0.0 - Corporate',
        sub_department: '3.1.1 - Finance',
        bank_account: 'Bankinter Spain 4605',
        payment_method: 'Direct Debit',
        document_type: 'Bank Charge',
        description_prefix: 'Swift Commission - '
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
    invoiceId: string
    paymentId: string
    transactionId: string
    amount: number
    success: boolean
    error?: string
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Busca provider ID pelo nome
 */
async function getProviderId(providerName: string): Promise<string | null> {
    const { data } = await supabaseAdmin
        .from('providers')
        .select('id')
        .eq('name', providerName)
        .eq('is_active', true)
        .single()
    
    return data?.id || null
}

/**
 * Busca bank account ID pelo nome
 */
async function getBankAccountId(accountName: string): Promise<string | null> {
    const { data } = await supabaseAdmin
        .from('bank_accounts')
        .select('id')
        .ilike('name', `%${accountName}%`)
        .eq('is_active', true)
        .single()
    
    return data?.id || null
}

/**
 * Busca department e sub-department IDs
 */
async function getDepartmentIds(deptCode: string, subDeptCode: string): Promise<{
    departmentId: string | null
    subDepartmentId: string | null
}> {
    const { data: dept } = await supabaseAdmin
        .from('departments')
        .select('id')
        .ilike('name', `%${deptCode}%`)
        .single()
    
    const { data: subDept } = await supabaseAdmin
        .from('sub_departments')
        .select('id')
        .ilike('name', `%${subDeptCode}%`)
        .single()
    
    return {
        departmentId: dept?.id || null,
        subDepartmentId: subDept?.id || null
    }
}

/**
 * Verifica se transação já foi processada
 */
async function isAlreadyProcessed(transactionId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
        .from('invoice_payments')
        .select('id')
        .eq('reconciled_transaction_id', transactionId)
        .single()
    
    return !!data
}

/**
 * Gera número de invoice sequencial
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
            .select('id, date, description, amount, custom_data')
            .eq('source', config.source)
            .ilike('description', config.descriptionPattern)
            .lt('amount', 0) // Apenas débitos
            .order('date', { ascending: true })
        
        if (fetchError) {
            throw new Error(`Erro ao buscar transações: ${fetchError.message}`)
        }
        
        if (!transactions || transactions.length === 0) {
            await completeBotTask(ctx, 'Nenhuma comissão Swift pendente encontrada')
            return { success: true, processed: 0, created: 0, failed: 0, errors: [] }
        }
        
        ctx.recordsProcessed = transactions.length
        await updateBotProgress(ctx, `Encontradas ${transactions.length} transações Swift`)
        
        // 2. Buscar IDs de referência (provider, bank account, etc.)
        const providerId = await getProviderId(config.defaults.provider_name)
        const bankAccountId = await getBankAccountId(config.defaults.bank_account)
        const { departmentId, subDepartmentId } = await getDepartmentIds(
            config.defaults.department,
            config.defaults.sub_department
        )
        
        if (!providerId) {
            // Criar provider se não existir
            const { data: newProvider } = await supabaseAdmin
                .from('providers')
                .insert({
                    name: config.defaults.provider_name,
                    is_active: true,
                    created_by: BOT_NAME
                })
                .select('id')
                .single()
            
            if (newProvider) {
                await updateBotProgress(ctx, `Provider "${config.defaults.provider_name}" criado automaticamente`)
            }
        }
        
        // 3. Processar cada transação
        for (const tx of transactions as SwiftTransaction[]) {
            try {
                // Verificar se já foi processada
                const processed = await isAlreadyProcessed(tx.id)
                if (processed) {
                    ctx.recordsUpdated++
                    continue
                }
                
                // Gerar número de invoice
                const invoiceNumber = await generateInvoiceNumber()
                const invoiceDate = tx.date
                const dueDate = tx.date // Já pago, mesma data
                const amount = Math.abs(tx.amount) // Converter para positivo
                
                // Criar invoice
                const { data: invoice, error: invoiceError } = await supabaseAdmin
                    .from('invoices')
                    .insert({
                        invoice_number: invoiceNumber,
                        provider_id: providerId,
                        invoice_date: invoiceDate,
                        due_date: dueDate,
                        currency: config.defaults.currency,
                        scope: config.defaults.scope,
                        gross_amount: amount,
                        net_amount: amount,
                        vat_amount: 0,
                        vat_rate: 0,
                        cost_type: config.defaults.cost_type,
                        dep_cost: config.defaults.dep_cost,
                        department_id: departmentId,
                        sub_department_id: subDepartmentId,
                        description: `${config.defaults.description_prefix}${tx.description}`,
                        document_type: config.defaults.document_type,
                        status: 'paid',
                        notes: `Auto-generated by ${BOT_NAME} from Bankinter EUR transaction`,
                        created_by: BOT_NAME,
                        created_at: new Date().toISOString()
                    })
                    .select('id')
                    .single()
                
                if (invoiceError || !invoice) {
                    throw new Error(`Erro ao criar invoice: ${invoiceError?.message}`)
                }
                
                // Criar payment (já marcado como pago)
                const { data: payment, error: paymentError } = await supabaseAdmin
                    .from('invoice_payments')
                    .insert({
                        invoice_id: invoice.id,
                        payment_date: invoiceDate,
                        amount: amount,
                        currency: config.defaults.currency,
                        payment_method: config.defaults.payment_method,
                        bank_account_id: bankAccountId,
                        status: 'paid',
                        reconciled: true,
                        reconciled_transaction_id: tx.id,
                        reconciled_at: new Date().toISOString(),
                        notes: `Auto-reconciled with Bankinter EUR transaction`,
                        created_by: BOT_NAME
                    })
                    .select('id')
                    .single()
                
                if (paymentError || !payment) {
                    throw new Error(`Erro ao criar payment: ${paymentError?.message}`)
                }
                
                // Marcar transação original como reconciliada
                await supabaseAdmin
                    .from('csv_rows')
                    .update({
                        reconciled: true,
                        reconciled_with: invoice.id,
                        reconciled_at: new Date().toISOString(),
                        reconciled_by: BOT_NAME
                    })
                    .eq('id', tx.id)
                
                ctx.recordsCreated++
                results.push({
                    invoiceId: invoice.id,
                    paymentId: payment.id,
                    transactionId: tx.id,
                    amount: amount,
                    success: true
                })
                
            } catch (txError) {
                ctx.recordsFailed++
                const errorMsg = txError instanceof Error ? txError.message : String(txError)
                errors.push(`Transação ${tx.id}: ${errorMsg}`)
                results.push({
                    invoiceId: '',
                    paymentId: '',
                    transactionId: tx.id,
                    amount: Math.abs(tx.amount),
                    success: false,
                    error: errorMsg
                })
            }
        }
        
        // 4. Finalizar com sucesso
        await completeBotTask(ctx, 
            `Processamento concluído: ${ctx.recordsCreated} invoices criados, ${ctx.recordsFailed} falhas`,
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
    description: 'Detecta comissões Swift no Bankinter EUR e cria invoices automaticamente',
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
