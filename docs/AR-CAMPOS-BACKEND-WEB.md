# 📊 Campos Disponíveis do Backend Web (HubSpot)

## 🎯 Objetivo
Listar todos os campos que vêm do HubSpot SQL Server para começar a criar **invoices no Contas a Receber (AR)** a partir das informações de venda da web.

---

## 📦 Campos Principais de Ordem/Pedido

### Identificadores
| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| **id** | bigint | Deal ID único | `8727781664` |
| **order_number** | nvarchar | Código da ordem (dealname) | `a3d2c9a`, `371e321` |
| **hubspot_vid** | nvarchar | HubSpot VID | `5352498` |
| **reference** | nvarchar | Número de referência | `546ce22` |
| **short_number** | nvarchar | Número curto | `371e321` |

### 📅 Datas
| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| **date_ordered** | datetime | Data do pedido web (closedate ou data_do_pedido_web) | `2025-12-03` |
| **date_paid** | datetime | Data do pagamento (hs_closed_won_date) | `2025-12-03` |
| **date_created** | datetime | Data de criação no sistema | `2025-12-02` |
| **date_updated** | datetime | Última atualização | `2025-12-03` |

### 💰 Valores Financeiros
| Campo | Tipo | Descrição | Exemplo | ⭐ Prioridade |
|-------|------|-----------|---------|--------------|
| **total** | numeric | Total da ordem | `7725`, `54.44` | ⭐⭐⭐ **USAR ESTE** |
| **total_price** | numeric | Preço total (alternativa) | `7725` | ⭐⭐ |
| **total_paid** | numeric | Total pago | `7725` | ⭐⭐ |
| **total_discount** | numeric | Desconto total | `0`, `1440` | ⭐⭐ |
| **total_shipping** | numeric | Custo de envio | `0` | ⭐ |
| **total_tax** | numeric | Imposto | `0` | ⭐ |
| **total_included_tax** | numeric | Imposto incluído | `0` | ⭐ |
| **item_subtotal** | numeric | Subtotal dos itens | - | ⭐ |
| **item_total** | numeric | Total dos itens | - | ⭐ |
| **total_qty** | numeric | Quantidade total | - | ⭐ |

### 👤 Informações do Cliente (Billing/Faturamento)
| Campo | Tipo | Descrição | Exemplo | Obs |
|-------|------|-----------|---------|-----|
| **customer_name** | nvarchar | Nome completo do cliente | `Ruchika Sachdev` | ⭐⭐⭐ |
| **customer_email** | nvarchar | Email do cliente | `labsmilesville@gmail.com` | ⭐⭐⭐ |
| **billing_business_name** | nvarchar | Razão social (empresa) | `ACME Inc.` | ⭐⭐⭐ |
| **billing_first_name** | nvarchar | Primeiro nome | `John` | ⭐ |
| **billing_last_name** | nvarchar | Sobrenome | `Doe` | ⭐ |
| **billing_full_name** | nvarchar | Nome completo (construído) | `John Doe` | ⭐ |

### 🚚 Informações de Entrega (Shipping)
| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| **shipping_business_name** | nvarchar | Nome da empresa (entrega) | - |
| **shipping_first_name** | nvarchar | Primeiro nome (entrega) | - |
| **shipping_last_name** | nvarchar | Sobrenome (entrega) | - |
| **shipping_full_name** | nvarchar | Nome completo (entrega) | - |
| **shipping_method** | nvarchar | Método de envio | - |

### 📊 Status e Pagamento
| Campo | Tipo | Descrição | Valores Possíveis |
|-------|------|-----------|-------------------|
| **paid_status** | nvarchar | Status do pagamento | `Paid`, `Unpaid`, `Partial` |
| **status** | nvarchar | Estágio do deal | `New`, `Negotiation`, `closedwon` |
| **gateway** | nvarchar | Gateway de pagamento | `Stripe`, `Braintree`, etc. |
| **payment_subscription** | nvarchar | Se é subscrito | `Yes`, `No` |

### 🎁 Informações de Promoção
| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| **coupon_code** | nvarchar | Código do cupom | `SUMMER2024` |

