# 🔔 Webhook Braintree - Sincronização em Tempo Real

## ✅ O que foi implementado

### 1. Endpoint de Webhook
**URL:** `/api/braintree/webhook`

Recebe notificações automáticas do Braintree quando:
- ✅ Transação é confirmada (`transaction_settled`)
- ✅ Transação falha na liquidação (`transaction_settlement_declined`)
- ✅ Assinatura é cobrada (`subscription_charged_successfully`)

### 2. Verificação de Segurança
- ✅ Valida assinatura do webhook (garante que é realmente do Braintree)
- ✅ Evita duplicatas (verifica se transação já existe antes de salvar)
- ✅ Log de todos os eventos recebidos

### 3. Processamento Automático
Quando webhook é recebido:
1. Valida assinatura
2. Extrai dados da transação
3. Salva receita em `csv_rows` (source: `braintree-api-revenue`)
4. Salva fee em `csv_rows` (source: `braintree-api-fees`)
5. Dados aparecem **automaticamente** nas páginas

---

## 🚀 Como configurar (no painel do Braintree)

### Passo 1: Acessar configuração de Webhooks

1. Acesse: https://www.braintreegateway.com/merchants/[seu_merchant_id]/webhooks
2. Ou: **Settings** → **Webhooks** → **Add New Webhook**

### Passo 2: Configurar URL

**Destination URL:**
```
https://dsdfinancehub.com/api/braintree/webhook
```

### Passo 3: Selecionar eventos

Marque os seguintes eventos:

- ✅ `transaction_settled` (transação confirmada)
- ✅ `transaction_settlement_declined` (falha na liquidação)
- ✅ `subscription_charged_successfully` (assinatura cobrada)
- ✅ `subscription_charged_unsuccessfully` (falha na cobrança)

### Passo 4: Salvar

Clique em **"Create Webhook"**

### Passo 5: Testar

1. Clique em **"Send Test Notification"**
2. Escolha evento: `transaction_settled`
3. Clique em **"Send"**
4. Verifique se aparece em `/reports/braintree-eur` (ou USD/Amex)

---

## 🧪 Testar localmente (desenvolvimento)

### Opção 1: ngrok (túnel para localhost)

```bash
# Instalar ngrok
npm install -g ngrok

# Criar túnel
ngrok http 3000

# Copie a URL HTTPS gerada (ex: https://abc123.ngrok.io)
# Configure no Braintree: https://abc123.ngrok.io/api/braintree/webhook
```

### Opção 2: Usar webhook de teste do Braintree

No painel do Braintree, você pode enviar notificações de teste sem precisar túnel.

---

## 📊 Como verificar se está funcionando

### 1. Logs no terminal
```bash
# Deve aparecer quando webhook é recebido:
[Braintree Webhook] Received: transaction_settled for 2025-12-31T...
[Braintree Webhook] ✅ Transação abc123 processada: €150.00
```

### 2. Verificar no banco de dados

```sql
-- Transações recebidas via webhook
SELECT 
  date,
  description,
  amount,
  custom_data->>'webhook_kind' as webhook_event,
  custom_data->>'webhook_received_at' as received_at
FROM csv_rows
WHERE source = 'braintree-api-revenue'
  AND custom_data->>'webhook_kind' IS NOT NULL
ORDER BY date DESC
LIMIT 10;
```

### 3. Ver nas páginas

- Acesse: `/reports/braintree-eur`
- Transações devem aparecer automaticamente após webhook

---

## 🔧 Troubleshooting

### Webhook não está sendo recebido

**1. Verificar URL configurada no Braintree**
- Deve ser: `https://dsdfinancehub.com/api/braintree/webhook`
- Não usar: `http://` ou `localhost`

**2. Verificar se domínio está acessível**
```bash
curl -I https://dsdfinancehub.com/api/braintree/webhook
# Deve retornar 200 ou 405 (Method Not Allowed é OK para GET)
```

**3. Ver logs de erro no Braintree**
- Painel do Braintree → Webhooks → Ver detalhes do webhook
- Mostra tentativas, erros HTTP, etc.

### Erro "Invalid webhook signature"

- Credenciais do `.env.local` estão corretas?
- Ambiente está correto (sandbox vs production)?
- Webhook foi enviado para o ambiente certo?

### Transações duplicadas

O sistema já tem proteção contra duplicatas, mas se ocorrer:

```sql
-- Ver duplicatas
SELECT 
  custom_data->>'transaction_id' as transaction_id,
  COUNT(*) as count
FROM csv_rows
WHERE source = 'braintree-api-revenue'
GROUP BY custom_data->>'transaction_id'
HAVING COUNT(*) > 1;

-- Deletar duplicatas (mantém a primeira)
DELETE FROM csv_rows
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY custom_data->>'transaction_id' 
             ORDER BY created_at ASC
           ) as rn
    FROM csv_rows
    WHERE source = 'braintree-api-revenue'
  ) t
  WHERE t.rn > 1
);
```

---

## 🎯 Diferença: Webhook vs Sincronização Manual

| Aspecto | Webhook (Tempo Real) | Sincronização Manual |
|---------|---------------------|---------------------|
| **Quando?** | Automático (quando transação ocorre) | Manual (clica no botão) |
| **Delay** | ~1-2 segundos | Precisa rodar manualmente |
| **Uso** | Produção (recomendado) | Backup / histórico |
| **Setup** | Configurar no Braintree | Só usar o botão |

**Recomendação:** Use **webhook para tempo real** + sincronização manual ocasional para garantir que nada foi perdido.

---

## 📅 Próximos passos

### Agora que webhook está configurado:

1. ✅ **Configurar webhook no Braintree** (seguir passos acima)
2. ✅ **Testar com notificação de teste**
3. ✅ **Processar transação real** (fazer pagamento teste)
4. ✅ **Verificar se aparece automaticamente** nas páginas

### Opcional (melhorias futuras):

- 📧 Email notification quando transação é recebida
- 📊 Dashboard com estatísticas de webhooks recebidos
- 🔄 Retry automático se webhook falhar
- 📝 Log de todos os webhooks em tabela separada

---

## 🔗 Links de Referência

- [Braintree Webhooks Docs](https://developer.paypal.com/braintree/docs/guides/webhooks)
- [Webhook Events](https://developer.paypal.com/braintree/docs/guides/webhooks/overview)
- [Testing Webhooks](https://developer.paypal.com/braintree/docs/guides/webhooks/testing-go-live)

---

**Status:** ✅ Webhook implementado e pronto para configurar no Braintree
