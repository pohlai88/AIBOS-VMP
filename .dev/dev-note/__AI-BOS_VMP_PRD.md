Understood 👍
I’ll **re-enrich and consolidate the PRD + decision model directly in chat**, cleanly structured, **no canvas**, no tooling side effects.

This is written as a **dev-authoritative operating document** you can paste into your repo as `PRD_VMP_UNIFIED.md`.

I’ve also cross-checked against your uploaded **PRD v3.0.0** and aligned terminology, routes, entities, and architecture .

---

# NexusCanon VMP

## Unified PRD + Architecture + Decision Model (Final for Development)

**Document ID:** PRD-VMP-001-U
**Version:** 3.1.0
**Status:** Production-Grade
**Scope:** Client + Vendor Portals (Multi-Tenant)
**Primary Stack:** Node.js (Express) · Supabase (Postgres, Auth, Storage) · HTMX · Nunjucks
**Secondary DB Targets:** Neon / AWS RDS (via adapter boundary)

---

## 0. Purpose of This Document

This document **replaces all fragmented PRDs, intent notes, and verbal rules**.

It consolidates:

1. Your existing **VMP v3.0.0 PRD** (Case OS, Evidence Vault, 3-Way Matching, Payment, SOA, Ports, AI Enforcer)
2. The **entity-scoped decision/action model** you defined
3. Explicit **state machines**, **RBAC boundaries**, and **audit guarantees**
4. Architecture rules that prevent future drift

This is now the **single source of truth for developers**.

---

## 1. Non-Negotiable Product Principles

These principles govern **every line of code**:

1. **Everything Is a Case**
   No orphan messages, files, approvals, or chats.

2. **CRUD Verbs Stay CRUD**
   Business meaning never replaces CRUD semantics.

3. **Business Meaning Lives in Small ENUMs**
   Per-entity, not global.

4. **Decisions Are Events, Not Mutations**
   History is append-only. Current state is derived.

5. **Tenant Isolation Is Absolute**
   Enforced by database RLS, never UI logic.

6. **Evidence First, Always**
   State progression requires evidence unless explicitly waived with audit reason.

---

## 2. System Overview (Re-affirmed)

**NexusCanon VMP** is a **Case + Evidence + Decision OS** for vendor collaboration and payment governance.

### Two Portals (Hard Separation)

| Portal                     | Purpose                                                      |
| -------------------------- | ------------------------------------------------------------ |
| **Client / Tenant Portal** | Manage vendors, cases, matching, approvals, payments         |
| **Vendor Portal**          | Submit evidence, respond to cases, track invoices & payments |

No shared UI folders. No shared CSS scopes. No “conditional rendering hacks”.

---

## 3. Core Domain Entities

### Decision-Bearing Entities (Must Follow Decision Model)

* Case / Dispute
* Payment
* Invitation
* Match Pack (3-Way Matching)
* Evidence / File

### Supporting Entities (CRUD-Only)

* Message
* Checklist Step
* Vendor Profile
* Invoice (Shadow Ledger)
* SOA Statement / Lines

---

## 4. Unified Decision Model (Authoritative)

### 4.1 The Pattern (Applies to All Entities)

For every decision-bearing entity:

**Main Table**

* Holds **current state only**
* Has `status`

**Event Table**

* Records **every decision**
* Contains:

  * `update_action` (ENUM, entity-specific)
  * `from_status`
  * `to_status`
  * `reason / note`
  * `actor`
  * `timestamp`

> ❗ No entity may change state without writing an event.

---

## 5. Entity-Specific Decision ENUMs (Final)

### 5.1 Case / Dispute

**Enum:** `case_update_action`

```
APPROVE
REJECT
WITHDRAW
CANCEL
```

**Who can act**

| Action   | Vendor  | Tenant | Ops |
| -------- | ------- | ------ | --- |
| APPROVE  | ❌       | ✅      | ✅   |
| REJECT   | ❌       | ✅      | ✅   |
| WITHDRAW | ✅ (own) | ❌      | ❌   |
| CANCEL   | ❌       | ❌      | ✅   |

---

### 5.2 Payment

**Enum:** `payment_update_action`

```
APPROVE
REJECT
WITHDRAW
CANCEL
```

Notes:

* `HOLD` is a **status**, not an action
* Payment actions are downstream of Case resolution

---

### 5.3 Invitation

**Enum:** `invite_update_action`

```
CANCEL
WITHDRAW
RESEND
```

Explicit exclusions:

* APPROVE / REJECT **do not apply** to invitations

---

### 5.4 Match Pack (3-Way Matching)

**Enum:** `match_update_action`

```
CONFIRM_MATCH
MARK_MISMATCH
REQUEST_EVIDENCE
CANCEL
```

---

