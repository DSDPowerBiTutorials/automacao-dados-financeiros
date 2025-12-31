# GoCardless Webhook Configuration

## Overview

O webhook do GoCardless permite receber notificações em tempo real quando eventos ocorrem (payouts, payments, refunds, mandates). 

**Endpoint**: `https://dsdfinancehub.com/api/webhooks/gocardless`

## Configuração

### 1. Obter o Webhook Secret

1. Acesse [GoCardless Dashboard](https://manage.gocardless.com)
2. Vá para **Settings** → **Webhooks**
3. Clique em **Add Endpoint**
4. Cole a URL: `https://dsdfinancehub.com/api/webhooks/gocardless`
5. **Importante**: O GoCardless vai exibir o secret apenas uma vez. Copie e guarde com segurança.

### 2. Configurar Variável de Ambiente

No arquivo `.env.local`, adicione:

```env
GOCARDLESS_WEBHOOK_SECRET=your_secret_here
```

**Exemplo** (com secret fictício):
```env
GOCARDLESS_WEBHOOK_SECRET=whsec_abcdef123456789
```

### 3. Selecionar Eventos de Interesse

No dashboard do GoCardless, selecione os seguintes eventos:
- ✅ `payout_created`
- ✅ `payout_paid`
- ✅ `payout_failed`
- ✅ `payment_created`
- ✅ `payment_submitted`
- ✅ `payment_confirmed`
- ✅ `payment_paid_out`
- ✅ `payment_failed`
- ✅ `payment_cancelled`
- ✅ `refund_created`
- ✅ `refund_refunded`
- ✅ `refund_failed`
- ✅ `mandate_created`
- ✅ `mandate_active`
- ✅ `mandate_cancelled`

### 4. Testar o Webhook

No dashboard do GoCardless, você pode enviar um evento de teste:
- Clique em **Send Test** no endpoint criado
- Verifique os logs no Vercel para confirmar que foi recebido

## Estrutura de Dados

### Armazenamento no Supabase

Todos os eventos são armazenados na tabela `csv_rows` com:

```typescript
{
  source: "gocardless",
  date: string,                    // Data do evento
  description: string,              // Descrição legível
  amount: string,                   // Valor em unidades (euros, libras, etc)
  reconciled: boolean,             // true se confirmado/pago
  custom_data: {
    type: "payout" | "payment" | "refund" | "mandate",
    payout_id?: string,
    payment_id?: string,
    refund_id?: string,
    mandate_id?: string,
    status: string,                // Última ação
    gocardless_event_id: string,   // ID único do evento
    webhook_received_at: string,   // ISO timestamp
    ...                            // Outros dados específicos
  }
}
```

### Tipos de Eventos Processados

#### 1. **Payout Events**
- `payout_created` → Novo payout criado (status: pending)
- `payout_paid` → Payout confirmado (reconciled: true)
- `payout_failed` → Payout falhou

```json
{
  "custom_data": {
    "type": "payout",
    "payout_id": "PM123...",
    "status": "payout_paid",
    "currency": "GBP",
    "amount_cents": 250000
  }
}
```

#### 2. **Payment Events**
- `payment_created` → Nova cobrança
- `payment_confirmed` → Confirmada
- `payment_paid_out` → Distribuída para payout
- `payment_failed` → Falhou
- `payment_cancelled` → Cancelada

```json
{
  "custom_data": {
    "type": "payment",
    "payment_id": "PM456...",
    "status": "payment_confirmed",
    "amount_cents": 50000,
    "charge_date": "2024-01-15",
    "reference": "INV-001"
  }
}
```

#### 3. **Refund Events**
- `refund_created` → Reembolso criado
- `refund_refunded` → Reembolso processado
- `refund_failed` → Reembolso falhou

```json
{
  "custom_data": {
    "type": "refund",
    "refund_id": "RF789...",
    "status": "refund_refunded",
    "amount_cents": 10000,
    "payment_id": "PM456..."
  }
}
```

#### 4. **Mandate Events**
- `mandate_created` → Novo mandato
- `mandate_active` → Ativo
- `mandate_cancelled` → Cancelado
- Esses apenas são logados para auditoria

## Segurança

### Validação de Assinatura

O webhook valida a assinatura HMAC-SHA256 usando:
1. Raw body do request
2. Header `webhook-signature` enviado pelo GoCardless
3. Secret armazenado em `GOCARDLESS_WEBHOOK_SECRET`

```typescript
// Verificação no código:
const hash = crypto
  .createHmac("sha256", secret)
  .update(payload)
  .digest("hex");

const isValid = hash === signature;
```

### Headers de Segurança

- ✅ Valida assinatura em todos os requests
- ✅ Retorna 401 Unauthorized se inválido
- ✅ Logs de acesso não autorizado

## Troubleshooting

### Webhook não está recebendo eventos

1. Verifique se a URL está correta em GoCardless Dashboard
2. Confirme que `GOCARDLESS_WEBHOOK_SECRET` está configurado
3. Teste com o botão "Send Test" no dashboard
4. Verifique os logs do Vercel em **Deployments** → **Function Logs**

### Erro: "Invalid webhook signature"

1. Confirme que o secret em `.env.local` é exatamente o do GoCardless
2. Tente obter um novo secret se perdeu o original
3. Redeploy para Vercel com o novo secret

### Dados não aparecem no Dashboard

1. Verifique se as transações foram inseridas em `csv_rows`
2. Use o Supabase Dashboard para verificar a tabela
3. Procure por registros com `source = 'gocardless'`
4. Verifique se o `date` está no formato correto (YYYY-MM-DD)

## Logs

Os eventos são registrados com o prefixo `[GoCardless Webhook]`:

```
[GoCardless Webhook] Received event: payment_confirmed (ID: evt_123...)
[GoCardless Webhook] Payment PM456 atualizado como payment_confirmed
```

Verifique os logs:
- **Local**: `npm run dev` no terminal
- **Vercel**: Vá para **Deployments** → **Function Logs**

## Próximos Passos

1. ✅ Deploy da função webhook para Vercel
2. ✅ Configuração do webhook secret em `.env.local` (production)
3. ✅ Teste com evento de teste no GoCardless Dashboard
4. ✅ Monitorar os logs de eventos em tempo real

---

**Última atualização**: $(date)
**Status**: ✅ Webhook implementado e pronto para configuração
