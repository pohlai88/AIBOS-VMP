# Frontend Development Quickstart

**Get Started Building Vendor MVP UI in 10 Minutes**

---

## 1. Project Setup (Already Done ✅)

Your project already has:
- ✅ Express server with Nunjucks templating
- ✅ Tailwind CSS configured
- ✅ ESLint + Prettier configured
- ✅ Vitest for unit tests
- ✅ Playwright for E2E tests
- ✅ Dark theme design system (glassmorphism, signal green accents)

---

## 2. File Structure You'll Work In

```
src/views/
├── layout.html          ← Base template (header, footer, sidebar)
├── pages/
│   ├── vendor-dashboard.html   ← NEW: Case list view
│   ├── case-detail.html         ← EXISTING: Case detail with tabs
│   └── ...
└── partials/            ← Reusable components
    ├── case-card.html          ← NEW: Single case card
    ├── message-item.html       ← NEW: Single message in thread
    ├── file-item.html          ← NEW: Evidence file in gallery
    └── ...

public/
├── globals.css          ← Global styles, animations
├── components.css       ← Component-specific overrides
└── js/
    ├── components/
    │   ├── message-thread.js   ← NEW: Chat interface
    │   ├── evidence-manager.js ← NEW: File upload
    │   └── case-filter.js      ← NEW: Filtering logic
    ├── utils/
    │   ├── api.js              ← HTTP client
    │   ├── date-utils.js       ← Date formatting
    │   └── validation.js       ← Form validation
    └── app.js          ← Main entry point
```

---

## 3. Start Development Server

```bash
# Terminal 1: Start Express server
npm run dev

# Open browser
# http://localhost:9000
```

**Server will auto-reload on HTML/CSS changes**  
**For JavaScript changes, refresh browser manually**

---

## 4. Build Your First Component: Case Card

**Create:** `src/views/partials/case-card.html`

```html
{% macro caseCard(case) %}
  <div class="case-card group" data-case-id="{{ case.id }}">
    <!-- Card Container -->
    <div class="border border-white/8 rounded-lg bg-white/3 p-4 hover:bg-white/5 transition-colors">
      
      <!-- Header: Title + Status -->
      <div class="flex items-start justify-between gap-3 mb-3">
        <h3 class="text-base font-semibold text-white flex-1 line-clamp-2">
          <a href="/cases/{{ case.id }}" class="hover:text-green-400 transition-colors">
            {{ case.title }}
          </a>
        </h3>
        <span class="status-badge status-{{ case.status | lower }}"
              data-status="{{ case.status }}">
          {{ case.status }}
        </span>
      </div>

      <!-- Case ID + Date -->
      <div class="flex items-center justify-between text-xs text-white/60 mb-3">
        <span class="font-mono">{{ case.id | truncate(8, true, '…') }}</span>
        <span>{{ case.created_at | relativeTime }}</span>
      </div>

      <!-- Unread Indicator -->
      {% if case.unread_count > 0 %}
        <div class="text-xs font-semibold text-green-400">
          {{ case.unread_count }} new message{{ 's' if case.unread_count > 1 }}
        </div>
      {% endif %}

    </div>
  </div>
{% endmacro %}
```

**Use in Template:**
```html
{% from "partials/case-card.html" import caseCard %}

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {% for case in cases %}
    {{ caseCard(case) }}
  {% endfor %}
</div>
```

**Styling in `globals.css`:**
```css
/* Case Card Status Badges */
.status-badge {
  @apply px-2 py-1 rounded text-xs font-semibold inline-block;
}

.status-open {
  @apply bg-blue-500/20 text-blue-300;
}

.status-closed {
  @apply bg-gray-500/20 text-gray-300;
}

.status-action-required {
  @apply bg-yellow-500/20 text-yellow-300;
}

.status-escalated {
  @apply bg-red-500/20 text-red-300;
}
```

---

## 5. Build Vendor Dashboard Page

**Create:** `src/views/pages/vendor-dashboard.html`

