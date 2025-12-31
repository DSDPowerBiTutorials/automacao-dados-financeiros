# ⚡ Webhook GoCardless - Configuração Rápida

## Status: ✅ Implementado e Pronto para Uso

O webhook do GoCardless foi implementado com sucesso! Agora o sistema pode receber notificações em tempo real quando:
- ✅ Novos payouts são criados
- ✅ Payments são confirmados
- ✅ Refunds são processados
- ✅ Mandates são criados/cancelados

---

## 🚀 Próximos Passos (3 minutos)

### 1️⃣ Obter o Webhook Secret

```
Acesse: https://manage.gocardless.com
  └─ Settings > Webhooks (seção Developers)
     └─ Clique em "Add Endpoint"
        └─ Cole URL: https://dsdfinancehub.com/api/webhooks/gocardless
           └─ Clique "Create"
              └─ **Copie o secret mostrado (aparece apenas uma vez!)**
```

**⚠️ Importante**: O GoCardless mostra o secret uma única vez. Salve em um lugar seguro.

### 2️⃣ Configurar Secret Localmente

Abra um terminal e execute:

```bash
node scripts/setup-gocardless-webhook.js whsec_seu_secret_aqui
```

Exemplo:
```bash
node scripts/setup-gocardless-webhook.js whsec_abc123def456xyz
```

Isso vai atualizar o `.env.local` automaticamente.

### 3️⃣ Testar Localmente

```bash
npm run dev
# Em outro terminal:
node scripts/test-gocardless-webhook.js
```

Você deve ver:
```
✅ Test Event (200)
✅ Payout Created (200)  
✅ Payment Confirmed (200)
✅ Refund Refunded (200)
✅ Invalid Signature Rejected (401)
✅ Missing Signature Rejected (400)
```

### 4️⃣ Deploy e Produção

```bash
git push origin main
# Aguarde o deploy do Vercel
```

Verifique os logs em: **Vercel Dashboard > Deployments > Function Logs**

### 5️⃣ Ativar no GoCardless

1. Volte ao GoCardless Dashboard
2. Selecione seu webhook endpoint
3. Marque os eventos que quer receber:
   - ✅ `payout_created`, `payout_paid`
   - ✅ `payment_created`, `payment_confirmed`, `payment_paid_out`
   - ✅ `refund_created`, `refund_refunded`
   - ✅ `mandate_created`, `mandate_active`, `mandate_cancelled`

4. **Teste**: Clique em "Send Test" no dashboard
5. **Verifique**: Logs do Vercel devem mostrar a confirmação

---

## 📝 Arquivos Criados

```
/src/app/api/webhooks/gocardless/route.ts
├─ POST endpoint para receber webhooks
├─ Validação de assinatura HMAC-SHA256
└─ Processamento de eventos (payout, payment, refund, mandate)

/docs/GOCARDLESS-WEBHOOK-SETUP.md
└─ Documentação detalhada completa

/scripts/test-gocardless-webhook.js
├─ Testa o webhook localmente
├─ Simula eventos do GoCardless
└─ Valida assinatura e resposta

/scripts/setup-gocardless-webhook.js
└─ Configura o secret automaticamente

/scripts/gocardless-webhook-setup-guide.js
└─ Guia interativo visual
```

---

## 🔐 Segurança

- ✅ **Assinatura HMAC-SHA256**: Cada webhook é assinado
- ✅ **Validação obrigatória**: Retorna `401 Unauthorized` se inválido
- ✅ **Secret nunca exposto**: Armazenado em `GOCARDLESS_WEBHOOK_SECRET` 
- ✅ **HTTPS obrigatório**: Só funciona com HTTPS em produção

---

## 🧪 Testando com cURL (Manual)

Se quiser testar manualmente:

```bash
#!/bin/bash
SECRET="seu_secret_aqui"
PAYLOAD='{"type":"test.webhook_action_performed","id":"evt_test_123"}'

SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | cut -d' ' -f2)

curl -X POST https://dsdfinancehub.com/api/webhooks/gocardless \
  -H "Content-Type: application/json" \
  -H "webhook-signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

---

## 📊 Como Funciona

```
GoCardless Webhook Event
    ↓
API recebe em /api/webhooks/gocardless
    ↓
Valida assinatura HMAC-SHA256
    ↓
Roteia para handler correto (payout/payment/refund/mandate)
    ↓
Insere/atualiza em csv_rows com custom_data
    ↓
Retorna 200 OK ao GoCardless
    ↓
Dashboard mostra dados em tempo real
```

---

## 🆘 Troubleshooting

### Webhook não está recebendo eventos

1. Verifique se a URL está correta no GoCardless Dashboard
   - Deve ser: `https://dsdfinancehub.com/api/webhooks/gocardless`

2. Confirme que `GOCARDLESS_WEBHOOK_SECRET` está configurado
   ```bash
   grep GOCARDLESS_WEBHOOK_SECRET .env.local
   ```

3. Teste com "Send Test" no GoCardless Dashboard

4. Verifique os logs do Vercel

### "Invalid webhook signature"

- Confirm o secret está exatamente igual ao do GoCardless
- Se perdeu o secret, crie um novo no GoCardless Dashboard
- Re-execute: `node scripts/setup-gocardless-webhook.js novo_secret`

### Dados não aparecem no Dashboard

1. Abra Supabase Dashboard
2. Vá para `csv_rows` table
3. Procure por registros com `source = 'gocardless'`
4. Verifique se o `date` está em formato YYYY-MM-DD

---

## 📈 O Que Acontece Agora

✅ **Antes**: Dados do GoCardless apenas via cron (1x por dia)
✅ **Depois**: Dados em tempo real quando eventos ocorrem

### Fluxo de Dados

```
Real-time Events          Backup Daily Sync
(via webhook)             (via cron - 3 AM UTC)
     ↓                           ↓
  Webhook                    POST /api/cron/gocardless
     ↓                           ↓
  /api/webhooks/gocardless      Ambos atualizam
     ↓                           ↓
  Supabase csv_rows ←───────────┘
     ↓
  Dashboard atualiza automaticamente
```

---

## 🎉 Resultado Final

Agora o sistema tem:
- ✅ Sync manual via botão no dashboard
- ✅ Sync automático diário via cron (3 AM UTC)
- ✅ **Sync em tempo real via webhook** ← NOVO!

Qualquer transação do GoCardless é sincronizada em segundos!

---

## 📚 Referências

- [GoCardless API Docs](https://developer.gocardless.com/api-reference)
- [GoCardless Webhooks](https://developer.gocardless.com/getting-started/webhooks)
- Documentação completa: [GOCARDLESS-WEBHOOK-SETUP.md](./GOCARDLESS-WEBHOOK-SETUP.md)

---

**Última atualização**: 2024
**Status**: ✅ Pronto para produção
