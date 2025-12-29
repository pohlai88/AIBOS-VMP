# Test Standards & Rules

**Version:** 1.0.0  
**Last Updated:** 2025-12-28  
**Purpose:** Establish clear rules and standards for test organization, naming, and maintenance  
**Status:** Active

---

## 📋 Table of Contents

1. [Test Structure](#test-structure)
2. [File Organization Rules](#file-organization-rules)
3. [Naming Conventions](#naming-conventions)
4. [Content Standards](#content-standards)
5. [Maintenance Rules](#maintenance-rules)
6. [AI Assistant Guidelines](#ai-assistant-guidelines)

---

## 📁 Test Structure

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
│   ├── workflows/              # Complete user journeys
│   ├── features/                # Feature-specific E2E tests
│   └── smoke/                  # Critical path checks for deployment
│
├── setup/                      # Global configuration
│   └── test-helpers.js         # Shared reusable logic
│
├── helpers/                    # Test-specific helpers
│   └── auth-helper.js          # Authentication test utilities
│
└── fixtures/                   # Static Data
    ├── data/                   # JSON fixtures (users, cases, etc.)
    └── mocks/                  # Mock objects and responses
```

### Directory Purposes

#### `tests/unit/`
- Pure logic tests with mocked dependencies
- Fast execution (<1ms per test)
- No database or API calls
- Test functions, utilities, component logic

#### `tests/integration/`
- Real database and API connections
- Medium execution time (~100ms per test)
- Test adapters, routes, RLS policies
- Test security boundaries

#### `tests/browser/`
- Virtual DOM/Browser rendering tests
- Medium execution time (~100ms per test)
- Test component rendering, HTMX interactions
- Use Vitest Browser mode

#### `tests/e2e/`
- Full environment tests with real browser
- Slow execution (>1s per test)
- Complete user journeys
- Critical path verification

#### `tests/setup/`
- Global test configuration
- Shared test utilities
- Setup and cleanup helpers

#### `tests/helpers/`
- Test-specific helper functions
- Authentication utilities
- Test data creation helpers

#### `tests/fixtures/`
- Static test data
- Reusable mock objects
- Standard test payloads

---

## 📝 File Organization Rules

### Rule 1: Test Type First
- Tests are organized by **test type** (unit, integration, browser, e2e)
- Then by **category** (adapters, server, utils, etc.)
- This keeps the `src/` directory clean for deployment

### Rule 2: Single Test File Per Feature
- Each feature/module has ONE test file
- Group related tests in `describe` blocks
- Use `test.each` for parameterized tests

### Rule 3: No Tests in Source
- **FORBIDDEN:** Test files in `src/` directory
- **REQUIRED:** All tests in `tests/` directory
- Keep source code clean for deployment

### Rule 4: Helper Organization
- **Global helpers:** `tests/setup/test-helpers.js`
- **Test-specific helpers:** `tests/helpers/[category]-helper.js`
- **Fixtures:** `tests/fixtures/data/[type].js`

---

## 🏷️ Naming Conventions

### Test File Names

#### Unit & Integration Tests
**Format:** `[feature-or-module].test.js`

**Rules:**
- **MUST** use `kebab-case` (lowercase with hyphens)
- **MUST** end with `.test.js`
- **MUST** be descriptive (not generic)
- **FORBIDDEN:** camelCase, PascalCase, snake_case, spaces

**Examples:**
- ✅ `soa-adapter.test.js`
- ✅ `server-routes.test.js`
- ✅ `route-helpers.test.js`
- ❌ `soaAdapter.test.js` (camelCase)
- ❌ `server_routes.test.js` (snake_case)
- ❌ `ServerRoutes.test.js` (PascalCase)
- ❌ `server routes.test.js` (spaces)

#### Browser Tests
**Format:** `[feature-or-module].browser.test.js`

**Rules:**
- **MUST** include `.browser` before `.test.js`
- **MUST** use `kebab-case`
- **MUST** be descriptive

**Examples:**
- ✅ `mobile-ux-improvements.browser.test.js`
- ✅ `icon-accessibility.browser.test.js`
- ❌ `mobile-ux.test.js` (missing `.browser`)
- ❌ `mobileUX.browser.test.js` (camelCase)

#### E2E Tests
**Format:** `[feature-or-workflow].spec.js`

**Rules:**
- **MUST** end with `.spec.js` (not `.test.js`)
- **MUST** use `kebab-case`
- **MUST** be descriptive

**Examples:**
- ✅ `soa-recon-workflow.spec.js`
- ✅ `button-link-navigation.spec.js`
- ❌ `soa-recon.test.js` (wrong extension)
- ❌ `soaRecon.spec.js` (camelCase)

### Directory Names

**Format:** `kebab-case` (lowercase with hyphens)

**Rules:**
- **MUST** use lowercase
- **MUST** use hyphens for word separation
- **MUST** keep names short and clear
- **FORBIDDEN:** PascalCase, snake_case, spaces

**Examples:**
- ✅ `edge-cases/`
- ✅ `test-helpers/`
- ❌ `EdgeCases/` (PascalCase)
- ❌ `edge_cases/` (snake_case)
- ❌ `Edge Cases/` (spaces)

---

## 📄 Content Standards

### Test File Structure

Every test file must follow this structure:

```javascript
/**
 * [Brief description of what this test file covers]
 * 
 * Test Type: [unit|integration|browser|e2e]
 * Dependencies: [list key dependencies]
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// ... other imports

describe('[Feature/Module Name]', () => {
  // Setup
  beforeEach(() => {
    // Test setup
  });

  // Cleanup
  afterEach(() => {
    // Test cleanup
  });

  // Tests
  describe('[Sub-feature]', () => {
    it('should [expected behavior]', () => {
      // Test implementation
    });
  });
});
```

### Test Naming

**Format:** `should [expected behavior]`

**Rules:**
- **MUST** start with `should`
- **MUST** describe expected behavior (not implementation)
- **MUST** be clear and specific
- **FORBIDDEN:** Generic names like "works", "test", "check"

**Examples:**
- ✅ `should return error when user is not authenticated`
- ✅ `should create SOA match with valid data`
- ✅ `should render button with correct text`
- ❌ `works` (too generic)
- ❌ `test create match` (not descriptive)
- ❌ `check error` (not clear)

### Path Aliases

**REQUIRED:** Use path aliases instead of relative imports

**Aliases:**
- `@/` → `src/`
- `@tests/` → `tests/`
- `@server` → `server.js`

**Examples:**
- ✅ `import { vmpAdapter } from '@/adapters/supabase.js';`
- ✅ `import { setupSOATestData } from '@tests/setup/test-helpers.js';`
- ✅ `import app from '@server';`
- ❌ `import { vmpAdapter } from '../../src/adapters/supabase.js';` (relative import)
- ❌ `import { setupSOATestData } from '../setup/test-helpers.js';` (relative import)

### Fixtures & Helpers

**REQUIRED:** Use fixtures and setup helpers

**Fixtures:**
```javascript
import { standardUser, adminUser } from '@tests/fixtures/data/users.js';
import { standardVendor } from '@tests/fixtures/data/vendors.js';
```

**Setup Helpers:**
```javascript
import { setupSOATestData, cleanupSOATestData } from '@tests/setup/test-helpers.js';

beforeEach(async () => {
  testData = await setupSOATestData(supabase);
});

afterEach(async () => {
  await cleanupSOATestData(supabase, testData);
});
```

---

## 🔄 Maintenance Rules

### Rule 1: Regular Cleanup
- Review test files quarterly
- Remove obsolete tests
- Update fixtures when schemas change
- Keep test registry current

### Rule 2: Test Registry
- **ALL** test files **MUST** be registered in `TEST_REGISTRY.md`
- **ALL** new tests **MUST** be added to registry
- Registry **MUST** be kept current

### Rule 3: DRY vs DAMP
- **DAMP (Descriptive And Meaningful Phrases)** in test code
- Use fixtures for data (DRY-approved)
- Use setup helpers for common setup (DRY-approved)
- **DON'T** over-abstract test logic (readability > reusability)

### Rule 4: Test Coverage
- Focus on **critical path coverage**, not line coverage
- Test business logic, not boilerplate
- Use parameterized tests for multiple scenarios
- Exclude config files and test helpers from coverage

---

## 🤖 AI Assistant Guidelines

### When Creating Tests

1. **Check existing tests first**
   - Search for similar tests
   - Avoid creating duplicates
   - Update existing tests instead of creating new ones

2. **Follow structure rules**
   - Place in correct `tests/` subdirectory
   - Use correct naming conventions
   - Include proper structure and metadata

3. **Use fixtures and helpers**
   - Import from `@tests/fixtures/data/`
   - Use `setupSOATestData()`, `setupServerTestData()`
   - Use `cleanupSOATestData()`, `cleanupServerTestData()`

4. **Use path aliases**
   - `@/` for `src/` imports
   - `@tests/` for `tests/` imports
   - `@server` for `server.js`

5. **Register in TEST_REGISTRY.md**
   - Add entry to appropriate section
   - Include purpose, dependencies, status

### When Organizing Tests

1. **Categorize correctly**
   - Unit tests → `tests/unit/[category]/`
   - Integration tests → `tests/integration/[category]/`
   - Browser tests → `tests/browser/`
   - E2E tests → `tests/e2e/[category]/`

2. **Follow naming conventions**
   - Unit/Integration: `[feature].test.js`
   - Browser: `[feature].browser.test.js`
   - E2E: `[feature].spec.js`

3. **Use kebab-case**
   - File names: `kebab-case`
   - Directory names: `kebab-case`

### When Updating Tests

1. **Update metadata**
   - Update "Last Updated" in registry
   - Update test descriptions if behavior changes

2. **Maintain fixtures**
   - Update fixtures when schemas change
   - Keep fixtures in sync with actual data

3. **Keep registry current**
   - Update registry when adding/removing tests
   - Update dependencies if they change

---

## ✅ Test Checklist

Before committing test changes:

- [ ] Test file is in correct `tests/` subdirectory
- [ ] Test file name follows naming convention
- [ ] Test uses path aliases (not relative imports)
- [ ] Test uses fixtures and setup helpers
- [ ] Test is registered in `TEST_REGISTRY.md`
- [ ] Test follows structure standards
- [ ] Test names are descriptive (`should [behavior]`)
- [ ] Test has proper setup and cleanup
- [ ] Test uses appropriate test type (unit/integration/browser/e2e)
- [ ] Test follows DRY vs DAMP principles

---

## 🚫 Anti-Patterns (What NOT to Do)

1. **Don't create tests in src/**
   - ❌ `src/components/Button.test.js`
   - ✅ `tests/unit/components/button.test.js`

2. **Don't use relative imports**
   - ❌ `import { adapter } from '../../src/adapters/supabase.js';`
   - ✅ `import { adapter } from '@/adapters/supabase.js';`

3. **Don't duplicate test data**
   - ❌ Large mock objects in every test file
   - ✅ Use fixtures from `@tests/fixtures/data/`

4. **Don't use generic test names**
   - ❌ `it('works', () => { ... });`
   - ✅ `it('should return error when user is not authenticated', () => { ... });`

5. **Don't skip cleanup**
   - ❌ Tests that leave data in database
   - ✅ Always cleanup in `afterEach`

6. **Don't test implementation details**
   - ❌ `expect(mockFunction).toHaveBeenCalledWith(...)`
   - ✅ `expect(result).toEqual(expected)`

---

## 📚 Quick Reference

### Where to Put Tests

| Test Type | Location | Example |
|-----------|----------|---------|
| Unit | `tests/unit/[category]/` | `tests/unit/utils/route-helpers.test.js` |
| Integration | `tests/integration/[category]/` | `tests/integration/adapters/soa-adapter.test.js` |
| Browser | `tests/browser/` | `tests/browser/mobile-ux-improvements.browser.test.js` |
| E2E | `tests/e2e/[category]/` | `tests/e2e/workflows/soa-recon-workflow.spec.js` |

### File Naming Examples

| Purpose | Good Name | Bad Name |
|---------|-----------|----------|
| Unit Test | `soa-adapter.test.js` | `soaAdapter.test.js` |
| Browser Test | `mobile-ux.browser.test.js` | `mobileUX.test.js` |
| E2E Test | `soa-workflow.spec.js` | `soa-workflow.test.js` |

### Path Alias Examples

| Import Type | Good | Bad |
|-------------|------|-----|
| Source Code | `@/adapters/supabase.js` | `../../src/adapters/supabase.js` |
| Test Helper | `@tests/setup/test-helpers.js` | `../setup/test-helpers.js` |
| Server | `@server` | `../../server.js` |

---

## 🔗 Related Documentation

- [Test Registry](TEST_REGISTRY.md) - Complete test file inventory
- [Testing Strategy](../../docs/architecture/TESTING_STRATEGY.md) - Testing philosophy
- [Testing Guide V3](../../docs/development/guides/TESTING_GUIDE_V3.md) - Comprehensive testing guide
- [Documentation Standards](../../docs/DOCUMENTATION_STANDARDS.md) - Documentation standards

---

**Remember:** Well-organized, standardized tests are easier to maintain, find, and use. Follow these standards to keep the test suite professional and accessible.

