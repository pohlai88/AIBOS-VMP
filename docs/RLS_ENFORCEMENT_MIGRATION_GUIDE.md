# RLS Enforcement Migration Guide

## 🚨 CRITICAL SECURITY GAP IDENTIFIED

Your Express server currently uses `service_role` key for ALL database operations, which **BYPASSES ALL RLS POLICIES**. This violates the "Tenant Isolation Is Absolute" principle.

### Current State (INSECURE)
```javascript
// server.js line 83
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
```

**Problem**: When Express uses `service_role`, RLS policies are ignored. This means:
- ❌ Vendor A can query vendor B's cases (if they guess the UUID)
- ❌ Tenant isolation is not enforced at database level
- ❌ All security relies on application-layer checks (fragile)

---

## ✅ Solution: Migrate to Anon Key + User JWTs

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Express Middleware Layer                                     │
│                                                              │
│ 1. Extract JWT from session cookie                          │
│ 2. Create Supabase client with anon key + setAuth(jwt)      │
│ 3. All queries now run as authenticated user                │
│ 4. RLS policies enforce tenant/vendor isolation             │
└─────────────────────────────────────────────────────────────┘
```

### Step 1: Create Request-Scoped Supabase Client Middleware

**File**: `src/middleware/supabase-client.js`

```javascript
import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client scoped to the authenticated user.
 * Uses anon key + user JWT so RLS policies are enforced.
 * 
 * CRITICAL: This ensures "Tenant Isolation Is Absolute" at database level.
 */
export function createUserScopedSupabaseClient(req) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  // Create client with anon key (RLS enforced)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // If user is authenticated, set their JWT
  if (req.session?.access_token) {
    supabase.auth.setAuth(req.session.access_token);
  }

  return supabase;
}

/**
 * Middleware: Attach user-scoped Supabase client to req.supabase
 */
export function attachSupabaseClient(req, res, next) {
  req.supabase = createUserScopedSupabaseClient(req);
  next();
}
```

### Step 2: Update server.js to Use Middleware

**File**: `server.js`

```javascript
// Import the middleware
import { attachSupabaseClient } from './src/middleware/supabase-client.js';

// Apply middleware AFTER session middleware but BEFORE routes
app.use(session(sessionOptions));
app.use(attachSupabaseClient); // <-- ADD THIS

// Now all routes have access to req.supabase (user-scoped)
```

### Step 3: Update Route Handlers

**Before (service_role bypass)**:
```javascript
app.get('/vendor/cases/:id', requireAuth, async (req, res) => {
  const { data: caseData } = await supabase // service_role - RLS bypassed!
    .from('vmp_cases')
    .select('*')
    .eq('id', req.params.id)
    .single();

  // Manual ownership check (fragile)
  if (caseData?.vendor_id !== req.session.vendorId) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(caseData);
});
```

**After (RLS enforced)**:
```javascript
app.get('/vendor/cases/:id', requireAuth, async (req, res) => {
  const { data: caseData, error } = await req.supabase // user-scoped - RLS enforced!
    .from('vmp_cases')
    .select('*')
    .eq('id', req.params.id)
    .single();

  // RLS policy handles authorization automatically
  // If user can't access case, data will be null
  if (error || !caseData) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(caseData);
});
```

### Step 4: Keep Service Role Client for Admin Operations

**File**: `server.js`

```javascript
// Service role client (ONLY for admin operations)
const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Export for admin-only use cases:
// - User creation/deletion
// - Bulk data imports
// - Cron jobs
// - Internal analytics
export { supabaseAdmin };
```

**Usage pattern**:
```javascript
// ONLY use supabaseAdmin for operations that MUST bypass RLS
// (e.g., creating new vendor users during onboarding)
async function createVendorUser(email, vendorId) {
  const { data, error } = await supabaseAdmin
    .from('vmp_vendor_users')
    .insert({ email, vendor_id: vendorId });
  
  return data;
}
```

---

## 🧪 Testing RLS Enforcement

### Test 1: Vendor Isolation (Cross-Vendor Access Denied)

```javascript
// tests/rls/vendor-isolation.test.js
import { describe, it, expect } from 'vitest';

