# NEXUS CLIENT PORTAL - MASTER PLAN CCP

**Version:** 1.6
**Created:** 2025-12-26
**Updated:** 2025-12-26
**Status:** ✅ C8 COMPLETE - Notifications (C8.3) Shipped
**Companion:** `___NEXUS_VMP_VENDOR_MASTERCCP.md` (Vendor-facing, Phase 12 Complete)

---

## Critical Control Points (CCP)

> **CCP = Checkpoint before proceeding. STOP and verify before moving forward.**

| CCP | Gate | Status | Verified |
|-----|------|--------|----------|
| CCP-C1 | Shared schema supports client context | ✅ PASS | 2025-12-26 |
| CCP-C2 | Client adapter functions exist | ✅ PASS | 2025-12-26 |
| CCP-C3 | Client routes at /nexus/client/* | ✅ PASS | 2025-12-26 |
| CCP-C4 | Client templates exist | ✅ PASS | 2025-12-26 |
| CCP-C5 | Case detail + notes (client & vendor) | ✅ PASS | 2025-12-26 |
| CCP-C6 | Case investigation (evidence, status, vendor) | ✅ PASS | 2025-12-26 |
| CCP-C7 | Invoice processing workflow | ✅ MVP | 2025-12-26 |
| CCP-C8 | Payment approval workflow | ❌ TODO | - |
| CCP-C9 | Document request → vendor flow | ❌ TODO | - |
| CCP-C10 | End-to-end client journey tested | ❌ TODO | - |

---

## Architecture Alignment Check

### Existing Assets (From VMP Implementation)

**Shared Core (Already Built):**
| Component | Status | Notes |
|-----------|--------|-------|
| nexus_tenants | ✅ | Has tenant_client_id (TC-*) |
| nexus_tenant_relationships | ✅ | client_id ↔ vendor_id links |
| nexus_cases | ✅ | Has client_id + vendor_id |
| nexus_invoices | ✅ | Has **vendor_id** (from), **client_id** (to) |
| nexus_payments | ✅ | Has **from_id** (client), **to_id** (vendor) |
| nexus_case_messages | ✅ | Shared thread |
| nexus_case_evidence | ✅ | Shared documents |
| nexus-adapter.js | ✅ | Core CRUD functions |
| nexus-context.js | ✅ | Context switching middleware |

### Schema Column Mapping (Verified 2025-12-26)
| Table | Client Column | Vendor Column |
|-------|---------------|---------------|
| nexus_invoices | `client_id` (TC-*) | `vendor_id` (TV-*) |
| nexus_payments | `from_id` (TC-*) | `to_id` (TV-*) |
| nexus_cases | `client_id` (TC-*) | `vendor_id` (TV-*) |
| nexus_tenant_relationships | `client_id` (TC-*) | `vendor_id` (TV-*) |

**Client-Specific (Built):**
| Component | Status | Notes |
|-----------|--------|-------|
| Client dashboard | ✅ | `client-dashboard.html` |
| Vendor directory view | ✅ | `vendor-directory.html` |
| Case list (client) | ✅ | `client-cases.html` |
| Case detail (client) | ✅ | `client-case-detail.html` with timeline |
| Invoice list (client) | ✅ | `client-invoices.html` |
| Invoice detail (client) | ✅ | `client-invoice-detail.html` |
| Payment list (client) | ✅ | `client-payments.html` |
| Payment detail (client) | ✅ | `client-payment-detail.html` |
| Evidence upload (client) | ✅ | C6.2 complete |
| Status transitions (client) | ✅ | C6.3 complete |
| Vendor case detail | ✅ | `vendor-case-detail.html` [C6.4] |
| Vendor notes/evidence | ✅ | C6.4 complete |
| Approval workflows | ❌ | Future phase |
| Document tracker | ❌ | Future phase |

---

## Pre-Flight Verification (CCP-C1)

Before building, verify shared schema supports client context:

```sql
-- Check: Cases accessible by client_id
SELECT * FROM nexus_cases WHERE client_id = 'TC-ALPH0001';

-- Check: Invoices where we are the payer (client)
SELECT * FROM nexus_invoices
WHERE client_id = 'TC-ALPH0001';  -- We receive invoices

-- Check: Payments where we are the payer (client)
SELECT * FROM nexus_payments
WHERE from_id = 'TC-ALPH0001';  -- We make payments

-- Check: Relationships where we are client
SELECT * FROM nexus_tenant_relationships
WHERE client_id = 'TC-ALPH0001';  -- Our vendors
```

---

## Phase Tracker

### PHASE C1: Context Verification ✅ COMPLETE (2025-12-26)
| # | Task | Status |
|---|------|--------|
| C1.1 | Verify existing schema supports client context | ✅ Done |
| C1.2 | Verify adapter has client-perspective queries | ✅ Schema ready |
| C1.3 | Verify demo data has client test scenarios | ✅ Done |
| C1.4 | Document any schema gaps | ✅ Column names corrected |

**Verified Data (Alpha Corp as Client):**
| Entity | Count | Details |
|--------|-------|---------|
| Vendors | 2 | Beta Services, Gamma Group |
| Invoices (AP) | 3 | $12K paid, $8.5K disputed, $7.5K sent |
| Payments (out) | 3 | $12K completed, $7K pending, $7.5K completed |
| Cases | 4 | contract, payment, general, delivery |

**Corrected Column Names:**
| Table | PRD Assumed | Actual Schema |
|-------|-------------|---------------|
| nexus_invoices | `to_tenant_id` | `client_id` |
| nexus_invoices | `from_tenant_id` | `vendor_id` |
| nexus_payments | `from_tenant_id` | `from_id` |
| nexus_payments | `to_tenant_id` | `to_id` |

**CCP-C1: ✅ VERIFIED** - Schema supports client context with corrected column names

---

### PHASE C2: Client Adapter Functions ✅ COMPLETE (2025-12-26)
| # | Function | Purpose | Status |
|---|----------|---------|--------|
| C2.1 | getVendorsByClient(clientId) | List my vendors | ✅ Done |
| C2.2 | getVendorDetail(clientId, vendorId) | Vendor profile view | ⏳ Phase C2+ |
| C2.3 | getCasesByClient(clientId) | Cases where I'm client | ✅ Done |
| C2.4 | getInvoicesByClient(clientId) | Invoices TO me | ✅ Done |
| C2.5 | getPaymentsByClient(clientId) | Payments FROM me | ✅ Done |
| C2.6 | getPendingDocuments(clientId) | Docs I'm waiting for | ⏳ Phase C2+ |
| C2.7 | approveInvoice(invoiceId, userId) | Mark approved | ⏳ Phase C2+ |
| C2.8 | requestDocument(vendorId, docType) | Push request to vendor | ⏳ Phase C2+ |
| C2.9 | createPaymentRun(invoiceIds) | Batch payment | ⏳ Phase C2+ |
| C2.10 | approvePayment(paymentId, userId) | Approve for release | ⏳ Phase C2+ |

**File:** `src/adapters/nexus-adapter.js` (lines 1492-1624)

**Implementation Notes:**
- FK constraint names verified from schema: `fk_payments_from_tenant`, `fk_payments_to_tenant`, `fk_cases_client_tenant`, `fk_cases_vendor_tenant`
- `nexus_invoices` has no FK constraints - uses manual enrichment pattern
- `nexus_tenant_relationships` has no FK constraints - uses manual enrichment pattern
- All functions support optional filters matching vendor-perspective patterns

**CCP-C2: ✅ VERIFIED** - Core 4 functions implemented, advanced functions deferred to C2+

---

### PHASE C3: Client Routes ✅ COMPLETE (2025-12-26)
| # | Method | Path | Template | Status |
|---|--------|------|----------|--------|
| C3.1 | GET | /nexus/client | Client dashboard | ✅ Done |
| C3.2 | GET | /nexus/client/vendors | Vendor directory | ✅ Done |
| C3.3 | GET | /nexus/client/vendors/:id | Vendor detail | ⏳ C3+ |
| C3.4 | POST | /nexus/client/invite | Send invitation | ✅ Done |
| C3.5 | GET | /nexus/client/cases | Issue tracker | ✅ Done |
| C3.6 | GET | /nexus/client/cases/queue | Triage queue | ⏳ C3+ |
| C3.7 | POST | /nexus/client/cases/:id/assign | Assign case | ⏳ C3+ |
| C3.8 | GET | /nexus/client/invoices | AP Queue | ✅ Done |
| C3.9 | GET | /nexus/client/invoices/:id | Invoice detail | ⏳ C3+ |
| C3.10 | POST | /nexus/client/invoices/:id/approve | Approve invoice | ⏳ C3+ |
| C3.11 | POST | /nexus/client/invoices/:id/reject | Reject invoice | ⏳ C3+ |
| C3.12 | GET | /nexus/client/payments | Payment Outbox | ✅ Done |
| C3.13 | GET | /nexus/client/payments/run | Payment run builder | ⏳ C3+ |
| C3.14 | POST | /nexus/client/payments/run | Execute payment run | ⏳ C3+ |
| C3.15 | POST | /nexus/client/payments/:id/approve | Approve payment | ⏳ C3+ |
| C3.16 | GET | /nexus/client/documents | Document tracker | ⏳ C3+ |
| C3.17 | POST | /nexus/client/documents/request | Request from vendor | ⏳ C3+ |

**File:** `src/routes/nexus-client.js` (327 lines)

**Implementation Notes:**
- Router mounted at `/nexus/client` BEFORE `/nexus` in server.js (route priority)
- Security: `requireNexusContext('client')` applied to all routes
- All list routes include: grouping by status, summary metrics, filter support
- Dashboard aggregates all 4 data sources in parallel for performance
- HTMX support on POST /invite with partial response

**CCP-C3: ✅ VERIFIED** - Core 6 routes implemented, detail/action routes deferred to C3+

---

### PHASE C4: Client Templates ✅ COMPLETE (2025-12-26)
| # | Template | Route | Status |
|---|----------|-------|--------|
| C4.1 | pages/client-dashboard.html | /nexus/client | ✅ Done |
| C4.2 | pages/vendor-directory.html | /nexus/client/vendors | ✅ Done |
| C4.3 | pages/vendor-detail.html | /nexus/client/vendors/:id | ⏳ C4+ |
| C4.4 | pages/client-cases.html | /nexus/client/cases | ✅ Done |
| C4.5 | pages/client-invoices.html | /nexus/client/invoices | ✅ Done |
| C4.6 | pages/invoice-detail.html | /nexus/client/invoices/:id | ✅ Done |
| C4.7 | pages/client-payments.html | /nexus/client/payments | ✅ Done |
| C4.8 | pages/payment-detail.html | /nexus/client/payments/:id | ✅ Done |
| C4.9 | pages/client-case-detail.html | /nexus/client/cases/:id | ✅ Done |
| C4.10 | partials/case-timeline-item.html | (timeline entry) | ✅ Done |
| C4.11 | partials/case-evidence-item.html | (evidence list item) | ✅ Done |
| C4.12 | partials/case-status-actions.html | (status transition buttons) | ✅ Done |
| C4.13 | partials/case-evidence-upload-response.html | (HTMX upload response) | ✅ Done |

**Location:** `src/views/nexus/pages/` and `src/views/nexus/partials/`

**C4.1 Implementation (2025-12-26):**
- Template: `src/views/nexus/pages/client-dashboard.html` (255 lines)
- CSS additions: `public/css/nexus.css` (+260 lines for CMP styles)
- Sections: Header, AP Exposure Hero, KPI Grid, Attention Strip, Recent Activity, Quick Actions
- Data consumed: `metrics`, `recent`, `vendors` from C3 route
- Patterns: Extends `nexus/layout.html`, uses existing class conventions

**CCP-C4.1: ✅ COMPLETE** - Client Command Center dashboard functional

---

### PHASE C5: Case Detail & Notes ✅ COMPLETE (2025-12-26)
| # | Task | Status |
|---|------|--------|
| C5.1 | Client case detail page | ✅ Done |
| C5.2 | Case timeline rendering | ✅ Done |
| C5.3 | Client note creation | ✅ Done |
| C5.4 | Invoice detail page | ✅ Done |
| C5.5 | Payment detail page | ✅ Done |

**Files Implemented:**
- `src/routes/nexus-client.js` - Case detail route + note POST
- `src/views/nexus/pages/client-case-detail.html` - Full case detail page
- `src/views/nexus/partials/case-timeline-item.html` - Reusable timeline partial
- `src/adapters/nexus-adapter.js` - `getCaseDetailByClient()`, `createCaseNoteByClient()`

**CCP-C5: ✅ VERIFIED** - Case detail and notes working for client context

---

### PHASE C6A: Case Investigation ✅ COMPLETE (2025-12-26)

#### C6A.1: Case Detail + Notes ✅ (Covered in C5)

#### C6A.2: Evidence Upload ✅ SIGNED OFF
| # | Task | Status |
|---|------|--------|
| C6A.2.1 | Evidence file constraints (10MB, PDF/PNG/JPG/DOCX/XLSX) | ✅ Done |
| C6A.2.2 | Storage bucket `nexus-evidence` | ✅ Verified |
| C6A.2.3 | `createCaseEvidenceByClient()` adapter | ✅ Done |
| C6A.2.4 | POST /nexus/client/cases/:id/evidence route | ✅ Done |
| C6A.2.5 | HTMX upload response (timeline + OOB evidence list) | ✅ Done |
| C6A.2.6 | Signed download URLs | ✅ Done |

#### C6A.3: Status Transitions ✅ SIGNED OFF
| # | Task | Status |
|---|------|--------|
| C6A.3.1 | Status state machine (`open → in_progress → resolved → closed`) | ✅ Done |
| C6A.3.2 | `STATUS_TRANSITIONS` + `TRANSITION_LABELS` constants | ✅ Done |
| C6A.3.3 | `transitionCaseStatusByClient()` adapter | ✅ Done |
| C6A.3.4 | POST /nexus/client/cases/:id/status route | ✅ Done |
| C6A.3.5 | System event in timeline | ✅ Done |
| C6A.3.6 | OOB badge + actions swap | ✅ Done |
| C6A.3.7 | `case-status-actions.html` partial | ✅ Done |

#### C6A.4: Vendor-Side Participation ✅ COMPLETE
| # | Task | Status |
|---|------|--------|
| C6A.4.1 | `/nexus/vendor/*` namespace created | ✅ Done |
| C6A.4.2 | `nexus-vendor.js` router (session→locals→auth→vendor context) | ✅ Done |
| C6A.4.3 | Route mounting before `/nexus` | ✅ Done |
| C6A.4.4 | `getCaseDetailByVendor()` scoped by `vendor_id` | ✅ Done |
| C6A.4.5 | `createCaseNoteByVendor()` with `sender_context='vendor'` | ✅ Done |
| C6A.4.6 | `createCaseEvidenceByVendor()` with `uploader_context='vendor'` | ✅ Done |
| C6A.4.7 | `vendor-case-detail.html` template | ✅ Done |
| C6A.4.8 | Reuses client partials (timeline, evidence) | ✅ Done |
| C6A.4.9 | Cross-vendor access returns 404 | ✅ Done |
| C6A.4.10 | HTMX error handling (OOB swap) | ✅ Done |

**Files Implemented (C6):**
- `src/routes/nexus-vendor.js` - Vendor portal routes (~235 lines)
- `src/views/nexus/pages/vendor-case-detail.html` - Vendor case view
- `src/adapters/nexus-adapter.js` additions:
  - `getCaseDetailByVendor()`, `getCaseEvidenceByVendor()`
  - `createCaseNoteByVendor()`, `createCaseEvidenceByVendor()`
  - `transitionCaseStatusByClient()`, `getAvailableTransitions()`
  - `STATUS_TRANSITIONS`, `TRANSITION_LABELS`
- `src/views/nexus/partials/case-status-actions.html`
- `src/views/nexus/partials/case-status-transition-response.html`

**CCP-C6A: ✅ VERIFIED** - Bilateral case investigation COMPLETE (2025-12-26)

---

### PHASE C6B: Demo Data Verification ⏳ VERIFY
| # | Scenario | Data Exists | Status |
|---|----------|-------------|--------|
| C6B.1 | Alpha Corp as pure client | TC-ALPH0001 | ⏳ |
| C6B.2 | Alpha → Beta relationship | client → vendor | ⏳ |
| C6B.3 | Alpha → Gamma relationship | client → vendor | ⏳ |
| C6B.4 | Invoices TO Alpha | nexus_invoices | ⏳ |
| C6B.5 | Cases WHERE Alpha is client | nexus_cases | ⏳ |
| C6B.6 | Payments FROM Alpha | nexus_payments | ⏳ |

**Expected Demo Chain:**
```
Alpha Corp (TC-ALPH0001) - Pure Client
    ├── → Beta Services (TV-BETA0001) - Pure Vendor
    └── → Gamma Group (TV-GAMM0001) - Dual (also a client)
              └── → Delta Supplies (TV-DELT0001) - Pure Vendor
```

---

## Namespace Guardrails (ENFORCED)

> **Non-negotiable rules for route structure**

| Rule | Enforcement |
|------|-------------|
| Client endpoints | `/nexus/client/*` only |
| Vendor endpoints | `/nexus/vendor/*` only |
| General portal | `/nexus/*` (auth, profile, etc.) |
| Mount order in server.js | `/nexus/client` → `/nexus/vendor` → `/nexus` |
| Context middleware | `requireNexusContext('client')` or `requireNexusContext('vendor')` |
| ID scoping | Client routes filter by `client_id`, Vendor routes filter by `vendor_id` |

**Reason:** Express matches routes in order. If `/nexus` is mounted before `/nexus/vendor`, the general portal catches vendor routes first → 404 or wrong handler.

---

### PHASE C7: Invoice Processing Workflow ✅ MVP COMPLETE (2025-12-26)

> **MVP Patch: Invoice Decision v0** - Minimal viable decision flow

| # | Task | Status |
|---|------|--------|
| C7.1 | Invoice `approved` status added | ✅ Done |
| C7.2 | `approveInvoiceByClient()` adapter | ✅ Done |
| C7.3 | `disputeInvoiceByClient()` adapter | ✅ Done |
| C7.4 | POST /invoices/:id/approve route | ✅ Done |
| C7.5 | POST /invoices/:id/dispute route | ✅ Done |
| C7.6 | Approve button in invoice detail | ✅ Done |
| C7.7 | Raise Issue form in invoice detail | ✅ Done |
| C7.8 | Dispute creates linked case | ✅ Done |
| C7.9 | Audit columns (approved_at/by, disputed_at/by) | ✅ Done |

**Files Implemented:**
- `migrations/048_nexus_invoice_decisions.sql` - Schema patch
- `src/adapters/nexus-adapter.js` - Two new functions
- `src/routes/nexus-client.js` - Two POST routes
- `src/views/nexus/pages/client-invoice-detail.html` - Decision UI
- `public/css/nexus.css` - Dispute form styling

**MVP Decision Flow:**
```
Invoice → [Approve] → status='approved' + audit trail
       → [Raise Issue] → status='disputed' + case created → vendor sees case
```

**NOT in MVP (deferred to v1.1):**
- 3-way matching logic
- Approval chain / thresholds
- Exception handling workflow
- Notification triggers
- SLA analytics

**CCP-C7: ✅ MVP VERIFIED** - Client can make invoice decisions

---

## MVP Demo Script — Invoice Decision v0

**Duration:** 2 minutes
**Prereq:** Server running (`npm run dev`), logged in as `alice@alpha.com`

### A) Approve Flow
1. Navigate: `/nexus/client/invoices/INV-AG000001`
2. Verify status badge shows `sent`
3. Click **✅ Approve**
4. ✓ Green toast appears at top: "Invoice approved successfully"
5. ✓ Badge now shows `approved`
6. ✓ Approve button gone, replaced by badge

### B) Dispute Flow
**Reset first (run in Supabase SQL Editor):**
```sql
UPDATE nexus_invoices
SET status = 'sent', disputed_at = NULL, disputed_by = NULL, case_id = NULL
WHERE invoice_id = 'INV-AB000002';
```

1. Navigate: `/nexus/client/invoices/INV-AB000002`
2. Click **🚨 Raise Issue** → form expands
3. Enter subject: "Quantity mismatch"
4. Enter description: "PO was for 10 units, invoice shows 15"
5. Click **Submit Dispute**
6. ✓ Redirects to case detail page
7. ✓ Case shows subject + description
8. Go back to invoice: `/nexus/client/invoices/INV-AB000002`
9. ✓ Warning toast: "Invoice disputed - case created"
10. ✓ "View Dispute Case" button visible

### Verification SQL
```sql
-- After Approve:
SELECT invoice_id, status, approved_at FROM nexus_invoices WHERE invoice_id = 'INV-AG000001';

-- After Dispute:
SELECT invoice_id, status, disputed_at, case_id FROM nexus_invoices WHERE invoice_id = 'INV-AB000002';
```

### Known Reset Commands

Use these to reset demo data for repeat testing:

```sql
-- Reset approved invoice back to 'sent' (for Approve demo)
UPDATE nexus_invoices
SET status = 'sent', approved_at = NULL, approved_by = NULL
WHERE invoice_id = 'INV-AG000001';

-- Reset disputed invoice back to 'sent' (for Dispute demo)
UPDATE nexus_invoices
SET status = 'sent', disputed_at = NULL, disputed_by = NULL, case_id = NULL
WHERE invoice_id = 'INV-AB000002';

-- Optional: Delete orphaned test cases created during dispute demos
DELETE FROM nexus_cases WHERE subject LIKE '%mismatch%' AND client_id = 'TC-ALPH0001';
```

---

## MVP Scope Freeze Notice

> **v0.9.0-mvp-invoice-decision**
>
> ✅ **In Scope (Shipped):**
> - Invoice Approve action (status + audit trail)
> - Invoice Dispute action (creates linked case)
> - Decision UI with conditional rendering
> - Toast feedback on redirect
>
> 🚫 **Out of Scope (Deferred to v1.1+):**
> - 3-way matching
> - Approval chains / thresholds
> - Notifications
> - SLA analytics
> - Bulk operations
>
> **Freeze Policy:** C8 development begins only after this tag is created and demo passes clean.

---

### PHASE C8 (v1.1): Invoice Workflow Expansion — Sprint Plan (Post-MVP)

**Objective:** Extend the shipped Invoice Decision v0 into a scalable AP workflow without introducing scope creep.

**Guardrails (Non-negotiable):**
- No "full ERP" features in v1.1.
- Reuse existing Case engine for exceptions.
- Adapter remains SSOT (no route SQL).
- All new features must be demoable with a 5-minute script.

---

#### Sprint C8.1 (Week 1): Client Approval Inbox + Filtering

**Goal:** Give Client an AP "work queue" (not just invoice detail).

| # | Deliverable | Acceptance Criteria |
|---|-------------|---------------------|
| C8.1.1 | `/nexus/client/invoices` becomes an **Approval Inbox** | Supports filters: `status`, `vendor`, `amount range`, `date range` |
| C8.1.2 | Quick tabs | Tabs: **Needs Review** (sent/viewed/overdue), **Approved**, **Disputed**, **Paid** |
| C8.1.3 | Bulk selection (optional) | If implemented: bulk approve limited to ≤20 items and logs audit for each |
| C8.1.4 | Adapter: `getInvoiceInboxByClient()` | Returns normalized list (no joins), supports filters + pagination |
| C8.1.5 | UI empty states | Clear empty state for each tab; no broken table rendering |

**Out of scope (C8.1):**
- Approval chains / thresholds
- Notifications
- Matching

---

#### Sprint C8.2 (Week 2): Matching Pilot (Read-Only) + Case Trigger

**Goal:** Introduce matching as *signal*, not a blocking gate yet.

| # | Deliverable | Acceptance Criteria |
|---|-------------|---------------------|
| C8.2.1 | Matching status model (minimal) | Add fields or table for `match_status` + `match_score` + `match_reason` (read-only) |
| C8.2.2 | UI: Matching panel on invoice detail | Shows "Matched / Needs Review / Mismatch" with reason text |
| C8.2.3 | "Create Case from Mismatch" | Button appears only when mismatch; creates case linked to invoice |
| C8.2.4 | Adapter: `computeInvoiceMatchSignal()` | Deterministic logic, safe defaults, no external dependencies |
| C8.2.5 | Feature flag | Matching panel behind `FEATURE_MATCHING_PILOT=true` |

**Out of scope (C8.2):**
- True PO/GRN ingestion pipelines
- Full 3-way match enforcement
- Auto rejection rules

---

#### Sprint C8.3 (Week 3): Notifications (Minimal, Non-intrusive)

**Goal:** Add confidence and responsiveness without complex orchestration.

| # | Deliverable | Acceptance Criteria |
|---|-------------|---------------------|
| C8.3.1 | Notification trigger: invoice disputed | Creates one notification record/event |
| C8.3.2 | Notification trigger: invoice approved | Creates one notification record/event |
| C8.3.3 | UI: notification list | Shows last 20 notifications for client and vendor |
| C8.3.4 | Adapter: `createNotification()` | Single function; called only from adapter decision methods |

**Out of scope (C8.3):**
- Email/SMS
- SLA breach alerts
- Multi-channel routing

---

#### Definition of Done (v1.1 Release Gate)

A) Client can process invoices from an Inbox (not only detail pages).
B) Matching shows a **read-only** signal and can trigger a case.
C) Minimal notifications confirm decisions/disputes.
D) No regressions to MVP Decision v0 (approve/dispute).

---

#### Demo Script (v1.1)

1. Open Approval Inbox → filter "Needs Review"
2. Approve 1 invoice → status updates, audit recorded, notification created
3. Open a mismatched invoice (pilot) → see reason → create case
4. Vendor sees dispute/case + notification

---

### PHASE C9: Payment Approval Workflow ❌ TODO
| # | Task | Status |
|---|------|--------|
| C9.1 | Payment state machine | ❌ |
| C9.2 | Approval threshold rules | ❌ |
| C9.3 | Dual control enforcement | ❌ |
| C9.4 | Payment run batching | ❌ |
| C9.5 | Release notification to vendor | ❌ |

**Payment States:**
```
draft → pending_approval → approved → scheduled → released → completed
                       ↘ rejected → (back to draft or cancelled)
```

---

### PHASE C10: Document Request Flow ❌ TODO
| # | Task | Status |
|---|------|--------|
| C9.1 | Document requirement schema | ❌ |
| C9.2 | Request triggers vendor notification | ❌ |
| C9.3 | Vendor submits → appears in client view | ❌ |
| C9.4 | Client approves/rejects | ❌ |
| C9.5 | Expiry tracking | ❌ |

---

### PHASE C10: End-to-End Testing ❌ TODO
| # | Test Scenario | Status |
|---|---------------|--------|
| C10.1 | Login as Alice (Alpha) → see Client dashboard | ❌ |
| C10.2 | View vendor directory → see Beta, Gamma | ❌ |
| C10.3 | View invoices → see invoices from Beta | ❌ |
| C10.4 | Approve invoice → status changes | ❌ |
| C10.5 | Create payment run → batch invoices | ❌ |
| C10.6 | Approve payment → vendor sees notification | ❌ |
| C10.7 | Request document → vendor sees request | ❌ |
| C10.8 | Vendor submits → client sees submission | ❌ |

---

## File Inventory (Actual)

### Source Files Created/Modified
```
src/
├── routes/
│   ├── nexus-client.js          ✅ CREATED (~743 lines)
│   └── nexus-vendor.js          ✅ CREATED (~235 lines) [C6.4]
├── adapters/
│   └── nexus-adapter.js         ✅ EXTENDED (+400 lines)
│       ├── getVendorsByClient()
│       ├── getInvoicesByClient()
│       ├── getPaymentsByClient()
│       ├── getCasesByClient()
│       ├── getCaseDetailByClient()
│       ├── createCaseNoteByClient()
│       ├── getCaseEvidenceByClient()
│       ├── createCaseEvidenceByClient()
│       ├── transitionCaseStatusByClient()
│       ├── getAvailableTransitions()
│       ├── getCaseDetailByVendor()        [C6.4]
│       ├── getCaseEvidenceByVendor()      [C6.4]
│       ├── createCaseNoteByVendor()       [C6.4]
│       └── createCaseEvidenceByVendor()   [C6.4]
└── views/nexus/
    ├── pages/
    │   ├── client-dashboard.html    ✅ CREATED
    │   ├── vendor-directory.html    ✅ CREATED
    │   ├── client-cases.html        ✅ CREATED
    │   ├── client-case-detail.html  ✅ CREATED
    │   ├── client-invoices.html     ✅ CREATED
    │   ├── client-invoice-detail.html ✅ CREATED
    │   ├── client-payments.html     ✅ CREATED
    │   ├── client-payment-detail.html ✅ CREATED
    │   └── vendor-case-detail.html  ✅ CREATED [C6.4]
    └── partials/
        ├── case-timeline-item.html  ✅ CREATED
        ├── case-evidence-item.html  ✅ CREATED
        ├── case-status-actions.html ✅ CREATED [C6.3]
        ├── case-status-transition-response.html ✅ CREATED [C6.3]
        └── case-evidence-upload-response.html ✅ CREATED [C6.2]
```

### Server Mount Order (server.js)
```javascript
app.use('/nexus/client', nexusClientRouter);  // Client routes
app.use('/nexus/vendor', nexusVendorRouter);  // Vendor routes [C6.4]
app.use('/nexus', nexusPortalRouter);         // General portal
```

### Migrations (If Needed)
```
migrations/
├── 050_nexus_invoice_workflow.sql     ❌ (if schema changes needed)
├── 051_nexus_approval_chains.sql      ❌ (if new tables needed)
└── 052_nexus_document_requirements.sql ❌ (if new tables needed)
```

---

## Dependencies

### From VMP (Already Built)
- ✅ Core tenant schema
- ✅ Relationship model
- ✅ Case system
- ✅ Basic invoice/payment tables
- ✅ Notification system
- ✅ Realtime subscriptions
- ✅ Context switching middleware

### New Dependencies
- [ ] Invoice workflow state machine
- [ ] Approval chain engine
- [ ] Document requirement tracking
- [ ] Payment run batching

---

## Resume Point

**STATUS:** ✅ MVP SHIPPABLE

**Completed:**
- ✅ Dual Persona Access (Client + Vendor)
- ✅ Client AP Command Center (invoices, vendors, cases)
- ✅ Case Lifecycle (create, note, evidence, status transition)
- ✅ Invoice Decision (Approve + Dispute → Case)
- ✅ Adapter Discipline (all data via nexus-adapter.js)
- ✅ C8.1 Invoice Inbox (tabs, filters, pagination)
- ✅ C8.2 Matching Pilot (feature-flagged)
- ✅ C8.3 Notifications (minimal, adapter-driven)

---

## C8.3 Notifications - Implementation Details

**Trigger Points:**
| Event | Trigger Location | Notification Type |
|-------|------------------|-------------------|
| Invoice approved | `approveInvoiceByClient()` | `invoice_approved` |
| Invoice disputed | `disputeInvoiceByClient()` | `invoice_disputed` |
| Mismatch → case | Same dispute endpoint | `invoice_disputed` |

**Idempotency:**
- Approval: Fires only if status changes (idempotent check in adapter)
- Dispute: Fires only for NEW case creation; re-disputes with existing case → no notification

**Notification Scope:**
- Each decision creates 2 notifications: one for `client`, one for `vendor`
- `context_id` = TC-* (client) or TV-* (vendor)
- `action_url` links to appropriate context portal

**Adapter Functions:**
| Function | Purpose |
|----------|--------|
| `getNotificationsByClient(clientId, opts)` | Client context notifications |
| `getNotificationsByVendor(vendorId, opts)` | Vendor context notifications |
| `createInvoiceDecisionNotification(params)` | Helper for decision triggers |

**Routes:**
| Route | Template |
|-------|----------|
| `GET /nexus/client/notifications` | `client-notifications.html` |
| `GET /nexus/vendor/notifications` | `vendor-notifications.html` |

**Schema:** Reused existing `nexus_notifications` table; extended `notification_type` CHECK to include `invoice_approved`, `invoice_disputed`.

---

## C8.2 Matching Pilot - Implementation Details

**Feature Flag:** `FEATURE_MATCHING_PILOT=true`

**Schema Changes (migration 049):**
```sql
-- nexus_invoices columns:
match_status TEXT DEFAULT 'unknown'   -- matched|needs_review|mismatch|unknown
match_score NUMERIC                   -- 0-100 confidence score
match_reason TEXT                     -- Human-readable reason
match_updated_at TIMESTAMPTZ          -- Last computed timestamp
```

**Adapter Functions:**
| Function | Purpose |
|----------|---------|
| `computeInvoiceMatchSignal(invoice)` | Pure function, returns signal object |
| `refreshInvoiceMatchSignal({ invoiceId, clientId })` | Computes + persists to DB |

**Match Signal Logic (Pilot):**
| Condition | Status | Score | Reason |
|-----------|--------|-------|--------|
| `status = 'disputed'` | mismatch | 0 | "Invoice is disputed" |
| `case_id IS NOT NULL` | needs_review | 50 | "Invoice has a linked case" |
| `status = 'approved'` | matched | 100 | "Invoice approved by client" |
| `status = 'paid'` | matched | 95 | "Invoice paid" |
| Otherwise | unknown | null | "Awaiting client review" |

**Route Behavior:**
- GET `/nexus/client/invoices/:id` checks `process.env.FEATURE_MATCHING_PILOT`
- If enabled: refreshes match signal + passes `matchSignal` to template
- Template shows "Match Signal (Pilot)" panel with badge + action

**UI Panel Features:**
- Match status badge (color-coded: green/yellow/red/gray)
- Score percentage (if available)
- Reason text
- Last computed timestamp
- "Create Case from Mismatch" shortcut (for mismatch status only)

**Enabling Pilot:**
```bash
# Add to .env or environment
FEATURE_MATCHING_PILOT=true
```

---

**Next Phase (v1.1):**
- C8: Payment approval workflow
- C7+: 3-way matching, SLA analytics, notification triggers

---

## Changelog

| Date | Phase | Change |
|------|-------|--------|
| 2025-12-26 | - | Initial CMP CCP document created |
| 2025-12-26 | C5 | Case detail + notes implementation complete |
| 2025-12-26 | C6.2 | Evidence upload signed off |
| 2025-12-26 | C6.3 | Status transitions signed off |
| 2025-12-26 | C6.4 | Vendor-side participation COMPLETE |
| 2025-12-26 | C7 | **MVP PATCH: Invoice Decision v0** - Approve + Dispute |
| 2025-12-26 | C8.1 | Invoice Inbox (tabs, filters, pagination) |
| 2025-12-26 | C8.2 | **Matching Pilot** - Feature-flagged match signal |
| 2025-12-26 | C8.3 | **Notifications** - Approve/dispute triggers, client+vendor pages |

---

## Quick Reference

**Client Context Identifier:** `TC-XXXXXXXX` (Tenant-as-Client)

**Key Perspective Shift:**
| VMP (Vendor) | CMP (Client) |
|--------------|--------------|
| "My clients" | "My vendors" |
| "Invoices I sent" | "Invoices I received" |
| "Payments coming to me" | "Payments going from me" |
| "Documents I submitted" | "Documents I'm waiting for" |
| "Cases about my issues" | "Cases I'm managing" |
