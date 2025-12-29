# server.js Legacy Verification Report

**Date:** 2025-01-22  
**Status:** ✅ **VERIFIED - Legacy Server Confirmed**  
**Purpose:** Verify if server.js is legacy and covers nexus series pages

---

## 🔍 Verification Results

### ✅ **CONFIRMED: server.js is Legacy Server**

**Evidence:**

1. **Uses Legacy Adapter:**
   - Line 27: `import { vmpAdapter } from './src/adapters/supabase.js';`
   - ❌ Should use: `import { nexusAdapter } from './src/adapters/nexus-adapter.js';`
   - Multiple usages throughout file (lines 558, 790, 806, etc.)

2. **Nexus Routes NOT Mounted:**
   - ❌ No `app.use('/nexus', nexusPortalRouter)` found
   - ❌ No `app.use('/nexus/client', nexusClientRouter)` found
   - ❌ No `app.use('/nexus/vendor', nexusVendorRouter)` found
   - ✅ Nexus route files exist but are commented out (lines 10878-10882)

3. **Legacy Imports (Partially Fixed):**
   - ✅ Fixed: `vendorRouter` and `clientRouter` imports removed (lines 18-22)
   - ⚠️ Still broken: `attachSupabaseClient` import (line 23) - file doesn't exist
   - ⚠️ Still broken: `vmpAdapter` import (line 27) - should be `nexusAdapter`

4. **Legacy Middleware:**
   - Line 504: `app.use(attachSupabaseClient);` - middleware file doesn't exist
   - Should use: `nexus-context.js` middleware instead

---

## 📊 Current State

| Component | Status | Notes |
|-----------|--------|-------|
| **Adapter** | ❌ Legacy | Uses `vmpAdapter` instead of `nexusAdapter` |
| **Nexus Routes** | ❌ Not Mounted | Files exist but not imported/mounted |
| **Legacy Routes** | ✅ Active | All legacy VMP routes still active |
| **Middleware** | ❌ Broken | `attachSupabaseClient` file missing |
| **Nexus Pages** | ⚠️ Partial | Some nexus views exist but routes not accessible |

---

## 🎯 Nexus Route Files (Exist but Not Used)

**Available Nexus Routes:**
- ✅ `src/routes/nexus-portal.js` - Main portal routes
- ✅ `src/routes/nexus-vendor.js` - Vendor portal routes  
- ✅ `src/routes/nexus-client.js` - Client portal routes

**Status:** Files exist but are **NOT mounted** in `server.js`

**Impact:** All `/nexus/*` routes return 404

---

## 🚨 Critical Issues

### Issue 1: Broken Middleware Import
```javascript
// Line 23 - FILE DOES NOT EXIST
import { attachSupabaseClient } from './src/middleware/supabase-client.js';

// Line 504 - WILL CRASH
app.use(attachSupabaseClient);
```

**Fix Required:**
- Remove `attachSupabaseClient` import
- Replace with nexus middleware: `loadNexusSession`, `requireNexusAuth`, etc.

### Issue 2: Legacy Adapter Usage
```javascript
// Line 27 - LEGACY
import { vmpAdapter } from './src/adapters/supabase.js';

// Should be:
import { nexusAdapter } from './src/adapters/nexus-adapter.js';
```

**Impact:** All database operations use legacy adapter instead of nexus adapter

### Issue 3: Nexus Routes Not Mounted
```javascript
// Lines 10878-10882 - COMMENTED OUT
// app.use(`${BASE_PATH}/vendor`, vendorRouter);
// app.use(`${BASE_PATH}/client`, clientRouter);
```

**Expected:**
```javascript
import nexusPortalRouter from './src/routes/nexus-portal.js';
import nexusVendorRouter from './src/routes/nexus-vendor.js';
import nexusClientRouter from './src/routes/nexus-client.js';

app.use('/nexus', nexusPortalRouter);
app.use('/nexus/vendor', nexusVendorRouter);
app.use('/nexus/client', nexusClientRouter);
```

---

## 📋 Migration Status (Phase 13)

According to `docs/development/notes/CCP_VALIDATION_REPORT.md`:

| Task | Status | Notes |
|------|--------|-------|
| **13.1** | ✅ DONE | Migration file `099_remove_legacy_vmp.sql` exists |
| **13.2** | ❌ NOT EXECUTED | Migration not run on Supabase |
| **13.3** | ⚠️ PARTIAL | Some imports fixed, others still broken |
| **13.4** | ❌ NOT DONE | Nexus routes not mounted |
| **13.5** | ✅ MOSTLY DONE | Legacy files deleted |
| **13.6** | ❌ NOT DONE | No cleanup commit |

---

## ✅ Conclusion

**VERIFIED:** `server.js` is indeed a **legacy server** that:

1. ✅ Still uses legacy `vmpAdapter` 
2. ✅ Does NOT mount nexus routes
3. ⚠️ Has broken imports (partially fixed)
4. ✅ Contains legacy VMP routes mixed with some nexus code
5. ❌ Nexus pages exist but are **not accessible** because routes aren't mounted

**Recommendation:**
- Complete Phase 13 migration (mount nexus routes, replace vmpAdapter)
- Or create separate `server-nexus.js` for nexus-only routes
- Follow migration plan in `CCP_VALIDATION_REPORT.md`

---

**Status:** ✅ **VERIFIED**  
**Next Steps:** Complete Phase 13 migration or mount nexus routes

