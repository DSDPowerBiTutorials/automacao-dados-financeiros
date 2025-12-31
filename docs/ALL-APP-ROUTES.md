# 📋 Todas as Rotas da Aplicação

## 🔐 Para Configuração do Supabase Auth

Use esta lista para configurar **Redirect URLs** no Supabase se preferir controle granular.

---

## 🎯 Opção Recomendada (Wildcard)

```
https://dsdfinancehub.com/**
https://*.vercel.app/**
http://localhost:3000/**
```

✅ Esta opção cobre automaticamente todas as 34 rotas abaixo.

---

## 📝 Lista Completa de Rotas (34 páginas)

### 🔐 Autenticação (2)
```
https://dsdfinancehub.com/login
https://dsdfinancehub.com/auth/callback
```

### 🏠 Dashboard (2)
```
https://dsdfinancehub.com/
https://dsdfinancehub.com/dashboard
```

### 💰 Accounts Payable - Contas a Pagar (7)
```
https://dsdfinancehub.com/accounts-payable
https://dsdfinancehub.com/accounts-payable/invoices
https://dsdfinancehub.com/accounts-payable/invoices/payments
https://dsdfinancehub.com/accounts-payable/master-data/bank-accounts
https://dsdfinancehub.com/accounts-payable/master-data/cost-centers
https://dsdfinancehub.com/accounts-payable/master-data/financial-accounts
https://dsdfinancehub.com/accounts-payable/master-data/providers
```

### 📈 Accounts Receivable - Contas a Receber (3)
```
https://dsdfinancehub.com/accounts-receivable
https://dsdfinancehub.com/accounts-receivable/invoices
https://dsdfinancehub.com/accounts-receivable/master-data/customers
```

### ⚡ Actions - Ações (2)
```
https://dsdfinancehub.com/actions/integration-insights
https://dsdfinancehub.com/actions/reconciliation-center
```

### 💵 Cash Management - Gestão de Caixa (2)
```
https://dsdfinancehub.com/cash-management
https://dsdfinancehub.com/cash-management/bank-accounts
```

### 📊 Executive - Relatórios Executivos (5)
```
https://dsdfinancehub.com/executive/cash-flow
https://dsdfinancehub.com/executive/forecasts
https://dsdfinancehub.com/executive/kpis
https://dsdfinancehub.com/executive/performance
https://dsdfinancehub.com/executive/reports
```

### 📉 P&L - Demonstração de Resultados (1)
```
https://dsdfinancehub.com/pnl
```

### 🏦 Bank Reports - Relatórios Bancários (4)
```
https://dsdfinancehub.com/reports/bankinter
https://dsdfinancehub.com/reports/bankinter-eur
https://dsdfinancehub.com/reports/bankinter-usd
https://dsdfinancehub.com/reports/sabadell
```

### 💳 Payment Gateway Reports - Gateways de Pagamento (6)
```
https://dsdfinancehub.com/reports/braintree
https://dsdfinancehub.com/reports/braintree-amex
https://dsdfinancehub.com/reports/braintree-eur
https://dsdfinancehub.com/reports/braintree-transactions
https://dsdfinancehub.com/reports/braintree-usd
https://dsdfinancehub.com/reports/gocardless
https://dsdfinancehub.com/reports/paypal
https://dsdfinancehub.com/reports/stripe
```

---

## 🔧 Como Usar no Supabase

### 1. Acesse a configuração do Auth:
```
https://supabase.com/dashboard/project/rrzgawssbyfzbkmtcovz/auth/url-configuration
```

### 2. Em "Redirect URLs", escolha uma opção:

#### Opção A: Wildcard (Recomendado)
Cole apenas estas 3 linhas:
```
https://dsdfinancehub.com/**
https://*.vercel.app/**
http://localhost:3000/**
```

#### Opção B: Lista Completa
Cole TODAS as 34 URLs acima.

### 3. Clique em "Save"

---

## 📌 Notas Importantes

1. **O `/**` é um wildcard** que significa "todas as rotas a partir daqui"
2. **O `*.vercel.app`** permite preview deployments do Vercel
3. **O `localhost`** permite desenvolvimento local
4. Supabase aceita até **100 Redirect URLs** por projeto
5. Wildcards (`**` e `*`) são oficialmente suportados pelo Supabase

---

## 🔄 Quando Atualizar Esta Lista

Atualize quando:
- ✅ Adicionar nova página/rota no `src/app/`
- ✅ Renomear pasta de rota existente
- ✅ Criar novo módulo ou seção

Para regenerar a lista automaticamente:
```bash
find src/app -name "page.tsx" -type f | sed 's|src/app||' | sed 's|/page.tsx||' | sort
```

---

## 📊 Resumo

| Categoria | Quantidade |
|-----------|------------|
| Autenticação | 2 |
| Dashboard | 2 |
| Accounts Payable | 7 |
| Accounts Receivable | 3 |
| Actions | 2 |
| Cash Management | 2 |
| Executive | 5 |
| P&L | 1 |
| Bank Reports | 4 |
| Payment Gateways | 8 |
| **TOTAL** | **34 rotas** |

---

## ✅ Recomendação Final

**Use a Opção A (Wildcard)**:
```
https://dsdfinancehub.com/**
```

É mais simples, mais seguro, e cobre automaticamente:
- ✅ Todas as 34 rotas atuais
- ✅ Futuras rotas que você criar
- ✅ Query parameters e fragments
- ✅ Dynamic routes

**Desvantagem da lista completa**: Toda vez que criar uma nova página, precisa voltar no Supabase e adicionar manualmente.
