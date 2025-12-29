# Template Pattern Guide

**Project:** AIBOS-VMP (Vendor Management Platform)  
**Date:** 2025-01-22  
**Status:** ✅ **Active**  
**Context:** Comprehensive guide to the Template Pattern for sustainability

---

## 📋 Overview

The **Template Pattern** is a foundational architectural concept that ensures consistency, sustainability, and maintainability across the AIBOS-VMP codebase. Templates serve as **read-only reference files** that developers copy and customize for new implementations.

**Version:** 1.1.0 (Governance Hardened)  
**Status:** System-Grade Template Doctrine

---

## 🚫 Non-Negotiables

**These rules are mandatory:**

1. **DO NOT modify templates directly** - Templates are read-only references
2. **DO NOT skip placeholder replacement** - All `{{...}}` must be replaced
3. **DO NOT remove security patterns** - RLS, auth, validation are required
4. **DO NOT bypass BaseRepository** inheritance
5. **DO NOT commit template files** with placeholders
6. **DO NOT skip domain declaration** - Domain context required
7. **DO NOT skip state transitions** - If entity has status, define transitions
8. **DO NOT skip trust level** - View templates must declare trust level

---

## 🎯 Purpose

### Why Templates?

1. **Consistency** - All new code follows standardized patterns
2. **Sustainability** - Long-term maintainability through proven patterns
3. **Onboarding** - New developers have clear starting points
4. **Quality** - Best practices enforced at template level
5. **Efficiency** - Faster development with proven patterns

---

## 📂 Template Locations

```
src/views/templates/          # View templates (Nunjucks) ✅ EXISTS
src/routes/templates/         # Route templates ✅ CREATED
src/services/templates/       # Service templates (future)
migrations/templates/         # Migration templates ✅ CREATED
docs/templates/               # Documentation templates ✅ CREATED
tests/templates/              # Test templates ✅ CREATED
```

---

## 🏗️ Template Types

### 1. View Templates (`src/views/templates/`)

**Status:** ✅ **IMPLEMENTED**

**Files:**
- `page-boilerplate.html` - Full page layout template
- `partial-boilerplate.html` - HTMX-swappable partial template

**Usage:**
```bash
# Create new page
cp src/views/templates/page-boilerplate.html src/views/pages/my_page.html
# Edit my_page.html (template remains unchanged)
```

**Features:**
- CONTRACT-001 compliant (semantic `.vmp-*` classes)
- Route-first structure
- HTMX integration patterns
- Empty state handling
- Loading indicators

### 2. Route Templates (`src/routes/templates/`)

**Status:** ✅ **CREATED**

**File:** `route-template.js`

**Usage:**
```bash
# Create new route file
cp src/routes/templates/route-template.js src/routes/my-entity.js
# Customize: Replace 'entity' with your entity name
```

**Features:**
- Standard CRUD-S operations (Create, Read, Update, Soft-Delete)
- Authentication middleware
- Error handling
- Input validation
- UUID validation
- Tenant isolation
- Logging

**Pattern:**
```javascript
// Standard route structure
router.get('/entity', requireAuth, async (req, res) => {
  // List entities
});

router.get('/entity/:id', requireAuth, async (req, res) => {
  // Get single entity
});

router.post('/entity', requireAuth, async (req, res) => {
  // Create entity
});

router.put('/entity/:id', requireAuth, async (req, res) => {
  // Update entity
});

router.delete('/entity/:id', requireAuth, async (req, res) => {
  // Soft delete entity
});

router.post('/entity/:id/restore', requireRole('admin'), async (req, res) => {
  // Restore entity (admin only)
});
```

### 3. Service Templates (`src/services/templates/`)

**Status:** 🔄 **PLANNED**

**Pattern:** Extend `BaseRepository` for entity-specific services

**Example:**
```javascript
import { BaseRepository } from '../core/base-repository.js';

export class EntityService extends BaseRepository {
  constructor(supabase) {
    super(supabase, 'table_name');
  }
  
  // Entity-specific methods
  async findByCustomField(field) {
    // Custom query
  }
}
```

### 4. Migration Templates (`migrations/templates/`)

**Status:** ✅ **CREATED**

**File:** `migration-template.sql`

**Usage:**
```bash
# Create new migration
cp migrations/templates/migration-template.sql migrations/052_my_migration.sql
# Customize: Fill in sections, add SQL statements
```

**Features:**
- Standardized structure
- Prerequisites checklist
- Section organization
- Comments and documentation
- Rollback instructions (optional)

**Structure:**
```sql
-- Migration: [Description]
-- Created: YYYY-MM-DD
-- Description: [What this migration does]
-- Purpose: [Why this migration is needed]

-- ============================================================================
-- 1. [Section Name]
-- ============================================================================
-- SQL statements

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE table_name IS 'Description';
```

### 5. Documentation Templates (`docs/templates/`)

**Status:** ✅ **CREATED**

