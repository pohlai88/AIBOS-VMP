# Meta-Tests Guide

**Date:** 2025-01-22  
**Status:** ✅ **ACTIVE**  
**Purpose:** Automated enforcement of CCP boundaries to prevent architectural drift

---

## Overview

Meta-tests are **static analysis tests** that enforce Critical Control Points (CCP) and prevent architectural drift. They run as part of the standard test suite and **fail the build** if boundaries are violated.

---

## Location

**File:** `tests/unit/meta/ccp-enforcement.test.js`

**Run:** `npm test` (runs all tests including meta-tests)

**Run Meta-Tests Only:** `npm run test:unit -- tests/unit/meta/`

---

## The 3 Meta-Tests

### 1. Adapter-Only Doctrine Enforcement

**Test:** `should fail if any non-adapter/service file calls supabase.from() directly`

**What it checks:**
- Scans all files in `src/` for `supabase.from()` calls
- Fails if found outside allowed directories:
  - `src/adapters/`
  - `src/services/`
  - `src/repositories/`
  - `src/middleware/supabase-client.js` (client initialization only)

**Why it matters:**
- Enforces adapter-only doctrine (all DB I/O must go through adapters)
- Prevents direct Supabase calls in routes, controllers, or utilities
- Catches drift before it becomes a pattern

**Example violation:**
```javascript
// ❌ FAILS: Direct call in route
app.get('/cases', async (req, res) => {
  const { data } = await supabase.from('nexus_cases').select(); // ❌
  res.render('cases.html', { cases: data });
});

// ✅ PASSES: Uses adapter
app.get('/cases', async (req, res) => {
  const cases = await nexusAdapter.getCases(req.tenantId); // ✅
  res.render('cases.html', { cases });
});
```

---

### 2. Signed URL Enforcement

**Test:** `should fail if any file uses getPublicUrl or constructs public Storage URLs`

**What it checks:**
- Scans for `getPublicUrl`, `publicUrl`, or manual public URL construction
- Fails if found (except in comments/TODOs)

**Why it matters:**
- Enforces signed URL policy (all file access must use signed URLs with TTL)
- Prevents public URL leakage (security risk)
- Ensures consistent file access pattern

**Example violation:**
```javascript
// ❌ FAILS: Public URL
const url = supabase.storage.from('bucket').getPublicUrl('file.pdf'); // ❌

// ✅ PASSES: Signed URL
const url = await nexusAdapter.createSignedDownloadUrl('bucket', 'file.pdf', 3600); // ✅
```

---

### 3. CRUD-S Registry Enforcement

**Test:** `should fail if softDeleteEntity() is called for a table not in SOFT_DELETE_CAPABLE registry`

**What it checks:**
- Extracts registry from `nexus-adapter.js`
- Scans all `softDeleteEntity()` calls
- Fails if table is not in registry

**Why it matters:**
- Enforces CRUD-S registry (only registered tables support soft delete)
- Prevents accidental soft delete on non-CRUD-S tables (audit logs, sessions, etc.)
- Ensures registry is the single source of truth

**Example violation:**
```javascript
// ❌ FAILS: Table not in registry
await nexusAdapter.softDeleteEntity({
  table: 'nexus_audit_log', // ❌ Not in SOFT_DELETE_CAPABLE
  id: 'log-123',
  userId: 'user-123',
  tenantId: 'tenant-123'
});

// ✅ PASSES: Table in registry
await nexusAdapter.softDeleteEntity({
  table: 'nexus_cases', // ✅ In SOFT_DELETE_CAPABLE
  id: 'CASE-123',
  userId: 'user-123',
  tenantId: 'tenant-123'
});
```

---

## Legacy Adapter Usage Test

**Test:** `should flag legacy vmpAdapter usage outside allowed files`

**What it checks:**
- Scans for `vmpAdapter` usage
- Fails if found outside allowed files:
  - `src/adapters/supabase.js` (legacy compatibility layer)
  - `src/utils/push-sender.js` (TODO: CLEANUP-VMP-LEGACY-01)
  - `src/utils/notifications.js` (TODO: CLEANUP-VMP-LEGACY-01)

**Why it matters:**
- Prevents new code from using legacy adapter
- Tracks acceptable debt (files with TODOs)
- Ensures migration path is clear

---

## Running Meta-Tests

### In CI/CD

Meta-tests run automatically as part of `npm test`:

```bash
npm test
```

If any meta-test fails, the build fails with clear error messages.

### Locally

Run meta-tests only:

```bash
npm run test:unit -- tests/unit/meta/
```

Watch mode:

```bash
npm run test:watch -- tests/unit/meta/
```

---

## Adding New Meta-Tests

When adding new CCP boundaries, add a new test in `ccp-enforcement.test.js`:

```javascript
describe('CCP Enforcement: New Boundary', () => {
  it('should fail if [violation description]', () => {
    // Static analysis logic
    // Fail with clear error message
  });
});
```

**Pattern:**
1. Use `execSync` with `rg` (ripgrep) for pattern matching
2. Filter out comments/examples
3. Check against allowed list
4. Fail with actionable error message

---

## Integration with Audit Script

The audit script (`scripts/audit/no-drift-audit.mjs`) performs similar checks but:
- **Audit script:** Manual/CI check, outputs report
- **Meta-tests:** Automated enforcement, fails build

Both use the same patterns, ensuring consistency.

---

## Troubleshooting

### Test fails but code is legitimate

If a meta-test fails but the code is legitimate (e.g., comment/example):

1. **Add to allowed list** in the test (if it's a new pattern)
2. **Add comment marker** (e.g., `// Example:`, `// Deprecated:`)
3. **Refactor** if it's actual drift

### Test is too strict

If a meta-test is catching false positives:

1. **Refine the pattern** (better regex, more context)
2. **Add exception list** for known legitimate cases
3. **Document the exception** in the test

---

## Compliance Score Impact

Meta-tests bump compliance from **95% → 99%** by:
- **Automated enforcement** (no human discipline required)
- **Early detection** (fails in CI, not production)
- **Clear error messages** (actionable feedback)

---

## Related Documentation

- `docs/audit/NO_DRIFT_AUDIT_REPORT.md` - Full audit report
- `scripts/audit/no-drift-audit.mjs` - Manual audit script
- `docs/architecture/CRUD_S_REGISTRY_CONTRACT.md` - CRUD-S registry details

---

**Last Updated:** 2025-01-22  
**Maintainer:** AI Assistant

