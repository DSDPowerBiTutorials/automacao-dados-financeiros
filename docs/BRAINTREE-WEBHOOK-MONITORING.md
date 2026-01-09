# Monitoramento de Webhook Braintree

## Como verificar se o Webhook está funcionando

### 1. **Verificar configuração no Braintree Dashboard**

1. Acesse: https://sandbox.braintreegateway.com (ou production)
2. Vá em: **Settings → Webhooks**
3. Verifique se a URL está configurada corretamente:
   ```
   https://seu-dominio.vercel.app/api/braintree/webhook
   ```
4. Status deve estar: **✅ Active**

### 2. **Testar Webhook Manualmente**

No Braintree Dashboard:
1. **Settings → Webhooks → [Seu Webhook]**
2. Clique em **"Test"**
3. Selecione um evento (ex: `transaction_settled`)
4. Clique em **"Send Test"**
5. Veja o log no Vercel em tempo real

### 3. **Monitorar Logs do Vercel**

**Tempo Real:**
```bash
# No terminal local (requer Vercel CLI)
vercel logs --follow
```

**No Dashboard:**
1. Acesse: https://vercel.com/seu-projeto/logs
2. Filtro: `/api/braintree/webhook`
3. Deve ver logs como:
   ```
   [Braintree Webhook] Evento recebido: transaction_settled
   [Braintree Webhook] Transação direta salva: abc123
   ```

### 4. **Verificar Última Atualização no Banco**

Execute no Supabase SQL Editor:

```sql
-- Última transação recebida via webhook
SELECT 
  date,
  description,
  amount,
  custom_data->>'webhook_received_at' as webhook_time,
  created_at
FROM csv_rows
WHERE source = 'braintree-api-revenue'
  AND custom_data->>'webhook_received_at' IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

Se `webhook_received_at` não está vazio → **Webhook está funcionando!**

### 5. **Testar Transação Real**

1. Faça uma transação teste no Braintree (cartão de teste)
2. Aguarde **2-3 minutos** (tempo de settlement)
3. Verifique se apareceu automaticamente na página `/reports/braintree-eur`
4. Se aparecer **SEM clicar em nenhum botão** → **Webhook OK!**

---

## Botões de Sync - Quando Usar

### 🔄 **Carga Inicial**
- **Quando:** Primeira vez configurando o sistema
- **O que faz:** Busca TODAS as transações históricas desde uma data específica
- **Duplicatas:** Ignoradas automaticamente
- **Exemplo:** "Buscar todas as transações de 2024"

### ⚡ **Atualizar (Incremental)**
- **Quando:** Webhook parou de funcionar temporariamente
- **O que faz:** Busca apenas últimos 30 dias
- **Duplicatas:** Ignoradas automaticamente
- **Exemplo:** "Webhook ficou offline por 2 dias, buscar manualmente"

### 🔄 **Recarregar**
- **Quando:** Quer ver dados mais recentes na tela
- **O que faz:** Re-fetch do banco de dados (NÃO busca API Braintree)
- **Uso:** Apenas refresh da página, sem sync

### 🗑️ **Deletar Tudo**
- **Quando:** Quer limpar e recomeçar do zero
- **O que faz:** Deleta TODOS os dados Braintree EUR
- **Cuidado:** Não tem desfazer! Você precisará rodar "Carga Inicial" depois

---

## Fluxo Ideal de Trabalho

### **Setup Inicial (Uma vez apenas)**
1. Configure Webhook no Braintree Dashboard
2. Clique em **"Carga Inicial"**
3. Selecione período (ex: 01/01/2024 até hoje)
4. Aguarde sincronização (pode levar minutos para milhares de transações)
5. ✅ Pronto! Webhook cuidará de novas transações automaticamente

### **Operação Diária (Automática)**
- **Webhook detecta nova transação** → Insere automaticamente
- **Webhook detecta refund** → Atualiza status
- **Webhook detecta dispute** → Marca na transação
- **Você não precisa fazer nada!**

### **Quando Webhook Falha (Raro)**
1. Percebe que dados não estão atualizados
2. Clique em **"Atualizar"** (últimos 30 dias)
3. Sistema busca e insere apenas o que está faltando

---

## Indicadores de Saúde do Webhook

### ✅ **Webhook Funcionando**
- Transações aparecem automaticamente (1-3 min após settlement)
- Logs do Vercel mostram: `[Braintree Webhook] Evento recebido`
- Campo `custom_data->>'webhook_received_at'` preenchido

### ⚠️ **Webhook com Problemas**
- Transações não aparecem automaticamente
- Logs do Vercel vazios (nenhuma chamada em `/api/braintree/webhook`)
- Precisa clicar em "Atualizar" todo dia

### 🔧 **Solução para Webhook Quebrado**
1. Verifique URL no Braintree Dashboard
2. Verifique se domínio está correto (não localhost!)
3. Teste manualmente no Dashboard Braintree
4. Verifique logs de erro no Vercel
5. Se necessário, delete e recrie o webhook

---

## FAQ

**P: Quanto tempo demora para transação aparecer?**
R: 2-5 minutos após settlement (não é instantâneo no Braintree)

**P: Posso rodar Carga Inicial várias vezes?**
R: Sim! Duplicatas são ignoradas automaticamente

**P: O que acontece se Webhook e API buscarem a mesma transação?**
R: Nada! Sistema detecta duplicata pelo `transaction_id` e ignora

**P: Preciso rodar "Atualizar" todo dia?**
R: NÃO! Apenas se webhook estiver quebrado

**P: Como saber se estou perdendo transações?**
R: Compare total no Braintree Dashboard vs total na página. Se diferença > 5%, rode "Atualizar"

---

## Logs para Debug

### Ver transações mais recentes:
```sql
SELECT 
  date,
  description,
  amount,
  custom_data->>'transaction_id' as tx_id,
  custom_data->>'webhook_received_at' as via_webhook,
  created_at
FROM csv_rows
WHERE source = 'braintree-api-revenue'
ORDER BY created_at DESC
LIMIT 20;
```

### Contar transações por fonte:
```sql
SELECT 
  CASE 
    WHEN custom_data->>'webhook_received_at' IS NOT NULL THEN 'Via Webhook'
    ELSE 'Via API Sync'
  END as origem,
  COUNT(*) as total,
  SUM(amount) as total_amount
FROM csv_rows
WHERE source = 'braintree-api-revenue'
GROUP BY origem;
```

### Verificar duplicatas (não deve ter):
```sql
SELECT 
  custom_data->>'transaction_id' as tx_id,
  COUNT(*) as count
FROM csv_rows
WHERE source = 'braintree-api-revenue'
GROUP BY custom_data->>'transaction_id'
HAVING COUNT(*) > 1;
```

Se retornar linhas → tem duplicatas! Use "Deletar Tudo" + "Carga Inicial"
