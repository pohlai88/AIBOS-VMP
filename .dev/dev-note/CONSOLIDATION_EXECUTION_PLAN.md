# Consolidation Execution Plan

**Date:** 2025-12-22  
**Status:** Ready for Execution  
**Estimated Time:** 2 hours

---

## 🎯 Objective

Lock production architecture by:
1. Consolidating experimental pages
2. Establishing clear production routes
3. Extracting valuable features from experiments
4. Creating clean, maintainable codebase

---

## 📋 Execution Steps

### Step 1: Create Archive Directory (5 min)

```bash
mkdir -p src/views/pages/.archive
```

**Action:** Create directory structure for archived experimental pages.

---

### Step 2: Identify Production Targets (CONFIRMED)

✅ **Production Pages:**
- `/home` → `home5.html` (Unified Console v7)
- `/login` → `login3.html` (NOIR + Enterprise)
- `/` → `landing.html` (Public landing)
- `/error` → `error.html` (Error handling)

---

### Step 3: Archive Experimental Pages (15 min)

**Move to `.archive/`:**
- `home.html` → `.archive/home.html`
- `home2.html` → `.archive/home2.html`
- `home3.html` → `.archive/home3.html`
- `home4.html` → `.archive/home4.html`
- `login.html` → `.archive/login.html` (or keep as fallback)
- `login2.html` → `.archive/login2.html`
- `login4.html` → `.archive/login4.html`
- `dashboard.html` → `.archive/dashboard.html`

**Note:** Keep `login.html` as fallback if needed, otherwise archive.

---

### Step 4: Update Server Routes (30 min)

**Update `server.js`:**

1. **Update `/home` route:**
   ```javascript
   // OLD: app.get('/home', async (req, res) => { res.render('pages/home.html', ...) });
   // NEW:
   app.get('/home', async (req, res) => {
     // Use home5.html (production unified console)
     const VENDOR_ID_HARDCODED = env.DEMO_VENDOR_ID;
     // ... existing home5 logic ...
     res.render('pages/home5.html', { ... });
   });
   ```

2. **Update `/login` route:**
   ```javascript
   // OLD: app.get('/login', (req, res) => { res.render('pages/login.html', ...) });
   // NEW:
   app.get('/login', (req, res) => {
     if (req.session?.sessionId) {
       return res.redirect('/home');
     }
     res.render('pages/login3.html', { error: null });
   });
   ```

3. **Remove experimental routes:**
   - Remove `/home2` route
   - Remove `/home3` route
   - Remove `/home4` route
   - Remove `/login2` route
   - Remove `/login4` route
   - Remove `/dashboard` route

4. **Add redirects (optional):**
   ```javascript
   // Redirect old routes to production
   app.get('/home2', (req, res) => res.redirect('/home'));
   app.get('/home3', (req, res) => res.redirect('/home'));
   app.get('/home4', (req, res) => res.redirect('/home'));
   ```

---

### Step 5: Extract Valuable Features (45 min)

**From Experimental Pages (if any):**

**home3.html optimizations (if present):**
- Debounced search (300ms)
- Memoized computed properties
- Lookup maps for status classes
- ARIA improvements
- Keyboard shortcuts

**Action:** Review `home5.html` and merge any missing optimizations.

**Note:** If `home3.html` is just a placeholder, skip this step.

---

### Step 6: Update Documentation (15 min)

**Files to Update:**

1. **`.dev/dev-note/VMP 21Sprint.md`:**
   - Mark experimental pages as archived
   - Update production routes section
   - Add consolidation completion note

2. **`README.md`:**
   - Update route documentation
   - Remove references to experimental pages
   - Add production architecture section

3. **Create `.dev/dev-note/ARCHIVED_PAGES.md`:**
   ```markdown
   # Archived Experimental Pages
   
   **Date:** 2025-12-22
   
   The following pages were experimental prototypes and have been archived:
   
   - `home.html` - Basic shell (superseded by home5)
   - `home2.html` - Neural console (experimental)
   - `home3.html` - Optimized console (features merged into home5)
   - `home4.html` - Unified command surface (superseded by home5)
   - `login.html` - Basic login (superseded by login3)
   - `login2.html` - Experimental login
   - `login4.html` - Experimental login
   - `dashboard.html` - Tactical governance (merged into home5)
   
   **Location:** `src/views/pages/.archive/`
   ```

---

### Step 7: Testing Checklist (15 min)

**Test Production Routes:**
- [ ] `/login` → Renders `login3.html` correctly
- [ ] `POST /login` → Authenticates and redirects to `/home`
- [ ] `/home` → Renders `home5.html` correctly
- [ ] `/home` → Case inbox loads via HTMX
- [ ] `/home` → Case detail loads via HTMX
- [ ] All HTMX partials work correctly
- [ ] No broken links or references

**Test Archived Routes (if redirects added):**
- [ ] `/home2` → Redirects to `/home`
- [ ] `/home3` → Redirects to `/home`
- [ ] `/home4` → Redirects to `/home`

---

### Step 8: Clean Up (10 min)

**Remove:**
- Unused imports in `server.js`
- Dead code comments
- Experimental route handlers

**Verify:**
- No references to archived pages in code
- All routes point to production pages
- Documentation is up to date

---

## 📊 Final State

### Production Routes

```
PUBLIC:
  GET  /              → landing.html
  GET  /login         → login3.html
  POST /login         → Auth → /home
  POST /logout        → Clear session → /login

AUTHENTICATED:
  GET  /home          → home5.html
  GET  /partials/*    → HTMX partials
  POST /cases/:id/*   → Action handlers
```

### File Structure

```
src/views/
  ├─ pages/
  │   ├─ home5.html          ✅ PRODUCTION
  │   ├─ login3.html          ✅ PRODUCTION
  │   ├─ landing.html         ✅ PRODUCTION
  │   ├─ error.html           ✅ PRODUCTION
  │   └─ .archive/
  │       ├─ home.html        📦 ARCHIVED
  │       ├─ home2.html       📦 ARCHIVED
  │       ├─ home3.html       📦 ARCHIVED
  │       ├─ home4.html       📦 ARCHIVED
  │       ├─ login.html       📦 ARCHIVED
  │       ├─ login2.html      📦 ARCHIVED
  │       ├─ login4.html      📦 ARCHIVED
  │       └─ dashboard.html   📦 ARCHIVED
  └─ partials/
      └─ (all production partials)
```

---

## ✅ Success Criteria

1. ✅ Only production pages accessible via routes
2. ✅ Experimental pages archived (not deleted)
3. ✅ All HTMX partials functional
4. ✅ Documentation updated
5. ✅ No broken links or references
6. ✅ Clean, maintainable codebase

---

## 🚀 Ready to Execute?

**Estimated Total Time:** 2 hours  
**Risk Level:** Low (archived, not deleted)  
**Rollback:** Restore from `.archive/` if needed

**Proceed with consolidation?** This will lock the production architecture and clean up the codebase.

