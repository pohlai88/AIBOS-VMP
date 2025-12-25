/**
 * Push Notification Sender (Sprint 12.3)
 * Sends push notifications using Web Push API
 */

import webpush from 'web-push';
import { vmpAdapter } from '../adapters/supabase.js';

// Initialize web-push with VAPID keys
let vapidInitialized = false;

/**
 * Initialize VAPID keys from environment variables
 */
function initializeVAPID() {
  if (vapidInitialized) return;

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject =
    process.env.VAPID_SUBJECT || process.env.SUPABASE_URL || 'mailto:admin@nexuscanon.com';

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[Push] VAPID keys not configured. Push notifications will not work.');
    console.warn('[Push] Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in environment variables.');
    return false;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  vapidInitialized = true;
  console.log('[Push] VAPID keys initialized');
  return true;
}

/**
 * Send push notification to a single subscription
 * @param {Object} subscription - Push subscription object from database
 * @param {Object} payload - Notification payload
 * @returns {Promise<boolean>} Success status
 */
export async function sendPushNotification(subscription, payload) {
  try {
    if (!vapidInitialized) {
      if (!initializeVAPID()) {
        throw new Error('VAPID keys not configured');
      }
    }

    // Convert database subscription to Web Push format
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh_key,
        auth: subscription.auth_key,
      },
    };

    // Default payload structure
    const notificationPayload = JSON.stringify({
      title: payload.title || 'NexusCanon VMP',
      body: payload.body || '',
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      data: payload.data || {},
      tag: payload.tag || 'vmp-notification',
      requireInteraction: payload.requireInteraction || false,
      ...payload,
    });

    // Send notification
    await webpush.sendNotification(pushSubscription, notificationPayload);
    return true;
  } catch (error) {
    // Handle specific error cases
    if (error.statusCode === 410) {
      // Subscription expired or invalid - deactivate it
      console.log(`[Push] Subscription expired: ${subscription.endpoint}`);
      const { vmpAdapter } = await import('../adapters/supabase.js');
      await vmpAdapter.removePushSubscription(subscription.user_id, subscription.endpoint);
      return false;
    }

    if (error.statusCode === 404 || error.statusCode === 403) {
      // Subscription not found or forbidden - deactivate it
      console.log(`[Push] Subscription invalid: ${subscription.endpoint}`);
      const { vmpAdapter } = await import('../adapters/supabase.js');
      await vmpAdapter.removePushSubscription(subscription.user_id, subscription.endpoint);
      return false;
    }

    // Other errors - log but don't deactivate
    console.error('[Push] Error sending notification:', error);
    throw error;
  }
}

/**
 * Send push notification to a user
 * @param {string} userId - User ID
 * @param {Object} payload - Notification payload
 * @returns {Promise<{sent: number, failed: number}>} Results
 */
export async function sendPushToUser(userId, payload) {
  try {
    const subscriptions = await vmpAdapter.getUserPushSubscriptions(userId);

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0, message: 'No active subscriptions' };
    }

    let sent = 0;
    let failed = 0;

    // Send to all subscriptions for this user
    for (const subscription of subscriptions) {
      try {
        const success = await sendPushNotification(subscription, payload);
        if (success) {
          sent++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`[Push] Failed to send to subscription ${subscription.id}:`, error);
        failed++;
      }
    }

    return { sent, failed, total: subscriptions.length };
  } catch (error) {
    console.error('[Push] Error sending to user:', error);
    throw error;
  }
}

/**
 * Send push notification to all users in a vendor
 * @param {string} vendorId - Vendor ID
 * @param {Object} payload - Notification payload
 * @returns {Promise<{sent: number, failed: number}>} Results
 */
export async function sendPushToVendor(vendorId, payload) {
  try {
    // Dynamic import to avoid circular dependency
    const { vmpAdapter } = await import('../adapters/supabase.js');
    const subscriptions = await vmpAdapter.getVendorPushSubscriptions(vendorId);

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0, message: 'No active subscriptions' };
    }

    let sent = 0;
    let failed = 0;

    // Send to all subscriptions for this vendor
    for (const subscription of subscriptions) {
      try {
        const success = await sendPushNotification(subscription, payload);
        if (success) {
          sent++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`[Push] Failed to send to subscription ${subscription.id}:`, error);
        failed++;
      }
    }

    return { sent, failed, total: subscriptions.length };
  } catch (error) {
    console.error('[Push] Error sending to vendor:', error);
    throw error;
  }
}

/**
 * Send push notification for a case update
 * @param {string} caseId - Case ID
 * @param {string} userId - User ID to notify
 * @param {string} message - Notification message
 * @param {Object} options - Additional options
 * @returns {Promise<{sent: number, failed: number}>} Results
 */
export async function sendCaseNotification(caseId, userId, message, options = {}) {
  const payload = {
    title: options.title || 'Case Update',
    body: message,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {
      type: 'case',
      caseId,
      url: `/cases/${caseId}`,
      ...options.data,
    },
    tag: `case-${caseId}`,
    requireInteraction: options.requireInteraction || false,
  };

  return await sendPushToUser(userId, payload);
}

/**
 * Send push notification for a payment receipt
 * @param {string} paymentId - Payment ID
 * @param {string} userId - User ID to notify
 * @param {Object} paymentData - Payment data
 * @returns {Promise<{sent: number, failed: number}>} Results
 */
export async function sendPaymentNotification(paymentId, userId, paymentData) {
  const amount = paymentData.amount || 0;
  const currency = paymentData.currency_code || 'USD';

  const payload = {
    title: 'Payment Received',
    body: `Payment of ${currency} ${amount.toFixed(2)} has been processed`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {
      type: 'payment',
      paymentId,
      url: `/payments/${paymentId}`,
      amount,
      currency,
    },
    tag: `payment-${paymentId}`,
    requireInteraction: false,
  };

  return await sendPushToUser(userId, payload);
}
