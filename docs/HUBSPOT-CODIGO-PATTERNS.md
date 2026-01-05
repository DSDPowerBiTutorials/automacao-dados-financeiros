# 🔢 Padrões de Código do Backend → HubSpot

## 📋 Análise dos Prints

### Exemplo 1: Credit Order (4f51c13)

**Backend Order Detail:**
- **Order/Reference/Short Number**: `4f51c13` (7 caracteres alfanuméricos)
- **Number/Long Term**: `4f51c13ce864ecda764f80f1af7feac1` (32 caracteres - MD5 hash)
- **ID**: `5347991` (numérico sequencial)
- **Proof of Purchase**: `#DSDES4F51C13` (padrão: `#DSDES` + SHORT_NUMBER uppercase)
- **Status**: ● Credit Order (yellow/orange)
- **Total Price**: $120.00
- **Sub Total**: $160.00
- **Discount**: -$40.00 (DSD Clinic 25% PC Discount)
- **Items**:
  - `05e6da2c` - DSD Motivational Mockup Design
  - `b18b8711` - (outro produto)

### Exemplo 2: Order Normal (546ce22)

**Backend Order Detail:**
- **Order/Reference/Short Number**: `546ce22` (7 caracteres alfanuméricos)
- **Number/Long Term**: `546ce22f75a6ac30ac2e7cc582da4208` (32 caracteres - MD5 hash)
- **ID**: `5352498` (numérico sequencial)
- **Invoice Number**: `#DSDES546CE22` (padrão: `#DSDES` + SHORT_NUMBER uppercase)
- **Status**: ● New (green)
- **Paid Status**: ● Paid (green)
- **Total Price**: €255.00
- **Sale Amount Off**: $45.00
- **Item**: DSD Implant Partial Planning & Guide Design

---

## 🔍 Mapeamento HubSpot → Aplicação

### Campos Disponíveis no HubSpot

| Campo do Backend | Campo HubSpot | Observações |
|-----------------|---------------|-------------|
| **Short Number** (7 chars) | `dealname` substring(0,7) | Extrair primeiros 7 caracteres |
| **Long Number** (32 chars) | `dealname` OU campo específico | Hash MD5 completo |
| **ID** (numeric) | `hs_object_id` | ID numérico único |
| **Invoice/Proof Pattern** | Calcular: `#DSDES{SHORT_UPPER}` | Gerar a partir do short number |
| **Status** | `dealstage` | Mapear para ícones coloridos |
| **Total Price** | `amount` | Valor total do deal |
| **Sub Total** | `LineItem.amount` soma | Somar todos os line items |
| **Discount** | `LineItem.discount` soma | Somar todos os descontos |
| **Paid Status** | `reconciled` | Booleano (paid/unpaid) |
| **Date Ordered** | `closedate` | Data de fechamento |
| **Date Paid** | `matched_at` | Data de reconciliação |
| **Customer** | `Contact.email` | Email do cliente |
| **Items** | `LineItem.description` | Produtos associados |
| **Quantity** | `LineItem.quantity` soma | Quantidade total |

---

## 🎯 Padrões de Código Identificados

### 1. **Short Number** (Order/Reference)
```
Formato: [a-z0-9]{7}
Exemplos: 4f51c13, 546ce22
Origem: Primeiros 7 caracteres do dealname
```

### 2. **Long Number**
```
Formato: [a-z0-9]{32}
Exemplos: 
  - 4f51c13ce864ecda764f80f1af7feac1
  - 546ce22f75a6ac30ac2e7cc582da4208
Origem: Hash MD5 completo (possivelmente dealname completo)
```

### 3. **ID Numérico**
```
Formato: [0-9]+
Exemplos: 5347991, 5352498
Origem: hs_object_id do HubSpot
```

### 4. **Invoice/Proof Number**
```
Formato: #DSDES{SHORT_NUMBER_UPPERCASE}
Exemplos: 
  - #DSDES4F51C13
  - #DSDES546CE22
Cálculo: `#DSDES${shortNumber.toUpperCase()}`
```

---

## ⚠️ Problemas Identificados na Implementação Atual

### 1. **Coluna "Order"** - Mostrando ID errado
```tsx
// ❌ ATUAL (mostrando deal_id que é hs_object_id numérico)
{row.custom_data?.deal_id || "-"}

// ✅ CORRETO (deve mostrar short number - primeiros 7 chars do dealname)
{extractShortNumber(row.custom_data?.dealname) || "-"}
```

### 2. **Coluna "Reference"** - Mostrando dealname completo
```tsx
// ❌ ATUAL (mostrando dealname completo que pode ter 32+ chars)
{row.custom_data?.dealname || "-"}

// ✅ CORRETO (deve mostrar só short number ou invoice pattern)
{getInvoiceNumber(row.custom_data?.dealname) || extractShortNumber(row.custom_data?.dealname) || "-"}
```

### 3. **Falta Link para Invoice Pattern**
```tsx
// ✅ ADICIONAR (link para invoice no formato #DSDES{SHORT})
<a href={`#invoice-${shortNumber}`} className="text-blue-600 hover:underline">
  {getInvoiceNumber(dealname)}
