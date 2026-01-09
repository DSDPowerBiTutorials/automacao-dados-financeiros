# 📊 Estrutura de Dados Braintree - Guia Completo

## 🎯 Campos Disponíveis nas Transações

### **Campos Principais (Já Capturados)**
```typescript
{
  // Identificação
  id: string                    // ID único da transação
  merchantAccountId: string     // Qual merchant account (EUR, USD, GBP, AUD)
  orderId: string              // ID do pedido (opcional)
  
  // Valores
  amount: string               // Valor total (ex: "150.00")
  currencyIsoCode: string      // Moeda (EUR, USD, GBP, AUD)
  serviceFeeAmount: string     // Fee do Braintree
  
  // Status
  status: string               // settled, authorized, submitted_for_settlement, etc.
  type: string                 // sale, credit
  
  // Datas
  createdAt: Date             // Data de criação
  updatedAt: Date             // Última atualização
  
  // Cliente
  customer: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  
  // Método de Pagamento
  paymentInstrumentType: string  // credit_card, paypal_account
  creditCard: {
    cardType: string            // Visa, Mastercard, Amex
    last4: string               // Últimos 4 dígitos
    expirationMonth: string
    expirationYear: string
  }
  paypalAccount: {
    payerEmail: string
  }
}
```

---

## 💰 Disbursements (Transferências Bancárias)

### **O que é Disbursement?**
É a transferência real do dinheiro do Braintree para sua conta bancária. Uma única transferência pode incluir múltiplas transações.

### **Campos do Disbursement:**
```typescript
{
  id: string                    // ID único do disbursement
  merchantAccount: {
    id: string                 // ***REMOVED***_EUR
    currencyIsoCode: string    // EUR, USD, etc.
  }
  
  amount: string               // Valor total transferido
  disbursementDate: Date       // Data da transferência
  
  // Transações incluídas
  transactions: [
    {
      id: string               // IDs das transações no disbursement
      amount: string
    }
  ]
  
  // Taxas
  settlementBatchId: string
  success: boolean
  retry: boolean
}
```

### **Como Acessar Disbursements:**
```typescript
// Via API
gateway.transaction.find(transactionId).then(transaction => {
  console.log(transaction.disbursementDetails);
  // {
  //   disbursementDate: Date,
  //   settlementAmount: string,
  //   settlementCurrencyIsoCode: string,
  //   settlementCurrencyExchangeRate: string
  // }
});

// Via Webhook
// Evento: "disbursement"
webhookNotification.disbursement.id
webhookNotification.disbursement.amount
webhookNotification.disbursement.disbursementDate
```

---

## 🏦 Merchant Accounts (Contas por Moeda)

Você tem 4 merchant accounts:
- `digitalsmiledesignAUD` → Transações em Dólares Australianos
- `digitalsmiledesignEUR` → Transações em Euros
- `digitalsmiledesignGBP` → Transações em Libras
- `digitalsmiledesignUSD` → Transações em Dólares Americanos

### **Como Filtrar por Moeda:**
```typescript
// Opção 1: Filtrar por currency na busca
const transactions = await searchTransactions(start, end, {
  // Não há filtro de currency direto, então filtramos depois
});
const eurTransactions = transactions.filter(t => t.currencyIsoCode === 'EUR');

// Opção 2: Filtrar por merchant account
const transactions = await searchTransactions(start, end, {
  merchantAccountId: 'digitalsmiledesignEUR'
});
```

---

## 📈 Otimizações de Performance

### **Problemas Potenciais:**
1. ✅ **Muitas transações (1.700+)** → Pode deixar interface lenta
2. ✅ **Reconciliação automática** → Processa todos os registros ao carregar
3. ✅ **Queries sem limite** → Busca todos os dados

### **Soluções Implementadas:**

#### **1. Paginação na Interface**
```typescript
// Limite de 200 registros por página
const { data } = await supabase
  .from("csv_rows")
  .select("*")
  .eq("source", "braintree-api-revenue")
  .order("date", { ascending: false })
  .limit(200);  // ✅ JÁ IMPLEMENTADO
```

