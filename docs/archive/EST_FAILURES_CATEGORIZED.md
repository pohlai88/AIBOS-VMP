# Test Failures Categorized Report

**Date:** 2025-12-22  
**Status:** 🔄 In Progress (Phase 1 Complete)  
**Total Failures:** 22 tests across 5 test files (2 resolved ✅)  
**Total Tests:** 538 tests (516 passing, 22 failing)  
**Pass Rate:** 96.0% (up from 95.5%)

---

## Executive Summary

The test suite has **22 failures** categorized into 4 main groups (2 schema issues resolved ✅):
1. **Database Schema Issues** (1 failure remaining) - Missing columns in test database (2 resolved ✅)
2. **Error Response Format Issues** (15 failures) - Error messages not matching expected format
3. **HTTP Status Code Issues** (5 failures) - Wrong status codes returned
4. **Timeout Issues** (1 failure) - Test hook timeout

---

## Category 1: Database Schema Issues 🔴 Critical

**Count:** 1 failure (2 resolved ✅)  
**Priority:** 🔴 Critical - Must fix before other tests can pass  
**Root Cause:** Test database missing columns that exist in migrations but haven't been applied  
**Status:** ✅ **2 of 3 issues resolved** - Migrations 021 and 022 applied and verified

### Failures

#### 1.1 Missing `metadata` column in `vmp_messages` ✅ **RESOLVED**
- **Test:** `tests/adapters/supabase.test.js > createMessage should create a message`
- **Error:** `DatabaseError: Database operation failed: Could not find the 'metadata' column of 'vmp_messages' in the schema cache`
- **Migration:** `migrations/022_vmp_messages_metadata.sql` ✅ Applied
- **Status:** ✅ **FIXED** - Test now passing after migration applied and schema cache refreshed

#### 1.2 Missing `assigned_to_user_id` column in `vmp_cases` ✅ **RESOLVED**
- **Test:** `tests/adapters/supabase.test.js > reassignCase should reassign a case`
- **Error:** `DatabaseError: Database operation failed: Could not find the 'assigned_to_user_id' column of 'vmp_cases' in the schema cache`
- **Migration:** `migrations/021_vmp_cases_assigned_to.sql` ✅ Applied
- **Status:** ✅ **FIXED** - Test now passing after migration applied and schema cache refreshed

#### 1.3 Timeout in `uploadEvidence` test
- **Test:** `tests/adapters/supabase.test.js > uploadEvidence should handle database insert error and attempt cleanup`
- **Error:** `Error: Hook timed out in 10000ms`
- **Root Cause:** Likely related to database cleanup operations taking too long
- **Fix Required:** Increase hook timeout or optimize cleanup operations

### Action Items
- [x] Apply migration `022_vmp_messages_metadata.sql` to test database ✅ **COMPLETE**
- [x] Apply migration `021_vmp_cases_assigned_to.sql` to test database ✅ **COMPLETE**
- [x] Verify migrations in database schema ✅ **VERIFIED** (columns and indexes exist)
- [ ] Run tests to verify schema cache has refreshed (may need to restart test process)
- [ ] Investigate and fix timeout in `uploadEvidence` test hook

---

## Category 2: Error Response Format Issues 🟡 High Priority

**Count:** 15 failures  
**Priority:** 🟡 High - Tests expect specific error message formats  
**Root Cause:** Error messages are being rendered as `[object Object]` instead of readable text, or error messages don't match expected format

### Failures

#### 2.1 Authorization Error Messages (4 failures)
All these tests expect specific authorization error messages but receive `[object Object]`:

1. **POST /cases/:id/update-status - Non-internal user**
   - **Test:** `tests/server-coverage-gaps.test.js > should return 403 for non-internal users`
   - **Expected:** `"Only internal staff can update case status"`
   - **Received:** `"[object Object]"` in error div
   - **Location:** Error rendering in template

2. **POST /cases/:id/verify-evidence - Non-internal user**
   - **Test:** `tests/server-internal-ops.test.js > should require internal user (RBAC)`
   - **Expected:** `"Only internal staff can verify evidence"`
   - **Received:** `"[object Object]"` in error div

3. **POST /cases/:id/reject-evidence - Non-internal user**
   - **Test:** `tests/server-internal-ops.test.js > should require internal user (RBAC)`
   - **Expected:** `"Only internal staff can reject evidence"`
   - **Received:** `"[object Object]"` in error div

4. **POST /cases/:id/reassign - Non-internal user**
   - **Test:** `tests/server-internal-ops.test.js > should require internal user (RBAC)`
   - **Expected:** `"Only internal staff can reassign cases"`
   - **Received:** `"[object Object]"` in error div

**Fix Required:** Update error template rendering to display error message text instead of `[object Object]`

