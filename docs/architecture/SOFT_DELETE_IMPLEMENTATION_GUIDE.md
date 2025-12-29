# Soft Delete Implementation Guide

**Project:** AIBOS-VMP (Vendor Management Platform)  
**Date:** 2025-01-22  
**Status:** ✅ **Implementation Guide**  
**Context:** Step-by-step guide for implementing CRUD-S pattern

---

## 📋 Quick Start

This guide provides step-by-step instructions for implementing the CRUD-S (Soft Delete) architecture in your codebase.

---

## 🚀 Implementation Steps

### Step 1: Run Database Migrations

Execute migrations in order:

```bash
# 1. Add base columns (deleted_at, deleted_by, is_archived)
psql -f migrations/048_soft_delete_base_columns.sql

# 2. Create RLS policies (hide deleted records)
psql -f migrations/049_soft_delete_rls_policies.sql

# 3. Create partial indexes (unique constraints)
psql -f migrations/050_soft_delete_partial_indexes.sql

# 4. Create cascade triggers (parent-child relationships)
psql -f migrations/051_soft_delete_cascade_triggers.sql
```

**Or in Supabase SQL Editor:**
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste each migration file content
3. Run each migration sequentially

---

### Step 2: Update Existing Repositories

Replace hard delete operations with soft delete:

#### Before (Hard Delete):
```javascript
// ❌ BAD: Hard delete
app.delete('/api/vendors/:id', async (req, res) => {
  const { error } = await supabase
    .from('vmp_vendors')
    .delete()
    .eq('id', req.params.id);
  
  if (error) throw error;
  res.json({ success: true });
});
```

#### After (Soft Delete):
```javascript
// ✅ GOOD: Soft delete
import { VendorRepository } from '../services/examples/vendor-repository-example.js';

app.delete('/api/vendors/:id', async (req, res) => {
  try {
    const vendorRepo = new VendorRepository(req.supabase);
    const deleted = await vendorRepo.softDelete(req.params.id, req.user.id);
    res.json({ success: true, data: deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### Step 3: Remove Manual `deleted_at` Filters

RLS policies automatically hide deleted records. Remove manual filters:

#### Before (Manual Filter):
```javascript
// ❌ BAD: Manual filter (RLS already handles this)
const { data } = await supabase
  .from('vmp_vendors')
  .select('*')
  .eq('tenant_id', tenantId)
  .is('deleted_at', null);  // Remove this - RLS handles it
```

#### After (RLS Handles It):
```javascript
// ✅ GOOD: RLS automatically filters
const { data } = await supabase
  .from('vmp_vendors')
  .select('*')
  .eq('tenant_id', tenantId);
  // No need for .is('deleted_at', null) - RLS policy handles it
```

---

### Step 4: Create Repository Classes

For each entity, create a repository extending `BaseRepository`:

```javascript
// src/services/repositories/vendor-repository.js
import { BaseRepository } from '../core/base-repository.js';

export class VendorRepository extends BaseRepository {
  constructor(supabase) {
    super(supabase, 'vmp_vendors');
  }

