# Investigação: Invoice Number e Invoice Date - 30/01/2026

## 🔍 Problema

O usuário quer linkar orders aos seus invoices reais:
- **Exemplo**: Order `38f776d` 
- **Invoice Numbers**: `#DSDES38F776D-53596`, `#DSDES38F776D-53595`
- **Order Date**: 11/12/2025
- **Invoice Date**: 18/12/2025

## 📊 Resultados da Investigação

### Tabelas Verificadas no SQL Server

| Tabela | Registros | Observação |
|--------|-----------|------------|
| `Invoice` | **0** | Tabela VAZIA |
| `Order` | **0** | Tabela VAZIA |
| `Payment` | **0** | Tabela VAZIA |
| `Deal` | ~45.000+ | Contém dados |
| `LineItem` | ~50.000+ | Contém dados |

### Campos do Deal `38f776d`

```json
{
  "DealId": "51533955501",
  "dealname": "38f776d",
  "deal_number": "38f776dd6c25df5266c1890f841dfb5d",
  "website_order_id": null,
  "closedate": "2025-12-11T17:17:22.000Z",
  "amount": 0
}
```

### Análise do Sufixo `-53596`

O sufixo NÃO corresponde a:
- ❌ `DealId` (é `51533955501`)
- ❌ `LineItemId` (é `46889330242`)
- ❌ `website_order_id` (é `null`)
- ❌ Nenhum campo encontrado no HubSpot

## 🎯 Conclusão

O número de invoice `#DSDES38F776D-53596` com data `18/12/2025` **NÃO existe no HubSpot**.

### Possíveis Fontes Externas

1. **Sistema de e-commerce** (WooCommerce, Shopify, BigCommerce)
2. **Sistema de contabilidade** (Odoo, SAP, QuickBooks, Xero)
3. **Sistema de billing DSD customizado**
4. **Arquivo Excel/CSV manual**
5. **Plataforma de pagamentos** (Stripe, Braintree - invoice própria)

## 📋 Próximos Passos

1. **Identificar a fonte** do invoice number `#DSDES38F776D-53596`
2. Se for sistema externo, criar integração ou importação CSV
3. Se for arquivo manual, criar processo de upload
4. Linkar via `order_code` (dealname) como chave

## 🔗 Estrutura Atual de Geração

O sistema atual gera invoice number assim:
```typescript
// Em src/app/reports/hubspot/page.tsx
const getInvoiceNumber = (row: HubSpotDeal): string => {
    const orderCode = extractOrderCode(row);
    const webOrderId = row.custom_data?.website_order_id || "";
    
    if (webOrderId) {
        return `#DSDES${orderCode.toUpperCase()}-${webOrderId}`;
    }
    return `#DSDES${orderCode.toUpperCase()}`;
};
```

Mas como `website_order_id` é `null`, gera apenas `#DSDES38F776D` (sem sufixo).

---

**Status**: ⏳ Aguardando informação do usuário sobre origem dos invoice numbers
