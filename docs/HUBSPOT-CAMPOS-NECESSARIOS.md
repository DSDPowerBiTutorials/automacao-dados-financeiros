# 📋 Campos Necessários na Página de Deals (HubSpot)

## Baseado no Print Order 546ce22

### ✅ Campos Principais (Tabela)

| Campo | Fonte HubSpot | Status | Notas |
|-------|---------------|--------|-------|
| **Reference** | dealname (7 chars) | ✅ | Short number: `546ce22` |
| **ID** | hs_object_id | ✅ | Numérico: `5352498` |
| **Status** | dealstage | ✅ | Ex: "New" com ● verde |
| **Date Ordered** | closedate | ✅ | Ex: `1/4/2026 8:42 AM` |
| **Customer Name** | Contact.firstname + lastname | ✅ | Ex: `Ruchika Sachdev` |
| **Customer Email** | Contact.email | ✅ | Ex: `labsmilesville@gmail.com` |
| **Total Price** | Deal.amount | ✅ | Ex: `€255.00` |
| **Paid Status** | ? | ❓ | Pode vir de transações/payments? |
| **Date Paid** | ? | ❓ | Idem |

### ✅ Campos Detalhados (Seção Expandida)

| Campo | Fonte HubSpot | Status | Notas |
|-------|---------------|--------|-------|
| **Short Number** | dealname (7 chars) | ✅ | `546ce22` |
| **Number (Long)** | dealname (32 chars) | ✅ | `546ce22f75a6ac30ac2...` |
| **Paid Amount** | ? | ❓ | Pode ser amount ou de payments |
| **Coupon Code** | ? | ❓ | Precisa verificar se existe |
| **Order Site** | ? | ⚠️ | Pode ser hardcoded "DSD (en-GB)" |
| **Shipping Method** | ? | ❌ | Não disponível |
| **IP Address** | ? | ❌ | Não disponível |
| **Origin** | ? | ⚠️ | Pode ser hardcoded "Web" |
| **Last Updated** | hs_lastmodifieddate | ✅ | Data de última atualização |

### ✅ Produtos (Line Items)

| Campo | Fonte HubSpot | Status | Notas |
|-------|---------------|--------|-------|
| **Item Name** | LineItem.description | ✅ | Ex: "DSD Implant Partial Planning & Guide Design" |
| **SKU** | ? | ❓ | Ex: "DSD IPP&G design" |
| **Unit Price (Sale)** | LineItem.price | ✅ | Ex: `$255.00` |
| **Original Price** | ? | ❓ | Ex: `$300.00` |
| **Quantity** | LineItem.quantity | ✅ | Ex: `1` |
| **Total** | LineItem.amount | ✅ | Ex: `$255.00` |
| **Discount Amount** | LineItem.discount | ✅ | Ex: `$45.00` |
| **Discount Name** | ? | ❓ | Ex: "excludeCoinMultiplier: false" |

### ❓ Campos que Precisam Investigação

1. **Paid Status** (● Paid / ● Unpaid)
   - Pode vir de campo específico do Deal
   - Pode ser calculado se houver payments associados
   - Pode ser derivado de dealstage ("closedwon" = paid?)

2. **Date Paid**
   - Pode ser `hs_closed_won_date`
   - Pode ser data de último payment
   - Pode ser igual ao closedate para deals won

3. **Coupon Code**
   - Verificar se existe campo no Deal
   - Pode estar em LineItem
   - Pode não estar disponível

4. **Order Site**
   - Pode ser campo customizado
   - Pode estar em Deal properties
   - Pode precisar ser inferido (ex: currency EUR = "DSD (en-GB)")

5. **Original Price** vs **Sale Price**
   - LineItem tem `price` e `amount`
   - Pode ter campo `hs_price` vs `amount`
   - Pode ter campo `discount` para calcular

---

## 🎯 Lógica de Inferência

### Paid Status
```typescript
// Opção 1: Baseado no dealstage
const isPaid = dealstage === 'closedwon' || dealstage === 'paid';

// Opção 2: Baseado em campo customizado
const isPaid = deal.paid_status === true;

// Opção 3: Baseado em closedate
const isPaid = deal.closedate !== null && deal.closedate !== undefined;
```

### Date Paid
```typescript
// Opção 1: Usar closedate
const datePaid = deal.closedate;

// Opção 2: Usar hs_closed_won_date
const datePaid = deal.hs_closed_won_date || deal.closedate;
```

### Order Site (Inferir por moeda)
```typescript
const orderSite = 
  currency === 'EUR' ? 'DSD (en-GB)' :
  currency === 'USD' ? 'DSD (en-US)' :
  currency === 'GBP' ? 'DSD (en-GB)' :
  'DSD (Web)';
```

---

## 📊 Estrutura da Nova Página

### Tabela Principal
```
┌──┬───────────┬──────────┬────────┬──────────────┬───────────────┬─────────────┬─────────────┬─────────┐
│☐ │ Reference │ ID       │ Status │ Date Ordered │ Customer      │ Total Price │ Paid Status │ Actions │
├──┼───────────┼──────────┼────────┼──────────────┼───────────────┼─────────────┼─────────────┼─────────┤
│☐ │ 546ce22   │ 5352498  │ ● New  │ 1/4/26 8:42  │ Ruchika S.    │ €255.00     │ ● Paid      │ [...]   │
│  │           │          │        │              │ labsmiles...  │             │             │         │
└──┴───────────┴──────────┴────────┴──────────────┴───────────────┴─────────────┴─────────────┴─────────┘
```

### Seção Expandida (ao clicar na linha)
```
Order Details: 546ce22
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Basic Info
  Reference:     546ce22
  ID:            5352498
  Number:        546ce22f75a6ac30ac2e7cc582da4208
  Invoice:       #DSDES546CE22

📅 Dates
  Date Ordered:  1/4/2026 8:42 AM
  Date Paid:     1/4/2026 8:42 AM
  Last Updated:  1/4/2026 8:42 AM

👤 Customer
  Name:          Ruchika Sachdev
  Email:         labsmilesville@gmail.com
  
💰 Payment
  Total Price:   €255.00
  Paid Amount:   €255.00
  Paid Status:   ● Paid

📦 Products
  ┌─────────────────────────────────────┬───────┬────────┬────────┐
  │ Item                                │ Qty   │ Price  │ Total  │
  ├─────────────────────────────────────┼───────┼────────┼────────┤
  │ DSD Implant Partial Planning        │   1   │ $255   │ $255   │
  │   Original: $300 | Discount: $45    │       │        │        │
  └─────────────────────────────────────┴───────┴────────┴────────┘

🌐 Site Info
  Order Site:    DSD (en-GB)
  Origin:        Web
  IP Address:    203.211.72.155
```

---

## 🚀 Próximos Passos

1. ✅ Identificar se campos ❓ existem no HubSpot
2. ✅ Implementar lógica de inferência para Paid Status
3. ✅ Simplificar página (remover matching/reconciliation)
4. ✅ Adicionar apenas visualização pura dos deals
5. ✅ Testar com dados reais
