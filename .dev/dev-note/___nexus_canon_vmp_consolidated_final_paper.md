# NexusCanon VMP (Vendor Management Portal)

> **Positioning:** Supplier Facade + Collaboration Spine + Headless Truth Engine (AI-BOS Canon)

**Document Status:** SSOT Development Document  
**Last Updated:** 2025-12-20  
**Version:** v0.1.0

## 0) One-liner
**NexusCanon VMP** is the supplier-facing (and internal-facing) **case + evidence** operating surface that turns supplier onboarding, invoice exceptions, missing documents, and payment questions into **auditable, structured Cases**—while allowing suppliers to communicate through **their preferred channels (WhatsApp/Email/Portal)** via pluggable **Ports**.

---

## 1) Purpose
### 1.1 What problem we kill
- “WhatsApp procurement / AP chaos” (missing PDFs, scattered approvals, no audit trail)
- Endless AP chasing (40% of time spent on missing/mismatched evidence)
- Supplier anxiety (“I sent it already”, “who is handling this”, “why not paid?”)
- Fragmented accountability (procurement vs AP vs finance silos)

### 1.2 What VMP becomes
- **Single Source of Interaction Truth** for supplier-facing workflow
- **Supplier Support Desk for Supply Chain** (service-management model)
- **Evidence Vault** + **Case Thread** + **Matching/Payment Visibility**

---

## 2) Design Constitution (Non-Negotiables)
### 2.1 Everything is a Case
Every supplier interaction must attach to a Case:
- Onboarding Case
- Invoice Case (3-way match, missing GRN, variances)
- Payment Case (bank details, remittance, payment run status)
- Contract/Compliance Case
- SOA/Statement Case
- General Inquiry Case (the “black hole” that normally becomes email/WhatsApp)

### 2.2 Evidence-first UI
- A Case cannot progress without required evidence **unless** an authorized override path exists.
- Evidence must be:
  - Tagged to Case
  - Versioned
  - Permission-scoped
  - Immutable-audited

### 2.3 Omnichannel via Ports (don’t kill WhatsApp, bridge it)
- WhatsApp / Email / Slack / Portal are **Ports**.
- VMP is the **Truth Engine**.
- Internal staff never needs to open WhatsApp.

### 2.4 CRUD + MCP simplicity
Every Cell exposes consistent actions:
- **Create** (submit query, upload invoice/SOA/doc)
- **Read** (view status, view ledger-facing projections)
- **Update** (add missing evidence, correct bank info)
- **Delete/Void** (soft-delete only; internal immutable audit)

### 2.5 AI AP Enforcer (Agentic Shield)
- Supplier conversations are first handled by AI.
- If data is not clean → AI requests missing artifacts.
- Human AP steps in only after data meets the minimum integrity threshold.

### 2.6 Safety Valve escalation hierarchy
- Level 1: AI Agent (instant)
- Level 2: AP Manager (Case assignment)
- Level 3: “Break-glass” visibility of escalation contact (GM/Director)

---

## 3) AI-BOS LEGO Architecture Fit
### 3.1 Placement
- **Kernel** governs identity, tenancy, audit, routing, notifications, storage primitives.
- **Canon: NexusCanon VMP** owns Cases, Messages, Evidence, and supplier-facing workflows.
- **Finance/AP Canon(s)** remain the source of transactional truth.

### 3.2 Hexagonal boundary
VMP never hard-codes Finance/AP internals.
- VMP depends on **Ports** (interfaces)
- Adapters connect to:
  - AI-BOS AP engine
  - Legacy ERP (migration bridge)
  - External ERP (future extension)

---

## 4) Canon Map (Molecules → Cells)

### Molecule VMP-01 — Supplier Onboarding
- VMP-01-01 Invite / Activate Supplier
- VMP-01-02 Supplier Register / Accept Invite
- VMP-01-03 Conditional Checklist Engine (branching by vendor type/country)
- VMP-01-04 Verification Workflow (procurement / AP review)
- VMP-01-05 Approval & Activation

### Molecule VMP-02 — Supplier Profile & Compliance Vault
- VMP-02-01 Supplier Master Profile
- VMP-02-02 Bank Details Change (with approval gates)
- VMP-02-03 Tax / Certificates / Compliance Docs
- VMP-02-04 Contract Library (NDA/MSA/Indemnity)

