# Test Environment Reset Guide

**Purpose:** Fix Supabase schema cache issues and test pollution.  
**When to use:** After migrations or when seeing "column not found in schema cache" errors.

---

## Quick Fixes

### Fix 1: Schema Cache Stale (PostgREST)

**Symptoms:**
```
DatabaseError: Could not find the 'confirmed_at' column of 'vmp_soa_matches' in the schema cache
```

**Root Cause:** PostgREST caches the database schema. After migrations add/remove columns, the cache is stale.

**Solution:**
```powershell
# Option A: Full reset (clears data + reloads migrations)
supabase db reset

# Option B: Restart services (preserves data)
supabase stop
supabase start

# Option C: Just reload schema (fastest, if available)
supabase db reload-schema
```

**When to run:** After any migration that alters table structure.

---

### Fix 2: Test Pollution (Leftover Data)

**Symptoms:**
```
AssertionError: expected [] to deeply equal [{ id: "...", ... }]
```

**Root Cause:** Previous test runs left data in the database. Next test expects clean state but finds leftovers.

**Solution A: Manual Cleanup (Quick)**
```powershell
# Truncate all test data (preserves schema)
supabase db reset --db-only
```

**Solution B: Automated Cleanup (Preferred)**

Add to `tests/setup/test-helpers.js`:
```javascript
/**
 * Reset test database to clean state
 * Truncates all tables while preserving schema
 */
export async function resetTestDatabase(supabase) {
  const tables = [
    'vmp_soa_acknowledgements',
    'vmp_soa_discrepancies',
    'vmp_soa_matches',
    'vmp_soa_items',
    'vmp_debit_notes',
    'vmp_invoices',
    'vmp_payments',
    'vmp_messages',
    'vmp_evidence',
    'vmp_checklist_steps',
    'vmp_cases',
    'vmp_vendor_users',
    'vmp_vendors',
    'vmp_companies',
    'vmp_tenants'
  ];
  
  // Truncate in reverse FK order
  for (const table of tables) {
    await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
}
```

Then in test files:
```javascript
import { resetTestDatabase } from '../setup/test-helpers.js';

beforeEach(async () => {
  supabase = createTestSupabaseClient();
  await resetTestDatabase(supabase); // Start with clean slate
  // ... create test data
});
```

---

## CI/CD Integration

### Pre-Test Reset (GitHub Actions)

```yaml
- name: Reset Supabase Schema Cache
  run: |
    supabase stop
    supabase start
    
- name: Run Tests
  run: pnpm vitest run
```

### Local Development Workflow

```powershell
# Before starting work session
supabase db reset

# Run tests
pnpm vitest

# If schema cache errors appear
supabase stop; supabase start; pnpm vitest
```

---

## Common Issues & Solutions

### Issue: "relation does not exist"

**Symptom:** `relation "vmp_cases" does not exist`

**Cause:** Migrations not applied to test database.

**Fix:**
```powershell
supabase db reset  # Reapplies all migrations
```

---

### Issue: Foreign Key Violations During Cleanup

**Symptom:** `update or delete on table violates foreign key constraint`

**Cause:** Deleting parent record before child records.

**Fix:** Delete in reverse FK dependency order:
1. SOA acknowledgements → discrepancies → matches → items
2. Debit notes → invoices/payments
3. Messages → evidence → checklist → cases
4. Vendor users → vendors/companies → tenants

---

### Issue: Test Isolation Failures

**Symptom:** Test passes alone but fails in suite.

**Cause:** Shared state between tests (e.g., `beforeEach` creates data, test expects empty).

**Fix:** Either:
- Use unique test data per test (e.g., fresh vendor for "empty" test)
- OR reset database in `beforeEach`

---

## Troubleshooting Decision Tree

```
Test failing?
├─ "column not found in schema cache"
│  └─ Run: supabase stop; supabase start
│
├─ "expected [] but got [...]"
│  └─ Check: Is beforeEach creating data the test expects not to exist?
│     ├─ Yes → Create fresh entity for that test
│     └─ No → Add resetTestDatabase() to beforeEach
│
├─ "relation does not exist"
│  └─ Run: supabase db reset
│
└─ Foreign key violation during cleanup
   └─ Fix: Delete child records before parent (see order above)
```

---

## Best Practices

### ✅ DO
- Run `supabase db reset` after adding/modifying migrations
- Use `resetTestDatabase()` for integration tests that need isolation
- Create fresh test entities for "empty state" tests
- Delete test data in reverse FK order in `afterEach`

### ❌ DON'T
- Rely on test execution order (tests should be independent)
- Share test data across tests (use `beforeEach` to create fresh data)
- Manually manage cleanup for every test (use helpers)
- Skip `afterEach` cleanup (causes pollution)

---

## Performance Tips

**For unit tests:** No DB reset needed (pure logic tests).

**For adapter tests:** Use `resetTestDatabase()` only in `beforeAll` if tests are truly independent.

**For integration tests:** Reset per test to guarantee isolation.

---

## Monitoring Test Stability

Track flaky tests by running suite multiple times:
```powershell
# Run 10 times to detect flakiness
for ($i=1; $i -le 10; $i++) { 
  Write-Host "Run $i"
  pnpm vitest run tests/adapters/soa-adapter.test.js
}
```

If failures are inconsistent → test pollution or race conditions.

---

## Related Documentation

- **SOA Matching Rules:** `docs/development/SOA_MATCHING_RULES.md`
- **Test Failure Classification:** `TEST_FAILURE_CLASSIFICATION.md`
- **Migration Guide:** `migrations/README.md`