**File:** `documentation-template.md`

**Usage:**
```bash
# Create new documentation
cp docs/templates/documentation-template.md docs/my-document.md
# Customize: Fill in sections, add content
```

**Features:**
- Standardized metadata
- Executive summary
- Section organization
- Implementation checklist
- Related documentation links
- Version tracking

### 6. Test Templates (`tests/templates/`)

**Status:** ✅ **CREATED**

**File:** `test-template.js`

**Usage:**
```bash
# Create new test file
cp tests/templates/test-template.js tests/unit/my-feature.test.js
# Customize: Replace 'Feature Name' with your feature
```

**Features:**
- Standard test structure
- Setup/teardown patterns
- Arrange-Act-Assert pattern
- Edge case testing
- Integration testing patterns

---

## 📋 Template Usage Rules

### ✅ DO

1. **Copy templates** to create new files
2. **Customize copied files** for specific needs
3. **Keep templates updated** with best practices
4. **Document template changes** in architecture docs
5. **Use templates consistently** across the codebase

### ❌ DON'T

1. **Modify templates directly** (they are read-only references)
2. **Create files without templates** (unless justified)
3. **Deviate from template patterns** without documentation
4. **Remove templates** (they are architectural artifacts)
5. **Skip template sections** without good reason

---

## 🔧 Template Maintenance

### Responsibilities

- **Architecture Team** - Maintains template patterns
- **Developers** - Use templates for new code
- **Code Review** - Verify new code follows templates

### Update Process

1. **Identify Pattern Improvement** - Notice pattern that should be standardized
2. **Update Template File** - Modify template with new pattern
3. **Document Change** - Update architecture docs with rationale
4. **Notify Team** - Announce template update to team
5. **Update Existing Code** - If pattern is critical, update existing code

### Version Control

Templates are versioned with the architecture:
- Template changes = Architecture version bump
- Document template versions in architecture docs
- Track template usage in codebase

---

## 📊 Template Benefits

### Sustainability

- ✅ **Consistent Structure** - All code follows same patterns
- ✅ **Reduced Onboarding** - New developers learn patterns once
- ✅ **Easier Code Review** - Familiar patterns = faster reviews
- ✅ **Long-Term Maintainability** - Proven patterns = fewer bugs

### Quality

- ✅ **Best Practices** - Templates enforce good patterns
- ✅ **Error Handling** - Standard error handling built-in
- ✅ **Security** - Auth, RLS, validation patterns included
- ✅ **Performance** - Indexes, queries optimized in templates

### Efficiency

- ✅ **Faster Development** - Copy template, customize, done
- ✅ **Less Decision Fatigue** - Template provides structure
- ✅ **Reduced Bugs** - Proven patterns = fewer mistakes
- ✅ **Consistent API** - All routes follow same structure

---

## 🚀 Getting Started

### For New Features

1. **Identify Template Type** - Route, Service, View, Migration, Test, Doc
2. **Copy Template** - `cp template-file new-file`
3. **Customize** - Replace placeholders, add specific logic
4. **Follow Patterns** - Keep template structure intact
5. **Test** - Verify new code works correctly

### For Existing Code

1. **Review Against Templates** - Compare existing code to templates
2. **Refactor Gradually** - Update code to match templates over time
3. **Document Deviations** - If code can't follow template, document why
4. **Update Templates** - If pattern is better, update template

---

## 📚 Related Documentation

- [`ARCHITECTURE_ASSESSMENT_AND_RECOMMENDATIONS.md`](./ARCHITECTURE_ASSESSMENT_AND_RECOMMENDATIONS.md) - Clean stack architecture
- [`SOFT_DELETE_CRUD_S_ARCHITECTURE.md`](./SOFT_DELETE_CRUD_S_ARCHITECTURE.md) - Soft delete patterns
- [`.cursorrules`](../../.cursorrules) - IDE rules and standards

---

## ✅ Template Checklist

### View Templates
- [ ] `page-boilerplate.html` exists and is current
- [ ] `partial-boilerplate.html` exists and is current
- [ ] Templates follow CONTRACT-001 design system
- [ ] Templates include HTMX patterns

### Code Templates
- [ ] Route template created
- [ ] Service template created (planned)
- [ ] Adapter method template documented
- [ ] Templates include error handling
- [ ] Templates include authentication

### Migration Templates
- [ ] Migration template created
- [ ] Template includes prerequisites
- [ ] Template includes rollback instructions
- [ ] Template includes comments section

### Documentation Templates
- [ ] Documentation template created
- [ ] Template includes metadata section
- [ ] Template includes checklist
- [ ] Template includes related docs section

### Test Templates
- [ ] Test template created
- [ ] Template includes setup/teardown
- [ ] Template includes edge cases
- [ ] Template includes integration tests

---

**Document Status:** ✅ **Active**  
**Last Updated:** 2025-01-22  
**Version:** 1.0.0  
**Owner:** Architecture Team

