# 📋 Campos de Dados - Braintree e GoCardless

## 🎯 Braintree - Campos Disponíveis

Todos os Braintrees (EUR, USD, GBP, AUD) utilizam a mesma estrutura de dados da API Braintree.

### Campos Principais

| Campo | Tipo | Descrição | Origem |
|-------|------|-----------|--------|
| `id` | string | ID único da transação no sistema | Supabase (auto-gerado) |
| `date` | string | Data da transação (YYYY-MM-DD) | Braintree API |
| `description` | string | Descrição da transação | Braintree API |
| `amount` | number | Valor da transação | Braintree API |
| `conciliado` | boolean | Se a transação foi reconciliada com banco | Manual/Automático |
| `destinationAccount` | string \| null | Conta bancária de destino (Bankinter EUR/USD/GBP) | Manual |
| `reconciliationType` | "automatic" \| "manual" \| null | Tipo de reconciliação | Sistema |

### Campos Específicos da Braintree API

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `transaction_id` | string | ID único da transação no Braintree | "abc123xyz" |
| `status` | string | Status da transação | "settled", "settling", "authorized" |
| `type` | string | Tipo de transação | "sale", "credit" |
| `currency` | string | Moeda da transação | "EUR", "USD", "GBP", "AUD" |
| `customer_id` | string | ID do cliente no Braintree | "cust_123456" |
| `customer_name` | string | Nome completo do cliente | "John Doe" |
| `customer_email` | string | Email do cliente | "john@example.com" |
| `payment_method` | string | Método de pagamento usado | "credit_card", "paypal" |
| `merchant_account_id` | string | Conta merchant específica | "digitalsmiledesignEUR" |
| `created_at` | string | Data de criação no Braintree | ISO 8601 timestamp |
| `updated_at` | string | Última atualização no Braintree | ISO 8601 timestamp |
| `disbursement_date` | string \| null | Data de transferência bancária | "2024-06-18" |
| `settlement_amount` | number \| null | Valor líquido após taxas | 145.35 |
| `settlement_currency` | string \| null | Moeda do settlement | "EUR" |

### Merchant Accounts por Moeda

| Página | Merchant Account ID | Moeda Padrão |
|--------|-------------------|--------------|
| Braintree EUR | `digitalsmiledesignEUR` | EUR |
| Braintree USD | `digitalsmiledesignUSD` | USD |
| Braintree GBP | `digitalsmiledesignGBP` | GBP |
| Braintree AUD | `digitalsmiledesignAUD` | AUD |

### Status Possíveis (Braintree)

- `settled` - Transação finalizada e liquidada
- `settled_successfully` - Variante de settled
- `settling` - Em processo de liquidação
- `submitted_for_settlement` - Submetida para liquidação
- `authorized` - Autorizada mas não capturada
- `authorization_expired` - Autorização expirada
- `processor_declined` - Recusada pelo processador
- `gateway_rejected` - Rejeitada pelo gateway

### Tipos de Transação (Braintree)

- `sale` - Venda/cobrança
- `credit` - Crédito/reembolso

### Métodos de Pagamento (Braintree)

- `credit_card` - Cartão de crédito
- `paypal` - PayPal
- `venmo` - Venmo (USA)
- `apple_pay` - Apple Pay
- `google_pay` - Google Pay

---

## 🏦 GoCardless - Campos Disponíveis

O GoCardless processa Direct Debits (débitos diretos) principalmente em GBP, mas também suporta EUR e USD.

### Campos Principais

| Campo | Tipo | Descrição | Origem |
|-------|------|-----------|--------|
| `id` | string | ID único da transação no sistema | Supabase (auto-gerado) |
| `date` | string | Data da transação ou arrival_date | GoCardless API |
| `description` | string | Descrição/referência da transação | GoCardless API |
| `amount` | number | Valor da transação (já convertido de centavos) | GoCardless API |
| `reconciled` | boolean | Se a transação foi reconciliada | Manual |

### Campos Específicos do GoCardless

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `type` | "payment" \| "payout" \| "refund" | Tipo de transação | "payout" |
| `payout_id` | string | ID do payout no GoCardless | "PO123456..." |
| `payment_id` | string | ID do payment no GoCardless | "PM123456..." |
| `status` | string | Status da transação | "paid", "pending", "confirmed" |
| `currency` | string | Moeda da transação | "GBP", "EUR", "USD" |
| `gocardless_id` | string | ID único no GoCardless | "PO123456..." ou "PM123456..." |
| `mandate_id` | string | ID do mandate (autorização) | "MD123456..." |
| `customer_name` | string | Nome do cliente | "John Doe" |
| `customer_email` | string | Email do cliente | "john@example.com" |
| `reference` | string | Referência da transação | "Invoice 1234" |

### Tipos de Transação (GoCardless)

1. **Payout** (`payout`)
   - Transferências do GoCardless para sua conta bancária
   - Agrupam múltiplos payments
   - Geralmente ocorrem semanalmente ou mensalmente

2. **Payment** (`payment`)
   - Cobranças individuais de clientes
   - Débitos diretos processados
   - Podem estar associados a um payout

3. **Refund** (`refund`)
   - Reembolsos de payments
   - Valores devolvidos aos clientes

### Status Possíveis (GoCardless)

- `paid` - Pagamento concluído
- `pending` - Aguardando processamento
- `confirmed` - Confirmado pelo banco
- `failed` - Falhou no processamento
- `cancelled` - Cancelado
- `customer_approval_denied` - Cliente negou aprovação
- `charged_back` - Chargeback

### Moedas Suportadas (GoCardless)

