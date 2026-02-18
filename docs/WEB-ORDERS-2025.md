# Web Orders 2025 — Importação e Reconciliação

## Resumo da Implementação

### Análise dos CSVs (7 ficheiros)

| CSV | Rows | Colunas | Status |
|-----|------|---------|--------|
| Legacy | 1.755 | 25 (flat) | ✅ Base principal |
| Line Items | 1.755 | 30 (flat) | ✅ Produtos por order |
| Expanded 1-4 | 1.755 | 106 (JSON embedded) | ✅ TxIDs + customer names |
| Raw Data | ~1.755 | 198+ | ⏳ HubSpot VID (futuro) |

### Dados Extraídos

- **1.755 orders** totais (todas subscription, statusId=12, gatewayId=2=Braintree)
- **1.652 orders** com Braintree TxIDs determinísticos (94,1%)
- **103 orders** sem TxID (totalPaid=0, trials/grátis — sem transação bancária)
- **1.755/1.755** com produtos (Line Items)
- **1.755/1.755** com nomes de clientes (Expanded)
- **791 EUR** + **964 USD** orders

### Cadeia de Reconciliação

```
Banco (Bankinter/Chase)
  → Disbursement Match (bank-disbursement API)
    → custom_data.transaction_ids
      → Gateway TX (csv_rows source=braintree-api-revenue)
        → order_transaction_links.transaction_id
          → web_orders.order_reference
            → products, customer, billing info
```

## Ficheiros Criados/Modificados

### Novos
1. `supabase/migrations/20260211_create_web_orders.sql` — Migração da tabela
2. `scripts/import-web-orders-2025.js` — Script de importação unificado
3. `docs/WEB-ORDERS-2025.md` — Esta documentação

### Modificados
4. `src/app/api/reconcile/chain-details/route.ts` — Nova busca web_orders via order_transaction_links
5. `src/app/executive/cash-flow/bank/page.tsx` — Nova secção "E-Commerce Orders" no drill-down dialog

## Como Usar

### 1. Executar Migração
```bash
# Via Supabase CLI
supabase db push

# Ou diretamente via psql
psql $DATABASE_URL -f supabase/migrations/20260211_create_web_orders.sql
```

### 2. Importar Orders
```bash
# Dry run (sem escrever no banco)
node scripts/import-web-orders-2025.js --dry-run

# Importar de verdade
node scripts/import-web-orders-2025.js

# Forçar re-importação (apaga dados existentes)
node scripts/import-web-orders-2025.js --force
```

### 3. Verificar
No dashboard, ir a **Executive → Cash Flow → Bank**, clicar num ingresso bancário Braintree, e verificar que a secção "E-Commerce Orders" aparece com clientes, produtos e valores.

## Schema: web_orders

| Campo | Tipo | Descrição |
|-------|------|-----------|
| craft_id | TEXT | ID do Craft Commerce (e.g. '4771504') |
| order_reference | TEXT | 7 primeiros chars do number (e.g. 'f16cbfe') |
| customer_email | TEXT | Email do cliente |
| customer_full_name | TEXT | Nome completo |
| total_price | NUMERIC | Valor total |
| currency | TEXT | EUR ou USD |
| products | JSONB | Array de [{sku, description, qty, price}] |
| braintree_tx_ids | TEXT[] | Array de Braintree Transaction IDs |
| order_type | TEXT | 'subscriptionPayment' ou 'cart' |
| billing_country | TEXT | País de billing |

## Próximos Passos

1. **Cart orders (7.825)**: Importar web_orders dos cart orders (2025_web_orders.csv) — já têm TxIDs no Braintree CSV
2. **HubSpot VID**: Extrair do Raw Data CSV para linking com CRM
3. **Stripe/GoCardless**: Adicionar order_transaction_links para estes gateways
4. **Auto-reconciliação**: Script para popular reconciled_bank_row_id automaticamente
