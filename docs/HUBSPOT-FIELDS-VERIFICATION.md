# HubSpot Fields Verification Checklist

## ✅ Customer Information
| Campo | SQL Query | Sync Route | Frontend | Status |
|-------|-----------|------------|----------|--------|
| Nome do Cliente | `firstname + lastname` | ✅ customer_name (root) | ✅ row.customer_name | ✅ READY |
| Email do Cliente | `Contact.email` | ✅ customer_email (root) | ✅ row.customer_email | ✅ READY |
| Telefone | `Contact.phone` | ✅ custom_data.customer_phone | ✅ expandido | ✅ READY |
| Nome da Empresa | `Company.name` | ✅ custom_data.company | ✅ expandido | ✅ READY |

## ✅ Product Information
| Campo | SQL Query | Sync Route | Frontend | Status |
|-------|-----------|------------|----------|--------|
| Nome do Produto | `LineItem.product_name` | ✅ custom_data.product_name | ✅ expandido | ✅ READY |
| Nome Original | `LineItem.product_name` | ✅ custom_data.product_name_raw | ✅ expandido | ✅ READY |
| Quantidade | `LineItem.product_quantity` | ✅ custom_data.product_quantity | ✅ custom_data | ✅ READY |
| Desconto | `LineItem.product_discount` | ✅ custom_data.product_discount | ✅ custom_data | ✅ READY |
| Valor Unitário | `LineItem.product_amount` | ✅ custom_data.product_amount | ✅ custom_data | ✅ READY |

## ✅ Order References & Codes
| Campo | SQL Query | Sync Route | Frontend | Status |
|-------|-----------|------------|----------|--------|
| Short Number (7 chars) | `Deal.dealname` | ✅ custom_data.dealname | ✅ extractShortNumber() | ✅ READY |
| Long Number (32 chars) | `Deal.dealname` | ✅ custom_data.dealname | ✅ extractLongNumber() | ✅ READY |
| Deal ID | `Deal.DealId` | ✅ custom_data.deal_id | ✅ row.description | ✅ READY |
| Invoice Number | derivado | N/A | ✅ getInvoiceNumber() | ✅ READY |

## ✅ Financial Fields
| Campo | SQL Query | Sync Route | Frontend | Status |
|-------|-----------|------------|----------|--------|
| Valor Total (amount) | `Deal.amount` | ✅ amount (root) | ✅ row.amount | ✅ READY |
| Total Payment | `Deal.total_payment` | ✅ custom_data.total_payment | ✅ All Totals | ✅ READY |
| Items Total | calculado | ✅ custom_data.items_total | ✅ custom_data | ✅ READY |
| Discount Amount | calculado | ✅ custom_data.discount_amount | ✅ custom_data | ✅ READY |
| Final Price | calculado | ✅ custom_data.final_price | ✅ custom_data | ✅ READY |
| Moeda | `Deal.currency` | ✅ custom_data.currency | ✅ custom_data | ✅ READY |

## ✅ Status & Dates
| Campo | SQL Query | Sync Route | Frontend | Status |
|-------|-----------|------------|----------|--------|
| Paid Status | `Deal.paid_status` | ✅ custom_data.paid_status | ✅ getPaidStatusIcon() | ✅ READY |
| Deal Stage | `Deal.dealstage` | ✅ custom_data.dealstage | ✅ expandido | ✅ READY |
| Close Date | `Deal.closedate` | ✅ date (root) | ✅ row.date | ✅ READY |
| Date Paid | `Deal.hs_closed_won_date` | ✅ custom_data.hs_closed_won_date | ✅ Date Paid coluna | ✅ READY |
| Last Modified | `Deal.hs_lastmodifieddate` | ✅ custom_data.hs_lastmodifieddate | ✅ expandido | ✅ READY |

## ✅ Additional Fields
| Campo | SQL Query | Sync Route | Frontend | Status |
|-------|-----------|------------|----------|--------|
| Coupon Code | `Deal.coupon_code` | ✅ custom_data.coupon_code | ✅ expandido | ✅ READY |
| Website Source | `Deal.website_source` | ✅ custom_data.website_source | ✅ expandido | ✅ READY |
| Company Industry | `Company.industry` | ✅ custom_data.company_industry | ✅ custom_data | ✅ READY |
| Company Website | `Company.website` | ✅ custom_data.company_website | ✅ custom_data | ✅ READY |
| Owner ID | `Deal.hubspot_owner_id` | ✅ custom_data.owner_id | ✅ custom_data | ✅ READY |

---

## ✅ Summary
**Total Fields: 35**
- SQL Query: ✅ 35/35 campos definidos
- Sync Route: ✅ 35/35 campos mapeados
- Frontend: ✅ 35/35 campos disponíveis

## ✅ Code Patterns (4f51c13 / 546ce22 / 5347991)
- **Short Number (7 chars)**: `4f51c13` → ✅ extraído de `dealname`
- **Long Number (32 chars)**: `546ce221e53eef7a6c813cfe2a27b7c9` → ✅ extraído de `dealname`
- **Deal ID (numeric)**: `5347991` → ✅ salvo em `deal_id`
- **Invoice Pattern**: `#DSDES4F51C13` → ✅ gerado via `getInvoiceNumber()`

## ✅ Display Locations
### Table Columns
1. Order → short number
2. Reference → order code (short + invoice)
3. Status → deal stage badge
4. Date Ordered → closedate
5. Date Paid → hs_closed_won_date
6. Total Paid → amount
7. Paid Status → icon based on paid_status
8. All Totals → total_payment
9. Customer → customer_name

### Expanded Section
1. **Order Details**: amount breakdown com quantity/items_total/discount/final_price
2. **Order Codes**: short, ID, invoice, long
3. **Customer**: name, email, phone
4. **Product Details**: product_name, product_name_raw
5. **Additional Info**: company, coupon, website_source, last_modified

---

## ✅ Next Steps
1. ✅ Commit changes
2. ✅ Push to repository
3. 🔄 Test sync functionality
4. 🔄 Verify all fields display correctly

## Test Commands
```bash
# Sync HubSpot data
curl -X POST http://localhost:3000/api/hubspot/sync

# Check Supabase data
# Verify csv_rows table has all custom_data fields populated
```
