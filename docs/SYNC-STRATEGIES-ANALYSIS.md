# 🔄 Análise de Estratégias de Sincronização

## 📊 Comparação de Estratégias

| Estratégia | Prós | Contras | Uso Ideal |
|-----------|------|---------|-----------|
| **1. Full Sync** | ✅ Captura todas as mudanças<br>✅ Simples de implementar<br>✅ Dados sempre atualizados | ❌ Lento (milhares de registros)<br>❌ Usa muita API quota<br>❌ Ineficiente | Setup inicial<br>Recovery de erros |
| **2. Incremental (created_at)** | ✅ Rápido<br>✅ Baixo uso de API<br>✅ Escalável | ❌ **PERDE UPDATES**<br>❌ Não detecta mudanças | APIs sem `updated_at`<br>Dados imutáveis |
| **3. Incremental (updated_at)** | ✅ Rápido<br>✅ Captura updates<br>✅ Eficiente | ⚠️ Depende da API ter `updated_at` | **RECOMENDADO**<br>Maioria dos casos |
| **4. Híbrido (incremental + full periódico)** | ✅ Balanceado<br>✅ Recupera dados perdidos<br>✅ Flexível | ⚠️ Mais complexo | **IDEAL**<br>Sistemas críticos |
| **5. Event-Driven (Webhooks)** | ✅ **Tempo real**<br>✅ Zero polling<br>✅ Eficiente | ⚠️ Requer infraestrutura<br>⚠️ Pode perder eventos | Updates instantâneos<br>Complementar |

---

## 🎯 Estratégia Recomendada: **HÍBRIDA**

### Arquitetura Proposta

```sql
-- Tabela de metadata de sincronização
CREATE TABLE sync_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL UNIQUE, -- 'braintree', 'gocardless', 'hubspot'
  last_incremental_sync TIMESTAMPTZ, -- Última sync incremental
  last_full_sync TIMESTAMPTZ, -- Última sync completa
  next_full_sync_due TIMESTAMPTZ, -- Quando fazer próxima full sync
  total_records INTEGER DEFAULT 0,
  last_sync_status TEXT, -- 'success', 'error', 'in_progress'
  last_sync_error TEXT,
  sync_config JSONB, -- Configurações específicas
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_sync_metadata_source ON sync_metadata(source);
CREATE INDEX idx_sync_metadata_next_full_sync ON sync_metadata(next_full_sync_due);
```

### Lógica de Sincronização

```typescript
// src/lib/sync-strategy.ts

export type SyncType = 'incremental' | 'full';

export interface SyncMetadata {
  source: string;
  lastIncrementalSync: Date | null;
  lastFullSync: Date | null;
  nextFullSyncDue: Date;
  totalRecords: number;
  syncConfig: {
    fullSyncIntervalDays: number; // Ex: 7 dias
    incrementalSyncIntervalHours: number; // Ex: 6 horas
    useUpdatedAt: boolean; // Se a API suporta updated_at
  };
}

export async function determineSyncStrategy(
  source: string
): Promise<{ type: SyncType; since?: Date }> {
  
  const metadata = await getSyncMetadata(source);
  
  // CASO 1: Primeira sincronização
  if (!metadata.lastIncrementalSync) {
    return { type: 'full' };
  }
  
  // CASO 2: Full sync periódica obrigatória
  if (new Date() >= metadata.nextFullSyncDue) {
    return { type: 'full' };
  }
  
  // CASO 3: Sincronização incremental
  const since = metadata.syncConfig.useUpdatedAt 
    ? metadata.lastIncrementalSync // Busca por updated_at
    : metadata.lastIncrementalSync; // Busca por created_at (menos seguro)
  
  return { 
    type: 'incremental',
    since: new Date(since.getTime() - 60000) // -1 min buffer para evitar race conditions
  };
}
```

---

## 🔧 Implementação por Fonte

### 1. Braintree (Suporta updated_at ✅)

```typescript
// API: transaction.updatedAt está disponível
const strategy = await determineSyncStrategy('braintree');

if (strategy.type === 'incremental') {
  // Busca transações criadas OU atualizadas desde último sync
  const searchResults = await gateway.transaction.search((search) => {
    search.updatedAt().greaterThanOrEqualTo(strategy.since);
  });
}
```

**Configuração:**
```javascript
{
  source: 'braintree',
  syncConfig: {
    fullSyncIntervalDays: 30, // Full sync mensal
    incrementalSyncIntervalHours: 6, // Incremental 4x/dia
    useUpdatedAt: true // ✅ API suporta
  }
}
```

### 2. GoCardless (Suporta created_at apenas ⚠️)

