# Scripts Control System

**Version:** 1.0.0  
**Last Updated:** 2025-12-28  
**Purpose:** Control mechanisms for scripts standards enforcement  
**Status:** Active

---

## Control System Overview

This document defines the control mechanisms that enforce scripts standards, naming conventions, and organization.

---

## Automated Validation

### Validation Script

**Command:** `npm run validate:scripts`  
**Script:** `scripts/documented/validate-scripts.mjs`

**Checks:**
- ✅ Script naming: kebab-case
- ✅ Directory structure: Only allowed subdirectories
- ✅ Script organization: Documented vs Temporary
- ✅ Registry compliance: All scripts registered
- ✅ package.json references: All referenced scripts exist

**Usage:**
```bash
# Validate all scripts
npm run validate:scripts

# Validate as part of full validation
npm run validate:all
```

**Exit Codes:**
- `0` - All scripts compliant
- `1` - Violations found

---

## Registry System

### Scripts Registry

**File:** `scripts/documented/SCRIPTS_REGISTRY.md`

**Purpose:**
- Complete inventory of all documented scripts
- Usage instructions and examples
- Dependencies tracking
- Maintenance status
- Quick reference guide

**Requirements:**
- **ALL** documented scripts **MUST** be registered
- Registry **MUST** be updated when adding/removing scripts
- Registry **MUST** be kept current

---

## Naming Convention Enforcement

### Script Naming Rules

**Format:** `purpose-action[-target].ext`

**Required:**
- kebab-case (lowercase with hyphens)
- Descriptive name (not generic)
- Appropriate file extension (`.js`, `.mjs`, `.ts`, `.ps1`, `.sh`, `.bat`, `.sql`)

**Forbidden:**
- PascalCase
- camelCase
- SCREAMING_SNAKE_CASE
- Spaces
- Special characters (except `-` and `_`)

**Examples:**
- ✅ `apply-migrations.js`
- ✅ `create-super-admin.js`
- ✅ `validate-docs-naming.mjs`
- ✅ `check-db-health.js`
- ❌ `ApplyMigrations.js` (PascalCase)
- ❌ `applyMigrations.js` (camelCase)
- ❌ `APPLY_MIGRATIONS.js` (SCREAMING_SNAKE_CASE)
- ❌ `apply migrations.js` (spaces)

### Directory Naming Rules

**Format:** `kebab-case` (lowercase with hyphens)

**Required:**
- Lowercase
- Hyphens for word separation
- Short, clear names

**Allowed Subdirectories:**
- `documented/` - Production/utility scripts
- `temporary/` - One-time/cleanup scripts

**Forbidden:**
- Creating new subdirectories without approval
- Nested subdirectories beyond 1 level

---

## Directory Structure Control

### Allowed Structure

**In `scripts/`:**
- `documented/` - Documented/production scripts
- `temporary/` - Temporary/cleanup scripts

**Forbidden:**
- Scripts directly in `scripts/` root (except registry/README)
- Creating new subdirectories without updating this control document
- Nested subdirectories

### Script Organization Rules

**Documented Scripts (`scripts/documented/`):**
- Production-ready scripts
- Utility scripts
- Setup/configuration scripts
- Validation scripts
- Database migration scripts
- **MUST** be registered in `SCRIPTS_REGISTRY.md`

**Temporary Scripts (`scripts/temporary/`):**
- One-time use scripts
- Cleanup scripts
- Test helpers
- Development utilities
- **SHOULD** be reviewed and cleaned daily

---

## Pre-Commit Controls

### Required Checks

Before committing script changes:

1. **Run Validation:**
   ```bash
   npm run validate:scripts
   ```

2. **Update Registry:**
   - Add new documented scripts to `SCRIPTS_REGISTRY.md`
   - Update metadata for modified scripts
   - Mark deprecated scripts as "Archived"

3. **Verify Naming:**
   - Script names: kebab-case
   - Directory names: kebab-case
   - No violations

4. **Check Organization:**
   - Scripts in correct subdirectories
   - No scripts in scripts root (except registry/README)
   - No unauthorized directories

---

## CI/CD Integration

### GitHub Actions (Recommended)

Add to `.github/workflows/scripts-validation.yml`:

```yaml
name: Scripts Validation

on:
  pull_request:
    paths:
      - 'scripts/**'
      - 'scripts/documented/validate-scripts.mjs'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run validate:scripts
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

1. **Identify:** Run `npm run validate:scripts`
2. **Fix:** Rename scripts/directories to comply
3. **Update Registry:** Update `SCRIPTS_REGISTRY.md`
4. **Verify:** Re-run validation
5. **Commit:** Only commit when 100% compliant

### Common Violations

**Script Naming:**
- `ApplyMigrations.js` → `apply-migrations.js`
- `createSuperAdmin.js` → `create-super-admin.js`
- `VALIDATE_DOCS.js` → `validate-docs-naming.mjs`

**Directory Naming:**
- `Documented/` → `documented/`
- `Temporary/` → `temporary/`

---

## Maintenance

### Regular Tasks

**Daily:**
- Review `scripts/temporary/` directory
- Archive or remove obsolete temporary scripts

**Weekly:**
- Run validation script
- Check registry completeness
- Archive obsolete scripts

**Monthly:**
- Review directory structure
- Consolidate related scripts
- Update registry metadata

**Quarterly:**
- Full scripts audit
- Remove deprecated scripts
- Update control mechanisms

---

## Quick Reference

### Validation Commands

```bash
# Validate scripts naming and structure
npm run validate:scripts

# Validate everything (code + docs + scripts)
npm run validate:all
```

### Registry Management

```bash
# View registry
cat scripts/documented/SCRIPTS_REGISTRY.md

# Count registered scripts
grep -c "| Script |" scripts/documented/SCRIPTS_REGISTRY.md
```

### Finding Scripts

```bash
# Find by category
ls scripts/documented/
ls scripts/temporary/

# Find by name pattern
find scripts -name "*migration*"
find scripts -name "*validate*"
```

---

**Control System Status:** ✅ Active  
**Validation Script:** ✅ Operational  
**Registry:** ✅ Complete  
**Compliance:** 100%

