# PRD Consolidation Strategy — Kernel Doctrine Alignment

**Status:** 🚨 CRITICAL — Must Complete Before L0 Implementation  
**Version:** 1.0.0  
**Date:** 2025-01-22  
**Authority:** Derived from [NEXUS_CANON_V5_KERNEL_DOCTRINE.md](../../ssot/db/NEXUS_CANON_V5_KERNEL_DOCTRINE.md)

---

## Executive Summary

**Problem:** Current PRDs use incompatible structure (Frontend/Backend/Utils/DB boundaries) that does not align with Kernel Doctrine's **L0-L3 Layer Model**. This prevents proper L0 Kernel Registry implementation.

**Solution:** Consolidate all PRDs into a unified structure that:
1. Maps features to **L0-L3 layers** (Kernel → Domain → Cluster → Cell)
2. Uses **P0-P1-P2-P3 priority framework** aligned with business value
3. Separates **Metadata (L0)** from **Schema (L1)** from **Execution (L2/L3)**
4. Creates **single source of truth** for all development work

**Critical Path:** This consolidation **MUST** be completed before Phase 1 (Kernel Instantiation) of the Implementation Roadmap.

---

## Current State Analysis

### Existing PRD Structure (Incompatible)

| PRD File | Current Structure | Issues |
|----------|-------------------|--------|
| `PRD_MAIN.md` | Technical stack + CCP gates | ❌ No L0-L3 mapping<br>❌ No P0-P1-P2-P3 priorities<br>❌ Mixes all layers |
| `PRD_CONSOLIDATED.md` | Frontend/Backend/Utils/DB boundaries | ❌ Boundaries ≠ Layers<br>❌ DB deferred (should be L0)<br>❌ No Kernel Doctrine alignment |
| `PRD_VENDOR_PORTAL.md` | Feature analysis | ❌ No layer assignment<br>❌ No priority framework |
| `PRD_VENDOR_ADVANCED_FEATURES.md` | Feature priorities (CRITICAL/HIGH) | ❌ Priorities not P0-P1-P2-P3<br>❌ No L0-L3 mapping |
| `PRD_DB_SCHEMA.md` | Database architecture (Deferred) | ❌ Should be L0 Kernel Registry<br>❌ Currently isolated/deferred |
| `PRD_RECOMMENDATION.md` | Development recommendations | ❌ No Kernel Doctrine context |

### Root Cause

**Current PRDs assume:**
- Development boundaries = Technical layers (Frontend/Backend)
- Database = Separate concern (deferred)
- Priorities = Ad-hoc (CRITICAL/HIGH/MEDIUM)

**Kernel Doctrine requires:**
- Development layers = Business layers (L0-L3)
- Database = L0 Kernel Registry (foundational, not deferred)
- Priorities = Structured (P0-P1-P2-P3) mapped to business value

---

## Target State — Unified PRD Structure

### Structure Overview

```
PRD_MASTER.md (Single Source of Truth)
├── Section 1: Kernel Doctrine Alignment
│   ├── L0-L3 Layer Model Overview
│   ├── P0-P1-P2-P3 Priority Framework
│   └── Feature-to-Layer Mapping Rules
│
├── Section 2: L0 Kernel Registry (P0)
│   ├── Concept Registry Requirements
│   ├── Jurisdictional Value Sets
│   ├── Canonical Identity Mapping
│   └── Metadata Governance
│
├── Section 3: L1 Domain Policies (P0-P1)
│   ├── Finance Domain
│   ├── Supply Chain Domain
│   ├── Marketing Domain
│   └── Franchise Domain
│
├── Section 4: L2 Cluster Workflows (P1-P2)
│   ├── Treasury Operations
│   ├── Trade Marketing
│   ├── Vendor Management
│   └── Payment Processing
│
├── Section 5: L3 Cell Execution (P2-P3)
│   ├── Client Portal Features
│   ├── Vendor Portal Features
│   ├── Admin Features
│   └── Reporting Features
│
└── Section 6: Implementation Roadmap
    ├── Phase 1: L0 Kernel Instantiation (P0)
    ├── Phase 2: L1 Domain Policies (P0-P1)
    ├── Phase 3: L2 Cluster Workflows (P1-P2)
    └── Phase 4: L3 Cell Execution (P2-P3)
```

---

## Priority Framework (P0-P1-P2-P3)

### P0 — Critical (Must Have for L0)

**Definition:** Features required for Kernel Registry instantiation. Without P0, L0 cannot exist.

**Examples:**
- Concept Registry schema
- Jurisdictional Value Set tables
- Canonical Identity Mapping
- Metadata governance enforcement
- Drift detection system

**Timeline:** Immediate (Phase 1)

### P1 — High (Required for L1)

**Definition:** Features required for Domain Policy implementation. Enables L1 layer functionality.

**Examples:**
- Finance domain policy engine
- Supply Chain domain policy engine
- Permission matrix
- RBAC aligned with L0

