/**
 * Query SQL COMPLETA para HubSpot - Espelha o backend WEB EXATAMENTE
 * 
 * COLUNAS DO BACKEND (conforme imagem):
 * 1. Order Number (dealname ou website_order_id)
 * 2. Reference / ID (referência com #)
 * 3. Status (dealstage)
 * 4. Date Ordered (closedate)
 * 5. Date Paid (date_paid)
 * 6. Total / Paid (amount e total_payment)
 * 7. Paid Status (paid_status)
 * 8. Product (Qty) (line item name + quantity)
 * 9. Customer (email do contact)
 */

export const ENRICHED_HUBSPOT_QUERY = `
SELECT TOP 2000
  -- ==========================================
  -- 1. ORDER NUMBER (Primary Key)
  -- ==========================================
  d.DealId,
  d.dealname as order_code,
  d.hs_object_id as hubspot_vid,
  
  -- ==========================================
  -- 2. REFERENCE / ID
  -- ==========================================
  d.dealname as reference,  -- Será formatado como #DEALNAME no frontend
  
  -- ==========================================
  -- 3. STATUS
  -- ==========================================
  d.dealstage as status,
  d.pipeline,
  
  -- ==========================================
  -- 4. DATE ORDERED
  -- ==========================================
  d.closedate as date_ordered,
  d.createdate,
  d.hs_lastmodifieddate as last_updated,
  
  -- ==========================================
  -- 5. DATE PAID
  -- ==========================================
  d.date_paid,
  d.hs_closed_won_date,
  
  -- ==========================================
  -- 6. TOTAL / PAID (Amounts)
  -- ==========================================
  d.amount as total_amount,
  d.total_payment as paid_amount,
  d.total_paid,
  d.total_discount,
  d.total_shipping,
  d.total_tax,
  d.amount_in_home_currency,
  d.deal_currency_code as currency,
  
  -- ==========================================
  -- 7. PAID STATUS
  -- ==========================================
  d.paid_status,
  
  -- ==========================================
  -- 8. PRODUCT (from LineItem)
  -- ==========================================
  (
    SELECT TOP 1 li.name
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_name,
  
  (
    SELECT TOP 1 li.description
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_description,
  
  (
    SELECT TOP 1 li.quantity
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_quantity,
  
  (
    SELECT TOP 1 li.hs_sku
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_sku,
  
  (
    SELECT TOP 1 li.price
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_price,
  
  -- ==========================================
  -- 9. CUSTOMER (from Contact)
  -- ==========================================
  c.email as customer_email,
  c.firstname as customer_firstname,
  c.lastname as customer_lastname,
  c.phone as customer_phone,
  c.VId as contact_id,
  
  -- ==========================================
  -- EXTRAS (Company, etc)
  -- ==========================================
  co.CompanyName as company_name,
  co.CompanyId as company_id,
  
  -- Additional fields
  d.hubspot_owner_id as owner_id,
  d.description as deal_description,
  d.website_order_id,
  d.website_source as order_site

FROM Deal d

-- JOIN com Contact (Cliente)
LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
LEFT JOIN Contact c ON c.VId = dca.VId

-- JOIN com Company (Empresa)
LEFT JOIN DealCompanyAssociations dcoa ON d.DealId = dcoa.DealId
LEFT JOIN Company co ON co.CompanyId = dcoa.CompanyId

WHERE 
  d.closedate IS NOT NULL
  AND d.closedate >= @startDate

ORDER BY 
  d.closedate DESC,
  d.DealId DESC
`;

-- ==========================================
  --CONTACT - Informações do Cliente
  -- ==========================================
  c.VId as contact_id,
  c.email as customer_email,
  c.firstname as customer_firstname,
  c.lastname as customer_lastname,
  c.phone as customer_phone,
  c.jobtitle as customer_jobtitle,
  c.clinic_name as customer_clinic,
  c.address as customer_address,
  c.city as customer_city,
  c.state as customer_state,
  c.country as customer_country,
  c.zip as customer_zip,

  -- ==========================================
  --COMPANY - Informações da Empresa
