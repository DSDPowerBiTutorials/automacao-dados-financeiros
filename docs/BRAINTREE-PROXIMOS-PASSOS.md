# 🚀 Próximos Passos - Integração Braintree

## ✅ Status Atual (31/12/2025)

**Tudo funcionando:**
- ✅ API conectada e autenticada (production)
- ✅ Endpoint de sincronização funcionando
- ✅ Webhook configurado e pronto
- ✅ 300+ transações detectadas no histórico
- ✅ Interface com botão de sincronização

---

## 📋 Ações Recomendadas (em ordem de prioridade)

### 1. 🔄 Sincronizar Transações Históricas (AGORA)

**Objetivo:** Importar todo o histórico de transações do Braintree para o sistema.

**Passos:**

#### Opção A: Via Interface (Mais Fácil)

1. Acesse: http://localhost:3000/reports/braintree-eur
2. Clique em **"⚡ Sincronizar API Braintree"**
3. Configure o período:
   - **Data Inicial:** `2024-01-01`
   - **Data Final:** `2024-12-31`
   - **Moeda:** `EUR`
4. Clique em **"Sincronizar"**
5. Aguarde processamento (pode levar 1-2 minutos para 300+ transações)

Repita para outras moedas se necessário:
- USD: http://localhost:3000/reports/braintree-usd
- AMEX: http://localhost:3000/reports/braintree-amex

#### Opção B: Via API (Para automação futura)

```bash
# Sincronizar ano de 2024 - EUR
curl -X POST https://dsdfinancehub.com/api/braintree/sync \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "currency": "EUR"
  }'

# Sincronizar ano de 2024 - USD
curl -X POST https://dsdfinancehub.com/api/braintree/sync \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "currency": "USD"
  }'
```

**Resultado esperado:**
- Todas as transações liquidadas (settled) serão importadas
- Cada transação gera 2 registros:
  - **Receita** (`braintree-api-revenue`) → para Contas a Receber
  - **Fee** (`braintree-api-fees`) → para Contas a Pagar

---

### 2. 🎯 Realizar Conciliação Automática com Bankinter

**Objetivo:** Vincular transações do Braintree com os ingressos bancários do Bankinter.

**O que acontece:**
- Sistema compara datas (±3 dias de tolerância)
- Sistema compara valores (diferença < €0.01)
- Se houver match:
  - ✅ Marca como **conciliado**
  - ⚡ Define tipo: **automatic**
  - 🏦 Vincula à conta destino: **Bankinter EUR/USD**

**Como fazer:**

1. Certifique-se de ter dados do Bankinter importados:
   - Acesse: http://localhost:3000/reports/bankinter-eur
   - Verifique se há lançamentos bancários

2. A conciliação acontece **automaticamente** quando:
   - Você carrega a página `/reports/braintree-eur`
   - Você importa novos dados do Braintree
   - O sistema detecta novas transações via webhook

3. Para forçar reconciliação manual:
   - Abra o arquivo [src/app/reports/braintree-eur/page.tsx](../src/app/reports/braintree-eur/page.tsx)
   - A função `reconcileBankStatements()` é chamada automaticamente

**Verificar conciliação:**
```sql
-- Transações conciliadas automaticamente
SELECT 
  date,
  description,
  amount,
  custom_data->>'destinationAccount' as conta_destino,
  custom_data->>'reconciliationType' as tipo
FROM csv_rows
WHERE source = 'braintree-api-revenue'
  AND custom_data->>'conciliado' = 'true'
ORDER BY date DESC;
```

---

### 3. 📊 Criar Dashboard de Receitas vs Fees

**Objetivo:** Visualizar receita líquida (depois das taxas do Braintree).

**Criar página:** `/dashboard/braintree-summary`

**Métricas importantes:**
- Total de receitas (revenue)
- Total de fees
- Receita líquida (net amount)
- Taxa média (fee %)
- Transações por mês
- Taxa de conciliação (% conciliado)

**Query SQL de exemplo:**

