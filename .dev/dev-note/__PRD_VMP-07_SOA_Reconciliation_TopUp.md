# PRD — VMP-07  
## Statement of Account (SOA) Reconciliation  
**NexusCanon VMP — Financial Control Protocol (Top-Up)**

---

## 1. Purpose

This PRD defines a **minimal, protocol-driven enhancement** to NexusCanon VMP that introduces **Statement of Account (SOA) Reconciliation** as a **first-class control surface**, without redesigning the existing system.

The objective is to elevate VMP from a **vendor communication portal** into a **Financial Control OS**, while preserving:

- “Everything is a Case”
- Evidence-first governance
- Multi-tenant isolation
- Low implementation complexity

This is a **top-up**, not a rewrite.

---

## 2. Problem Statement

Today:
- Vendors submit statements and evidence off-system
- Reconciliation happens in spreadsheets, email, or chat
- Variance handling lacks audit lineage
- Sign-off is implicit, not controlled

This creates:
- Audit risk
- Settlement disputes
- Non-defensible overrides
- Fragmented truth

---

## 3. Solution Overview (Minimal)

Introduce **SOA Reconciliation** as:

- A **new Case Type**: `soa`
- A **shadow ledger overlay** (does not replace AP)
- A **3-column Recon Workspace**
- A **rule-based matching protocol** (no AI required at MVP)

No new frameworks.  
No deep inheritance engines.  
No schema-per-tenant.

---

## 4. Scope

### In Scope (MVP)
- SOA upload (CSV first)
- Automatic matching (Exact + Tolerance + Normalized Doc No)
- Manual matching with evidence
- Variance tracking
- Controlled sign-off
- Full audit trail

### Out of Scope (Explicit)
- OCR / PDF parsing
- Advanced AI fuzzy matching
- Automatic posting to GL
- Multi-currency FX engines
- Schema-per-tenant isolation

---

## 5. Core Principles (Protocol)

1. **Everything is a Case**
2. **No match is silent**
3. **Evidence precedes settlement**
4. **Overrides are logged, never hidden**
5. **Tenant isolation is enforced at DB level**

---

## 6. User Roles

### Vendor User
- Upload SOA
- View reconciliation status
- Upload missing evidence
- Acknowledge sign-off

### Internal Ops / Finance
- Review SOA cases
- Match or dispute lines
- Approve resolutions
- Execute sign-off

---

## 7. Workflow (End-to-End)

1. Vendor uploads SOA  
2. System creates **SOA Case**  
3. Matching protocol runs  
4. Unmatched lines become **Issues**  
5. Evidence is requested/uploaded  
6. Variance reduces to zero / tolerance  
7. Digital sign-off enabled  
8. Case closed  

---

## 8. Matching Protocol (Simple)

### Pass A — Exact Match
```
vendor + doc_no + currency + amount
```

### Pass B — Tolerance Match
- Same as Pass A
- Date window: ±7 days

### Pass C — Normalized Doc No
- Strip spaces, dashes, punctuation
- Re-attempt Pass A / B

---

## 9. Status Model

### SOA Case Status
- ACTION_REQUIRED
- CLEAN
- ON_HOLD
- CLOSED

### SOA Line Status
- UNMATCHED
- MATCHED_EXACT
- MATCHED_TOLERANCE
- PARTIAL_MATCH
- DISPUTED
- RESOLVED

---

## 10. Definition of Done

- SOA upload creates a Case
- Lines auto-match using defined passes
- Unmatched lines create issues
- Evidence can be uploaded and linked
- Net variance is computed
- Sign-off is blocked until clean/tolerant
- All actions are auditable
