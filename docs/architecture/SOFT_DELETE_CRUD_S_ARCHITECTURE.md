# CRUD-S (Soft Delete) Architecture

**Project:** AIBOS-VMP (Vendor Management Platform)  
**Date:** 2025-01-22  
**Status:** ✅ **APPROVED - Foundational ERP Pattern**  
**Context:** Next.js + Supabase (PostgreSQL) Stack

---

## 📋 Executive Summary

**CRUD-S** (Create, Read, Update, Soft-Delete) is a **foundational architectural decision** for ERP systems in regulated industries (finance, supply chain). This pattern ensures data remains auditable even after it is "removed," meeting compliance requirements for financial audits and regulatory reporting.

### Key Principle: "The Database is the Source of Truth"

We enforce Soft Delete at the **Database Level (PostgreSQL/Supabase)** to prevent developer error. If a junior developer accidentally writes `DELETE FROM orders`, the database should prevent it or the architecture should make `update({ deleted_at: now() })` the path of least resistance.

---

## 🎯 Design Decision: Database-Level Soft Delete

**✅ APPROVED APPROACH:** PostgreSQL triggers, RLS policies, and partial indexes enforce soft delete at the database level.

### Why This Approach is Superior

| Aspect | Application-Level | Database-Level ✅ |
|--------|-------------------|-------------------|
| **Developer Error Prevention** | Can be bypassed | Enforced by database |
| **RLS Integration** | Manual filtering | Automatic via policies |
| **Unique Constraints** | Complex application logic | Partial indexes |
| **Cascading Deletes** | Application-level loops | Database triggers |
| **Audit Trail** | Application-dependent | Database-enforced |
| **Performance** | Multiple queries | Single query with RLS |

---

## 🏗️ Architecture Components

### 1. Standardized Schema (The "Base Model")

Every major entity (Invoices, Vendors, Users, Products) must share this footprint:

```sql
-- Apply this pattern to all tables
ALTER TABLE your_table_name
ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL,  -- The flag. NULL = Active.
ADD COLUMN deleted_by UUID REFERENCES auth.users(id),  -- Audit trail
ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;  -- Optional: For 'cold' storage separation
```

**Column Definitions:**
- `deleted_at`: `NULL` = Active record, `TIMESTAMPTZ` = Soft-deleted
- `deleted_by`: User ID who performed the soft delete (audit trail)
- `is_archived`: Optional flag for "cold storage" separation (GDPR compliance)

---

### 2. Partial Indexes (The "Unique Constraint" Solution)

**Problem:** If you Soft Delete a user "john@aibos.com", the row stays in the DB. If you try to create a *new* "john@aibos.com", Postgres throws a Unique Violation error because the old row still exists.

**Solution:** Use **Partial Indexes** to enforce uniqueness only on ACTIVE records.

```sql
-- ❌ BAD: Blocks re-using emails after soft delete
-- CREATE UNIQUE INDEX idx_users_email ON users(email);

-- ✅ GOOD: Enforces uniqueness only on ACTIVE records
CREATE UNIQUE INDEX idx_users_email_active 
ON users(email) 
WHERE deleted_at IS NULL;
```

**Pattern for All Unique Constraints:**

```sql
-- Example: Email uniqueness
CREATE UNIQUE INDEX idx_table_name_unique_field_active 
ON table_name(unique_field) 
WHERE deleted_at IS NULL;

-- Example: Composite unique constraint
CREATE UNIQUE INDEX idx_table_name_composite_active 
ON table_name(field1, field2) 
WHERE deleted_at IS NULL;
```

---

### 3. Row Level Security (RLS) - "Invisible Deletion"

Make soft-deleted rows invisible to standard queries automatically.

```sql
-- 1. Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- 2. Standard READ Policy (Hides deleted items)
CREATE POLICY "Users see active vendors only" 
ON vendors FOR SELECT 
USING (deleted_at IS NULL);

-- 3. Audit/Admin Policy (Can see everything)
CREATE POLICY "Admins see all vendors" 
ON vendors FOR SELECT 
TO authenticated
USING (
  -- Admin role check (adjust based on your auth system)
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
  OR deleted_at IS NULL  -- Regular users see active only
);
```

**Standard RLS Policy Pattern:**

```sql
-- Standard users: See active records only
CREATE POLICY "table_name_select_active" 
ON table_name FOR SELECT 
USING (deleted_at IS NULL);

-- Service role: See everything (for system operations)
CREATE POLICY "table_name_select_service_role" 
ON table_name FOR SELECT 
TO service_role
USING (true);
```

---

### 4. Application Layer: Base Repository Pattern

Centralize the logic in a **Base Repository** or Service Class. Do not repeat `deleted_at = new Date()` in 50 different API routes.

#### Base Repository Implementation (TypeScript/JavaScript)

