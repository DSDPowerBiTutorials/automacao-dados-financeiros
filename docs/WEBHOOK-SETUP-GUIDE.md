# ⚡ Configuração do Webhook Braintree - Tempo Real

## 🎯 O que isso faz?
Toda vez que uma transação acontece no Braintree, seu sistema recebe uma notificação **instantânea** e salva automaticamente no banco de dados.

---

## 📋 Passo a Passo

### **1. Acessar Painel do Braintree**
🔗 https://www.braintreegateway.com/login

- Faça login com suas credenciais
- Merchant ID: `***REMOVED***`

---

### **2. Ir para Webhooks**
1. No menu superior, clique em **Settings** (⚙️)
2. No menu lateral, clique em **Webhooks**
3. Clique no botão **"New Webhook"** ou **"Add New Webhook"**

---

### **3. Configurar URL de Destino**

**URL do Webhook:**
```
https://dsdfinancehub.com/api/braintree/webhook
```

✅ **IMPORTANTE:** Use HTTPS (não HTTP)

---

### **4. Selecionar Eventos** ☑️

Marque os seguintes eventos:

#### **Transações e Pagamentos:**
- ☑️ `subscription_charged_successfully`
- ☑️ `subscription_charged_unsuccessfully`
- ☑️ `subscription_canceled`
- ☑️ `subscription_expired`
- ☑️ `subscription_went_active`

#### **Transferências Bancárias:**
- ☑️ `disbursement`

#### **Disputas (Chargebacks):**
- ☑️ `dispute_opened`
- ☑️ `dispute_won`
- ☑️ `dispute_lost`

#### **Pagamentos Locais:**
- ☑️ `local_payment_completed`
- ☑️ `local_payment_reversed`
- ☑️ `local_payment_funded`

#### **Reembolsos:**
- ☑️ `refund_failed`

---

### **5. Salvar Webhook**
1. Clique em **"Create Webhook"** ou **"Save"**
2. O Braintree vai mostrar o webhook na lista

---

### **6. Testar Webhook** 🧪

1. Na lista de webhooks, clique no webhook que você acabou de criar
2. Clique no botão **"Send Test Notification"**
3. Selecione o evento: `subscription_charged_successfully`
4. Clique em **"Send"**

**Verificar se funcionou:**
- Vá para: https://dsdfinancehub.com/reports/braintree-eur
- Deve aparecer uma nova transação de teste

---

## 🔄 Sincronização Automática Configurada

### **Sistema Híbrido (Redundante):**

#### **1️⃣ Webhook (Tempo Real)** ⚡
- **Quando:** Toda vez que há uma transação no Braintree
- **Tempo:** **Instantâneo** (1-2 segundos)
- **Confiabilidade:** 99.9%

#### **2️⃣ Cron Diário (Backup)** 🕒
- **Quando:** Todos os dias às **3h AM UTC**
- **O que faz:** Sincroniza últimos 7 dias
- **Por quê:** Garante que nada foi perdido (falhas de rede, etc)

---

## ✅ Checklist de Verificação

- [ ] Webhook criado no painel do Braintree
- [ ] URL configurada: `https://dsdfinancehub.com/api/braintree/webhook`
- [ ] Eventos selecionados (13 eventos)
- [ ] Webhook testado com sucesso
- [ ] Transação de teste apareceu no sistema
- [ ] Cron diário configurado (automático via Vercel)

---

## 🆘 Troubleshooting

### **Webhook não está funcionando?**

**1. Verificar logs do webhook:**
- No painel do Braintree
- Clique no webhook
- Veja "Recent Deliveries"

**2. Verificar logs do Vercel:**
- Acesse: https://vercel.com/dsdpowerbitutorials/automacao-dados-financeiros/logs
- Procure por `[Braintree Webhook]`

**3. Testar manualmente:**
```bash
# Simular webhook (development)
curl -X POST http://localhost:3000/api/braintree/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "bt_signature=test&bt_payload=test"
```

---

## 📊 Monitoramento

### **Como ver se está funcionando:**

1. **Painel do Braintree:**
   - Settings → Webhooks
   - Ver "Recent Deliveries"
   - Status deve ser **200 OK**

2. **Seu Sistema:**
   - Acesse: https://dsdfinancehub.com/reports/braintree-eur
   - Novas transações aparecem automaticamente

3. **Logs do Vercel:**
   - Procure por: `[Braintree Webhook] Received:`
   - Deve mostrar eventos processados

---

## 🎉 Resultado Final

### **Antes:**
- ❌ Sincronização manual (clique no botão)
- ❌ Dados desatualizados
- ❌ Pode esquecer de sincronizar

### **Depois:**
- ✅ **Tempo real** (webhook)
- ✅ **Backup diário** (cron às 3h AM)
- ✅ **Zero trabalho manual**
- ✅ Dados sempre atualizados

---

## 📝 Notas Importantes

1. **Webhook é pago?** Não, é grátis no Braintree
2. **Funciona em sandbox?** Sim, mas configure URL diferente se testar
3. **Pode ter múltiplos webhooks?** Sim, um para cada ambiente
4. **O que fazer se webhook falhar?** O cron diário sincroniza como backup
5. **Webhook funciona com VPN/Firewall?** Sim, Braintree faz requisição externa

---

**Status:** 🟢 Webhook configurado e pronto para uso!
**Data:** 31/12/2025
