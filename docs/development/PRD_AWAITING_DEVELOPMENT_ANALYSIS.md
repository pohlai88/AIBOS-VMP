# Development Readiness Analysis: PRDs & DB Schema

**Date:** 2025-01-22  
**Status:** ✅ Analysis Complete  
**Purpose:** Analyze which PRDs are awaiting development and assess DB schema readiness/constraints  
**Document Type:** Analysis Document (NOT a PRD)

---

## 📋 Executive Summary

**Database Schema Status:** ✅ **L1 Documented** (Ready for Development)  
**Can Develop Remaining PRDs?** ✅ **YES** - With proper schema governance

**Key Finding:** The database architecture follows **"Flexible Database, Super Flexible Schema"** philosophy, which means:
- ✅ JSONB fields can be added **WITHOUT migrations** (but require adapter + validator + UI contract updates)
- ✅ New features can use existing JSONB columns for flexible data
- ⚠️ Some features require new tables (must follow guardrail matrix)
- ✅ Schema serves as guardrails, not constraints

---

## 🎯 PRDs Awaiting Development

### 1. Vendor Management Advanced Features PRD

**Source:** `docs/VENDOR_MANAGEMENT_ADVANCED_FEATURES.md`

#### Feature 1: Cryptographic Audit Trail
- **Priority:** 🔴 **CRITICAL**
- **Effort:** 5 days
- **Impact:** 🔴 **SILENT KILLER**
- **Dependencies:** Document storage, Case management
- **DB Schema Required:** ✅ **YES** - New table for document hashes
  - New table: `nexus_document_hashes` (or similar)
  - Must follow guardrail matrix (tenant scope, RLS, JSONB contracts)
  - Can use JSONB for flexible hash metadata

#### Feature 2: Vendor Evaluation
- **Priority:** 🟡 **HIGH**
- **Effort:** 7 days
- **Impact:** 🟡 **HIGH**
- **Dependencies:** Invoice matching, Case metrics
- **DB Schema Required:** ✅ **YES** - New table for evaluations
  - New table: `nexus_vendor_evaluations` (or similar)
  - Can leverage existing `nexus_cases` and `nexus_invoices` data
  - JSONB for flexible evaluation criteria

#### Feature 3: Break-Glass Enhancement
- **Priority:** 🟡 **HIGH**
- **Effort:** 3 days
- **Impact:** 🟡 **HIGH**
- **Dependencies:** Existing break-glass (partial)
- **DB Schema Required:** ⚠️ **MAYBE** - Could use existing tables with JSONB
  - May extend `nexus_cases.metadata` or `nexus_payments.metadata`
  - Or new table: `nexus_break_glass_approvals`
  - Check existing break-glass implementation first

#### Feature 4: Vendor Suspension
- **Priority:** 🟡 **HIGH**
- **Effort:** 4 days
- **Impact:** 🟡 **HIGH**
- **Dependencies:** Vendor status tracking
- **DB Schema Required:** ⚠️ **MAYBE** - Could use existing tables
  - Option 1: Add to `nexus_tenant_relationships.metadata` (JSONB)
  - Option 2: New table: `nexus_vendor_status` (if complex workflow needed)
  - Check requirements for suspension workflow complexity

**Migration Files Needed:**
- `migrations/060_cryptographic_audit_trail.sql` (Feature 1)
- `migrations/061_vendor_evaluation.sql` (Feature 2)
- `migrations/062_break_glass_enhancement.sql` (Feature 3 - if new table)
- `migrations/063_vendor_status_management.sql` (Feature 4 - if new table)

---

### 2. Client CCP Phases (Payment & Document Workflows)

**Source:** `docs/development/notes/CCP_VALIDATION_REPORT.md`

#### Phase C9: Payment Approval Workflow
- **Status:** ❌ TODO
- **DB Schema Required:** ⚠️ **MAYBE** - Could extend existing
  - Option 1: Extend `nexus_payments` table with approval columns
  - Option 2: New table: `nexus_payment_approvals` (if complex workflow)
  - Payment states: `draft → pending_approval → approved → scheduled → released → completed`
  - Can use JSONB in `nexus_payments.metadata` for approval history

#### Phase C10: Document Request Flow
- **Status:** ❌ TODO
- **DB Schema Required:** ✅ **YES** - New table needed
  - New table: `nexus_document_requests` (or similar)
  - Must follow guardrail matrix
  - Links to cases, vendors, clients
  - JSONB for flexible document metadata

