# Wireframe Blueprint vs Implementation Audit

**Date:** 2025-01-XX  
**Status:** 📊 Gap Analysis Complete  
**Blueprint:** `.dev/dev-note/aha_wireframe_blueprint_nexus_canon_vmp (1).md`  
**Implementation:** `server.js` + `src/views/`

---

## Executive Summary

This document compares the AHA Wireframe Blueprint against the actual implementation to identify:
- ✅ **Implemented** features
- ⚠️ **Partially implemented** features
- ❌ **Missing** features
- 🔄 **Divergences** from blueprint

**Key Finding:** Core collaboration spine (cases, messages, evidence) is **fully implemented**. Invoice facade, payments, profile, and onboarding routes are **missing**.

---

## 1. Information Architecture Comparison

### Supplier Portal Routes

| Route | Blueprint | Implementation | Status |
|-------|-----------|---------------|--------|
| `/accept` | ✅ Invite Accept + Account Setup | ❌ Not implemented | **MISSING** |
| `/login` | ✅ Login | ✅ Implemented (`login3.html`) | **COMPLETE** |
| `/home` | ✅ Supplier Home (Posture + Case Inbox) | ✅ Implemented (`home5.html`) | **COMPLETE** |
| `/cases/:id` | ✅ Case Detail (Thread + Checklist + Evidence) | ⚠️ Partial (no direct route, only partials) | **PARTIAL** |
| `/invoices` | ✅ Invoice List (read-only facade) | ❌ Not implemented | **MISSING** |
| `/invoices/:id` | ✅ Invoice Detail (3-way status + attach evidence) | ❌ Not implemented | **MISSING** |
| `/payments` | ✅ Payment History + Remittance | ❌ Not implemented | **MISSING** |
| `/profile` | ✅ Vendor profile (docs/bank change is gated) | ❌ Not implemented | **MISSING** |

### Internal Console Routes

| Route | Blueprint | Implementation | Status |
|-------|-----------|---------------|--------|
| `/ops/cases` | ✅ Case Queue (Procurement/AP triage) | ❌ Not implemented | **MISSING** |
| `/ops/cases/:id` | ✅ Case Detail (same cells, different permissions) | ⚠️ Uses same partials, no dedicated route | **PARTIAL** |
| `/ops/vendors` | ✅ Vendor directory + onboarding status | ❌ Not implemented | **MISSING** |

---

## 2. Route → Cell Map Comparison

### Full Pages (Layout + Shell)

| Endpoint | Blueprint | Implementation | Status |
|----------|-----------|---------------|--------|
| `GET /login` | ✅ | ✅ `app.get('/login')` → `login3.html` | **COMPLETE** |
| `GET /accept?token=...` | ✅ | ❌ Not implemented | **MISSING** |
| `GET /home` | ✅ | ✅ `app.get('/home')` → `home5.html` | **COMPLETE** |
| `GET /cases/:id` | ✅ | ❌ Not implemented (only partials) | **MISSING** |
| `GET /invoices` | ✅ | ❌ Not implemented | **MISSING** |
| `GET /invoices/:id` | ✅ | ❌ Not implemented | **MISSING** |

### Partials (Cells) - Collaboration Spine

| Endpoint | Blueprint | Implementation | Status |
|----------|-----------|---------------|--------|
| `GET /partials/case-inbox` | ✅ VMP-03-01 Case Inbox Cell | ✅ `app.get('/partials/case-inbox.html')` → `case_inbox.html` | **COMPLETE** |
| `GET /partials/case-row?case_id=...` | ✅ Single row refresh | ❌ Not implemented | **MISSING** |
| `GET /partials/case-detail?case_id=...` | ✅ Case Detail Shell Cell | ✅ `app.get('/partials/case-detail.html')` → `case_detail.html` | **COMPLETE** |
| `GET /partials/case-thread?case_id=...` | ✅ VMP-03-02 Thread Cell | ✅ `app.get('/partials/case-thread.html')` → `case_thread.html` | **COMPLETE** |
| `GET /partials/case-checklist?case_id=...` | ✅ VMP-03-03 Checklist Cell | ✅ `app.get('/partials/case-checklist.html')` → `case_checklist.html` | **COMPLETE** |
| `GET /partials/case-evidence?case_id=...` | ✅ VMP-05 Evidence List Cell | ✅ `app.get('/partials/case-evidence.html')` → `case_evidence.html` | **COMPLETE** |
| `GET /partials/case-actions?case_id=...` | ✅ Quick actions (upload, escalate) | ⚠️ Actions embedded in `case_detail.html`, no separate partial | **PARTIAL** |

