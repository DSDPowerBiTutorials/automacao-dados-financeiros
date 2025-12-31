# Integração Braintree API → ERP Financeiro

**Objetivo:** Sincronizar transações do Braintree automaticamente para alimentar:
- ✅ **Contas a Receber** (receitas)
- ✅ **Contas a Pagar** (fees do Braintree)

---

## 📦 O que foi implementado

### 1. SDK do Braintree
- Instalado `braintree` + `@types/braintree`
- Cliente configurado em [src/lib/braintree.ts](../src/lib/braintree.ts)

### 2. Variáveis de Ambiente
Adicionadas ao `.env.local` e `.env.example`:

```bash
BRAINTREE_MERCHANT_ID=your_merchant_id
BRAINTREE_PUBLIC_KEY=your_public_key
BRAINTREE_PRIVATE_KEY=your_private_key
BRAINTREE_ENVIRONMENT=sandbox  # sandbox | production
```

### 3. API de Sincronização
Endpoint: **`POST /api/braintree/sync`**

**Funcionalidade:**
- Busca transações **settled** (confirmadas) do Braintree em período específico
- Salva no `csv_rows` com **2 registros** por transação:
  1. **Receita** → `source: "braintree-api-revenue"`  
  2. **Fee** → `source: "braintree-api-fees"` (valor negativo)

---

## 🚀 Como usar

### 1️⃣ Pegar credenciais no Braintree