**Migration Files Needed:**
- `migrations/064_payment_approval_workflow.sql` (if new table)
- `migrations/065_document_request_flow.sql` (Feature C10)

---

### 3. SOA Reconciliation (Future)

**Source:** `docs/FINAL_PRD_WITH_CCP_CONTROL.md` (marked as "Future")

- **Status:** 🔄 Planned (Future)
- **DB Schema Required:** ✅ **YES** - New tables needed
  - Statement matching tables
  - Dispute resolution tables
  - Reconciliation report tables
  - **Note:** Marked as "Future" - not immediate priority

---

### 4. Email Notifications

**Source:** `docs/FINAL_PRD_WITH_CCP_CONTROL.md` (marked as "future")

- **Status:** 🔄 Planned (Future)
- **DB Schema Required:** ⚠️ **MAYBE** - Could extend existing
  - May extend `nexus_notifications` table
  - Or use existing notification infrastructure
  - Check if email delivery tracking needed

---

## ✅ Database Schema Readiness Assessment

### Current State: L1 Documented

**Status:** ✅ **FULLY DOCUMENTED AND OPERATIONAL**

| Component | Status | Coverage |
|-----------|--------|----------|
| **Tables Documented** | ✅ Complete | 20/20 (100%) |
| **JSONB Contracts Registered** | ✅ Complete | 21/21 (100%) |
| **RLS Policies Documented** | ✅ Complete | 20/20 (100%) |
| **Drift Checks** | ✅ Operational | 3/3 checks passing |
| **Matrix Parser** | ✅ Complete | Reads from SSOT |
| **CI Integration** | ✅ Complete | `check:drift` in CI gate |

**Compliance Level:** L1 Documented (Ready for L2 Enforced upgrade)

---

## 🚦 Can We Develop Remaining PRDs?

### ✅ **YES - With Proper Schema Governance**

**Key Principles from PRD_DB_SCHEMA.md:**

1. **"Flexible Database, Super Flexible Schema"**
   - Schema serves as guardrails, not constraints
   - JSONB fields can be added WITHOUT migrations
   - New tables require migrations but follow established patterns

2. **JSONB-First Approach**
   - Start flexible (JSONB), promote to strict (columns) when patterns stabilize
   - Many features can use existing JSONB columns
   - Only create new tables when necessary

3. **Schema Does Not Define Database**
   - Domain model defines business logic
   - Storage strategy defines how data is stored
   - Database schema optimizes for performance

---

## 📐 Development Guidelines

### For Features Using Existing Tables + JSONB

**✅ ALLOWED - No Migration Required:**
- Add new fields to existing JSONB columns (e.g., `nexus_cases.metadata`, `nexus_payments.metadata`)
- Update adapter layer to handle new JSONB fields
- Update Zod schemas for validation
- Update UI contracts
- Register new JSONB contract types in matrix

**Example:**
```javascript
// Add to existing nexus_payments.metadata JSONB
{
  "_schema_version": 1,
  "_context": {...},
  "type": "payment_metadata",
  "approval_history": [...],  // NEW FIELD - no migration needed
  "approval_workflow": {...}   // NEW FIELD - no migration needed
}
```

**Required Steps:**
1. Update `src/schemas/metadata.schema.js` (Zod validation)
2. Update `docs/ssot/db/DB_GUARDRAIL_MATRIX.md` (register contract)
3. Update adapter methods in `src/adapters/nexus-adapter.js`
4. Update UI components
5. Run `npm run check:drift` to validate

---

### For Features Requiring New Tables

**⚠️ REQUIRES MIGRATION - Must Follow Guardrail Matrix:**

**Required Steps:**
1. Create migration file in `migrations/` directory
2. Add table row to `docs/ssot/db/DB_GUARDRAIL_MATRIX.md` Section A
3. Add RLS policies to `docs/ssot/db/RLS_COVERAGE.md`
4. Register JSONB contracts (if any) in Section B
5. Update adapter in `src/adapters/nexus-adapter.js`
6. Run `npm run check:drift` to validate
7. Execute migration via Supabase MCP

**Example Pattern:**
```sql
-- migrations/060_cryptographic_audit_trail.sql
CREATE TABLE nexus_document_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  case_id UUID REFERENCES nexus_cases(id),
  hash_algorithm TEXT NOT NULL,
  hash_value TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

-- RLS policies
ALTER TABLE nexus_document_hashes ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_document_hashes_document_id ON nexus_document_hashes(document_id);
CREATE INDEX idx_document_hashes_case_id ON nexus_document_hashes(case_id);
```

