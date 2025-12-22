# NexusCanon VMP: Integration Wireframe Plan v2.0

**Date:** 2025-12-22  
**Status:** 🎯 **Active Development Roadmap**  
**Purpose:** Comprehensive audit, design system governance, and sprint-based development plan  
**Reference:** `__nexus_canon_vmp_consolidated_final_paper.md` (White Paper SSOT)

---

## 📋 Executive Summary

This document provides:
1. **Complete Audit** - What's done, what's pending, what we could do but didn't
2. **Market Pain Points** - Known problems we haven't addressed yet
3. **User Delight Features** - UX improvements users will thank us for
4. **Design System Governance** - Rules for IDE auto-enrichment
5. **Sprint-Based Roadmap** - Actionable development plan

**Current State:**
- ✅ **Core Collaboration Spine:** 90% complete (Cases, Messages, Evidence, Checklist)
- ✅ **Shadow Ledger:** 100% complete (CSV Ingest, Multi-Company, Payments)
- ✅ **Onboarding:** 40% complete (Invite generation, Accept page, User creation)
- ⚠️ **Invoice Facade:** 60% complete (List/Detail exist, Matching Status partial)
- ⚠️ **Profile Management:** 70% complete (View/Edit contact, Bank change request)
- ❌ **AI Agent:** 0% complete (Not started)
- ❌ **Omnichannel Ports:** 25% complete (Portal only, no WhatsApp/Email bridges)
- ❌ **SOA Mapping:** 0% complete (Optional, not started)

---

## 🎨 Design Philosophy & UI Concepts

### Core Design Principles (Non-Negotiables)

#### 1. **"Deep Void" Aesthetic**
- **Philosophy:** Minimal, flat, no shadows, no bold weights
- **Visual Language:** Dark-first, high contrast, semantic colors
- **Typography:** Liter (300 weight) for body, Playfair Display for headings
- **Spacing:** 8px grid system (var(--vmp-space-*))

#### 2. **Evidence-First UI**
- **Principle:** A Case cannot progress without required evidence
- **UI Pattern:** Checklist-driven workflow, visual evidence status
- **Override Path:** Controlled "Waive" with justification + audit

#### 3. **Mobile-First, Desktop-Enhanced**
- **Priority:** Touch targets ≥44px, responsive stacking
- **Desktop:** Multi-pane layouts (Inbox + Detail + Thread)
- **Mobile:** Single-pane with navigation drawer

#### 4. **WhatsApp-Speed Communication**
- **Principle:** Threaded conversations feel instant
- **UI Pattern:** Chat-like interface, real-time updates (HTMX polling)
- **Feedback:** Typing indicators, read receipts (future)

#### 5. **Actionable Intelligence**
- **Principle:** Every status indicator has an action
- **UI Pattern:** Status pills → Click → Open Case / View Detail
- **Visual:** Color-coded status (PAID=green, PENDING=yellow, DISPUTED=red)

### VMP Design UI Concepts (IDE Governance)

#### Concept 1: **The "Posture Rail"**
**Purpose:** At-a-glance supplier health status

**Visual:**
```
┌─────────────────────────────────────┐
│ 🟢 READY  |  🟡 ACTION REQUIRED  |  🔴 BLOCKED │
│ 12 Cases  |  3 Cases              |  0 Cases  │
└─────────────────────────────────────┘
```

**Implementation:**
- **Location:** Top of supplier home page
- **Data:** Aggregated case status counts
- **Interaction:** Click → Filter inbox by status
- **Design Token:** `.vmp-posture-rail`, `.vmp-posture-ready`, `.vmp-posture-action`, `.vmp-posture-blocked`

**IDE Hint:**
```html
<!-- Use this pattern for supplier dashboard -->
<div class="vmp-posture-rail">
  <div class="vmp-posture-ready">...</div>
  <div class="vmp-posture-action">...</div>
  <div class="vmp-posture-blocked">...</div>
</div>
```

#### Concept 2: **The "Truth Panel"**
**Purpose:** Single source of truth for linked transactions

**Visual:**
```
┌─────────────────────────────────────┐
│ INVOICE INV-12345                   │
│ Status: PAID | Amount: $10,000      │
│ Linked: Case #456, Payment #789    │
│ Evidence: 3 files                   │
└─────────────────────────────────────┘
```

