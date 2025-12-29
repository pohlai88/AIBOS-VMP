# Payment Approval Workflow (Phase C9) - Execution Plan

**Date:** 2025-01-22  
**Status:** 🔄 In Progress  
**PRD:** Payment Approval Workflow (Phase C9)  
**Boundary:** Backend Logic + Frontend UI/UX

---

## 🧠 Execution Plan

**Goal:** Implement full payment approval workflow with state machine, approval thresholds, dual control, and payment run batching using JSONB metadata (no new tables).

**Scope:**
- ✅ IN: State machine (`draft → pending_approval → approved → scheduled → released → completed`)
- ✅ IN: Approval threshold rules (multi-level approvals)
- ✅ IN: Dual control enforcement
- ✅ IN: Payment run batching
- ✅ IN: Approval history tracking (JSONB)
- ✅ IN: Workflow UI (state transitions, approval queue)
- ❌ OUT: New database tables (use existing `nexus_payments` + JSONB)
- ❌ OUT: Email notifications (deferred to future)
- ❌ OUT: Advanced reporting (out of scope)

---

## Steps

### Phase 1: Backend Foundation

1. [ ] **Add Zod Schema for Payment Workflow Metadata**
   - File: `src/schemas/metadata.schema.js`
   - Schema: `PaymentWorkflowMetadataSchema`
   - Validation: State machine, approval rules, history
   - Validation: Run `npm test` to verify schema

2. [ ] **Create PaymentWorkflowService**
   - File: `src/services/payment-workflow.service.js` (NEW)
   - Methods:
     - `validateStateTransition(currentState, newState)`
     - `checkApprovalThresholds(payment, actorUserId)`
     - `enforceDualControl(payment, actorUserId)`
     - `addApprovalHistory(payment, action, actorUserId)`
   - Validation: Unit tests pass

3. [ ] **Enhance approvePaymentByClient Adapter**
   - File: `src/adapters/nexus-adapter.js`
   - Enhance: Support state machine transitions
   - Enhance: Store workflow in `metadata.approval_workflow`
   - Enhance: Check approval thresholds
   - Enhance: Enforce dual control
   - Validation: Integration tests pass

4. [ ] **Add createPaymentRun Adapter Method**
   - File: `src/adapters/nexus-adapter.js`
   - Method: `createPaymentRun({ clientId, paymentIds, actorUserId })`
   - Creates payment run with batch of payments
   - Stores run metadata in JSONB
   - Validation: Integration tests pass

5. [ ] **Add releasePayment Adapter Method**
   - File: `src/adapters/nexus-adapter.js`
   - Method: `releasePayment({ paymentId, clientId, actorUserId })`
   - Transitions: `approved → scheduled → released`
   - Validation: Integration tests pass

### Phase 2: Routes

6. [ ] **Enhance Payment Approve Route**
   - File: `src/routes/nexus-client.js`
   - Route: `POST /nexus/client/payments/:payment_id/approve`
   - Enhance: Use workflow service
   - Validation: Manual test approve flow

7. [ ] **Add Payment Reject Route**
   - File: `src/routes/nexus-client.js`
   - Route: `POST /nexus/client/payments/:payment_id/reject`
   - Transitions: `pending_approval → rejected`
   - Validation: Manual test reject flow

8. [ ] **Add Create Payment Run Route**
   - File: `src/routes/nexus-client.js`
   - Route: `POST /nexus/client/payment-runs`
   - Creates batch of payments for approval
   - Validation: Manual test create run

9. [ ] **Add Release Payment Run Route**
   - File: `src/routes/nexus-client.js`
   - Route: `POST /nexus/client/payment-runs/:run_id/release`
   - Releases all payments in run
   - Validation: Manual test release run

### Phase 3: Frontend UI

10. [ ] **Enhance Payment Detail Page**
    - File: `src/views/nexus/pages/client-payment-detail.html`
    - Add: Workflow state display
    - Add: Approval queue UI
    - Add: State transition buttons (approve, reject, release)
    - Add: Approval history timeline
    - Validation: Visual inspection, HTMX works

11. [ ] **Create Payment Run Creation Page**
    - File: `src/views/nexus/pages/client-payment-run-create.html` (NEW)
    - Route: `GET /nexus/client/payment-runs/create`
    - UI: Batch selection interface
    - Validation: Visual inspection, form submission works

12. [ ] **Create Approval Dashboard Page**
    - File: `src/views/nexus/pages/client-approval-dashboard.html` (NEW)
    - Route: `GET /nexus/client/approvals`
    - UI: Pending approvals list, approval queue by threshold
    - Validation: Visual inspection, filters work

---

## Risks/Assumptions

**Assumptions:**
- Payment metadata JSONB column exists and is writable
- Existing `approvePaymentByClient()` can be enhanced without breaking existing calls
- Approval thresholds can be configured per client (stored in JSONB)
- Dual control means 2 different users must approve (not same user twice)

**Risks:**
- State machine conflicts with existing payment status values
- JSONB schema changes may break existing payment records
- Approval workflow may conflict with existing approval logic

**Mitigation:**
- Use versioned JSONB schema (`_schema_version`)
- Maintain backward compatibility (existing payments work)
- Add migration path for existing payments

---

## Validation Criteria

**Backend:**
- [ ] All adapter methods use `nexusAdapter` (no direct Supabase)
- [ ] All inputs validated with Zod schemas
- [ ] Error handling complete (try-catch, proper status codes)
- [ ] State machine transitions validated
- [ ] Approval thresholds enforced
- [ ] Dual control enforced

**Frontend:**
- [ ] All templates use Nunjucks syntax
- [ ] All dynamic updates use HTMX (no vanilla JS)
- [ ] All templates follow design system contracts
- [ ] All components mobile-responsive
- [ ] All templates use VMP semantic classes for data presentation

**Testing:**
- [ ] Unit tests for state machine
- [ ] Integration tests for approval workflow
- [ ] E2E tests for approval flow
- [ ] Test coverage ≥ 80%

---

**Status:** Ready for execution