#### 2.2 Operation Error Messages (4 failures)
These tests expect specific operation failure messages but receive generic error messages:

1. **POST /cases/:id/update-status - Update error**
   - **Test:** `tests/server-coverage-gaps.test.js > should handle updateCaseStatus errors`
   - **Expected:** `"Failed to update case status"`
   - **Received:** `"Database error"` (generic message)

2. **POST /cases/:id/verify-evidence - Verify error**
   - **Test:** `tests/server-internal-ops.test.js > should handle verifyEvidence errors`
   - **Expected:** `"Failed to verify evidence"`
   - **Received:** `"Database error"` (generic message)

3. **POST /cases/:id/reject-evidence - Reject error**
   - **Test:** `tests/server-internal-ops.test.js > should handle rejectEvidence errors`
   - **Expected:** `"Failed to reject evidence"`
   - **Received:** `"Database error"` (generic message)

4. **POST /cases/:id/reassign - Reassign error**
   - **Test:** `tests/server-internal-ops.test.js > should handle reassignCase errors`
   - **Expected:** `"Failed to reassign case"`
   - **Received:** `"Database error"` (generic message)

**Fix Required:** Update error handling in routes to provide specific error messages for each operation

#### 2.3 Partial Refresh Error Messages (3 failures)
These tests expect specific error messages when partial refresh fails:

1. **POST /cases/:id/verify-evidence - Refresh error**
   - **Test:** `tests/server-internal-ops.test.js > should handle refresh checklist errors`
   - **Expected:** `"Evidence verified but failed to refresh detail"`
   - **Received:** Status 200 (success) instead of 500
   - **Note:** This is also a status code issue

2. **POST /cases/:id/update-status - Refresh error**
   - **Test:** `tests/server-internal-ops.test.js > should handle refresh errors`
   - **Expected:** `"Case status updated but failed to refresh detail"`
   - **Received:** Status 200 (success) instead of 500
   - **Note:** This is also a status code issue

3. **POST /cases/:id/reassign - Refresh error**
   - **Test:** `tests/server-internal-ops.test.js > should handle refresh errors`
   - **Expected:** `"Case reassigned but failed to refresh detail"`
   - **Received:** Status 200 (success) instead of 500
   - **Note:** This is also a status code issue

**Fix Required:** Update partial refresh error handling to return 500 status and specific error message

### Action Items
- [ ] Fix error template rendering to display error.message instead of [object Object]
- [ ] Update error handling in routes to provide specific error messages
- [ ] Fix partial refresh error handling to return 500 status on failure

---

## Category 3: HTTP Status Code Issues 🟡 High Priority

**Count:** 5 failures  
**Priority:** 🟡 High - Wrong HTTP status codes returned  
**Root Cause:** Validation errors returning 500 instead of 400, or error paths returning 200 instead of 500

### Failures

#### 3.1 Validation Errors Returning 500 Instead of 400 (4 failures)

1. **POST /cases/:id/update-status - Invalid status**
   - **Test:** `tests/server-coverage-gaps.test.js > should return 400 for invalid status`
   - **Expected:** Status 400
   - **Received:** Status 500
   - **Fix Required:** Catch validation errors and return 400 status

2. **POST /cases/:id/update-status - Missing status**
   - **Test:** `tests/server-coverage-gaps.test.js > should return 400 for missing status`
   - **Expected:** Status 400
   - **Received:** Status 500
   - **Fix Required:** Catch validation errors and return 400 status

3. **POST /cases/:id/verify-evidence - Missing checklist_step_id**
   - **Test:** `tests/server-internal-ops.test.js > should require checklist_step_id`
   - **Expected:** Status 400
   - **Received:** Status 500
   - **Fix Required:** Catch validation errors and return 400 status

4. **POST /cases/:id/reject-evidence - Missing parameters**
   - **Test:** `tests/server-internal-ops.test.js > should require checklist_step_id and reason`
   - **Expected:** Status 400
   - **Received:** Status 500
   - **Fix Required:** Catch validation errors and return 400 status

5. **POST /cases/:id/reassign - Invalid owner_team**
   - **Test:** `tests/server-internal-ops.test.js > should require valid owner_team`
   - **Expected:** Status 400
   - **Received:** Status 500
   - **Fix Required:** Catch validation errors and return 400 status

#### 3.2 Error Paths Returning 200 Instead of 500 (2 failures)

1. **POST /cases/:id/messages - getMessages error after creation**
   - **Test:** `tests/server-branch-coverage.test.js > should handle getMessages error after creation`
   - **Expected:** Status 500
   - **Received:** Status 200
   - **Fix Required:** Ensure error in getMessages after message creation returns 500

