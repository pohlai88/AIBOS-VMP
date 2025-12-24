# Frontend Code Quality & Testing Standards

**Version:** 1.0  
**Date:** December 24, 2025  
**Applies To:** All frontend code (HTML, CSS, JavaScript)

---

## 1. Code Quality Gates

### 1.1 Linting & Formatting

**Tools:**
- **ESLint** – JavaScript code quality
- **Prettier** – Code formatting
- **Stylelint** – CSS validation

**Pre-Commit Checks:**
```bash
npm run lint          # Must pass
npm run format:check  # Must pass
```

**Configuration Files:**
```
.eslintrc.json      # ESLint rules
.prettierrc          # Prettier config
.stylelintrc.json    # Stylelint config
```

**Key Rules to Enforce:**
```javascript
// ❌ NOT ALLOWED
console.log('debug');      // Use proper logging
var x = 1;                 // Use const/let
function(args){/**/}       // Use arrow functions where possible
x==5                       // Use === always

// ✅ ALLOWED
logger.debug('debug');     // Structured logging
const x = 1;
(args) => {}
x === 5
```

**Fixing Issues:**
```bash
npm run lint:fix      # Auto-fix ESLint issues
npm run format        # Auto-format with Prettier
```

### 1.2 Browser Compatibility

**Supported Browsers:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**No IE11 Support** (use modern ES6+)

**Testing Tools:**
- BrowserStack (cloud testing)
- Chrome DevTools (local)
- Firefox Developer Edition

**Polyfill Strategy:**
- Use native APIs when available
- Fetch, Promise, Array methods → no polyfills needed
- Test in all target browsers before shipping

### 1.3 Accessibility (WCAG 2.1 AA)

**Automated Testing:**
```bash
npm run test:a11y      # Run axe accessibility audit
```

**Manual Testing Checklist:**
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Screen reader testing (VoiceOver on Mac, NVDA on Windows)
- [ ] Color contrast ratio ≥ 4.5:1
- [ ] Focus indicators visible
- [ ] Alt text on images
- [ ] Form labels associated with inputs

**Common Issues & Fixes:**

| Issue | Fix |
|-------|-----|
| Missing alt text | Add `alt="description"` to `<img>` tags |
| Low contrast | Increase color brightness/darkness |
| Missing ARIA | Add `aria-label` to icons/buttons |
| Unlabeled form | Add `<label for="input-id">` |
| Unclickable icon | Wrap in `<button>` or use `role="button"` |
| No focus indicator | Add `.focus-visible` or `:focus` styles |