**Implementation:**
- **Location:** Right sidebar in case detail (desktop), expandable section (mobile)
- **Data:** Invoice/PO/GRN/Payment details, linked cases
- **Interaction:** Click invoice → Navigate to invoice detail
- **Design Token:** `.vmp-truth-panel`, `.vmp-truth-item`

**IDE Hint:**
```html
<!-- Use this pattern for transaction context -->
<aside class="vmp-truth-panel">
  <div class="vmp-truth-item">
    <div class="vmp-label-kicker">INVOICE</div>
    <div class="vmp-h3">INV-12345</div>
    <!-- Status, amount, links -->
  </div>
</aside>
```

#### Concept 3: **The "Escalation Zone"**
**Purpose:** Break-glass safety valve with audit trail

**Visual:**
```
┌─────────────────────────────────────┐
│ ⚠️ ESCALATION ZONE                  │
│ [Request Management Review]         │
│                                     │
│ (After click)                       │
│ 📞 John Smith (Director)            │
│ 📧 john@company.com                 │
│ 🔴 GLASS BROKEN - Logged            │
└─────────────────────────────────────┘
```

**Implementation:**
- **Location:** Bottom of case detail page
- **Interaction:** Click → Confirmation modal → Reveal contact → Audit log
- **Design Token:** `.vmp-escalation-zone`, `.vmp-break-glass`, `.vmp-emergency-contact`

**IDE Hint:**
```html
<!-- Use this pattern for escalation -->
<div class="vmp-escalation-zone">
  <button class="vmp-break-glass">Request Management Review</button>
  <!-- Revealed after break-glass -->
  <div class="vmp-emergency-contact">...</div>
</div>
```

#### Concept 4: **The "Status Pill"**
**Purpose:** Color-coded status indicators with semantic meaning

**Visual:**
```
[PAID] [MATCHED] [PENDING] [DISPUTED] [BLOCKED]
```

**Implementation:**
- **Design Token:** `.vmp-pill`, `.vmp-pill-paid`, `.vmp-pill-pending`, `.vmp-pill-disputed`
- **Accessibility:** ARIA labels, high contrast
- **Mobile:** Full-width on small screens, inline on desktop

**IDE Hint:**
```html
<!-- Use this pattern for status indicators -->
<span class="vmp-pill vmp-pill-paid">PAID</span>
<span class="vmp-pill vmp-pill-pending">PENDING</span>
```

#### Concept 5: **The "Action Button"**
**Purpose:** Primary actions with clear visual hierarchy

**Visual:**
```
┌─────────────────┐  ┌─────────────────┐
│  Open Case      │  │  Upload Evidence│
│  (Primary)      │  │  (Secondary)    │
└─────────────────┘  └─────────────────┘
```

**Implementation:**
- **Design Token:** `.vmp-action-button`, `.vmp-action-button-primary`
- **Touch Target:** ≥44px height, full-width on mobile
- **Feedback:** Loading state, success/error states

**IDE Hint:**
```html
<!-- Use this pattern for primary actions -->
<button class="vmp-action-button vmp-action-button-primary">
  Open Case
</button>
```

#### Concept 6: **The "Mode Switch" (Persona Toggle)**
**Purpose:** Adapts the interface for the user's current intent (Deep Work vs. Fast Action).

**Visual:**
```
[ Toggle: 📊 Reconciliation Mode (Desktop Default) | ⚡ Action Mode (Mobile Default) ]
```

**Implementation:**
- **Reconciliation Mode:** Dense tables, bulk actions, filters (Finance Persona)
- **Action Mode:** Card feeds, big buttons, chat-style thread (Sales Persona)
- **Logic:** Auto-detects by device, but allows manual toggle.

---

## 🎨 Design System Governance (IDE Auto-Enrichment)

### Foundation Layer (Data Presentation - Controlled)

**Rule:** Use semantic classes for data presentation ONLY.

**Typography:**
- `.vmp-h1` through `.vmp-h6` - Headings (data presentation)
- `.vmp-body` - Body text (data presentation)
- `.vmp-label` - Labels (data presentation)
- `.vmp-caption` - Captions (data presentation)

**Spacing:**
- `var(--vmp-space-0)` through `var(--vmp-space-16)` - 8px grid system

**Colors (Semantic):**
- `var(--vmp-text)` - Primary text color
- `var(--vmp-ok)` - Success/positive state
- `var(--vmp-warn)` - Warning/attention state
- `var(--vmp-danger)` - Error/blocked state

**Components:**
- `.vmp-table` - Data tables (data presentation)
- `.vmp-list` - Data lists (data presentation)

