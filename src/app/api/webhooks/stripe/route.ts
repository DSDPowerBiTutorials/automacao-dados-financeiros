// =====================================================
// Stripe Webhook Handler
// Processa webhooks do Stripe para transações em tempo real
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

/**
 * Verifica a assinatura do webhook do Stripe
 */
async function verifyStripeSignature(
    payload: string,
    signature: string
): Promise<any> {
    if (!STRIPE_WEBHOOK_SECRET) {
        console.warn('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured - skipping verification');
        return JSON.parse(payload);
    }

    // Importar crypto para verificação
    const crypto = await import('crypto');

    // Parse do header de assinatura
    const elements = signature.split(',');
    const timestampStr = elements.find(e => e.startsWith('t='))?.slice(2);
    const signatures = elements
        .filter(e => e.startsWith('v1='))
        .map(e => e.slice(3));

    if (!timestampStr || signatures.length === 0) {
        throw new Error('Invalid signature format');
    }

    const timestamp = parseInt(timestampStr, 10);

    // Verificar se não é muito antigo (5 minutos)
    const now = Math.floor(Date.now() / 1000);
    if (now - timestamp > 300) {
        throw new Error('Webhook signature too old');
    }

    // Criar a string para verificação
    const signedPayload = `${timestamp}.${payload}`;

    // Calcular HMAC
    const expectedSignature = crypto
        .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
        .update(signedPayload)
        .digest('hex');

    // Verificar se alguma das assinaturas é válida
    const isValid = signatures.some(sig =>
        crypto.timingSafeEqual(
            Buffer.from(sig, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        )
    );

    if (!isValid) {
        throw new Error('Invalid webhook signature');
    }

    return JSON.parse(payload);
}

export async function POST(request: NextRequest) {
    try {
        console.log('[Stripe Webhook] Received webhook');

        const payload = await request.text();
        const signature = request.headers.get('stripe-signature') || '';

        // Verificar assinatura (ou parsear se não tiver secret)
        let event;
        try {
            event = await verifyStripeSignature(payload, signature);
        } catch (err) {
            console.error('[Stripe Webhook] Signature verification failed:', err);
            // Em desenvolvimento, aceitar mesmo sem assinatura válida
            if (process.env.NODE_ENV === 'development') {
                event = JSON.parse(payload);
            } else {
                return NextResponse.json(
                    { error: 'Invalid signature' },
                    { status: 400 }
                );
            }
        }

        console.log('[Stripe Webhook] Event type:', event.type);
        console.log('[Stripe Webhook] Event ID:', event.id);

        // Processar diferentes tipos de eventos
        switch (event.type) {
            case 'charge.succeeded':
                await handleChargeSucceeded(event.data.object);
                break;

            case 'charge.refunded':
                await handleChargeRefunded(event.data.object);
                break;

            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event.data.object);
                break;

            case 'payout.paid':
                await handlePayoutPaid(event.data.object);
                break;

            case 'payout.failed':
                await handlePayoutFailed(event.data.object);
                break;

            case 'charge.dispute.created':
            case 'charge.dispute.updated':
            case 'charge.dispute.closed':
                await handleDispute(event.data.object);
                break;

            default:
                console.log('[Stripe Webhook] Unhandled event type:', event.type);
        }

        return NextResponse.json({
            received: true,
            type: event.type,
            id: event.id
        });

    } catch (error: any) {
        console.error('[Stripe Webhook] Error:', error);
        return NextResponse.json(
            { error: 'Webhook processing failed', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * Processa charge bem-sucedido
 */
async function handleChargeSucceeded(charge: any) {
    console.log('[Stripe Webhook] Processing charge.succeeded:', charge.id);

    const currency = charge.currency?.toUpperCase() || 'EUR';
    const customerEmail = charge.receipt_email || charge.billing_details?.email || null;
    const customerName = charge.billing_details?.name || null;
    const paymentMethod = charge.payment_method_details?.card
        ? `${charge.payment_method_details.card.brand} ****${charge.payment_method_details.card.last4}`
        : charge.payment_method_details?.type || 'stripe';

    // Extrair order_id do metadata
    const orderId = charge.metadata?.order_id || charge.metadata?.orderId || null;

    const row = {
        id: `stripe-${currency.toLowerCase()}-${charge.id}`,
        file_name: 'stripe-webhook.csv',
        source: `stripe-api-revenue`,
        date: new Date(charge.created * 1000).toISOString().split('T')[0],
        description: `${customerName || 'Stripe'} - ${paymentMethod}`,
        amount: charge.amount / 100, // Stripe usa centavos
        reconciled: false,
        custom_data: {
            transaction_id: charge.id,
            type: 'charge',
            status: charge.status,
            currency: currency,
            order_id: orderId,
            customer_email: customerEmail,
            customer_name: customerName,
            payment_method: paymentMethod,
            payment_intent: charge.payment_intent,
            created_at: new Date(charge.created * 1000).toISOString(),
            metadata: charge.metadata,
            webhook_received_at: new Date().toISOString(),
        },
    };

    const { error } = await supabaseAdmin
        .from('csv_rows')
        .upsert(row, { onConflict: 'id' });

    if (error) {
        console.error('[Stripe Webhook] Error saving charge:', error);
        throw error;
    }

    console.log('[Stripe Webhook] ✅ Charge saved:', charge.id);
}

/**
 * Processa reembolso
 */
async function handleChargeRefunded(charge: any) {
    console.log('[Stripe Webhook] Processing charge.refunded:', charge.id);

    const currency = charge.currency?.toUpperCase() || 'EUR';
    const refundedAmount = charge.amount_refunded / 100;

    const row = {
        id: `stripe-refund-${charge.id}`,
        file_name: 'stripe-webhook.csv',
        source: `stripe-api-revenue`,
        date: new Date().toISOString().split('T')[0],
        description: `Refund - ${charge.billing_details?.name || 'Stripe'}`,
        amount: -refundedAmount, // Negativo para refund
        reconciled: false,
        custom_data: {
            transaction_id: charge.id,
            type: 'refund',
            status: 'refunded',
            currency: currency,
            original_charge_id: charge.id,
            refunded_amount: refundedAmount,
            created_at: new Date().toISOString(),
            webhook_received_at: new Date().toISOString(),
        },
    };

    const { error } = await supabaseAdmin
        .from('csv_rows')
        .upsert(row, { onConflict: 'id' });

    if (error) {
        console.error('[Stripe Webhook] Error saving refund:', error);
        throw error;
    }

    console.log('[Stripe Webhook] ✅ Refund saved:', charge.id);
}

/**
 * Processa payment intent succeeded
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
    console.log('[Stripe Webhook] Processing payment_intent.succeeded:', paymentIntent.id);
    // Geralmente o charge.succeeded já cobre isso, mas logar para debug
}

/**
 * Processa payout paid (dinheiro enviado ao banco)
 */
async function handlePayoutPaid(payout: any) {
    console.log('[Stripe Webhook] Processing payout.paid:', payout.id);

    const currency = payout.currency?.toUpperCase() || 'EUR';
    const arrivalDate = new Date(payout.arrival_date * 1000).toISOString().split('T')[0];

    const row = {
        id: `stripe-payout-${payout.id}`,
        file_name: 'stripe-webhook.csv',
        source: `stripe-api-disbursement`,
        date: arrivalDate,
        description: `Stripe Payout - ${payout.description || payout.id}`,
        amount: payout.amount / 100,
        reconciled: false,
        custom_data: {
            payout_id: payout.id,
            type: 'payout',
            status: payout.status,
            currency: currency,
            arrival_date: arrivalDate,
            created_at: new Date(payout.created * 1000).toISOString(),
            webhook_received_at: new Date().toISOString(),
        },
    };

    const { error } = await supabaseAdmin
        .from('csv_rows')
        .upsert(row, { onConflict: 'id' });

    if (error) {
        console.error('[Stripe Webhook] Error saving payout:', error);
        throw error;
    }

    console.log('[Stripe Webhook] ✅ Payout saved:', payout.id);
}

/**
 * Processa payout failed
 */
async function handlePayoutFailed(payout: any) {
    console.log('[Stripe Webhook] ⚠️ Payout failed:', payout.id);
    // TODO: Alertar sobre falha no payout
}

/**
 * Processa disputa (chargeback)
 */
async function handleDispute(dispute: any) {
    console.log('[Stripe Webhook] Processing dispute:', dispute.id, 'status:', dispute.status);
    // TODO: Registrar disputa e atualizar transação relacionada
}

/**
 * GET - Retorna informações do endpoint
 */
export async function GET() {
    return NextResponse.json({
        endpoint: '/api/webhooks/stripe',
        description: 'Stripe Webhook Endpoint',
        status: 'active',
        configured: {
            webhook_secret: !!STRIPE_WEBHOOK_SECRET,
            secret_key: !!STRIPE_SECRET_KEY,
        },
        supported_events: [
            'charge.succeeded',
            'charge.refunded',
            'payment_intent.succeeded',
            'payout.paid',
            'payout.failed',
            'charge.dispute.created',
            'charge.dispute.updated',
            'charge.dispute.closed',
        ],
    });
}
