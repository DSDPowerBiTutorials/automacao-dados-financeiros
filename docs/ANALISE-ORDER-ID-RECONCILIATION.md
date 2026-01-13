# 📊 Análise: Order ID e Reconciliação Persistente

## ✅ **1. ORDER ID JÁ EXISTE**

### **Status Atual:**
- ✅ `order_id` já está mapeado em `custom_data`
- ✅ Campo exibido na interface (coluna "Order ID")
- ✅ Vinculado ao HubSpot via `order_code`

### **Exemplo de Dados:**
```typescript
{
  transaction_id: "abc123",
  order_id: "ba29374",        // ← Código do backend de vendas
  customer_name: "João Silva",
  amount: 100.00
}
```

### **Para Verificar no Supabase:**
Execute: [`docs/QUERY-ORDER-ID-EXAMPLE.sql`](QUERY-ORDER-ID-EXAMPLE.sql)

```sql
SELECT 
  custom_data->>'order_id' as order_id,
  custom_data->>'transaction_id' as transaction_id
FROM csv_rows
WHERE source = 'braintree-api-revenue'
  AND custom_data->>'order_id' = 'ba29374';
```

---

## ⚠️ **2. PROBLEMA: RECONCILIAÇÃO RODA SEMPRE**

### **Comportamento Atual:**
1. Usuário entra na página → `loadData()` executa
2. `reconcileWithBank()` roda **TODA VEZ**
3. Processa 10.000+ transações novamente (lento)
4. Salva no banco, mas **não verifica se já foi feito**

### **Causa Raiz:**
```typescript
// src/app/reports/braintree-eur/page.tsx (linha ~1120)
if (runReconcile && ENABLE_AUTO_RECONCILIATION && !isReconciling) {
  const reconciliationResult = await reconcileWithBank(...);
  // ❌ Sempre executa, mesmo para transações já reconciliadas
}
```

---

## ✅ **SOLUÇÃO: RECONCILIAÇÃO INTELIGENTE**

### **Mudança 1: Verificar Antes de Reconciliar**

```typescript
// Filtrar apenas transações NÃO reconciliadas
const unreconciled = mappedRows.filter(row => !row.conciliado);

if (unreconciled.length > 0 && runReconcile && ENABLE_AUTO_RECONCILIATION) {
  console.log(`[Braintree EUR] Reconciling ${unreconciled.length} unreconciled transactions...`);
  
  const reconciliationResult = await reconcileWithBank(
    unreconciled,  // ← Apenas não-reconciliadas
    'bankinter-eur',
    'Bankinter EUR'
  );
  
  // Merge: reconciliadas + já-reconciliadas-antes
  const allRows = [
    ...reconciliationResult.transactions,
    ...mappedRows.filter(row => row.conciliado)
  ];
  
  setRows(allRows);
} else {
  console.log(`[Braintree EUR] All ${mappedRows.length} transactions already reconciled`);
  setRows(mappedRows);
}
```

### **Mudança 2: Atualizar `reconciled` na Tabela**

```typescript
// src/lib/braintree-reconciliation.ts (já implementado parcialmente)
const { error } = await supabase
  .from("csv_rows")
  .update({
    reconciled: true,  // ← Marcar como reconciliado
    custom_data: {
      ...tx,
      conciliado: true,
      reconciliationType: 'automatic',
      bank_match_id: tx.bank_match_id,
      // ... outros campos
    }
  })
  .eq("id", tx.id);
```

### **Mudança 3: Índice para Performance**

```sql
-- Já criado em FIX-PERFORMANCE-INDEXES.sql
CREATE INDEX idx_csv_rows_reconciled 
ON csv_rows(source, reconciled) 
WHERE reconciled = false;
```

---

## 📊 **RESULTADO ESPERADO**

### **Antes:**
- ⏱️ Carregamento: 20 segundos (timeout)
- 🔄 Processa 10.000+ transações **toda vez**
- 💾 Salva no banco, mas re-processa sempre

### **Depois:**
- ⚡ Carregamento: 1-2 segundos
- 🎯 Processa apenas **novas transações** (não-reconciliadas)
- ✅ Carrega transações já reconciliadas direto do banco

### **Exemplo:**
```
Primeira vez:
- 10.000 transações → reconcilia 9.500 → salva no banco

Segunda vez (próximo acesso):
- 9.500 já reconciliadas → skip
- 500 novas → reconcilia apenas essas
- Total: 1-2 segundos (vs 20 segundos antes)
```

---

## 🔧 **IMPLEMENTAÇÃO**

### **Arquivos a Editar:**

1. **`src/app/reports/braintree-eur/page.tsx`**
   - Linha ~1120: Filtrar `unreconciled` antes de reconciliar
   - Merge de resultados (reconciliadas + já-reconciliadas)

2. **`src/lib/braintree-reconciliation.ts`**
   - Linha ~170: Atualizar `reconciled: true` no banco
   - Já está parcialmente implementado

3. **Índice SQL**
   - ✅ Já criado: `idx_csv_rows_reconciled`

---

## ✅ **ORDER ID: COMO USAR**

### **Na Interface:**
- ✅ Coluna "Order ID" já visível (se selecionada)
- ✅ Tooltip mostra `order_id` completo
- ✅ Link para HubSpot (se vinculado)

### **Para Buscar Transações por Order ID:**

**No código:**
```typescript
const row = rows.find(r => r.order_id === 'ba29374');
```

**No Supabase:**
```sql
SELECT * FROM csv_rows
WHERE custom_data->>'order_id' = 'ba29374';
```

### **Estatísticas:**
Execute [`QUERY-ORDER-ID-EXAMPLE.sql`](QUERY-ORDER-ID-EXAMPLE.sql) para ver:
- Total de transações
- % com `order_id` preenchido
- Transações sem `order_id` (investigar motivo)

---

## 📋 **PRÓXIMOS PASSOS**

1. ✅ Order ID já funciona → Nada a fazer
2. 🔧 Implementar reconciliação inteligente (filtrar unreconciled)
3. 📊 Executar query SQL para verificar `ba29374`
4. 🚀 Deploy + teste

**Aguardo confirmação para implementar a reconciliação inteligente.**
