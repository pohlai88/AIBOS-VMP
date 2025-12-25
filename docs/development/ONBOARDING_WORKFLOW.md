# Onboarding Workflow Documentation

**Last Updated:** 2025-12-22  
**Status:** Decision Required  
**Version:** 1.0.0

---

## Current Implementation

The current onboarding workflow uses a **simplified single-step approval model**:

```
1. Supplier accepts invite
   → Onboarding case created (owner_team: 'procurement')
   → Checklist steps generated (conditional based on country/vendor type)
   → Case status: 'open'

2. Supplier uploads required documents
   → Evidence uploaded to case
   → Checklist steps marked as 'submitted'
   → Case status: 'waiting_internal' (via updateCaseStatusFromEvidence)

3. Internal users verify evidence
   → Procurement/AP users verify checklist steps
   → Checklist steps marked as 'verified' or 'rejected'
   → Case status updates based on evidence status

4. Internal user approves onboarding
   → POST /cases/:id/approve-onboarding
   → Case status: 'resolved'
   → Vendor status: 'active'
```

**Key Characteristics:**
- Any internal user can verify evidence
- Any internal user can approve onboarding
- No explicit two-step process (procurement → AP)
- Flexible and simple

---

## Workflow Options

### Option A: Simplified Single-Step Model (Current)

**Description:** Single approval step where any internal user can verify evidence and approve onboarding.

**Pros:**
- ✅ Simple and flexible
- ✅ Faster approval process
- ✅ Less overhead
- ✅ Works well for small teams
- ✅ Already implemented and tested

**Cons:**
- ❌ No explicit separation of procurement review and AP approval
- ❌ May not meet compliance requirements for some organizations
- ❌ Less granular control over approval process

**Use Cases:**
- Small to medium organizations
- Organizations with flexible approval processes
- Teams where procurement and AP work closely together

---

### Option B: Two-Step Workflow (Procurement → AP)

**Description:** Explicit two-step process where procurement verifies documents first, then AP approves activation.

**Workflow:**
```
1. Supplier accepts invite
   → Onboarding case created (owner_team: 'procurement')
   → Checklist steps generated
   → Case status: 'open'

2. Supplier uploads required documents
   → Evidence uploaded to case
   → Checklist steps marked as 'submitted'
   → Case status: 'waiting_internal'

3. Procurement verifies evidence
   → Procurement users verify checklist steps
   → Checklist steps marked as 'verified'
   → Case status: 'waiting_ap' (new status)
   → Notification sent to AP team

4. AP reviews and approves
   → AP users review procurement verification
   → POST /cases/:id/approve-onboarding (AP only)
   → Case status: 'resolved'
   → Vendor status: 'active'
```

**Pros:**
- ✅ Clear separation of responsibilities
- ✅ Better compliance and audit trail
- ✅ Matches traditional procurement → AP workflow
- ✅ More granular control
- ✅ Better for large organizations

**Cons:**
- ❌ More complex implementation
- ❌ Slower approval process
- ❌ Requires additional status transitions
- ❌ More notifications and coordination

**Use Cases:**
- Large organizations
- Organizations with strict compliance requirements
- Organizations with separate procurement and AP teams
- Organizations requiring explicit two-step approval

---

## Implementation Requirements

### If Option A (Simplified) is Chosen:

**Action Required:**
- ✅ Document current workflow (this document)
- ✅ Update project documentation
- ✅ Mark as complete

**Estimated Effort:** 0.5 days

---

### If Option B (Two-Step) is Chosen:

**Implementation Tasks:**

1. **Database Changes** (0.25 days)
   - Add `waiting_ap` to case status enum (if not exists)
   - Verify status transitions are valid

2. **Backend Changes** (0.5 days)
   - Update `verifyEvidence` to transition to `waiting_ap` when all steps verified
   - Add `waiting_ap` status check in `updateCaseStatus`
   - Update `approveOnboarding` to require AP team or specific role
   - Add procurement verification gate

3. **Frontend Changes** (0.5 days)
   - Update case detail UI to show workflow stages
   - Add "Waiting for AP" status indicator
   - Update approval button to show AP-only message
   - Add workflow stage visualization

4. **Notifications** (0.25 days)
   - Add notification when case transitions to `waiting_ap`
   - Notify AP team when case ready for approval
   - Add notification when procurement verification complete

5. **Testing** (0.25 days)
   - Test procurement verification workflow
   - Test AP approval workflow
   - Test status transitions
   - Test notifications

**Estimated Effort:** 1.5 days

**Files to Modify:**
- `migrations/` - Add status if needed
- `src/adapters/supabase.js` - Update workflow logic
- `server.js` - Update routes if needed
- `src/views/partials/case_detail.html` - Update UI
- Notification system - Add workflow notifications

---

## Decision Matrix

| Criteria | Option A (Simplified) | Option B (Two-Step) |
|----------|----------------------|---------------------|
| **Complexity** | Low | Medium |
| **Speed** | Fast | Slower |
| **Compliance** | Basic | Enhanced |
| **Flexibility** | High | Medium |
| **Audit Trail** | Basic | Enhanced |
| **Implementation Effort** | 0.5 days | 1.5 days |
| **Maintenance** | Low | Medium |

---

## Recommendation

**Recommended:** Option A (Simplified Model)

**Rationale:**
1. Already implemented and working correctly
2. Meets current business requirements
3. Faster approval process
4. Lower maintenance overhead
5. Can be enhanced later if needed

**When to Consider Option B:**
- If compliance requirements mandate two-step approval
- If organization grows and needs stricter controls
- If audit requirements change

---

## Decision Status

**Status:** ⏳ **AWAITING STAKEHOLDER DECISION**

**Next Steps:**
1. Review this document with stakeholders
2. Make decision on workflow model
3. If Option A: Document and mark complete
4. If Option B: Implement two-step workflow

---

**Document Owner:** Development Team  
**Review Required:** Product Owner, Compliance Team  
**Decision Deadline:** TBD

