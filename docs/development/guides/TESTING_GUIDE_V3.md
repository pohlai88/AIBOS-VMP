# Testing Guide

**Version:** 3.0.0  
**Date:** 2025-12-28  
**Status:** Production Ready  
**Based on:** Testing Strategy & Architecture v3.0.0

---

## 📋 Overview

This guide provides comprehensive testing practices for the VMP project, following the **"Push tests down the pyramid"** philosophy. It emphasizes **DAMP over DRY** in tests, prevents coverage gaming, and promotes maintainable test code.

**Key Principles:**
- 70% Unit Tests (fast, isolated)
- 20% Integration Tests (DB/API)
- 10% Browser + E2E Tests (UI/workflows)

---

## 🚀 Quick Start

### Run All Tests
```bash
# Unit + Integration tests
npm run test

# Unit tests only (fast)
npm run test:unit

# Integration tests only
npm run test:integration

# Browser tests
npm run test:browser

# E2E tests
npm run test:e2e

# All tests with coverage
npm run test:coverage
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

## 🏗️ Test Structure

### Directory Organization

```
tests/
├── unit/                       # ⚡ FAST (<1ms) - Mocked dependencies
│   ├── adapters/               # Test adapter logic (data transformation)
│   ├── utils/                  # Test helpers/utilities (pure functions)
│   ├── components/             # Test component logic (no DOM required)
│   └── server/                 # Test server utilities (filters, middleware)
│
├── integration/                # 🐢 MEDIUM (~100ms) - Real DB/API
│   ├── adapters/               # Test actual DB queries/connections
│   ├── server/                 # Test API routes (Supertest)
│   ├── rls/                    # Test Row Level Security policies
│   ├── security/               # Test security boundaries
│   └── edge-cases/             # Regression tests for specific bugs
│
├── browser/                    # 🐢 MEDIUM - Virtual DOM/Browser
│   └── *.browser.test.js       # Test rendering & interactions (Vitest Browser)
│
├── e2e/                        # 🐌 SLOW (>1s) - Full Environment
│   ├── workflows/              # Complete user journeys (Login -> Action -> Success)
│   ├── features/               # Feature-specific E2E tests
│   └── smoke/                  # Critical path checks for deployment
│
├── setup/                      # Global configuration
│   └── test-helpers.js         # Shared reusable logic (DRY-approved)
│
├── helpers/                    # Test-specific helpers
│   └── auth-helper.js          # Authentication test utilities
│
└── fixtures/                   # Static Data (DRY-approved)
    ├── data/                   # JSON fixtures (users, cases, etc.)
    └── mocks/                  # Mock objects and responses
```

---

## 📊 Test Types & Guidelines

### Unit Tests (70% of tests)

**Location:** `tests/unit/**/*.test.js`  
**Speed Target:** <1ms per test  
**Purpose:** Test isolated functions and pure logic  
**Coverage Target:** 100% on business logic

**Characteristics:**
- No database calls
- No API calls
- No file system operations
- Pure function testing
- Fast execution

**Example:**
```javascript
import { describe, test, expect } from 'vitest';
import { handleResponse } from '@/utils/errors.js';

describe('Error Handling', () => {
  test('should handle 400 error correctly', () => {
    const result = handleResponse(400);
    expect(result.message).toBe('Bad Request');
    expect(result.code).toBe('BAD_REQUEST');
  });
});
```

### Integration Tests (20% of tests)

**Location:** `tests/integration/**/*.test.js`  
**Speed Target:** ~100ms per test  
**Purpose:** Test multiple components working together  
**Coverage Target:** 95% on API routes

**Characteristics:**
- Real database calls
- Real API calls
- Multiple components
- Real dependencies

**Example:**
```javascript
import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '@server';
import { createTestSession } from '@tests/helpers/auth-helper.js';

