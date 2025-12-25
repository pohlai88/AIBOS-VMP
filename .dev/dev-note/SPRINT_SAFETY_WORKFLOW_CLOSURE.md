# Sprint: Safety & Workflow Closure

> **Sprint Goal:** Close Safety Gaps & Validate Critical Flows  
> **Target:** Move implementation status from **89.5%** → **95%+** (Ready for UAT)  
> **Duration:** 10 Days  
> **Sprint Type:** Verification & Gap Closure

**Document Status:** SSOT Sprint Plan  
**Last Updated:** 2025-12-22  
**Version:** v1.0.0  
**Based On:** 360-Degree Planning vs Implementation Audit

---

## Executive Summary

### Current State Analysis

**Key Finding:** The 360 audit identified several "missing" features that are **already implemented** but need verification:

1. ✅ **Emergency Pay Override** - **IMPLEMENTED** (Migration 026, routes, adapter, UI)
2. ✅ **Bank Details Change Approval** - **IMPLEMENTED** (Creates payment case, approval gates exist)
3. ✅ **Conditional Checklist Engine** - **IMPLEMENTED** (checklist-rules.js with country/vendor type logic)
4. ✅ **AI Response Generation** - **IMPLEMENTED** (generateValidationResponse function exists)
5. ⚠️ **Privacy Shield** - **PARTIALLY IMPLEMENTED** (Needs verification and edge case fixes)
6. ⚠️ **Onboarding Verification Workflow** - **NEEDS VERIFICATION** (Routes exist, workflow unclear)

### Sprint Focus

This sprint prioritizes **verification and testing** over new implementation, with targeted fixes for identified gaps.

---

## Sprint Backlog & Estimates

| Priority | Ticket ID | Task Name | Type | Est. Effort | Status | Source Gap |
| --- | --- | --- | --- | --- | --- | --- |
| **P0** | **VERIFY-01** | **Emergency Pay Override Verification** | 🔍 QA/Test | 0.5 Days | ⏳ Pending | Audit Gap #1 (Already Implemented) |
| **P0** | **VERIFY-02** | **Privacy Shield Audit & Fixes** | 🛡️ Security | 1 Day | ⏳ Pending | Audit Gap #5 |
| **P1** | **VERIFY-03** | **Conditional Checklist Engine Validation** | 🔍 QA/Test | 2 Days | ⏳ Pending | Audit Gap #2 (Already Implemented) |
| **P1** | **VERIFY-04** | **Bank Details Change Approval Gate Verification** | ⚙️ QA/Test | 1 Day | ⏳ Pending | Audit Gap #4 (Already Implemented) |
| **P1** | **VERIFY-05** | **Onboarding Verification Workflow** | 🔍 QA/Fix | 1.5 Days | ⏳ Pending | Audit Gap #3 |
| **P2** | **VERIFY-06** | **AI Actionable Response Verification** | 🤖 QA/Test | 1 Day | ⏳ Pending | Audit Gap #6 (Already Implemented) |
| **P2** | **VERIFY-07** | **Contract Library Verification** | 🔍 QA/Test | 0.5 Days | ⏳ Pending | Audit Gap #7 |
| **P2** | **VERIFY-08** | **SLA Analytics Verification** | 📊 QA/Test | 0.5 Days | ⏳ Pending | Audit Gap #8 |

**Total Estimated Effort:** 8 Days  
**Buffer:** 2 Days (for unexpected issues)

---

## Phase 1: Critical Safety Verification (Days 1-2)

### VERIFY-01: Emergency Pay Override Verification

**Status:** ✅ **Already Implemented** - Needs verification testing

**Implementation Found:**
- ✅ Migration: `migrations/026_vmp_emergency_pay_override.sql`
- ✅ Routes: `server.js` lines 2195-2343
- ✅ Adapter: `src/adapters/supabase.js` (requestEmergencyPayOverride, approveEmergencyPayOverride, rejectEmergencyPayOverride)
- ✅ UI: `src/views/partials/emergency_pay_override.html`
- ✅ Integration: Payment detail view includes override section

**Verification Tasks:**

1. **Database Schema Verification**
   - [ ] Verify migration 026 has been applied
   - [ ] Verify table `vmp_emergency_pay_overrides` exists with all required fields
   - [ ] Verify indexes are created
   - [ ] Verify foreign key constraints