**Timeline:** Phase 2-3

### P2 — Medium (Required for L2)

**Definition:** Features required for Cluster Workflow implementation. Enables operational workflows.

**Examples:**
- Payment approval workflows
- Vendor onboarding workflows
- Invoice processing workflows
- Case management workflows

**Timeline:** Phase 3-4

### P3 — Low (Enhancement for L3)

**Definition:** Features that enhance L3 Cell Execution but are not required for core functionality.

**Examples:**
- Advanced reporting
- Email notifications
- Multi-currency support
- Advanced analytics

**Timeline:** Phase 4+

---

## Feature-to-Layer Mapping Rules

### Rule 1: L0 (Kernel) — What Belongs Here

**L0 contains ONLY:**
- Concept definitions (Bank, Currency, Counterparty)
- Jurisdictional value sets (Malaysia Banks, Global Currencies)
- Canonical identity mappings (Immutable IDs, Official aliases)
- Metadata governance rules (JSONB contracts, validation)

**L0 does NOT contain:**
- Business logic
- User interfaces
- Workflow definitions
- Domain-specific policies

### Rule 2: L1 (Domain) — What Belongs Here

**L1 contains:**
- Domain policy engines (Finance, Supply Chain, Marketing, Franchise)
- Permission definitions (who may use which L0 values)
- Domain-specific validation rules
- RBAC policies aligned with L0

**L1 does NOT contain:**
- Workflow definitions (L2)
- User interfaces (L3)
- Execution logic (L3)

### Rule 3: L2 (Cluster) — What Belongs Here

**L2 contains:**
- Operational workflows (Treasury Ops, Trade Marketing)
- Approval chains
- Workflow state machines
- Cluster-specific business rules

**L2 does NOT contain:**
- Concept definitions (L0)
- Domain policies (L1)
- User interfaces (L3)

### Rule 4: L3 (Cell) — What Belongs Here

**L3 contains:**
- User-facing interfaces (Client Portal, Vendor Portal)
- Execution actions (AP clerks, merchandisers, promoters)
- UI/UX components
- Reporting dashboards

**L3 does NOT contain:**
- Any authority (all authority derived from L0-L2)
- Business logic (all logic derived from L0-L2)

---

## Migration Plan — Current PRDs → Unified PRD

### Step 1: Inventory All Features

**From `PRD_MAIN.md`:**
- Technical stack definition → **Keep as reference** (not layer-specific)
- CCP gates → **Map to L0-L3 layers**
- MCP strategy → **Keep as reference**

**From `PRD_CONSOLIDATED.md`:**
- Frontend UI/UX → **Map to L3 (Cell Execution)**
- Backend Logic → **Map to L1-L2 (Domain/Cluster)**
- Utils → **Keep as reference** (cross-layer utilities)
- DB-Metadata-Schema → **Map to L0 (Kernel Registry)** ⚠️ **NOT DEFERRED**

**From `PRD_VENDOR_PORTAL.md`:**
- Vendor onboarding → **L2 (Cluster Workflow)**
- Vendor dashboard → **L3 (Cell Execution)**
- Vendor features → **Map to L1-L3 based on type**

**From `PRD_VENDOR_ADVANCED_FEATURES.md`:**
- Cryptographic Audit Trail → **L0 (Kernel Registry) - P0**
- Vendor Evaluation → **L1 (Domain Policy) - P1**
- Break-Glass Enhancement → **L2 (Cluster Workflow) - P1**
- Vendor Suspension → **L2 (Cluster Workflow) - P1**

**From `PRD_DB_SCHEMA.md`:**
- Database schema → **L0 (Kernel Registry) - P0** ⚠️ **NOT DEFERRED**
- JSONB contracts → **L0 (Kernel Registry) - P0**
- RLS policies → **L1 (Domain Policy) - P0**
- Drift checks → **L0 (Kernel Registry) - P0**

**From `PRD_RECOMMENDATION.md`:**
- Payment Approval Workflow → **L2 (Cluster Workflow) - P1**
- Recommendations → **Use to prioritize P0-P1-P2-P3**

### Step 2: Create Feature Inventory Matrix

| Feature | Current PRD | Target Layer | Priority | Migration Notes |
|---------|-------------|--------------|----------|-----------------|
| Concept Registry | PRD_DB_SCHEMA | L0 | P0 | **CRITICAL** - Must be first |
| JSONB Contracts | PRD_DB_SCHEMA | L0 | P0 | **CRITICAL** - Required for L0 |
| Drift Detection | PRD_DB_SCHEMA | L0 | P0 | **CRITICAL** - Enforcement mechanism |
| RLS Policies | PRD_DB_SCHEMA | L1 | P0 | **CRITICAL** - Security foundation |
| Finance Domain | None | L1 | P0 | **NEW** - Required for L1 |
| Payment Workflow | PRD_RECOMMENDATION | L2 | P1 | **HIGH** - Business critical |
| Vendor Portal | PRD_VENDOR_PORTAL | L3 | P2 | **MEDIUM** - User-facing |
| Client Portal | PRD_MAIN | L3 | P2 | **MEDIUM** - User-facing |
| Advanced Reporting | PRD_VENDOR_ADVANCED | L3 | P3 | **LOW** - Enhancement |

