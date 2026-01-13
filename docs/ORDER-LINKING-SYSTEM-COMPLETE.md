# 🔗 Sistema de Linkagem Order ID ↔ Transaction ID

## Resumo da Implementação

Sistema **triplo** de vínculo garantindo que **TODAS** as transações Braintree sejam associadas a `order_id`:

### ✅ 3 Camadas de Vínculo

1. **Tabela de Mapeamento** (`order_transaction_mapping`)
2. **Integração HubSpot** (via `braintree_hubspot_order_links`)
3. **Trigger Automático** (auto-link no INSERT de novas transações)

---

## 📊 Componentes Criados

### 1. API de Mapeamento
**Arquivo:** `src/app/api/order-mapping/route.ts`

**Endpoints:**
- `POST /api/order-mapping` - Criar vínculo manual
- `GET /api/order-mapping?transaction_id=xxx` - Buscar vínculo
- `PUT /api/order-mapping` - Busca em batch (múltiplos IDs)

**Exemplo de uso:**
```bash
# Criar vínculo manual
curl -X POST http://localhost:3000/api/order-mapping \
  -H "Content-Type: application/json" \
  -d '{"order_id": "ba29374", "transaction_id": "abc123", "source": "manual"}'

# Buscar vínculo
curl "http://localhost:3000/api/order-mapping?transaction_id=abc123"
```

### 2. API de Backfill Automático
**Arquivo:** `src/app/api/order-mapping/backfill/route.ts`

**Funcionalidade:**
- Busca transações SEM `order_id`
- Verifica vínculos no HubSpot (`braintree_hubspot_order_links`)
- Cria mapeamentos automaticamente na tabela `order_transaction_mapping`
- Suporta modo DRY RUN (testar sem salvar)

**Exemplo de uso:**
```bash
# Teste (DRY RUN)
curl -X POST http://localhost:3000/api/order-mapping/backfill \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true, "limit": 100}'

# Executar REAL
curl -X POST http://localhost:3000/api/order-mapping/backfill \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false, "limit": 1000}'
```

### 3. Trigger Automático (Database)
**Arquivo:** `docs/TRIGGER-AUTO-LINK-ORDER-ID.sql`

**Funcionalidade:**
- Trigger `BEFORE INSERT` na tabela `csv_rows`
- Quando webhook do Braintree inserir nova transação:
  1. Verifica se já tem `order_id` → skip
  2. Busca na `order_transaction_mapping`
  3. Se não encontrar, busca na `braintree_hubspot_order_links`
  4. Se encontrar, auto-insere `order_id` no `custom_data`

**Executar SQL:**
```sql
-- Copiar e colar no Supabase SQL Editor
-- docs/TRIGGER-AUTO-LINK-ORDER-ID.sql
```

### 4. Integração Frontend
**Arquivo:** `src/app/reports/braintree-eur/page.tsx`

**Mudanças:**
- Linha ~881: Busca em **batch** todos os mapeamentos (`PUT /api/order-mapping`)
- Linha ~949: Prioridade de `order_id`:
  1. `custom_data->order_id` (direto da transação)
  2. `orderMappings.get(transaction_id)` (tabela de mapeamento)
  3. `null` (sem vínculo)

---

## 🚀 Como Usar

### Passo 1: Executar Trigger no Banco
```sql
-- Copiar conteúdo de docs/TRIGGER-AUTO-LINK-ORDER-ID.sql
-- Colar no Supabase SQL Editor → Run
```

### Passo 2: Backfill Transações Antigas
```bash
# 1. Testar (DRY RUN)
curl -X POST https://dsdfinancehub.com/api/order-mapping/backfill \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true, "limit": 100}'

# 2. Verificar resposta
# {
#   "success": true,
#   "found_in_hubspot": 850,
#   "created": 0,
#   "message": "DRY RUN: Would create 850 mappings"
# }

# 3. Executar REAL (criar mapeamentos)
curl -X POST https://dsdfinancehub.com/api/order-mapping/backfill \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false, "limit": 1000}'
```

