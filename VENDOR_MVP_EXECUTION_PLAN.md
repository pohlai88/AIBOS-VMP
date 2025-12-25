# Vendor MVP: 3-Day Execution Plan

**Architecture:** See `VENDOR_MVP_ARCHITECTURE.md`  
**Code Quality:** See `FRONTEND_CODE_QUALITY.md`  
**Timeline:** 3 days (Day 1-3)

---

## Day 1: Vendor Dashboard (6-8 hours)

### 1.1 Create Vendor Route

**File:** `src/routes/vendor.js`

```javascript
import express from 'express';
import { vmpAdapter } from '../adapters/supabase.js';
import { requireAuth, requireVendor } from '../middleware/auth.js';
import { handleRouteError } from '../utils/errors.js';

const router = express.Router();

// Dashboard page
router.get('/dashboard', requireAuth, requireVendor, async (req, res) => {
  try {
    const vendorId = req.user.vendorId;
    const { status, search, from_date, page = 1 } = req.query;
    
    const [vendor, cases, unreadCount] = await Promise.all([
      vmpAdapter.getVendor(vendorId),
      vmpAdapter.getCasesByVendor(vendorId, {
        status,
        search,
        from_date,
        limit: 12,
        offset: (page - 1) * 12
      }),
      vmpAdapter.getUnreadCount(req.user.id)
    ]);

    res.render('pages/vendor-dashboard.html', {
      vendor,
      cases: cases.data,
      pagination: cases.pagination,
      filters: { status, search, from_date },
      unread_count: unreadCount
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

export default router;
```

**Anti-Drift:** NO business logic in route; delegate to adapter

---

### 1.2 Create Dashboard Template

**File:** `src/views/pages/vendor-dashboard.html`

```nunjucks
{% extends "layout.html" %}
{% from "partials/case-card.html" import caseCard %}

{% block title %}Dashboard - {{ vendor.name }}{% endblock %}

{% block content %}
<main class="min-h-screen bg-black">
  <!-- Header -->
  <div class="border-b border-white/8 bg-white/3 backdrop-blur-sm">
    <div class="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
      <h1 class="text-2xl font-bold text-white">{{ vendor.name }}</h1>
      <div class="relative">
        <button class="relative">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {% if unread_count > 0 %}
          <span class="absolute -top-1 -right-1 bg-green-500 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {{ unread_count }}
          </span>
          {% endif %}
        </button>
      </div>
    </div>
  </div>

  <!-- Filter Bar -->
  <div class="max-w-7xl mx-auto px-4 py-4">
    <form method="GET" class="flex gap-4 flex-wrap">
      <select name="status" class="px-3 py-2 bg-white/5 border border-white/8 rounded-lg text-white">
        <option value="">All Status</option>
        <option value="open" {% if filters.status == 'open' %}selected{% endif %}>Open</option>
        <option value="closed" {% if filters.status == 'closed' %}selected{% endif %}>Closed</option>
        <option value="action-required" {% if filters.status == 'action-required' %}selected{% endif %}>Action Required</option>
      </select>
      
      <input type="text" name="search" value="{{ filters.search or '' }}" 
             placeholder="Search by case ID or title"
             class="px-3 py-2 bg-white/5 border border-white/8 rounded-lg text-white flex-1 min-w-[200px]">
      
      <button type="submit" class="px-4 py-2 bg-green-500 hover:bg-green-600 text-black font-semibold rounded-lg">
        Filter
      </button>
    </form>
  </div>

  <!-- Cases Grid -->
  <div class="max-w-7xl mx-auto px-4 py-6">
    {% if cases.length > 0 %}
      <div data-testid="case-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {% for case in cases %}
          {{ caseCard(case) }}
        {% endfor %}
      </div>
      
      <!-- Pagination -->
      {% if pagination.total_pages > 1 %}
      <div class="flex justify-center gap-2 mt-8">
        {% if pagination.page > 1 %}
        <a href="?page={{ pagination.page - 1 }}{% if filters.status %}&status={{ filters.status }}{% endif %}{% if filters.search %}&search={{ filters.search }}{% endif %}"
           class="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white">
          Previous
        </a>
        {% endif %}
        
        <span class="px-4 py-2 text-white">
          Page {{ pagination.page }} of {{ pagination.total_pages }}
        </span>
        
        {% if pagination.page < pagination.total_pages %}
        <a href="?page={{ pagination.page + 1 }}{% if filters.status %}&status={{ filters.status }}{% endif %}{% if filters.search %}&search={{ filters.search }}{% endif %}"
           class="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white">
          Next
        </a>
        {% endif %}
      </div>
      {% endif %}
    {% else %}
      <div class="text-center py-12">
        <p class="text-white/60 text-lg">No cases found</p>
      </div>
    {% endif %}
  </div>
</main>
{% endblock %}
```

