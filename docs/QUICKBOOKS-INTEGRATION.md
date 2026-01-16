# 🇺🇸 QuickBooks Online Integration

## Visão Geral

Integração completa com o QuickBooks Online para sincronização de dados financeiros do escopo **Estados Unidos (USD)**.

**Empresa:** DSD Planning LLC  
**Escopo:** EUA / USD  
**Status:** ✅ Configurado

---

## 📁 Arquivos da Integração

| Arquivo | Descrição |
|---------|-----------|
| `src/lib/quickbooks.ts` | Biblioteca principal com OAuth2 e API calls |
| `src/app/api/quickbooks/auth/route.ts` | Início do fluxo OAuth2 |
| `src/app/api/quickbooks/callback/route.ts` | Callback OAuth2 |
| `src/app/api/quickbooks/sync/route.ts` | Endpoint de sincronização |
| `src/app/api/quickbooks/disconnect/route.ts` | Desconexão da integração |
| `src/app/api/quickbooks/reports/route.ts` | Relatórios financeiros |
| `src/app/api/webhooks/quickbooks/route.ts` | Webhook handler (real-time) |
| `src/app/api/cron/daily-sync/route.ts` | Cron job unificado (inclui QB) |
| `src/app/reports/quickbooks-usd/page.tsx` | Página de relatórios |
| `migrations/20260116_quickbooks_full_integration.sql` | Migração SQL |

---

## 🔐 Variáveis de Ambiente

```env
# QuickBooks OAuth2
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
QUICKBOOKS_REDIRECT_URI=https://www.dsdfinancehub.com/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=production  # ou "sandbox" para testes

# Webhook (opcional, mas recomendado)
QUICKBOOKS_WEBHOOK_VERIFIER=your_webhook_verifier_token
```

---

## 📊 Entidades Sincronizadas

### Transações (armazenadas em `csv_rows`)

| Entidade | Source | Descrição |
|----------|--------|-----------|
| Invoices | `quickbooks-invoices` | Faturas emitidas (Accounts Receivable) |
| Payments | `quickbooks-payments` | Pagamentos recebidos |
| Bills | `quickbooks-bills` | Contas a pagar (Accounts Payable) |
| Expenses | `quickbooks-expenses` | Despesas/Compras |

### Master Data (tabelas dedicadas)

| Tabela | Descrição |
|--------|-----------|
| `quickbooks_customers` | Clientes do QuickBooks |
| `quickbooks_vendors` | Fornecedores do QuickBooks |
| `quickbooks_accounts` | Plano de Contas |

---

## 🔄 Fluxos de Sincronização

### 1. Sincronização Manual

```bash
# Verificar status da conexão
GET /api/quickbooks/sync

# Sincronizar todos os dados (últimos 30 dias)
POST /api/quickbooks/sync
Content-Type: application/json
{
  "syncType": "all"  # ou "invoices", "payments", "bills", "expenses"
}

# Sincronizar desde uma data específica
POST /api/quickbooks/sync
Content-Type: application/json
{
  "startDate": "2025-01-01",
  "syncType": "all"
}
```

### 2. Sincronização Automática (Cron)

O QuickBooks é sincronizado automaticamente pelo cron job unificado:

- **Endpoint:** `GET /api/cron/daily-sync`
- **Frequência:** Diária às 4h UTC
- **Período:** Últimos 30 dias
- **Ordem:** 7º na fila (após Braintree, GoCardless, HubSpot, Products, Stripe)

### 3. Sincronização Real-Time (Webhooks)

O webhook recebe notificações do QuickBooks quando:

- Invoices são criados/atualizados
- Payments são registrados
- Bills são adicionados
- Expenses/Purchases são criados
- Customers são modificados
- Vendors são modificados

**Webhook URL:** `https://www.dsdfinancehub.com/api/webhooks/quickbooks`

---

## ⚙️ Configuração do Webhook no Portal Intuit

1. Acesse: https://developer.intuit.com/app/developer/dashboard
2. Selecione seu app
3. Vá para **Webhooks**
4. Clique em **Add webhook**
5. Configure:
   - **URL:** `https://www.dsdfinancehub.com/api/webhooks/quickbooks`
   - **Events:** 
     - Invoice (Create, Update, Delete)
     - Payment (Create, Update)
     - Bill (Create, Update)
     - Purchase (Create, Update)
     - Customer (Create, Update, Merge)
     - Vendor (Create, Update, Merge)
