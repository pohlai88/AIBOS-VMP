# Frontend UI/UX PRD – Vendor MVP & Core Platform

**Version:** 1.0  
**Date:** December 24, 2025  
**Status:** Ready for Development  
**Scope:** Vendor MVP Dashboard + Core Client Pages  

---

## 1. Executive Summary

This PRD defines the complete frontend UI/UX roadmap for the Vendor MVP and core client-facing pages. The vendor MVP focuses on **case management, evidence handling, and communication** while maintaining the established design system (dark theme, glassmorphism, signal green accents).

**Key Deliverables:**
- Vendor Dashboard (case inbox, filters, quick actions)
- Case Detail Page (with tabs: overview, thread, evidence, checklist, activity)
- Case Thread Component (message chat interface)
- Evidence Manager (upload, preview, organize)
- Responsive Mobile Experience

**Timeline:** Sprint-based, with vendor MVP first (2 weeks), core pages follow (4 weeks)

---

## 2. Design System Reference

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| `bg-primary` | `#060607` | Page backgrounds |
| `bg-secondary` | `#0a0a0b` | Card backgrounds |
| `bg-tertiary` | `rgba(255, 255, 255, 0.03)` | Glassmorphic panels |
| `accent-green` | `hsl(155, 100%, 69%)` | Buttons, highlights, CTAs |
| `text-primary` | `#ededed` | Primary text |
| `text-secondary` | `rgba(237, 237, 237, 0.60)` | Secondary text, labels |
| `text-tertiary` | `rgba(237, 237, 237, 0.40)` | Disabled, subtle text |
| `border-color` | `rgba(255, 255, 255, 0.08)` | Borders, dividers |
| `error-red` | `#ff4444` | Error states, warnings |
| `success-green` | `#4ade80` | Success states |
| `warning-yellow` | `#facc15` | Warnings, cautions |

### Typography
```
Font Family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
Font Rendering: geometricPrecision
Font Smoothing: antialiased + grayscale

Scales:
- Display (h1): 32px, weight 700, line-height 1.2
- Headline (h2): 24px, weight 600, line-height 1.3
- Subheading (h3): 18px, weight 600, line-height 1.4
- Body Large: 16px, weight 400, line-height 1.5
- Body: 14px, weight 400, line-height 1.6
- Small: 12px, weight 400, line-height 1.5
- Label: 11px, weight 600, letter-spacing 0.5px
```

### Visual Effects
- **Grain Overlay:** SVG fractal noise (`.noise-overlay`)
- **Glassmorphism:** `rgba(255, 255, 255, 0.03)` with backdrop blur
- **Shadows:** Minimal, dark-theme optimized
- **Animations:** Smooth 200-300ms easing (ease-in-out)
- **Breathing Effect:** For icons/badges (4s infinite animation)

---

## 3. Feature Requirements

### 3.1 Vendor Dashboard (`/vendor/dashboard`)