**Anti-Drift:** NO business logic in template; use adapter data as-is

---

### 1.3 Create Case Card Partial

**File:** `src/views/partials/case-card.html`

```nunjucks
{% macro caseCard(case) %}
<div data-testid="case-card" class="border border-white/8 rounded-lg bg-white/3 p-4 hover:bg-white/5 transition-colors cursor-pointer"
     onclick="window.location.href='/cases/{{ case.id }}'">
  
  <div class="flex justify-between items-start mb-3">
    <h3 class="text-white font-semibold">{{ case.subject }}</h3>
    <span class="px-2 py-1 rounded text-xs font-semibold status-{{ case.status }}">
      {{ case.status | replace('-', ' ') | title }}
    </span>
  </div>
  
  <div class="text-sm text-white/60 space-y-1">
    <p>Case ID: <span class="text-white">{{ case.id | truncate(8) }}</span></p>
    <p>Type: <span class="text-white">{{ case.case_type | replace('_', ' ') | title }}</span></p>
    <p>Created: <span class="text-white">{{ case.created_at | formatDate }}</span></p>
  </div>
  
  {% if case.unread_messages > 0 %}
  <div class="mt-3 flex items-center gap-2">
    <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
    <span class="text-xs text-green-400">{{ case.unread_messages }} new message{% if case.unread_messages > 1 %}s{% endif %}</span>
  </div>
  {% endif %}
</div>
{% endmacro %}
```

**Anti-Drift:** Reusable macro; NO duplication

---

### Day 1 DoD Checklist

- [ ] Route `/vendor/dashboard` responds with 200
- [ ] Dashboard displays cases from real data
- [ ] Status filter changes query param and reloads
- [ ] Search input filters by case ID/title
- [ ] Pagination works (prev/next buttons)
- [ ] Case card click navigates to `/cases/:id`
- [ ] Unread badge shows correct count
- [ ] Mobile responsive (1 col on mobile)
- [ ] `npm run lint` passes
- [ ] No console errors

---

## Day 2: Case Detail Page (8-10 hours)

### 2.1 Create Case Detail Route

**File:** `src/routes/client.js` (add to existing)

```javascript
// Case detail page
router.get('/cases/:id', requireAuth, canAccessCase, async (req, res) => {
  try {
    const caseId = req.params.id;
    
    const [caseData, vendor, company] = await Promise.all([
      vmpAdapter.getCaseDetail(caseId),
      vmpAdapter.getVendor(caseData.vendor_id),
      vmpAdapter.getCompany(caseData.company_id)
    ]);

    res.render('pages/case-detail.html', {
      case: caseData,
      vendor,
      company,
      active_tab: req.query.tab || 'overview'
    });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// HTMX endpoint: Load thread tab
router.get('/cases/:id/thread', requireAuth, canAccessCase, async (req, res) => {
  const messages = await vmpAdapter.getMessages(req.params.id, { limit: 20, page: 1 });
  res.render('partials/message-thread.html', { messages, caseId: req.params.id });
});

// HTMX endpoint: Load evidence tab
router.get('/cases/:id/evidence', requireAuth, canAccessCase, async (req, res) => {
  const files = await vmpAdapter.getEvidence(req.params.id);
  res.render('partials/evidence-gallery.html', { files, caseId: req.params.id });
});
```