**IDE Auto-Enrichment:**
```html
<!-- IDE will suggest these classes for data presentation -->
<h1 class="vmp-h1">Invoice List</h1>
<p class="vmp-body">Total: $10,000</p>
<span class="vmp-label">Status</span>
```

### Design Layer (Marketing/Creative - Free Hand)

**Rule:** Use creative markers to exempt from Foundation rules.

**Creative Markers:**
- `.vmp-creative` - Creative content (Foundation rules exempt)
- `.vmp-marketing` - Marketing pages (Foundation rules exempt)
- `.vmp-free-form` - Free-form content (Foundation rules exempt)

**Visual Components:**
- `.vmp-btn`, `.vmp-card`, `.vmp-modal` - NO prescriptive templates
- Inline styles ALLOWED in creative/marketing content
- Custom CSS ALLOWED in creative/marketing content

**IDE Auto-Enrichment:**
```html
<!-- IDE will understand: Foundation rules do NOT apply -->
<div class="vmp-creative">
  <div style="background: linear-gradient(...);">
    <!-- Inline styles OK here -->
  </div>
</div>
```

### Component Hierarchy (IDE Discovery)

**Layout:**
- `.vmp-container` - Main container
- `.vmp-panel` - Content panel
- `.vmp-card` - Card container
- `.vmp-sidebar` - Sidebar container

**Forms:**
- `.vmp-input` - Text input
- `.vmp-textarea` - Textarea
- `.vmp-select` - Select dropdown
- `.vmp-checkbox` - Checkbox
- `.vmp-radio` - Radio button

**Actions:**
- `.vmp-btn` - Base button
- `.vmp-btn-primary` - Primary button
- `.vmp-btn-danger` - Danger button
- `.vmp-btn-ghost` - Ghost button

**Feedback:**
- `.vmp-badge` - Status badge
- `.vmp-alert` - Alert message
- `.vmp-spinner` - Loading spinner
- `.vmp-skeleton` - Loading skeleton
- `.vmp-empty` - Empty state

**Overlays:**
- `.vmp-modal` - Modal dialog
- `.vmp-dropdown` - Dropdown menu

**Governance Rule:**
- **Mobile Parity Rule:** "Action Mode" (Mobile) must support **Status Checking** and **Evidence Upload** for every transaction type. It does *not* need to support Bulk Actions or CSV Exports.

**IDE Auto-Enrichment:**
```html
<!-- IDE will suggest component classes -->
<div class="vmp-container">
  <div class="vmp-panel">
    <button class="vmp-btn vmp-btn-primary">Submit</button>
  </div>
</div>
```

---

## 📊 Complete Audit: What's Done, Pending, Could Do, Good to Have

### ✅ **COMPLETED (Production-Ready)**

#### VMP-03: Collaboration Spine (90% Complete)
- ✅ **Case Inbox** (`/partials/case-inbox.html`) - Triage tabs, search, filter
- ✅ **Case Detail** (`/partials/case-detail.html`) - Shell with HTMX partials
- ✅ **Case Thread** (`/partials/case-thread.html`) - WhatsApp-speed conversation
- ✅ **Case Checklist** (`/partials/case-checklist.html`) - Evidence requirements
- ✅ **Case Evidence** (`/partials/case-evidence.html`) - Upload, versioning, audit
- ✅ **Escalation** (`/partials/escalation.html`) - Break-glass protocol
- ✅ **Routes:** All case routes standardized with `requireAuth`, `validateUUIDParam`
- ✅ **Adapter:** Complete case CRUD, message creation, evidence upload

**Gaps:**
- ⚠️ **SLA Reminders** - Field exists, no reminder system
- ⚠️ **Decision Log** - Partial exists, not fully integrated
- ⚠️ **Direct Route** - `/cases/:id` route missing (only partials exist)

#### VMP-05: Evidence Exchange (100% Complete)
- ✅ **Upload** - File upload with Supabase Storage
- ✅ **Tagging** - Evidence linked to cases and checklist steps
- ✅ **Versioning** - File version tracking
- ✅ **Access Control** - Permission-scoped evidence
- ✅ **Audit Log** - Immutable audit trail

#### Shadow Ledger (100% Complete)
- ✅ **Multi-Company Schema** - `vmp_groups`, `vmp_companies`, `vmp_vendor_company_links`
- ✅ **Invoice Ingest** - CSV parsing with flexible column mapping
- ✅ **Payment Ingest** - CSV parsing with invoice lookup
- ✅ **Remittance Drop** - PDF upload with fuzzy matching
- ✅ **Routes:** All ingest routes standardized with `requireInternal`

