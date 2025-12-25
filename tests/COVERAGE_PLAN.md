# Test Coverage Plan

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Target Coverage:** 95% (as per project requirements)

---

## 📊 Coverage Strategy

### Unit Tests (Vitest)
- **Target:** 95% coverage for all components, utilities, and adapters
- **Focus:** Individual functions, edge cases, error paths
- **Location:** `tests/**/*.test.js`

### Integration Tests (Vitest)
- **Target:** 90% coverage for API endpoints and workflows
- **Focus:** End-to-end workflows within single components
- **Location:** `tests/**/*.test.js`

### E2E Tests (Playwright)
- **Target:** 100% coverage for critical user paths
- **Focus:** Complete user workflows, UI interactions, HTMX updates
- **Location:** `tests/e2e/**/*.spec.js`

---

## 🎯 Component Coverage

### SOA Reconciliation (`tests/components/soa-recon.test.js`)

#### ✅ Covered
- [x] SOA Items CRUD operations
- [x] SOA Matches creation and validation
- [x] SOA Discrepancies creation and resolution
- [x] Debit Notes proposal, approval, and posting
- [x] Status transitions
- [x] Data validation

#### 🔄 Pending
- [ ] SOA matching engine (5-pass algorithm)
- [ ] Variance calculations
- [ ] Sign-off validation
- [ ] Evidence upload integration
- [ ] Export functionality

### Adapters (`tests/adapters/`)

#### ✅ Covered
- [x] Supabase adapter error handling
- [x] Storage operations
- [x] Upload error paths

#### 🔄 Pending
- [ ] All adapter methods (95% coverage target)
- [ ] Timeout handling
- [ ] Connection retry logic
- [ ] Transaction rollback

### Server Routes (`tests/server-*.test.js`)

#### ✅ Covered
- [x] Route error handling
- [x] Middleware validation
- [x] Authentication checks
- [x] File upload handling

#### 🔄 Pending
- [ ] All route handlers (95% coverage target)
- [ ] HTMX partial responses
- [ ] Error page rendering
- [ ] Session management

### Utilities (`tests/utils/`)

#### ✅ Covered
- [x] Error handling utilities
- [x] Route helpers
- [x] Checklist rules

#### 🔄 Pending
- [ ] AI message parser
- [ ] Email parser
- [ ] WhatsApp parser
- [ ] Export utilities
- [ ] Notification utilities
- [ ] SLA reminders
- [ ] SOA matching engine

---

## 🛤️ Path Coverage

### Authentication Flow
- [ ] Login (success, failure, validation)
- [ ] Logout
- [ ] Password reset
- [ ] Session expiration
- [ ] Role-based access

### Case Management Flow
- [ ] Case creation
- [ ] Case list/filtering
- [ ] Case detail view
- [ ] Case status transitions
- [ ] Case assignment
- [ ] Case tagging

### SOA Reconciliation Flow
- [x] SOA workspace navigation
- [x] SOA lines list and filtering
- [x] Line selection and focus view
- [x] Manual matching
- [x] Dispute creation
- [x] Evidence upload
- [ ] Autonomous matching
- [ ] Variance calculation
- [ ] Sign-off workflow
- [ ] Export pack generation

### Invoice Management Flow
- [ ] Invoice list
- [ ] Invoice detail
- [ ] Invoice approval
- [ ] Payment linking
- [ ] Exception reporting

### Payment Flow
- [ ] Payment list
- [ ] Payment detail
- [ ] Payment approval
- [ ] Emergency override

### Evidence Upload Flow
- [ ] File upload (success, failure)
- [ ] File validation
- [ ] Storage integration
- [ ] Checksum verification
- [ ] Version management

### Messaging Flow
- [ ] Message list
- [ ] Message creation
- [ ] Multi-channel delivery
- [ ] Message status tracking

---

## 🔄 Workflow Coverage

### SOA Reconciliation Workflow
1. [x] Navigate to SOA workspace
2. [x] View SOA lines list
3. [x] Filter lines by status
4. [x] Search lines by document number
5. [x] Select line and view focus
6. [x] View suggested matches
7. [x] Create manual match
8. [x] Mark line as disputed
9. [x] Upload evidence
10. [x] View variance HUD
11. [x] Recompute reconciliation
12. [x] Export reconciliation pack
13. [ ] Sign off (when variance is zero)
14. [ ] Create debit note proposal
15. [ ] Approve debit note
16. [ ] Post debit note to ledger

