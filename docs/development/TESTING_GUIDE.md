# Testing Guide

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Production Ready

---

## 📋 Overview

This guide covers comprehensive testing setup for VMP using Vitest (unit/integration) and Playwright (E2E).

**Test Coverage Target:** 95% (as per project requirements)

---

## 🚀 Quick Start

### Run All Tests
```bash
# Unit + Integration tests
npm run test

# E2E tests
npm run test:e2e

# All tests with coverage
npm run test:all
```

### Run Specific Test Suites
```bash
# Component tests
npm run test:components

# Adapter tests
npm run test:adapters

# Utility tests
npm run test:utils

# Server route tests
npm run test:server

# SOA reconciliation E2E
npm run test:e2e:soa
```

### Watch Mode
```bash
# Watch unit tests
npm run test:watch

# Watch with UI
npm run test:ui

# Watch E2E tests
npm run test:e2e:ui
```

---

## 🧪 Test Structure

```
tests/
├── setup/
│   └── test-helpers.js          # Shared test utilities
├── components/
│   └── soa-recon.test.js        # SOA reconciliation component tests
├── adapters/
│   ├── supabase.test.js         # Supabase adapter tests
│   └── supabase-error-simulation.test.js
├── utils/
│   ├── errors.test.js
│   ├── route-helpers.test.js
│   └── checklist-rules.test.js
├── e2e/
│   ├── soa-recon-workflow.spec.js  # SOA E2E tests
│   ├── button-link-navigation.spec.js
│   └── mobile-ux-improvements.spec.js
└── COVERAGE_PLAN.md             # Coverage tracking
```

---

## 📊 Test Types

### Unit Tests (Vitest)
- **Location:** `tests/**/*.test.js`
- **Purpose:** Test individual functions and components
- **Target Coverage:** 95%
- **Run:** `npm run test`

**Example:**
```javascript
import { describe, it, expect } from 'vitest';

describe('SOA Items', () => {
  it('should create SOA item', async () => {
    // Test implementation
  });
});
```

### Integration Tests (Vitest)
- **Location:** `tests/**/*.test.js`
- **Purpose:** Test workflows within components
- **Target Coverage:** 90%
- **Run:** `npm run test`

**Example:**
```javascript
describe('SOA Reconciliation Workflow', () => {
  it('should match SOA line to invoice', async () => {
    // Create SOA item
    // Create invoice
    // Run matching
    // Verify match
  });
});
```

### E2E Tests (Playwright)
- **Location:** `tests/e2e/**/*.spec.js`
- **Purpose:** Test complete user workflows
- **Target Coverage:** 100% (critical paths)
- **Run:** `npm run test:e2e`

**Example:**
```javascript
import { test, expect } from '@playwright/test';

test('should navigate to SOA workspace', async ({ page }) => {
  await page.goto('/soa/recon/test-case-id');
  await expect(page.locator('h2:has-text("Statement Workspace")')).toBeVisible();
});
```

---

## 🛠️ Test Helpers

### `createTestSupabaseClient()`
Creates a Supabase client for testing.

```javascript
import { createTestSupabaseClient } from '../setup/test-helpers.js';

const supabase = createTestSupabaseClient();
```

### `createTestUser()`
Creates a test user.

```javascript
const user = await createTestUser(supabase, {
  email: 'test@example.com',
  vendor_id: vendorId
});
```

### `createTestVendor()`
Creates a test vendor.

```javascript
const vendor = await createTestVendor(supabase, {
  name: 'Test Vendor',
  tenant_id: tenantId
});
```

### `createTestCase()`
Creates a test case.

```javascript
const testCase = await createTestCase(supabase, {
  case_type: 'soa',
  vendor_id: vendorId
});
```

### `cleanupTestData()`
Cleans up test data.

```javascript
await cleanupTestData(supabase, 'vmp_soa_items', { case_id: testCase.id });
```

---

## 📈 Coverage Reports

### Generate Coverage Report
```bash
npm run test:coverage
```

### View Coverage Report
```bash
# HTML report (opens in browser)
open coverage/index.html
```

### Coverage Thresholds
- **Lines:** 85%
- **Functions:** 85%
- **Branches:** 85%
- **Statements:** 85%

---

## 🎯 Test Writing Guidelines

### Unit Tests
1. **One assertion per test** (when possible)
2. **Test edge cases** (null, undefined, empty, invalid)
3. **Test error paths** (validation failures, database errors)
4. **Mock external dependencies** (Supabase, file system)
5. **Use descriptive test names** (should do X when Y)

### Integration Tests
1. **Test complete workflows** (not just individual functions)
2. **Use real database** (with test data cleanup)
3. **Test error recovery** (rollback, retry logic)
4. **Test concurrent operations** (race conditions)

### E2E Tests
1. **Test user-visible workflows** (what user sees and does)
2. **Test HTMX interactions** (dynamic updates)
3. **Test responsive design** (mobile, tablet, desktop)
4. **Test accessibility** (keyboard navigation, screen readers)

---

## 🔧 Configuration

### Vitest Config (`vitest.config.js`)
- **Environment:** Node.js (default), Browser (with `--browser` flag)
- **Coverage:** v8 provider
- **Timeout:** 30 seconds
- **Globals:** Enabled (Jest-compatible)

### Playwright Config (`playwright.config.js`)
- **Base URL:** `http://localhost:9000`
- **Browsers:** Chromium, Mobile Chrome, Mobile Safari, Tablet
- **Retries:** 2 (CI), 0 (local)
- **Web Server:** Auto-starts dev server

---

## 🐛 Troubleshooting

### Tests Fail with Database Errors
- **Solution:** Ensure test database is set up
- **Check:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`

### E2E Tests Fail to Start
- **Solution:** Ensure dev server is running or use `webServer` config
- **Check:** `npm run dev` starts successfully

### Coverage Report Not Generated
- **Solution:** Install coverage provider: `npm install --save-dev @vitest/coverage-v8`
- **Check:** `vitest.config.js` has coverage configuration

### Tests Timeout
- **Solution:** Increase timeout in `vitest.config.js` or individual tests
- **Check:** Network operations and large data operations

---

## 📚 Related Documentation

- `tests/COVERAGE_PLAN.md` - Detailed coverage plan
- `vitest.config.js` - Vitest configuration
- `playwright.config.js` - Playwright configuration
- `tests/setup/test-helpers.js` - Test utilities

---

## ✅ Test Checklist

### Before Committing
- [ ] All unit tests pass (`npm run test`)
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] Coverage meets threshold (85%)
- [ ] No linter errors (`npm run lint`)
- [ ] Code formatted (`npm run format:check`)

### Before Production
- [ ] 95% unit test coverage achieved
- [ ] 100% critical path E2E coverage
- [ ] Performance tests pass
- [ ] Security tests pass
- [ ] Accessibility tests pass

---

**Document Status:** ✅ Production Ready  
**Last Updated:** 2025-01-22