2. **Backend Route Testing**
   - [ ] Test `POST /payments/:id/emergency-override` (request override)
   - [ ] Test `POST /payments/emergency-override/:overrideId/approve` (approve)
   - [ ] Test `POST /payments/emergency-override/:overrideId/reject` (reject)
   - [ ] Test `GET /payments/emergency-overrides` (list overrides)
   - [ ] Verify authorization (internal only)
   - [ ] Verify audit logging to `vmp_decision_log`

3. **UI Integration Testing**
   - [ ] Verify override form appears in payment detail view (internal users only)
   - [ ] Test override request submission
   - [ ] Test approval/rejection workflow
   - [ ] Verify urgency level selection (high, critical, emergency)
   - [ ] Verify reason field is required

4. **Workflow Testing**
   - [ ] Test end-to-end: Request → Approve → Payment processed
   - [ ] Test rejection workflow
   - [ ] Verify override status tracking
   - [ ] Test metadata field functionality

5. **Edge Cases**
   - [ ] Test with invalid payment ID
   - [ ] Test with missing reason
   - [ ] Test with non-internal user (should fail)
   - [ ] Test duplicate override requests

**Acceptance Criteria:**
- ✅ All routes return correct status codes
- ✅ Authorization is enforced (internal only)
- ✅ Audit trail is created for all actions
- ✅ UI is functional and accessible
- ✅ Workflow completes end-to-end

**Files to Review:**
- `migrations/026_vmp_emergency_pay_override.sql`
- `server.js` (lines 2195-2343)
- `src/adapters/supabase.js` (lines 5448-5702)
- `src/views/partials/emergency_pay_override.html`
- `src/views/partials/payment_detail.html`

---

### VERIFY-02: Privacy Shield Audit & Fixes

**Status:** ⚠️ **Partially Implemented** - Needs verification and edge case fixes

**Current Implementation:**
- ✅ Escalation partial shows internal contact only if `isInternal` is true
- ✅ Supplier view shows generic team name only
- ⚠️ Need to verify all views that expose internal user information

**Verification Tasks:**

1. **View Audit (Comprehensive)**
   - [ ] Audit `src/views/partials/escalation.html` (lines 32-64)
   - [ ] Audit `src/views/partials/case_detail.html` (check for internal user exposure)
   - [ ] Audit `src/views/partials/case_thread.html` (message sender information)
   - [ ] Audit `src/views/partials/case_inbox.html` (assigned user information)
   - [ ] Audit `src/views/pages/home.html` (any internal user references)
   - [ ] Audit all partials that display user information

2. **Masking Rules Verification**
   - [ ] Verify `isInternal` flag is correctly passed to all views
   - [ ] Test supplier view: Should show "AP Manager" not email/name
   - [ ] Test internal view: Should show full contact details
   - [ ] Verify no internal emails visible in supplier view DOM

3. **Edge Cases**
   - [ ] Test with unassigned cases (no assigned_user)
   - [ ] Test with cases assigned to internal users
   - [ ] Test with cases assigned to vendors
   - [ ] Test escalation zone in supplier vs internal view

4. **Code Review**
   - [ ] Verify all user queries filter by `is_internal` flag
   - [ ] Verify no raw user emails/names in supplier-facing templates
   - [ ] Check for any hardcoded internal user references

**Fixes Required (If Found):**

1. **Case Thread Partial** (`src/views/partials/case_thread.html`)
   - If internal user names/emails are shown to suppliers, mask with generic labels
   - Example: "Internal Agent" instead of actual name

2. **Case Detail Partial** (`src/views/partials/case_detail.html`)
   - Verify assigned user information is masked for suppliers
   - Check decision log entries for internal user exposure

3. **Any Other Views**
   - Apply same masking rules consistently

**Acceptance Criteria:**
- ✅ No internal user emails visible in supplier view (DOM inspection)
- ✅ No internal user names visible in supplier view
- ✅ Generic labels used ("AP Manager", "Procurement Agent", etc.)
- ✅ Internal users see full contact details
- ✅ All views pass privacy shield audit

**Files to Review:**
- `src/views/partials/escalation.html`
- `src/views/partials/case_detail.html`
- `src/views/partials/case_thread.html`
- `src/views/partials/case_inbox.html`
- `src/views/pages/home.html`
- All routes that render user information

---

## Phase 2: Critical Workflow Logic Verification (Days 3-6)

