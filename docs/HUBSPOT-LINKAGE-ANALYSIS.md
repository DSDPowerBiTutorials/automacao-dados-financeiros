# 🎯 DESCOBERTAS: Linkagem HubSpot ↔ Payment Channels

**Data:** 5 Janeiro 2026  
**Status:** ✅ Fase de Investigação Concluída

---

## 📊 RESUMO DAS DESCOBERTAS

### ✅ O QUE ENCONTRAMOS

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  HUBSPOT SQL SERVER - ESTRUTURA COMPLETA                   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                             ┃
┃  📦 Total de Tabelas: 133                                  ┃
┃                                                             ┃
┃  ✅ Deal (239 colunas)                                     ┃
┃  ✅ Contact (1.024 colunas)                                ┃
┃  ✅ Company (242 colunas)                                  ┃
┃  ✅ LineItem (97 colunas)                                  ┃
┃  ✅ Invoice (118 colunas) ⭐                               ┃
┃  ✅ Payment (123 colunas) ⭐⭐⭐                            ┃
┃  ✅ Order (104 colunas) ⭐                                 ┃
┃                                                             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## 🔑 CAMPOS-CHAVE PARA LINKAGEM

### 📋 **Tabela: Invoice** (118 colunas)

| Campo | Tipo | Uso para Linkagem |
|-------|------|-------------------|
| `InvoiceId` | bigint | ID único HubSpot |
| `hs_unique_id` | nvarchar | **Número da fatura** ⭐ |
| `hs_external_invoice_id` | nvarchar | **ID externo** ⭐⭐⭐ |
| `hs_invoice_latest_contact_email` | nvarchar | **Email do cliente** ⭐⭐⭐ |
| `hs_invoice_date` | datetime | Data de emissão |
| `hs_due_date` | datetime | Data de vencimento |
| `hs_amount_billed` | numeric | Valor faturado |
| `hs_amount_paid` | numeric | Valor pago |
| `hs_invoice_status` | nvarchar | Status (paid/pending/overdue) |
| `hs_payment_date` | datetime | Data do pagamento |
| `hs_purchase_order_number` | nvarchar | Número do pedido de compra |

**Relação com Deal:**
```
Invoice ←→ InvoiceDealAssociations ←→ Deal
```

---

### 💳 **Tabela: Payment** (123 colunas)

| Campo | Tipo | Uso para Linkagem |
|-------|------|-------------------|
| `PaymentId` | bigint | ID único HubSpot |
| `hs_reference_number` | nvarchar | Número de referência |
| `hs_external_reference_id` | nvarchar | **🎯 ID EXTERNO** ⭐⭐⭐ |
| `hs_payment_source_name` | nvarchar | **Gateway** (Braintree/Stripe/GoCardless) |
| `hs_payment_method_type` | nvarchar | Tipo de pagamento |
| `hs_customer_email` | nvarchar | **Email do cliente** ⭐⭐⭐ |
| `hs_net_amount` | numeric | Valor líquido |
| `hs_initiated_date` | datetime | Data de início |
| `hs_payout_date` | datetime | Data do payout |
| `hs_payment_id` | bigint | ID do pagamento |
| `hs_internal_payment_id` | numeric | ID interno |
| `hs_external_payment_method_id` | nvarchar | ID do método de pagamento externo |

**Relação com Deal:**
```
Payment ←→ PaymentDealAssociations ←→ Deal
```

**Relação com Invoice:**
```
Payment ←→ PaymentInvoiceAssociations ←→ Invoice
```

---

### 📦 **Tabela: Order** (104 colunas)

| Campo | Tipo | Uso para Linkagem |
|-------|------|-------------------|
| `OrderId` | bigint | ID único HubSpot |
| `hs_external_order_id` | nvarchar | **ID externo do pedido** ⭐⭐⭐ |
| `hs_external_cart_id` | nvarchar | ID do carrinho |
| `hs_external_checkout_id` | nvarchar | ID do checkout |
| `hs_billing_address_email` | nvarchar | **Email de cobrança** ⭐⭐ |
| `hs_homecurrency_amount` | numeric | Valor na moeda local |
| `hs_external_created_date` | datetime | Data de criação externa |
| `hs_processed_date` | datetime | Data de processamento |
| `hs_shipping_tracking_number` | nvarchar | Número de rastreio |

**Relação com Deal:**
```
Order ←→ OrderDealAssociations ←→ Deal
```

