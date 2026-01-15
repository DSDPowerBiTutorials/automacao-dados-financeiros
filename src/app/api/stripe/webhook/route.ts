/**
 * API Route: Webhook do Stripe
 * 
 * Recebe notificações em tempo real do Stripe quando:
 * - Checkout é completado (checkout.session.completed) ⭐ PRINCIPAL
 * - Invoice é paga (invoice.paid)
 * - Pagamento é criado/confirmado (charge.succeeded)
 * - Reembolso é processado (charge.refunded)
 * - Payout é enviado (payout.paid)
 * - Disputa é aberta (charge.dispute.created)
 * 
 * URL para configurar no Stripe Dashboard:
 * https://dsdfinancehub.com/api/stripe/webhook
 * 
 * ==========================================
 * EVENTOS A SELECIONAR NO STRIPE DASHBOARD:
 * ==========================================
 * 1. checkout.session.completed  ⭐ (nomes de produtos, cliente, order_id)
 * 2. invoice.paid                ⭐ (subscriptions, produtos detalhados)
 * 3. charge.succeeded            (pagamentos diretos)
 * 4. charge.refunded             (reembolsos)
 * 5. payout.paid                 (transferências bancárias)
 * 6. charge.dispute.created      (disputas/chargebacks)
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

interface StripeCheckoutSession {
    id: string;
    amount_total: number;
    currency: string;
    created: number;
    status: string;
    payment_status: string;
    customer_details?: {
        name?: string;
        email?: string;
    };
    customer?: string;
    client_reference_id?: string;
    metadata?: Record<string, string>;
    line_items?: {
        data: Array<{
            description?: string;
            quantity?: number;
            amount_total: number;
            price?: {
                product?: string;
            };
        }>;
    };
}

interface StripeInvoice {
    id: string;
    amount_paid: number;
    currency: string;
    created: number;
    status: string;
    customer_name?: string;
    customer_email?: string;
    customer?: string;
    metadata?: Record<string, string>;
    lines?: {
        data: Array<{
            description?: string;
            amount: number;
            quantity?: number;
        }>;
    };
}

/**
 * Busca dados expandidos do Stripe (line_items, customer, etc)
 */