**Purpose:** Entry point for vendor users; displays case inbox and key metrics.

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Header: Vendor Name + Notifications Bell    │
├─────────────────────────────────────────────┤
│ Filter Bar (Status, Date, Search)           │
├─────────────────────────────────────────────┤
│ Case Inbox (List or Card View Toggle)       │
│ ├─ Case Row 1 (Title, Status, Date, Unread)│
│ ├─ Case Row 2                               │
│ └─ Case Row N                               │
├─────────────────────────────────────────────┤
│ Pagination / Load More                      │
└─────────────────────────────────────────────┘
```

**Components Needed:**
1. **Header** – Vendor name, notification bell with unread count, user menu
2. **Filter Bar** – Dropdowns for status (open, closed, action-required), date range, search input
3. **Case Cards/Rows** – Each shows:
   - Case ID / Title (clickable)
   - Status badge (open, closed, escalated)
   - Last message date (human-readable, e.g., "2 hours ago")
   - Unread indicator (red dot)
   - Vendor assigned indicator
4. **Empty State** – Message when no cases found

**Key Features:**
- Case filtering (status, date, search)
- Real-time unread badge updates
- Quick case selection (highlight row)
- Responsive grid layout (1 col mobile, 2-3 col desktop)

**API Endpoints:**
- `GET /vendor/api/cases` (list with filters, pagination)
- `GET /vendor/api/cases/unread-count`

---

### 3.2 Case Detail Page (`/cases/:id`)

**Purpose:** Comprehensive case view with tabs for different aspects.

**Layout:**
```
┌────────────────────────────────────┐
│ Breadcrumb: Home > Cases > Case ID │
├────────────────────────────────────┤
│ Case Header:                        │
│ - Title, Case ID, Status Badge     │
│ - Created Date, Vendor Name        │
├────────────────────────────────────┤
│ Tab Navigation:                     │
│ [Overview] [Thread] [Evidence] [..] │
├────────────────────────────────────┤
│ Tab Content (changes per tab)       │
│ ├─ Overview: Case summary, metadata │
│ ├─ Thread: Message chat             │
│ ├─ Evidence: File gallery           │
│ ├─ Checklist: Task list             │
│ └─ Activity: Timeline               │
└────────────────────────────────────┘
```

**Tabs & Contents:**

#### Tab 1: Overview
- **Case Info Card:**
  - Case ID (copyable)
  - Title, Description
  - Status (badge)
  - Created, Updated dates
  - Vendor assigned
  - Assigned to (team member)
- **Quick Actions:** Edit, Escalate, Resolve, Mark as spam
- **Metadata Grid:**
  - Contract type
  - Amount (if applicable)
  - Priority
  - Tags

#### Tab 2: Thread (Messages)
- **Message List:**
  - Chronological messages
  - Each message shows: author avatar, name, timestamp, message content
  - Unread messages highlighted
  - Load older messages (pagination)
- **Message Input:**
  - Text area with markdown support (bold, italic, code, links)
  - File attachment button (upload evidence inline)
  - Send button (disabled if empty)
  - Typing indicator when others are typing

#### Tab 3: Evidence
- **Evidence Gallery:**
  - Grid layout (3-4 cols on desktop, 1-2 on mobile)
  - Each item shows: thumbnail, filename, file size, upload date
  - Right-click context menu (download, delete, view details)
- **Upload Area:**
  - Drag-and-drop zone or click to upload
  - Progress bar for uploads
  - Allowed file types (PDF, images, Word, Excel)
  - Max file size hint

#### Tab 4: Checklist
- **Task List:**
  - Checkbox for each task (checked/unchecked)
  - Task name, description
  - Due date (if applicable)
  - Assigned to
  - Editable (click to edit)
- **Add Task:** Button to create new task

#### Tab 5: Activity
- **Timeline:**
  - Chronological log of case changes
  - Each entry: timestamp, action, user, details
  - Icons for different action types (comment, status change, evidence upload, etc.)

**Key Features:**
- Tab persistence (remember selected tab)
- Responsive layout
- Real-time updates (WebSocket for new messages)
- Optimistic UI updates (message appears immediately, retries if fails)
- Loading states and error handling

**API Endpoints:**
- `GET /cases/:id` (full case details)
- `GET /cases/:id/messages` (paginated)
- `POST /cases/:id/messages` (create)
- `GET /cases/:id/evidence` (list)
- `POST /cases/:id/evidence` (upload)
- `GET /cases/:id/activity` (timeline)

---

### 3.3 Message Thread Component

**Purpose:** Chat-like interface for case communication.

**Behavior:**
- Load 20 messages initially, load more on scroll-up
- Auto-scroll to latest message (unless user scrolled up)
- Show typing indicators
- Format timestamps (1m ago, 1h ago, Yesterday, Date)
- Support markdown rendering (limited set)

**Markdown Support:**
- `**bold**` → bold
- `*italic*` → italic
- `` `code` `` → monospace
- `[link text](url)` → clickable link
- Line breaks and paragraphs

**Code Quality:**
- Sanitize user input (prevent XSS)
- Auto-linkify URLs
- Emoji support

---

### 3.4 Evidence Manager Component

**Purpose:** Upload, preview, and organize case evidence files.

**Features:**
- Drag-and-drop file upload
- Inline file type validation
- Progress tracking (bytes uploaded / total)
- Thumbnail previews (images only)
- File metadata (name, size, upload date, uploader)
- Context menu (download, delete, info)
- Batch operations (select multiple, delete all)

**Validation:**
- File types: PDF, JPG, PNG, GIF, DOCX, XLSX, PPT
- Max file size: 50MB per file, 500MB total per case
- Filename validation (no special chars)

**UI States:**
- Idle (empty, show upload prompt)
- Uploading (progress bar)
- Uploaded (thumbnail + metadata)
- Error (retry button)

---

### 3.5 Core Pages (Phase 2)

| Page | Route | Purpose |
|------|-------|---------|
| Home Dashboard | `/home` | Quick overview, recent cases, notifications |
| Case Dashboard | `/case-dashboard` | Advanced case filtering and search |
| Payments | `/payments` | Payment list with status tracking |
| Payment Detail | `/payments/:id` | Payment breakdown and history |
| Invoices | `/invoices` | Invoice list and status |
| Invoice Detail | `/invoices/:id` | Invoice details and payment link |
| Notifications | `/notifications` | Notification feed and preferences |
| Profile | `/profile` | User info, avatar, contact details |
| Settings | `/settings` | App preferences, integrations, security |

---

## 4. Code Quality Standards

### 4.1 HTML/Template Standards

**File Organization:**
```
src/views/
├── layout.html (base template)
├── pages/
│   ├── vendor-dashboard.html
│   ├── case-detail.html
│   └── ...
└── partials/
    ├── header.html
    ├── footer.html
    ├── case-card.html
    ├── message-item.html
    └── ...
