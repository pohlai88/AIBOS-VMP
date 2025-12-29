# CRUD-S Registry Contract

**Date:** 2025-01-22  
**Status:** ✅ **ENFORCED**  
**Purpose:** Safe-by-construction soft delete enforcement

---

## 🎯 Principle

**CRUD-S applies ONLY to core business entities** (not logs, queues, junctions, audit).

This registry prevents accidental soft-delete on immutable/state tables.

---

## ✅ CRUD-S Capable Tables (Soft Delete + Restore)

### Core Business Entities

| Table | ID Column | Has deleted_by | Notes |
|-------|-----------|----------------|-------|
| `nexus_tenants` | `tenant_id` | ✅ Yes | Master tenant records |
| `nexus_users` | `user_id` | ✅ Yes | User accounts |
| `nexus_cases` | `case_id` | ✅ Yes | Case records |
| `nexus_invoices` | `invoice_id` | ✅ Yes | Invoice records |
| `nexus_payments` | `payment_id` | ✅ Yes | Payment records |
| `nexus_case_messages` | `message_id` | ✅ Yes | Case messages |
| `nexus_case_checklist` | `item_id` | ✅ Yes | Checklist items |

### Special Cases

| Table | ID Column | Has deleted_by | Notes |
|-------|-----------|----------------|-------|
| `nexus_case_evidence` | `evidence_id` | ⚠️ **Temporary: false** | Will be `true` after migration 052 |

### VMP Legacy Tables (if still in use)

| Table | ID Column | Has deleted_by | Notes |
|-------|-----------|----------------|-------|
| `vmp_vendors` | `id` | ✅ Yes | Legacy vendor table |
| `vmp_companies` | `id` | ✅ Yes | Legacy company table |
| `vmp_cases` | `id` | ✅ Yes | Legacy case table |
| `vmp_invoices` | `id` | ✅ Yes | Legacy invoice table |
| `vmp_payments` | `id` | ✅ Yes | Legacy payment table |

---

## ❌ Non-CRUD-S Tables (By Design)

These tables **DO NOT** support soft delete. Attempting to use `softDeleteEntity()` will throw `SOFT_DELETE_NOT_SUPPORTED`.

### Junction Tables
- `nexus_tenant_relationships` - Relationship edges (hard delete OK)
- `nexus_relationship_invites` - Invitation records (hard delete OK)

### Session/State Tables
- `nexus_sessions` - User sessions (TTL-based retention)

### Audit/Activity Tables (Immutable)
- `nexus_case_activity` - Case audit trail (append-only)
- `nexus_payment_activity` - Payment audit trail (append-only)
- `nexus_audit_log` - System audit log (append-only)

### Queue/Notification Infrastructure
- `nexus_notifications` - Notification records (TTL-based retention)
- `nexus_notification_config` - Notification configuration
- `nexus_user_notification_prefs` - User preferences
- `nexus_notification_queue` - Queue records (TTL-based retention)
- `nexus_push_subscriptions` - Push subscription records

### Workflow Records
- `nexus_document_requests` - Document request workflow (use status machine, not delete)

---

## 🔒 Registry Location

**File:** `src/adapters/nexus-adapter.js`

**Registry Name:** `SOFT_DELETE_CAPABLE`

**Structure:**
```javascript
const SOFT_DELETE_CAPABLE = {
  table_name: { 
    idColumn: 'id_column_name', 
    hasDeletedBy: true | false 
  },
  // ...
};
```

---

## 🛡️ Safety Enforcement

### Adapter Methods

- `softDeleteEntity()` - Checks registry, throws `SOFT_DELETE_NOT_SUPPORTED` if not found
- `restoreEntity()` - Checks registry, throws `SOFT_DELETE_NOT_SUPPORTED` if not found
- `getSoftDeleteConfig(table)` - Returns registry entry or `null`

### Route Templates

- DELETE/RESTORE routes include try-catch for `SOFT_DELETE_NOT_SUPPORTED`
- Returns HTTP 400 with clear error message

### Service Templates

- BaseRepository constructor accepts `{ hasDeletedBy: true | false }`
- Conditionally sets `deleted_by` based on `hasDeletedBy` flag

---

## 📋 Adding New CRUD-S Tables

### Step 1: Add to Registry

Edit `src/adapters/nexus-adapter.js`:

```javascript
const SOFT_DELETE_CAPABLE = {
  // ... existing entries ...
  your_new_table: { idColumn: 'your_id_column', hasDeletedBy: true },
};
```

### Step 2: Ensure Migration Has Columns

Migration must include:
- `deleted_at TIMESTAMPTZ DEFAULT NULL`
- `deleted_by UUID REFERENCES auth.users(id)` (if `hasDeletedBy: true`)

### Step 3: Add RLS Policy

See `migrations/049_soft_delete_rls_policies.sql` for pattern.

### Step 4: Add Partial Index

See `migrations/050_soft_delete_partial_indexes.sql` for pattern.

---

## 🚫 Preventing Misuse

### Why Registry (Not Schema Introspection)?

1. **Deterministic** - No runtime database queries
2. **Explicit** - Clear contract of what supports CRUD-S
3. **Governance-Friendly** - Code review required to add tables
4. **Fast** - No performance overhead

### Error Response

When attempting soft delete on non-CRUD-S table:

```json
{
  "data": null,
  "error": {
    "code": "SOFT_DELETE_NOT_SUPPORTED",
    "message": "Table 'nexus_audit_log' does not support soft delete. Only core business entities support CRUD-S."
  }
}
```

HTTP Status: `400 Bad Request`

---

## 📝 Lifecycle Patterns for Non-CRUD-S Tables

### Junction Tables
- **Pattern:** Hard delete is acceptable
- **Reason:** Relationship edges, not business records

### Sessions/Queue
- **Pattern:** Hard delete + TTL retention
- **Reason:** Ephemeral state, not business records

### Audit/Activity
- **Pattern:** Immutable append-only (never delete)
- **Reason:** Legal/regulatory requirement

### Document Requests
- **Pattern:** State machine (`requested → uploaded → accepted/rejected/cancelled`)
- **Reason:** Workflow record, not business entity

---

## ✅ Compliance Checklist

When adding a new business entity:

- [ ] Table has `deleted_at` column
- [ ] Table has `deleted_by` column (or documented exception)
- [ ] Added to `SOFT_DELETE_CAPABLE` registry
- [ ] RLS policy hides soft-deleted records
- [ ] Partial index for unique constraints
- [ ] Service template uses correct `hasDeletedBy` flag
- [ ] Route templates include error handling

---

**Last Updated:** 2025-01-22  
**Version:** 1.0.0  
**Maintainer:** Architecture Team

