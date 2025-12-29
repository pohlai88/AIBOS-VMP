# Database & Schema Architecture PRD

**Document ID:** PRD-DB-SCHEMA-001  
**Version:** 1.2.0  
**Status:** ✅ Production-Ready (Enforceable)  
**Date:** 2025-01-22  
**Owner:** Architecture Team  
**Last Updated:** 2025-01-22

---

## 📋 Executive Summary

This Product Requirements Document (PRD) defines the **official database and schema architecture** for NexusCanon VMP. It establishes the core principle: **"Flexible Database, Super Flexible Schema"** - where the database is flexible (schema does not define the database), and the schema itself is super flexible (evolutionary, JSONB-first approach).

**This PRD is the single source of truth for all database and schema design decisions.**

---

## 🎯 One-Liner

**NexusCanon VMP Database Architecture** is a flexible, evolutionary database system where the schema serves as guardrails (optimization and safety) rather than a rigid definition, enabling rapid iteration through JSONB-first patterns while maintaining data integrity and performance.

---

## 🧬 Core Philosophy

### The Fundamental Principle: "Schema as Guardrails, Not Straitjackets"

> **"The database is flexible. The schema is super flexible. Schema does not define the database - it optimizes it."**

### Key Tenets

1. **Flexible Database**
   - The database structure adapts to business needs
   - **DB migrations are not required for JSONB fields, but adapter + validator + UI contract updates are still required**
   - Multiple storage strategies coexist (SQL columns + JSONB)

2. **Super Flexible Schema**
   - Start flexible (JSONB), promote to strict (columns) when patterns stabilize
   - Schema is an optimization layer, not a design constraint
   - Evolution is expected and supported

3. **Schema Does Not Define Database**
   - Domain model defines business logic (strictly)
   - Storage strategy defines how data is stored (flexibly)
   - Database schema optimizes for performance and constraints (strategically)
   - **Business rules live in domain/app; schema encodes safety constraints and tenant isolation**

### The Three-Layer Architecture

```
┌─────────────────────────────────────────┐
│  Domain Model (Business Logic)          │  ← Strict: Business rules, entities, relationships
│  "What the business needs"              │
└──────────────┬──────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  Storage Strategy (Data Storage)       │  ← Flexible: SQL vs. JSONB decision
│  "How to store the data"               │
└──────────────┬──────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  Database Schema (Optimization)        │  ← Strategic: Indexes, constraints, performance
│  "How to optimize access"              │
└─────────────────────────────────────────┘
```

---

## 📐 Requirements

### R1: Flexible Database Structure

**Requirement:** The database must support multiple storage patterns simultaneously without requiring application rewrites.

**Acceptance Criteria:**
- ✅ Support for typed columns (strict structure)
- ✅ ✅ Support for JSONB columns (flexible structure)
- ✅ ✅ Both patterns can coexist in the same table
- ✅ ✅ Migration from JSONB to columns is supported without breaking changes
- ✅ ✅ DB migrations are not required for adding JSONB fields, but validation + adapter compatibility must be maintained

**Implementation:**
- Use PostgreSQL (Supabase) hybrid capabilities
- Implement JSONB columns for flexible data
- Implement typed columns for stable, frequently-queried data
- Support promotion strategy (JSONB → columns)

---

### R2: Super Flexible Schema

**Requirement:** The schema must evolve without breaking existing functionality.

**Acceptance Criteria:**
- ✅ ✅ New fields can be added to JSONB without migrations
- ✅ ✅ Schema versioning is supported in JSONB metadata
- ✅ ✅ Multiple schema versions can coexist
- ✅ ✅ Promotion from JSONB to columns is supported
- ✅ ✅ Schema changes are backward compatible

**Implementation:**
- Use JSONB for evolving data structures
- Include `_schema_version` in JSONB payloads
- Support gradual migration patterns
- Document schema evolution in metadata

---

### R3: Schema Does Not Define Database

**Requirement:** The database structure is not constrained by the schema definition.

**Acceptance Criteria:**
- ✅ ✅ Domain model is the source of truth (not schema)
- ✅ ✅ Storage strategy is independent of schema
- ✅ ✅ Schema optimizes for performance, not design
- ✅ ✅ **Business rules live in domain/app; schema encodes safety constraints (CHECK constraints, enums) and tenant isolation (RLS)**
- ✅ ✅ Schema changes do not require domain model changes

**Implementation:**
- Document domain model separately (see `DOMAIN_MODELING.md`)
- Use schema for optimization (indexes, constraints)
- Use JSONB for business logic flexibility
- Keep business rules in application code, not database constraints

---

### R4: Evolutionary Design Support

**Requirement:** The system must support schema evolution without downtime or data loss.

**Acceptance Criteria:**
- ✅ ✅ Zero-downtime migrations are supported
- ✅ ✅ Data migration scripts are provided
- ✅ ✅ Rollback strategies are documented
- ✅ ✅ Multiple schema versions are supported during transition
- ✅ ✅ Promotion patterns are standardized

**Implementation:**
- Use migration scripts for schema changes
- Support dual-write patterns during transitions
- Document rollback procedures
- Test migrations in staging environment

---

### R5: Metadata Governance (Tight Guardrails)

