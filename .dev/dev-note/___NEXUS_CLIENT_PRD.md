# NexusCanon CMP (Client Management Portal)

> **Positioning:** Client Facade + AP Command Center + Vendor Lifecycle Orchestrator

**Document Status:** SSOT Development Document
**Last Updated:** 2025-12-26
**Version:** v0.1.0
**Companion:** `__nexus_canon_vmp_consolidated_final_paper.md` (Vendor-facing)

---

## 0) One-liner

**NexusCanon CMP** is the client-facing (internal AP/Procurement/Finance) **control center** that turns vendor onboarding, invoice processing, payment approvals, and SOA reconciliation into **auditable, structured workflows**—while giving internal teams **full visibility and control** over the vendor relationship lifecycle.

---

## 1) Purpose

### 1.1 What problem we kill
- "Where is this invoice?" (scattered AP inbox, no status visibility)
- "Who approved this payment?" (no audit trail, compliance gaps)
- "Why is this vendor blocked?" (onboarding stuck in email limbo)
- "Which vendors are overdue for compliance renewal?" (reactive firefighting)
- "How do I know if the vendor received our response?" (no acknowledgement tracking)

### 1.2 What CMP becomes
- **AP Command Center** - Single dashboard for all vendor-facing work
- **Vendor Lifecycle Manager** - Onboarding → Active → Renewal → Offboarding
- **Payment Orchestrator** - Approval workflows, batch runs, remittance tracking
- **Compliance Vault** - Document expiry, renewal automation, audit-ready
- **SOA Reconciliation Hub** - Vendor statement matching, dispute resolution

---

## 2) Design Constitution (Non-Negotiables)

### 2.1 Mirrored Architecture with VMP
- CMP and VMP share the **same Nexus core** (tenants, relationships, cases, payments)
- CMP sees data through **TC-*** (Tenant-as-Client) context
- VMP sees data through **TV-*** (Tenant-as-Vendor) context
- **Same case**, different perspectives

### 2.2 Client is the Initiator
- Clients **invite** vendors (not vice versa)
- Clients **set SLAs** and compliance requirements
- Clients **approve** payments and releases
- Clients **define** document checklists per vendor type

### 2.3 Everything Has an Owner
- Every case has `assigned_to` (internal user)
- Every payment has `approved_by` (approval chain)
- Every document request has `requested_by`
- **No orphan work items**

### 2.4 Proactive Not Reactive
- SLA breach warnings **before** breach
- Document expiry alerts **30/60/90 days** ahead
- Payment run notifications **before** cut-off
- Vendor performance flags **continuous**

### 2.5 CRUD + MCP Consistency
Same adapter pattern as VMP:
- **Create** (invite vendor, create case, request document)
- **Read** (dashboard views, reports, audit logs)
- **Update** (approve, reject, reassign, extend SLA)
- **Delete/Void** (soft-delete only, immutable audit)

---

## 3) AI-BOS LEGO Architecture Fit

### 3.1 Placement
```
┌─────────────────────────────────────────────────────────────┐
│                     AI-BOS KERNEL                           │
│  (Identity, Tenancy, Audit, Routing, Notifications, Storage)│
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ NexusCanon   │     │ NexusCanon   │     │  Finance/AP  │
│     CMP      │◄───►│     VMP      │◄───►│   Canons     │
│ (Client-Facing)    │ (Vendor-Facing)    │ (ERP Truth)  │
└──────────────┘     └──────────────┘     └──────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │   Shared Core    │
                    │  (nexus_* tables) │
                    └──────────────────┘
```

### 3.2 Shared Data Model
| Entity | CMP View (Client) | VMP View (Vendor) |
|--------|-------------------|-------------------|
| Relationship | "My vendors" | "My clients" |
| Case | "Vendor support tickets" | "Client requests" |
| Invoice | "Payables to process" | "Receivables to track" |
| Payment | "Payments we're making" | "Payments we're receiving" |
| Document | "Compliance we require" | "Documents we submit" |

---

## 4) Canon Map (Molecules → Cells)

### Molecule CMP-01 — Vendor Lifecycle Management
- CMP-01-01 Vendor Discovery & Sourcing (optional)
- CMP-01-02 Vendor Invitation & Onboarding
- CMP-01-03 Onboarding Checklist Engine (configurable by vendor type)
- CMP-01-04 Compliance Document Tracking
- CMP-01-05 Vendor Status Management (active, suspended, offboarded)
- CMP-01-06 Vendor Performance Scoring (future)

