-- =====================================================
-- HUBSPOT BACKEND WEB - QUERY COMPLETA
-- Replica EXATAMENTE as colunas mostradas no backend
-- =====================================================

/**
 * COLUNAS DISPONÍVEIS NO BACKEND (conforme prints):
 * 
 * ✅ Selecionadas (visíveis):
 * - HubSpot VID
 * - Date Ordered  
 * - Billing Business Name
 * - Customer
 * - Paid Status
 * - Date Paid
 * - Total Paid
 * - Total Discount
 * - Total
 * 
 * 📋 Disponíveis (não selecionadas):
 * - Billing First Name, Full Name, Last Name
 * - Coupon Code
 * - Data, Date Created, Date Updated
 * - Email, Gateway, ID
 * - Item Subtotal, Item Total
 * - Number
 * - Order Site, Order Type
 * - Payment Subscription
 * - Prevent Email, Reference
 * - Shipping Business Name, First Name, Full Name, Last Name, Method
 * - Short Number, Status
 * - Total Included Tax, Total Price, Total Qty, Total Shipping, Total Tax
 */

-- Query TypeScript para src/lib/hubspot-queries.ts:

export const COMPLETE_HUBSPOT_QUERY = `
SELECT TOP 2000
  -- ============ IDENTIFICADORES ============
  d.DealId AS id,
  d.dealname AS [Order],  -- Ex: 371e321, 98e020f
  d.hs_object_id AS [HubSpot VID],  -- 53360830866
  d.website_order_id AS [Number],  -- Número sequencial
  d.short_number AS [Short Number],
  
  -- ============ DATAS ============
  d.closedate AS [Date Ordered],  -- Yesterday, 29/12/2025, etc
  d.date_paid AS [Date Paid],
  d.createdate AS [Date Created],
  d.hs_lastmodifieddate AS [Date Updated],
  
  -- ============ BILLING INFO ============
  d.billing_business_name AS [Billing Business Name],  -- Evergreen Dental Group
  d.billing_first_name AS [Billing First Name],
  d.billing_last_name AS [Billing Last Name],
  CONCAT(d.billing_first_name, ' ', d.billing_last_name) AS [Billing Full Name],
  
  -- ============ CUSTOMER INFO (via Contact) ============
  c.email AS [Customer],  -- drm@evergreendental.com
  c.email AS [Email],
  CONCAT(c.firstname, ' ', c.lastname) AS customer_name,
  
  -- ============ SHIPPING INFO ============
  d.shipping_business_name AS [Shipping Business Name],
  d.shipping_first_name AS [Shipping First Name],
  d.shipping_last_name AS [Shipping Last Name],
  CONCAT(d.shipping_first_name, ' ', d.shipping_last_name) AS [Shipping Full Name],
  d.shipping_method AS [Shipping Method],
  
  -- ============ STATUS & PAYMENT ============
  d.paid_status AS [Paid Status],  -- Paid, Unpaid
  d.dealstage AS [Status],
  d.gateway AS [Gateway],  -- Stripe, Braintree, etc
  d.payment_subscription AS [Payment Subscription],
  
  -- ============ VALORES ============
  d.amount AS [Total],  -- $500.00
  d.total_paid AS [Total Paid],  -- $500.00
  d.total_discount AS [Total Discount],  -- -$650.00
  d.total_shipping AS [Total Shipping],
  d.total_tax AS [Total Tax],
  d.total_included_tax AS [Total Included Tax],
  d.total_price AS [Total Price],
  d.total_qty AS [Total Qty],
  
  -- ============ ITENS ============
  d.item_subtotal AS [Item Subtotal],
  d.item_total AS [Item Total],
  
  -- ============ OUTRAS INFORMAÇÕES ============
  d.coupon_code AS [Coupon Code],
  d.reference AS [Reference],
  d.order_site AS [Order Site],
  d.order_type AS [Order Type],
  d.prevent_email AS [Prevent Email],
  d.data AS [Data],  -- Campo genérico
  
  -- ============ LINE ITEMS (Produtos) ============
  (
    SELECT TOP 1 li.name
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) AS product_name,
  
  (
    SELECT TOP 1 li.hs_sku
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) AS product_sku,
  
  (
    SELECT TOP 1 li.quantity
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) AS product_quantity,
  
  (
    SELECT TOP 1 li.price
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) AS product_price,
  
  -- ============ COMPANY INFO ============
  co.CompanyName AS company_name

FROM Deal d

-- JOIN com Contact (Customer/Email)
LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
LEFT JOIN Contact c ON c.VId = dca.VId

-- JOIN com Company (Company Name)
LEFT JOIN DealCompanyAssociations dcoa ON d.DealId = dcoa.DealId
LEFT JOIN Company co ON co.CompanyId = dcoa.CompanyId

WHERE 
  d.closedate IS NOT NULL  -- Apenas deals com data (orders reais)

ORDER BY 
  d.closedate DESC,
  d.DealId DESC
`;
