# Consolidated PRD with CCP Boundaries

**Document ID:** PRD-VMP-CONSOLIDATED-001  
**Version:** 1.0.0  
**Status:** ✅ Production-Ready  
**Date:** 2025-01-22  
**Owner:** Product + Engineering  
**Last Updated:** 2025-01-22

---

## 📋 Executive Summary

This consolidated PRD organizes all development work into **four clear boundaries** to enable parallel development without confusion:

1. **Frontend UI/UX** - HTMX, Alpine.js, Nunjucks templates, Design system
2. **Backend Logic** - Express routes, Adapter layer, Business logic, Validation
3. **Utils** - Shared utilities, Helpers, Validators, Logging
4. **DB-Metadata-Schema** - Database schema, Metadata governance, Schema evolution (ISOLATED - Deferred to next dev phase)

**This PRD serves as the single source of truth for active development work, with DB-Metadata-Schema isolated for future implementation.**

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

---

## 🚧 Development Boundaries

### Boundary 1: Frontend UI/UX

**Scope:** All user-facing interface components, templates, and interactions.

**Components:**
- HTMX integration patterns
- Alpine.js component logic
- Nunjucks template rendering
- Design system compliance
- Component patterns library
- Utility class usage
- Responsive design patterns

**File Locations:**
- `src/views/` - All templates (pages, partials)
- `public/css/` - Stylesheets
- `public/js/` - Client-side scripts
- `docs/design-system/` - Design system documentation

**CCP Gates:**
- [ ] All templates use Nunjucks syntax (`{% extends %}`, `{{ var }}`)
- [ ] All dynamic updates use HTMX (no vanilla JS for DOM manipulation)
- [ ] All templates follow design system contracts
- [ ] All components are mobile-responsive
- [ ] All templates use VMP semantic classes for data presentation

**Related PRDs:**
- `PRD_MAIN.md` - Main PRD with stack details
- `docs/design-system/` - Design system specifications

---

### Boundary 2: Backend Logic

**Scope:** Server-side routes, business logic, data processing, and API endpoints.

**Components:**
- Express route handlers
- Adapter layer (`nexusAdapter`)
- Business logic services
- Input validation
- Authentication/authorization middleware
- Error handling
- API endpoints (JSON responses)

**File Locations:**
- `src/routes/` - Route handlers
- `src/adapters/` - Database adapters
- `src/services/` - Business logic services
- `src/middleware/` - Middleware functions
- `src/schemas/` - Validation schemas (Zod)

**CCP Gates:**
- [ ] All routes use `nexusAdapter` (never direct Supabase calls)
- [ ] All routes use `requireNexusAuth` and `requireTenant` middleware
- [ ] All inputs validated with Zod schemas
- [ ] All errors handled with proper status codes
- [ ] All routes follow template patterns
- [ ] All business logic in services (not routes)

**Related PRDs:**
- `PRD_MAIN.md` - Main PRD with architecture principles
- `PRD_VENDOR_ADVANCED_FEATURES.md` - Advanced features
- `PRD_VENDOR_PORTAL.md` - Vendor portal features

---

### Boundary 3: Utils

**Scope:** Shared utilities, helpers, validators, and cross-cutting concerns.

**Components:**
- UUID validators
- Date/time utilities
- String formatters
- Logging utilities
- Error formatters
- Common helpers

**File Locations:**
- `src/utils/` - All utility functions
- Shared across Frontend, Backend, and DB layers

**CCP Gates:**
- [ ] All utilities are pure functions (no side effects)
- [ ] All utilities have unit tests
- [ ] All utilities are documented with JSDoc
- [ ] No business logic in utilities (only helpers)

**Related PRDs:**
- `PRD_MAIN.md` - Main PRD with testing requirements

---

### Boundary 4: DB-Metadata-Schema (ISOLATED - DEFERRED)

**⚠️ IMPORTANT:** This boundary is **ISOLATED** and **DEFERRED** to the next development phase. Do not implement database schema changes or metadata governance features in the current development cycle.

**Scope:** Database schema design, metadata governance, schema evolution, migrations.

**Components:**
- Database migrations
- Schema guardrails
- JSONB contract registry
- RLS policies
- Metadata governance
- Schema evolution patterns