### Molecule CMP-02 — Vendor Master Data
- CMP-02-01 Vendor Directory (searchable, filterable)
- CMP-02-02 Vendor Profile View (read-only snapshot of vendor data)
- CMP-02-03 Bank Details Approval Workflow
- CMP-02-04 Tax/Compliance Document Registry
- CMP-02-05 Contract & Agreement Library
- CMP-02-06 Vendor Categories & Tags

### Molecule CMP-03 — AP Command Center (Case OS)
- CMP-03-01 Case Dashboard (all vendor cases)
- CMP-03-02 Case Triage Queue (unassigned, SLA-critical)
- CMP-03-03 Case Assignment & Routing
- CMP-03-04 Case Resolution Workflow
- CMP-03-05 SLA Monitoring & Escalation
- CMP-03-06 Decision Log (who/what/why)

### Molecule CMP-04 — Invoice Processing
- CMP-04-01 Invoice Inbox (pending processing)
- CMP-04-02 Invoice Detail View
- CMP-04-03 3-Way Matching Panel (PO/GRN/Invoice)
- CMP-04-04 Exception Handling (request evidence, dispute, approve)
- CMP-04-05 Invoice Approval Workflow
- CMP-04-06 Invoice Batch Actions

### Molecule CMP-05 — Payment Orchestration
- CMP-05-01 Payment Queue (approved, pending release)
- CMP-05-02 Payment Run Scheduling
- CMP-05-03 Payment Approval Workflow
- CMP-05-04 Remittance Generation & Dispatch
- CMP-05-05 Payment History & Audit
- CMP-05-06 Emergency Payment Override (break-glass)

### Molecule CMP-06 — Document & Evidence Management
- CMP-06-01 Document Request (push to vendor)
- CMP-06-02 Document Receipt & Review
- CMP-06-03 Document Approval/Rejection
- CMP-06-04 Expiry Tracking & Renewal Alerts
- CMP-06-05 Bulk Document Actions

### Molecule CMP-07 — SOA Reconciliation
- CMP-07-01 SOA Upload (vendor statement)
- CMP-07-02 Auto-Match Engine
- CMP-07-03 Exception Review
- CMP-07-04 Confirmation & Sign-off
- CMP-07-05 Dispute Resolution (link to Case)

### Molecule CMP-08 — Reporting & Analytics
- CMP-08-01 Vendor Performance Dashboard
- CMP-08-02 AP Aging Report
- CMP-08-03 SLA Compliance Report
- CMP-08-04 Document Expiry Report
- CMP-08-05 Payment Forecast

---

## 5) Core Domain Objects (Client Perspective)

### 5.1 Vendor (Relationship View)
```
vendor_relationship:
  relationship_id: REL-XXXXXXXX
  vendor_tenant_id: TV-XXXXXXXX (their vendor ID)
  vendor_name: "Beta Services Ltd"
  vendor_code: "V-001" (client's internal code)
  category: "IT Services"
  status: active | suspended | offboarded
  onboarding_status: pending | in_progress | completed
  compliance_status: compliant | expiring_soon | non_compliant
  next_review_date: DATE
  assigned_ap_user: USR-XXXXXXXX
  sla_tier: gold | silver | bronze
  payment_terms: net_30 | net_60 | net_90
```

### 5.2 Case (Client View)
```
case:
  case_id: CASE-XXXXXXXX
  case_type: onboarding | invoice | payment | document | soa | general
  direction: inbound (vendor initiated) | outbound (client initiated)
  vendor_tenant_id: TV-XXXXXXXX
  vendor_name: "Beta Services"
  assigned_to: USR-XXXXXXXX (internal AP user)
  status: open | in_progress | pending_vendor | pending_approval | resolved
  priority: critical | high | normal | low
  sla_due_at: TIMESTAMPTZ
  sla_status: on_track | at_risk | breached
```

### 5.3 Invoice (Payables View)
```
invoice:
  invoice_id: INV-XXXXXXXX
  vendor_tenant_id: TV-XXXXXXXX
  invoice_number: "INV-2024-001"
  invoice_date: DATE
  due_date: DATE
  amount: NUMERIC
  currency: TEXT
  po_ref: TEXT
  grn_ref: TEXT
  matching_status: unmatched | partial | matched
  approval_status: pending | approved | rejected | on_hold
  payment_status: unpaid | scheduled | paid
  assigned_to: USR-XXXXXXXX
```

