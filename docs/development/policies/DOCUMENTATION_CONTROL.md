# Documentation Control System

**Version:** 1.0.0  
**Last Updated:** 2025-12-28  
**Purpose:** Control mechanisms for documentation standards enforcement  
**Status:** Active

---

## Control System Overview

This document defines the control mechanisms that enforce documentation standards and naming conventions.

---

## Automated Validation

### Validation Script

**Command:** `npm run validate:docs`  
**Script:** `scripts/validate-docs-naming.mjs`

**Checks:**
- ✅ File naming: SCREAMING_SNAKE_CASE
- ✅ Directory naming: kebab-case
- ✅ Directory structure: Only allowed directories
- ✅ Root files: Only allowed files in docs root
- ✅ Subdirectory structure: Only allowed subdirectories

**Usage:**
```bash
# Validate all documentation
npm run validate:docs

# Validate as part of full validation
npm run validate:all
```

**Exit Codes:**
- `0` - All files compliant
- `1` - Violations found

---

## Registry System

### Documentation Registry

**File:** `docs/DOCUMENTATION_REGISTRY.md`

**Purpose:**
- Complete inventory of all documentation
- Metadata tracking (version, status, purpose)
- Compliance tracking
- Quick reference guide

**Requirements:**
- **ALL** documentation files **MUST** be registered
- Registry **MUST** be updated when adding/removing files
- Registry **MUST** be kept current

---

## Naming Convention Enforcement

### File Naming Rules

**Format:** `CATEGORY_SPECIFIC_NAME[_VERSION][_STATUS].md`

**Required:**
- SCREAMING_SNAKE_CASE (uppercase, underscores)
- Descriptive name (not generic)
- `.md` extension

**Forbidden:**
- Lowercase
- camelCase
- kebab-case
- Spaces
- Special characters (except `_`)

**Examples:**
- ✅ `AI_ASSISTANT_CONSISTENCY_PROTOCOL.md`
- ✅ `DESIGN_SYSTEM_V2_PRODUCTION_READY.md`
- ❌ `ai-assistant-consistency.md` (kebab-case)
- ❌ `AiAssistantConsistency.md` (PascalCase)
- ❌ `ai_assistant_consistency.md` (lowercase)

### Directory Naming Rules

**Format:** `kebab-case` (lowercase with hyphens)

**Required:**
- Lowercase
- Hyphens for word separation
- Short, clear names

**Forbidden:**
- PascalCase
- snake_case
- Spaces
- Special characters (except `-`)

**Examples:**
- ✅ `design-system/`
- ✅ `error-handling/`
- ✅ `workflows/`
- ❌ `DesignSystem/` (PascalCase)
- ❌ `design_system/` (snake_case)
- ❌ `Design System/` (spaces)

---

## Directory Structure Control

### Allowed Top-Level Directories

**In `docs/`:**
- `architecture/` - System architecture
- `design-system/` - Design system docs
- `development/` - Development guides
- `integrations/` - Integration guides

**Forbidden:**
- Creating new top-level directories without approval
- Files directly in `docs/` (except allowed root files)

### Allowed Subdirectories

**In `docs/development/`:**
- `workflows/` - Development workflows
- `guides/` - Setup and usage guides
- `policies/` - Development policies
- `error-handling/` - Error handling patterns

**In `docs/integrations/`:**
- `supabase/` - Supabase integrations
- `mcp/` - MCP integrations
- `services/` - Other service integrations

**Forbidden:**
- Creating new subdirectories without updating this control document
- Nested subdirectories beyond 2 levels

---

## Pre-Commit Controls

### Required Checks

Before committing documentation changes:

1. **Run Validation:**
   ```bash
   npm run validate:docs
   ```

2. **Update Registry:**
   - Add new files to `DOCUMENTATION_REGISTRY.md`
   - Update metadata for modified files
   - Mark deprecated files as "Archived"

3. **Verify Naming:**
   - File names: SCREAMING_SNAKE_CASE
   - Directory names: kebab-case
   - No violations

4. **Check Structure:**
   - Files in correct subdirectories
   - No files in docs root (except allowed)
   - No unauthorized directories

---

## CI/CD Integration

### GitHub Actions (Recommended)

Add to `.github/workflows/docs-validation.yml`:

```yaml
name: Documentation Validation

on:
  pull_request:
    paths:
      - 'docs/**'
      - 'scripts/validate-docs-naming.mjs'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run validate:docs
```

---

## Enforcement Levels

### Level 1: Warning (Development)
- Validation script reports violations
- Developer fixes before committing

### Level 2: Blocking (Pre-Commit)
- Pre-commit hook runs validation
- Commit blocked if violations found

### Level 3: CI/CD (Pull Request)
- GitHub Actions runs validation
- PR blocked if violations found

---

## Violation Resolution

### When Violations Are Found

1. **Identify:** Run `npm run validate:docs`
2. **Fix:** Rename files/directories to comply
3. **Update Registry:** Update `DOCUMENTATION_REGISTRY.md`
4. **Verify:** Re-run validation
5. **Commit:** Only commit when 100% compliant

### Common Violations

**File Naming:**
- `design-system.md` → `DESIGN_SYSTEM.md`
- `figma-mcp.md` → `FIGMA_MCP_INTEGRATION_GUIDE.md`
- `test.md` → `TESTING_GUIDE.md`

**Directory Naming:**
- `DesignSystem/` → `design-system/`
- `design_system/` → `design-system/`
- `Design System/` → `design-system/`

---

## Maintenance

### Regular Tasks

**Weekly:**
- Run validation script
- Check registry completeness
- Archive obsolete docs

**Monthly:**
- Review directory structure
- Consolidate related docs
- Update registry metadata

**Quarterly:**
- Full documentation audit
- Remove deprecated docs
- Update control mechanisms

---

## Quick Reference

### Validation Commands

```bash
# Validate documentation naming
npm run validate:docs

# Validate everything (code + docs)
npm run validate:all
```

### Registry Management

```bash
# View registry
cat docs/DOCUMENTATION_REGISTRY.md

# Count registered files
grep -c "| File |" docs/DOCUMENTATION_REGISTRY.md
```

### Finding Documentation

```bash
# Find by category
ls docs/architecture/
ls docs/design-system/
ls docs/development/workflows/

# Find by name pattern
find docs -name "*MCP*"
find docs -name "*ERROR*"
```

---

**Control System Status:** ✅ Active  
**Validation Script:** ✅ Operational  
**Registry:** ✅ Complete  
**Compliance:** 100%

