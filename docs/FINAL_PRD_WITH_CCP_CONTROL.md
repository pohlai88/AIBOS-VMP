# Final PRD with CCP Control

**Document ID:** PRD-VMP-FINAL-001  
**Version:** 1.0.0  
**Status:** ✅ Production-Ready  
**Date:** 2025-01-22  
**Owner:** Product + Engineering  
**Last Updated:** 2025-01-22

---

## 📋 Executive Summary

This document serves as the **Final Product Requirements Document (PRD)** with **Critical Control Points (CCP)** for the NexusCanon Vendor Management Platform (VMP). It defines the complete technical stack, MCP utilization strategy, entry points, scope boundaries, Definition of Done (DoD), and Key Performance Indicators (KPIs).

**This PRD consolidates all previous PRDs and serves as the single source of truth for development.**

---

## 🎯 One-Liner

**NexusCanon VMP** is a multi-tenant, case-driven vendor management platform that transforms vendor onboarding, invoice processing, payment approvals, and SOA reconciliation into auditable, structured workflows—enabling both clients (internal AP/Procurement) and vendors (suppliers) to collaborate seamlessly through a unified system.

---

## 🏗️ Technical Stack (Compatible & Locked)

### Core Stack (Production-Grade)

#### Backend Layer
| Component | Version | Purpose | Status |
|-----------|---------|---------|--------|
| **Node.js** | 20.x | Runtime (ESM modules) | ✅ Locked |
| **Express** | 4.x | HTTP server framework | ✅ Locked |
| **Nunjucks** | 3.x | Server-side templating | ✅ Locked |
| **Supabase JS** | 2.39.0 | Database client | ✅ Locked |

#### Frontend Layer
| Component | Version | Purpose | Status |
|-----------|---------|---------|--------|
| **HTMX** | Latest (CDN) | Client-side interactivity | ✅ Locked |
| **Alpine.js** | Latest (CDN) | Minimal client-side logic | ✅ Locked |
| **Tailwind CSS** | Latest (CDN) | Utility-first CSS | ✅ Locked |

#### Database & Infrastructure
| Component | Provider | Purpose | Status |
|-----------|----------|---------|--------|
| **PostgreSQL** | Supabase | Primary database | ✅ Locked |
| **Supabase Auth** | Supabase | Authentication | ✅ Locked |
| **Supabase Storage** | Supabase | File storage | ✅ Locked |
| **Supabase Realtime** | Supabase | Real-time updates | ✅ Locked |

#### Development Tools
| Component | Version | Purpose | Status |
|-----------|---------|---------|--------|
| **Vitest** | 4.0.16 | Unit/integration testing | ✅ Locked |
| **Playwright** | 1.57.0 | E2E testing | ✅ Locked |
| **ESLint** | 8.57.0 | Code linting | ✅ Locked |
| **Prettier** | 3.7.4 | Code formatting | ✅ Locked |

### Stack Compatibility Matrix

| Layer | Technology | Compatibility | Notes |
|-------|------------|---------------|-------|
| **Runtime** | Node.js 20.x | ✅ Full | ESM modules, async/await |
| **Server** | Express 4.x | ✅ Full | Middleware, routing |
| **Templating** | Nunjucks 3.x | ✅ Full | Server-side rendering |
| **Database** | Supabase Postgres | ✅ Full | RLS, triggers, functions |
| **Auth** | Supabase Auth | ✅ Full | OAuth, email, sessions |
| **Storage** | Supabase Storage | ✅ Full | File uploads, CDN |
| **Realtime** | Supabase Realtime | ✅ Full | WebSocket subscriptions |
| **Client** | HTMX + Alpine | ✅ Full | Progressive enhancement |

### Stack Non-Negotiables

**DO NOT:**
- ❌ Add React, Vue, or any SPA framework
- ❌ Add TypeScript (JavaScript ESM only)
- ❌ Add custom build tools (Webpack, Vite, etc.)
- ❌ Add ORM (use Supabase client directly)
- ❌ Add state management library
- ❌ Add routing library (Express handles routing)

**DO:**
- ✅ Use server-side rendering (Nunjucks)
- ✅ Use HTMX for dynamic updates
- ✅ Use Alpine.js for minimal interactivity
- ✅ Use Supabase client for database access
- ✅ Use adapter pattern for database abstraction

---

## 🔌 MCP (Model Context Protocol) Utilization

### MCP Strategy for Maximum Productivity

**Purpose:** Leverage MCP tools to automate development, testing, and deployment workflows.

### Available MCP Servers

