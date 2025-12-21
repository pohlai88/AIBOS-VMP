# Sprint Implementation Roadmap

**Date:** 2025-12-21  
**Status:** Active Implementation  
**Current:** Sprint 2 Complete ✅

---

## Implementation Strategy

**Approach:** Implement core functionality sprints (1-6) before bulk testing, then polish sprints (7-8) after testing feedback.

---

## Completed Sprints

### ✅ Sprint 1: Case Deep-Linking + Escalation Action
- **Status:** Complete
- **Duration:** 1 week
- **Deliverables:**
  - `/cases/:id` direct route
  - Escalation action with Break Glass Protocol
  - Case row refresh partial

### ✅ Sprint 2: Invoice Transparency + Manual Ingest
- **Status:** Complete
- **Duration:** 2 weeks
- **Deliverables:**
  - Shadow Ledger tables (vmp_invoices, vmp_po_refs, vmp_grn_refs)
  - CSV ingest functionality
  - Invoice list & detail pages
  - 3-way matching status
  - Invoice-to-case linking

---

## Recommended Next Steps (Pre-Testing)

### 🔴 Sprint 3: Supplier Onboarding Flow (VMP-01)
**Priority:** High  
**Duration:** 2 weeks  
**Why Next:** Foundational feature - enables vendor self-service onboarding

**Tasks:**
1. Invite Generation (Internal API)
2. Accept Invite & Account Creation
3. Onboarding Case & Checklist (auto-create)
4. Approval Workflow (Internal)

**Dependencies:** None (vmp_invites table exists)

**Impact:** Enables end-to-end vendor onboarding workflow

---

### 🟡 Sprint 4: Payment Visibility + Remittance Drop (VMP-06)
**Priority:** Medium (High Value - "Adoption Carrot")  
**Duration:** 1 week  
**Why Next:** Short sprint, builds on Sprint 2 Shadow Ledger pattern

**Tasks:**
1. Payment table schema
2. Bulk payment CSV ingest
3. Remittance PDF drop
4. Supplier payment views

**Dependencies:** Sprint 2 (Shadow Ledger pattern established)

**Impact:** High adoption value - suppliers can see payment status

---

### 🟡 Sprint 5: Supplier Profile & Compliance (VMP-02)
**Priority:** Medium  
**Duration:** 1 week  
**Why Next:** Short sprint, completes supplier self-service

**Tasks:**
1. Profile page & form
2. Bank details change (gated workflow)
3. Compliance docs display
4. Contract library

**Dependencies:** None

**Impact:** Completes supplier self-service capabilities

---

### 🟡 Sprint 6: Command Center (Internal Ops + Org Tree)
**Priority:** Medium  
**Duration:** 1 week  
**Why Next:** Completes internal operations features

**Tasks:**
1. Command Center layout with Org Tree Sidebar
2. Scoped Dashboard (Director vs Manager View)
3. Ops Case Queue (scoped)
4. Enhanced Inviter (multi-company selection)
5. Manual Ingest UI (scoped)
6. Data Ingest History

**Dependencies:** Sprint 2 (ingest), Sprint 3 (invites), Sprint 14 (groups)

**Impact:** Completes Command Center architecture

---

## Bulk Testing Phase

**After Sprint 6 Completion:**

1. **End-to-End Testing:**
   - Vendor onboarding flow (Sprint 3)
   - Invoice ingest → Case creation (Sprint 2)
   - Payment visibility (Sprint 4)
   - Profile management (Sprint 5)
   - Internal ops workflows (Sprint 6)

2. **Integration Testing:**
   - Break Glass Protocol (Sprint 1)
   - 3-way matching (Sprint 2)
   - Multi-company hierarchy (Sprint 2, 6)
   - RBAC scoping (Sprint 6)

3. **Performance Testing:**
   - CSV ingest performance
   - Large invoice list rendering
   - Case inbox performance
   - Dashboard aggregation queries

4. **Security Testing:**
   - Authentication/authorization
   - Vendor data isolation
   - Internal route protection
   - CSV upload validation

---

## Post-Testing Polish Sprints

### 🟢 Sprint 7: SLA & Polish (VMP-03)
**Priority:** Polish  
**Duration:** 1 week  
**After Testing:** Implement based on testing feedback

**Tasks:**
1. SLA reminders
2. Decision log

---

### 🟢 Sprint 8: Domain Object Polish
**Priority:** Polish  
**Duration:** 1 week  
**After Testing:** Implement based on testing feedback

**Tasks:**
1. Tags
2. Assigned To
3. Metadata
4. Contract case type

---

## Implementation Timeline

| Phase | Sprints | Duration | Status |
|-------|---------|----------|--------|
| **Core Features** | 1-2 | 3 weeks | ✅ Complete |
| **Foundation** | 3 | 2 weeks | 🔄 Next |
| **Value Features** | 4-5 | 2 weeks | ⏳ Pending |
| **Internal Ops** | 6 | 1 week | ⏳ Pending |
| **Bulk Testing** | - | 1-2 weeks | ⏳ Pending |
| **Polish** | 7-8 | 2 weeks | ⏳ Pending |

**Total Estimated:** 11-12 weeks (including testing)

---

## Recommendation

**Proceed with Sprint 3 (Supplier Onboarding Flow)** as it is:
- ✅ High priority
- ✅ Foundational feature
- ✅ No blocking dependencies
- ✅ Enables end-to-end vendor workflow testing

After Sprint 3, continue with Sprints 4-6 in sequence, then conduct comprehensive bulk testing before polish sprints.

---

**Last Updated:** 2025-12-21

