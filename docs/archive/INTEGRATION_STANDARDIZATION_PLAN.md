# Integration Standardization Plan (Sprint-Based)

**Date:** 2025-12-22  
**Status:** ✅ Complete (All 5 Sprints Executed)  
**Completion Date:** 2025-12-22  
**Objective:** Standardize, unify, and synchronize all 75 routes per `.cursorrules`  
**Reference:** `__CODEBASE_AUDIT_REPORT.md`  
**Verification Report:** `__STANDARDIZATION_VERIFICATION_REPORT.md`  
**Plan Audit:** `__PLAN_VS_CODEBASE_AUDIT.md`

---

## Executive Summary

This plan breaks down the standardization of 75 routes into 4 focused sprints, each targeting specific route categories. Each sprint includes:
- Route identification
- Standardization tasks
- Testing requirements
- Acceptance criteria

**Total Routes:** 75 routes  
**Sprint Duration:** 1 week per sprint  
**Total Duration:** 4 weeks

---

## Sprint 1: Critical Case Routes (20 routes)

**Duration:** 1 week  
**Priority:** 🔴 Critical  
**Focus:** Case management routes (highest impact, most complex)

### Routes to Standardize

#### Case Detail Routes (4 routes)
- `GET /cases/:id` - Case detail page
- `GET /partials/case-detail.html` - Case detail partial
- `GET /partials/case-row.html` - Case row partial
- `GET /ops/cases/:id` - Internal ops case detail

#### Case Action Routes (6 routes)
- `POST /cases/:id/messages` - Create message
- `POST /cases/:id/evidence` - Upload evidence
- `POST /cases/:id/verify-evidence` - Verify evidence
- `POST /cases/:id/reject-evidence` - Reject evidence
- `POST /cases/:id/reassign` - Reassign case
- `POST /cases/:id/update-status` - Update case status

#### Escalation Routes (3 routes)
- `GET /partials/escalation.html` - Escalation partial
- `POST /cases/:id/escalate` - Escalate case
- `POST /cases/:id/break-glass` - Break glass protocol

#### Case Data Routes (7 routes)
- `GET /partials/case-inbox.html` - Case inbox partial
- `GET /partials/case-thread.html` - Case thread partial
- `GET /partials/case-checklist.html` - Case checklist partial
- `GET /partials/case-evidence.html` - Case evidence partial
- `GET /ops/cases` - Internal ops case queue page
- `GET /partials/ops-case-queue.html` - Ops case queue partial
- `GET /partials/decision-log.html` - Decision log partial

### Tasks

#### Task 1.1: Standardize Case Detail Routes
- [ ] Update `GET /cases/:id` to use `requireAuth`, `validateUUIDParam`, `handleRouteError`
- [ ] Update `GET /partials/case-detail.html` to use `validateRequiredQuery`, `handlePartialError`
- [ ] Update `GET /partials/case-row.html` to use `validateRequiredQuery`, `handlePartialError`
- [ ] Update `GET /ops/cases/:id` to use `requireInternal`, `validateUUIDParam`, `handleRouteError`
- [ ] Replace all `console.error()` with `logError()`
- [ ] Standardize error responses

**Files to Modify:**
```
server.js (lines ~360-404, ~446-490, ~696-738)
```

#### Task 1.2: Standardize Case Action Routes
- [ ] Update all POST routes to use `requireAuth`, `validateUUIDParam`
- [ ] Standardize error handling with `handleRouteError` or `handlePartialError`
- [ ] Replace `console.error()` with `logError()`
- [ ] Ensure consistent validation patterns

**Files to Modify:**
```
server.js (lines ~746-823, ~825-954, ~956-1050, ~1052-1148, ~1150-1220, ~1222-1292)
```

#### Task 1.3: Standardize Escalation Routes
- [ ] Update escalation routes to use standardized helpers
- [ ] Ensure break glass protocol uses proper error handling
- [ ] Standardize director info fetching error handling

**Files to Modify:**
```
server.js (lines ~642-693, ~1294-1420)
```

