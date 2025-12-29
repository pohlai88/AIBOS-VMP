# Test Registry

**Version:** 1.0.0  
**Last Updated:** 2025-12-28  
**Purpose:** Central registry of all test files with metadata, test type classification, and compliance tracking  
**Status:** Active

---

## Registry Purpose

This registry provides:
- **Complete inventory** of all test files in the codebase
- **Test type classification** (unit, integration, browser, e2e)
- **Metadata** for each test file (purpose, coverage, dependencies)
- **Quick reference** for finding tests
- **Compliance tracking** with test standards

---

## Test File Naming Conventions

### Unit & Integration Tests
**Format:** `[feature-or-module].test.js`

**Examples:**
- ✅ `soa-adapter.test.js`
- ✅ `server-routes.test.js`
- ✅ `route-helpers.test.js`
- ❌ `soaAdapter.test.js` (camelCase)
- ❌ `server-routes.spec.js` (wrong extension)

### Browser Tests
**Format:** `[feature-or-module].browser.test.js`

**Examples:**
- ✅ `mobile-ux-improvements.browser.test.js`
- ✅ `icon-accessibility.browser.test.js`
- ❌ `mobile-ux.test.js` (missing `.browser`)

### E2E Tests
**Format:** `[feature-or-workflow].spec.js`

**Examples:**
- ✅ `soa-recon-workflow.spec.js`
- ✅ `button-link-navigation.spec.js`
- ❌ `soa-recon.test.js` (wrong extension)

---

## Test Type Definitions

### Unit Tests (`tests/unit/`)
- **Speed:** <1ms per test
- **Scope:** Pure logic, mocked dependencies
- **Purpose:** Test functions, utilities, component logic
- **Location:** `tests/unit/[category]/`

### Integration Tests (`tests/integration/`)
- **Speed:** ~100ms per test
- **Scope:** Real DB/API connections
- **Purpose:** Test adapter queries, API routes, RLS policies
- **Location:** `tests/integration/[category]/`

### Browser Tests (`tests/browser/`)
- **Speed:** ~100ms per test
- **Scope:** Virtual DOM/Browser rendering
- **Purpose:** Test component rendering, HTMX interactions
- **Location:** `tests/browser/`

### E2E Tests (`tests/e2e/`)
- **Speed:** >1s per test
- **Scope:** Full environment, real browser
- **Purpose:** Complete user journeys, critical paths
- **Location:** `tests/e2e/[category]/`

---

## Registry Entries

### Unit Tests

| File | Path | Purpose | Dependencies | Status | Last Updated |
|------|------|---------|--------------|--------|--------------|
| path-check.test.js | `tests/unit/` | Verify path alias resolution | @, @tests, @server | Active | 2025-12-28 |
| soa-recon.test.js | `tests/unit/components/` | Test SOA reconciliation component logic | @/adapters/supabase.js | Active | 2025-12-28 |
| checklist-rules.test.js | `tests/unit/utils/` | Test checklist rule validation | @/utils/checklist-rules.js | Active | - |
| errors.test.js | `tests/unit/utils/` | Test error handling utilities | @/utils/errors.js | Active | - |
| route-helpers.test.js | `tests/unit/utils/` | Test route helper functions | @/utils/route-helpers.js | Active | - |
| server-multer-file-filter.test.js | `tests/unit/server/` | Test multer file filter logic | @server | Active | - |
| server-nunjucks-filters.test.js | `tests/unit/server/` | Test Nunjucks template filters | @server | Active | - |

**Total:** 7 unit test files

---

### Integration Tests

#### Adapters (`tests/integration/adapters/`)

| File | Path | Purpose | Dependencies | Status | Last Updated |
|------|------|---------|--------------|--------|--------------|
| soa-adapter.test.js | `tests/integration/adapters/` | Test SOA adapter methods | @/adapters/supabase.js, @tests/fixtures | Active | 2025-12-28 |
| supabase.test.js | `tests/integration/adapters/` | Test Supabase adapter core functionality | @/adapters/supabase.js | Active | - |
| supabase-error-simulation.test.js | `tests/integration/adapters/` | Test error handling in Supabase adapter | @/adapters/supabase.js | Active | - |
| adapters-supabase-comprehensive-error-paths.test.js | `tests/integration/adapters/` | Comprehensive error path coverage | @/adapters/supabase.js | Active | - |
| adapters-supabase-error-paths.test.js | `tests/integration/adapters/` | Test error paths in Supabase adapter | @/adapters/supabase.js | Active | - |
| adapters-supabase-mock-storage-error.test.js | `tests/integration/adapters/` | Test storage error mocking | @/adapters/supabase.js | Active | - |
| adapters-supabase-upload-error-paths.test.js | `tests/integration/adapters/` | Test upload error paths | @/adapters/supabase.js | Active | - |
| adapters-supabase-upload-mock-error-paths.test.js | `tests/integration/adapters/` | Test upload error paths with mocks | @/adapters/supabase.js | Active | - |