```html
{% extends "layout.html" %}

{% from "partials/case-card.html" import caseCard %}
{% from "partials/notification-badge.html" import notificationBadge %}

{% block title %}Vendor Dashboard{% endblock %}

{% block content %}
<main class="min-h-screen bg-black">
  <!-- Header -->
  <div class="border-b border-white/8 bg-white/3 backdrop-blur-sm">
    <div class="max-w-7xl mx-auto px-4 py-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">{{ vendor.name }}</h1>
          <p class="text-sm text-white/60">Case Inbox</p>
        </div>
        <div class="flex items-center gap-4">
          <button class="relative p-2 hover:bg-white/5 rounded-lg transition-colors"
                  aria-label="Notifications">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {% if unread_count > 0 %}
              <span class="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full"></span>
            {% endif %}
          </button>
          <button class="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  aria-label="User menu">
            <img src="{{ user.avatar_url }}" alt="" class="w-8 h-8 rounded-full" />
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="max-w-7xl mx-auto px-4 py-6">
    
    <!-- Filter Bar -->
    <div class="mb-6 flex flex-col md:flex-row gap-4">
      <!-- Status Filter -->
      <select hx-get="/vendor/api/cases"
              hx-target="#case-list"
              hx-trigger="change"
              name="status"
              class="px-3 py-2 bg-white/5 border border-white/8 rounded-lg text-white text-sm focus:outline-none focus:border-green-400/50">
        <option value="">All Statuses</option>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
        <option value="action-required">Action Required</option>
      </select>

      <!-- Date Range Filter -->
      <input type="date" 
             hx-get="/vendor/api/cases"
             hx-target="#case-list"
             hx-trigger="change"
             name="from_date"
             class="px-3 py-2 bg-white/5 border border-white/8 rounded-lg text-white text-sm focus:outline-none focus:border-green-400/50"
             placeholder="From Date" />

      <!-- Search -->
      <div class="flex-1">
        <input type="text" 
               placeholder="Search cases..."
               hx-get="/vendor/api/cases"
               hx-target="#case-list"
               hx-trigger="keyup changed delay:500ms"
               name="search"
               class="w-full px-3 py-2 bg-white/5 border border-white/8 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-green-400/50" />
      </div>
    </div>

    <!-- Cases List -->
    <div id="case-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {% if cases.length > 0 %}
        {% for case in cases %}
          {{ caseCard(case) }}
        {% endfor %}
      {% else %}
        <div class="col-span-full text-center py-12">
          <p class="text-white/60">No cases found</p>
        </div>
      {% endif %}
    </div>

    <!-- Pagination -->
    {% if pagination.total_pages > 1 %}
      <div class="flex justify-center gap-2 mt-8">
        {% if pagination.page > 1 %}
          <a href="?page={{ pagination.page - 1 }}"
             class="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors">
            Previous
          </a>
        {% endif %}
        
        <div class="px-4 py-2 text-white/60">
          Page {{ pagination.page }} of {{ pagination.total_pages }}
        </div>
        
        {% if pagination.page < pagination.total_pages %}
          <a href="?page={{ pagination.page + 1 }}"
             class="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors">
            Next
          </a>
        {% endif %}
      </div>
    {% endif %}

  </div>
</main>
{% endblock %}
```

**Add to `server.js`:**
```javascript
// GET: Vendor Dashboard
app.get('/vendor/dashboard', requireAuth, async (req, res) => {
  try {
    const vendorId = req.user.vendorId || env.DEMO_VENDOR_ID;
    
    // Get vendor info
    const vendor = await vmpAdapter.getVendor(vendorId);
    
    // Get cases with filters
    const { status, search, from_date, page = 1 } = req.query;
    const cases = await vmpAdapter.getCasesByVendor(vendorId, {
      status,
      search,
      from_date,
      limit: 12,
      offset: (page - 1) * 12
    });

    // Get unread count
    const unread_count = await vmpAdapter.getUnreadCount(req.user.id);

    res.render('pages/vendor-dashboard.html', {
      vendor,
      cases: cases.data,
      unread_count,
      pagination: {
        page: parseInt(page),
        total_pages: Math.ceil(cases.total / 12)
      }
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});
```

