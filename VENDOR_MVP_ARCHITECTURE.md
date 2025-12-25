# Vendor MVP Architecture & Governance

**Version:** 1.0  
**Date:** December 24, 2025  
**Purpose:** Engineering architecture, component contracts, anti-drift governance

---

## 1. Architecture Overview

### System Boundaries
```
┌─────────────────────────────────────────────────────────────┐
│ VENDOR MVP SCOPE                                            │
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│ │  Dashboard  │→ │ Case Detail │→ │  Evidence   │         │
│ │  (Inbox)    │  │  (5 Tabs)   │  │  Manager    │         │
│ └─────────────┘  └─────────────┘  └─────────────┘         │
│        ↓                ↓                ↓                  │
│ ┌──────────────────────────────────────────────────────┐   │
│ │         Express Routes (server.js)                   │   │
│ │  /vendor/dashboard  /cases/:id  /api/cases/*         │   │
│ └──────────────────────────────────────────────────────┘   │
│        ↓                                                    │
│ ┌──────────────────────────────────────────────────────┐   │
│ │         Supabase Adapter (vmpAdapter)                │   │
│ │  getCasesByVendor()  getCaseDetail()  uploadFile()   │   │
│ └──────────────────────────────────────────────────────┘   │
│        ↓                                                    │
│ ┌──────────────────────────────────────────────────────┐   │
│ │              Supabase Cloud                          │   │
│ │  vmp_cases  vmp_messages  vmp_evidence  storage      │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy
```
Page Layer (Nunjucks Templates)
  └─ vendor-dashboard.html
  └─ case-detail.html
       ├─ Tab: Overview (partials/case-overview.html)
       ├─ Tab: Thread (partials/message-thread.html)
       ├─ Tab: Evidence (partials/evidence-gallery.html)
       ├─ Tab: Checklist (partials/case-checklist.html)
       └─ Tab: Activity (partials/case-timeline.html)

Component Layer (JavaScript Modules)
  └─ public/js/components/
       ├─ MessageThread.js (chat interface)
       ├─ EvidenceManager.js (file upload/preview)
       └─ CaseFilter.js (status/search filters)

Service Layer (Backend Routes)
  └─ src/routes/
       ├─ vendor.js (dashboard, case list)
       └─ client.js (shared case detail, messages, evidence)

Data Layer (Supabase Adapter)
  └─ src/adapters/supabase.js
       └─ vmpAdapter methods (getCases, createMessage, uploadEvidence)
```

---

## 2. Component Contracts (Anti-Drift Governance)

### 2.1 Dashboard Page Contract

**File:** `src/views/pages/vendor-dashboard.html`

**Responsibilities:**
- Display case inbox (12 per page, paginated)
- Filter by status (open, closed, action-required)
- Search by case ID or title
- Show unread count badge
- Navigate to case detail on click

**Dependencies:**
- Route: `GET /vendor/dashboard`
- API: `vmpAdapter.getCasesByVendor(vendorId, filters)`
- Partials: `case-card.html` (reusable card component)

**Data Contract:**
```typescript
interface DashboardProps {
  vendor: { id: string; name: string };
  cases: Case[];
  filters: { status?: string; search?: string; from_date?: string };
  pagination: { page: number; total_pages: number; total_count: number };
  unread_count: number;
}

interface Case {
  id: string;
  case_type: string;
  subject: string;
  status: 'open' | 'closed' | 'action-required' | 'escalated';
  created_at: string;
  sla_due_at?: string;
  unread_messages: number;
}
```

**Anti-Drift Rules:**
1. ❌ NO direct database queries in template
2. ❌ NO business logic in Nunjucks (use adapter methods)
3. ✅ ALL filters must pass through URL query params (stateless)
4. ✅ Pagination MUST be server-side (not client-side)
5. ✅ Case cards MUST use `partials/case-card.html` macro (DRY)

**Governance Checkpoint:**
```javascript
// WRONG: Logic in template
{% if case.created_at > Date.now() - 86400000 %}New{% endif %}

// RIGHT: Logic in adapter
{{ case.is_new ? 'New' : '' }}
```

---

### 2.2 Case Detail Page Contract

**File:** `src/views/pages/case-detail.html`

**Responsibilities:**
- Display case metadata (title, status, dates, vendor)
- Tab navigation (5 tabs: Overview, Thread, Evidence, Checklist, Activity)
- Tab state persistence (URL hash: `/cases/123#thread`)
- Lazy load tab content (only active tab)

