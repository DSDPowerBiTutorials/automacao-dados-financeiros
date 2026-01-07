// =====================================================
// Braintree Webhook Handler
// Processa webhooks do Braintree e atualiza sync_metadata
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import braintree from 'braintree';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { updateSyncMetadata } from '@/lib/sync-metadata';

// Inicializar Braintree Gateway
const gateway = new braintree.BraintreeGateway({
    environment: process.env.BRAINTREE_ENVIRONMENT === 'production'
        ? braintree.Environment.Production
        : braintree.Environment.Sandbox,
    merchantId: process.env.BRAINTREE_MERCHANT_ID!,
    publicKey: process.env.BRAINTREE_PUBLIC_KEY!,
    privateKey: process.env.BRAINTREE_PRIVATE_KEY!,
});

export async function POST(request: NextRequest) {
    try {
        console.log('[Braintree Webhook] Received webhook');

        // Parse webhook notification
        const formData = await request.formData();
        const btSignature = formData.get('bt_signature') as string;
        const btPayload = formData.get('bt_payload') as string;

        if (!btSignature || !btPayload) {
            console.error('[Braintree Webhook] Missing signature or payload');
            return NextResponse.json(
                { error: 'Invalid webhook payload' },
                { status: 400 }
            );
        }

        // Verificar assinatura do webhook
        const webhookNotification = gateway.webhookNotification.parse(
            btSignature,
            btPayload
        );

        console.log('[Braintree Webhook] Kind:', webhookNotification.kind);
        console.log('[Braintree Webhook] Timestamp:', webhookNotification.timestamp);

        // Processar diferentes tipos de eventos
        switch (webhookNotification.kind) {
            case 'subscription_charged_successfully':
            case 'subscription_charged_unsuccessfully':
                await handleSubscriptionCharge(webhookNotification);
                break;

            case 'transaction_settled':
            case 'transaction_settlement_declined':
                await handleTransactionSettled(webhookNotification);
                break;

            case 'disbursement':
                await handleDisbursement(webhookNotification);
                break;

            case 'dispute_opened':
            case 'dispute_won':
            case 'dispute_lost':
                await handleDispute(webhookNotification);
                break;

            default:
                console.log('[Braintree Webhook] Unhandled event type:', webhookNotification.kind);
        }

        return NextResponse.json({ received: true, kind: webhookNotification.kind });

    } catch (error: any) {
        console.error('[Braintree Webhook] Error:', error);

        // Registrar erro no sync_metadata
        await updateSyncMetadata({
            source: 'braintree-webhook',
            syncType: 'webhook',
            status: 'error',
            error: error.message,
        });

        return NextResponse.json(
            { error: 'Webhook processing failed', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * Processa evento de cobrança de assinatura
 */
async function handleSubscriptionCharge(notification: any) {
    const subscription = notification.subscription;
    const transactions = subscription.transactions || [];

    for (const transaction of transactions) {
        await saveTransaction(transaction);
    }
}

/**
 * Processa evento de transação liquidada
 */
async function handleTransactionSettled(notification: any) {
    const transaction = notification.transaction;
    await saveTransaction(transaction);
}

/**
 * Processa evento de desembolso (payout)
 */
async function handleDisbursement(notification: any) {
    const disbursement = notification.disbursement;

    console.log('[Braintree Webhook] Disbursement:', {
        id: disbursement.id,
        amount: disbursement.amount,
        disbursementDate: disbursement.disbursementDate,
    });

    // TODO: Salvar informações de disbursement se necessário
}

/**
 * Processa evento de disputa (chargeback)
 */
async function handleDispute(notification: any) {
    const dispute = notification.dispute;

    console.log('[Braintree Webhook] Dispute:', {
        id: dispute.id,
        status: dispute.status,
        amount: dispute.amount,
        transaction: dispute.transaction?.id,
    });

    // TODO: Atualizar transação relacionada com informação de disputa
}

/**
 * Salva ou atualiza transação no banco
 */
async function saveTransaction(transaction: any) {
    console.log('[Braintree Webhook] Processing transaction:', transaction.id);

    // Determinar source baseado na moeda/merchant account
    const merchantAccountId = transaction.merchantAccountId || '';
    let source = 'braintree-transactions';

    if (merchantAccountId.includes('EUR')) {
        source = 'braintree-eur';
    } else if (merchantAccountId.includes('USD')) {
        source = 'braintree-usd';
    } else if (merchantAccountId.includes('Amex')) {
        source = 'braintree-amex';
    }

    // Preparar dados da transação
    const transactionDate = transaction.createdAt || new Date();
    const amount = parseFloat(transaction.amount) || 0;
    const fee = parseFloat(transaction.serviceFeeAmount) || 0;

    // 1. Salvar receita
    const { error: revenueError } = await supabaseAdmin
        .from('csv_rows')
        .upsert({
            source: `${source}`,
            external_id: `${transaction.id}-revenue`,
            date: transactionDate,
            description: `${transaction.customer?.firstName || ''} ${transaction.customer?.lastName || ''} - ${transaction.type}`,
            amount: amount,
            custom_data: {
                transaction_id: transaction.id,
                status: transaction.status,
                type: transaction.type,
                payment_method: transaction.paymentInstrumentType,
                customer_email: transaction.customer?.email,
                customer_id: transaction.customer?.id,
                merchant_account_id: merchantAccountId,
                settlement_date: transaction.disbursementDetails?.disbursementDate,
                webhook_received_at: new Date().toISOString(),
            },
        }, {
            onConflict: 'source,external_id',
            ignoreDuplicates: false,
        });

    if (revenueError) {
        console.error('[Braintree Webhook] Error saving revenue:', revenueError);
    }

    // 2. Salvar fee (se houver)
    if (fee > 0) {
        const { error: feeError } = await supabaseAdmin
            .from('csv_rows')
            .upsert({
                source: `${source}-fees`,
                external_id: `${transaction.id}-fee`,
                date: transactionDate,
                description: `Fee - ${transaction.id}`,
                amount: -Math.abs(fee),
                custom_data: {
                    transaction_id: transaction.id,
                    fee_type: 'service_fee',
                    merchant_account_id: merchantAccountId,
                    webhook_received_at: new Date().toISOString(),
                },
            }, {
                onConflict: 'source,external_id',
                ignoreDuplicates: false,
            });

        if (feeError) {
            console.error('[Braintree Webhook] Error saving fee:', feeError);
        }
    }

    // 3. Atualizar sync_metadata
    await updateSyncMetadata({
        source,
        syncType: 'webhook',
        recordsAdded: fee > 0 ? 2 : 1,
        lastRecordDate: new Date(transactionDate),
        status: 'success',
    });

    console.log('[Braintree Webhook] Transaction saved:', transaction.id);
}

// Exportar também como GET para teste
export async function GET() {
    return NextResponse.json({
        message: 'Braintree webhook endpoint',
        status: 'active',
        info: 'Send POST requests with Braintree webhook payload',
    });
}
