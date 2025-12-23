# NexusCanon VMP Development Status

**Date:** 2025-12-21  
**Status:** Active Development  
**Current Phase:** Sprint 3 Ready

---

## ✅ Completed Sprints

### Sprint 1: Case Deep-Linking + Escalation Action ✅
**Duration:** 1 week  
**Status:** Complete

**Deliverables:**
- ✅ `/cases/:id` direct route with full page layout
- ✅ Case detail page with graceful null handling for linked_refs
- ✅ Escalation action with Break Glass Protocol (Level 3)
- ✅ Emergency contact card reveal for Director contact
- ✅ Audit logging for break glass events
- ✅ Case row refresh partial for HTMX updates

**Files Created:**
- `src/views/pages/case_detail.html`

**Files Modified:**
- `server.js` (routes added)
- `src/adapters/supabase.js` (escalateCase, logBreakGlass, getGroupDirectorInfo methods)
- `src/views/partials/escalation.html` (break glass UI)

---

### Sprint 2: Invoice Transparency + Manual Ingest ✅
**Duration:** 2 weeks  
**Status:** Complete

**Deliverables:**
- ✅ Shadow Ledger tables (`vmp_invoices`, `vmp_po_refs`, `vmp_grn_refs`)
- ✅ CSV ingest functionality (`/ops/ingest/invoices`)
- ✅ Invoice list page (`/invoices`)
- ✅ Invoice detail page (`/invoices/:id`)
- ✅ 3-way matching status calculation
- ✅ Invoice-to-case linking (`linked_invoice_id` in `vmp_cases`)
- ✅ Linked refs migration (moved from Sprint 8)

**Files Created:**
- `src/views/pages/invoice_list.html`
- `src/views/pages/invoice_detail.html`
- `src/views/partials/invoice_list.html`
- `src/views/partials/invoice_detail.html`
- `migrations/015_vmp_shadow_ledger.sql`

**Files Modified:**
- `server.js` (routes added)
- `src/adapters/supabase.js` (invoice methods, CSV ingest logic)
- `migrations/014_vmp_multi_company_groups.sql` (linked_refs fields)

---

### Design System Enhancement ✅
**Status:** Complete

**Deliverables:**
- ✅ Figma MCP validation and alignment
- ✅ Clean semantic `globals.css` rewrite (removed non-semantic utilities)
- ✅ IDE-friendly documentation with design hierarchy
- ✅ Foundation vs Design Layer separation
- ✅ NO CDS Template Design enforcement
- ✅ NO SaaS Typical Design Model enforcement
- ✅ Creativity markers (`.vmp-creative`, `.vmp-marketing`, `.vmp-free-form`)

**Files Modified:**
- `public/globals.css` (complete rewrite - clean semantic structure)
- `.cursorrules` (updated with design system rules)
- `.dev/dev-contract/contract-001-design-system.md` (updated with new rules)

---

## ✅ Completed Sprints (Continued)

### Sprint 3: Supplier Onboarding Flow (VMP-01) ✅
**Duration:** 2 weeks  
**Priority:** 🔴 High  
**Status:** Complete

**Deliverables:**
- ✅ Invite Generation (POST `/ops/invites` - internal only)
- ✅ Accept Invite & Account Creation (GET `/accept`, POST `/accept`)
- ✅ Onboarding Case & Checklist (auto-create after accept)
- ✅ Approval Workflow (POST `/cases/:id/approve-onboarding` - internal only)

**Files Created:**
- `src/views/pages/accept.html`

**Files Modified:**
- `server.js` (routes added)
- `src/adapters/supabase.js` (createInvite, getInviteByToken, createVendorUser, markInviteAsUsed, createOnboardingCase, approveOnboarding methods)

---

## 🔄 Current Sprint

### Sprint 4: Payment Visibility + Remittance Drop (VMP-06)
**Duration:** 1 week  
**Priority:** 🟡 Medium (High Value - "Adoption Carrot")  
**Status:** Ready to Start

**Goal:** Complete supplier onboarding workflow - enables vendor self-service onboarding

**Tasks:**
1. **3.1 Invite Generation (Internal - Basic)**
   - POST `/ops/invites` route (internal only)
   - `createInvite()` adapter method
   - Generate secure token, set expiry, create vendor-company links

2. **3.2 Accept Invite & Account Creation**
   - GET `/accept?token=...` route
   - `accept.html` page (full layout)
   - POST `/accept` route for password setup
   - `createVendorUser()` adapter method
   - Redirect to onboarding checklist

3. **3.3 Onboarding Case & Checklist**
   - Auto-create `case_type='onboarding'` after accept
   - `createOnboardingCase()` adapter method
   - Render standard checklist (Bank, Tax, Reg)
   - Redirect to `/cases/:id` (onboarding case)

4. **3.4 Approval Workflow**
   - POST `/cases/:id/approve-onboarding` route (internal only)
   - `approveOnboarding()` adapter method
   - Mark case as resolved, activate vendor account
   - Notify vendor user of activation

**Dependencies:** None (vmp_invites table exists)

**Impact:** Enables end-to-end vendor onboarding workflow

---

## 📋 Upcoming Sprints

### Sprint 4: Payment Visibility + Remittance Drop (VMP-06)
**Duration:** 1 week  
**Priority:** 🟡 Medium (High Value - "Adoption Carrot")

**Focus:** Let suppliers see payment status via manual upload

---

### Sprint 5: Supplier Profile & Compliance (VMP-02)
**Duration:** 1 week  
**Priority:** 🟡 Medium

**Focus:** Supplier self-service profile management

---

### Sprint 6: Command Center (Internal Ops + Org Tree)
**Duration:** 1 week  
**Priority:** 🟡 Medium

**Focus:** Internal operations dashboard and organizational tree

---

### Sprint 7: SLA & Polish (VMP-03)
**Duration:** 1 week  
**Priority:** 🟢 Polish

**Focus:** SLA reminders and decision log

---

### Sprint 8: Domain Object Polish
**Duration:** 1 week  
**Priority:** 🟢 Polish

**Focus:** Tags, assigned to, metadata, contract case type

---

## 📊 Progress Summary

| Phase | Sprints | Duration | Status |
|-------|---------|----------|--------|
| **Core Features** | 1-2 | 3 weeks | ✅ Complete |
| **Foundation** | 3 | 2 weeks | ✅ Complete |
| **Value Features** | 4-5 | 2 weeks | 🔄 Next |
| **Value Features** | 4-5 | 2 weeks | ⏳ Pending |
| **Internal Ops** | 6 | 1 week | ⏳ Pending |
| **Bulk Testing** | - | 1-2 weeks | ⏳ Pending |
| **Polish** | 7-8 | 2 weeks | ⏳ Pending |

**Total Estimated:** 11-12 weeks (including testing)  
**Completed:** 5 weeks (Sprints 1-3)  
**Remaining:** 6-7 weeks

---

## 🎯 Next Action

**Proceed with Sprint 4 (Payment Visibility + Remittance Drop)** as it is:
- ✅ High value feature ("Adoption Carrot")
- ✅ Short sprint (1 week)
- ✅ Builds on Sprint 2 Shadow Ledger pattern
- ✅ Enables supplier payment visibility

---

**Last Updated:** 2025-12-21