### 🌍 Outras Informações
| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| **order_site** | nvarchar | Site de origem | - |
| **order_type** | nvarchar | Tipo de ordem | - |
| **prevent_email** | boolean | Prevent email | - |
| **company_name** | nvarchar | Nome da empresa | - |
| **company_domain** | nvarchar | Domínio da empresa | - |
| **pipeline** | nvarchar | Pipeline HubSpot | - |
| **deal_type** | nvarchar | Tipo de deal | - |
| **owner_id** | nvarchar | ID do dono | - |

---

## 📦 Campos de Produtos (Line Items)

Para cada produto no pedido, estão disponíveis:

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| **product_name** | nvarchar | Nome do produto | `DSD Course Level 1` |
| **product_sku** | nvarchar | SKU do produto | `DSD-L1-001` |
| **product_quantity** | numeric | Quantidade | `1`, `2` |
| **product_price** | numeric | Preço unitário | `500.00` |
| **product_amount** | numeric | Valor total (qty × price) | `500.00` |
| **product_discount** | numeric | Desconto do produto | `0` |

---

## 🏢 Campos de Empresa (Company Info)

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| **company_name** | nvarchar | Nome da empresa | `ACME Inc.` |
| **company_domain** | nvarchar | Domínio | `example.com` |

---

## 🔗 Campos de Moeda

| Campo | Tipo | Descrição | Valores |
|-------|------|-----------|--------|
| **deal_currency_code** | nvarchar | Moeda da transação | `EUR`, `USD`, `GBP`, etc. |

---

## 📋 Como Usar Estes Campos para Contas a Receber (AR)

### Mapeamento Recomendado para Criar Invoices (AR)

Ao criar uma **invoice de receita (AR)** a partir de um pedido web, use:

| Campo da Invoice | Fonte no HubSpot | Observações |
|------------------|-----------------|------------|
| **invoice_date** | `date_ordered` | Data em que o pedido foi feito |
| **benefit_date** | `date_ordered` | Data em que a receita deve ser reconhecida |
| **due_date** | `date_paid` (ou date_ordered + payment_terms) | Quando o pagamento é esperado |
| **customer_code** | Vincular com tabela `customers` (novo campo) | Criar/vincular cliente no AR |
| **customer_name** | `customer_name` ou `billing_business_name` | Nome para ref. |
| **invoice_amount** | **`total`** (campo principal) | Valor da fatura |
| **currency** | `deal_currency_code` | Moeda da transação |
| **description** | `product_name` (primeiro) + lista de produtos | Descrição dos itens |
| **financial_account_code** | Selecionar conta de **receita** (101.x, 102.x, etc.) | **⭐ Importante: type = 'revenue'** |
| **payment_method_code** | `gateway` | Stripe, Braintree, etc. |
| **cost_center_code** | Definir conforme departamento | Departamento responsável |
| **reference** | `order_number` ou `short_number` | Referência do pedido original |
| **notes** | Adicionar detalhes de `product_name`, `coupon_code`, etc. | Informações adicionais |

---

## ⚠️ Campos Ainda Não Disponíveis no Sistema

Para um mapeamento completo, você pode precisar:

- **tax_id / VAT** do cliente → Buscar em tabela Company do HubSpot
- **billing_address_*** → Disponível no HubSpot, precisa ser armazenado
- **shipping_address_*** → Disponível no HubSpot, precisa ser armazenado
- **website_order_id** → ID numérico do pedido no site (já está em deal.website_order_id)

---

## 🚀 Próximos Passos

1. **Criar tabela `ar_orders`** ou estender `invoices` com campo `web_order_id`
2. **Sincronizar dados** do HubSpot para `ar_orders` (via webhook ou API)
3. **Criar página de UI** em `/accounts-receivable/orders` para visualizar pedidos da web
4. **Auto-gerar invoices** (AR) a partir de orders do web com mapeamento acima
5. **Reconciliar** com pagamentos recebidos (Stripe, Braintree, etc.)

---

## 📌 Query SQL Utilizada

A query completa que busca estes campos está em:
- **Arquivo**: `/workspaces/automacao-dados-financeiros/src/lib/hubspot-complete-query.sql`
- **Tabelas HubSpot**: Deal, Contact, Company, Line_Items
- **Atualizado em**: 2026-01-29

---

## ✅ Resumo

✅ **Disponível e pronto**: ID, datas, valores, cliente, produtos  
✅ **Implementado**: Sincronização HubSpot → csv_rows  
⚠️ **Pendente**: Tabela AR Orders dedicada, UI para criar invoices automaticamente
