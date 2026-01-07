/**
 * API Route: Webhook do GoCardless
 *
 * Recebe notificações em tempo real do GoCardless quando:
 * - Payout é criado/atualizado
 * - Payment é confirmado/falha
 * - Refund é processado
 * - Mandate é criado/cancelado
 *
 * URL para configurar no GoCardless Dashboard:
 * https://dsdfinancehub.com/api/webhooks/gocardless
 *
 * Verificação de Autenticidade:
 * GoCardless envia um header "Webhook-Signature" que deve ser validado
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { updateSyncMetadata } from "@/lib/sync-metadata";
import crypto from "crypto";

// Tipos de eventos GoCardless que processaremos
type GoCardlessEventType =
    | "payout_created"
    | "payout_paid"
    | "payout_failed"
    | "payment_created"
    | "payment_submitted"
    | "payment_confirmed"
    | "payment_paid_out"
    | "payment_failed"
    | "payment_cancelled"
    | "payment_expired"
    | "payment_chargeback_cancelled"
    | "payment_chargeback_created"
    | "payment_chargeback_lost"
    | "payment_chargeback_won"
    | "refund_created"
    | "refund_refunded"
    | "refund_failed"
    | "mandate_created"
    | "mandate_active"
    | "mandate_cancelled"
    | "mandate_failed"
    | "mandate_transferred"
    | "mandate_replaced"
    | "customer_created"
    | "creditor_updated"
    | "test.webhook_action_performed";

interface GoCardlessPayload {
    type: GoCardlessEventType;
    id: string;
    created_at: string;
    action: string;
    resourceType: string;
    links: {
        [key: string]: string;
    };
    [key: string]: any;
}

/**
 * Valida a assinatura do webhook usando HMAC-SHA256
 * GoCardless envia: Webhook-Signature header com formato "test_..."
 */
function validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    const hash = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

    return hash === signature;
}

/**
 * Processa eventos de payout do GoCardless
 */
async function handlePayoutEvent(event: GoCardlessPayload, action: string) {
    const payout = event.payout || event.event?.resource;

    if (!payout) {
        console.warn("[GoCardless Webhook] Payout data not found in event");
        return;
    }

    const customData: Record<string, any> = {
        type: "payout",
        payout_id: payout.id,
        status: action,
        currency: payout.currency,
        amount_cents: payout.amount,
        gocardless_event_id: event.id,
        webhook_received_at: new Date().toISOString(),
    };

    // Mapear ações para status
    const statusMap: { [key: string]: string } = {
        payout_created: "pending",
        payout_paid: "paid",
        payout_failed: "failed",
    };

    // Atualizar ou inserir payout no banco de dados
    const { error: searchError, data: existingData } = await supabaseAdmin
        .from("csv_rows")
        .select("*")
        .eq("source", "gocardless")
        .eq("custom_data->>payout_id", payout.id)
        .limit(1);

    if (existingData && existingData.length > 0) {
        // Atualizar existente
        const { error } = await supabaseAdmin
            .from("csv_rows")
            .update({
                reconciled: statusMap[action] === "paid",
                custom_data: customData,
            })
            .eq("id", existingData[0].id);

        if (error) {
            console.error("[GoCardless Webhook] Erro ao atualizar payout:", error);
        } else {
            console.log(`[GoCardless Webhook] Payout ${payout.id} atualizado como ${action}`);
        }
    } else {
        // Inserir novo com upsert strategy
        const { error } = await supabaseAdmin.from("csv_rows").upsert({
            external_id: payout.id,
            source: "gocardless",
            date: payout.arrival_date || new Date().toISOString().split("T")[0],
            description: `GoCardless Payout - ${payout.id}`,
            amount: (payout.amount / 100).toString(), // Converter centavos
            reconciled: statusMap[action] === "paid",
            custom_data: customData,
        }, {
            onConflict: 'source,external_id',
            ignoreDuplicates: false
        });

        if (error) {
            console.error("[GoCardless Webhook] Erro ao salvar payout:", error);
        } else {
            console.log(`[GoCardless Webhook] Novo payout ${payout.id} criado como ${action}`);
        }
    }

    // Atualizar sync_metadata
    await updateSyncMetadata({
        source: 'gocardless',
        syncType: 'webhook',
        recordsAdded: existingData && existingData.length > 0 ? 0 : 1,
        lastRecordDate: new Date(payout.arrival_date || new Date()),
        status: 'success',
    });
}

/**
 * Processa eventos de payment do GoCardless
 */
