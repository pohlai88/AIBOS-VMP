# NexusCanon VMP Sprint Development Plan (v2: Manual/Hybrid Mode)

**Date:** 2025-12-21  
**Status:** 📋 Active Development Plan  
**Reference:** `.dev/dev-note/nexus_canon_vmp_consolidated_final_paper.md`  
**Based On:** Consolidated Paper Audit + Wireframe Blueprint + **Manual Mode Pivot**

---

## Development Principles

- **Route-First Architecture:** Routes defined before HTML files.
- **Naming:** `snake_case` for files, `kebab-case` for URLs.
- **HTMX Partials:** All cells are server-rendered fragments.
- **Server Authority:** All business logic server-side.
- **Shadow Ledger (Manual Mode):** VMP maintains its own `vmp_invoices` and `vmp_payments` tables to support clients without ERP integration (CSV Ingest).
- **Design System:** CONTRACT-001 compliance (VMP classes only).

---

## Sprint Overview

| Sprint | Focus | Duration | Priority |
|--------|-------|----------|----------|
| **Sprint 1** | Case Deep-Linking + Escalation | 1 week | 🔴 Critical |
| **Sprint 2** | Invoice Facade + **CSV Ingest** | 2 weeks | 🔴 Critical |
| **Sprint 3** | Supplier Onboarding Flow | 2 weeks | 🔴 High |
| **Sprint 4** | Payment Visibility + **Remittance Drop** | 1 week | 🟡 Medium |
| **Sprint 5** | Supplier Profile & Compliance | 1 week | 🟡 Medium |
| **Sprint 6** | Internal Ops Routes | 1 week | 🟡 Medium |
| **Sprint 7** | SLA Reminders + Decision Log | 1 week | 🟢 Polish |
| **Sprint 8** | Domain Object Polish | 1 week | 🟢 Polish |

**Total Duration:** 10 weeks

---

## Sprint 1: Case Deep-Linking + Escalation Action

**Duration:** 1 week  
**Priority:** 🔴 Critical  
**Goal:** Enable direct case access and complete escalation safety valve.

### ⚠️ Tactical Warnings

**1. Director Contact Data Dependency (Task 1.2)**
- **Issue:** Break Glass Protocol needs Director contact info, but `vmp_groups` table is in Sprint 2
- **Solution:** Use hardcoded/mock Director data in Sprint 1, wire up real DB fetch in Sprint 2
- **Implementation:** Create `getGroupDirectorInfo(groupId)` with mock data for now

**2. Linked Refs "Chicken and Egg" (Task 1.1)**
- **Issue:** Case Detail page references `linked_invoice_id`, but Shadow Ledger is in Sprint 2
- **Solution:** Build UI to gracefully handle null `linked_refs` (hide section if missing)
- **Implementation:** Use conditional rendering: `{% if case.linked_invoice_id %}`

### Tasks

#### 1.1 Add `/cases/:id` Direct Route
- [ ] **Route:** `app.get('/cases/:id', ...)` in `server.js`
- [ ] **Page:** `src/views/pages/case_detail.html` (full page layout)
- [ ] **Data:** Fetch case detail, render with empty state if not found
- [ ] **Auth:** Require authentication, verify vendor access

**Files to Create:**
```
src/views/pages/case_detail.html
```

**Files to Modify:**
```
server.js (add route)
```

---

