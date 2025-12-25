/**
 * Nexus Portal Realtime Client
 * Handles Supabase Realtime subscriptions for live updates
 *
 * Architecture: "Signal → Fetch" pattern
 * - Signal: Supabase Realtime sends WebSocket event "something changed"
 * - Fetch: HTMX securely requests updated HTML from server
 *
 * Security:
 * - Uses authenticated JWT (fetched from /nexus/api/realtime-token)
 * - JWT contains RLS claims (nexus_user_id, nexus_tenant_id)
 * - Actual data comes via authenticated HTMX requests
 *
 * @version 1.1.0
 * @created 2025-12-26
 * @updated 2025-12-26 - Added authenticated token support
 */

class NexusRealtimeClient {
  constructor(supabaseUrl, supabaseAnonKey) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = supabaseAnonKey;
    this.client = null;
    this.channels = new Map();
    this.initialized = false;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.tokenRefreshTimer = null;
    // Dev mode detection for extended toast duration
    this.isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  /**
   * Fetch authenticated access token from server
   * Token contains RLS claims and is short-lived
   * Returns { token, error } - error present if auth failed (401)
   */
  async fetchRealtimeToken() {
    try {
      const response = await fetch('/nexus/api/realtime-token', {
        credentials: 'include' // Include session cookie
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // 401 = auth required, don't mask with anon fallback
        if (response.status === 401) {
          console.warn('📡 Nexus Realtime: Auth required -', errorData.hint || errorData.error);
          return { token: null, error: errorData.code || 'AUTH_REQUIRED', hint: errorData.hint };
        }

        console.warn('📡 Nexus Realtime: Token fetch failed:', errorData.error || response.status);
        return { token: null, error: 'FETCH_FAILED' };
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiresAt = data.expires_at;

      console.log('📡 Nexus Realtime: Token acquired, expires at', new Date(this.tokenExpiresAt * 1000).toISOString());
      return { token: data.access_token, error: null };
    } catch (error) {
      console.error('📡 Nexus Realtime: Token fetch error:', error);
      return { token: null, error: 'NETWORK_ERROR' };
    }
  }

  /**
   * Show realtime unavailable banner (for legacy auth users)
   */
  showRealtimeUnavailableBanner(hint) {
    // Check if banner already exists
    if (document.getElementById('realtime-unavailable-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'realtime-unavailable-banner';
    banner.className = 'vmp-alert vmp-alert-warning';
    banner.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:1000;max-width:350px;padding:12px 16px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:1.2em;">⚠️</span>
        <div>
          <strong>Realtime unavailable</strong><br>
          <small>${hint || 'Please re-login for live updates.'}</small>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:1.2em;">×</button>
      </div>
    `;
    document.body.appendChild(banner);
  }

  /**
   * Initialize Supabase client for realtime with authenticated token
   */
  async init() {
    if (this.initialized) return;

    try {
      // Fetch authenticated token first
      const { token, error, hint } = await this.fetchRealtimeToken();

      // If auth failed (401), show banner and DON'T initialize realtime
      // This prevents "silently dead" realtime that masks bugs
      if (error === 'LEGACY_AUTH' || error === 'TOKEN_EXPIRED' || error === 'REFRESH_FAILED' || error === 'AUTH_REQUIRED') {
        this.showRealtimeUnavailableBanner(hint);
        this.initialized = false;
        this.authError = error;
        console.warn('📡 Nexus Realtime: Disabled due to auth error:', error);
        return;
      }

      // If no token for other reasons, still don't fall back to anon
      if (!token) {
        console.warn('📡 Nexus Realtime: No token available, realtime disabled');
        this.initialized = false;
        return;
      }

      // Dynamic import of Supabase client from CDN
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

      // Create client WITH authenticated token (not anon-only)
      const options = {
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      };

      this.client = createClient(this.supabaseUrl, this.supabaseAnonKey, options);

      // Set the auth token for realtime
      await this.client.realtime.setAuth(token);

      // Schedule token refresh (5 minutes before expiry)
      this.scheduleTokenRefresh();

      this.initialized = true;
      console.log('📡 Nexus Realtime: Connected', token ? '(authenticated)' : '(anon)');
    } catch (error) {
      console.error('Nexus Realtime: Failed to load Supabase JS', error);
    }
  }

  /**
   * Schedule token refresh before expiry
   */
  scheduleTokenRefresh() {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    if (!this.tokenExpiresAt) return;

    const now = Math.floor(Date.now() / 1000);
    const refreshIn = Math.max((this.tokenExpiresAt - now - 300) * 1000, 60000); // 5 min before expiry, min 1 min

    this.tokenRefreshTimer = setTimeout(async () => {
      console.log('📡 Nexus Realtime: Refreshing token...');
      const newToken = await this.fetchRealtimeToken();
      if (newToken && this.client) {
        await this.client.realtime.setAuth(newToken);
        console.log('📡 Nexus Realtime: Token refreshed');
        this.scheduleTokenRefresh();
      }
    }, refreshIn);

    if (this.isDev) {
      console.log(`📡 Nexus Realtime: Token refresh scheduled in ${Math.round(refreshIn / 1000)}s`);
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

    // Dev: 8s for visibility during testing, Prod: 5s to avoid spam
    const duration = this.isDev ? 8000 : 5000;
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
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
    // Clear token refresh timer
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }

    this.channels.forEach((channel, name) => {
      channel.unsubscribe();
      console.log(`📡 Nexus Realtime: Cleaned up ${name}`);
    });
    this.channels.clear();
  }

  /**
   * Handle auth error by refreshing token and re-authenticating
   */
  async handleAuthError() {
    console.log('📡 Nexus Realtime: Auth error, attempting token refresh...');
    const { token, error, hint } = await this.fetchRealtimeToken();

    if (error) {
      // Auth failed - show banner and disable
      this.showRealtimeUnavailableBanner(hint);
      this.authError = error;
      console.warn('📡 Nexus Realtime: Re-auth failed:', error);
      return false;
    }

    if (token && this.client) {
      await this.client.realtime.setAuth(token);
      console.log('📡 Nexus Realtime: Re-authenticated after error');
      this.scheduleTokenRefresh();
      return true;
    }
    console.warn('📡 Nexus Realtime: Failed to re-authenticate');
    return false;
  }

  /**
   * Get current subscription status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      authenticated: !!this.accessToken,
      authError: this.authError || null,
      tokenExpiresAt: this.tokenExpiresAt ? new Date(this.tokenExpiresAt * 1000).toISOString() : null,
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
