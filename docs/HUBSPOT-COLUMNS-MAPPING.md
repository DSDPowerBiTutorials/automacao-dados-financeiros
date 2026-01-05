# 📊 Mapeamento de Colunas: Prints → HubSpot

## ✅ Análise Completa dos Prints

### Print 1: Colunas Visíveis por Padrão

| # | Coluna do Print | Campo HubSpot | Disponível? | Implementação |
|---|----------------|---------------|-------------|---------------|
| 1 | ☐ (Checkbox) | - | ✅ | Reconciliation checkbox |
| 2 | **Order** | `Deal.hs_object_id` | ✅ | Deal ID único |
| 3 | **Reference** | `Deal.dealname` | ✅ | Nome do deal |
| 4 | **Status** | `Deal.dealstage` | ✅ | Stage com ícone ● colorido |
| 5 | **Date Ordered** | `Deal.closedate` | ✅ | Data de fechamento |
| 6 | **Date Paid** | `Deal.hs_closed_won_date` ou `matched_at` | ✅ | Data de reconciliação |
| 7 | **Total Paid** | `Deal.amount` | ✅ | Valor total |
| 8 | **Paid Status** | `reconciled` | ✅ | ● verde (paid) / ● vermelho (unpaid) |
| 9 | **All Totals** | Múltiplos campos | ✅ | Expandível com detalhes |
| 10 | **Customer** | `Contact.email` | ✅ | Email do cliente |

### Print 2 & 3: Colunas Disponíveis (mas não selecionadas por padrão)

| Coluna do Print | Campo HubSpot | Disponível? | Notas |
|----------------|---------------|-------------|-------|
| Billing Business Name | `Company.name` | ✅ | Empresa de cobrança |
| Billing First Name | `Contact.firstname` | ✅ | Primeiro nome |
| Billing Full Name | `Contact.firstname + lastname` | ✅ | Nome completo |
| Billing Last Name | `Contact.lastname` | ✅ | Sobrenome |
| Coupon Code | - | ❌ | Não disponível no HubSpot |
| Data | `Deal.createdate` | ✅ | Data de criação |
| Date Created | `Deal.createdate` | ✅ | Data de criação |
| Date Updated | `Deal.hs_lastmodifieddate` | ✅ | Última modificação |
| Email | `Contact.email` | ✅ | ✅ Já implementado |
| Gateway | - | ❌ | Campo de payment gateway |
| HubSpot VID | `Contact.vid` | ✅ | ID do contact |
| ID | `Deal.hs_object_id` | ✅ | ✅ Já implementado |
| Item Subtotal | `LineItem.amount` | ✅ | Subtotal de items |
| Item Total | Soma de `LineItem.amount` | ✅ | Total de items |
| Number | `Deal.dealstage` | ✅ | Número da ordem |
| Order Site | - | ❌ | Site da ordem |
| Order Type | `Deal.dealtype` | ✅ | Tipo do deal |
| Payment Subscription | - | ❌ | Subscrição |
| Prevent Email | - | ❌ | Flag de email |
| Shipping Business Name | `Company.name` | ✅ | Empresa de envio |
| Shipping First Name | `Contact.firstname` | ✅ | Nome de envio |
| Shipping Full Name | Nome completo | ✅ | Nome completo de envio |
| Shipping Last Name | `Contact.lastname` | ✅ | Sobrenome de envio |
| Shipping Method | - | ❌ | Método de envio |
| Short Number | Substring de ID | ✅ | ID curto |
| Total | `Deal.amount` | ✅ | ✅ Já implementado |
| Total Discount | `Deal.discount_amount` | ⚠️ | Se disponível |
| Total Included Tax | - | ❌ | Tax incluído |
| Total Price | `Deal.amount` | ✅ | ✅ Já implementado |
| Total Qty | Soma de `LineItem.quantity` | ✅ | Quantidade total |
| Total Shipping | - | ❌ | Custo de envio |
| Total Tax | - | ❌ | Total de impostos |

---

## 🎯 Implementação Proposta

### Estrutura da Tabela (matching prints)

