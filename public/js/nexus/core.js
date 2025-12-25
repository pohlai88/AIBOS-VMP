/**
 * Nexus Core JavaScript
 * Shared utilities for the Nexus portal
 */

(function() {
  'use strict';

  // ============================================================================
  // Dropdown Handler
  // ============================================================================

  function initDropdowns() {
    // Click to toggle
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-dropdown]');

      if (trigger) {
        e.preventDefault();
        const dropdownId = trigger.dataset.dropdown;
        const dropdown = document.getElementById(dropdownId);

        if (dropdown) {
          // Close all other dropdowns
          document.querySelectorAll('.nexus-dropdown.open').forEach(d => {
            if (d.id !== dropdownId) d.classList.remove('open');
          });

          dropdown.classList.toggle('open');
        }
      } else {
        // Click outside closes dropdowns
        document.querySelectorAll('.nexus-dropdown.open').forEach(d => {
          d.classList.remove('open');
        });
      }
    });

    // Escape key closes dropdowns
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.nexus-dropdown.open').forEach(d => {
          d.classList.remove('open');
        });
      }
    });
  }

  // ============================================================================
  // Modal Handler
  // ============================================================================

  function initModals() {
    // Open modal
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-modal]');

      if (trigger) {
        e.preventDefault();
        const modalId = trigger.dataset.modal;
        const modal = document.getElementById(modalId);

        if (modal) {
          modal.classList.add('open');
          document.body.style.overflow = 'hidden';
        }
      }
    });

    // Close modal
    document.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-modal-close]');
      const backdrop = e.target.closest('.nexus-modal-backdrop');

      if (closeBtn || backdrop) {
        const modal = e.target.closest('.nexus-modal');
        if (modal) {
          modal.classList.remove('open');
          document.body.style.overflow = '';
        }
      }
    });

    // Escape key closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const openModal = document.querySelector('.nexus-modal.open');
        if (openModal) {
          openModal.classList.remove('open');
          document.body.style.overflow = '';
        }
      }
    });
  }

  // ============================================================================
  // Toast Notifications
  // ============================================================================

  const toast = {
    container: null,

    init() {
      this.container = document.getElementById('nexus-toasts');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'nexus-toasts';
        this.container.className = 'nexus-toast-container';
        document.body.appendChild(this.container);
      }
    },

    show(message, type = 'info', duration = 4000) {
      if (!this.container) this.init();

      const toastEl = document.createElement('div');
      toastEl.className = `nexus-toast ${type}`;
      toastEl.innerHTML = `
        <span class="nexus-toast-icon">${this.getIcon(type)}</span>
        <span class="nexus-toast-message">${message}</span>
        <button class="nexus-toast-close" onclick="this.parentElement.remove()">✕</button>
      `;

      this.container.appendChild(toastEl);

      // Auto-remove after duration
      if (duration > 0) {
        setTimeout(() => {
          toastEl.style.animation = 'slideOut 0.3s ease forwards';
          setTimeout(() => toastEl.remove(), 300);
        }, duration);
      }

      return toastEl;
    },

    getIcon(type) {
      switch (type) {
        case 'success': return '✓';
        case 'error': return '✕';
        case 'warning': return '⚠';
        default: return 'ℹ';
      }
    }
  };

  // ============================================================================
  // HTMX Event Handlers
  // ============================================================================

  function initHtmx() {
    // Handle HTMX form submissions
    document.addEventListener('htmx:afterRequest', (e) => {
      // Handle context switch
      if (e.detail.pathInfo?.requestPath === '/nexus/portal/switch') {
        if (e.detail.successful) {
          window.location.reload();
        }
      }
    });

    // Handle HTMX errors
    document.addEventListener('htmx:responseError', (e) => {
      toast.show('Something went wrong. Please try again.', 'error');
    });
  }

  // ============================================================================
  // Form Utilities
  // ============================================================================

  function serializeForm(form) {
    const data = {};
    const formData = new FormData(form);

    for (const [key, value] of formData.entries()) {
      if (data[key]) {
        if (!Array.isArray(data[key])) {
          data[key] = [data[key]];
        }
        data[key].push(value);
      } else {
        data[key] = value;
      }
    }

    return data;
  }

  // ============================================================================
  // Date Formatting
  // ============================================================================

  function formatDate(date, format = 'MMM D, YYYY') {
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return format
      .replace('YYYY', d.getFullYear())
      .replace('MMM', months[d.getMonth()])
      .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
      .replace('DD', String(d.getDate()).padStart(2, '0'))
      .replace('D', d.getDate())
      .replace('h', d.getHours() % 12 || 12)
      .replace('mm', String(d.getMinutes()).padStart(2, '0'))
      .replace('a', d.getHours() < 12 ? 'am' : 'pm');
  }

  function formatRelativeTime(date) {
    const now = new Date();
    const d = new Date(date);
    const diff = (now - d) / 1000; // seconds

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

    return formatDate(date);
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  function init() {
    initDropdowns();
    initModals();
    initHtmx();
    toast.init();

    // Add slideOut animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideOut {
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export to global
  window.nexusToast = toast;
  window.nexusUtils = {
    serializeForm,
    formatDate,
    formatRelativeTime
  };

})();
