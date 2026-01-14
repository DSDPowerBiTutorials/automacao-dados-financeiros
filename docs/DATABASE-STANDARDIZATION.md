# Padronização da Base de Dados - csv_rows

## Resumo da Migration

**Data:** 2026-01-13  
**Arquivo:** `supabase/migrations/20260113_standardize_csv_rows.sql`

---

## Mudanças Aplicadas

### 1. Novas Colunas

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `date_ts` | TIMESTAMPTZ | Data normalizada (usar para queries) |
| `currency` | VARCHAR(3) | Código ISO 4217 (EUR, USD, GBP) |
| `amount_cents` | BIGINT | Valor em centavos (cálculos precisos) |

### 2. Índices de Performance

| Índice | Colunas | Uso |
|--------|---------|-----|
| `idx_csv_rows_source_date` | source, date_ts | Consultas por fonte + período |
| `idx_csv_rows_date_ts` | date_ts | Ordenação por data |
| `idx_csv_rows_reconciled` | reconciled | Filtro de pendentes |
| `idx_csv_rows_external_id` | external_id | Busca por ID externo |
| `idx_csv_rows_customer_email` | customer_email | Busca por cliente |
| `idx_csv_rows_custom_data` | custom_data (GIN) | Busca em JSONB |

### 3. View Padronizada

```sql
SELECT * FROM csv_rows_normalized;
```

Retorna dados com `transaction_date` normalizada automaticamente.

### 4. Função Helper

```sql
SELECT parse_transaction_date('2026-01-13');
SELECT parse_transaction_date('13/01/2026');
SELECT parse_transaction_date('2026-01-13T10:30:00Z');
```

---

## Como Aplicar

1. Acesse: https://supabase.com/dashboard/project/rrzgawssbyfzbkmtcovz/sql/new

2. Cole o conteúdo de `supabase/migrations/20260113_standardize_csv_rows.sql`

3. Execute

---

## Verificação Pós-Aplicação

```sql
-- Verificar novas colunas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'csv_rows' 
  AND column_name IN ('date', 'date_ts', 'currency', 'amount_cents')
ORDER BY column_name;

-- Verificar dados migrados
SELECT 
  COUNT(*) as total,
  COUNT(date_ts) as com_date_ts,
  COUNT(currency) as com_currency,
  COUNT(amount_cents) as com_amount_cents
FROM csv_rows;

-- Ver exemplos
SELECT id, date, date_ts, amount, amount_cents, currency, source 
FROM csv_rows 
LIMIT 5;
```

---

## Boas Práticas Implementadas

1. **Datas como TIMESTAMPTZ** - Suporte a timezone, ordenação correta
2. **Valores em centavos** - Evita problemas de ponto flutuante
3. **Moeda explícita** - Multi-currency nativo
4. **Índices estratégicos** - Performance em queries comuns
5. **Compatibilidade retroativa** - Coluna `date` original mantida
6. **Documentação inline** - COMMENT em todas as colunas