#### Onboarding (40% Complete)
- ✅ **Invite Generation** (`POST /ops/invites`) - Secure token generation
- ✅ **Accept Invite Page** (`GET /accept`) - Public page with validation
- ✅ **Account Creation** (`POST /accept`) - Atomic user creation + onboarding case
- ✅ **Onboarding Case** - Auto-created with checklist steps

**Gaps:**
- ⚠️ **Conditional Checklist** - No branching by vendor type/country
- ⚠️ **Verification Workflow** - No procurement/AP review UI
- ⚠️ **Approval & Activation** - No approval workflow

#### Profile Management (70% Complete)
- ✅ **Profile View** (`GET /profile`) - Vendor master data display
- ✅ **Contact Update** (`POST /profile/contact`) - Direct edit (address, phone, website)
- ✅ **Bank Details Change** (`POST /profile/bank-details`) - Change request case workflow
- ✅ **Schema** - All profile fields in `vmp_vendors`

**Gaps:**
- ⚠️ **Compliance Docs** - Partial exists, not fully functional
- ⚠️ **Contract Library** - Partial exists, not fully functional

#### Command Center (80% Complete)
- ✅ **Ops Dashboard** (`GET /ops/dashboard`) - Scoped metrics (Action Items, Financials, Onboarding)
- ✅ **Org Tree Sidebar** (`GET /partials/org-tree-sidebar.html`) - Hierarchical navigation
- ✅ **Data Ingest UI** (`GET /ops/ingest`) - CSV upload forms
- ✅ **Vendor Directory** (`GET /ops/vendors`) - Vendor list with filters

**Gaps:**
- ⚠️ **Scoped Dashboard Partial** - Exists but needs enhancement
- ⚠️ **Data History** - Partial exists, not fully functional

#### Infrastructure (100% Complete)
- ✅ **Session Store** - PostgreSQL-backed sessions (`connect-pg-simple`)
- ✅ **Route Standardization** - All 75 routes standardized
- ✅ **Error Handling** - Consistent error handling with `logError()`
- ✅ **Authentication** - Session-based auth with `requireAuth()`, `requireInternal()`
- ✅ **Input Validation** - UUID validation, required field validation

---

### ⏳ **PENDING (In Progress / Partially Complete)**

#### VMP-04: Invoice Transparency (60% Complete)
- ✅ **Invoice List** (`GET /invoices`, `/partials/invoice-list.html`) - Status pills, search, filter
- ✅ **Invoice Detail** (`GET /invoices/:id`, `/partials/invoice-detail.html`) - Full invoice view
- ✅ **Open Case** (`POST /invoices/:id/open-case`) - Auto-link invoice to case
- ⚠️ **Matching Status** (`/partials/matching-status.html`) - Partial exists, needs enhancement
- ❌ **3-Way Match Visualization** - PO/GRN/Invoice matching not visualized
- ❌ **Exception Workflow** - Exception → Action → Evidence linkage incomplete

**What's Missing:**
1. **Matching Status Enhancement:**
   - Visual 3-way match diagram (PO ✅, GRN ⚠️, Invoice ✅)
   - Mismatch highlighting (amount, date, quantity)
   - Action buttons (Request GRN, Dispute Amount)

2. **Exception Workflow:**
   - Exception reason selection (Missing GRN, Amount Mismatch, etc.)
   - Auto-create case with pre-filled exception details
   - Link exception to evidence requirements

#### VMP-06: Payment Visibility (50% Complete)
- ✅ **Payment List** (`GET /payments`, `/partials/payment-list.html`) - Payment history
- ✅ **Payment Detail** (`GET /payments/:id`, `/partials/payment-detail.html`) - Payment details
- ✅ **Remittance Viewer** (`/partials/remittance-viewer.html`) - PDF viewer
- ⚠️ **Payment Status Integration** - Invoice status updates on payment ingest
- ❌ **Payment History Timeline** - No chronological payment history
- ❌ **Payment Notifications** - No "Payment Received" notifications

**What's Missing:**
1. **Payment History Timeline:**
   - Chronological list of all payments
   - Filter by date range, amount, status
   - Export to CSV

2. **Payment Notifications:**
   - Email/SMS notification on payment
   - In-app notification badge
   - Payment receipt download