**Anti-Drift:** Lazy load tabs via HTMX; NO full page reload

---

### 2.2 Create Case Detail Template

**File:** `src/views/pages/case-detail.html`

```nunjucks
{% extends "layout.html" %}

{% block title %}{{ case.subject }} - Case Detail{% endblock %}

{% block content %}
<main class="min-h-screen bg-black">
  <!-- Header -->
  <div class="border-b border-white/8 bg-white/3 backdrop-blur-sm">
    <div class="max-w-7xl mx-auto px-4 py-4">
      <div class="flex items-center gap-2 text-sm text-white/60 mb-3">
        <a href="/vendor/dashboard" class="hover:text-white">Dashboard</a>
        <span>/</span>
        <span class="text-white">Case {{ case.id | truncate(8) }}</span>
      </div>
      
      <div class="flex justify-between items-start">
        <div>
          <h1 class="text-2xl font-bold text-white">{{ case.subject }}</h1>
          <div class="flex items-center gap-3 mt-2">
            <span class="px-2 py-1 rounded text-xs font-semibold status-{{ case.status }}">
              {{ case.status | replace('-', ' ') | title }}
            </span>
            <span class="text-sm text-white/60">Created {{ case.created_at | formatDate }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Tab Navigation -->
  <div class="border-b border-white/8">
    <div class="max-w-7xl mx-auto px-4">
      <nav class="flex gap-6">
        {% set tabs = ['overview', 'thread', 'evidence', 'checklist', 'activity'] %}
        {% for tab in tabs %}
        <a href="?tab={{ tab }}" 
           id="{{ tab }}-tab-button"
           class="py-3 border-b-2 text-sm font-semibold {% if active_tab == tab %}border-green-500 text-green-400{% else %}border-transparent text-white/60 hover:text-white{% endif %}">
          {{ tab | title }}
        </a>
        {% endfor %}
      </nav>
    </div>
  </div>

  <!-- Tab Content -->
  <div class="max-w-7xl mx-auto px-4 py-6">
    <!-- Overview Tab (always loaded) -->
    <div id="overview-tab" {% if active_tab != 'overview' %}class="hidden"{% endif %}>
      {% include "partials/case-overview.html" %}
    </div>
    
    <!-- Thread Tab (lazy load) -->
    <div id="thread-tab" 
         {% if active_tab != 'thread' %}class="hidden"{% endif %}
         hx-get="/cases/{{ case.id }}/thread" 
         hx-trigger="click from:#thread-tab-button once">
      {% if active_tab == 'thread' %}
        Loading...
      {% endif %}
    </div>
    
    <!-- Evidence Tab (lazy load) -->
    <div id="evidence-tab"
         {% if active_tab != 'evidence' %}class="hidden"{% endif %}
         hx-get="/cases/{{ case.id }}/evidence"
         hx-trigger="click from:#evidence-tab-button once">
      {% if active_tab == 'evidence' %}
        Loading...
      {% endif %}
    </div>
  </div>
</main>

<script>
  // Tab switching without page reload
  document.querySelectorAll('[id$="-tab-button"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = btn.id.replace('-tab-button', '');
      
      // Hide all tabs
      document.querySelectorAll('[id$="-tab"]').forEach(t => t.classList.add('hidden'));
      
      // Show selected tab
      document.getElementById(tab + '-tab').classList.remove('hidden');
      
      // Update URL hash
      window.location.hash = tab;
    });
  });
</script>
{% endblock %}
```

**Anti-Drift:** Tabs lazy load via HTMX; URL hash preserves state

---

### Day 2 DoD Checklist

- [ ] Route `/cases/:id` responds with 200
- [ ] Case metadata displays correctly
- [ ] All 5 tabs clickable
- [ ] Tab switching shows/hides content (no reload)
- [ ] URL hash updates on tab change
- [ ] HTMX lazy loads thread/evidence tabs
- [ ] Back button preserves tab state
- [ ] Mobile responsive
- [ ] `npm run lint` passes

---

## Day 3: Interactive Components (8-10 hours)

### 3.1 Message Thread Component

**File:** `public/js/components/MessageThread.js`

