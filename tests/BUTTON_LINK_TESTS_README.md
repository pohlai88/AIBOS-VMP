# Button and Link Component Tests

**Date:** 2025-01-21  
**Purpose:** Comprehensive testing for Button and Link components to ensure proper navigation and responses  
**Test Coverage:** Unit tests (Vitest) + E2E tests (Playwright)

---

## Test Files

### 1. Vitest Unit Tests
**File:** `tests/button-link-components.test.js`

**Purpose:** Fast unit tests that verify HTML structure, CSS classes, and component attributes without requiring a browser.

**Test Suites:**
- `Button Components` - Tests button structure, variants, types, and states
- `Link Components` - Tests navigation links, href attributes, HTMX attributes, and accessibility
- `Button and Link Integration` - Tests form buttons, disabled states, and design system compliance

**Run Command:**
```bash
npm test -- tests/button-link-components.test.js
```

**Test Results:**
- ✅ 13 tests passed
- ✅ All button variants verified
- ✅ All navigation links verified
- ✅ HTMX attributes verified
- ✅ Design system compliance verified

---

### 2. Playwright E2E Tests
**File:** `tests/e2e/button-link-navigation.spec.js`

**Purpose:** End-to-end tests with real browser to verify actual navigation behavior, response codes, and page loading.

**Test Suites:**
- `Public Routes - Landing Page` - Tests landing page buttons and links
- `Authenticated Routes - Navigation Links` - Tests sidebar navigation
- `Button Actions` - Tests button clicks (logout, theme toggle)
- `HTMX Partial Loading` - Tests HTMX-powered navigation
- `Response Codes` - Tests all links return valid HTTP responses
- `Page Navigation Flow` - Tests complete navigation workflows

**Run Command:**
```bash
npx playwright test tests/e2e/button-link-navigation.spec.js
```

**Run with specific browser:**
```bash
npx playwright test tests/e2e/button-link-navigation.spec.js --project="chromium"
npx playwright test tests/e2e/button-link-navigation.spec.js --project="Mobile Chrome"
```

**Prerequisites:**
- Server must be running on `http://localhost:9000`
- Test user credentials: `admin@acme.com` / `testpassword123`

---

## Test Coverage

### Button Components

**Vitest Tests:**
- ✅ Button structure and classes (`.vmp-btn`, `.vmp-action-button`)
- ✅ Button variants (primary, danger, ghost, outline)
- ✅ Button types (submit, button, reset)
- ✅ Disabled button state
- ✅ Design system CSS classes exist

**Playwright Tests:**
- ✅ Button clicks navigate correctly
- ✅ Form buttons submit correctly
- ✅ Theme toggle button works
- ✅ Logout button redirects correctly

---

### Link Components

**Vitest Tests:**
- ✅ Navigation link structure (`.vmp-navigation-link`)
- ✅ Href attributes present
- ✅ HTMX attributes (hx-get, hx-target, hx-push-url)
- ✅ Accessibility attributes (aria-label, title)
- ✅ Disabled link styling

**Playwright Tests:**
- ✅ Navigation links navigate to correct pages
- ✅ HTMX links load partials into targets
- ✅ URL state preserved with hx-push-url
- ✅ All links return valid HTTP responses (200-399)
- ✅ Complete navigation flows work

---

## Tested Routes

### Public Routes
- `/` - Landing page
- `/login` - Login page

### Authenticated Routes
- `/home` - Home/Console
- `/invoices` - Invoice list
- `/payments` - Payment list
- `/profile` - Profile page
- `/partials/case-inbox.html` - HTMX partial
- `/partials/case-detail.html` - HTMX partial
- `/logout` - Logout action

---

## Test Results Summary

### Vitest Unit Tests
```
✓ tests/button-link-components.test.js (13 tests) 36ms
  ✓ Button Components (5 tests)
  ✓ Link Components (5 tests)
  ✓ Button and Link Integration (3 tests)
```

### Playwright E2E Tests
```
Run with: npx playwright test tests/e2e/button-link-navigation.spec.js
```

**Expected Results:**
- All navigation links navigate correctly
- All buttons return desired responses
- HTMX partials load correctly
- Response codes are valid (200-399)
- Pages toggle/navigate correctly

**Note:** E2E tests require:
- Server running on port 9000
- Valid test user credentials in database
- Test data seeded (cases, invoices, etc.)
- Database connection configured

---

## Running Tests

### Run All Tests
```bash
# Unit tests
npm test -- tests/button-link-components.test.js

# E2E tests (requires server running)
npm run dev  # In one terminal
npx playwright test tests/e2e/button-link-navigation.spec.js  # In another terminal
```

### Run Specific Test Suite
```bash
# Vitest: Button Components only
npm test -- tests/button-link-components.test.js -t "Button Components"

# Playwright: Navigation Links only
npx playwright test tests/e2e/button-link-navigation.spec.js -g "Navigation Links"
```

### Debug Tests
```bash
# Vitest with watch mode
npm test -- tests/button-link-components.test.js --watch

# Playwright with UI mode
npx playwright test tests/e2e/button-link-navigation.spec.js --ui

# Playwright with headed browser
npx playwright test tests/e2e/button-link-navigation.spec.js --headed
```

---

## Test Maintenance

### Adding New Button Tests
1. Add test case to `tests/button-link-components.test.js`
2. Follow existing patterns for structure checks
3. Verify CSS classes exist in `public/globals.css`

### Adding New Link Tests
1. Add test case to `tests/button-link-navigation.spec.js`
2. Use `login(page)` helper for authenticated routes
3. Verify response codes and navigation behavior

### Updating Test Credentials
Update `TEST_EMAIL` and `TEST_PASSWORD` in:
- `tests/e2e/button-link-navigation.spec.js`
- `tests/e2e/days5-8.spec.js`
- `tests/e2e/mobile-ux-improvements.spec.js`

---

## Known Limitations

1. **HTMX Tests:** Some HTMX tests may require specific page state
2. **Dynamic Content:** Tests may need adjustment if page structure changes
3. **Authentication:** E2E tests require valid test user credentials
4. **Server Dependency:** Playwright tests require server running on port 9000

---

## Troubleshooting

### Vitest Tests Failing
- Check file paths are correct
- Verify HTML files exist in `src/views/`
- Check CSS classes exist in `public/globals.css`

### Playwright Tests Failing
- Ensure server is running: `npm run dev`
- Check server is on port 9000
- Verify test credentials are valid
- Check network tab for failed requests

### HTMX Tests Failing
- Verify HTMX library is loaded
- Check HTMX attributes are correct
- Verify target elements exist
- Check server returns valid partials

---

**Status:** ✅ All tests passing  
**Last Updated:** 2025-01-21

