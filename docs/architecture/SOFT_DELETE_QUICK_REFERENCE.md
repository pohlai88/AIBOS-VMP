# Soft Delete Quick Reference

**Project:** AIBOS-VMP (Vendor Management Platform)  
**Date:** 2025-01-22  
**Status:** ✅ **Quick Reference Card**  
**Context:** One-page reference for CRUD-S pattern

---

## 📋 Files Overview

| File | Purpose | Location |
|------|---------|----------|
| **Architecture** | Complete architecture documentation | `docs/architecture/SOFT_DELETE_CRUD_S_ARCHITECTURE.md` |
| **Implementation Guide** | Step-by-step implementation | `docs/architecture/SOFT_DELETE_IMPLEMENTATION_GUIDE.md` |
| **Base Columns** | Add deleted_at, deleted_by, is_archived | `migrations/048_soft_delete_base_columns.sql` |
| **RLS Policies** | Hide deleted records automatically | `migrations/049_soft_delete_rls_policies.sql` |
| **Partial Indexes** | Fix unique constraints for soft delete | `migrations/050_soft_delete_partial_indexes.sql` |
| **Cascade Triggers** | Parent-child soft delete relationships | `migrations/051_soft_delete_cascade_triggers.sql` |
| **BaseRepository** | Application layer base class | `src/services/core/base-repository.js` |
| **Example Repository** | Vendor repository example | `src/services/examples/vendor-repository-example.js` |

---

## 🚀 Quick Start

### 1. Run Migrations (In Order)

```bash
# Supabase SQL Editor or psql
migrations/048_soft_delete_base_columns.sql
migrations/049_soft_delete_rls_policies.sql
migrations/050_soft_delete_partial_indexes.sql
migrations/051_soft_delete_cascade_triggers.sql
```

### 2. Use BaseRepository

```javascript
import { BaseRepository } from '../services/core/base-repository.js';

class VendorRepository extends BaseRepository {
  constructor(supabase) {
    super(supabase, 'vmp_vendors');
  }
}

// Usage
const repo = new VendorRepository(supabase);
await repo.softDelete(id, userId);  // Soft delete
await repo.restore(id);             // Restore
```

### 3. Replace Hard Deletes

```javascript
// ❌ Before
await supabase.from('table').delete().eq('id', id);

// ✅ After
await repo.softDelete(id, userId);
```

---

## 🔑 Key Concepts

### Database Level (PostgreSQL)
- **`deleted_at`**: `NULL` = Active, `TIMESTAMPTZ` = Deleted
- **`deleted_by`**: User ID who deleted (audit trail)
- **RLS Policies**: Automatically hide deleted records
- **Partial Indexes**: Unique constraints only on active records
- **Cascade Triggers**: Auto-delete children when parent deleted

### Application Level (Node.js)
- **BaseRepository**: Centralized soft delete logic
- **No Manual Filters**: RLS handles `deleted_at IS NULL` automatically
- **Restore Endpoints**: Admin-only restore functionality

---

## 📊 CRUD-S Operations

| Operation | Method | Example |
|-----------|--------|---------|
| **Create** | `INSERT` | `repo.create(data, userId)` |
| **Read** | `SELECT` | `repo.findById(id)` (RLS filters automatically) |
| **Update** | `UPDATE` | `repo.update(id, data, userId)` |
| **Soft Delete** | `UPDATE SET deleted_at` | `repo.softDelete(id, userId)` |
| **Restore** | `UPDATE SET deleted_at = NULL` | `repo.restore(id)` |
| **Hard Delete** | `DELETE` | `repo.hardDelete(id)` (Admin only) |

---

## ✅ Checklist

### Database
- [ ] Columns added (`deleted_at`, `deleted_by`, `is_archived`)
- [ ] RLS enabled and policies created
- [ ] Partial indexes for unique constraints
- [ ] Cascade triggers for parent-child relationships

### Application
- [ ] BaseRepository imported and used
- [ ] Hard deletes replaced with soft deletes
- [ ] Manual `deleted_at IS NULL` filters removed
- [ ] Restore endpoints created

### Testing
- [ ] Soft delete hides records (RLS working)
- [ ] Cascade delete works (parent → children)
- [ ] Restore works (parent → children restored)
- [ ] Unique constraints allow re-using values

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Unique constraint violation after soft delete | Create partial index: `WHERE deleted_at IS NULL` |
| Deleted records still visible | Check RLS is enabled and policy exists |
| Cascade not working | Verify trigger exists and `WHEN` clause is correct |
| Cannot restore | Use service_role client or check RLS policy |

---

## 📚 Full Documentation

- **Architecture**: `docs/architecture/SOFT_DELETE_CRUD_S_ARCHITECTURE.md`
- **Implementation**: `docs/architecture/SOFT_DELETE_IMPLEMENTATION_GUIDE.md`
- **BaseRepository**: `src/services/core/base-repository.js`
- **Example**: `src/services/examples/vendor-repository-example.js`

---

**Last Updated:** 2025-01-22