#### Task 1.4: Standardize Case Data Routes
- [ ] Update all case data partial routes
- [ ] Standardize to use `handlePartialError` for graceful degradation
- [ ] Ensure consistent data fetching error handling

**Files to Modify:**
```
server.js (lines ~421-444, ~492-523, ~525-593, ~595-640, ~2334-2400, ~2200-2330, ~2300-2330)
```

### Acceptance Criteria

- [ ] All 20 routes use `requireAuth` or `requireInternal` consistently
- [ ] All UUID parameters validated with `validateUUIDParam`
- [ ] All error handling uses `logError()` instead of `console.error()`
- [ ] All routes follow standard pattern from `.cursorrules`
- [ ] All error responses use `handleRouteError` or `handlePartialError`
- [ ] No duplicate error handling code
- [ ] All routes tested for error paths
- [ ] All routes tested for authentication/authorization

### Testing Requirements

- [ ] Test case detail routes with invalid UUIDs
- [ ] Test case action routes without authentication
- [ ] Test escalation routes with missing director info
- [ ] Test case data routes with missing data
- [ ] Verify error messages are user-friendly
- [ ] Verify error logging includes proper context

---

## Sprint 2: Invoice & Payment Routes (15 routes)

**Duration:** 1 week  
**Priority:** 🟡 High  
**Focus:** Financial data routes (invoice transparency, payment visibility)

### Routes to Standardize

#### Invoice Routes (8 routes)
- `GET /invoices` - Invoice list page
- `GET /partials/invoice-list.html` - Invoice list partial
- `GET /invoices/:id` - Invoice detail page
- `GET /partials/invoice-detail.html` - Invoice detail partial
- `GET /partials/matching-status.html` - Matching status partial
- `POST /invoices/:id/open-case` - Open case from invoice
- `POST /ops/ingest/invoices` - Ingest invoices CSV
- `GET /partials/invoice-ingest-form.html` - Invoice ingest form

#### Payment Routes (7 routes)
- `GET /payments` - Payment list page
- `GET /partials/payment-list.html` - Payment list partial
- `GET /payments/:id` - Payment detail page
- `GET /partials/payment-detail.html` - Payment detail partial
- `GET /partials/remittance-viewer.html` - Remittance viewer partial
- `POST /ops/ingest/payments` - Ingest payments CSV
- `POST /ops/ingest/remittances` - Ingest remittances

### Tasks

#### Task 2.1: Standardize Invoice Routes
- [ ] Update invoice list routes to use `requireAuth`, `handleRouteError`
- [ ] Update invoice detail routes to use `validateUUIDParam`
- [ ] Standardize matching status partial error handling
- [ ] Standardize invoice ingest route (file upload handling)
- [ ] Replace `console.error()` with `logError()`

**Files to Modify:**
```
server.js (lines ~1500-1600, ~1600-1700)
```

#### Task 2.2: Standardize Payment Routes
- [ ] Update payment list routes to use standardized helpers
- [ ] Update payment detail routes with proper validation
- [ ] Standardize remittance viewer error handling
- [ ] Standardize payment/remittance ingest routes
- [ ] Ensure file upload error handling is consistent

**Files to Modify:**
```
server.js (lines ~1700-1900)
```

### Acceptance Criteria

- [ ] All invoice routes use standardized authentication
- [ ] All payment routes use standardized validation
- [ ] File upload routes handle errors consistently
- [ ] All routes use `logError()` instead of `console.error()`
- [ ] Error responses are user-friendly
- [ ] All routes tested for error scenarios

### Testing Requirements

- [ ] Test invoice routes with invalid IDs
- [ ] Test payment routes with missing data
- [ ] Test file upload routes with invalid files
- [ ] Test CSV ingest routes with malformed data
- [ ] Verify error messages guide users correctly

---

## Sprint 3: Supplier & Profile Routes (15 routes)

**Duration:** 1 week  
**Priority:** 🟡 High  
**Focus:** Supplier onboarding, profile management, compliance

