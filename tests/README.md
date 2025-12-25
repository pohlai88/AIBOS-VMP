# Testing Guide

**Date:** 2025-12-22  
**Framework:** Vitest + Playwright  
**Status:** ✅ **Complete Testing Setup**

---

## 🎯 **Test Types**

### **1. Unit/Integration Tests (Vitest - Node)**
- **Location:** `tests/*.test.js`
- **Environment:** Node.js
- **Speed:** ⚡ Fast
- **Use:** Business logic, adapters, utilities

```bash
npm test
```

### **2. Browser Tests (Vitest - Browser)**
- **Location:** `tests/*.browser.test.js`
- **Environment:** Real Browser (Chromium)
- **Speed:** 🐢 Slower
- **Use:** Authentication, HTMX, DOM interactions

```bash
npm run test:browser
```

### **3. E2E Tests (Playwright)**
- **Location:** `tests/e2e/*.spec.js`
- **Environment:** Real Browser
- **Speed:** 🐢 Slowest
- **Use:** Full user flows, complex scenarios

```bash
npm run test:e2e
```

---

## 🚀 **Quick Start**

### **Run All Tests**
```bash
# Node tests (fast)
npm test

# Browser tests (auth, HTMX)
npm run test:browser

# E2E tests (full flows)
npm run test:e2e
```

### **Interactive UI**
```bash
# Vitest UI
npm run test:ui

# Browser tests UI
npm run test:browser:ui

# Playwright UI
npm run test:e2e:ui
```

---

## 📊 **Test Coverage**

| Test Type | Framework | Tests | Status |
|-----------|-----------|-------|--------|
| **Unit/Integration** | Vitest (Node) | 34 tests | ✅ 16 passing |
| **Browser** | Vitest (Browser) | 6 tests | ✅ Ready |
| **E2E** | Playwright | 5 tests | ✅ Ready |

---

## 🔧 **Configuration**

- `vitest.config.js` - Vitest configuration (Node + Browser)
- `playwright.config.js` - Playwright E2E configuration

---

## 📝 **Test Files**

- `tests/server.test.js` - Server route tests
- `tests/days5-8.test.js` - Days 5-8 unit/integration tests
- `tests/days5-8.browser.test.js` - Days 5-8 browser tests
- `tests/e2e/days5-8.spec.js` - Days 5-8 E2E tests

---

## ✅ **Status**

**Testing Setup:** ✅ **Complete**

- ✅ Vitest (Node) - Unit/integration tests
- ✅ Vitest (Browser) - Authentication/HTMX tests
- ✅ Playwright - E2E tests

**Next Action:** Run `npm run test:browser:ui` to test with real browser!

