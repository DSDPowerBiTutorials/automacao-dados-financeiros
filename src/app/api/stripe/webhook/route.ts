/**
 * API Route: Webhook do Stripe
 * 
 * Recebe notificações em tempo real do Stripe quando:
 * - Pagamento é criado/confirmado (charge.succeeded)
 * - Pagamento falha (charge.failed)
 * - Reembolso é processado (charge.refunded)
 * - Payout é enviado (payout.paid)
 * - Disputa é aberta (charge.dispute.created)
 * 
 * URL para configurar no Stripe Dashboard:
 * https://dsdfinancehub.com/api/stripe/webhook
 * 
 * Eventos a habilitar no Stripe:
 * - charge.succeeded
 * - charge.failed
 * - charge.refunded
 * - charge.dispute.created
 * - payout.paid
 * - payment_intent.succeeded
 * - payment_intent.payment_failed
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// Tipos do Stripe
interface StripeEvent {
    id: string;
    type: string;
    created: number;
    data: {
        object: any;
    };
}

interface StripeCharge {
    id: string;
    amount: number;
    amount_refunded: number;
    currency: string;
    status: string;
    created: number;
    description?: string;
    receipt_email?: string;
    billing_details?: {
        name?: string;
        email?: string;
    };
    metadata?: {
        order_id?: string;
        orderId?: string;
        [key: string]: string | undefined;
    };
    payment_method_details?: {
        type: string;
        card?: {
            brand?: string;
            last4?: string;
        };
    };
}

interface StripePayout {
    id: string;
    amount: number;
    arrival_date: number;
    created: number;
    currency: string;
    status: string;
}

/**
 * Verifica assinatura do webhook do Stripe
 */
async function verifyStripeSignature(
    payload: string,
    signature: string
): Promise<StripeEvent | null> {
    if (!STRIPE_WEBHOOK_SECRET) {
        console.warn("[Stripe Webhook] STRIPE_WEBHOOK_SECRET não configurado - aceitando sem verificação");
        try {
            return JSON.parse(payload);
        } catch {
            return null;
        }
    }

    try {
        // Verificação manual da assinatura (sem SDK)
        const crypto = await import("crypto");
        const elements = signature.split(",");
        const timestampElement = elements.find((e) => e.startsWith("t="));
        const signatureElement = elements.find((e) => e.startsWith("v1="));

        if (!timestampElement || !signatureElement) {
            console.error("[Stripe Webhook] Assinatura inválida - elementos faltando");
            return null;
        }

        const timestamp = timestampElement.split("=")[1];
        const expectedSignature = signatureElement.split("=")[1];

        // Criar o signed payload
        const signedPayload = `${timestamp}.${payload}`;
        const computedSignature = crypto
            .createHmac("sha256", STRIPE_WEBHOOK_SECRET)
            .update(signedPayload)
            .digest("hex");

        if (computedSignature !== expectedSignature) {
            console.error("[Stripe Webhook] Assinatura não confere");
            return null;
        }

        // Verificar se não é muito antigo (5 minutos de tolerância)
        const now = Math.floor(Date.now() / 1000);
        if (now - parseInt(timestamp) > 300) {
            console.error("[Stripe Webhook] Evento muito antigo");
            return null;
        }

        return JSON.parse(payload);
    } catch (error) {
        console.error("[Stripe Webhook] Erro na verificação:", error);
        return null;
    }
}

/**
 * Converte timestamp Unix para data ISO
 */
function unixToDate(timestamp: number): string {
    return new Date(timestamp * 1000).toISOString().split("T")[0];
}

/**
 * Extrai Order ID do metadata ou description
 */
