/**
 * Query SQL COMPLETA para HubSpot - Espelha o backend WEB EXATAMENTE
 * 
 * COLUNAS DO BACKEND (conforme investigação do banco):
 * 1. Order → dealname (formato: 371e321, a3d2c9a, 8305674)
 * 2. HubSpot VID → DealId (ID numérico do deal)
 * 3. Date Ordered → closedate
 * 4. Billing Business Name → Company.CompanyName
 * 5. Customer → Contact.firstname + lastname + email
 * 6. Paid Status → paid_status
 * 7. Date Paid → hs_closed_won_date
 * 8. Total Paid → total_payment
 * 9. Total Discount → ip__ecomm_bridge__discount_amount
 * 10. Total → amount (valor final com desconto já aplicado)
 * 11. Product → LineItem.name, quantity, amount
 * 
 * ATUALIZADO: 2026-01-13 - Query completa com Deal + Contact + Company + LineItem
 */

export const ENRICHED_HUBSPOT_QUERY = `
SELECT
  -- =============================================
  -- DEAL (Venda/Pedido)
  -- =============================================
  d.DealId,
  d.dealname AS order_code,
  d.ip__ecomm_bridge__order_number AS ecomm_order_number,
  d.amount,
  d.amount_in_home_currency,
  d.deal_currency_code AS currency,
  d.closedate AS date_ordered,
  d.createdate,
  d.hs_closed_won_date AS date_paid,
  d.hs_lastmodifieddate AS last_updated,
  d.paid_status,
  d.total_payment,
  d.ip__ecomm_bridge__discount_amount AS discount_amount,
  d.ip__ecomm_bridge__tax_amount AS tax_amount,
  d.dealstage AS status,
  d.pipeline,
  d.dealtype,
  d.ecommerce_deal,
  d.website_order_id,
  d.website_source AS order_site,
  d.coupon_code,
  d.hubspot_owner_id AS owner_id,
  d.description AS deal_description,
  d.hs_is_closed,
  d.hs_is_closed_won,
  d.failed_payment_timestamp,
  
  -- =============================================
  -- CONTACT (Cliente)
  -- =============================================
  c.VId AS contact_id,
  c.email AS customer_email,
  c.firstname AS customer_firstname,
  c.lastname AS customer_lastname,
  c.phone AS customer_phone,
  c.jobtitle AS customer_jobtitle,
  c.city AS customer_city,
  c.country AS customer_country,
  
  -- =============================================
  -- COMPANY (Empresa)
  -- =============================================
  co.CompanyId AS company_id,
  co.CompanyName AS company_name,
  co.domain AS company_domain,
  co.industry AS company_industry,
  co.city AS company_city,
  co.country AS company_country,
  
  -- =============================================
  -- LINEITEM (Produto)
  -- =============================================
  li.LineItemId AS product_id,
  li.name AS product_name,
  li.description AS product_description,
  li.quantity AS product_quantity,
  li.amount AS product_amount,
  li.price AS product_unit_price,
  li.hs_sku AS product_sku,
  li.cost_price AS product_cost,
  li.discount AS product_discount

FROM Deal d

-- JOIN com Contact (Cliente)
LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
LEFT JOIN Contact c ON c.VId = dca.VId

-- JOIN com Company (Empresa)
LEFT JOIN DealCompanyAssociations dcoa ON d.DealId = dcoa.DealId
LEFT JOIN Company co ON co.CompanyId = dcoa.CompanyId

-- JOIN com LineItem (Produto) - pegar apenas o primeiro produto para evitar duplicatas
LEFT JOIN (
  SELECT DealId, MIN(LineItemId) AS LineItemId 
  FROM DealLineItemAssociations 
  GROUP BY DealId
) dlia ON d.DealId = dlia.DealId
LEFT JOIN LineItem li ON li.LineItemId = dlia.LineItemId

WHERE 
  d.closedate IS NOT NULL
  AND d.closedate >= @startDate

ORDER BY 
  d.closedate DESC,
  d.DealId DESC
`;

/**
 * Query SIMPLES (fallback se a enriquecida der erro)
 * 
 * Busca apenas dados essenciais:
 * - Deal básico
 * - Contact (email, nome)
 * 
 * Esta query é GARANTIDA de funcionar se as tabelas Deal e Contact existirem.
 */
export const SIMPLE_HUBSPOT_QUERY = `
SELECT
  d.DealId,
  d.dealname AS order_code,
  d.amount,
  d.amount_in_home_currency,
  d.deal_currency_code AS currency,
  d.closedate AS date_ordered,
  d.createdate,
  d.hs_closed_won_date AS date_paid,
  d.hs_lastmodifieddate AS last_updated,
  d.paid_status,
  d.total_payment,
  d.dealstage AS status,
  d.pipeline,
  d.dealtype,
  d.ecommerce_deal,
  d.website_order_id,
  d.coupon_code,
  d.hubspot_owner_id AS owner_id,
  c.VId AS contact_id,
  c.email AS customer_email,
  c.firstname AS customer_firstname,
  c.lastname AS customer_lastname,
  c.phone AS customer_phone
FROM Deal d
LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
LEFT JOIN Contact c ON c.VId = dca.VId
WHERE
  d.closedate IS NOT NULL
  AND d.closedate >= @startDate
ORDER BY d.closedate DESC
`;

