/**
 * Toast Notification System (Sprint 7.4)
 * Manages toast notifications for user feedback
 */

(function() {
  'use strict';

  // Create toast container if it doesn't exist
  function ensureToastContainer() {
    if (!document.body) {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureToastContainer);
        return null;
      }
      return null;
    }

    let container = document.getElementById('vmp-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'vmp-toast-container';
      container.className = 'vmp-toast-container';
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'false');
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * Show a toast notification
   * @param {Object} options - Toast options
   * @param {string} options.type - Toast type: 'success', 'error', 'warn', 'info'
   * @param {string} options.title - Toast title
   * @param {string} [options.message] - Toast message (optional)
   * @param {number} [options.duration] - Auto-dismiss duration in ms (default: 5000)
   * @returns {HTMLElement} Toast element
   */
  function showToast(options) {
    const { type = 'info', title, message, duration = 5000 } = options;

    if (!title) {
      console.warn('[Toast] Title is required');
      return null;
    }

    const container = ensureToastContainer();
    if (!container) {
      // DOM not ready yet, try again after a short delay
      setTimeout(() => showToast(options), 100);
      return null;
    }

    const toast = document.createElement('div');
    toast.className = `vmp-toast vmp-toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    const toastId = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    toast.id = toastId;

    toast.innerHTML = `
      <div class="vmp-toast-content">
        <div class="vmp-toast-title">${escapeHtml(title)}</div>
        ${message ? `<div class="vmp-toast-message">${escapeHtml(message)}</div>` : ''}
      </div>
      <button type="button" class="vmp-toast-close" aria-label="Close notification" onclick="window.vmpToast?.dismiss('${toastId}')">
        <span aria-hidden="true">×</span>
      </button>
    `;

    container.appendChild(toast);

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        dismissToast(toastId);
      }, duration);
    }

    // Focus management for accessibility
    toast.focus();

    return toast;
  }

  /**
   * Dismiss a toast notification
   * @param {string} toastId - Toast ID
   */
  function dismissToast(toastId) {
    const toast = document.getElementById(toastId);
    if (!toast) return;

    toast.classList.add('vmp-toast-exiting');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public API
  window.vmpToast = {
    show: showToast,
    dismiss: dismissToast,
    success: (title, message, duration) => showToast({ type: 'success', title, message, duration }),
    error: (title, message, duration) => showToast({ type: 'error', title, message, duration }),
    warn: (title, message, duration) => showToast({ type: 'warn', title, message, duration }),
    info: (title, message, duration) => showToast({ type: 'info', title, message, duration })
  };

  // HTMX integration: Show toast on HTMX events
  function setupHtmxListeners() {
    if (!window.htmx || !document.body) {
      return;
    }

    document.body.addEventListener('htmx:afterSwap', function(event) {
      // Check for toast data in response
      const toastData = event.detail.xhr?.getResponseHeader('X-Toast');
      if (toastData) {
        try {
          const toast = JSON.parse(toastData);
          window.vmpToast.show({
            type: toast.type || 'info',
            title: toast.title,
            message: toast.message,
            duration: toast.duration || 5000
          });
        } catch (e) {
          console.warn('[Toast] Failed to parse toast data:', e);
        }
      }
    });

    document.body.addEventListener('htmx:responseError', function(event) {
      window.vmpToast.error('Request Failed', 'An error occurred while processing your request.');
    });
  }

  // Setup HTMX listeners when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHtmxListeners);
  } else {
    setupHtmxListeners();
  }
})();

