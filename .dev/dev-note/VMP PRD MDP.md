Below are **3 standardized documents** (each with **Header · Version · DoD**) for **NexusCanon VMP on AHA (Alpine + HTMX + HTML)**, aligned to your consolidated canon + AHA wireframe blueprint.  

---

# 1) PRD — NexusCanon VMP (Vendor Management Portal)

## Standard Header

* **Document ID:** PRD-VMP-01
* **Product:** NexusCanon — Vendor Management Portal (VMP)
* **Architecture:** AI-BOS Canon (Hexagonal / LEGO), Headless Truth Engine 
* **Frontend Stack:** AHA (Alpine + HTMX + HTML) with server-rendered Cells 
* **Version:** v0.1.0
* **Status:** DRAFT — Pending Certification
* **Owner:** CID / Product + Engineering
* **Last Updated:** 2025-12-20
* **Target Release:** MVP + Phase 2 (see MDP)

## 1.1 One-liner

NexusCanon VMP is a supplier-facing (and internal-facing) **Case + Evidence + Thread** system that turns onboarding, invoice exceptions, missing documents, and payment questions into **auditable structured Cases**, while supporting **omnichannel Ports** (Portal/Email/WhatsApp) via adapters. 

## 1.2 Problem Statement

Today supplier collaboration is fragmented (WhatsApp/email), causing:

* missing evidence and non-auditable approvals
* repeated AP chasing and supplier anxiety
* unclear accountability between Procurement/AP/Finance 

## 1.3 Goals (What “Success” Means)

* **Everything is a Case** (no orphan messages/files) 
* **Evidence-first enforcement** (case cannot progress without required evidence unless authorized override) 
* **Privacy Shield:** internal staff never needs to open WhatsApp; suppliers can still use Ports 
* **Fast daily UX:** Case Inbox + Case Detail becomes 90% of work 

## 1.4 Non-goals (v0–v1)

* Full ERP replacement (VMP is a facade + truth spine, not core AP engine) 
* Advanced BI dashboards
* Full automation of payment execution (read-only visibility first)

## 1.5 Personas & Permissions

### External (Supplier)

* Create: submit query, upload evidence, open case
* Read: view cases, invoice/payment status (if enabled)
* Update: add missing evidence, fix profile (gated)
* Delete/Void: **soft only** (request cancel)

### Internal (Procurement/AP)

* Read all cases in assigned scope
* Update: status changes, verify/reject evidence, reassign ownership
* Delete: forbidden (immutable audit)

## 1.6 Core Product Principles (Non-negotiables)

1. **Everything is a Case** (Onboarding, Invoice, Payment, Contract, SOA, General) 
2. **Evidence-first UI** with controlled override path 
3. **Omnichannel Ports** (Portal, Email, WhatsApp) — VMP is the Truth Engine 
4. **CRUD simplicity** (Create/Read/Update/Delete-soft) 
5. **Escalation hierarchy** (AI → AP Manager → Break-glass contact) 

## 1.7 Scope by Molecule (Functional Requirements)

### VMP-03 Collaboration Spine (MVP backbone)

* Case Inbox (triage tabs: action required / waiting / resolved) 
* Case Detail: thread + checklist + evidence vault 
* SLA fields + reminders (phase 2+)

### VMP-05 Evidence Exchange

* Upload, tag to case, versioning, access control, audit log 

### VMP-01 Supplier Onboarding (Phase 2)

* Invite → Accept → Checklist → Verification workflow → Activation 

### VMP-04 Invoice Transparency (Phase 3)

* Invoice list/detail, matching status facade, exceptions → action/evidence linkage 

### VMP-06 Payment Visibility (Phase 4)

* Payment status/history + remittance viewer 

### VMP-07 SOA Mapping (Optional Phase 5)

* SOA upload → auto match → exceptions → acknowledgement 

## 1.8 UX / Wireframe Contract (AHA)

Pages + partials are defined explicitly (server-rendered fragments swapped by HTMX). 

* Full pages: `/login`, `/accept`, `/home`, `/cases/:id`, `/invoices`, `/payments` 
* Core partials: `case-inbox`, `case-detail`, `case-thread`, `case-checklist`, `case-evidence`, `escalation` 

