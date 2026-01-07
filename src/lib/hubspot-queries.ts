/**
 * Query SQL COMPLETA para HubSpot - Espelha o backend WEB EXATAMENTE
 * 
 * COLUNAS DO BACKEND (conforme investigação do banco):
 * 1. Order → dealname (formato: 371e321, a3d2c9a)
 * 2. HubSpot VID → DealId (ID numérico do deal)
 * 3. Date Ordered → closedate
 * 4. Billing Business Name → billing_business_name ou Company.CompanyName
 * 5. Customer → Contact.email
 * 6. Paid Status → paid_status
 * 7. Date Paid → hs_closed_won_date
 * 8. Total Paid → total_payment
 * 9. Total Discount → ip__ecomm_bridge__discount_amount
 * 10. Total → amount (valor final com desconto já aplicado)
 */

export const ENRICHED_HUBSPOT_QUERY = `
SELECT TOP 2000
  -- 1. Order (Order Number formato 371e321)
  d.dealname AS [Order],
  d.ip__ecomm_bridge__order_number AS order_number_backup,
  
  -- 2. HubSpot VID (Deal ID)
  d.DealId AS hubspot_vid,
  
  -- 3. Date Ordered
  d.closedate,
  d.createdate,
  d.hs_lastmodifieddate AS last_updated,
  
  -- 4. Billing Business Name
  d.billing_business_name,
  
  -- 5. Paid Status
  d.paid_status,
  
  -- 6. Date Paid
  d.hs_closed_won_date AS date_paid,
  
  -- 7. Total Paid
  d.total_payment AS total_paid,
  
  -- 8. Total Discount
  d.ip__ecomm_bridge__discount_amount AS total_discount,
  
  -- 9. Total (valor final)
  d.amount AS total_amount,
  
  -- Campos adicionais úteis
  d.deal_currency_code AS currency,
  d.dealstage AS status,
  d.pipeline,
  d.dealtype,
  d.ecommerce_deal,
  d.website_order_id,
  d.hubspot_owner_id AS owner_id,
  d.description AS deal_description,
  d.ip__ecomm_bridge__tax_amount AS tax_amount,
  d.discount_amount AS discount_amount_text,
  
  -- Customer (from Contact)
  c.VId AS contact_id,
  c.email AS customer_email,
  c.firstname AS customer_firstname,
  c.lastname AS customer_lastname,
  c.phone AS customer_phone,
  
  -- Company (Billing Business Name fallback)
  co.CompanyId AS company_id,
  co.CompanyName AS company_name,
  co.name AS company_name_alt

FROM Deal d

-- JOIN com Contact (Customer Email)
LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
LEFT JOIN Contact c ON c.VId = dca.VId

-- JOIN com Company (Billing Business Name)
LEFT JOIN DealCompanyAssociations dcoa ON d.DealId = dcoa.DealId
LEFT JOIN Company co ON co.CompanyId = dcoa.CompanyId

WHERE 
  d.closedate IS NOT NULL
  AND d.closedate >= @startDate
  AND (
    -- FILTRAR APENAS DEALS DE E-COMMERCE (order number formato 371e321)
    d.ip__ecomm_bridge__order_number IS NOT NULL
    OR d.ecommerce_deal = 'true'
    OR (d.dealname IS NOT NULL AND LEN(d.dealname) <= 10 AND d.dealname NOT LIKE '%provider%' AND d.dealname NOT LIKE '%DSD%')
  )

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