### Evidence Actions

| Endpoint | Blueprint | Implementation | Status |
|----------|-----------|---------------|--------|
| `POST /cases/:id/messages` | ✅ Append message; returns refreshed Thread Cell | ✅ `app.post('/cases/:id/messages')` → returns `case_thread.html` | **COMPLETE** |
| `POST /cases/:id/evidence` | ✅ Upload; returns refreshed Checklist + Evidence | ✅ `app.post('/cases/:id/evidence')` → returns `case_evidence.html` | **COMPLETE** |

### Invoice Facade Partials

| Endpoint | Blueprint | Implementation | Status |
|----------|-----------|---------------|--------|
| `GET /partials/invoice-list` | ✅ VMP-04-01 | ❌ Not implemented | **MISSING** |
| `GET /partials/invoice-detail?invoice_id=...` | ✅ VMP-04-02 | ❌ Not implemented | **MISSING** |
| `GET /partials/matching-status?invoice_id=...` | ✅ VMP-04-03 (adapter-backed) | ❌ Not implemented | **MISSING** |
| `POST /invoices/:id/open-case` | ✅ Create/attach Case; returns redirect/fragment | ❌ Not implemented | **MISSING** |

### Safety Valve

| Endpoint | Blueprint | Implementation | Status |
|----------|-----------|---------------|--------|
| `GET /partials/escalation` | ✅ Escalation Cell | ✅ `app.get('/partials/escalation.html')` → `escalation.html` | **COMPLETE** |
| `POST /cases/:id/escalate` | ✅ Sets escalation status; returns updated escalation panel | ❌ Not implemented | **MISSING** |

### Internal Operations (Not in Blueprint, but Implemented)

| Endpoint | Blueprint | Implementation | Status |
|----------|-----------|---------------|--------|
| `POST /cases/:id/verify-evidence` | ❌ Not in blueprint | ✅ Implemented (RBAC: internal only) | **EXTRA** |
| `POST /cases/:id/reject-evidence` | ❌ Not in blueprint | ✅ Implemented (RBAC: internal only) | **EXTRA** |
| `POST /cases/:id/reassign` | ❌ Not in blueprint | ✅ Implemented (RBAC: internal only) | **EXTRA** |
| `POST /cases/:id/update-status` | ❌ Not in blueprint | ✅ Implemented (RBAC: internal only) | **EXTRA** |

---

## 3. Wireframe Layout System Comparison

### Global Shell (Page Layout)

| Component | Blueprint | Implementation | Status |
|-----------|-----------|---------------|--------|
| **Left Rail** | ✅ Brand sigil + tenant/company context + Primary nav | ⚠️ No left rail in `home5.html` (header-based navigation) | **DIVERGENT** |
| **Command Surface** | ✅ Top: "The Connection · The Law" strip (posture + counts) | ✅ Implemented in `home5.html` (lines 79-86) | **COMPLETE** |
| **Main Split** | ✅ Left: Case Inbox / Lists, Right: Case Detail panel | ✅ Implemented in `home5.html` (split-view layout) | **COMPLETE** |
| **Posture Pill** | ✅ ENFORCING / WARNING / BLOCK | ✅ Implemented in `home5.html` (lines 90-100) | **COMPLETE** |
| **Escalation Cell** | ✅ Always visible (Level 1/2/3) | ⚠️ Implemented but not always visible (loaded on demand) | **PARTIAL** |