### Routes to Standardize

#### Supplier Onboarding Routes (5 routes)
- `GET /accept` - Accept invite page
- `POST /accept` - Accept invite action
- `POST /ops/invites` - Create invite
- `GET /ops/invites/new` - New invite page
- `GET /partials/invite-form.html` - Invite form partial

#### Profile Routes (6 routes)
- `GET /profile` - Profile page
- `GET /partials/profile-form.html` - Profile form partial
- `POST /profile/bank-details` - Update bank details
- `GET /partials/compliance-docs.html` - Compliance docs partial
- `GET /partials/contract-library.html` - Contract library partial
- `POST /cases/:id/approve-onboarding` - Approve onboarding

#### Vendor Directory Routes (4 routes)
- `GET /ops/vendors` - Vendor directory page
- `GET /partials/vendor-directory.html` - Vendor directory partial
- `GET /ops/invites/new` - New invite page (duplicate, verify)
- `GET /partials/invite-form.html` - Invite form (duplicate, verify)

### Tasks

#### Task 3.1: Standardize Supplier Onboarding Routes
- [ ] Update invite acceptance routes with proper validation
- [ ] Standardize invite creation route error handling
- [ ] Ensure password validation is consistent
- [ ] Standardize invite form partial error handling

**Files to Modify:**
```
server.js (lines ~1900-2100)
```

#### Task 3.2: Standardize Profile Routes
- [ ] Update profile routes to use `requireAuth`
- [ ] Standardize bank details update validation
- [ ] Standardize compliance docs partial error handling
- [ ] Standardize contract library partial error handling
- [ ] Ensure onboarding approval uses proper authorization

**Files to Modify:**
```
server.js (lines ~2100-2300)
```

#### Task 3.3: Standardize Vendor Directory Routes
- [ ] Update vendor directory routes to use `requireInternal`
- [ ] Standardize vendor directory partial error handling
- [ ] Ensure scope validation is consistent

**Files to Modify:**
```
server.js (lines ~2300-2400)
```

### Acceptance Criteria

- [ ] All supplier routes use standardized authentication
- [ ] All profile routes validate inputs consistently
- [ ] All vendor directory routes use `requireInternal`
- [ ] All routes use `logError()` instead of `console.error()`
- [ ] Error responses guide users correctly
- [ ] All routes tested for authorization scenarios

### Testing Requirements

- [ ] Test invite acceptance with invalid tokens
- [ ] Test profile updates with invalid data
- [ ] Test vendor directory with insufficient permissions
- [ ] Test onboarding approval workflow
- [ ] Verify error messages are actionable

---

## Sprint 4: Command Center & Internal Ops Routes (25 routes)

**Duration:** 1 week  
**Priority:** 🟢 Medium  
**Focus:** Command center, data ingest, dashboards, org tree

### Routes to Standardize

#### Command Center Routes (5 routes)
- `GET /ops` - Command center home
- `GET /partials/org-tree-sidebar.html` - Org tree sidebar
- `GET /ops/dashboard` - Scoped dashboard page
- `GET /partials/scoped-dashboard.html` - Scoped dashboard partial
- `GET /ops/ingest` - Data ingest page

#### Data Ingest Routes (6 routes)
- `GET /partials/ingest-target-selector.html` - Ingest target selector
- `GET /partials/ingest-target-options.html` - Ingest target options
- `GET /partials/invoice-ingest-form.html` - Invoice ingest form (duplicate, verify)
- `GET /partials/payment-ingest-form.html` - Payment ingest form
- `GET /partials/remittance-drop-form.html` - Remittance drop form
- `GET /ops/data-history` - Data ingest history page
- `GET /partials/data-ingest-history.html` - Data ingest history partial

#### Dashboard & Metrics Routes (4 routes)
- `GET /home` - Home page (metrics)
- `GET /` - Landing page
- `GET /health` - Health check
- `GET /login` - Login page