---

## 🎯 ESTRATÉGIA DE LINKAGEM RECOMENDADA

### **Critério 1: Email do Cliente** (PRIORIDADE MÁXIMA ⭐⭐⭐)

```sql
-- HubSpot
Contact.email

-- Payment Channels
Braintree: customer_email ✅
GoCardless: customer_email ✅
Stripe: ❌ (precisa adicionar)
```

**Cobertura:** 83.3% dos deals têm email (5 de 6 deals recentes)

---

### **Critério 2: External Reference ID** (IDEAL SE DISPONÍVEL)

```sql
-- HubSpot
Payment.hs_external_reference_id
Invoice.hs_external_invoice_id
Order.hs_external_order_id

-- Payment Channels
Braintree: transaction_id
GoCardless: payment_id, payout_id
Stripe: transaction_id
```

**Status Atual:** ⚠️ Tabelas Payment/Invoice/Order estão **vazias** no banco
- Total Invoices: 0
- Total Payments: 0  
- Total Orders: 0

**Motivo:** Essas tabelas só são populadas quando o HubSpot Payments ou integrações específicas são usadas.

---

### **Critério 3: Valor + Data** (FALLBACK SEMPRE DISPONÍVEL)

```sql
-- HubSpot
Deal.amount + Deal.closedate

-- Payment Channels
amount + date (todos têm) ✅
```

**Tolerância:**
- Data: ±3 dias
- Valor: ±€0.01

**Cobertura:** 100% (todos os deals têm esses campos)

---

## 📈 ESTATÍSTICAS DE COBERTURA

### Deals Recentes (desde 2024)

```
┌─────────────────────────────────────────────────────────┐
│  Total de Deals Ganhos: 6                               │
├─────────────────────────────────────────────────────────┤
│  ✅ Com Email: 5 (83.3%)                                │
│  ❌ Com Invoice: 0 (0.0%)                               │
│  ❌ Com Payment: 0 (0.0%)                               │
│  ❌ Com Order: 0 (0.0%)                                 │
│  ✅ Com Amount + Date: 6 (100%)                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 PLANO DE AÇÃO ATUALIZADO

### ✅ FASE 1: LINKAGEM POR EMAIL + VALOR + DATA (Implementar Agora)

**Justificativa:** É o método mais confiável com os dados disponíveis

**Algoritmo:**
```javascript
function matchDealWithPayment(deal, payment) {
  // 1. Match por email (se ambos tiverem)
  if (deal.customer_email && payment.customer_email) {
    if (deal.customer_email.toLowerCase() === payment.customer_email.toLowerCase()) {
      
      // 2. Verificar proximidade de data (±3 dias)
      const dateDiff = Math.abs(deal.closedate - payment.date);
      if (dateDiff <= 3 * 24 * 60 * 60 * 1000) { // 3 dias em ms
        
        // 3. Verificar proximidade de valor (±€0.01)
        const amountDiff = Math.abs(deal.amount - payment.amount);
        if (amountDiff <= 0.01) {
          return { match: true, confidence: 95 }; // 95% confiança
        }
      }
    }
  }
  
  // Fallback: apenas valor + data (sem email)
  const dateDiff = Math.abs(deal.closedate - payment.date);
  const amountDiff = Math.abs(deal.amount - payment.amount);
  
  if (dateDiff <= 3 * 24 * 60 * 60 * 1000 && amountDiff <= 0.01) {
    return { match: true, confidence: 70 }; // 70% confiança (sem email)
  }
  
  return { match: false, confidence: 0 };
}
```

**Tarefas:**
1. ✅ Investigar estrutura do HubSpot (COMPLETO)
2. ✅ Mapear campos de linkagem (COMPLETO)
3. 🔄 Criar página /reports/hubspot enriquecida (EM ANDAMENTO)
4. ⏳ Implementar algoritmo de auto-matching
5. ⏳ Criar dashboard de reconciliação

---

### 🔮 FASE 2: LINKAGEM POR EXTERNAL IDs (Futuro - Se Necessário)

**Quando usar:**
- Se o cliente começar a usar HubSpot Payments
- Se configurar integração Stripe/Braintree → HubSpot
- Se preencher manualmente external_reference_id

**Tabelas a monitorar:**
- `Payment` (hs_external_reference_id)
- `Invoice` (hs_external_invoice_id)
- `Order` (hs_external_order_id)

---

## 📋 TABELAS RECOMENDADAS PARA TRAZER

### ✅ **PRIORIDADE 1 - Implementar Agora**

```
1. Deal (✅ Já temos)
   └─ DealId, dealname, amount, closedate, dealstage...

