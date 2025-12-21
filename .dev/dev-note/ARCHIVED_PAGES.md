# Archived Experimental Pages

**Date:** 2025-12-22  
**Status:** Archived (not deleted)

---

## Overview

The following pages were experimental prototypes created during UX exploration and design system validation. They have been archived to `src/views/pages/.archive/` as part of the production consolidation effort.

---

## Archived Pages

### Home Pages

1. **`home.html`** — Basic shell
   - **Status:** Superseded by `home5.html`
   - **Reason:** Basic implementation, functionality merged into unified console

2. **`home2.html`** — Neural Console
   - **Status:** Experimental
   - **Reason:** Alternative console design, not selected for production

3. **`home3.html`** — Optimized Console
   - **Status:** Features merged into `home5.html`
   - **Reason:** Performance optimizations (debounced search, memoization) integrated into production
   - **Note:** Optimizations preserved in `home5.html`

4. **`home4.html`** — Unified Command Surface
   - **Status:** Superseded by `home5.html`
   - **Reason:** Tri-pane layout merged into unified console v7

### Login Pages

1. **`login.html`** — Basic login
   - **Status:** Superseded by `login3.html`
   - **Reason:** Basic implementation, functionality merged into NOIR login

2. **`login2.html`** — Experimental login
   - **Status:** Experimental
   - **Reason:** Alternative design, not selected for production

3. **`login4.html`** — Experimental login
   - **Status:** Experimental
   - **Reason:** Alternative design, not selected for production

### Other Pages

1. **`dashboard.html`** — Tactical Governance Surface
   - **Status:** Merged into `home5.html`
   - **Reason:** Functionality integrated into unified console

---

## Production Pages (Locked)

- **`home5.html`** → `/home` (Unified Console v7)
- **`login3.html`** → `/login` (NOIR + Enterprise)
- **`landing.html`** → `/` (Public landing)
- **`error.html`** → `/error` (Error handling)

---

## Rollback

If needed, pages can be restored by:
1. Moving files from `.archive/` back to `pages/`
2. Setting environment variables:
   - `VMP_HOME_PAGE=home3` (or `home`, `home2`, `home4`)
   - `VMP_LOGIN_PAGE=login` (or `login2`, `login4`)
3. Restarting the server

---

## Location

All archived pages are located in: `src/views/pages/.archive/`