### VERIFY-03: Conditional Checklist Engine Validation

**Status:** ✅ **Already Implemented** - Needs comprehensive testing

**Implementation Found:**
- ✅ Rules file: `src/utils/checklist-rules.js`
- ✅ Conditional logic for country codes (US, EU, MY, etc.)
- ✅ Conditional logic for vendor types (individual, corporate, international)
- ✅ Adapter method: `ensureChecklistSteps` (needs verification)

**Verification Tasks:**

1. **Rules Engine Testing**
   - [ ] Test `getChecklistStepsForCaseType('onboarding', null, { countryCode: 'US' })`
     - Expected: W-9 Form, EIN Certificate
   - [ ] Test `getChecklistStepsForCaseType('onboarding', null, { countryCode: 'MY' })`
     - Expected: GST Registration
   - [ ] Test `getChecklistStepsForCaseType('onboarding', null, { countryCode: 'GB' })`
     - Expected: VAT Certificate (EU)
   - [ ] Test `getChecklistStepsForCaseType('onboarding', null, { countryCode: 'VN' })`
     - Expected: Tax ID (generic)
   - [ ] Test `getChecklistStepsForCaseType('onboarding', null, { vendorType: 'individual' })`
     - Expected: No Company Registration Certificate
   - [ ] Test `getChecklistStepsForCaseType('onboarding', null, { vendorType: 'corporate' })`
     - Expected: Company Registration Certificate
   - [ ] Test `getChecklistStepsForCaseType('onboarding', null, { vendorType: 'international' })`
     - Expected: International Trade License, Import/Export Permit

2. **Integration Testing**
   - [ ] Verify `ensureChecklistSteps` in adapter calls rules engine correctly
   - [ ] Test case creation with different country codes
   - [ ] Test case creation with different vendor types
   - [ ] Verify checklist steps are created in database
   - [ ] Verify conditional steps are filtered correctly

3. **Test Matrix**

| Country | Vendor Type | Expected Steps |
|---------|------------|---------------|
| US | Corporate | Company Registration, Bank Letter, Tax ID, EIN, W-9 |
| US | Individual | Bank Letter, Tax ID, EIN, W-9 (no Company Registration) |
| MY | Corporate | Company Registration, Bank Letter, Tax ID, GST |
| GB | Corporate | Company Registration, Bank Letter, Tax ID, VAT (EU) |
| VN | Corporate | Company Registration, Bank Letter, Tax ID |
| Any | International | + International Trade License, Import/Export Permit |

4. **Edge Cases**
   - [ ] Test with null country code
   - [ ] Test with invalid country code
   - [ ] Test with null vendor type
   - [ ] Test with combination of country + vendor type
   - [ ] Test with non-onboarding case types (should not use conditional logic)

**Acceptance Criteria:**
- ✅ All country-specific rules work correctly
- ✅ All vendor type-specific rules work correctly
- ✅ Conditional logic filters steps correctly
- ✅ Database checklist steps match expected rules
- ✅ Test matrix passes 100%

**Files to Review:**
- `src/utils/checklist-rules.js`
- `src/adapters/supabase.js` (ensureChecklistSteps method)
- Routes that create onboarding cases

**Test Script:**
```javascript
// Create test cases for each combination
const testCases = [
  { country: 'US', vendorType: 'corporate', expectedSteps: ['company_registration', 'bank_letter', 'tax_id', 'ein_certificate', 'w9_form'] },
  { country: 'US', vendorType: 'individual', expectedSteps: ['bank_letter', 'tax_id', 'ein_certificate', 'w9_form'] },
  { country: 'MY', vendorType: 'corporate', expectedSteps: ['company_registration', 'bank_letter', 'tax_id', 'tax_certificate'] },
  // ... more test cases
];
```

---

### VERIFY-04: Bank Details Change Approval Gate Verification

**Status:** ✅ **Already Implemented** - Needs verification testing

**Implementation Found:**
- ✅ Route: `POST /profile/bank-details` (line 2752)
- ✅ Adapter: `requestBankDetailsChange` (line 3696)
- ✅ Creates payment case instead of updating DB directly
- ✅ Requires bank letter evidence

**Verification Tasks:**