```

**Template Best Practices:**
- Use semantic HTML5 elements (`<header>`, `<nav>`, `<main>`, `<article>`)
- ARIA labels for accessibility (`aria-label`, `aria-live`)
- Nunjucks macros for reusable components
- Consistent indentation (2 spaces)
- Comments for complex sections

**Example Component Macro:**
```nunjucks
{% macro caseCard(case) %}
  <div class="case-card" data-case-id="{{ case.id }}">
    <h3 class="case-title">{{ case.title }}</h3>
    <span class="status-badge" data-status="{{ case.status }}">
      {{ case.status | upper }}
    </span>
    <!-- Rest of component -->
  </div>
{% endmacro %}
```

### 4.2 CSS Standards (Tailwind)

**Tailwind Usage:**
- Use utility classes for responsive design
- Avoid custom CSS except for animations/effects
- Consistent spacing scale (4px base)
- Semantic color tokens from design system

**File Structure:**
```
public/
├── globals.css (base styles, animations, utility classes)
├── components.css (component-specific overrides if needed)
└── vendor-theme.css (vendor-specific overrides)
```

**Responsive Breakpoints:**
```
Mobile: < 640px
Tablet: 640px - 1024px
Desktop: > 1024px

Use Tailwind prefixes: sm:, md:, lg:, xl:
```

**Example:**
```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- Items -->
</div>
```

### 4.3 JavaScript Standards

**File Organization:**
```
public/
├── js/
│   ├── components/ (reusable UI components)
│   │   ├── message-thread.js
│   │   ├── evidence-manager.js
│   │   └── case-filter.js
│   ├── utils/ (helpers)
│   │   ├── api.js (HTTP calls)
│   │   ├── date-utils.js (formatting)
│   │   └── validation.js
│   ├── app.js (main entry)
│   └── htmx-handlers.js (HTMX integration)
```

**Code Standards:**
- ES6+ syntax (const/let, arrow functions, destructuring)
- Consistent naming (camelCase for variables, PascalCase for classes)
- JSDoc comments for functions
- Error handling (try-catch, console.warn/error)
- No console logs in production (use logging service)

**HTMX Integration:**
- Use HTMX for dynamic content loading
- `hx-get` for reads, `hx-post` for writes
- `hx-swap` for placement (innerHTML, outerHTML, beforeend)
- Proper `hx-target` specification
- Loading/error indicators

**Example:**
```html
<div hx-get="/vendor/api/cases?page=2"
     hx-target="#case-list"
     hx-swap="beforeend"
     hx-trigger="click"
     hx-indicator="#spinner">
  Load More