### Molecule VMP-03 — Collaboration Spine (Case OS)
- VMP-03-01 Case Inbox (triage)
- VMP-03-02 Threaded Conversation (WhatsApp-speed)
- VMP-03-03 Task / Checklist Panel
- VMP-03-04 SLA + Reminders
- VMP-03-05 Decision Log (who/what/why)

### Molecule VMP-04 — Invoice Transparency (3-Way Matching Facade)
- VMP-04-01 Invoice List
- VMP-04-02 Invoice Detail
- VMP-04-03 Matching Status (PO/GRN/Invoice)
- VMP-04-04 Exceptions (reason → action → evidence)

### Molecule VMP-05 — Evidence Exchange
- VMP-05-01 Upload
- VMP-05-02 Tagging & Linking
- VMP-05-03 Versioning
- VMP-05-04 Access Control + Audit

### Molecule VMP-06 — Payment Visibility
- VMP-06-01 Payment Status
- VMP-06-02 Remittance Viewer
- VMP-06-03 Payment History

### Molecule VMP-07 — SOA / Statement Mapping (optional module)
- VMP-07-01 SOA Upload
- VMP-07-02 Auto Match
- VMP-07-03 Exceptions + Confirmation
- VMP-07-04 Acknowledgement

---

## 5) Core Domain Objects (Truth Engine)

### 5.1 Case
- case_id, tenant_id, group_company_id, vendor_id
- case_type: onboarding | invoice | payment | contract | soa | general
- linked_refs: invoice_id / po_id / grn_id / payment_id (optional)
- status: open | waiting_supplier | waiting_internal | resolved | blocked
- owner_team: procurement | AP | finance
- assigned_to (user/team)
- sla_due_at
- tags

### 5.2 Message
- message_id, case_id
- channel_source: portal | whatsapp | email | slack
- sender_party: vendor | internal | ai
- body, attachments[], metadata
- created_at (immutable)

### 5.3 Evidence
- evidence_id, case_id
- evidence_type: invoice_pdf | grn | delivery_note | bank_letter | tax_form | contract | misc
- file_ref, version, checksum
- required_by (optional: checklist_step_id)
- access_scope

### 5.4 Checklist Step
- step_id, case_id
- rule_expression (conditional)
- required_evidence_types[]
- status: required | submitted | verified | rejected | waived

---

## 6) Ports & Adapters (Omnichannel + ERP)

### 6.1 Input/Output Ports (Channels)
- Portal UI Port
- WhatsApp Port (bridge)
- Email Port (email-to-case)
- Slack Port (internal)

### 6.2 Business Ports (ERP truth)
- InvoiceReadPort
- MatchingReadPort
- PaymentReadPort
- VendorMasterReadPort (optional)

### 6.3 Adapter examples
- AP Adapter (AI-BOS native)
- Legacy Adapter (Autocount / migration)
- External ERP Adapter (future)

---

## 7) AI Agent: “AI AP Enforcer”

### 7.1 Responsibilities
- Parse incoming messages (WhatsApp/email) → classify → attach to correct Case
- Validate minimum data integrity:
  - invoice number, PO reference, company relationship
  - required doc presence
- Respond with **actionable requests**:
  - “Upload PDF here”
  - “GRN missing; request delivery note”
  - “Bank letter required for payout change”

### 7.2 Human handoff
- AI escalates to AP Manager only when:
  - evidence threshold met, or
  - supplier invokes escalation, or
  - SLA breach

---

## 8) Queue Model (Internal Ops)

### Principle: Separate Queues with Handoffs
- Procurement Queue: onboarding, contracts, pricing/terms
- AP Queue: bank, tax, invoice evidence, matching exceptions
- Handoff occurs by reassigning Case owner_team

---

## 9) UX Blueprint (fast, modern, auditable)

### 9.1 Supplier “Home”
- Posture: Ready / Blocked / Action Required
- Case Inbox (chat-like)
- Payment visibility (the adoption carrot)
- Escalation Cell always visible

### 9.2 Case Detail (the 90% screen)
- Left: Evidence Checklist + required actions
- Right: Threaded conversation (WhatsApp feel)
- Top: Case status + SLA + owner
- Bottom: Upload quick actions

---

## 10) Implementation Status & Design System Compliance

### 10.1 Design System Contract (CONTRACT-001)

**Reference:** `.dev/dev-contract/contract-001-design-system.md` (LOCKED v1.0.1)