```sql
-- Resumo mensal
SELECT 
  TO_CHAR(DATE_TRUNC('month', date::date), 'YYYY-MM') as mes,
  COUNT(*) FILTER (WHERE source = 'braintree-api-revenue') as total_transacoes,
  SUM(amount::numeric) FILTER (WHERE source = 'braintree-api-revenue') as receita_total,
  SUM(amount::numeric) FILTER (WHERE source = 'braintree-api-fees') as fees_total,
  SUM(amount::numeric) FILTER (WHERE source = 'braintree-api-revenue') + 
    SUM(amount::numeric) FILTER (WHERE source = 'braintree-api-fees') as receita_liquida,
  COUNT(*) FILTER (
    WHERE source = 'braintree-api-revenue' 
    AND custom_data->>'conciliado' = 'true'
  ) as transacoes_conciliadas
FROM csv_rows
WHERE source LIKE 'braintree-api-%'
GROUP BY mes
ORDER BY mes DESC;
```

---

### 4. 🔔 Testar Webhook em Produção

**Objetivo:** Garantir que novas transações apareçam automaticamente.

**Passos:**

1. **Criar transação de teste no Braintree:**
   - Acesse: https://sandbox.braintreegateway.com/ (ou production)
   - Vá em: **Transactions** → **Test Transactions**
   - Crie uma transação de teste

2. **Verificar se webhook foi acionado:**
   - Verifique logs do Vercel (ou terminal local)
   - Deve aparecer:
     ```
     [Braintree Webhook] Received: subscription_charged_successfully for 2025-12-31T...
     [Braintree Webhook] ✅ Transação abc123 processada: €150.00
     ```

3. **Confirmar dados no sistema:**
   - Acesse: http://localhost:3000/reports/braintree-eur
   - Deve aparecer a nova transação **automaticamente**

4. **Se não funcionar:**
   - Verifique configuração do webhook no painel do Braintree
   - URL deve ser: `https://dsdfinancehub.com/api/braintree/webhook`
   - Eventos selecionados devem incluir: `subscription_charged_successfully`

---

### 5. 🤖 Automatizar Sincronização Diária

**Objetivo:** Sistema sempre atualizado sem intervenção manual.

**Opções:**

#### A. Cron Job no Vercel

Criar arquivo: `/api/cron/braintree-sync.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Verificar autorização (token secreto)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Sincronizar últimos 7 dias
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/braintree/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        currency: "EUR",
      }),
    });

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: "Sincronização automática concluída",
      data: result.data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

**Configurar no Vercel:**
1. Adicione variável: `CRON_SECRET=seu_token_secreto`
2. Em `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/braintree-sync",
    "schedule": "0 2 * * *"
  }]
}
```

#### B. GitHub Actions

Criar arquivo: `.github/workflows/braintree-sync.yml`

```yaml
name: Sincronizar Braintree

on:
  schedule:
    - cron: '0 2 * * *'  # Todos os dias às 2h AM UTC
  workflow_dispatch:  # Permitir execução manual

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Sincronizar transações EUR
        run: |
          curl -X POST https://dsdfinancehub.com/api/braintree/sync \
            -H "Content-Type: application/json" \
            -d '{
              "startDate": "'$(date -d '7 days ago' +%Y-%m-%d)'",
              "endDate": "'$(date +%Y-%m-%d)'",
              "currency": "EUR"
            }'
```

---

### 6. 📈 Relatórios e Análises

**Criar relatórios específicos:**

#### A. Receitas por Cliente

```sql
SELECT 
  custom_data->>'customer_name' as cliente,
  custom_data->>'customer_email' as email,
  COUNT(*) as total_transacoes,
  SUM(amount::numeric) as receita_total,
  AVG(amount::numeric) as ticket_medio