6. Copie o **Verifier Token** e adicione como `QUICKBOOKS_WEBHOOK_VERIFIER`

---

## 📈 Estrutura dos Dados

### Invoice (csv_rows)

```json
{
  "id": "qb-invoice-123",
  "source": "quickbooks-invoices",
  "date": "2025-01-15",
  "description": "Invoice #INV-001 - Customer Name",
  "amount": "1500.00",
  "category": "Revenue",
  "classification": "Invoice",
  "reconciled": false,
  "custom_data": {
    "quickbooks_id": "123",
    "doc_number": "INV-001",
    "customer_name": "Customer Name",
    "customer_id": "456",
    "due_date": "2025-02-15",
    "balance": 1500.00,
    "total_amount": 1500.00,
    "currency": "USD",
    "synced_at": "2025-01-16T10:00:00Z"
  }
}
```

### Bill (csv_rows)

```json
{
  "id": "qb-bill-789",
  "source": "quickbooks-bills",
  "date": "2025-01-10",
  "description": "Bill #BILL-001 - Vendor Name",
  "amount": "-500.00",  // Negativo pois é conta a pagar
  "category": "Expense",
  "classification": "Bill",
  "reconciled": false,
  "custom_data": {
    "quickbooks_id": "789",
    "doc_number": "BILL-001",
    "vendor_name": "Vendor Name",
    "vendor_id": "321",
    "due_date": "2025-02-10",
    "balance": 500.00,
    "total_amount": 500.00,
    "ap_account": "Accounts Payable",
    "currency": "USD",
    "line_items": [
      {
        "description": "Software License",
        "amount": 500.00,
        "account": "Software Expenses"
      }
    ],
    "synced_at": "2025-01-16T10:00:00Z"
  }
}
```

---

## 🗄️ Views SQL Úteis

```sql
-- Ver todas as transações QuickBooks
SELECT * FROM v_quickbooks_transactions;

-- Resumo por tipo
SELECT * FROM v_quickbooks_summary;

-- Faturas em aberto (Accounts Receivable)
SELECT * FROM v_quickbooks_open_invoices;

-- Contas a pagar em aberto (Accounts Payable)
SELECT * FROM v_quickbooks_open_bills;
```

---

## 🔗 Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/quickbooks/auth` | Iniciar OAuth2 |
| GET | `/api/quickbooks/callback` | Callback OAuth2 |
| POST | `/api/quickbooks/disconnect` | Desconectar |
| GET | `/api/quickbooks/sync` | Status da conexão |
| POST | `/api/quickbooks/sync` | Sincronizar dados |
| GET | `/api/quickbooks/reports?type=pnl` | Relatório P&L |
| GET | `/api/quickbooks/reports?type=balance-sheet` | Balanço |
| POST | `/api/webhooks/quickbooks` | Receber webhooks |

---

## 🛡️ Segurança

1. **Tokens OAuth2** armazenados na tabela `quickbooks_tokens` com refresh automático
2. **Webhook Signature** validada via HMAC-SHA256
3. **Rate Limits** respeitados (500 req/min)
4. **Tokens expiram:**
   - Access Token: 1 hora
   - Refresh Token: 100 dias

---

## 🐛 Troubleshooting

### Erro: "Token expired"
- O sistema faz refresh automático do token
- Se persistir, reconectar via `/api/quickbooks/auth`

### Erro: "Rate limit exceeded"
- Aguardar 1 minuto
- Considerar aumentar intervalo do cron

### Webhook não recebido
- Verificar URL configurada no portal Intuit
- Verificar logs em `webhook_logs`
- Verificar `QUICKBOOKS_WEBHOOK_VERIFIER`

### Dados desatualizados
- Executar sync manual: `POST /api/quickbooks/sync`
- Verificar `sync_metadata` para última sincronização

---

## 📅 Histórico de Implementação

| Data | Versão | Mudanças |
|------|--------|----------|
| 2026-01-16 | 1.0 | Implementação inicial completa |

---

## 📚 Referências

- [QuickBooks API Documentation](https://developer.intuit.com/app/developer/qbo/docs/get-started)
- [OAuth2 Guide](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization)
- [Webhooks Guide](https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks)
- [API Reference](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account)