**File Locations:**
- `migrations/` - Database migration files
- `docs/ssot/db/` - Database guardrail matrices
- `docs/development/prds/PRD_DB_SCHEMA.md` - Database PRD (reference only)

**Status:** ✅ **L1 Documented** - Fully documented, ready for L2 Enforced upgrade

**Current State:**
- ✅ All 20 tables documented in guardrail matrix
- ✅ All 21 JSONB contracts registered
- ✅ All 20 RLS policies documented
- ✅ 100% coverage on all checks
- ⚠️ **Not yet connected to live database** (L2 upgrade pending)

**Deferred Work:**
- ❌ New database migrations (unless critical bug fix)
- ❌ Schema changes (unless critical bug fix)
- ❌ Metadata governance implementation
- ❌ Schema evolution features

**When to Implement:**
- After Frontend, Backend, and Utils boundaries are complete
- When L2 Enforced upgrade is ready (connect drift checks to live DB)
- When new features require schema changes (follow guardrail matrix)

**Related PRDs:**
- `PRD_DB_SCHEMA.md` - Complete database architecture PRD (reference)
- `docs/ssot/db/DB_GUARDRAIL_MATRIX.md` - Guardrail matrix (SSOT)
- `docs/ssot/db/L2_L3_UPGRADE_PATH.md` - Upgrade path guide

---

## 🔐 Critical Control Points (CCP)

### CCP Gates by Boundary

#### Frontend UI/UX CCPs
- **CCP-F1:** All templates use Nunjucks syntax
- **CCP-F2:** All dynamic updates use HTMX
- **CCP-F3:** All templates follow design system contracts
- **CCP-F4:** All components are mobile-responsive

#### Backend Logic CCPs
- **CCP-B1:** All routes use `nexusAdapter`
- **CCP-B2:** All routes use authentication middleware
- **CCP-B3:** All inputs validated with Zod
- **CCP-B4:** All errors handled properly

#### Utils CCPs
- **CCP-U1:** All utilities are pure functions
- **CCP-U2:** All utilities have unit tests
- **CCP-U3:** All utilities are documented

#### DB-Metadata-Schema CCPs (Deferred)
- **CCP-D1:** No schema changes in current phase
- **CCP-D2:** Reference `PRD_DB_SCHEMA.md` for future work
- **CCP-D3:** Follow guardrail matrix when implementing

---

## 📊 Development Priority

### Phase 1: Active Development (Current)

1. **Frontend UI/UX** - Implement user interfaces
2. **Backend Logic** - Implement business logic and routes
3. **Utils** - Implement shared utilities

### Phase 2: Deferred (Next Dev Cycle)

4. **DB-Metadata-Schema** - Schema evolution and metadata governance

---

## 📚 Related Documentation

### Active PRDs
- `PRD_MAIN.md` - Main PRD with complete stack and CCP details
- `PRD_VENDOR_ADVANCED_FEATURES.md` - Advanced vendor features
- `PRD_VENDOR_PORTAL.md` - Vendor portal features

### Analysis Documents (Not PRDs)
- `DEVELOPMENT_READINESS_ANALYSIS.md` - Analysis of PRDs awaiting development and DB schema readiness

### Deferred PRDs (Reference Only)
- `PRD_DB_SCHEMA.md` - Database architecture PRD (isolated, deferred)

### Architecture Documents
- `docs/architecture/` - Architecture patterns and guides
- `docs/design-system/` - Design system specifications
- `docs/ssot/db/` - Database guardrail matrices (SSOT)

---

## ✅ Definition of Done (DoD)

### For Frontend UI/UX
- [ ] Templates render correctly
- [ ] HTMX interactions work
- [ ] Design system compliance verified
- [ ] Mobile-responsive tested
- [ ] No linter errors

### For Backend Logic
- [ ] Routes work correctly
- [ ] Adapter layer used
- [ ] Validation implemented
- [ ] Error handling complete
- [ ] Tests passing

### For Utils
- [ ] Functions are pure
- [ ] Unit tests written
- [ ] Documentation complete
- [ ] No side effects

### For DB-Metadata-Schema (Deferred)
- [ ] **NOT APPLICABLE** - Deferred to next phase

---

**Document Status:** ✅ Production-Ready  
**Last Updated:** 2025-01-22  
**Next Review:** After Phase 1 completion