#### 1.2 Implement Escalate Action + Break Glass Protocol
- [ ] **Route:** `app.post('/cases/:id/escalate', ...)`
- [ ] **Adapter:** Add `escalateCase(caseId, level, userId, reason)` to `src/adapters/supabase.js`
- [ ] **Logic:** Update `escalation_level` field, create audit log entry
- [ ] **Validation:** Verify case exists, user has access, level is valid (1-3)
- [ ] **Break Glass Protocol (Level 3):**
  - [ ] Require confirmation dialog: "This will log an incident with the Group Director"
  - [ ] On Level 3 escalation, fetch Director contact from `vmp_groups` table (based on case's `group_id`)
  - [ ] Reveal Director contact details (name, phone, email) in Emergency Contact Card
  - [ ] Create audit log entry in `vmp_break_glass_events` table
  - [ ] Update escalation panel to show "Red Phone" state with Emergency Contact Card
  - [ ] **Adapter:** Add `logBreakGlass(caseId, userId, groupId, directorInfo)` to `src/adapters/supabase.js`
  - [ ] **Adapter:** Add `getGroupDirectorInfo(groupId)` to `src/adapters/supabase.js`
- [ ] **Response:** Return refreshed `escalation.html` partial with contact details if Level 3

**Files to Modify:**
```
server.js (add POST route)
src/adapters/supabase.js (add escalateCase method, add logBreakGlass method)
src/views/partials/escalation.html (add escalate form, add break glass confirmation, add emergency contact card)
```

**Database:**
```
migrations/014_vmp_multi_company_groups.sql (includes vmp_break_glass_events table and director contact fields in vmp_groups)
```

---

#### 1.3 Add Case Row Refresh Partial
- [ ] **Route:** `app.get('/partials/case-row.html?case_id=...', ...)` in `server.js`
- [ ] **Partial:** `src/views/partials/case_row.html` (single row component)
- [ ] **Use Case:** HTMX polling or single-row updates without full inbox reload
- [ ] **Data:** Fetch single case, render as inbox row

**Files to Create:**
```
src/views/partials/case_row.html
```

**Files to Modify:**
```
server.js (add route)
```

---

### Acceptance Criteria

- [ ] Users can access `/cases/:id` directly and see full case detail
- [ ] Escalation action updates case escalation level
- [ ] Escalation panel refreshes after escalation
- [ ] Level 3 escalation requires confirmation dialog
- [ ] Level 3 escalation reveals Director contact details (Break Glass Protocol)
- [ ] Break Glass events are logged in audit trail
- [ ] Case row can be refreshed individually
- [ ] All routes follow existing patterns (snake_case files, kebab-case URLs)
- [ ] Design system compliance (VMP classes only)

---

## Sprint 2: Invoice Transparency + Manual Ingest (VMP-04)

**Duration:** 2 weeks  
**Priority:** 🔴 Critical  
**Goal:** Implement "Shadow Ledger" for manual invoice upload and 3-way matching status.

### Tasks

#### 2.1 Schema: Multi-Company Groups (Hierarchical Tenant Model)
*CRITICAL:* Add Group layer for "Director View" across multiple legal entities.
- [ ] **Migration:** `migrations/014_vmp_multi_company_groups.sql`
- [ ] **Table:** `vmp_groups` (id, tenant_id, name, code) - The "Alias" layer
- [ ] **Update:** Add `group_id` to `vmp_companies` (links companies to groups)
- [ ] **Update:** Add legal entity fields to `vmp_companies` (legal_name, tax_id, country_code, currency_code)
- [ ] **Update:** Add `group_id` to `vmp_cases` (denormalized for fast Director View filtering)
- [ ] **Update:** Add `erp_vendor_code` to `vmp_vendor_company_links` (ERP mapping per company)
- [ ] **Update:** Add RBAC scoping to `vmp_vendor_users` (scope_group_id, scope_company_id)
- [ ] **Purpose:** Enable "One Vendor Master → Many Companies → Grouped for monitoring"

**Files to Create:**
```
migrations/014_vmp_multi_company_groups.sql
```

---

#### 2.2 Schema: Shadow Ledger & Linked Refs
*CRITICAL:* We pull `linked_refs` forward to Sprint 2 to ensure data integrity immediately.
- [ ] **Migration:** `migrations/015_vmp_shadow_ledger.sql`
- [ ] **Table:** `vmp_invoices` (id, vendor_id, company_id, invoice_num, amount, date, status, source_system ['erp', 'manual'])
- [ ] **Table:** `vmp_po_refs` and `vmp_grn_refs` (simplified for matching)
- [ ] **Migration:** `migrations/016_vmp_cases_linked_refs.sql`
- [ ] **Fields:** Add `linked_invoice_id`, `linked_po_id` to `vmp_cases`
- [ ] **Note:** Invoices must include `company_id` (legal entity specific)

**Files to Create:**
```
migrations/015_vmp_shadow_ledger.sql
migrations/016_vmp_cases_linked_refs.sql
```

---

#### 2.3 Ops: Manual CSV Ingest (Foundation)
*Note: Full Command Center UI with scope selection in Sprint 6*
- [ ] **Route:** `app.get('/ops/ingest', ...)` (Internal Upload UI)
- [ ] **Page:** `src/views/pages/ops_ingest.html` (full page layout - basic version)
- [ ] **Route:** `app.post('/ops/ingest/invoices', ...)` (multipart/form-data)
- [ ] **Logic:** Parse CSV → Upsert into `vmp_invoices`
- [ ] **Feature:** Support standard "Open AP" report format (Invoice #, Date, Amount, PO #, Company Code)
- [ ] **Company Mapping:** Map CSV "Company Code" column to `vmp_companies.id` (or auto-create if needed)
- [ ] **Adapter:** Add `ingestInvoicesFromCSV(csvBuffer, vendorId, companyId)` to `src/adapters/supabase.js`
- [ ] **Validation:** Validate CSV format, handle duplicates (upsert by invoice_num + vendor_id + company_id)
- [ ] **Note:** Scope selection (Group vs Company) will be enhanced in Sprint 6

**Files to Create:**
```
src/views/pages/ops_ingest.html (basic version)
src/views/partials/invoice_ingest_form.html
```

**Files to Modify:**
```
server.js (add routes)
src/adapters/supabase.js (add ingestInvoicesFromCSV method)
```

---

#### 2.4 Implement Invoice List & Detail
- [ ] **Route:** `app.get('/invoices', ...)` in `server.js`
- [ ] **Page:** `src/views/pages/invoices.html` (full page layout)
- [ ] **Partial:** `src/views/partials/invoice_list.html` (HTMX cell)
- [ ] **Route:** `app.get('/partials/invoice-list.html', ...)` in `server.js`
- [ ] **Adapter:** `src/adapters/invoice_adapter.js` (reads from `vmp_invoices` table)
- [ ] **Display:** Show matching status (derived from `vmp_grn_refs` or manual status)
- [ ] **Features:** Filter by matching status, search by invoice number

**Files to Create:**
```
src/views/pages/invoices.html
src/views/partials/invoice_list.html
src/adapters/invoice_adapter.js
```

**Files to Modify:**
```
server.js (add routes)
```

---

#### 2.5 Implement Invoice Detail Route & Page
- [ ] **Route:** `app.get('/invoices/:id', ...)` in `server.js`
- [ ] **Page:** `src/views/pages/invoice_detail.html` (full page layout)
- [ ] **Partial:** `src/views/partials/invoice_detail.html` (HTMX cell)
- [ ] **Route:** `app.get('/partials/invoice-detail.html?invoice_id=...', ...)` in `server.js`
- [ ] **Data:** Fetch invoice detail from `vmp_invoices` table

**Files to Create:**
```
src/views/pages/invoice_detail.html
src/views/partials/invoice_detail.html
```

**Files to Modify:**
```
server.js (add routes)
```

---

#### 2.6 Implement Matching Status Partial
- [ ] **Route:** `app.get('/partials/matching-status.html?invoice_id=...', ...)` in `server.js`
- [ ] **Partial:** `src/views/partials/matching_status.html` (VMP-04-03)
- [ ] **Data:** Fetch matching status from `vmp_po_refs` and `vmp_grn_refs` tables
- [ ] **Display:** Show matching state (READY/WARN/BLOCK), exceptions list

**Files to Create:**
```
src/views/partials/matching_status.html
```

**Files to Modify:**
```
server.js (add route)
```

---

#### 2.7 Implement Invoice-to-Case Linking
- [ ] **Route:** `app.post('/invoices/:id/open-case', ...)` in `server.js`
- [ ] **Logic:** Create new case with `case_type='invoice'`, link `linked_invoice_id`
- [ ] **Adapter:** Add `createCaseFromInvoice(invoiceId, vendorId, ...)` to `src/adapters/supabase.js`
- [ ] **Auto-Fill:** Pre-fill case title with "Invoice #123 Exception"
- [ ] **Response:** Redirect to `/cases/:id` or return case detail fragment

**Files to Modify:**
```
server.js (add POST route)
src/adapters/supabase.js (add createCaseFromInvoice method)
```

---

### Acceptance Criteria

- [ ] Group layer created (`vmp_groups` table)
- [ ] Companies linked to groups (`group_id` in `vmp_companies`)
- [ ] Legal entity fields added (legal_name, tax_id, country_code, currency_code)
- [ ] Cases have `group_id` for Director View filtering
- [ ] RBAC scoping added to users (scope_group_id, scope_company_id)
- [ ] Shadow ledger tables created (`vmp_invoices`, `vmp_po_refs`, `vmp_grn_refs`)
- [ ] Invoices include `company_id` (legal entity specific)
- [ ] Linked refs added to `vmp_cases` table
- [ ] Internal users can upload invoice CSV via `/ops/ingest`
- [ ] CSV parsing maps Company Code to `vmp_companies.id`
- [ ] CSV parsing upserts invoices into `vmp_invoices` table
- [ ] Invoice list page displays invoices with matching status
- [ ] Invoice detail page shows full invoice information
- [ ] Matching status partial shows 3-way match state
- [ ] "Open Case" action creates invoice case and links it
- [ ] All routes follow existing patterns
- [ ] Design system compliance (VMP classes only)

---

## Sprint 3: Supplier Onboarding Flow (VMP-01)

**Duration:** 2 weeks  
**Priority:** 🔴 High  
**Goal:** Complete supplier onboarding. *Note: Start with standard checklist, add conditional logic later if needed.*

### Tasks

#### 3.1 Invite Generation (Internal - Basic)
*Note: Multi-company scope selection UI in Sprint 6*
- [ ] **Route:** `app.post('/ops/invites', ...)` in `server.js` (internal only)
- [ ] **Adapter:** Add `createInvite(vendorId, email, companyIds[], ...)` to `src/adapters/supabase.js`
- [ ] **Logic:** Generate secure token, set expiry, create invite record, create vendor-company links
- [ ] **Response:** Return invite details with token (for email sending)
- [ ] **Note:** Basic invite creation in Sprint 3, enhanced UI with multi-company selection in Sprint 6

**Files to Modify:**
```
server.js (add POST route)
src/adapters/supabase.js (add createInvite method)
```

---

#### 3.2 Accept Invite & Account Creation
- [ ] **Route:** `app.get('/accept?token=...', ...)` in `server.js`
- [ ] **Page:** `src/views/pages/accept.html` (full page layout)
- [ ] **Logic:** Verify token, show company relationship, password setup form
- [ ] **Validation:** Check token validity, expiry, already used
- [ ] **Route:** `app.post('/accept', ...)` in `server.js`
- [ ] **Logic:** Validate token, create user account, set password, activate invite
- [ ] **Adapter:** Add `createVendorUser(vendorId, email, passwordHash, ...)` to `src/adapters/supabase.js`
- [ ] **Response:** Redirect to onboarding checklist or `/home`

**Files to Create:**
```
src/views/pages/accept.html
```

**Files to Modify:**
```
server.js (add GET and POST routes)
src/adapters/supabase.js (add createVendorUser method)
```

---

#### 3.3 Onboarding Case & Checklist
- [ ] **Logic:** Auto-create `case_type='onboarding'` after accept
- [ ] **Adapter:** Add `createOnboardingCase(vendorId, ...)` to `src/adapters/supabase.js`
- [ ] **Checklist:** Render `case_checklist.html` with standard steps (Bank, Tax, Reg)
- [ ] **Note:** Start with standard checklist; conditional logic (vendor type/country) can be added later
- [ ] **Redirect:** After case creation, redirect to `/cases/:id` (onboarding case)

**Files to Modify:**
```
src/adapters/supabase.js (add createOnboardingCase method)
```

---

#### 3.4 Approval Workflow
- [ ] **Route:** `app.post('/cases/:id/approve-onboarding', ...)` in `server.js` (internal only)
- [ ] **Adapter:** Add `approveOnboarding(caseId, userId)` to `src/adapters/supabase.js`
- [ ] **Logic:** Mark onboarding case as resolved, activate vendor account (set `status='active'`)
- [ ] **Notification:** Notify vendor user of activation

**Files to Modify:**
```
server.js (add POST route)
src/adapters/supabase.js (add approveOnboarding method)
```

---

### Acceptance Criteria

- [ ] Internal users can generate invites
- [ ] Suppliers can accept invites via `/accept?token=...`
- [ ] Password setup creates vendor user account
- [ ] Onboarding case created automatically after account creation
- [ ] Onboarding checklist shows standard steps (Bank, Tax, Reg)
- [ ] Internal users can approve onboarding and activate vendor
- [ ] All routes follow existing patterns
- [ ] Design system compliance

---

## Sprint 4: Payment Visibility + Remittance Drop (VMP-06)

**Duration:** 1 week  
**Priority:** 🟡 Medium (High Value)
**Goal:** The "Adoption Carrot" — let suppliers see payment status via manual upload.

### Tasks

#### 4.1 Schema: Payments
- [ ] **Migration:** `migrations/017_vmp_payments.sql`
- [ ] **Table:** `vmp_payments` (id, vendor_id, amount, date, ref_num, source_system ['erp', 'manual'], remittance_url)
- [ ] **Fields:** Add `linked_payment_id` to `vmp_cases` (if not already in Sprint 2)

**Files to Create:**
```
migrations/017_vmp_payments.sql
```

---

#### 4.2 Ops: Bulk Payment Ingest
- [ ] **Route:** `app.post('/ops/ingest/payments', ...)` in `server.js` (multipart/form-data)
- [ ] **Logic:** Parse CSV (Payment Run) → Upsert `vmp_payments` → Update `vmp_invoices.status = 'PAID'`
- [ ] **Adapter:** Add `ingestPaymentsFromCSV(csvBuffer, vendorId)` to `src/adapters/supabase.js`
- [ ] **Feature:** Support standard payment run format (Payment Ref, Date, Amount, Invoice #)

**Files to Modify:**
```
server.js (add POST route)
src/adapters/supabase.js (add ingestPaymentsFromCSV method)
src/views/pages/ops_ingest.html (add payment ingest form)
```

---

#### 4.3 Ops: Remittance Drop
- [ ] **Route:** `app.post('/ops/ingest/remittances', ...)` in `server.js` (multipart/form-data)
- [ ] **Logic:** Bulk upload PDFs. Match filename (e.g., `INV-123.pdf`) to Invoice/Payment record.
- [ ] **Storage:** Save to bucket, link URL to `vmp_payments` record (update `remittance_url` field)
- [ ] **Adapter:** Add `ingestRemittances(files, vendorId)` to `src/adapters/supabase.js`

**Files to Modify:**
```
server.js (add POST route)
src/adapters/supabase.js (add ingestRemittances method)
src/views/pages/ops_ingest.html (add remittance drop form)
```

---

#### 4.4 Supplier Payment Views
- [ ] **Route:** `app.get('/payments', ...)` in `server.js`
- [ ] **Page:** `src/views/pages/payments.html` (full page layout)
- [ ] **Partial:** `src/views/partials/payment_list.html` (HTMX cell)
- [ ] **Route:** `app.get('/partials/payment-list.html', ...)` in `server.js`
- [ ] **Data:** Fetch payments from `vmp_payments` table
- [ ] **Route:** `app.get('/payments/:id', ...)` in `server.js`
- [ ] **Page:** `src/views/pages/payment_detail.html` (full page layout)
- [ ] **Partial:** `src/views/partials/remittance_viewer.html` (VMP-06-02)
- [ ] **Logic:** Embed PDF from storage (use `remittance_url` from `vmp_payments`)

**Files to Create:**
```
src/views/pages/payments.html
src/views/partials/payment_list.html
src/views/pages/payment_detail.html
src/views/partials/remittance_viewer.html
```

**Files to Modify:**
```
server.js (add routes)
```

---

### Acceptance Criteria

- [ ] Payment table created with remittance URL support
- [ ] Internal users can upload payment CSV via `/ops/ingest/payments`
- [ ] CSV parsing upserts payments and updates invoice status
- [ ] Internal users can bulk upload remittance PDFs
- [ ] Remittance PDFs matched to payments by filename
- [ ] Payment list page displays payment history
- [ ] Payment detail page shows payment information
- [ ] Remittance viewer displays PDF from storage
- [ ] All routes follow existing patterns
- [ ] Design system compliance

---

## Sprint 5: Supplier Profile & Compliance (VMP-02)

**Duration:** 1 week  
**Priority:** 🟡 Medium  
**Goal:** Self-service profile management.

### Tasks

#### 5.1 Profile Page
- [ ] **Route:** `app.get('/profile', ...)` in `server.js`
- [ ] **Page:** `src/views/pages/profile.html` (full page layout)
- [ ] **Data:** Fetch vendor profile, compliance docs, bank details
- [ ] **Adapter:** Add `getVendorProfile(vendorId)` to `src/adapters/supabase.js`

**Files to Create:**
```
src/views/pages/profile.html
```

**Files to Modify:**
```
server.js (add route)
src/adapters/supabase.js (add getVendorProfile method)
```

---

#### 5.2 Profile Read/Edit Partial
- [ ] **Partial:** `src/views/partials/profile_form.html` (HTMX cell)
- [ ] **Route:** `app.get('/partials/profile-form.html', ...)` in `server.js`
- [ ] **Features:** Display vendor master data, edit form (gated updates)
- [ ] **Validation:** Only allow certain fields to be edited by vendor

**Files to Create:**
```
src/views/partials/profile_form.html
```

**Files to Modify:**
```
server.js (add route)
```

---

#### 5.3 Bank Details Change (Gated)
- [ ] **Route:** `app.post('/profile/bank-details', ...)` in `server.js`
- [ ] **Logic:** Do NOT update DB directly. Create `case_type='payment'` linked to profile.
- [ ] **Requirement:** Enforce "Bank Letter" evidence upload.
- [ ] **Adapter:** Add `requestBankDetailsChange(vendorId, newBankDetails, userId)` to `src/adapters/supabase.js`
- [ ] **Workflow:** Bank change requires approval gate (internal review)
- [ ] **Response:** Return case detail or redirect to case

**Files to Modify:**
```
server.js (add POST route)
src/adapters/supabase.js (add requestBankDetailsChange method)
```

---

#### 5.4 Compliance Docs
- [ ] **Partial:** `src/views/partials/compliance_docs.html` (HTMX cell)
- [ ] **Route:** `app.get('/partials/compliance-docs.html', ...)` in `server.js`
- [ ] **Data:** Fetch compliance documents (tax forms, certificates, contracts)
- [ ] **Display:** List of compliance docs with upload/expiry status
- [ ] **Upload:** Reuse evidence upload system for compliance docs

**Files to Create:**
```
src/views/partials/compliance_docs.html
```

**Files to Modify:**
```
server.js (add route)
```

---

#### 5.5 Contract Library (Optional)
- [ ] **Partial:** `src/views/partials/contract_library.html` (HTMX cell)
- [ ] **Route:** `app.get('/partials/contract-library.html', ...)` in `server.js`
- [ ] **Data:** Fetch contracts (NDA, MSA, Indemnity)
- [ ] **Display:** Contract list with download links

**Files to Create:**
```
src/views/partials/contract_library.html
```

**Files to Modify:**
```
server.js (add route)
```

---

### Acceptance Criteria

- [ ] Profile page displays vendor master data
- [ ] Profile form allows gated updates
- [ ] Bank details change creates payment case with approval gate
- [ ] Compliance docs list shows tax/certificate status
- [ ] Contract library displays available contracts
- [ ] All routes follow existing patterns
- [ ] Design system compliance

---

## Sprint 6: Command Center (Internal Ops + Org Tree)

**Duration:** 1 week  
**Priority:** 🟡 Medium  
**Goal:** Build Command Center UI with Org Tree navigation, scoped dashboards, and manual data control.

### Tasks

#### 6.1 Command Center Layout with Org Tree Sidebar
- [ ] **Route:** `app.get('/ops', ...)` in `server.js` (internal only) - Command Center home
- [ ] **Page:** `src/views/pages/ops_command_center.html` (full page layout)
- [ ] **Partial:** `src/views/partials/org_tree_sidebar.html` (HTMX cell)
- [ ] **Route:** `app.get('/partials/org-tree-sidebar.html', ...)` in `server.js`
- [ ] **UI Pattern:** Collapsible tree structure
  - 📂 Tenant (Global View) - Super Admin only
  - 📂 Groups (e.g., "Retail Division") - Director View
  - 🏭 Companies (e.g., "Fashion Co.") - Manager View
- [ ] **Data:** Fetch tenant → groups → companies hierarchy based on user scope
- [ ] **Adapter:** Add `getOrgTree(userId, scopeType, scopeId)` to `src/adapters/supabase.js`
- [ ] **Navigation:** Clicking tree node updates dashboard scope (HTMX swap)

**Files to Create:**
```
src/views/pages/ops_command_center.html
src/views/partials/org_tree_sidebar.html
```

**Files to Modify:**
```
server.js (add routes)
src/adapters/supabase.js (add getOrgTree method)
```

---

#### 6.2 Scoped Dashboard (Director vs Manager View)
- [ ] **Route:** `app.get('/ops/dashboard', ...)` in `server.js` (internal only)
- [ ] **Page:** `src/views/pages/ops_dashboard.html` (full page layout)
- [ ] **Partial:** `src/views/partials/scoped_dashboard.html` (HTMX cell)
- [ ] **Route:** `app.get('/partials/scoped-dashboard.html?scope_type=...&scope_id=...', ...)` in `server.js`
- [ ] **Director View (Group Scope):**
  - [ ] Aggregate metrics: Total AP Exposure (sum across all companies in group)
  - [ ] Critical Cases: Count escalations per company
  - [ ] Vendor Performance: SLA failures across entire group
  - [ ] Data: Query `vmp_cases` WHERE `group_id = scope_id`
- [ ] **Manager View (Company Scope):**
  - [ ] Company-specific metrics: AP Exposure for single company
  - [ ] Critical Cases: Escalations for this company only
  - [ ] Vendor Performance: SLA for vendors linked to this company
  - [ ] Data: Query `vmp_cases` WHERE `company_id = scope_id`
- [ ] **Adapter:** Add `getScopedDashboard(scopeType, scopeId, userId)` to `src/adapters/supabase.js`

**Files to Create:**
```
src/views/pages/ops_dashboard.html
src/views/partials/scoped_dashboard.html
```

**Files to Modify:**
```
server.js (add routes)
src/adapters/supabase.js (add getScopedDashboard method)
```

---

#### 6.3 Ops Case Queue (Scoped)
- [ ] **Route:** `app.get('/ops/cases', ...)` in `server.js` (internal only)
- [ ] **Page:** `src/views/pages/ops_cases.html` (full page layout)
- [ ] **Partial:** `src/views/partials/ops_case_queue.html` (HTMX cell)
- [ ] **Route:** `app.get('/partials/ops-case-queue.html?scope_type=...&scope_id=...', ...)` in `server.js`
- [ ] **Data:** Fetch cases filtered by scope (group_id OR company_id) + owner_team
- [ ] **Features:** Tabs for each queue (procurement/AP/finance), filter by status, reassign actions
- [ ] **RBAC:** Apply scope filtering based on user's `scope_group_id` or `scope_company_id`

**Files to Create:**
```
src/views/pages/ops_cases.html
src/views/partials/ops_case_queue.html
```

**Files to Modify:**
```
server.js (add routes)
src/adapters/supabase.js (update getInbox to support scope filtering)
```

---

#### 6.4 Internal Ops Case Detail
- [ ] **Route:** `app.get('/ops/cases/:id', ...)` in `server.js` (internal only)
- [ ] **Page:** `src/views/pages/ops_case_detail.html` (full page layout)
- [ ] **Reuse:** Same partials as vendor case detail (different permissions)
- [ ] **Features:** Additional internal actions (verify, reject, reassign, update status)
- [ ] **RBAC:** Verify user has access to case's group/company

**Files to Create:**
```
src/views/pages/ops_case_detail.html
```

**Files to Modify:**
```
server.js (add route)
```

---

#### 6.5 Vendor Directory with Multi-Company Support
- [ ] **Route:** `app.get('/ops/vendors', ...)` in `server.js` (internal only)
- [ ] **Page:** `src/views/pages/ops_vendors.html` (full page layout)
- [ ] **Partial:** `src/views/partials/vendor_directory.html` (HTMX cell)
- [ ] **Route:** `app.get('/partials/vendor-directory.html?scope_type=...&scope_id=...', ...)` in `server.js`
- [ ] **Data:** Fetch vendors with onboarding status, case counts, company links
- [ ] **Features:** Search, filter by status, view vendor profile, see which companies vendor serves
- [ ] **Display:** Show vendor's ERP codes per company (from `vmp_vendor_company_links`)

**Files to Create:**
```
src/views/pages/ops_vendors.html
src/views/partials/vendor_directory.html
```

**Files to Modify:**
```
server.js (add routes)
```

---

#### 6.6 Enhanced Inviter (Multi-Company Scope Selection)
- [ ] **Route:** `app.get('/ops/invites/new', ...)` in `server.js` (internal only)
- [ ] **Page:** `src/views/pages/ops_invite_new.html` (full page layout)
- [ ] **Partial:** `src/views/partials/invite_form.html` (HTMX cell)
- [ ] **Route:** `app.post('/ops/invites', ...)` in `server.js` (internal only)
- [ ] **Features:**
  - [ ] Enter Supplier Email & Name
  - [ ] **Scope Selection:** Checkbox list of Groups/Companies vendor will serve
  - [ ] **Group Auto-Select:** Checking a Group auto-selects all child companies
  - [ ] **Company Links:** Create `vmp_vendor_company_links` records for selected companies
- [ ] **Adapter:** Update `createInvite` to accept `companyIds[]` array

**Files to Create:**
```
src/views/pages/ops_invite_new.html
src/views/partials/invite_form.html
```

**Files to Modify:**
```
server.js (add routes)
src/adapters/supabase.js (update createInvite method)
```

---

#### 6.7 Manual Ingest UI (Scoped)
- [ ] **Route:** `app.get('/ops/ingest', ...)` in `server.js` (internal only)
- [ ] **Page:** `src/views/pages/ops_ingest.html` (full page layout)
- [ ] **Partial:** `src/views/partials/ingest_target_selector.html` (HTMX cell)
- [ ] **Target Selection:**
  - [ ] Dropdown/Selector: Choose "Retail Division" (Group) OR "Fashion Co." (Company)
  - [ ] **Group Selection:** Ingest applies to all companies in group
  - [ ] **Company Selection:** Ingest applies to single company only
- [ ] **Upload Forms:** Invoice CSV and Payment CSV (already in Sprint 2, enhance with scope)
- [ ] **Adapter:** Update `ingestInvoicesFromCSV` to accept `scopeType` and `scopeId`

**Files to Create:**
```
src/views/partials/ingest_target_selector.html
```

**Files to Modify:**
```
src/views/pages/ops_ingest.html (enhance with target selector)
src/adapters/supabase.js (update ingest methods to support scope)
```

---

#### 6.8 Data Ingest History
- [ ] **Route:** `app.get('/ops/data-history', ...)` in `server.js` (internal only)
- [ ] **Page:** `src/views/pages/ops_data_history.html` (full page layout)
- [ ] **Partial:** `src/views/partials/data_ingest_history.html` (HTMX cell)
- [ ] **UI:** Show log of CSV uploads (Invoices/Payments) with scope information
- [ ] **Migration:** Create `migrations/018_vmp_ingest_log.sql` (id, type, filename, records_count, scope_type, scope_id, uploaded_by, created_at)
- [ ] **Action:** "Undo/Rollback" last upload (Soft delete created records)
- [ ] **Adapter:** Add `logIngest(type, filename, recordsCount, scopeType, scopeId, userId)` and `rollbackIngest(ingestLogId)` to `src/adapters/supabase.js`

**Files to Create:**
```
migrations/018_vmp_ingest_log.sql
src/views/pages/ops_data_history.html
src/views/partials/data_ingest_history.html
```

**Files to Modify:**
```
server.js (add routes)
src/adapters/supabase.js (add logIngest and rollbackIngest methods)
```

---

### Acceptance Criteria

- [ ] Command Center home page (`/ops`) displays with Org Tree Sidebar
- [ ] Org Tree shows hierarchical structure (Tenant → Groups → Companies)
- [ ] Org Tree navigation updates dashboard scope via HTMX
- [ ] Director Dashboard aggregates data across all companies in group
- [ ] Manager Dashboard shows data for single company only
- [ ] Case Queue respects scope filtering (group or company)
- [ ] Vendor Directory shows multi-company relationships
- [ ] Inviter supports multi-company scope selection
- [ ] Manual Ingest UI allows target selection (Group or Company)
- [ ] Data Ingest History shows scope information
- [ ] All routes require internal user permission (RBAC)
- [ ] All routes follow existing patterns
- [ ] Design system compliance

---

## Sprint 7: SLA & Polish (VMP-03)

**Duration:** 1 week  
**Priority:** 🟢 Polish

### Tasks

#### 7.1 SLA Reminders
- [ ] **Adapter:** Add `getCasesWithSLAApproaching(thresholdHours)` to `src/adapters/supabase.js`
- [ ] **Notification:** Create notifications for cases approaching SLA
- [ ] **Cron/Job:** Set up background job to check SLA and create reminders
- [ ] **UI:** Display SLA warnings in case detail and inbox

**Files to Modify:**
```
src/adapters/supabase.js (add getCasesWithSLAApproaching method)
```

---

#### 7.2 Decision Log
- [ ] **Migration:** Create `migrations/019_vmp_decision_log.sql`
- [ ] **Table:** `vmp_decision_log` (case_id, decision_type, who, what, why, created_at)
- [ ] **Adapter:** Add `logDecision(caseId, decisionType, who, what, why)` to `src/adapters/supabase.js`
- [ ] **Partial:** `src/views/partials/decision_log.html` (VMP-03-05)
- [ ] **Route:** `app.get('/partials/decision-log.html?case_id=...', ...)` in `server.js`
- [ ] **Integration:** Log decisions on verify, reject, reassign, status update

**Files to Create:**
```
migrations/019_vmp_decision_log.sql
src/views/partials/decision_log.html
```

**Files to Modify:**
```
server.js (add route)
src/adapters/supabase.js (add logDecision method)
```

---

### Acceptance Criteria

- [ ] SLA reminders created for cases approaching due date
- [ ] Decision log displays who/what/why for all case decisions
- [ ] Decisions logged automatically on case actions
- [ ] All routes follow existing patterns
- [ ] Design system compliance

---

## Sprint 8: Domain Object Polish

**Duration:** 1 week  
**Priority:** 🟢 Polish

### Tasks

#### 8.1 Tags
- [ ] **Migration:** Create `migrations/020_vmp_cases_tags.sql`
- [ ] **Field:** Add `tags JSONB` to `vmp_cases`
- [ ] **Adapter:** Update `createCase` and `updateCase` to handle tags
- [ ] **UI:** Display tags in case detail, add tag management

**Files to Create:**
```
migrations/020_vmp_cases_tags.sql
```

**Files to Modify:**
```
src/adapters/supabase.js (update methods)
src/views/partials/case_detail.html (display tags)
```

---

#### 8.2 Assigned To
- [ ] **Migration:** Create `migrations/021_vmp_cases_assigned_to.sql`
- [ ] **Field:** Add `assigned_to_user_id` to `vmp_cases`
- [ ] **Adapter:** Update `reassignCase` to set assigned_to
- [ ] **UI:** Display assigned user in case detail

**Files to Create:**
```
migrations/021_vmp_cases_assigned_to.sql
```

**Files to Modify:**
```
src/adapters/supabase.js (update reassignCase)
src/views/partials/case_detail.html (display assigned user)
```

---

#### 8.3 Metadata
- [ ] **Migration:** Create `migrations/022_vmp_messages_metadata.sql`
- [ ] **Field:** Add `metadata JSONB` to `vmp_messages`
- [ ] **Adapter:** Update `createMessage` to handle metadata
- [ ] **Use Case:** Store channel-specific metadata (WhatsApp message ID, email headers, etc.)

**Files to Create:**
```
migrations/022_vmp_messages_metadata.sql
```

**Files to Modify:**
```
src/adapters/supabase.js (update createMessage)
```

---

#### 8.4 Contract Case Type
- [ ] **Migration:** Create `migrations/023_vmp_cases_contract_type.sql`
- [ ] **Update:** Add `'contract'` to `case_type` CHECK constraint
- [ ] **Adapter:** Update case creation to allow contract type

**Files to Create:**
```
migrations/023_vmp_cases_contract_type.sql
```

**Files to Modify:**
```
src/adapters/supabase.js (update createCase)
```

---

### Acceptance Criteria

- [ ] Cases support tags for categorization
- [ ] Cases can be assigned to specific users
- [ ] Messages support metadata for channel-specific data
- [ ] Contract case type available
- [ ] All migrations apply cleanly
- [ ] All routes follow existing patterns

---

## Technical Checklist (Per Sprint)

1.  **Define Schema:** Create migration file (`migrations/XXX_name.sql`).
2.  **Define Routes:** Add to `server.js` (dummy response first).
3.  **Create View/Partial:** Create HTML with HTMX attributes.
4.  **Implement Logic:** Add Adapter method in `src/adapters/`.
5.  **Connect:** Update route to call Adapter.
6.  **Verify:** Test Manual Ingest (CSV) -> Supplier View data flow.

---

## Success Metrics

After completion of all sprints:

- [ ] **VMP-01** Supplier Onboarding: 100% complete
- [ ] **VMP-02** Supplier Profile: 100% complete
- [ ] **VMP-03** Collaboration Spine: 100% complete
- [ ] **VMP-04** Invoice Transparency: 100% complete
- [ ] **VMP-05** Evidence Exchange: 100% complete (already done)
- [ ] **VMP-06** Payment Visibility: 100% complete
- [ ] **VMP-07** SOA Mapping: 0% (optional, future)

**Overall Target:** 85%+ completion of MVP features

---

**Document Status:** ✅ Complete  
**Last Updated:** 2025-12-21  
**Next Review:** After Sprint 1 completion
