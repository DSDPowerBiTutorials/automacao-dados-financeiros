/**
 * Query SQL COMPLETA para HubSpot - Espelha o backend WEB EXATAMENTE
 * 
 * COLUNAS DO BACKEND (conforme prints do sistema):
 * 1. Order (dealname - ex: 371e321)
 * 2. HubSpot VID (hs_object_id - ex: 53360830866)
 * 3. Date Ordered (closedate)
 * 4. Billing Business Name (company_name ou billing_business_name)
 * 5. Customer (email do contact)
 * 6. Paid Status (paid_status)
 * 7. Date Paid (date_paid)
 * 8. Total Paid (total_paid)
 * 9. Total Discount (total_discount)
 * 10. Total (amount)
 */

export const ENRICHED_HUBSPOT_QUERY = `
SELECT TOP 2000
  -- ==========================================
  -- IDs e Order
  -- ==========================================
  d.DealId,
  d.dealname,  -- Order (371e321)
  d.hs_object_id as hubspot_vid,  -- HubSpot VID
  d.website_order_id,
  Datas (Date Ordered & Date Paid)
  -- ==========================================
  d.closedate,  -- Date Ordered
  d.createdate,
  d.hs_lastmodifieddate as last_updated,
  d.date_paid,  -- Date Paid
  d.hs_closed_won_date,
  
  -- ==========================================
  -- Billing Business Name
  -- ==========================================
  d.billing_business_name,
  
  -- ==========================================
  -- Status & Payment
  -- ==========================================
  d.paid_status,  -- Paid Status
  d.dealstage as status,
  d.pipeline,
  
  -- ==========================================
  -- Valores (Total, Total Paid, Total Discount)
  -- ==========================================
  d.amount,  -- Total
  d.total_paid,  -- Total Paid
  d.total_discount,  -- Total Discount
  d.total_shipping,
  d.total_tax,
  d.total_price,
  d.deal_currency_code as currencyATUS
  -- ==========================================
  d.paid_status,
  
  -- ==========================================
  -- 8. PRODUCT (from LineItem)
  -- ==========================================
  (
    SELECT TOP 1 li.name
    FROM DealLineItemAssociations dlia
  -- ==========================================
  -- Customer (from Contact) - Email
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