## 1.9 Data Model (Truth Objects)

Minimum tables (MVP):

* **cases**: type/status/owner_team/sla/vendor_id/company_id 
* **messages**: case_id, channel_source, sender_party, body, immutable timestamps 
* **evidence**: case_id, type, file_ref, version/checksum, access scope 
* **checklist_steps**: case_id, required evidence types, status (required/submitted/verified/rejected/waived) 

## 1.10 Integrations (Ports & Adapters)

* Ports: Portal UI, Email-to-case, WhatsApp bridge (pilot), Slack internal (optional) 
* ERP truth ports: InvoiceReadPort, MatchingReadPort, PaymentReadPort 

## 1.11 Acceptance Criteria (MVP)

* A supplier can login → see Case Inbox → open Case Detail
* Supplier can post message and upload evidence **only to an existing Case**
* Evidence checklist updates immediately (HTMX swap), thread updates immediately
* Internal view (optional) can reassign case owner_team and verify evidence
* Full audit trail exists for message/evidence events (immutable log)

## PRD Definition of Done (DoD)

* ✅ PRD reviewed and signed off by Product + Engineering + Finance/AP owner
* ✅ Scope locked to Phase plan (below), MVP acceptance criteria unambiguous
* ✅ Data objects + permissions rules documented
* ✅ Wireframe endpoints list finalized (pages + partials)

---

# 2) Master Development Plan (MDP) — Specific Phases

## Standard Header

* **Document ID:** MDP-VMP-01
* **Version:** v0.1.0
* **Status:** DRAFT
* **Owner:** CID / Delivery Lead
* **Scope:** AHA implementation + Canon integration

## Phase Count: **6 Phases**

This is the shortest path that still respects your Canon boundaries and “tomorrow-shelf” speed.

### Phase 0 — Foundation & Shell

**Goal:** NexusCanon luxury shell + auth + tenant context + routing skeleton
**Deliverables:** layout, nav, session auth, base tables, seed data, logging

### Phase 1 — Collaboration Spine (MVP Core)

**Goal:** Cases + Messages + Evidence + Checklist working end-to-end
**Deliverables:** Case Inbox, Case Detail, thread posting, evidence upload & versioning

### Phase 2 — Supplier Onboarding & Compliance Vault

**Goal:** Invite/Accept + onboarding checklist + profile docs + bank change gate
**Deliverables:** onboarding flow, verification workflow, controlled updates

### Phase 3 — Invoice Transparency Facade

**Goal:** Invoice list/detail + matching status panel + “Open Case” from exception
**Deliverables:** invoice pages + adapter contract stubs, case linkage

### Phase 4 — Payment Visibility

**Goal:** Payment status/history + remittance viewing
**Deliverables:** payments pages + adapter stubs + access policy

### Phase 5 — Ports + AI Enforcer + SOA Optional

**Goal:** Email-to-case, WhatsApp pilot port, AI AP Enforcer behavior; SOA module optional
**Deliverables:** port endpoints, classification + auto-case attach, escalation routing

## MDP Definition of Done (DoD)

* ✅ Exactly 6 phases locked with goals + deliverables
* ✅ Each phase has measurable completion gates (see Phase Plan)
* ✅ Dependencies mapped (Kernel auth, storage, ERP adapters)
* ✅ Release toggles defined (FEATURE_INVOICES, FEATURE_PAYMENTS, FEATURE_SOA, FEATURE_WHATSAPP_PORT) 

---

# 3) Phase-by-Phase Development Plan (Detailed)

## Standard Header

* **Document ID:** PDP-VMP-01
* **Version:** v0.1.0
* **Status:** DRAFT
* **Method:** AHA (server-rendered partials + HTMX swaps) 

---

## Phase 0 — Foundation & Shell

### Build

* Project skeleton: `views/layout.html`, `pages/*`, `partials/*` 
* Auth: login + session cookie; tenant/company/vendor context selector
* Data: create base tables (`cases/messages/evidence/checklist_steps`)
* Storage: evidence file storage + checksum + version field

### QA / Security

* Vendor can only read cases for their vendor_id + tenant/company scope
* Audit events for create message/upload evidence

### Phase 0 DoD