---

## 6. Add Message Thread Component

**Create:** `public/js/components/message-thread.js`

```javascript
/**
 * MessageThread - Chat interface for case messages
 * Usage: new MessageThread('thread-container', { caseId: '123' })
 */
export class MessageThread {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.caseId = options.caseId;
    this.pageSize = options.pageSize || 20;
    this.currentPage = 1;
    this.isLoading = false;
    
    this.init();
  }

  async init() {
    this.attachListeners();
    await this.loadMessages(1);
    this.scrollToBottom();
  }

  attachListeners() {
    // Listen for scroll to load older messages
    this.container.addEventListener('scroll', () => this.handleScroll());
    
    // Send button click
    const sendBtn = document.getElementById('send-button');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    // Enter key to send
    const input = document.getElementById('message-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }
  }

  async loadMessages(page) {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const response = await fetch(
        `/api/cases/${this.caseId}/messages?page=${page}&limit=${this.pageSize}`
      );
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      this.renderMessages(data.messages, page === 1);
      this.currentPage = page;
    } catch (error) {
      console.error('Failed to load messages:', error);
      this.showError('Could not load messages');
    } finally {
      this.isLoading = false;
    }
  }

  renderMessages(messages, shouldClear = false) {
    const list = document.getElementById('messages-list');
    
    if (shouldClear) {
      list.innerHTML = '';
    }

    messages.forEach((msg) => {
      const item = document.createElement('div');
      item.className = 'message-item';
      item.innerHTML = `
        <div class="flex gap-3 mb-4">
          <img src="${msg.author.avatar}" alt="" class="w-8 h-8 rounded-full flex-shrink-0" />
          <div class="flex-1">
            <div class="flex items-baseline gap-2">
              <span class="text-white font-semibold">${msg.author.name}</span>
              <span class="text-xs text-white/40">${this.formatDate(msg.created_at)}</span>
            </div>
            <p class="text-white/80 mt-1">${this.escapeHtml(msg.content)}</p>
          </div>
        </div>
      `;
      list.appendChild(item);
    });
  }

  async sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();

    if (!content) return;

    try {
      const response = await fetch(`/api/cases/${this.caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });

      if (!response.ok) throw new Error('Failed to send');

      const data = await response.json();
      
      // Add message optimistically
      this.addMessage(data.message);
      input.value = '';
      this.scrollToBottom();
    } catch (error) {
      console.error('Failed to send message:', error);
      this.showError('Could not send message');
    }
  }

  addMessage(message) {
    const list = document.getElementById('messages-list');
    const item = document.createElement('div');
    item.className = 'message-item animate-fadeIn';
    item.innerHTML = `
      <div class="flex gap-3 mb-4">
        <img src="${message.author.avatar}" alt="" class="w-8 h-8 rounded-full flex-shrink-0" />
        <div class="flex-1">
          <div class="flex items-baseline gap-2">
            <span class="text-white font-semibold">${message.author.name}</span>
            <span class="text-xs text-white/40">now</span>
          </div>
          <p class="text-white/80 mt-1">${this.escapeHtml(message.content)}</p>
        </div>
      </div>
    `;
    list.appendChild(item);
  }

  scrollToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }

  handleScroll() {
    if (this.container.scrollTop === 0 && !this.isLoading) {
      this.loadMessages(this.currentPage + 1);
    }
  }

  formatDate(isoDate) {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    
    return date.toLocaleDateString();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showError(message) {
    // Show toast notification
    console.error(message);
  }
}
```

**Use in Template:**
```html
<!-- In case-detail.html, Thread tab -->
<div id="message-thread" class="flex flex-col h-screen">
  <div id="messages-list" class="flex-1 overflow-y-auto p-4 space-y-4"></div>
  
  <div class="border-t border-white/8 p-4">
    <textarea id="message-input"
              class="w-full px-3 py-2 bg-white/5 border border-white/8 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-green-400/50"
              placeholder="Type message..."
              rows="3"></textarea>
    <button id="send-button"
            class="mt-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-white font-semibold transition-colors">
      Send
    </button>
  </div>
