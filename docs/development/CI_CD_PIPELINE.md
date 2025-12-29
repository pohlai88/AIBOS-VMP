# CI/CD Pipeline Guide

**Date:** 2025-01-22  
**Status:** ✅ **ACTIVE**  
**Purpose:** Standardized CI/CD gate order for PR validation

---

## 🚪 The Golden Pipeline: `ci:gate`

**Command:** `npm run ci:gate`

**🚨 NON-NEGOTIABLE RULE:** PRs must pass `npm run ci:gate`. No bypass, no skip.

**Fast no-drift audit:**
- **Preferred:** `npm run audit:no-drift` (canonical name, clear in CI logs)
- **Alias:** `npm run guardrails` (kept for convenience; same command)

**What it runs (in order):**
1. `npm run lint` - ESLint validation
2. `npm run test:unit` - Unit tests (includes meta-tests for CCP enforcement)
3. `node scripts/audit/no-drift-audit.mjs` - No-drift audit (grep-based validation)

**Exit codes:**
- `0` = All checks passed (PR safe to merge)
- `1` = One or more checks failed (PR blocked)

---

## Why This Order?

### 1. Lint First (Fastest)
- Catches syntax errors and style violations
- Fast execution (<5 seconds)
- No dependencies required

### 2. Unit Tests (Including Meta-Tests)
- Runs all unit tests in `tests/unit/` (includes `tests/unit/meta/`)
- **Meta-tests enforce CCP boundaries** (adapter-only, signed URLs, CRUD-S registry)
- Medium execution time (~30-60 seconds)
- Requires test environment setup

### 3. No-Drift Audit (Final Validation)
- Static analysis via grep/ripgrep
- Validates architectural boundaries
- Fast execution (<10 seconds)
- No dependencies required

---

## Usage in CI/CD

### GitHub Actions Example

```yaml
name: PR Validation

on:
  pull_request:
    branches: [main, develop]

jobs:
  ci-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run ci:gate
```

### Local Pre-Commit

```bash
# Run before pushing
npm run ci:gate
```

---

## What Each Step Validates

### `npm run lint`
- ESLint rules compliance
- Code style consistency
- Syntax errors

### `npm run test:unit`
- Unit test correctness
- **Meta-test CCP enforcement:**
  - Adapter-only doctrine
  - Signed URL only
  - CRUD-S registry enforcement
  - Legacy adapter usage (WARN/FAIL)

**Fast CCP check:** `npm run test:meta` runs only meta-tests (instant feedback during refactors)

### `npm run audit:no-drift` (or `npm run guardrails`)
- Direct Supabase calls outside adapters
- Public URL usage
- Hardcoded `.eq('id', ...)` in CRUD-S tables
- `@ts-ignore` containment
- IMEI leakage
- CRUD-S registry coverage

**Note:** `guardrails` is an alias for `audit:no-drift` (backwards compatibility).

---

## Full Test Suite (Separate)

For comprehensive testing (not in CI gate):

```bash
# All tests (unit + integration)
npm test

# With coverage
npm run test:coverage

# E2E tests (slow, run separately)
npm run test:e2e

# Combined (all tests)
npm run test:combined
```

**Note:** E2E tests are excluded from `ci:gate` because they're slow (>1s per test). Run them separately or in a dedicated E2E job.

---

## Other Validation Scripts

### `npm run validate:all`
- Runs `audit:no-drift` (no-drift audit)
- Runs `validate:docs` (documentation naming)
- Runs `validate:scripts` (script registry)

**Purpose:** Documentation and governance validation (not runtime drift).

**Use case:** Pre-release validation, not PR gate.

---

## Script Alignment

### ✅ Server Entrypoint
- `"main": "server.js"` - Single entry point
- `"start": "node server.js"` - Production
- `"dev": "nodemon server.js"` - Development

### ✅ Test Scripts
- `test` → `vitest run` (all tests, includes meta-tests)
- `test:unit` → `vitest run tests/unit/` (includes meta-tests)
- Meta-tests run by default ✅

### ✅ Guardrails
- `guardrails` → `node scripts/audit/no-drift-audit.mjs`
- `ci:gate` → lint + test:unit + guardrails (golden pipeline)

---

## Troubleshooting

### CI Gate Fails

1. **Lint fails:**
   - Run `npm run lint:fix` to auto-fix
   - Check ESLint output for specific violations

2. **Unit tests fail:**
   - Check test output for failing tests
   - If meta-tests fail, see `docs/development/CCP_ENFORCEMENT.md`

3. **Audit fails:**
   - Check audit output for drift violations
   - See `docs/audit/NO_DRIFT_AUDIT_REPORT.md` for details

### Meta-Tests Fail

**Do NOT bypass.** See `docs/development/CCP_ENFORCEMENT.md` for:
- What to do when meta-tests fail
- How to fix violations
- When to update CCP policy

---

## Related Documentation

- `docs/development/CCP_ENFORCEMENT.md` - CCP enforcement policy
- `docs/audit/NO_DRIFT_AUDIT_REPORT.md` - Full audit report
- `docs/audit/META_TESTS_GUIDE.md` - Meta-tests documentation
- `scripts/audit/no-drift-audit.mjs` - Audit script source

---

**Last Updated:** 2025-01-22  
**Maintainer:** AI Assistant

