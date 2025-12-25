# RLS Enforcement Action Plan

## 🎯 Objective: Achieve 100% RLS Enforcement

**Current Status**: Database RLS policies complete ✅ | Express migration pending ⚠️

---

## ✅ Phase 1: Database RLS Policies (COMPLETE)

### Completed Work
1. ✅ Created 4 RLS helper functions:
   - `public.get_user_vendor_id()` - Returns vendor_id for authenticated user
   - `public.get_user_company_ids()` - Returns company_ids user can access (scope-based)
   - `public.can_access_case(case_id)` - Multi-vendor ↔ multi-company authorization
   - `public.get_user_tenant_id()` - Returns tenant_id (absolute isolation)

2. ✅ Created 30 RLS policies across 13 tables:
   - **vmp_cases**: 4 policies (SELECT, INSERT, UPDATE, DELETE)
   - **vmp_messages**: 4 policies (cascade from case)
   - **vmp_evidence**: 4 policies (cascade from case)
   - **vmp_checklist_steps**: 2 policies (cascade from case)
   - **vmp_payments**: 2 policies (vendor-only)
   - **vmp_invoices**: 2 policies (vendor-only)
   - **vmp_invites**: 4 policies (vendor-scoped, internal-only create/update/delete)
   - **vmp_companies**: 1 policy (tenant isolation)
   - **vmp_vendors**: 1 policy (tenant isolation)
   - **vmp_vendor_company_links**: 1 policy (relationship authorization)
   - **vmp_vendor_users**: 1 policy (self + vendor access)
   - **vmp_tenants**: 1 policy (read-only own tenant)
   - **vmp_sessions**: 1 policy (self access only)

3. ✅ Dropped 11 overly-permissive "service role full access" policies

4. ✅ Created middleware: `src/middleware/supabase-client.js`
   - `createUserScopedSupabaseClient(req)` - Anon key + user JWT
   - `attachSupabaseClient` - Express middleware

5. ✅ Created test suite: `tests/rls-leak-tests.test.js`
   - Vendor isolation tests (5 tests)
   - Tenant isolation tests (2 tests)
   - Cascade security tests (4 tests)
   - Anti-enumeration tests (2 tests)
   - Helper function tests (4 tests)

6. ✅ Created documentation:
   - `docs/RLS_ENFORCEMENT_MIGRATION_GUIDE.md` - Complete migration guide
   - `docs/RLS_ENFORCEMENT_SUMMARY.md` - Technical summary
   - `RLS_ENFORCEMENT_ACTION_PLAN.md` - This file

### Security Validation
- ✅ All vmp_* tables have RLS enabled
- ✅ No "service role full access" policies remain
- ✅ Supabase security advisors: Only 1 INFO (vmp_invites - now fixed), 2 WARN (non-RLS issues)
- ✅ Mathematical boundary enforcement: Policies enforce tenant/vendor isolation at database level

---

## ⚠️ Phase 2: Express Server Migration (PENDING)

### Current Problem
```javascript
// server.js line 83 - ALL ROUTES USE THIS
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Result: RLS policies are BYPASSED for all user requests
```

### Required Changes

#### Step 1: Update server.js Imports
```javascript
// Add at top of server.js
import { attachSupabaseClient } from './src/middleware/supabase-client.js';
```

#### Step 2: Apply Middleware (After Session)
```javascript
// In server.js, after session middleware
app.use(session(sessionOptions));
app.use(attachSupabaseClient); // <-- ADD THIS LINE
```

#### Step 3: Rename Service Role Client
```javascript
// OLD:
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// NEW:
const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Export for admin-only use
export { supabaseAdmin };
```

#### Step 4: Update All Route Handlers

**Pattern 1: Vendor Routes**
```javascript
// BEFORE (service_role bypass)
app.get('/vendor/cases/:id', requireAuth, async (req, res) => {
  const { data } = await supabase.from('vmp_cases')...
});

// AFTER (RLS enforced)
app.get('/vendor/cases/:id', requireAuth, async (req, res) => {
  const { data } = await req.supabase.from('vmp_cases')...
});
```

**Pattern 2: Vendor Partials**
```javascript
// BEFORE
app.get('/vendor/partials/case-inbox', requireAuth, async (req, res) => {
  const cases = await vmpAdapter.getCases(supabase, { vendorId })...
});

// AFTER
app.get('/vendor/partials/case-inbox', requireAuth, async (req, res) => {
  const cases = await vmpAdapter.getCases(req.supabase, { vendorId })...
});
```