| MCP Server | Purpose | Tools Available | Usage |
|------------|---------|-----------------|-------|
| **Supabase MCP** | Database operations | `list_tables`, `execute_sql`, `apply_migration`, `get_logs`, `get_advisors` | Database schema, migrations, queries |
| **GitHub MCP** | Repository management | `search_code`, `get_file_contents`, `create_issue`, `create_pull_request` | Code search, PR management |
| **Figma MCP** | Design integration | `get_design_context`, `get_screenshot` | Design-to-code workflow |

**Note:** Next.js DevTools MCP is **not applicable** - this stack uses Express SSR, not Next.js.

### MCP Usage Patterns

#### 1. Database Development (Supabase MCP)
```javascript
// Use Supabase MCP for:
- Schema validation: list_tables()
- Migration execution: apply_migration()
- Query testing: execute_sql()
- Performance analysis: get_advisors('performance')
- Security audit: get_advisors('security')
```

#### 2. Code Search & Analysis (GitHub MCP)
```javascript
// Use GitHub MCP for:
- Cross-repo code search: search_code()
- File content retrieval: get_file_contents()
- Issue tracking: create_issue()
- PR management: create_pull_request()
```

#### 3. Development Workflow
```javascript
// Express SSR Development:
- Use Supabase MCP for database operations
- Use GitHub MCP for code search and PR management
- Use standard Express debugging tools (nodemon, etc.)
```

### MCP Productivity KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Database Operations** | 80% via MCP | Count of MCP vs manual SQL |
| **Code Search** | 90% via MCP | Count of MCP vs manual search |
| **Error Resolution** | 70% via MCP | Count of MCP diagnostics used |
| **Migration Execution** | 100% via MCP | All migrations via `apply_migration` |

---

## 🚪 Entry Points

### Application Entry Points

#### 1. Primary Entry Point
**File:** `server.js`  
**Port:** `process.env.PORT || 3000`  
**Command:** `npm start` or `npm run dev`

**Responsibilities:**
- Express server initialization
- Middleware configuration
- Route mounting
- Error handling
- Session management

#### 2. API Entry Point (Future)
**File:** `api/index.js`  
**Purpose:** Serverless function entry (Vercel/Netlify)  
**Status:** 🔄 Planned

#### 3. Development Entry Point
**Command:** `npm run dev`  
**Tool:** Nodemon (auto-restart on changes)

### User Entry Points

#### Client Portal
- **URL:** `/nexus/client/*`
- **Routes:** `src/routes/nexus-client.js`
- **Templates:** `src/views/nexus/pages/client-*.html`
- **Auth:** Supabase Auth (OAuth + Email)

#### Vendor Portal
- **URL:** `/nexus/vendor/*`
- **Routes:** `src/routes/nexus-vendor.js`
- **Templates:** `src/views/nexus/pages/vendor-*.html`
- **Auth:** Supabase Auth (OAuth + Email)

#### Public Portal
- **URL:** `/nexus/portal/*`
- **Routes:** `src/routes/nexus-portal.js`
- **Templates:** `src/views/nexus/pages/*.html`
- **Auth:** Supabase Auth (Login/Sign-up)

---

## ✅ What's IN (Scope)

### Core Features (MVP)

#### 1. Multi-Tenant Architecture
- ✅ Tenant isolation (RLS enforced)
- ✅ Client-Vendor relationships
- ✅ Context switching (TC-* / TV-*)
- ✅ Shared schema with context filtering

#### 2. Case Management System
- ✅ Case creation (client/vendor initiated)
- ✅ Case status workflow (DRAFT → SUBMITTED → APPROVED → CLOSED)
- ✅ Case messages (thread-based)
- ✅ Case evidence (file uploads)
- ✅ Case timeline (audit trail)

#### 3. Invoice Processing
- ✅ Invoice listing (client/vendor views)
- ✅ Invoice detail view
- ✅ Invoice status tracking
- ✅ Invoice-evidence linking

#### 4. Payment Management
- ✅ Payment listing (client/vendor views)
- ✅ Payment detail view
- ✅ Payment status tracking
- ✅ Payment approval workflow (future)

#### 5. Document Management
- ✅ Document upload (evidence)
- ✅ Document request workflow
- ✅ Document expiry tracking
- ✅ Document compliance checks

#### 6. Notifications
- ✅ Real-time notifications (Supabase Realtime)
- ✅ Notification bell (unread count)
- ✅ Notification preferences
- ✅ Email notifications (future)

