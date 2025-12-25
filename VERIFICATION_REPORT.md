# Route & File Verification Report

## ✅ Naming Convention Status

### Route → File Mapping (Kebab-Case → Snake_Case)

| Route | File | Status |
|-------|------|--------|
| `/partials/org-tree-sidebar.html` | `partials/org_tree_sidebar.html` | ✅ Correct |
| `/partials/scoped-dashboard.html` | `partials/scoped_dashboard.html` | ✅ Correct |
| `/partials/ops-case-queue.html` | `partials/ops_case_queue.html` | ✅ Correct |
| `/partials/case-inbox.html` | `partials/case_inbox.html` | ✅ Correct |
| `/partials/case-detail.html` | `partials/case_detail.html` | ✅ Correct |
| `/partials/vendor-directory.html` | `partials/vendor_directory.html` | ✅ Correct |
| `/partials/port-configuration.html` | `partials/port_configuration.html` | ✅ Correct |
| `/partials/port-activity-log.html` | `partials/port_activity_log.html` | ✅ Correct |
| `/partials/remittance-viewer.html` | `partials/remittance_viewer.html` | ✅ Correct |
| `/partials/invite-form.html` | `partials/invite_form.html` | ✅ Correct |
| `/partials/matching-status.html` | `partials/matching_status.html` | ✅ Correct |

**All partial routes follow correct naming convention! ✅**

---

## 🚨 CRITICAL: HTMX Target Mismatch

### Issue
The new sidebar (`org_tree_sidebar.html`) targets `#main-content`, but some pages have different target structures.

### Current State

| File | HTMX Target | Status |
|------|-------------|--------|
| `layout.html` | `#main-content` | ✅ Correct (used by sidebar) |
| `ops_dashboard.html` | N/A (full page) | ✅ Correct |
| `ops_cases.html` | `#case-queue-container` | ✅ Correct (local target) |
| `ops_ingest.html` | `#dashboard-main-content` | ❌ **MISMATCH** |
| `ops_vendors.html` | N/A (has own sidebar) | ⚠️ **DUPLICATE SIDEBAR** |
| `sla_analytics.html` | `#sla-analytics-main-content` | ⚠️ **LOCAL TARGET** |

### Problems

1. **`ops_ingest.html`** has its own `#dashboard-main-content` element
   - Sidebar navigation will NOT work
   - Page has duplicate sidebar structure

2. **`ops_vendors.html`** has duplicate sidebar
   - Layout already includes sidebar
   - Creates redundant structure

3. **`sla_analytics.html`** uses local target
   - Sidebar navigation will NOT work
   - Needs to target `#main-content` or use full page replacement

---

## 📋 Required Fixes

### Fix 1: Update `ops_ingest.html`
- Remove duplicate sidebar (layout already has it)
- Remove `#dashboard-main-content` wrapper
- Content should render directly in `#main-content` block

### Fix 2: Update `ops_vendors.html`
- Remove duplicate sidebar
- Use layout sidebar instead

### Fix 3: Verify `ops_dashboard.html`
- ✅ Already correct - renders full page content
- Sidebar navigation will work correctly

---

## ✅ Verified Working Pages

These pages work correctly with the new sidebar:

- ✅ `ops_dashboard.html` - Full page, no conflicts
- ✅ `ops_cases.html` - Uses local targets, no conflicts
- ✅ `login.html` - Standalone, no sidebar
- ✅ `landing.html` - Standalone, no sidebar
- ✅ `invoices.html` - Uses layout sidebar
- ✅ `payments.html` - Uses layout sidebar
- ✅ `profile.html` - Uses layout sidebar

---

## 🔍 Route Verification

### All Routes Exist ✅

All routes in `server.js` have corresponding files:
- ✅ All page routes mapped correctly
- ✅ All partial routes mapped correctly
- ✅ Naming conventions followed (kebab-case → snake_case)

---

## 🎯 Next Steps

1. **Fix `ops_ingest.html`** - Remove duplicate sidebar, use layout
2. **Fix `ops_vendors.html`** - Remove duplicate sidebar
3. **Test sidebar navigation** - Verify all pages work with `#main-content` target
4. **Update `sla_analytics.html`** - If needed for sidebar navigation

---

**Report Generated:** 2025-01-21
**Status:** ⚠️ 2 Critical Issues Found

