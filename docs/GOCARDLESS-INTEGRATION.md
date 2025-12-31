# GoCardless API Integration

## Overview
Full integration with GoCardless API for Direct Debit and payment management. Automatically syncs payouts and payments to the system.

## Configuration

### 1. Environment Variables
Add to `.env.local`:
```
GOCARDLESS_ACCESS_TOKEN=***REMOVED***
```

### 2. Accessing the Integration
- **Dashboard**: https://dsdfinancehub.com/reports/gocardless
- **API Endpoint (Manual Sync)**: POST `/api/gocardless/sync`
- **Cron Endpoint (Automatic Daily)**: GET `/api/cron/gocardless`

## Features

### Manual Sync
Click the "Sync API" button on the GoCardless page to manually synchronize transactions.

### Automatic Daily Sync (via Cron)
Set up in Vercel dashboard:
```
Cron schedule: 0 3 * * * (3 AM UTC daily)
URL: https://dsdfinancehub.com/api/cron/gocardless
Headers: x-cron-secret: [your-secret]
```

### Data Structure
Transactions stored in `csv_rows` table with:
- **source**: "gocardless"
- **date**: arrival_date or created_at
- **description**: Reference or auto-generated
- **amount**: Converted from cents to currency units
- **reconciled**: Manual flag for reconciliation
- **custom_data**: Metadata including:
  - `type`: "payout", "payment", or "refund"
  - `status`: Payment status (paid, pending, etc.)
  - `currency`: Transaction currency
  - `payout_id`: Associated payout reference
  - `payment_id`: Associated payment reference
  - `gocardless_id`: Unique GoCardless transaction ID

## Page Features

### Sync Button
- Fetches latest payouts and payments from GoCardless API
- Tests API connection first
- Shows success/error messages
- Updates last sync timestamp

### Filtering & Searching
- **Search**: By description or transaction ID
- **Type Filter**: Show Payouts, Payments, or Refunds
- **Sorting**: By date or other fields

### Column Selection
Customize visible columns:
- ID, Date, Description, Amount
- Type, Status, Reconciliation Flag
- Action Buttons

### Reconciliation
- Mark transactions as reconciled (toggle via checkbox button)
- Status persisted to database
- Color-coded indicators

### Editing
- Inline edit for date, description, and amount
- Save changes to database
- Cancel to discard changes

## API Endpoints

### POST `/api/gocardless/sync`
Manually trigger synchronization.

**Response**:
```json
{
  "success": true,
  "message": "GoCardless sync completed",
  "payoutsCount": 15,
  "paymentsCount": 342,
  "rowsSynced": 357,
  "creditor": "DSD Finance"
}
```

### GET `/api/gocardless/sync`
Get connection status and statistics.

**Response**:
```json
{
  "success": true,
  "connection": {
    "status": "connected",
    "creditor": "DSD Finance"
  },
  "stats": {
    "payoutsCount": 15,
    "paymentsCount": 342,
    "totalPayoutAmount": "5234.50",
    "totalPaymentAmount": "18234.67"
  }
}
```

### GET `/api/cron/gocardless`
Cron endpoint for automatic daily sync.

**Headers**:
```
x-cron-secret: [your-cron-secret]
```

## Library Functions

### `src/lib/gocardless.ts`

```typescript
// Test API connection
const result = await testGoCardlessConnection();
// Returns: { success: boolean; message: string; creditor?: string }

// Fetch all payouts
const payouts = await fetchGoCardlessPayouts();

// Fetch all payments
const payments = await fetchGoCardlessPayments();

// Full sync to Supabase
const result = await syncGoCardlessTransactions();
// Returns: { success: boolean; payoutsCount: number; paymentsCount: number; error?: string }
```

## Troubleshooting

### Connection Failed
1. Verify `GOCARDLESS_ACCESS_TOKEN` is correct
2. Check API token expiration
3. Ensure creditor account is active

### No Transactions Syncing
1. Check GoCardless account for recent payments/payouts
2. Verify token has correct permissions
3. Check Supabase RLS policies allow inserts

### Transactions Not Showing
1. Ensure `csv_rows` table has column `source` = "gocardless"
2. Check table has `custom_data` JSONB column
3. Verify Supabase connection is working

## Future Enhancements

- [ ] Webhook support for real-time updates
- [ ] Reconciliation with bank statements (Bankinter)
- [ ] Refund tracking and analytics
- [ ] Multi-currency balance reporting
- [ ] Payment failure notifications
- [ ] Custom transaction grouping

## References
- [GoCardless API Docs](https://developer.gocardless.com/api-reference/)
- [Cron Jobs in Next.js/Vercel](https://vercel.com/docs/cron-jobs)