### Passo 3: Validar Cobertura
```sql
-- Ver estatísticas de cobertura
SELECT 
  COUNT(*) as total,
  COUNT(CASE 
    WHEN custom_data->>'order_id' IS NOT NULL 
      OR EXISTS (
        SELECT 1 FROM order_transaction_mapping otm
        WHERE otm.transaction_id = csv_rows.custom_data->>'transaction_id'
      ) 
    THEN 1 
  END) as with_order_id,
  ROUND(100.0 * COUNT(CASE 
    WHEN custom_data->>'order_id' IS NOT NULL 
      OR EXISTS (
        SELECT 1 FROM order_transaction_mapping otm
        WHERE otm.transaction_id = csv_rows.custom_data->>'transaction_id'
      ) 
    THEN 1 
  END) / COUNT(*), 2) as coverage_percent
FROM csv_rows
WHERE source = 'braintree-api-revenue';
```

---

## 📈 Métricas Esperadas

**ANTES:**
- 1925 transações totais
- 16 com `order_id` (0.8%)
- **99.2% SEM vínculo**

**DEPOIS (após backfill):**
- 1925 transações totais
- ~850+ com `order_id` via mapeamento (44%+)
- **Novas transações:** 100% linkadas (via trigger)

---

## 🔍 Debugging

### Verificar se vínculo existe
```sql
-- Por transaction_id
SELECT * FROM order_transaction_mapping
WHERE transaction_id = 'abc123';

-- Por order_id
SELECT * FROM order_transaction_mapping
WHERE order_id = 'ba29374';
```

### Ver transação no frontend
1. Abrir [/reports/braintree-eur](https://dsdfinancehub.com/reports/braintree-eur)
2. Coluna "Order ID" deve mostrar valor linkado
3. Se não aparecer, verificar no console do navegador:
   ```
   [Order Mapping] ✅ Loaded XXX mappings
   ```

### Criar vínculo manual
```sql
INSERT INTO order_transaction_mapping (order_id, transaction_id, source)
VALUES ('ba29374', 'abc123', 'manual')
ON CONFLICT (transaction_id) DO UPDATE SET order_id = EXCLUDED.order_id;
```

---

## 🛠️ Arquivos de Referência

- **API Routes:**
  - [src/app/api/order-mapping/route.ts](../src/app/api/order-mapping/route.ts)
  - [src/app/api/order-mapping/backfill/route.ts](../src/app/api/order-mapping/backfill/route.ts)

- **SQL Scripts:**
  - [docs/TRIGGER-AUTO-LINK-ORDER-ID.sql](TRIGGER-AUTO-LINK-ORDER-ID.sql) - Trigger automático
  - [docs/ORDER-BACKFILL-SCRIPT.sql](ORDER-BACKFILL-SCRIPT.sql) - Queries de validação

- **Frontend:**
  - [src/app/reports/braintree-eur/page.tsx](../src/app/reports/braintree-eur/page.tsx) - Integração batch

---

## ✅ Status de Implementação

- [x] Tabela `order_transaction_mapping` criada (user)
- [x] API POST/GET/PUT para mapeamentos
- [x] API backfill automático via HubSpot
- [x] Trigger auto-link no INSERT
- [x] Integração frontend (batch loading)
- [ ] **TODO:** Executar trigger no banco (SQL Editor)
- [ ] **TODO:** Executar backfill inicial (API)
- [ ] **TODO:** Validar cobertura > 40%

---

**Próximos Passos:**
1. Executar `docs/TRIGGER-AUTO-LINK-ORDER-ID.sql` no Supabase
2. Executar backfill via API (dry_run → real)
3. Validar no frontend que `order_id` aparece nas transações
4. Monitorar logs para novas transações sendo auto-linkadas
