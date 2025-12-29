# Temporary Scripts Directory

**Purpose:** One-time use scripts, cleanup scripts, and temporary utilities  
**Cleanup Policy:** Scripts in this directory should be reviewed and cleaned daily

---

## Cleanup Policy

Scripts in this directory are:
- **One-time use** scripts (migrations, setup, cleanup)
- **Temporary utilities** (test helpers, wrappers)
- **Cleanup scripts** (archive, deep-clean, phase cleanup)
- **Development helpers** (run scripts, batch files)

**Action Required:**
- Review scripts daily
- Archive or remove scripts that are no longer needed
- Move scripts to `documented/` if they become permanent

---

## Current Temporary Scripts

| Script | Purpose | Status | Cleanup Date |
|--------|---------|--------|--------------|
| `deep-archive-all.ps1` | Archive all files | Review | - |
| `deep-clean-360.mjs` | Deep clean project | Review | - |
| `enforce-documentation-standards.mjs` | Enforce doc standards | Review | - |
| `phase13-cleanup.ps1` | Phase 13 cleanup | Review | - |
| `phase13-cleanup.sh` | Phase 13 cleanup (bash) | Review | - |
| `run-combined-tests.ps1` | Combined test runner | Review | - |
| `run-vitest-coverage.bat` | Vitest coverage wrapper | Review | - |
| `run-vitest.bat` | Vitest wrapper | Review | - |

---

## Daily Cleanup Checklist

- [ ] Review all scripts in this directory
- [ ] Identify scripts no longer needed
- [ ] Archive obsolete scripts to `archive/`
- [ ] Move permanent scripts to `documented/`
- [ ] Update `SCRIPTS_REGISTRY.md` if needed

---

**Last Cleanup:** 2025-12-28  
**Next Review:** Daily

