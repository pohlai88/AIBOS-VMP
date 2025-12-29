# CCP Enforcement Policy

**Date:** 2025-01-22  
**Status:** ✅ **ENFORCED**  
**Purpose:** Prevent architectural drift through automated guardrails

---

## 🚨 Critical Rule: Do Not Bypass Meta-Tests

**If meta-tests fail, do NOT bypass them. Fix the violation or update CCP policy.**

Meta-tests are **automated guardrails** that enforce Critical Control Points (CCP). They prevent architectural drift and maintain PRD/CCP compliance.

### What to Do When Meta-Tests Fail

1. **Read the error message** - It will tell you exactly what boundary was violated
2. **Fix the violation** - Refactor code to comply with CCP boundaries
3. **If the violation is legitimate** - Update the CCP policy and meta-test (don't bypass)

### What NOT to Do

❌ **DO NOT** add `@ts-ignore` to suppress meta-test errors  
❌ **DO NOT** skip meta-tests in CI/CD  
❌ **DO NOT** comment out meta-test assertions  
❌ **DO NOT** create exceptions without updating policy

---

## Meta-Tests Location

**File:** `tests/unit/meta/ccp-enforcement.test.js`

**Run:** `npm test` (runs automatically) or `npm run test:unit -- tests/unit/meta/`

**⚠️ CRITICAL:** Meta-tests **MUST** remain in `tests/unit/meta/` to be included in `npm run test:unit`. Do not move them to `tests/meta/` or any other location without updating the test script.

---

## The 3 Enforced Boundaries

### 1. Adapter-Only Doctrine

**Rule:** All database I/O must go through adapters (`nexusAdapter` or service layer).

**What it checks:**
- Fails if `supabase.from()` is called outside `src/adapters/`, `src/services/`, or `src/repositories/`
- Catches patterns like `supabase.from()`, `this.supabase.from()`, `req.supabase.from()`, etc.

**Fix:** Use `nexusAdapter` methods instead of direct Supabase calls.

---

### 2. Signed URL Only

**Rule:** All file access must use signed URLs (no public URLs).

**What it checks:**
- Fails if `getPublicUrl()` or manual public URL construction is used
- Ensures all file access uses `createSignedDownloadUrl()` or `createSignedUploadUrl()`

**Fix:** Use `nexusAdapter.createSignedDownloadUrl()` or `nexusAdapter.createSignedUploadUrl()`.

---

### 3. CRUD-S Registry Enforcement

**Rule:** Only registered tables support soft delete.

**What it checks:**
- Fails if `softDeleteEntity()` is called for a table not in `SOFT_DELETE_CAPABLE` registry
- Prevents accidental soft delete on non-CRUD-S tables (audit logs, sessions, etc.)

**Fix:** Add table to `SOFT_DELETE_CAPABLE` registry in `src/adapters/nexus-adapter.js` OR use hard delete for non-CRUD-S tables.

---

## Legacy Adapter Usage

**Rule:** `vmpAdapter` usage is frozen - no new usage allowed.

**What it checks:**
- **WARN** if `vmpAdapter` is used in allowed files (acceptable debt with TODO)
- **FAIL** if `vmpAdapter` appears in new files

**Allowed files:**
- `src/adapters/supabase.js` (legacy compatibility layer)
- `src/utils/push-sender.js` (TODO: CLEANUP-VMP-LEGACY-01)
- `src/utils/notifications.js` (TODO: CLEANUP-VMP-LEGACY-01)

**Fix:** Migrate to `nexusAdapter`. See `TODO: CLEANUP-VMP-LEGACY-01`.

---

## CI/CD Integration

Meta-tests run automatically in CI/CD pipeline:

```bash
npm run lint
npm run typecheck
npm run test:unit  # Includes meta-tests
node scripts/audit/no-drift-audit.mjs
```

**If any step fails → PR blocked.**

---

## Compliance Score

Meta-tests maintain **99% compliance** by:
- **Automated enforcement** (no human discipline required)
- **Early detection** (fails in CI, not production)
- **Clear error messages** (actionable feedback)

---

## Quick Commands

**Fast CCP enforcement:**
- `npm run test:meta` - Run meta-tests only (seconds)

**Fast no-drift audit:**
- **Preferred:** `npm run audit:no-drift` (canonical name, clear in CI logs)
- **Alias:** `npm run guardrails` (kept for convenience; same command)

**Full CI gate:**
- `npm run ci:gate` - lint + unit/meta + audit (official pipeline)

---

## Related Documentation

- `docs/audit/META_TESTS_GUIDE.md` - Detailed meta-test documentation
- `docs/audit/NO_DRIFT_AUDIT_REPORT.md` - Full audit report
- `scripts/audit/no-drift-audit.mjs` - Manual audit script
- `docs/architecture/CRUD_S_REGISTRY_CONTRACT.md` - CRUD-S registry details

---

**Last Updated:** 2025-01-22  
**Maintainer:** AI Assistant