2. Contact (✅ Já temos via JOIN)
   └─ email, firstname, lastname, phone...

3. Company (✅ Já temos via JOIN)
   └─ name, industry, website...

4. LineItem (⏳ Adicionar)
   └─ description, amount, quantity...
```

### 🔮 **PRIORIDADE 2 - Monitorar**

```
5. Invoice (⚠️ Atualmente vazia)
   └─ hs_external_invoice_id, hs_unique_id...

6. Payment (⚠️ Atualmente vazia)
   └─ hs_external_reference_id, hs_customer_email...

7. Order (⚠️ Atualmente vazia)
   └─ hs_external_order_id, hs_billing_address_email...
```

---

## 🎨 INTERFACE PROPOSTA

### Página: `/reports/hubspot`

**Colunas principais:**
```
┌──────────────────────────────────────────────────────────────────┐
│ ID | Date | Customer | Email | Amount | Status | Match | Actions │
├──────────────────────────────────────────────────────────────────┤
│ 123│01/15 │ John Doe │ j@... │ €900  │ Won ✅ │ 🔗95% │ [Link] │
│ 124│01/16 │ Jane S.  │ s@... │ €1200 │ Won ✅ │ ❌ 0% │ [Link] │
└──────────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Sincronizar dados do HubSpot
- ✅ Auto-match com Braintree/GoCardless/Stripe
- ✅ Indicador de confiança (%) no match
- ✅ Link manual se auto-match falhar
- ✅ Filtrar por: reconciliado/não reconciliado
- ✅ Exportar CSV

---

## 💡 INSIGHTS IMPORTANTES

### 🎯 **Descoberta Principal**

**As tabelas Invoice, Payment e Order do HubSpot estão vazias porque:**
1. O cliente não está usando HubSpot Payments (nativo)
2. Não há integração direta Braintree/Stripe → HubSpot configurada
3. Os payments são processados externamente

**Solução:**
- Fazer a reconciliação no nosso sistema!
- Usar **email + valor + data** como critério principal
- Match com 95% de confiança quando tudo bate

---

### 🔑 **Campos-Chave Confirmados**

| Origem | Campo | Status |
|--------|-------|--------|
| HubSpot | Contact.email | ✅ 83% cobertura |
| HubSpot | Deal.amount | ✅ 100% cobertura |
| HubSpot | Deal.closedate | ✅ 100% cobertura |
| Braintree | customer_email | ✅ Disponível |
| Braintree | amount | ✅ Disponível |
| Braintree | date | ✅ Disponível |
| GoCardless | customer_email | ✅ Disponível |
| GoCardless | amount | ✅ Disponível |
| GoCardless | date | ✅ Disponível |

---

## 📂 ARQUIVOS GERADOS

| Arquivo | Descrição |
|---------|-----------|
| `scripts/hubspot-investigate-tables.js` | Script de investigação completa |
| `scripts/hubspot-test-linkage.js` | Script de teste de linkagem |
| `docs/HUBSPOT-LINKAGE-ANALYSIS.md` | Este documento |

---

## ⏭️ PRÓXIMOS PASSOS

1. **Criar Query SQL Enriquecida** (30 min)
   - JOIN de Deal + Contact + Company + LineItem
   - Trazer todos os campos necessários para matching

2. **Atualizar `/api/hubspot/sync`** (1h)
   - Usar query enriquecida
   - Mapear para formato csv_rows
   - Adicionar campos: customer_email, customer_name

3. **Criar Algoritmo de Auto-Matching** (2h)
   - Implementar lógica de match por email+valor+data
   - Calcular % de confiança
   - Salvar matched_with e matched_source

4. **Atualizar Página `/reports/hubspot`** (2h)
   - Mostrar status de match
   - Botão "Auto-Match" 
   - Botão "Link Manual"
   - Indicador visual de confiança

5. **Testar em Produção** (1h)
   - Deploy no Vercel
   - Sincronizar deals
   - Validar matches

**Tempo Total Estimado:** ~6-7 horas

---

**Última Atualização:** 5 Janeiro 2026  
**Status:** ✅ Fase 1 Completa - Pronto para Fase 2
