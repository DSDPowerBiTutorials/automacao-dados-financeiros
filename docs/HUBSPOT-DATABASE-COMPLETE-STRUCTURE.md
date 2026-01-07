# 🗄️ ESTRUTURA COMPLETA DO BANCO HUBSPOT (SQL Server)

**Banco:** `Jorge9660` @ `datawarehouse-io-eur.database.windows.net`  
**Total de Tabelas:** 133 tabelas  
**Documentação criada:** 2026-01-07

---

## 📋 SUMÁRIO EXECUTIVO

### 🎯 CAMPOS CRÍTICOS ENCONTRADOS:

| Campo | Localização | Descrição | Exemplo |
|-------|-------------|-----------|---------|
| **Order Number** | `Deal.dealname` ou `Deal.ip__ecomm_bridge__order_number` | Código alfanumérico da ordem | `371e321`, `a3d2c9a` |
| **HubSpot VID (Deal ID)** | `Deal.DealId` | ID numérico do deal | `8727781664` |
| **Total Paid** | `Deal.total_payment` | Valor total pago | `7725`, `54.44` |
| **Total Discount** | `Deal.ip__ecomm_bridge__discount_amount` | Desconto aplicado | `1440`, `3000` |
| **Date Paid** | `Deal.hs_closed_won_date` | Data do pagamento | `2025-12-03` |
| **Total** | `Deal.amount` | Valor total (já com desconto) | `7725`, `8000` |
| **Paid Status** | `Deal.paid_status` | Status de pagamento | `Paid`, `Unpaid`, `Partial` |
| **Billing Business Name** | `Deal.billing_business_name` ou `Company.CompanyName` | Nome da empresa cobrança | `Evergreen Dental Group` |
| **Customer Email** | `Contact.email` | Email do cliente | `drm@evergreendental.com` |
| **Date Ordered** | `Deal.closedate` | Data da ordem | `2025-12-03` |

---

## 🏗️ TABELAS PRINCIPAIS

### 1️⃣ **Deal** (Tabela Principal - 239 colunas)

**Descrição:** Contém todos os deals (vendas/ordens) do HubSpot, incluindo e-commerce e deals manuais.

#### **Campos Críticos para E-commerce:**

| Campo | Tipo | Descrição | Exemplos |
|-------|------|-----------|----------|
| `DealId` | bigint | **Deal ID** (Primary Key) | `8727781664`, `2456050209` |
| `dealname` | nvarchar | **Order Number** (código alfanumérico) | `a3d2c9a`, `9cddee9`, `371e321` |
| `ip__ecomm_bridge__order_number` | nvarchar | **Order Number** (backup) | `a3d2c9a`, `789a668` |
| `website_order_id` | nvarchar | Order ID numérico (quando disponível) | `2831851`, `24819` |
| `amount` | numeric | **Total** (valor final com desconto) | `7725`, `54.44`, `8000` |
| `total_payment` | numeric | **Total Paid** (valor efetivamente pago) | `7725`, `54.44`, `8000` |
| `discount_amount` | nvarchar | Desconto (formato texto) | `null` na maioria |
| `ip__ecomm_bridge__discount_amount` | numeric | **Total Discount** (valor numérico) | `0`, `1440`, `3000` |
| `ip__ecomm_bridge__tax_amount` | numeric | Valor de imposto | `0` |
| `paid_status` | nvarchar | **Paid Status** | `Paid`, `Unpaid`, `Partial`, `Unpaid;Paid;Partial` |
| `closedate` | datetime | **Date Ordered** | `2025-12-03`, `2023-06-26` |
| `hs_closed_won_date` | datetime | **Date Paid** | `2025-12-03`, `2022-11-30` |
| `createdate` | datetime | Data de criação do deal | `2025-12-02` |
| `hs_lastmodifieddate` | datetime | Última modificação | `2025-12-03` |
| `deal_currency_code` | nvarchar | Moeda | `EUR`, `USD`, `GBP` |
| `dealstage` | nvarchar | Estágio do deal | `1203581032`, `closedwon` |
| `dealtype` | nvarchar | Tipo do deal | `newbusiness`, `renewal` |
| `deal_pipeline` | nvarchar | Pipeline | `default`, `ecommerce` |
| `ecommerce_deal` | nvarchar | Flag de e-commerce | `true`, `false`, `null` |
| `billing_business_name` | nvarchar | **Billing Business Name** | `Evergreen Dental Group` |
| `hubspot_owner_id` | bigint | ID do owner | `123456789` |
| `description` | nvarchar | Descrição do deal | Texto livre |
| `deal_number` | nvarchar | Número sequencial | Raramente preenchido |