FROM csv_rows
WHERE source = 'braintree-api-revenue'
GROUP BY cliente, email
ORDER BY receita_total DESC
LIMIT 20;
```

#### B. Métodos de Pagamento Mais Usados

```sql
SELECT 
  custom_data->>'payment_method' as metodo_pagamento,
  COUNT(*) as total_transacoes,
  SUM(amount::numeric) as receita_total,
  ROUND(AVG(amount::numeric), 2) as ticket_medio
FROM csv_rows
WHERE source = 'braintree-api-revenue'
GROUP BY metodo_pagamento
ORDER BY total_transacoes DESC;
```

#### C. Taxa Média por Mês

```sql
SELECT 
  TO_CHAR(DATE_TRUNC('month', date::date), 'YYYY-MM') as mes,
  SUM(amount::numeric) FILTER (WHERE source = 'braintree-api-revenue') as receita,
  ABS(SUM(amount::numeric) FILTER (WHERE source = 'braintree-api-fees')) as fees,
  ROUND(
    (ABS(SUM(amount::numeric) FILTER (WHERE source = 'braintree-api-fees')) / 
     NULLIF(SUM(amount::numeric) FILTER (WHERE source = 'braintree-api-revenue'), 0)) * 100, 
    2
  ) as taxa_percentual
FROM csv_rows
WHERE source LIKE 'braintree-api-%'
GROUP BY mes
ORDER BY mes DESC;
```

---

### 7. 🔒 Melhorias de Segurança

**Adicionar validações extras:**

1. **Rate Limiting no webhook:**
   - Limitar requisições por IP
   - Prevenir ataques DDoS

2. **Validação de duplicate transactions:**
   - Verificar se transaction_id já existe antes de inserir
   - Adicionar constraint UNIQUE no banco

3. **Logs de auditoria:**
   - Registrar todas as sincronizações
   - Tracking de quem fez reconciliações manuais

---

## 📚 Documentos Relacionados

- [BRAINTREE-STATUS-2025.md](./BRAINTREE-STATUS-2025.md) - Status atual e testes
- [BRAINTREE-INTEGRATION.md](./BRAINTREE-INTEGRATION.md) - Documentação técnica
- [BRAINTREE-WEBHOOK-SETUP.md](./BRAINTREE-WEBHOOK-SETUP.md) - Setup do webhook

---

## 🎯 Checklist de Implementação

- [ ] Sincronizar transações históricas (2024)
- [ ] Verificar conciliação automática com Bankinter
- [ ] Criar dashboard de receitas vs fees
- [ ] Testar webhook em produção
- [ ] Configurar sincronização automática diária
- [ ] Criar relatórios de análise
- [ ] Implementar melhorias de segurança
- [ ] Documentar processos para equipe

---

## 💡 Dicas Importantes

1. **Sempre teste em período pequeno primeiro:**
   - Sincronize 1 mês antes de fazer o ano inteiro
   - Verifique se dados estão corretos

2. **Monitore taxas do Braintree:**
   - Compare fees calculados vs. faturas reais
   - Alerte se houver discrepâncias

3. **Backup antes de grandes imports:**
   - Exporte dados atuais do Supabase
   - Tenha rollback plan

4. **Performance:**
   - Grandes volumes (1000+ transações) podem demorar
   - Considere processar em batches de 100

---

## 🆘 Troubleshooting

### Problema: Sincronização muito lenta
**Solução:** Reduza período ou adicione paginação

### Problema: Transações duplicadas
**Solução:** Adicione verificação de duplicate no código:
```typescript
const { data: existing } = await supabase
  .from("csv_rows")
  .select("id")
  .eq("custom_data->>transaction_id", transaction.id)
  .single();

if (existing) {
  console.log(`Transação ${transaction.id} já existe, pulando...`);
  continue;
}
```

### Problema: Webhook não está sendo chamado
**Soluções:**
1. Verifique URL no painel do Braintree
2. Teste manualmente: "Send Test Notification"
3. Verifique logs do Vercel
4. Confirme que endpoint `/api/braintree/webhook` está acessível

---

**Última atualização:** 31/12/2025  
**Próxima revisão:** Após sincronização inicial completa