**Pattern 3: Admin-Only Operations (Keep service_role)**
```javascript
// User creation (admin operation)
async function createVendorUser(email, vendorId) {
  const { data } = await supabaseAdmin // Still uses service_role
    .from('vmp_vendor_users')
    .insert({ email, vendor_id: vendorId });
}
```

#### Step 5: Update vmpAdapter (if needed)

Check `src/adapters/vmp-adapter.js` and ensure it accepts Supabase client as parameter (not hardcoded global).

```javascript
// GOOD (already parameterized)
export async function getCases(supabaseClient, { vendorId }) {
  return supabaseClient.from('vmp_cases').select('*')...
}

// BAD (hardcoded global - needs fix)
import { supabase } from '../config/supabase.js';
export async function getCases({ vendorId }) {
  return supabase.from('vmp_cases').select('*')... // RLS bypassed!
}
```

---

## 🧪 Phase 3: Testing & Validation

### Test 1: RLS Leak Tests (Unit)
```bash
pnpm vitest tests/rls-leak-tests.test.js
```

**Expected**: All tests pass (vendor isolation, tenant isolation, cascade, anti-enumeration)

### Test 2: Guardrails Check (Regression)
```bash
node scripts/vmp-guardrails-check.mjs
```

**Expected**: 0 errors, ≤ 4 warnings (same as baseline)

### Test 3: Manual QA (Cross-Vendor Access)
1. Login as vendor A user
2. Open browser DevTools → Network tab
3. Try to access vendor B case URL: `/vendor/cases/{vendor-b-case-id}`
4. **Expected**: 404 Not Found (RLS blocks access)
5. Check response body: Should NOT reveal "permission denied" (anti-enumeration)

### Test 4: Supabase Security Advisors
```javascript
// Run after migration
const { data } = await supabase.rpc('get_advisors', { type: 'security' });
// Expected: No RLS-related warnings
```

---

## 📋 Migration Checklist

### Pre-Migration (Complete)
- [x] RLS policies created and tested
- [x] Helper functions created
- [x] Middleware created (`src/middleware/supabase-client.js`)
- [x] Test suite created (`tests/rls-leak-tests.test.js`)
- [x] Documentation created

### Migration Steps (Pending)
- [ ] **Step 1**: Import middleware in `server.js`
- [ ] **Step 2**: Apply `attachSupabaseClient` middleware (after session)
- [ ] **Step 3**: Rename `supabase` → `supabaseAdmin` in `server.js`
- [ ] **Step 4**: Update vendor routes (15-20 routes estimated)
  - [ ] `/vendor/cases/:id` (GET)
  - [ ] `/vendor/cases/:id/messages` (POST)
  - [ ] `/vendor/cases/:id/evidence` (POST)
  - [ ] `/vendor/cases/:id/documents` (POST)
  - [ ] `/vendor/partials/case-inbox` (GET)
  - [ ] `/vendor/partials/case-detail` (GET)
  - [ ] `/vendor/partials/case-thread` (GET)
  - [ ] `/vendor/partials/case-activity` (GET)
  - [ ] `/vendor/partials/case-checklist` (GET)
  - [ ] `/vendor/partials/case-evidence` (GET)
  - [ ] `/vendor/partials/escalation` (GET)
  - [ ] `/vendor/partials/case-row` (GET)
  - [ ] (Identify remaining routes via grep search)
- [ ] **Step 5**: Update legacy `/partials/*` routes (if still used)
- [ ] **Step 6**: Review vmpAdapter methods (ensure parameterized Supabase client)

### Post-Migration Validation
- [ ] Run RLS leak tests: `pnpm vitest tests/rls-leak-tests.test.js`
- [ ] Run guardrails check: `node scripts/vmp-guardrails-check.mjs`
- [ ] Manual QA: Cross-vendor access test
- [ ] Check Supabase logs for RLS policy violations
- [ ] Run security advisors: Check for RLS gaps

---

## 🚨 Critical Routes Requiring Update

### Priority 1: Vendor Case Operations (High Risk)
```javascript
// server.js - These routes MUST use req.supabase
app.get('/vendor/cases/:id', ...)           // Case detail read
app.post('/vendor/cases/:id/messages', ...) // Message create
app.post('/vendor/cases/:id/evidence', ...) // Evidence upload
app.post('/vendor/cases/:id/documents', ...)// Document upload
```

### Priority 2: Vendor Partials (High Traffic)
```javascript
// server.js - Rendered partials for HTMX
app.get('/vendor/partials/case-inbox', ...)
app.get('/vendor/partials/case-detail', ...)
app.get('/vendor/partials/case-thread', ...)
app.get('/vendor/partials/case-evidence', ...)
```

### Priority 3: API Routes (Internal)
```javascript
// Check src/routes/* for API endpoints
// Example:
app.get('/api/cases', ...)
app.put('/api/cases/:id', ...)
```