---

### 💡 **COULD DO (Market Pain Points We Know But Haven't Addressed)**

#### 1. **Supplier Anxiety: "Who is handling this?"**
**Pain Point:** Suppliers don't know who to contact or what's happening.

**Solution:**
- **Case Owner Visibility:** Show assigned AP Manager name/photo in case detail
- **Activity Feed:** Real-time activity log ("John verified evidence", "Case reassigned to Finance")
- **Estimated Resolution Time:** "Expected resolution: 2 business days"
- **Status Explanations:** "Waiting for GRN from warehouse" instead of just "Waiting"

**Implementation:**
- Add `assigned_to_user` display in case detail
- Create activity feed partial (`/partials/case-activity.html`)
- Add SLA calculation and display
- Enhance status messages with context

**Sprint:** Sprint 8 (User Delight Features)

#### 2. **"I Sent It Already" Problem**
**Pain Point:** Suppliers claim they sent documents, but AP can't find them.

**Solution:**
- **Upload Receipt:** "Document uploaded on Dec 22, 2025 at 2:30 PM"
- **Email-to-Case:** Suppliers can reply to notification emails, attachments auto-attach to case
- **WhatsApp Bridge:** Suppliers can send documents via WhatsApp, auto-create case
- **Document Search:** AP can search all evidence by filename, date, type

**Implementation:**
- Add upload timestamp and receipt in evidence list
- Implement email-to-case parser (email port)
- Implement WhatsApp webhook (WhatsApp port)
- Add evidence search functionality

**Sprint:** Sprint 9 (Omnichannel Ports)

#### 3. **"Why Not Paid?" Problem**
**Pain Point:** Suppliers see "PENDING" but don't know why payment is delayed.

**Solution:**
- **Payment Status Explanation:** "Payment scheduled for Jan 15, 2025" or "Blocked: Missing tax certificate"
- **Payment Timeline:** Visual timeline showing invoice → approval → payment run → remittance
- **Blocking Issues:** Clear list of blocking issues with action buttons
- **Payment Forecast:** "Expected payment date: Jan 15, 2025"

**Implementation:**
- Add payment status explanation field
- Create payment timeline visualization
- Link blocking cases to payment status
- Add payment forecast calculation

**Sprint:** Sprint 7 (Payment Visibility Enhancement)

#### 4. **"What Do I Need to Upload?" Problem**
**Pain Point:** Suppliers don't know what documents are required.

**Solution:**
- **Smart Checklist:** Context-aware checklist (e.g., "Bank Letter" only for bank change cases)
- **Document Templates:** "Download template: Bank Letter Format"
- **Upload Guidance:** "Upload a clear photo of your bank statement"
- **Progress Indicator:** "2 of 3 documents uploaded"

**Implementation:**
- Enhance checklist with conditional logic
- Add document template downloads
- Add upload guidance tooltips
- Add progress indicator component

**Sprint:** Sprint 8 (User Delight Features)

#### 5. **"I Need to Talk to Someone" Problem**
**Pain Point:** Suppliers want human contact but don't know who to call.

**Solution:**
- **Live Chat:** Real-time chat with AP team (future: AI agent first, human handoff)
- **Contact Card:** "Your AP Manager: John Smith (john@company.com)"
- **Escalation Path:** Clear escalation hierarchy (AI → AP Manager → Director)
- **Response Time Promise:** "We respond within 2 hours during business hours"

**Implementation:**
- Add live chat widget (future)
- Display assigned AP Manager contact in case detail
- Enhance escalation zone with contact information
- Add response time SLA display

**Sprint:** Sprint 8 (User Delight Features)

---

### 🌟 **GOOD TO HAVE (User Delight Features)**

#### 1. **Keyboard Shortcuts**
**Feature:** Power users can navigate with keyboard.

**Implementation:**
- `Cmd/Ctrl+K` - Command palette (search cases, invoices, actions)
- `Cmd/Ctrl+N` - New case
- `Cmd/Ctrl+/` - Show keyboard shortcuts
- `Esc` - Close modals, clear search

**Sprint:** Sprint 10 (Power User Features)

#### 2. **Dark Mode Toggle**
**Feature:** Users can switch between light and dark themes.

**Implementation:**
- Theme toggle in user menu
- Persist preference in user profile
- Smooth transition animation

**Sprint:** Sprint 10 (Power User Features)

