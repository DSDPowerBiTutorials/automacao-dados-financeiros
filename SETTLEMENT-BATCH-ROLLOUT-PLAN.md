# 🎯 Settlement Batch ID - Plano de Implementação

## ✅ **FASE 1: BRAINTREE EUR - CONCLUÍDO**
- [x] Settlement Batch ID funcionando
- [x] Agrupamento visual por batch
- [x] Filtro por batch
- [x] Debug logging implementado

## 🔄 **FASE 2: REPLICAR PARA OUTRAS MOEDAS**

### Páginas a atualizar:
1. `/reports/braintree-usd/page.tsx`
2. `/reports/braintree-gbp/page.tsx`
3. `/reports/braintree-aud/page.tsx`
4. `/reports/braintree-amex/page.tsx`
5. `/reports/braintree-transactions/page.tsx`

### Mudanças necessárias por página:

#### A. **Estados** (adicionar após disbursementFilter):
```typescript
// 🆕 Settlement Batch grouping
const [settlementBatches, setSettlementBatches] = useState<Map<string, BraintreeXXXRow[]>>(new Map());
const [expandedSettlementBatches, setExpandedSettlementBatches] = useState<Set<string>>(new Set());
const [settlementBatchFilter, setSettlementBatchFilter] = useState<string>("");
```

#### B. **Interface** (adicionar campo):
```typescript
settlement_batch_id?: string | null; // Formato: YYYY-MM-DD_merchant_uniqueid
```

#### C. **Mapear settlement_batch_id** (na função loadData):
```typescript
settlement_batch_id: row.custom_data?.settlement_batch_id,
```

#### D. **Agrupar por batch** (após mapear rows):
```typescript
// 🆕 Agrupar transações por Settlement Batch ID
const batchGroups = new Map<string, BraintreeXXXRow[]>();
mappedRows.forEach((row) => {
  const batchId = row.settlement_batch_id || 'no-batch';
  if (!batchGroups.has(batchId)) {
    batchGroups.set(batchId, []);
  }
  batchGroups.get(batchId)!.push(row);
});

console.log(`[Braintree XXX] Found ${batchGroups.size} settlement batches`);

// Log detalhes dos batches
batchGroups.forEach((rows, batchId) => {
  if (batchId !== 'no-batch') {
    const totalAmount = rows.reduce((sum, r) => sum + (r.settlement_amount || r.amount), 0);
    console.log(`[Batch ${batchId}] ${rows.length} transactions, Total: $${totalAmount.toFixed(2)}`);
  }
});

setSettlementBatches(batchGroups);
```

#### E. **UI - Filtro de Settlement Batch** (adicionar no JSX):
```tsx
{/* 🆕 Settlement Batch Filter */}
<div className="flex flex-col gap-2">
  <label className="text-sm font-medium">Settlement Batch</label>
  <Select value={settlementBatchFilter} onValueChange={setSettlementBatchFilter}>
    <SelectTrigger>
      <SelectValue placeholder="All Batches" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">All Batches</SelectItem>
      {Array.from(settlementBatches.keys())
        .filter(batch => batch !== 'no-batch')
        .sort((a, b) => b.localeCompare(a))
        .map(batch => (
          <SelectItem key={batch} value={batch}>
            {batch} ({settlementBatches.get(batch)?.length} tx)
          </SelectItem>
        ))}
    </SelectContent>
  </Select>
</div>
```

## 🤝 **FASE 3: RECONCILIAÇÃO AUTOMÁTICA COM BANKINTER**

### Conceito:
Quando uma transação Braintree tem `settlement_batch_id` e `disbursement_date`, ela deve ser automaticamente reconciliada com o ingresso correspondente no Bankinter EUR.

### Lógica de Match:
```typescript
// Para cada settlement_batch_id com valor total X:
// 1. Buscar no Bankinter EUR transações com:
//    - Data: disbursement_date ±3 dias
//    - Valor: ±€0.10 de tolerância
//    - Descrição contendo: "BRAINTREE" ou "PAYPAL" ou merchant_id
// 2. Se match encontrado:
//    - Marcar Braintree como conciliado → Bankinter EUR
//    - Marcar Bankinter como conciliado → Braintree (bidirectional)
//    - Tipo: "automatic"
```

### Implementação:
```typescript
async function reconcileSettlementBatchWithBank(
  settlementBatchId: string,
  transactions: BraintreeRow[],
  currency: 'EUR' | 'USD' | 'GBP' | 'AUD'
): Promise<void> {
  // Calcular total do batch
  const batchTotal = transactions.reduce((sum, t) => 
    sum + (t.settlement_amount || t.amount), 0
  );

  const disbursementDate = transactions[0]?.disbursement_date;
  if (!disbursementDate) return;

  // Buscar match no Bankinter correspondente
  const bankSource = `bankinter-${currency.toLowerCase()}`;
  
  const { data: bankRows } = await supabase
    .from('csv_rows')
    .select('*')
    .eq('source', bankSource)
    .gte('date', subtractDays(disbursementDate, 3))
    .lte('date', addDays(disbursementDate, 3));

  // Procurar match por valor
  const match = bankRows?.find(row => 
    Math.abs(parseFloat(row.amount) - batchTotal) < 0.10
  );

  if (match) {
    // Reconciliar Braintree → Bank
    await Promise.all(transactions.map(t => 
      supabase.from('csv_rows').update({
        custom_data: {
          ...t,
          conciliado: true,
          destinationAccount: `Bankinter ${currency}`,
          reconciliationType: 'automatic',
          bank_match_id: match.id,
        }
      }).eq('id', t.id)
    ));

    // Reconciliar Bank → Braintree
    await supabase.from('csv_rows').update({
      custom_data: {
        ...match.custom_data,
        conciliado: true,
        destinationAccount: `Braintree ${currency}`,
        reconciliationType: 'automatic',
        braintree_settlement_batch_id: settlementBatchId,
      }
    }).eq('id', match.id);

    console.log(`✅ Auto-reconciled batch ${settlementBatchId} with ${bankSource}`);
  }
}
```

## 📋 **PRÓXIMOS PASSOS**

1. ✅ Aplicar mudanças A-E em todas as páginas USD, GBP, AUD, AMEX
2. ✅ Testar agrupamento visual em cada página
3. ✅ Implementar reconciliação automática
4. ✅ Adicionar botão "Auto-Reconcile All" nas páginas
5. ✅ Criar job automático (webhook ou cron) para reconciliar novos batches

## 🎯 **BENEFÍCIOS**

- ✅ Visibilidade clara de payouts agrupados
- ✅ Reconciliação automática entre Braintree ↔ Bankinter
- ✅ Menos trabalho manual
- ✅ Auditoria completa de settlements
- ✅ Identificação rápida de discrepâncias