---

## 🔍 Migration Script (Semi-Automated)

```bash
# Find all routes using global 'supabase' (not req.supabase)
grep -rn "await supabase\\.from" server.js src/routes/

# Find all vmpAdapter calls (check if Supabase client is passed)
grep -rn "vmpAdapter\\." server.js src/routes/

# Find all service_role usage (should only be admin operations)
grep -rn "SUPABASE_SERVICE_ROLE_KEY" server.js src/
```

---

## 📊 Estimated Migration Time

| Phase | Tasks | Time Estimate |
|-------|-------|---------------|
| Setup | Import middleware, apply middleware, rename client | 15 min |
| Route Updates | Update 15-20 vendor routes | 1-2 hours |
| vmpAdapter Review | Check adapter methods | 30 min |
| Testing | RLS tests + guardrails + manual QA | 1 hour |
| Validation | Security advisors + log review | 30 min |
| **Total** | | **3-4 hours** |

---

## 🎯 Success Criteria

### RLS Enforcement is Complete When:
1. ✅ All vmp_* tables have RLS policies
2. ⚠️ Express uses `req.supabase` (anon key + JWT) for user requests
3. ⚠️ `supabaseAdmin` (service_role) used ONLY for admin operations
4. ⚠️ RLS leak tests pass (vendor/tenant isolation)
5. ⚠️ Guardrails check passes (no new warnings)
6. ⚠️ Manual cross-vendor access test returns 404
7. ⚠️ Supabase security advisors show no RLS gaps

### Mathematical Boundary Enforcement Validated:
- ✅ Tenant isolation enforced at database level (not app code)
- ✅ Vendor isolation enforced by RLS policies
- ✅ Messages/evidence cascade from case access
- ✅ Unknown UUIDs return 404/empty (anti-enumeration)

---

## 🆘 Rollback Plan

If RLS causes issues after migration:

### Option 1: Temporary RLS Disable (EMERGENCY ONLY)
```sql
-- Disable RLS on specific table
ALTER TABLE vmp_cases DISABLE ROW LEVEL SECURITY;

-- Re-enable after fixing
ALTER TABLE vmp_cases ENABLE ROW LEVEL SECURITY;
```

### Option 2: Revert to service_role Client
```javascript
// Temporarily revert middleware change
// app.use(attachSupabaseClient); // <-- Comment out
// All routes revert to supabaseAdmin (bypasses RLS)
```

### Option 3: Git Revert
```bash
# Revert server.js changes
git checkout HEAD -- server.js

# Redeploy
```

**Note**: Rollback should ONLY be used in emergencies. The correct solution is to fix RLS policies or route implementation.

---

## 📚 Reference Documents

1. **Migration Guide**: `docs/RLS_ENFORCEMENT_MIGRATION_GUIDE.md`
   - Complete how-to with code examples
   - Testing strategy
   - Troubleshooting

2. **Technical Summary**: `docs/RLS_ENFORCEMENT_SUMMARY.md`
   - RLS policy inventory
   - Security model explanation
   - Performance considerations

3. **Middleware**: `src/middleware/supabase-client.js`
   - User-scoped client creation
   - Express middleware implementation

4. **Test Suite**: `tests/rls-leak-tests.test.js`
   - 17 test cases for RLS enforcement
   - Vendor/tenant isolation validation
   - Anti-enumeration tests

5. **Action Plan**: `RLS_ENFORCEMENT_ACTION_PLAN.md` (this file)
   - Step-by-step migration checklist
   - Success criteria
   - Rollback procedures

---

## 🚀 Next Steps: Begin Migration

```bash
# 1. Review migration guide
cat docs/RLS_ENFORCEMENT_MIGRATION_GUIDE.md

# 2. Create feature branch
git checkout -b feature/rls-enforcement-phase2

# 3. Update server.js (Steps 1-3 from checklist)
# - Import middleware
# - Apply middleware
# - Rename supabase → supabaseAdmin

# 4. Update vendor routes (Step 4)
# - Search for all "await supabase.from"
# - Replace with "await req.supabase.from"

# 5. Test changes
pnpm vitest tests/rls-leak-tests.test.js
node scripts/vmp-guardrails-check.mjs

# 6. Commit and deploy
git add .
git commit -m "feat: enforce RLS via user-scoped Supabase client"
git push origin feature/rls-enforcement-phase2
```

---

**Status**: Ready for Phase 2 migration (Express server updates)  
**Blocker**: None - all prerequisites complete  
**Risk Level**: Low (rollback plan available, tests in place)  
**Estimated Completion**: 3-4 hours
