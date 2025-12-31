/**
 * API Route: Webhook do Braintree
 * 
 * Recebe notificações em tempo real do Braintree quando:
 * - Transação é criada/atualizada
 * - Transação é settled (confirmada)
 * - Disputa é aberta
 * - Subscription é cobrada
 * 
 * URL para configurar no Braintree:
 * https://dsdfinancehub.com/api/braintree/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  braintreeGateway,
  calculateTransactionFee,
  getCustomerName,
  getPaymentMethod,
  type BraintreeTransactionData,
} from "@/lib/braintree";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text(); // Webhook vem como form-urlencoded

    // Parse form data
    const params = new URLSearchParams(body);
    const btSignature = params.get("bt_signature");
    const btPayload = params.get("bt_payload");

    if (!btSignature || !btPayload) {
      return NextResponse.json(
        { error: "Missing webhook signature or payload" },
        { status: 400 }
      );
    }

    // Verifica assinatura do webhook (garante que é do Braintree)
    const webhookNotification = braintreeGateway.webhookNotification.parse(
      btSignature,
      btPayload
    );

    console.log(
      `[Braintree Webhook] Received: ${webhookNotification.kind} for ${webhookNotification.timestamp}`
    );

    // Eventos que vamos processar
    const handledEvents = [
      // Subscription
      "subscription_charged_successfully",
      "subscription_charged_unsuccessfully",
      "subscription_canceled",
      "subscription_expired",
      "subscription_went_active",
      // Disbursement (conciliação bancária)
      "disbursement",
      // Dispute (chargebacks)
      "dispute_opened",
      "dispute_won",
      "Roteamento por tipo de evento
    const eventKind = webhookNotification.kind;

    // EVENTOS DE CANCELAMENTO/EXPIRAÇÃO
    if (["subscription_canceled", "subscription_expired"].includes(eventKind)) {
      const subscription = webhookNotification.subscription;
      
      if (subscription) {
        // Atualiza status de transações relacionadas a essa subscription
        const { error } = await supabaseAdmin
          .from("csv_rows")
          .update({
            custom_data: supabaseAdmin.raw(
              `custom_data || '{"subscription_status": "${eventKind === "subscription_canceled" ? "canceled" : "expired"}", "canceled_at": "${new Date().toISOString()}"}'::jsonb`
            ),
          })
          .eq("source", "braintree-api-revenue")
          .eq("custom_data->>subscription_id", subscription.id);

        console.log(`[Braintree Webhook] Subscription ${subscription.id} marcada como ${eventKind}`);
      }

      return NextResponse.json({
        success: true,
        message: "Subscription status updated",
      });
    }

    // EVENTOS DE DISPUTE (Chargeback)
    if (["dispute_opened", "dispute_won", "dispute_lost"].includes(eventKind)) {
      const dispute = webhookNotification.dispute;
      
      if (dispute) {
        const disputeStatus = eventKind.replace("dispute_", "");
        
        // Atualiza transação relacionada
        const { error } = await supabaseAdmin
          .from("csv_rows")
          .update({
            custom_data: supabaseAdmin.raw(
              `custom_data || '{"dispute_status": "${disputeStatus}", "dispute_amount": ${dispute.amount}, "dispute_reason": "${dispute.reason}", "dispute_date": "${new Date().toISOString()}"}'::jsonb`
            ),
          })
          .eq("source", "braintree-api-revenue")
          .eq("custom_data->>transaction_id", dispute.transaction?.id);

        console.log(`[Braintree Webhook] Dispute ${disputeStatus} para transação ${dispute.transaction?.id}`);
      }

      return NextResponse.json({
        success: true,
        message: "Dispute status updated",
      });
    }

    // EVENTO DE DISBURSEMENT (Transferência bancária)
    if (subscription_id: transaction.subscriptionId,
        created_at: transaction.createdAt,
        webhook_received_at: new Date().toISOString(),
        webhook_kind: webhookNotification.kind,
        is_successful: eventKind.includes("successfully")
      if (disbursement) {
        // Cria registro de disbursement (importante pra conciliação bancária)
        const disbursementRow = {
          source: "braintree-api-disbursement",
          date: new Date(disbursement.disbursementDate).toISOString().split("T")[0],
          description: `Disbursement Braintree - ${disbursement.id}`,
          amount: parseFloat(disbursement.amount),
          reconciled: false,

          custom_data: {
            disbursement_id: disbursement.id,
            merchant_account_id: disbursement.merchantAccount?.id,
            currency: disbursement.merchantAccount?.currencyIsoCode || "EUR",
            success: disbursement.success,
            disbursement_date: disbursement.disbursementDate,
            webhook_received_at: new Date().toISOString(),
          },
        };

        await supabaseAdmin.from("csv_rows").insert([disbursementRow]);
        
        console.log(`[Braintree Webhook] Disbursement ${disbursement.id} registrado: €${disbursement.amount}`);
      }

      return NextResponse.json({
        success: true,
        message: "Disbursement recorded",
      });
    }

    // EVENTOS DE TRANSAÇÃO (receitas)
    const transaction = webhookNotification.transaction;

    if (!transaction) {
      console.log("[Braintree Webhook] Webhook sem dados de transação");
      return NextResponse.json({ success: true, message: "No transaction data" });
    }

    // Verifica se já existe no banco (evita duplicatas)
    const { data: existing } = await supabaseAdmin
      .from("csv_rows")
      .select("id")
      .eq("source", "braintree-api-revenue")
      .eq("custom_data->>transaction_id", transaction.id)
      .single();

    if (existing) {
      console.log(`[Braintree Webhook] Transação ${transaction.id} já existe, atualizando status`);
      
      // Atualiza status se evento for de falha/reversão
      if (eventKind.includes("unsuccessful") || eventKind.includes("reversed")) {
        await supabaseAdmin
          .from("csv_rows")
          .update({
            custom_data: supabaseAdmin.raw(
              `custom_data || '{"status": "failed", "webhook_kind": "${eventKind}", "failed_at": "${new Date().toISOString()}"}'::jsonb`
            ),
          })
          .eq("id", existing.id);
      }

      console.log("[Braintree Webhook] Webhook sem dados de transação");
      return NextResponse.json({ success: true, message: "No transaction data" });
    }

    // Verifica se já existe no banco (evita duplicatas)
    const { data: existing } = await supabaseAdmin
      .from("csv_rows")
      .select("id")
      .eq("source", "braintree-api-revenue")
      .eq("custom_data->>transaction_id", transaction.id)
      .single();

    if (existing) {
      console.log(`[Braintree Webhook] Transação ${transaction.id} já existe, pulando`);
      return NextResponse.json({
        success: true,
        message: "Transaction already exists",
      });
    }

    // Cria registros no banco (receita + fee)
    const revenueRow = {
      source: "braintree-api-revenue",
      date: new Date(transaction.createdAt).toISOString().split("T")[0],
      description: `${getCustomerName(transaction as any)} - ${getPaymentMethod(transaction as any)}`,
      amount: parseFloat(transaction.amount),
      reconciled: false,

      custom_data: {
        transaction_id: transaction.id,
        status: transaction.status,
        type: transaction.type,
        currency: transaction.currencyIsoCode || "EUR",
        customer_id: transaction.customer?.id,
        customer_name: getCustomerName(transaction as any),
        customer_email: transaction.customer?.email,
        payment_method: getPaymentMethod(transaction as any),
        merchant_account_id: transaction.merchantAccountId,
        created_at: transaction.createdAt,
        webhook_received_at: new Date().toISOString(),
        webhook_kind: webhookNotification.kind,
      },
    };

    const { error: revenueError } = await supabaseAdmin
      .from("csv_rows")
      .insert([revenueRow]);

    if (revenueError) {
      console.error("[Braintree Webhook] Erro ao inserir receita:", revenueError);
      throw revenueError;
    }

    // Cria registro de fee
    const fee = calculateTransactionFee(transaction as any);

    if (fee > 0) {
      const feeRow = {
        source: "braintree-api-fees",
        date: new Date(transaction.createdAt).toISOString().split("T")[0],
        description: `Fee Braintree - ${transaction.id}`,
        amount: -fee,
        reconciled: false,

        custom_data: {
          transaction_id: transaction.id,
          related_revenue_amount: parseFloat(transaction.amount),
          currency: transaction.currencyIsoCode || "EUR",
          fee_type: "braintree_processing_fee",
          merchant_account_id: transaction.merchantAccountId,
          webhook_received_at: new Date().toISOString(),
        },
      };

      const { error: feeError } = await supabaseAdmin
        .from("csv_rows")
        .insert([feeRow]);

      if (feeError) {
        console.error("[Braintree Webhook] Erro ao inserir fee:", feeError);
      }
    }

    console.log(
      `[Braintree Webhook] ✅ Transação ${transaction.id} processada: €${transaction.amount}`
    );

    return NextResponse.json({
      success: true,
      message: "Webhook processed successfully",
      transaction_id: transaction.id,
      amount: transaction.amount,
    });
  } catch (error: any) {
    console.error("[Braintree Webhook] Erro:", error);

    // Se for erro de validação de assinatura, retorna 400
    if (error.message?.includes("InvalidSignature")) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro ao processar webhook",
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Retorna informações sobre configuração do webhook
 */
export async function GET() {
  return NextResponse.json({
    webhook_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://dsdfinancehub.com"}/api/braintree/webhook`,
    instructions: [
      "1. Acesse o painel do Braintree: Settings → Webhooks",
      "2. Clique em 'Add New Webhook'",
      "3. Cole a URL acima no campo 'Destination URL'",
      "4. Selecione os eventos:",
      "   - transaction_settled",
      "   - transaction_settlement_declined",
      "   - subscription_charged_successfully",
      "5. Clique em 'Create Webhook'",
      "6. Teste clicando em 'Send Test Notification'",
    ],
    supported_events: [
      "subscription_charged_successfully",
      "subscription_charged_unsuccessfully",
      "subscription_canceled",
      "subscription_expired",
      "subscription_went_active",
      "disbursement",
      "dispute_opened",
      "dispute_won",
      "dispute_lost",
      "local_payment_completed",
      "local_payment_reversed",
      "local_payment_funded",
      "refund_failed",
    ],
  });
}