#### **2. Índices no Banco de Dados**
```sql
-- Criar índices para queries rápidas
CREATE INDEX idx_csv_rows_source_date ON csv_rows(source, date DESC);
CREATE INDEX idx_csv_rows_custom_data_transaction_id ON csv_rows((custom_data->>'transaction_id'));
CREATE INDEX idx_csv_rows_reconciled ON csv_rows(source, reconciled);
```

#### **3. Lazy Loading (Carregar sob Demanda)**
```typescript
// Opção: Carregar mais dados ao scrollar
const [page, setPage] = useState(1);
const ITEMS_PER_PAGE = 100;

// Carregar próxima página
const loadMore = async () => {
  const from = page * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE;
  // ... fetch com range
};
```

#### **4. Desabilitar Reconciliação Automática**
```typescript
// ATUAL: Reconcilia ao carregar (lento com muitos dados)
const reconciledRows = await reconcileBankStatements(mappedRows);

// MELHOR: Reconciliar apenas quando necessário
// - Botão "Reconciliar Agora"
// - Ou reconciliar em background (webhook do Braintree)
```

#### **5. Virtual Scrolling**
```typescript
// Renderizar apenas linhas visíveis
import { useVirtualizer } from '@tanstack/react-virtual';

// Renderiza apenas ~20 linhas visíveis
// Resto fica em memória mas não renderizado
```

---

## 🔄 Fluxo Completo de Dados

### **1. Transação no Braintree**
```
Cliente paga €150
↓
Braintree processa
↓
Taxa: €4.65 (2.9% + €0.30)
↓
Líquido: €145.35
```

### **2. Sistema Captura**
```
Webhook recebe notificação
↓
Cria 2 registros:
  - Revenue: €150 (braintree-api-revenue)
  - Fee: -€4.65 (braintree-api-fees)
```

### **3. Disbursement (Alguns Dias Depois)**
```
Braintree agrupa transações
↓
Transfere para banco: €1.453,50
  (10 transações agrupadas)
↓
Webhook "disbursement"
↓
Sistema registra transferência
```

### **4. Reconciliação Bancária**
```
Extrato Bankinter: €1.453,50
↓
Sistema compara:
  - Data: ±3 dias
  - Valor: diferença < €0.01
↓
Match automático ✅
```

---

## 🎯 Campos Essenciais para Reconciliação

### **Dados Necessários:**
```typescript
// 1. Da Transação Braintree
{
  transaction_id: "abc123",
  amount: 150.00,
  currency: "EUR",
  date: "2024-06-15",
  merchantAccountId: "digitalsmiledesignEUR"
}

// 2. Do Disbursement
{
  disbursement_id: "disb_xyz789",
  disbursement_date: "2024-06-18",  // 3 dias depois
  settlement_amount: 145.35,         // Líquido (com fees)
  transactions: ["abc123", "def456"] // Quais transações estão incluídas
}

// 3. Do Extrato Bancário
{
  bank_date: "2024-06-18",
  bank_amount: 145.35,
  bank_description: "Braintree Payments"
}
```

### **Lógica de Match:**
```typescript
// Match por disbursement_id (melhor)
if (transaction.disbursement_id === bankStatement.reference) {
  return MATCH; // ✅ Exato
}

// Match por data + valor (fallback)
if (
  Math.abs(dateDiff) <= 3 &&           // ±3 dias
  Math.abs(valueDiff) < 0.01 &&        // ±€0.01
  transaction.currency === "EUR"
) {
  return MATCH; // ✅ Provável
}
```

---

## 📊 Queries SQL Úteis

### **1. Ver Transações por Moeda**
```sql
SELECT 
  custom_data->>'currency' as currency,
  COUNT(*) as total_transactions,
  SUM(amount::numeric) as total_amount
FROM csv_rows
WHERE source = 'braintree-api-revenue'
GROUP BY custom_data->>'currency'
ORDER BY total_amount DESC;
```

### **2. Transações Não Reconciliadas**
```sql
SELECT 
  date,
  description,
  amount,
  custom_data->>'transaction_id' as braintree_id
FROM csv_rows
WHERE source = 'braintree-api-revenue'
  AND (custom_data->>'conciliado')::boolean = false
ORDER BY date DESC
LIMIT 100;
```

