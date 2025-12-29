# Payment Approval Workflow - Template System Audit

**Date:** 2025-01-22  
**Status:** 🔴 **NON-COMPLIANT** - Multiple violations found  
**Issue:** Implementation did not follow template system patterns

---

## 🚨 Critical Violations Found

### 1. View Templates (HTML Pages) - ⚠️ **PARTIALLY COMPLIANT**

**Context:** Nexus pages use `nexus-*` classes (separate design system from VMP `.vmp-*` classes)

**Violations:**
- ⚠️ **Did not check for Nexus-specific template pattern** (no Nexus boilerplate exists, but should follow existing Nexus page patterns)
- ❌ **Missing VIEW CONTRACT headers** in HTML files (template system requires this)
- ⚠️ **Inline styles used** (violates CONTRACT-001 for data presentation - but Nexus pages may allow this)
- ✅ **Using `nexus-*` classes** (correct for Nexus pages, matches existing pattern)
- ✅ **Extends `nexus/layout.html`** (correct)

**Files Affected:**
- `src/views/nexus/pages/client-payment-run-create.html`
- `src/views/nexus/pages/client-approval-dashboard.html`
- `src/views/nexus/pages/client-payment-detail.html` (enhanced section)

**Required:**
- Should include VIEW CONTRACT header (even if Nexus-specific)
- Should minimize inline styles (use CSS classes where possible)
- Should follow existing Nexus page patterns more closely (check `client-payments.html`, `client-dashboard.html` for structure)

---

### 2. Service Template - ⚠️ **NEEDS CLARIFICATION**

**File:** `src/services/payment-workflow.service.js`