1. **Workflow Testing**
   - [ ] Test bank details change request from profile page
   - [ ] Verify payment case is created (case_type = 'payment')
   - [ ] Verify case is NOT immediately resolved
   - [ ] Verify `vmp_vendor_profile` is NOT updated on request
   - [ ] Verify case requires "bank_letter" evidence
   - [ ] Test approval workflow (internal user approves case)
   - [ ] Verify `vmp_vendor_profile` is updated ONLY after case is resolved

2. **Approval Gate Testing**
   - [ ] Test that vendor cannot approve their own bank change
   - [ ] Test that internal user can approve bank change
   - [ ] Verify case status must be "resolved" before DB update
   - [ ] Test rejection workflow (case rejected, DB not updated)

3. **Evidence Requirement**
   - [ ] Verify bank letter upload is required
   - [ ] Test case cannot be resolved without bank letter
   - [ ] Test case can be resolved with bank letter uploaded

4. **Data Integrity**
   - [ ] Verify old bank details remain until approval
   - [ ] Verify new bank details are stored in case metadata
   - [ ] Verify bank details are correctly updated after approval
   - [ ] Test concurrent bank change requests (should create separate cases)

5. **Edge Cases**
   - [ ] Test with missing required fields (account_name, account_number, etc.)
   - [ ] Test with invalid SWIFT code format
   - [ ] Test with duplicate bank change request
   - [ ] Test cancellation of bank change request

**Acceptance Criteria:**
- ✅ Bank change creates payment case (not direct DB update)
- ✅ Approval gate is enforced (internal user only)
- ✅ Bank letter evidence is required
- ✅ DB update only occurs after case resolution
- ✅ Workflow completes end-to-end

**Files to Review:**
- `server.js` (line 2752: POST /profile/bank-details)
- `src/adapters/supabase.js` (line 3696: requestBankDetailsChange)
- `src/views/pages/profile.html`
- Routes that handle case approval/resolution

**Test Flow:**
```
1. Vendor submits bank change request
   → Payment case created (status: open)
   → vmp_vendor_profile NOT updated

2. Vendor uploads bank letter
   → Evidence linked to case
   → Case status: waiting_internal

3. Internal user reviews and approves
   → Case status: resolved
   → vmp_vendor_profile updated with new bank details
```

---

### VERIFY-05: Onboarding Verification Workflow

**Status:** ⚠️ **Needs Verification** - Routes exist, workflow unclear

**Verification Tasks:**

1. **Route Discovery**
   - [ ] Search for onboarding approval routes
   - [ ] Search for procurement review routes
   - [ ] Search for AP review routes
   - [ ] Document all routes related to onboarding verification

2. **Workflow Mapping**
   - [ ] Map onboarding case lifecycle
   - [ ] Identify verification steps
   - [ ] Identify approval gates
   - [ ] Document who can approve (procurement vs AP)

3. **Testing**
   - [ ] Test onboarding case creation
   - [ ] Test checklist step completion
   - [ ] Test verification workflow (procurement review)
   - [ ] Test approval workflow (AP review)
   - [ ] Test activation after approval
   - [ ] Test rejection workflow

4. **Gap Analysis**
   - [ ] Identify missing workflow steps
   - [ ] Identify missing routes
   - [ ] Identify missing UI components
   - [ ] Document required fixes

5. **Implementation (If Needed)**
   - [ ] Create missing routes (if any)
   - [ ] Create missing UI components (if any)
   - [ ] Update workflow documentation

**Acceptance Criteria:**
- ✅ Onboarding workflow is fully documented
- ✅ All verification steps are functional
- ✅ Approval gates are enforced
- ✅ Vendor activation works correctly
- ✅ End-to-end workflow completes

**Files to Review:**
- All routes in `server.js` related to onboarding
- `src/adapters/supabase.js` (onboarding methods)
- `src/views/partials/case_checklist.html`
- Routes for case approval/resolution

**Expected Workflow:**
```
1. Supplier accepts invite
   → Onboarding case created
   → Checklist steps generated (conditional)

2. Supplier uploads required documents
   → Checklist steps marked as submitted
   → Case status: waiting_internal

3. Procurement reviews documents
   → Documents verified/rejected
   → Case status: waiting_ap (if procurement approved)

4. AP reviews and approves
   → Case status: resolved
   → Vendor status: active
```

---

## Phase 3: AI & Analytics Verification (Days 7-8)

### VERIFY-06: AI Actionable Response Verification

