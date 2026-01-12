# Braintree ↔ HubSpot (Order Linking)

## Objetivo
Permitir conciliação determinística usando o **Order ID do site** (ex: `5ebe90b`) como chave principal para ligar:
- HubSpot (deals/invoices internas) ↔ Payments (Braintree transactions)
- Bank payout/disbursement ↔ soma de transações ↔ orders

## Tabelas
- `csv_rows` (principal): linhas normalizadas + `custom_data` (JSONB)
- `order_transaction_links` (novo): vínculo determinístico `order_id` ↔ `transaction_id`

## Campos de link (chave)
### HubSpot (`source = hubspot`)
- `custom_data.order_code` = Order ID do site (chave principal)
- `custom_data.ecomm_order_number` = fallback/alias
- `custom_data.website_order_id` = ID numérico (quando existir)

### Braintree API (`source = braintree-api-revenue`)
- `custom_data.order_id` = `transaction.orderId` (quando existir)
- `custom_data.transaction_id` = `transaction.id`
- `custom_data.disbursement_id` = `transaction.disbursementDetails.disbursementId`
- `custom_data.merchant_account_id`, `custom_data.currency`

### Braintree API Fees (`source = braintree-api-fees`)
- `custom_data.transaction_id`
- `custom_data.order_id`
- `custom_data.disbursement_id` (para explicar payout = gross - fees)

### Disbursement (`source = braintree-api-disbursement`)
- `custom_data.disbursement_id`
- `custom_data.transaction_ids[]`

## Rotas/Endpoints relevantes
- `GET /api/braintree/explain-disbursement?disbursementId=...`
  - Retorna: gross (revenues), fees, net_expected, e agrupamento por `order_id` + lookup no HubSpot por `custom_data.order_code`.
- `POST /api/braintree/backfill-order-transaction-links`
  - Body: `{ dryRun?: boolean, limit?: number, provider?: string }`
  - Usa `csv_rows` (braintree-api-revenue) para popular `order_transaction_links`.

## Matching (prioridade)
No motor de matching, quando existir:
- `hubspot.custom_data.order_code` == `payment.custom_data.order_id`
=> match com confiança máxima (determinístico). Fuzzy/email/data/valor ficam como fallback.