**Analysis:**
- ⚠️ **Does not extend BaseRepository** (template requires this for CRUD services)
- ⚠️ **Not a service class** (it's a utility module with exported functions)
- ⚠️ **Missing TEMPLATE CONTRACT header**
- ⚠️ **Missing domain declaration**
- ✅ **Has state transition validation** (good pattern)

**Question:** Is this a CRUD service or utility?

**If CRUD Service:**
- Should extend `BaseRepository`
- Should follow `service.template.js`
- Should have TEMPLATE CONTRACT header
- Should declare domain (`finance`)

**If Utility Service:**
- May not need BaseRepository
- Should still have header/documentation
- Should declare domain/purpose
- May need utility template (if exists) or exception documented

**Current Status:** ⚠️ **UNCLEAR** - Need to determine if this should be a CRUD service or utility

---

### 3. Route Template - ✅ **COMPLIANT** (Nexus Pattern)

**File:** `src/routes/nexus-client.js` (new routes added)

**Analysis:**
- ✅ **Follows existing Nexus route pattern** (matches `nexus-client.js` style)
- ✅ **Uses `requireNexusAuth` and `requireNexusContext`** (correct for Nexus)
- ✅ **Uses `getClientId()` helper** (matches existing pattern)
- ✅ **Error handling consistent** with existing routes
- ⚠️ **No Zod validation** (but existing Nexus routes don't use Zod either - manual validation)
- ⚠️ **No domain declaration** (template suggests this, but Nexus routes don't declare domains)

**Routes Affected:**
- `POST /nexus/client/payments/:payment_id/reject`
- `GET /nexus/client/payment-runs/create`
- `POST /nexus/client/payment-runs`
- `POST /nexus/client/payments/:payment_id/release`
- `GET /nexus/client/approvals`

**Status:** ✅ **COMPLIANT** with Nexus route patterns (not generic route template)

**Note:** The `route.page.template.js` appears to be for generic routes, not Nexus-specific routes. Nexus routes have their own pattern (no Zod, manual validation, `requireNexusAuth`).

---

## 📊 Compliance Breakdown

| Component | Template Required | Status | Compliance % |
|-----------|------------------|--------|--------------|
| **View Templates** | Nexus page pattern | ⚠️ Partial | 60% |
| **Service Template** | `service.template.js` or utility | ⚠️ Unclear | 40% |
| **Route Template** | Nexus route pattern | ✅ Compliant | 90% |
| **Template Contracts** | VIEW/TEMPLATE CONTRACT headers | ❌ Missing | 0% |
| **Nexus Classes** | `.nexus-*` classes | ✅ Used | 100% |
| **Inline Styles** | CONTRACT-001 | ⚠️ Used (needs review) | 50% |

**Overall Compliance:** 🟡 **57%** (Partially Compliant - Needs Improvement)

**Key Findings:**
- ✅ Routes follow Nexus pattern correctly
- ✅ Uses Nexus classes (correct for Nexus pages)
- ❌ Missing VIEW CONTRACT headers
- ⚠️ Inline styles need review (may be acceptable for Nexus)
- ⚠️ Service template compliance unclear (utility vs CRUD)

---

## 🔧 Required Fixes

### Priority 1: View Templates (Medium)

**Action:** Add VIEW CONTRACT headers and review inline styles

**Files to Fix:**
1. `src/views/nexus/pages/client-payment-run-create.html`
2. `src/views/nexus/pages/client-approval-dashboard.html`
3. `src/views/nexus/pages/client-payment-detail.html` (workflow section)

**Changes Required:**
- ✅ Keep `nexus-*` classes (correct for Nexus pages)
- ✅ Keep `nexus/layout.html` extension (correct)
- ❌ **Add VIEW CONTRACT headers** (required by template system)
- ⚠️ **Review inline styles** (minimize if possible, but Nexus pages may allow)
- ✅ Follow existing Nexus page structure (check `client-payments.html`, `client-dashboard.html`)

### Priority 2: Route Template (Low)

**Action:** Routes are compliant with Nexus pattern

**Status:** ✅ **COMPLIANT** - Routes follow existing Nexus route patterns correctly

**Optional Enhancements:**
- Consider adding Zod validation (but not required if Nexus routes don't use it)
- Consider adding domain declaration (but not required if Nexus routes don't declare domains)

### Priority 3: Service Template (Medium)

**Action:** Clarify service type and add documentation

**Decision Needed:** Is `payment-workflow.service.js` a CRUD service or utility?

**If Utility (Current):**
- Add header documenting it's a utility service
- Add domain declaration (`finance`)
- Document why it doesn't extend BaseRepository

**If CRUD Service (Future):**
- Refactor to extend BaseRepository
- Follow `service.template.js` structure
- Add TEMPLATE CONTRACT header

---

## 📝 Template System Requirements

### View Template Requirements

1. **Must start from boilerplate:**
   ```bash
   cp src/views/templates/page-boilerplate.html src/views/nexus/pages/new-page.html
   ```

2. **Must include VIEW CONTRACT header:**
   ```nunjucks
   {# ============================================================================
      VIEW CONTRACT
      Type: View
      Category: Full Page
      Trust Level: Authenticated
      Domain: finance
      Version: 1.0.0
      ============================================================================ #}
   ```

3. **Must use VMP semantic classes:**
   - `.vmp-h2` for headings
   - `.vmp-body` for body text
   - `.vmp-label-kicker` for labels
   - `.vmp-card` for cards
   - `.vmp-panel` for panels
   - NO inline styles

### Route Template Requirements

1. **Must follow template structure:**
   - Validation schemas (Zod)
   - Auth guards
   - Business logic
   - Standardized error handling
   - Domain declaration

2. **Must include TEMPLATE CONTRACT header**

### Service Template Requirements

1. **Must extend BaseRepository** (if CRUD service)
2. **Must include TEMPLATE CONTRACT header**
3. **Must declare domain**
4. **Must define state transitions** (if entity has status)

---

## ✅ Corrective Action Plan

### Step 1: Fix View Templates
- [ ] Refactor `client-payment-run-create.html` using `page-boilerplate.html`
- [ ] Refactor `client-approval-dashboard.html` using `page-boilerplate.html`
- [ ] Refactor workflow section in `client-payment-detail.html`
- [ ] Remove all inline styles
- [ ] Add VIEW CONTRACT headers
- [ ] Use VMP semantic classes

### Step 2: Fix Route Templates
- [ ] Add Zod validation schemas for all new routes
- [ ] Standardize error handling
- [ ] Add domain declarations
- [ ] Follow template structure

### Step 3: Fix Service Template
- [ ] Decide: CRUD service or utility?
- [ ] If CRUD: Refactor to extend BaseRepository
- [ ] If utility: Document exception and create utility template
- [ ] Add TEMPLATE CONTRACT header

---

**Status:** 🟡 **AUDIT COMPLETE - MINOR FIXES REQUIRED**  
**Compliance:** 57% (Partially Compliant)  
**Priority:** MEDIUM - Should fix VIEW CONTRACT headers and clarify service type

**Summary:**
- ✅ Routes: Compliant with Nexus pattern
- ✅ HTML: Uses correct Nexus classes
- ❌ Missing: VIEW CONTRACT headers
- ⚠️ Review: Inline styles (may be acceptable)
- ⚠️ Clarify: Service type (utility vs CRUD)

