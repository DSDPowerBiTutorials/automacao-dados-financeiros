# AR Invoices Page - Guide

## ✅ Status: Complete & Deployed

The AR (Accounts Receivable) Invoices page has been created with full feature parity to AP Invoices (3,910 lines).

---

## 🎯 Key Features

### 1. **Full CRUD Operations**
- Create, Read, Update, Delete invoices
- Support for revenue invoice types: REVENUE, BUDGET, ADJUSTMENT
- Default type: `REVENUE` (actual revenues)

### 2. **Customer Integration**
- Uses `customer_code` field (linked to `customers` table)
- Dynamic customer dropdown with search
- Auto-load customer details on selection

### 3. **Financial Accounts**
- Filtered by `type='revenue'` (series 100)
- 38 revenue accounts available:
  - 101.x Growth (DSD Courses, Mastership, Partnerships)
  - 102.x Delight (Level 3 ROW/AMEX, Training)
  - 103.x Planning Center (Membership, Services)
  - 104.x LAB (Software, Onboarding)
  - 105.x Other Income

### 4. **Split Invoice Functionality**
- Split by installments (payment plans)
- Split by financial account (multi-product)
- Split by cost center
- Split by cost type/dep cost type
- Maintain parent-child relationships

### 5. **Excel Import/Export**
- Export visible columns to XLSX
- Import from Excel template
- European number format support (1.250,00)

### 6. **Advanced Filtering**
- Filter by customer, date range, amount, status
- Multi-select filters with search
- Column visibility toggles (20+ columns)
- Scope filtering (ES/US/GLOBAL)

### 7. **Payment Reconciliation**
- Track payment status
- Mark as reconciled
- Link payment dates
- Schedule future payments

---

## 📊 Import October Receivables

### Option 1: Using Excel Import (Recommended)

1. **Access AR Invoices page**:
   - Navigate to: `/accounts-receivable/invoices`
   - Click "Import from Excel" button

2. **Prepare Excel file**:
   Required columns:
   ```
   Invoice Date    | Customer Code | Description           | Amount  | Currency | Financial Account Code
   ---------------+---------------+----------------------+---------+----------+-----------------------
   2024-10-15     | ES-CU00001    | DSD Course Oct       | 1250.00 | EUR      | 101.1
   2024-10-20     | US-CU00002    | Mastership Program   | 3500.00 | USD      | 101.2
   ```

   Optional columns:
   - Invoice Number
   - Due Date
   - Payment Status
   - Notes
   - Cost Center Code
   - Bank Account Code

3. **Upload**:
   - Drag & drop or select file
   - System validates and imports
   - Review imported records

### Option 2: Manual Entry

1. Click "+ New Invoice" button
2. Fill required fields:
   - **Invoice Date**: Date of invoice
   - **Customer**: Select from dropdown
   - **Financial Account**: Select revenue account (series 100)
   - **Amount**: Invoice value
   - **Currency**: EUR/USD/GBP
   - **Country**: ES/US/GLOBAL

3. Optional fields:
   - Description
   - Invoice Number
   - Due Date
   - Payment Method
   - Bank Account
   - Cost Center

4. Click "Create Invoice"

### Option 3: Bulk Insert via SQL

If you have a CSV/Excel with October data, you can insert directly:

```sql
-- Example: Insert October receivables
INSERT INTO invoices (
  input_date, invoice_date, benefit_date, invoice_type, entry_type,
  financial_account_code, invoice_amount, currency, eur_exchange,
  customer_code, country_code, scope, dre_impact, cash_impact,
  description, invoice_number
)
VALUES
  (
    CURRENT_TIMESTAMP,
    '2024-10-15',
    '2024-10-15',
    'REVENUE',
    'credit',
    '101.1', -- DSD Courses
    1250.00,
    'EUR',
    1.0,
    'ES-CU00001', -- Customer code from customers table
    'ES',
    'ES',
    true,
    true,
    'DSD Course - October',
    'INV-2024-10-001'
  ),
  -- Add more rows...
;
```

---

## 🔍 Key Differences from AP Invoices

| Feature               | AP Invoices          | AR Invoices          |
|----------------------|---------------------|---------------------|
| Reference Field      | `provider_code`     | `customer_code`     |
| Master Data Table    | `providers`         | `customers`         |
| Default Invoice Type | `INCURRED`          | `REVENUE`           |
| Financial Accounts   | `type='expense'`    | `type='revenue'`    |
| Account Series       | Series 200 (COGS/OpEx) | Series 100 (Revenue) |
| Entry Type           | `debit` (expense)   | `credit` (revenue)  |
| Labels               | "Provider", "Fornecedor" | "Customer", "Cliente" |

---

## 🗂️ Data Structure

### Invoice Fields (AR-specific)

```typescript
type Invoice = {
  id: number;
  input_date: string;
  invoice_date: string;
  benefit_date: string;
  due_date?: string | null;
  invoice_type: "REVENUE" | "BUDGET" | "ADJUSTMENT";
  entry_type: "credit"; // Always credit for revenue
  financial_account_code: string; // Series 100
  invoice_amount: number;
  currency: string;
  eur_exchange: number;
  customer_code: string; // 👈 AR-specific
  bank_account_code?: string | null;
  payment_method_code?: string | null;
  cost_center_code?: string | null;
  description?: string | null;
  invoice_number?: string | null;
  country_code: string;
  scope: string;
  dre_impact: boolean; // true for REVENUE
  cash_impact: boolean; // true when paid
  is_reconciled?: boolean;
  payment_status?: string | null;
  is_split?: boolean;
  parent_invoice_id?: number | null;
  created_at: string;
  updated_at: string;
};
```

---

## 📝 October Receivables Checklist

### Before Importing:

- [ ] Verify `customers` table has all customer codes
- [ ] Check `financial_accounts` has revenue accounts (series 100)
- [ ] Confirm customer codes match (ES-CU00001, US-CU00002, etc.)
- [ ] Prepare data with required columns

### During Import:

- [ ] Set invoice_type = `REVENUE`
- [ ] Set entry_type = `credit`
- [ ] Use customer_code (not provider_code)
- [ ] Select financial accounts from series 100
- [ ] Set country scope (ES/US/GLOBAL)
- [ ] Mark `dre_impact = true`

### After Import:

- [ ] Verify invoice count matches October data
- [ ] Check total amount matches expected revenue
- [ ] Review customer distribution
- [ ] Confirm financial account allocations
- [ ] Test filtering and search
- [ ] Validate scope filtering

---

## 🚀 Next Steps

1. **Import October data**:
   - Locate CSV/Excel file
   - Map columns to invoice fields
   - Import via Excel or SQL

2. **Verify data**:
   - Check invoice list
   - Validate totals
   - Test customer links

3. **Payment reconciliation**:
   - Match invoices to bank receipts
   - Mark as paid/reconciled
   - Update payment dates

4. **Reports** (future):
   - Aging report (overdue receivables)
   - Collection dashboard
   - Customer statements
   - Revenue analysis by product

---

## ❓ Where is the October CSV?

**User mentioned**: "Tenho um CSV com os recebimentos de outubro"

**Next action**: Please share or specify the location of the October receivables CSV/Excel file so I can:
1. Examine structure and columns
2. Create import mapping
3. Load data into AR Invoices
4. Verify imported records

Possible locations to check:
- Email attachments
- `data/` directory (not found yet)
- Google Drive/Dropbox link
- Bank export files
- Accounting system export

---

## 📞 Support

If you need help with:
- Import mapping
- Data validation
- Custom fields
- Split invoices
- Excel templates

Please provide the October CSV file or sample data, and I'll assist with the import process.
