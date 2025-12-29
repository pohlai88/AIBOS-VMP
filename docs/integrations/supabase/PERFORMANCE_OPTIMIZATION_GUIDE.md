# Supabase Performance Optimization Guide

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Comprehensive guide for optimizing Supabase database and API performance  
**Auto-Generated:** No

---

## 🎯 Overview

This guide provides **actionable strategies** for optimizing Supabase performance, based on the current audit findings and best practices.

---

## 🔍 Performance Audit Results

### Current Performance Issues

1. **RLS Policy Performance:** 9 policies re-evaluate auth functions per row
2. **Unused Indexes:** 200+ indexes never used
3. **Multiple Permissive Policies:** 60+ policy combinations causing overhead
4. **Query Patterns:** Some queries not optimized for scale

### Performance Score: 60% → Target: 85%

---

## ⚡ Quick Wins (Implement First)

### 1. Fix RLS Policy Initialization Plans

**Impact:** HIGH | **Effort:** LOW | **Time:** 1-2 hours

**Problem:** RLS policies call `auth.uid()` or `auth.jwt()` for each row, causing N+1 query pattern.

**Solution:** Wrap auth functions in subqueries to evaluate once per query.

```sql
-- ❌ SLOW: Re-evaluates for each row
CREATE POLICY "users_view_cases"
ON vmp_cases FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ✅ FAST: Evaluates once per query
CREATE POLICY "users_view_cases"
ON vmp_cases FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

**Affected Policies (Fix These First):**

```sql
-- realtime.messages
ALTER POLICY "users_receive_own_notifications" ON realtime.messages
USING ((SELECT auth.uid())::text = user_id);

ALTER POLICY "users_receive_own_dashboard_updates" ON realtime.messages
USING ((SELECT auth.uid())::text = user_id);

-- vmp_cases
ALTER POLICY "Internal users can delete cases in their tenant" ON vmp_cases
USING ((SELECT auth.uid())::uuid IN (
  SELECT id FROM vmp_vendor_users WHERE is_internal = true
));

-- vmp_messages
ALTER POLICY "Users can update their own messages" ON vmp_messages
USING ((SELECT auth.uid())::uuid = sender_user_id);

ALTER POLICY "Internal users can delete messages" ON vmp_messages
USING ((SELECT auth.uid())::uuid IN (
  SELECT id FROM vmp_vendor_users WHERE is_internal = true
));

-- vmp_evidence
ALTER POLICY "Internal users can delete evidence" ON vmp_evidence
USING ((SELECT auth.uid())::uuid IN (
  SELECT id FROM vmp_vendor_users WHERE is_internal = true
));

-- vmp_vendor_users
ALTER POLICY "Users can view vendor users in their vendor" ON vmp_vendor_users
USING ((SELECT auth.uid())::uuid = id);

-- vmp_sessions
ALTER POLICY "Users can manage their own sessions" ON vmp_sessions
USING ((SELECT auth.uid())::uuid = user_id);

-- vmp_invites (3 policies)
ALTER POLICY "Internal users can create invites for their vendor" ON vmp_invites
USING ((SELECT auth.uid())::uuid IN (
  SELECT id FROM vmp_vendor_users WHERE is_internal = true
));

ALTER POLICY "Internal users can update invites for their vendor" ON vmp_invites
USING ((SELECT auth.uid())::uuid IN (
  SELECT id FROM vmp_vendor_users WHERE is_internal = true
));

ALTER POLICY "Internal users can delete invites for their vendor" ON vmp_invites
USING ((SELECT auth.uid())::uuid IN (
  SELECT id FROM vmp_vendor_users WHERE is_internal = true
));
```

**Expected Improvement:** 20-30% faster queries on affected tables

---

### 2. Consolidate Multiple Permissive Policies

**Impact:** HIGH | **Effort:** MEDIUM | **Time:** 4-6 hours

**Problem:** Multiple permissive policies on the same table/role/action must all be evaluated.

**Solution:** Consolidate into single policy with OR conditions.

**Example: Documents Table**

```sql
-- ❌ BEFORE: Multiple policies (slow)
CREATE POLICY "admins_delete_documents" ON documents FOR DELETE ...
CREATE POLICY "users_delete_tenant_documents" ON documents FOR DELETE ...

-- ✅ AFTER: Single consolidated policy (fast)
DROP POLICY IF EXISTS "admins_delete_documents" ON documents;
DROP POLICY IF EXISTS "users_delete_tenant_documents" ON documents;

CREATE POLICY "users_delete_documents" ON documents FOR DELETE
TO authenticated
USING (
  -- Admin check
  (SELECT (auth.jwt() ->> 'role')) = 'admin'
  OR
  -- User check
  tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid)
);
```

**Tables to Consolidate:**
- `company_groups` (16 combinations)
- `documents` (12 combinations)
- `payments` (12 combinations)
- `statements` (12 combinations)
- `tenants` (4 combinations)
- `users` (8 combinations)
- `document_embeddings` (4 combinations)

**Expected Improvement:** 15-25% faster policy evaluation

---

### 3. Index Optimization Strategy

**Impact:** MEDIUM | **Effort:** MEDIUM | **Time:** Ongoing (30-day monitoring)

**Problem:** 200+ unused indexes consuming storage and slowing writes.

**Solution:** Monitor → Analyze → Remove → Add

#### Step 1: Monitor Index Usage (30 days)

```sql
-- Create monitoring view
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  pg_relation_size(indexrelid) as size_bytes
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, size_bytes DESC;

