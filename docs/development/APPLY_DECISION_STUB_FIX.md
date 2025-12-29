# Apply Decision Stub Fix

**Date:** 2025-01-22  
**Status:** ✅ **FIXED**  
**Issue:** App crashed due to missing `applyDecision.js` file

---

## 🚨 Problem

**Error:**
```
Error: Cannot find module 'C:\AI-BOS\AIBOS-VMP\src\services\decisions\applyDecision.js'
[nodemon] app crashed - waiting for file changes before starting...
```

**Root Cause:**
- `server.js` imports `applyDecision` from `./src/services/decisions/applyDecision.js`
- File did not exist
- Import fails at module load time (before code execution)
- App crashes immediately on startup

---

## ✅ Solution

### 1. Created Stub File

**File:** `src/services/decisions/applyDecision.js`

**Implementation:**
- Stub implementation for future decision engine feature
- Includes TEMPLATE CONTRACT header
- Throws descriptive error when called (feature not yet implemented)
- Allows app to start without crashing

### 2. Updated server.js

**Change:** Modified decision engine usage to fallback to legacy method

**Before:**
```javascript
if (USE_DECISION_ENGINE && action) {
  await applyDecision({...}); // Would crash if called
}
```

**After:**
```javascript
if (USE_DECISION_ENGINE && action) {
  // Decision engine is not yet implemented - use legacy method
  console.warn('Decision engine requested but not yet implemented. Using legacy method.');
  await vmpAdapter.updateCaseStatus(caseId, nextStatus, req.user.id, { note, reason });
}
```

**Rationale:**
- Prevents crash if `USE_DECISION_ENGINE=true` is set
- Falls back to legacy method gracefully
- Logs warning for visibility

---

## 📊 Fix Summary

| Issue | Status | Fix |
|-------|--------|-----|
| **Missing File** | ✅ Fixed | Created stub file |
| **Import Error** | ✅ Fixed | File now exists |
| **Runtime Error** | ✅ Fixed | Falls back to legacy method |
| **App Crash** | ✅ Fixed | App can now start |

---

## ✅ Verification

**File Created:**
- ✅ `src/services/decisions/applyDecision.js` exists
- ✅ Module exports `applyDecision` function
- ✅ Includes TEMPLATE CONTRACT header
- ✅ Syntax valid (no syntax errors)

**Server.js Updated:**
- ✅ Import no longer crashes
- ✅ Decision engine usage falls back gracefully
- ✅ Legacy method used when decision engine requested

---

## 📝 Notes

**Future Implementation:**
- When decision engine is fully implemented, replace stub with real implementation
- Stub currently throws error if called (but code falls back to legacy method)
- Decision engine is a planned feature, not yet available

**Environment Variable:**
- `USE_DECISION_ENGINE=false` (default) - Uses legacy methods
- `USE_DECISION_ENGINE=true` - Would use decision engine (but falls back to legacy until implemented)

---

**Status:** ✅ **FIXED**  
**App Status:** ✅ **Can Start**  
**Compliance:** ✅ **Template System Compliant** (includes TEMPLATE CONTRACT header)

