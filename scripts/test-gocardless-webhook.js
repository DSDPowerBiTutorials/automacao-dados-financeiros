#!/usr/bin/env node

/**
 * Script para testar o webhook do GoCardless localmente
 * Uso: node scripts/test-gocardless-webhook.js
 */

import crypto from "crypto";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const WEBHOOK_SECRET = process.env.GOCARDLESS_WEBHOOK_SECRET || "test_secret";
const WEBHOOK_URL = process.env.WEBHOOK_URL || "http://localhost:3000/api/webhooks/gocardless";

/**
 * Cria uma assinatura válida para um payload
 */
function createSignature(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

/**
 * Exemplo: Evento de Payout Criado
 */
function createPayoutCreatedEvent(): object {
  return {
    type: "payout_created",
    id: `evt_${Date.now()}`,
    created_at: new Date().toISOString(),
    action: "payout_created",
    resourceType: "payout",
    links: {},
    payout: {
      id: `PM${Date.now()}`,
      created_at: new Date().toISOString(),
      status: "pending",
      reference: "PAYOUT-001",
      amount: 25000, // 250.00 GBP em centavos
      currency: "GBP",
      arrival_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      creditor_id: "CR123...",
    },
  };
}

/**
 * Exemplo: Evento de Payment Confirmado
 */
function createPaymentConfirmedEvent(): object {
  return {
    type: "payment_confirmed",
    id: `evt_${Date.now()}`,
    created_at: new Date().toISOString(),
    action: "payment_confirmed",
    resourceType: "payment",
    links: {},
    payment: {
      id: `PM${Date.now()}`,
      created_at: new Date().toISOString(),
      status: "pending_submission",
      reference: "INV-2024-001",
      amount: 5000, // 50.00 GBP em centavos
      currency: "GBP",
      charge_date: new Date().toISOString().split("T")[0],
      payout_id: `PM${Date.now() - 1000}`,
      customer_id: "CU123...",
      creditor_id: "CR123...",
      mandate_id: "MD123...",
    },
  };
}

/**
 * Exemplo: Evento de Refund
 */
function createRefundEvent(): object {
  return {
    type: "refund_refunded",
    id: `evt_${Date.now()}`,
    created_at: new Date().toISOString(),
    action: "refund_refunded",
    resourceType: "refund",
    links: {},
    refund: {
      id: `RF${Date.now()}`,
      created_at: new Date().toISOString(),
      status: "refunded",
      amount: 1000, // 10.00 GBP em centavos
      currency: "GBP",
      payment_id: `PM${Date.now() - 2000}`,
      creditor_id: "CR123...",
    },
  };
}

/**
 * Exemplo: Evento de Teste
 */
function createTestEvent(): object {
  return {
    type: "test.webhook_action_performed",
    id: `evt_test_${Date.now()}`,
    created_at: new Date().toISOString(),
    action: "test",
    resourceType: "test",
    links: {},
  };
}

/**
 * Envia um evento para o webhook
 */
async function sendWebhookEvent(eventPayload: object, eventName: string) {
  const payload = JSON.stringify(eventPayload);
  const signature = createSignature(payload, WEBHOOK_SECRET);

  console.log(`\n📤 Enviando evento: ${eventName}`);
  console.log(`   URL: ${WEBHOOK_URL}`);
  console.log(`   Payload size: ${payload.length} bytes`);
  console.log(`   Signature: ${signature.substring(0, 20)}...`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "webhook-signature": signature,
      },
      body: payload,
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ Sucesso (${response.status})`);
      console.log(`   Response:`, data);
    } else {
      console.error(`❌ Erro (${response.status})`);
      console.error(`   Response:`, data);
    }

    return response.ok;
  } catch (error) {
    console.error(`❌ Falha ao conectar:`, error);
    return false;
  }
}

/**
 * Teste de assinatura inválida
 */
async function testInvalidSignature() {
  const payload = JSON.stringify(createTestEvent());
  const invalidSignature = "invalid_signature_12345";

  console.log(`\n🔐 Testando assinatura inválida...`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "webhook-signature": invalidSignature,
      },
      body: payload,
    });

    const data = await response.json();

    if (response.status === 401) {
      console.log(`✅ Webhook rejeitou corretamente (401)`);
    } else {
      console.warn(`⚠️  Esperado 401, recebeu ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ Falha ao conectar:`, error);
  }
}

/**
 * Teste de payload ausente
 */
async function testMissingSignature() {
  const payload = JSON.stringify(createTestEvent());

  console.log(`\n🔐 Testando header de assinatura ausente...`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
    });

    const data = await response.json();

    if (response.status === 400) {
      console.log(`✅ Webhook rejeitou corretamente (400)`);
    } else {
      console.warn(`⚠️  Esperado 400, recebeu ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ Falha ao conectar:`, error);
  }
}

/**
 * Executar testes
 */
async function runTests() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║   GoCardless Webhook Test Suite        ║");
  console.log("╚════════════════════════════════════════╝");
  console.log(`\nWebhook URL: ${WEBHOOK_URL}`);
  console.log(`Secret: ${WEBHOOK_SECRET.substring(0, 10)}...`);

  const results: boolean[] = [];

  // Teste 1: Evento de Teste
  results.push(await sendWebhookEvent(createTestEvent(), "Test Event"));

  // Teste 2: Evento de Payout
  results.push(await sendWebhookEvent(createPayoutCreatedEvent(), "Payout Created"));

  // Teste 3: Evento de Payment
  results.push(await sendWebhookEvent(createPaymentConfirmedEvent(), "Payment Confirmed"));

  // Teste 4: Evento de Refund
  results.push(await sendWebhookEvent(createRefundEvent(), "Refund Refunded"));

  // Teste 5: Assinatura inválida
  await testInvalidSignature();

  // Teste 6: Header ausente
  await testMissingSignature();

  console.log("\n╔════════════════════════════════════════╗");
  console.log(
    `║  Resultado: ${results.filter((r) => r).length}/${results.length} eventos bem-sucedidos`
  );
  console.log("╚════════════════════════════════════════╝\n");
}

// Executar se chamado diretamente
runTests().catch(console.error);