#### Internal Ops Routes (10 routes)
- `GET /ops/cases` - Ops case queue (duplicate, verify)
- `GET /partials/ops-case-queue.html` - Ops case queue partial (duplicate, verify)
- `GET /ops/cases/:id` - Ops case detail (duplicate, verify)
- `GET /ops/vendors` - Vendor directory (duplicate, verify)
- `GET /partials/vendor-directory.html` - Vendor directory partial (duplicate, verify)
- `GET /ops/invites/new` - New invite (duplicate, verify)
- `GET /partials/invite-form.html` - Invite form (duplicate, verify)
- `GET /ops/ingest` - Ingest page (duplicate, verify)
- `GET /ops/dashboard` - Dashboard (duplicate, verify)
- `GET /ops/data-history` - Data history (duplicate, verify)

### Tasks

#### Task 4.1: Standardize Command Center Routes
- [ ] Update command center routes to use `requireInternal`
- [ ] Standardize org tree sidebar error handling
- [ ] Standardize scoped dashboard error handling
- [ ] Ensure scope validation is consistent

**Files to Modify:**
```
server.js (lines ~2400-2600)
```

#### Task 4.2: Standardize Data Ingest Routes
- [ ] Update all ingest routes to use `requireInternal`
- [ ] Standardize file upload error handling
- [ ] Standardize CSV parsing error handling
- [ ] Ensure ingest history routes use proper error handling

**Files to Modify:**
```
server.js (lines ~2600-2800)
```

#### Task 4.3: Standardize Dashboard & Metrics Routes
- [ ] Update home page route error handling
- [ ] Ensure landing page is public (no auth required)
- [ ] Standardize health check response
- [ ] Ensure login page is public

**Files to Modify:**
```
server.js (lines ~270-320, ~258-270)
```

#### Task 4.4: Verify & Deduplicate Routes
- [ ] Identify and remove duplicate route definitions
- [ ] Consolidate similar routes
- [ ] Ensure all routes are properly organized
- [ ] Update route documentation

**Files to Modify:**
```
server.js (entire file review)
```

### Acceptance Criteria

- [ ] All command center routes use `requireInternal`
- [ ] All data ingest routes handle file errors consistently
- [ ] All dashboard routes use standardized error handling
- [ ] No duplicate route definitions
- [ ] All routes use `logError()` instead of `console.error()`
- [ ] All routes follow standard pattern
- [ ] Route organization is clear and maintainable

### Testing Requirements

- [ ] Test command center routes with non-internal users
- [ ] Test data ingest routes with invalid files
- [ ] Test dashboard routes with missing data
- [ ] Verify scope validation works correctly
- [ ] Test all error paths
- [ ] Verify no duplicate routes exist

---

## Sprint 5: Verification & Documentation (Final Sprint)

**Duration:** 1 week  
**Priority:** 🔴 Critical  
**Focus:** Comprehensive testing, documentation, final standardization

### Tasks

#### Task 5.1: Comprehensive Route Audit
- [ ] Verify all 75 routes use standardized helpers
- [ ] Verify all routes use `logError()` instead of `console.error()`
- [ ] Verify all routes follow standard pattern from `.cursorrules`
- [ ] Verify all error responses are consistent
- [ ] Verify all authentication checks are consistent
- [ ] Verify all input validation is consistent

#### Task 5.2: Route Documentation
- [ ] Document all route categories
- [ ] Document route patterns and conventions
- [ ] Create route reference guide
- [ ] Update `.cursorrules` if needed
- [ ] Create route testing guide

#### Task 5.3: Comprehensive Testing
- [ ] Test all routes for error scenarios
- [ ] Test all routes for authentication/authorization
- [ ] Test all routes for input validation
- [ ] Test all routes for error responses
- [ ] Performance testing for error handling
- [ ] Integration testing

#### Task 5.4: Code Quality
- [ ] Run linter on all routes
- [ ] Fix any linting errors
- [ ] Remove duplicate code
- [ ] Optimize error handling
- [ ] Code review all routes

### Acceptance Criteria