**Dependencies:**
- Route: `GET /cases/:id`
- API: `vmpAdapter.getCaseDetail(caseId)`
- Components: `MessageThread.js`, `EvidenceManager.js`

**Data Contract:**
```typescript
interface CaseDetailProps {
  case: {
    id: string;
    subject: string;
    status: string;
    case_type: string;
    created_at: string;
    vendor_id: string;
    company_id: string;
    assigned_to_user_id?: string;
    sla_due_at?: string;
    tags?: string[];
  };
  vendor: { id: string; name: string };
  company: { id: string; name: string };
  tabs: ['overview', 'thread', 'evidence', 'checklist', 'activity'];
  active_tab: string; // from URL hash
}
```

**Anti-Drift Rules:**
1. ❌ NO tab content loaded until tab clicked (lazy load)
2. ❌ NO inline JavaScript in template (use separate .js files)
3. ✅ Tab state MUST sync with URL hash (back button support)
4. ✅ All tab content MUST use `hx-get` for AJAX load (HTMX)
5. ✅ Tab switching MUST preserve scroll position

**Governance Checkpoint:**
```html
<!-- WRONG: All tabs loaded upfront -->
<div id="overview-tab">...</div>
<div id="thread-tab">...</div>
<div id="evidence-tab">...</div>

<!-- RIGHT: Lazy load via HTMX -->
<div id="overview-tab">...</div>
<div id="thread-tab" 
     hx-get="/cases/{{ case.id }}/thread" 
     hx-trigger="click from:#thread-tab-button">
</div>
```

---

### 2.3 Message Thread Component Contract

**File:** `public/js/components/MessageThread.js`

**Responsibilities:**
- Display messages in chronological order
- Auto-scroll to latest message
- Load older messages on scroll-up (pagination)
- Send new messages (optimistic UI)
- Show typing indicators

**API Contract:**
```typescript
// Constructor
new MessageThread(containerId: string, options: {
  caseId: string;
  pageSize?: number; // default 20
  autoScroll?: boolean; // default true
})

// Public Methods
async loadMessages(page: number): Promise<Message[]>
async sendMessage(content: string): Promise<Message>
scrollToBottom(): void

// Events
onMessageSent(callback: (message: Message) => void)
onError(callback: (error: Error) => void)
```

**Data Contract:**
```typescript
interface Message {
  id: string;
  case_id: string;
  sender_type: 'vendor' | 'client' | 'system';
  sender_user_id?: string;
  body: string;
  created_at: string;
  metadata?: { attachments?: string[] };
}
```

**Anti-Drift Rules:**
1. ❌ NO direct DOM manipulation outside this component
2. ❌ NO global variables (encapsulate in class)
3. ✅ ALL API calls MUST go through `/api/cases/:id/messages`
4. ✅ Error states MUST show toast notification
5. ✅ Optimistic UI MUST rollback on failure

**Governance Checkpoint:**
```javascript
// WRONG: Global state
let messages = [];
function sendMessage() { /* mutates global */ }

// RIGHT: Encapsulated class
class MessageThread {
  #messages = [];
  async sendMessage(content) {
    // Optimistic update
    const tempMsg = this.#addOptimisticMessage(content);
    try {
      const saved = await this.#api.post(content);
      this.#replaceOptimistic(tempMsg.id, saved);
    } catch (err) {
      this.#removeOptimistic(tempMsg.id);
      this.#showError(err);
    }
  }
}
```

---

### 2.4 Evidence Manager Component Contract

**File:** `public/js/components/EvidenceManager.js`

**Responsibilities:**
- Drag-drop file upload
- File type validation (PDF, images only)
- Progress tracking during upload
- Thumbnail previews (images only)
- File download/delete actions

**API Contract:**
```typescript
new EvidenceManager(containerId: string, options: {
  caseId: string;
  maxFileSize?: number; // default 50MB
  allowedTypes?: string[]; // default ['pdf', 'jpg', 'png']
})

// Public Methods
async uploadFile(file: File): Promise<Evidence>
async deleteFile(fileId: string): Promise<void>
downloadFile(fileId: string): void
```

**Data Contract:**
```typescript
interface Evidence {
  id: string;
  case_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  uploaded_at: string;
  uploader_type: 'vendor' | 'client';
}
```

**Anti-Drift Rules:**
1. ❌ NO file upload without client-side validation
2. ❌ NO inline progress bars (use dedicated component)
3. ✅ ALL uploads MUST go through `/api/cases/:id/evidence`
4. ✅ File size MUST be validated before upload starts
5. ✅ SHA256 checksum MUST be calculated client-side