**Status:** ✅ **Already Implemented** - Needs verification testing

**Implementation Found:**
- ✅ Function: `generateValidationResponse` in `src/utils/ai-data-validation.js` (line 429)
- ✅ Function: `validateCaseData` (line 13)
- ✅ Routes: Auto-respond routes in `server.js`

**Verification Tasks:**

1. **Response Generation Testing**
   - [ ] Test with missing required documents
     - Expected: Actionable request message ("Upload PDF here")
   - [ ] Test with complete documents
     - Expected: Success message
   - [ ] Test with data issues
     - Expected: Issue-specific messages
   - [ ] Test with partial completeness
     - Expected: Completeness percentage + missing items

2. **Actionable Requests**
   - [ ] Verify response includes upload actions
   - [ ] Verify actions link to correct evidence types
   - [ ] Verify actions link to correct checklist steps
   - [ ] Test action execution (upload via action)

3. **Message Quality**
   - [ ] Verify messages are clear and actionable
   - [ ] Verify messages are not too robotic
   - [ ] Verify messages include specific document names
   - [ ] Verify messages include next steps

4. **Integration Testing**
   - [ ] Test auto-respond route: `/api/cases/:id/auto-respond`
   - [ ] Verify response is sent as message to case
   - [ ] Verify response is tagged as AI-generated
   - [ ] Test with different case types

5. **Edge Cases**
   - [ ] Test with empty case (no checklist steps)
   - [ ] Test with all documents waived
   - [ ] Test with validation errors
   - [ ] Test with escalation required

**Acceptance Criteria:**
- ✅ Responses are actionable (include specific upload requests)
- ✅ Messages are clear and professional
- ✅ Actions are functional (can trigger uploads)
- ✅ Auto-respond route works correctly
- ✅ Messages are properly tagged (AI-generated)

**Files to Review:**
- `src/utils/ai-data-validation.js` (lines 429-485)
- `server.js` (auto-respond routes)
- Routes that call `generateValidationResponse`

**Test Cases:**
```javascript
// Test Case 1: Missing Invoice PDF
const validation = {
  isValid: false,
  missingRequired: [{
    stepId: 'step-1',
    stepLabel: 'Upload Invoice PDF',
    evidenceType: 'invoice_pdf'
  }]
};
const response = generateValidationResponse(validation, caseData);
// Expected: Message includes "Upload Invoice PDF", action with type 'upload'
```

---

### VERIFY-07: Contract Library Verification

**Status:** ⚠️ **Needs Verification** - Partial exists

**Verification Tasks:**

1. **UI Verification**
   - [ ] Verify contract library partial exists: `src/views/partials/contract_library.html`
   - [ ] Verify contract library route exists
   - [ ] Test contract library page loads
   - [ ] Test contract list displays

2. **Functionality Testing**
   - [ ] Test contract upload (if available)
   - [ ] Test contract download
   - [ ] Test contract filtering (NDA, MSA, Indemnity)
   - [ ] Test contract search
   - [ ] Verify contract metadata display

3. **Data Verification**
   - [ ] Verify contracts are stored correctly
   - [ ] Verify contract types are categorized
   - [ ] Verify contract access control
   - [ ] Test contract expiration tracking (if implemented)

4. **Gap Analysis**
   - [ ] Identify missing features
   - [ ] Document required enhancements
   - [ ] Prioritize fixes

**Acceptance Criteria:**
- ✅ Contract library displays contracts
- ✅ Contract download works
- ✅ Contract filtering works (if implemented)
- ✅ All gaps documented

**Files to Review:**
- `src/views/partials/contract_library.html`
- Routes related to contracts
- `src/adapters/supabase.js` (contract methods)

---

### VERIFY-08: SLA Analytics Verification

**Status:** ⚠️ **Needs Verification** - SLA fields exist, analytics unclear

**Verification Tasks:**

1. **Data Verification**
   - [ ] Verify `sla_due_at` field exists in cases table
   - [ ] Verify SLA calculation logic exists
   - [ ] Verify SLA reminder system works
   - [ ] Test SLA due date calculation

2. **Analytics Discovery**
   - [ ] Search for SLA analytics routes
   - [ ] Search for SLA dashboard components
   - [ ] Search for SLA metrics calculations
   - [ ] Document existing SLA tracking