async function fetchStripeExpanded(sessionId: string): Promise<StripeCheckoutSession | null> {
    if (!STRIPE_SECRET_KEY) {
        console.warn("[Stripe Webhook] STRIPE_SECRET_KEY não configurado");
        return null;
    }

    try {
        // Buscar session com line_items expandidos
        const response = await fetch(
            `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=line_items`,
            {
                headers: {
                    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
                },
            }
        );

        if (!response.ok) {
            console.error("[Stripe Webhook] Erro ao buscar session:", response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error("[Stripe Webhook] Erro na API:", error);
        return null;
    }
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

/**
 * Processa evento de checkout.session.completed ⭐ PRINCIPAL
 * Contém: nome do cliente, email, order_id (client_reference_id), produtos
 */
async function handleCheckoutSessionCompleted(session: StripeCheckoutSession) {
    // Buscar dados expandidos com line_items
    const expandedSession = await fetchStripeExpanded(session.id);
    const sessionData = expandedSession || session;

    const amount = (sessionData.amount_total || 0) / 100;
    const currency = sessionData.currency?.toUpperCase() || "EUR";
    const source = `stripe-${currency.toLowerCase()}`;

    // Extrair nomes dos produtos
    const productNames: string[] = [];
    if (sessionData.line_items?.data) {
        for (const item of sessionData.line_items.data) {
            if (item.description) {
                productNames.push(item.description);
            }
        }
    }

    const customerName = sessionData.customer_details?.name || "";
    const customerEmail = sessionData.customer_details?.email || "";
    const orderId = sessionData.client_reference_id || sessionData.metadata?.order_id || null;

    // Descrição rica com produtos
    let description = customerName || customerEmail || "Stripe Checkout";
    if (productNames.length > 0) {
        description += ` - ${productNames.slice(0, 3).join(", ")}`;
        if (productNames.length > 3) {
            description += ` +${productNames.length - 3} more`;
        }
    }

    const rowData = {
        source,
        date: unixToDate(sessionData.created),
        description,
        amount,
        reconciled: false,
        custom_data: {
            session_id: sessionData.id,
            order_id: orderId,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_id: sessionData.customer,
            currency,
            products: productNames,
            product_count: productNames.length,
            status: sessionData.status,
            payment_status: sessionData.payment_status,
            type: "sale",
            created_at: new Date(sessionData.created * 1000).toISOString(),
            webhook_received_at: new Date().toISOString(),
            webhook_event: "checkout.session.completed",
        },
    };

    // Upsert no Supabase
    const { error } = await supabaseAdmin
        .from("csv_rows")
        .upsert(rowData, {
            onConflict: "source,custom_data->>'session_id'",
        });

    if (error) {
        const { error: insertError } = await supabaseAdmin
            .from("csv_rows")
            .insert(rowData);

        if (insertError) {
            console.error("[Stripe Webhook] Erro ao salvar checkout session:", insertError);
            throw insertError;
        }
    }

    console.log(`[Stripe Webhook] ✅ Checkout ${sessionData.id} processado - ${productNames.length} produto(s)`);
}

/**
 * Processa evento de invoice.paid (subscriptions e pagamentos recorrentes)
 */
async function handleInvoicePaid(invoice: StripeInvoice) {
    const amount = (invoice.amount_paid || 0) / 100;
    const currency = invoice.currency?.toUpperCase() || "EUR";
    const source = `stripe-${currency.toLowerCase()}`;

    // Extrair produtos da invoice
    const productNames: string[] = [];
    if (invoice.lines?.data) {
        for (const line of invoice.lines.data) {
            if (line.description) {
                productNames.push(line.description);
            }
        }
    }

    const customerName = invoice.customer_name || "";
    const customerEmail = invoice.customer_email || "";

    let description = customerName || customerEmail || "Stripe Invoice";
    if (productNames.length > 0) {
        description += ` - ${productNames.slice(0, 2).join(", ")}`;
    }

    const rowData = {
        source,
        date: unixToDate(invoice.created),
        description,
        amount,
        reconciled: false,
        custom_data: {
            invoice_id: invoice.id,
            order_id: invoice.metadata?.order_id || null,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_id: invoice.customer,
            currency,
            products: productNames,
            status: invoice.status,
            type: "invoice",
            created_at: new Date(invoice.created * 1000).toISOString(),
            webhook_received_at: new Date().toISOString(),
            webhook_event: "invoice.paid",
        },
    };

    const { error } = await supabaseAdmin
        .from("csv_rows")
        .upsert(rowData, {
            onConflict: "source,custom_data->>'invoice_id'",
        });

    if (error) {
        const { error: insertError } = await supabaseAdmin
            .from("csv_rows")
            .insert(rowData);

        if (insertError) {
            console.error("[Stripe Webhook] Erro ao salvar invoice:", insertError);
            throw insertError;
        }
    }

    console.log(`[Stripe Webhook] ✅ Invoice ${invoice.id} processado`);
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
            // ⭐ Eventos principais (com dados completos)
            case "checkout.session.completed":
                await handleCheckoutSessionCompleted(event.data.object as StripeCheckoutSession);
                break;

            case "invoice.paid":
                await handleInvoicePaid(event.data.object as StripeInvoice);
                break;

            // Eventos de charge (backup/fallback)
            case "charge.succeeded":
            case "charge.failed":
            case "charge.refunded":
                await handleChargeEvent(event.data.object as StripeCharge, event.type);
                break;

            // Payouts (transferências bancárias)
            case "payout.paid":
                await handlePayoutEvent(event.data.object as StripePayout);
                break;

            // Disputas (chargebacks)
            case "charge.dispute.created":
                console.log(`[Stripe Webhook] ⚠️ Disputa aberta: ${event.data.object.id}`);
                // TODO: Implementar notificação de disputa
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
            "checkout.session.completed ⭐",
            "invoice.paid ⭐",
            "charge.succeeded",
            "charge.refunded",
            "payout.paid",
            "charge.dispute.created",
        ],
    });
}