### **3. Fees Totais por Mês**
```sql
SELECT 
  DATE_TRUNC('month', date::date) as month,
  COUNT(*) as transactions,
  ABS(SUM(amount::numeric)) as total_fees,
  ROUND(
    ABS(SUM(amount::numeric)) / 
    NULLIF((SELECT SUM(amount::numeric) 
            FROM csv_rows r2 
            WHERE r2.source = 'braintree-api-revenue'
              AND DATE_TRUNC('month', r2.date::date) = DATE_TRUNC('month', r1.date::date)
    ), 0) * 100, 
  2) as fee_percentage
FROM csv_rows r1
WHERE source = 'braintree-api-fees'
GROUP BY month
ORDER BY month DESC;
```

---

## 🔑 Agrupamento de Payouts via `disbursement_id`

### Problema Resolvido
O Braintree agrupa múltiplas transações em um único payout bancário. Por exemplo, 9 vendas podem ser pagas em 2-4 transferências diferentes para a conta bancária.

### Solução: Campo `disbursement_id`
Cada transação Braintree tem um `disbursementDetails.disbursementId` que identifica o payout ao qual pertence.

### Implementação

#### 1. Captura na API (`src/app/api/braintree/sync/route.ts`)
```typescript
custom_data: {
  // ... outros campos
  disbursement_id: transaction.disbursementDetails?.disbursementId || null,
  disbursement_date: transaction.disbursementDetails?.disbursementDate?.toISOString() || null,
  settlement_amount: transaction.disbursementDetails?.settlementAmount || null,
}
```

#### 2. Visualização na UI (`src/app/reports/braintree-eur/page.tsx`)
- Nova coluna "Disbursement ID (Payout Group)" na tabela
- Exibe primeiros 12 caracteres com estilo `font-mono`
- Badge azul para destacar agrupamento

#### 3. Query SQL para Análise de Agrupamento
```sql
-- Ver todos os payouts agrupados
SELECT 
  custom_data->>'disbursement_id' as payout_id,
  custom_data->>'disbursement_date' as payout_date,
  COUNT(*) as num_transactions,
  SUM(amount::numeric) as total_amount,
  STRING_AGG(custom_data->>'transaction_id', ', ') as transaction_ids
FROM csv_rows
WHERE source = 'braintree-api-revenue'
  AND custom_data->>'disbursement_id' IS NOT NULL
GROUP BY 
  custom_data->>'disbursement_id',
  custom_data->>'disbursement_date'
ORDER BY custom_data->>'disbursement_date' DESC;
```

#### 4. Reconciliação com Bankinter
```sql
-- Encontrar payouts Braintree que correspondem a transferências Bankinter
SELECT 
  b.custom_data->>'disbursement_id' as braintree_payout,
  b.custom_data->>'disbursement_date' as braintree_date,
  SUM(b.amount::numeric) as braintree_total,
  k.date as bankinter_date,
  k.amount as bankinter_amount,
  k.description as bankinter_desc
FROM csv_rows b
LEFT JOIN csv_rows k ON 
  k.source = 'bankinter-eur' 
  AND ABS(EXTRACT(EPOCH FROM (k.date::date - (b.custom_data->>'disbursement_date')::date)) / 86400) <= 3
  AND ABS(k.amount::numeric - SUM(b.amount::numeric)) < 1.00
WHERE b.source = 'braintree-api-revenue'
  AND b.custom_data->>'disbursement_id' IS NOT NULL
GROUP BY 
  b.custom_data->>'disbursement_id',
  b.custom_data->>'disbursement_date',
  k.date, k.amount, k.description
ORDER BY b.custom_data->>'disbursement_date' DESC;
```

### Exemplo de Uso
Se você vê 9 transações Braintree em 2024-01-15, mas apenas 3 transferências bancárias:
1. Agrupe por `disbursement_id` na interface
2. Some os valores de cada grupo
3. Compare com as transferências Bankinter usando a data de disbursement ±3 dias
4. Marque como reconciliado quando valores coincidirem

### Moedas Suportadas
- ✅ EUR (`/reports/braintree-eur`)
- ✅ USD (`/reports/braintree-usd`)
- ✅ GBP (`/reports/braintree-gbp`)

Todas as páginas agora exibem a coluna `Disbursement ID`.

---

**Última atualização:** 31/12/2025