---

## 4. Screen Wireframes Comparison

### 4.1 Accept Invite (/accept)

| Feature | Blueprint | Implementation | Status |
|---------|-----------|---------------|--------|
| Verify invite token | ✅ | ❌ Not implemented | **MISSING** |
| Set password / MFA | ✅ | ❌ Not implemented | **MISSING** |
| Supplier profile essentials | ✅ | ❌ Not implemented | **MISSING** |
| Required docs checklist | ✅ | ❌ Not implemented | **MISSING** |
| Submit → land on /home | ✅ | ❌ Not implemented | **MISSING** |

**Status:** ❌ **COMPLETELY MISSING**

### 4.2 Login (/login)

| Feature | Blueprint | Implementation | Status |
|---------|-----------|---------------|--------|
| Email + password | ✅ | ✅ Implemented in `login3.html` | **COMPLETE** |
| Optional OTP | ✅ | ⚠️ UI exists but not functional | **PARTIAL** |
| "Need help?" link opens escalation info | ✅ | ✅ Implemented (help modals) | **COMPLETE** |

**Status:** ✅ **MOSTLY COMPLETE** (OTP not functional)

### 4.3 Supplier Home (/home)

| Feature | Blueprint | Implementation | Status |
|---------|-----------|---------------|--------|
| Top strip ("The Law") | ✅ Evidence Chain: VALID / WARN / BLOCK | ✅ Implemented (lines 90-100) | **COMPLETE** |
| Open Cases count | ✅ | ✅ Implemented (metrics in `renderHomePage`) | **COMPLETE** |
| Items waiting supplier | ✅ | ✅ Implemented (actionCount metric) | **COMPLETE** |
| Left column: Case Inbox | ✅ Tabs: Action Required / Waiting / Resolved | ✅ Implemented (HTMX-loaded) | **COMPLETE** |
| Case row details | ✅ Case type + subject, Status pill, SLA due, Last message snippet | ✅ Implemented in `case_inbox.html` | **COMPLETE** |
| Right column: Case Detail (empty state) | ✅ "Select a case to view thread & checklist." | ✅ Implemented (empty state in `case_detail.html`) | **COMPLETE** |
| Bottom: Escalation Cell | ✅ Level 1 AI agent, Level 2 AP manager, Level 3 Break-glass | ✅ Implemented in `escalation.html` | **COMPLETE** |
| HTMX behavior | ✅ Inbox loads on page load, Clicking row loads Case Detail | ✅ Implemented | **COMPLETE** |

**Status:** ✅ **FULLY COMPLETE**

### 4.4 Case Detail (/cases/:id)

| Feature | Blueprint | Implementation | Status |
|---------|-----------|---------------|--------|
| Header | ✅ Case title, Status + owner team, SLA timer | ✅ Implemented in `case_detail.html` | **COMPLETE** |
| Two-column interior | ✅ Left: Checklist + Evidence, Right: Thread | ✅ Implemented in `case_detail.html` | **COMPLETE** |
| Actions bar | ✅ Upload evidence, Mark resolved, Escalate | ⚠️ Upload + internal actions exist, escalate missing | **PARTIAL** |
| HTMX behavior | ✅ Posting message refreshes thread only | ✅ Implemented | **COMPLETE** |
| HTMX behavior | ✅ Upload refreshes checklist+evidence only | ✅ Implemented | **COMPLETE** |

**Status:** ⚠️ **MOSTLY COMPLETE** (missing direct `/cases/:id` route, escalate action)

### 4.5 Invoices (/invoices)

| Feature | Blueprint | Implementation | Status |
|---------|-----------|---------------|--------|
| Invoice list | ✅ invoice no, date, amount | ❌ Not implemented | **MISSING** |
| Matching state pill | ✅ READY / WARN / BLOCK | ❌ Not implemented | **MISSING** |
| CTA: "Open Case" | ✅ (if blocked/warn) | ❌ Not implemented | **MISSING** |
| HTMX behavior | ✅ List loads on page load | ❌ Not implemented | **MISSING** |