-- ==========================================
  co.CompanyId as company_id,
  co.CompanyName as company_name,
  co.industry as company_industry,
  co.website as company_website,
  co.city as company_city,
  co.country as company_country,
  co.phone as company_phone,

  -- ==========================================
  --LINEITEM - Produto(primeiro item)
-- ==========================================
  (
    SELECT TOP 1 li.description
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_name,

  (
    SELECT TOP 1 li.name
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_short_name,

  (
    SELECT TOP 1 li.quantity
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_quantity,

  (
    SELECT TOP 1 li.amount
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_amount,

  (
    SELECT TOP 1 li.price
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_unit_price,

  (
    SELECT TOP 1 li.hs_sku
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_sku,

  (
    SELECT TOP 1 li.cost_price
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_cost,

  (
    SELECT TOP 1 li.ip__ecomm_bridge__discount_amount
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_discount

FROM Deal d

--JOIN com Contact(Cliente)
LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
LEFT JOIN Contact c ON c.VId = dca.VId

--JOIN com Company(Empresa)
LEFT JOIN DealCompanyAssociations dcoa ON d.DealId = dcoa.DealId
LEFT JOIN Company co ON co.CompanyId = dcoa.CompanyId

WHERE
d.hs_lastmodifieddate >= @startDate
AND(d.dealstage LIKE '%won%' OR d.dealstage LIKE '%completed%' OR d.dealstage LIKE '%paid%')

ORDER BY d.closedate DESC
  `;

/**
 * Query simplificada (fallback se a enriquecida der erro)
 * 
 * Busca apenas dados essenciais:
 * - Deal básico
 * - Contact (email, nome)
 * 
 * Esta query é GARANTIDA de funcionar se as tabelas Deal e Contact existirem.
 */
export const SIMPLE_HUBSPOT_QUERY = `
SELECT TOP 2000
d.DealId,
  d.dealname,
  d.amount,
  d.closedate,
  d.createdate,
  d.dealstage,
  d.deal_pipeline as pipeline,
  d.deal_currency_code as currency,
  d.hubspot_owner_id as owner_id,
  c.email as customer_email,
  c.firstname as customer_firstname,
  c.lastname as customer_lastname
FROM Deal d
LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
LEFT JOIN Contact c ON c.VId = dca.VId
WHERE
d.hs_lastmodifieddate >= @startDate
  AND d.dealstage LIKE '%won%'
ORDER BY d.closedate DESC
  `;

/**
 * Query INTERMEDIÁRIA - Tenta buscar Company e alguns campos de e-commerce
 * sem as subqueries pesadas de LineItem
 * 
 * Use esta se a query enriquecida falhar mas você ainda quer mais dados
 * que a query simples.
 */
export const INTERMEDIATE_HUBSPOT_QUERY = `
SELECT TOP 2000
--DEAL(Venda)
d.DealId,
  d.dealname,
  d.amount,
  d.closedate,
  d.createdate,
  d.dealstage,
  d.deal_pipeline as pipeline,
  d.deal_currency_code as currency,
  d.hubspot_owner_id as owner_id,
  d.description as deal_description,
  d.hs_closed_won_date,
  d.hs_lastmodifieddate,

  --CONTACT(Cliente)
c.VId as contact_id,
  c.email as customer_email,
  c.firstname as customer_firstname,
  c.lastname as customer_lastname,
  c.phone as customer_phone,

  --COMPANY(Empresa)
co.CompanyId as company_id,
  co.name as company_name,
  co.industry as company_industry,
  co.city as company_city,
  co.country as company_country

FROM Deal d

--JOIN com Contact(Cliente)
LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
LEFT JOIN Contact c ON c.VId = dca.VId

--JOIN com Company(Empresa)
LEFT JOIN DealCompanyAssociations dcoa ON d.DealId = dcoa.DealId
LEFT JOIN Company co ON co.CompanyId = dcoa.CompanyId

WHERE
d.hs_lastmodifieddate >= @startDate
  AND d.dealstage LIKE '%won%'

ORDER BY d.closedate DESC
  `;
