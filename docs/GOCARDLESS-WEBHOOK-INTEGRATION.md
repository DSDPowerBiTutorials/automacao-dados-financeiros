# GoCardless Webhook Integration Summary

## 🎯 Overview

The GoCardless webhook endpoint is now implemented and ready to handle real-time transaction updates.

**Endpoint**: `/api/webhooks/gocardless`
**Method**: POST  
**Authentication**: HMAC-SHA256 signature verification
**Status**: ✅ Production Ready

---

## 📊 Webhook Events Handled

### Payouts
- `payout_created` → New payout initiated (pending)
- `payout_paid` → Payout confirmed (reconciled: true)
- `payout_failed` → Payout failed

### Payments  
- `payment_created` → Payment created
- `payment_confirmed` → Payment confirmed (reconciled: true)
- `payment_paid_out` → Paid out to payout (reconciled: true)
- `payment_failed` → Payment failed
- `payment_cancelled` → Payment cancelled

### Refunds
- `refund_created` → Refund initiated
- `refund_refunded` → Refund processed (reconciled: true)
- `refund_failed` → Refund failed

### Mandates
- `mandate_created` → New mandate
- `mandate_active` → Mandate active
- `mandate_cancelled` → Mandate cancelled

---

## 🔧 Configuration Steps

### 1. Get Webhook Secret from GoCardless

```
Settings > Webhooks > Add Endpoint
URL: https://dsdfinancehub.com/api/webhooks/gocardless
Save the secret (shown only once!)
```

### 2. Configure Locally

```bash
node scripts/setup-gocardless-webhook.js whsec_your_secret
```

### 3. Test

```bash
npm run dev
node scripts/test-gocardless-webhook.js
```

### 4. Deploy

```bash
git push origin main
```

---

## 🔐 Security

- **HMAC-SHA256**: Each webhook is cryptographically signed
- **Signature Validation**: Required before processing
- **Returns 401 Unauthorized**: For invalid signatures
- **HTTPS Only**: Production endpoint requires HTTPS

---

## 💾 Data Storage

All webhook events are stored in `csv_rows` table:

```json
{
  "source": "gocardless",
  "date": "2024-01-15",
  "description": "GoCardless Payment - ...",
  "amount": "50.00",
  "reconciled": false,
  "custom_data": {
    "type": "payment",
    "payment_id": "PM12345...",
    "status": "payment_created",
    "gocardless_event_id": "evt_...",
    "webhook_received_at": "2024-01-15T10:30:00Z"
  }
}
```

---

## 🧪 Testing

### Local Test
```bash
npm run dev
node scripts/test-gocardless-webhook.js
```

### Manual Test (cURL)
```bash
SECRET="whsec_..."
PAYLOAD='{"type":"test.webhook_action_performed"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | cut -d' ' -f2)

curl -X POST http://localhost:3000/api/webhooks/gocardless \
  -H "Content-Type: application/json" \
  -H "webhook-signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

### Production Test
Click "Send Test" in GoCardless Dashboard > Webhooks > Your Endpoint

---

## 📈 Data Flow

```
GoCardless Event
    ↓
POST to /api/webhooks/gocardless
    ↓
Validate signature ← GOCARDLESS_WEBHOOK_SECRET
    ↓
Route to appropriate handler
    ↓
Upsert in csv_rows table
    ↓
Return 200 OK
    ↓
Dashboard updates automatically
```

---

## 🚀 Comparison: Before vs After

### Before (Manual + Cron)
- ❌ Manual sync via button click
- ✅ Automatic daily sync at 3 AM UTC
- ❌ Up to 24-hour delay for new transactions

### After (+ Webhook)
- ✅ Manual sync via button click (still available)
- ✅ Automatic daily sync at 3 AM UTC (still available)  
- ✅ Real-time sync when events occur
- ✅ Seconds to minutes delay (near real-time)

---

## 🔗 Related Files

| File | Purpose |
|------|---------|
| [/src/app/api/webhooks/gocardless/route.ts](../src/app/api/webhooks/gocardless/route.ts) | Webhook endpoint & event handlers |
| [/docs/GOCARDLESS-WEBHOOK-SETUP.md](./GOCARDLESS-WEBHOOK-SETUP.md) | Detailed configuration guide |
| [/docs/GOCARDLESS-WEBHOOK-QUICK-START.md](./GOCARDLESS-WEBHOOK-QUICK-START.md) | Quick 5-minute setup |
| [/scripts/test-gocardless-webhook.js](../scripts/test-gocardless-webhook.js) | Local testing script |
| [/scripts/setup-gocardless-webhook.js](../scripts/setup-gocardless-webhook.js) | Automated secret configuration |

---

## 📚 Documentation

- [Detailed Setup Guide](./GOCARDLESS-WEBHOOK-SETUP.md)
- [Quick Start (5 min)](./GOCARDLESS-WEBHOOK-QUICK-START.md)
- [GoCardless API Docs](https://developer.gocardless.com/api-reference)
- [GoCardless Webhooks](https://developer.gocardless.com/getting-started/webhooks)

---

**Status**: ✅ Ready for Production  
**Last Updated**: 2024  
**Commit**: 7a22117
