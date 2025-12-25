# VMP Integration Wireframe & Consolidation Plan

**Date:** 2025-12-22  
**Status:** Planning Document  
**Purpose:** Lock experiments, define production architecture, create integration graph

---

## 📊 Current State Analysis

### Experimental Pages Inventory

#### **Home Pages (5 variants)**
1. **`/home`** (home.html) — **BASIC SHELL** — Original split-view shell
   - Status: ✅ Functional, basic implementation
   - Use: Foundation, simple split-view
   - Decision: **KEEP AS FALLBACK** or **ARCHIVE**

2. **`/home2`** (home2.html) — **NEURAL CONSOLE**
   - Status: ⚠️ Experimental
   - Use: Alternative console design
   - Decision: **ARCHIVE** (not production target)

3. **`/home3`** (home3.html) — **OPTIMIZED CONSOLE**
   - Status: ✅ Enhanced with performance optimizations
   - Features: Debounced search, memoization, ARIA, keyboard shortcuts
   - Use: Performance-optimized version
   - Decision: **EVALUATE** (may have useful optimizations)

4. **`/home4`** (home4.html) — **UNIFIED COMMAND SURFACE**
   - Status: ⚠️ Experimental tri-pane layout
   - Use: Beastmode visuals + Operational workflow
   - Decision: **ARCHIVE** (superseded by home5)

5. **`/home5`** (home5.html) — **MERGED UNIFIED CONSOLE v7** ⭐ **PRODUCTION TARGET**
   - Status: ✅ Current production target
   - Features: Tri-pane layout, Control Plane HUD, Posture Rail, HTMX integration
   - Use: **PRIMARY PRODUCTION PAGE**
   - Decision: **LOCK AS PRODUCTION**

#### **Login Pages (4 variants)**
1. **`/login`** (login.html) — **BASIC LOGIN**
   - Status: ✅ Functional, working
   - Use: Simple login form
   - Decision: **KEEP AS FALLBACK** or **ARCHIVE**

2. **`/login2`** (login2.html) — **EXPERIMENTAL**
   - Status: ⚠️ Experimental
   - Decision: **ARCHIVE**

3. **`/login3`** (login3.html) — **NOIR + ENTERPRISE** ⭐ **PRODUCTION TARGET**
   - Status: ✅ Enhanced login with NOIR aesthetic
   - Features: Interactive status, ritual rows, launch ticker
   - Use: **PRIMARY PRODUCTION LOGIN**
   - Decision: **LOCK AS PRODUCTION**

4. **`/login4`** (login4.html) — **EXPERIMENTAL**
   - Status: ⚠️ Experimental
   - Decision: **ARCHIVE**

#### **Other Pages**
- **`/dashboard`** (dashboard.html) — Tactical Governance Surface
  - Status: ⚠️ Experimental
  - Decision: **ARCHIVE** (functionality merged into home5)

- **`/landing`** (landing.html) — Public landing page
  - Status: ✅ Functional
  - Decision: **KEEP** (public page)

- **`/error`** (error.html) — Error page
  - Status: ✅ Functional
  - Decision: **KEEP**

---

## 🎯 Production Architecture Decision

### **LOCKED PRODUCTION PAGES**

| Route | File | Purpose | Status |
|-------|------|---------|--------|
| `/login` | `login3.html` | Primary login | ✅ **LOCKED** |
| `/home` | `home5.html` | Primary console | ✅ **LOCKED** |
| `/` | `landing.html` | Public landing | ✅ **LOCKED** |
| `/error` | `error.html` | Error handling | ✅ **LOCKED** |

### **ARCHIVE/REMOVE (Experimental)**

| Route | File | Action |
|-------|------|--------|
| `/home2` | `home2.html` | Archive to `.archive/` |
| `/home3` | `home3.html` | Extract optimizations → archive |
| `/home4` | `home4.html` | Archive |
| `/login2` | `login2.html` | Archive |
| `/login4` | `login4.html` | Archive |
| `/dashboard` | `dashboard.html` | Archive |

### **EVALUATE (May Have Value)**

| Route | File | Action |
|-------|------|--------|
| `/home` (basic) | `home.html` | Keep as fallback or archive |
| `/login` (basic) | `login.html` | Keep as fallback or archive |