#### **5 Exemplos Reais de Deals E-commerce:**

```
DEAL 1:
  DealId: 8727781664
  dealname: "a3d2c9a"
  ip__ecomm_bridge__order_number: "a3d2c9a"
  website_order_id: "null"
  amount: 7725
  total_payment: 7725
  discount_amount: "null"
  ip__ecomm_bridge__discount_amount: 0
  ip__ecomm_bridge__tax_amount: null
  paid_status: "Paid"
  closedate: 2025-12-03
  hs_closed_won_date: 2025-12-03
  currency: USD
  dealstage: closedwon
  ecommerce_deal: true

DEAL 2:
  DealId: 6761419092
  dealname: "a7184b5"
  ip__ecomm_bridge__order_number: "a7184b5"
  website_order_id: "null"
  amount: 5
  total_payment: 4
  discount_amount: "null"
  ip__ecomm_bridge__discount_amount: 0
  paid_status: "Unpaid;Paid;Partial"
  closedate: 2023-06-26
  hs_closed_won_date: NULL
  currency: EUR
  
DEAL 3:
  DealId: 7233201933
  dealname: "789a668"
  ip__ecomm_bridge__order_number: "789a668"
  website_order_id: "null"
  amount: 0
  total_payment: 0
  discount_amount: "null"
  ip__ecomm_bridge__discount_amount: 3000
  paid_status: "Paid"
  closedate: 2023-06-14
  hs_closed_won_date: NULL
  currency: EUR

DEAL 4:
  DealId: 10445815387
  dealname: "356891a"
  ip__ecomm_bridge__order_number: "356891a"
  website_order_id: "null"
  amount: 54.44
  total_payment: 54.44
  discount_amount: "null"
  ip__ecomm_bridge__discount_amount: 1440
  paid_status: "Paid"
  closedate: 2022-11-30
  hs_closed_won_date: 2022-11-30
  currency: USD
  ecommerce_deal: true

DEAL 5:
  DealId: 10832408170
  dealname: "bbbe56c"
  ip__ecomm_bridge__order_number: "bbbe56c"
  website_order_id: "null"
  amount: 8000
  total_payment: 8000
  discount_amount: "null"
  ip__ecomm_bridge__discount_amount: 0
  paid_status: "Paid"
  closedate: 2022-11-24
  hs_closed_won_date: 2022-11-24
  currency: EUR
  ecommerce_deal: true
```

---

### 2️⃣ **Contact** (Tabela de Clientes)

**Descrição:** Contém informações dos contatos/clientes.

#### **Campos Principais:**

| Campo | Tipo | Descrição | Exemplos |
|-------|------|-----------|----------|
| `VId` | bigint | Contact ID (Primary Key) | `12345`, `67890` |
| `email` | nvarchar | **Customer Email** | `drm@evergreendental.com`, `bathgk@gmail.com` |
| `firstname` | nvarchar | Primeiro nome | `John`, `Maria` |
| `lastname` | nvarchar | Sobrenome | `Doe`, `Silva` |
| `phone` | nvarchar | Telefone | `+1234567890` |
| `jobtitle` | nvarchar | Cargo | `Dentist`, `CEO` |
| `city` | nvarchar | Cidade | `New York`, `London` |
| `state` | nvarchar | Estado | `NY`, `CA` |
| `country` | nvarchar | País | `United States`, `Brazil` |
| `zip` | nvarchar | CEP | `10001`, `SW1A 1AA` |
| `createdate` | datetime | Data de criação | `2023-01-15` |
| `hs_lastmodifieddate` | datetime | Última modificação | `2025-12-03` |

#### **Relacionamento:**
- `DealContactAssociations.VId` → `Contact.VId`
- `DealContactAssociations.DealId` → `Deal.DealId`

---

### 3️⃣ **Company** (Tabela de Empresas)

**Descrição:** Contém informações das empresas.

#### **Campos Principais:**