#### 7. Authentication & Authorization
- ✅ Supabase Auth integration
- ✅ OAuth providers (Google, etc.)
- ✅ Email/password authentication
- ✅ Session management
- ✅ RBAC (Role-Based Access Control)

#### 8. SOA Reconciliation (Future)
- 🔄 Statement matching
- 🔄 Dispute resolution
- 🔄 Reconciliation reports

### Technical Features

#### 1. CRUD-S Pattern (Soft Delete)
- ✅ `deleted_at`, `deleted_by` columns
- ✅ RLS policies (hide deleted records)
- ✅ `softDelete()`, `restore()` methods
- ✅ Partial indexes (unique constraints)

#### 2. Audit Trail
- ✅ Hash chain (document integrity)
- ✅ Created/updated timestamps
- ✅ User tracking (`created_by`, `updated_by`)
- ✅ State transition history

#### 3. Template System
- ✅ Application templates (route, service, migration, test)
- ✅ View templates (page, partial)
- ✅ Scaffold script (auto-generation)
- ✅ Template contracts (governance)

#### 4. Testing Infrastructure
- ✅ Unit tests (Vitest)
- ✅ Integration tests (Vitest)
- ✅ E2E tests (Playwright)
- ✅ Test templates

---

## ❌ What's OUT (Out of Scope)

### Explicitly Excluded

#### 1. Full ERP Replacement
- ❌ Core AP engine (VMP is facade + truth spine)
- ❌ General ledger integration
- ❌ Full accounting system
- ❌ Inventory management

#### 2. Advanced BI/Analytics
- ❌ Custom dashboards (beyond basic KPIs)
- ❌ Advanced reporting engine
- ❌ Data warehousing
- ❌ Predictive analytics

#### 3. Full Payment Execution
- ❌ Payment gateway integration (read-only visibility first)
- ❌ Automated payment processing
- ❌ Bank reconciliation
- ❌ Payment scheduling

#### 4. Mobile Applications
- ❌ Native iOS app
- ❌ Native Android app
- ❌ React Native app
- ✅ Responsive web (mobile-friendly)

#### 5. Advanced Automation
- ❌ AI-powered invoice extraction (future)
- ❌ Automated approval workflows (future)
- ❌ Machine learning models
- ❌ RPA integration

#### 6. Third-Party Integrations (MVP)
- ❌ ERP system integration (SAP, Oracle, etc.)
- ❌ Accounting software integration (QuickBooks, Xero, etc.)
- ❌ Banking API integration
- ❌ Tax software integration

#### 7. Advanced Features (Future)
- ❌ Multi-currency support
- ❌ Multi-language support (i18n)
- ❌ Advanced workflow engine
- ❌ Custom field builder

---

## 🎯 Definition of Done (DoD)

### Feature-Level DoD

A feature is considered **DONE** when all of the following are complete:

#### 1. Development
- [ ] Code written and reviewed
- [ ] All placeholders replaced (`{{EntityName}}`, etc.)
- [ ] No linter errors
- [ ] No TypeScript errors (if applicable)
- [ ] Follows template patterns (if applicable)

#### 2. Testing
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] E2E tests written and passing (if applicable)
- [ ] Test coverage ≥ 80% (for new code)
- [ ] Manual testing completed

#### 3. Database
- [ ] Migration created and tested
- [ ] RLS policies implemented (if applicable)
- [ ] Indexes created (if applicable)
- [ ] Data integrity verified
- [ ] Rollback tested

#### 4. Documentation
- [ ] API documentation updated (if applicable)
- [ ] User documentation updated (if applicable)
- [ ] Architecture documentation updated (if applicable)
- [ ] CHANGELOG updated

#### 5. Security
- [ ] Authentication required (if applicable)
- [ ] Authorization verified (RBAC)
- [ ] Input validation implemented
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified

#### 6. Performance
- [ ] Query performance acceptable (< 500ms)
- [ ] No N+1 queries
- [ ] Proper indexing in place
- [ ] Caching implemented (if applicable)

#### 7. Deployment
- [ ] Code merged to main branch
- [ ] Migration executed on staging
- [ ] Staging environment verified
- [ ] Production deployment approved
- [ ] Post-deployment verification

### Release-Level DoD

A release is considered **DONE** when:

- [ ] All features meet Feature-Level DoD
- [ ] All CCP gates passed
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] User acceptance testing (UAT) passed
- [ ] Production deployment successful
- [ ] Monitoring and alerting configured
- [ ] Rollback plan documented

---

## 📊 Key Performance Indicators (KPIs)

### Development KPIs

