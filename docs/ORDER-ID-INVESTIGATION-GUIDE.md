# 🔍 Investigação: Order ID "ba29374" Não Encontrado

## ❓ **Problema**
Query SQL não retornou resultados para `order_id = 'ba29374'`

## 🔎 **Possíveis Causas**

### 1. **Order ID não está sendo enviado pelo Braintree**
- Campo `orderId` pode estar vazio na resposta da API
- Braintree pode não ter esse campo preenchido

### 2. **"ba29374" não é um Order ID**
- Pode ser um `transaction_id` (ID interno do Braintree)
- Pode ser outro tipo de referência

### 3. **Formato diferente**
- Order ID pode ter prefixo/sufixo: `ORDER-ba29374`, `ba29374-1`
- Pode estar em outro campo do `custom_data`

## 📊 **Próximos Passos para Investigar**

### **Execute estas queries no Supabase:**

```sql
-- 1️⃣ Ver EXEMPLOS de order_id que existem (últimas 20 transações)
SELECT 
  custom_data->>'order_id' as order_id,
  custom_data->>'transaction_id' as transaction_id,
  date, amount
FROM csv_rows
WHERE source = 'braintree-api-revenue'
  AND custom_data->>'order_id' IS NOT NULL
ORDER BY date DESC LIMIT 20;
```

```sql
-- 2️⃣ Buscar "ba29374" em QUALQUER lugar do custom_data
SELECT 
  id, date, amount,
  custom_data->>'transaction_id' as transaction_id,
  custom_data->>'order_id' as order_id,
  substring(custom_data::text, 1, 300) as preview
FROM csv_rows
WHERE source = 'braintree-api-revenue'
  AND custom_data::text LIKE '%ba29374%'
ORDER BY date DESC LIMIT 10;
```

```sql
-- 3️⃣ Estatísticas: Quantas transações TÊM order_id preenchido?
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN custom_data->>'order_id' IS NOT NULL THEN 1 END) as com_order_id,
  ROUND(100.0 * COUNT(CASE WHEN custom_data->>'order_id' IS NOT NULL THEN 1 END) / COUNT(*), 2) as percentual
FROM csv_rows
WHERE source = 'braintree-api-revenue';
```

## 🎯 **Interpretação dos Resultados**

### **Se Query 1 retornar dados:**
✅ Order IDs existem → "ba29374" não está no sistema ou tem formato diferente

### **Se Query 1 NÃO retornar dados:**
❌ Order IDs NÃO estão sendo capturados → Problema na integração Braintree

### **Se Query 2 encontrar "ba29374":**
🔍 Está em outro campo (não `order_id`) → Identificar onde está

### **Se Query 3 mostrar 0% com order_id:**
⚠️ **Braintree não está enviando `orderId`** → Verificar:
1. Configuração do gateway Braintree
2. Se transações foram criadas COM order_id na origem
3. Logs do webhook/sync

## 🔧 **Como Verificar no Braintree Dashboard**

1. Acesse: https://www.braintreegateway.com/
2. Vá em **Transactions**
3. Busque por `ba29374`
4. Verifique se há campo **"Order ID"** preenchido

## ✅ **O Que Fazer Depois**

**Se order_id não está sendo capturado:**
- Verificar se Braintree está configurado para incluir `orderId`
- Verificar se vendas antigas foram criadas sem order_id
- Implementar backfill para adicionar order_id retroativamente

**Se "ba29374" for transaction_id:**
- Usar campo correto na busca: `custom_data->>'transaction_id'`
- Confirmar com backend de vendas qual ID eles geram

---

**Execute as 3 queries acima e me envie os resultados.** 📊