describe('API Routes', () => {
  let authHeaders;

  beforeEach(async () => {
    const session = await createTestSession(userId, vendorId);
    authHeaders = getTestAuthHeaders(session.userId, session.vendorId);
  });

  test('should return 200 for authenticated request', async () => {
    const res = await request(app)
      .get('/api/cases')
      .set(authHeaders);
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});
```

### Browser Tests (10% of tests)

**Location:** `tests/browser/**/*.browser.test.js`  
**Speed Target:** ~100ms per test  
**Purpose:** Test component rendering and HTMX interactions  
**Coverage Target:** 80% on UI components

**Characteristics:**
- Tests rendering/DOM
- Tests HTMX behavior
- Tests browser-specific features
- **Mocks backend** (fast)

**Example:**
```javascript
import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/dom';

describe('Button Component', () => {
  test('should render button correctly', () => {
    const button = render('<button class="vmp-button">Click Me</button>');
    expect(button).toBeVisible();
  });
});
```

### E2E Tests (10% of tests)

**Location:** `tests/e2e/**/*.spec.js`  
**Speed Target:** >1s per test  
**Purpose:** Test complete user workflows  
**Coverage Target:** 100% on critical paths

**Characteristics:**
- Full user workflows
- Real backend
- Real database
- Slow, comprehensive

**Example:**
```javascript
import { test, expect } from '@playwright/test';

test('should complete SOA reconciliation workflow', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'vendor@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  await page.goto('/soa/recon/test-case-id');
  await expect(page.locator('h2:has-text("Statement Workspace")')).toBeVisible();
});
```

---

## 🛠️ Test Helpers & Fixtures

### Using Test Helpers

**Location:** `tests/setup/test-helpers.js`

```javascript
import {
  createTestSupabaseClient,
  createTestUser,
  createTestVendor,
  createTestCase,
  createTestSOACase,
  cleanupTestData,
} from '@tests/setup/test-helpers.js';

// Create test client
const supabase = createTestSupabaseClient();

// Create test data
const vendor = await createTestVendor(supabase);
const user = await createTestUser(supabase, { vendor_id: vendor.id });
const testCase = await createTestCase(supabase, { vendor_id: vendor.id });

// Cleanup
await cleanupTestData(supabase, 'vmp_cases', { id: testCase.id });
```

### Using Fixtures

**Location:** `tests/fixtures/data/`

```javascript
// Import standard fixtures
import { standardUser, adminUser, vendorUser } from '@tests/fixtures/data/users';
import { standardCase, soaCase } from '@tests/fixtures/data/cases';

// Use with overrides
const user = { ...standardUser, role: 'guest' };
const case = { ...soaCase, status: 'closed' };
```

### Authentication Helpers

**Location:** `tests/helpers/auth-helper.js`

```javascript
import { createTestSession, getTestAuthHeaders } from '@tests/helpers/auth-helper.js';

// Create test session
const session = await createTestSession(userId, vendorId);

// Get auth headers for supertest
const headers = getTestAuthHeaders(session.userId, session.vendorId);
```

---

## 🎯 Best Practices

### 1. Use Parameterized Tests

**❌ Bad (Repeated):**
```javascript
test('handles 400 error', () => { /* ... */ });
test('handles 401 error', () => { /* ... */ });
test('handles 403 error', () => { /* ... */ });
```

**✅ Good (Parameterized):**
```javascript
const errorCases = [
  { status: 400, expected: 'Bad Request', code: 'BAD_REQUEST' },
  { status: 401, expected: 'Unauthorized', code: 'UNAUTHORIZED' },
  { status: 403, expected: 'Forbidden', code: 'FORBIDDEN' },
];

test.each(errorCases)(
  'handles $status response correctly',
  ({ status, expected, code }) => {
    const result = handleResponse(status);
    expect(result.message).toBe(expected);
    expect(result.code).toBe(code);
  }
);
```

### 2. Use Fixtures for Data

**❌ Bad (Cloned):**
```javascript
// Repeated in 20 files
const user = {
  id: '123',
  email: 'test@example.com',
  name: 'Test User',
  // ... 15 more fields
};
```

**✅ Good (Centralized):**
```javascript
import { standardUser } from '@tests/fixtures/data/users';
const user = { ...standardUser, role: 'guest' };
```

### 3. Extract Setup Patterns

**❌ Bad (Setup Wall):**
```javascript
// Repeated in 5 files
beforeEach(async () => {
  testVendor = await createTestVendor(supabase);
  testUser = await createTestUser(supabase, { vendor_id: testVendor.id });
  testCase = await createTestCase(supabase, { vendor_id: testVendor.id });
  // ... 10 more lines
});
```

**✅ Good (Helper Function):**
```javascript
import { setupSOATestData } from '@tests/setup/test-helpers.js';

beforeEach(async () => {
  const data = await setupSOATestData(supabase);
  testVendor = data.vendor;
  testUser = data.user;
  testCase = data.case;
});
```

### 4. Test Behavior, Not Implementation

**❌ Bad:**
```javascript
test('should call internal method X', () => {
  const spy = vi.spyOn(module, 'internalMethod');
  doSomething();
  expect(spy).toHaveBeenCalled();
});
```

**✅ Good:**
```javascript
test('should return error message when validation fails', () => {
  const result = validateInput(null);
  expect(result).toHaveProperty('error');
  expect(result.error.message).toBe('Input is required');
});
```

### 5. One Concept per Test

**❌ Bad:**
```javascript
test('should validate and save user', () => {
  // Tests validation AND saving
  const result = validateAndSave(user);
  expect(result.valid).toBe(true);
  expect(result.saved).toBe(true);
});
```

**✅ Good:**
```javascript
test('should validate user input', () => {
  const result = validateUser(user);
  expect(result.valid).toBe(true);
});

test('should save valid user', () => {
  const validUser = validateUser(user);
  const result = saveUser(validUser);
  expect(result.saved).toBe(true);
});
```

---

## 📈 Coverage Strategy

### Coverage Targets by File Type

| File Type | Target Coverage | Rationale |
|-----------|----------------|-----------|
| **Business Logic** (`src/utils/`, `src/adapters/`) | 100% | Core functionality, high risk |
| **API Routes** (`src/routes/`) | 95% | Critical paths, error handling |
| **UI Components** (`src/views/`) | 80% | Low risk, hard to test |
| **Configuration** (`*.config.js`) | 0% | Not testable, low value |
| **Test Helpers** (`tests/**`) | 0% | Meta-code, not production |

### Generate Coverage Report

```bash
npm run test:coverage
```

### Coverage Exclusions

The following are excluded from coverage:
- Configuration files (`*.config.js`)
- Test files (`tests/**`, `**/*.test.js`)
- Type definitions (`types/**`, `**/*.d.ts`)
- Nunjucks templates (`src/views/**`)

---

## 🚫 Anti-Patterns to Avoid

### ❌ Coverage Gaming

Writing redundant tests just to hit a coverage number.

**Example:**
```javascript
// ❌ BAD: 10 E2E tests clicking the same button
test('button handles error 400', async () => { /* click button */ });
test('button handles error 401', async () => { /* click button */ });
```

**Solution:** Extract logic, test once in unit tests, test UI once in E2E.

### ❌ Mystery Guest

Tests where you can't tell what data is being used.

**Example:**
```javascript
// ❌ BAD: What user? What vendor?
const result = await testHelper.runTest();
expect(result).toBeTruthy();
```

**Solution:** Make test data explicit and visible in the test.

### ❌ Test Logic

Complex `if/else` logic inside tests.

**Example:**
```javascript
// ❌ BAD: Who tests this logic?
if (user.role === 'admin') {
  expect(result).toBe('admin');
} else if (user.role === 'vendor') {
  expect(result).toBe('vendor');
}
```

**Solution:** Use parameterized tests or separate test cases.

---

## 🔧 Configuration

### Path Aliases

All tests use path aliases for clean imports:

```javascript
// ✅ Good: Using path aliases
import { vmpAdapter } from '@/adapters/supabase.js';
import { createTestSession } from '@tests/helpers/auth-helper.js';
import app from '@server';

