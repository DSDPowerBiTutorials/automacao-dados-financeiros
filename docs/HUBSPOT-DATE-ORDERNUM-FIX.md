# ✅ Fix: Data de Pagamento e Order Number - HubSpot

## 🎯 Problema Identificado

Você reportou que as informações na página HubSpot não estavam corretas:
1. **Date Paid**: Estava mostrando "-" ao invés da data em que foi pago
2. **Order Number**: Não estava exibindo o número do pedido do site

## 🔍 Análise Realizada

### Campos Disponíveis no HubSpot SQL Server

Através da análise dos arquivos de documentação e da query SQL atual, identifiquei que:

1. **Date Paid** → Campo `hs_closed_won_date` (tipo: datetime)
   - Este campo já está sendo buscado na query SQL
   - Estava sendo salvo em `custom_data.date_paid` e `custom_data.hs_closed_won_date`

2. **Order Number** → Campo `website_order_id` (tipo: nvarchar)
   - ID numérico do pedido web (ex: 2831851)
   - Também está sendo buscado na query SQL
   - Estava sendo salvo em `custom_data.website_order_id`

### Problema Real

Os campos **JÁ ESTAVAM SENDO BUSCADOS** corretamente na rota de sincronização (`/api/hubspot/sync`), mas:
- A **exibição na página** não estava otimizada
- O **Order Number não estava sendo destacado** como informação principal
- A **Date Paid** poderia ter melhor formatação e fallbacks

## ✅ Solução Implementada

### 1. Atualização da Coluna "Order Number"

**Antes:**
```tsx
<th>Order Code</th>
<td>
  <a>{orderCode}</a>
  {websiteOrderId && <span>ID: {websiteOrderId}</span>}
</td>
```

**Depois:**
```tsx
<th>Order Number</th>
<td>
  {websiteOrderId ? (
    <>
      <a className="text-base">{websiteOrderId}</a>
      <span className="text-xs">Code: {orderCode}</span>
    </>
  ) : (
    <a className="font-mono">{orderCode}</a>
  )}
</td>
```

**Resultado:**
- Se `website_order_id` existe → mostra ele em destaque + o código como secundário
- Se `website_order_id` é null → mostra o orderCode como antes

### 2. Melhoria na Coluna "Date Paid"

**Antes:**
```tsx
{row.custom_data?.date_paid ? formatDate(row.custom_data.date_paid) : "-"}
```

**Depois:**
```tsx
{(() => {
  const datePaid = row.custom_data?.date_paid || row.custom_data?.hs_closed_won_date;
  if (!datePaid) return "-";
  
  try {
    return new Date(datePaid).toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return formatDate(datePaid);
  }
})()}
```

**Resultado:**
- Tenta múltiplos fallbacks: `date_paid` → `hs_closed_won_date`
- Formato melhorado com data e hora
- Tratamento de erro robusto

### 3. Adição de "Date Paid" na Seção Expandida

Agora a seção "Additional Info" (quando você clica para expandir) também mostra:
```
Date Paid: Jan 4, 2026 8:42 AM
```

Em destaque verde para facilitar a visualização.

## 📊 Estrutura de Dados

### Query SQL (`hubspot-queries.ts`)
```sql
SELECT
  d.hs_closed_won_date as date_paid,     -- Data de pagamento
  d.website_order_id,                     -- Order number do site
  ...
```

### Mapeamento no Sync (`/api/hubspot/sync/route.ts`)
```typescript
custom_data: {
  date_paid: deal.date_paid || null,
  hs_closed_won_date: deal.date_paid || null,
  website_order_id: deal.website_order_id || null,
  ecomm_order_number: deal.ecomm_order_number || orderCode,
  ...
}
```

### Exibição na Página (`/reports/hubspot/page.tsx`)
```tsx
// Coluna principal
const websiteOrderId = row.custom_data?.website_order_id || '';
const datePaid = row.custom_data?.date_paid || row.custom_data?.hs_closed_won_date;

// Exibe com prioridade:
// 1. website_order_id (se existir)
// 2. orderCode (fallback)
```

## 🚨 Importante: Dados Podem Estar Vazios

Se após visualizar a página você ainda vê "-" na coluna Date Paid ou não vê o Order Number, pode significar que:

### Cenário A: Campos NULL no HubSpot
Os campos podem estar **vazios** no banco de dados SQL Server do HubSpot para esses deals específicos.

**Como verificar:**
1. Abra o console do navegador (F12 > Console)
2. Expanda um deal específico
3. Verifique se `custom_data.website_order_id` e `custom_data.date_paid` têm valores

**Exemplo:**
```javascript
{
  website_order_id: null,  // ❌ Campo vazio no HubSpot
  date_paid: null,         // ❌ Campo vazio no HubSpot
  orderCode: "e437d54"     // ✅ Sempre disponível
}
```

### Cenário B: Dados Antigos no Supabase

Se você sincronizou antes desta correção, os dados salvos no Supabase podem ser antigos.

**Solução:**
1. Vá para a página `/reports/hubspot`
2. Clique em **"Sync from HubSpot"**
3. Aguarde a sincronização completar
4. Verifique novamente os dados

Isso vai buscar os dados **atualizados** com a query correta.

## 📁 Arquivos Alterados

### ✅ Modificados
- [src/app/reports/hubspot/page.tsx](../src/app/reports/hubspot/page.tsx)
  - Linha ~825: Header da coluna alterado para "Order Number"
  - Linha ~870: Lógica de exibição do Order Number atualizada
  - Linha ~920: Formatação melhorada da Date Paid
  - Linha ~1180: Date Paid adicionada na seção expandida

### ℹ️ Não Precisaram de Alteração
- [src/lib/hubspot-queries.ts](../src/lib/hubspot-queries.ts) ✅ Já estava correto
- [src/app/api/hubspot/sync/route.ts](../src/app/api/hubspot/sync/route.ts) ✅ Já estava correto

## 🧪 Como Testar

1. Acesse `/reports/hubspot`
2. Clique em **"Sync from HubSpot"** (se ainda não sincronizou recentemente)
3. Verifique a coluna **"Order Number"**:
   - ✅ Deve mostrar o número do site (ex: `2831851`) quando disponível
   - ✅ Ou mostrar o código (ex: `e437d54`) como fallback
4. Verifique a coluna **"Date Paid"**:
   - ✅ Deve mostrar data e hora (ex: `1/4/2026, 8:42 AM`) quando disponível
   - ✅ Ou mostrar "-" se não houver data de pagamento
5. Clique para expandir um deal:
   - ✅ Na seção "Additional Info" deve mostrar "Date Paid: Jan 4, 2026 8:42 AM"
   - ✅ Na seção "Order Codes" deve mostrar "Web Order ID: 2831851"

## 🎯 Próximos Passos

Se ainda houver problemas após sincronizar:

1. **Verificar no HubSpot**: Confirmar se os campos estão preenchidos no CRM do HubSpot
2. **Logs do Sync**: Verificar logs no console durante a sincronização
3. **SQL Test**: Executar query de teste direto no SQL Server (ver `query-hubspot-order.js`)

---

**Data da Correção:** 2026-01-07  
**Desenvolvedor:** GitHub Copilot  
**Status:** ✅ Pronto para Teste