```typescript
// src/services/core/base-repository.ts
import { SupabaseClient } from '@supabase/supabase-js';

export class BaseRepository<T> {
  constructor(
    protected supabase: SupabaseClient,
    protected tableName: string
  ) {}

  /**
   * STANDARD READ: Respects RLS (which hides deleted_at automatically)
   */
  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data as T;
  }

  /**
   * Find all active records (explicit filter for clarity)
   */
  async findAllActive(): Promise<T[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as T[];
  }

  /**
   * SOFT DELETE: The centralized implementation
   */
  async softDelete(id: string, userId: string): Promise<T> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: userId 
      })
      .eq('id', id)
      .is('deleted_at', null)  // Only soft-delete if not already deleted
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Record ${id} not found or already deleted`);
      }
      throw error;
    }

    return data as T;
  }

  /**
   * RESTORE: The "Undo" button
   */
  async restore(id: string): Promise<T> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({ 
        deleted_at: null,
        deleted_by: null 
      })
      .eq('id', id)
      .is('deleted_at', null, { foreignTable: null })  // Only restore if deleted
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Record ${id} not found or already active`);
      }
      throw error;
    }

    return data as T;
  }

  /**
   * HARD DELETE: Admin only (for GDPR/retention policies)
   * WARNING: This bypasses soft delete. Use with extreme caution.
   */
  async hardDelete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Find including deleted (admin/audit use)
   */
  async findByIdIncludingDeleted(id: string): Promise<T | null> {
    // Use service role client for this
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data as T;
  }
}
```

#### Usage Example

```typescript
// src/services/vendor-repository.ts
import { BaseRepository } from './core/base-repository.js';
import { SupabaseClient } from '@supabase/supabase-js';

interface Vendor {
  id: string;
  name: string;
  email: string;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
}

export class VendorRepository extends BaseRepository<Vendor> {
  constructor(supabase: SupabaseClient) {
    super(supabase, 'vendors');
  }

  // Add vendor-specific methods
  async findByEmail(email: string): Promise<Vendor | null> {
    const { data, error } = await this.supabase
      .from('vendors')
      .select('*')
      .eq('email', email)
      .is('deleted_at', null)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }
}

// Usage in API route
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

### 5. Cascading Soft Deletes (PostgreSQL Triggers)

In an ERP, if you delete an `Invoice`, you MUST delete the `InvoiceItems`. Leaving orphan items corrupts reports.

**Recommendation:** Use a **Postgres Trigger** for reliability.

```sql
-- ============================================================================
-- CASCADING SOFT DELETE TRIGGER
-- ============================================================================
-- When an Invoice is soft-deleted, soft-delete its InvoiceItems too
-- When an Invoice is restored, restore its InvoiceItems too

CREATE OR REPLACE FUNCTION cascade_soft_delete_invoice_items()
RETURNS TRIGGER AS $$
BEGIN
    -- If the Invoice is being soft deleted...
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        -- ...Soft delete its children too
        UPDATE invoice_items
        SET 
            deleted_at = NEW.deleted_at, 
            deleted_by = NEW.deleted_by
        WHERE invoice_id = NEW.id
        AND deleted_at IS NULL;  -- Only cascade to active items
    
    -- If the Invoice is being RESTORED...
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        -- ...Restore its children
        UPDATE invoice_items
        SET 
            deleted_at = NULL, 
            deleted_by = NULL
        WHERE invoice_id = NEW.id
        AND deleted_at IS NOT NULL;  -- Only restore deleted items
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS tr_cascade_invoice_delete ON invoices;
CREATE TRIGGER tr_cascade_invoice_delete
AFTER UPDATE ON invoices
FOR EACH ROW
WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)  -- Only fire on delete/restore
EXECUTE FUNCTION cascade_soft_delete_invoice_items();
```

**Pattern for Cascading Soft Deletes:**

```sql
-- Generic pattern for parent-child relationships
CREATE OR REPLACE FUNCTION cascade_soft_delete_children()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        -- Soft delete children
        UPDATE child_table
        SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by
        WHERE parent_id = NEW.id AND deleted_at IS NULL;
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        -- Restore children
        UPDATE child_table
        SET deleted_at = NULL, deleted_by = NULL
        WHERE parent_id = NEW.id AND deleted_at IS NOT NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 📊 CRUD-S Operation Matrix

| Operation | SQL Action | Where Logic Lives | Example |
|-----------|------------|-------------------|---------|
| **Create** | `INSERT` | API / Repository | `INSERT INTO vendors (name, email) VALUES (...)` |
| **Read** | `SELECT ... WHERE deleted_at IS NULL` | **RLS Policy** (Centralized) | RLS automatically filters |
| **Update** | `UPDATE` | API / Repository | `UPDATE vendors SET name = ... WHERE id = ...` |
| **Soft Delete** | `UPDATE ... SET deleted_at = NOW()` | **BaseRepository** Class | `vendorRepo.softDelete(id, userId)` |
| **Restore** | `UPDATE ... SET deleted_at = NULL` | **BaseRepository** Class | `vendorRepo.restore(id)` |
| **Purge** | `DELETE FROM ...` | **Admin Only** (Cron job for GDPR/Retention) | `vendorRepo.hardDelete(id)` |

---

## 🔧 Implementation Checklist

### Phase 1: Database Schema (Week 1)

