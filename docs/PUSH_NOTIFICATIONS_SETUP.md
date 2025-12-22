# Push Notifications Setup Guide

**Version:** 1.0.0  
**Sprint:** 12.3  
**Status:** Production-Ready

---

## Overview

The NexusCanon VMP includes a complete push notification system using the Web Push API. This guide covers setup, configuration, and usage.

---

## Prerequisites

1. **Node.js 18+** with `web-push` package installed
2. **HTTPS** (required for push notifications in production)
3. **Service Worker** registered (already implemented in Sprint 12.2)

---

## Step 1: Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for push notifications.

### Generate Keys

```bash
node scripts/generate-vapid-keys.js
```

This will output:
- `VAPID_PUBLIC_KEY` - Used by the client to subscribe
- `VAPID_PRIVATE_KEY` - Used by the server to send notifications
- `VAPID_SUBJECT` - Contact email or URL

### Add to Environment Variables

Add the generated keys to your `.env` file:

```env
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:admin@nexuscanon.com
```

**Important:** Never commit VAPID keys to version control!

---

## Step 2: Apply Database Migration

Apply the push subscriptions migration:

```bash
# Using Supabase MCP
# Apply migration 024_vmp_push_subscriptions.sql
```

Or manually run the SQL in `migrations/024_vmp_push_subscriptions.sql`.

This creates:
- `vmp_push_subscriptions` table
- Indexes for performance
- RLS policies for security

---

## Step 3: Verify Configuration

### Check Environment Variables

The server will validate VAPID keys on startup. Check logs for:

```
[Push] VAPID keys initialized
```

If you see a warning, VAPID keys are not configured.

### Test VAPID Key Endpoint

```bash
curl http://localhost:9000/api/push/vapid-key
```

Should return:
```json
{
  "publicKey": "your_public_key_here"
}
```

---

## Step 4: Client-Side Registration

Push notifications are automatically registered when:

1. User grants notification permission
2. Service worker is active
3. VAPID public key is available

The registration happens in `src/utils/push-notifications.js` and is triggered on user interaction.

---

## Step 5: Sending Notifications

### Automatic Notifications

Push notifications are automatically sent when:

1. **Case Updates** - Via `createNotificationWithPush()` in adapter
2. **Payment Receipts** - Via `notifyVendorUsersForPayment()` in adapter

### Manual Sending

#### Send to a User

```javascript
import { sendPushToUser } from './src/utils/push-sender.js';

await sendPushToUser(userId, {
  title: 'Case Update',
  body: 'Your case has been updated',
  icon: '/icon-192.png',
  data: {
    type: 'case',
    caseId: 'case-uuid',
    url: '/cases/case-uuid'
  }
});
```

#### Send to a Vendor

```javascript
import { sendPushToVendor } from './src/utils/push-sender.js';

await sendPushToVendor(vendorId, {
  title: 'Payment Received',
  body: 'Payment of $1,000.00 has been processed',
  data: {
    type: 'payment',
    paymentId: 'payment-uuid'
  }
});
```

#### Send Case Notification

```javascript
import { sendCaseNotification } from './src/utils/push-sender.js';

await sendCaseNotification(caseId, userId, 'Your case has been updated', {
  title: 'Case Update',
  requireInteraction: false
});
```

#### Send Payment Notification

```javascript
import { sendPaymentNotification } from './src/utils/push-sender.js';

await sendPaymentNotification(paymentId, userId, {
  amount: 1000.00,
  currency_code: 'USD',
  payment_ref: 'PAY-12345'
});
```

---

## Step 6: Testing

### Test Notification Endpoint (Internal Only)

```bash
curl -X POST http://localhost:9000/api/push/test \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "userId": "user-uuid",
    "title": "Test Notification",
    "body": "This is a test push notification"
  }'
```

**Note:** Requires internal user authentication.

---

## API Endpoints

### `POST /api/push/subscribe`

Subscribe to push notifications.

**Request:**
```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "base64_key",
    "auth": "base64_auth"
  },
  "expirationTime": null
}
```

**Response:**
```json
{
  "success": true,
  "message": "Push subscription registered",
  "subscription": {
    "id": "subscription-uuid",
    "endpoint": "https://fcm.googleapis.com/..."
  }
}
```

### `POST /api/push/unsubscribe`

Unsubscribe from push notifications.

**Request:**
```json
{
  "endpoint": "https://fcm.googleapis.com/..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Push subscription removed"
}
```

### `GET /api/push/vapid-key`

Get VAPID public key for client-side registration.

**Response:**
```json
{
  "publicKey": "your_public_key_here"
}
```

---

## Database Schema

### `vmp_push_subscriptions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `vmp_vendor_users` |
| `vendor_id` | UUID | Foreign key to `vmp_vendors` |
| `endpoint` | TEXT | Push service endpoint URL |
| `p256dh_key` | TEXT | P256DH public key (base64) |
| `auth_key` | TEXT | Auth secret (base64) |
| `user_agent` | TEXT | Browser user agent |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |
| `expires_at` | TIMESTAMPTZ | Subscription expiration |
| `is_active` | BOOLEAN | Active status |

**Indexes:**
- `idx_push_subscriptions_user_id` - Fast user lookups
- `idx_push_subscriptions_vendor_id` - Fast vendor lookups
- `idx_push_subscriptions_active` - Filter active subscriptions
- `idx_push_subscriptions_endpoint` - Endpoint lookups

**Constraints:**
- Unique: `(user_id, endpoint)` - One subscription per user/endpoint

---

## Troubleshooting

### "VAPID keys not configured"

**Solution:** Add VAPID keys to `.env` file and restart server.

### "Subscription expired" errors

**Solution:** Expired subscriptions are automatically removed. This is normal behavior.

### Notifications not appearing

**Check:**
1. Browser notification permission is granted
2. Service worker is registered
3. VAPID keys are configured
4. Subscription is stored in database
5. Network connectivity

### "Failed to send push notification"

**Common causes:**
- Invalid subscription (expired/revoked)
- Network error
- VAPID key mismatch

**Solution:** Check server logs for specific error codes:
- `410` - Subscription expired (auto-removed)
- `404` - Subscription not found (auto-removed)
- `403` - Forbidden (auto-removed)

---

## Security Notes

1. **VAPID Private Key** - Never expose in client code
2. **RLS Policies** - Users can only see their own subscriptions
3. **HTTPS Required** - Push notifications require HTTPS in production
4. **Service Worker** - Must be served from same origin

---

## Performance

- **Automatic Cleanup** - Expired subscriptions are deactivated
- **Batch Sending** - Multiple subscriptions sent in parallel
- **Error Handling** - Failed subscriptions are automatically removed
- **Indexes** - Optimized for fast lookups

---

## Related Files

- `migrations/024_vmp_push_subscriptions.sql` - Database schema
- `src/adapters/supabase.js` - Subscription storage methods
- `src/utils/push-sender.js` - Notification sending logic
- `src/utils/push-notifications.js` - Client-side registration
- `scripts/generate-vapid-keys.js` - Key generation utility
- `public/sw.js` - Service worker (handles push events)

---

## Next Steps

1. ✅ Generate VAPID keys
2. ✅ Add to environment variables
3. ✅ Apply database migration
4. ✅ Test registration
5. ✅ Test sending notifications
6. ✅ Monitor subscription health

---

**Last Updated:** 2025-12-22  
**Version:** 1.0.0

