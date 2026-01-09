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
    const body = await req.text();

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
    const webhookNotification = await braintreeGateway.webhookNotification.parse(
      btSignature,
      btPayload
    );

    console.log(
      `[Braintree Webhook] Received: ${webhookNotification.kind} for ${webhookNotification.timestamp}`
    );

    // Eventos que vamos processar
    const handledEvents = [
      // Transações diretas (NOVO - pagamentos únicos)
      "transaction_authorized",
      "transaction_settlement_pending",
      "transaction_settled",
      "transaction_settlement_declined",
      "transaction_voided",
      "transaction_submitted_for_settlement",
      "transaction_failed",
      "transaction_gateway_rejected",

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
      "dispute_lost",
      // Local Payments
      "local_payment_completed",
      "local_payment_reversed",
      "local_payment_funded",
      // Refund
      "refund_failed",
    ];

    if (!handledEvents.includes(webhookNotification.kind)) {
      console.log(`[Braintree Webhook] Evento não processado: ${webhookNotification.kind}`);
      return NextResponse.json({ success: true, message: "Event not handled" });
    }

    // Roteamento por tipo de evento
    const eventKind = webhookNotification.kind;

    // ✅ NOVO: EVENTOS DE TRANSAÇÃO DIRETA (pagamentos únicos)
    if ([
      "transaction_authorized",
      "transaction_settlement_pending",
      "transaction_settled",
      "transaction_settlement_declined",
      "transaction_voided",
      "transaction_submitted_for_settlement",
      "transaction_failed",
      "transaction_gateway_rejected",
    ].includes(eventKind)) {
      const transaction = webhookNotification.transaction;

      if (transaction) {
        const isSuccessful = [
          "transaction_authorized",
          "transaction_settlement_pending",
          "transaction_settled",
          "transaction_submitted_for_settlement",
        ].includes(eventKind);

        // Cria registro de revenue
        const revenueRow = {
          source: "braintree-api-revenue",
          date: transaction.createdAt.toISOString().split("T")[0],
          description: `${getPaymentMethod(transaction)} - ${getCustomerName(transaction)}`,
          amount: parseFloat(transaction.amount),
          reconciled: false,
          custom_data: {
            transaction_id: transaction.id,
            customer_name: getCustomerName(transaction),
            customer_email: transaction.customer?.email,
            currency: transaction.currencyIsoCode,
            payment_method: getPaymentMethod(transaction),
            status: eventKind.replace("transaction_", ""),
            created_at: transaction.createdAt,
            webhook_received_at: new Date().toISOString(),
            webhook_kind: webhookNotification.kind,
            is_successful: isSuccessful,
          },
        };

        const { error: revenueError } = await supabaseAdmin
          .from("csv_rows")
          .insert(revenueRow);

        if (revenueError) {
          console.error("[Braintree Webhook] Erro ao salvar transação direta:", revenueError);
        } else {
          console.log(`[Braintree Webhook] Transação direta salva: ${transaction.id} (${eventKind})`);
        }

        // Se foi bem-sucedida, cria também a fee
        if (isSuccessful) {
          const feeAmount = calculateTransactionFee(transaction as BraintreeTransactionData);

          const feeRow = {
            source: "braintree-api-fees",
            file_name: `braintree-webhook-fee-${transaction.id}.json`,
            date: transaction.createdAt.toISOString().split("T")[0],
            description: `Braintree Fee - ${transaction.id}`,
            amount: -Math.abs(feeAmount),
            reconciled: false,
            custom_data: {
              transaction_id: transaction.id,
              currency: transaction.currencyIsoCode,
              payment_method: getPaymentMethod(transaction),
              webhook_received_at: new Date().toISOString(),
            },
          };

          const { error: feeError } = await supabaseAdmin
            .from("csv_rows")
            .insert(feeRow);

          if (feeError) {
            console.error("[Braintree Webhook] Erro ao salvar fee:", feeError);
          }

          console.log(`[Braintree Webhook] Fee salva para: ${transaction.id}`);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Transaction processed",
      });
    }

    // EVENTOS DE CANCELAMENTO/EXPIRAÇÃO
    if (["subscription_canceled", "subscription_expired"].includes(eventKind)) {
      const subscription = webhookNotification.subscription;

      if (subscription) {
        const status = eventKind === "subscription_canceled" ? "canceled" : "expired";

        // Atualiza status de transações relacionadas a essa subscription
        const { error } = await supabaseAdmin
          .from("csv_rows")
          .update({
            custom_data: {
              subscription_status: status,
              canceled_at: new Date().toISOString(),
            },
          })
          .eq("source", "braintree-api-revenue")
          .filter("custom_data->>subscription_id", "eq", subscription.id);

        console.log(`[Braintree Webhook] Subscription ${subscription.id} marcada como ${status}`);
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
            custom_data: {
              dispute_status: disputeStatus,
              dispute_amount: dispute.amount,
              dispute_reason: dispute.reason,
              dispute_date: new Date().toISOString(),
            },
          })
          .eq("source", "braintree-api-revenue")
          .filter("custom_data->>transaction_id", "eq", dispute.transaction?.id);

        console.log(`[Braintree Webhook] Dispute ${disputeStatus} para transação ${dispute.transaction?.id}`);
      }

      return NextResponse.json({
        success: true,
        message: "Dispute status updated",
      });
    }

    // EVENTO DE DISBURSEMENT (Transferência bancária)
    if (eventKind === "disbursement") {
      const disbursement = webhookNotification.disbursement;

      if (disbursement) {
        // Cria registro de disbursement (importante pra conciliação bancária)
        const disbursementRow = {
          source: "braintree-api-disbursement",
          file_name: `braintree-webhook-disbursement-${disbursement.id}.json`,
          date: new Date(disbursement.disbursementDate).toISOString().split("T")[0],
          description: `Disbursement Braintree - ${disbursement.id}`,
          amount: parseFloat(disbursement.amount),
          reconciled: false,
          custom_data: {
            disbursement_id: disbursement.id,
            merchant_account_id: disbursement.merchantAccount?.id,
            currency: disbursement.merchantAccount?.currencyIsoCode || "EUR",
            webhook_received_at: new Date().toISOString(),
            transaction_ids: disbursement.transactionIds,
          },
        };

        const { error } = await supabaseAdmin
          .from("csv_rows")
          .insert(disbursementRow);

        if (error) {
          console.error("[Braintree Webhook] Erro ao salvar disbursement:", error);
          return NextResponse.json(
            { error: "Failed to save disbursement" },
            { status: 500 }
          );
        }

        console.log(`[Braintree Webhook] Disbursement salvo: ${disbursement.id}`);
      }

      return NextResponse.json({
        success: true,
        message: "Disbursement saved",
      });
    }

    // EVENTOS DE LOCAL PAYMENT
    if (["local_payment_completed", "local_payment_reversed", "local_payment_funded"].includes(eventKind)) {
      const localPayment = webhookNotification.localPayment;

      if (localPayment) {
        const paymentRow = {
          source: "braintree-api-revenue",
          file_name: `braintree-webhook-localpayment-${localPayment.paymentId}.json`,
          date: new Date().toISOString().split("T")[0],
          description: `Local Payment ${eventKind.split("_")[2]} - ${localPayment.paymentId}`,
          amount: parseFloat(localPayment.amount || "0"),
          reconciled: false,
          custom_data: {
            payment_id: localPayment.paymentId,
            transaction_id: localPayment.transactionId,
            currency: localPayment.currencyIsoCode,
            payment_method: localPayment.paymentMethodNonce,
            status: eventKind.split("_")[2],
            webhook_received_at: new Date().toISOString(),
          },
        };

        const { error } = await supabaseAdmin
          .from("csv_rows")
          .insert(paymentRow);

        if (error) {
          console.error("[Braintree Webhook] Erro ao salvar local payment:", error);
        } else {
          console.log(`[Braintree Webhook] Local payment salvo: ${localPayment.paymentId}`);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Local payment processed",
      });
    }

    // EVENTOS DE SUBSCRIPTION (charged_successfully/unsuccessfully)
    if (["subscription_charged_successfully", "subscription_charged_unsuccessfully"].includes(eventKind)) {
      const subscription = webhookNotification.subscription;

      if (subscription && subscription.transactions && subscription.transactions.length > 0) {
        const transaction = subscription.transactions[0];

        // Cria registro de revenue
        const revenueRow = {
          source: "braintree-api-revenue",
          date: transaction.createdAt.toISOString().split("T")[0],
          description: `${getPaymentMethod(transaction)} - ${getCustomerName(transaction)}`,
          amount: parseFloat(transaction.amount),
          reconciled: false,
          custom_data: {
            transaction_id: transaction.id,
            customer_name: getCustomerName(transaction),
            customer_email: transaction.customer?.email,
            currency: transaction.currencyIsoCode,
            payment_method: getPaymentMethod(transaction),
            subscription_id: transaction.subscriptionId,
            created_at: transaction.createdAt,
            webhook_received_at: new Date().toISOString(),
            webhook_kind: webhookNotification.kind,
            is_successful: eventKind.includes("successfully"),
          },
        };

        const { error: revenueError } = await supabaseAdmin
          .from("csv_rows")
          .insert(revenueRow);

        if (revenueError) {
          console.error("[Braintree Webhook] Erro ao salvar revenue:", revenueError);
        }

        // Se foi bem-sucedida, cria também a fee
        if (eventKind.includes("successfully")) {
          const feeAmount = calculateTransactionFee(transaction as BraintreeTransactionData);

          const feeRow = {
            source: "braintree-api-fees",
            file_name: `braintree-webhook-subfee-${transaction.id}.json`,
            date: transaction.createdAt.toISOString().split("T")[0],
            description: `Braintree Fee - ${transaction.id}`,
            amount: -Math.abs(feeAmount),
            reconciled: false,
            custom_data: {
              transaction_id: transaction.id,
              currency: transaction.currencyIsoCode,
              payment_method: getPaymentMethod(transaction),
              webhook_received_at: new Date().toISOString(),
            },
          };

          const { error: feeError } = await supabaseAdmin
            .from("csv_rows")
            .insert(feeRow);

          if (feeError) {
            console.error("[Braintree Webhook] Erro ao salvar fee:", feeError);
          }

          console.log(`[Braintree Webhook] Transação salva: ${transaction.id} (Revenue + Fee)`);
        } else {
          console.log(`[Braintree Webhook] Transação falhada salva: ${transaction.id} (sem fee)`);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Transaction saved",
      });
    }

    // EVENTO DE REFUND_FAILED
    if (eventKind === "refund_failed") {
      console.log(`[Braintree Webhook] Refund failed detectado - verificar manualmente`);

      return NextResponse.json({
        success: true,
        message: "Refund failed logged",
      });
    }

    // Default fallback
    return NextResponse.json({
      success: true,
      message: "Event processed",
    });

  } catch (error: unknown) {
    console.error("[Braintree Webhook] Error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: "Webhook processing failed", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Braintree Webhook Endpoint",
    status: "active",
    events: [
      // Transações diretas
      "transaction_authorized",
      "transaction_settlement_pending",
      "transaction_settled",
      "transaction_settlement_declined",
      "transaction_voided",
      "transaction_submitted_for_settlement",
      "transaction_failed",
      "transaction_gateway_rejected",

      // Subscription
      "subscription_charged_successfully",
      "subscription_charged_unsuccessfully",
      "subscription_canceled",
      "subscription_expired",
      "subscription_went_active",

      // Disbursement
      "disbursement",

      // Disputes
      "dispute_opened",
      "dispute_won",
      "dispute_lost",

      // Local Payments
      "local_payment_completed",
      "local_payment_reversed",
      "local_payment_funded",

      // Refunds
      "refund_failed",
    ],
  });
}