**Status:** ❌ **COMPLETELY MISSING**

### 4.6 Invoice Detail (/invoices/:id)

| Feature | Blueprint | Implementation | Status |
|---------|-----------|---------------|--------|
| Matching Status (PO/GRN/Invoice) | ✅ | ❌ Not implemented | **MISSING** |
| Exceptions list (reason → action) | ✅ | ❌ Not implemented | **MISSING** |
| "Attach missing evidence" action | ✅ | ❌ Not implemented | **MISSING** |

**Status:** ❌ **COMPLETELY MISSING**

### 4.7 Payments (/payments)

| Feature | Blueprint | Implementation | Status |
|---------|-----------|---------------|--------|
| List | ✅ paid date, amount, ref | ❌ Not implemented | **MISSING** |
| Remittance link | ✅ | ❌ Not implemented | **MISSING** |

**Status:** ❌ **COMPLETELY MISSING**

---

## 5. HTMX Interaction Blueprint Comparison

| Interaction | Blueprint | Implementation | Status |
|------------|-----------|---------------|--------|
| Home loads inbox | ✅ `hx-get="/partials/case-inbox" hx-trigger="load"` | ✅ Implemented in `home5.html` | **COMPLETE** |
| Selecting a case loads detail | ✅ `hx-get="/partials/case-detail?case_id=..."` | ✅ Implemented in `case_inbox.html` | **COMPLETE** |
| Message send updates thread only | ✅ `hx-target="#caseThread" hx-swap="innerHTML"` | ✅ Implemented in `case_thread.html` | **COMPLETE** |
| Upload updates checklist + evidence | ✅ Upload returns combined partial | ✅ Implemented (returns `case_evidence.html`) | **COMPLETE** |
| Polling (optional) | ✅ `hx-trigger="every 20s"` for inbox row refresh | ❌ Not implemented | **MISSING** |

**Status:** ✅ **MOSTLY COMPLETE** (polling missing)

---

## 6. Alpine Usage Comparison

| Usage | Blueprint | Implementation | Status |
|-------|-----------|---------------|--------|
| Tabs (Action Required / Waiting / Resolved) | ✅ Use Alpine | ⚠️ Not implemented (filtering via HTMX) | **DIVERGENT** |
| Drawer open/close (mobile) | ✅ Use Alpine | ❌ Not implemented | **MISSING** |
| Filter dropdown open/close | ✅ Use Alpine | ✅ Implemented in `home5.html` (Alpine state) | **COMPLETE** |
| Business rules | ❌ Do NOT use Alpine | ✅ Server-side only | **COMPLETE** |
| Permission checks | ❌ Do NOT use Alpine | ✅ Server-side only | **COMPLETE** |

**Status:** ⚠️ **PARTIALLY COMPLETE** (tabs not using Alpine, drawer missing)

---

## 7. File/Template Structure Comparison

### Blueprint Structure
```
apps/vmp/
  server/
    app.ts
    routes/
      pages.ts
      partials.ts
      actions.ts
    views/
      layout.html
      pages/
        login.html
        accept.html
        home.html
        invoices.html
        invoice_detail.html
        case_page.html
        payments.html
      partials/
        case_inbox.html
        case_detail.html
        case_thread.html
        case_checklist.html
        case_evidence.html
        matching_status.html
        escalation.html
```

### Actual Structure
```
AIBOS-VMP/
  server.js                    # ✅ All routes in single file (not split)
  src/
    views/
      layout.html              # ✅ Exists
      pages/
        login3.html            # ✅ Exists (not login.html)
        home5.html             # ✅ Exists (not home.html)
        landing.html           # ✅ Extra (not in blueprint)
        error.html             # ✅ Extra (not in blueprint)
      partials/
        case_inbox.html        # ✅ Exists
        case_detail.html       # ✅ Exists
        case_thread.html       # ✅ Exists
        case_checklist.html    # ✅ Exists
        case_evidence.html     # ✅ Exists
        escalation.html        # ✅ Exists
        # Missing:
        # - matching_status.html
        # - case_row.html (single row refresh)
        # - case_actions.html
        # Extra:
        # - login-help-*.html (10 files)
        # - file_upload_dropzone.html
        # - avatar-component.html
        # - oauth-github-button.html
        # - supabase-ui-examples.html
```

