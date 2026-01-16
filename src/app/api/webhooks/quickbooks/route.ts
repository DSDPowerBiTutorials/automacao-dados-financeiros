// =====================================================
// QuickBooks Webhook Handler
// Processa webhooks do QuickBooks e atualiza dados em tempo real
// Documentação: https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
    getInvoices,
    getPayments,
    getBills,
    getExpenses,
    getCustomers,
    getVendors,
    syncInvoicesToDatabase,
    syncPaymentsToDatabase,
    syncBillsToDatabase,
    syncExpensesToDatabase,
    syncCustomersToDatabase,
    syncVendorsToDatabase,
} from "@/lib/quickbooks";

// QuickBooks Webhook Verifier Token (configurar no portal Intuit)
const QUICKBOOKS_WEBHOOK_VERIFIER = process.env.QUICKBOOKS_WEBHOOK_VERIFIER || "";

interface QuickBooksWebhookPayload {
    eventNotifications: Array<{
        realmId: string;
        dataChangeEvent: {
            entities: Array<{
                name: string; // "Invoice", "Payment", "Bill", "Purchase", "Customer", "Vendor"
                id: string;
                operation: string; // "Create", "Update", "Delete", "Merge", "Void"
                lastUpdated: string;
            }>;
        };
    }>;
}

/**
 * Verificar assinatura HMAC do webhook
 */
function verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!QUICKBOOKS_WEBHOOK_VERIFIER) {
        console.warn("[QuickBooks Webhook] No verifier token configured, skipping verification");
        return true; // Em dev, permitir sem verificação
    }

    const hash = crypto
        .createHmac("sha256", QUICKBOOKS_WEBHOOK_VERIFIER)
        .update(payload)
        .digest("base64");

    return hash === signature;
}

/**
 * POST: Receber webhook do QuickBooks
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        console.log("[QuickBooks Webhook] Received webhook");

        // Obter payload e assinatura
        const payload = await request.text();
        const signature = request.headers.get("intuit-signature") || "";

        // Verificar assinatura
        if (!verifyWebhookSignature(payload, signature)) {
            console.error("[QuickBooks Webhook] Invalid signature");

            // Registrar tentativa inválida
            await logWebhook({
                source: "quickbooks",
                event_type: "invalid_signature",
                payload: { raw: payload.substring(0, 500) },
                signature_valid: false,
                processed: false,
                processing_error: "Invalid webhook signature",
                ip_address: request.headers.get("x-forwarded-for") || "unknown",
            });

            return NextResponse.json(
                { error: "Invalid signature" },
                { status: 401 }
            );
        }

        // Parse do payload
        const data: QuickBooksWebhookPayload = JSON.parse(payload);

        console.log("[QuickBooks Webhook] Processing notifications:",
            data.eventNotifications?.length || 0);

        // Processar cada notificação
        const results: Array<{ entity: string; operation: string; success: boolean; error?: string }> = [];

        for (const notification of data.eventNotifications || []) {
            const realmId = notification.realmId;
            const entities = notification.dataChangeEvent?.entities || [];

            for (const entity of entities) {
                console.log(`[QuickBooks Webhook] ${entity.operation} ${entity.name} (${entity.id})`);

                try {
                    await processEntityChange(entity);
                    results.push({
                        entity: `${entity.name}:${entity.id}`,
                        operation: entity.operation,
                        success: true,
                    });
                } catch (error: any) {
                    console.error(`[QuickBooks Webhook] Error processing ${entity.name}:`, error);
                    results.push({
                        entity: `${entity.name}:${entity.id}`,
                        operation: entity.operation,
                        success: false,
                        error: error.message,
                    });
                }
            }
        }

        // Registrar webhook processado
        await logWebhook({
            source: "quickbooks",
            event_type: "data_change",
            payload: data,
            signature_valid: true,
            processed: true,
            processing_duration_ms: Date.now() - startTime,
            ip_address: request.headers.get("x-forwarded-for") || "unknown",
        });

        // Atualizar sync_metadata
        if (supabaseAdmin) {
            await supabaseAdmin.from("sync_metadata").upsert(
                {
                    source: "quickbooks-usd",
                    most_recent_webhook_at: new Date().toISOString(),
                    sync_status: "success",
                },
                { onConflict: "source" }
            );
        }

        console.log(`[QuickBooks Webhook] Processed in ${Date.now() - startTime}ms`);

        return NextResponse.json({
            success: true,
            processed: results.length,
            results,
            duration_ms: Date.now() - startTime,
        });

    } catch (error: any) {
        console.error("[QuickBooks Webhook] Error:", error);

        // Registrar erro
        await logWebhook({
            source: "quickbooks",
            event_type: "error",
            payload: { error: error.message },
            signature_valid: true,
            processed: false,
            processing_error: error.message,
            processing_duration_ms: Date.now() - startTime,
            ip_address: request.headers.get("x-forwarded-for") || "unknown",
        });

        return NextResponse.json(
            { error: "Webhook processing failed", details: error.message },
            { status: 500 }
        );
    }
}

/**
 * GET: Responder ao challenge de verificação do QuickBooks
 * QuickBooks envia um GET com challengeToken quando você registra o webhook
 */