// ❌ Bad: Relative imports
import { vmpAdapter } from '../../src/adapters/supabase.js';
```

**Configured Aliases:**
- `@/*` → `src/*`
- `@tests/*` → `tests/*`
- `@server` → `server.js`

### Vitest Config

**Location:** `vitest.config.js`

- **Environment:** Node.js (default), Browser (with `--browser` flag)
- **Coverage:** v8 provider
- **Timeout:** 30 seconds
- **Globals:** Enabled (Jest-compatible)

### Playwright Config

**Location:** `playwright.config.js`

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

### Path Aliases Not Resolving
- **Solution:** Verify `jsconfig.json` and `vitest.config.js` have alias configuration
- **Check:** Run `npm test tests/unit/path-check.test.js` to verify

---

## 📚 Related Documentation

- `docs/architecture/TESTING_STRATEGY.md` - Comprehensive testing strategy
- `docs/development/guides/TESTS_DIRECTORY_RESTRUCTURE_PROPOSAL.md` - Directory structure
- `docs/development/guides/TESTS_RESTRUCTURE_COMPLIANCE_REPORT.md` - Migration status
- `vitest.config.js` - Vitest configuration
- `playwright.config.js` - Playwright configuration
- `tests/setup/test-helpers.js` - Test utilities
- `tests/fixtures/data/` - Test fixtures

---

## ✅ Test Checklist

### Before Committing
- [ ] All unit tests pass (`npm run test:unit`)
- [ ] All integration tests pass (`npm run test:integration`)
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] Coverage meets threshold (85% overall, 100% business logic)
- [ ] No linter errors (`npm run lint`)
- [ ] Code formatted (`npm run format:check`)

### Before Production
- [ ] 100% business logic coverage achieved
- [ ] 95% API route coverage achieved
- [ ] 100% critical path E2E coverage
- [ ] Performance tests pass
- [ ] Security tests pass
- [ ] Accessibility tests pass

---

## 🎓 Learning Resources

### Key Concepts
- **Testing Pyramid:** 70% Unit, 20% Integration, 10% E2E
- **DAMP over DRY:** Descriptive And Meaningful Phrases in tests
- **Push Tests Down:** Test logic in unit tests, not E2E
- **Parameterized Tests:** Use `test.each` for multiple scenarios
- **Fixtures:** Centralize test data

### Anti-Patterns
- **Coverage Gaming:** Writing redundant tests for coverage
- **Mystery Guest:** Hidden test data in helpers
- **Test Logic:** Complex logic inside tests
- **Setup Wall:** Repeated setup code

---

**Document Status:** ✅ Production Ready  
**Last Updated:** 2025-12-28  
**Version:** 3.0.0  
**Based on:** Testing Strategy & Architecture v3.0.0

