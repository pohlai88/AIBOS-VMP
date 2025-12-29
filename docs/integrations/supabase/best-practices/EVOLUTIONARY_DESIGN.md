# Evolutionary Design: Refactoring Databases Without Breaking Apps

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Strategies for evolving database schemas without breaking applications - "Schemaless First, Strict Later"  
**Auto-Generated:** No

---

## 📋 Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [Evolution Patterns](#evolution-patterns)
3. [Migration Strategies](#migration-strategies)
4. [JSONB → Column Promotion](#jsonb--column-promotion)
5. [Backward Compatibility](#backward-compatibility)
6. [Breaking Changes](#breaking-changes)
7. [Real-World Examples](#real-world-examples)
8. [Related Documentation](#related-documentation)

---

## 🧬 Core Philosophy

> **"Schemaless First, Strict Later"** - Start flexible, promote to columns when patterns stabilize.

### The Evolution Principle

Databases should evolve with your application, not constrain it. The schema is a **governance layer** (optimization and safety), not a straitjacket.

### Key Principles

1. **Start Flexible** - Use JSONB for rapidly evolving data
2. **Promote When Stable** - Move to typed columns when patterns stabilize
3. **Maintain Compatibility** - Never break existing applications
4. **Iterate Safely** - Use migrations to evolve, not rewrite

---

## 🔄 Evolution Patterns

### Pattern 1: JSONB First → Column Later

**When:** Data structure is evolving, access patterns not yet clear.

**Process:**
1. Start with JSONB field
2. Monitor usage patterns
3. Promote to column when stable
4. Maintain backward compatibility

**Example:**
```sql
-- Phase 1: Start with JSONB
ALTER TABLE nexus_cases
  ADD COLUMN metadata JSONB DEFAULT '{}';

-- Application stores priority in metadata
UPDATE nexus_cases
SET metadata = jsonb_set(metadata, '{priority}', '"urgent"')
WHERE id = '...';

-- Phase 2: Monitor usage, see it's queried frequently
-- Phase 3: Promote to column
ALTER TABLE nexus_cases
  ADD COLUMN priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- Migrate existing data
UPDATE nexus_cases
SET priority = metadata->>'priority'
WHERE metadata->>'priority' IS NOT NULL;

-- Phase 4: Update application to use column
-- Phase 5: (Optional) Remove from JSONB after verification
```

---

### Pattern 2: Additive Changes Only

**When:** Adding new features or fields.

**Rule:** Always add, never remove (incrementally).

**Process:**
1. Add new column/field (nullable)
2. Populate gradually
3. Make required later (if needed)
4. Deprecate old field (mark, don't remove)

**Example:**
```sql
-- Add new field (nullable)
ALTER TABLE nexus_cases
  ADD COLUMN sla_tier TEXT CHECK (sla_tier IN ('gold', 'silver', 'bronze'));

-- Populate gradually (no breaking change)
-- Application can use new field when available

-- Later: Make required (if needed)
ALTER TABLE nexus_cases
  ALTER COLUMN sla_tier SET DEFAULT 'bronze';

-- Deprecate old field (mark, don't remove)
COMMENT ON COLUMN nexus_cases.old_field IS 'DEPRECATED: Use new_field instead';
```

---

### Pattern 3: Soft Deprecation

**When:** Replacing a field or structure.

**Rule:** Never remove immediately, always deprecate first.

**Process:**
1. Add new field
2. Mark old field as deprecated
3. Migrate data gradually
4. Remove old field later (after verification)

**Example:**
```sql
-- Step 1: Add new field
ALTER TABLE nexus_cases
  ADD COLUMN tags TEXT[] DEFAULT '{}';

-- Step 2: Mark old field as deprecated
COMMENT ON COLUMN nexus_cases.tags_jsonb IS 'DEPRECATED: Use tags (TEXT[]) instead';

-- Step 3: Migrate data gradually
UPDATE nexus_cases
SET tags = ARRAY(SELECT jsonb_array_elements_text(tags_jsonb))
WHERE tags_jsonb IS NOT NULL AND tags_jsonb != '[]'::jsonb;

-- Step 4: Update application to use new field
-- Step 5: (After verification) Remove old field
-- ALTER TABLE nexus_cases DROP COLUMN tags_jsonb;
```

---

### Pattern 4: Versioned Schemas

**When:** Major structural changes needed.

**Rule:** Support multiple versions simultaneously.

**Process:**
1. Add version field
2. Support both old and new formats
3. Migrate gradually
4. Remove old format after migration complete

**Example:**
```sql
-- Add version field
ALTER TABLE nexus_payments
  ADD COLUMN schema_version INTEGER DEFAULT 1;

-- Old format: line_items JSONB (version 1)
-- New format: payment_line_items table (version 2)

-- Application checks version and handles both
-- Migrate records to version 2 gradually
-- Remove version 1 support after all migrated
```

---

### Pattern 5: Just-in-Time Migration (Metadata Guardrails)

**When:** Need to write new data formats immediately without halting development.

**Rule:** Use metadata guardrails to write new formats, migrate to columns only when performance requires it.

**Process:**
1. Write new data format to JSONB with version tag
2. Application handles both old and new formats
3. Monitor performance and usage
4. Migrate to columns only when it becomes a bottleneck
5. Use background migration to standardize gradually

**Example:**
```sql
-- Step 1: Write new format immediately (no migration needed)
UPDATE nexus_cases
SET metadata = jsonb_set(
  metadata,
  '{priority}',
  '"urgent"'
)
WHERE id = '...';

-- Add version tag for tracking
UPDATE nexus_cases
SET metadata = jsonb_set(
  metadata,
  '{_schema_version}',
  '2'
)
WHERE metadata->>'_schema_version' IS NULL;

-- Step 2: Application handles both formats
-- (See application code example below)

-- Step 3: Monitor - if priority is queried frequently, promote to column
-- Step 4: Background migration (only when performance requires it)
ALTER TABLE nexus_cases
  ADD COLUMN priority TEXT;

-- Migrate in background (non-blocking)
UPDATE nexus_cases
SET priority = metadata->>'priority'
WHERE metadata->>'priority' IS NOT NULL
  AND priority IS NULL;

-- Step 5: Application switches to column (gradual rollout)
```

**Application Code (Handles Both Formats):**
```javascript
// Application code handles both JSONB and column
function getPriority(case) {
  // Try column first (if promoted)
  if (case.priority) {
    return case.priority;
  }
  
  // Fall back to JSONB (if not yet promoted)
  const version = case.metadata?._schema_version || 1;
  if (version === 2) {
    return case.metadata?.priority;
  } else if (version === 1) {
    return case.metadata?.priority_level; // Old format
  }
  
  return 'normal'; // Default
}
```

**Benefits:**
- ✅ No development halt for schema changes
- ✅ Write new formats immediately
- ✅ Migrate only when performance requires it
- ✅ Zero-downtime evolution
- ✅ Metadata guardrails prevent data swamp

---

## 🚀 Migration Strategies

### Strategy 1: Zero-Downtime Migrations

**Principle:** Never break running applications.

**Techniques:**
1. Additive changes only (add columns, don't remove)
2. Backward compatible defaults
3. Gradual rollout
4. Feature flags

**Example:**
```sql
-- Add new column with default (no breaking change)
ALTER TABLE nexus_cases
  ADD COLUMN priority TEXT DEFAULT 'normal'
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- Application can use new field immediately
-- Old code continues to work (default value used)
```

---

### Strategy 2: Dual-Write Pattern

**Principle:** Write to both old and new fields during transition.

**Process:**
1. Add new field
2. Application writes to both
3. Migrate existing data
4. Switch reads to new field
5. Remove old field

**Example:**
```javascript
// Application code during transition
async function createCase(data) {
  const case = await supabase
    .from('nexus_cases')
    .insert({
      // Old field (for backward compatibility)
      metadata: { priority: data.priority },
      // New field (for future)
      priority: data.priority
    })
    .select()
    .single();
  
  return case;
}
```

---

### Strategy 3: Feature Flags

**Principle:** Control rollout with feature flags.

**Process:**
1. Add feature flag to settings
2. Use flag to enable/disable new behavior
3. Roll out gradually
4. Remove flag after full rollout

**Example:**
```sql
-- Feature flag in tenant settings
UPDATE nexus_tenants
SET settings = jsonb_set(settings, '{use_new_priority_field}', 'true')
WHERE id = '...';

-- Application checks flag
const useNewField = tenant.settings?.use_new_priority_field;
const priority = useNewField 
  ? case.priority 
  : case.metadata?.priority;
```

---

## 📈 JSONB → Column Promotion

### When to Promote

Promote JSONB to typed column when:

1. **Access Pattern Stabilizes**
   - Field is queried frequently
   - Structure is consistent across records
   - Performance would benefit from B-tree index

2. **Validation Needed**
   - Need database-level constraints
   - Need foreign key relationships
   - Need NOT NULL enforcement

3. **Reporting Requirements**
   - Need to aggregate/group by field
   - Need to join on field
   - Need complex queries

### Promotion Process

#### Step 1: Add Column (Nullable)

```sql
ALTER TABLE nexus_cases
  ADD COLUMN priority TEXT 
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
```

#### Step 2: Migrate Data

```sql
-- Migrate from JSONB to column
UPDATE nexus_cases
SET priority = metadata->>'priority'
WHERE metadata->>'priority' IS NOT NULL
  AND metadata->>'priority' IN ('low', 'normal', 'high', 'urgent');
```

#### Step 3: Create Index

```sql
CREATE INDEX idx_nexus_cases_priority 
ON nexus_cases(priority);
```

#### Step 4: Update Application

```javascript
// Old code (JSONB)
const priority = case.metadata?.priority;

// New code (Column)
const priority = case.priority;
```

#### Step 5: Set Default (If Needed)

```sql
ALTER TABLE nexus_cases
  ALTER COLUMN priority SET DEFAULT 'normal';
```

#### Step 6: Make NOT NULL (If Needed)

```sql
-- Only after all records have values
ALTER TABLE nexus_cases
  ALTER COLUMN priority SET NOT NULL;
```

#### Step 7: Clean Up JSONB (Optional)

```sql
-- Remove from JSONB after verification
UPDATE nexus_cases
SET metadata = metadata - 'priority'
WHERE metadata ? 'priority';
```

### Promotion Checklist

- [ ] Field is queried frequently
- [ ] Structure is consistent across records
- [ ] Performance would benefit from B-tree index
- [ ] Validation constraints needed
- [ ] Reporting/analytics requirements
- [ ] Migration script tested
- [ ] Application code updated
- [ ] Old JSONB data cleaned up (optional)

---

## 🔄 Backward Compatibility

### Principle: Never Break Existing Code

**Rules:**
1. Additive changes only (add, don't remove)
2. Default values for new required fields
3. Support both old and new formats during transition
4. Deprecate, don't remove immediately

### Compatibility Patterns

#### Pattern 1: Default Values

```sql
-- New required field with default (backward compatible)
ALTER TABLE nexus_cases
  ADD COLUMN priority TEXT DEFAULT 'normal' NOT NULL;
```

#### Pattern 2: Nullable New Fields

```sql
-- New optional field (backward compatible)
ALTER TABLE nexus_cases
  ADD COLUMN sla_tier TEXT;
```

#### Pattern 3: Dual Support

```javascript
// Application supports both old and new
function getPriority(case) {
  // Try new field first
  if (case.priority) {
    return case.priority;
  }
  // Fall back to old field
  if (case.metadata?.priority) {
    return case.metadata.priority;
  }
  // Default
  return 'normal';
}
```

---

## ⚠️ Breaking Changes

### When Breaking Changes Are Necessary

Sometimes breaking changes are unavoidable:
- Security fixes
- Data corruption issues
- Performance critical changes
- Major architectural shifts

### Breaking Change Process

1. **Plan Carefully**
   - Document impact
   - Create migration path
   - Set deprecation timeline

2. **Communicate Early**
   - Announce deprecation
   - Provide migration guide
   - Set removal date

3. **Support Both (Temporarily)**
   - Keep old format working
   - Add new format
   - Provide migration tools

4. **Remove After Migration**
   - Verify all migrated
   - Remove old format
   - Update documentation

### Example: Breaking Change

```sql
-- Step 1: Announce deprecation
COMMENT ON COLUMN nexus_cases.tags_jsonb IS 
  'DEPRECATED: Will be removed on 2025-03-01. Use tags (TEXT[]) instead.';

-- Step 2: Provide migration script
-- (See migration file)

-- Step 3: Support both during transition
-- Application handles both formats

-- Step 4: Remove after migration complete
-- ALTER TABLE nexus_cases DROP COLUMN tags_jsonb;
```

---

## 📚 Real-World Examples

### Example 1: Tags Field Evolution

**Initial:** JSONB array
```sql
ALTER TABLE vmp_cases
  ADD COLUMN tags JSONB DEFAULT '[]'::jsonb;

CREATE INDEX idx_vmp_cases_tags ON vmp_cases USING GIN (tags);
```

**Evolution:** TEXT array (better performance, simpler queries)
```sql
ALTER TABLE nexus_cases
  ADD COLUMN tags TEXT[] DEFAULT '{}';

-- Migrate from JSONB
UPDATE nexus_cases
SET tags = ARRAY(SELECT jsonb_array_elements_text(metadata->'tags'))
WHERE metadata->'tags' IS NOT NULL;
```

**Why:** TEXT[] is simpler, faster, and more PostgreSQL-native for array operations.

---

### Example 2: Metadata Field Addition

**Pattern:** Add metadata field for flexibility
```sql
ALTER TABLE vmp_messages
  ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX idx_vmp_messages_metadata ON vmp_messages USING GIN (metadata);
```

**Usage:** Store channel-specific data
```sql
-- WhatsApp message
metadata = '{"whatsapp": {"message_id": "wamid.xxx", "thread_id": "thread_123"}}'

-- Email message
metadata = '{"email": {"message_id": "<abc@example.com>", "in_reply_to": "<xyz@example.com>"}}'
```

**Why:** Different channels have different metadata structures. JSONB accommodates this without schema changes.

---

### Example 3: Settings Field Evolution

**Initial:** Hard-coded settings in application
**Evolution:** JSONB settings field
```sql
ALTER TABLE nexus_tenants
  ADD COLUMN settings JSONB DEFAULT '{}';

-- Store flexible configuration
settings = '{
  "features": {"soa_matching": true, "whatsapp_bridge": false},
  "sla": {"default_hours": 48, "escalation_levels": 3}
}'
```

**Future Promotion:** If specific settings become critical, promote to columns
```sql
-- If "default_sla_hours" becomes critical
ALTER TABLE nexus_tenants
  ADD COLUMN default_sla_hours INTEGER DEFAULT 48;
```

---

## 🎯 Best Practices

### 1. Start Flexible

✅ **Do:**
- Use JSONB for evolving data
- Use JSONB for user-defined data
- Use JSONB for extension data

❌ **Don't:**
- Over-engineer schema upfront
- Create columns for data that might change
- Lock in structure before understanding patterns

### 2. Monitor Usage

✅ **Do:**
- Track query patterns
- Monitor performance
- Identify frequently accessed JSONB fields

❌ **Don't:**
- Promote too early (before patterns stabilize)
- Promote too late (after performance issues)

### 3. Promote Strategically

✅ **Do:**
- Promote when access patterns stabilize
- Promote when validation needed
- Promote when performance critical

❌ **Don't:**
- Promote everything to columns
- Promote before understanding patterns
- Promote without migration plan

### 4. Maintain Compatibility

✅ **Do:**
- Additive changes only
- Default values for new fields
- Support both old and new during transition

❌ **Don't:**
- Remove fields immediately
- Break existing code
- Force immediate migration

### 5. Document Evolution

✅ **Do:**
- Document why JSONB was chosen
- Document when to promote
- Document migration paths

❌ **Don't:**
- Leave evolution undocumented
- Forget why decisions were made
- Skip migration documentation

---

## 📖 Related Documentation

- [Domain Modeling](../database/DOMAIN_MODELING.md) - Business entities (the abstract concept)
- [Flexible Data Patterns](../database/FLEXIBLE_DATA_PATTERNS.md) - JSONB vs. columns decision framework
- [Schema Reference](../database/SCHEMA_REFERENCE.md) - Database schema (implementation detail)
- [Migration Best Practices](./MIGRATION_BEST_PRACTICES.md) - Migration guidelines

---

## 🎯 Quick Reference

### Evolution Checklist

**Starting New Feature:**
- [ ] Use JSONB for flexible data
- [ ] Document why JSONB was chosen
- [ ] Monitor usage patterns

**Promoting JSONB to Column:**
- [ ] Access pattern stabilized
- [ ] Validation needed
- [ ] Performance critical
- [ ] Migration script ready
- [ ] Application code updated
- [ ] Backward compatibility maintained

**Making Breaking Changes:**
- [ ] Impact documented
- [ ] Migration path created
- [ ] Deprecation announced
- [ ] Both formats supported
- [ ] Removal date set

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22