| Metric | Target | Measurement | Frequency |
|--------|--------|------------|-----------|
| **Code Quality** | ESLint errors = 0 | Automated linting | Per commit |
| **Test Coverage** | ≥ 80% | Vitest coverage report | Per PR |
| **Build Time** | < 30 seconds | CI/CD pipeline | Per commit |
| **Deployment Time** | < 5 minutes | CI/CD pipeline | Per release |
| **Bug Rate** | < 5 bugs/1000 LOC | Bug tracking | Per sprint |

### Performance KPIs

| Metric | Target | Measurement | Frequency |
|--------|--------|------------|-----------|
| **Page Load Time** | < 2 seconds | Lighthouse/WebPageTest | Weekly |
| **API Response Time** | < 500ms (p95) | Application monitoring | Real-time |
| **Database Query Time** | < 200ms (p95) | Supabase dashboard | Real-time |
| **Uptime** | ≥ 99.9% | Uptime monitoring | Real-time |
| **Error Rate** | < 0.1% | Error tracking | Real-time |

### User Experience KPIs

| Metric | Target | Measurement | Frequency |
|--------|--------|------------|-----------|
| **User Satisfaction** | ≥ 4.0/5.0 | User surveys | Monthly |
| **Task Completion Rate** | ≥ 90% | User testing | Monthly |
| **Time to First Value** | < 5 minutes | User onboarding | Monthly |
| **Support Ticket Volume** | < 10 tickets/week | Support system | Weekly |
| **Feature Adoption** | ≥ 60% | Analytics | Monthly |

### Business KPIs

| Metric | Target | Measurement | Frequency |
|--------|--------|------------|-----------|
| **Case Resolution Time** | < 24 hours | Case analytics | Daily |
| **Invoice Processing Time** | < 48 hours | Invoice analytics | Daily |
| **Payment Approval Time** | < 72 hours | Payment analytics | Daily |
| **Vendor Onboarding Time** | < 7 days | Relationship analytics | Weekly |
| **System Utilization** | ≥ 80% | Usage analytics | Monthly |

### MCP Productivity KPIs

| Metric | Target | Measurement | Frequency |
|--------|--------|------------|-----------|
| **Database Operations via MCP** | ≥ 80% | MCP usage logs | Weekly |
| **Code Search via MCP** | ≥ 90% | MCP usage logs | Weekly |
| **Error Resolution via MCP** | ≥ 70% | MCP usage logs | Weekly |
| **Migration Execution via MCP** | 100% | MCP usage logs | Per migration |

---

## 🔐 Critical Control Points (CCP)

### CCP Gates (Must Pass Before Proceeding)

| CCP | Gate | Verification | Status |
|-----|------|--------------|--------|
| **CCP-1** | Schema migrations exist | All migrations in `migrations/` | ✅ PASS |
| **CCP-2** | Adapter has all CRUD functions | `nexusAdapter` complete | ✅ PASS |
| **CCP-3** | Routes match adapter functions | Routes use adapter | ✅ PASS |
| **CCP-4** | Templates match routes | Templates exist for routes | ✅ PASS |
| **CCP-5** | Migrations executed on Supabase | All migrations applied | ✅ PASS |
| **CCP-6** | Demo seed data inserted | Seed scripts executed | ✅ PASS |
| **CCP-7** | Supabase Auth integration working | OAuth + Email auth | ✅ PASS |
| **CCP-8** | All validation checks pass | Guardrails pass | ✅ PASS |
| **CCP-9** | Legacy removal complete | No `vmpAdapter` references | ✅ PASS |
| **CCP-10** | Realtime validated | Two-session test passed | ✅ PASS |
| **CCP-11** | CRUD-S pattern implemented | Soft delete on all tables | ✅ PASS |
| **CCP-12** | RLS policies enforced | All tables have RLS | ✅ PASS |
| **CCP-13** | Template system operational | Templates + scaffold working | ✅ PASS |
| **CCP-14** | Test coverage ≥ 80% | Vitest coverage report | ⏳ IN PROGRESS |
| **CCP-15** | Performance benchmarks met | All KPIs within target | ⏳ IN PROGRESS |
| **CCP-16** | Template drift check | Templates match Express SSR patterns | ⏳ IN PROGRESS |

### CCP Verification Process

1. **Pre-Development:** Verify CCP-1 through CCP-5
2. **During Development:** Verify CCP-6 through CCP-10
3. **Pre-Release:** Verify CCP-11 through CCP-16
4. **Post-Release:** Monitor KPIs and update CCP status