#### 3. **Bulk Actions**
**Feature:** Select multiple invoices/cases and perform bulk actions.

**Implementation:**
- Checkbox selection in list views
- Bulk actions menu (Approve, Reject, Export)
- Progress indicator for bulk operations

**Sprint:** Sprint 11 (Efficiency Features)

#### 4. **Export to PDF/Excel**
**Feature:** Export invoice lists, payment history, case reports.

**Implementation:**
- Export button in list views
- PDF generation for reports
- Excel export for data analysis

**Sprint:** Sprint 11 (Efficiency Features)

#### 5. **Mobile App (PWA)**
**Feature:** Installable Progressive Web App for mobile.

**Implementation:**
- Service worker for offline support
- App manifest for install prompt
- Push notifications for case updates

**Sprint:** Sprint 12 (The Sales Rep Experience - Action Mode)

#### 6. **AI-Powered Search**
**Feature:** Natural language search ("Show me unpaid invoices from last month").

**Implementation:**
- AI search endpoint
- Natural language parsing
- Context-aware results

**Sprint:** Sprint 13 (AI Features)

---

## 🚀 Sprint-Based Development Plan

### **Sprint 7: Invoice & Payment Polish (2 weeks)**
**Goal:** Complete Invoice Transparency and Payment Visibility modules

#### Task 7.1: Matching Status Enhancement
- [ ] Visual 3-way match diagram component
- [ ] Mismatch highlighting (amount, date, quantity)
- [ ] Action buttons (Request GRN, Dispute Amount)
- [ ] Route: `GET /partials/matching-status.html?invoice_id=...`

#### Task 7.2: Exception Workflow
- [ ] Exception reason selection UI
- [ ] Auto-create case with pre-filled exception details
- [ ] Link exception to evidence requirements
- [ ] Route: `POST /invoices/:id/report-exception`

#### Task 7.3: Payment History Timeline
- [ ] Chronological payment history view
- [ ] Filter by date range, amount, status
- [ ] Export to CSV functionality
- [ ] Route: `GET /payments/history`

#### Task 7.4: Payment Notifications
- [ ] Email notification on payment
- [ ] In-app notification badge
- [ ] Payment receipt download
- [ ] Route: `GET /payments/:id/receipt`

**Deliverables:**
- Complete invoice matching visualization
- Exception workflow end-to-end
- Payment history with filters
- Payment notifications system

---

### **Sprint 8: User Delight Features (2 weeks)**
**Goal:** Address supplier anxiety and improve UX

#### Task 8.1: Case Owner Visibility
- [ ] Display assigned AP Manager in case detail
- [ ] Activity feed component (`/partials/case-activity.html`)
- [ ] SLA calculation and display
- [ ] Enhanced status messages with context

#### Task 8.2: Upload Receipt & Guidance
- [ ] Upload timestamp and receipt in evidence list
- [ ] Document template downloads
- [ ] Upload guidance tooltips
- [ ] Progress indicator component

#### Task 8.3: Payment Status Explanation
- [ ] Payment status explanation field
- [ ] Payment timeline visualization
- [ ] Link blocking cases to payment status
- [ ] Payment forecast calculation

#### Task 8.4: Contact & Escalation Enhancement
- [ ] Display assigned AP Manager contact in case detail
- [ ] Enhance escalation zone with contact information
- [ ] Response time SLA display
- [ ] "Contact AP Manager" button

**Deliverables:**
- Case owner visibility
- Upload guidance system
- Payment status explanations
- Enhanced contact information

---

### **Sprint 9: Omnichannel Ports (3 weeks)**
**Goal:** Bridge WhatsApp and Email to VMP

#### Task 9.1: Email-to-Case Parser
- [ ] Email webhook endpoint (`POST /ports/email`)
- [ ] Parse email attachments
- [ ] Auto-create case from email
- [ ] Link email thread to case

#### Task 9.2: WhatsApp Bridge
- [ ] WhatsApp webhook endpoint (`POST /ports/whatsapp`)
- [ ] Parse WhatsApp messages and media
- [ ] Auto-create case from WhatsApp
- [ ] Link WhatsApp thread to case

#### Task 9.3: Port Configuration UI
- [ ] Port settings page (`GET /ops/ports`)
- [ ] Webhook URL configuration
- [ ] Port enable/disable toggles
- [ ] Port activity log

**Deliverables:**
- Email-to-case functionality
- WhatsApp bridge
- Port configuration UI

---

