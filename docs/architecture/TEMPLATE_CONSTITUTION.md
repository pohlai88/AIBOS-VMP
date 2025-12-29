# Template Constitution

**Project:** AIBOS-VMP (Vendor Management Platform)  
**Date:** 2025-01-22  
**Status:** ✅ **System-Grade Template Doctrine**  
**Version:** 1.1.0 (Governance Hardened)

---

## 📋 Preamble

This document establishes the **Template Constitution** - the foundational governance framework for all template systems in AIBOS-VMP. Templates are not mere developer conveniences; they are **institutional-grade engineering standards** that enforce security, sustainability, and consistency.

---

## 🎯 Core Principles

### 1. Templates as Contracts

**Principle:** Templates are **explicit contracts**, not suggestions.

**Enforcement:**
- Every template includes a **Template Contract** header
- Contract headers declare: Type, Category, Domain, Enforced Patterns, Version
- Modifying templates requires updating documentation and version

**Rationale:** Prevents pattern drift and ensures institutional memory.

---

### 2. Dual Template System

**Principle:** View templates and Application templates serve different purposes and must remain separate.

**Structure:**
- **View Templates** (`src/views/templates/`) → Presentation contracts
- **Application Templates** (`src/templates/`) → Operational & security contracts

**Rationale:** Keeps UI iteration fast while keeping backend rules strict.

---

### 3. Domain Awareness

**Principle:** All templates must declare their domain context.

**Domains:**
- `finance` - Financial transactions, invoices, payments
- `vendor` - Vendor management, relationships
- `client` - Client management, cases
- `compliance` - Audit, governance, regulatory
- `system` - Infrastructure, configuration

**Enforcement:**
- Scaffold script requires domain parameter
- Templates inject domain into generated code
- Domain used for future governance and policy enforcement

---

### 4. State Transition Validation

**Principle:** Entities with status fields must enforce valid state transitions.

**Enforcement:**
- Service templates include `ALLOWED_TRANSITIONS` constant
- `assertTransition()` method validates transitions
- Tests verify transition rules

**Rationale:** Prevents invalid state changes that violate business logic.

---

### 5. Trust Level Declaration

**Principle:** View templates must declare their trust level and data access patterns.

**Trust Levels:**
- `Public` - No authentication required
- `Authenticated` - Standard user access
- `Privileged` - Admin/role-based access
- `System` - Internal only

**Data Access:**
- `Read-Only` - No data modifications
- `Writes Data` - Form submissions, state changes
- `Sensitive` - Contains sensitive information

**Rationale:** Prevents misuse and security violations.

---

## 🚫 Non-Negotiables

### Application Templates

1. **DO NOT bypass Application Templates** - All new entities must use templates
2. **DO NOT add tables without CRUD-S** - `deleted_at`, `deleted_by` required
3. **DO NOT disable RLS** - Row Level Security is mandatory
4. **DO NOT skip validation** - Zod schemas required for all inputs
5. **DO NOT remove auth guards** - Authentication required for all routes
6. **DO NOT modify templates directly** - Templates are read-only references
7. **DO NOT skip state transitions** - If entity has status, define transitions

### View Templates

1. **DO NOT use inline styles** - CONTRACT-001 compliance required
2. **DO NOT create partials without trust level** - Trust level declaration required
3. **DO NOT bypass HTMX patterns** - Use HTMX for dynamic updates
4. **DO NOT create orphan views** - All views must have corresponding routes

### General

1. **DO NOT commit templates with placeholders** - Replace all `{{...}}` before committing
2. **DO NOT skip documentation updates** - Template changes require doc updates
3. **DO NOT deviate without justification** - Document any deviations

---

## 📐 Template Contract Structure

### Application Template Contract Header

```javascript
/**
 * ============================================================================
 * TEMPLATE CONTRACT
 * ============================================================================
 * Type: Application
 * Category: Service Layer | API Route | Migration | Test
 * Domain: finance | vendor | client | compliance | system
 * Enforces: CRUD-S, RLS, Validation, State Transitions
 * 
 * DO NOT MODIFY WITHOUT UPDATING:
 * - docs/architecture/APPLICATION_TEMPLATE_SYSTEM.md
 * - docs/architecture/TEMPLATE_CONSTITUTION.md
 * - Version below
 * 
 * Version: 1.0.0
 * Last Updated: YYYY-MM-DD
 * ============================================================================
 */
```

### View Template Contract Header

```html
{# ============================================================================
   VIEW CONTRACT
   ============================================================================
   Type: View
   Category: Full Page | HTMX Partial
   Trust Level: Public | Authenticated | Privileged | System
   Writes Data: Yes | No
   Domain: finance | vendor | client | compliance | system
   Safe for Reuse: Yes | No
   
   DO NOT MODIFY WITHOUT UPDATING:
   - docs/architecture/TEMPLATE_PATTERN_GUIDE.md
   - docs/architecture/TEMPLATE_CONSTITUTION.md
   
   Version: 1.0.0
   Last Updated: YYYY-MM-DD
   ============================================================================ #}
```

---

## 🔐 Security Enforcement

### Automatic Security (Application Templates)

All generated code automatically includes:

1. **CRUD-S (Soft Delete)**
   - `deleted_at`, `deleted_by` columns
   - `softDelete()`, `restore()` methods
   - RLS policies hide deleted records