2. **POST /cases/:id/messages - getMessages error after creation**
   - **Test:** `tests/server-error-paths.test.js > should handle getMessages errors after creation`
   - **Expected:** Status 500
   - **Received:** Status 200
   - **Fix Required:** Ensure error in getMessages after message creation returns 500

**Note:** These are duplicate tests checking the same route

### Action Items
- [ ] Update validation error handling to return 400 status instead of 500
- [ ] Fix error handling in POST /cases/:id/messages to return 500 on getMessages error
- [ ] Ensure all validation errors are caught and return appropriate 400 status

---

## Category 4: Test Timeout Issues 🟢 Medium Priority

**Count:** 1 failure  
**Priority:** 🟢 Medium - Test infrastructure issue  
**Root Cause:** Test hook cleanup taking too long

### Failure

#### 4.1 uploadEvidence Test Hook Timeout
- **Test:** `tests/adapters/supabase.test.js > uploadEvidence should handle database insert error and attempt cleanup`
- **Error:** `Error: Hook timed out in 10000ms`
- **Location:** `afterEach` hook at line 32
- **Fix Required:** 
  - Increase hook timeout
  - Optimize cleanup operations
  - Or investigate why cleanup is taking so long

### Action Items
- [ ] Investigate why cleanup is taking >10 seconds
- [ ] Optimize cleanup operations or increase timeout
- [ ] Consider using `beforeEach` instead of `afterEach` if appropriate

---

## Summary by Test File

| Test File | Failures | Category Breakdown |
|-----------|----------|-------------------|
| `tests/adapters/supabase.test.js` | 3 | Schema (2), Timeout (1) |
| `tests/server-coverage-gaps.test.js` | 4 | Status Code (2), Error Format (2) |
| `tests/server-error-paths.test.js` | 1 | Status Code (1) |
| `tests/server-branch-coverage.test.js` | 1 | Status Code (1) |
| `tests/server-internal-ops.test.js` | 15 | Status Code (2), Error Format (13) |
| **Total** | **24** | **Schema (3), Status Code (5), Error Format (15), Timeout (1)** |

---

## Priority Fix Order

### Phase 1: Critical (Must Fix First) 🔴 ✅ **COMPLETE**
1. **Apply Database Migrations** ✅
   - ✅ Applied `022_vmp_messages_metadata.sql`
   - ✅ Applied `021_vmp_cases_assigned_to.sql`
   - ✅ Verified columns exist: `vmp_cases.assigned_to_user_id`, `vmp_messages.metadata`
   - ✅ Verified indexes exist: `idx_vmp_cases_assigned_to_user_id`, `idx_vmp_messages_metadata`
   - **Impact:** Should fix 2 test failures (schema-related)
   - **Status:** Migrations verified in database schema
   - **Note:** If tests still fail with "schema cache" error, may need to restart test process to refresh Supabase client cache

### Phase 2: High Priority (Core Functionality) 🟡
2. **Fix Error Template Rendering**
   - Fix `[object Object]` display issue
   - **Impact:** Fixes 4 authorization error message failures

3. **Fix Validation Error Status Codes**
   - Return 400 for validation errors instead of 500
   - **Impact:** Fixes 5 status code failures

4. **Fix Error Message Format**
   - Provide specific error messages for operations
   - **Impact:** Fixes 4 operation error message failures

5. **Fix Partial Refresh Error Handling**
   - Return 500 status on partial refresh failure
   - **Impact:** Fixes 3 partial refresh failures

6. **Fix getMessages Error Handling**
   - Return 500 status on getMessages error after creation
   - **Impact:** Fixes 2 duplicate test failures

### Phase 3: Medium Priority (Test Infrastructure) 🟢
7. **Fix Test Timeout**
   - Optimize cleanup or increase timeout
   - **Impact:** Fixes 1 timeout failure

---

## Expected Outcome

After fixing all issues:
- **Total Failures:** 0
- **Pass Rate:** 100%
- **Test Coverage:** Maintained at current levels
- **Code Quality:** Improved error handling and validation

---

## Next Steps

1. ✅ **Complete:** Categorize all failures
2. ✅ **Complete:** Apply database migrations to test environment
3. ✅ **Complete:** Run tests to verify Phase 1 fixes (✅ 2 failures resolved - createMessage and reassignCase now passing)
4. ⏳ **Next:** Fix error template rendering
5. ⏳ **Next:** Fix validation error status codes
6. ⏳ **Next:** Fix error message formats
7. ⏳ **Next:** Fix partial refresh error handling
8. ⏳ **Next:** Fix test timeout issue

---

**Document Status:** ✅ Analysis Complete  
**Last Updated:** 2025-12-22  
**Next Review:** After Phase 1 fixes applied

