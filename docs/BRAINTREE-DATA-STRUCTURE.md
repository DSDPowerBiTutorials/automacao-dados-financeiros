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

## 🚀 Melhorias Recomendadas

### **Curto Prazo (Esta Semana):**
1. ✅ Adicionar índices no Supabase
2. ✅ Implementar paginação na interface
3. ✅ Desabilitar reconciliação automática (fazer sob demanda)
4. ✅ Separar páginas por moeda (EUR, USD, GBP, AUD)

### **Médio Prazo (Este Mês):**
1. 📊 Implementar captura de disbursements
2. 🔄 Reconciliação bancária automatizada
3. 📈 Dashboard com métricas por moeda
4. 🔍 Busca e filtros avançados

### **Longo Prazo (Este Trimestre):**
1. 📱 Virtual scrolling para milhares de registros
2. 🤖 Machine learning para sugerir reconciliações
3. 📧 Alertas automáticos para discrepâncias
4. 🌐 Suporte multi-idioma

---

**Última atualização:** 31/12/2025