### **Sprint 10: Power User Features (2 weeks)**
**Goal:** Keyboard shortcuts and productivity features

#### Task 10.1: Command Palette
- [ ] Command palette component (`Cmd/Ctrl+K`)
- [ ] Search cases, invoices, actions
- [ ] Keyboard navigation
- [ ] Action execution from palette

#### Task 10.2: Keyboard Shortcuts
- [ ] `Cmd/Ctrl+N` - New case
- [ ] `Cmd/Ctrl+/` - Show shortcuts
- [ ] `Esc` - Close modals
- [ ] Shortcuts help modal

#### Task 10.3: Dark Mode Toggle
- [ ] Theme toggle in user menu
- [ ] Persist preference in user profile
- [ ] Smooth transition animation
- [ ] Update design tokens for light mode

**Deliverables:**
- Command palette
- Keyboard shortcuts system
- Dark/light mode toggle

---

### **Sprint 11: Efficiency Features (2 weeks)**
**Goal:** Bulk actions and export functionality

#### Task 11.1: Bulk Actions
- [ ] Checkbox selection in list views
- [ ] Bulk actions menu (Approve, Reject, Export)
- [ ] Progress indicator for bulk operations
- [ ] Bulk action confirmation modal

#### Task 11.2: Export to PDF/Excel
- [ ] PDF generation for reports
- [ ] Excel export for data analysis
- [ ] Export button in list views
- [ ] Custom export fields selection

**Deliverables:**
- Bulk actions system
- PDF/Excel export functionality

---

### **Sprint 12: The Sales Rep Experience (Action Mode) (2 weeks)**
**Goal:** Dedicated mobile interface for Sales Rep persona

#### Task 12.1: Action Mode UI (The Card Feed)
- [ ] **Split View Implementation:** Separate HTML structures for Table vs. Card Feed (not just CSS hiding).
- [ ] **Invoice Cards:** "Instagram-style" feed for invoices (Status + Amount + Big Actions).
- [ ] **Quick Actions:** One-tap "Snap Evidence" and "Chat" buttons on cards.
- [ ] **Infinite Scroll:** Replace pagination with scroll-to-load for feeds.

#### Task 12.2: PWA Setup
- [ ] Service worker for offline support
- [ ] App manifest for install prompt
- [ ] Offline fallback pages
- [ ] Cache strategy implementation

#### Task 12.3: Mobile Push & Polish
- [ ] Push notification registration
- [ ] Touch target size optimization (≥44px)
- [ ] Mobile navigation drawer
- [ ] Swipe gestures for actions

**Deliverables:**
- Dedicated Action Mode UI
- Installable PWA
- Push notifications

---

### **Sprint 13: AI Features (3 weeks)**
**Goal:** AI AP Enforcer implementation

#### Task 13.1: AI Message Parser
- [ ] Parse incoming messages (WhatsApp/email)
- [ ] Classify message intent
- [ ] Attach to correct case
- [ ] Extract invoice numbers, PO references

#### Task 13.2: AI Data Validation
- [ ] Validate minimum data integrity
- [ ] Check required document presence
- [ ] Respond with actionable requests
- [ ] Escalate to human when threshold met

#### Task 13.3: AI Search
- [ ] Natural language search endpoint
- [ ] Context-aware results
- [ ] Search across cases, invoices, payments
- [ ] AI-powered suggestions

**Deliverables:**
- AI message parser
- AI data validation
- AI-powered search

---

## 📐 Design System Implementation Checklist

### Foundation Layer (Data Presentation)

- [x] Typography scale (`.vmp-h1` through `.vmp-h6`, `.vmp-body`, `.vmp-label`)
- [x] Spacing scale (`var(--vmp-space-*)`)
- [x] Semantic colors (`var(--vmp-text)`, `var(--vmp-ok)`, `var(--vmp-warn)`, `var(--vmp-danger)`)
- [x] Data components (`.vmp-table`, `.vmp-list`)
- [ ] **TODO:** Add `.vmp-posture-rail` component
- [ ] **TODO:** Add `.vmp-truth-panel` component
- [ ] **TODO:** Add `.vmp-escalation-zone` component
- [ ] **TODO:** Add `.vmp-pill` variants (`.vmp-pill-paid`, `.vmp-pill-pending`, etc.)
- [ ] **TODO:** Add `.vmp-action-button` variants

### Design Layer (Marketing/Creative)

