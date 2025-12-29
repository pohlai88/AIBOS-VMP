# Supabase Cron Jobs: Complete Guide

**Version:** 1.0.0  
**Last Updated:** 2025-01-22  
**Status:** Active  
**Purpose:** Comprehensive guide to Supabase Cron Jobs - scheduled SQL functions using pg_cron  
**Auto-Generated:** No

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Cron Syntax](#cron-syntax)
4. [Common Patterns](#common-patterns)
5. [Advanced Features](#advanced-features)
6. [Best Practices](#best-practices)
7. [Related Documentation](#related-documentation)

---

## 🎯 Overview

### What is pg_cron?

**pg_cron** is a Postgres extension that allows you to **schedule SQL functions** to run automatically on a schedule.

### Key Features

- ✅ **SQL-Based Scheduling** - Schedule any SQL function
- ✅ **Cron Syntax** - Standard cron expressions
- ✅ **Database Integration** - Runs within Postgres transaction
- ✅ **Job Management** - List, enable, disable jobs
- ✅ **Error Handling** - Automatic retry and logging

---

## 🚀 Getting Started

### Enable Extension

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Create Scheduled Job

```sql
-- Schedule daily cleanup
SELECT cron.schedule(
  'daily-cleanup',           -- Job name
  '0 2 * * *',              -- Cron expression (2 AM daily)
  $$DELETE FROM sessions WHERE expires_at < NOW()$$
);
```

### List Jobs

```sql
-- List all scheduled jobs
SELECT * FROM cron.job;
```

### Run Job Manually

```sql
-- Run job immediately
SELECT cron.run_job('daily-cleanup');
```

---

## ⏰ Cron Syntax

### Basic Format

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

### Common Patterns

```sql
-- Every minute
'* * * * *'

-- Every hour (at minute 0)
'0 * * * *'

-- Daily at 2 AM
'0 2 * * *'

-- Every Monday at 9 AM
'0 9 * * 1'

-- First day of month at midnight
'0 0 1 * *'

-- Every 15 minutes
'*/15 * * * *'

-- Every weekday at 9 AM
'0 9 * * 1-5'
```

---

## 📊 Common Patterns

### Pattern 1: Data Cleanup

```sql
-- Clean up expired sessions daily
SELECT cron.schedule(
  'cleanup-expired-sessions',
  '0 2 * * *',
  $$
    DELETE FROM vmp_sessions
    WHERE expires_at < NOW() - INTERVAL '1 day';
  $$
);
```

### Pattern 2: Report Generation

```sql
-- Generate daily reports
SELECT cron.schedule(
  'generate-daily-reports',
  '0 6 * * *',
  $$
    INSERT INTO daily_reports (date, metrics)
    SELECT 
      CURRENT_DATE,
      jsonb_build_object(
        'total_cases', COUNT(*),
        'open_cases', COUNT(*) FILTER (WHERE status = 'open'),
        'resolved_cases', COUNT(*) FILTER (WHERE status = 'resolved')
      )
    FROM nexus_cases
    WHERE created_at::date = CURRENT_DATE - INTERVAL '1 day';
  $$
);
```

### Pattern 3: Cache Warming

```sql
-- Warm cache every hour
SELECT cron.schedule(
  'warm-cache',
  '0 * * * *',
  $$
    -- Pre-compute expensive queries
    REFRESH MATERIALIZED VIEW CONCURRENTLY case_statistics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY payment_summary;
  $$
);
```

### Pattern 4: Data Aggregation

```sql
-- Aggregate metrics hourly
SELECT cron.schedule(
  'aggregate-metrics',
  '0 * * * *',
  $$
    INSERT INTO hourly_metrics (hour, metric_type, value)
    SELECT 
      date_trunc('hour', created_at),
      'cases_created',
      COUNT(*)
    FROM nexus_cases
    WHERE created_at >= date_trunc('hour', NOW()) - INTERVAL '1 hour'
    GROUP BY date_trunc('hour', created_at);
  $$
);
```

### Pattern 5: Scheduled Notifications

```sql
-- Send scheduled notifications
SELECT cron.schedule(
  'send-scheduled-notifications',
  '*/5 * * * *',  -- Every 5 minutes
  $$
    INSERT INTO nexus_notification_queue (user_id, type, data)
    SELECT 
      user_id,
      'reminder',
      jsonb_build_object('case_id', id, 'due_at', sla_due_at)
    FROM nexus_cases
    WHERE 
      status IN ('open', 'in_progress')
      AND sla_due_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
      AND NOT EXISTS (
        SELECT 1 FROM nexus_notification_queue
        WHERE case_id = nexus_cases.id
          AND type = 'reminder'
          AND created_at > NOW() - INTERVAL '1 hour'
      );
  $$
);
```

---

## 🚀 Advanced Features

### Pattern 6: Conditional Execution

```sql
-- Only run if conditions are met
SELECT cron.schedule(
  'conditional-cleanup',
  '0 3 * * *',
  $$
    DO $$
    BEGIN
      -- Only cleanup if table has old data
      IF EXISTS (
        SELECT 1 FROM audit_logs
        WHERE created_at < NOW() - INTERVAL '90 days'
        LIMIT 1
      ) THEN
        DELETE FROM audit_logs
        WHERE created_at < NOW() - INTERVAL '90 days';
      END IF;
    END $$;
  $$
);
```

### Pattern 7: Error Handling

```sql
-- Job with error handling
SELECT cron.schedule(
  'safe-data-migration',
  '0 4 * * *',
  $$
    DO $$
    BEGIN
      -- Wrap in transaction
      BEGIN
        -- Your migration logic
        UPDATE nexus_cases
        SET metadata = jsonb_set(metadata, '{migrated}', 'true')
        WHERE metadata->>'migrated' IS NULL;
        
        -- Log success
        INSERT INTO cron_job_logs (job_name, status, message)
        VALUES ('safe-data-migration', 'success', 'Migration completed');
      EXCEPTION WHEN OTHERS THEN
        -- Log error
        INSERT INTO cron_job_logs (job_name, status, message, error)
        VALUES ('safe-data-migration', 'error', 'Migration failed', SQLERRM);
        RAISE;
      END;
    END $$;
  $$
);
```

### Pattern 8: Chained Jobs

```sql
-- Job 1: Prepare data
SELECT cron.schedule(
  'prepare-data',
  '0 5 * * *',
  $$
    CREATE TEMP TABLE daily_stats AS
    SELECT * FROM generate_daily_statistics();
  $$
);

-- Job 2: Process data (runs after prepare-data)
SELECT cron.schedule(
  'process-data',
  '5 5 * * *',  -- 5 minutes after prepare-data
  $$
    INSERT INTO processed_stats
    SELECT * FROM daily_stats;
  $$
);
```

---

## 📊 Best Practices

### 1. Job Naming

```sql
-- Good naming
'cleanup-expired-sessions'
'generate-daily-reports'
'aggregate-hourly-metrics'

-- Bad naming
'job1'
'cleanup'
'task'
```

### 2. Schedule Optimization

- ✅ Run during low-traffic hours
- ✅ Avoid overlapping jobs
- ✅ Use appropriate frequency
- ✅ Consider timezone

### 3. Error Handling

```sql
-- Always handle errors
DO $$
BEGIN
  -- Your job logic
EXCEPTION WHEN OTHERS THEN
  -- Log error
  RAISE;
END $$;
```

### 4. Monitoring

```sql
-- Create job log table
CREATE TABLE IF NOT EXISTS cron_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Log job execution
INSERT INTO cron_job_logs (job_name, status, message)
VALUES ('my-job', 'success', 'Job completed successfully');
```

### 5. Performance

- ✅ Use indexes in job queries
- ✅ Limit data processed per run
- ✅ Use batch processing
- ✅ Monitor job execution time

---

## 🔧 Management

### List All Jobs

```sql
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job;
```

### Disable Job

```sql
-- Disable job
UPDATE cron.job
SET active = false
WHERE jobname = 'daily-cleanup';
```

### Enable Job

```sql
-- Enable job
UPDATE cron.job
SET active = true
WHERE jobname = 'daily-cleanup';
```

### Delete Job

```sql
-- Delete job
SELECT cron.unschedule('daily-cleanup');
```

### Update Job Schedule

```sql
-- Update schedule
SELECT cron.unschedule('daily-cleanup');
SELECT cron.schedule(
  'daily-cleanup',
  '0 3 * * *',  -- New schedule (3 AM instead of 2 AM)
  $$DELETE FROM sessions WHERE expires_at < NOW()$$
);
```

---

## 📚 Related Documentation

- [Supabase Platform Capabilities](./SUPABASE_PLATFORM_CAPABILITIES.md) - Full platform guide
- [Database Guide](./database/SCHEMA_REFERENCE.md) - Database schema
- [pg_cron Docs](https://github.com/citusdata/pg_cron) - pg_cron documentation

---

**Last Updated:** 2025-01-22  
**Next Review:** 2025-02-22