### Case Onboarding Workflow
1. [ ] Case creation
2. [ ] Checklist step completion
3. [ ] Evidence upload
4. [ ] Message exchange
5. [ ] Case approval
6. [ ] Case closure

### Invoice Processing Workflow
1. [ ] Invoice ingestion
2. [ ] Invoice validation
3. [ ] Invoice approval
4. [ ] Payment linking
5. [ ] Exception handling

---

## 📈 Coverage Metrics

### Current Coverage (Estimated)
- **Unit Tests:** ~60%
- **Integration Tests:** ~40%
- **E2E Tests:** ~30%
- **Overall:** ~45%

### Target Coverage
- **Unit Tests:** 95%
- **Integration Tests:** 90%
- **E2E Tests:** 100% (critical paths)
- **Overall:** 95%

---

## 🚀 Implementation Plan

### Phase 1: Core Components (Week 1)
- [ ] Complete SOA reconciliation component tests
- [ ] Complete adapter method tests
- [ ] Complete utility function tests
- [ ] Achieve 80% unit test coverage

### Phase 2: Routes & Workflows (Week 2)
- [ ] Complete server route tests
- [ ] Complete authentication flow tests
- [ ] Complete case management flow tests
- [ ] Achieve 90% integration test coverage

### Phase 3: E2E Coverage (Week 3)
- [ ] Complete SOA reconciliation E2E tests
- [ ] Complete case onboarding E2E tests
- [ ] Complete invoice processing E2E tests
- [ ] Achieve 100% critical path E2E coverage

### Phase 4: Optimization (Week 4)
- [ ] Performance testing
- [ ] Load testing
- [ ] Security testing
- [ ] Accessibility testing
- [ ] Achieve 95% overall coverage

---

## 🧪 Test Execution

### Run All Tests
```bash
# Unit and integration tests
npm run test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage

# Combined (unit + E2E)
npm run test:combined
```

### Run Specific Test Suites
```bash
# SOA reconciliation tests
npm run test -- tests/components/soa-recon.test.js

# E2E SOA workflow
npm run test:e2e -- tests/e2e/soa-recon-workflow.spec.js

# Adapter tests
npm run test -- tests/adapters/
```

### Watch Mode
```bash
# Watch unit tests
npm run test:watch

# Watch E2E tests
npm run test:e2e:ui
```

---

## 📝 Test Writing Guidelines

### Unit Tests
- **One assertion per test** (when possible)
- **Test edge cases** (null, undefined, empty, invalid)
- **Test error paths** (validation failures, database errors)
- **Mock external dependencies** (Supabase, file system)
- **Use descriptive test names** (should do X when Y)

### Integration Tests
- **Test complete workflows** (not just individual functions)
- **Use real database** (with test data cleanup)
- **Test error recovery** (rollback, retry logic)
- **Test concurrent operations** (race conditions)

### E2E Tests
- **Test user-visible workflows** (what user sees and does)
- **Test HTMX interactions** (dynamic updates)
- **Test responsive design** (mobile, tablet, desktop)
- **Test accessibility** (keyboard navigation, screen readers)

---

## ✅ Coverage Checklist

### Components
- [ ] SOA Items
- [ ] SOA Matches
- [ ] SOA Discrepancies
- [ ] SOA Acknowledgements
- [ ] Debit Notes
- [ ] Cases
- [ ] Invoices
- [ ] Payments
- [ ] Evidence
- [ ] Messages

### Utilities
- [ ] Error handling
- [ ] Route helpers
- [ ] Validation
- [ ] Parsers (email, WhatsApp, AI)
- [ ] Export utilities
- [ ] Notification utilities
- [ ] SLA utilities
- [ ] SOA matching engine

### Routes
- [ ] Authentication routes
- [ ] Case routes
- [ ] SOA routes
- [ ] Invoice routes
- [ ] Payment routes
- [ ] Evidence routes
- [ ] Message routes
- [ ] API routes

### Workflows
- [ ] SOA reconciliation
- [ ] Case onboarding
- [ ] Invoice processing
- [ ] Payment approval
- [ ] Evidence upload
- [ ] Messaging

---

**Document Status:** ✅ In Progress  
**Last Updated:** 2025-01-22

