# Test Coverage Plan - 85% Target

**Date:** 2025-12-22  
**Status:** 🚧 In Progress  
**Current Coverage:** 74.5% statements, 66.66% branches, 91.39% functions, 74.7% lines  
**Target Coverage:** 85% across all metrics  
**Gap:** ~10.5% statements, ~18.34% branches, ~6.61% functions, ~10.3% lines

**Progress Update:**
- ✅ Phase 1 Complete: Route Helpers test suite created (48 tests, all passing)
- ⏳ Phase 2 In Progress: Branch coverage improvements
- ⏳ Phase 3-5 Pending: Edge cases, adapter errors, middleware errors

---

## Executive Summary

This plan outlines the strategy to achieve 85% test coverage across all metrics. The focus areas are:
1. **Route Helpers** - Missing test suite (critical gap)
2. **Branch Coverage** - Error paths and conditional branches
3. **Edge Cases** - Input validation, boundary conditions
4. **Error Handling** - All error paths in routes and utilities

---

## 1. Current Coverage Analysis

### 1.1 Coverage Metrics

| Metric | Current | Target | Gap | Priority |
|--------|---------|--------|-----|----------|
| **Statements** | 74.5% | 85% | 10.5% | 🔴 High |
| **Branches** | 66.66% | 85% | 18.34% | 🔴 Critical |
| **Functions** | 91.39% | 85% | ✅ Met | 🟢 Low |
| **Lines** | 74.7% | 85% | 10.3% | 🔴 High |

### 1.2 Test Files Status

| File | Status | Coverage | Priority |
|------|--------|----------|----------|
| `tests/utils/route-helpers.test.js` | ❌ Missing | 0% | 🔴 Critical |
| `tests/utils/errors.test.js` | ✅ Complete | ~95% | 🟢 Low |
| `tests/utils/checklist-rules.test.js` | ✅ Complete | ~90% | 🟢 Low |
| `tests/adapters/supabase.test.js` | ⚠️ Partial | ~80% | 🟡 Medium |
| `tests/server-*.test.js` | ⚠️ Partial | ~75% | 🟡 Medium |

---

## 2. Test Coverage Gaps

### 2.1 Critical Gaps (Must Fix)

#### Gap 1: Route Helpers Test Suite ❌
**File:** `src/utils/route-helpers.js`  
**Status:** No tests exist  
**Impact:** High - All routes depend on these utilities  
**Tests Needed:**
- `isValidUUID()` - All edge cases
- `validateRequired()` - All edge cases
- `requireAuth()` - Success and failure paths
- `requireInternal()` - Success, failure, and redirect paths
- `validateUUIDParam()` - Valid/invalid UUIDs, error rendering
- `validateRequiredQuery()` - Missing params, error rendering
- `handleRouteError()` - All error types (ValidationError, NotFoundError, etc.)
- `handlePartialError()` - Error handling for HTMX partials
- `asyncRoute()` - Success and error paths

**Estimated Coverage Gain:** +5% statements, +8% branches

#### Gap 2: Branch Coverage - Error Paths ⚠️
**Files:** `server.js` (75 routes)  
**Status:** Many error paths untested  
**Impact:** High - Error handling is critical  
**Tests Needed:**
- All routes: Error paths in try-catch blocks
- All routes: Validation error paths
- All routes: Authentication/authorization error paths
- All routes: Database error paths
- Partial routes: Graceful degradation paths

**Estimated Coverage Gain:** +8% branches, +3% statements

#### Gap 3: Edge Cases - Input Validation ⚠️
**Files:** `server.js`, `src/adapters/supabase.js`  
**Status:** Some edge cases missing  
**Impact:** Medium - Important for robustness  
**Tests Needed:**
- Invalid UUID formats (various edge cases)
- Empty strings vs null vs undefined
- Boundary conditions (max lengths, etc.)
- File upload edge cases
- Query parameter edge cases

**Estimated Coverage Gain:** +2% statements, +2% branches

### 2.2 Medium Priority Gaps

#### Gap 4: Adapter Error Paths ⚠️
**File:** `src/adapters/supabase.js`  
**Status:** Some error paths covered, but not all  
**Impact:** Medium - Database operations are critical  
**Tests Needed:**
- Timeout error paths
- Connection error paths
- RLS policy error paths
- Storage error paths (edge cases)

**Estimated Coverage Gain:** +2% statements, +3% branches

#### Gap 5: Middleware Error Paths ⚠️
**File:** `server.js` (middleware)  
**Status:** Some middleware paths untested  
**Impact:** Medium - Middleware is critical  
**Tests Needed:**
- Auth middleware error paths
- File filter error paths
- Rate limiting error paths
- Timeout middleware error paths

**Estimated Coverage Gain:** +1% statements, +2% branches

---

## 3. Implementation Plan

### Phase 1: Route Helpers Test Suite (Critical) 🔴

**Duration:** 2-3 hours  
**Priority:** Critical  
**Files to Create:**
- `tests/utils/route-helpers.test.js`

**Test Cases:**
1. `isValidUUID()` - 10 test cases
2. `validateRequired()` - 8 test cases
3. `requireAuth()` - 4 test cases
4. `requireInternal()` - 6 test cases
5. `validateUUIDParam()` - 6 test cases
6. `validateRequiredQuery()` - 6 test cases
7. `handleRouteError()` - 12 test cases
8. `handlePartialError()` - 6 test cases
9. `asyncRoute()` - 4 test cases

**Expected Coverage Gain:** +5% statements, +8% branches

### Phase 2: Branch Coverage - Error Paths 🔴

**Duration:** 3-4 hours  
**Priority:** High  
**Files to Modify:**
- `tests/server-error-paths.test.js` (extend)
- `tests/server-branch-coverage.test.js` (extend)