| Campo | Tipo | Descrição | Exemplos |
|-------|------|-----------|----------|
| `CompanyId` | bigint | Company ID (Primary Key) | `123456`, `789012` |
| `CompanyName` ou `name` | nvarchar | **Billing Business Name** | `Evergreen Dental Group`, `Silfa Dental Aesthetics` |
| `industry` | nvarchar | Indústria | `Healthcare`, `Technology` |
| `city` | nvarchar | Cidade | `Jacksonville`, `London` |
| `country` | nvarchar | País | `United States`, `United Kingdom` |
| `phone` | nvarchar | Telefone | `+1234567890` |
| `website` | nvarchar | Website | `https://example.com` |
| `description` | nvarchar | Descrição | Texto livre |

#### **Relacionamento:**
- `DealCompanyAssociations.CompanyId` → `Company.CompanyId`
- `DealCompanyAssociations.DealId` → `Deal.DealId`

---

### 4️⃣ **LineItem** (Tabela de Produtos)

**Descrição:** Contém os produtos/itens de cada deal.

#### **Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `LineItemId` | bigint | Line Item ID (Primary Key) |
| `name` | nvarchar | Nome do produto |
| `description` | nvarchar | Descrição |
| `quantity` | numeric | Quantidade |
| `price` | numeric | Preço unitário |
| `amount` | numeric | Valor total do item |
| `hs_sku` | nvarchar | SKU do produto |
| `hs_position_on_quote` | numeric | Posição na lista |
| `discount` | numeric | Desconto aplicado |
| `tax` | numeric | Imposto |

#### **Relacionamento:**
- `DealLineItemAssociations.LineItemId` → `LineItem.LineItemId`
- `DealLineItemAssociations.DealId` → `Deal.DealId`

---

### 5️⃣ **Order** (Tabela de Pedidos - 104 colunas)

**Descrição:** Contém informações de pedidos (orders), com dados mais detalhados de e-commerce.

#### **Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `OrderId` | bigint | Order ID (Primary Key) |
| `hs_order_name` | nvarchar | Nome da ordem |
| `hs_external_order_id` | nvarchar | ID externo da ordem |
| `hs_total_price` | numeric | Preço total |
| `hs_subtotal_price` | numeric | Subtotal |
| `hs_order_discount` | numeric | Desconto |
| `hs_tax` | numeric | Imposto |
| `hs_shipping_cost` | numeric | Custo de envio |
| `hs_refund_amount` | numeric | Valor de reembolso |
| `hs_payment_status` | nvarchar | Status de pagamento |
| `hs_currency_code` | nvarchar | Moeda |
| `hs_processed_date` | datetime | Data de processamento |
| `hs_createdate` | datetime | Data de criação |
| `hs_lastmodifieddate` | datetime | Última modificação |
| `hs_billing_address_*` | nvarchar | Endereço de cobrança (múltiplos campos) |
| `hs_shipping_address_*` | nvarchar | Endereço de entrega (múltiplos campos) |

#### **Relacionamento:**
- `OrderDealAssociations.OrderId` → `Order.OrderId`
- `OrderDealAssociations.DealId` → `Deal.DealId`

---

### 6️⃣ **Payment** (Tabela de Pagamentos)

**Descrição:** Contém informações de pagamentos.

#### **Campos Esperados:**
- `PaymentId` (Primary Key)
- Valor do pagamento
- Data do pagamento
- Status
- Método de pagamento

#### **Relacionamento:**
- `PaymentDealAssociations.PaymentId` → `Payment.PaymentId`
- `PaymentDealAssociations.DealId` → `Deal.DealId`

---

### 7️⃣ **Invoice** (Tabela de Faturas)

**Descrição:** Contém informações de faturas.

#### **Campos Esperados:**
- `InvoiceId` (Primary Key)
- Número da fatura
- Valor total
- Valor pago
- Data de emissão
- Data de vencimento

#### **Relacionamento:**
- `InvoiceDealAssociations.InvoiceId` → `Invoice.InvoiceId`
- `InvoiceDealAssociations.DealId` → `Deal.DealId`

---

## 🔗 RELACIONAMENTOS PRINCIPAIS

```
Deal (DealId)
  ├─ DealContactAssociations → Contact (VId) → Customer Email
  ├─ DealCompanyAssociations → Company (CompanyId) → Billing Business Name
  ├─ DealLineItemAssociations → LineItem (LineItemId) → Products
  ├─ OrderDealAssociations → Order (OrderId) → Order Details
  ├─ PaymentDealAssociations → Payment (PaymentId) → Payment Info
  └─ InvoiceDealAssociations → Invoice (InvoiceId) → Invoice Info
```

