# Testing Strategy & Architecture

**Version:** 3.0.0  
**Date:** 2025-12-28  
**Status:** Approved Standard  
**Purpose:** Define testing philosophy, patterns, and anti-patterns to prevent coverage gaming and maintenance debt

---

## I. The Core Philosophy

**"Push tests down the pyramid."**

We do not test business logic through the UI. If a button has 10 different error states, we write:
- **1 E2E Test:** To verify the button is clickable and wires up to the backend.
- **10 Unit Tests:** To verify the logic handles every error state (400, 401, 500, etc.).

### The Golden Rules

1. **Don't Mock What You Don't Own:** Only mock *your* interfaces, not external libraries (unless necessary for speed).
2. **Test Behavior, Not Implementation:** Test "User gets error message," not "function called internal method X."
3. **No Logic in Tests:** If your test has complex `if/else` logic, who tests the test?
4. **One Concept per Test:** A test should fail for exactly one reason.
5. **DAMP Over DRY in Tests:** Descriptive And Meaningful Phrases. Readability > Reusability in test code.

---

## II. The Testing Pyramid

### Target Distribution

```
        /\
       /  \     E2E Tests (10%)
      /    \    - Full user journeys
     /______\   - Critical paths only
    /        \  
   /          \  Browser Tests (10%)
  /            \ - Component rendering
 /              \ - HTMX interactions
/________________\ 
Integration (20%) - API/DB integration
\________________/
 \              /  
  \            /   Unit Tests (70%)
   \          /    - Pure logic
    \________/     - Fast, isolated
```

**Speed Targets:**
- **Unit:** <1ms per test
- **Integration:** ~100ms per test
- **Browser:** ~100ms per test
- **E2E:** >1s per test

---

## III. Directory Structure (Centralized)

We utilize a **Centralized** structure to keep the `src/` directory clean for deployment.

```text
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

## IV. DRY vs DAMP in Tests

### The Critical Distinction

**In Production Code:** DRY (Don't Repeat Yourself) is essential.  
**In Test Code:** DAMP (Descriptive And Meaningful Phrases) is preferred.

### When DRY is "Bad" in Tests

#### 1. The "Setup Wall" Pattern ❌

**Detection:** The exact same 15 lines of database seeding in 5 different files.

**Example:**
```javascript
// ❌ BAD: Repeated in 5 files
beforeEach(async () => {
  testVendor = await createTestVendor(supabase);
  testUser = await createTestUser(supabase, { vendor_id: testVendor.id });
  testCase = await createTestCase(supabase, { vendor_id: testVendor.id });
  // ... 10 more lines
});
```

**Solution:** ✅ Move to `tests/setup/test-helpers.js` as a reusable function.

#### 2. The "Fixture Clone" Pattern ❌

**Detection:** Large mock objects appearing verbatim in multiple files.

**Example:**
```javascript
// ❌ BAD: Repeated in 20 files
const mockUser = {
  id: '123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin',
  vendor_id: '456',
  // ... 15 more fields
};
```

**Solution:** ✅ Centralize in `tests/fixtures/data/users.json` or `tests/fixtures/mocks/users.js`.

#### 3. The "Logic in Tests" Pattern ❌

**Detection:** Custom helper functions defined inside test files.

**Example:**
```javascript
// ❌ BAD: Logic duplicated in 3 files
function generateTestToken(user) {
  return jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1h' });
}
```

**Solution:** ✅ Move to `tests/setup/test-helpers.js`.

#### 4. The "Assertion Block" Pattern ⚠️

**Detection:** Repeated blocks of `expect` statements.

**Example:**
```javascript
// ⚠️ BORDERLINE: Verbose but readable
expect(res.status).toBe(400);
expect(res.body).toHaveProperty('error');
expect(res.body.error).toHaveProperty('code');
```

**Verdict:** Usually **allow** this unless it's 10+ lines. If it is, create a custom matcher:
```javascript
// ✅ GOOD: Custom matcher for complex assertions
expectError(res, 400, 'VALIDATION_ERROR');
```

### When DRY is "Good" in Tests

✅ **Setup Functions:** `createTestUser()`, `createTestVendor()` in `tests/setup/test-helpers.js`  
✅ **Fixtures:** Static data in `tests/fixtures/data/`  
✅ **Custom Matchers:** Reusable assertion helpers  
✅ **Test Utilities:** Pure functions for test data generation

---

## V. Implementation Patterns (The "Anti-Gaming" Guide)

### 1. The Parameterized Pattern (For High Coverage)

Instead of copying a test 10 times for different inputs, use `test.each`.

**❌ Bad (Repeated):**
```javascript
it('handles 400 error', () => { 
  const result = handleResponse(400);
  expect(result).toBe('Bad Request');
});

