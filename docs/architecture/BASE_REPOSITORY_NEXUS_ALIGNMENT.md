# Architecture Fix: BaseRepository + Nexus Schema Alignment

**Date:** 2025-01-22  
**Status:** ✅ **SURGICAL PATCH READY**  
**Critical Gap:** BaseRepository assumes `id` PK, but Nexus uses prefixed IDs (`case_id`, `payment_id`, etc.)

---

## 🔴 Root Cause Analysis

### The Mismatch

1. **BaseRepository** assumes primary key is `id` (UUID)
2. **Nexus Schema** uses:
   - `id` (UUID PRIMARY KEY) - database internal
   - Prefixed TEXT columns (`case_id`, `payment_id`, `user_id`, `tenant_id`) - business identifiers
3. **Adapter** uses prefixed IDs for lookups (e.g., `.eq('case_id', caseId)`)
4. **CRUD-S columns** (`deleted_at`, `deleted_by`) are consistently added to all tables (migration 048)

### Impact

- BaseRepository cannot be used for Nexus entities
- Service templates generate code that won't work
- CRUD-S operations fail silently or return 501
- Template system drifts from reality

---

## ✅ Solution: Surgical Patch

### 1. Upgrade BaseRepository to Support Custom ID Column

**File:** `src/services/core/base-repository.js`

**Change:** Add `idColumn` parameter to constructor

```javascript
constructor(supabase, tableName, idColumn = 'id') {
  this.supabase = supabase;
  this.tableName = tableName;
  this.idColumn = idColumn; // NEW: Support custom PK column
}
```

**Replace all `.eq('id', id)` with `.eq(this.idColumn, id)`**

---

### 2. Add Generic CRUD-S Methods to Adapter

**File:** `src/adapters/nexus-adapter.js`

**Add:**
- `softDeleteEntity({ table, idColumn, id, userId, tenantId, context })`
- `restoreEntity({ table, idColumn, id, tenantId, context })`

**Use context client (not service client) for RLS enforcement**

---

### 3. Add Prefixed ID Validator

**File:** `src/utils/uuid-validator.js` (extend existing)

**Add:**
- `assertPrefixedId(value, prefix)` - validates prefixed ID format

---

### 4. Update Service Template

**File:** `src/templates/service.template.js`

**Change:** Pass `idColumn` to BaseRepository constructor

```javascript
constructor(supabase) {
  super(supabase, '{{table_name}}', '{{id_column}}'); // e.g., 'case_id', 'payment_id'
}
```

---

## 📋 Implementation Plan

### Phase 1: BaseRepository Upgrade (Critical)

1. Add `idColumn` parameter
2. Replace all `.eq('id', ...)` with `.eq(this.idColumn, ...)`
3. Update all methods: `findById`, `softDelete`, `restore`, `hardDelete`, etc.

### Phase 2: Adapter CRUD-S Helpers (Critical)

1. Add `softDeleteEntity()` - uses context client, BaseRepository internally
2. Add `restoreEntity()` - uses context client, BaseRepository internally
3. Document when to use service client vs context client

### Phase 3: Prefixed ID Validator (High Value)

1. Add `assertPrefixedId()` to `uuid-validator.js`
2. Use in adapter methods for early validation
3. Prevents UUIDs from sneaking into prefixed ID fields

### Phase 4: Template Updates (High Value)

1. Update service template to accept `idColumn` placeholder
2. Update scaffold script to prompt for `idColumn`
3. Document Nexus ID conventions

---

## 🎯 Expected Outcome

After patch:
- ✅ BaseRepository works with Nexus tables (using `case_id`, `payment_id`, etc.)
- ✅ Service templates generate working code
- ✅ CRUD-S operations work via adapter helpers
- ✅ RLS enforced (context client used for user operations)
- ✅ Prefixed IDs validated consistently

---

**Next Step:** Apply surgical patch to files listed above.

