/**
 * Nexus Realtime Notifications
 *
 * Subscribes to Supabase realtime changes for notifications
 * Payment notifications get priority display
 */

(function() {
  'use strict';

  const NexusRealtime = {
    client: null,
    channel: null,
    config: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,

    /**
     * Initialize realtime connection
     */
    init(config) {
      this.config = config;

      if (!config.userId || !config.tenantId) {
        console.warn('Nexus Realtime: Missing user/tenant ID');
        return;
      }

      // Check for Supabase client
      if (typeof window.supabase === 'undefined') {
        // Load Supabase client dynamically
        this.loadSupabase().then(() => this.connect());
      } else {
        this.connect();
      }
    },

    /**
     * Load Supabase client script
     */
    async loadSupabase() {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.supabase) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@supabase/supabase-js@2';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    },

    /**
     * Connect to Supabase realtime
     */
    connect() {
      // Get Supabase config from meta tags or environment
      const supabaseUrl = document.querySelector('meta[name="supabase-url"]')?.content
        || window.SUPABASE_URL;
      const supabaseKey = document.querySelector('meta[name="supabase-anon-key"]')?.content
        || window.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.warn('Nexus Realtime: Missing Supabase config');
        return;
      }

      try {
        this.client = window.supabase.createClient(supabaseUrl, supabaseKey);
        this.subscribe();
      } catch (error) {
        console.error('Nexus Realtime: Failed to create client', error);
      }
    },

    /**
     * Subscribe to notification changes
     */
    subscribe() {
      if (!this.client) return;

      // Subscribe to notifications for this user
      this.channel = this.client
        .channel(`nexus_notifications:${this.config.userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'nexus_notifications',
            filter: `user_id=eq.${this.config.userId}`
          },
          (payload) => this.handleNotification(payload.new)
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'nexus_notifications',
            filter: `user_id=eq.${this.config.userId}`
          },
          (payload) => this.handleNotificationUpdate(payload.new)
        )
        .subscribe((status) => {
          console.log('Nexus Realtime status:', status);

          if (status === 'SUBSCRIBED') {
            this.reconnectAttempts = 0;
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            this.handleDisconnect();
          }
        });
    },

    /**
     * Handle new notification
     */
    handleNotification(notification) {
      console.log('New notification:', notification);

      // Update badge count
      this.incrementBadge();

      // Payment notifications get special treatment
      if (notification.priority === 'critical' || notification.type?.startsWith('payment_')) {
        this.showCriticalNotification(notification);
      } else {
        this.showNotification(notification);
      }

      // Add to dropdown if open
      this.addToDropdown(notification);

      // Request browser notification permission and show
      this.showBrowserNotification(notification);
    },

    /**
     * Handle notification update (e.g., marked as read)
     */
    handleNotificationUpdate(notification) {
      if (notification.read_at) {
        // Remove from unread count
        this.decrementBadge();

        // Update UI
        const item = document.querySelector(`[data-notification-id="${notification.id}"]`);
        if (item) {
          item.classList.add('read');
        }
      }
    },

    /**
     * Show standard notification toast
     */
    showNotification(notification) {
      const icon = this.getNotificationIcon(notification.type);

      window.nexusToast?.show(
        `<strong>${notification.title}</strong><br>${notification.body || ''}`,
        'info',
        5000
      );
    },

    /**
     * Show critical notification (payment, etc.)
     */
    showCriticalNotification(notification) {
      const icon = this.getNotificationIcon(notification.type);

      // Create a more prominent notification
      const toast = document.createElement('div');
      toast.className = 'nexus-toast critical-notification';
      toast.innerHTML = `
        <div class="critical-notification-header">
          <span class="critical-icon">${icon}</span>
          <span class="critical-label">Important</span>
        </div>
        <div class="critical-notification-body">
          <strong>${notification.title}</strong>
          <p>${notification.body || ''}</p>
        </div>
        ${notification.action_url ? `
          <a href="${notification.action_url}" class="nexus-btn primary small">
            View Details →
          </a>
        ` : ''}
        <button class="critical-notification-close" onclick="this.parentElement.remove()">✕</button>
      `;

      // Add critical notification styles if not present
      this.ensureCriticalStyles();

      const container = document.getElementById('nexus-toasts');
      if (container) {
        container.appendChild(toast);

        // Play sound for payment notifications
        if (notification.type?.startsWith('payment_')) {
          this.playNotificationSound();
        }
      }
    },

    /**
     * Add notification to dropdown
     */
    addToDropdown(notification) {
      const list = document.getElementById('notification-list');
      if (!list) return;

      // Remove "no notifications" message if present
      const empty = list.querySelector('.nexus-notification-loading, .nexus-empty-state');
      if (empty) empty.remove();

      // Create notification item
      const item = document.createElement('div');
      item.className = 'nexus-notification-item';
      item.dataset.notificationId = notification.id;
      item.dataset.priority = notification.priority;

      const icon = this.getNotificationIcon(notification.type);
      const time = window.nexusUtils?.formatRelativeTime(notification.created_at) || 'Just now';

      item.innerHTML = `
        <div class="nexus-notification-icon ${notification.type}">
          <span>${icon}</span>
        </div>
        <div class="nexus-notification-content">
          <div class="nexus-notification-title">${notification.title}</div>
          <div class="nexus-notification-body">${notification.body || ''}</div>
          <div class="nexus-notification-time">${time}</div>
        </div>
        <button
          class="nexus-notification-dismiss"
          onclick="window.nexusRealtime.markRead('${notification.id}'); this.closest('.nexus-notification-item').remove();"
        >
          ✕
        </button>
      `;

      // Insert at top
      list.insertBefore(item, list.firstChild);
    },

    /**
     * Show browser notification
     */
    async showBrowserNotification(notification) {
      if (!('Notification' in window)) return;

      let permission = Notification.permission;

      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission === 'granted') {
        const n = new Notification(notification.title, {
          body: notification.body,
          icon: '/images/nexus-icon.png',
          tag: notification.id,
          requireInteraction: notification.priority === 'critical'
        });

        n.onclick = () => {
          window.focus();
          if (notification.action_url) {
            window.location.href = notification.action_url;
          }
          n.close();
        };
      }
    },

    /**
     * Mark notification as read
     */
    async markRead(notificationId) {
      try {
        await fetch('/nexus/api/notifications/read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            notificationIds: [notificationId]
          })
        });
      } catch (error) {
        console.error('Failed to mark notification read:', error);
      }
    },

    /**
     * Update badge from API response
     */
    updateBadge(response) {
      try {
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        const badge = document.getElementById('notification-count');

        if (data.total > 0) {
          if (badge) {
            badge.textContent = data.total < 100 ? data.total : '99+';
          } else {
            // Create badge
            const bell = document.querySelector('.nexus-bell-trigger');
            if (bell) {
              const newBadge = document.createElement('span');
              newBadge.className = 'nexus-bell-badge';
              newBadge.id = 'notification-count';
              newBadge.textContent = data.total < 100 ? data.total : '99+';
              bell.appendChild(newBadge);
            }
          }

          // Show critical indicator for payment notifications
          const criticalIndicator = document.querySelector('.nexus-bell-critical');
          if (data.payments > 0) {
            if (!criticalIndicator) {
              const bell = document.querySelector('.nexus-bell-trigger');
              if (bell) {
                const indicator = document.createElement('span');
                indicator.className = 'nexus-bell-critical';
                indicator.title = 'Payment notifications';
                bell.appendChild(indicator);
              }
            }
          } else if (criticalIndicator) {
            criticalIndicator.remove();
          }
        } else if (badge) {
          badge.remove();
        }
      } catch (error) {
        console.error('Failed to update badge:', error);
      }
    },

    /**
     * Increment badge count
     */
    incrementBadge() {
      const badge = document.getElementById('notification-count');
      if (badge) {
        const current = parseInt(badge.textContent) || 0;
        badge.textContent = current + 1;
      } else {
        // Create badge
        const bell = document.querySelector('.nexus-bell-trigger');
        if (bell) {
          const newBadge = document.createElement('span');
          newBadge.className = 'nexus-bell-badge';
          newBadge.id = 'notification-count';
          newBadge.textContent = '1';
          bell.appendChild(newBadge);
        }
      }
    },

    /**
     * Decrement badge count
     */
    decrementBadge() {
      const badge = document.getElementById('notification-count');
      if (badge) {
        const current = parseInt(badge.textContent) || 0;
        if (current <= 1) {
          badge.remove();
        } else {
          badge.textContent = current - 1;
        }
      }
    },

    /**
     * Get icon for notification type
     */
    getNotificationIcon(type) {
      const icons = {
        'message_received': '💬',
        'case_created': '📋',
        'case_updated': '📝',
        'case_resolved': '✅',
        'payment_pending': '⏳',
        'payment_processing': '🔄',
        'payment_completed': '💰',
        'payment_failed': '❌',
        'payment_disputed': '⚠️',
        'vendor_linked': '🔗',
        'vendor_invited': '✉️',
        'relationship_updated': '🤝'
      };

      return icons[type] || '🔔';
    },

    /**
     * Play notification sound
     */
    playNotificationSound() {
      try {
        const audio = new Audio('/audio/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {
          // Autoplay blocked - that's fine
        });
      } catch (error) {
        // No audio support
      }
    },

    /**
     * Ensure critical notification styles are loaded
     */
    ensureCriticalStyles() {
      if (document.getElementById('nexus-critical-styles')) return;

      const style = document.createElement('style');
      style.id = 'nexus-critical-styles';
      style.textContent = `
        .critical-notification {
          position: relative;
          background: #1e1e2e !important;
          color: white;
          border-left: 4px solid #ef4444 !important;
          padding: 16px !important;
          max-width: 360px;
        }

        .critical-notification-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .critical-icon {
          font-size: 20px;
        }

        .critical-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #ef4444;
        }

        .critical-notification-body strong {
          display: block;
          margin-bottom: 4px;
        }

        .critical-notification-body p {
          margin: 0 0 12px;
          font-size: 14px;
          opacity: 0.8;
        }

        .critical-notification-close {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          color: white;
          opacity: 0.5;
          cursor: pointer;
        }

        .critical-notification-close:hover {
          opacity: 1;
        }
      `;
      document.head.appendChild(style);
    },

    /**
     * Handle disconnect
     */
    handleDisconnect() {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        console.log(`Nexus Realtime: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
          this.unsubscribe();
          this.subscribe();
        }, delay);
      } else {
        console.error('Nexus Realtime: Max reconnect attempts reached');
      }
    },

    /**
     * Unsubscribe from channel
     */
    unsubscribe() {
      if (this.channel) {
        this.client?.removeChannel(this.channel);
        this.channel = null;
      }
    },

    /**
     * Cleanup on page unload
     */
    destroy() {
      this.unsubscribe();
      this.client = null;
    }
  };

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    NexusRealtime.destroy();
  });

  // Export to global
  window.nexusRealtime = NexusRealtime;

})();