### 5.4 Payment (Outbound)
```
payment:
  payment_id: PAY-XXXXXXXX
  to_vendor_id: TV-XXXXXXXX
  invoice_refs: [INV-XXXXXXXX, ...]
  amount: NUMERIC
  currency: TEXT
  payment_date: DATE
  payment_method: wire | ach | check
  status: draft | pending_approval | approved | scheduled | released | completed | failed
  approved_by: USR-XXXXXXXX
  released_by: USR-XXXXXXXX
  remittance_sent: BOOLEAN
```

### 5.5 Document (Required from Vendor)
```
document_requirement:
  requirement_id: UUID
  vendor_tenant_id: TV-XXXXXXXX
  document_type: tax_cert | insurance | bank_letter | contract | license
  required: BOOLEAN
  status: not_requested | requested | submitted | approved | rejected | expired
  expires_at: DATE
  last_reminder_at: TIMESTAMPTZ
  submitted_evidence_id: UUID (link to nexus_case_evidence)
```

---

## 6) CMP-Specific Routes

### 6.1 Vendor Management
| Method | Path | Description |
|--------|------|-------------|
| GET | /nexus/client/vendors | Vendor directory |
| GET | /nexus/client/vendors/:id | Vendor detail |
| POST | /nexus/client/vendors/invite | Send invitation |
| POST | /nexus/client/vendors/:id/status | Update status |
| GET | /nexus/client/vendors/:id/documents | Document tracker |

### 6.2 Case Management
| Method | Path | Description |
|--------|------|-------------|
| GET | /nexus/client/cases | Case dashboard |
| GET | /nexus/client/cases/queue | Triage queue |
| POST | /nexus/client/cases/:id/assign | Assign case |
| POST | /nexus/client/cases/:id/resolve | Resolve case |

### 6.3 Invoice Processing
| Method | Path | Description |
|--------|------|-------------|
| GET | /nexus/client/invoices | Invoice inbox |
| GET | /nexus/client/invoices/:id | Invoice detail |
| POST | /nexus/client/invoices/:id/match | Update matching |
| POST | /nexus/client/invoices/:id/approve | Approve invoice |
| POST | /nexus/client/invoices/:id/reject | Reject invoice |

### 6.4 Payment Management
| Method | Path | Description |
|--------|------|-------------|
| GET | /nexus/client/payments | Payment queue |
| GET | /nexus/client/payments/run | Payment run builder |
| POST | /nexus/client/payments/run | Execute payment run |
| POST | /nexus/client/payments/:id/approve | Approve payment |
| POST | /nexus/client/payments/:id/release | Release payment |

### 6.5 Documents
| Method | Path | Description |
|--------|------|-------------|
| POST | /nexus/client/documents/request | Request from vendor |
| POST | /nexus/client/documents/:id/approve | Approve document |
| POST | /nexus/client/documents/:id/reject | Reject document |

---

## 7) UI Blueprint (Client Dashboard)

### 7.1 CMP Home (Command Center)
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Nexus CMP           🔔 (3)  👤 Alice (Alpha Corp)    │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────┐                                                │
│ │ Vendors  │  📊 COMMAND CENTER                            │
│ ├──────────┤                                                │
│ │ Cases    │  ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│ ├──────────┤  │ Cases   │ │Invoices │ │Payments │          │
│ │ Invoices │  │ 12 open │ │ 8 pending│ │ $45,000 │          │
│ ├──────────┤  │ 3 SLA ⚠ │ │ 2 overdue│ │ pending │          │
│ │ Payments │  └─────────┘ └─────────┘ └─────────┘          │
│ ├──────────┤                                                │
│ │ Documents│  ┌─────────────────────────────────────────┐  │
│ ├──────────┤  │ URGENT ACTIONS                          │  │
│ │ Reports  │  │ • Invoice INV-2024-042 - SLA breach in 2h│  │
│ └──────────┘  │ • Vendor Beta - Cert expires in 7 days  │  │
│               │ • Payment PAY-2024-015 awaiting approval │  │
│               └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Vendor Directory
```
┌─────────────────────────────────────────────────────────────┐
│ VENDOR DIRECTORY                      [+ Invite Vendor]     │
├─────────────────────────────────────────────────────────────┤
│ [Search...] [Category ▼] [Status ▼] [Compliance ▼]          │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────┐  │
│ │ Beta Services (V-001)           IT Services          │  │
│ │ ● Active   ● Compliant   Net-30   📧 vendor@beta.com │  │
│ │ Cases: 2 open   Invoices: $12,500   Last: 2 days ago │  │
│ └───────────────────────────────────────────────────────┘  │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ Gamma Group (V-002)             Logistics            │  │
│ │ ● Active   ⚠ Expiring   Net-60   📧 ap@gamma.com    │  │
│ │ Cases: 1 open   Invoices: $8,200    Last: 5 days ago │  │
│ └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Invoice Processing View
```
┌─────────────────────────────────────────────────────────────┐
│ INVOICE: INV-2024-042                        [Approve] [❌]  │
├─────────────────────────────────────────────────────────────┤
│ Vendor: Beta Services                 Amount: $5,250.00     │
│ Date: 2024-12-20                      Due: 2025-01-19       │
├─────────────────────────────────────────────────────────────┤
│ 3-WAY MATCH                                                 │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ PO-2024-100 │→│ GRN-2024-50 │→│ INV-2024-42 │            │
│ │ $5,000.00   │ │ $5,000.00   │ │ $5,250.00   │            │
│ │ ✓ Matched   │ │ ✓ Matched   │ │ ⚠ Variance  │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                             │
│ VARIANCE: $250.00 (5%) - Tax adjustment                     │
│ [Request Explanation] [Accept Variance] [Dispute]           │
├─────────────────────────────────────────────────────────────┤
│ EVIDENCE                                                    │
│ 📄 invoice_scan.pdf   📄 delivery_note.pdf                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 8) Security & Access Model