### 5.5 Evidence / File

**Enum:** `evidence_update_action`

```
VERIFY
REJECT
REPLACE
REMOVE
```

Rules:

* `REMOVE` = soft delete
* Physical deletion is forbidden

---

## 6. State Machines (Safety Net)

### 6.1 Case State Machine (Example)

| Current Status | Action   | Next Status       |
| -------------- | -------- | ----------------- |
| OPEN           | CANCEL   | CANCELLED         |
| WAITING_VENDOR | CANCEL   | CANCELLED         |
| IN_REVIEW      | APPROVE  | RESOLVED_APPROVED |
| IN_REVIEW      | REJECT   | RESOLVED_REJECTED |
| IN_REVIEW      | WITHDRAW | WITHDRAWN         |

Invalid transitions **must fail hard**.

---

### 6.2 Payment State Machine (Excerpt)

| Current Status | Action   | Next Status |
| -------------- | -------- | ----------- |
| SUBMITTED      | APPROVE  | APPROVED    |
| SUBMITTED      | REJECT   | REJECTED    |
| SUBMITTED      | WITHDRAW | WITHDRAWN   |
| APPROVED       | CANCEL   | CANCELLED   |

---

## 7. Database Schema Additions (Delta)

### 7.1 Case Event Table

```sql
CREATE TABLE vmp_case_event (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  update_action case_update_action NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  note TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

### 7.2 Payment Event Table

```sql
CREATE TABLE vmp_payment_event (
  id UUID PRIMARY KEY,
  payment_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  update_action payment_update_action NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

### 7.3 Invitation Event Table

```sql
CREATE TABLE vmp_invite_event (
  id UUID PRIMARY KEY,
  invite_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  update_action invite_update_action NOT NULL,
  note TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

All event tables **must have RLS enabled**.

---

## 8. API Contract (Strict)

### 8.1 CRUD Rules

* `POST` = create
* `GET` = read
* `PATCH / UPDATE` = non-decision edits
* `POST /:id/update` = **decisions only**

### 8.2 Decision Routes (Pattern)

```
POST /cases/:id/update
POST /payments/:id/update
POST /invites/:id/update
```

Each route **must**:

1. Validate RBAC
2. Validate allowed state transition
3. Insert event row
4. Update main entity status
5. Write audit_log
6. Commit atomically

No shortcuts.

---

## 9. UI Contract (Explicit)

### 9.1 The 4-Button Rule

Decision entities may expose **at most 4 buttons**:

* Approve
* Reject
* Withdraw
* Cancel

Visibility depends on:

* Role
* Ownership
* Current status

---

### 9.2 Everything Else Is Plain CRUD

| Interaction     | Operation     |
| --------------- | ------------- |
| Comment         | CREATE        |
| Upload evidence | CREATE        |
| Edit note       | UPDATE        |
| Retag file      | UPDATE        |
| Remove file     | DELETE (soft) |

---

## 10. Architecture Guardrails (Re-stated)

### 10.1 Folder Boundaries (Frontend)

```
/views
  /client
  /vendor
  /ops
  /shared (partials only)
```

No cross-portal imports.

---

### 10.2 Adapter Boundary (DB)

All data access via repositories:

```
repos/
  supabase/
  postgres/
```

No route touches SQL directly.

---

## 11. Critical Gaps Identified (Must Fix)

### 11.1 Silent Status Mutations ❌

Some existing routes update `status` directly.

**This is audit-breaking.**
Refactor to event-first immediately.

---

### 11.2 ENUM Drift Risk

Statuses and decisions still exist as free text in places.

**Fix:**

* Use DB ENUMs or CHECK constraints
* Enforce transitions centrally

---

### 11.3 Mixed Responsibility Routes

Routes that:

* change state
* upload files
* add comments

…must be split.

---

### 11.4 Event Tables Missing RLS

Event tables are tenant-scoped data.

**They must inherit tenant isolation.**

---

## 12. Definition of Done (Dev-Level)

A feature is **done** only if:

* No state change without event
* ENUM used, not free text
* RLS enforced on base + event tables
* Decision requires reason where applicable
* UI exposes only allowed actions

---

## 13. Final Assessment

Your simplification is **correct and mature**.

It:

* Reduces cognitive load
* Preserves audit integrity
* Keeps UX consistent
* Prevents future “workflow soup”

This is **enterprise-grade without enterprise bloat**.

---

## 14. Recommended Next Actions

Pick one:

1. Refactor `/cases/:id/update` as a gold-standard example
2. Generate ENUM DDL + migration scripts
3. Add state-transition unit tests (service + DB)

Say which one, and I’ll deliver it **implementation-ready**.

---

If you want, I can also **re-diff this against your current codebase** and flag exactly which routes violate the new rules.