**Total:** 8 adapter integration test files

#### Server (`tests/integration/server/`)

| File | Path | Purpose | Dependencies | Status | Last Updated |
|------|------|---------|--------------|--------|--------------|
| server-soa-routes.test.js | `tests/integration/server/` | Test SOA reconciliation routes | @server, @tests/fixtures | Active | 2025-12-28 |
| server-routes.test.js | `tests/integration/server/` | Test general server routes | @server | Active | - |
| server-middleware.test.js | `tests/integration/server/` | Test server middleware | @server | Active | - |
| server-error-paths.test.js | `tests/integration/server/` | Test error handling in routes | @server | Active | - |
| server-extended.test.js | `tests/integration/server/` | Extended server functionality tests | @server | Active | - |
| server-internal-ops.test.js | `tests/integration/server/` | Test internal operations | @server | Active | - |
| server-listen-coverage.test.js | `tests/integration/server/` | Test server listen coverage | @server | Active | - |
| server-timeout-middleware.test.js | `tests/integration/server/` | Test timeout middleware | @server | Active | - |
| days5-8.test.js | `tests/integration/server/` | Test days 5-8 functionality | @server | Active | - |
| emergency-pay-override.test.js | `tests/integration/server/` | Test emergency pay override | @server | Active | - |

**Total:** 10 server integration test files

#### RLS (`tests/integration/rls/`)

| File | Path | Purpose | Dependencies | Status | Last Updated |
|------|------|---------|--------------|--------|--------------|
| rls-integration.test.js | `tests/integration/rls/` | Test Row Level Security policies | @/adapters/supabase.js | Active | - |
| rls-leak-tests.test.js | `tests/integration/rls/` | Test RLS leak prevention | @/adapters/supabase.js | Active | - |

**Total:** 2 RLS integration test files

#### Security (`tests/integration/security/`)

| File | Path | Purpose | Dependencies | Status | Last Updated |
|------|------|---------|--------------|--------|--------------|
| vendor_leakage.test.js | `tests/integration/security/` | Test vendor data leakage prevention | @/adapters/supabase.js | Active | - |

**Total:** 1 security integration test file

#### Edge Cases (`tests/integration/edge-cases/`)

| File | Path | Purpose | Dependencies | Status | Last Updated |
|------|------|---------|--------------|--------|--------------|
| server-branch-coverage.test.js | `tests/integration/edge-cases/` | Branch coverage for server | @server | Active | - |
| server-coverage-gaps.test.js | `tests/integration/edge-cases/` | Coverage gap tests for server | @server | Active | - |
| adapter-branch-coverage.test.js | `tests/integration/edge-cases/` | Branch coverage for adapters | @/adapters/supabase.js | Active | - |

**Total:** 3 edge case integration test files

**Integration Tests Total:** 24 files

---

### Browser Tests

| File | Path | Purpose | Dependencies | Status | Last Updated |
|------|------|---------|--------------|--------|--------------|
| mobile-ux-improvements.browser.test.js | `tests/browser/` | Test mobile UX improvements | Vitest Browser | Active | - |
| icon-accessibility.browser.test.js | `tests/browser/` | Test icon accessibility | Vitest Browser | Active | - |
| days5-8.browser.test.js | `tests/browser/` | Test days 5-8 browser features | Vitest Browser | Active | - |
| button-link-components.browser.test.js | `tests/browser/` | Test button/link components | Vitest Browser | Active | - |

**Total:** 4 browser test files

---

### E2E Tests

#### Workflows (`tests/e2e/workflows/`)

| File | Path | Purpose | Dependencies | Status | Last Updated |
|------|------|---------|--------------|--------|--------------|
| soa-recon-workflow.spec.js | `tests/e2e/workflows/` | Complete SOA reconciliation workflow | Playwright | Active | - |
| button-link-navigation.spec.js | `tests/e2e/workflows/` | Button/link navigation workflow | Playwright | Active | - |

