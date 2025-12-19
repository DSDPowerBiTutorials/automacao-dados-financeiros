# Split Invoice Feature - Implementation Guide

## Overview
The Split Invoice feature allows users to divide a single invoice into multiple parts, either by time (installments) or by dimensions (financial accounts, cost centers, cost types, or department cost types).

## Database Migration

### Execute Migration 007
Run the following SQL in Supabase SQL Editor to add split invoice support:

```sql
-- Located at: /scripts/migration/007_add_split_invoice_support.sql
-- This adds columns: is_split, parent_invoice_id, split_number, total_splits, split_type
```

**Key Fields:**
- `is_split`: Boolean flag indicating if invoice is part of a split
- `parent_invoice_id`: Foreign key to original invoice (NULL for parent invoices)
- `split_number`: Sequential number of this split (1, 2, 3, etc.)
- `total_splits`: Total number of splits created
- `split_type`: Type of split (installments, financial_account, cost_center, cost_type, dep_cost_type)

## Features

### 1. Split by Installments (1-12 months)
- Divides invoice into equal monthly payments
- Automatically calculates due dates (progressive monthly)
- Each installment has equal amount: `original_amount / installments`
- Example: €1,200 invoice split into 3 installments = 3 × €400

### 2. Split by Dimensions
Users can split invoices across different accounting dimensions:

#### Financial Account Split
- Distribute invoice amount across multiple financial accounts
- Custom percentages or amounts per account
- Must total 100% of original amount

#### Cost Center Split  
- Allocate costs to different cost centers
- Useful for shared expenses across departments

#### Cost Type Split
- Categorize single invoice across multiple cost types
- Flexible percentage-based allocation

#### Department Cost Type Split
- Split across department-specific cost types
- Fine-grained cost allocation control

## User Interface

### Actions Column - Split Button
- **Blue Split Icon**: Click to open split configuration dialog
- Appears on all non-split invoices
- Opens split configuration modal

### Split Status Column
Shows split state:
- **Part X/Y Badge** (blue): Click to view all related splits
- **Eye Icon + Count** (green): Parent invoice showing number of child splits
- **"-"**: Non-split invoice

### Split Configuration Dialog
1. **Original Invoice Info**: Shows invoice number, provider, amount, due date
2. **Split Type Selection**: Radio buttons for split method
3. **Installments Selector**: Dropdown 1-12 for monthly splits
4. **Preview**: Shows each installment amount and due date
5. **Dimension Configuration**: Add/remove split entries with custom amounts
6. **Validation**: Ensures total equals original amount

### View Splits Dialog
- Lists all parts of a split invoice
- Shows: part number, amount, due date, reconciliation status
- Highlights dimension differences (if any)
- Edit button for each split part
- Total validation

## Technical Implementation

### Type Definitions
```typescript
type Invoice = {
  ...
  is_split?: boolean;
  parent_invoice_id?: number | null;
  split_number?: number | null;
  total_splits?: number | null;
  split_type?: string | null;
  amount: number; // Mapped from invoice_amount
  scope: string; // Mapped from country_code
  is_reconciled?: boolean;
}
```

### State Management
```typescript
const [splitDialogOpen, setSplitDialogOpen] = useState(false);
const [splitInvoice, setSplitInvoice] = useState<Invoice | null>(null);
const [viewSplitsDialogOpen, setViewSplitsDialogOpen] = useState(false);
const [viewingSplitInvoice, setViewingSplitInvoice] = useState<Invoice | null>(null);
const [splitConfig, setSplitConfig] = useState({...});
```

### Key Functions
- `openSplitDialog(invoice)`: Opens split configuration
- `handleSplitInvoice()`: Creates split records in database
- `viewSplits(invoice)`: Opens split hierarchy view
- `formatEuropeanNumber(value, decimals)`: Number formatting

### Database Operations
```typescript
// Create parent record (is_split = true)
// Create N child records with parent_invoice_id
// Set split_number, total_splits, split_type on all records
// For installments: Calculate progressive due dates
// For dimensions: Copy base invoice, override dimension field
```

## Validation Rules
1. Total splits must be 1-100
2. Split number must be ≤ total_splits
3. For dimension splits: sum of amounts must equal original
4. Cannot split an already-split invoice (prevent nested splits)
5. Deleting parent invoice cascades to all children (ON DELETE CASCADE)

## Database Indexes
- `idx_accounts_payable_is_split`: Filter split invoices
- `idx_accounts_payable_parent_invoice_id`: Query children
- `idx_accounts_payable_split_type`: Filter by split type

## Usage Examples

### Example 1: Split into 6 Monthly Installments
1. Click split icon on €6,000 invoice
2. Select "Split by Installments"
3. Choose "6 installments" from dropdown
4. Review preview: 6 × €1,000
5. Click "Create Splits"
6. Result: 7 records total (1 parent + 6 children)

### Example 2: Split by Cost Centers
1. Click split icon on €5,000 expense
2. Select "Split by Cost Center"
3. Add Split 1: Marketing CC → €3,000 (60%)
4. Add Split 2: Sales CC → €2,000 (40%)
5. Verify total = €5,000
6. Click "Create Splits"
7. Result: 3 records (1 parent + 2 children with different cost centers)

## Column Visibility
Split Status column is included in:
- Column selector dropdown
- Visible columns state (23 total columns)
- Export functionality (Excel/PDF)
- Filter options

## Icons Used
- **Split Icon** (Lucide): Blue split icon for action button
- **Eye Icon** (Lucide): View splits on parent invoices

## Testing Checklist
- [ ] Execute migration 007 in Supabase
- [ ] Create installment split (test 1, 6, and 12 installments)
- [ ] Create financial account split
- [ ] Create cost center split
- [ ] View splits from parent invoice
- [ ] View splits from child invoice
- [ ] Edit individual split part
- [ ] Delete parent invoice (verify cascade)
- [ ] Verify split status column displays correctly
- [ ] Test split validation (totals must match)
- [ ] Export invoices with split data

## Future Enhancements
- [ ] Merge split invoices back together
- [ ] Partial payment allocation across splits
- [ ] Automated split suggestions based on history
- [ ] Split templates for recurring invoices
- [ ] Bulk split operations
- [ ] Split audit trail and history

## Notes
- Split functionality preserves all original invoice attributes
- Each split part is a fully independent invoice
- Reconciliation happens individually per split part
- Reports can filter by parent_invoice_id to see splits together
- Split type field enables analytics on split patterns