2. **Row Level Security (RLS)**
   - Tenant isolation
   - Active records only (soft delete aware)
   - Service role access for admin

3. **Input Validation**
   - Zod schemas
   - Type checking
   - Required fields

4. **Authentication**
   - Auth guards in routes
   - User context extraction
   - Tenant validation

5. **State Transitions** (if applicable)
   - `ALLOWED_TRANSITIONS` constant
   - `assertTransition()` validation
   - Transition tests

---

## 🏗️ Domain Architecture

### Domain Separation

**Purpose:** Enable future governance, policy enforcement, and Canon/Cell evolution.

**Current Domains:**
- `finance` - Financial operations
- `vendor` - Vendor management
- `client` - Client management
- `compliance` - Regulatory compliance
- `system` - Infrastructure

**Future Evolution:**
- Domain-specific policies
- Canon separation by domain
- Cross-domain rules
- Domain-specific audit requirements

---

## 📋 State Transition Pattern

### Standard Pattern

```javascript
static ALLOWED_TRANSITIONS = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['POSTED', 'REJECTED'],
  REJECTED: ['DRAFT'], // Allow resubmission
  POSTED: [], // Terminal state
  CANCELLED: [], // Terminal state
};
```

### Usage

```javascript
// Validate before transition
this.assertTransition(currentStatus, 'APPROVED');

// Get allowed next states
const allowed = service.getAllowedTransitions('SUBMITTED');
// Returns: ['APPROVED', 'REJECTED', 'CANCELLED']
```

---

## 🎓 Template Usage Workflow

### Step 1: Generate Files

```bash
# With domain awareness
node scripts/scaffold.js finance Invoice invoices
```

### Step 2: Replace Placeholders

- `{{EntityName}}` → `Invoice`
- `{{entity-name}}` → `invoice`
- `{{table_name}}` → `invoices`
- `{{Domain}}` → `finance`

### Step 3: Customize

- Add entity-specific fields
- Define state transitions (if applicable)
- Add business logic methods
- Customize validation schemas

### Step 4: Verify

- All placeholders replaced
- State transitions defined (if applicable)
- Tests written
- Documentation updated

---

## 🔍 Pattern Validation (Future)

### Meta-Tests

Future enhancement: Pattern tests that validate:

- Every table has `deleted_at` column
- Every service filters deleted records
- Every route uses auth guard
- Every entity with status has transition rules
- Every view declares trust level

**Status:** 🔄 Planned (not blocking)

---

## 📊 Template Versioning

### Version Format

- **Major** (X.0.0) - Breaking changes to template structure
- **Minor** (0.X.0) - New features, non-breaking changes
- **Patch** (0.0.X) - Bug fixes, documentation updates

### Version Update Process

1. Identify change needed
2. Update template file
3. Update version in contract header
4. Update documentation
5. Notify team
6. Update existing code if critical

---

## 🚨 Violation Consequences

### Template Violations

**Severity Levels:**

1. **Critical** - Security or data integrity risk
   - Bypass CRUD-S
   - Disable RLS
   - Skip validation
   - **Action:** Immediate fix required

2. **High** - Pattern drift or inconsistency
   - Modify template without documentation
   - Skip domain declaration
   - Skip state transitions
   - **Action:** Fix in next sprint

3. **Medium** - Documentation or process
   - Missing contract header
   - Outdated documentation
   - **Action:** Fix during code review

---

## 📚 Related Documentation

### Core Documents
- [`APPLICATION_TEMPLATE_SYSTEM.md`](./APPLICATION_TEMPLATE_SYSTEM.md) - Complete application template guide
- [`TEMPLATE_PATTERN_GUIDE.md`](./TEMPLATE_PATTERN_GUIDE.md) - General template pattern
- [`TEMPLATE_SYSTEM_SUMMARY.md`](./TEMPLATE_SYSTEM_SUMMARY.md) - System overview

### Architecture
- [`SOFT_DELETE_CRUD_S_ARCHITECTURE.md`](./SOFT_DELETE_CRUD_S_ARCHITECTURE.md) - CRUD-S pattern
- [`ARCHITECTURE_ASSESSMENT_AND_RECOMMENDATIONS.md`](./ARCHITECTURE_ASSESSMENT_AND_RECOMMENDATIONS.md) - Clean stack

---

## ✅ Constitution Checklist

### Template Files
- [ ] All templates have contract headers
- [ ] Contract headers include domain
- [ ] Contract headers include version
- [ ] Contract headers include enforcement list

### Service Templates
- [ ] State transition pattern included
- [ ] `assertTransition()` method present
- [ ] Domain constant declared

### Route Templates
- [ ] Domain context included
- [ ] Validation schemas present
- [ ] Auth guards present

### Migration Templates
- [ ] CRUD-S columns included
- [ ] RLS policies included
- [ ] Partial indexes included
- [ ] Domain in comments

### View Templates
- [ ] Trust level declared
- [ ] Data access pattern declared
- [ ] Domain specified

### Documentation
- [ ] Non-Negotiables section present
- [ ] Template Constitution created
- [ ] Usage workflows documented

---

**Document Status:** ✅ **System-Grade Template Doctrine**  
**Last Updated:** 2025-01-22  
**Version:** 1.1.0 (Governance Hardened)  
**Owner:** Architecture Team  
**Next Review:** After first major template evolution