**Total:** 2 workflow E2E test files

#### Features (`tests/e2e/features/`)

| File | Path | Purpose | Dependencies | Status | Last Updated |
|------|------|---------|--------------|--------|--------------|
| days5-8.spec.js | `tests/e2e/features/` | Days 5-8 feature E2E tests | Playwright | Active | - |
| mobile-ux-improvements.spec.js | `tests/e2e/features/` | Mobile UX improvements E2E | Playwright | Active | - |
| nexus-ccp8-validation.spec.js | `tests/e2e/features/` | Nexus CCP8 validation E2E | Playwright | Active | - |

**Total:** 3 feature E2E test files

#### Smoke (`tests/e2e/smoke/`)

| File | Path | Purpose | Dependencies | Status | Last Updated |
|------|------|---------|--------------|--------|--------------|
| realtime-token.spec.js | `tests/e2e/smoke/` | Realtime token smoke test | Playwright | Active | - |

**Total:** 1 smoke E2E test file

**E2E Tests Total:** 6 files

---

## Test Helpers & Fixtures

### Helpers (`tests/helpers/`)

| File | Path | Purpose | Status | Last Updated |
|------|------|---------|--------|--------------|
| auth-helper.js | `tests/helpers/` | Authentication test utilities | Active | - |

### Setup (`tests/setup/`)

| File | Path | Purpose | Status | Last Updated |
|------|------|---------|--------|--------------|
| test-helpers.js | `tests/setup/` | Shared test utilities and setup helpers | Active | 2025-12-28 |

### Fixtures (`tests/fixtures/`)

| File | Path | Purpose | Status | Last Updated |
|------|------|---------|--------|--------------|
| users.js | `tests/fixtures/data/` | Standard user fixture data | Active | 2025-12-28 |
| vendors.js | `tests/fixtures/data/` | Standard vendor fixture data | Active | 2025-12-28 |
| cases.js | `tests/fixtures/data/` | Standard case fixture data | Active | 2025-12-28 |

---

## Test Statistics

### By Type
- **Unit Tests:** 7 files
- **Integration Tests:** 24 files
- **Browser Tests:** 4 files
- **E2E Tests:** 6 files
- **Helpers/Fixtures:** 5 files

### Total Test Files: 41

### By Category
- **Adapters:** 8 files
- **Server:** 10 files
- **RLS:** 2 files
- **Security:** 1 file
- **Edge Cases:** 3 files
- **Components:** 1 file
- **Utils:** 3 files
- **Workflows:** 2 files
- **Features:** 3 files
- **Smoke:** 1 file

---

## Compliance Tracking

### Naming Convention Compliance
- **Compliant:** 41 files
- **Non-Compliant:** 0 files
- **Compliance Rate:** 100%

### Structure Compliance
- **Correct Location:** 41 files
- **Incorrect Location:** 0 files
- **Compliance Rate:** 100%

### Path Alias Compliance
- **Using Aliases:** 16 files (verified)
- **Using Relative Imports:** 0 files
- **Compliance Rate:** 100%

---

## Maintenance Rules

### When Adding New Tests

1. **Choose correct location:**
   - Unit tests → `tests/unit/[category]/`
   - Integration tests → `tests/integration/[category]/`
   - Browser tests → `tests/browser/`
   - E2E tests → `tests/e2e/[category]/`

2. **Follow naming conventions:**
   - Unit/Integration: `[feature].test.js`
   - Browser: `[feature].browser.test.js`
   - E2E: `[feature].spec.js`

3. **Use path aliases:**
   - `@/` for `src/` imports
   - `@tests/` for `tests/` imports
   - `@server` for `server.js`

4. **Register in this file:**
   - Add entry to appropriate section
   - Include purpose, dependencies, status

5. **Use fixtures and helpers:**
   - Import from `@tests/fixtures/data/`
   - Use `setupSOATestData()`, `setupServerTestData()`
   - Use `cleanupSOATestData()`, `cleanupServerTestData()`

---

## Related Documentation

- [Test Standards](TEST_STANDARDS.md) - Test standards and rules
- [Testing Strategy](../../docs/architecture/TESTING_STRATEGY.md) - Testing philosophy
- [Testing Guide V3](../../docs/development/guides/TESTING_GUIDE_V3.md) - Comprehensive testing guide

---

**Registry Generated:** 2025-12-28  
**Status:** Active  
**Last Audit:** 2025-12-28