- [ ] Add `deleted_at`, `deleted_by`, `is_archived` columns to all major tables
- [ ] Create partial indexes for all unique constraints
- [ ] Enable RLS on all tables
- [ ] Create RLS policies for active records (standard users)
- [ ] Create RLS policies for admin access (see all records)

### Phase 2: Application Layer (Week 2)

- [ ] Create `BaseRepository` class
- [ ] Update all repositories to extend `BaseRepository`
- [ ] Replace hard `DELETE` operations with `softDelete()`
- [ ] Update all queries to respect RLS (remove manual `deleted_at IS NULL` filters)
- [ ] Add restore endpoints for admin use

### Phase 3: Cascading Deletes (Week 3)

- [ ] Identify parent-child relationships
- [ ] Create cascading soft delete triggers
- [ ] Test cascade behavior (delete parent → children deleted)
- [ ] Test restore behavior (restore parent → children restored)

### Phase 4: Audit & Compliance (Week 4)

- [ ] Create audit report endpoints (show deleted records)
- [ ] Implement GDPR retention policy (hard delete after X years)
- [ ] Create admin purge endpoint (with approval workflow)
- [ ] Document soft delete in API documentation

---

## 🚨 Critical Rules

### ✅ DO

1. **Always use soft delete** for user-facing deletions
2. **Use RLS policies** to hide deleted records automatically
3. **Use partial indexes** for unique constraints
4. **Use cascading triggers** for parent-child relationships
5. **Log `deleted_by`** for audit trail
6. **Use BaseRepository** to centralize soft delete logic

### ❌ DON'T

1. **Never hard delete** user data (except GDPR retention)
2. **Never bypass RLS** for standard queries
3. **Never create unique indexes** without `WHERE deleted_at IS NULL`
4. **Never manually filter** `deleted_at IS NULL` in queries (RLS handles it)
5. **Never delete parent** without cascading to children
6. **Never expose deleted records** to standard users (admin only)

---

## 📝 Migration Template

```sql
-- Migration: Add Soft Delete to [Table Name]
-- Created: 2025-01-22
-- Description: Implements CRUD-S pattern for [table_name]

-- ============================================================================
-- 1. ADD SOFT DELETE COLUMNS
-- ============================================================================
ALTER TABLE [table_name]
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 2. CREATE PARTIAL INDEXES FOR UNIQUE CONSTRAINTS
-- ============================================================================
-- Example: Email uniqueness
DROP INDEX IF EXISTS idx_[table_name]_email;
CREATE UNIQUE INDEX idx_[table_name]_email_active 
ON [table_name](email) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. ENABLE RLS
-- ============================================================================
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. CREATE RLS POLICIES
-- ============================================================================
-- Standard users: See active records only
DROP POLICY IF EXISTS "[table_name]_select_active" ON [table_name];
CREATE POLICY "[table_name]_select_active" 
ON [table_name] FOR SELECT 
USING (deleted_at IS NULL);

-- Service role: See everything
DROP POLICY IF EXISTS "[table_name]_select_service_role" ON [table_name];
CREATE POLICY "[table_name]_select_service_role" 
ON [table_name] FOR SELECT 
TO service_role
USING (true);

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================
COMMENT ON COLUMN [table_name].deleted_at IS 'Soft delete timestamp. NULL = active, TIMESTAMPTZ = deleted';
COMMENT ON COLUMN [table_name].deleted_by IS 'User ID who performed the soft delete (audit trail)';
COMMENT ON COLUMN [table_name].is_archived IS 'Optional flag for cold storage separation (GDPR compliance)';
```

---

## 🔍 Tables Requiring Soft Delete

Based on codebase analysis, the following tables need soft delete implementation:

### High Priority (Core Business Entities)
- [ ] `nexus_tenants`
- [ ] `nexus_users`
- [ ] `nexus_cases`
- [ ] `nexus_invoices`
- [ ] `nexus_payments`
- [ ] `vmp_vendors`
- [ ] `vmp_companies`
- [ ] `vmp_cases`
- [ ] `vmp_invoices`
- [ ] `vmp_payments`

### Medium Priority (Supporting Entities)
- [ ] `nexus_case_evidence` (✅ Already has `deleted_at`)
- [ ] `nexus_case_messages`
- [ ] `nexus_case_checklist`
- [ ] `vmp_evidence`
- [ ] `vmp_messages`
- [ ] `vmp_checklist_steps`

### Low Priority (Audit/System Tables)
- [ ] `nexus_audit_log` (Immutable - no soft delete)
- [ ] `nexus_sessions` (TTL-based - no soft delete)
- [ ] `nexus_notifications` (TTL-based - no soft delete)

---

## 📚 References

- **PostgreSQL Partial Indexes:** https://www.postgresql.org/docs/current/indexes-partial.html
- **Supabase RLS:** https://supabase.com/docs/guides/auth/row-level-security
- **ERP Soft Delete Patterns:** Industry standard for regulated industries
- **GDPR Compliance:** Data retention and right to erasure

---

**Document Status:** ✅ **APPROVED - Foundational ERP Pattern**  
**Last Updated:** 2025-01-22  
**Owner:** Architecture Team  
**Next Review:** After Phase 1 completion (Week 1)

