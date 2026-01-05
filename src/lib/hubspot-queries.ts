/**
 * Query SQL enriquecida para HubSpot
 * 
 * Busca dados de:
 * - Deal (venda)
 * - Contact (cliente) - email, nome, telefone
 * - Company (empresa)
 * - LineItem (produtos)
 */

export const ENRICHED_HUBSPOT_QUERY = `
SELECT TOP 2000
  -- DEAL (Venda)
  d.DealId,
  d.dealname,
  d.amount,
  d.closedate,
  d.createdate,
  d.dealstage,
  d.deal_pipeline as pipeline,
  d.deal_currency_code as currency,
  d.hubspot_owner_id as owner_id,
  d.ip__ecomm_bridge__order_number as ecomm_order_number,
  d.website_order_id,
  d.description as deal_description,
  
  -- CONTACT (Cliente)
  c.VId as contact_id,
  c.email as customer_email,
  c.firstname as customer_firstname,
  c.lastname as customer_lastname,
  c.phone as customer_phone,
  c.jobtitle as customer_jobtitle,
  c.clinic_name as customer_clinic,
  
  -- COMPANY (Empresa)
  co.CompanyId as company_id,
  co.name as company_name,
  co.industry as company_industry,
  co.website as company_website,
  co.city as company_city,
  co.country as company_country,
  
  -- LINEITEM (Produto) - pegar o primeiro associado
  (
    SELECT TOP 1 
      li.description
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_name,
  
  (
    SELECT TOP 1 
      li.amount
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_amount,
  
  (
    SELECT TOP 1 
      li.quantity
    FROM DealLineItemAssociations dlia
    LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId
    WHERE dlia.DealId = d.DealId
    ORDER BY li.hs_position_on_quote
  ) as product_quantity

FROM Deal d

-- JOIN com Contact (Cliente)
LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
LEFT JOIN Contact c ON c.VId = dca.VId

-- JOIN com Company (Empresa)
LEFT JOIN DealCompanyAssociations dcoa ON d.DealId = dcoa.DealId
LEFT JOIN Company co ON co.CompanyId = dcoa.CompanyId

WHERE 
  d.hs_lastmodifieddate >= @startDate
  AND d.dealstage LIKE '%won%'  -- Apenas deals ganhos

ORDER BY d.closedate DESC
`;

/**
 * Query simplificada (fallback se a enriquecida der erro)
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
