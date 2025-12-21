# Archived Pages Manifest

**Date:** 2025-12-22  
**Reason:** Consolidation - Locked to production routes (home5, login3)

---

## 📦 Archived Files

### Production Route Replacements

| Archived File | Replaced By | Status |
|--------------|-------------|--------|
| `home.html` | `home5.html` | ✅ Consolidated |
| `home2.html` | `home5.html` | ✅ Consolidated |
| `home3.html` | `home5.html` | ✅ Consolidated (optimizations merged) |
| `home4.html` | `home5.html` | ✅ Consolidated |
| `login.html` | `login3.html` | ✅ Consolidated |
| `login2.html` | `login3.html` | ✅ Consolidated |
| `login4.html` | `login3.html` | ✅ Consolidated |
| `dashboard.html` | `home5.html` | ✅ Consolidated |

### Test/Example Files

| Archived File | Purpose | Status |
|--------------|---------|--------|
| `components-showcase.html` | Component testing | ✅ Archived |
| `examples.html` | Example patterns | ✅ Archived |
| `snippets-test.html` | Snippet testing | ✅ Archived |
| `test.html` | General testing | ✅ Archived |
| `Landing_backup.html` | Backup file | ✅ Archived |

---

## 🔒 Production Routes (Active)

### Main Routes
- `/` → `landing.html` (Public landing page)
- `/home` → `home5.html` (Production console - Unified v7)
- `/login` → `login3.html` (Production login - NOIR + Enterprise)
- `/error` → `error.html` (Error handling)

### Legacy Redirects
All legacy routes redirect to canonical production routes:
- `/home2`, `/home3`, `/home4`, `/home5`, `/dashboard` → `/home`
- `/login4` → `/login`

---

## 📝 Notes

1. **Home3 Optimizations Merged:** The debounce and keyboard shortcuts from `home3.html` have been merged into `home5.html`.

2. **Route Locking:** Production routes are now hardcoded in `server.js` with no rollback switches. This ensures consistency.

3. **Archive Purpose:** Files are archived (not deleted) to preserve "history of thought" for reference during future development.

4. **Restoration:** If needed, files can be restored from this archive, but production should always use the locked routes.

---

## ✅ Consolidation Status

- [x] Routes locked to production
- [x] Legacy routes redirect properly
- [x] Experimental files archived
- [x] Tests updated and passing
- [x] Optimizations merged into production

**Consolidation Complete:** 2025-12-22

