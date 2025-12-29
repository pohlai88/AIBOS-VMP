# Flexible Data Patterns: JSONB vs. Columns

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Decision framework for when to use JSONB (flexible) vs. typed columns (strict) - The "Anti-Trap" Guide  
**Auto-Generated:** No

---

## 📋 Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [Decision Framework](#decision-framework)
3. [JSONB Patterns in VMP](#jsonb-patterns-in-vmp)
4. [When to Use JSONB](#when-to-use-jsonb)
5. [When to Use Columns](#when-to-use-columns)
6. [Promotion Strategy](#promotion-strategy)
7. [Query Patterns](#query-patterns)
8. [Performance Considerations](#performance-considerations)
9. [Related Documentation](#related-documentation)

---

## 🧬 Core Philosophy

> **"Schemaless First, Strict Later"** - Start flexible, promote to columns when patterns stabilize.

### The Hybrid Approach

PostgreSQL (Supabase) is unique because it allows you to be:
- **Flexible** (like MongoDB) - Using JSONB for unstructured data
- **Strict** (like MySQL) - Using typed columns for structured data
- **Both simultaneously** - The best of both worlds

### The Trap to Avoid

❌ **Trap:** Treating the schema as the *definition* of the application, creating rigid thinking.

✅ **Solution:** Treat the schema as a **governance layer** (optimization and safety) applied *after* understanding data access patterns.

---

## 🎯 Decision Framework

### Quick Decision Tree

```
Is the data structure:
├─ Well-understood and stable?
│  └─ YES → Use typed columns
│
├─ Varying between records?
│  └─ YES → Use JSONB
│
├─ Frequently queried by specific fields?
│  └─ YES → Consider columns (or JSONB with GIN index)
│
├─ Rapidly evolving during development?
│  └─ YES → Use JSONB first, promote later
│
└─ Need strict validation/constraints?
   └─ YES → Use typed columns with CHECK constraints
```

### Decision Matrix

| Factor | JSONB | Typed Columns |
|--------|-------|---------------|
| **Structure Stability** | Varying, evolving | Fixed, stable |
| **Query Patterns** | Flexible queries | Specific field queries |
| **Validation Needs** | Application-level | Database-level constraints |
| **Performance** | Good with GIN indexes | Excellent with B-tree indexes |
| **Development Speed** | Fast iteration | Requires migrations |
| **Data Integrity** | Application-enforced | Database-enforced |

---

## 📊 JSONB Patterns in VMP

### Current JSONB Usage

Based on codebase analysis, VMP uses JSONB extensively for flexibility:

#### 1. Metadata Fields

**Pattern:** `metadata JSONB DEFAULT '{}'`

**Used In:**
- `nexus_tenants.metadata`
- `nexus_cases.metadata`
- `nexus_payments.metadata`
- `vmp_messages.metadata`
- `nexus_invoices.metadata`
- And 15+ other tables

**Purpose:** Store flexible, entity-specific extension data without schema changes.

**Example:**
```sql
-- Store channel-specific metadata
metadata = '{
  "whatsapp": {"message_id": "wamid.xxx", "thread_id": "thread_123"},
  "email": {"message_id": "<abc@example.com>", "in_reply_to": "<xyz@example.com>"}
}'
```

**Why JSONB:**
- ✅ Different channels have different metadata structures
- ✅ New channels can be added without migrations
- ✅ Flexible querying with JSON operators

---

#### 2. Settings/Configuration

**Pattern:** `settings JSONB DEFAULT '{}'` or `preferences JSONB DEFAULT '{}'`

**Used In:**
- `nexus_tenants.settings`
- `nexus_users.preferences`
- `nexus_notification_config.configuration`

**Purpose:** Store flexible configuration without schema changes.

**Example:**
```sql
-- Tenant-specific settings
settings = '{
  "features": {"soa_matching": true, "whatsapp_bridge": false},
  "sla": {"default_hours": 48, "escalation_levels": 3},
  "notifications": {"email_enabled": true, "sms_enabled": false}
}'
```

**Why JSONB:**
- ✅ Settings vary by tenant/user
- ✅ New features can add settings without migrations
- ✅ Easy to query and update nested values

---

#### 3. Line Items (Flexible Structures)

**Pattern:** `line_items JSONB DEFAULT '[]'`

**Used In:**
- `nexus_payments.line_items`
- `nexus_invoices.line_items` (implied)

**Purpose:** Store variable-length line item structures.

**Example:**
```sql
-- Payment line items
line_items = '[
  {"invoice_id": "INV-001", "amount": 1000.00, "currency": "USD"},
  {"invoice_id": "INV-002", "amount": 500.00, "currency": "USD", "discount": 50.00}
]'
```

**Why JSONB:**
- ✅ Line items have varying structures
- ✅ Can add fields (discount, tax, etc.) without migrations
- ✅ Easy to aggregate and query

---

#### 4. Tags/Categorization

**Pattern:** `tags JSONB DEFAULT '[]'` or `tags TEXT[] DEFAULT '{}'`

**Used In:**
- `vmp_cases.tags` (JSONB)
- `nexus_cases.tags` (TEXT[])

**Purpose:** Flexible categorization without fixed categories.

**Example:**
```sql
-- Case tags
tags = '["urgent", "compliance", "payment", "q4-2024"]'
```

**Why JSONB/TEXT[]:**
- ✅ Tags are user-defined, not fixed
- ✅ Can add/remove tags without schema changes
- ✅ Easy to query with array operators

---

#### 5. Match Criteria (Flexible Logic)

**Pattern:** `match_criteria JSONB`

**Used In:**
- `vmp_soa_matches.match_criteria`

**Purpose:** Store flexible matching logic results.

**Example:**
```sql
-- SOA matching criteria
match_criteria = '{
  "invoice_number": true,
  "amount": true,
  "date": false,
  "algorithm_version": "2.1",
  "confidence_score": 0.95
}'
```

**Why JSONB:**
- ✅ Matching logic evolves over time
- ✅ Different algorithms produce different criteria
- ✅ Flexible structure accommodates algorithm changes

---

#### 6. Delivery Attempts (Event Arrays)

**Pattern:** `delivery_attempts JSONB DEFAULT '[]'`

**Used In:**
- `nexus_notifications.delivery_attempts`

**Purpose:** Store array of delivery attempt events.

**Example:**
```sql
-- Notification delivery attempts
delivery_attempts = '[
  {"timestamp": "2025-01-22T10:00:00Z", "status": "sent", "channel": "email"},
  {"timestamp": "2025-01-22T10:05:00Z", "status": "failed", "channel": "sms", "error": "Invalid number"}
]'
```

**Why JSONB:**
- ✅ Variable number of attempts
- ✅ Different channels have different error structures
- ✅ Easy to append new attempts

---

## ✅ When to Use JSONB

### Use JSONB When:

1. **Structure Varies Between Records**
   - Different records have different fields
   - Example: Channel-specific metadata (WhatsApp vs. Email)

2. **Rapid Development/Iteration**
   - Structure is still evolving
   - Don't want to create migrations for every change
   - Example: New feature flags, settings

3. **User-Defined Data**
   - Users define the structure
   - Example: Tags, custom fields, preferences

4. **Extension Data**
   - Additional data that doesn't fit core schema
   - Example: Metadata, configuration, audit trails

5. **Variable-Length Arrays**
   - Arrays with varying structures
   - Example: Line items, delivery attempts, event logs

6. **Integration Data**
   - Data from external systems with varying structures
   - Example: API responses, webhook payloads

---

## 🔒 When to Use Typed Columns

### Use Typed Columns When:

1. **Structure is Stable and Well-Understood**
   - Fields are consistent across all records
   - Example: Email, name, amount, date

2. **Frequent Queries on Specific Fields**
   - Need to filter/sort by specific fields
   - Example: Status, priority, due_date

3. **Database-Level Validation Required**
   - Need CHECK constraints, foreign keys, NOT NULL
   - Example: Status enums, required fields, relationships

4. **Performance is Critical**
   - Need B-tree indexes for fast lookups
   - Example: Primary keys, foreign keys, frequently queried fields

5. **Data Integrity is Critical**
   - Need database-enforced constraints
   - Example: Amounts, dates, required relationships

6. **Reporting/Analytics**
   - Need to aggregate, group, join on specific fields
   - Example: Sum amounts, count by status, date ranges

---

## 🔄 Promotion Strategy

### When to Promote JSONB → Columns

Promote JSONB fields to typed columns when:

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

```sql
-- Step 1: Add new column (nullable)
ALTER TABLE nexus_cases
  ADD COLUMN priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- Step 2: Migrate data from JSONB
UPDATE nexus_cases
SET priority = metadata->>'priority'
WHERE metadata->>'priority' IS NOT NULL;

-- Step 3: Make column NOT NULL (if needed)
ALTER TABLE nexus_cases
  ALTER COLUMN priority SET NOT NULL;

-- Step 4: Create index
CREATE INDEX idx_nexus_cases_priority ON nexus_cases(priority);

-- Step 5: Update application code to use column instead of JSONB

-- Step 6: Remove from JSONB (optional, after verification)
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

## 🔍 Query Patterns

### JSONB Query Examples

#### 1. Access Nested Values

```sql
-- Get metadata field
SELECT metadata->>'channel' AS channel
FROM vmp_messages;

-- Get nested object
SELECT metadata->'whatsapp'->>'message_id' AS whatsapp_id
FROM vmp_messages
WHERE metadata->'whatsapp' IS NOT NULL;
```

#### 2. Filter by JSONB Field

```sql
-- Filter by metadata field
SELECT *
FROM nexus_cases
WHERE metadata->>'priority' = 'urgent';

-- Filter by nested field
SELECT *
FROM vmp_messages
WHERE metadata->'email'->>'in_reply_to' IS NOT NULL;
```

#### 3. Array Operations

```sql
-- Check if array contains value
SELECT *
FROM vmp_cases
WHERE tags @> '["urgent"]'::jsonb;

-- Get array length
SELECT jsonb_array_length(tags) AS tag_count
FROM vmp_cases;
```

#### 4. GIN Index Queries

```sql
-- Create GIN index for efficient JSONB queries
CREATE INDEX idx_vmp_cases_tags_gin ON vmp_cases USING GIN (tags);
CREATE INDEX idx_vmp_messages_metadata_gin ON vmp_messages USING GIN (metadata);

-- Use index for queries
SELECT *
FROM vmp_cases
WHERE tags @> '["urgent"]'::jsonb;  -- Uses GIN index
```

---

## 🛡️ The Metadata Safety Net

> **"Structure on Demand"** - Don't enforce rigid schema on write (blocking the app), but enforce description on read (so you know what you have).

### The Problem: Data Swamp

Without metadata guardrails, JSONB can become a "data swamp" where:
- ❌ You don't know what structure the data has
- ❌ You can't parse it without guessing
- ❌ Different versions of data coexist without tracking
- ❌ No audibility or context

### The Solution: Metadata Guardrails

Use three patterns to maintain structure while preserving flexibility:

#### Pattern 1: The Version Tag

**Embed schema version in every JSONB payload.**

```sql
-- Store version with data
metadata = '{
  "_schema_version": 2,
  "priority": "urgent",
  "tags": ["compliance", "payment"]
}'

-- Application checks version before parsing
const version = metadata._schema_version || 1;
if (version === 2) {
  // Parse v2 structure
  const priority = metadata.priority;
} else if (version === 1) {
  // Parse v1 structure (backward compatibility)
  const priority = metadata.priority_level;
}
```

**Benefits:**
- ✅ Know exactly how to parse the data
- ✅ Support multiple versions simultaneously
- ✅ Gradual migration without breaking changes

**Example from VMP:**
```sql
-- Case metadata with version
UPDATE nexus_cases
SET metadata = jsonb_set(metadata, '{_schema_version}', '2')
WHERE metadata->>'_schema_version' IS NULL;

-- Query with version awareness
SELECT *
FROM nexus_cases
WHERE metadata->>'_schema_version' = '2'
  AND metadata->>'priority' = 'urgent';
```

---

#### Pattern 2: The Context Header

**Store who and why data was changed inside the JSON (audibility without extra tables).**

```sql
-- Store context with data
metadata = '{
  "_context": {
    "updated_by": "user_123",
    "updated_at": "2025-01-22T10:00:00Z",
    "reason": "SLA escalation",
    "source": "automated_system"
  },
  "priority": "urgent",
  "escalation_level": 2
}'
```

**Benefits:**
- ✅ Full audit trail without separate audit table
- ✅ Know why data changed
- ✅ Track data lineage
- ✅ Debug data issues

**Example from VMP:**
```sql
-- Case metadata with context
UPDATE nexus_cases
SET metadata = jsonb_set(
  metadata,
  '{_context}',
  jsonb_build_object(
    'updated_by', current_setting('app.user_id', true),
    'updated_at', now()::text,
    'reason', 'Manual priority update',
    'source', 'web_ui'
  )
)
WHERE id = '...';
```

---

#### Pattern 3: The Type Discriminator

**Use a `type` field to allow multiple different "entities" to live in the same flexible table (Polymorphism).**

```sql
-- Store different entity types in same table
CREATE TABLE flexible_entities (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,  -- Type discriminator
  data JSONB NOT NULL
);

-- Different types with different structures
INSERT INTO flexible_entities (type, data) VALUES
  ('invoice', '{"invoice_number": "INV-001", "amount": 1000}'),
  ('payment', '{"payment_id": "PAY-001", "method": "wire"}'),
  ('case', '{"case_id": "CASE-001", "status": "open"}');

-- Query by type
SELECT *
FROM flexible_entities
WHERE type = 'invoice'
  AND data->>'amount'::numeric > 500;
```

**Benefits:**
- ✅ Store related but different entities together
- ✅ Query by type for filtering
- ✅ Polymorphic relationships
- ✅ Flexible schema per type

**Example from VMP:**
```sql
-- Notification queue with type discriminator
INSERT INTO nexus_notification_queue (type, data) VALUES
  ('email', '{"to": "user@example.com", "subject": "Case update"}'),
  ('sms', '{"phone": "+1234567890", "message": "Case resolved"}'),
  ('push', '{"user_id": "user_123", "title": "New message"}');

-- Process by type
SELECT *
FROM nexus_notification_queue
WHERE type = 'email'
  AND processed_at IS NULL;
```

---

### Metadata Guardrails Checklist

When using JSONB, always include:

- [ ] **Version Tag** (`_schema_version`) - Know how to parse
- [ ] **Context Header** (`_context`) - Know who/why/when
- [ ] **Type Discriminator** (`type`) - If storing multiple entity types
- [ ] **Validation** - Application-level validation of structure
- [ ] **Documentation** - Document expected structure per version

### Example: Complete Metadata Guardrail

```sql
-- Complete example with all guardrails
metadata = '{
  "_schema_version": 2,
  "_context": {
    "created_by": "user_123",
    "created_at": "2025-01-22T10:00:00Z",
    "updated_by": "user_456",
    "updated_at": "2025-01-22T11:00:00Z",
    "reason": "SLA escalation",
    "source": "automated_system"
  },
  "priority": "urgent",
  "tags": ["compliance", "payment"],
  "custom_fields": {
    "department": "finance",
    "project_code": "PROJ-001"
  }
}'
```

---

## ⚡ Performance Considerations

### JSONB Indexing

**GIN Indexes:**
- ✅ Excellent for `@>`, `?`, `?&`, `?|` operators
- ✅ Good for array containment queries
- ✅ Larger index size than B-tree
- ✅ Slower updates than B-tree

**B-tree Indexes:**
- ✅ Excellent for `->`, `->>` operators (if extracted to column)
- ✅ Smaller index size
- ✅ Faster updates
- ❌ Not suitable for nested JSONB queries

### Performance Tips

1. **Use GIN Indexes for JSONB Queries**
   ```sql
   CREATE INDEX idx_table_jsonb_field_gin ON table_name USING GIN (jsonb_field);
   ```

2. **Extract Frequently Queried Fields**
   - If a JSONB field is queried frequently, consider promoting to column
   - Or create a generated column:
   ```sql
   ALTER TABLE nexus_cases
     ADD COLUMN priority TEXT GENERATED ALWAYS AS (metadata->>'priority') STORED;
   CREATE INDEX idx_nexus_cases_priority ON nexus_cases(priority);
   ```

3. **Avoid Deep Nesting**
   - Keep JSONB structure relatively flat
   - Deep nesting makes queries complex and slow

4. **Use JSONB Operators Efficiently**
   - `->` returns JSONB (for nested access)
   - `->>` returns TEXT (for comparisons)
   - Use `->>` for WHERE clauses

---

## 📚 Related Documentation

- [Domain Modeling](./DOMAIN_MODELING.md) - Business entities (the abstract concept)
- [Schema Reference](./SCHEMA_REFERENCE.md) - Database schema (implementation detail)
- [Evolutionary Design](../best-practices/EVOLUTIONARY_DESIGN.md) - How to evolve schemas without breaking apps
- [Indexes and Performance](./INDEXES_AND_PERFORMANCE.md) - Performance optimization

---

## 🎯 Quick Reference

### Decision Checklist

**Use JSONB if:**
- [ ] Structure varies between records
- [ ] Rapid development/iteration needed
- [ ] User-defined data
- [ ] Extension data
- [ ] Variable-length arrays
- [ ] Integration data

**Use Columns if:**
- [ ] Structure is stable
- [ ] Frequent queries on specific fields
- [ ] Database-level validation needed
- [ ] Performance is critical
- [ ] Data integrity is critical
- [ ] Reporting/analytics requirements

### Common Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| `metadata JSONB` | Extension data | Channel-specific metadata |
| `settings JSONB` | Configuration | Tenant/user settings |
| `line_items JSONB` | Variable arrays | Payment/invoice line items |
| `tags JSONB/TEXT[]` | Categorization | Case tags |
| `match_criteria JSONB` | Flexible logic | SOA matching results |
| `delivery_attempts JSONB` | Event arrays | Notification delivery attempts |

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22