-- Check unused indexes
SELECT * FROM index_usage_stats
WHERE index_scans = 0
AND size_bytes > 1024 * 1024  -- Larger than 1MB
ORDER BY size_bytes DESC;
```

#### Step 2: Remove Unused Indexes (After 30 days)

```sql
-- Example: Remove unused index
DROP INDEX IF EXISTS idx_global_metadata_standard_pack;

-- Batch removal script (review carefully!)
DO $$
DECLARE
  idx_record RECORD;
BEGIN
  FOR idx_record IN 
    SELECT indexname, tablename
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
      AND idx_scan = 0
      AND pg_relation_size(indexrelid) > 1024 * 1024
      AND indexname NOT LIKE '%_pkey'  -- Keep primary keys
      AND indexname NOT LIKE '%_fkey'   -- Keep foreign keys (usually)
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', idx_record.indexname);
    RAISE NOTICE 'Dropped index: %', idx_record.indexname;
  END LOOP;
END $$;
```

#### Step 3: Add Missing Indexes (Based on Query Patterns)

```sql
-- Analyze slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- Queries slower than 100ms
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Add composite indexes for common patterns
CREATE INDEX idx_nexus_cases_status_priority_created 
ON nexus_cases(status, priority, created_at DESC)
WHERE status IN ('open', 'in_progress');

-- Partial index for active records
CREATE INDEX idx_vmp_cases_active 
ON vmp_cases(tenant_id, status, created_at)
WHERE status != 'closed';
```

**Expected Improvement:** 
- Storage reduction: 15-20%
- Write performance: 10-15% faster
- Query performance: 5-10% faster (with new indexes)

---

## 🎯 Medium-Term Optimizations

### 4. Query Optimization

**Impact:** MEDIUM | **Effort:** MEDIUM | **Time:** Ongoing

#### Enable Query Monitoring

```sql
-- pg_stat_statements is already enabled ✅
-- Check slow queries weekly
SELECT 
  LEFT(query, 100) as query_preview,
  calls,
  mean_exec_time,
  max_exec_time,
  (total_exec_time / 1000) as total_seconds
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

#### Common Query Patterns to Optimize

**Pattern 1: N+1 Queries**
```sql
-- ❌ BAD: Multiple queries
SELECT * FROM nexus_cases WHERE id = $1;
SELECT * FROM nexus_case_messages WHERE case_id = $1;
SELECT * FROM nexus_case_evidence WHERE case_id = $1;

-- ✅ GOOD: Single query with JOINs
SELECT 
  c.*,
  json_agg(DISTINCT m.*) as messages,
  json_agg(DISTINCT e.*) as evidence
FROM nexus_cases c
LEFT JOIN nexus_case_messages m ON m.case_id = c.case_id
LEFT JOIN nexus_case_evidence e ON e.case_id = c.case_id
WHERE c.id = $1
GROUP BY c.id;
```

**Pattern 2: Missing WHERE Clauses**
```sql
-- ❌ BAD: Full table scan
SELECT * FROM nexus_notifications ORDER BY created_at DESC LIMIT 10;

-- ✅ GOOD: Filtered query
SELECT * FROM nexus_notifications 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 10;
```

**Pattern 3: Unnecessary JSONB Operations**
```sql
-- ❌ BAD: JSONB extraction in WHERE
SELECT * FROM nexus_cases 
WHERE metadata->>'priority' = 'high';

-- ✅ GOOD: Extract to column or use GIN index
-- Option 1: Add column
ALTER TABLE nexus_cases ADD COLUMN priority TEXT;
UPDATE nexus_cases SET priority = metadata->>'priority';
CREATE INDEX idx_nexus_cases_priority ON nexus_cases(priority);

-- Option 2: Use GIN index
CREATE INDEX idx_nexus_cases_metadata_gin ON nexus_cases USING GIN (metadata);
SELECT * FROM nexus_cases WHERE metadata @> '{"priority": "high"}';
```

---

### 5. Connection Pooling

**Impact:** MEDIUM | **Effort:** LOW | **Time:** 1 hour

**Current State:** Pooler disabled in local config

**Recommendation:** Enable in production

```toml
# supabase/config.toml
[db.pooler]
enabled = true
pool_mode = "transaction"  # For serverless/Edge Functions
default_pool_size = 20
max_client_conn = 100
```

**Benefits:**
- Reduced connection overhead
- Better resource utilization
- Improved scalability

**Connection String:**
```
# Direct connection (bypasses pooler)
postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# Pooled connection (use this!)
postgresql://postgres:password@db.xxx.supabase.co:6543/postgres
```