- `GBP` - Libra Esterlina (principal)
- `EUR` - Euro
- `USD` - Dólar Americano
- `SEK` - Coroa Sueca
- `DKK` - Coroa Dinamarquesa
- `AUD` - Dólar Australiano

---

## 📊 Comparação: Braintree vs GoCardless

| Aspecto | Braintree | GoCardless |
|---------|-----------|------------|
| **Método de Pagamento** | Cartões, PayPal, Wallets | Direct Debit (débito automático) |
| **Processamento** | Tempo real | D+3 a D+7 (depende do banco) |
| **Estrutura** | Transação individual | Payment → Payout (agrupado) |
| **Moeda Padrão** | Multi-moeda (EUR/USD/GBP/AUD) | GBP (principal) |
| **Reconciliação** | Com Bankinter (por moeda) | Com conta GBP |
| **ID Externo** | `transaction_id` | `gocardless_id` |
| **Cliente** | `customer_name`, `customer_email` | `customer_name`, `customer_email` |
| **Taxas** | `settlement_amount` (líquido) | Deduzidas no payout |
| **Disbursement** | `disbursement_date` | `payout_id` + date |

---

## 🔍 Campos Visíveis por Padrão

### Braintree (EUR/USD/GBP/AUD)

✅ Visíveis por padrão (17 colunas):
- ID
- Date
- Description
- Amount
- Destination Account
- Payout Reconciliation
- Actions
- Transaction ID
- Status
- Type
- Currency
- Customer Name
- Customer Email
- Payment Method
- Merchant Account ID
- Disbursement Date
- Settlement Amount

### GoCardless

✅ Visíveis por padrão (12 colunas):
- ID
- Date
- Description
- Amount
- Type
- Status
- Reconciliation
- Actions
- Payout ID
- Payment ID
- Currency
- GoCardless ID

---

## 🎨 Funcionalidades Implementadas

### Todas as Páginas (Braintree e GoCardless)

✅ **Paginação**
- 50 registros por página
- Navegação: First, Previous, Next, Last
- Indicador de página atual e total

✅ **Filtros de Coluna**
- Seletor visual de colunas
- Mostrar/ocultar colunas individualmente
- Badge indicando quantas colunas visíveis

✅ **Ordenação**
- Clique no cabeçalho para ordenar
- Ascendente/Descendente
- Ícone indicando campo e direção

✅ **Filtros Avançados**
- Busca textual (ID, descrição, etc.)
- Filtro por status
- Filtro por tipo
- Filtro por moeda
- Filtro por valor (>, <, =)
- Botão "Clear all filters"

✅ **Edição Inline**
- Editar data, descrição, valor
- Salvar/Cancelar
- Feedback visual de sucesso

✅ **Download CSV**
- Exportar dados filtrados
- Formato padronizado

✅ **Sync API** (onde aplicável)
- Braintree: Botão de sync via API
- GoCardless: Botão de sync manual

✅ **Reconciliação**
- Marcar como reconciliado
- Indicador visual (Braintree: automatic/manual)
- GoCardless: Toggle simples

---

## 🗂️ Estrutura no Banco de Dados (Supabase)

### Tabela: `csv_rows`

```sql
CREATE TABLE csv_rows (
  id UUID PRIMARY KEY,
  source TEXT NOT NULL,           -- 'braintree-api-revenue', 'braintree-eur', 'gocardless', etc.
  date DATE NOT NULL,
  description TEXT,
  amount NUMERIC(10, 2),
  reconciled BOOLEAN DEFAULT FALSE,
  custom_data JSONB,              -- Todos os campos extras aqui
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Índices Recomendados

```sql
-- Performance indexes
CREATE INDEX idx_csv_rows_source_date ON csv_rows(source, date DESC);
CREATE INDEX idx_csv_rows_transaction_id ON csv_rows((custom_data->>'transaction_id'));
CREATE INDEX idx_csv_rows_gocardless_id ON csv_rows((custom_data->>'gocardless_id'));
CREATE INDEX idx_csv_rows_reconciled ON csv_rows(source, reconciled);
CREATE INDEX idx_csv_rows_merchant_account ON csv_rows((custom_data->>'merchant_account_id'));
CREATE INDEX idx_csv_rows_disbursement_date ON csv_rows((custom_data->>'disbursement_date'));
CREATE INDEX idx_csv_rows_currency ON csv_rows((custom_data->>'currency'));
```

---

## 📝 Notas de Implementação

### Filtros Padrão

- **Braintree**: Status padrão = "settled" (mostra apenas transações liquidadas)
- **GoCardless**: Sem filtro padrão (mostra tudo)

### Moeda Padrão

- **Braintree EUR**: "EUR"
- **Braintree USD**: "USD"
- **Braintree GBP**: "GBP"
- **Braintree AUD**: "AUD"
- **GoCardless**: "GBP"

### Source na Query

- **Braintree EUR**: `source.eq.braintree-api-revenue OR source.eq.braintree-eur` + filtro `merchant_account_id = "digitalsmiledesignEUR"`
- **Braintree USD**: Igual ao EUR, mas `merchant_account_id = "digitalsmiledesignUSD"`
- **Braintree GBP**: Igual ao EUR, mas `merchant_account_id = "digitalsmiledesignGBP"`
- **Braintree AUD**: Igual ao EUR, mas `merchant_account_id = "digitalsmiledesignAUD"`
- **GoCardless**: `source.eq.gocardless`

---

## 🚀 Próximos Passos

1. Implementar reconciliação automática entre Braintree e Bankinter
2. Dashboard consolidado com KPIs de todas as fontes
3. Relatórios de análise de receita por moeda
4. Alertas automáticos para transações com problemas
5. Export para Power BI com todos os campos