1. Acesse o [Braintree Dashboard](https://sandbox.braintreegateway.com/) (Sandbox ou Production)
2. Vá em **Settings → API Keys**
3. Copie:
   - Merchant ID
   - Public Key
   - Private Key

### 2️⃣ Configurar `.env.local`

```bash
BRAINTREE_MERCHANT_ID=abc123def456
BRAINTREE_PUBLIC_KEY=xyz789uvw012
BRAINTREE_PRIVATE_KEY=secret_key_here
BRAINTREE_ENVIRONMENT=sandbox
```

### 3️⃣ Sincronizar transações

#### Via API (POST)

```bash
curl -X POST http://localhost:3000/api/braintree/sync \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-12-01",
    "endDate": "2024-12-31",
    "currency": "EUR"
  }'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Sincronização concluída com sucesso",
  "data": {
    "period": { "start": "2024-12-01", "end": "2024-12-31" },
    "transactions_processed": 45,
    "revenue_rows_inserted": 45,
    "fee_rows_inserted": 45,
    "total_revenue": 12450.00,
    "total_fees": 382.50,
    "net_amount": 12067.50,
    "currency": "EUR"
  }
}
```

#### Via código (Next.js)

```typescript
const response = await fetch("/api/braintree/sync", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    startDate: "2024-12-01",
    endDate: "2024-12-31",
    currency: "EUR",
  }),
});

const result = await response.json();
console.log(result);
```

### 4️⃣ Ver estatísticas

```bash
curl http://localhost:3000/api/braintree/sync
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "last_sync": {
      "revenue": { "date": "2024-12-31", "amount": 150.00 },
      "fee": { "date": "2024-12-31", "amount": -4.65 }
    },
    "totals": {
      "revenue_transactions": 123,
      "fee_transactions": 123
    }
  }
}
```

---

## 📊 Como os dados são salvos

### Tabela: `csv_rows`

Cada transação do Braintree vira **2 linhas** no `csv_rows`:

#### 1. Receita (Contas a Receber)

| Campo          | Valor                                |
|----------------|--------------------------------------|
| `source`       | `"braintree-api-revenue"`            |
| `date`         | Data da transação                    |
| `description`  | Nome do cliente + método pagamento   |
| `amount`       | Valor positivo (ex: 150.00)          |
| `reconciled`   | `false` (aguardando reconciliação)   |
| `custom_data`  | JSON com dados completos (veja abaixo) |

**Exemplo de `custom_data` (JSONB):**
```json
{
  "transaction_id": "abc123",
  "status": "settled",
  "type": "sale",
  "currency": "EUR",
  "customer_id": "cust_456",
  "customer_name": "João Silva",
  "customer_email": "joao@example.com",
  "payment_method": "Visa ****1234",
  "merchant_account_id": "merchant_eur",
  "created_at": "2024-12-15T10:30:00Z",
  "updated_at": "2024-12-15T10:35:00Z"
}
```

#### 2. Fee (Contas a Pagar)

| Campo          | Valor                                |
|----------------|--------------------------------------|
| `source`       | `"braintree-api-fees"`               |
| `date`         | Data da transação                    |
| `description`  | `"Fee Braintree - abc123"`           |
| `amount`       | **Valor negativo** (ex: -4.65)       |
| `reconciled`   | `false`                              |
| `custom_data`  | JSON com referência à transação      |

**Exemplo de `custom_data` (fee):**
```json
{
  "transaction_id": "abc123",
  "related_revenue_amount": 150.00,
  "currency": "EUR",
  "fee_type": "braintree_processing_fee",
  "merchant_account_id": "merchant_eur"
}
```

---

## 🔄 Fluxo completo

```mermaid
graph LR
    A[Braintree Gateway] -->|API| B[/api/braintree/sync]
    B -->|Transação| C[csv_rows: revenue]
    B -->|Fee| D[csv_rows: fees]
    C -->|Reconciliação| E[Contas a Receber]
    D -->|Reconciliação| F[Contas a Pagar]
```

### Passos:
1. **Braintree** processa pagamento do cliente
2. **API Sync** busca transação settled
3. Cria **2 registros** no `csv_rows`:
   - Receita (positiva) → depois vira **Contas a Receber**
   - Fee (negativo) → depois vira **Contas a Pagar**
4. Sistema de **reconciliação** processa os registros

---

## 🎯 Uso em páginas de relatório

### Filtrar receitas do Braintree

```typescript
const { data: revenues } = await supabase
  .from("csv_rows")
  .select("*")
  .eq("source", "braintree-api-revenue")
  .eq("reconciled", false)
  .order("date", { ascending: false });
```

### Filtrar fees do Braintree

```typescript
const { data: fees } = await supabase
  .from("csv_rows")
  .select("*")
  .eq("source", "braintree-api-fees")
  .eq("reconciled", false)
  .order("date", { ascending: false });
```

---

## 🔧 Helpers disponíveis

Em [src/lib/braintree.ts](../src/lib/braintree.ts):

### `searchTransactions(startDate, endDate, options?)`
Busca transações em intervalo de datas.

```typescript
import { searchTransactions } from "@/lib/braintree";

const transactions = await searchTransactions(
  new Date("2024-12-01"),
  new Date("2024-12-31"),
  {
    status: [braintree.Transaction.Status.Settled],
    limit: 100,
  }
);
```

### `getTransaction(transactionId)`
Busca transação específica por ID.

```typescript
import { getTransaction } from "@/lib/braintree";

const transaction = await getTransaction("abc123");
console.log(transaction.amount);
```

### `calculateTransactionFee(transaction)`
Calcula fee total da transação.

```typescript
import { calculateTransactionFee } from "@/lib/braintree";

const fee = calculateTransactionFee(transaction);
console.log(`Fee: ${fee}`); // 4.65
```

### `getCustomerName(transaction)`
Extrai nome do cliente.

```typescript
import { getCustomerName } from "@/lib/braintree";

const name = getCustomerName(transaction);
console.log(name); // "João Silva"
```

### `getPaymentMethod(transaction)`
Extrai método de pagamento formatado.

```typescript
import { getPaymentMethod } from "@/lib/braintree";

const method = getPaymentMethod(transaction);
console.log(method); // "Visa ****1234"
```

---

## 📅 Automação (próximos passos)

### Opção 1: Cron job diário

Adicionar em `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/braintree/sync",
    "schedule": "0 2 * * *"
  }]
}
```

Modifica API para aceitar chamadas sem body (busca ontem):

```typescript
const startDate = body.startDate || getYesterday();
const endDate = body.endDate || getToday();
```

### Opção 2: Webhook do Braintree

1. Configure webhook no Braintree Dashboard
2. Crie `/api/braintree/webhook`
3. Processe eventos em tempo real:
   - `transaction_settled`
   - `transaction_settlement_declined`

---

## ⚠️ Checklist de segurança

- ✅ Credenciais em `.env.local` (nunca no código)
- ✅ `.env.local` no `.gitignore`
- ✅ Usar `BRAINTREE_ENVIRONMENT=sandbox` em dev
- ✅ Validar inputs na API (datas, moedas)
- ✅ Usar `supabaseAdmin` (server-side only)
- ⚠️ Produção: adicionar autenticação na API (middleware)
- ⚠️ Produção: rate limiting (ex: 10 req/min)

---

## 🐛 Troubleshooting

### Erro: "Missing required environment variable"
- Verifique se `.env.local` tem todas as 4 variáveis do Braintree
- Reinicie `npm run dev` após adicionar variáveis

### Erro: "Authentication error"
- Confirme que as credenciais estão corretas
- Sandbox: use credenciais do Sandbox
- Production: use credenciais de Production

### Transações não aparecem
- Verifique se as transações estão no status `Settled` (não `Authorized`)
- Confirme período de datas (formato `YYYY-MM-DD`)
- Limite de resultados: remova `options.limit` para buscar todas

### Fees não são calculados
- Verifique se `serviceFeeAmount` está disponível no Braintree
- Alguns merchant accounts não retornam fees via API (configure manualmente)

---

## 📚 Referências

- [Braintree API Docs](https://developer.paypal.com/braintree/docs)
- [Transaction Search](https://developer.paypal.com/braintree/docs/reference/request/transaction/search)
- [Webhooks](https://developer.paypal.com/braintree/docs/guides/webhooks)
- [Sandbox Testing](https://developer.paypal.com/braintree/docs/start/hello-server)

---

## 💡 Próximos passos sugeridos

1. **Testar sincronização** com dados reais do Sandbox
2. **Criar página de relatório** em `/reports/braintree-api`
3. **Implementar webhook** para sincronização em tempo real
4. **Adicionar filtros** por moeda (EUR/USD/GBP)
5. **Integrar reconciliação automática** com extratos bancários

---

**Precisa de ajuda?** Revise os logs em `console` ou adicione `console.log` nos helpers de [src/lib/braintree.ts](../src/lib/braintree.ts).