---

### 6. Materialized Views for Complex Queries

**Impact:** MEDIUM | **Effort:** MEDIUM | **Time:** 2-4 hours

**Use Case:** Expensive aggregations or JOINs that are queried frequently

**Example:**
```sql
-- Create materialized view for dashboard
CREATE MATERIALIZED VIEW dashboard_case_summary AS
SELECT 
  tenant_id,
  DATE_TRUNC('day', created_at) as date,
  status,
  COUNT(*) as case_count,
  COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count
FROM nexus_cases
GROUP BY tenant_id, DATE_TRUNC('day', created_at), status;

-- Create index for fast lookups
CREATE INDEX idx_dashboard_case_summary_lookup 
ON dashboard_case_summary(tenant_id, date DESC);

-- Refresh periodically (via pg_cron)
SELECT cron.schedule(
  'refresh-dashboard-summary',
  '*/15 * * * *',  -- Every 15 minutes
  'REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_case_summary;'
);
```

---

## 🚀 Advanced Optimizations

### 7. Partitioning Large Tables

**Impact:** HIGH | **Effort:** HIGH | **Time:** 1-2 days

**Use Case:** Tables with millions of rows, especially time-series data

**Example: Audit Log Partitioning**
```sql
-- Partition by month
CREATE TABLE audit_events (
  id UUID DEFAULT gen_random_uuid(),
  table_name TEXT,
  record_id UUID,
  action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE audit_events_2025_01 PARTITION OF audit_events
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE audit_events_2025_02 PARTITION OF audit_events
FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Auto-create partitions (via pg_cron)
SELECT cron.schedule(
  'create-audit-partition',
  '0 0 1 * *',  -- First day of each month
  $$
    CREATE TABLE IF NOT EXISTS audit_events_$(date +%Y_%m)
    PARTITION OF audit_events
    FOR VALUES FROM (date_trunc('month', CURRENT_DATE))
    TO (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month');
  $$
);
```

---

### 8. Read Replicas for Read-Heavy Workloads

**Impact:** HIGH | **Effort:** MEDIUM | **Time:** 2-4 hours

**Use Case:** High read-to-write ratio, analytics queries

**Implementation:**
- Supabase Pro plan includes read replicas
- Route read queries to replica
- Route write queries to primary

```typescript
// Client-side routing
const primaryClient = createClient(SUPABASE_URL, SUPABASE_KEY);
const replicaClient = createClient(REPLICA_URL, SUPABASE_KEY);

// Use replica for reads
const { data } = await replicaClient
  .from('nexus_cases')
  .select('*')
  .eq('status', 'open');

// Use primary for writes
await primaryClient
  .from('nexus_cases')
  .update({ status: 'resolved' })
  .eq('id', caseId);
```

---

## 📊 Performance Monitoring

### Key Metrics to Track

1. **Query Performance**
   - Average query time
   - P95/P99 query times
   - Slow query count

2. **Index Usage**
   - Index hit ratio (target: >95%)
   - Unused indexes
   - Missing indexes

3. **Connection Pool**
   - Active connections
   - Idle connections
   - Connection wait time

4. **RLS Performance**
   - Policy evaluation time
   - Policy hit ratio

### Monitoring Queries

```sql
-- Overall database performance
SELECT 
  datname,
  numbackends as active_connections,
  xact_commit as transactions_committed,
  xact_rollback as transactions_rolled_back,
  blks_read as disk_blocks_read,
  blks_hit as cache_blocks_hit,
  round(100.0 * blks_hit / (blks_hit + blks_read), 2) as cache_hit_ratio
FROM pg_stat_database
WHERE datname = current_database();

-- Index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- Slow queries
SELECT 
  LEFT(query, 100) as query,
  calls,
  mean_exec_time,
  max_exec_time,
  (total_exec_time / 1000) as total_seconds
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## ✅ Performance Checklist

### Immediate (Week 1)
- [ ] Fix RLS policy initialization plans (9 policies)
- [ ] Enable connection pooling in production
- [ ] Set up query monitoring

### Short-Term (Week 2-4)
- [ ] Consolidate multiple permissive policies
- [ ] Monitor index usage for 30 days
- [ ] Optimize top 10 slowest queries
- [ ] Add composite indexes for common patterns

### Medium-Term (Month 2-3)
- [ ] Remove unused indexes (after monitoring)
- [ ] Implement materialized views for dashboards
- [ ] Set up read replicas (if needed)
- [ ] Implement query result caching

### Long-Term (Ongoing)
- [ ] Weekly performance review
- [ ] Monthly index optimization
- [ ] Quarterly architecture review
- [ ] Continuous query optimization

---

## 🔗 Related Documentation

- [SUPABASE_AUDIT_AND_OPTIMIZATION.md](./SUPABASE_AUDIT_AND_OPTIMIZATION.md)
- [Supabase Performance Guide](https://supabase.com/docs/guides/database/performance)
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22