**Status:** ⚠️ **DIVERGENT** (routes not split, missing invoice/payment templates, extra login/test templates)

---

## 8. Wireframe Component Inventory Comparison

### Shell Components

| Component | Blueprint | Implementation | Status |
|-----------|-----------|---------------|--------|
| Surface | ✅ | ✅ VMP design system classes | **COMPLETE** |
| Panel | ✅ | ✅ `.vmp-panel` class | **COMPLETE** |
| Rail (metrics) | ✅ | ⚠️ Not implemented (no left rail) | **MISSING** |
| Pill (status) | ✅ | ✅ Status pills in `case_inbox.html` | **COMPLETE** |

### Case Components

| Component | Blueprint | Implementation | Status |
|-----------|-----------|---------------|--------|
| CaseRow | ✅ | ✅ Implemented in `case_inbox.html` | **COMPLETE** |
| CaseHeader | ✅ | ✅ Implemented in `case_detail.html` | **COMPLETE** |
| Thread | ✅ | ✅ Implemented in `case_thread.html` | **COMPLETE** |
| Composer | ✅ | ✅ Implemented in `case_thread.html` | **COMPLETE** |
| Checklist | ✅ | ✅ Implemented in `case_checklist.html` | **COMPLETE** |
| EvidenceList | ✅ | ✅ Implemented in `case_evidence.html` | **COMPLETE** |
| Upload | ✅ | ✅ Implemented in `case_evidence.html` | **COMPLETE** |
| Escalation | ✅ | ✅ Implemented in `escalation.html` | **COMPLETE** |

### Invoice Components

| Component | Blueprint | Implementation | Status |
|-----------|-----------|---------------|--------|
| InvoiceRow | ✅ | ❌ Not implemented | **MISSING** |
| MatchingStatus | ✅ | ❌ Not implemented | **MISSING** |
| ExceptionList | ✅ | ❌ Not implemented | **MISSING** |

---

## 9. Activation Toggles Comparison

| Toggle | Blueprint | Implementation | Status |
|--------|-----------|---------------|--------|
| `FEATURE_INVOICES` | ✅ (on/off) | ❌ Not implemented | **MISSING** |
| `FEATURE_PAYMENTS` | ✅ (on/off) | ❌ Not implemented | **MISSING** |
| `FEATURE_SOA` | ✅ (on/off) | ❌ Not implemented | **MISSING** |
| `FEATURE_WHATSAPP_PORT` | ✅ (on/off pilot) | ❌ Not implemented | **MISSING** |

**Status:** ❌ **COMPLETELY MISSING**

---

## 10. Next Deliverables Comparison

### Blueprint Deliverables

| Deliverable | Blueprint | Implementation | Status |
|-------------|-----------|---------------|--------|
| AHA HTML Wireframes Pack | ✅ /login, /accept, /home, /partials/case-inbox, /partials/case-detail, /partials/case-thread, /partials/case-checklist, /partials/escalation | ✅ Most implemented (missing /accept) | **MOSTLY COMPLETE** |
| Ports/Adapters contracts | ✅ Invoice list + invoice detail + matching status | ❌ Not implemented | **MISSING** |
| Case schema (minimal) + seed data | ✅ | ✅ Implemented (migrations + seed script) | **COMPLETE** |

---

## Summary Statistics

### Implementation Coverage