* ✅ Login works, session persisted
* ✅ Home loads shell with empty-state panels
* ✅ DB migrations apply cleanly, seed data renders

---

## Phase 1 — Collaboration Spine (MVP Core)

### Build (Pages)

* `/home` split-view: left Case Inbox, right Case Detail empty state 
* `/cases/:id` direct deep link to case detail

### Build (Partials / Cells)

* `GET /partials/case-inbox` (triage tabs; action required/waiting/resolved) 
* `GET /partials/case-detail?case_id=` (loads checklist + thread containers) 
* `GET /partials/case-thread?case_id=` (messages) 
* `GET /partials/case-checklist?case_id=` (required evidence tiles) 
* `POST /cases/:id/messages` returns refreshed thread partial 
* `POST /cases/:id/evidence` returns refreshed checklist+evidence partial 

### Rules

* **No orphan uploads**: evidence must attach to a Case 
* Checklist status auto-updates on evidence upload (submitted)

### Phase 1 DoD

* ✅ Supplier can: view inbox → open case → send message → upload evidence
* ✅ HTMX swaps update thread/checklist without full reload
* ✅ Evidence versioning works (upload same type creates new version)
* ✅ Basic escalation panel visible (Level 1/2/3) 

---

## Phase 2 — Supplier Onboarding & Compliance Vault

### Build

* `/accept?token=` invite accept + password setup + onboarding checklist 
* Onboarding as a **Case type = onboarding** (reuses checklist/evidence engine) 
* Vendor profile page `/profile` (read + gated updates)
* Bank detail change flow requires evidence (bank letter) + internal approval gate 

### Phase 2 DoD

* ✅ Invite → Accept → Checklist → Activation works
* ✅ Internal can verify/reject onboarding evidence
* ✅ Vendor cannot activate without required docs (unless waiver with justification)

---

## Phase 3 — Invoice Transparency Facade

### Build

* `/invoices` list + matching state pill; CTA “Open Case” if blocked/warn 
* `/invoices/:id` detail: matching status panel + exceptions list + “Attach missing evidence” 
* Adapter stubs: InvoiceReadPort + MatchingReadPort (return mock JSON first) 
* Link invoice exceptions to Case type = invoice (auto-create if missing)

### Phase 3 DoD

* ✅ Invoice list renders from adapter (mock acceptable)
* ✅ Opening an exception creates/links to a Case and routes supplier to Case Detail
* ✅ Evidence uploaded in invoice context attaches to the linked Case

---

## Phase 4 — Payment Visibility

### Build

* `/payments` history + remittance link 
* PaymentReadPort stub + mapping
* Permission: vendor sees only their payments

### Phase 4 DoD

* ✅ Payment pages functional (even if adapter mocked)
* ✅ Remittance viewer works (HTML/PDF link)
* ✅ Payment visibility linked to Cases when relevant

---

## Phase 5 — Ports + AI Enforcer + SOA Optional

### Build (Ports)

* Email-to-case append (reply updates message thread) 
* WhatsApp inbound pilot: webhook → create Message → attach Case (AI classification) 
* Escalation routing rules: SLA breach → AP Manager assignment 

### Build (AI AP Enforcer)

* Minimum integrity checks (invoice/PO reference presence, required doc presence) 
* AI replies with actionable request and/or upload link; human handoff only when threshold met 

### Optional: SOA Module

* `/soa` upload → match → exceptions → acknowledgement 

### Phase 5 DoD

* ✅ Email replies append to correct Case
* ✅ WhatsApp inbound creates messages without exposing staff numbers (privacy shield) 
* ✅ AI Enforcer blocks progress when evidence missing and provides clear next steps
* ✅ Escalation hierarchy visible and operational (AI → AP Manager → Break-glass) 

---

## PDP Definition of Done (DoD)

* ✅ Each phase has: deliverables shipped + acceptance checks + security gates
* ✅ MVP is independently usable without ERP perfection (adapters can be mocked initially)
* ✅ Feature toggles allow staged rollout without redesign 

---

If you want the **fastest execution next**, tell me **your preferred phase deadline** (e.g., “MVP in 10 days” or “MVP in 3 weeks”), and I’ll translate the 6 phases into a concrete calendar sprint plan with day-by-day deliverables.