describe('RLS Vendor Isolation', () => {
  it('prevents vendor A from reading vendor B cases', async () => {
    // Login as vendor A
    const vendorAClient = await loginAsVendor('vendor-a@example.com');

    // Try to read vendor B's case
    const { data, error } = await vendorAClient
      .from('vmp_cases')
      .select('*')
      .eq('id', VENDOR_B_CASE_ID) // Known case ID from vendor B
      .single();

    // RLS policy should return null (not found)
    expect(data).toBeNull();
  });
});
```

### Test 2: Tenant Isolation (Cross-Tenant Access Denied)

```javascript
describe('RLS Tenant Isolation', () => {
  it('prevents tenant A user from reading tenant B data', async () => {
    const tenantAClient = await loginAsVendor('tenant-a-user@example.com');

    // Try to read company from tenant B
    const { data } = await tenantAClient
      .from('vmp_companies')
      .select('*')
      .eq('id', TENANT_B_COMPANY_ID)
      .single();

    expect(data).toBeNull(); // RLS blocks cross-tenant access
  });
});
```

### Test 3: Message Cascade (Case Access Controls Messages)

```javascript
describe('RLS Message Access', () => {
  it('allows reading messages only for accessible cases', async () => {
    const vendorClient = await loginAsVendor('vendor@example.com');

    // Read messages for own case
    const { data: ownMessages } = await vendorClient
      .from('vmp_messages')
      .select('*')
      .eq('case_id', OWN_CASE_ID);

    expect(ownMessages.length).toBeGreaterThan(0);

    // Try to read messages for other vendor's case
    const { data: otherMessages } = await vendorClient
      .from('vmp_messages')
      .select('*')
      .eq('case_id', OTHER_VENDOR_CASE_ID);

    expect(otherMessages.length).toBe(0); // RLS blocks access
  });
});
```

---

## 🔒 RLS Policy Reference

### Helper Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `public.get_user_vendor_id()` | Get vendor_id for authenticated user | UUID |
| `public.get_user_company_ids()` | Get all company_ids user can access (via scope) | TABLE(uuid) |
| `public.can_access_case(case_id)` | Check if user can access case (vendor OR company side) | BOOLEAN |
| `public.get_user_tenant_id()` | Get tenant_id for authenticated user | UUID |

### Case Access Logic

```sql
-- User can view case if:
SELECT * FROM vmp_cases
WHERE 
  vendor_id = public.get_user_vendor_id() -- They are the vendor
  OR
  company_id IN (SELECT company_id FROM public.get_user_company_ids()) -- They are the company
```

### Message Access Logic (Cascade)

```sql
-- User can view message if they can access the parent case
SELECT * FROM vmp_messages
WHERE public.can_access_case(case_id) = true;
```

---

## 📋 Migration Checklist

### Phase 1: Setup (1 hour)
- [x] RLS policies created (migration applied)
- [ ] Create `src/middleware/supabase-client.js`
- [ ] Update `server.js` to use middleware
- [ ] Rename old `supabase` → `supabaseAdmin`

### Phase 2: Route Migration (2-4 hours)
- [ ] Update `/vendor/*` routes to use `req.supabase`
- [ ] Update `/partials/*` routes to use `req.supabase`
- [ ] Update `/api/cases/*` routes to use `req.supabase`
- [ ] Update `/api/messages/*` routes to use `req.supabase`
- [ ] Keep `supabaseAdmin` only for admin operations

### Phase 3: Testing (2 hours)
- [ ] Create RLS leak tests (vendor isolation, tenant isolation, cascade)
- [ ] Run guardrails check (ensure no 403 leaks)
- [ ] Manual QA: Login as vendor A, verify cannot see vendor B data
- [ ] Check Supabase logs for RLS policy violations

### Phase 4: Validation (1 hour)
- [ ] Review security advisors: `mcp_supabase_get_advisors`
- [ ] Verify all tables have RLS enabled
- [ ] Confirm no service_role usage in user-facing routes
- [ ] Document admin-only service_role use cases

---

## ⚠️ Breaking Changes

### Before Migration
```javascript
// All routes used global supabase (service_role)
const { data } = await supabase.from('vmp_cases').select('*');
```

### After Migration
```javascript
// User-facing routes use req.supabase (anon key + JWT)
const { data } = await req.supabase.from('vmp_cases').select('*');

// Admin operations use supabaseAdmin (service_role)
const { data } = await supabaseAdmin.from('vmp_vendor_users').insert(...);
```

---

## 🎯 Expected Outcomes

### Security Improvements
✅ **Mathematical boundary enforcement**: Tenant isolation enforced by Postgres RLS, not just app code  
✅ **Anti-enumeration**: Even with guessed UUIDs, unauthorized queries return empty results  
✅ **Cascade security**: Messages/evidence/payments inherit case access control automatically  
✅ **Audit trail**: All queries run as authenticated user (trackable in Supabase logs)  

### Performance Impact
⚠️ **Minimal overhead**: RLS policy evaluation adds ~1-2ms per query  
✅ **Cacheable**: Helper functions (`get_user_vendor_id()`) use `STABLE` (Postgres caches result per transaction)  
✅ **Index-friendly**: Policies use indexed columns (`vendor_id`, `company_id`, `tenant_id`)  

---

## 📚 Additional Resources

- [Supabase RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Multi-tenant Patterns](https://supabase.com/docs/guides/database/postgres/row-level-security#multi-tenant-patterns)
- [Auth Helpers for Server-Side](https://supabase.com/docs/guides/auth/server-side)

---

## 🆘 Rollback Plan

If RLS causes issues, you can temporarily disable enforcement:

```sql
-- EMERGENCY ONLY: Disable RLS on specific table
ALTER TABLE vmp_cases DISABLE ROW LEVEL SECURITY;

-- Re-enable after fixing policies
ALTER TABLE vmp_cases ENABLE ROW LEVEL SECURITY;
```

**Note**: This should ONLY be used in emergencies. The correct solution is to fix the RLS policies, not disable them.
