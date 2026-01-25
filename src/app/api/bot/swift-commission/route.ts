/**
 * API Route: Swift Commission Auto-Invoice
 * 
 * POST /api/bot/swift-commission
 * 
 * Executa a task de comissão Swift manualmente ou via cron.
 * Pode ser chamada pelo dispatcher ou diretamente pela UI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeSwiftCommissionTask, SWIFT_COMMISSION_CONFIG } from '@/lib/bot/tasks/swift-commission-task'
import { checkRateLimit, BOT_CONSOLE_NAME } from '@/lib/botella'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 segundos máximo

export async function POST(request: NextRequest) {
    const taskName = SWIFT_COMMISSION_CONFIG.taskName
    
    try {
        // Rate limiting
        if (!checkRateLimit(taskName, 5)) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: 'Rate limit atingido. Aguarde 1 minuto.' 
                },
                { status: 429 }
            )
        }
        
        console.log(`${BOT_CONSOLE_NAME} [${taskName}] 📨 Requisição recebida`)
        
        // Parse body opcional (pode incluir filtros adicionais no futuro)
        let body: Record<string, unknown> = {}
        try {
            body = await request.json()
        } catch {
            // Body vazio é OK
        }
        
        const dryRun = body.dryRun === true
        
        if (dryRun) {
            console.log(`${BOT_CONSOLE_NAME} [${taskName}] 🔍 Modo dry-run ativado`)
        }
        
        // Executar task
        const result = await executeSwiftCommissionTask()
        
        console.log(`${BOT_CONSOLE_NAME} [${taskName}] ${result.success ? '✅' : '❌'} Resultado:`, {
            processed: result.processed,
            created: result.created,
            failed: result.failed
        })
        
        return NextResponse.json({
            success: result.success,
            data: {
                taskName,
                processed: result.processed,
                created: result.created,
                failed: result.failed,
                errors: result.errors.length > 0 ? result.errors : undefined
            },
            timestamp: new Date().toISOString()
        })
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`${BOT_CONSOLE_NAME} [${taskName}] ❌ Erro crítico:`, errorMessage)
        
        return NextResponse.json(
            { 
                success: false, 
                error: errorMessage,
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        )
    }
}

// GET para status/health check
export async function GET() {
    return NextResponse.json({
        task: SWIFT_COMMISSION_CONFIG.taskName,
        description: 'Detecta comissões Swift no Bankinter EUR e cria invoices automaticamente',
        config: {
            source: SWIFT_COMMISSION_CONFIG.source,
            pattern: SWIFT_COMMISSION_CONFIG.descriptionPattern,
            defaults: SWIFT_COMMISSION_CONFIG.defaults
        },
        status: 'ready',
        timestamp: new Date().toISOString()
    })
}