async function handlePaymentEvent(event: GoCardlessPayload, action: string) {
    const payment = event.payment || event.event?.resource;

    if (!payment) {
        console.warn("[GoCardless Webhook] Payment data not found in event");
        return;
    }

    const customData: Record<string, any> = {
        type: "payment",
        payment_id: payment.id,
        status: action,
        amount_cents: payment.amount,
        charge_date: payment.charge_date,
        payout_id: payment.payout_id,
        reference: payment.reference,
        gocardless_event_id: event.id,
        webhook_received_at: new Date().toISOString(),
    };

    // Mapear ações para reconciliação
    const shouldReconcile = ["payment_confirmed", "payment_paid_out"].includes(action);

    // Atualizar ou inserir payment
    const { error: searchError, data: existingData } = await supabaseAdmin
        .from("csv_rows")
        .select("*")
        .eq("source", "gocardless")
        .eq("custom_data->>payment_id", payment.id)
        .limit(1);

    if (existingData && existingData.length > 0) {
        // Atualizar existente
        const { error } = await supabaseAdmin
            .from("csv_rows")
            .update({
                reconciled: shouldReconcile,
                custom_data: customData,
            })
            .eq("id", existingData[0].id);

        if (error) {
            console.error("[GoCardless Webhook] Erro ao atualizar payment:", error);
        } else {
            console.log(`[GoCardless Webhook] Payment ${payment.id} atualizado como ${action}`);
        }
    } else {
        // Inserir novo com upsert strategy
        const { error } = await supabaseAdmin.from("csv_rows").upsert({
            external_id: payment.id,
            source: "gocardless",
            date: payment.charge_date || new Date().toISOString().split("T")[0],
            description: payment.reference || `GoCardless Payment - ${payment.id}`,
            amount: (payment.amount / 100).toString(), // Converter centavos
            reconciled: shouldReconcile,
            custom_data: customData,
        }, {
            onConflict: 'source,external_id',
            ignoreDuplicates: false
        });

        if (error) {
            console.error("[GoCardless Webhook] Erro ao salvar payment:", error);
        } else {
            console.log(`[GoCardless Webhook] Novo payment ${payment.id} criado como ${action}`);
        }
    }

    // Atualizar sync_metadata
    await updateSyncMetadata({
        source: 'gocardless',
        syncType: 'webhook',
        recordsAdded: existingData && existingData.length > 0 ? 0 : 1,
        lastRecordDate: new Date(payment.charge_date || new Date()),
        status: 'success',
    });
}

/**
 * Processa eventos de refund do GoCardless
 */
async function handleRefundEvent(event: GoCardlessPayload, action: string) {
    const refund = event.refund || event.event?.resource;

    if (!refund) {
        console.warn("[GoCardless Webhook] Refund data not found in event");
        return;
    }

    const customData: Record<string, any> = {
        type: "refund",
        refund_id: refund.id,
        status: action,
        amount_cents: refund.amount,
        payment_id: refund.payment_id,
        reference: refund.reference,
        gocardless_event_id: event.id,
        webhook_received_at: new Date().toISOString(),
    };

    // Inserir refund como novo registro (sempre negativo) com upsert
    const { error } = await supabaseAdmin.from("csv_rows").upsert({
        external_id: refund.id,
        source: "gocardless",
        date: new Date().toISOString().split("T")[0],
        description: refund.reference || `GoCardless Refund - ${refund.id}`,
        amount: (-(refund.amount / 100)).toString(), // Valor negativo para refund
        reconciled: action === "refund_refunded",
        custom_data: customData,
    }, {
        onConflict: 'source,external_id',
        ignoreDuplicates: false
    });

    if (error) {
        console.error("[GoCardless Webhook] Erro ao salvar refund:", error);
    } else {
        console.log(`[GoCardless Webhook] Novo refund ${refund.id} criado como ${action}`);
    }
}

/**
 * Processa eventos de mandate do GoCardless
 */
async function handleMandateEvent(event: GoCardlessPayload, action: string) {
    const mandate = event.mandate || event.event?.resource;

    if (!mandate) {
        console.warn("[GoCardless Webhook] Mandate data not found in event");
        return;
    }

    console.log(
        `[GoCardless Webhook] Mandate ${mandate.id} event: ${action}`
    );

    // Mandates geralmente não precisam de registros em csv_rows
    // Mas podemos logar para auditoria
}

export async function POST(req: NextRequest) {
    try {
        // Ler o body como texto para validar assinatura
        const rawBody = await req.text();

        // Extrair assinatura do header
        const signature = req.headers.get("webhook-signature");

        if (!signature) {
            console.warn("[GoCardless Webhook] Missing webhook signature");
            return NextResponse.json(
                { error: "Missing webhook signature" },
                { status: 400 }
            );
        }

        // Validar assinatura (usar secret do GoCardless)
        const webhookSecret = process.env.GOCARDLESS_WEBHOOK_SECRET || "";

        if (!webhookSecret) {
            console.warn("[GoCardless Webhook] GOCARDLESS_WEBHOOK_SECRET not configured");
            return NextResponse.json(
                { error: "Webhook secret not configured" },
                { status: 500 }
            );
        }

        // Validar a assinatura
        const isValid = validateWebhookSignature(rawBody, signature, webhookSecret);

        if (!isValid) {
            console.warn("[GoCardless Webhook] Invalid webhook signature");
            return NextResponse.json(
                { error: "Invalid webhook signature" },
                { status: 401 }
            );
        }

        // Parse payload
        let payload: GoCardlessPayload;
        try {
            payload = JSON.parse(rawBody);
        } catch (e) {
            console.error("[GoCardless Webhook] Failed to parse JSON:", e);
            return NextResponse.json(
                { error: "Invalid JSON" },
                { status: 400 }
            );
        }

        console.log(
            `[GoCardless Webhook] Received event: ${payload.type} (ID: ${payload.id})`
        );

        // Determinar o tipo de recurso e ação
        const eventType = payload.type as GoCardlessEventType;
        const action = eventType;

        // Roteador de eventos
        if (eventType.startsWith("payout_")) {
            await handlePayoutEvent(payload, action);
        } else if (eventType.startsWith("payment_")) {
            await handlePaymentEvent(payload, action);
        } else if (eventType.startsWith("refund_")) {
            await handleRefundEvent(payload, action);
        } else if (eventType.startsWith("mandate_")) {
            await handleMandateEvent(payload, action);
        } else if (eventType === "test.webhook_action_performed") {
            console.log("[GoCardless Webhook] Test event received");
        } else {
            console.log(`[GoCardless Webhook] Event type not handled: ${eventType}`);
        }

        // Sempre retornar 200 OK para que o GoCardless saiba que recebemos
        return NextResponse.json({
            success: true,
            message: "Event processed",
            eventId: payload.id,
        });
    } catch (error) {
        console.error("[GoCardless Webhook] Unexpected error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

export const config = {
    runtime: "nodejs",
};