The VMP design system follows a **"Deep Void"** aesthetic with strict policy enforcement:
- **SSOT:** `public/globals.css` is the sole styling authority
- **NO inline styles:** All templates must use CSS classes only
- **NO shadows, NO bold:** Policy clamps enforce flat aesthetic
- **AHA Stack:** Alpine.js + HTMX + Tailwind CDN (no custom config)
- **HTML Scope:** `html[data-surface="vmp"]` scopes all VMP styles

### 10.2 Compliance Status (2025-12-20)

✅ **Design System Compliance Achieved:**
- All inline `style=` attributes removed from templates
- Signal helper classes added to `globals.css`:
  - `.vmp-signal-ok`, `.vmp-signal-warn`, `.vmp-signal-danger` (text colors)
  - `.vmp-fill-ok`, `.vmp-fill-warn`, `.vmp-fill-danger` (background colors)
- Templates updated:
  - `src/views/pages/home.html` (protocol capsule)
  - `src/views/partials/case_detail.html` (checklist statuses)
  - `src/views/partials/case_inbox.html` (status tags)
- FX layers (`.vmp-noise`, `.vmp-grid`) implemented in layout
- Policy clamps active (no shadows, no bold weights)

### 10.3 Current Implementation State

**Phase 0 — Foundation & Shell** (In Progress)
- ✅ Layout shell with sidebar navigation
- ✅ Design system compliance (CONTRACT-001)
- ✅ Home page with Case Inbox + Truth Panel structure
- ✅ HTMX partials: `case-inbox`, `case-detail` (stub)
- ⏳ Database schema (pending)
- ⏳ Authentication integration (pending)
- ⏳ Server routing (partial)

**Next Immediate Steps:**
1. Complete database schema for Cases, Messages, Evidence
2. Implement server endpoints for HTMX partials
3. Connect Supabase adapter for data persistence
4. Add authentication middleware

---

## 11) Risks & Safety Controls

### 10.1 Email reply behavior
Suppliers will reply to notifications → must support email-to-case append.

### 10.2 Over-rigidity
Evidence-first must have controlled override:
- “Waive requirement” with justification
- “Emergency pay override” with approvals + audit stamp

### 10.3 Privacy shield
- Suppliers never see internal identities unless allowed.
- Internal staff interact only via Portal; ports mask personal contact details.

---

## 12) Rollout & Activation

### MVP (minimum that solves WhatsApp)
- Cases + Threads + Evidence Vault
- Supplier onboarding checklist
- Payment visibility
- WhatsApp bridge (optional pilot)

### Phase 2
- Email-to-case
- SOA mapping
- SLA analytics

---

## 13) Success Metrics
- % invoices with complete evidence on first submission
- Reduction in AP "chasing" time
- Avg time-to-resolution per Case type
- Supplier satisfaction (time-to-answer)
- Audit readiness: complete traceability per payment

---

## 14) NexusCanon Command Center Architecture

**Version:** 2.0 (Hybrid + Multi-Tenant)  
**Purpose:** Enable a "God View" for holding companies while preserving strict legal entity isolation for invoices/payments.  
**Core Philosophy:** "One Vendor Master, Many Legal Entities, One Truth."

### 14.1 The Hierarchical Data Model (The Tree)

To solve the "Group of Companies" requirement, we move from a flat list to a strict 3-tier hierarchy. This allows you to monitor performance via "Alias" groups while managing tax/payments at the legal entity level.

#### 14.1.1 The Tier Structure

1. **Tenant (Root):** The Conglomerate (You). Owns all data, users, and the Global Vendor Master.
2. **Group (Alias/Branch):** A logical container for management.
   - *Example:* "Retail Division" or "North Region".
   - *Function:* Aggregates reporting. A "Director" is assigned here to see across all child companies.
3. **Company (Leaf/Entity):** The specific Legal Entity with a Tax ID.
   - *Example:* "Fashion Co. Ltd" (VAT: 123) and "Sports Co. Ltd" (VAT: 456).
   - *Function:* Owns Invoices, Payments, and Bank Accounts.

#### 14.1.2 The "One Vendor" Strategy

We avoid duplicate vendor records.

- **Global Vendor Master:** `vmp_vendors` exists at the **Tenant** level.
- **Local Authorization:** `vmp_vendor_company_links` authorizes a vendor to trade with a specific Company and assigns the local ERP code (e.g., `V-1001`).