3. **Gap Analysis**
   - [ ] Identify missing analytics features
   - [ ] Identify missing dashboard components
   - [ ] Document required metrics
   - [ ] Prioritize implementation

4. **Implementation (If Needed)**
   - [ ] Create SLA analytics routes (if missing)
   - [ ] Create SLA dashboard components (if missing)
   - [ ] Implement SLA metrics calculations

**Acceptance Criteria:**
- ✅ SLA fields are tracked correctly
- ✅ SLA analytics exist (or gap documented)
- ✅ SLA metrics are calculated correctly
- ✅ All gaps documented with priority

**Files to Review:**
- `src/utils/sla-reminders.js`
- Dashboard routes
- Analytics routes
- `migrations/003_vmp_cases_checklist.sql` (SLA fields)

---

## Phase 4: Documentation & Closure (Days 9-10)

### Documentation Tasks

1. **Update 360 Audit**
   - [ ] Update audit with verification results
   - [ ] Mark completed items as verified
   - [ ] Update completion percentages
   - [ ] Document remaining gaps

2. **Update Consolidated Paper**
   - [ ] Update implementation status
   - [ ] Document verified features
   - [ ] Update version number

3. **Create Test Reports**
   - [ ] Document all test results
   - [ ] Document edge cases tested
   - [ ] Document bugs found and fixed
   - [ ] Create test coverage report

4. **Sprint Retrospective**
   - [ ] Document lessons learned
   - [ ] Document process improvements
   - [ ] Update sprint velocity
   - [ ] Plan next sprint

---

## Definition of Done (DoD)

### For Each Verification Task

1. ✅ **Code Review Complete**
   - All relevant files reviewed
   - Implementation status confirmed
   - Gaps identified

2. ✅ **Testing Complete**
   - All test cases executed
   - Edge cases tested
   - Test results documented

3. ✅ **Fixes Applied (If Needed)**
   - Bugs fixed
   - Missing features implemented
   - Code reviewed

4. ✅ **Documentation Updated**
   - Test results documented
   - Gaps documented
   - Status updated in audit

### For Sprint Completion

1. ✅ **All P0 Tasks Complete**
   - Emergency Pay Override verified
   - Privacy Shield verified and fixed

2. ✅ **All P1 Tasks Complete**
   - Conditional Checklist verified
   - Bank Change verified
   - Onboarding Workflow verified

3. ✅ **P2 Tasks Complete (or Gaps Documented)**
   - AI Response verified
   - Contract Library verified (or gap documented)
   - SLA Analytics verified (or gap documented)

4. ✅ **Documentation Complete**
   - 360 Audit updated
   - Consolidated Paper updated
   - Test reports created
   - Sprint retrospective complete

5. ✅ **Implementation Status Updated**
   - Completion percentage: **95%+**
   - Ready for UAT

---

## Risk Management

### Identified Risks

1. **Risk:** Onboarding workflow may have missing steps
   - **Mitigation:** Comprehensive route discovery and workflow mapping
   - **Contingency:** Document gaps and prioritize for next sprint

2. **Risk:** Privacy shield may have edge cases
   - **Mitigation:** Comprehensive view audit
   - **Contingency:** Fix critical issues, document minor issues

3. **Risk:** Test coverage may reveal unexpected bugs
   - **Mitigation:** Allocate buffer time
   - **Contingency:** Prioritize critical bugs, defer minor bugs

### Dependencies

- Access to test environment
- Test data availability
- Internal user accounts for testing
- Vendor accounts for testing

---

## Success Metrics

### Sprint Metrics

- **Completion Rate:** Target 100% of P0 and P1 tasks
- **Test Coverage:** Target 90%+ for verified features
- **Bug Count:** Track bugs found and fixed
- **Documentation:** All tasks documented

### Quality Metrics

- **Code Quality:** No new linting errors
- **Test Quality:** All edge cases covered
- **Documentation Quality:** All gaps documented

---

## Next Steps After Sprint

1. **UAT Preparation**
   - Prepare test scenarios
   - Prepare test data
   - Prepare user guides

2. **Next Sprint Planning**
   - Prioritize remaining gaps
   - Plan SOA module (if needed)
   - Plan SLA analytics (if needed)

3. **Production Readiness**
   - Performance testing
   - Security audit
   - Deployment planning

---

**Document Status:** SSOT Sprint Plan  
**Last Updated:** 2025-12-22  
**Version:** v1.0.0

