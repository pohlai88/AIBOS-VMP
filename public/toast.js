/**
 * Toast Notification System (SSOT Aligned)
 */
(function() {
  'use strict';

  function ensureToastContainer() {
    let container = document.getElementById('vmp-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'vmp-toast-container';
      // Inline styles to avoid needing more CSS
      container.style.cssText = `
        position: fixed; top: var(--spacing-4); right: var(--spacing-4);
        z-index: var(--z-toast); display: flex; flex-direction: column; gap: var(--spacing-2);
      `;
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast({ type = 'info', title, message, duration = 5000 }) {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    
    // Map types to SSOT variables
    const colors = {
      success: 'var(--vmp-ok)',
      error: 'var(--vmp-danger)',
      warn: 'var(--vmp-warn)',
      info: 'var(--vmp-brand)'
    };
    const accentColor = colors[type] || colors.info;

    // Use SSOT Panel styles + Accent border
    toast.className = 'vmp-panel';
    toast.style.cssText = `
      padding: var(--spacing-4);
      border-left: 4px solid ${accentColor};
      min-width: 300px;
      box-shadow: var(--shadow-lg);
      animation: fadeIn 0.3s ease;
      display: flex; justify-content: space-between; align-items: start;
    `;

    toast.innerHTML = `
      <div>
        <div style="font-weight: var(--font-weight-medium); color: var(--vmp-text);">${escapeHtml(title)}</div>
        ${message ? `<div class="text-subtle" style="font-size: var(--font-size-sm); margin-top: var(--spacing-1);">${escapeHtml(message)}</div>` : ''}
      </div>
      <button onclick="this.parentElement.remove()" style="background:none; border:none; color:var(--vmp-text-muted); cursor:pointer;">×</button>
    `;

    container.appendChild(toast);
    if (duration > 0) setTimeout(() => toast.remove(), duration);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public API
  window.vmpToast = {
    success: (t, m, d) => showToast({ type: 'success', title: t, message: m, duration: d }),
    error: (t, m, d) => showToast({ type: 'error', title: t, message: m, duration: d }),
    warn: (t, m, d) => showToast({ type: 'warn', title: t, message: m, duration: d }),
    info: (t, m, d) => showToast({ type: 'info', title: t, message: m, duration: d })
  };
})();

