# NEXUS CLIENT PORTAL - MASTER PLAN CCP

**Version:** 1.1
**Created:** 2025-12-26
**Updated:** 2025-12-26
**Status:** IN PROGRESS
**Companion:** `___NEXUS_VMP_VENDOR_MASTERCCP.md` (Vendor-facing, Phase 12 Complete)

---

## Critical Control Points (CCP)

> **CCP = Checkpoint before proceeding. STOP and verify before moving forward.**

| CCP | Gate | Status | Verified |
|-----|------|--------|----------|
| CCP-C1 | Shared schema supports client context | ✅ PASS | 2025-12-26 |
| CCP-C2 | Client adapter functions exist | ❌ TODO | - |
| CCP-C3 | Client routes at /nexus/client/* | ❌ TODO | - |
| CCP-C4 | Client templates exist | ❌ TODO | - |
| CCP-C5 | Context switching works (TC-* ↔ TV-*) | ⏳ VERIFY | - |
| CCP-C6 | Demo data includes client scenarios | ✅ PASS | 2025-12-26 |
| CCP-C7 | Invoice processing workflow | ❌ TODO | - |
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

**Client-Specific (To Build):**
| Component | Status | Notes |
|-----------|--------|-------|
| Client dashboard | ❌ | New template |
| Vendor directory view | ❌ | Client sees "my vendors" |
| Invoice inbox (client) | ❌ | Invoices TO us |
| Payment queue (client) | ❌ | Payments FROM us |
| Approval workflows | ❌ | Multi-level |
| Document tracker | ❌ | What we're waiting for |

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

### PHASE C2: Client Adapter Functions ❌ TODO
| # | Function | Purpose | Status |
|---|----------|---------|--------|
| C2.1 | getVendorsByClient(clientId) | List my vendors | ❌ |
| C2.2 | getVendorDetail(clientId, vendorId) | Vendor profile view | ❌ |
| C2.3 | getCasesByClient(clientId) | Cases where I'm client | ❌ |
| C2.4 | getInvoicesByClient(clientId) | Invoices TO me | ❌ |
| C2.5 | getPaymentsByClient(clientId) | Payments FROM me | ❌ |
| C2.6 | getPendingDocuments(clientId) | Docs I'm waiting for | ❌ |
| C2.7 | approveInvoice(invoiceId, userId) | Mark approved | ❌ |
| C2.8 | requestDocument(vendorId, docType) | Push request to vendor | ❌ |
| C2.9 | createPaymentRun(invoiceIds) | Batch payment | ❌ |
| C2.10 | approvePayment(paymentId, userId) | Approve for release | ❌ |

**File:** `src/adapters/nexus-adapter.js` (extend existing)

---

### PHASE C3: Client Routes ❌ TODO
| # | Method | Path | Template | Status |
|---|--------|------|----------|--------|
| C3.1 | GET | /nexus/client | Client dashboard | ❌ |
| C3.2 | GET | /nexus/client/vendors | Vendor directory | ❌ |
| C3.3 | GET | /nexus/client/vendors/:id | Vendor detail | ❌ |
| C3.4 | POST | /nexus/client/vendors/invite | Send invitation | ❌ |
| C3.5 | GET | /nexus/client/cases | Case dashboard | ❌ |
| C3.6 | GET | /nexus/client/cases/queue | Triage queue | ❌ |
| C3.7 | POST | /nexus/client/cases/:id/assign | Assign case | ❌ |
| C3.8 | GET | /nexus/client/invoices | Invoice inbox | ❌ |
| C3.9 | GET | /nexus/client/invoices/:id | Invoice detail | ❌ |
| C3.10 | POST | /nexus/client/invoices/:id/approve | Approve invoice | ❌ |
| C3.11 | POST | /nexus/client/invoices/:id/reject | Reject invoice | ❌ |
| C3.12 | GET | /nexus/client/payments | Payment queue | ❌ |
| C3.13 | GET | /nexus/client/payments/run | Payment run builder | ❌ |
| C3.14 | POST | /nexus/client/payments/run | Execute payment run | ❌ |
| C3.15 | POST | /nexus/client/payments/:id/approve | Approve payment | ❌ |
| C3.16 | GET | /nexus/client/documents | Document tracker | ❌ |
| C3.17 | POST | /nexus/client/documents/request | Request from vendor | ❌ |

**File:** `src/routes/nexus-client.js` (new file)

---

### PHASE C4: Client Templates ❌ TODO
| # | Template | Route | Status |
|---|----------|-------|--------|
| C4.1 | pages/client-dashboard.html | /nexus/client | ❌ |
| C4.2 | pages/vendor-directory.html | /nexus/client/vendors | ❌ |
| C4.3 | pages/vendor-detail.html | /nexus/client/vendors/:id | ❌ |
| C4.4 | pages/client-cases.html | /nexus/client/cases | ❌ |
| C4.5 | pages/client-invoices.html | /nexus/client/invoices | ❌ |
| C4.6 | pages/invoice-detail.html | /nexus/client/invoices/:id | ❌ |
| C4.7 | pages/client-payments.html | /nexus/client/payments | ❌ |
| C4.8 | pages/payment-run.html | /nexus/client/payments/run | ❌ |
| C4.9 | pages/document-tracker.html | /nexus/client/documents | ❌ |
| C4.10 | partials/vendor-card.html | (vendor directory item) | ❌ |
| C4.11 | partials/invoice-row.html | (invoice list item) | ❌ |
| C4.12 | partials/matching-panel.html | (3-way match display) | ❌ |
| C4.13 | partials/approval-chain.html | (workflow status) | ❌ |

**Location:** `src/views/nexus/pages/` and `src/views/nexus/partials/`

---

### PHASE C5: Context Switching Enhancement ⏳ VERIFY
| # | Task | Status |
|---|------|--------|
| C5.1 | Verify role-dashboard shows Client context | ⏳ |
| C5.2 | Verify /nexus/portal/switch handles client | ⏳ |
| C5.3 | Add /nexus/client/* routes to context check | ❌ |
| C5.4 | Context badge shows "Client Mode" | ❌ |
| C5.5 | Sidebar changes based on context | ❌ |

**Context Logic:**
```javascript
// Existing in nexus-context.js
if (req.nexus.activeContext === 'client') {
  // User is viewing as CLIENT
  // Show: My Vendors, Invoices To Pay, Payments Going Out
} else if (req.nexus.activeContext === 'vendor') {
  // User is viewing as VENDOR
  // Show: My Clients, Invoices Sent, Payments Coming In
}
```

---

### PHASE C6: Demo Data Verification ⏳ VERIFY
| # | Scenario | Data Exists | Status |
|---|----------|-------------|--------|
| C6.1 | Alpha Corp as pure client | TC-ALPH0001 | ⏳ |
| C6.2 | Alpha → Beta relationship | client → vendor | ⏳ |
| C6.3 | Alpha → Gamma relationship | client → vendor | ⏳ |
| C6.4 | Invoices TO Alpha | nexus_invoices | ⏳ |
| C6.5 | Cases WHERE Alpha is client | nexus_cases | ⏳ |
| C6.6 | Payments FROM Alpha | nexus_payments | ⏳ |

**Expected Demo Chain:**
```
Alpha Corp (TC-ALPH0001) - Pure Client
    ├── → Beta Services (TV-BETA0001) - Pure Vendor
    └── → Gamma Group (TV-GAMM0001) - Dual (also a client)
              └── → Delta Supplies (TV-DELT0001) - Pure Vendor
```

---

### PHASE C7: Invoice Processing Workflow ❌ TODO
| # | Task | Status |
|---|------|--------|
| C7.1 | Invoice state machine | ❌ |
| C7.2 | 3-way matching logic | ❌ |
| C7.3 | Exception handling | ❌ |
| C7.4 | Approval chain | ❌ |
| C7.5 | Notification triggers | ❌ |

**Invoice States:**
```
received → processing → matched → pending_approval → approved → scheduled → paid
                    ↘ exception → pending_evidence → [loop back]
                                    ↘ disputed → case_created
```

---

### PHASE C8: Payment Approval Workflow ❌ TODO
| # | Task | Status |
|---|------|--------|
| C8.1 | Payment state machine | ❌ |
| C8.2 | Approval threshold rules | ❌ |
| C8.3 | Dual control enforcement | ❌ |
| C8.4 | Payment run batching | ❌ |
| C8.5 | Release notification to vendor | ❌ |

**Payment States:**
```
draft → pending_approval → approved → scheduled → released → completed
                       ↘ rejected → (back to draft or cancelled)
```

---

### PHASE C9: Document Request Flow ❌ TODO
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

## File Inventory (Planned)

### New Source Files
```
src/
├── routes/
│   └── nexus-client.js          ❌ NEW (~500 lines)
├── adapters/
│   └── nexus-adapter.js         ⬆️ EXTEND (+200 lines)
└── views/nexus/
    ├── pages/
    │   ├── client-dashboard.html    ❌ NEW
    │   ├── vendor-directory.html    ❌ NEW
    │   ├── vendor-detail.html       ❌ NEW
    │   ├── client-cases.html        ❌ NEW
    │   ├── client-invoices.html     ❌ NEW
    │   ├── invoice-detail.html      ❌ NEW
    │   ├── client-payments.html     ❌ NEW
    │   ├── payment-run.html         ❌ NEW
    │   └── document-tracker.html    ❌ NEW
    └── partials/
        ├── vendor-card.html         ❌ NEW
        ├── invoice-row.html         ❌ NEW
        ├── matching-panel.html      ❌ NEW
        └── approval-chain.html      ❌ NEW
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

**START AT:** Phase C1.1 - Verify existing schema supports client context

**Pre-requisite:** Phase 13 (Legacy Removal) complete ✅

---

## Changelog

| Date | Phase | Change |
|------|-------|--------|
| 2025-12-26 | - | Initial CMP CCP document created |

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