  // Add vendor-specific methods
  async findByEmail(email) {
    // Implementation
  }
}
```

---

### Step 5: Add Restore Endpoints

Allow admins to restore deleted records:

```javascript
// Restore endpoint
app.post('/api/vendors/:id/restore', async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const vendorRepo = new VendorRepository(req.supabase);
    const restored = await vendorRepo.restore(req.params.id);
    res.json({ success: true, data: restored });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### Step 6: Update Unique Constraint Queries

When checking for uniqueness, ensure you're only checking active records:

#### Before:
```javascript
// ❌ BAD: Checks all records including deleted
const { data } = await supabase
  .from('vmp_vendors')
  .select('email')
  .eq('email', email)
  .single();
```

#### After:
```javascript
// ✅ GOOD: Partial index ensures only active records are checked
// But still filter explicitly for clarity
const { data } = await supabase
  .from('vmp_vendors')
  .select('email')
  .eq('email', email)
  .is('deleted_at', null)
  .single();
```

**Note:** The partial index enforces uniqueness, but explicit filter is good practice.

---

## 🔍 Testing Checklist

### Database Level
- [ ] `deleted_at` column exists on all target tables
- [ ] `deleted_by` column exists on all target tables
- [ ] RLS policies are enabled and working
- [ ] Partial indexes are created for unique constraints
- [ ] Cascade triggers fire correctly

### Application Level
- [ ] `BaseRepository` is imported and used
- [ ] All hard `DELETE` operations replaced with `softDelete()`
- [ ] Manual `deleted_at IS NULL` filters removed (RLS handles it)
- [ ] Restore endpoints created for admin use
- [ ] Error handling for already-deleted records

### Integration Testing
- [ ] Soft delete hides record from standard queries
- [ ] Soft delete preserves record for admin queries
- [ ] Cascade delete works (parent → children)
- [ ] Restore works (parent → children restored)
- [ ] Unique constraints allow re-using values after soft delete

---

## 🐛 Common Issues & Solutions

### Issue 1: "Unique constraint violation" after soft delete

**Problem:** Trying to create new record with same unique value fails.

**Solution:** Ensure partial index is created:
```sql
CREATE UNIQUE INDEX idx_table_field_active 
ON table_name(field) 
WHERE deleted_at IS NULL;
```

### Issue 2: Deleted records still visible

**Problem:** RLS policy not working.

**Solution:** 
1. Check RLS is enabled: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Verify policy exists: `SELECT * FROM pg_policies WHERE tablename = 'table_name';`
3. Check user has correct role (authenticated vs service_role)

### Issue 3: Cascade not working

**Problem:** Children not soft-deleted when parent is deleted.

**Solution:**
1. Verify trigger exists: `SELECT * FROM pg_trigger WHERE tgname LIKE '%cascade%';`
2. Check trigger function is correct
3. Ensure `WHEN` clause is correct: `WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)`

### Issue 4: Cannot restore record

**Problem:** Restore fails with "not found" error.

**Solution:**
1. Check record exists: `SELECT * FROM table_name WHERE id = '...' AND deleted_at IS NOT NULL;`
2. Verify RLS policy allows service_role to see deleted records
3. Use service role client for restore operations

---

## 📊 Migration Order

Execute migrations in this exact order:

1. **048_soft_delete_base_columns.sql** - Add columns
2. **049_soft_delete_rls_policies.sql** - Enable RLS
3. **050_soft_delete_partial_indexes.sql** - Fix unique constraints
4. **051_soft_delete_cascade_triggers.sql** - Enable cascading

**Why this order?**
- Columns must exist before RLS policies can reference them
- RLS must be enabled before partial indexes (for testing)
- Triggers depend on columns existing

---

## 🔐 Security Considerations

### RLS Policy Testing

Test that RLS policies work correctly:

```sql
-- As authenticated user (should see only active)
SET ROLE authenticated;
SELECT * FROM vmp_vendors;  -- Should NOT see deleted records

-- As service_role (should see all)
SET ROLE service_role;
SELECT * FROM vmp_vendors;  -- Should see ALL records including deleted
```

### Admin Access

Ensure admin users can see deleted records for audit purposes:

```sql
-- Admin policy (adjust based on your auth system)
CREATE POLICY "admins_see_all_vendors" 
ON vmp_vendors FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
  OR deleted_at IS NULL  -- Regular users see active only
);
```

---

## 📝 Code Review Checklist

Before merging soft delete implementation:

- [ ] All migrations executed successfully
- [ ] No hard `DELETE` operations remain (except GDPR retention)
- [ ] All repositories extend `BaseRepository`
- [ ] RLS policies tested and working
- [ ] Partial indexes created for all unique constraints
- [ ] Cascade triggers tested
- [ ] Restore endpoints created
- [ ] Error handling implemented
- [ ] Documentation updated

---

## 🎯 Next Steps

After implementing soft delete:

1. **Monitor Performance:** Check query performance with RLS enabled
2. **Audit Trail:** Review `deleted_by` audit logs regularly
3. **GDPR Compliance:** Implement retention policy (hard delete after X years)
4. **Admin Tools:** Create admin dashboard for viewing/restoring deleted records

---

**Document Status:** ✅ **Implementation Guide**  
**Last Updated:** 2025-01-22  
**Related Docs:** 
- `SOFT_DELETE_CRUD_S_ARCHITECTURE.md` - Architecture overview
- `BaseRepository` - Application layer implementation