**Governance Checkpoint:**
```javascript
// WRONG: No validation
async uploadFile(file) {
  return fetch('/api/upload', { body: file });
}

// RIGHT: Validate first
async uploadFile(file) {
  this.#validateFileType(file);
  this.#validateFileSize(file);
  const checksum = await this.#calculateChecksum(file);
  return this.#uploadWithProgress(file, checksum);
}
```

---

## 3. Route Architecture (Backend)

### 3.1 Vendor Routes

**File:** `src/routes/vendor.js`

```javascript
import express from 'express';
const router = express.Router();

// Dashboard
router.get('/dashboard', requireAuth, requireVendor, async (req, res) => {
  // Contract: Returns vendor case inbox with filters
  // Anti-drift: NO direct DB queries; use vmpAdapter
});

// API: Get cases for vendor
router.get('/api/cases', requireAuth, requireVendor, async (req, res) => {
  // Contract: JSON endpoint for case list
  // Supports: ?status=open&search=INV-123&page=1
});

export default router;
```

**Anti-Drift Rules:**
1. ✅ ALL routes MUST have `requireAuth` middleware
2. ✅ Vendor routes MUST have `requireVendor` check
3. ❌ NO business logic in routes (delegate to adapter)
4. ✅ Error handling MUST use `handleRouteError()`

---

### 3.2 Client Routes (Shared)

**File:** `src/routes/client.js`

```javascript
// Case Detail
router.get('/cases/:id', requireAuth, canAccessCase, async (req, res) => {
  // Contract: Returns case detail page
  // Supports: Both vendor and client users
});

// Messages API
router.post('/api/cases/:id/messages', requireAuth, canAccessCase, async (req, res) => {
  // Contract: Create new message
  // Validation: CSRF token required
});

// Evidence API
router.post('/api/cases/:id/evidence', requireAuth, canAccessCase, upload.single('file'), async (req, res) => {
  // Contract: Upload evidence file
  // Validation: File type, size, checksum
});
```

**Anti-Drift Rules:**
1. ✅ Shared routes MUST check `canAccessCase` (RLS enforcement)
2. ✅ File uploads MUST use `multer` middleware
3. ✅ CSRF protection MUST be enabled for POST/PUT/DELETE
4. ❌ NO hardcoded vendor/company IDs

---

## 4. Data Flow Governance

### 4.1 Request → Response Flow

```
User Action (Click case)
  ↓
Frontend (HTMX hx-get="/cases/123")
  ↓
Express Route (/cases/:id)
  ↓
Middleware (requireAuth → canAccessCase)
  ↓
Adapter (vmpAdapter.getCaseDetail(123))
  ↓
Supabase (SELECT with RLS enforcement)
  ↓
Adapter (transform DB → domain model)
  ↓
Route (render template with data)
  ↓
Template (case-detail.html)
  ↓
User (sees case detail page)
```

**Anti-Drift Checkpoints:**
- ❌ NO template logic that queries database
- ❌ NO adapter methods that render HTML
- ✅ Adapter returns plain objects (not Supabase response)
- ✅ Routes handle errors via `try/catch` + `handleRouteError()`

---

### 4.2 Error Handling Flow

```
Error Occurs (e.g., API 500)
  ↓
Adapter (throws DatabaseError)
  ↓
Route (catches error)
  ↓
handleRouteError(error, req, res)
  ↓
┌─────────────────────────────────────┐
│ If HTML request: render error page │
│ If API request: return JSON error  │
└─────────────────────────────────────┘
  ↓
Frontend (displays error toast/message)
  ↓
Logger (logs to console + Sentry)
```

**Anti-Drift Rules:**
1. ✅ ALL async functions MUST have try/catch
2. ✅ Errors MUST be logged with context (vendorId, caseId)
3. ❌ NO generic "Something went wrong" messages
4. ✅ User-facing errors MUST be actionable

---

## 5. Testing Governance

### 5.1 Unit Test Contract

**Scope:** Utility functions only (date formatting, validation)

```javascript
// File: tests/utils/date-utils.test.js
describe('formatRelativeTime', () => {
  it('returns "now" for recent times');
  it('returns "5m ago" for 5-minute-old times');
  it('returns "2h ago" for 2-hour-old times');
  it('returns date for >24h old times');
});
```

