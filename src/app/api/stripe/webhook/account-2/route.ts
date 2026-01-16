/**
 * Webhook do Stripe - Conta 2 (Digitalsmiledesign)
 * 
 * URL para configurar no Stripe Dashboard:
 * https://www.dsdfinancehub.com/api/stripe/webhook/account-2
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import Stripe from "stripe";

const STRIPE_SECRET_KEY_2 = process.env.STRIPE_SECRET_KEY_2;
const STRIPE_WEBHOOK_SECRET_2 = process.env.STRIPE_WEBHOOK_SECRET_2;

const ACCOUNT_ID = "stripe-account-2";
const ACCOUNT_NAME = process.env.STRIPE_ACCOUNT_NAME_2 || "Digitalsmiledesign";
const CURRENCY = process.env.STRIPE_CURRENCY_2 || "EUR";
const BANK_ACCOUNT = process.env.STRIPE_BANK_ACCOUNT_2 || "bankinter-4605";

// Inicializa Stripe se a chave estiver disponível
let stripe: Stripe | null = null;
if (STRIPE_SECRET_KEY_2) {
    stripe = new Stripe(STRIPE_SECRET_KEY_2, {
        apiVersion: "2024-12-18.acacia",
    });
}

function unixToDate(timestamp: number): string {
    return new Date(timestamp * 1000).toISOString().split("T")[0];
}

export async function POST(request: NextRequest) {
    console.log(`[Stripe Webhook Account 2] 📥 Received webhook`);

    try {
        const body = await request.text();
        const signature = request.headers.get("stripe-signature");

        if (!signature) {
            console.error("[Stripe Webhook Account 2] ❌ No signature");
            return NextResponse.json({ error: "No signature" }, { status: 400 });
        }

        if (!STRIPE_WEBHOOK_SECRET_2) {
            console.error("[Stripe Webhook Account 2] ❌ Webhook secret not configured");
            return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
        }

        if (!stripe) {
            console.error("[Stripe Webhook Account 2] ❌ Stripe not initialized");
            return NextResponse.json({ error: "Stripe not initialized" }, { status: 500 });
        }

        // Verificar assinatura do webhook
        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET_2);
        } catch (err) {
            console.error("[Stripe Webhook Account 2] ❌ Invalid signature:", err);
            return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
        }

        console.log(`[Stripe Webhook Account 2] ✅ Event verified: ${event.type}`);

        // Processar eventos
        switch (event.type) {
            case "charge.succeeded": {
                const charge = event.data.object as Stripe.Charge;
                await handleChargeSucceeded(charge);
                break;
            }
            case "charge.refunded": {
                const charge = event.data.object as Stripe.Charge;
                await handleChargeRefunded(charge);
                break;
            }
            case "payout.paid": {
                const payout = event.data.object as Stripe.Payout;
                await handlePayoutPaid(payout);
                break;
            }
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutCompleted(session);
                break;
            }
            default:
                console.log(`[Stripe Webhook Account 2] ℹ️ Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[Stripe Webhook Account 2] ❌ Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

async function handleChargeSucceeded(charge: Stripe.Charge) {
    console.log(`[Stripe Webhook Account 2] 💳 Processing charge: ${charge.id}`);

    if (!supabaseAdmin) {
        throw new Error("Supabase not configured");
    }

    const customerEmail = charge.receipt_email || charge.billing_details?.email || null;
    const customerName = charge.billing_details?.name || null;
    const paymentMethod = charge.payment_method_details?.card
        ? `${charge.payment_method_details.card.brand} ****${charge.payment_method_details.card.last4}`
        : charge.payment_method_details?.type || "unknown";

    const createdDate = new Date(charge.created * 1000);
    const disbursementDate = new Date(createdDate);
    disbursementDate.setDate(disbursementDate.getDate() + 2);

    const row = {
        id: `stripe-${CURRENCY.toLowerCase()}-${charge.id}`,
        file_name: `stripe-${ACCOUNT_NAME.toLowerCase().replace(/\s+/g, "-")}-webhook`,
        source: `stripe-${CURRENCY.toLowerCase()}`,
        date: unixToDate(charge.created),
        description: `${customerName || "Stripe Customer"} - ${paymentMethod}`,
        amount: (charge.amount / 100).toString(),
        reconciled: false,
        customer_email: customerEmail,
        customer_name: customerName,
        custom_data: {
            transaction_id: charge.id,
            order_id: charge.metadata?.order_id || charge.metadata?.orderId || null,
            status: charge.status,
            type: "sale",
            currency: charge.currency.toUpperCase(),
            customer_email: customerEmail,
            customer_name: customerName,
            payment_method: paymentMethod,
            payment_intent: charge.payment_intent,
            created_at: createdDate.toISOString(),
            settlement_date: unixToDate(charge.created),
            disbursement_date: disbursementDate.toISOString().split("T")[0],
            stripe_account_id: ACCOUNT_ID,
            stripe_account_name: ACCOUNT_NAME,
            bank_account: BANK_ACCOUNT,
            metadata: charge.metadata,
            webhook_received_at: new Date().toISOString(),
        },
    };

    const { error } = await supabaseAdmin.from("csv_rows").upsert([row], { onConflict: "id" });

    if (error) {
        console.error("[Stripe Webhook Account 2] ❌ Supabase error:", error);
        throw error;
    }

    console.log(`[Stripe Webhook Account 2] ✅ Charge saved: ${charge.id}`);
}

async function handleChargeRefunded(charge: Stripe.Charge) {
    console.log(`[Stripe Webhook Account 2] 🔄 Processing refund for charge: ${charge.id}`);

    if (!supabaseAdmin) {
        throw new Error("Supabase not configured");
    }

    const refundAmount = charge.amount_refunded / 100;
    const customerName = charge.billing_details?.name || "Stripe Customer";

    const row = {
        id: `stripe-refund-${CURRENCY.toLowerCase()}-${charge.id}`,
        file_name: `stripe-${ACCOUNT_NAME.toLowerCase().replace(/\s+/g, "-")}-refunds`,
        source: `stripe-${CURRENCY.toLowerCase()}`,
        date: new Date().toISOString().split("T")[0],
        description: `Refund - ${customerName}`,
        amount: (-refundAmount).toString(),
        reconciled: false,
        custom_data: {
            transaction_id: charge.id,
            type: "refund",
            currency: charge.currency.toUpperCase(),
            original_charge_id: charge.id,
            stripe_account_id: ACCOUNT_ID,
            stripe_account_name: ACCOUNT_NAME,
            bank_account: BANK_ACCOUNT,
            webhook_received_at: new Date().toISOString(),
        },
    };

    const { error } = await supabaseAdmin.from("csv_rows").upsert([row], { onConflict: "id" });

    if (error) {
        console.error("[Stripe Webhook Account 2] ❌ Supabase refund error:", error);
        throw error;
    }

    console.log(`[Stripe Webhook Account 2] ✅ Refund saved: ${charge.id}`);
}

async function handlePayoutPaid(payout: Stripe.Payout) {
    console.log(`[Stripe Webhook Account 2] 🏦 Processing payout: ${payout.id}`);

    if (!supabaseAdmin) {
        throw new Error("Supabase not configured");
    }

    const row = {
        id: `stripe-payout-${CURRENCY.toLowerCase()}-${payout.id}`,
        file_name: `stripe-${ACCOUNT_NAME.toLowerCase().replace(/\s+/g, "-")}-payouts`,
        source: `stripe-${CURRENCY.toLowerCase()}-payouts`,
        date: unixToDate(payout.arrival_date),
        description: `Stripe Payout - ${ACCOUNT_NAME}`,
        amount: (payout.amount / 100).toString(),
        reconciled: false,
        custom_data: {
            transaction_id: payout.id,
            type: "payout",
            currency: payout.currency.toUpperCase(),
            status: payout.status,
            created_at: new Date(payout.created * 1000).toISOString(),
            arrival_date: unixToDate(payout.arrival_date),
            stripe_account_id: ACCOUNT_ID,
            stripe_account_name: ACCOUNT_NAME,
            bank_account: BANK_ACCOUNT,
            webhook_received_at: new Date().toISOString(),
        },
    };

    const { error } = await supabaseAdmin.from("csv_rows").upsert([row], { onConflict: "id" });

    if (error) {
        console.error("[Stripe Webhook Account 2] ❌ Supabase payout error:", error);
        throw error;
    }

    console.log(`[Stripe Webhook Account 2] ✅ Payout saved: ${payout.id}`);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    console.log(`[Stripe Webhook Account 2] 🛒 Processing checkout: ${session.id}`);
    // Checkout sessions geralmente têm um charge associado que será processado separadamente
    // Aqui podemos extrair informações adicionais como line_items se necessário
}

// GET para verificar se o endpoint está funcionando
export async function GET() {
    return NextResponse.json({
        status: "ok",
        account: ACCOUNT_NAME,
        accountId: ACCOUNT_ID,
        currency: CURRENCY,
        bankAccount: BANK_ACCOUNT,
        configured: !!STRIPE_SECRET_KEY_2 && !!STRIPE_WEBHOOK_SECRET_2,
        webhookUrl: "https://www.dsdfinancehub.com/api/stripe/webhook/account-2",
    });
}