| Category | Complete | Partial | Missing | Total |
|----------|----------|---------|---------|-------|
| **Supplier Portal Routes** | 2 | 1 | 5 | 8 |
| **Internal Console Routes** | 0 | 1 | 2 | 3 |
| **Full Pages** | 2 | 0 | 4 | 6 |
| **Collaboration Spine Partials** | 5 | 2 | 1 | 8 |
| **Invoice Facade Partials** | 0 | 0 | 4 | 4 |
| **Safety Valve** | 1 | 0 | 1 | 2 |
| **Screen Wireframes** | 2 | 2 | 4 | 8 |
| **HTMX Interactions** | 4 | 0 | 1 | 5 |
| **Alpine Usage** | 2 | 1 | 1 | 4 |
| **Components** | 10 | 0 | 4 | 14 |

### Overall Completion Rate

- **Core Collaboration Spine:** ✅ **~90% Complete** (cases, messages, evidence, checklist)
- **Invoice Facade:** ❌ **0% Complete** (completely missing)
- **Payments:** ❌ **0% Complete** (completely missing)
- **Onboarding:** ❌ **0% Complete** (completely missing)
- **Internal Ops:** ⚠️ **~30% Complete** (partials exist, dedicated routes missing)

---

## Critical Gaps & Recommendations

### 🔴 High Priority (MVP Blockers)

1. **Missing `/cases/:id` Direct Route**
   - **Impact:** Users cannot deep-link to cases
   - **Recommendation:** Add `app.get('/cases/:id', ...)` route that renders full page with case detail

2. **Missing Invoice Facade**
   - **Impact:** Core feature missing (read-only invoice transparency)
   - **Recommendation:** Implement `/invoices` and `/invoices/:id` routes with matching partials

3. **Missing Escalate Action**
   - **Impact:** Safety valve incomplete
   - **Recommendation:** Implement `POST /cases/:id/escalate` endpoint

### 🟡 Medium Priority (Feature Completeness)

4. **Missing Onboarding Flow (`/accept`)**
   - **Impact:** Cannot onboard new vendors
   - **Recommendation:** Implement invite accept flow (Phase 2 per PRD)

5. **Missing Payments Page**
   - **Impact:** Adoption carrot missing
   - **Recommendation:** Implement `/payments` route (read-only facade)

6. **Missing Profile Page**
   - **Impact:** Vendor self-service incomplete
   - **Recommendation:** Implement `/profile` route with gated updates

7. **Missing Internal Ops Routes**
   - **Impact:** Internal users cannot access dedicated ops views
   - **Recommendation:** Implement `/ops/cases` and `/ops/vendors` routes

### 🟢 Low Priority (Polish)

8. **Missing Case Row Refresh**
   - **Impact:** Cannot refresh single row without full inbox reload
   - **Recommendation:** Implement `GET /partials/case-row?case_id=...`

9. **Missing Polling**
   - **Impact:** No auto-refresh for inbox
   - **Recommendation:** Add `hx-trigger="every 20s"` to inbox (optional per blueprint)

10. **Missing Activation Toggles**
    - **Impact:** Cannot feature-flag modules
    - **Recommendation:** Add environment-based feature toggles

---

## Alignment Assessment

### ✅ **Well Aligned**

- Core collaboration spine (cases, messages, evidence, checklist)
- HTMX interaction patterns
- Server-side authority (no business logic in Alpine)
- Design system compliance (VMP classes)

### ⚠️ **Partially Aligned**

- File structure (routes not split, extra templates)
- Alpine usage (tabs not using Alpine, drawer missing)
- Layout (no left rail, header-based navigation)

### ❌ **Not Aligned**

- Invoice facade (completely missing)
- Payments (completely missing)
- Onboarding (`/accept` route missing)
- Internal ops routes (missing dedicated routes)
- Feature toggles (not implemented)

---

## Next Steps

1. **Immediate:** Add `/cases/:id` direct route for deep-linking
2. **Phase 1:** Implement invoice facade (`/invoices`, `/invoices/:id`)
3. **Phase 2:** Implement onboarding flow (`/accept`)
4. **Phase 3:** Implement payments and profile pages
5. **Phase 4:** Add internal ops routes and feature toggles

---

**Document Status:** ✅ Complete  
**Last Updated:** 2025-01-XX  
**Next Review:** After Phase 1 implementation