### 8.1 CMP-Specific Roles
| Role | Scope | Permissions |
|------|-------|-------------|
| **AP Manager** | All vendors | Full case/invoice/payment access |
| **AP Clerk** | Assigned vendors | Process invoices, view payments |
| **Procurement** | Assigned vendors | Onboarding, contracts, no payments |
| **Finance Approver** | All vendors | Approve payments, view only |
| **Viewer** | All vendors | Read-only access |

### 8.2 Approval Workflows
```yaml
invoice_approval:
  - threshold: < $5,000
    approvers: [AP_Clerk]
  - threshold: < $25,000
    approvers: [AP_Manager]
  - threshold: >= $25,000
    approvers: [AP_Manager, Finance_Approver]

payment_release:
  - any_amount:
    approvers: [Finance_Approver]
    dual_control: true  # Different person than invoice approver
```

---

## 9) Integration Points

### 9.1 With VMP (Vendor Portal)
- **Realtime sync**: Case updates, messages, documents
- **Notification bridge**: Payment released → Vendor sees it immediately
- **Evidence sharing**: Vendor uploads → Client reviews

### 9.2 With ERP/Finance Canon
- **Invoice import**: From ERP AP module
- **Payment export**: To ERP for execution
- **Vendor master sync**: Bidirectional

### 9.3 With GlobalConfig Admin
- **Tenant provisioning**: New client setup
- **Workflow configuration**: Approval chains, SLA rules
- **User management**: Role assignments

---

## 10) Implementation Phases

### Phase 1: Foundation (Sprint 1-2)
- [ ] CMP route structure under `/nexus/client/*`
- [ ] Vendor directory view (read from existing relationships)
- [ ] Case dashboard (client perspective)
- [ ] Basic invoice list view

### Phase 2: Processing Core (Sprint 3-4)
- [ ] Invoice detail with matching panel
- [ ] Invoice approval workflow
- [ ] Payment queue view
- [ ] Document request → vendor flow

### Phase 3: Advanced Workflows (Sprint 5-6)
- [ ] Payment run builder
- [ ] Multi-level approval chains
- [ ] SLA monitoring & alerts
- [ ] Compliance expiry tracking

### Phase 4: Analytics & Reporting (Sprint 7-8)
- [ ] Vendor performance dashboard
- [ ] AP aging report
- [ ] SLA compliance report
- [ ] Export to Excel/PDF

---

## 11) Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Invoice processing time | < 24 hours | Time from receipt to approval |
| First-time match rate | > 80% | Invoices matched without exception |
| SLA compliance | > 95% | Cases resolved within SLA |
| Vendor response time | < 4 hours | Time to first response |
| Document compliance | 100% | All required docs current |

---

## 12) Changelog

| Date | Version | Change |
|------|---------|--------|
| 2025-12-26 | v0.1.0 | Initial CMP PRD created |

---

**Document Status:** SSOT Development Document
**Companion Documents:**
- `__nexus_canon_vmp_consolidated_final_paper.md` - Vendor-facing PRD
- `___NEXUS_CLIENT_MASTERCCP.md` - Client implementation tracking
- `___NEXUS_GLOBALCONFIG.md` - Admin/Configuration architecture