- [ ] All 75 routes standardized
- [ ] All routes tested and verified
- [ ] Documentation complete
- [ ] No linting errors
- [ ] No duplicate code
- [ ] All error paths tested
- [ ] Performance acceptable

### Deliverables

- [ ] Standardized `server.js` with all 75 routes
- [ ] Route documentation
- [ ] Testing report
- [ ] Code quality report
- [ ] Updated audit report (marked complete)

---

## Implementation Guidelines

### Standard Route Pattern

All routes must follow this pattern:

```javascript
import { requireAuth, requireInternal, validateUUIDParam, validateRequiredQuery, handleRouteError, handlePartialError } from './src/utils/route-helpers.js';

// For Page Routes
app.get('/route-path', async (req, res) => {
  try {
    // 1. Authentication
    if (!requireAuth(req, res)) return;
    
    // 2. Input validation
    const param = req.params.id;
    if (!validateUUIDParam(param, res)) return;
    
    // 3. Authorization (if needed)
    if (!requireInternal(req, res)) return;
    
    // 4. Business logic
    const data = await vmpAdapter.getData(param, req.user.vendorId);
    
    // 5. Render response
    res.render('pages/template.html', { data, user: req.user });
  } catch (error) {
    handleRouteError(error, req, res);
  }
});

// For Partial Routes (HTMX)
app.get('/partials/template.html', async (req, res) => {
  try {
    // 1. Authentication (if needed)
    if (!requireAuth(req, res)) return;
    
    // 2. Input validation
    const param = req.query.param;
    if (!validateRequiredQuery(param, 'param', res, 'partials/template.html', { param: null, data: [] })) {
      return;
    }
    
    // 3. Business logic
    const data = await vmpAdapter.getData(param);
    
    // 4. Render response
    res.render('partials/template.html', { param, data });
  } catch (error) {
    handlePartialError(error, req, res, 'partials/template.html', { 
      param: req.query.param || null, 
      data: [] 
    });
  }
});
```

### Error Handling Rules

1. **Page Routes:** Use `handleRouteError()` - returns 500 status
2. **Partial Routes:** Use `handlePartialError()` - returns 200 status (graceful degradation for HTMX)
3. **Always use `logError()`** instead of `console.error()`
4. **Always include context** in error logs (path, method, userId)

### Authentication Rules

1. **Protected Routes:** Use `requireAuth(req, res)` - redirects to `/login`
2. **Internal-Only Routes:** Use `requireInternal(req, res)` - returns 403
3. **Public Routes:** No authentication check needed (landing, login, health)

### Validation Rules

1. **UUID Parameters:** Use `validateUUIDParam(id, res)`
2. **Required Query Params:** Use `validateRequiredQuery(param, paramName, res, template, defaultData)`
3. **Required Body Fields:** Validate in route before calling adapter

---

## Success Metrics

After completion of all sprints:

- [ ] **100% Route Standardization:** All 75 routes use standardized helpers
- [ ] **Zero `console.error()`:** All routes use `logError()`
- [ ] **Consistent Error Handling:** All routes use `handleRouteError` or `handlePartialError`
- [ ] **Consistent Authentication:** All routes use `requireAuth` or `requireInternal`
- [ ] **Consistent Validation:** All routes use validation helpers
- [ ] **Zero Duplicate Code:** No duplicate error handling code
- [ ] **100% Test Coverage:** All routes tested for error paths
- [ ] **Documentation Complete:** Route patterns documented

---

## Risk Mitigation

### Risk 1: Breaking Changes
**Mitigation:** Test each sprint thoroughly before moving to next sprint

### Risk 2: Large Code Changes
**Mitigation:** Incremental approach, one sprint at a time

### Risk 3: Missing Edge Cases
**Mitigation:** Comprehensive testing in Sprint 5

### Risk 4: Performance Impact
**Mitigation:** Performance testing in Sprint 5

---

**Document Status:** ✅ Planning Complete  
**Last Updated:** 2025-12-22  
**Next Review:** After Sprint 1 completion

