# PRD Development Recommendation

**Date:** 2025-01-22  
**Status:** ✅ Recommendation Ready  
**Purpose:** Recommend which PRD to develop first based on boundaries, priorities, and constraints

---

## 🎯 Recommended PRD: Payment Approval Workflow (Phase C9)

### Why This PRD?

**✅ Aligns with Development Boundaries:**
- **Boundary:** Backend Logic + Frontend UI/UX (NO DB-Metadata-Schema)
- **No Migration Required:** Can use existing `nexus_payments` table + JSONB metadata
- **Fastest to Implement:** Builds on existing payment infrastructure

**✅ High Business Value:**
- Core client workflow (payment approval is critical)
- Part of Client CCP Phase C9 (defined requirements)
- Enhances existing basic approval (already has `approvePaymentByClient()`)

**✅ Low Risk:**
- Existing table structure supports it
- Can use JSONB for workflow state (no schema changes)
- Follows established patterns

---

## 📋 Current State Analysis

### What Exists (Basic Implementation)
- ✅ `nexus_payments` table with `approved_at`, `approved_by` columns
- ✅ `approvePaymentByClient()` adapter method
- ✅ `disputePaymentByClient()` adapter method
- ✅ Basic approve/dispute routes
- ✅ Migration 053: Payment decision columns added

### What's Missing (Full Workflow)
- ❌ Payment state machine: `draft → pending_approval → approved → scheduled → released → completed`
- ❌ Approval threshold rules (multi-level approvals)
- ❌ Dual control enforcement
- ❌ Payment run batching
- ❌ Approval history tracking (can use JSONB)
- ❌ Workflow UI (state transitions, approval queue)

---

## 🏗️ Implementation Strategy

### Phase 1: Enhance Existing (No Migration)

**Use JSONB in `nexus_payments.metadata` for:**
```javascript
{
  "_schema_version": 1,
  "_context": {...},
  "type": "payment_metadata",
  "approval_workflow": {
    "current_state": "pending_approval",
    "state_history": [
      { "state": "draft", "timestamp": "...", "user_id": "..." },
      { "state": "pending_approval", "timestamp": "...", "user_id": "..." }
    ],
    "approval_rules": {
      "threshold_amount": 10000,
      "requires_dual_control": true,
      "approvers": ["USR-...", "USR-..."]
    },
    "approvals": [
      { "approver_id": "USR-...", "timestamp": "...", "status": "approved" }
    ]
  }
}
```

**Benefits:**
- ✅ No migration needed (uses existing JSONB column)
- ✅ Flexible workflow (can evolve without schema changes)
- ✅ Full audit trail in JSONB
- ✅ Can promote to columns later if needed

---

## 📐 Development Plan

### Backend Logic (Boundary 2)

**Tasks:**
1. **Enhance Adapter Methods**
   - Extend `approvePaymentByClient()` to handle state machine
   - Add `createPaymentRun()` for batching
   - Add `releasePayment()` for final release
   - Add approval threshold validation

2. **Add Service Layer**
   - `PaymentWorkflowService` - State machine logic
   - `ApprovalRuleService` - Threshold/dual control rules
   - `PaymentRunService` - Batching logic

3. **Add Routes**
   - `POST /nexus/client/payments/:id/approve` (enhance existing)
   - `POST /nexus/client/payments/:id/reject`
   - `POST /nexus/client/payment-runs` (create batch)
   - `POST /nexus/client/payment-runs/:id/release`

4. **Validation**
   - Zod schemas for approval workflow JSONB
   - State transition validation
   - Approval threshold validation

### Frontend UI/UX (Boundary 1)

**Tasks:**
1. **Payment Detail Page Enhancement**
   - Show current state in workflow
   - Approval queue UI (who needs to approve)
   - State transition buttons (approve, reject, release)
   - Approval history timeline

2. **Payment Run UI**
   - Create payment run page
   - Batch selection interface
   - Approval queue for payment runs
   - Release confirmation

3. **Approval Dashboard**
   - Pending approvals list
   - Approval queue by amount threshold
   - Dual control requirements indicator