</div>

<script type="module">
  import { MessageThread } from '/js/components/message-thread.js';
  new MessageThread('message-thread', { caseId: '{{ case.id }}' });
</script>
```

---

## 7. Common Tasks

### Add a New Status Filter

1. Update API endpoint (`server.js`):
```javascript
const { status } = req.query;
const cases = await vmpAdapter.getCasesByVendor(vendorId, { status });
```

2. Update filter in template:
```html
<option value="my-status">My Status</option>
```

### Style a New Button

```html
<!-- Primary CTA -->
<button class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors">
  Action
</button>

<!-- Secondary -->
<button class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
  Action
</button>

<!-- Danger -->
<button class="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors">
  Delete
</button>
```

### Add Loading State

```html
<!-- Loading indicator -->
<div hx-indicator="#spinner"
     class="htmx-request:hidden">
  Content
</div>

<div id="spinner" class="htmx-request:flex hidden items-center justify-center">
  <svg class="animate-spin h-5 w-5 text-green-400" /* SVG */></svg>
</div>
```

### Show Error Toast

```javascript
function showErrorToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 5000);
}
```

---

## 8. Testing Your Component

**Quick Manual Test:**
1. Start server: `npm run dev`
2. Navigate to dashboard: `http://localhost:9000/vendor/dashboard`
3. Check for:
   - Cases display
   - Filters work
   - Click opens case detail
   - Mobile responsive

**Write Unit Test:**
```javascript
// tests/utils/date-utils.test.js
import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../../public/js/utils/date-utils.js';

describe('formatRelativeTime', () => {
  it('should return "now" for recent messages', () => {
    const date = new Date();
    expect(formatRelativeTime(date)).toBe('now');
  });

  it('should return "2h ago" for 2-hour-old messages', () => {
    const date = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('2h ago');
  });
});
```

**Run Test:**
```bash
npm run test
```

---

## 9. Common Gotchas

| Issue | Solution |
|-------|----------|
| Tailwind classes not showing | Rebuild Tailwind: `npm run dev` (auto-rebuilds) |
| HTMX swap not working | Check `hx-target` selector exists and is correct |
| Date not formatting | Import formatter: `const { formatDate } = await import('./utils.js');` |
| File upload stuck | Check max file size, check API error response |
| Message not sending | Check network tab, verify CSRF token included |
| Mobile layout broken | Use DevTools device emulation to test |

---

## 10. Next Steps

1. **Build dashboard page** → Copy template above
2. **Connect to API** → Update routes in `server.js`
3. **Test responsive** → Use Chrome DevTools device mode
4. **Add message thread** → Copy JS component
5. **Style evidence gallery** → Use grid layout + file icons
6. **Write unit tests** → For utility functions
7. **Deploy to staging** → Run guardrails check first

---

## Quick Reference

**Development Server:**
```bash
npm run dev           # Start Express + auto-reload
```

**Linting & Formatting:**
```bash
npm run lint          # Check code style
npm run lint:fix      # Auto-fix issues
npm run format        # Auto-format code
npm run format:check  # Check formatting
```

**Testing:**
```bash
npm run test          # Unit tests
npm run test:watch    # Watch mode
npm run test:e2e      # E2E tests
npm run test:a11y     # Accessibility audit
```

**Quality Gates (Pre-Ship):**
```bash
npm run guardrails    # Regression scan
npm run test          # All tests
npm run lint          # Code style check
```

---

**Ready to start?** Pick a component from the PRD and follow the pattern above! 🚀

Document: PRD_FRONTEND_UIUX.md | Code Quality: FRONTEND_CODE_QUALITY.md