**Requirement:** JSONB data must have governance to prevent "data swamp." Metadata is the control plane for business logic.

**Acceptance Criteria:**
- ✅ ✅ Version tags are required in JSONB (`_schema_version`)
- ✅ ✅ Context headers are included (`_context` with audit info)
- ✅ ✅ Type discriminators are used for polymorphism (`type` field)
- ✅ ✅ Application-level validation (Zod schemas) - **Single Source of Truth**
- ✅ ✅ Database-level constraints (CHECK constraints for structure)
- ✅ ✅ JSONB Contract Registry exists (type → validator → version range)
- ✅ ✅ All JSONB fields are registered in contract registry
- ✅ ✅ Metadata controls business logic (permissions, quotas, feature flags, UI prefs)

**Implementation:**
- Enforce metadata guardrails in application code
- Use Zod schemas as Single Source of Truth for validation
- Use PostgreSQL CHECK constraints for structure enforcement
- Maintain JSONB Contract Registry (see [JSONB Contract Registry](#jsonb-contract-registry))
- Document expected JSONB structures
- **Metadata is the control plane** - business rules are configured via metadata, not hardcoded

**Metadata Hierarchy:**
| Layer | Type | Storage | Governance | Modified By |
|-------|------|---------|------------|-------------|
| **Core Data** | Identity, Foreign Keys, Audit Logs | SQL Columns | **Absolute** | Migration only |
| **Metadata** | Permissions, Configs, Quotas, UI Prefs | JSONB | **Strong** (Schema-validated) | API/Admin UI |
| **Content** | User inputs, Descriptions | SQL Columns/JSONB | **Loose** | User input |

**Metadata Lifecycle:**
```
Developer → Defines Schema (Zod) + Implements Logic (Middleware)
    ↓
Database → Stores Configuration (JSONB)
    ↓
Business → Updates Configuration (Admin UI)
    ↓
User → Experiences Result Immediately
```

**Result:** High Flexibility (Business Speed) balanced by High Governance (Engineering Stability).

---

### R6: Core Columns Immutability

**Requirement:** Core columns are sacred and cannot be removed or renamed without deprecation.

**Acceptance Criteria:**
- ✅ ✅ Core columns cannot be removed/renamed, only deprecated
- ✅ ✅ Standard deprecation pattern exists (`deprecated_at`, `deprecated_reason`)
- ✅ ✅ Shadow columns pattern for renames is documented
- ✅ ✅ Deprecation timeline is defined (minimum grace period)
- ✅ ✅ Breaking changes to core columns require major version bump

**Implementation:**
- Use deprecation pattern for column removal
- Support shadow columns for renames during transition
- Document deprecation timeline (minimum 6 months)
- Maintain backward compatibility during deprecation period

---

### R7: Multi-Tenant & RLS First-Class

**Requirement:** Multi-tenant isolation and RLS are mandatory, not optional.

**Acceptance Criteria:**
- ✅ ✅ **Default rule: Every tenant-scoped table has a `tenant_id` column (mandatory)**
- ✅ ✅ **"Derived tenant" is only allowed for join tables with strict FK chain + documented RLS pattern**
- ✅ ✅ RLS policies are treated as part of "schema guardrails"
- ✅ ✅ RLS coverage is 100% for all tenant-scoped tables
- ✅ ✅ RLS policies are tested and validated
- ✅ ✅ Tenant isolation is enforced at database level, not application level
- ✅ ✅ **RLS coverage list exists (table → policy → tested status)**

**Implementation:**
- **Default pattern: All tenant-scoped tables must have `tenant_id` column**
- **Exception: Join tables may derive tenant via FK chain (must be documented with RLS pattern)**
- RLS policies are mandatory for all tenant-scoped tables
- RLS policies are part of schema definition (not optional appendix)
- Test RLS policies in integration tests
- Document RLS patterns per table
- **Maintain RLS coverage list (see [RLS Coverage List](#rls-coverage-list))**

---

## 🛡️ RLS Coverage List

**Requirement:** All tenant-scoped tables must have RLS policies. This list is maintained and validated in CI/CD.

**Coverage List Format:**

| Table | Tenant Scoped | Has `tenant_id` | RLS Enabled | SELECT Policy | INSERT Policy | UPDATE Policy | DELETE Policy | Tested | Status |
|-------|---------------|-----------------|-------------|---------------|---------------|---------------|---------------|--------|--------|
| `nexus_tenants` | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Compliant |
| `nexus_users` | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Compliant |
| `nexus_cases` | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ Non-Compliant |
| `nexus_payments` | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Partial | ⚠️ Needs Tests |

**Maintenance:**
- ✅ ✅ Coverage list is updated when tables are added/modified
- ✅ ✅ Coverage list is validated in CI/CD
- ✅ ✅ Missing policies block deployment
- ✅ ✅ Untested policies are flagged (warnings)

**Implementation:**
- Maintain coverage list in version-controlled file: `docs/architecture/RLS_COVERAGE_LIST.md`
- Or maintain in database table: `rls_coverage_registry`
- CI/CD validates coverage list matches actual database state

---

## 🏗️ Architecture Design

### Storage Strategy Decision Framework

**Decision Tree:**
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

### Data Layer Hierarchy

| Layer | Type | Storage | Governance | Modified By |
|-------|------|---------|------------|-------------|
| **Core Data** | Identity, Foreign Keys, Audit Logs | SQL Columns | **Absolute** | Migration only |
| **Metadata** | Permissions, Configs, Quotas, UI Prefs | JSONB | **Strong** (Schema-validated) | API/Admin UI |
| **Content** | User inputs, Descriptions | SQL Columns/JSONB | **Loose** | User input |

### JSONB Patterns

**Standard JSONB Columns:**
- `metadata JSONB DEFAULT '{}'` - Extension data
- `settings JSONB DEFAULT '{}'` - Configuration
- `preferences JSONB DEFAULT '{}'` - User preferences
- `line_items JSONB DEFAULT '[]'` - Variable arrays
- `tags JSONB DEFAULT '[]'` - Categorization
- `match_criteria JSONB` - Flexible logic

**Metadata Guardrails:**
```json
{
  "_schema_version": 2,
  "_context": {
    "created_by": "user_123",
    "created_at": "2025-01-22T10:00:00Z",
    "updated_by": "user_456",
    "updated_at": "2025-01-22T11:00:00Z",
    "reason": "SLA escalation",
    "source": "automated_system"
  },
  "type": "case_metadata",
  "priority": "urgent",
  "tags": ["compliance", "payment"]
}
```

---

## 🔄 Promotion Strategy

### When to Promote JSONB → Columns

**Promote when:**
1. Access pattern stabilizes (frequently queried)
2. Structure is consistent across records
3. Performance requires B-tree index
4. Database-level validation needed
5. Reporting/analytics requirements

### Standard Operating Procedure: Dual-Write / Backfill

**Promotion must follow Phase A/B/C pattern:**

#### Phase A: Backfill + Read-Old
```sql
-- Step 1: Add new column (nullable)
ALTER TABLE nexus_cases
  ADD COLUMN priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- Step 2: Backfill data from JSONB
UPDATE nexus_cases
SET priority = metadata->>'priority'
WHERE metadata->>'priority' IS NOT NULL;

-- Step 3: Create index
CREATE INDEX idx_nexus_cases_priority ON nexus_cases(priority);

-- Application: Still reads from JSONB, writes to both (dual-write)
```

#### Phase B: Dual-Write + Read-New
```sql
-- Step 4: Make column NOT NULL (if needed) - after all data migrated
ALTER TABLE nexus_cases
  ALTER COLUMN priority SET NOT NULL;

-- Application: Reads from column, writes to both (dual-write)
-- Monitor: Verify column data matches JSONB data
```

**Hard Gate 1: Consistency Check (Phase B → C)**
- ✅ ✅ **CI must verify column value == JSONB value for promoted keys**
- ✅ ✅ **Verification: sampled (for large tables) or full (for small tables)**
- ✅ ✅ **Consistency check must pass before Phase C cutover**
- ✅ ✅ **Inconsistencies must be resolved before proceeding**

```sql
-- Consistency check query (run in CI)
SELECT 
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE priority IS NOT NULL) as column_populated,
  COUNT(*) FILTER (WHERE metadata->>'priority' IS NOT NULL) as jsonb_populated,
  COUNT(*) FILTER (WHERE priority != (metadata->>'priority')) as mismatches
FROM nexus_cases
WHERE priority IS NOT NULL OR metadata->>'priority' IS NOT NULL;

-- Expected: mismatches = 0 before Phase C
```

#### Phase C: Read-New + Cleanup
```sql
-- Step 5: Application: Reads from column only, writes to column only

-- Step 6: Remove from JSONB (after verification period - minimum 30 days)
UPDATE nexus_cases
SET metadata = metadata - 'priority'
WHERE metadata ? 'priority';

-- Step 7: Update JSONB Contract Registry to remove field
```

**Hard Gate 2: Rollback Script (All Phases)**
- ✅ ✅ **Every promotion migration must ship with rollback script**
- ✅ ✅ **Rollback script must be tested in staging environment**
- ✅ ✅ **Rollback script must be reviewed in PR**
- ✅ ✅ **"Documented later" is not acceptable - rollback must exist before merge**

**Example Rollback Script:**
```sql
-- Rollback: Remove promoted column, restore to JSONB
-- Phase C → Phase B → Phase A

-- Step 1: Restore JSONB data from column (if column exists)
UPDATE nexus_cases
SET metadata = jsonb_set(metadata, '{priority}', to_jsonb(priority))
WHERE priority IS NOT NULL AND metadata->>'priority' IS NULL;

-- Step 2: Update application to read from JSONB again

-- Step 3: Drop column (after application updated)
ALTER TABLE nexus_cases DROP COLUMN priority;

-- Step 4: Drop index
DROP INDEX IF EXISTS idx_nexus_cases_priority;
```

**Requirements:**
- ✅ Minimum 30-day verification period between phases
- ✅ Dual-write period must be monitored for data consistency
- ✅ **Consistency check gate must pass (Phase B → C)**
- ✅ **Rollback script must exist before merge (all phases)**
- ✅ All phases must be tested in staging environment

---

## 📊 Implementation Standards

### Core Data (SQL Columns)

**Use SQL columns for:**
- Primary keys and foreign keys
- Frequently queried fields
- Required fields with constraints
- Audit fields (created_at, updated_at)
- Status enums with CHECK constraints
- Relationships and references

**Example:**
```sql
CREATE TABLE nexus_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT UNIQUE NOT NULL,
  tenant_id TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'  -- Flexible extension data
);
```

### Metadata (JSONB)

**Use JSONB for:**
- Extension data (metadata)
- Configuration (settings, preferences)
- Variable arrays (line_items, tags)
- Flexible logic (match_criteria)
- User-defined data
- Rapidly evolving structures

**Example:**
```sql
-- Case metadata with guardrails
UPDATE nexus_cases
SET metadata = jsonb_set(
  metadata,
  '{_schema_version}',
  '2'::jsonb
)
WHERE metadata->>'_schema_version' IS NULL;
```

### Indexes

**B-tree indexes for:**
- Primary keys
- Foreign keys
- Frequently queried columns
- Status fields
- Date ranges

**GIN Index Policy: Prevent "GIN Everything"**

**Rule:** Only GIN-index JSONB keys that are queried frequently. Prefer expression indexes on stable JSONB keys before full-column GIN.

**Decision Tree:**
```
Is JSONB key:
├─ Queried frequently (> 10% of queries)?
│  ├─ YES → Is structure stable?
│  │  ├─ YES → Use expression index OR promote to column
│  │  └─ NO → Use GIN index on specific key path
│  └─ NO → No index needed
│
└─ Used for full-text search?
   └─ YES → Use GIN index
```

**Indexing Patterns:**

**Pattern 1: Expression Index (Preferred for Stable Keys)**
```sql
-- Expression index on specific JSONB key (more efficient than full GIN)
CREATE INDEX idx_nexus_cases_metadata_priority 
ON nexus_cases((metadata->>'priority'))
WHERE metadata->>'priority' IS NOT NULL;
```

**Pattern 2: GIN Index on Specific Path (For Frequently Queried Nested Keys)**
```sql
-- GIN index on specific nested path
CREATE INDEX idx_nexus_tenants_metadata_feature_flags_gin
ON nexus_tenants USING GIN ((metadata->'feature_flags'));
```

**Pattern 3: Full-Column GIN (Only When Needed)**
```sql
-- Full-column GIN only when:
-- 1. Multiple keys are queried frequently
-- 2. Full-text search is required
-- 3. Array containment queries are common
CREATE INDEX idx_nexus_cases_metadata_gin 
ON nexus_cases USING GIN (metadata);
```

**Requirement: Full-Column GIN Justification**
- ✅ ✅ **Full-column GIN requires justification in PR/ADR**
- ✅ ✅ **Justification must include: query examples + measured benefit**
- ✅ ✅ **Without justification, PR cannot be merged**

**Anti-Pattern:**
```sql
-- ❌ BAD: GIN index on every JSONB column
CREATE INDEX idx_everything_gin ON every_table USING GIN (metadata);
-- Why: Causes write amplification and index bloat
```

**Example:**
```sql
-- B-tree index for column
CREATE INDEX idx_nexus_cases_status ON nexus_cases(status);

-- Expression index for stable JSONB key (preferred)
CREATE INDEX idx_nexus_cases_metadata_priority 
ON nexus_cases((metadata->>'priority'))
WHERE metadata->>'priority' IS NOT NULL;

-- GIN index only when necessary (multiple keys, full-text search)
CREATE INDEX idx_nexus_cases_metadata_gin 
ON nexus_cases USING GIN (metadata)
WHERE metadata IS NOT NULL AND metadata != '{}'::jsonb;
```

---

## 🔒 Governance & Validation

### Metadata Tight Guardrails (Three-Level Governance)

**Philosophy:** Metadata is the control plane. We hardcode **capabilities**, and we use Metadata to **configure** them.

#### Level 1: Database Constraints (Hard Stop)

**Purpose:** Prevent invalid data from entering the database, even if application validation fails.

```sql
-- Enforce that specific keys must exist in the JSONB column
ALTER TABLE nexus_tenants
ADD CONSTRAINT enforce_metadata_structure
CHECK (
  jsonb_typeof(metadata->'plan_config') = 'object' OR metadata->'plan_config' IS NULL
  AND jsonb_typeof(metadata->'feature_flags') = 'object' OR metadata->'feature_flags' IS NULL
);

-- Example: Enforce structure for nexus_users preferences
ALTER TABLE nexus_users
ADD CONSTRAINT enforce_user_preferences_structure
CHECK (
  jsonb_typeof(preferences->'ui') = 'object' OR preferences->'ui' IS NULL
  AND jsonb_typeof(preferences->'notifications') = 'object' OR preferences->'notifications' IS NULL
);
```

#### Level 2: Application Schema (Validator) - Single Source of Truth

**Purpose:** Zod schemas are the Single Source of Truth for what valid metadata looks like. The DB stores JSON, but the App only sees Typed Objects.

```javascript
// src/schemas/metadata.schema.js
import { z } from 'zod';

// 1. Define the Governance Schema for Tenants
export const TenantMetadataSchema = z.object({
  _schema_version: z.number().default(1),
  _context: z.object({
    created_by: z.string().optional(),
    created_at: z.string().optional(),
    updated_by: z.string().optional(),
    updated_at: z.string().optional(),
    reason: z.string().optional(),
    source: z.string().optional()
  }).optional(),
  plan_config: z.object({
    max_users: z.number().min(1).default(10),
    retention_days: z.number().min(1).default(30),
    can_export: z.boolean().default(false),
    max_storage_gb: z.number().min(1).default(5)
  }).default({}),
  feature_flags: z.record(z.string(), z.boolean()).default({}),
  ui_preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    primary_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional()
  }).optional()
});

// 2. Define the Governance Schema for Users
export const UserPreferencesSchema = z.object({
  _schema_version: z.number().default(1),
  ui: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    sidebar_collapsed: z.boolean().default(false),
    dashboard_layout: z.enum(['grid', 'list']).default('grid')
  }).optional(),
  notifications: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
    push: z.boolean().default(false)
  }).optional(),
  limits: z.object({
    reports_per_day: z.number().min(0).default(10)
  }).optional()
});
```

#### Level 3: Adapter Layer (Gatekeeper)

**Purpose:** Data never enters the app without passing through the Adapter. Ensures all metadata is validated and typed before use.

```javascript
// src/adapters/nexus-adapter.js
import { TenantMetadataSchema, UserPreferencesSchema } from '@/schemas/metadata.schema';

// Adapter validates before storing/returning
export function adaptTenant(row) {
  // If DB has old/bad data, Zod fixes it with defaults or throws error
  const safeMetadata = TenantMetadataSchema.parse(row.metadata || {});
  
  return {
    tenantId: row.tenant_id,
    name: row.name,
    metadata: safeMetadata // The app ONLY uses this safe object
  };
}

export function adaptNexusUser(row) {
  const safePreferences = UserPreferencesSchema.parse(row.preferences || {});
  
  return {
    userId: row.user_id,
    tenantId: row.tenant_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    preferences: safePreferences // Typed, validated preferences
  };
}
```

### JSONB Contract Registry (Enforceable Artifact)

**Requirement:** All JSONB fields must be registered in a contract registry that maps `jsonb.type` → schema validator version. **The registry is a real, enforceable artifact, not just a code concept.**

**Registry Implementation Options:**

#### Option 1: Database Table (Preferred for Auditability)

```sql
-- JSONB Contract Registry Table
CREATE TABLE jsonb_contract_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL UNIQUE,  -- e.g., 'tenant_metadata', 'case_metadata'
  table_name TEXT NOT NULL,   -- e.g., 'nexus_tenants', 'nexus_cases'
  column_name TEXT NOT NULL,  -- e.g., 'metadata', 'preferences'
  min_version INTEGER NOT NULL DEFAULT 1,
  max_version INTEGER NOT NULL,
  validator_ref TEXT NOT NULL,  -- Path to Zod schema, e.g., 'src/schemas/metadata.schema.js:TenantMetadataSchema'
  owner TEXT NOT NULL,  -- Team/developer responsible
  deprecation_policy TEXT,  -- e.g., '6 months grace period'
  migration_notes JSONB DEFAULT '{}',  -- Version migration notes
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for lookups
CREATE INDEX idx_jsonb_contract_registry_type ON jsonb_contract_registry(type);
CREATE INDEX idx_jsonb_contract_registry_table_column ON jsonb_contract_registry(table_name, column_name);
```

#### Option 2: Versioned File (Alternative)

```javascript
// src/schemas/jsonb-contract-registry.js
// This file is version-controlled and CI-validated

/**
 * JSONB Contract Registry
 * Maps JSONB type → validator schema → version range
 * 
 * REQUIREMENT: All JSONB columns must be registered here.
 * CI validates that all JSONB columns in database have corresponding entries.
 */
export const JSONB_CONTRACT_REGISTRY = {
  // Tenant metadata contracts
  'tenant_metadata': {
    table: 'nexus_tenants',
    column: 'metadata',
    validator: TenantMetadataSchema,
    validatorRef: 'src/schemas/metadata.schema.js:TenantMetadataSchema',
    minVersion: 1,
    maxVersion: 2,
    owner: 'architecture-team',
    deprecationPolicy: '6 months grace period',
    migrationNotes: {
      '1→2': 'plan_config.max_users renamed to plan_config.limits.users'
    }
  },
  
  // User preferences contracts
  'user_preferences': {
    table: 'nexus_users',
    column: 'preferences',
    validator: UserPreferencesSchema,
    validatorRef: 'src/schemas/metadata.schema.js:UserPreferencesSchema',
    minVersion: 1,
    maxVersion: 1,
    owner: 'architecture-team',
    deprecationPolicy: '6 months grace period',
    migrationNotes: {}
  },
  
  // Case metadata contracts
  'case_metadata': {
    table: 'nexus_cases',
    column: 'metadata',
    validator: CaseMetadataSchema,
    validatorRef: 'src/schemas/metadata.schema.js:CaseMetadataSchema',
    minVersion: 1,
    maxVersion: 2,
    owner: 'architecture-team',
    deprecationPolicy: '6 months grace period',
    migrationNotes: {
      '1→2': 'Added priority field, added escalation_level'
    }
  }
};

/**
 * Get validator for JSONB type
 */
export function getValidatorForType(type, version = null) {
  const contract = JSONB_CONTRACT_REGISTRY[type];
  if (!contract) {
    throw new Error(`No contract registered for type: ${type}`);
  }
  
  if (version !== null) {
    if (version < contract.minVersion || version > contract.maxVersion) {
      throw new Error(
        `Version ${version} not supported for type ${type}. ` +
        `Supported range: ${contract.minVersion}-${contract.maxVersion}`
      );
    }
  }
  
  return contract.validator;
}
```

**Registry Minimum Fields (Required):**
- `type` - JSONB type identifier
- `table_name` - Database table name
- `column_name` - JSONB column name
- `min_version` - Minimum supported schema version
- `max_version` - Maximum supported schema version
- `validator_ref` - Reference to Zod schema (file path + export name)
- `owner` - Team/developer responsible
- `deprecation_policy` - Deprecation timeline policy
- `migration_notes` - Version migration documentation

**Enforcement:**
- ✅ ✅ Registry is validated in CI/CD (coverage check)
- ✅ ✅ All JSONB columns must have registry entry
- ✅ ✅ Registry updates require PR review
- ✅ ✅ Missing registry entries block deployment

**Usage in Adapter:**
```javascript
import { getValidatorForType } from '@/schemas/jsonb-contract-registry';

export function adaptCase(row) {
  const metadata = row.metadata || {};
  const type = metadata.type || 'case_metadata';
  const version = metadata._schema_version || 1;
  
  // Get validator from registry
  const validator = getValidatorForType(type, version);
  
  // Validate and parse
  const safeMetadata = validator.parse(metadata);
  
  return {
    caseId: row.case_id,
    metadata: safeMetadata
  };
}
```

**Registry Maintenance:**
- ✅ All JSONB fields must be registered
- ✅ Version ranges must be maintained
- ✅ Migration notes must be documented
- ✅ Registry is validated in CI/CD

---

## 📈 Success Criteria

### Functional Requirements

- ✅ Database supports both SQL columns and JSONB simultaneously
- ✅ Schema can evolve without breaking existing functionality
- ✅ JSONB data has governance (version, context, type)
- ✅ Promotion from JSONB to columns is supported
- ✅ Multiple schema versions can coexist

### Performance Requirements

- ✅ JSONB queries use GIN indexes for performance
- ✅ Frequently queried fields are promoted to columns
- ✅ Indexes are created for all foreign keys
- ✅ Query performance meets SLA requirements

### Maintainability Requirements

- ✅ Domain model is documented separately from schema
- ✅ Storage strategy decisions are documented
- ✅ Schema evolution is documented
- ✅ Migration scripts are tested and validated

---

## 📚 Related Documentation

### Core Architecture Documents

- [Domain Modeling](../integrations/supabase/database/DOMAIN_MODELING.md) - Business entities (the abstract concept)
- [Flexible Data Patterns](../integrations/supabase/database/FLEXIBLE_DATA_PATTERNS.md) - JSONB vs. columns decision framework
- [Schema Reference](../integrations/supabase/database/SCHEMA_REFERENCE.md) - Database schema (implementation detail)
- [Database Standards](./DATABASE_STANDARDS.md) - Supabase database design standards

### Implementation Guides

- [Metadata Control Protocol](./METADATA_CONTROL_PROTOCOL.md) - **REQUIRED READING** - Metadata-driven architecture governance (tight guardrails)
- [Evolutionary Design](../integrations/supabase/best-practices/EVOLUTIONARY_DESIGN.md) - How to evolve schemas without breaking apps
- [RLS Enforcement Architecture](./RLS_ENFORCEMENT_COMPLETE_ARCHITECTURE.md) - Row Level Security patterns (mandatory for multi-tenant)

### Testing & Validation

- [Testing Strategy](./TESTING_STRATEGY.md) - Complete testing architecture
- [Test Standards](../../tests/TEST_STANDARDS.md) - Testing conventions and patterns

---

## 🔐 Schema Governance Addendum

**Critical Rules (Copy/Paste Reference):**

1. **Core columns are immutable** - No drop/rename; deprecate only (minimum 6-month grace period)
2. **JSONB contracts must be registered** - Type → validator → version range in JSONB Contract Registry
3. **Promotion SOP must follow Phase A/B/C** - Backfill, dual-write, cutover (minimum 30-day verification)
4. **RLS is mandatory** - All tenant tables must have RLS policies (100% coverage)
5. **Indexing policy: no blanket GIN** - Use expression indexes or promote to columns for stable keys
6. **Metadata is the control plane** - Business rules are configured via metadata, not hardcoded
7. **Drift checks are mandatory** - Schema diff, RLS coverage, JSONB contract registry coverage (automated CI/CD)

---

## 🎯 Definition of Done (DoD)

### For Database Changes

- [ ] Migration script is created and tested
- [ ] Rollback script is provided
- [ ] Domain model is updated (if business logic changes)
- [ ] Storage strategy is documented (SQL vs. JSONB decision)
- [ ] Indexes are created for new query patterns (following indexing policy)
- [ ] RLS policies are updated (if needed) - **Mandatory for tenant tables**
- [ ] **RLS coverage list is updated** (see [RLS Coverage List](#rls-coverage-list))
- [ ] Tests are written and passing
- [ ] Documentation is updated
- [ ] **Drift checks pass** (schema diff, RLS coverage, JSONB contract registry coverage)

### For Schema Evolution

- [ ] JSONB structure is documented
- [ ] Version tag is included (`_schema_version`)
- [ ] Context header is included (`_context`)
- [ ] Zod schema is created for validation
- [ ] **JSONB Contract Registry is updated** (type → validator → version range)
- [ ] Database CHECK constraint is added (if needed)
- [ ] Adapter layer is updated
- [ ] Tests are written and passing
- [ ] Documentation is updated
- [ ] **Drift checks pass** (JSONB contract registry coverage)

### For Core Column Changes

- [ ] Deprecation pattern is followed (if removing/renaming)
- [ ] Shadow columns are created (if renaming)
- [ ] Deprecation timeline is documented (minimum 6 months)
- [ ] Backward compatibility is maintained
- [ ] Migration script includes deprecation markers
- [ ] Tests verify backward compatibility
- [ ] Documentation is updated

### Drift Checks (Automated CI/CD) - Real and Complete

**Requirement:** Drift checks must produce machine-readable reports. These three outputs are mandatory and must exist for the PRD to be enforceable.

**Required Checks with Minimum Outputs:**

#### 1. Schema Diff Check
**Output:** Machine-readable schema diff report

**Format:** JSON or structured text
```json
{
  "timestamp": "2025-01-22T10:00:00Z",
  "baseline": "migrations/",
  "current": "live_database",
  "differences": [
    {
      "table": "nexus_cases",
      "type": "column_added",
      "column": "priority",
      "status": "expected"
    },
    {
      "table": "nexus_users",
      "type": "column_missing",
      "column": "deprecated_field",
      "status": "unexpected",
      "action": "investigate"
    }
  ],
  "summary": {
    "total_differences": 2,
    "expected": 1,
    "unexpected": 1
  }
}
```

#### 2. RLS Coverage Check
**Output:** RLS coverage report (table list + missing policies)

**Format:** JSON or structured text
```json
{
  "timestamp": "2025-01-22T10:00:00Z",
  "tables": [
    {
      "table": "nexus_tenants",
      "tenant_scoped": true,
      "has_tenant_id": true,
      "rls_enabled": true,
      "policies": [
        {
          "name": "Users can view own tenant",
          "operation": "SELECT",
          "tested": true,
          "status": "compliant"
        },
        {
          "name": "Users can update own tenant",
          "operation": "UPDATE",
          "tested": false,
          "status": "missing_test"
        }
      ],
      "coverage": {
        "select": true,
        "insert": true,
        "update": true,
        "delete": true
      },
      "status": "compliant"
    },
    {
      "table": "nexus_cases",
      "tenant_scoped": true,
      "has_tenant_id": true,
      "rls_enabled": false,
      "status": "non_compliant",
      "action": "enable_rls"
    }
  ],
  "summary": {
    "total_tables": 2,
    "tenant_scoped": 2,
    "rls_enabled": 1,
    "coverage_percentage": 50.0,
    "compliant": 1,
    "non_compliant": 1
  }
}
```

#### 3. JSONB Contract Registry Coverage Check
**Output:** Contract registry coverage report (JSONB columns/keys used vs registered)

**Format:** JSON or structured text
```json
{
  "timestamp": "2025-01-22T10:00:00Z",
  "jsonb_columns": [
    {
      "table": "nexus_tenants",
      "column": "metadata",
      "registered": true,
      "contract_type": "tenant_metadata",
      "min_version": 1,
      "max_version": 2,
      "validator_ref": "src/schemas/metadata.schema.js:TenantMetadataSchema",
      "status": "compliant"
    },
    {
      "table": "nexus_cases",
      "column": "metadata",
      "registered": false,
      "status": "non_compliant",
      "action": "register_in_contract_registry"
    }
  ],
  "summary": {
    "total_jsonb_columns": 2,
    "registered": 1,
    "unregistered": 1,
    "coverage_percentage": 50.0,
    "compliant": 1,
    "non_compliant": 1
  }
}
```

**Additional Checks:**
- [ ] **Index Coverage Check:** Verify all foreign keys have indexes
- [ ] **Core Column Immutability Check:** Verify no core columns were removed/renamed without deprecation

**Implementation:**
```bash
# Run drift checks before commit
npm run check:drift

# Outputs:
# - reports/schema-diff.json
# - reports/rls-coverage.json
# - reports/jsonb-contract-coverage.json
# - reports/index-coverage.json
# - reports/core-column-immutability.json

# CI/CD gates on:
# - schema-diff.json (unexpected differences block merge)
# - rls-coverage.json (coverage < 100% blocks merge)
# - jsonb-contract-coverage.json (coverage < 100% blocks merge)
```

**Enforcement:**
- ✅ ✅ All three reports must be generated
- ✅ ✅ Reports must be machine-readable (JSON format)
- ✅ ✅ CI/CD gates on report outputs
- ✅ ✅ Non-compliant reports block deployment

---

## 📊 Key Performance Indicators (KPIs)

### Database Flexibility

- **Schema Evolution Speed:** Time to add new field (target: < 1 day for JSONB, < 1 week for columns)
- **Migration Success Rate:** Percentage of migrations without rollback (target: > 95%)
- **Zero-Downtime Migrations:** Percentage of migrations without downtime (target: > 90%)

### Schema Governance

- **JSONB Governance Compliance:** Percentage of JSONB fields with version tags (target: 100%)
- **Validation Coverage:** Percentage of JSONB fields with Zod schemas (target: 100%)
- **Constraint Coverage:** Percentage of JSONB fields with CHECK constraints (target: > 80%)

### Performance

- **Query Performance:** Average query time (target: < 100ms for indexed queries)
- **Index Coverage:** Percentage of foreign keys with indexes (target: 100%)
- **JSONB Index Coverage:** Percentage of JSONB fields with GIN indexes (target: > 80%)

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

- [ ] Document current database structure
- [ ] Identify JSONB usage patterns
- [ ] Create domain model documentation
- [ ] Establish governance framework

### Phase 2: Governance (Week 3-4)

- [ ] Implement metadata guardrails
- [ ] Create Zod schemas for validation
- [ ] Add database CHECK constraints
- [ ] Update adapter layer

### Phase 3: Optimization (Week 5-6)

- [ ] Identify promotion candidates
- [ ] Create promotion scripts
- [ ] Add indexes for performance
- [ ] Optimize query patterns

### Phase 4: Documentation (Week 7-8)

- [ ] Complete schema reference
- [ ] Document evolution patterns
- [ ] Create migration guides
- [ ] Update all related documentation

---

## ✅ Compliance Checklist

### Architecture Compliance

- [ ] Database supports flexible storage (SQL + JSONB)
- [ ] Schema is evolutionary (JSONB-first approach)
- [ ] Domain model is separate from schema
- [ ] Storage strategy is documented
- [ ] Promotion strategy is defined

### Governance Compliance

- [ ] JSONB fields have version tags
- [ ] JSONB fields have context headers
- [ ] Zod schemas exist for all JSONB fields
- [ ] Database CHECK constraints exist for JSONB structure
- [ ] Adapter layer validates all JSONB data

### Performance Compliance

- [ ] All foreign keys have indexes
- [ ] JSONB indexing policy is followed (expression indexes preferred, GIN only when needed)
- [ ] Query performance meets SLA
- [ ] Index coverage is > 80%
- [ ] No blanket GIN indexes (only on frequently queried keys)

### Multi-Tenant & RLS Compliance

- [ ] All tables have tenant scoping (`tenant_id` or derived)
- [ ] RLS policies exist for all tenant-scoped tables (100% coverage)
- [ ] RLS policies are tested in integration tests
- [ ] Tenant isolation is enforced at database level

### Metadata Governance Compliance

- [ ] All JSONB fields have version tags (`_schema_version`)
- [ ] All JSONB fields have context headers (`_context`)
- [ ] All JSONB fields are registered in JSONB Contract Registry
- [ ] Zod schemas exist for all JSONB fields (100% coverage)
- [ ] Database CHECK constraints exist for JSONB structure (> 80% coverage)
- [ ] Adapter layer validates all JSONB data

### Core Column Immutability Compliance

- [ ] No core columns removed without deprecation
- [ ] No core columns renamed without shadow columns
- [ ] Deprecation timeline is documented (minimum 6 months)
- [ ] Backward compatibility is maintained

---

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-22 | Initial PRD with core philosophy and requirements |
| 1.1.0 | 2025-01-22 | Enhanced with missing guardrails: Core column immutability, JSONB Contract Registry, Multi-tenant/RLS first-class, JSONB indexing policy, Dual-write/backfill SOP, Drift checks, Metadata Tight Guardrails integration |
| 1.2.0 | 2025-01-22 | Made PRD enforceable: Tightened risky sentences, Contract Registry as real artifact (DB table/versioned file), Hard gates for promotion (consistency check + rollback), Single tenant scoping pattern mandate, GIN index justification requirement, Real drift checks with machine-readable outputs, RLS coverage list |

---

---

## 🎯 Highest ROI Next Step

**Based on this PRD, the single highest ROI next step is:**

**Implement `check:drift` with 3 checks first:**
1. Schema diff check (machine-readable report)
2. RLS coverage check (table list + missing policies)
3. JSONB contract registry coverage check (JSONB columns/keys used vs registered)

**Why:** These three directly enforce the "Schema as guardrails" promise and prevent:
- Schema drift (unexpected changes)
- Tenant data leaks (missing RLS)
- JSONB data swamp (unregistered contracts)

**Implementation Priority:**
1. ✅ Create drift check script (`scripts/check-drift.mjs`)
2. ✅ Generate three required reports (schema-diff.json, rls-coverage.json, jsonb-contract-coverage.json)
3. ✅ Add CI/CD gates on report outputs
4. ✅ Block deployment on non-compliant reports

**Once these three checks exist, the PRD becomes enforceable, not philosophical.**

---

**Document Status:** ✅ Production-Ready (Enforceable)  
**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22  
**Maintained By:** Architecture Team

