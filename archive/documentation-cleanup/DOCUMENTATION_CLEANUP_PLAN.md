# Documentation Cleanup Plan

**Date:** 2025-01-22  
**Status:** 🔄 In Progress  
**Purpose:** Clean up root-level docs, organize by category, create consolidated PRD with clear boundaries

---

## 📋 Analysis Summary

### Root-Level Documents in `docs/` (12 files)

| File | Current Location | Category | Action | New Location |
|------|-----------------|----------|--------|--------------|
| `FINAL_PRD_WITH_CCP_CONTROL.md` | `docs/` | PRD | ✅ Move | `docs/development/prds/PRD_MAIN.md` |
| `VENDOR_MANAGEMENT_ADVANCED_FEATURES.md` | `docs/` | Feature Analysis | ✅ Move | `docs/development/prds/PRD_VENDOR_ADVANCED_FEATURES.md` |
| `VENDOR_PORTAL_FEATURE_ANALYSIS.md` | `docs/` | Feature Analysis | ✅ Move | `docs/development/prds/PRD_VENDOR_PORTAL.md` |
| `ARCHITECTURE_FIX_BASE_REPOSITORY_NEXUS_ALIGNMENT.md` | `docs/` | Architecture | ✅ Move | `docs/architecture/BASE_REPOSITORY_NEXUS_ALIGNMENT.md` |
| `CCP_16_CLOSURE_REPORT.md` | `docs/` | Closure Report | ✅ Archive | `archive/CCP_16_CLOSURE_REPORT.md` |
| `CRYPTOGRAPHIC_CODE_EXTRACTION.md` | `docs/` | Audit | ✅ Archive | `archive/CRYPTOGRAPHIC_CODE_EXTRACTION.md` |
| `CRYPTOGRAPHIC_CODE_EXTRACTION_ALL_REPOS.md` | `docs/` | Audit | ✅ Archive | `archive/CRYPTOGRAPHIC_CODE_EXTRACTION_ALL_REPOS.md` |
| `CRYPTOGRAPHIC_FINALIZATION_REPORT.md` | `docs/` | Audit | ✅ Archive | `archive/CRYPTOGRAPHIC_FINALIZATION_REPORT.md` |
| `CRYPTOGRAPHIC_IMPLEMENTATIONS_AUDIT.md` | `docs/` | Audit | ✅ Archive | `archive/CRYPTOGRAPHIC_IMPLEMENTATIONS_AUDIT.md` |
| `DOCUMENTATION_REGISTRY.md` | `docs/` | Registry | ✅ Keep | `docs/DOCUMENTATION_REGISTRY.md` (root) |
| `DOCUMENTATION_STANDARDS.md` | `docs/` | Standards | ✅ Keep | `docs/DOCUMENTATION_STANDARDS.md` (root) |
| `SUPABASE_MCP_DEV_SETUP.md` | `docs/` | Integration | ✅ Move | `docs/integrations/supabase/SUPABASE_MCP_DEV_SETUP.md` |

---

## 🎯 Cleanup Actions

### Phase 1: Move PRDs to `docs/development/prds/`

**Files to Move:**
1. `FINAL_PRD_WITH_CCP_CONTROL.md` → `PRD_MAIN.md`
2. `VENDOR_MANAGEMENT_ADVANCED_FEATURES.md` → `PRD_VENDOR_ADVANCED_FEATURES.md`
3. `VENDOR_PORTAL_FEATURE_ANALYSIS.md` → `PRD_VENDOR_PORTAL.md`

**Rationale:** All PRDs should be in one location for easy developer access.

---

### Phase 2: Move Architecture Documents

**Files to Move:**
1. `ARCHITECTURE_FIX_BASE_REPOSITORY_NEXUS_ALIGNMENT.md` → `docs/architecture/BASE_REPOSITORY_NEXUS_ALIGNMENT.md`

**Rationale:** Architecture documents belong in `docs/architecture/`.

---

### Phase 3: Archive Legacy/Audit Documents

**Files to Archive:**
1. `CCP_16_CLOSURE_REPORT.md` → `archive/CCP_16_CLOSURE_REPORT.md`
2. `CRYPTOGRAPHIC_CODE_EXTRACTION.md` → `archive/CRYPTOGRAPHIC_CODE_EXTRACTION.md`
3. `CRYPTOGRAPHIC_CODE_EXTRACTION_ALL_REPOS.md` → `archive/CRYPTOGRAPHIC_CODE_EXTRACTION_ALL_REPOS.md`
4. `CRYPTOGRAPHIC_FINALIZATION_REPORT.md` → `archive/CRYPTOGRAPHIC_FINALIZATION_REPORT.md`
5. `CRYPTOGRAPHIC_IMPLEMENTATIONS_AUDIT.md` → `archive/CRYPTOGRAPHIC_IMPLEMENTATIONS_AUDIT.md`

**Rationale:** These are historical audit/report documents, not active development docs.

---

### Phase 4: Move Integration Guides

**Files to Move:**
1. `SUPABASE_MCP_DEV_SETUP.md` → `docs/integrations/supabase/SUPABASE_MCP_DEV_SETUP.md`

**Rationale:** Integration guides belong in `docs/integrations/`.

---

### Phase 5: Keep Root-Level Standards

**Files to Keep:**
1. `DOCUMENTATION_REGISTRY.md` - Central registry (should be in root)
2. `DOCUMENTATION_STANDARDS.md` - Standards reference (should be in root)

**Rationale:** These are meta-documents about documentation itself, appropriate for root.

---

## 📝 New Consolidated PRD Structure

### Create: `docs/development/prds/PRD_CONSOLIDATED.md`

**Structure with Clear Boundaries:**

```markdown
# Consolidated PRD with CCP Boundaries

## 1. Frontend UI/UX
- HTMX + Alpine.js patterns
- Nunjucks templates
- Design system compliance
- Component patterns

## 2. Backend Logic
- Express routes
- Adapter layer
- Business logic
- Validation

## 3. Utils
- Shared utilities
- Helpers
- Validators
- Logging

## 4. DB-Metadata-Schema (Isolated - Deferred)
- Database schema (deferred to next dev phase)
- Metadata governance
- Schema evolution
- Migration patterns
```

**Rationale:** Clear separation allows parallel development without confusion.

---

## ✅ Execution Checklist

- [ ] Move PRD files to `docs/development/prds/`
- [ ] Move architecture files to `docs/architecture/`
- [ ] Archive legacy/audit files to `archive/`
- [ ] Move integration guides to `docs/integrations/`
- [ ] Create consolidated PRD with boundaries
- [ ] Update `DOCUMENTATION_REGISTRY.md`
- [ ] Update `docs/README.md` with new structure

---

**Status:** Ready for execution  
**Next Step:** Begin file moves and PRD consolidation

