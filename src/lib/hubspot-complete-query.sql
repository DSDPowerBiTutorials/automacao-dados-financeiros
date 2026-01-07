-- =====================================================
-- HubSpot COMPLETE Query - Espelho EXATO do Backend
-- Inclui TODAS as colunas disponíveis no sistema
-- =====================================================

SELECT 
  -- ============ IDENTIFICADORES ============
  d.dealid AS id,
  d.dealname AS order_number,
  d.hs_object_id AS hubspot_vid,
  
  -- ============ DATAS PRINCIPAIS ============
  d.data_do_pedido_web AS date_ordered,
  d.date_paid AS date_paid,
  d.createdate AS date_created,
  d.hs_lastmodifieddate AS date_updated,
  
  -- ============ BILLING INFO ============
  c.company_billing_name AS billing_business_name,
  d.billing_first_name AS billing_first_name,
  d.billing_last_name AS billing_last_name,
  CONCAT(d.billing_first_name, ' ', d.billing_last_name) AS billing_full_name,
  
  -- ============ SHIPPING INFO ============
  d.shipping_business_name AS shipping_business_name,
  d.shipping_first_name AS shipping_first_name,
  d.shipping_last_name AS shipping_last_name,
  CONCAT(d.shipping_first_name, ' ', d.shipping_last_name) AS shipping_full_name,
  d.shipping_method AS shipping_method,
  
  -- ============ CUSTOMER INFO ============
  con.email AS customer_email,
  CONCAT(con.firstname, ' ', con.lastname) AS customer_name,
  
  -- ============ STATUS & PAYMENT ============
  d.paid_status AS paid_status,
  d.dealstage AS status,
  d.gateway AS gateway,
  d.payment_subscription AS payment_subscription,
  
  -- ============ VALORES (CURRENCY) ============
  d.amount AS total,
  d.total_paid AS total_paid,
  d.total_discount AS total_discount,
  d.total_shipping AS total_shipping,
  d.total_tax AS total_tax,
  d.total_included_tax AS total_included_tax,
  d.total_price AS total_price,
  d.total_qty AS total_qty,
  
  -- ============ ITENS DO PEDIDO ============
  d.item_subtotal AS item_subtotal,
  d.item_total AS item_total,
  
  -- ============ OUTRAS INFORMAÇÕES ============
  d.coupon_code AS coupon_code,
  d.reference AS reference,
  d.short_number AS short_number,
  d.order_site AS order_site,
  d.order_type AS order_type,
  d.prevent_email AS prevent_email,
  
  -- ============ LINE ITEMS (Produtos) ============
  li.name AS product_name,
  li.hs_sku AS product_sku,
  li.quantity AS product_quantity,
  li.price AS product_price,
  li.amount AS product_amount,
  li.discount AS product_discount,
  
  -- ============ COMPANY INFO ============
  c.name AS company_name,
  c.domain AS company_domain,
  
  -- ============ METADATA ============
  d.hubspot_owner_id AS owner_id,
  d.pipeline AS pipeline,
  d.dealtype AS deal_type

FROM 
  [Jorge9660].[dbo].[deals] d

-- JOIN com Contacts (email e nome do cliente)
LEFT JOIN [Jorge9660].[dbo].[contacts] con
  ON d.associatedvids = con.vid
  
-- JOIN com Companies (dados da empresa)
LEFT JOIN [Jorge9660].[dbo].[companies] c
  ON d.associatedcompanyids = c.companyid

-- JOIN com Line Items (produtos do pedido)
LEFT JOIN [Jorge9660].[dbo].[line_items] li
  ON d.dealid = li.hs_object_id

WHERE 
  -- Filtrar apenas deals que são orders (não prospects)
  d.data_do_pedido_web IS NOT NULL
  OR d.dealname LIKE '%[0-9]%' -- Order numbers geralmente têm números

ORDER BY 
  d.data_do_pedido_web DESC,
  d.dealid DESC;