</div>
```

### 4.4 Component Standards

**Reusable Component Checklist:**
- ✅ Single responsibility (one purpose per component)
- ✅ Props/parameters well-documented
- ✅ Error states handled
- ✅ Loading states implemented
- ✅ Accessible (ARIA labels, keyboard support)
- ✅ Mobile responsive
- ✅ Tested (at least manual QA)

**Component Template:**
```javascript
// src/utils/components.js
export class MessageThread {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = { pageSize: 20, ...options };
    this.currentPage = 1;
    this.isLoading = false;
    this.init();
  }

  /**
   * Initialize component and attach event listeners
   */
  init() {
    this.container.addEventListener('scroll', (e) => this.handleScroll(e));
    this.loadMessages(1);
  }

  /**
   * Load messages for a given page
   * @param {number} page - Page number
   */
  async loadMessages(page) {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const response = await fetch(`/api/messages?page=${page}`);
      const data = await response.json();
      this.render(data.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      this.showError('Could not load messages. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  handleScroll(e) {
    // Pagination logic
  }

  render(messages) {
    // Rendering logic
  }

  showError(message) {
    // Error UI
  }
}
```

### 4.5 Accessibility (A11y) Standards

**WCAG 2.1 Level AA Compliance:**
- ✅ Color contrast ratio ≥ 4.5:1 (AA)
- ✅ All interactive elements keyboard accessible
- ✅ ARIA labels for buttons, icons, regions
- ✅ Form labels associated with inputs
- ✅ Image alt text
- ✅ Semantic HTML (avoid `<div>` for buttons)
- ✅ Focus indicators visible
- ✅ Error messages descriptive

**Example:**
```html
<button 
  aria-label="Upload evidence for case {{ case.id }}"
  aria-busy="false"
  class="btn btn-primary">
  <svg aria-hidden="true"><!-- icon --></svg>
  Upload
</button>
```

### 4.6 Performance Standards

**Page Load Metrics (Target):**
- First Contentful Paint (FCP): < 1.5s
- Largest Contentful Paint (LCP): < 2.5s
- Cumulative Layout Shift (CLS): < 0.1

**Optimization Tactics:**
- Lazy load images (`loading="lazy"`)
- Minify CSS/JS in production
- Compress images (WebP where possible)
- Cache static assets (1 year)
- HTTP/2 push for critical resources
- Code split by page

**Bundle Size Targets:**
- HTML: < 50KB
- CSS (critical): < 15KB
- JS (critical): < 100KB
- Images: < 100KB per page

---

## 5. Definition of Done (DoD)

### Feature DoD

A feature is considered **DONE** when:

#### Code Quality ✅
- [ ] All code follows style guide (ESLint passes)
- [ ] No console errors/warnings in production
- [ ] JSDoc comments on all functions
- [ ] No hardcoded values (use constants/config)
- [ ] Error handling for all async operations
- [ ] No unused imports or variables

#### Functionality ✅
- [ ] All acceptance criteria met
- [ ] Happy path tested manually
- [ ] Edge cases handled (empty states, errors, loading)
- [ ] Form validation working
- [ ] API error responses handled gracefully

#### Responsiveness ✅
- [ ] Works on mobile (375px), tablet (768px), desktop (1024px+)
- [ ] No horizontal scroll at any breakpoint
- [ ] Touch targets ≥ 44x44px on mobile
- [ ] Readable font sizes (≥ 12px mobile, ≥ 14px desktop)

#### Accessibility ✅
- [ ] ARIA labels on all buttons/icons
- [ ] Form inputs have labels
- [ ] Focus indicators visible
- [ ] Color contrast ≥ 4.5:1
- [ ] Tab order logical
- [ ] Tested with keyboard navigation
- [ ] Alt text on images

#### Testing ✅
- [ ] Happy path tested manually
- [ ] Error states tested
- [ ] Browser compatibility verified (Chrome, Firefox, Safari, Edge)
- [ ] Mobile tested on actual device (if available)
- [ ] Lighthouse audit score ≥ 90

#### Performance ✅
- [ ] Lighthouse performance score ≥ 90
- [ ] No unused CSS/JS
- [ ] Images optimized
- [ ] No layout shifts (CLS)
- [ ] Loading states shown

#### Documentation ✅
- [ ] README updated if applicable
- [ ] API endpoints documented in code comments
- [ ] Component usage examples provided
- [ ] Breaking changes noted if any

#### Deployment ✅
- [ ] No console errors in QA/staging
- [ ] Tested with real data
- [ ] Database migrations applied (if applicable)
- [ ] Environment variables documented
- [ ] Rollback plan documented (if needed)

---

## 6. Design System Components

### Component Library (Phase 1 Priority)

Essential reusable components to build first:

| Component | Purpose | Files |
|-----------|---------|-------|
| **Button** | Primary, secondary, danger variants | `button.html` |
| **Input** | Text, email, password, search | `input.html` |
| **Select** | Dropdown selector | `select.html` |
| **Badge** | Status indicators | `badge.html` |
| **Card** | Container component | `card.html` |
| **Modal** | Dialog box | `modal.html` |
| **Toast** | Notification popup | `toast.html` |
| **Spinner** | Loading indicator | `spinner.html` |
| **Avatar** | User profile picture | `avatar.html` |
| **Table** | Data grid | `table.html` |

**Component Standards:**
- Consistent theming (colors, typography)
- Responsive sizing
- States (default, hover, active, disabled, loading, error)
- Accessibility features (ARIA, keyboard support)

---

## 7. Testing Strategy

### Unit Tests

**Files to Test:**
- `src/utils/date-utils.js` – Date formatting functions
- `src/utils/validation.js` – Form validation
- `src/utils/api.js` – API wrapper (mocked responses)

**Test Framework:** Vitest  
**Coverage Target:** 80%+

**Example:**
```javascript
// tests/utils/date-utils.test.js
import { describe, it, expect } from 'vitest';
import { formatDate, getRelativeTime } from '../../src/utils/date-utils.js';

describe('formatDate', () => {
  it('should format date as MM/DD/YYYY', () => {
    const date = new Date('2025-12-24');
    expect(formatDate(date)).toBe('12/24/2025');
  });
});
```

### E2E Tests (Playwright)

**Critical Paths to Test:**
1. Vendor login → Dashboard → Open case → View message
2. Upload evidence file → Verify in gallery
3. Post message → See in thread immediately
4. Filter cases by status → Verify list updates

**Test Structure:**
```javascript
// tests/e2e/vendor-workflow.spec.js
import { test, expect } from '@playwright/test';

test.describe('Vendor Workflow', () => {
  test('should load dashboard and open case', async ({ page }) => {
    await page.goto('/vendor/dashboard');
    expect(page).toHaveTitle(/Vendor Dashboard/);
    // More assertions...
  });
});
```

### Manual QA Checklist

**Before Each Release:**
- [ ] Vendor dashboard loads
- [ ] Cases display correctly
- [ ] Filtering works (status, date, search)
- [ ] Open case detail page
- [ ] Navigate between tabs smoothly
- [ ] Post a message
- [ ] Upload a file
- [ ] Verify on mobile (iOS Safari, Chrome Android)
- [ ] Check dark theme (no bright flashes)
- [ ] Test with slow network (simulate 3G)

---

## 8. Deployment & Launch

### Pre-Launch Checklist

**Technical:**
- [ ] All code reviewed and merged to main
- [ ] Tests passing (unit + E2E)
- [ ] Lighthouse scores ≥ 90
- [ ] Production build runs without errors
- [ ] Database migrations applied
- [ ] Environment variables set correctly
- [ ] Error logging configured (Sentry/LogRocket)

**Content:**
- [ ] Copy reviewed and approved
- [ ] Links tested (internal and external)
- [ ] Images optimized and responsive
- [ ] Fonts loading correctly

**User Communication:**
- [ ] Release notes prepared
- [ ] Help docs updated
- [ ] Support team briefed
- [ ] Rollback plan documented

### Monitoring Post-Launch

**Key Metrics to Watch:**
- Error rate (target: < 0.1%)
- Page load time (target: < 2s)
- User session count
- Feature adoption (event tracking)

**Tools:**
- Sentry (error tracking)
- Google Analytics (usage metrics)
- Lighthouse CI (performance regression)

---

## 9. Timeline & Phases

### Phase 1: Vendor MVP (Week 1-2)
**Priority Features:**
1. Vendor Dashboard (case list, filters)
2. Case Detail Page (overview, thread, evidence)
3. Basic components (button, input, badge, card)

**Deliverables:**
- Vendor dashboard responsive and functional
- Case detail page with all tabs working
- Messaging and evidence upload working
- Mobile-friendly

### Phase 2: Core Pages (Week 3-4)
**Features:**
1. Home dashboard
2. Payment/Invoice pages
3. Notifications
4. Advanced filtering

### Phase 3: Polish & Optimization (Week 5)
**Activities:**
1. Performance optimization
2. A/B testing (if applicable)
3. UX refinements based on feedback
4. Documentation updates

---

## 10. Success Criteria

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Feature Completion | 100% | All acceptance criteria met |
| Code Coverage | 80%+ | Vitest report |
| Performance Score | ≥ 90 | Lighthouse |
| Accessibility Score | ≥ 95 | axe DevTools |
| Mobile Usability | ✅ | Manual testing + Lighthouse |
| Zero Critical Bugs | 100% | Issues tracked to resolution |
| Load Time (FCP) | < 1.5s | Real User Monitoring |
| User Satisfaction | ≥ 4/5 | Survey (post-launch) |

---

## 11. Appendix

### A. Design Tokens

```css
/* Color Tokens */
--color-bg-primary: #060607;
--color-bg-secondary: #0a0a0b;
--color-bg-tertiary: rgba(255, 255, 255, 0.03);
--color-accent-green: hsl(155, 100%, 69%);
--color-text-primary: #ededed;
--color-text-secondary: rgba(237, 237, 237, 0.60);
--color-border: rgba(255, 255, 255, 0.08);

/* Spacing */
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
--spacing-2xl: 48px;

/* Typography */
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-size-body: 14px;
--font-size-body-lg: 16px;
--font-size-h3: 18px;
--font-size-h2: 24px;
--font-size-h1: 32px;

/* Shadows */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
```

### B. Component Sizes

```
Button: 40px (h) × 120px-240px (w)
Input: 40px (h) × 100% (w)
Avatar: 32px (small), 48px (medium), 64px (large)
Icon: 16px (small), 20px (medium), 24px (large)
Card: 100% width, 16px padding, 8px border-radius
```

### C. Animation Timing

```
Fast: 100ms (micro-interactions)
Normal: 200ms (standard transitions)
Slow: 300ms (complex animations)
Breathing: 4s (infinite, icons)
Easing: cubic-bezier(0.4, 0, 0.2, 1) (Material standard)
```

---

**Document Owner:** Frontend Lead  
**Last Updated:** December 24, 2025  
**Next Review:** Post-Phase 1 Launch