```javascript
export class MessageThread {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.caseId = options.caseId;
    this.currentPage = 1;
    this.isLoading = false;
    
    this.init();
  }

  async init() {
    await this.loadMessages(1);
    this.attachListeners();
    this.scrollToBottom();
  }

  async loadMessages(page) {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const response = await fetch(`/api/cases/${this.caseId}/messages?page=${page}`);
      if (!response.ok) throw new Error(`API error: ${response.statusText}`);
      
      const messages = await response.json();
      this.renderMessages(messages, page === 1);
      this.currentPage = page;
    } catch (error) {
      console.error('Failed to load messages:', error);
      this.showError('Could not load messages');
    } finally {
      this.isLoading = false;
    }
  }

  async sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;

    // Optimistic UI
    const tempId = `temp-${Date.now()}`;
    this.addOptimisticMessage(tempId, content);
    input.value = '';

    try {
      const response = await fetch(`/api/cases/${this.caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      
      if (!response.ok) throw new Error('Send failed');
      
      const savedMsg = await response.json();
      this.replaceOptimisticMessage(tempId, savedMsg);
    } catch (error) {
      this.removeOptimisticMessage(tempId);
      this.showError('Could not send message');
      input.value = content; // Restore
    }
  }

  renderMessages(messages, clear = false) {
    const list = document.getElementById('messages-list');
    if (clear) list.innerHTML = '';
    
    messages.forEach(msg => {
      const div = document.createElement('div');
      div.dataset.messageId = msg.id;
      div.className = 'mb-4';
      div.innerHTML = `
        <div class="flex gap-3">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-semibold text-white">${this.escapeHtml(msg.sender_name)}</span>
              <span class="text-xs text-white/60">${this.formatDate(msg.created_at)}</span>
            </div>
            <p class="text-white/80">${this.escapeHtml(msg.body)}</p>
          </div>
        </div>
      `;
      list.appendChild(div);
    });
  }

  attachListeners() {
    document.getElementById('send-button').addEventListener('click', () => this.sendMessage());
    
    document.getElementById('message-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  scrollToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

  showError(message) {
    // TODO: Show toast notification
    console.error(message);
  }
}
```

**Anti-Drift:** Encapsulated class; NO global state

---

### 3.2 API Routes

**File:** `src/routes/client.js` (add to existing)

```javascript
// POST: Send message
router.post('/api/cases/:id/messages', requireAuth, canAccessCase, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content required' });
    }

    const message = await vmpAdapter.createMessage(req.params.id, {
      sender_user_id: req.user.id,
      sender_type: req.user.role,
      body: content.trim()
    });

    res.status(201).json(message);
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// POST: Upload evidence
router.post('/api/cases/:id/evidence', requireAuth, canAccessCase, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const evidence = await vmpAdapter.uploadEvidence(req.params.id, {
      file: file.buffer,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploader_type: req.user.role
    });

    res.status(201).json(evidence);
  } catch (error) {
    handleRouteError(error, req, res);
  }
});
```

**Anti-Drift:** Input validation before adapter call

---

### Day 3 DoD Checklist

- [ ] Can send message to case thread
- [ ] Message appears immediately (optimistic UI)
- [ ] Error handling shows toast notification
- [ ] Can upload file (drag-drop or click)
- [ ] File preview/thumbnail shows
- [ ] File validation before upload
- [ ] Progress bar during upload
- [ ] `npm run lint` passes
- [ ] E2E test passes (send message + upload file)

---

## Final Verification (30 mins)

### Run Full Test Suite

```bash
# Lint
npm run lint

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Lighthouse
npm run test:lighthouse
```

### Manual QA Checklist

- [ ] Dashboard loads without errors
- [ ] Can filter cases by status
- [ ] Can search cases by ID
- [ ] Pagination works
- [ ] Can open case detail
- [ ] All 5 tabs work
- [ ] Can send message
- [ ] Can upload file
- [ ] Mobile responsive (test on real device)
- [ ] No console errors

---

**Once all DoD items checked, Vendor MVP is SHIPPED. 🚀**
