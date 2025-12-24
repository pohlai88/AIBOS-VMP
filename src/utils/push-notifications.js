/**
 * Push Notifications Utility (Sprint 12.3)
 * Handles push notification registration and management
 */

let registration = null;
let subscription = null;

/**
 * Request push notification permission and register
 */
export async function requestPushPermission() {
  if (!isPushSupported()) {
    console.warn('[Push] This browser does not support push notifications');
    return null;
  }

  if (Notification.permission === 'granted') {
    return await registerPushSubscription();
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      return await registerPushSubscription();
    } else if (permission === 'denied') {
      console.warn('[Push] Notification permission denied by user');
      return null;
    }
  }

  return null;
}

/**
 * Register push subscription with service worker
 */
async function registerPushSubscription() {
  try {
    if (!('serviceWorker' in navigator)) {
      console.warn('[Push] Service Worker not supported');
      return null;
    }

    registration = await navigator.serviceWorker.ready;

    // Get VAPID public key from server (or use environment variable)
    // For client-side, we need to fetch it from the server
    let vapidPublicKey;
    try {
      const response = await fetch('/api/push/vapid-key');
      if (response.ok) {
        const data = await response.json();
        vapidPublicKey = data.publicKey;
      } else {
        // Fallback: try to get from meta tag or use default
        const metaTag = document.querySelector('meta[name="vapid-public-key"]');
        vapidPublicKey = metaTag?.content || null;
      }
    } catch (error) {
      console.warn('[Push] Failed to fetch VAPID key from server:', error);
      const metaTag = document.querySelector('meta[name="vapid-public-key"]');
      vapidPublicKey = metaTag?.content || null;
    }

    if (!vapidPublicKey) {
      throw new Error('VAPID public key not available. Please configure VAPID keys on the server.');
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    // Send subscription to server
    await sendSubscriptionToServer(subscription);

    console.log('[Push] Subscription registered:', subscription);
    return subscription;
  } catch (error) {
    console.error('[Push] Registration failed:', error);
    return null;
  }
}

/**
 * Send subscription to server
 */
async function sendSubscriptionToServer(subscription) {
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify(subscription),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to send subscription to server');
    }

    return await response.json();
  } catch (error) {
    console.error('[Push] Failed to send subscription:', error);
    throw error;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribePush() {
  if (!subscription) {
    return false;
  }

  try {
    const successful = await subscription.unsubscribe();
    if (successful) {
      // Notify server
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      subscription = null;
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Push] Unsubscribe failed:', error);
    return false;
  }
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Check current permission status
 */
export function getPushPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Convert VAPID key from base64 URL to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