### 14.2 The Headless ERP & Hybrid Ingest Engine (The "Shadow Ledger")

**Status:** ✅ **Production-Ready (Sprint 2, 2025-12-22)**

VMP functions as a **standalone Headless ERP** for clients without API integrations. The system maintains its own **Shadow Ledger** that serves as the single source of truth for supplier-facing invoice and payment data.

#### 14.2.1 The "Shadow Ledger" Architecture

We do not rely on the ERP being online. VMP maintains its own lightweight ledger:

- **`vmp_invoices`:** Stores the "Truth" of what the supplier should see.
  - `source_system`: `'manual'` (CSV upload) OR `'erp'` (future API sync)
  - `status`: `'pending'`, `'matched'`, `'paid'`, `'disputed'`, `'cancelled'`
  - `company_id`: Links to legal entity (multi-company support)
  - `po_ref`, `grn_ref`: 3-way matching references
- **`vmp_po_refs`:** Purchase Order references for matching
- **`vmp_grn_refs`:** Goods Receipt Note references for matching
- **`vmp_payments`:** Payment run data (Sprint 4)

**Key Achievement:** VMP can operate **completely independently** of external ERP systems via CSV ingest, enabling rapid deployment for clients without API infrastructure.

#### 14.2.2 The CSV Ingest Engine (Production Implementation)

**Location:** `/ops/ingest/invoices` (Internal Ops only)

**Technology Stack:**
- **Parser:** `csv-parse` (v6.1.0) - Robust CSV parsing with quoted field support
- **Upload:** `multer` (v1.4.5-lts.1) - Multipart form-data handling
- **Flexible Column Mapping:** Case-insensitive, handles variations:
  - Invoice #, Invoice, Invoice Number, Inv #, Inv Num
  - Date, Invoice Date, Doc Date, Document Date
  - Amount, Invoice Amount, Total, Total Amount
  - PO #, PO, PO Number, Purchase Order (optional)
  - Company Code, Company, Company ID (optional)
  - Description, Desc, Notes (optional)

**Workflow:**
1. **Select Target:** Admin selects Company (legal entity) for invoice assignment
2. **Upload CSV:** "Open AP Report" format (flexible column mapping)
3. **Harmonization:**
   - System parses CSV with robust error handling (per-row validation)
   - Maps CSV columns to `vmp_invoices` schema
   - Upserts invoices (updates existing, inserts new) by `invoice_num + vendor_id + company_id`
   - Optional: Company code lookup (overrides provided company_id if CSV contains company code)
4. **Result:** Suppliers see updated invoice status instantly in their dashboard

**Error Handling:**
- Per-row validation with detailed error messages
- Continues processing on row errors (graceful degradation)
- Returns summary: `{ total, upserted, failed, errors, failures }`

**Production Features:**
- ✅ Handles quoted fields, commas in values, newlines
- ✅ Flexible column mapping (handles common ERP export variations)
- ✅ Upsert logic (idempotent - safe to re-run same CSV)
- ✅ Company code lookup (optional override)
- ✅ Comprehensive error reporting

### 14.3 The "Command Center" UI (Admin Dashboard)

This is the interface for the "Common Director" and "Ops Manager".

#### 14.3.1 Sidebar: The Org Navigator

Instead of a flat menu, the sidebar is a collapsible tree:

- 📂 **My Holding Corp** (Global View)
- 📂 **Retail Division** (Group View - *Director's Home*)
- 🏭 **Fashion Co.** (Entity View - *AP Manager's Home*)
- 🏭 **Sports Co.** (Entity View)

#### 14.3.2 The "Director's Dashboard" (Scope: Group)

When a Director selects "Retail Division", the dashboard aggregates data:

- **Total AP Exposure:** Sum of Fashion Co. + Sports Co.
- **Critical Cases:** "3 escalations in Fashion Co., 0 in Sports Co."
- **Vendor Performance:** "Supplier X is failing SLA across the entire group."

#### 14.3.3 The "Inviter" (Onboarding Control)

When inviting a supplier:

1. **Who:** Enter Supplier Email & Name.
2. **Scope:** Checkbox selection of which Companies they serve.
   - ☑️ **Retail Division** (Auto-selects all child companies).
3. **Result:** Supplier gets **one account** but can select "Fashion Co." or "Sports Co." from a dropdown when uploading an invoice.

### 14.4 The "Break Glass" Protocol (Supplier UI)

This is the safety valve for when the digital process fails. It is strictly controlled to prevent abuse.

#### 14.4.1 The UI Pattern (in Case Detail)

1. **Standard State:**
   - The "Escalation Zone" shows a generic "Request Management Review" button.
   - *Director contact details are hidden.*

2. **The "Break Glass" Action:**
   - Supplier clicks "Escalate".
   - System requires confirmation: *"This will log an incident with the Group Director."*

3. **The "Red Phone" State (Revealed):**
   - The UI swaps to show the **Emergency Contact Card**.
   - **Name:** "John Smith (Director, Retail Division)"
   - **Phone/Email:** Revealed.
   - **Audit:** A log entry is created: `GLASS_BROKEN` by `user_id` at `timestamp`.

### 14.5 Security & Access Model (RBAC)

We define visibility based on the Hierarchy Tree.

| Role | Scope ID | Visibility | Use Case |
| --- | --- | --- | --- |
| **Super Admin** | `tenant_id` | **Everything.** Can edit the Tree structure. | IT / System Owner |
| **Group Director** | `group_id` | **Aggregated.** Sees all child Companies. | "Common Director" |
| **Entity Manager** | `company_id` | **Isolated.** Sees only their legal entity. | Finance / AP Staff |

### 14.6 Implementation Strategy

This architecture is executed across planned Sprints:

- **Sprint 1:** Break Glass Protocol (escalation with contact reveal)
- **Sprint 2 (Foundation):**
  - Create `vmp_groups`, `vmp_companies`, `vmp_vendor_company_links` tables.
  - Implement "Shadow Ledger" (`vmp_invoices`) with `company_id` foreign key.
  - *Why:* You cannot ingest data without knowing where it lands in the tree.
- **Sprint 6 (Ops & Command Center):**
  - Build the **Org Tree Sidebar**.
  - Build the **Scoped Dashboard** (Director vs. Manager view).
  - Build the **Manual Ingest UI** (`/ops/ingest`).

### 14.7 Production Infrastructure: Session Store (PostgreSQL)

**Status:** ✅ **Production-Ready (2025-12-22)**  
**Critical:** Required for production deployment

#### 14.7.1 The Problem

Initial implementation used `cookie-session` (in-memory) which:
- ❌ **Memory Leaks:** Sessions accumulate in server memory
- ❌ **Deployment Logouts:** All users logged out on every deploy/restart
- ❌ **No Persistence:** Sessions lost on server crash
- ❌ **Scalability:** Cannot scale horizontally (sessions tied to single server)

#### 14.7.2 The Solution: PostgreSQL Session Store

**Technology:** `express-session` + `connect-pg-simple`

**Architecture:**
- Sessions stored in PostgreSQL `session` table (Supabase database)
- Uses Supabase connection pooling for performance
- Automatic session cleanup (expired sessions removed)
- Horizontal scaling support (multiple servers share same session store)

**Migration:** `migrations/019_vmp_sessions_table.sql`
```sql
CREATE TABLE "session" (
  "sid" varchar NOT NULL PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);
CREATE INDEX "IDX_session_expire" ON "session" ("expire");
```

**Configuration:**
- **Environment Variable:** `SESSION_DB_URL` (PostgreSQL connection string)
- **Format:** `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
- **Source:** Supabase Dashboard → Settings → Database → Connection Pooling

**Benefits:**
- ✅ **Persistent Sessions:** Survive server restarts
- ✅ **Zero Logouts:** Users stay logged in across deployments
- ✅ **Scalable:** Multiple app instances share session store
- ✅ **Auditable:** Session data stored in database (compliance)
- ✅ **Simple Stack:** No Redis required (uses existing Supabase PostgreSQL)

**Development Fallback:**
- Development mode uses MemoryStore with warning (for local dev without DB config)
- Production requires `SESSION_DB_URL` or errors on startup

**Implementation Status:**
- ✅ Migration created (`019_vmp_sessions_table.sql`)
- ✅ `express-session` + `connect-pg-simple` installed
- ✅ Server.js updated to use PostgreSQL session store
- ✅ Login/logout routes updated to use `express-session` API
- ✅ Deployment guide updated with configuration instructions

---

**Document Status:** SSOT Development Document  
**Last Updated:** 2025-12-22  
**Version:** v0.2.1 (Session Store Infrastructure Added)