function extractOrderId(charge: StripeCharge): string | null {
    if (charge.metadata?.order_id) return charge.metadata.order_id;
    if (charge.metadata?.orderId) return charge.metadata.orderId;

    if (charge.description) {
        const match = charge.description.match(/order[:\s#]*([a-f0-9]{7})/i);
        if (match) return match[1];
    }

    return null;
}

/**
 * Formata método de pagamento
 */
function formatPaymentMethod(charge: StripeCharge): string {
    const details = charge.payment_method_details;
    if (!details) return "unknown";

    if (details.type === "card" && details.card) {
        return `${details.card.brand || "card"} ****${details.card.last4 || "****"}`;
    }

    return details.type || "unknown";
}

/**
 * Processa evento de charge (pagamento)
 */
async function handleChargeEvent(charge: StripeCharge, eventType: string) {
    const isSuccessful = eventType === "charge.succeeded";
    const isRefund = eventType === "charge.refunded";

    // Valor em unidade monetária (Stripe usa centavos)
    const amount = (charge.amount - charge.amount_refunded) / 100;
    const currency = charge.currency.toUpperCase();

    const customerName = charge.billing_details?.name || "";
    const customerEmail = charge.billing_details?.email || charge.receipt_email || "";

    // Determinar source baseado na moeda
    const source = `stripe-${currency.toLowerCase()}`;

    const rowData = {
        source,
        date: unixToDate(charge.created),
        description: `${formatPaymentMethod(charge)} - ${customerName || customerEmail || "Stripe Payment"}`,
        amount: isRefund ? -amount : amount,
        reconciled: false,
        custom_data: {
            charge_id: charge.id,
            order_id: extractOrderId(charge),
            customer_name: customerName,
            customer_email: customerEmail,
            currency,
            payment_method: formatPaymentMethod(charge),
            status: charge.status,
            type: isRefund ? "refund" : "sale",
            created_at: new Date(charge.created * 1000).toISOString(),
            webhook_received_at: new Date().toISOString(),
            webhook_event: eventType,
            is_successful: isSuccessful,
        },
    };

    // Upsert no Supabase
    const { error } = await supabaseAdmin
        .from("csv_rows")
        .upsert(rowData, {
            onConflict: "source,custom_data->>'charge_id'",
        });

    if (error) {
        // Se falhar upsert por conflito, tentar update
        const { error: updateError } = await supabaseAdmin
            .from("csv_rows")
            .update({
                amount: rowData.amount,
                custom_data: rowData.custom_data,
            })
            .eq("source", source)
            .filter("custom_data->>charge_id", "eq", charge.id);

        if (updateError) {
            // Se ainda falhar, inserir como novo
            const { error: insertError } = await supabaseAdmin
                .from("csv_rows")
                .insert(rowData);

            if (insertError) {
                console.error("[Stripe Webhook] Erro ao salvar charge:", insertError);
                throw insertError;
            }
        }
    }

    console.log(`[Stripe Webhook] ✅ Charge ${charge.id} processado (${eventType})`);
}

/**
 * Processa evento de payout (transferência bancária)
 */
async function handlePayoutEvent(payout: StripePayout) {
    const amount = payout.amount / 100;
    const currency = payout.currency.toUpperCase();
    const source = `stripe-disbursement-${currency.toLowerCase()}`;

    const rowData = {
        source,
        date: unixToDate(payout.arrival_date),
        description: `Stripe Payout - ${currency} ${amount.toFixed(2)}`,
        amount,
        reconciled: false,
        custom_data: {
            payout_id: payout.id,
            currency,
            status: payout.status,
            arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
            created_at: new Date(payout.created * 1000).toISOString(),
            webhook_received_at: new Date().toISOString(),
        },
    };

    const { error } = await supabaseAdmin
        .from("csv_rows")
        .upsert(rowData, {
            onConflict: "source,custom_data->>'payout_id'",
        });

    if (error) {
        // Fallback: tentar insert
        const { error: insertError } = await supabaseAdmin
            .from("csv_rows")
            .insert(rowData);

        if (insertError) {
            console.error("[Stripe Webhook] Erro ao salvar payout:", insertError);
            throw insertError;
        }
    }

    console.log(`[Stripe Webhook] ✅ Payout ${payout.id} processado`);
}

export async function POST(req: NextRequest) {
    try {
        const payload = await req.text();
        const signature = req.headers.get("stripe-signature") || "";

        // Verificar assinatura
        const event = await verifyStripeSignature(payload, signature);
        if (!event) {
            return NextResponse.json(
                { error: "Invalid signature" },
                { status: 400 }
            );
        }

        console.log(`[Stripe Webhook] Received: ${event.type} (${event.id})`);

        // Processar eventos
        switch (event.type) {
            case "charge.succeeded":
            case "charge.failed":
            case "charge.refunded":
                await handleChargeEvent(event.data.object as StripeCharge, event.type);
                break;

            case "payout.paid":
                await handlePayoutEvent(event.data.object as StripePayout);
                break;

            case "charge.dispute.created":
                console.log(`[Stripe Webhook] ⚠️ Disputa aberta: ${event.data.object.id}`);
                // TODO: Implementar notificação de disputa
                break;

            case "payment_intent.succeeded":
            case "payment_intent.payment_failed":
                // Payment intents são processados via charge events
                console.log(`[Stripe Webhook] Payment Intent: ${event.type}`);
                break;

            default:
                console.log(`[Stripe Webhook] Evento não processado: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[Stripe Webhook] ❌ Erro:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Webhook error" },
            { status: 500 }
        );
    }
}

// GET para verificar se o endpoint está ativo
export async function GET() {
    return NextResponse.json({
        status: "active",
        endpoint: "/api/stripe/webhook",
        configured: !!STRIPE_WEBHOOK_SECRET,
        events: [
            "charge.succeeded",
            "charge.failed",
            "charge.refunded",
            "charge.dispute.created",
            "payout.paid",
            "payment_intent.succeeded",
            "payment_intent.payment_failed",
        ],
    });
}
