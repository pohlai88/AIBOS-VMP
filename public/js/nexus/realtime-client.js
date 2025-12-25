/**
 * Nexus Portal Realtime Client
 * Handles Supabase Realtime subscriptions for live updates
 *
 * Architecture: "Signal → Fetch" pattern
 * - Signal: Supabase Realtime sends WebSocket event "something changed"
 * - Fetch: HTMX securely requests updated HTML from server
 *
 * Security: Uses anon key only. RLS policies filter data.
 * Actual data comes via authenticated HTMX requests.
 *
 * @version 1.0.0
 * @created 2025-12-26
 */

class NexusRealtimeClient {
  constructor(supabaseUrl, supabaseAnonKey) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = supabaseAnonKey;
    this.client = null;
    this.channels = new Map();
    this.initialized = false;
  }

  /**
   * Initialize Supabase client for realtime
   */
  async init() {
    if (this.initialized) return;

    try {
      // Dynamic import of Supabase client from CDN
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

      this.client = createClient(this.supabaseUrl, this.supabaseAnonKey, {
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      });

      this.initialized = true;
      console.log('📡 Nexus Realtime: Connected');
    } catch (error) {
      console.error('Nexus Realtime: Failed to load Supabase JS', error);
    }
  }

  /**
   * Safe HTMX trigger with existence check
   * @param {string} method - HTTP method (GET, POST)
   * @param {string} url - Endpoint to fetch
   * @param {string} selector - CSS selector for target element
   */
  triggerHtmx(method, url, selector) {
    if (typeof htmx === 'undefined') {
      console.warn('Nexus Realtime: HTMX not found, skipping update');
      return;
    }
    console.log(`⚡ Realtime Trigger: ${method} ${url} → ${selector}`);
    htmx.ajax(method, url, selector);
  }

  /**
   * Subscribe to case messages for live thread updates
   * @param {string} caseId - The case ID (CASE-*) to subscribe to
   * @param {string} threadSelector - CSS selector for the thread container
   */
  subscribeToCaseMessages(caseId, threadSelector = '#case-thread') {
    if (!this.client) {
      console.warn('Nexus Realtime: Client not initialized');
      return null;
    }

    const channelName = `case-messages-${caseId}`;

    // Avoid duplicate subscriptions
    if (this.channels.has(channelName)) {
      console.log(`📡 Nexus Realtime: Already subscribed to ${channelName}`);
      return this.channels.get(channelName);
    }

    const channel = this.client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'nexus_case_messages',
          filter: `case_id=eq.${caseId}`
        },
        (payload) => {
          console.log('📨 Nexus Realtime: New message signal', payload.new?.id);
          // Trigger HTMX reload of the thread - server handles auth
          this.triggerHtmx('GET', `/nexus/cases/${caseId}/thread`, threadSelector);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Nexus Realtime: Case ${caseId} subscription ${status}`);
      });

    this.channels.set(channelName, channel);
    return channel;
  }

  /**
   * Subscribe to payment updates for a tenant
   * @param {string} contextId - TC-* or TV-* ID
   * @param {string} tableSelector - CSS selector for the payments container
   */
  subscribeToPayments(contextId, tableSelector = '#payments-list') {
    if (!this.client) return null;

    const channelName = `payments-${contextId}`;

    if (this.channels.has(channelName)) {
      return this.channels.get(channelName);
    }

    // Subscribe to payments where this context is sender (from_id)
    const channel = this.client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'nexus_payments',
          filter: `from_id=eq.${contextId}`
        },
        (payload) => {
          console.log('💰 Nexus Realtime: Payment update (from)', payload.eventType);
          this.triggerHtmx('GET', '/nexus/payments', tableSelector);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nexus_payments',
          filter: `to_id=eq.${contextId}`
        },
        (payload) => {
          console.log('💰 Nexus Realtime: Payment update (to)', payload.eventType);
          this.triggerHtmx('GET', '/nexus/payments', tableSelector);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Nexus Realtime: Payments ${contextId} subscription ${status}`);
      });

    this.channels.set(channelName, channel);
    return channel;
  }

  /**
   * Subscribe to notifications for badge updates
   * @param {string} userId - USR-* ID
   * @param {Function} onNotification - Optional callback when new notification arrives
   */
  subscribeToNotifications(userId, onNotification) {
    if (!this.client) return null;

    const channelName = `notifications-${userId}`;

    if (this.channels.has(channelName)) {
      return this.channels.get(channelName);
    }

    const channel = this.client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'nexus_notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔔 Nexus Realtime: New notification signal', payload.new?.notification_type);

          // 1. Update notification badge
          this.updateNotificationBadge();

          // 2. Call custom handler if provided
          if (typeof onNotification === 'function') {
            onNotification(payload.new);
          }

          // 3. Show toast for high priority notifications
          if (payload.new && payload.new.priority === 'high') {
            this.showToast(
              payload.new.title || 'New Notification',
              payload.new.body || 'You have a new high-priority notification',
              'warning'
            );
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Nexus Realtime: Notifications ${userId} subscription ${status}`);
      });

    this.channels.set(channelName, channel);
    return channel;
  }

  /**
   * Subscribe to relationship updates (invites)
   * @param {string} tenantId - TNT-* ID
   * @param {Function} onUpdate - Optional callback when relationship changes
   */
  subscribeToRelationships(tenantId, onUpdate) {
    if (!this.client) return null;

    const channelName = `relationships-${tenantId}`;

    if (this.channels.has(channelName)) {
      return this.channels.get(channelName);
    }

    const channel = this.client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nexus_tenant_relationships'
        },
        (payload) => {
          console.log('🤝 Nexus Realtime: Relationship update', payload.eventType);

          // Reload relationships page if currently viewing it
          if (window.location.pathname === '/nexus/relationships') {
            this.triggerHtmx('GET', '/nexus/relationships', '#relationships-list');
          }

          if (typeof onUpdate === 'function') {
            onUpdate(payload);
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Nexus Realtime: Relationships ${tenantId} subscription ${status}`);
      });

    this.channels.set(channelName, channel);
    return channel;
  }

  /**
   * Update the notification badge count via HTMX
   */
  updateNotificationBadge() {
    const badge = document.querySelector('#notification-badge');
    if (badge && typeof htmx !== 'undefined') {
      htmx.ajax('GET', '/nexus/api/notifications/unread', {
        target: '#notification-badge',
        swap: 'innerHTML'
      });
    }
  }

  /**
   * Show a toast notification
   * @param {string} title - Toast title
   * @param {string} message - Toast message
   * @param {string} type - Toast type (info, success, warning, error)
   */
  showToast(title, message, type = 'info') {
    // Get or create toast container
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'nexus-toast-container';
      document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `nexus-toast nexus-toast-${type}`;
    toast.innerHTML = `
      <div class="nexus-toast-content">
        <strong>${this.escapeHtml(title)}</strong>
        <p>${this.escapeHtml(message)}</p>
      </div>
      <button class="nexus-toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto-remove after 8 seconds (extended for dev visibility)
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 8000);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  /**
   * Unsubscribe from a specific channel
   * @param {string} channelName - Name of channel to unsubscribe
   */
  unsubscribe(channelName) {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelName);
      console.log(`📡 Nexus Realtime: Unsubscribed from ${channelName}`);
    }
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup() {
    this.channels.forEach((channel, name) => {
      channel.unsubscribe();
      console.log(`📡 Nexus Realtime: Cleaned up ${name}`);
    });
    this.channels.clear();
  }

  /**
   * Get current subscription status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      channels: Array.from(this.channels.keys()),
      channelCount: this.channels.size
    };
  }
}

// ============================================================================
// GLOBAL INITIALIZATION
// ============================================================================

window.NexusRealtime = null;

/**
 * Initialize Nexus Realtime with config from server
 */
window.initNexusRealtime = async function() {
  try {
    // Fetch config from server (only exposes anon key, never service role)
    const response = await fetch('/nexus/api/realtime-config');
    if (!response.ok) {
      console.warn('📡 Nexus Realtime: Config not available (status:', response.status, ')');
      return;
    }

    const config = await response.json();

    if (!config.url || !config.anonKey) {
      console.warn('📡 Nexus Realtime: Missing Supabase config');
      return;
    }

    // Create and initialize client
    window.NexusRealtime = new NexusRealtimeClient(config.url, config.anonKey);
    await window.NexusRealtime.init();

    // Auto-subscribe to notifications if user ID is available
    const userIdMeta = document.querySelector('meta[name="nexus-user-id"]');
    if (userIdMeta && userIdMeta.content) {
      const userId = userIdMeta.content;
      window.NexusRealtime.subscribeToNotifications(userId);
      console.log(`📡 Nexus Realtime: Auto-subscribed to notifications for ${userId}`);
    }

    // Auto-subscribe to payments if context ID is available
    const contextIdMeta = document.querySelector('meta[name="nexus-context-id"]');
    if (contextIdMeta && contextIdMeta.content) {
      const contextId = contextIdMeta.content;
      window.NexusRealtime.subscribeToPayments(contextId);
      console.log(`📡 Nexus Realtime: Auto-subscribed to payments for ${contextId}`);
    }

    console.log('📡 Nexus Realtime: Ready ✓');

  } catch (error) {
    console.error('📡 Nexus Realtime: Initialization failed', error);
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.initNexusRealtime);
} else {
  window.initNexusRealtime();
}

// Cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
  if (window.NexusRealtime) {
    window.NexusRealtime.cleanup();
  }
});
