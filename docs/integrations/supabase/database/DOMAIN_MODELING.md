# Domain Modeling: Business Entities & Interactions

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Document business entities and their interactions (the abstract concept), separate from database schema (the implementation detail)  
**Auto-Generated:** No

---

## 📋 Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [Domain Entities](#domain-entities)
3. [Entity Relationships](#entity-relationships)
4. [Business Rules](#business-rules)
5. [State Machines](#state-machines)
6. [Related Documentation](#related-documentation)

---

## 🧬 Core Philosophy

> **"The Map vs. The Territory"** - This document describes the **territory** (business reality), not the **map** (database schema).

### Domain Model vs. Database Schema vs. Storage Strategy

| Aspect | Domain Model (This Document) | Storage Strategy | Database Schema (Implementation) |
|--------|------------------------------|------------------|----------------------------------|
| **Focus** | Business entities & interactions | SQL vs. JSONB decision | Tables, columns, indexes |
| **Purpose** | Understand the business | Choose flexible vs. strict | Optimize for performance & constraints |
| **Evolution** | Changes with business needs | Changes with data patterns | Changes with optimization needs |
| **Documentation** | Conceptual, business-focused | Decision framework | Technical, implementation-focused |

**Key Principles:**
1. **Domain Model** = Source of truth for business logic (model strictly)
2. **Storage Strategy** = SQL vs. JSONB decision (choose based on patterns)
3. **Database Schema** = Optimization layer (implement based on performance needs)

**The Separation:**
- Model the **domain** strictly (business entities, relationships, rules)
- Store the **data** flexibly (JSONB for evolving, columns for stable)
- Optimize the **schema** strategically (promote when patterns stabilize)

**Example:**
- **Domain Model:** Case has a priority (business rule: required, enum values)
- **Storage Strategy:** Start with JSONB (flexible), promote to column when queried frequently
- **Database Schema:** `priority TEXT CHECK (priority IN (...))` (optimization when needed)

---

## 🏢 Domain Entities

### 1. Tenant (Root Entity)

**Business Concept:** Top-level organizational boundary for multi-tenant isolation.

**Key Attributes:**
- Unique identifier (tenant_id)
- Name and display information
- Status (active, pending, suspended, archived)
- Onboarding status (pending, active, completed)
- Settings (flexible configuration via JSONB)
- Metadata (flexible extension data via JSONB)

**Business Rules:**
- All data is scoped to a tenant
- Tenants are isolated from each other
- One tenant can have multiple companies
- One tenant can have multiple vendors

**State Transitions:**
```
pending → active → suspended → archived
```

**Related Entities:**
- Companies (1:N)
- Vendors (1:N)
- Cases (1:N)
- Relationships (1:N - tenant-to-tenant)

---

### 2. Company (Legal Entity)

**Business Concept:** Legal entity within a tenant that owns invoices, payments, and bank accounts.

**Key Attributes:**
- Unique identifier (company_id)
- Tenant reference
- Name
- Tax ID (for legal entity identification)
- Status
- Metadata (flexible extension data)

**Business Rules:**
- Belongs to exactly one tenant
- Can have multiple vendors authorized to trade with it
- Owns invoices and payments
- Has bank accounts for payments

**State Transitions:**
```
active → suspended → archived
```

**Related Entities:**
- Tenant (N:1)
- Vendor-Company Links (1:N)
- Cases (1:N)
- Invoices (1:N)
- Payments (1:N)

---

### 3. Vendor (Supplier/Partner)

**Business Concept:** External supplier or partner that provides goods/services.

**Key Attributes:**
- Unique identifier (vendor_id)
- Tenant reference
- Name
- Status (invited, active, suspended)
- Onboarding status
- Metadata (flexible extension data)

**Business Rules:**
- Belongs to exactly one tenant (vendor's tenant)
- Can be authorized to trade with multiple companies
- Can initiate cases (inbound)
- Can receive cases (outbound)
- Can receive payments

**State Transitions:**
```
invited → active → suspended
```

**Related Entities:**
- Tenant (N:1)
- Vendor-Company Links (1:N)
- Cases (1:N - both as initiator and recipient)
- Payments (1:N - as recipient)

---

### 4. Case (Vendor Interaction)

**Business Concept:** A structured interaction between tenant and vendor requiring evidence, decisions, or resolution.

**Key Attributes:**
- Unique identifier (case_id)
- Client reference (tenant/company)
- Vendor reference
- Case type (onboarding, invoice, payment, soa, general, dispute, etc.)
- Status (draft, open, in_progress, pending_client, pending_vendor, resolved, closed, etc.)
- Priority (low, normal, high, urgent)
- Subject and description
- SLA due date
- Resolution information
- Tags (flexible categorization via JSONB or array)
- Metadata (flexible extension data via JSONB)

**Business Rules:**
- Must belong to a client (tenant/company) and vendor
- Follows "evidence-first" doctrine (checklist steps required)
- Has state machine with strict transitions
- Can have messages (communication thread)
- Can have evidence (files, documents)
- Can have checklist steps (evidence requirements)

**State Transitions:**
```
draft → open → in_progress → pending_client/pending_vendor → resolved → closed
                    ↓
                 escalated
                    ↓
                 blocked
```

**Related Entities:**
- Client (N:1 - tenant/company)
- Vendor (N:1)
- Messages (1:N)
- Evidence (1:N)
- Checklist Steps (1:N)
- Activity Log (1:N)

---

### 5. Payment (Outbound Payment)

**Business Concept:** Payment made from tenant/company to vendor.

**Key Attributes:**
- Unique identifier (payment_id)
- Client reference (tenant/company)
- Vendor reference
- Amount and currency
- Payment date
- Payment method (wire, ach, check, etc.)
- Status (draft, pending_approval, approved, scheduled, released, completed, failed)
- Line items (flexible structure via JSONB)
- Invoice references
- Metadata (flexible extension data via JSONB)

**Business Rules:**
- Must belong to a client (tenant/company)
- Must reference a vendor
- Can reference multiple invoices
- Follows approval workflow
- Has state machine with strict transitions
- Can be scheduled for future execution

**State Transitions:**
```
draft → pending_approval → approved → scheduled → released → completed
                                                          ↓
                                                       failed
```

**Related Entities:**
- Client (N:1 - tenant/company)
- Vendor (N:1)
- Invoices (N:M - via references)
- Payment Schedule (1:1)
- Activity Log (1:N)

---

### 6. Invoice (Shadow Ledger)

**Business Concept:** Invoice record in the shadow ledger (headless ERP).

**Key Attributes:**
- Unique identifier (invoice_id)
- Vendor reference
- Invoice number (vendor's reference)
- Invoice date and due date
- Amount and currency
- PO reference
- GRN reference
- Matching status (unmatched, partial, matched)
- Approval status
- Payment status
- Line items (flexible structure via JSONB)
- Metadata (flexible extension data via JSONB)

**Business Rules:**
- Belongs to a vendor
- Can be matched with SOA statements (3-way matching)
- Can be linked to payments
- Tracks approval and payment status

**State Transitions:**
```
unmatched → partial → matched
pending → approved → rejected
unpaid → scheduled → paid
```

**Related Entities:**
- Vendor (N:1)
- Payments (N:M - via references)
- SOA Matches (1:N)

---

### 7. Relationship (Tenant-to-Tenant)

**Business Concept:** Binary relationship between two tenants (client-vendor relationship).

**Key Attributes:**
- Unique identifier (relationship_id)
- Client tenant reference
- Vendor tenant reference
- Status (pending, active, suspended)
- Onboarding status
- Metadata (flexible extension data via JSONB)

**Business Rules:**
- Links two tenants (client and vendor)
- Enables cross-tenant collaboration
- Has state machine with strict transitions
- Can have invitations (relationship invites)

**State Transitions:**
```
pending → active → suspended
```

**Related Entities:**
- Client Tenant (N:1)
- Vendor Tenant (N:1)
- Relationship Invites (1:N)
- Cases (1:N)

---

### 8. Message (Case Communication)

**Business Concept:** Message in a case communication thread.

**Key Attributes:**
- Unique identifier
- Case reference
- Sender reference
- Content (text)
- Channel (email, whatsapp, slack, etc.)
- Metadata (channel-specific data via JSONB)

**Business Rules:**
- Belongs to exactly one case
- Has a sender (user or system)
- Can be from different channels
- Channel-specific metadata stored in JSONB

**Related Entities:**
- Case (N:1)

---

### 9. Evidence (Case Evidence)

**Business Concept:** File or document submitted as evidence for a case.

**Key Attributes:**
- Unique identifier
- Case reference
- Checklist step reference (optional)
- File reference (storage)
- Evidence type
- Status (submitted, verified, rejected)
- Metadata (flexible extension data via JSONB)

**Business Rules:**
- Belongs to exactly one case
- Can be linked to a checklist step
- Follows "evidence-first" doctrine
- Has state machine with strict transitions

**State Transitions:**
```
submitted → verified
         ↓
      rejected
```

**Related Entities:**
- Case (N:1)
- Checklist Step (N:1 - optional)

---

### 10. Checklist Step (Evidence Requirement)

**Business Concept:** Required evidence step for a case.

**Key Attributes:**
- Unique identifier
- Case reference
- Label (description)
- Required evidence type
- Status (pending, submitted, verified, rejected, waived)
- Waived reason (if waived)
- Metadata (flexible extension data via JSONB)

**Business Rules:**
- Belongs to exactly one case
- Enforces "evidence-first" doctrine
- Can be waived (with reason)
- Has state machine with strict transitions

**State Transitions:**
```
pending → submitted → verified
       ↓
    waived
       ↓
    rejected
```

**Related Entities:**
- Case (N:1)
- Evidence (1:N - optional)

---

## 🔗 Entity Relationships

### Primary Relationships

```
Tenant
├── Companies (1:N)
├── Vendors (1:N)
├── Cases (1:N)
└── Relationships (1:N - as client)

Company
├── Vendor-Company Links (1:N)
├── Cases (1:N)
├── Invoices (1:N)
└── Payments (1:N)

Vendor
├── Vendor-Company Links (1:N)
├── Cases (1:N - as initiator or recipient)
├── Invoices (1:N)
└── Payments (1:N - as recipient)

Case
├── Messages (1:N)
├── Evidence (1:N)
├── Checklist Steps (1:N)
└── Activity Log (1:N)

Payment
├── Invoices (N:M - via references)
├── Payment Schedule (1:1)
└── Activity Log (1:N)

Relationship
├── Cases (1:N)
└── Relationship Invites (1:N)
```

### Relationship Cardinality

| Relationship | Cardinality | Notes |
|--------------|-------------|-------|
| Tenant → Companies | 1:N | One tenant has many companies |
| Tenant → Vendors | 1:N | One tenant has many vendors |
| Company → Vendors | N:M | Via Vendor-Company Links |
| Case → Messages | 1:N | One case has many messages |
| Case → Evidence | 1:N | One case has many evidence items |
| Case → Checklist Steps | 1:N | One case has many checklist steps |
| Payment → Invoices | N:M | One payment can reference many invoices |

---

## 📐 Business Rules

### 1. Multi-Tenant Isolation

**Rule:** All data is scoped to a tenant. Tenants cannot access each other's data.

**Implementation:** RLS policies enforce tenant isolation at the database level.

### 2. Evidence-First Doctrine

**Rule:** Cases require evidence before resolution. Checklist steps enforce evidence requirements.

**Implementation:** Checklist steps must be completed (verified or waived) before case resolution.

### 3. State Machine Enforcement

**Rule:** Entities follow strict state machines. Invalid transitions are rejected.

**Implementation:** Database constraints and application logic enforce valid state transitions.

### 4. Relationship Authorization

**Rule:** Vendors must be authorized to trade with specific companies.

**Implementation:** Vendor-Company Links table authorizes vendor-company relationships.

### 5. Payment Approval Workflow

**Rule:** Payments require approval before release.

**Implementation:** Payment status transitions enforce approval workflow.

---

## 🔄 State Machines

### Case State Machine

```
[Initial States]
draft
open

[Active States]
in_progress
pending_client
pending_vendor

[Resolution States]
resolved
closed

[Exception States]
escalated
blocked
cancelled
```

**Valid Transitions:**
- `draft → open`
- `open → in_progress`
- `in_progress → pending_client | pending_vendor | resolved | escalated | blocked`
- `pending_client → in_progress | resolved | escalated | blocked`
- `pending_vendor → in_progress | resolved | escalated | blocked`
- `resolved → closed`
- `escalated → in_progress | resolved | blocked`
- `blocked → in_progress | resolved`

### Payment State Machine

```
[Initial States]
draft

[Approval States]
pending_approval
approved

[Execution States]
scheduled
released
completed

[Exception States]
failed
cancelled
```

**Valid Transitions:**
- `draft → pending_approval`
- `pending_approval → approved | cancelled`
- `approved → scheduled | cancelled`
- `scheduled → released | cancelled`
- `released → completed | failed`

---

## 📚 Related Documentation

- [Flexible Data Patterns](./FLEXIBLE_DATA_PATTERNS.md) - JSONB vs. columns decision framework
- [Schema Reference](./SCHEMA_REFERENCE.md) - Database schema (implementation detail)
- [Evolutionary Design](../best-practices/EVOLUTIONARY_DESIGN.md) - How to evolve schemas without breaking apps
- [RLS Policies](./RLS_POLICIES.md) - Row Level Security implementation

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22