---

## 🚫 What's FORBIDDEN

### Database Schema Anti-Patterns

1. **❌ Adding JSONB fields without:**
   - Zod schema validation
   - Contract registry entry
   - Adapter layer updates
   - Drift check validation

2. **❌ Creating new tables without:**
   - Guardrail matrix entry
   - RLS policies
   - Tenant scope definition
   - Core column immutability compliance

3. **❌ Modifying core columns without:**
   - Deprecation pattern (6-month grace period)
   - Shadow columns (if renaming)
   - Backward compatibility

4. **❌ Skipping drift checks:**
   - Must run `npm run check:drift` before merge
   - Must update matrix files
   - Must generate reports

---

## 🎯 Recommended Development Order

### Phase 1: Features Using Existing Tables (No Migrations)

**Priority:** Start here - fastest to implement

1. **Break-Glass Enhancement** (if can use existing JSONB)
   - Check existing implementation
   - Extend `nexus_cases.metadata` or `nexus_payments.metadata`
   - No migration needed

2. **Vendor Suspension** (if can use existing JSONB)
   - Extend `nexus_tenant_relationships.metadata`
   - No migration needed

3. **Payment Approval Workflow** (if can use existing JSONB)
   - Extend `nexus_payments.metadata`
   - Add approval history to JSONB
   - No migration needed

---

### Phase 2: Features Requiring New Tables (Migrations Needed)

**Priority:** After Phase 1 - requires migration planning

1. **Cryptographic Audit Trail** (CRITICAL)
   - New table: `nexus_document_hashes`
   - Follow guardrail matrix
   - Migration: `060_cryptographic_audit_trail.sql`

2. **Vendor Evaluation**
   - New table: `nexus_vendor_evaluations`
   - Follow guardrail matrix
   - Migration: `061_vendor_evaluation.sql`

3. **Document Request Flow**
   - New table: `nexus_document_requests`
   - Follow guardrail matrix
   - Migration: `065_document_request_flow.sql`

---

## 📊 Development Readiness Matrix

| Feature | DB Schema Required | Migration Needed | JSONB Option | Status | Can Develop? |
|---------|-------------------|-------------------|-------------|--------|--------------|
| **Cryptographic Audit Trail** | ✅ Yes | ✅ Yes | ❌ No | ❌ TODO | ✅ YES (with migration) |
| **Vendor Evaluation** | ✅ Yes | ✅ Yes | ❌ No | ❌ TODO | ✅ YES (with migration) |
| **Break-Glass Enhancement** | ⚠️ Maybe | ⚠️ Maybe | ✅ Yes | ❌ TODO | ✅ YES (check first) |
| **Vendor Suspension** | ⚠️ Maybe | ⚠️ Maybe | ✅ Yes | ❌ TODO | ✅ YES (check first) |
| **Payment Approval Workflow** | ⚠️ Maybe | ⚠️ Maybe | ✅ Yes | ❌ TODO | ✅ YES (check first) |
| **Document Request Flow** | ✅ Yes | ✅ Yes | ❌ No | ❌ TODO | ✅ YES (with migration) |
| **SOA Reconciliation** | ✅ Yes | ✅ Yes | ❌ No | 🔄 Future | ✅ YES (future) |
| **Email Notifications** | ⚠️ Maybe | ⚠️ Maybe | ✅ Yes | 🔄 Future | ✅ YES (check first) |

---

## ✅ Conclusion

### Can We Develop Remaining PRDs?

**✅ YES - Development is NOT forbidden by DB schema constraints.**

**Key Points:**
1. ✅ Database is at **L1 Documented** level (fully operational)
2. ✅ Architecture supports **flexible schema evolution**
3. ✅ JSONB-first approach allows **rapid iteration**
4. ✅ Many features can use **existing tables + JSONB** (no migrations)
5. ✅ New tables follow **established guardrail patterns**

**Requirements:**
- ✅ Follow guardrail matrix for new tables
- ✅ Register JSONB contracts
- ✅ Update adapter layer
- ✅ Run drift checks
- ✅ Follow core column immutability rules

**Recommendation:**
- Start with features that can use existing JSONB (Phase 1)
- Then proceed to features requiring new tables (Phase 2)
- Always follow the guardrail matrix and run drift checks

---

**Document Status:** ✅ Analysis Complete  
**Last Updated:** 2025-01-22  
**Next Review:** After first feature implementation