**Test Cases:**
1. All POST routes: Error paths (25 routes × 3 error types = 75 tests)
2. All GET routes: Error paths (50 routes × 2 error types = 100 tests)
3. Partial routes: Graceful degradation (35 routes × 2 error types = 70 tests)

**Expected Coverage Gain:** +8% branches, +3% statements

### Phase 3: Edge Cases - Input Validation 🟡

**Duration:** 2-3 hours  
**Priority:** Medium  
**Files to Modify:**
- `tests/server-routes.test.js` (extend)
- `tests/adapters/supabase.test.js` (extend)

**Test Cases:**
1. UUID validation edge cases (10 tests)
2. Required field validation edge cases (8 tests)
3. File upload edge cases (6 tests)
4. Query parameter edge cases (8 tests)

**Expected Coverage Gain:** +2% statements, +2% branches

### Phase 4: Adapter Error Paths 🟡

**Duration:** 2-3 hours  
**Priority:** Medium  
**Files to Modify:**
- `tests/adapters-supabase-error-paths.test.js` (extend)

**Test Cases:**
1. Timeout error paths (5 tests)
2. Connection error paths (5 tests)
3. RLS policy error paths (5 tests)
4. Storage error edge cases (5 tests)

**Expected Coverage Gain:** +2% statements, +3% branches

### Phase 5: Middleware Error Paths 🟡

**Duration:** 1-2 hours  
**Priority:** Medium  
**Files to Modify:**
- `tests/server-middleware.test.js` (extend)

**Test Cases:**
1. Auth middleware error paths (4 tests)
2. File filter error paths (3 tests)
3. Rate limiting error paths (3 tests)
4. Timeout middleware error paths (3 tests)

**Expected Coverage Gain:** +1% statements, +2% branches

---

## 4. Test Execution Strategy

### 4.1 Test Organization

**Unit Tests (Vitest):**
- Route helpers: `tests/utils/route-helpers.test.js`
- Error utilities: `tests/utils/errors.test.js` (already complete)
- Checklist rules: `tests/utils/checklist-rules.test.js` (already complete)

**Integration Tests (Vitest + Supertest):**
- Server routes: `tests/server-*.test.js`
- Adapter methods: `tests/adapters/*.test.js`

**E2E Tests (Playwright):**
- Critical user flows: `tests/e2e/*.spec.js`

### 4.2 Test Execution Order

1. **Unit Tests First** - Fast, isolated tests
2. **Integration Tests Second** - Route and adapter tests
3. **E2E Tests Last** - Full system tests

### 4.3 Coverage Verification

After each phase:
1. Run `npm run test:coverage`
2. Verify coverage metrics
3. Identify remaining gaps
4. Adjust plan if needed

---

## 5. Success Criteria

### 5.1 Coverage Targets

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| **Statements** | 74.5% | ≥85% | ⏳ Pending |
| **Branches** | 66.66% | ≥85% | ⏳ Pending |
| **Functions** | 91.39% | ≥85% | ✅ Met |
| **Lines** | 74.7% | ≥85% | ⏳ Pending |

### 5.2 Quality Criteria

- ✅ All critical paths tested
- ✅ All error paths tested
- ✅ All edge cases covered
- ✅ All tests passing
- ✅ No flaky tests
- ✅ Tests are maintainable

---

## 6. Risk Mitigation

### Risk 1: Tests May Not Reach 85%
**Mitigation:** Focus on high-impact areas first (route helpers, error paths)

### Risk 2: Some Code Paths Hard to Test
**Mitigation:** Use mocks and stubs where necessary, document untestable paths

### Risk 3: Test Maintenance Overhead
**Mitigation:** Follow established patterns, use helper functions, keep tests simple

---

## 7. Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: Route Helpers | 2-3 hours | ✅ Complete |
| Phase 2: Branch Coverage | 3-4 hours | ⏳ Pending |
| Phase 3: Edge Cases | 2-3 hours | ⏳ Pending |
| Phase 4: Adapter Errors | 2-3 hours | ⏳ Pending |
| Phase 5: Middleware Errors | 1-2 hours | ⏳ Pending |
| **Total** | **10-15 hours** | ⏳ Pending |

---

## 8. Next Steps

1. ✅ Create test plan (this document)
2. ✅ Create `tests/utils/route-helpers.test.js` (48 tests, all passing)
3. ⏳ Extend error path tests
4. ⏳ Add edge case tests
5. ⏳ Run coverage and verify 85% target
6. ⏳ Document any untestable paths

## 9. Implementation Status

### Phase 1: Route Helpers Test Suite ✅ COMPLETE

**File Created:** `tests/utils/route-helpers.test.js`  
**Tests:** 48 tests covering all route helper functions  
**Status:** All tests passing ✅

**Coverage:**
- `isValidUUID()` - 6 test cases
- `validateRequired()` - 5 test cases
- `requireAuth()` - 3 test cases
- `requireInternal()` - 5 test cases
- `validateUUIDParam()` - 4 test cases
- `validateRequiredQuery()` - 5 test cases
- `handleRouteError()` - 11 test cases
- `handlePartialError()` - 5 test cases
- `asyncRoute()` - 4 test cases

**Expected Coverage Gain:** +5% statements, +8% branches

### Phase 2: Branch Coverage - Error Paths ⏳ IN PROGRESS

**Status:** Need to extend existing error path tests  
**Focus:** Error handling branches in server.js routes  
**Estimated Coverage Gain:** +8% branches, +3% statements

---

**Document Status:** ✅ Planning Complete  
**Last Updated:** 2025-12-22  
**Next Review:** After Phase 1 completion