```typescript
// API: Apenas created_at disponível
// SOLUÇÃO: Combinar incremental + webhooks

const strategy = await determineSyncStrategy('gocardless');

if (strategy.type === 'incremental') {
  // Busca apenas novos pagamentos
  const payments = await gocardless.payments.list({
    created_at: {
      gt: strategy.since.toISOString()
    }
  });
  
  // ⚠️ PROBLEMA: Não captura updates de pagamentos antigos
  // ✅ SOLUÇÃO: Usar webhooks para updates
}
```

**Configuração:**
```javascript
{
  source: 'gocardless',
  syncConfig: {
    fullSyncIntervalDays: 7, // Full sync semanal (mais frequente)
    incrementalSyncIntervalHours: 12,
    useUpdatedAt: false, // ❌ API não suporta
    useWebhooks: true // ✅ Compensar com webhooks
  }
}
```

### 3. HubSpot (Via SQL Server - custom logic)

```typescript
// SQL Server tem updated_at customizado
const strategy = await determineSyncStrategy('hubspot');

if (strategy.type === 'incremental') {
  const query = `
    SELECT * FROM HubSpot_Deals_View
    WHERE ModifiedDate >= @lastSync
    ORDER BY ModifiedDate DESC
  `;
}
```

**Configuração:**
```javascript
{
  source: 'hubspot',
  syncConfig: {
    fullSyncIntervalDays: 14,
    incrementalSyncIntervalHours: 24,
    useUpdatedAt: true // ✅ ModifiedDate disponível
  }
}
```

---

## 🛡️ Estratégia de Upsert (Evitar Duplicatas)

### Na tabela `csv_rows`:

```sql
-- Adicionar constraint único por source + external_id
ALTER TABLE csv_rows 
ADD COLUMN external_id TEXT; -- ID da API externa (transaction.id, payment.id, etc.)

CREATE UNIQUE INDEX idx_csv_rows_source_external_id 
ON csv_rows(source, external_id) 
WHERE external_id IS NOT NULL;
```

### No código (INSERT ... ON CONFLICT):

```typescript
// src/lib/upsert-transaction.ts

export async function upsertTransaction(
  source: string,
  externalId: string,
  data: any
) {
  const { data: result, error } = await supabase
    .from('csv_rows')
    .upsert({
      source,
      external_id: externalId,
      date: data.date,
      amount: data.amount,
      description: data.description,
      custom_data: data.customData,
      updated_at: new Date() // ← Importante!
    }, {
      onConflict: 'source,external_id', // Chave única
      ignoreDuplicates: false // ← Atualizar se existir
    });
  
  return result;
}
```

---

## 📈 Casos de Uso Reais

### Cenário A: Transação Braintree atualizada
```
Jan 1  → Criada (status: pending, paid_at: null)
Jan 2  → SYNC INCREMENTAL → salva no banco
Jan 10 → Atualizada na Braintree (status: settled, paid_at: 2026-01-10)
Jan 11 → SYNC INCREMENTAL (usando updated_at) → DETECTA mudança
         → UPSERT atualiza registro existente ✅
```

### Cenário B: Pagamento GoCardless atualizado (sem updated_at)
```
Jan 1  → Criado (status: pending_submission)
Jan 2  → SYNC INCREMENTAL → salva no banco
Jan 10 → Atualizado no GoCardless (status: confirmed)
Jan 11 → SYNC INCREMENTAL (apenas created_at) → NÃO detecta ❌
Jan 11 → WEBHOOK recebido → Atualiza via webhook ✅
Jan 15 → FULL SYNC semanal → Atualiza como fallback ✅
```

---

## 🎯 Recomendação Final

### Implementar 3 camadas de sincronização:

1. **Incremental (Diária/6h)** → Novos registros + updates (se API suportar)
2. **Webhooks (Tempo Real)** → Updates instantâneos
3. **Full Sync (Semanal/Mensal)** → Safety net para capturar tudo

### Benefícios:
- ✅ Eficiente (baixo uso de API)
- ✅ Atualizado (webhooks em tempo real)
- ✅ Confiável (full sync periódica como backup)
- ✅ Escalável (incremental para volume alto)

### Prioridades de Implementação:
1. ✅ **AGORA**: Tabela `sync_metadata` + lógica básica
2. ✅ **AGORA**: Upsert strategy com `external_id`
3. ⏳ **PRÓXIMO**: Webhooks GoCardless (você já tem!)
4. ⏳ **DEPOIS**: Full sync periódica automática
5. ⏳ **FUTURO**: Dashboard de monitoramento de syncs