- [x] Creative markers (`.vmp-creative`, `.vmp-marketing`, `.vmp-free-form`)
- [x] Visual components (`.vmp-btn`, `.vmp-card`, `.vmp-modal`)
- [ ] **TODO:** Add toast/notification system (`.vmp-toast`, `.vmp-toast-success`, etc.)
- [ ] **TODO:** Add command palette (`.vmp-command-palette`)
- [ ] **TODO:** Add skeleton loading (`.vmp-skeleton`)

### Component Library

- [x] Layout components (`.vmp-container`, `.vmp-panel`, `.vmp-card`, `.vmp-sidebar`)
- [x] Form components (`.vmp-input`, `.vmp-textarea`, `.vmp-select`, `.vmp-checkbox`, `.vmp-radio`)
- [x] Action components (`.vmp-btn`, `.vmp-btn-primary`, `.vmp-btn-danger`, `.vmp-btn-ghost`)
- [x] Feedback components (`.vmp-badge`, `.vmp-alert`, `.vmp-spinner`, `.vmp-empty`)
- [x] Overlay components (`.vmp-modal`, `.vmp-dropdown`)
- [ ] **TODO:** Add progress indicator (`.vmp-progress`)
- [ ] **TODO:** Add timeline component (`.vmp-timeline`)
- [ ] **TODO:** Add activity feed (`.vmp-activity-feed`)

---

## 🎯 Success Metrics

### User Satisfaction
- **Supplier Satisfaction Score:** Target >4.5/5
- **Time-to-Answer:** Target <2 hours
- **Case Resolution Time:** Target <48 hours

### Adoption Metrics
- **Active Suppliers:** Target 80% of invited suppliers
- **Payment Visibility Usage:** Target 60% of suppliers check payment status weekly
- **Case Creation Rate:** Target 5 cases per supplier per month

### Technical Metrics
- **Page Load Time:** Target <350ms (current: 716KB bundle)
- **Mobile Performance:** Target 90+ Lighthouse score
- **Error Rate:** Target <0.1% of requests

---

## 📚 IDE Auto-Enrichment Guidelines

### Pattern Recognition

**When IDE sees:**
```html
<div class="vmp-container">
  <h1>Invoice List</h1>
```

**IDE should suggest:**
```html
<div class="vmp-container">
  <h1 class="vmp-h1">Invoice List</h1>
```

**When IDE sees:**
```html
<button>Submit</button>
```

**IDE should suggest:**
```html
<button class="vmp-action-button vmp-action-button-primary">Submit</button>
```

**When IDE sees:**
```html
<span>PAID</span>
```

**IDE should suggest:**
```html
<span class="vmp-pill vmp-pill-paid">PAID</span>
```

### Component Suggestions

**When creating a new page:**
- Suggest extending `layout.html`
- Suggest using `.vmp-container` for main content
- Suggest using `.vmp-panel` for content sections

**When creating a new partial:**
- Suggest using standalone structure (no `{% extends %}`)
- Suggest using `.vmp-panel` for container
- Suggest including loading and empty states

**When creating a form:**
- Suggest using `.vmp-input`, `.vmp-textarea`, `.vmp-select`
- Suggest using `.vmp-action-button` for submit
- Suggest including validation error display

### Design Token Discovery

**IDE should provide autocomplete for:**
- `var(--vmp-*` - All design tokens
- `.vmp-*` - All component classes
- `vmp-*` - All utility classes

**IDE should warn when:**
- Inline styles used in data presentation (without `.vmp-creative` marker)
- Foundation classes used incorrectly (e.g., `.vmp-h1` in marketing content)
- Missing accessibility attributes (e.g., `aria-label` on buttons)

---

## 🏁 Conclusion

This integration wireframe plan provides:
1. ✅ **Complete Audit** - What's done, pending, could do, good to have
2. ✅ **Market Pain Points** - Known problems with solutions
3. ✅ **User Delight Features** - UX improvements users will thank us for
4. ✅ **Design System Governance** - Rules for IDE auto-enrichment
5. ✅ **Sprint-Based Roadmap** - 7 sprints, actionable tasks

**Next Steps:**
1. Review and approve sprint priorities
2. Begin Sprint 7 (Invoice & Payment Polish)
3. Update design system with missing components
4. Implement IDE auto-enrichment patterns

---

**Document Status:** ✅ **Active Development Roadmap**  
**Last Updated:** 2025-12-22  
**Version:** v2.0.0  
**Next Review:** After Sprint 7 completion