### CCP-16: Template Drift Check

**Purpose:** Ensure templates remain aligned with Express SSR architecture and don't drift to Next.js or other patterns.

**Verification Checklist:**
- [ ] Route templates use Express Router (`express.Router()`), not Next.js App Router
- [ ] Route templates use `res.render()` for SSR, not `NextResponse.json()`
- [ ] Service templates extend `BaseRepository` correctly
- [ ] Migration templates include CRUD-S columns (`deleted_at`, `deleted_by`)
- [ ] Migration templates include optional `case_id` for case linkage
- [ ] View templates use Nunjucks syntax (`{% extends %}`, `{{ var }}`)
- [ ] No Next.js imports (`NextResponse`, `createClient` from `@/utils/supabase/server`)
- [ ] All routes use `nexusAdapter`, never direct Supabase calls
- [ ] Tenant isolation uses `requireTenant` middleware
- [ ] Storage patterns include signed URL generation

**Frequency:** Before each release, after major template updates

---

## 📋 Architecture Principles

### Non-Negotiable Principles

1. **Everything Is a Case** - No orphan messages, files, or approvals
2. **CRUD Verbs Stay CRUD** - Business meaning never replaces CRUD semantics
3. **Business Meaning Lives in ENUMs** - Per-entity, not global
4. **Decisions Are Events** - History is append-only, state is derived
5. **Tenant Isolation Is Absolute** - Enforced by RLS, never UI logic
6. **Evidence First, Always** - State progression requires evidence
7. **Route-First Architecture** - All HTML rendered via `res.render()`
8. **Adapter Pattern** - Database access through `nexusAdapter` only
9. **Template-Driven Development** - Use templates for consistency
10. **Security by Default** - CRUD-S, RLS, validation built-in

---

## 🚀 Deployment Strategy

### Environments

| Environment | Purpose | URL | Database |
|-------------|---------|-----|----------|
| **Development** | Local development | `localhost:3000` | Local Supabase |
| **Staging** | Pre-production testing | `staging.nexuscanon.com` | Staging Supabase |
| **Production** | Live system | `app.nexuscanon.com` | Production Supabase |

### Deployment Process

1. **Development:** Local development with hot reload
2. **Staging:** Automated deployment on merge to `develop` branch
3. **Production:** Manual deployment approval required
4. **Rollback:** Automated rollback on failure

### CI/CD Pipeline

```yaml
# Simplified pipeline
1. Lint & Format Check
2. Unit Tests
3. Integration Tests
4. E2E Tests
5. Build Verification
6. Deploy to Staging
7. Smoke Tests
8. Deploy to Production (manual approval)
9. Post-Deployment Verification
```

---

## 📚 Related Documentation

### Core Documents
- [`ARCHITECTURE_ASSESSMENT_AND_RECOMMENDATIONS.md`](./architecture/ARCHITECTURE_ASSESSMENT_AND_RECOMMENDATIONS.md) - Clean stack architecture
- [`TEMPLATE_CONSTITUTION.md`](./architecture/TEMPLATE_CONSTITUTION.md) - Template system governance
- [`SOFT_DELETE_CRUD_S_ARCHITECTURE.md`](./architecture/SOFT_DELETE_CRUD_S_ARCHITECTURE.md) - CRUD-S pattern

### CCP Documents
- [`___NEXUS_VMP_CLIENT_MASTERCCP.md`](../../archive/___NEXUS_VMP_CLIENT_MASTERCCP.md) - Client portal CCP
- [`___NEXUS_VMP_VENDOR_MASTERCCP.md`](../../archive/___NEXUS_VMP_VENDOR_MASTERCCP.md) - Vendor portal CCP

### MCP Documents
- [`MCP_SETUP.md`](./integrations/mcp/MCP_SETUP.md) - MCP configuration
- [`SUPABASE_MCP_GUIDE.md`](./integrations/supabase/SUPABASE_MCP_GUIDE.md) - Supabase MCP usage

---

## ✅ PRD Compliance Checklist

- [x] Technical stack defined and locked
- [x] MCP utilization strategy documented
- [x] Entry points identified
- [x] Scope boundaries clear (IN/OUT)
- [x] Definition of Done established
- [x] KPIs defined and measurable
- [x] CCP gates documented
- [x] Architecture principles stated
- [x] Deployment strategy defined
- [x] Related documentation linked

---

**Document Status:** ✅ **Production-Ready**  
**Last Updated:** 2025-01-22  
**Version:** 1.0.0  
**Owner:** Product + Engineering  
**Next Review:** After first production release