/**
 * Query para buscar INVOICES (Faturas) do HubSpot
 * 
 * Busca dados da tabela Invoice com JOIN para Deal e Contact
 * Campos importantes:
 * - hs_unique_id → Número da fatura (#DSDES38F776D-53596)
 * - hs_invoice_date → Data de emissão
 * - hs_external_invoice_id → ID externo
 * - hs_amount_billed → Valor faturado
 * - hs_amount_paid → Valor pago
 * - hs_invoice_status → Status (paid/pending/overdue)
 */
export const INVOICE_HUBSPOT_QUERY = `
SELECT
  -- INVOICE (Fatura)
  i.InvoiceId,
  i.hs_unique_id AS invoice_number,
  i.hs_external_invoice_id AS external_invoice_id,
  i.hs_invoice_date AS invoice_date,
  i.hs_due_date AS due_date,
  i.hs_amount_billed AS amount_billed,
  i.hs_amount_paid AS amount_paid,
  i.hs_invoice_status AS invoice_status,
  i.hs_payment_date AS payment_date,
  i.hs_purchase_order_number AS purchase_order_number,
  i.hs_invoice_latest_contact_email AS contact_email,
  i.createdate AS invoice_created,
  i.hs_lastmodifieddate AS invoice_updated,
  
  -- DEAL (Venda - se associado)
  d.DealId,
  d.dealname AS order_code,
  d.amount AS deal_amount,
  d.deal_currency_code AS currency,
  d.closedate AS date_ordered,
  d.hs_closed_won_date AS date_paid,
  d.paid_status,
  
  -- CONTACT (Cliente)
  c.VId AS contact_id,
  c.email AS customer_email,
  c.firstname AS customer_firstname,
  c.lastname AS customer_lastname

FROM Invoice i

-- JOIN com Deal via InvoiceDealAssociations
LEFT JOIN InvoiceDealAssociations ida ON i.InvoiceId = ida.InvoiceId
LEFT JOIN Deal d ON d.DealId = ida.DealId

-- JOIN com Contact
LEFT JOIN DealContactAssociations dca ON d.DealId = dca.DealId
LEFT JOIN Contact c ON c.VId = dca.VId

WHERE
  i.hs_invoice_date IS NOT NULL
  AND i.hs_invoice_date >= @startDate

ORDER BY i.hs_invoice_date DESC
`;

/**
 * Query para contar total de Invoices disponíveis
 */
export const COUNT_INVOICES_QUERY = `
SELECT COUNT(*) AS total FROM Invoice WHERE hs_invoice_date IS NOT NULL
`;

/**
 * Query INTERMEDIÁRIA - Tenta buscar Company e alguns campos de e-commerce
 * sem as subqueries pesadas de LineItem
 * 
 * Use esta se a query enriquecida falhar mas você ainda quer mais dados
 * que a query simples.
 */
export const INTERMEDIATE_HUBSPOT_QUERY = `
SELECT
  -- DEAL (Venda)
  d.DealId,
  d.dealname AS order_code,
  d.ip__ecomm_bridge__order_number AS ecomm_order_number,
  d.amount,
  d.amount_in_home_currency,
  d.deal_currency_code AS currency,
  d.closedate AS date_ordered,
  d.createdate,
  d.hs_closed_won_date AS date_paid,
  d.hs_lastmodifieddate AS last_updated,
  d.paid_status,
  d.total_payment,
  d.ip__ecomm_bridge__discount_amount AS discount_amount,
  d.ip__ecomm_bridge__tax_amount AS tax_amount,
  d.dealstage AS status,
  d.pipeline,
  d.dealtype,
  d.ecommerce_deal,
  d.website_order_id,
  d.website_source AS order_site,
  d.coupon_code,
  d.hubspot_owner_id AS owner_id,
  d.description AS deal_description,

  -- CONTACT (Cliente)
  c.VId AS contact_id,
  c.email AS customer_email,
  c.firstname AS customer_firstname,
  c.lastname AS customer_lastname,
  c.phone AS customer_phone,
  c.city AS customer_city,
  c.country AS customer_country,

  -- COMPANY (Empresa)
  co.CompanyId AS company_id,
  co.CompanyName AS company_name,
  co.domain AS company_domain,
  co.industry AS company_industry,
  co.city AS company_city,
  co.country AS company_country

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

ORDER BY d.closedate DESC
`;