---

## 🎯 QUERY SQL RECOMENDADA PARA BACKEND

```sql
SELECT TOP 2000
  -- 1. Order (Order Number formato 371e321)
  d.dealname AS [Order],
  
  -- 2. HubSpot VID (Deal ID)
  d.DealId AS [HubSpot VID],
  
  -- 3. Date Ordered
  d.closedate AS [Date Ordered],
  
  -- 4. Billing Business Name
  COALESCE(d.billing_business_name, co.CompanyName, co.name) AS [Billing Business Name],
  
  -- 5. Customer
  c.email AS [Customer],
  
  -- 6. Paid Status
  d.paid_status AS [Paid Status],
  
  -- 7. Date Paid
  d.hs_closed_won_date AS [Date Paid],
  
  -- 8. Total Paid
  d.total_payment AS [Total Paid],
  
  -- 9. Total Discount
  d.ip__ecomm_bridge__discount_amount AS [Total Discount],
  
  -- 10. Total (valor final com desconto já aplicado)
  d.amount AS [Total],
  
  -- Campos adicionais úteis
  d.deal_currency_code AS currency,
  d.dealstage AS status,
  d.website_order_id,
  d.ip__ecomm_bridge__order_number,
  d.ecommerce_deal,
  d.createdate,
  d.hs_lastmodifieddate,
  c.firstname AS customer_firstname,
  c.lastname AS customer_lastname,
  c.phone AS customer_phone,
  co.CompanyId

FROM Deal d

-- JOIN com Contact (Customer)
LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
LEFT JOIN Contact c ON c.VId = dca.VId

-- JOIN com Company (Billing Business Name)
LEFT JOIN DealCompanyAssociations dcoa ON d.DealId = dcoa.DealId
LEFT JOIN Company co ON co.CompanyId = dcoa.CompanyId

WHERE 
  d.closedate IS NOT NULL
  AND d.closedate >= @startDate
  AND (
    d.ecommerce_deal = 'true' 
    OR d.ip__ecomm_bridge__order_number IS NOT NULL
  )

ORDER BY 
  d.closedate DESC,
  d.DealId DESC
```

---

## 📊 RESUMO DE CAMPOS POR COLUNA DO FRONTEND

| Coluna Frontend | Campo SQL | Tabela | Observações |
|-----------------|-----------|--------|-------------|
| **Order** | `dealname` | Deal | Formato: `371e321`, `a3d2c9a` |
| **HubSpot VID** | `DealId` | Deal | ID numérico único |
| **Date Ordered** | `closedate` | Deal | Data da ordem |
| **Billing Business Name** | `billing_business_name` ou `CompanyName` | Deal ou Company | Nome da empresa |
| **Customer** | `email` | Contact | Email do cliente |
| **Paid Status** | `paid_status` | Deal | `Paid`, `Unpaid`, `Partial` |
| **Date Paid** | `hs_closed_won_date` | Deal | Data do pagamento |
| **Total Paid** | `total_payment` | Deal | Valor efetivamente pago |
| **Total Discount** | `ip__ecomm_bridge__discount_amount` | Deal | Desconto aplicado |
| **Total** | `amount` | Deal | Valor final (com desconto) |

---

## ✅ CONCLUSÕES E RECOMENDAÇÕES

1. **Order Number** está em `Deal.dealname` e `Deal.ip__ecomm_bridge__order_number`
2. **Total** deve mostrar `Deal.amount` (valor final já com desconto aplicado)
3. **Total Paid** está em `Deal.total_payment`
4. **Total Discount** está em `Deal.ip__ecomm_bridge__discount_amount`
5. **Date Paid** está em `Deal.hs_closed_won_date`
6. **Billing Business Name** pode vir de `Deal.billing_business_name` ou `Company.CompanyName`
7. **Customer** vem de `Contact.email` via `DealContactAssociations`

### 🚨 IMPORTANTE:
- Filtrar por `d.ecommerce_deal = 'true'` para pegar apenas deals de e-commerce
- Muitos deals manuais NÃO têm `ip__ecomm_bridge__order_number`
- Campo `website_order_id` raramente está preenchido
- `paid_status` pode conter múltiplos valores separados por `;` (ex: `Unpaid;Paid;Partial`)

---

**Documentação gerada automaticamente** 🤖  
**Data:** 2026-01-07  
**Autor:** Jorge Marfetan + GitHub Copilot