it('handles 401 error', () => { 
  const result = handleResponse(401);
  expect(result).toBe('Unauthorized');
});

// ... 8 more identical tests
```

**✅ Good (Parameterized):**
```javascript
const errorCases = [
  { status: 400, expected: 'Bad Request', code: 'BAD_REQUEST' },
  { status: 401, expected: 'Unauthorized', code: 'UNAUTHORIZED' },
  { status: 403, expected: 'Forbidden', code: 'FORBIDDEN' },
  { status: 404, expected: 'Not Found', code: 'NOT_FOUND' },
  { status: 500, expected: 'Server Error', code: 'SERVER_ERROR' },
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

**Result:** 1 test block, 100% logic coverage, 0 duplication.

### 2. The Fixture Pattern (For DRY Data)

Do not define large mock objects inside test files.

**❌ Bad:**
```javascript
// Repeated in 20 files
const user = {
  id: '123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin',
  vendor_id: '456',
  tenant_id: '789',
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  // ... 10 more fields
};
```

**✅ Good:**
```javascript
// tests/fixtures/data/users.js
export const standardUser = {
  id: '123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin',
  vendor_id: '456',
  tenant_id: '789',
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  // ... all fields
};

// In test file
import { standardUser } from '@tests/fixtures/data/users';
const user = { ...standardUser, role: 'guest' }; // Override only what matters
```

### 3. The "Humble Object" Pattern (For UI)

Move logic *out* of the UI component and into a pure JS/TS file.

**Structure:**
```
src/
├── components/
│   └── Button.js          # Only handles rendering
└── utils/
    └── button-logic.js     # Pure logic (testable)
```

**Testing:**
- **Component:** Test via Browser/E2E (just once) - "Does button render?"
- **Logic:** Test via Unit (exhaustively) - "Does logic handle all error states?"

### 4. Coverage Exclusion Configuration

Tell the coverage tool what **NOT** to count. Be aggressive here.

**In `vitest.config.js`:**
```javascript
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov', 'html'],
    include: ['server.js', 'src/**/*.js'],
    exclude: [
      // 1. Don't count configuration files
      '**/*.config.js',
      '**/.eslintrc.js',
      '**/vitest.config.js',
      
      // 2. Don't count pure UI wrappers (hard to test, low value)
      'src/ui/icons/**',
      'src/views/**', // Nunjucks templates
      
      // 3. Don't count test helpers
      'tests/**',
      '**/*.test.js',
      '**/*.spec.js',
      
      // 4. Don't count type definitions
      'types/**',
      '**/*.d.ts',
    ],
    thresholds: {
      lines: 85,
      functions: 85,
      branches: 85,
      statements: 85,
    },
  },
}
```

**Why:** If you include config files or test helpers in your denominator, you are forced to write useless tests just to "cover" them.

---

## VI. Negotiating Coverage Requirements

### The "95% Coverage" Problem

When DevOps demands 95%, you negotiate **"Critical Path Coverage"** instead of **"Global Line Coverage."**

**The Argument:**

> "I can give you 95% coverage by writing 10 redundant E2E tests. But if the button moves, maintenance time increases by 10x.
>
> **Proposal:** I will guarantee:
> - **100% coverage** on **Business Logic** files (services, utils, calculations)
> - **100% coverage** on **Critical User Journeys** (Checkout, Login, SOA Reconciliation)
> - **80% coverage** on boilerplate UI code (templates, static components)
> - **0% coverage** on configuration files (vitest.config.js, etc.)"

### Coverage Targets by File Type

| File Type | Target Coverage | Rationale |
|-----------|----------------|-----------|
| **Business Logic** (`src/utils/`, `src/adapters/`) | 100% | Core functionality, high risk |
| **API Routes** (`src/routes/`) | 95% | Critical paths, error handling |
| **UI Components** (`src/views/`) | 80% | Low risk, hard to test |
| **Configuration** (`*.config.js`) | 0% | Not testable, low value |
| **Test Helpers** (`tests/**`) | 0% | Meta-code, not production |

---

## VII. Current Codebase Analysis

### ✅ Good Practices Already in Place

1. **Centralized Helpers:** `tests/setup/test-helpers.js` contains reusable setup functions
2. **Path Aliases:** `@/`, `@tests/`, `@server` configured and working
3. **Clear Separation:** Unit, Integration, Browser, E2E tests clearly separated
4. **Fixture Structure:** `tests/fixtures/` directory exists and ready

### ⚠️ Opportunities for Improvement

1. **No Parameterized Tests:** Zero `test.each` usage found - opportunity to reduce duplication
2. **Fixture Clone Pattern:** 22 instances of `mockUser`/`testUser` creation across 18 files
3. **Setup Wall Pattern:** Similar `beforeEach` blocks in multiple integration test files
4. **Missing Fixtures:** No JSON fixtures in `tests/fixtures/data/` yet

### 📋 Recommended Refactoring Priorities

#### Priority 1: Create Standard Fixtures
- [ ] Create `tests/fixtures/data/users.js` with standard user objects
- [ ] Create `tests/fixtures/data/cases.js` with standard case objects
- [ ] Create `tests/fixtures/data/vendors.js` with standard vendor objects

#### Priority 2: Refactor Setup Walls
- [ ] Extract common `beforeEach` patterns to `tests/setup/test-helpers.js`
- [ ] Create `setupSOATestData()` helper for SOA-related tests
- [ ] Create `setupServerTestData()` helper for server route tests

#### Priority 3: Introduce Parameterized Tests
- [ ] Identify error handling tests that repeat the same pattern
- [ ] Convert to `test.each` for status code testing (400, 401, 403, 404, 500)
- [ ] Convert validation tests to parameterized format

#### Priority 4: Extract Custom Matchers
- [ ] Create `expectError(res, status, code)` matcher
- [ ] Create `expectSuccess(res, data)` matcher
- [ ] Create `expectValidationError(res, field)` matcher

---

## VIII. Migration Checklist

### Phase 0: The Safety Net (Do this FIRST)

- [x] Configure Path Aliases (`@/*` pointing to `src/*`) in `jsconfig.json` ✅
- [x] Update `vitest.config.js` to resolve aliases ✅
- [x] Ensure all current tests pass before moving a single file ✅

### Phase 1: Physical Move (Complete)

- [x] Create directory tree (`tests/unit`, `tests/integration`, etc.) ✅
- [x] Move files to correct locations ✅
- [x] Update all imports to use path aliases ✅

### Phase 2: Refactoring (In Progress)

- [ ] Create standard fixtures in `tests/fixtures/data/`
- [ ] Extract common setup patterns to helpers
- [ ] Convert repeated tests to parameterized format
- [ ] Create custom matchers for common assertions

### Phase 3: Coverage Optimization

- [ ] Update `vitest.config.js` with aggressive exclusions
- [ ] Negotiate "Critical Path Coverage" with DevOps
- [ ] Identify and refactor "coverage gaming" tests
- [ ] Document coverage targets by file type

---

## IX. Best Practices Summary

| Feature | ❌ Old Way (Coverage Gaming) | ✅ Best Practice Way |
|---------|------------------------------|---------------------|
| **Logic** | Embedded in UI/Component | Extracted to `utils/` or `services/` |
| **Testing** | Click button 10 times via E2E | **1 E2E** (Happy Path) + **10 Unit** (Logic) |
| **Data** | Hardcoded in each test | **Parameterized** (`test.each`) or **Fixtures** |
| **Metric** | "Did we hit 95% lines?" | "Did we cover all **Edge Cases**?" |
| **Mocking** | Real REST calls (Slow/Flaky) | **Mocked Service** responses (Fast) |
| **Setup** | Repeated in every file | **Centralized helpers** in `tests/setup/` |
| **Fixtures** | Cloned in 20 files | **Centralized** in `tests/fixtures/data/` |

---

## X. Anti-Patterns to Avoid

### ❌ Coverage Gaming

Writing redundant tests just to hit a coverage number.

**Example:**
```javascript
// ❌ BAD: 10 E2E tests clicking the same button
test('button handles error 400', async () => { /* click button */ });
test('button handles error 401', async () => { /* click button */ });
// ... 8 more identical tests
```

**Solution:** Extract logic, test once in unit tests, test UI once in E2E.

### ❌ Mystery Guest

Tests where you can't tell what data is being used because it's buried in 5 layers of helpers.

**Example:**
```javascript
// ❌ BAD: What user? What vendor? What case?
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
} else {
  expect(result).toBe('guest');
}
```

**Solution:** Use parameterized tests or separate test cases.

---

## XI. Next Steps

1. **Create Standard Fixtures:** Start with `tests/fixtures/data/users.js`
2. **Refactor Setup Walls:** Extract common patterns to helpers
3. **Introduce Parameterized Tests:** Convert error handling tests
4. **Update Coverage Config:** Add aggressive exclusions
5. **Document Coverage Targets:** Define per-file-type targets

---

**Status:** ✅ **Strategy Approved**  
**Last Updated:** 2025-12-28  
**Version:** 3.0.0

