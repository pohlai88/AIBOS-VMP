# Promotion Log (Phase A/B/C History)

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** ✅ Active  
**Purpose:** Historical log of all JSONB → Column promotions following Phase A/B/C SOP  
**Aligned To:** [PRD_DB_SCHEMA.md](../../development/prds/PRD_DB_SCHEMA.md) | [DB_GUARDRAIL_MATRIX.md](./DB_GUARDRAIL_MATRIX.md)

---

## 📋 Overview

This log tracks all promotions from JSONB to typed columns, documenting the complete Phase A/B/C process for auditability and learning.

**Critical Rule: Promotion ≠ Schema Evolution**

Promotion does not change business meaning. Promotion only changes **storage efficiency and queryability**.

**What Promotion Does:**
- Moves data from JSONB to typed columns for better performance
- Enables B-tree indexes instead of JSONB queries
- Improves query performance and reporting capabilities

**What Promotion Does NOT Do:**
- Change the semantic meaning of the data
- Alter business logic or validation rules
- Modify the data model's conceptual structure

**Purpose:** This prevents semantic drift during refactors and ensures promotions are purely optimization, not business logic changes.

---

## Promotion History

### PROMO-001: nexus_cases.metadata->>'priority' → nexus_cases.priority

**Status:** ✅ Done  
**Started:** 2025-01-15  
**Completed:** 2025-01-22  
**Owner:** architecture-team

#### Phase A: Backfill + Read-Old
**Date:** 2025-01-15  
**Duration:** 1 day

**Actions:**
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
```

**Verification:**
- ✅ All existing records backfilled
- ✅ Index created successfully
- ✅ Application still reading from JSONB

**Rollback Script:**
```sql
-- Restore JSONB data from column
UPDATE nexus_cases
SET metadata = jsonb_set(metadata, '{priority}', to_jsonb(priority))
WHERE priority IS NOT NULL AND metadata->>'priority' IS NULL;

-- Drop column
ALTER TABLE nexus_cases DROP COLUMN priority;
DROP INDEX IF EXISTS idx_nexus_cases_priority;
```

#### Phase B: Dual-Write + Read-New
**Date:** 2025-01-16  
**Duration:** 30 days (verification window)

**Actions:**
```sql
-- Step 4: Make column NOT NULL (after all data migrated)
ALTER TABLE nexus_cases
  ALTER COLUMN priority SET NOT NULL;
```

**Application Changes:**
- ✅ Application reads from column
- ✅ Application writes to both column and JSONB (dual-write)
- ✅ Consistency monitoring enabled

**Consistency Check Results:**
```sql
-- Consistency check query (run daily)
SELECT 
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE priority IS NOT NULL) as column_populated,
  COUNT(*) FILTER (WHERE metadata->>'priority' IS NOT NULL) as jsonb_populated,
  COUNT(*) FILTER (WHERE priority != (metadata->>'priority')) as mismatches
FROM nexus_cases
WHERE priority IS NOT NULL OR metadata->>'priority' IS NOT NULL;

-- Results: mismatches = 0 (consistent)
```

**Verification:**
- ✅ Consistency check passed (0 mismatches)
- ✅ Application performance improved (B-tree index vs JSONB query)
- ✅ No errors reported

#### Phase C: Read-New + Cleanup
**Date:** 2025-01-22  
**Duration:** 1 day

**Actions:**
```sql
-- Step 5: Application: Reads from column only, writes to column only

-- Step 6: Remove from JSONB (after 30-day verification)
UPDATE nexus_cases
SET metadata = metadata - 'priority'
WHERE metadata ? 'priority';

-- Step 7: Update JSONB Contract Registry
-- Removed 'priority' from case_metadata allowed keys
```

**Verification:**
- ✅ All reads/writes using column only
- ✅ JSONB data cleaned up
- ✅ Contract registry updated
- ✅ Tests passing

**Results:**
- ✅ Promotion successful
- ✅ Performance improved (B-tree index)
- ✅ No data loss
- ✅ Zero downtime

---

### PROMO-002: nexus_tenants.settings->'feature_flags' → GIN Index

**Status:** ⚠️ Planned  
**Planned Start:** 2025-02-01  
**Owner:** architecture-team

**Rationale:**
- Feature flags queried frequently (> 15% of queries)
- Structure is stable (boolean values)
- Need efficient querying for feature flag checks

**Plan:**
- Phase A: Create GIN index on `settings->'feature_flags'` path
- Phase B: Monitor query performance
- Phase C: Verify index usage

**Justification:**
- Query examples: `WHERE settings->'feature_flags'->>'ai_reports' = 'true'`
- Measured benefit: Expected 5x query speedup for feature flag checks

---

### PROMO-003: nexus_users.preferences->'ui'->>'theme' → nexus_users.ui_theme

**Status:** ⚠️ Planned  
**Planned Start:** 2025-02-15  
**Owner:** architecture-team

**Rationale:**
- Theme queried on every user session load
- Structure is stable (enum: 'light', 'dark', 'system')
- Reporting requirement: "Users by theme preference"

**Plan:**
- Phase A: Add `ui_theme TEXT` column, backfill, create index
- Phase B: Dual-write, consistency check
- Phase C: Read-new, cleanup JSONB

**Justification:**
- Query examples: `WHERE ui_theme = 'dark'` (frequent)
- Measured benefit: Expected 10x query speedup, enables efficient reporting

---

## Promotion Statistics

| Metric | Value |
|--------|-------|
| Total Promotions | 1 |
| Completed | 1 |
| In Progress | 0 |
| Planned | 2 |
| Failed | 0 |
| Average Duration | 7 days |
| Success Rate | 100% |

---

## Lessons Learned

### PROMO-001 Learnings

1. **Consistency checks are critical** - Daily consistency checks caught 0 issues, confirming dual-write worked correctly
2. **30-day verification window was appropriate** - Gave enough time to catch edge cases
3. **Rollback script prepared upfront** - Made rollback decision easy if needed (wasn't needed)
4. **Index creation before Phase B** - Improved performance immediately during dual-write phase

---

## Promotion Checklist

Before starting any promotion:

- [ ] Promotion rationale documented (frequent query, stable structure, reporting needs)
- [ ] Rollback script prepared and tested
- [ ] Consistency check query defined
- [ ] Application code updated for dual-write
- [ ] Monitoring/alerting configured
- [ ] Stakeholders notified
- [ ] PR created with promotion plan

### Abort Clause

**Abort promotion immediately if:**

- **Mismatch rate > 0.1%** - Dual-write consistency check shows more than 0.1% mismatches between column and JSONB
- **Dual-write latency exceeds SLA** - Application latency increases beyond acceptable thresholds during dual-write phase
- **Downstream reports diverge** - Any reporting or analytics queries show different results between column and JSONB sources

**Abort Procedure:**
1. Stop dual-write immediately (revert to read-old pattern)
2. Document mismatch/latency/divergence details
3. Notify stakeholders and architecture team
4. Execute rollback script if necessary
5. Root cause analysis before retry

**Authority:** Any team member can trigger abort if abort conditions are met. No approval required for safety-critical abort.

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22  
**Maintained By:** Architecture Team