</a>
```

### 4. **ID numérico não está visível**
O `hs_object_id` (5347991, 5352498) não está sendo mostrado, mas deveria estar disponível para referência.

---

## 🛠️ Funções de Helper Necessárias

### Extrair Short Number
```typescript
function extractShortNumber(dealname: string | undefined): string {
  if (!dealname) return "";
  // Pegar primeiros 7 caracteres alfanuméricos
  const match = dealname.match(/^[a-z0-9]{7}/i);
  return match ? match[0].toLowerCase() : dealname.substring(0, 7).toLowerCase();
}
```

### Gerar Invoice Number
```typescript
function getInvoiceNumber(dealname: string | undefined): string {
  const shortNumber = extractShortNumber(dealname);
  if (!shortNumber) return "";
  return `#DSDES${shortNumber.toUpperCase()}`;
}
```

### Extrair Long Number
```typescript
function extractLongNumber(dealname: string | undefined): string {
  if (!dealname) return "";
  // Se dealname tem 32 caracteres, é o long number
  if (dealname.length === 32) return dealname.toLowerCase();
  // Caso contrário, pode estar nos primeiros 32 chars
  return dealname.substring(0, 32).toLowerCase();
}
```

---

## 📊 Nova Estrutura de Exibição

### Tabela Principal

| Coluna | Valor Exibido | Formatação | Origem |
|--------|---------------|------------|--------|
| Order | `4f51c13` | Link azul | `dealname` (7 chars) |
| Reference | `#DSDES4F51C13` | Link azul | Calculado |
| Status | ● Credit Order | Ícone colorido + texto | `dealstage` |
| Date Ordered | 1:48 AM | Hora 12h | `closedate` |
| Date Paid | 1/5/2026 | Data formatada | `matched_at` |
| Total Paid | $120.00 | Moeda | `amount` |
| Paid Status | ● Unpaid | Ícone colorido | `reconciled` |
| All Totals | Qty: 2 / Price: $120 | Preview | LineItems |
| Customer | walker.1058@osu.edu | Email link | `Contact.email` |

### Seção Expandida (All Totals)

```
Order Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Qty:       2
Items:     $160.00   (Sub Total)
Discounts: -$40.00   (DSD Clinic 25% PC Discount)
Price:     $120.00   (Total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Customer:  Douglas Walker
           walker.1058@osu.edu
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Order ID:  5347991
Number:    4f51c13ce864ecda764f80f1af7feac1
Invoice:   #DSDES4F51C13
```

---

## 🎨 Melhorias de UX

### 1. Tooltip com informações completas
Ao passar o mouse sobre "Order" ou "Reference", mostrar tooltip:
```
Order: 4f51c13
Number: 4f51c13ce864ecda764f80f1af7feac1
ID: 5347991
Invoice: #DSDES4F51C13
```

### 2. Copy button para códigos
Adicionar botão de copiar ao lado dos códigos importantes.

### 3. Badge para tipo de order
- **Credit Order**: Badge amarelo/laranja
- **Normal Order**: Badge verde
- **Refund**: Badge vermelho

---

## ✅ Checklist de Implementação

- [ ] Criar helper functions (extractShortNumber, getInvoiceNumber, extractLongNumber)
- [ ] Atualizar coluna "Order" para mostrar short number (7 chars)
- [ ] Atualizar coluna "Reference" para mostrar invoice pattern (#DSDES...)
- [ ] Adicionar tooltip com informações completas
- [ ] Atualizar seção expandida para mostrar todos os códigos
- [ ] Adicionar ID numérico na seção expandida
- [ ] Adicionar long number na seção expandida
- [ ] Limpar dados vindos do HubSpot (remover espaços, normalizar)
- [ ] Testar com dados reais dos exemplos (4f51c13, 546ce22)
- [ ] Atualizar documentação com exemplos

---

## 🔬 Dados de Teste

Para validar a implementação, usar esses exemplos reais:

**Test Case 1:**
```json
{
  "dealname": "4f51c13ce864ecda764f80f1af7feac1",
  "hs_object_id": "5347991",
  "amount": 120.00,
  "dealstage": "closedwon",
  "customer_email": "walker.1058@osu.edu"
}
```

**Resultado Esperado:**
- Order: `4f51c13` (link azul)
- Reference: `#DSDES4F51C13` (link azul)
- ID (expandido): `5347991`
- Number (expandido): `4f51c13ce864ecda764f80f1af7feac1`

**Test Case 2:**
```json
{
  "dealname": "546ce22f75a6ac30ac2e7cc582da4208",
  "hs_object_id": "5352498",
  "amount": 255.00,
  "dealstage": "new",
  "customer_email": "labsmilesville@gmail.com"
}
```

**Resultado Esperado:**
- Order: `546ce22` (link azul)
- Reference: `#DSDES546CE22` (link azul)
- ID (expandido): `5352498`
- Number (expandido): `546ce22f75a6ac30ac2e7cc582da4208`