```
┌──┬─────────┬───────────┬────────┬──────────────┬────────────┬────────────┬─────────────┬────────────┬──────────┬─────────┐
│☐│ Order   │ Reference │ Status │ Date Ordered │ Date Paid  │ Total Paid │ Paid Status │ All Totals │ Customer │ Actions │
├──┼─────────┼───────────┼────────┼──────────────┼────────────┼────────────┼─────────────┼────────────┼──────────┼─────────┤
│☑│ 4f51c13 │ 4f51c13   │ ● Cre. │ 1:48 AM      │ -          │ $0.00      │ ● Unpaid    │ [▼ Expand] │ walker.. │ [...]   │
└──┴─────────┴───────────┴────────┴──────────────┴────────────┴────────────┴─────────────┴────────────┴──────────┴─────────┘
```

### All Totals (expandível):

Quando clica em "All Totals", expande para mostrar:
```
Qty:        2
Items:      $940.00
Discounts: -$820.00
Price:      $120.00
```

---

## 🔧 Mapeamento de Campos Custom Data

### Campos necessários em `custom_data`:

```typescript
custom_data: {
  // Existentes
  deal_id: string;          // Order
  dealname: string;         // Reference
  stage: string;            // Status (para ícone)
  closedate: string;        // Date Ordered
  amount: number;           // Total Paid
  
  // Novos para "All Totals"
  quantity: number;         // Qty (soma de LineItems)
  items_total: number;      // Items (subtotal)
  discount_amount: number;  // Discounts
  final_price: number;      // Price (amount - discount)
  
  // Para Date Paid
  hs_closed_won_date: string;
}
```

---

## 🎨 Estilização dos Ícones de Status

### Status (Deal Stage):
```typescript
const stageColors = {
  'closedwon': 'text-green-500',      // ● Verde
  'closedlost': 'text-red-500',       // ● Vermelho
  'contractsent': 'text-blue-500',    // ● Azul
  'creditorder': 'text-yellow-500',   // ● Amarelo (como no print)
  'qualifiedtobuy': 'text-orange-500',
  ...
}
```

### Paid Status (Reconciliation):
```typescript
reconciled === true  → ● Vermelho "Unpaid"
reconciled === false → ● Verde "Paid"
```

---

## 📋 Checklist de Implementação

### Backend (API `/api/hubspot/sync`):
- [ ] Adicionar `dealname` ao custom_data
- [ ] Adicionar `hs_closed_won_date` ao custom_data
- [ ] Calcular `quantity` (soma de LineItems)
- [ ] Calcular `items_total` (subtotal)
- [ ] Buscar `discount_amount` do Deal
- [ ] Calcular `final_price` (amount - discount)

### Frontend (`/reports/hubspot/page.tsx`):
- [x] Atualizar interface HubSpotRow com novos campos
- [x] Adicionar estado `expandedRows` para controlar expansão
- [x] Criar função `getStatusIcon()` para ícones de status
- [x] Criar função `getPaidStatusIcon()` para ícones de pagamento
- [x] Criar função `toggleRowExpansion()` para expandir/colapsar
- [x] Atualizar headers da tabela para refletir prints
- [ ] Atualizar células da tabela com nova estrutura
- [ ] Implementar seção expandível "All Totals"
- [ ] Ajustar formatação de datas/horas
- [ ] Testar responsividade

### Testes:
- [ ] Testar sincronização com novos campos
- [ ] Testar expansão de "All Totals"
- [ ] Verificar ícones de status corretos
- [ ] Validar formatação de valores
- [ ] Testar ordenação por coluna

---

## 🚀 Próximos Passos

1. **Atualizar API de Sync** (`src/app/api/hubspot/sync/route.ts`):
   - Adicionar query JOIN com LineItem para calcular quantity
   - Buscar discount_amount do Deal
   - Adicionar todos os campos necessários ao custom_data

2. **Atualizar Tabela** (`src/app/reports/hubspot/page.tsx`):
   - Implementar células com nova estrutura de colunas
   - Adicionar componente expandível para "All Totals"
   - Aplicar ícones coloridos de status

3. **Testar em Dev**:
   ```bash
   npm run dev
   # Acessar http://localhost:3000/reports/hubspot
   # Clicar em "Sincronizar"
   # Verificar se colunas aparecem como nos prints
   ```

4. **Deploy**:
   ```bash
   git add .
   git commit -m "feat: Implement print-style columns for HubSpot deals"
   git push origin main
   ```

---

**Status Atual:** 🟡 Em Implementação  
**Próximo Commit:** Após implementar células da tabela  
**Última Atualização:** 05 Jan 2026
