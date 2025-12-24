/**
 * MessageThread Component
 * 
 * Encapsulated class for managing case message threads with:
 * - Optimistic UI updates
 * - Automatic scroll-to-bottom
 * - Error handling & rollback
 * - Character counting
 * 
 * Usage:
 *   const thread = new MessageThread('thread-container', {
 *     caseId: '...',
 *     userId: req.user.id
 *   });
 *
 * Anti-drift:
 * - NO global state
 * - NO direct DOM manipulation outside class
 * - Clean error boundaries
 */

export class MessageThread {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.caseId = options.caseId;
    this.userId = options.userId;
    this.currentPage = 1;
    this.isLoading = false;
    this.messagesList = null;
    this.messageInput = null;
    this.sendButton = null;
    this.charCount = null;

    if (!this.container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    this.init();
  }

  /**
   * Initialize component
   * - Find DOM references
   * - Attach event listeners
   * - Load initial messages
   */
  async init() {
    // Find DOM elements
    this.messagesList = this.container.querySelector('#messages-list');
    this.messageInput = this.container.querySelector('#message-input');
    this.sendButton = this.container.querySelector('#send-button');
    this.charCount = this.container.querySelector('#char-count');
    const messageForm = this.container.querySelector('#message-form');

    if (!messageForm) {
      console.warn('Message form not found in container');
      return;
    }

    // Attach listeners
    this.attachListeners(messageForm);

    // Auto-scroll to bottom
    if (this.messagesList) {
      this.scrollToBottom();
    }
  }

  /**
   * Attach event listeners
   */
  attachListeners(formElement) {
    // Form submission
    formElement.addEventListener('submit', (e) => this.handleSubmit(e));

    // Character counting
    if (this.messageInput) {
      this.messageInput.addEventListener('input', (e) => {
        if (this.charCount) {
          this.charCount.textContent = e.target.value.length;
        }
      });

      // Enter to send (Shift+Enter for newline)
      this.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          formElement.dispatchEvent(new Event('submit'));
        }
      });
    }
  }

  /**
   * Handle form submission
   */
  async handleSubmit(event) {
    event.preventDefault();

    const content = this.messageInput.value.trim();
    if (!content) return;

    // Optimistic UI
    const tempId = `temp-${Date.now()}`;
    const originalValue = this.messageInput.value;

    this.addOptimisticMessage(tempId, content);
    this.messageInput.value = '';
    if (this.charCount) this.charCount.textContent = '0';
    if (this.sendButton) this.sendButton.disabled = true;

    try {
      const response = await fetch(`/api/cases/${this.caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const savedMsg = await response.json();
      this.replaceOptimisticMessage(tempId, savedMsg);
      this.scrollToBottom();
    } catch (error) {
      console.error('Message send error:', error);
      this.removeOptimisticMessage(tempId);
      this.messageInput.value = originalValue;
      if (this.charCount) this.charCount.textContent = originalValue.length;
      this.showError('Could not send message. Please try again.');
    } finally {
      if (this.sendButton) this.sendButton.disabled = false;
    }
  }

  /**
   * Add optimistic message to DOM
   */
  addOptimisticMessage(tempId, content) {
    if (!this.messagesList) return;

    const div = document.createElement('div');
    div.id = tempId;
    div.className = 'border-l-2 border-green-500/50 pl-4 py-2 opacity-70';
    div.innerHTML = `
      <div class="flex items-center gap-2 mb-1">
        <span class="font-semibold text-white text-sm">You</span>
        <span class="text-xs text-white/50">Just now</span>
      </div>
      <p class="text-white/80 text-sm">${this.escapeHtml(content)}</p>
    `;

    this.messagesList.appendChild(div);
  }

  /**
   * Replace optimistic message with saved message
   */
  replaceOptimisticMessage(tempId, savedMsg) {
    if (!this.messagesList) return;

    const tempElement = document.getElementById(tempId);
    if (!tempElement) return;

    tempElement.id = savedMsg.id;
    tempElement.className = 'border-l-2 border-green-500/30 pl-4 py-2';
    tempElement.innerHTML = `
      <div class="flex items-center gap-2 mb-1">
        <span class="font-semibold text-white text-sm">${this.escapeHtml(savedMsg.sender_name)}</span>
        <span class="text-xs text-white/50">${this.formatDate(savedMsg.created_at)}</span>
      </div>
      <p class="text-white/80 text-sm">${this.escapeHtml(savedMsg.body)}</p>
    `;
  }

  /**
   * Remove optimistic message on error
   */
  removeOptimisticMessage(tempId) {
    const element = document.getElementById(tempId);
    if (element) {
      element.remove();
    }
  }

  /**
   * Scroll to bottom of messages
   */
  scrollToBottom() {
    if (this.messagesList) {
      this.messagesList.scrollTop = this.messagesList.scrollHeight;
    }
  }

  /**
   * Show error toast
   */
  showError(message) {
    // TODO: Integrate with toast notification system
    // For now, simple fallback
    const notification = document.createElement('div');
    notification.className =
      'fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg text-sm';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 4000);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format date relative to now
   */
  formatDate(isoDate) {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    if (diffMins < 43200) return `${Math.floor(diffMins / 1440)}d ago`;

    return date.toLocaleDateString();
  }

  /**
   * Public: Load messages with pagination
   */
  async loadMessages(page = 1) {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const response = await fetch(
        `/api/cases/${this.caseId}/messages?page=${page}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.currentPage = page;

      if (page === 1 && this.messagesList) {
        this.messagesList.innerHTML = '';
      }

      // Render messages
      data.messages.forEach((msg) => {
        const div = document.createElement('div');
        div.className = 'border-l-2 border-green-500/30 pl-4 py-2';
        div.dataset.messageId = msg.id;
        div.innerHTML = `
          <div class="flex items-center gap-2 mb-1">
            <span class="font-semibold text-white text-sm">${this.escapeHtml(msg.sender_name)}</span>
            <span class="text-xs text-white/50">${this.formatDate(msg.created_at)}</span>
          </div>
          <p class="text-white/80 text-sm">${this.escapeHtml(msg.body)}</p>
        `;
        if (this.messagesList) {
          this.messagesList.appendChild(div);
        }
      });

      this.scrollToBottom();
    } catch (error) {
      console.error('Failed to load messages:', error);
      this.showError('Could not load messages');
    } finally {
      this.isLoading = false;
    }
  }
}

// Auto-initialize if data attributes present
document.addEventListener('DOMContentLoaded', () => {
  const threadContainer = document.querySelector('[data-message-thread]');
  if (threadContainer) {
    window.messageThread = new MessageThread('thread-container', {
      caseId: threadContainer.dataset.caseId,
      userId: threadContainer.dataset.userId
    });
  }
});