export async function GET(request: NextRequest) {
    const challengeToken = request.nextUrl.searchParams.get("challengeToken");

    if (challengeToken) {
        console.log("[QuickBooks Webhook] Responding to challenge");
        return new NextResponse(challengeToken, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        });
    }

    return NextResponse.json({
        endpoint: "QuickBooks Webhook",
        description: "Receives real-time notifications from QuickBooks Online",
        status: "active",
        methods: ["GET (challenge)", "POST (notifications)"],
    });
}

/**
 * Processar mudança em uma entidade específica
 */
async function processEntityChange(entity: {
    name: string;
    id: string;
    operation: string;
    lastUpdated: string;
}) {
    const { name, id, operation } = entity;

    // Ignorar operações de Delete por enquanto
    if (operation === "Delete") {
        console.log(`[QuickBooks Webhook] Ignoring Delete for ${name}:${id}`);
        // TODO: Implementar soft delete ou remoção
        return;
    }

    // Processar baseado no tipo de entidade
    switch (name) {
        case "Invoice":
            await handleInvoiceChange(id, operation);
            break;

        case "Payment":
            await handlePaymentChange(id, operation);
            break;

        case "Bill":
            await handleBillChange(id, operation);
            break;

        case "Purchase":
            await handleExpenseChange(id, operation);
            break;

        case "Customer":
            await handleCustomerChange(id, operation);
            break;

        case "Vendor":
            await handleVendorChange(id, operation);
            break;

        default:
            console.log(`[QuickBooks Webhook] Unhandled entity type: ${name}`);
    }
}

/**
 * Handlers específicos por tipo de entidade
 */

async function handleInvoiceChange(id: string, operation: string) {
    console.log(`[QuickBooks Webhook] Processing Invoice ${operation}: ${id}`);

    // Re-sync invoices (o sync irá atualizar apenas os modificados via upsert)
    // Em produção, seria melhor buscar apenas o invoice específico
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await syncInvoicesToDatabase(thirtyDaysAgo.toISOString().split("T")[0]);
}

async function handlePaymentChange(id: string, operation: string) {
    console.log(`[QuickBooks Webhook] Processing Payment ${operation}: ${id}`);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await syncPaymentsToDatabase(thirtyDaysAgo.toISOString().split("T")[0]);
}

async function handleBillChange(id: string, operation: string) {
    console.log(`[QuickBooks Webhook] Processing Bill ${operation}: ${id}`);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await syncBillsToDatabase(thirtyDaysAgo.toISOString().split("T")[0]);
}

async function handleExpenseChange(id: string, operation: string) {
    console.log(`[QuickBooks Webhook] Processing Expense ${operation}: ${id}`);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await syncExpensesToDatabase(thirtyDaysAgo.toISOString().split("T")[0]);
}

async function handleCustomerChange(id: string, operation: string) {
    console.log(`[QuickBooks Webhook] Processing Customer ${operation}: ${id}`);
    await syncCustomersToDatabase();
}

async function handleVendorChange(id: string, operation: string) {
    console.log(`[QuickBooks Webhook] Processing Vendor ${operation}: ${id}`);
    await syncVendorsToDatabase();
}

/**
 * Registrar webhook no banco de dados
 */
async function logWebhook(data: {
    source: string;
    event_type: string;
    payload?: any;
    signature_valid: boolean;
    processed: boolean;
    processing_error?: string;
    processing_duration_ms?: number;
    ip_address?: string;
}) {
    if (!supabaseAdmin) {
        console.warn("[QuickBooks Webhook] Supabase not configured, skipping log");
        return;
    }

    try {
        await supabaseAdmin.from("webhook_logs").insert({
            source: data.source,
            event_type: data.event_type,
            payload: data.payload,
            signature_valid: data.signature_valid,
            processed: data.processed,
            processed_at: data.processed ? new Date().toISOString() : null,
            processing_error: data.processing_error,
            processing_duration_ms: data.processing_duration_ms,
            ip_address: data.ip_address,
        });
    } catch (error) {
        console.error("[QuickBooks Webhook] Error logging webhook:", error);
    }
}