### Step 3: Create Unified PRD Structure

**New File:** `PRD_MASTER.md`

**Sections:**
1. **Kernel Doctrine Alignment** — Links to Kernel Doctrine, explains L0-L3 model
2. **L0 Kernel Registry (P0)** — All P0 features required for Kernel instantiation
3. **L1 Domain Policies (P0-P1)** — Domain policy engines and permissions
4. **L2 Cluster Workflows (P1-P2)** — Operational workflows and approval chains
5. **L3 Cell Execution (P2-P3)** — User-facing interfaces and execution
6. **Implementation Roadmap** — Phased approach aligned with Kernel Doctrine Section 11

### Step 4: Archive Legacy PRDs

**Archive (Keep for Reference):**
- `PRD_MAIN.md` → `archive/prds/PRD_MAIN_LEGACY.md`
- `PRD_CONSOLIDATED.md` → `archive/prds/PRD_CONSOLIDATED_LEGACY.md`
- `PRD_VENDOR_PORTAL.md` → `archive/prds/PRD_VENDOR_PORTAL_LEGACY.md`
- `PRD_VENDOR_ADVANCED_FEATURES.md` → `archive/prds/PRD_VENDOR_ADVANCED_LEGACY.md`
- `PRD_DB_SCHEMA.md` → `archive/prds/PRD_DB_SCHEMA_LEGACY.md`
- `PRD_RECOMMENDATION.md` → `archive/prds/PRD_RECOMMENDATION_LEGACY.md`

**New Structure:**
- `PRD_MASTER.md` — Single source of truth (Kernel Doctrine aligned)

---

## Critical Decision: P0 Handling

### Option A: Consolidate ALL PRDs First (Recommended)

**Pros:**
- ✅ Complete alignment with Kernel Doctrine before L0 implementation
- ✅ No rework needed after L0 is built
- ✅ Clear priority framework (P0-P1-P2-P3) from start
- ✅ Single source of truth prevents confusion

**Cons:**
- ⚠️ Takes time (1-2 days for consolidation)
- ⚠️ Delays L0 implementation start

**Recommendation:** **DO THIS** — The consolidation ensures L0 is built correctly the first time.

### Option B: Handle P0 Separately (Not Recommended)

**Pros:**
- ✅ Faster start on L0 implementation
- ✅ Can begin immediately

**Cons:**
- ❌ Risk of building wrong L0 structure
- ❌ Will need rework when PRDs are consolidated
- ❌ No clear priority framework
- ❌ Features may be assigned to wrong layers

**Recommendation:** **DON'T DO THIS** — The risk of building the wrong L0 structure outweighs the time saved.

---

## Implementation Checklist

### Phase 0: PRD Consolidation (BEFORE L0 Implementation)

- [ ] **Step 1:** Create feature inventory matrix (all features from all PRDs)
- [ ] **Step 2:** Map each feature to L0-L3 layer
- [ ] **Step 3:** Assign P0-P1-P2-P3 priorities
- [ ] **Step 4:** Create `PRD_MASTER.md` with unified structure
- [ ] **Step 5:** Review and validate against Kernel Doctrine
- [ ] **Step 6:** Archive legacy PRDs
- [ ] **Step 7:** Update `DOCUMENTATION_REGISTRY.md`

### Phase 1: L0 Kernel Instantiation (P0 Only)

- [ ] **Only after PRD consolidation is complete**
- [ ] Implement Concept Registry schema
- [ ] Implement Jurisdictional Value Set tables
- [ ] Implement Canonical Identity Mapping
- [ ] Implement Metadata governance enforcement

---

## Success Criteria

**PRD Consolidation is complete when:**

1. ✅ All features mapped to L0-L3 layers
2. ✅ All features assigned P0-P1-P2-P3 priorities
3. ✅ `PRD_MASTER.md` created and validated
4. ✅ Legacy PRDs archived
5. ✅ Documentation registry updated
6. ✅ Kernel Doctrine alignment verified

**Only then can Phase 1 (L0 Kernel Instantiation) begin.**

---

## Next Steps

1. **Immediate:** Review this consolidation strategy
2. **Decision:** Approve Option A (consolidate all PRDs first)
3. **Action:** Begin feature inventory and mapping
4. **Deliverable:** `PRD_MASTER.md` aligned with Kernel Doctrine

---

**Document Status:** 🚨 CRITICAL — Blocks L0 Implementation  
**Authority:** Derived from Kernel Doctrine Section 11 (Implementation Roadmap)  
**Owner:** Product + Engineering  
**Last Updated:** 2025-01-22