---

## 🗺️ System Architecture Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEXUSCANON VMP ARCHITECTURE                  │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   CLIENT     │
│  (Browser)   │
└──────┬───────┘
       │
       │ HTTP/HTTPS
       │
┌──────▼──────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER (server.js)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Middleware Layer                                         │  │
│  │  - Auth (Session Lookup)                                 │  │
│  │  - Timeout (30s)                                         │  │
│  │  - Rate Limiting                                         │  │
│  │  - Security (Helmet, CSP)                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Route Handlers                                         │  │
│  │                                                          │  │
│  │  GET  /login          → login3.html                      │  │
│  │  POST /login          → Auth → Redirect                 │  │
│  │  GET  /home           → home5.html                       │  │
│  │  GET  /partials/*     → HTMX Partials                   │  │
│  │  POST /cases/:id/*    → Action Handlers                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Template Engine (Nunjucks)                             │  │
│  │  - Pages: pages/*.html                                   │  │
│  │  - Partials: partials/*.html                             │  │
│  │  - Layout: layout.html                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────┬──────────────────────────────────────────────────────────┘
       │
       │ vmpAdapter calls
       │
┌──────▼──────────────────────────────────────────────────────────┐
│              ADAPTER LAYER (src/adapters/supabase.js)            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Auth Methods                                            │  │
│  │  - getUserByEmail()                                      │  │
│  │  - verifyPassword()                                       │  │
│  │  - createSession() / getSession()                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Case Methods                                           │  │
│  │  - getInbox()                                            │  │
│  │  - getCaseDetail()                                       │  │
│  │  - updateCaseStatus()                                    │  │
│  │  - reassignCase()                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Message Methods                                         │  │
│  │  - getMessages()                                         │  │
│  │  - createMessage()                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Evidence Methods                                       │  │
│  │  - getEvidence()                                         │  │
│  │  - uploadEvidence()                                      │  │
│  │  - uploadEvidenceToStorage()                            │  │
│  │  - getEvidenceSignedUrl()                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Checklist Methods                                       │  │
│  │  - getChecklistSteps()                                   │  │
│  │  - ensureChecklistSteps()                                │  │
│  │  - verifyEvidence() / rejectEvidence()                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Notification Methods                                   │  │
│  │  - createNotification()                                  │  │
│  │  - notifyVendorUsersForCase()                           │  │
│  │  - getUserNotifications()                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Escalation Methods                                      │  │
│  │  - escalateCase()                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Status Transition Logic                                │  │
│  │  - updateCaseStatusFromEvidence()                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────┬──────────────────────────────────────────────────────────┘
       │
       │ Supabase Client
       │
┌──────▼──────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL + Storage)               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Tables                                                  │  │
│  │  - vmp_tenants, vmp_companies, vmp_vendors              │  │
│  │  - vmp_vendor_users, vmp_sessions                       │  │
│  │  - vmp_cases, vmp_messages, vmp_evidence               │  │
│  │  - vmp_checklist_steps, vmp_notifications              │  │
│  │  - vmp_invites                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Storage Bucket                                          │  │
│  │  - vmp-evidence (file storage)                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Page Flow & User Journey Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER JOURNEY FLOW                             │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │   PUBLIC    │
                    │   LANDING   │
                    │     (/)     │
                    └──────┬──────┘
                           │
                           │ Click "Login"
                           │
                    ┌──────▼──────┐
                    │    LOGIN    │
                    │  (login3)   │
                    └──────┬──────┘
                           │
                           │ POST /login
                           │ (Auth Success)
                           │
                    ┌──────▼──────┐
                    │    HOME     │
                    │  (home5)    │
                    │             │
                    │  ┌────────┐ │
                    │  │ INBOX  │ │
                    │  │ CELL   │ │
                    │  └────┬───┘ │
                    │       │     │
                    │       │ Click Case
                    │       │     │
                    │  ┌────▼───┐ │
                    │  │ DETAIL │ │
                    │  │ SHELL  │ │
                    │  └────┬───┘ │
                    │       │     │
                    │       │ HTMX Loads:
                    │       │ - Thread
                    │       │ - Checklist
                    │       │ - Evidence
                    │       │ - Escalation
                    └───────┼──────┘
                            │
                            │ Actions:
                            │ - Post Message
                            │ - Upload Evidence
                            │ - Escalate
                            │ - Verify/Reject (internal)
                            │
                            │ All via HTMX swaps
                            │
                    ┌───────▼──────┐
                    │   REFRESHED  │
                    │   PARTIALS   │
                    └──────────────┘
```

---

## 🧩 Component Integration Map

```
┌─────────────────────────────────────────────────────────────────┐
│              HTMX PARTIAL INTEGRATION GRAPH                       │
└─────────────────────────────────────────────────────────────────┘

HOME5 (home5.html)
│
├─► GET /partials/case-inbox.html
│   └─► case_inbox.html
│       └─► Click Case Row
│           └─► hx-get="/partials/case-detail.html?case_id=..."
│
└─► GET /partials/case-detail.html?case_id=...
    └─► case_detail.html (Shell)
        │
        ├─► GET /partials/case-thread.html?case_id=...
        │   └─► case_thread.html
        │       └─► POST /cases/:id/messages
        │           └─► Returns refreshed case_thread.html
        │
        ├─► GET /partials/case-checklist.html?case_id=...
        │   └─► case_checklist.html
        │       ├─► POST /cases/:id/verify-evidence (internal)
        │       │   └─► Returns refreshed case_checklist.html
        │       └─► POST /cases/:id/reject-evidence (internal)
        │           └─► Returns refreshed case_checklist.html
        │
        ├─► GET /partials/case-evidence.html?case_id=...
        │   └─► case_evidence.html
        │       └─► POST /cases/:id/evidence (file upload)
        │           └─► Returns refreshed case_evidence.html
        │
        └─► GET /partials/escalation.html?case_id=...
            └─► escalation.html
                └─► POST /cases/:id/escalate
                    └─► Returns refreshed escalation.html
```

---

## 📐 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA FLOW ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────┘

USER ACTION
    │
    ├─► POST /cases/:id/messages
    │   │
    │   ├─► vmpAdapter.createMessage()
    │   │   └─► INSERT vmp_messages
    │   │
    │   └─► vmpAdapter.getMessages()
    │       └─► SELECT vmp_messages
    │           └─► Render case_thread.html
    │
    ├─► POST /cases/:id/evidence
    │   │
    │   ├─► multer (file handling)
    │   ├─► vmpAdapter.uploadEvidenceToStorage()
    │   │   └─► Supabase Storage
    │   ├─► vmpAdapter.uploadEvidence()
    │   │   └─► INSERT vmp_evidence
    │   ├─► UPDATE vmp_checklist_steps (status = 'submitted')
    │   ├─► updateCaseStatusFromEvidence()
    │   │   └─► UPDATE vmp_cases (status = 'waiting_internal')
    │   └─► Render case_evidence.html + case_checklist.html
    │
    ├─► POST /cases/:id/verify-evidence
    │   │
    │   ├─► vmpAdapter.verifyEvidence()
    │   │   └─► UPDATE vmp_checklist_steps (status = 'verified')
    │   ├─► updateCaseStatusFromEvidence()
    │   │   └─► UPDATE vmp_cases (status = 'resolved' if all verified)
    │   ├─► notifyVendorUsersForCase()
    │   │   └─► INSERT vmp_notifications
    │   └─► Render case_checklist.html
    │
    └─► POST /cases/:id/escalate
        │
        ├─► vmpAdapter.escalateCase()
        │   ├─► UPDATE vmp_cases (escalation_level, owner_team, status)
        │   └─► INSERT vmp_messages (escalation audit)
        └─► Render escalation.html
```

---

## 🎨 Design System Integration

```
┌─────────────────────────────────────────────────────────────────┐
│              DESIGN SYSTEM ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────┘

public/globals.css (SSOT)
    │
    ├─► VMP Semantic Classes
    │   ├─► Typography: .vmp-h1, .vmp-h2, .vmp-h3, .vmp-body, .vmp-label
    │   ├─► Signals: .vmp-signal-ok, .vmp-signal-warn, .vmp-signal-danger
    │   ├─► Fills: .vmp-fill-ok, .vmp-fill-warn, .vmp-fill-danger
    │   ├─► Borders: .vmp-border-color, .vmp-border-warn, .vmp-border-ok
    │   ├─► Backgrounds: .vmp-bg-panel, .vmp-bg-veil
    │   └─► Actions: .vmp-action-button, .vmp-action-button-primary
    │
    └─► Layout Classes
        ├─► .vmp-container
        ├─► .vmp-panel
        ├─► .vmp-empty
        └─► .vmp-login__bg, .noir-grid-overlay

All Templates
    │
    ├─► pages/*.html
    │   └─► {% extends "layout.html" %}
    │
    └─► partials/*.html
        └─► Standalone HTMX fragments
            └─► Use VMP classes only
            └─► No inline styles
            └─► No custom CSS
```

---

## 🔒 Consolidation Plan ✅ **COMPLETED** (2025-12-22)

### Phase 1: Route Consolidation ✅ **COMPLETED**

**Actions Completed:**
1. ✅ Updated `/home` route to use `home5.html` (with rollback env var `VMP_HOME_PAGE`)
2. ✅ Updated `/login` route to use `login3.html` (with rollback env var `VMP_LOGIN_PAGE`)
3. ✅ Removed/archived experimental routes:
   - ✅ `/home2` → Redirects to `/home`
   - ✅ `/home3` → Redirects to `/home` (optimizations extracted)
   - ✅ `/home4` → Redirects to `/home`
   - ✅ `/login2` → Redirects to `/login`
   - ✅ `/login4` → Redirects to `/login`
   - ✅ `/dashboard` → Redirects to `/home`
   - ✅ `/home5` → Redirects to `/home` (canonical)
   - ✅ `/login3` → Redirects to `/login` (canonical)

**Files Modified:**
- ✅ `server.js` (route handlers updated, rollback env vars added)

---

### Phase 2: File Organization ✅ **COMPLETED**

**Archive Structure Created:**
```
src/views/
  ├─ pages/
  │   ├─ home5.html          ✅ PRODUCTION (locked)
  │   ├─ login3.html         ✅ PRODUCTION (locked)
  │   ├─ landing.html        ✅ PRODUCTION
  │   ├─ error.html          ✅ PRODUCTION
  │   ├─ home.html           ⚠️ KEPT (fallback via rollback)
  │   ├─ login.html          ⚠️ KEPT (fallback via rollback)
  │   └─ .archive/
  │       ├─ home2.html      📦 ARCHIVED
  │       ├─ home3.html      📦 ARCHIVED (optimizations extracted)
  │       ├─ home4.html      📦 ARCHIVED
  │       ├─ login2.html     📦 ARCHIVED
  │       ├─ login4.html     📦 ARCHIVED
  │       └─ dashboard.html 📦 ARCHIVED
```

**Note:** `home.html` and `login.html` kept as fallback options (can be activated via `VMP_HOME_PAGE` and `VMP_LOGIN_PAGE` env vars)

---

### Phase 3: Extract Valuable Features ✅ **COMPLETED**

**From home3.html (merged into home5.html):**
- ✅ Debounced search input (300ms) — **IMPLEMENTED** via HTMX `hx-trigger="keyup changed delay:300ms"`
- ✅ ARIA accessibility improvements — **IMPLEMENTED** (`aria-label` on search input)
- ✅ Keyboard shortcuts (Cmd/Ctrl+K) — **IMPLEMENTED** (`initKeyboardShortcuts()` function)
- ✅ Esc key to close detail panel — **IMPLEMENTED**

**Note:** Memoization and lookup maps not needed (server-rendered, no client-side computation)

---

### Phase 4: Update Documentation ✅ **COMPLETED**

**Documentation Updated:**
- ✅ `.dev/dev-note/VMP 21Sprint.md` — Updated with consolidation status
- ✅ `.dev/dev-note/ARCHIVED_PAGES.md` — Created with archive documentation
- ✅ `.dev/dev-note/INTEGRATION_WIREFRAME_PLAN.md` — This document (finalized)
- ✅ `.dev/dev-note/CONSOLIDATION_EXECUTION_PLAN.md` — Execution plan documented

**Remaining:**
- ⚠️ Test files need updating (reference old routes, should test redirects)
- ⚠️ `README.md` — Should be updated with production routes (if exists)

---

## 📋 Implementation Checklist ✅ **COMPLETED**

### Pre-Consolidation ✅
- [x] Review all experimental pages for valuable features
- [x] Document any unique functionality to preserve
- [x] Backup experimental pages to `.archive/`

### Consolidation ✅
- [x] Update `/home` route to use `home5.html`
- [x] Update `/login` route to use `login3.html`
- [x] Extract optimizations from `home3.html` → `home5.html`
- [x] Move experimental pages to `.archive/`
- [x] Remove experimental routes from `server.js` (redirects added)
- [x] Update redirects (canonical redirects implemented)
- [x] Add rollback mechanism (env vars `VMP_HOME_PAGE`, `VMP_LOGIN_PAGE`)

### Post-Consolidation ✅
- [x] Update documentation
- [x] Production routes locked
- [x] HTMX partials verified (no changes needed)
- [x] Check for broken links/references
- [x] Archive documentation created

### Remaining Dev Debt ⚠️
- [ ] Update test files to test redirects instead of old routes
- [ ] Update `README.md` with production routes (if exists)
- [ ] Consider archiving `home.html` and `login.html` (currently kept as fallback)

---

## 🎯 Final Production Architecture

### **Locked Routes**

```
PUBLIC:
  GET  /              → landing.html
  GET  /login         → login3.html
  POST /login         → Auth → Redirect to /home
  POST /logout        → Clear session → Redirect to /login

AUTHENTICATED:
  GET  /home          → home5.html (Unified Console)
  GET  /partials/case-inbox.html
  GET  /partials/case-detail.html
  GET  /partials/case-thread.html
  GET  /partials/case-checklist.html
  GET  /partials/case-evidence.html
  GET  /partials/escalation.html

ACTIONS:
  POST /cases/:id/messages
  POST /cases/:id/evidence
  POST /cases/:id/escalate
  POST /cases/:id/verify-evidence (internal)
  POST /cases/:id/reject-evidence (internal)
  POST /cases/:id/reassign (internal)
  POST /cases/:id/update-status (internal)
```

---

## 📊 Integration Graph Summary

**Key Integration Points:**
1. **HTMX** → Server-rendered partials (no client-side data fetching)
2. **Alpine.js** → Local UI state only (filters, drawers, tabs)
3. **Nunjucks** → Template rendering (SSOT for HTML structure)
4. **VMP Design System** → `globals.css` (SSOT for styling)
5. **Supabase Adapter** → Single data access layer
6. **Express Routes** → Route-first architecture

**Data Flow:**
- User Action → HTMX Request → Express Route → Adapter Method → Supabase → Response → HTMX Swap

**Component Hierarchy:**
- Page (home5.html) → Shell (case_detail.html) → Cells (thread, checklist, evidence, escalation)

---

## ✅ Consolidation Status: **COMPLETE** (2025-12-22)

### Completed Actions
1. ✅ **Production targets confirmed** — `home5.html` and `login3.html` locked
2. ✅ **Consolidation executed** — Experiments archived, production locked
3. ✅ **Optimizations extracted** — home3 features merged into home5
4. ✅ **Routes updated** — `/home` and `/login` point to production pages
5. ✅ **Integration verified** — HTMX partials working correctly
6. ✅ **Documentation finalized** — All docs updated

### Remaining Cleanup Tasks
1. ⚠️ **Test files** — Update to test redirects (not old routes)
2. ⚠️ **README.md** — Update with production architecture (if exists)
3. ⚠️ **Optional** — Archive `home.html` and `login.html` (currently kept as fallback)

---

## 🎯 Final Production State

**Canonical Routes (Locked):**
- `GET /` → `landing.html`
- `GET /login` → `login3.html` (rollback: `VMP_LOGIN_PAGE` env var)
- `GET /home` → `home5.html` (rollback: `VMP_HOME_PAGE` env var)
- `GET /error` → `error.html`

**Redirects (All experimental routes redirect to canonical):**
- `/home2`, `/home3`, `/home4`, `/home5` → `/home`
- `/login2`, `/login3`, `/login4` → `/login`
- `/dashboard` → `/home`

**Rollback Mechanism:**
- Set `VMP_HOME_PAGE=home` to use basic home page
- Set `VMP_LOGIN_PAGE=login` to use basic login page
- Restart server to apply changes

**Production Architecture: LOCKED ✅**