**Anti-Drift Rules:**
1. ❌ NO unit tests for UI components (use E2E instead)
2. ✅ Coverage target: 90%+ for utils, 80%+ for services
3. ✅ Use `describe` blocks to group related tests

---

### 5.2 E2E Test Contract

**Scope:** Critical user workflows

```javascript
// File: tests/e2e/vendor-mvp.spec.js
test('Vendor can view case inbox and open case detail', async ({ page }) => {
  // 1. Login as vendor
  // 2. See dashboard with case list
  // 3. Click first case
  // 4. Verify case detail loads
  // 5. Verify tabs are clickable
});

test('Vendor can send message in case thread', async ({ page }) => {
  // 1. Open case detail
  // 2. Click Thread tab
  // 3. Type message
  // 4. Click Send
  // 5. Verify message appears
});
```

**Anti-Drift Rules:**
1. ✅ Use `[data-testid]` for selectors (not CSS classes)
2. ❌ NO hard waits; use `waitForSelector` / `waitForURL`
3. ✅ Clean up test data after each test
4. ✅ Mock API calls for speed (use Playwright intercept)

---

## 6. Definition of Done (Page-Level)

### Dashboard DoD
- [ ] Displays 12 cases per page from real data
- [ ] Status filter works (open, closed, action-required)
- [ ] Search by case ID works
- [ ] Pagination works (prev/next buttons)
- [ ] Unread badge shows correct count
- [ ] Mobile responsive (1 col mobile, 2-3 col desktop)
- [ ] ESLint passes
- [ ] No console errors
- [ ] Lighthouse ≥ 90

### Case Detail DoD
- [ ] Case metadata displays correctly
- [ ] All 5 tabs clickable
- [ ] Tab state persists in URL hash
- [ ] Tab content lazy loads (HTMX)
- [ ] Back button works (preserves tab)
- [ ] Mobile responsive
- [ ] ESLint passes
- [ ] Lighthouse ≥ 90

### Message Thread DoD
- [ ] Messages load in chronological order
- [ ] Auto-scrolls to latest message
- [ ] Can send new message
- [ ] Message appears immediately (optimistic UI)
- [ ] Error handling shows toast
- [ ] Timestamps formatted ("5m ago")
- [ ] ESLint passes

### Evidence Manager DoD
- [ ] Drag-drop file upload works
- [ ] File type validation before upload
- [ ] Progress bar during upload
- [ ] Thumbnail preview for images
- [ ] Can download file
- [ ] Can delete file
- [ ] ESLint passes

---

## 7. Anti-Drift Enforcement

### Code Review Checklist

**Before Merge:**
- [ ] No business logic in templates
- [ ] No direct DB queries in routes
- [ ] All async functions have try/catch
- [ ] All routes have auth middleware
- [ ] All API endpoints validate input
- [ ] All components use `[data-testid]`
- [ ] No hardcoded vendor/company IDs
- [ ] Error messages are user-friendly
- [ ] ESLint passes
- [ ] No console.log in production

### Automated Checks (CI)

```yaml
# .github/workflows/vendor-mvp.yml
- name: Lint
  run: npm run lint
  
- name: Unit Tests
  run: npm run test
  
- name: E2E Tests
  run: npm run test:e2e
  
- name: Lighthouse
  run: npm run test:lighthouse
```

---

## 8. Next Steps (3-Day Plan)

### Day 1: Dashboard (6-8 hours)
1. Create `src/routes/vendor.js` (dashboard route)
2. Create `src/views/pages/vendor-dashboard.html`
3. Create `src/views/partials/case-card.html` macro
4. Add API endpoint: `GET /vendor/api/cases`
5. Test: Dashboard loads, filters work, pagination works
6. Verify DoD checklist

### Day 2: Case Detail (8-10 hours)
1. Create `src/views/pages/case-detail.html`
2. Create 5 tab partials (overview, thread, evidence, checklist, activity)
3. Add HTMX lazy loading for tabs
4. Add URL hash routing for tabs
5. Test: All tabs work, lazy load verified, back button works
6. Verify DoD checklist

### Day 3: Interactive Components (8-10 hours)
1. Create `public/js/components/MessageThread.js`
2. Create `public/js/components/EvidenceManager.js`
3. Add API endpoints: `POST /api/cases/:id/messages`, `POST /api/cases/:id/evidence`
4. Test: Send message works, upload file works, error handling works
5. Verify DoD checklist
6. Run full E2E test suite

---

**This is your governance contract. All code MUST conform to these rules. No exceptions.**