---

## ✅ Definition of Done

### Backend
- [ ] State machine implemented in service layer
- [ ] Approval threshold rules implemented
- [ ] Dual control enforcement working
- [ ] Payment run batching functional
- [ ] All routes use `nexusAdapter`
- [ ] All inputs validated with Zod
- [ ] Error handling complete

### Frontend
- [ ] Payment detail shows workflow state
- [ ] Approval queue UI functional
- [ ] State transition buttons work
- [ ] Payment run creation UI complete
- [ ] Approval dashboard functional
- [ ] All templates use Nunjucks
- [ ] All dynamic updates use HTMX

### Testing
- [ ] Unit tests for state machine
- [ ] Integration tests for approval workflow
- [ ] E2E tests for approval flow
- [ ] Test coverage ≥ 80%

---

## 🚫 What's NOT Included (Deferred)

**These require DB-Metadata-Schema (DEFERRED):**
- ❌ New tables (use existing `nexus_payments`)
- ❌ Schema migrations (use JSONB)
- ❌ Metadata governance features
- ❌ Schema evolution patterns

**These are future enhancements:**
- ❌ Email notifications (marked as "future")
- ❌ Advanced reporting (out of scope)
- ❌ Multi-currency (out of scope)

---

## 📊 Comparison with Other PRDs

| PRD | Priority | Effort | DB Migration | Boundary | Recommendation |
|-----|----------|--------|--------------|----------|----------------|
| **Payment Approval Workflow** | 🟡 HIGH | 3-5 days | ❌ No (JSONB) | Backend+Frontend | ✅ **RECOMMENDED** |
| Break-Glass Enhancement | 🟡 HIGH | 3 days | ⚠️ Maybe | Backend+Frontend | ⚠️ Check first |
| Vendor Suspension | 🟡 HIGH | 4 days | ⚠️ Maybe | Backend+Frontend | ⚠️ Check first |
| Cryptographic Audit Trail | 🔴 CRITICAL | 5 days | ✅ Yes | DB-Metadata-Schema | ❌ **DEFERRED** |
| Vendor Evaluation | 🟡 HIGH | 7 days | ✅ Yes | DB-Metadata-Schema | ❌ **DEFERRED** |
| Document Request Flow | 🟡 HIGH | 4 days | ✅ Yes | DB-Metadata-Schema | ❌ **DEFERRED** |

**Why Payment Approval Workflow Wins:**
1. ✅ No DB migration needed (uses JSONB)
2. ✅ Aligns with active boundaries (Backend+Frontend)
3. ✅ High business value (core workflow)
4. ✅ Builds on existing infrastructure
5. ✅ Fastest to implement (3-5 days)

---

## 🎯 Next Steps

1. **Review Existing Implementation**
   - Check `approvePaymentByClient()` in adapter
   - Review migration 053 structure
   - Understand current payment status flow

2. **Design JSONB Schema**
   - Define approval workflow structure
   - Design state machine in JSONB
   - Plan approval history format

3. **Implement Backend**
   - Enhance adapter methods
   - Create service layer
   - Add routes
   - Add validation

4. **Implement Frontend**
   - Enhance payment detail page
   - Create approval queue UI
   - Add payment run UI
   - Create approval dashboard

5. **Test & Deploy**
   - Write tests
   - Run drift checks
   - Deploy to staging
   - Verify workflow

---

## 📚 Related Documents

- **PRD Source:** `docs/development/notes/CCP_VALIDATION_REPORT.md` (Phase C9)
- **Architecture:** `docs/development/prds/PRD_CONSOLIDATED.md` (Boundaries)
- **DB Schema:** `docs/development/prds/PRD_DB_SCHEMA.md` (JSONB patterns)
- **Readiness:** `docs/development/DEVELOPMENT_READINESS_ANALYSIS.md`

---

**Recommendation:** ✅ **Start with Payment Approval Workflow (Phase C9)**  
**Estimated Time:** 3-5 days  
**Boundary:** Backend Logic + Frontend UI/UX  
**DB Migration:** ❌ Not Required (uses JSONB)