**Resources:**
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Lighthouse Accessibility Audit](https://web.dev/lighthouse-accessibility/)

---

## 2. Testing Standards

### 2.1 Unit Tests (Vitest)

**When to Write:**
- Utility functions (date formatting, validation)
- API wrappers
- Data transformations
- Complex logic

**When NOT to Write:**
- Simple HTML rendering
- CSS styling
- Third-party library code

**Test File Structure:**
```javascript
// tests/utils/date-utils.test.js
import { describe, it, expect } from 'vitest';
import { formatDate, getRelativeTime } from '../../src/utils/date-utils.js';

describe('formatDate', () => {
  describe('with valid input', () => {
    it('should format date as MM/DD/YYYY', () => {
      const date = new Date('2025-12-24');
      const result = formatDate(date);
      expect(result).toBe('12/24/2025');
    });

    it('should handle different locales', () => {
      const date = new Date('2025-12-24');
      const result = formatDate(date, 'en-GB');
      expect(result).toBe('24/12/2025');
    });
  });

  describe('with invalid input', () => {
    it('should throw error for null input', () => {
      expect(() => formatDate(null)).toThrow();
    });

    it('should throw error for invalid date string', () => {
      expect(() => formatDate('invalid')).toThrow();
    });
  });
});
```

**Test Coverage Targets:**
- `src/utils/` → 90%+
- `src/services/` → 80%+
- `src/adapters/` → 80%+

**Running Tests:**
```bash
npm run test                  # Run all tests once
npm run test:watch          # Watch mode (auto-rerun on changes)
npm run test:coverage       # Generate coverage report
npm run test:coverage:report # Verbose coverage
```

**Coverage Report:**
```
────────────────────────────────────────
File           | % Stmts | % Branch | % Funcs | % Lines
────────────────────────────────────────
date-utils.js  |   95.2  |   92.3   |   100   |   94.1
validation.js  |   87.4  |   84.5   |   90.0  |   86.7
────────────────────────────────────────
Total          |   88.5  |   86.2   |   92.1  |   87.8
────────────────────────────────────────
```

### 2.2 E2E Tests (Playwright)

**When to Write:**
- Critical user workflows
- Cross-page navigation
- Form submissions
- Data persistence

**Test Structure:**
```javascript
// tests/e2e/vendor-workflow.spec.js
import { test, expect } from '@playwright/test';

test.describe('Vendor Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'vendor@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
  });

  test('should display case list', async ({ page }) => {
    await page.goto('/vendor/dashboard');
    
    const caseList = await page.locator('[data-testid="case-list"]');
    expect(caseList).toBeVisible();
    
    const cases = await page.locator('[data-testid="case-card"]').count();
    expect(cases).toBeGreaterThan(0);
  });

  test('should open case detail when clicked', async ({ page }) => {
    await page.goto('/vendor/dashboard');
    
    // Click first case
    await page.click('[data-testid="case-card"]:first-of-type');
    
    // Wait for navigation
    await page.waitForURL(/\/cases\/[a-f0-9-]+/);
    
    // Verify detail page loaded
    const title = await page.locator('h1').textContent();
    expect(title).toMatch(/Case #[0-9]+/);
  });

  test('should post message to case thread', async ({ page }) => {
    await page.goto('/cases/123');
    
    // Click Thread tab
    await page.click('[role="tab"]:has-text("Thread")');
    
    // Type message
    const input = page.locator('[data-testid="message-input"]');
    await input.fill('Test message');
    
    // Send
    await page.click('[data-testid="send-button"]');
    
    // Verify message appears
    await expect(page.locator('text="Test message"')).toBeVisible();
  });

  test('should upload evidence file', async ({ page }) => {
    await page.goto('/cases/123');
    
    // Click Evidence tab
    await page.click('[role="tab"]:has-text("Evidence")');
    
    // Upload file
    await page.setInputFiles('[data-testid="file-input"]', 'tests/fixtures/sample.pdf');
    
    // Wait for upload
    await page.waitForSelector('[data-testid="file-item"]:has-text("sample.pdf")');
    
    expect(page.locator('[data-testid="file-item"]')).toBeVisible();
  });
});
```

**Running E2E Tests:**
```bash
npm run test:e2e              # Run all E2E tests
npm run test:e2e:ui          # Interactive UI mode
npm run test:e2e:headed      # Show browser while running
npm run test:e2e -- --debug  # Step through test
```

**Best Practices:**
- Use `[data-testid]` attributes for reliable selectors
- Avoid hard waits; use proper wait conditions
- Test user flows, not implementation details
- Mock API calls for speed (use Playwright request interception)
- Clean up test data after each test

### 2.3 Manual QA Checklist

**Desktop (Chrome, Firefox, Safari, Edge)**
- [ ] Page loads without errors
- [ ] All text readable
- [ ] Images display correctly
- [ ] Forms work (inputs, selects, buttons)
- [ ] Links navigate correctly
- [ ] Modals open/close
- [ ] Scroll works smoothly
- [ ] No broken layout elements

**Mobile (iOS Safari, Chrome Android)**
- [ ] Responsive layout (no horizontal scroll)
- [ ] Touch targets ≥ 44×44px
- [ ] Readable text (≥ 12px)
- [ ] Forms usable with soft keyboard
- [ ] Images responsive
- [ ] No desktop-only UI elements

**Accessibility**
- [ ] Keyboard navigation (Tab through page)
- [ ] Focus indicators visible
- [ ] Screen reader announces elements
- [ ] Color not the only differentiator
- [ ] Sufficient color contrast

**Performance**
- [ ] Lighthouse score ≥ 90
- [ ] Fast on slow network (simulate 3G)
- [ ] No layout shifts (CLS < 0.1)
- [ ] No janky animations
- [ ] Images optimized

**Real-World Data**
- [ ] Test with long text (does layout break?)
- [ ] Test with missing data (empty states work?)
- [ ] Test with lots of data (lists pagination?)
- [ ] Test with different timezones
- [ ] Test with different locales (if applicable)

---

## 3. Performance Standards

### 3.1 Core Web Vitals

**Targets:**
```
First Contentful Paint (FCP):        < 1.5s  (Good)
Largest Contentful Paint (LCP):      < 2.5s  (Good)
Cumulative Layout Shift (CLS):       < 0.1   (Good)
First Input Delay (FID):             < 100ms (Good)
Time to Interactive (TTI):           < 3.5s  (Good)
```

**Measuring:**
```bash
npm run test:lighthouse    # Run Lighthouse audit
# Also check: DevTools > Lighthouse > Performance
```

### 3.2 Bundle Size Limits

**Per-Page Limits:**
```
HTML:                  < 50KB
Critical CSS:          < 15KB
Critical JS:           < 100KB
Images (optimized):    < 100KB
Total (gzipped):       < 200KB
```

**Monitoring:**
```javascript
// In build output
/* bundle-report.txt */
vendor-dashboard.html:   28KB ✓
vendor-dashboard.css:    12KB ✓
vendor-dashboard.js:     85KB ✓
images:                  45KB ✓
────────────────────────────
Total:                  170KB ✓
```

### 3.3 Optimization Tactics

**Lazy Loading:**
```html
<!-- Lazy load images below fold -->
<img src="image.jpg" loading="lazy" width="400" height="300" />

<!-- Lazy load iframes -->
<iframe src="..." loading="lazy"></iframe>
```

**Code Splitting:**
```javascript
// Load component only when needed
const MessageThread = () => import('./components/MessageThread.js');
```

**Caching:**
```javascript
// Service worker caches static assets
// Cache-Control headers:
// - Static assets: max-age=31536000 (1 year)
// - HTML: max-age=0 (always revalidate)
// - API: no-cache (validate with ETag)
```

**Image Optimization:**
```html
<!-- Responsive images -->
<picture>
  <source srcset="image.webp" type="image/webp" />
  <source srcset="image.jpg" type="image/jpeg" />
  <img src="image.jpg" alt="Description" />
</picture>

<!-- Sizes hint for responsive loading -->
<img src="image.jpg" 
     srcset="small.jpg 400w, large.jpg 800w"
     sizes="(max-width: 600px) 100vw, 50vw" />
```

---

## 4. Error Handling & Logging

### 4.1 Error Handling Pattern

**Always Handle Errors:**
```javascript
// ❌ BAD: No error handling
async function loadCases() {
  const response = await fetch('/api/cases');
  const data = await response.json();
  return data;
}

// ✅ GOOD: Proper error handling
async function loadCases() {
  try {
    const response = await fetch('/api/cases');
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to load cases:', error);
    showErrorToast('Could not load cases. Please try again.');
    return [];
  }
}
```

### 4.2 Logging Strategy

**No `console.log` in Production:**
```javascript
// ❌ NOT ALLOWED in production
console.log('Loading cases...');

// ✅ USE structured logging
import { logger } from './utils/logger.js';

logger.info('Loading cases', { vendorId: '123' });
logger.error('Failed to load cases', { error, context: 'vendor-dashboard' });
logger.warn('Slow API response', { duration: 3500, threshold: 3000 });
```

**Logger Levels:**
```javascript
logger.debug('Detailed info for developers')      // Dev only
logger.info('Application events')                 // Always
logger.warn('Potential issues')                   // Always
logger.error('Errors (recoverable)')              // Always + Alert
logger.critical('Fatal errors (not recoverable)') // Alert + Notify team
```

**Example Logger Implementation:**
```javascript
// src/utils/logger.js
class Logger {
  constructor(context = '') {
    this.context = context;
  }

  log(level, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      ...data
    };

    if (level === 'error' || level === 'critical') {
      console.error(JSON.stringify(entry));
      // Send to Sentry/error tracking service
      if (window.Sentry) {
        window.Sentry.captureException(new Error(message), { tags: { context: this.context } });
      }
    } else {
      console.info(JSON.stringify(entry));
    }
  }

  debug(message, data) { this.log('debug', message, data); }
  info(message, data) { this.log('info', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  error(message, data) { this.log('error', message, data); }
  critical(message, data) { this.log('critical', message, data); }
}

export const logger = new Logger('VMP');
```

---

## 5. Security Standards

### 5.1 Input Validation & Sanitization

**Always Validate Input:**
```javascript
// ❌ UNSAFE: No validation
const name = document.getElementById('name').value;
element.innerHTML = `<h1>Welcome ${name}</h1>`;  // XSS vulnerability!

// ✅ SAFE: Validated and sanitized
const name = document.getElementById('name').value;
if (!name || name.length > 100) {
  showError('Invalid name');
  return;
}
element.textContent = `Welcome ${name}`;  // textContent escapes HTML
```

**Validation Rules:**
```javascript
// Email validation
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) && email.length <= 254;
}

// Username validation
function validateUsername(username) {
  const re = /^[a-zA-Z0-9_-]{3,20}$/;
  return re.test(username);
}

// File upload validation
function validateFile(file) {
  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('File type not allowed');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('File too large');
  }
  return true;
}
```

### 5.2 Content Security Policy (CSP)

**Helmet Already Configured in server.js:**
```javascript
// CSP prevents:
// - Inline scripts (malicious injections)
// - External scripts from untrusted sources
// - Unsafe eval
// - Unsafe inline styles

// Only allow from trusted domains
directives: {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "https://cdn.tailwindcss.com"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https:"],
}
```

### 5.3 CSRF Protection

**Use CSRF Token for Forms:**
```html
<!-- Nunjucks template -->
<form method="POST" action="/cases">
  <input type="hidden" name="csrf_token" value="{{ csrf_token }}" />
  <!-- form fields -->
</form>
```

**Verify in Backend:**
```javascript
app.post('/cases', (req, res) => {
  if (!verifyCsrfToken(req)) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  // Process form
});
```

---

## 6. Git & Code Review Workflow

### 6.1 Commit Message Standards

**Format:**
```
<type>: <subject> [(<scope>)]

<body>

<footer>
```

**Example:**
```
feat: add vendor dashboard with case filtering

- Implemented case list view with real-time updates
- Added status filter dropdown
- Added search by case ID

Fixes #123
Related to #456

Co-authored-by: Designer <designer@example.com>
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code reorganization (no behavior change)
- `style:` Formatting, missing semicolons (no code change)
- `test:` Adding/updating tests
- `chore:` Dependencies, tooling (no app code change)
- `docs:` Documentation updates
- `perf:` Performance improvements

### 6.2 Pull Request Checklist

**PR Author Must Verify:**
- [ ] Code follows style guide (ESLint passes)
- [ ] Tests written and passing
- [ ] No console errors/warnings
- [ ] Mobile responsive
- [ ] Accessibility checklist complete
- [ ] Performance acceptable (Lighthouse ≥ 90)
- [ ] No hardcoded values
- [ ] Error handling for all async operations
- [ ] Documentation updated (if applicable)

**PR Reviewer Must Check:**
- [ ] Code logic is correct
- [ ] No security vulnerabilities
- [ ] API contracts match backend
- [ ] No unnecessary complexity
- [ ] Tests adequately cover changes
- [ ] Performance impact acceptable
- [ ] Backward compatibility (if applicable)

**GitHub Action Checks (Automated):**
```yaml
- npm run lint           # Must pass
- npm run test          # Must pass
- npm run test:e2e      # Must pass
- npm run test:a11y     # Must pass
- lighthouse            # Must be ≥ 90
```

---

## 7. Browser DevTools Tips

### 7.1 Performance Profiling

```
1. Open DevTools (F12)
2. Performance tab → Record
3. Perform user action
4. Stop recording
5. Analyze:
   - FCP marker (First Contentful Paint)
   - LCP marker (Largest Contentful Paint)
   - Layout/Paint times
```

### 7.2 Accessibility Audit

```
1. Open DevTools
2. Lighthouse tab
3. Mode: Navigation
4. Categories: Accessibility (only)
5. Generate report
6. Fix issues in order of severity
```

### 7.3 Network Throttling

```
DevTools > Network > Throttling dropdown
- No throttling
- Fast 3G
- Slow 3G
- Offline

Test page load with 3G to ensure acceptable performance
```

---

## 8. CI/CD Integration

### 8.1 GitHub Actions Workflow

```yaml
# .github/workflows/frontend.yml
name: Frontend QA

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Test
        run: npm run test
      
      - name: E2E Tests
        run: npm run test:e2e
      
      - name: Accessibility Audit
        run: npm run test:a11y
      
      - name: Lighthouse CI
        run: npm run lighthouse
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## 9. Troubleshooting Guide

| Issue | Solution |
|-------|----------|
| Tests failing locally but pass in CI | Clear node_modules: `rm -rf node_modules && npm install` |
| Lighthouse score drops | Check bundle size, image optimization, JavaScript execution |
| Mobile layout broken | Test with DevTools device emulation + real device |
| Accessibility audit fails | Run axe DevTools, fix ARIA issues, test keyboard nav |
| Slow API calls on client | Check Network tab, consider pagination/lazy loading |
| Console errors in production | Check error tracking service (Sentry), review logs |

---

**Document Owner:** QA/Frontend Lead  
**Last Updated:** December 24, 2025  
**Questions?** Ask in #frontend channel
